/** Viewport vs adventure world maps. Full Skill uses viewport = world (fixed arena). */

export const VIEWPORT_W = 360;
export const VIEWPORT_H = 640;

function dist(ax, ay, bx, by) {
  return Math.hypot(ax - bx, ay - by);
}

/**
 * Stage 1 — collisions prompt 3 (Gemini hand-tune after F2 + overlay).
 */
export const STAGE_01_WORLD = {
  id: 1,
  worldWidth: 720,
  worldHeight: 1280,
  playerSpawn: { x: 360, y: 1200 },
  bossArena: { x: 360, y: 200, radius: 210 },
  bossUnlock: {
    minSurvivalMs: 45_000,
    minKills: 22,
    enterRadius: 300,
  },
  walkableRects: [{ x: 300, y: 850, w: 120, h: 430, zone: "entrance_corridor" }],
  walkableCircles: [
    { x: 360, y: 600, radius: 350, zone: "arena_floor_center" },
    { x: 360, y: 190, radius: 45, zone: "boss_gate_clearance" },
  ],
  blockedCircles: [
    { x: 360, y: 95, radius: 24, zone: "pillar_top_center" },
    { x: 485, y: 150, radius: 24, zone: "pillar_top_right_1" },
    { x: 595, y: 240, radius: 24, zone: "pillar_top_right_2" },
    { x: 235, y: 150, radius: 24, zone: "pillar_top_left_1" },
    { x: 125, y: 240, radius: 24, zone: "pillar_top_left_2" },
    { x: 665, y: 365, radius: 24, zone: "pillar_mid_right_1" },
    { x: 690, y: 520, radius: 24, zone: "pillar_mid_right_2" },
    { x: 665, y: 675, radius: 24, zone: "pillar_low_right_1" },
    { x: 595, y: 800, radius: 24, zone: "pillar_low_right_2" },
    { x: 55, y: 365, radius: 24, zone: "pillar_mid_left_1" },
    { x: 30, y: 520, radius: 24, zone: "pillar_mid_left_2" },
    { x: 55, y: 675, radius: 24, zone: "pillar_low_left_1" },
    { x: 125, y: 800, radius: 24, zone: "pillar_low_left_2" },
    { x: 485, y: 890, radius: 24, zone: "pillar_bottom_right_outer" },
    { x: 452, y: 948, radius: 22, zone: "pillar_bottom_right_gate" },
    { x: 235, y: 890, radius: 24, zone: "pillar_bottom_left_outer" },
    { x: 268, y: 948, radius: 22, zone: "pillar_bottom_left_gate" },
    { x: 422, y: 118, radius: 16, zone: "wall_link_ne" },
    { x: 540, y: 190, radius: 16, zone: "wall_link_ne_2" },
    { x: 635, y: 298, radius: 16, zone: "wall_link_e_1" },
    { x: 682, y: 442, radius: 16, zone: "wall_link_e_2" },
    { x: 682, y: 600, radius: 16, zone: "wall_link_e_3" },
    { x: 635, y: 740, radius: 16, zone: "wall_link_se_1" },
    { x: 540, y: 850, radius: 16, zone: "wall_link_se_2" },
    { x: 268, y: 118, radius: 16, zone: "wall_link_nw" },
    { x: 180, y: 190, radius: 16, zone: "wall_link_nw_2" },
    { x: 85, y: 298, radius: 16, zone: "wall_link_w_1" },
    { x: 38, y: 442, radius: 16, zone: "wall_link_w_2" },
    { x: 38, y: 600, radius: 16, zone: "wall_link_w_3" },
    { x: 85, y: 740, radius: 16, zone: "wall_link_sw_1" },
    { x: 180, y: 850, radius: 16, zone: "wall_link_sw_2" },
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
    walkableRects: [{ x: 100, y: 120, w: 520, h: 1100 + extra, zone: "arena" }],
    walkableCircles: [],
    blockedCircles: [],
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

export function isWalkable(world, x, y, margin = 0) {
  if (!world) return true;
  if (isInsideBlockedCircle(world, x, y, margin)) return false;
  for (const r of world.walkableRects || []) {
    if (
      x >= r.x + margin &&
      x <= r.x + r.w - margin &&
      y >= r.y + margin &&
      y <= r.y + r.h - margin
    ) {
      return true;
    }
  }
  for (const c of world.walkableCircles || []) {
    if (dist(x, y, c.x, c.y) <= c.radius - margin) return true;
  }
  return false;
}

export function playerInsideBossArena(world, px, py, margin = 12) {
  return isInsideBossArena(world, px, py, margin);
}

export function playerNearBossArena(world, px, py) {
  const ba = world?.bossArena;
  if (!ba) return false;
  const enter = world.bossUnlock?.enterRadius ?? ba.radius + 40;
  return dist(px, py, ba.x, ba.y) <= enter;
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

export function constrainMove(world, ox, oy, nx, ny, r, { lockBossArena = false } = {}) {
  if (!world) return { x: nx, y: ny };
  if (lockBossArena && world.bossArena) {
    return clampToBossArena(world, nx, ny, r);
  }
  if (isWalkable(world, nx, ny, r)) return { x: nx, y: ny };
  if (isWalkable(world, nx, oy, r)) return { x: nx, y: oy };
  if (isWalkable(world, ox, ny, r)) return { x: ox, y: ny };
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
      const rad = rand() * Math.max(1, c.radius - margin);
      x = c.x + Math.cos(a) * rad;
      y = c.y + Math.sin(a) * rad;
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
