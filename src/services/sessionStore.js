'use strict';

// Session store en mémoire (identique au session_store.py Python)

const _meta = new Map();
const _answers = new Map();
const _profiles = new Map();
const _generatedFormulas = new Map();
const _selectedFormula = new Map();

const REQUIRED_PROFILE_FIELDS = new Set(['first_name', 'gender', 'age', 'has_allergies']);

function saveSessionMeta(sessionId, { language, voiceGender, voiceId, roomName, questions, mode = 'guided', inputMode = 'voice', customerEmail = null, avatar = true }) {
  _meta.set(sessionId, {
    language, voice_gender: voiceGender, voice_id: voiceId,
    room_name: roomName, questions, mode, input_mode: inputMode,
    avatar, customer_email: customerEmail,
    created_at: new Date().toISOString(),
  });
}

function getSessionMeta(sessionId) {
  const m = _meta.get(sessionId);
  return m ? { ...m } : null;
}

function listSessionIds() {
  return [..._meta.keys()];
}

function saveAnswer(sessionId, questionId, questionText, top2, bottom2) {
  if (!_answers.has(sessionId)) _answers.set(sessionId, {});
  _answers.get(sessionId)[String(questionId)] = {
    question: questionText,
    top_2: top2,
    bottom_2: bottom2,
    answered_at: new Date().toISOString(),
  };
}

function getSessionAnswers(sessionId) {
  if (!_meta.has(sessionId)) return null;
  return {
    session_id: sessionId,
    ..._meta.get(sessionId),
    answers: { ...(_answers.get(sessionId) || {}) },
  };
}

function saveUserProfile(sessionId, field, value) {
  if (!_profiles.has(sessionId)) _profiles.set(sessionId, {});
  _profiles.get(sessionId)[field] = value;
}

function getUserProfile(sessionId) {
  const p = _profiles.get(sessionId);
  return p ? { ...p } : null;
}

function isProfileComplete(sessionId) {
  const profile = _profiles.get(sessionId) || {};
  for (const f of REQUIRED_PROFILE_FIELDS) {
    if (!(f in profile)) return false;
  }
  const hasAllergies = (profile.has_allergies || '').toLowerCase();
  if ((hasAllergies === 'oui' || hasAllergies === 'yes') && !('allergies' in profile)) return false;
  return true;
}

function getMissingProfileFields(sessionId) {
  const profile = _profiles.get(sessionId) || {};
  const missing = [];
  for (const f of REQUIRED_PROFILE_FIELDS) {
    if (!(f in profile)) missing.push(f);
  }
  const hasAllergies = (profile.has_allergies || '').toLowerCase();
  if ((hasAllergies === 'oui' || hasAllergies === 'yes') && !('allergies' in profile)) missing.push('allergies');
  return missing;
}

function getSessionState(sessionId) {
  return isProfileComplete(sessionId) ? 'questionnaire' : 'collecting_profile';
}

function saveSelectedFormula(sessionId, formula) {
  _selectedFormula.set(sessionId, { ...formula });
}

function getSelectedFormula(sessionId) {
  const f = _selectedFormula.get(sessionId);
  return f ? { ...f } : null;
}

function saveGeneratedFormulas(sessionId, formulas) {
  _generatedFormulas.set(sessionId, [...formulas]);
}

function getGeneratedFormulas(sessionId) {
  const f = _generatedFormulas.get(sessionId);
  return f ? [...f] : null;
}

function getAllSessions() {
  return listSessionIds().map(id => getSessionAnswers(id)).filter(Boolean);
}

function deleteSession(sessionId) {
  const existed = _meta.has(sessionId);
  _meta.delete(sessionId);
  _answers.delete(sessionId);
  _profiles.delete(sessionId);
  _generatedFormulas.delete(sessionId);
  _selectedFormula.delete(sessionId);
  return existed;
}

module.exports = {
  saveSessionMeta, getSessionMeta, listSessionIds,
  saveAnswer, getSessionAnswers,
  saveUserProfile, getUserProfile,
  isProfileComplete, getMissingProfileFields, getSessionState,
  saveSelectedFormula, getSelectedFormula,
  saveGeneratedFormulas, getGeneratedFormulas,
  getAllSessions, deleteSession,
};
