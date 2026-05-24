/**
 * Runtime asset paths for AssetManager (aligned with www/assets/ASSETS_MANIFEST.md).
 * Only INTEGRATED PNG/OGG paths — add entries when assets ship.
 */

import { PLAYABLE_HEROES } from "./hero-config.js";
import { getAdventureWorldConfig } from "./adventure-world.js";

const MOVEMENT_CLIPS = ["idle", "walkDown", "walkSide", "walkUp"];

/** UI / branding preloaded at boot. */
export const CORE_IMAGE_PATHS = [
  "assets/branding/logo/logo-yskill-survivor-full.png",
  "assets/branding/logo/icon-ys-512.png",
  "assets/ui/icons/icon-ys-currency.png",
];

/** Audio to preload when files exist (skipped silently if 404). */
export const AUDIO_PATHS = [
  // { key: "bgm-menu", src: "assets/audio/music/bgm-menu.ogg" },
  // { key: "sfx-shoot", src: "assets/audio/sfx/sfx-shoot.ogg" },
];

export function heroPortraitPaths() {
  return Object.values(PLAYABLE_HEROES).map((c) => c.portrait).filter(Boolean);
}

export function heroMovementPaths(heroId) {
  const config = PLAYABLE_HEROES[heroId];
  if (!config) return [];
  const paths = new Set();
  for (const clip of MOVEMENT_CLIPS) {
    for (const p of config.animations[clip] || []) paths.add(p);
  }
  return [...paths];
}

export function stageBackgroundPaths(stageId) {
  const asset = getAdventureWorldConfig(stageId)?.backgroundAsset;
  return asset ? [asset] : [];
}

/** Unique image paths required before a run. */
export function collectRunImagePaths({ stageId, heroId }) {
  const set = new Set([
    ...CORE_IMAGE_PATHS,
    ...heroPortraitPaths(),
    ...heroMovementPaths(heroId),
    ...stageBackgroundPaths(stageId),
  ]);
  return [...set];
}
