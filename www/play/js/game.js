import {
  ARENA_W,
  ARENA_H,
  PLAYER_R,
  BASE_FIRE_MS,
  BOSS_AT_MS,
  BOSS_WARN_MS,
  BOSS_BONUS,
  ENEMY_TYPES,
  PALETTE,
  RUN_UPGRADE_POOL,
  LEVEL_UP_INTERVAL_MS,
} from "./config.js";
import { Sfx } from "./audio.js";

function difficultyAt(seconds) {
  return 1 + Math.floor(Math.max(0, seconds) / 10) * 0.25;
}

function mulberry32(seed) {
  let a = seed >>> 0;
  return function rand() {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function dist(ax, ay, bx, by) {
  return Math.hypot(ax - bx, ay - by);
}

function clamp(v, min, max) {
  return Math.max(min, Math.min(max, v));
}

function formatTime(ms) {
  const s = Math.floor(ms / 1000);
  const m = Math.floor(s / 60);
  return `${m}:${String(s % 60).padStart(2, "0")}`;
}

export class YSkillSurvivorGame {
  constructor(canvas, options = {}) {
    this.canvas = canvas;
    this.ctx = canvas.getContext("2d");
    this.seed = (options.seed >>> 0) || (Date.now() & 0xffffffff);
    this.rand = mulberry32(this.seed);
    this.sfx = options.sfx instanceof Sfx ? options.sfx : new Sfx(options.sound !== false);
    this.onState = options.onState || (() => {});
    this.onGameOver = options.onGameOver || (() => {});
    this.tBoss = options.tBoss || (() => "BOSS");
    this.getMoveVector = options.getMoveVector || null;
    this.useCanvasTouch = options.useCanvasTouch !== false;
    this.onImpact = options.onImpact || null;
    this.onLevelUp = options.onLevelUp || null;
    this.metaEffects = options.effects || {};
    this.combatEffects = { ...this.metaEffects };
    this.runLevels = {};
    this.levelUpPending = false;
    this._nextLevelUpMs = LEVEL_UP_INTERVAL_MS;
    this.maxHp = 1;

    this._recomputeCombatEffects();

    this.running = false;
    this.paused = false;
    this.startedAt = 0;
    this.lastFrame = 0;
    this.elapsedMs = 0;
    this.kills = 0;
    this.pickupScore = 0;
    this.bossBonusScore = 0;
    this.hp = 1;
    this.revived = false;
    this.spawnTimer = 0;
    this.fireTimer = 0;
    this.pickupSpawnTimer = 1200;
    this._lastEliteDecade = -1;
    this._bossSpawned = false;
    this._bossWarning = null;
    this.invulnMs = 0;
    this.shakeMs = 0;

    this.player = { x: ARENA_W / 2, y: ARENA_H / 2, vx: 0, vy: 0 };
    this.enemies = [];
    this.bullets = [];
    this.pickups = [];
    this.particles = [];
    this.keys = new Set();

    this._bindInput();
    this._resize();
  }

  _bindInput() {
    this._onKeyDown = (e) => {
      if (["ArrowUp", "ArrowDown", "ArrowLeft", "ArrowRight", "w", "a", "s", "d", "z", "q"].includes(e.key)) {
        e.preventDefault();
      }
      this.keys.add(e.key.toLowerCase());
    };
    this._onKeyUp = (e) => this.keys.delete(e.key.toLowerCase());
    window.addEventListener("keydown", this._onKeyDown);
    window.addEventListener("keyup", this._onKeyUp);

    this._touchId = null;
    this._touchOrigin = null;
    if (this.useCanvasTouch) {
      this._onTouchStart = (e) => {
        if (this.getMoveVector || this._touchId != null) return;
        e.preventDefault();
        const t = e.changedTouches[0];
        if (!t) return;
        this._touchId = t.identifier;
        const rect = this.canvas.getBoundingClientRect();
        this._touchOrigin = { x: t.clientX - rect.left, y: t.clientY - rect.top };
      };
      this._onTouchMove = (e) => {
        if (this.getMoveVector) return;
        e.preventDefault();
        if (this._touchId == null || !this._touchOrigin) return;
        const t = [...e.changedTouches].find((x) => x.identifier === this._touchId);
        if (!t) return;
        const rect = this.canvas.getBoundingClientRect();
        const dx = t.clientX - rect.left - this._touchOrigin.x;
        const dy = t.clientY - rect.top - this._touchOrigin.y;
        const len = Math.hypot(dx, dy) || 1;
        const max = 52;
        const scale = Math.min(max, len) / len;
        const speed = 220 * (this.combatEffects.moveSpeedMult || 1);
        this.player.vx = (dx / len) * scale * speed;
        this.player.vy = (dy / len) * scale * speed;
      };
      this._onTouchEnd = (e) => {
        const t = [...e.changedTouches].find((x) => x.identifier === this._touchId);
        if (!t) return;
        this._touchId = null;
        this._touchOrigin = null;
        this.player.vx = 0;
        this.player.vy = 0;
      };
      this.canvas.addEventListener("touchstart", this._onTouchStart, { passive: false });
      this.canvas.addEventListener("touchmove", this._onTouchMove, { passive: false });
      this.canvas.addEventListener("touchend", this._onTouchEnd);
    }
  }

  _movementFromKeys() {
    let vx = 0;
    let vy = 0;
    const fr = document.documentElement.lang === "fr";
    if (this.keys.has("arrowleft") || this.keys.has("a") || (fr && this.keys.has("q"))) vx -= 1;
    if (this.keys.has("arrowright") || this.keys.has("d")) vx += 1;
    if (this.keys.has("arrowup") || this.keys.has("w") || (fr && this.keys.has("z"))) vy -= 1;
    if (this.keys.has("arrowdown") || this.keys.has("s")) vy += 1;
    return { vx, vy };
  }

  _resize() {
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    this.canvas.width = ARENA_W * dpr;
    this.canvas.height = ARENA_H * dpr;
    this.ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  }

  applyEffects(effects) {
    this.metaEffects = effects || {};
    this._recomputeCombatEffects();
  }

  _runLevel(id) {
    return Math.max(0, Math.floor(Number(this.runLevels[id]) || 0));
  }

  _recomputeCombatEffects() {
    const m = this.metaEffects;
    const r = this.runLevels;
    const multishotHits =
      (m.multishotHits || 1) + this._runLevel("runPierce");
    this.combatEffects = {
      fireRateMult: (m.fireRateMult || 1) * Math.pow(1.18, this._runLevel("runFire")),
      bulletDamage: (m.bulletDamage || 1) + this._runLevel("runDamage"),
      multishotHits,
      moveSpeedMult: (m.moveSpeedMult || 1) * Math.pow(1.12, this._runLevel("runSpeed")),
      bulletSpeedMult: m.bulletSpeedMult || 1,
      pickupRadius: (m.pickupRadius || 18) + this._runLevel("runMagnet") * 10,
      pickupScoreMult: m.pickupScoreMult || 1,
      invulnMs: m.invulnMs || 900,
    };
  }

  _totalRunPicks() {
    return Object.values(this.runLevels).reduce(
      (sum, n) => sum + Math.max(0, Math.floor(Number(n) || 0)),
      0,
    );
  }

  _rollLevelUpChoices() {
    const available = RUN_UPGRADE_POOL.filter(
      (u) => this._runLevel(u.id) < u.max,
    );
    if (!available.length) return [];
    const pool = [...available];
    const picks = [];
    while (picks.length < 3 && pool.length) {
      const idx = Math.floor(this.rand() * pool.length);
      picks.push(pool.splice(idx, 1)[0]);
    }
    return picks;
  }

  _triggerLevelUp() {
    const choices = this._rollLevelUpChoices();
    if (!choices.length) {
      this._nextLevelUpMs = this.elapsedMs + LEVEL_UP_INTERVAL_MS;
      return;
    }
    this.levelUpPending = true;
    this.onLevelUp?.({
      choices: choices.map((c) => ({
        id: c.id,
        level: this._runLevel(c.id) + 1,
        max: c.max,
      })),
    });
  }

  pickRunUpgrade(id) {
    if (!this.levelUpPending) return false;
    const def = RUN_UPGRADE_POOL.find((u) => u.id === id);
    if (!def || this._runLevel(id) >= def.max) return false;
    this.runLevels[id] = this._runLevel(id) + 1;
    if (id === "runVitality") {
      this.maxHp += 1;
      this.hp = Math.min(this.maxHp, this.hp + 1);
    }
    this._recomputeCombatEffects();
    this.levelUpPending = false;
    this._nextLevelUpMs = this.elapsedMs + LEVEL_UP_INTERVAL_MS;
    this.lastFrame = performance.now();
    this.onImpact?.("light");
    if (this.running && !this.paused) {
      requestAnimationFrame((t) => this._loop(t));
    }
    return true;
  }

  score() {
    return (
      Math.floor(this.elapsedMs / 100) +
      this.kills * 30 +
      this.pickupScore +
      this.bossBonusScore
    );
  }

  start() {
    if (this.running) return;
    this.running = true;
    this.paused = false;
    this.startedAt = performance.now();
    this.lastFrame = this.startedAt;
    this.elapsedMs = 0;
    this.kills = 0;
    this.pickupScore = 0;
    this.bossBonusScore = 0;
    this.hp = 1;
    this.maxHp = 1;
    this.revived = false;
    this.runLevels = {};
    this.levelUpPending = false;
    this._nextLevelUpMs = LEVEL_UP_INTERVAL_MS;
    this._recomputeCombatEffects();
    this.enemies = [];
    this.bullets = [];
    this.pickups = [];
    this.particles = [];
    this.spawnTimer = 0;
    this.fireTimer = 0;
    this.pickupSpawnTimer = 1200;
    this._lastEliteDecade = -1;
    this._bossSpawned = false;
    this._bossWarning = null;
    this.invulnMs = 800;
    this.shakeMs = 0;
    this.player.x = ARENA_W / 2;
    this.player.y = ARENA_H / 2;
    this.player.vx = 0;
    this.player.vy = 0;
    requestAnimationFrame((t) => this._loop(t));
  }

  revive() {
    if (this.revived || this.running) return false;
    this.revived = true;
    this.hp = 1;
    this.invulnMs = 1500;
    this.running = true;
    this.lastFrame = performance.now();
    requestAnimationFrame((t) => this._loop(t));
    return true;
  }

  pause() {
    if (!this.running || this.paused || this.levelUpPending) return;
    this.paused = true;
  }

  resume() {
    if (!this.paused) return;
    this.paused = false;
    this.lastFrame = performance.now();
    requestAnimationFrame((t) => this._loop(t));
  }

  stop() {
    this.running = false;
    this.paused = false;
  }

  destroy() {
    this.stop();
    this.sfx.destroy();
    window.removeEventListener("keydown", this._onKeyDown);
    window.removeEventListener("keyup", this._onKeyUp);
    if (this.useCanvasTouch && this._onTouchStart) {
      this.canvas.removeEventListener("touchstart", this._onTouchStart);
      this.canvas.removeEventListener("touchmove", this._onTouchMove);
      this.canvas.removeEventListener("touchend", this._onTouchEnd);
    }
  }

  _loop(now) {
    if (!this.running || this.paused) return;
    const dt = Math.min(32, now - this.lastFrame);
    this.lastFrame = now;
    this.elapsedMs = now - this.startedAt;
    if (!this.levelUpPending) {
      this._update(dt);
    }
    this._draw();
    this.onState({
      elapsedMs: this.elapsedMs,
      timeLabel: formatTime(this.elapsedMs),
      kills: this.kills,
      hp: this.hp,
      maxHp: this.maxHp,
      runLevel: this._totalRunPicks(),
      score: this.score(),
      difficulty: difficultyAt(this.elapsedMs / 1000),
      levelUpPending: this.levelUpPending,
    });
    requestAnimationFrame((t) => this._loop(t));
  }

  _update(dt) {
    if (this.elapsedMs >= this._nextLevelUpMs) {
      this._triggerLevelUp();
      return;
    }

    const sec = this.elapsedMs / 1000;
    const diff = difficultyAt(sec);
    const eff = this.combatEffects;

    const stick = this.getMoveVector?.();
    const stickActive = stick && (Math.abs(stick.x) > 0.001 || Math.abs(stick.y) > 0.001);
    const speed = (175 + Math.min(40, sec * 0.4)) * (eff.moveSpeedMult || 1);

    if (stickActive) {
      this.player.vx = stick.x * speed;
      this.player.vy = stick.y * speed;
    } else if (this._touchId == null) {
      const { vx, vy } = this._movementFromKeys();
      const len = Math.hypot(vx, vy) || 1;
      this.player.vx = (vx / len) * speed;
      this.player.vy = (vy / len) * speed;
    }

    this.player.x = clamp(this.player.x + (this.player.vx * dt) / 1000, PLAYER_R, ARENA_W - PLAYER_R);
    this.player.y = clamp(this.player.y + (this.player.vy * dt) / 1000, PLAYER_R, ARENA_H - PLAYER_R);

    this.spawnTimer -= dt;
    const spawnEvery = Math.max(220, 1100 / diff);
    const maxEnemies = Math.min(50, Math.floor(14 + diff * 10));
    if (this.spawnTimer <= 0 && this.enemies.length < maxEnemies) {
      this.spawnTimer = spawnEvery;
      this._spawnEnemy(diff);
    }

    const decade = Math.floor(sec / 10);
    if (decade >= 1 && decade !== this._lastEliteDecade) {
      this._lastEliteDecade = decade;
      this._spawnElite(decade, diff);
    }

    if (this.elapsedMs >= BOSS_WARN_MS && !this._bossSpawned && !this._bossWarning) {
      this._bossWarning = { startedAt: this.elapsedMs, duration: 2000 };
    }
    if (this._bossWarning && !this._bossSpawned) {
      if (this.elapsedMs - this._bossWarning.startedAt >= this._bossWarning.duration) {
        this._spawnBoss();
        this._bossSpawned = true;
        this._bossWarning = null;
        this.sfx.boss();
        this.onImpact?.("heavy");
      }
    }

    this.fireTimer -= dt;
    const fireEvery = Math.max(110, BASE_FIRE_MS / Math.sqrt(diff) / (eff.fireRateMult || 1));
    if (this.fireTimer <= 0) {
      this.fireTimer = fireEvery;
      this._fireAtNearest();
    }

    this.pickupSpawnTimer -= dt;
    if (this.pickupSpawnTimer <= 0 && this.pickups.length < 5) {
      this.pickupSpawnTimer = 1800 + this.rand() * 1400;
      this._spawnPickup();
    }

    for (const p of this.pickups) p.lifeMs -= dt;
    this.pickups = this.pickups.filter((p) => p.lifeMs > 0);

    for (let i = this.pickups.length - 1; i >= 0; i--) {
      const p = this.pickups[i];
      if (dist(this.player.x, this.player.y, p.x, p.y) < (eff.pickupRadius || 18)) {
        this.pickupScore += Math.floor(p.value * (eff.pickupScoreMult || 1));
        this.pickups.splice(i, 1);
        this._burst(p.x, p.y, "#ffe566", 6);
        this.sfx.pickup();
      }
    }

    const enemySpeed = 42 + diff * 26;
    for (const e of this.enemies) {
      const d = dist(e.x, e.y, this.player.x, this.player.y) || 1;
      const mul = e.kind === "elite" ? 0.78 : e.kind === "boss" ? 0.55 : e.speedMul || 1;
      e.x += ((this.player.x - e.x) / d) * ((enemySpeed * mul * dt) / 1000);
      e.y += ((this.player.y - e.y) / d) * ((enemySpeed * mul * dt) / 1000);
    }

    for (const b of this.bullets) {
      b.x += b.vx * (dt / 1000);
      b.y += b.vy * (dt / 1000);
      b.life -= dt;
    }
    this.bullets = this.bullets.filter((b) => b.life > 0);

    const maxHits = eff.multishotHits || 1;
    const dmg = eff.bulletDamage || 1;
    for (const b of this.bullets) {
      b.hitCount = b.hitCount || 0;
      for (let i = this.enemies.length - 1; i >= 0; i--) {
        const e = this.enemies[i];
        if (dist(b.x, b.y, e.x, e.y) < e.r + 5) {
          e.hp -= dmg;
          b.hitCount += 1;
          this._burst(e.x, e.y, e.color, 4);
          if (e.hp <= 0) {
            if (e.kind === "boss") this.bossBonusScore += BOSS_BONUS;
            this.enemies.splice(i, 1);
            this.kills += 1;
            this.sfx.kill();
            this.onImpact?.("light");
          }
          if (b.hitCount >= maxHits) {
            b.life = 0;
            break;
          }
        }
      }
    }

    if (this.invulnMs > 0) this.invulnMs -= dt;
    if (this.shakeMs > 0) this.shakeMs -= dt;

    if (this.invulnMs <= 0) {
      for (const e of this.enemies) {
        if (dist(this.player.x, this.player.y, e.x, e.y) < PLAYER_R + e.r - 2) {
          this.hp -= 1;
          this.invulnMs = eff.invulnMs || 900;
          this.shakeMs = 200;
          this._burst(this.player.x, this.player.y, "#ff6688", 10);
          this.sfx.hurt();
          this.onImpact?.("medium");
          if (this.hp <= 0) {
            this._gameOver();
            return;
          }
          break;
        }
      }
    }

    for (const p of this.particles) {
      p.x += p.vx * (dt / 1000);
      p.y += p.vy * (dt / 1000);
      p.life -= dt;
    }
    this.particles = this.particles.filter((p) => p.life > 0);
  }

  _spawnEnemy(diff) {
    const edge = Math.floor(this.rand() * 4);
    let x = 0;
    let y = 0;
    if (edge === 0) {
      x = this.rand() * ARENA_W;
      y = -16;
    } else if (edge === 1) {
      x = ARENA_W + 16;
      y = this.rand() * ARENA_H;
    } else if (edge === 2) {
      x = this.rand() * ARENA_W;
      y = ARENA_H + 16;
    } else {
      x = -16;
      y = this.rand() * ARENA_H;
    }
    const type = ENEMY_TYPES[Math.floor(this.rand() * ENEMY_TYPES.length)];
    this.enemies.push({
      ...type,
      x,
      y,
      kind: "normal",
      color: PALETTE[Math.floor(this.rand() * PALETTE.length)],
      hp: type.hp,
      maxHp: type.hp,
    });
  }

  _spawnElite(decade, diff) {
    const x = this.rand() < 0.5 ? 30 : ARENA_W - 30;
    const y = this.rand() < 0.5 ? 30 : ARENA_H - 30;
    this.enemies.push({
      id: "elite",
      shape: "star",
      x,
      y,
      r: 18 + decade,
      kind: "elite",
      color: "#ff6eb4",
      hp: 4 + decade,
      maxHp: 4 + decade,
      speedMul: 0.78,
    });
  }

  _spawnBoss() {
    this.enemies.push({
      id: "boss",
      shape: "star",
      x: ARENA_W / 2,
      y: -40,
      r: 28,
      kind: "boss",
      color: "#a855f7",
      hp: 80,
      maxHp: 80,
      speedMul: 0.55,
    });
  }

  _spawnPickup() {
    this.pickups.push({
      x: 24 + this.rand() * (ARENA_W - 48),
      y: 24 + this.rand() * (ARENA_H - 48),
      value: 15 + Math.floor(this.rand() * 25),
      lifeMs: 4000,
    });
  }

  _fireAtNearest() {
    let best = null;
    let bestD = Infinity;
    for (const e of this.enemies) {
      const d = dist(this.player.x, this.player.y, e.x, e.y);
      if (d < bestD) {
        bestD = d;
        best = e;
      }
    }
    if (!best) return;
    const dx = best.x - this.player.x;
    const dy = best.y - this.player.y;
    const len = Math.hypot(dx, dy) || 1;
    const spd = 320 * (this.combatEffects.bulletSpeedMult || 1);
    this.bullets.push({
      x: this.player.x,
      y: this.player.y,
      vx: (dx / len) * spd,
      vy: (dy / len) * spd,
      life: 900,
    });
    this.sfx.shoot();
  }

  _burst(x, y, color, n = 8) {
    for (let i = 0; i < n; i++) {
      const a = this.rand() * Math.PI * 2;
      const s = 40 + this.rand() * 120;
      this.particles.push({
        x,
        y,
        vx: Math.cos(a) * s,
        vy: Math.sin(a) * s,
        life: 280 + this.rand() * 200,
        color,
      });
    }
  }

  _gameOver() {
    this.running = false;
    this.sfx.gameOver();
    this.onGameOver({
      score: this.score(),
      elapsedMs: this.elapsedMs,
      kills: this.kills,
      canRevive: !this.revived,
    });
  }

  _drawShape(ctx, shape, r) {
    if (shape === "circle") {
      ctx.arc(0, 0, r, 0, Math.PI * 2);
      return;
    }
    if (shape === "ring") {
      ctx.arc(0, 0, r, 0, Math.PI * 2);
      ctx.moveTo(r * 0.55, 0);
      ctx.arc(0, 0, r * 0.55, 0, Math.PI * 2, true);
      return;
    }
    if (shape === "triangle") {
      ctx.moveTo(0, -r);
      ctx.lineTo(r * 0.9, r * 0.8);
      ctx.lineTo(-r * 0.9, r * 0.8);
      ctx.closePath();
      return;
    }
    if (shape === "hex") {
      for (let i = 0; i < 6; i++) {
        const a = (Math.PI / 3) * i - Math.PI / 6;
        const px = Math.cos(a) * r;
        const py = Math.sin(a) * r;
        if (i === 0) ctx.moveTo(px, py);
        else ctx.lineTo(px, py);
      }
      ctx.closePath();
      return;
    }
    if (shape === "star") {
      for (let i = 0; i < 10; i++) {
        const a = (Math.PI / 5) * i - Math.PI / 2;
        const rad = i % 2 === 0 ? r : r * 0.45;
        const px = Math.cos(a) * rad;
        const py = Math.sin(a) * rad;
        if (i === 0) ctx.moveTo(px, py);
        else ctx.lineTo(px, py);
      }
      ctx.closePath();
    }
  }

  _draw() {
    const ctx = this.ctx;
    ctx.save();
    if (this.shakeMs > 0) {
      ctx.translate((this.rand() - 0.5) * 6, (this.rand() - 0.5) * 6);
    }

    ctx.fillStyle = "#0c0f14";
    ctx.fillRect(0, 0, ARENA_W, ARENA_H);

    ctx.strokeStyle = "#2a3347";
    ctx.lineWidth = 1;
    const gridStep = 40;
    for (let g = 0; g <= ARENA_W; g += gridStep) {
      ctx.beginPath();
      ctx.moveTo(g, 0);
      ctx.lineTo(g, ARENA_H);
      ctx.stroke();
    }
    for (let g = 0; g <= ARENA_H; g += gridStep) {
      ctx.beginPath();
      ctx.moveTo(0, g);
      ctx.lineTo(ARENA_W, g);
      ctx.stroke();
    }

    for (const p of this.pickups) {
      const pulse = 0.7 + 0.3 * Math.sin(this.elapsedMs / 120 + p.x);
      ctx.fillStyle = `rgba(255, 229, 102, ${pulse})`;
      ctx.beginPath();
      ctx.arc(p.x, p.y, 5, 0, Math.PI * 2);
      ctx.fill();
    }

    for (const b of this.bullets) {
      ctx.fillStyle = "#6ea8fe";
      ctx.beginPath();
      ctx.arc(b.x, b.y, 4, 0, Math.PI * 2);
      ctx.fill();
    }

    for (const e of this.enemies) {
      ctx.save();
      ctx.translate(e.x, e.y);
      ctx.fillStyle = e.color;
      ctx.strokeStyle = "rgba(255,255,255,0.25)";
      ctx.lineWidth = e.kind === "boss" ? 2 : 1;
      ctx.beginPath();
      this._drawShape(ctx, e.shape, e.r);
      if (e.shape === "ring") ctx.fill("evenodd");
      else ctx.fill();
      ctx.stroke();
      if (e.maxHp > 1) {
        const w = e.r * 2;
        const ratio = e.hp / e.maxHp;
        ctx.fillStyle = "rgba(0,0,0,0.5)";
        ctx.fillRect(-e.r, -e.r - 8, w, 4);
        ctx.fillStyle = "#3ecf8e";
        ctx.fillRect(-e.r, -e.r - 8, w * ratio, 4);
      }
      ctx.restore();
    }

    for (const p of this.particles) {
      ctx.globalAlpha = Math.max(0, p.life / 400);
      ctx.fillStyle = p.color;
      ctx.fillRect(p.x - 2, p.y - 2, 4, 4);
      ctx.globalAlpha = 1;
    }

    if (this.invulnMs > 0 && Math.floor(this.elapsedMs / 80) % 2 === 0) {
      ctx.globalAlpha = 0.55;
    }
    ctx.fillStyle = "#6ea8fe";
    ctx.strokeStyle = "#a855f7";
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(this.player.x, this.player.y - PLAYER_R);
    ctx.lineTo(this.player.x + PLAYER_R * 0.85, this.player.y + PLAYER_R * 0.7);
    ctx.lineTo(this.player.x - PLAYER_R * 0.85, this.player.y + PLAYER_R * 0.7);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();
    ctx.globalAlpha = 1;

    if (this._bossWarning) {
      const t = (this.elapsedMs - this._bossWarning.startedAt) / this._bossWarning.duration;
      ctx.fillStyle = `rgba(168, 85, 247, ${0.35 + 0.35 * Math.sin(t * 20)})`;
      ctx.font = "bold 28px system-ui,sans-serif";
      ctx.textAlign = "center";
      ctx.fillText(this.tBoss(), ARENA_W / 2, ARENA_H / 2);
    }

    if (this.levelUpPending) {
      ctx.fillStyle = "rgba(0, 0, 0, 0.55)";
      ctx.fillRect(0, 0, ARENA_W, ARENA_H);
    }

    ctx.restore();
  }
}

export { formatTime, difficultyAt };
