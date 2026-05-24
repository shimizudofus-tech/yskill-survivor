import { STORAGE_KEY, UPGRADE_CATALOG, MAX_LOCAL_SCORES } from "./config.js";
import { STAGES, getNextStageId } from "./stages.js";

const DEFAULT_ADVENTURE = {
  unlockedStage: 1,
  completedStages: {},
  stageScores: {},
  bossesDefeated: 0,
};

const DEFAULT = {
  ys: 0,
  upgrades: {},
  scores: [],
  adventure: structuredClone(DEFAULT_ADVENTURE),
  fullSkill: { scores: [] },
  settings: { sound: true, music: false, locale: "fr", haptics: true, heroId: "hero_male" },
  stats: { runs: 0, totalScore: 0 },
};

function normalizeAdventure(adventure) {
  const base = structuredClone(DEFAULT_ADVENTURE);
  if (!adventure || typeof adventure !== "object") return base;
  return {
    unlockedStage: Math.max(1, Math.min(STAGES.length, Math.floor(Number(adventure.unlockedStage) || 1))),
    completedStages: { ...base.completedStages, ...(adventure.completedStages || {}) },
    stageScores: { ...base.stageScores, ...(adventure.stageScores || {}) },
    bossesDefeated: Math.max(0, Math.floor(Number(adventure.bossesDefeated) || 0)),
  };
}

function loadRaw() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    const parsed = raw ? JSON.parse(raw) : structuredClone(DEFAULT);
    parsed.adventure = normalizeAdventure(parsed.adventure);
    parsed.fullSkill = parsed.fullSkill || { scores: [] };
    return parsed;
  } catch {
    return structuredClone(DEFAULT);
  }
}

let state = loadRaw();

function save() {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
}

export function getState() {
  return state;
}

export function getYs() {
  return state.ys;
}

export function addYs(amount) {
  const n = Math.max(0, Math.floor(Number(amount) || 0));
  state.ys += n;
  save();
  return state.ys;
}

export function spendYs(amount) {
  const n = Math.max(0, Math.floor(Number(amount) || 0));
  if (state.ys < n) return false;
  state.ys -= n;
  save();
  return true;
}

export function upgradeLevel(id) {
  return Math.max(0, Math.floor(Number(state.upgrades[id]) || 0));
}

export function upgradeCost(id) {
  const item = UPGRADE_CATALOG.find((u) => u.id === id);
  if (!item) return Infinity;
  const lv = upgradeLevel(id);
  return Math.floor(item.baseCost * Math.pow(2, lv));
}

export function buyUpgrade(id) {
  const cost = upgradeCost(id);
  if (!UPGRADE_CATALOG.some((u) => u.id === id)) return { ok: false };
  if (!spendYs(cost)) return { ok: false, error: "insufficient" };
  state.upgrades[id] = upgradeLevel(id) + 1;
  save();
  return { ok: true, level: state.upgrades[id], cost };
}

export function getUpgradeEffects() {
  const u = state.upgrades;
  const lv = (id) => upgradeLevel(id);
  const atk = lv("attackSpeed");
  const dmg = lv("damage");
  const move = lv("moveSpeed");
  const bullet = lv("bulletSpeed");
  const magnet = lv("pickupMagnet");
  const score = lv("scoreBoost");
  const skin = lv("thickSkin");
  const multi = lv("multishot");
  const multishotHits = multi > 0 ? 1 + multi : 1;
  return {
    fireRateMult: atk > 0 ? Math.pow(2, atk) : 1,
    bulletDamage: dmg > 0 ? Math.pow(2, dmg) : 1,
    multishotHits,
    moveSpeedMult: move > 0 ? Math.pow(1.25, move) : 1,
    bulletSpeedMult: bullet > 0 ? Math.pow(1.3, bullet) : 1,
    pickupRadius: 18 + magnet * 10,
    pickupScoreMult: score > 0 ? Math.pow(1.25, score) : 1,
    invulnMs: 900 + skin * 500,
  };
}

export function getAdventure() {
  return state.adventure;
}

export function isStageUnlocked(stageId) {
  return Number(stageId) <= state.adventure.unlockedStage;
}

export function isStageCompleted(stageId) {
  return Boolean(state.adventure.completedStages[String(stageId)]);
}

export function getStageRecord(stageId) {
  return state.adventure.stageScores[String(stageId)] || null;
}

function updateStageRecord(stageId, patch) {
  const key = String(stageId);
  const prev = state.adventure.stageScores[key] || {};
  state.adventure.stageScores[key] = { ...prev, ...patch };
}

export function recordAdventureVictory(stageId, { score, timeMs, revived }) {
  const stage = STAGES.find((s) => s.id === Number(stageId));
  if (!stage) return { ysEarned: 0, firstClear: false };

  const key = String(stageId);
  const firstClear = !state.adventure.completedStages[key];
  const ysEarned = firstClear ? stage.rewardFirstClear : stage.rewardReplay;

  state.adventure.completedStages[key] = true;
  state.adventure.bossesDefeated += 1;

  const nextId = getNextStageId(stageId);
  if (nextId && nextId > state.adventure.unlockedStage) {
    state.adventure.unlockedStage = nextId;
  }

  const prev = getStageRecord(stageId);
  const assisted = Boolean(revived);
  const leaderboardEligible = !assisted;
  const bestScore = Math.max(prev?.bestScore || 0, score);
  const bestTimeMs =
    !prev?.bestTimeMs || !prev?.bossDefeated || timeMs < prev.bestTimeMs
      ? timeMs
      : prev.bestTimeMs;

  updateStageRecord(stageId, {
    bestScore,
    bestTimeMs,
    bossDefeated: true,
    assisted: prev?.assisted && prev?.bossDefeated ? prev.assisted && assisted : assisted,
    leaderboardEligible: prev?.leaderboardEligible === false ? false : leaderboardEligible,
    lastVictoryAt: Date.now(),
  });

  if (ysEarned > 0) addYs(ysEarned);
  state.stats.runs += 1;
  state.stats.totalScore += score;
  save();

  return { ysEarned, firstClear, nextStageId: nextId };
}

export function recordAdventureDefeat(stageId, { score, timeMs, revived }) {
  const prev = getStageRecord(stageId);
  const bestScore = Math.max(prev?.bestScore || 0, score);
  updateStageRecord(stageId, {
    bestScore,
    bossDefeated: prev?.bossDefeated || false,
    assisted: prev?.assisted || Boolean(revived),
    lastDefeatAt: Date.now(),
  });
  state.stats.runs += 1;
  state.stats.totalScore += score;
  save();
  return { bestScore };
}

export function recordRun(score) {
  const s = Math.max(0, Math.floor(Number(score) || 0));
  state.stats.runs += 1;
  state.stats.totalScore += s;
  state.scores.push({ score: s, at: Date.now() });
  state.scores.sort((a, b) => b.score - a.score);
  state.scores = state.scores.slice(0, MAX_LOCAL_SCORES);
  save();
  return s;
}

export function ysFromScore(score) {
  return Math.max(1, Math.floor(score / 50));
}

export function getSettings() {
  return state.settings;
}

export function patchSettings(patch) {
  state.settings = { ...state.settings, ...patch };
  save();
  return state.settings;
}

export function resetProgress() {
  state = structuredClone(DEFAULT);
  save();
}
