/** Héros jouables — packs transparents v7+ (sans redécoupage). */

function framePaths(dir, prefix, count) {
  return Array.from({ length: count }, (_, i) => {
    const n = String(i + 1).padStart(2, "0");
    return `${dir}/${prefix}_${n}.png`;
  });
}

function heroAnimations(base, frameCount) {
  const mov = `${base}/movement/frames_128`;
  return {
    idle: framePaths(mov, "idle", frameCount),
    walkDown: framePaths(mov, "walk_down", frameCount),
    walkSide: framePaths(mov, "walk_side", frameCount),
    walkUp: framePaths(mov, "walk_up", frameCount),
    frontSlash: framePaths(`${base}/attacks/front_slash/frames_128`, "front_slash", frameCount),
    circleSlash: framePaths(`${base}/attacks/circle_slash/frames_128`, "circle_slash", frameCount),
    dash: framePaths(`${base}/attacks/dash/frames_128`, "dash", frameCount),
    magicShot: framePaths(`${base}/attacks/magic_shot/frames_128`, "magic_shot", frameCount),
  };
}

const MALE_BASE = "assets/hero/male";
const FEMALE_BASE = "assets/hero/female";

/** @type {const} */
export const HERO_MALE_CONFIG = {
  id: "hero_male",
  label: "Arin",
  nameKey: "hero.arin",
  /** Taille native des PNG (frames_128). */
  spriteSize: 128,
  frameCount: 5,
  collisionRadius: 18,
  /** Affichage in-game : 128 × 0.44 ≈ 56 px */
  visualScale: 0.44,
  /** Fallback si idle/walk non définis. */
  frameMs: 100,
  idleFrameMs: 120,
  walkFrameMs: 85,
  walkRefSpeed: 200,
  portrait: `${MALE_BASE}/ui/portrait_512.png`,
  icon: `${MALE_BASE}/ui/icon_128.png`,
  fullSheet: `${MALE_BASE}/full_sheet/hero_sprite_sheet_transparent_128.png`,
  manifest: `${MALE_BASE}/manifest.json`,
  readme: `${MALE_BASE}/README_CURSOR.md`,
  animations: heroAnimations(MALE_BASE, 5),
};

/** @type {const} */
export const HERO_FEMALE_CONFIG = {
  id: "hero_female",
  label: "Lyra",
  nameKey: "hero.lyra",
  spriteSize: 128,
  frameCount: 8,
  collisionRadius: 18,
  visualScale: 0.44,
  frameMs: 100,
  idleFrameMs: 120,
  walkFrameMs: 85,
  walkRefSpeed: 200,
  portrait: `${FEMALE_BASE}/ui/portrait_512.png`,
  icon: `${FEMALE_BASE}/ui/icon_128.png`,
  fullSheet: `${FEMALE_BASE}/full_sheet/hero_sprite_sheet_transparent_128.png`,
  manifest: `${FEMALE_BASE}/manifest.json`,
  readme: `${FEMALE_BASE}/README_CURSOR.md`,
  animations: heroAnimations(FEMALE_BASE, 8),
};

export const PLAYABLE_HEROES = {
  [HERO_MALE_CONFIG.id]: HERO_MALE_CONFIG,
  [HERO_FEMALE_CONFIG.id]: HERO_FEMALE_CONFIG,
};

/** Héros actif en jeu (remplacé plus tard par sélection Arin / Lyra). */
export const ACTIVE_HERO_CONFIG = HERO_MALE_CONFIG;

export function heroDisplaySize(config = ACTIVE_HERO_CONFIG) {
  return config.spriteSize * config.visualScale;
}
