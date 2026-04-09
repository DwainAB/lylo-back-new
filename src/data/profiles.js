'use strict';

const PROFILE_GENDERS = {
  Disruptor: 'masculine',
  Visionary: 'unisex',
  Trailblazer: 'unisex',
  Strategist: 'masculine',
  Innovator: 'masculine',
  Creator: 'feminine',
  Influencer: 'feminine',
  Icon: 'feminine',
  Cosy: 'unisex',
};

const PROFILE_DESCRIPTIONS = {
  Disruptor: "Innovant et atypique. Pas l'approche standard, il trace de nouveaux chemins à travers les anciens.",
  Visionary: "Toujours plusieurs coups d'avance, avec une direction claire et de la détermination.",
  Trailblazer: "Frais, lumineux, prêt pour tout. Un mélange subtil de floral, d'agrumes et de notes profondes.",
  Strategist: "Réfléchi, patient, jamais pressé. Une présence apaisante et assurée.",
  Innovator: "Jamais le même chemin deux fois, audacieux et risqué, mais assuré.",
  Creator: "Joyeux, créatif, excentrique, pleinement soi-même, sans compromis.",
  Influencer: "Toujours à la recherche de la nouveauté, enthousiaste et confiant.",
  Icon: "Au-delà du classique, sage et toujours à la mode. Intemporel, sans effort et élégant.",
  Cosy: "Doux, discret, rassuré par le confort. Une bulle de bien-être.",
};

const PROFILE_DESCRIPTIONS_EN = {
  Disruptor: "Innovative and unconventional. Not the standard approach, they blaze new trails through old paths.",
  Visionary: "Always several moves ahead, with a clear direction and determination.",
  Trailblazer: "Fresh, bright, ready for anything. A subtle blend of floral, citrus and deep notes.",
  Strategist: "Thoughtful, patient, never in a rush. A calming and confident presence.",
  Innovator: "Never the same path twice, bold and daring, yet assured.",
  Creator: "Joyful, creative, eccentric, fully themselves, without compromise.",
  Influencer: "Always seeking novelty, enthusiastic and confident.",
  Icon: "Beyond classic, wise and always fashionable. Timeless, effortless and elegant.",
  Cosy: "Soft, discreet, comforted by coziness. A bubble of well-being.",
};

const INGREDIENT_EN_TO_FR = {
  // TOP
  'Grapefruit wood': 'Bois de pamplemousse',
  'Bamboo leaf': 'Feuille de bambou',
  'Warm spices': 'Épices chaudes',
  'Cold spices': 'Épices froides',
  'Blackcurrant': 'Cassis',
  'White dew': 'Rosée blanche',
  "Grasse's lavender": 'Lavande de Grasse',
  'Fresh bergamot': 'Bergamote fraîche',
  'Modern freshness': 'Fraîcheur moderne',
  'Wild rose': 'Rose sauvage',
  // HEART
  'Rose & peony': 'Rose & pivoine',
  'Green lily of the valley': 'Muguet vert',
  'Jasmine blossom': 'Fleur de jasmin',
  'Fresh breeze': 'Brise fraîche',
  'Tutti fruitti-rhubarb': 'Tutti frutti-rhubarbe',
  'Neroli-orange blossom': "Néroli-fleur d'oranger",
  'Fig tree': 'Figuier',
  'Powdery violet': 'Violette poudrée',
  'Floral honey': 'Miel floral',
  'Blond tobacco': 'Tabac blond',
  // BASE
  'Sweet amber': 'Ambre doux',
  'Iris powder': "Poudre d'iris",
  'Sweet note': 'Note sucrée',
  'Woody bouquet': 'Bouquet boisé',
  'Woody harmony': 'Harmonie boisée',
  'White chypre': 'Chypre blanc',
  'Aldehyde harmony': 'Harmonie aldéhydée',
  'Powdery musk': 'Musc poudré',
  'Modern wood': 'Bois moderne',
  'Leather': 'Cuir',
};

const PROFILE_NORMALIZE = {
  stratégist: 'Strategist', strategist: 'Strategist',
  disrupteur: 'Disruptor', disruptor: 'Disruptor',
  'trail blazer': 'Trailblazer', trailblazer: 'Trailblazer',
  visionary: 'Visionary', visionnary: 'Visionary',
  innovator: 'Innovator', creator: 'Creator',
  influencer: 'Influencer', icon: 'Icon', cosy: 'Cosy',
};

function normalizeProfile(raw) {
  if (!raw) return null;
  return PROFILE_NORMALIZE[raw.trim().toLowerCase()] || raw.trim();
}

module.exports = {
  PROFILE_GENDERS,
  PROFILE_DESCRIPTIONS,
  PROFILE_DESCRIPTIONS_EN,
  INGREDIENT_EN_TO_FR,
  PROFILE_NORMALIZE,
  normalizeProfile,
};
