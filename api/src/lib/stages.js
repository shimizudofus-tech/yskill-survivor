/** Server-side stage limits (mirror www/play/js/stages.js and adventure-world.js). */
export const STAGES = [
  { id: 1, durationBeforeBossMs: 90_000, bossUnlockMinSurvivalMs: 45_000, difficultyMultiplier: 1 },
  { id: 2, durationBeforeBossMs: 105_000, bossUnlockMinSurvivalMs: 56_000, difficultyMultiplier: 1.15 },
  { id: 3, durationBeforeBossMs: 120_000, bossUnlockMinSurvivalMs: 64_000, difficultyMultiplier: 1.3 },
  { id: 4, durationBeforeBossMs: 135_000, bossUnlockMinSurvivalMs: 72_000, difficultyMultiplier: 1.5 },
  { id: 5, durationBeforeBossMs: 150_000, bossUnlockMinSurvivalMs: 80_000, difficultyMultiplier: 1.8 },
];

export const STAGE_IDS = STAGES.map((s) => s.id);

export function getStage(id) {
  return STAGES.find((s) => s.id === Number(id)) || null;
}

export function stageBounds(stageId) {
  const stage = getStage(stageId);
  if (!stage) return null;
  const minMs = stage.bossUnlockMinSurvivalMs + 3_000;
  const maxMs = stage.durationBeforeBossMs + 300_000;
  const maxScore = Math.floor(80_000 * stage.difficultyMultiplier);
  return { minMs, maxMs, maxScore };
}

export const PACT_IDS = ["berserker", "velocity", "harvester"];

export const RUN_EXPIRY_MS = 20 * 60 * 1000;
export const FULL_SKILL_MAX_MS = 30 * 60 * 1000;
export const FULL_SKILL_MAX_SCORE = 500_000;
export const LEADERBOARD_LIMIT = 50;
