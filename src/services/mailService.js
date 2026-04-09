'use strict';

const nodemailer = require('nodemailer');
const path = require('path');
const store = require('./sessionStore');

const IMAGES_DIR = path.resolve(__dirname, '../../app/static/images');

const LABELS = {
  fr: {
    subject: 'Votre formule de parfum personnalisée',
    greeting: 'Bonjour,',
    subtext: 'Voici votre formule de parfum personnalisée.',
    top: 'Notes de tête',
    heart: 'Notes de cœur',
    base: 'Notes de fond',
    goodbye: 'Merci pour votre visite. Nous espérons vous retrouver très bientôt pour créer votre prochaine fragrance. À bientôt !',
  },
  en: {
    subject: 'Your personalized fragrance formula',
    greeting: 'Hello,',
    subtext: 'Here is your personalized fragrance formula.',
    top: 'Top notes',
    heart: 'Heart notes',
    base: 'Base notes',
    goodbye: 'Thank you for your visit. We hope to see you again very soon to create your next fragrance. See you soon!',
  },
};

function _createTransport() {
  return nodemailer.createTransport({
    host: process.env.SMTP_HOST,
    port: parseInt(process.env.SMTP_PORT || '587'),
    secure: false,
    auth: { user: process.env.SMTP_USER, pass: process.env.SMTP_PASSWORD },
  });
}

function _top3ByMl(notes) {
  return [...notes].sort((a, b) => (b.ml || 0) - (a.ml || 0)).slice(0, 3);
}

function _renderNoteSection(title, notes) {
  if (!notes || notes.length === 0) return '';
  const rows = notes.map(n =>
    `<tr>
      <td style="font-size:0.92rem;padding:3px 0;line-height:1.6;">${n.name}</td>
      <td style="font-size:0.82rem;color:#bbb;text-align:right;white-space:nowrap;padding-left:16px;">${n.ml} ml</td>
    </tr>`
  ).join('');
  return `<div style="margin-bottom:18px;">
    <p style="font-size:0.75rem;text-transform:uppercase;letter-spacing:0.09em;color:#aaa;font-weight:bold;margin:0 0 7px;padding-bottom:5px;border-bottom:1px solid #efefef;">${title}</p>
    <table style="border-collapse:collapse;width:100%;"><tbody>${rows}</tbody></table>
  </div>`;
}

function buildFormulaHtml(profile, description, notes30ml, language = 'fr') {
  const labels = LABELS[language] || LABELS.fr;
  const top = _top3ByMl(notes30ml.top_notes || []);
  const heart = _top3ByMl(notes30ml.heart_notes || []);
  const base = _top3ByMl(notes30ml.base_notes || []);
  const notesHtml = _renderNoteSection(labels.top, top) + _renderNoteSection(labels.heart, heart) + _renderNoteSection(labels.base, base);

  return `<!DOCTYPE html>
<html lang="${language}">
<head><meta charset="UTF-8"/><meta name="viewport" content="width=device-width,initial-scale=1.0"/><title>${profile}</title></head>
<body style="font-family:Arial,sans-serif;background:#faf9f7;margin:0;padding:0;color:#333;">
  <div style="max-width:600px;margin:0 auto;background:#ffffff;padding:40px 36px;">
    <p style="font-size:1rem;margin:0 0 4px;">${labels.greeting}</p>
    <p style="font-size:1rem;color:#666;margin:0 0 28px;">${labels.subtext}</p>
    <p style="font-size:1.4rem;font-weight:bold;letter-spacing:0.04em;margin:0 0 6px;">${profile}</p>
    <p style="font-style:italic;color:#888;font-size:0.92rem;margin:0 0 28px;">${description}</p>
    ${notesHtml}
    <p style="margin-top:40px;padding-top:24px;border-top:1px solid #efefef;font-size:0.88rem;color:#888;font-style:italic;line-height:1.6;">${labels.goodbye}</p>
  </div>
</body>
</html>`;
}

function buildInternalHtml(formula) {
  const profile = formula.profile || '';
  const description = formula.description || '';
  const formulaType = formula.formula_type || '';
  const sizes = formula.sizes || {};

  let sizesHtml = '';
  for (const sizeLabel of ['10ml', '30ml', '50ml']) {
    const sizeData = sizes[sizeLabel];
    if (!sizeData) continue;

    const notesRows = (notes) => notes.map(n =>
      `<tr><td style="padding:3px 8px 3px 0;font-size:0.9rem;">${n.name}</td><td style="padding:3px 0;font-size:0.9rem;color:#555;text-align:right;">${n.ml} ml</td></tr>`
    ).join('');

    const sections = [
      ['Notes de tête', sizeData.top_notes || []],
      ['Notes de cœur', sizeData.heart_notes || []],
      ['Notes de fond', sizeData.base_notes || []],
      ['Booster', sizeData.boosters || []],
    ];

    let sectionsHtml = '';
    for (const [title, notes] of sections) {
      if (!notes.length) continue;
      sectionsHtml += `<p style="margin:12px 0 4px;font-size:0.75rem;text-transform:uppercase;letter-spacing:0.08em;color:#aaa;font-weight:bold;">${title}</p>
        <table style="border-collapse:collapse;width:100%;"><tbody>${notesRows(notes)}</tbody></table>`;
    }
    sizesHtml += `<div style="margin-bottom:24px;padding:16px;background:#f9f9f9;border-radius:6px;">
      <p style="margin:0 0 10px;font-weight:bold;font-size:1rem;">${sizeLabel}</p>${sectionsHtml}</div>`;
  }

  return `<!DOCTYPE html><html lang="fr"><head><meta charset="UTF-8"/><title>[Interne] ${profile}</title></head>
<body style="font-family:Arial,sans-serif;background:#faf9f7;margin:0;padding:0;color:#333;">
  <div style="max-width:600px;margin:0 auto;background:#ffffff;padding:40px 36px;">
    <p style="font-size:0.75rem;text-transform:uppercase;letter-spacing:0.1em;color:#bbb;margin:0 0 16px;">Récapitulatif interne</p>
    <p style="font-size:1.4rem;font-weight:bold;letter-spacing:0.04em;margin:0 0 4px;">${profile}</p>
    <p style="font-style:italic;color:#888;font-size:0.92rem;margin:0 0 6px;">${description}</p>
    <p style="font-size:0.82rem;color:#aaa;margin:0 0 28px;">Type : ${formulaType}</p>
    ${sizesHtml}
  </div>
</body></html>`;
}

async function sendMail(toEmail, sessionId, formula) {
  const meta = store.getSessionMeta(sessionId);
  const language = meta?.language || 'fr';
  const labels = LABELS[language] || LABELS.fr;
  const notes30ml = formula.sizes?.['30ml'] || {};
  const html = buildFormulaHtml(formula.profile || '', formula.description || '', notes30ml, language);

  const transport = _createTransport();
  await transport.sendMail({
    from: process.env.SMTP_FROM || process.env.SMTP_USER,
    to: toEmail,
    subject: labels.subject,
    html,
  });
}

async function sendInternalFormulaMail(toEmail, sessionId, formula) {
  const html = buildInternalHtml(formula);
  const profile = formula.profile || 'formule';
  const transport = _createTransport();
  await transport.sendMail({
    from: process.env.SMTP_FROM || process.env.SMTP_USER,
    to: toEmail,
    subject: `[Lylo Interne] ${profile} — Fiche complète`,
    html,
  });
}

async function sendTestMail(toEmail) {
  const html = buildFormulaHtml('Cosy', 'Un parfum chaleureux et enveloppant.', {
    top_notes: [{ name: 'Bergamote', ml: 4.5 }, { name: 'Rose', ml: 4.0 }],
    heart_notes: [{ name: 'Jasmin', ml: 2.5 }],
    base_notes: [{ name: 'Santal blanc', ml: 5.5 }],
  }, 'fr');
  const transport = _createTransport();
  await transport.sendMail({
    from: process.env.SMTP_FROM || process.env.SMTP_USER,
    to: toEmail,
    subject: '[Lylo] Test — Votre formule de parfum',
    html,
  });
}

function generateMailHtml(sessionId, formula) {
  return buildFormulaHtml(formula.profile || '', formula.description || '', formula.sizes?.['30ml'] || {});
}

module.exports = { sendMail, sendInternalFormulaMail, sendTestMail, generateMailHtml, buildFormulaHtml };
