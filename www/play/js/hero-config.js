/** Héros jouable — pack officiel yskill_hero_male_sprites_transparent_v7 (sans redécoupage). */

const BASE = "assets/hero/male";
const MOV = `${BASE}/movement/frames_128`;

function framePaths(dir, prefix, count = 5) {
  return Array.from({ length: count }, (_, i) => {
    const n = String(i + 1).padStart(2, "0");
    return `${dir}/${prefix}_${n}.png`;
  });
}

/** @type {const} */
export const HERO_MALE_CONFIG = {
  id: "hero_male",
  label: "Héros principal",
  nameKey: "hero.arin",
  /** Taille native des PNG (frames_128). */
  spriteSize: 128,
  collisionRadius: 18,
  /** Affichage in-game : 128 × 0.5 = 64 px (lisibilité mobile 9:16). */
  visualScale: 0.5,
  frameMs: 110,
  portrait: null,
  icon: null,
  fullSheet: `${BASE}/full_sheet/hero_sprite_sheet_transparent_128.png`,
  manifest: `${BASE}/manifest.json`,
  readme: `${BASE}/README_CURSOR.md`,
  animations: {
    idle: framePaths(MOV, "idle"),
    walkDown: framePaths(MOV, "walk_down"),
    walkSide: framePaths(MOV, "walk_side"),
    walkUp: framePaths(MOV, "walk_up"),
    frontSlash: framePaths(`${BASE}/attacks/front_slash/frames_128`, "front_slash"),
    circleSlash: framePaths(`${BASE}/attacks/circle_slash/frames_128`, "circle_slash"),
    dash: framePaths(`${BASE}/attacks/dash/frames_128`, "dash"),
    magicShot: framePaths(`${BASE}/attacks/magic_shot/frames_128`, "magic_shot"),
  },
};

/** Héros actif en jeu (remplacé plus tard par sélection héroïne / héros). */
export const ACTIVE_HERO_CONFIG = HERO_MALE_CONFIG;

export function heroDisplaySize(config = ACTIVE_HERO_CONFIG) {
  return config.spriteSize * config.visualScale;
}
