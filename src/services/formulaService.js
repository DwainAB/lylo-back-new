'use strict';

const path = require('path');
const fs = require('fs');
const XLSX = require('xlsx');
const { EN_TO_FR_CHOICES } = require('../data/questions');
const { PROFILE_GENDERS, PROFILE_DESCRIPTIONS, PROFILE_DESCRIPTIONS_EN, INGREDIENT_EN_TO_FR, normalizeProfile } = require('../data/profiles');
const store = require('./sessionStore');

const DATA_DIR = path.resolve(__dirname, '../data');
const XLSX_PATH = path.join(DATA_DIR, 'Coffret-description.xlsx');
const NOTE_SCORING_PATH = path.join(DATA_DIR, 'note_scoring_mapping.json');

// Cache en mémoire
let _coffret = null;
let _noteScoring = null;

// ── Types de formules ──────────────────────────────────────────────────
const FORMULA_TYPE_CONFIGS = {
  frais: {
    note_counts: { top: 3, heart: 3, base: 2 },
    sizes: {
      10: { top_ml: 1, heart_ml: 1, base_ml: 2, booster_ml: 1 },
      30: { top_ml: 3, heart_ml: 3, base_ml: 6, booster_ml: 3 },
      50: { top_ml: 5, heart_ml: 5, base_ml: 10, booster_ml: 5 },
    },
  },
  mix: {
    note_counts: { top: 2, heart: 3, base: 2 },
    sizes: {
      10: { top_ml: 1, heart_ml: 1, base_ml: 2, booster_ml: 1 },
      30: { top_ml: 3, heart_ml: 3, base_ml: 6, booster_ml: 3 },
      50: { top_ml: 5, heart_ml: 5, base_ml: 10, booster_ml: 5 },
    },
  },
  puissant: {
    note_counts: { top: 2, heart: 2, base: 3 },
    sizes: {
      10: { top_ml: 1, heart_ml: 1, base_ml: 2, booster_ml: 1 },
      30: { top_ml: 2, heart_ml: 4, base_ml: 6, booster_ml: 3 },
      50: { top_ml: 4, heart_ml: 6, base_ml: 10, booster_ml: 5 },
    },
  },
};

const PROFILE_GENDER_TO_FORMULA_TYPE = {
  masculine: 'puissant',
  feminine: 'frais',
  unisex: 'mix',
};

const BOOSTERS = [
  { name: 'Floral', keywords: ['fleur', 'rose', 'jasmin', 'muguet', 'floral', 'flower', 'pétale', 'bouquet', 'pivoine', 'iris', 'ylang', 'néroli', 'magnolia', 'tubéreuse', 'gardénia'] },
  { name: 'Ambre doux', keywords: ['ambre', 'vanille', 'oriental', 'chaud', 'doux', 'warm', 'amber', 'gourmand', 'caramel', 'miel', 'tonka', 'baume', 'résine', 'encens', 'oud', 'boisé'] },
  { name: 'Musc blanc sec', keywords: ['musc', 'propre', 'frais', 'clean', 'musk', 'coton', 'savon', 'linge', 'poudré', 'aldéhyde', 'blanc', 'minéral', 'ozonic', 'aquatique', 'agrume', 'bergamote', 'citron', 'pamplemousse'] },
];

// ── Chargement XLSX ────────────────────────────────────────────────────
function _loadCoffret() {
  const wb = XLSX.readFile(XLSX_PATH, { cellFormula: false });
  const ws = wb.Sheets[wb.SheetNames[0]];
  const ingredients = [];

  const noteRanges = [
    { type: 'top', start: 7, end: 16 },
    { type: 'heart', start: 21, end: 30 },
    { type: 'base', start: 35, end: 44 },
  ];

  for (const { type, start, end } of noteRanges) {
    for (let row = start; row <= end; row++) {
      const position = ws[`A${row}`]?.v;
      if (!position) continue;
      ingredients.push({
        position,
        name: ws[`B${row}`]?.v || '',
        family: ws[`C${row}`]?.v || '',
        description: ws[`D${row}`]?.v || '',
        note_type: type,
        profile_1: normalizeProfile(ws[`G${row}`]?.v),
        profile_2: normalizeProfile(ws[`H${row}`]?.v),
      });
    }
  }

  // Feuille ALLERGENS
  const ws2 = wb.Sheets['ALLERGENS'];
  const allergenMap = {};

  const allergenBlocks = [
    { headerRow: 4, dataStart: 6, dataEnd: 31 },
    { headerRow: 33, dataStart: 35, dataEnd: 60 },
    { headerRow: 62, dataStart: 64, dataEnd: 89 },
  ];

  for (const { headerRow, dataStart, dataEnd } of allergenBlocks) {
    const colToIngredient = {};
    for (let col = 2; col <= 11; col++) {
      const cellAddr = XLSX.utils.encode_cell({ r: headerRow - 1, c: col - 1 });
      const val = ws2[cellAddr]?.v;
      if (val) colToIngredient[col] = String(val).trim();
    }

    for (let row = dataStart; row <= dataEnd; row++) {
      const allergenCell = ws2[XLSX.utils.encode_cell({ r: row - 1, c: 0 })];
      if (!allergenCell?.v) continue;
      const allergenName = String(allergenCell.v).trim();

      for (let col = 2; col <= 11; col++) {
        const cell = ws2[XLSX.utils.encode_cell({ r: row - 1, c: col - 1 })];
        if (cell?.v && String(cell.v).trim().toLowerCase() === 'x') {
          const ingName = colToIngredient[col];
          if (ingName) {
            if (!allergenMap[ingName]) allergenMap[ingName] = new Set();
            allergenMap[ingName].add(allergenName);
          }
        }
      }
    }
  }

  // Convertir les Set en Array
  const allergenMapFinal = {};
  for (const [k, v] of Object.entries(allergenMap)) allergenMapFinal[k] = [...v];

  return { ingredients, allergen_map: allergenMapFinal };
}

function getCoffret() {
  if (!_coffret) _coffret = _loadCoffret();
  return _coffret;
}

function getNoteScoring() {
  if (!_noteScoring) {
    _noteScoring = JSON.parse(fs.readFileSync(NOTE_SCORING_PATH, 'utf-8'));
  }
  return _noteScoring;
}

// ── Résolution d'un choix vers sa clé anglaise dans le mapping ────────
function resolveEnChoice(choice, qid, qChoicesMapping) {
  if (choice in qChoicesMapping) return choice;

  const choicePrefix = choice.split(' - ')[0].trim().toLowerCase();
  for (const key of Object.keys(qChoicesMapping)) {
    if (key.split(' - ')[0].trim().toLowerCase() === choicePrefix) return key;
  }

  const enToFr = EN_TO_FR_CHOICES[qid] || {};
  for (const [enKey, frVal] of Object.entries(enToFr)) {
    if (frVal.toLowerCase() === choice.toLowerCase()) {
      const enPrefix = enKey.split(' - ')[0].trim().toLowerCase();
      for (const mappingKey of Object.keys(qChoicesMapping)) {
        if (mappingKey.split(' - ')[0].trim().toLowerCase() === enPrefix) return mappingKey;
      }
      return enKey;
    }
  }
  return choice;
}

// ── Scoring des notes ──────────────────────────────────────────────────
function scoreNotes(answers) {
  const noteMapping = getNoteScoring();
  const coffret = getCoffret();

  const noteByCategory = { top: new Set(), heart: new Set(), base: new Set() };
  for (const ing of coffret.ingredients) noteByCategory[ing.note_type].add(ing.name);

  const scores = { top: {}, heart: {}, base: {} };

  for (const [qidStr, answerData] of Object.entries(answers)) {
    const qid = parseInt(qidStr);
    const qChoices = noteMapping.questions?.[String(qid)]?.choices || {};
    const data = typeof answerData === 'string' ? JSON.parse(answerData) : answerData;

    const applyChoice = (choice, weight) => {
      const enChoice = resolveEnChoice(choice, qid, qChoices);
      const choiceData = qChoices[enChoice] || {};
      const noteScores = choiceData.notes || {};

      for (const [noteName, score] of Object.entries(noteScores)) {
        for (const [cat, catNotes] of Object.entries(noteByCategory)) {
          if (catNotes.has(noteName)) {
            scores[cat][noteName] = (scores[cat][noteName] || 0) + score * weight;
          }
        }
      }

      const families = choiceData.families || {};
      if (Object.keys(families).length > 0) {
        for (const ing of coffret.ingredients) {
          if (ing.name in noteScores) continue;
          const famScore = families[ing.family] || 0;
          if (famScore) scores[ing.note_type][ing.name] = (scores[ing.note_type][ing.name] || 0) + famScore * weight;
        }
      }
    };

    for (const choice of data.top_2 || []) applyChoice(choice, 2.0);
    for (const choice of data.bottom_2 || []) applyChoice(choice, -1.0);
  }

  return scores;
}

// ── Sélection des meilleures notes ────────────────────────────────────
function selectNotesByScore(noteScores, maxPerCat = 3, excludedNames = new Set(), blockedNames = new Set()) {
  const coffret = getCoffret();
  const catToKey = { top: 'top_notes', heart: 'heart_notes', base: 'base_notes' };
  const result = {};

  for (const [cat, key] of Object.entries(catToKey)) {
    const catScores = noteScores[cat] || {};
    const catIngredients = coffret.ingredients.filter(
      ing => ing.note_type === cat && !excludedNames.has(ing.name) && !blockedNames.has(ing.name)
    );

    catIngredients.sort((a, b) => {
      const sa = catScores[a.name] || 0;
      const sb = catScores[b.name] || 0;
      if (sb !== sa) return sb - sa;
      return a.position - b.position;
    });

    result[key] = catIngredients.slice(0, maxPerCat).map(ing => ({
      position: ing.position,
      name: ing.name,
      family: ing.family,
      description: ing.description,
    }));
  }

  return result;
}

// ── Profil dominant ────────────────────────────────────────────────────
function deriveProfileFromNotes(selectedNotes, excludedProfiles = new Set()) {
  const coffret = getCoffret();
  const ingByName = Object.fromEntries(coffret.ingredients.map(i => [i.name, i]));
  const profileCounts = {};

  for (const key of ['top_notes', 'heart_notes', 'base_notes']) {
    for (const note of selectedNotes[key] || []) {
      const ing = ingByName[note.name];
      if (ing) {
        if (ing.profile_1 && !excludedProfiles.has(ing.profile_1)) profileCounts[ing.profile_1] = (profileCounts[ing.profile_1] || 0) + 2;
        if (ing.profile_2 && !excludedProfiles.has(ing.profile_2)) profileCounts[ing.profile_2] = (profileCounts[ing.profile_2] || 0) + 1;
      }
    }
  }

  if (Object.keys(profileCounts).length === 0) return 'Trailblazer';
  return Object.entries(profileCounts).sort((a, b) => b[1] - a[1])[0][0];
}

// ── Boosters ───────────────────────────────────────────────────────────
function selectBoosters(ingredients, count = 1) {
  const textParts = [];
  for (const key of ['top_notes', 'heart_notes', 'base_notes']) {
    for (const note of ingredients[key] || []) {
      for (const field of ['name', 'family', 'description']) {
        if (note[field]) textParts.push(note[field].toLowerCase());
      }
    }
  }
  const combined = textParts.join(' ');

  const scored = BOOSTERS.map(b => ({ b, score: b.keywords.filter(kw => combined.includes(kw)).length }));
  scored.sort((a, b) => b.score - a.score);
  return scored.slice(0, count).map(x => x.b);
}

// ── Calcul des quantités ───────────────────────────────────────────────
function computeQuantities(selectedNotes, booster, formulaType, targetMl) {
  const config = FORMULA_TYPE_CONFIGS[formulaType].sizes[targetMl];
  return {
    target_ml: targetMl,
    formula_type: formulaType,
    top_notes: (selectedNotes.top_notes || []).map(n => ({ ...n, ml: config.top_ml })),
    heart_notes: (selectedNotes.heart_notes || []).map(n => ({ ...n, ml: config.heart_ml })),
    base_notes: (selectedNotes.base_notes || []).map(n => ({ ...n, ml: config.base_ml })),
    boosters: [{ name: booster.name, ml: config.booster_ml }],
  };
}

// ── Construction d'une formule complète ───────────────────────────────
function buildFormula(noteScores, blockedNames, excludedNames, language, forceType = null, excludedProfiles = new Set()) {
  const descriptions = language === 'en' ? PROFILE_DESCRIPTIONS_EN : PROFILE_DESCRIPTIONS;
  const translateName = language === 'fr' ? (n => INGREDIENT_EN_TO_FR[n] || n) : (n => n);

  const preliminary = selectNotesByScore(noteScores, 3, excludedNames, blockedNames);
  const profileName = deriveProfileFromNotes(preliminary, excludedProfiles);
  const profileGender = PROFILE_GENDERS[profileName] || 'unisex';
  const formulaType = (forceType && forceType in FORMULA_TYPE_CONFIGS) ? forceType : PROFILE_GENDER_TO_FORMULA_TYPE[profileGender];

  const typeCounts = FORMULA_TYPE_CONFIGS[formulaType].note_counts;
  const selectedNotes = {
    top_notes: (preliminary.top_notes || []).slice(0, typeCounts.top),
    heart_notes: (preliminary.heart_notes || []).slice(0, typeCounts.heart),
    base_notes: (preliminary.base_notes || []).slice(0, typeCounts.base),
  };

  const boosterList = selectBoosters(selectedNotes, 1);
  const booster = boosterList[0] || BOOSTERS[0];

  const selectedEnNames = new Set([
    ...selectedNotes.top_notes.map(n => n.name),
    ...selectedNotes.heart_notes.map(n => n.name),
    ...selectedNotes.base_notes.map(n => n.name),
  ]);

  const translated = {};
  for (const [key, notes] of Object.entries(selectedNotes)) {
    translated[key] = notes.map(n => ({ ...n, name: translateName(n.name) }));
  }

  const sizes = {};
  for (const ml of [10, 30, 50]) {
    sizes[`${ml}ml`] = computeQuantities(translated, booster, formulaType, ml);
  }

  return {
    profile: profileName,
    formula_type: formulaType,
    description: descriptions[profileName] || '',
    top_notes: translated.top_notes.map(n => n.name),
    heart_notes: translated.heart_notes.map(n => n.name),
    base_notes: translated.base_notes.map(n => n.name),
    details: translated,
    sizes,
    _selectedEnNames: selectedEnNames,
  };
}

// ── Ingrédients bloqués par allergènes ────────────────────────────────
function getBlockedIngredients(userAllergens) {
  if (!userAllergens || userAllergens.length === 0) return new Set();
  const coffret = getCoffret();
  const userAllergenLower = userAllergens.map(a => a.trim().toLowerCase());
  const blocked = new Set();
  for (const [ingName, allergens] of Object.entries(coffret.allergen_map)) {
    if (allergens.some(a => userAllergenLower.includes(a.toLowerCase()))) blocked.add(ingName);
  }
  return blocked;
}

// ── API publique ───────────────────────────────────────────────────────

function generateFormulas(sessionId, forceType = null) {
  const sessionData = store.getSessionAnswers(sessionId);
  if (!sessionData || !sessionData.answers || Object.keys(sessionData.answers).length === 0) {
    return { error: 'Aucune réponse trouvée', formulas: [] };
  }

  const meta = store.getSessionMeta(sessionId);
  const language = meta?.language || 'fr';
  const profile = store.getUserProfile(sessionId);
  const hasAllergies = profile?.has_allergies || 'non';
  const rawAllergens = profile?.allergies || '';

  let userAllergens = null;
  if (['oui', 'yes'].includes(hasAllergies.toLowerCase()) && rawAllergens) {
    userAllergens = rawAllergens.replace(',', ';').split(';').map(a => a.trim()).filter(Boolean);
  }

  const blockedNames = getBlockedIngredients(userAllergens);
  const noteScores = scoreNotes(sessionData.answers);

  const formulas = [];
  let excludedNames = new Set();
  let excludedProfiles = new Set();

  for (let i = 0; i < 2; i++) {
    const formula = buildFormula(noteScores, blockedNames, excludedNames, language, forceType, excludedProfiles);
    const enNames = formula._selectedEnNames;
    delete formula._selectedEnNames;
    for (const n of enNames) excludedNames.add(n);
    excludedProfiles.add(formula.profile);
    formulas.push(formula);
  }

  store.saveGeneratedFormulas(sessionId, formulas);
  return { formulas };
}

function selectFormula(sessionId, formulaIndex) {
  const formulas = store.getGeneratedFormulas(sessionId);
  if (!formulas) return { error: 'No generated formulas found' };
  if (formulaIndex !== 0 && formulaIndex !== 1) return { error: 'formula_index must be 0 or 1' };
  if (formulaIndex >= formulas.length) return { error: 'Invalid formula index' };
  store.saveSelectedFormula(sessionId, formulas[formulaIndex]);
  return { formula: formulas[formulaIndex] };
}

function changeSelectedFormulaType(sessionId, formulaType) {
  if (!(formulaType in FORMULA_TYPE_CONFIGS)) return { error: `formula_type must be one of: ${Object.keys(FORMULA_TYPE_CONFIGS).join(', ')}` };

  const sessionData = store.getSessionAnswers(sessionId);
  if (!sessionData?.answers) return { error: 'Aucune réponse trouvée' };

  const meta = store.getSessionMeta(sessionId);
  const language = meta?.language || 'fr';
  const profile = store.getUserProfile(sessionId);
  const hasAllergies = profile?.has_allergies || 'non';
  const rawAllergens = profile?.allergies || '';

  let userAllergens = null;
  if (['oui', 'yes'].includes(hasAllergies.toLowerCase()) && rawAllergens) {
    userAllergens = rawAllergens.replace(',', ';').split(';').map(a => a.trim()).filter(Boolean);
  }

  const blockedNames = getBlockedIngredients(userAllergens);
  const noteScores = scoreNotes(sessionData.answers);
  const formula = buildFormula(noteScores, blockedNames, new Set(), language, formulaType);
  delete formula._selectedEnNames;
  store.saveSelectedFormula(sessionId, formula);
  return { formula };
}

function getAvailableIngredients(sessionId, noteType) {
  if (!['top', 'heart', 'base'].includes(noteType)) return { error: 'note_type must be top, heart, or base' };

  const profile = store.getUserProfile(sessionId);
  const hasAllergies = profile?.has_allergies || 'non';
  const rawAllergens = profile?.allergies || '';
  let userAllergens = null;
  if (['oui', 'yes'].includes(hasAllergies.toLowerCase()) && rawAllergens) {
    userAllergens = rawAllergens.replace(',', ';').split(';').map(a => a.trim()).filter(Boolean);
  }

  const meta = store.getSessionMeta(sessionId);
  const language = meta?.language || 'fr';
  const translateName = language === 'fr' ? (n => INGREDIENT_EN_TO_FR[n] || n) : (n => n);

  const coffret = getCoffret();
  const blockedIngredients = getBlockedIngredients(userAllergens);

  const selected = store.getSelectedFormula(sessionId);
  const alreadyInFormula = new Set();
  if (selected) {
    const noteKey = { top: 'top_notes', heart: 'heart_notes', base: 'base_notes' }[noteType];
    for (const note of selected.details?.[noteKey] || []) alreadyInFormula.add(note.name.toLowerCase());
  }

  const ingredients = coffret.ingredients
    .filter(ing => ing.note_type === noteType && !blockedIngredients.has(ing.name))
    .map(ing => ({ name: translateName(ing.name), family: ing.family, description: ing.description }))
    .filter(ing => !alreadyInFormula.has(ing.name.toLowerCase()));

  return { note_type: noteType, ingredients };
}

function replaceNote(sessionId, noteType, oldNote, newNote) {
  if (!['top', 'heart', 'base'].includes(noteType)) return { error: 'note_type must be top, heart, or base' };

  const selected = store.getSelectedFormula(sessionId);
  if (!selected) return { error: 'No formula selected yet' };

  const noteKey = { top: 'top_notes', heart: 'heart_notes', base: 'base_notes' }[noteType];
  const formulaType = selected.formula_type || 'mix';

  const meta = store.getSessionMeta(sessionId);
  const language = meta?.language || 'fr';
  const translateName = language === 'fr' ? (n => INGREDIENT_EN_TO_FR[n] || n) : (n => n);

  const coffret = getCoffret();
  let newIngredient = null;
  for (const ing of coffret.ingredients) {
    if (ing.note_type !== noteType) continue;
    const translated = translateName(ing.name);
    if (translated.toLowerCase() === newNote.toLowerCase() || ing.name.toLowerCase() === newNote.toLowerCase()) {
      newIngredient = { name: translated, family: ing.family, description: ing.description, position: ing.position };
      break;
    }
  }
  if (!newIngredient) return { error: `Ingredient '${newNote}' not found in coffret for ${noteType} notes` };

  const details = selected.details || {};
  let found = false;
  for (let i = 0; i < (details[noteKey] || []).length; i++) {
    if (details[noteKey][i].name.toLowerCase() === oldNote.toLowerCase()) {
      details[noteKey][i] = newIngredient;
      found = true;
      break;
    }
  }
  if (!found) return { error: `Note '${oldNote}' not found in current formula's ${noteKey}` };

  selected[noteKey.replace('_notes', '_notes')] = details[noteKey].map(n => n.name);
  selected.details = details;

  const boosterList = selected.sizes?.['30ml']?.boosters || [];
  const booster = { name: boosterList[0]?.name || BOOSTERS[0].name, keywords: [] };

  const sizes = {};
  for (const ml of [10, 30, 50]) {
    sizes[`${ml}ml`] = computeQuantities(details, booster, formulaType, ml);
  }
  selected.sizes = sizes;
  store.saveSelectedFormula(sessionId, selected);
  return { formula: selected };
}

module.exports = {
  generateFormulas, selectFormula, changeSelectedFormulaType,
  getAvailableIngredients, replaceNote,
};
