/** Viewport vs adventure world maps. Full Skill uses viewport = world (fixed arena). */

export const VIEWPORT_W = 360;
export const VIEWPORT_H = 640;

function dist(ax, ay, bx, by) {
  return Math.hypot(ax - bx, ay - by);
}

/** Stage 1 — Clairière Runique: aligned to stage_01_gameplay_map.png (720×1280).
 *  Wide open layout: rects for paths, a big circle for the main clearing, and a
 *  circular boss arena up top. No collisions on inner decorations.
 */
export const STAGE_01_WORLD = {
  id: 1,
  worldWidth: 720,
  worldHeight: 1280,
  playerSpawn: { x: 360, y: 1200 },
  bossArena: { x: 360, y: 200, radius: 210 },
  bossPortalBarrier: { y: 410, xMin: 280, xMax: 440 },
  bossUnlock: {
    minSurvivalMs: 45_000,
    minKills: 22,
    enterRadius: 300,
  },
  walkableRects: [
    { x: 180, y: 1080, w: 360, h: 200, zone: "spawn" },
    { x: 175, y: 900, w: 370, h: 210, zone: "lower_link" },
    { x: 230, y: 380, w: 260, h: 130, zone: "boss_approach" },
  ],
  walkableCircles: [
    { x: 360, y: 760, radius: 260, zone: "main_clearing" },
  ],
  blockedCircles: [
    { x: 230, y: 990, radius: 58, zone: "tree_left" },
    { x: 495, y: 985, radius: 60, zone: "tree_right" },
  ],
  theme: "forest",
  backgroundAsset: "assets/adventure/stage-01/backgrounds/stage_01_gameplay_map.png",
};

export function defaultAdventureWorld(stageId) {
  const id = Number(stageId) || 1;
  const extra = (id - 1) * 120;
  return {
    id,
    worldWidth: 720,
    worldHeight: 1280 + extra,
    playerSpawn: { x: 360, y: 1180 + extra * 0.5 },
    bossArena: { x: 360, y: 180, radius: 210 },
    bossUnlock: {
      minSurvivalMs: 40_000 + id * 8_000,
      minKills: 18 + id * 4,
      enterRadius: 280,
    },
    walkableRects: [
      { x: 210, y: 1000 + extra * 0.4, w: 300, h: 200 + extra * 0.2, zone: "spawn" },
      { x: 280, y: 700 + extra * 0.2, w: 160, h: 320, zone: "path" },
      { x: 120, y: 480, w: 480, h: 260, zone: "clearing" },
      { x: 280, y: 320, w: 160, h: 180, zone: "approach" },
    ],
    theme: "forest",
    backgroundAsset: null,
  };
}

export function getAdventureWorldConfig(stageId) {
  const id = Number(stageId);
  if (id === 1) {
    return {
      ...STAGE_01_WORLD,
      walkableRects: STAGE_01_WORLD.walkableRects.map((r) => ({ ...r })),
      walkableCircles: (STAGE_01_WORLD.walkableCircles || []).map((c) => ({ ...c })),
      blockedCircles: (STAGE_01_WORLD.blockedCircles || []).map((c) => ({ ...c })),
    };
  }
  return defaultAdventureWorld(id);
}

export function isInsideBossArena(world, x, y, margin = 0) {
  const ba = world?.bossArena;
  if (!ba) return false;
  return dist(x, y, ba.x, ba.y) <= ba.radius - margin;
}

export function isInsideBlockedCircle(world, x, y, margin = 0) {
  for (const c of world?.blockedCircles || []) {
    if (dist(x, y, c.x, c.y) <= c.radius + margin) return true;
  }
  return false;
}

export function isWalkable(world, x, y, margin = 0, { allowBossArena = false } = {}) {
  if (!world) return true;
  const { walkableRects, walkableCircles, bossArena } = world;
  if (isInsideBlockedCircle(world, x, y, margin)) return false;
  for (const r of walkableRects || []) {
    if (
      x >= r.x + margin &&
      x <= r.x + r.w - margin &&
      y >= r.y + margin &&
      y <= r.y + r.h - margin
    ) {
      return true;
    }
  }
  for (const c of walkableCircles || []) {
    if (dist(x, y, c.x, c.y) <= c.radius - margin) return true;
  }
  if (allowBossArena && bossArena && isInsideBossArena(world, x, y, margin)) {
    return true;
  }
  return false;
}

export function crossesBossPortalBarrier(world, ox, oy, nx, ny, entityR, unlocked) {
  if (unlocked || !world?.bossPortalBarrier) return false;
  const b = world.bossPortalBarrier;
  const inX = (x) => x >= b.xMin - entityR && x <= b.xMax + entityR;
  if (!inX(ox) && !inX(nx)) return false;
  const line = b.y;
  const wasSouth = oy >= line - entityR * 0.5;
  const nowNorth = ny < line + entityR * 0.5;
  return wasSouth && nowNorth;
}

export function playerInsideBossArena(world, px, py, margin = 12) {
  return isInsideBossArena(world, px, py, margin);
}

export function playerNearBossPortal(world, px, py, maxDist = 140) {
  const b = world?.bossPortalBarrier;
  if (!b) return false;
  const cx = (b.xMin + b.xMax) / 2;
  return dist(px, py, cx, b.y) <= maxDist;
}

export function clampToBossArena(world, x, y, entityR) {
  const ba = world?.bossArena;
  if (!ba) return { x, y };
  const d = dist(x, y, ba.x, ba.y);
  const maxD = Math.max(8, ba.radius - entityR);
  if (d <= maxD || d < 0.001) return { x, y };
  return {
    x: ba.x + ((x - ba.x) * maxD) / d,
    y: ba.y + ((y - ba.y) * maxD) / d,
  };
}

export function constrainMove(
  world,
  ox,
  oy,
  nx,
  ny,
  r,
  { lockBossArena = false, bossArenaUnlocked = false } = {},
) {
  if (!world) return { x: nx, y: ny };
  if (lockBossArena && world.bossArena) {
    return clampToBossArena(world, nx, ny, r);
  }
  if (crossesBossPortalBarrier(world, ox, oy, nx, ny, r, bossArenaUnlocked)) {
    return { x: ox, y: oy };
  }
  const walkOpts = { allowBossArena: bossArenaUnlocked };
  if (isWalkable(world, nx, ny, r, walkOpts)) return { x: nx, y: ny };
  if (isWalkable(world, nx, oy, r, walkOpts)) return { x: nx, y: oy };
  if (isWalkable(world, ox, ny, r, walkOpts)) return { x: ox, y: ny };
  return { x: ox, y: oy };
}

export function randomWalkablePoint(world, rand, margin = 24) {
  const rects = world?.walkableRects || [];
  const circles = world?.walkableCircles || [];
  if (!rects.length && !circles.length) {
    return { x: world?.worldWidth / 2 || 180, y: world?.worldHeight / 2 || 320 };
  }
  const total = rects.length + circles.length;
  for (let attempt = 0; attempt < 40; attempt++) {
    const pick = Math.floor(rand() * total);
    let x, y;
    if (pick < rects.length) {
      const rect = rects[pick];
      x = rect.x + margin + rand() * Math.max(1, rect.w - margin * 2);
      y = rect.y + margin + rand() * Math.max(1, rect.h - margin * 2);
    } else {
      const c = circles[pick - rects.length];
      const a = rand() * Math.PI * 2;
      const r = rand() * Math.max(1, c.radius - margin);
      x = c.x + Math.cos(a) * r;
      y = c.y + Math.sin(a) * r;
    }
    if (isWalkable(world, x, y, margin)) return { x, y };
  }
  return { ...world.playerSpawn };
}

export function randomSpawnNearPlayer(world, px, py, rand, minDist, maxDist, entityR = 12) {
  for (let attempt = 0; attempt < 50; attempt++) {
    const angle = rand() * Math.PI * 2;
    const d = minDist + rand() * (maxDist - minDist);
    const x = px + Math.cos(angle) * d;
    const y = py + Math.sin(angle) * d;
    if (isWalkable(world, x, y, entityR) && dist(x, y, px, py) >= minDist - 4) {
      return { x, y };
    }
  }
  return randomWalkablePoint(world, rand, entityR);
}

export function playerNearBossArena(world, px, py) {
  const ba = world?.bossArena;
  if (!ba) return false;
  const enter = world.bossUnlock?.enterRadius ?? ba.radius + 40;
  return dist(px, py, ba.x, ba.y) <= enter;
}

export function canUnlockBoss(world, elapsedMs, kills) {
  const u = world?.bossUnlock;
  if (!u) return false;
  return elapsedMs >= (u.minSurvivalMs || 0) || kills >= (u.minKills || 999);
}

export class FollowCamera {
  constructor(viewW, viewH, worldW, worldH, { smoothing = 0.14 } = {}) {
    this.viewW = viewW;
    this.viewH = viewH;
    this.worldW = worldW;
    this.worldH = worldH;
    this.smoothing = smoothing;
    this.x = 0;
    this.y = 0;
    this.targetX = 0;
    this.targetY = 0;
  }

  resize(viewW, viewH, worldW, worldH) {
    this.viewW = viewW;
    this.viewH = viewH;
    this.worldW = worldW;
    this.worldH = worldH;
  }

  follow(px, py, instant = false) {
    const maxX = Math.max(0, this.worldW - this.viewW);
    const maxY = Math.max(0, this.worldH - this.viewH);
    this.targetX = Math.max(0, Math.min(px - this.viewW / 2, maxX));
    this.targetY = Math.max(0, Math.min(py - this.viewH / 2, maxY));
    if (instant || this.worldW <= this.viewW) {
      this.x = this.targetX;
      this.y = this.targetY;
      return;
    }
    const t = instant ? 1 : this.smoothing;
    this.x += (this.targetX - this.x) * t;
    this.y += (this.targetY - this.y) * t;
  }

  applyTransform(ctx) {
    ctx.translate(-this.x, -this.y);
  }
}
