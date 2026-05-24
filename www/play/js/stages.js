/** Adventure stages and stage boss definitions (v0.4). */

export const STAGES = [
  {
    id: 1,
    name: "Clairière Runique",
    bossName: "Gelée Runique",
    durationBeforeBossMs: 90000,
    difficultyMultiplier: 1,
    rewardFirstClear: 50,
    rewardReplay: 10,
    bossId: "rune_slime",
    theme: "forest",
    /** World layout: see adventure-world.js → STAGE_01_WORLD (720×1280). */
  },
  {
    id: 2,
    name: "Sentier Envahi",
    bossName: "Champignon Brutal",
    durationBeforeBossMs: 105000,
    difficultyMultiplier: 1.15,
    rewardFirstClear: 65,
    rewardReplay: 12,
    bossId: "brutal_mushroom",
    theme: "path",
  },
  {
    id: 3,
    name: "Marais Lumineux",
    bossName: "Crapaud Astral",
    durationBeforeBossMs: 120000,
    difficultyMultiplier: 1.3,
    rewardFirstClear: 80,
    rewardReplay: 15,
    bossId: "astral_toad",
    theme: "marsh",
  },
  {
    id: 4,
    name: "Bois des Brumes",
    bossName: "Loup des Brumes",
    durationBeforeBossMs: 135000,
    difficultyMultiplier: 1.5,
    rewardFirstClear: 110,
    rewardReplay: 20,
    bossId: "mist_wolf",
    theme: "mist",
  },
  {
    id: 5,
    name: "Arbre Ancien",
    bossName: "Gardien Sylvestre",
    durationBeforeBossMs: 150000,
    difficultyMultiplier: 1.8,
    rewardFirstClear: 180,
    rewardReplay: 35,
    bossId: "sylvan_guardian",
    theme: "ancient",
  },
];

/**
 * Boss stats and simple behavior hooks.
 * behavior: chase | dash | hop | fast | guardian
 */
export const BOSS_DEFINITIONS = {
  rune_slime: {
    id: "rune_slime",
    shape: "circle",
    color: "#5eead4",
    r: 38,
    hp: 55,
    speedMul: 0.7,
    behavior: "slime",
    bonusScore: 400,
    regenPerSec: 0.4,
  },
  brutal_mushroom: {
    id: "brutal_mushroom",
    shape: "hex",
    color: "#f97316",
    r: 30,
    hp: 75,
    speedMul: 0.38,
    behavior: "dash",
    bonusScore: 550,
    dashIntervalMs: 3200,
    dashSpeedMul: 2.8,
  },
  astral_toad: {
    id: "astral_toad",
    shape: "circle",
    color: "#a78bfa",
    r: 28,
    hp: 85,
    speedMul: 0.35,
    behavior: "hop",
    bonusScore: 650,
    hopIntervalMs: 2800,
    hopSpeedMul: 3.2,
  },
  mist_wolf: {
    id: "mist_wolf",
    shape: "triangle",
    color: "#94a3b8",
    r: 24,
    hp: 95,
    speedMul: 0.72,
    behavior: "fast",
    bonusScore: 750,
  },
  sylvan_guardian: {
    id: "sylvan_guardian",
    shape: "star",
    color: "#22c55e",
    r: 34,
    hp: 120,
    speedMul: 0.4,
    behavior: "guardian",
    bonusScore: 1000,
    minionIntervalMs: 8000,
  },
};

export function getStageById(id) {
  return STAGES.find((s) => s.id === Number(id)) ?? null;
}

export function getBossDefinition(bossId) {
  return BOSS_DEFINITIONS[bossId] ?? null;
}

export function getNextStageId(stageId) {
  const next = STAGES.find((s) => s.id === Number(stageId) + 1);
  return next?.id ?? null;
}
