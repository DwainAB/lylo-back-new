'use strict';

const express = require('express');
const router = express.Router();
const store = require('../services/sessionStore');
const mailService = require('../services/mailService');

router.get('/session/:id/mail', (req, res) => {
  const formula = store.getSelectedFormula(req.params.id);
  if (!formula) return res.status(404).json({ detail: 'No formula selected' });
  const html = mailService.generateMailHtml(req.params.id, formula);
  res.setHeader('Content-Type', 'text/html');
  res.send(html);
});

router.post('/session/:id/mail/send', async (req, res) => {
  try {
    const formula = store.getSelectedFormula(req.params.id);
    if (!formula) return res.status(404).json({ detail: 'No formula selected' });
    const { email } = req.body;
    if (!email) return res.status(400).json({ detail: 'email required' });
    await mailService.sendMail(email, req.params.id, formula);
    res.json({ status: 'ok' });
  } catch (err) {
    res.status(500).json({ detail: err.message });
  }
});

router.post('/mail/test', async (req, res) => {
  try {
    const { email } = req.body;
    if (!email) return res.status(400).json({ detail: 'email required' });
    await mailService.sendTestMail(email);
    res.json({ status: 'ok' });
  } catch (err) {
    res.status(500).json({ detail: err.message });
  }
});

module.exports = router;
