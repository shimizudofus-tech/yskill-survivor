import { ACTIVE_HERO_CONFIG } from "./hero-config.js";

/** YSkill Survivor — shared constants */
export const STORAGE_KEY = "yskill-survivor:v2";
/** Logical arena — portrait 9:16 (mobile-first). Viewport = visible canvas. */
export const VIEWPORT_W = 360;
export const VIEWPORT_H = 640;
/** @deprecated use VIEWPORT_W — kept for Full Skill fixed arena */
export const ARENA_W = VIEWPORT_W;
/** @deprecated use VIEWPORT_H */
export const ARENA_H = VIEWPORT_H;
export const ARENA_RATIO = "9 / 16";

/** Hitbox joueur — alignée sur le héros actif. */
export const PLAYER_R = ACTIVE_HERO_CONFIG.collisionRadius;

/** Art direction — manga fantasy arcade (Dofus × survivor mobile). Priority: readability > perf > mood > FX. */
export const VISUAL_STYLE = {
  cameraTiltDeg: "75-80",
  playerScreenRatio: 0.04,
  bossVsPlayerMin: 2.5,
  enemyVsPlayerRange: [0.55, 1.1],
  mapDecor: "borders-only",
  combatCenter: "clear",
};

export {
  ACTIVE_HERO_CONFIG,
  HERO_MALE_CONFIG,
  HERO_FEMALE_CONFIG,
  PLAYABLE_HEROES,
} from "./hero-config.js";
export const BASE_FIRE_MS = 420;
export const BOSS_AT_MS = 5 * 60 * 1000;
export const BOSS_WARN_MS = BOSS_AT_MS - 2000;
export const BOSS_BONUS = 1000;
export const MAX_LOCAL_SCORES = 10;
export const LEVEL_UP_INTERVAL_MS = 45000;

/** Améliorations temporaires pendant une run (choix 1/3 toutes les 45 s). */
export const RUN_UPGRADE_POOL = [
  { id: "runFire", max: 8 },
  { id: "runDamage", max: 10 },
  { id: "runSpeed", max: 6 },
  { id: "runMagnet", max: 6 },
  { id: "runPierce", max: 5 },
  { id: "runVitality", max: 2 },
];

export const UPGRADE_CATALOG = [
  { id: "attackSpeed", baseCost: 20 },
  { id: "damage", baseCost: 25 },
  { id: "moveSpeed", baseCost: 15 },
  { id: "bulletSpeed", baseCost: 25 },
  { id: "pickupMagnet", baseCost: 35 },
  { id: "scoreBoost", baseCost: 50 },
  { id: "thickSkin", baseCost: 60 },
  { id: "multishot", baseCost: 100 },
];

export const ENEMY_TYPES = [
  { id: "drifter", shape: "circle", hp: 1, r: 12, speedMul: 1 },
  { id: "spark", shape: "circle", hp: 1, r: 8, speedMul: 1.35 },
  { id: "wedge", shape: "triangle", hp: 1, r: 13, speedMul: 1.1 },
  { id: "ring", shape: "ring", hp: 2, r: 14, speedMul: 0.95 },
  { id: "hex", shape: "hex", hp: 3, r: 15, speedMul: 0.88 },
];

export const PALETTE = ["#7ecbff", "#c49bff", "#ff9a62", "#8dffb2", "#ffe566"];
