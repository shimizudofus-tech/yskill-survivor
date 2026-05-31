import { existsSync } from "node:fs";
import { fileURLToPath } from "node:url";

import { PLAYABLE_HEROES } from "../www/play/js/hero-config.js";
import { CORE_IMAGE_PATHS, collectRunImagePaths } from "../www/play/js/runtime-assets.js";

const PLAY_ROOT = new URL("../www/play/", import.meta.url);
const STAGES_WITH_REQUIRED_ASSETS = [1];

function runtimeFileExists(runtimePath) {
  return existsSync(fileURLToPath(new URL(runtimePath, PLAY_ROOT)));
}

const missing = new Set();

for (const path of CORE_IMAGE_PATHS) {
  if (!runtimeFileExists(path)) missing.add(path);
}

for (const stageId of STAGES_WITH_REQUIRED_ASSETS) {
  for (const heroId of Object.keys(PLAYABLE_HEROES)) {
    for (const path of collectRunImagePaths({ stageId, heroId })) {
      if (!runtimeFileExists(path)) missing.add(path);
    }
  }
}

if (missing.size) {
  console.error("Missing runtime assets:");
  for (const path of [...missing].sort()) {
    console.error(`- ${path}`);
  }
  process.exit(1);
}

console.log("Runtime asset catalog paths are present.");
