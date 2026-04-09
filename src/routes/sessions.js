'use strict';

const express = require('express');
const { v4: uuidv4 } = require('uuid');
const { RtcTokenBuilder, RtcRole } = require('agora-access-token');
const router = express.Router();

const store = require('../services/sessionStore');
const formulaService = require('../services/formulaService');
const mailService = require('../services/mailService');
const db = require('../db');
const { QUESTIONS_FR, QUESTIONS_EN, enrichQuestions } = require('../data/questions');

// ── Helper : normalisation des choix (comme Python) ───────────────────
function normalizeStr(s) {
  return s.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
}

function canonicalChoice(submitted, validLabels) {
  const normSubmitted = normalizeStr(submitted);
  const submittedPrefix = normSubmitted.split(' - ')[0].trim();

  for (const label of validLabels) {
    if (normalizeStr(label) === normSubmitted) return label;
  }
  for (const label of validLabels) {
    const lp = normalizeStr(label).split(' - ')[0].trim();
    if (lp === submittedPrefix) return label;
  }
  for (const label of validLabels) {
    const lp = normalizeStr(label).split(' - ')[0].trim();
    if (submittedPrefix.includes(lp) || lp.includes(submittedPrefix)) return label;
  }
  return submitted;
}

function normalizeChoices(choices, validLabels) {
  return choices.map(c => canonicalChoice(c, validLabels));
}

// ── Token Agora ────────────────────────────────────────────────────────
function generateAgoraToken(roomName) {
  const appId = process.env.AGORA_APP_ID;
  const cert = process.env.AGORA_APP_CERTIFICATE;
  if (!cert || cert === 'YOUR_AGORA_APP_CERTIFICATE') return null;
  const expireTime = Math.floor(Date.now() / 1000) + 3600;
  return RtcTokenBuilder.buildTokenWithUid(appId, cert, roomName, 0, RtcRole.PUBLISHER, expireTime);
}

// ── POST /api/session/start ────────────────────────────────────────────
router.post('/session/start', async (req, res) => {
  try {
    const {
      language = 'fr',
      voice_gender = 'female',
      question_count = 1,
      mode = 'guided',
      input_mode = 'voice',
      email = null,
      avatar = true,
    } = req.body;

    // Vérification client si email fourni
    if (email) {
      const customer = await db.getCustomerByEmail(email);
      if (customer) {
        if (parseInt(customer.sessions_available) <= 0) {
          return res.status(403).json({ detail: 'Aucune session disponible' });
        }
        const today = new Date().toISOString().slice(0, 10);
        if (customer.max_date && today > customer.max_date) {
          return res.status(403).json({ detail: "Date d'accès expirée" });
        }
        await db.updateCustomer(customer.id, { sessions_available: String(parseInt(customer.sessions_available) - 1) });
      } else {
        const member = await db.getTeamMemberByEmail(email);
        if (!member) return res.status(404).json({ detail: 'Email introuvable' });
      }
    }

    const sessionId = uuidv4();
    const roomName = `room_${sessionId}`;
    const userIdentity = `user_${sessionId}`;

    const voiceMapping = {
      fr: { female: process.env.VOICE_FR_FEMALE, male: process.env.VOICE_FR_MALE },
      en: { female: process.env.VOICE_EN_FEMALE, male: process.env.VOICE_EN_MALE },
    };
    const voiceId = voiceMapping[language]?.[voice_gender] || process.env.VOICE_FR_FEMALE;

    const questionsPool = language === 'fr' ? QUESTIONS_FR : QUESTIONS_EN;
    const questions = enrichQuestions(questionsPool.slice(0, question_count));

    store.saveSessionMeta(sessionId, {
      language,
      voiceGender: voice_gender,
      voiceId,
      roomName,
      questions,
      mode,
      inputMode: input_mode,
      customerEmail: email,
      avatar,
    });

    const token = generateAgoraToken(roomName);

    res.json({
      session_id: sessionId,
      room_name: roomName,
      token,
      agora_app_id: process.env.AGORA_APP_ID,
      identity: userIdentity,
    });
  } catch (err) {
    console.error('[session/start]', err);
    res.status(500).json({ detail: `Erreur création session: ${err.message}` });
  }
});

// ── GET /api/session/:id ───────────────────────────────────────────────
router.get('/session/:id', (req, res) => {
  const session = store.getSessionMeta(req.params.id);
  if (!session) return res.status(404).json({ detail: 'Session not found' });
  res.json(session);
});

// ── DELETE /api/session/:id ────────────────────────────────────────────
router.delete('/session/:id', (req, res) => {
  const existed = store.deleteSession(req.params.id);
  if (!existed) return res.status(404).json({ detail: 'Session not found' });
  res.json({ status: 'ok', session_id: req.params.id });
});

// ── GET /api/session_list ──────────────────────────────────────────────
router.get('/session_list', (req, res) => {
  res.json(store.listSessionIds());
});

// ── POST /api/session/:id/save-answer ─────────────────────────────────
router.post('/session/:id/save-answer', (req, res) => {
  const sessionId = req.params.id;
  if (!store.isProfileComplete(sessionId)) {
    return res.status(400).json({ detail: 'Profile incomplete, cannot save answers yet' });
  }

  const { question_id, question_text, top_2, bottom_2 } = req.body;
  const meta = store.getSessionMeta(sessionId);
  let normalizedTop2 = top_2;
  let normalizedBottom2 = bottom_2;

  if (meta) {
    const question = (meta.questions || []).find(q => q.id === question_id);
    if (question) {
      const validLabels = question.choices.map(c => (typeof c === 'object' ? c.label : c));
      normalizedTop2 = normalizeChoices(top_2, validLabels);
      normalizedBottom2 = normalizeChoices(bottom_2, validLabels);
    }
  }

  store.saveAnswer(sessionId, question_id, question_text, normalizedTop2, normalizedBottom2);
  res.json({ status: 'ok' });
});

// ── GET /api/session/:id/answers ───────────────────────────────────────
router.get('/session/:id/answers', (req, res) => {
  const data = store.getSessionAnswers(req.params.id);
  if (!data) return res.status(404).json({ detail: 'Session not found' });
  res.json(data);
});

// ── POST /api/session/:id/save-profile ────────────────────────────────
router.post('/session/:id/save-profile', (req, res) => {
  const sessionId = req.params.id;
  const { field, value } = req.body;
  store.saveUserProfile(sessionId, field, value);
  const complete = store.isProfileComplete(sessionId);
  const missing = store.getMissingProfileFields(sessionId);
  const state = complete ? 'questionnaire' : 'collecting_profile';
  res.json({ status: 'ok', state, profile_complete: complete, missing_fields: missing });
});

// ── GET /api/session/:id/profile ──────────────────────────────────────
router.get('/session/:id/profile', (req, res) => {
  const profile = store.getUserProfile(req.params.id);
  if (!profile) return res.status(404).json({ detail: 'Profile not found' });
  res.json(profile);
});

// ── GET /api/session/:id/state ────────────────────────────────────────
router.get('/session/:id/state', (req, res) => {
  const sessionId = req.params.id;
  const state = store.getSessionState(sessionId);
  const complete = store.isProfileComplete(sessionId);
  const missing = store.getMissingProfileFields(sessionId);
  const mailAvailable = store.getSelectedFormula(sessionId) !== null;
  res.json({ state, profile_complete: complete, missing_fields: missing, mail_available: mailAvailable });
});

// ── POST /api/session/:id/generate-formulas ───────────────────────────
router.post('/session/:id/generate-formulas', (req, res) => {
  const sessionId = req.params.id;
  if (!store.isProfileComplete(sessionId)) {
    return res.status(400).json({ detail: 'Profile incomplete, cannot generate formulas' });
  }
  const { formula_type = null } = req.body || {};
  const result = formulaService.generateFormulas(sessionId, formula_type);
  if (result.error) return res.status(400).json({ detail: result.error });
  res.json(result);
});

// ── POST /api/session/:id/select-formula ─────────────────────────────
router.post('/session/:id/select-formula', async (req, res) => {
  const sessionId = req.params.id;
  const { formula_index } = req.body;
  const result = formulaService.selectFormula(sessionId, formula_index);
  if (result.error) return res.status(400).json({ detail: result.error });

  // Envoi email en arrière-plan
  const formula = result.formula;
  setImmediate(async () => {
    const internalEmail = process.env.INTERNAL_EMAIL;
    if (!internalEmail) return;
    const recipients = internalEmail.split(',').map(e => e.trim()).filter(Boolean);
    for (const email of recipients) {
      try { await mailService.sendMail(email, sessionId, formula); } catch (e) { console.error('[mail]', e.message); }
      try { await mailService.sendInternalFormulaMail(email, sessionId, formula); } catch (e) { console.error('[mail internal]', e.message); }
    }
  });

  res.json(result);
});

// ── POST /api/session/:id/change-formula-type ─────────────────────────
router.post('/session/:id/change-formula-type', (req, res) => {
  const { formula_type } = req.body;
  const result = formulaService.changeSelectedFormulaType(req.params.id, formula_type);
  if (result.error) return res.status(400).json({ detail: result.error });
  res.json(result);
});

// ── GET /api/session/:id/available-ingredients/:noteType ──────────────
router.get('/session/:id/available-ingredients/:noteType', (req, res) => {
  const result = formulaService.getAvailableIngredients(req.params.id, req.params.noteType);
  if (result.error) return res.status(400).json({ detail: result.error });
  res.json(result);
});

// ── POST /api/session/:id/replace-note ────────────────────────────────
router.post('/session/:id/replace-note', async (req, res) => {
  const sessionId = req.params.id;
  const { note_type, old_note, new_note } = req.body;
  const result = formulaService.replaceNote(sessionId, note_type, old_note, new_note);
  if (result.error) return res.status(400).json({ detail: result.error });

  const formula = store.getSelectedFormula(sessionId);
  if (formula) {
    setImmediate(async () => {
      const internalEmail = process.env.INTERNAL_EMAIL;
      if (!internalEmail) return;
      const recipients = internalEmail.split(',').map(e => e.trim()).filter(Boolean);
      for (const email of recipients) {
        try { await mailService.sendMail(email, sessionId, formula); } catch (e) { console.error('[mail]', e.message); }
        try { await mailService.sendInternalFormulaMail(email, sessionId, formula); } catch (e) { console.error('[mail internal]', e.message); }
      }
    });
  }

  res.json(result);
});

// ── GET /api/sessions/all-answers ─────────────────────────────────────
router.get('/sessions/all-answers', (req, res) => {
  res.json(store.getAllSessions());
});

module.exports = router;
