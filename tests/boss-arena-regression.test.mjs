import assert from "node:assert/strict";
import fs from "node:fs";
import vm from "node:vm";

const sourcePath = new URL("../www/play/js/game.js", import.meta.url);
let source = fs.readFileSync(sourcePath, "utf8");

source = source
  .replace(/import[\s\S]*?from "\.\/[^"]+";\n/g, "")
  .replace("export class YSkillSurvivorGame", "class YSkillSurvivorGame")
  .replace(/export \{[^}]+\};\n?/g, "");

const canvasContext = {
  setTransform() {},
  save() {},
  restore() {},
  translate() {},
  fillRect() {},
  beginPath() {},
  arc() {},
  fill() {},
  stroke() {},
  moveTo() {},
  lineTo() {},
  closePath() {},
  createLinearGradient() {
    return { addColorStop() {} };
  },
  measureText(text) {
    return { width: String(text).length * 6 };
  },
  fillText() {},
  strokeRect() {},
  setLineDash() {},
};

const world = {
  id: 1,
  worldWidth: 720,
  worldHeight: 1280,
  playerSpawn: { x: 360, y: 1200 },
  bossArena: { x: 360, y: 200, radius: 210 },
  bossUnlock: { minSurvivalMs: 45_000, minKills: 22 },
  walkableRects: [],
  walkableCircles: [],
  blockedCircles: [],
  backgroundAsset: null,
};

const context = {
  console,
  VIEWPORT_W: 360,
  VIEWPORT_H: 640,
  ARENA_W: 360,
  ARENA_H: 640,
  PLAYER_R: 12,
  BASE_FIRE_MS: 700,
  BOSS_BONUS: 500,
  ENEMY_TYPES: [{ id: "slime", shape: "circle", r: 10, hp: 1 }],
  PALETTE: ["#fff"],
  LEVEL_UP_INTERVAL_MS: 10_000,
  ACTIVE_HERO_CONFIG: {},
  PLAYABLE_HEROES: { hero_male: {} },
  getAdventureWorldConfig: () => ({ ...world, bossArena: { ...world.bossArena }, bossUnlock: { ...world.bossUnlock } }),
  FollowCamera: class {
    resize() {}
    follow() {}
    applyTransform() {}
  },
  constrainMove(_world, _ox, _oy, nx, ny, _r, opts = {}) {
    context.lastConstrainOptions = opts;
    return { x: nx, y: ny };
  },
  clampToBossArena(_world, x, y, r) {
    context.clampCalls.push({ x, y, r });
    return { x, y };
  },
  isWalkable: () => true,
  randomWalkablePoint: () => ({ x: 360, y: 600 }),
  randomSpawnNearPlayer: () => ({ x: 360, y: 600 }),
  playerInsideBossArena(_world, x, y, margin = 0) {
    return Math.hypot(x - world.bossArena.x, y - world.bossArena.y) <= world.bossArena.radius - margin;
  },
  playerNearBossArena: () => false,
  canUnlockBoss(_world, elapsedMs, kills) {
    return elapsedMs >= world.bossUnlock.minSurvivalMs || kills >= world.bossUnlock.minKills;
  },
  getBossDefinition: () => ({ id: "boss", shape: "circle", r: 30, hp: 10 }),
  HeroSprite: class {
    load() {
      return Promise.resolve();
    }
    reset() {}
    update() {}
    draw() {
      return false;
    }
  },
  SkillManager: class {
    reset() {}
    getLevel() {
      return 0;
    }
    totalPicks() {
      return 0;
    }
    generateLevelUpOptions() {
      return [];
    }
    computeCombatEffects() {
      return {
        fireRateMult: 1,
        bulletDamage: 1,
        multishotHits: 1,
        moveSpeedMult: 1,
        bulletSpeedMult: 1,
        pickupRadius: 18,
        pickupScoreMult: 1,
        invulnMs: 900,
      };
    }
  },
  VirtualJoystick: class {},
  prefersTouchControls: () => false,
  getSettings: () => ({ heroId: "hero_male" }),
  Sfx: class {
    shoot() {}
    pickup() {}
    kill() {}
    hurt() {}
    boss() {}
    gameOver() {}
    destroy() {}
  },
  window: {
    devicePixelRatio: 1,
    addEventListener() {},
    removeEventListener() {},
    matchMedia() {
      return { matches: false };
    },
  },
  document: { documentElement: { lang: "fr" } },
  performance: { now: () => 0 },
  requestAnimationFrame() {},
  Image: class {},
  lastConstrainOptions: null,
  clampCalls: [],
};

vm.createContext(context);
vm.runInContext(`${source}\nglobalThis.YSkillSurvivorGame = YSkillSurvivorGame;`, context);

function makeGame() {
  const canvas = {
    getContext: () => canvasContext,
    addEventListener() {},
    removeEventListener() {},
    getBoundingClientRect: () => ({ left: 0, top: 0, width: 360, height: 640 }),
  };
  return new context.YSkillSurvivorGame(canvas, {
    runConfig: {
      mode: "adventure",
      stageConfig: {
        id: 1,
        bossId: "boss",
        difficultyMultiplier: 1,
        durationBeforeBossMs: 60_000,
      },
    },
  });
}

{
  const game = makeGame();
  game.elapsedMs = 45_000;
  game.kills = 0;

  game._updateAdventureBoss();

  assert.equal(game._bossArenaUnlocked, true, "survival unlock should open the boss portal");
  assert.equal(game._bossWarning, null, "boss warning must wait until the player enters the arena");

  game.player.x = world.bossArena.x;
  game.player.y = world.bossArena.y;
  game._updateAdventureBoss();

  assert.ok(game._bossWarning, "boss warning should start after entering the unlocked arena");
}

{
  const game = makeGame();
  game.elapsedMs = 1000;
  game._nextLevelUpMs = 1_000_000;
  game.pickupSpawnTimer = 1_000_000;
  game.fireTimer = 1_000_000;
  game._bossSpawned = true;
  game._bossFightLocked = true;

  game._update(16);
  assert.equal(
    context.lastConstrainOptions?.lockBossArena,
    true,
    "player movement must be locked to the boss arena during the fight",
  );

  context.clampCalls = [];
  game.player.x = world.bossArena.x;
  game.player.y = world.bossArena.y + 160;
  const boss = { x: world.bossArena.x, y: world.bossArena.y, r: 30, kind: "boss" };
  game._updateBossBehavior(boss, 16, 100);

  assert.equal(context.clampCalls.length, 1, "boss movement must be clamped to the arena");
}

console.log("boss arena regression tests passed");
