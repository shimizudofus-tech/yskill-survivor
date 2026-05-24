import {
  VIEWPORT_W,
  VIEWPORT_H,
  ARENA_W,
  ARENA_H,
  PLAYER_R,
  BASE_FIRE_MS,
  BOSS_BONUS,
  ENEMY_TYPES,
  PALETTE,
  LEVEL_UP_INTERVAL_MS,
  ACTIVE_HERO_CONFIG,
  PLAYABLE_HEROES,
} from "./config.js";
import {
  getAdventureWorldConfig,
  FollowCamera,
  constrainMove,
  isWalkable,
  randomWalkablePoint,
  randomSpawnNearPlayer,
  playerNearBossArena,
  canUnlockBoss,
} from "./adventure-world.js";
import { getBossDefinition } from "./stages.js";
import { HeroSprite } from "./hero-sprite.js";
import { SkillManager } from "./skill-manager.js";
import { getSettings } from "./storage.js";
import { Sfx } from "./audio.js";

function difficultyAt(seconds, mult = 1) {
  return (1 + Math.floor(Math.max(0, seconds) / 10) * 0.25) * mult;
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

function isDevEnvironment() {
  const host = globalThis.location?.hostname ?? "";
  return host === "localhost" || host === "127.0.0.1" || host.endsWith(".local");
}

/** F2 collision overlay — localhost, Cloudflare preview, or ?debug=1 / localStorage. */
function canToggleCollisionDebug() {
  if (isDevEnvironment()) return true;
  const host = globalThis.location?.hostname ?? "";
  if (host.endsWith(".pages.dev")) return true;
  try {
    if (new URLSearchParams(globalThis.location?.search || "").get("debug") === "1") return true;
    if (globalThis.localStorage?.getItem("yskill_debug") === "1") return true;
  } catch {
    /* ignore */
  }
  return false;
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
    this.skillManager = new SkillManager({ rand: this.rand });
    this.sfx = options.sfx instanceof Sfx ? options.sfx : new Sfx(options.sound !== false);
    this.onState = options.onState || (() => {});
    this.onGameOver = options.onGameOver || (() => {});
    this.onVictory = options.onVictory || (() => {});
    this.tBoss = options.tBoss || (() => "BOSS");
    this.tPortalSealed = options.tPortalSealed || (() => "Portail scellé — Survis 45 s ou élimine 22 ennemis");
    this.tPortalOpen = options.tPortalOpen || (() => "PORTAIL DU BOSS OUVERT");
    this.getMoveVector = options.getMoveVector || null;
    this.useCanvasTouch = options.useCanvasTouch !== false;
    this.onImpact = options.onImpact || null;
    this.onLevelUp = options.onLevelUp || null;
    this.metaEffects = options.effects || {};
    this.runConfig = options.runConfig || { mode: "adventure" };
    this.stageConfig = this.runConfig.stageConfig || null;
    this.viewW = VIEWPORT_W;
    this.viewH = VIEWPORT_H;
    this.isAdventureWorld = this.runConfig.mode === "adventure" && Boolean(this.stageConfig?.id);
    this.worldConfig = this.isAdventureWorld ? getAdventureWorldConfig(this.stageConfig.id) : null;
    this.worldW = this.worldConfig?.worldWidth ?? VIEWPORT_W;
    this.worldH = this.worldConfig?.worldHeight ?? VIEWPORT_H;
    this.camera = this.worldConfig
      ? new FollowCamera(VIEWPORT_W, VIEWPORT_H, this.worldW, this.worldH)
      : null;
    this._bossArenaUnlocked = false;
    this._bossFightLocked = false;
    this.assetManager = options.assetManager || null;
    this._bossPortalOpenBanner = null;
    this._collisionDebug = false;
    this._bgImage = null;
    this._bgImageReady = false;
    if (this.worldConfig?.backgroundAsset) {
      this._applyBackground(this.worldConfig.backgroundAsset);
    }
    this.difficultyMult = this.stageConfig?.difficultyMultiplier ?? 1;
    this.bossAtMs = this.stageConfig?.durationBeforeBossMs ?? 5 * 60 * 1000;
    this.bossWarnMs = Math.max(0, this.bossAtMs - 2000);
    this.allowRevive = this.runConfig.allowRevive !== false;
    this.combatEffects = { ...this.metaEffects };
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
    this._stageBossId = this.stageConfig?.bossId ?? null;
    this._stageCleared = false;
    this.invulnMs = 0;
    this.shakeMs = 0;

    const spawn = this.worldConfig?.playerSpawn ?? { x: VIEWPORT_W / 2, y: VIEWPORT_H / 2 };
    this.player = { x: spawn.x, y: spawn.y, vx: 0, vy: 0 };
    this.enemies = [];
    this.bullets = [];
    this.pickups = [];
    this.particles = [];
    this.keys = new Set();
    const heroId = getSettings().heroId || "hero_male";
    const heroConfig = PLAYABLE_HEROES[heroId] || ACTIVE_HERO_CONFIG;
    this.heroSprite = new HeroSprite(heroConfig, this.assetManager);
    void this.heroSprite.load().catch(() => {});

    this._bindInput();
    this._resize();
  }

  _bindInput() {
    this._onKeyDown = (e) => {
      if (e.key === "F2" && canToggleCollisionDebug()) {
        e.preventDefault();
        this._collisionDebug = !this._collisionDebug;
        return;
      }
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

  _applyBackground(path) {
    const cached = this.assetManager?.getImage(path);
    if (cached) {
      this._bgImage = cached;
      this._bgImageReady = true;
      return;
    }
    this._loadBackground(path);
  }

  _loadBackground(path) {
    const img = new Image();
    img.decoding = "async";
    img.onload = () => {
      this._bgImage = img;
      this._bgImageReady = true;
    };
    img.onerror = () => {
      this._bgImage = null;
      this._bgImageReady = false;
    };
    img.src = path;
  }

  _resize() {
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    this.canvas.width = VIEWPORT_W * dpr;
    this.canvas.height = VIEWPORT_H * dpr;
    this.ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    this.camera?.resize(VIEWPORT_W, VIEWPORT_H, this.worldW, this.worldH);
  }

  applyEffects(effects) {
    this.metaEffects = effects || {};
    this._recomputeCombatEffects();
  }

  _runLevel(id) {
    return this.skillManager.getLevel(id);
  }

  _recomputeCombatEffects() {
    this.combatEffects = this.skillManager.computeCombatEffects(this.metaEffects);
  }

  _totalRunPicks() {
    return this.skillManager.totalPicks();
  }

  _rollLevelUpChoices() {
    return this.skillManager.generateLevelUpOptions(3);
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
    const def = this.skillManager.getDefinition(id);
    if (!def || this._runLevel(id) >= def.max) return false;
    const result = this.skillManager.applyUpgrade(id, { validatePending: true });
    if (!result.ok) return false;
    if (result.maxHpDelta) {
      this.maxHp += result.maxHpDelta;
      this.hp = Math.min(this.maxHp, this.hp + (result.heal || 0));
    } else if (result.heal) {
      this.hp = Math.min(this.maxHp, this.hp + result.heal);
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
    this.skillManager.reset();
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
    this._bossArenaUnlocked = false;
    this._bossFightLocked = false;
    this._bossPortalOpenBanner = null;
    this._stageCleared = false;
    this.invulnMs = 800;
    this.shakeMs = 0;
    const spawn = this.worldConfig?.playerSpawn ?? { x: VIEWPORT_W / 2, y: VIEWPORT_H / 2 };
    this.player.x = spawn.x;
    this.player.y = spawn.y;
    this.player.vx = 0;
    this.player.vy = 0;
    this.heroSprite.reset();
    this.camera?.follow(this.player.x, this.player.y, true);
    requestAnimationFrame((t) => this._loop(t));
  }

  revive() {
    if (!this.allowRevive || this.revived || this.running) return false;
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
      difficulty: difficultyAt(this.elapsedMs / 1000, this.difficultyMult),
      levelUpPending: this.levelUpPending,
      stageName: this.stageConfig?.name,
    });
    requestAnimationFrame((t) => this._loop(t));
  }

  _update(dt) {
    if (this._stageCleared) return;

    if (this.elapsedMs >= this._nextLevelUpMs) {
      this._triggerLevelUp();
      return;
    }

    const sec = this.elapsedMs / 1000;
    const diff = difficultyAt(sec, this.difficultyMult);
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

    const ox = this.player.x;
    const oy = this.player.y;
    const nx = ox + (this.player.vx * dt) / 1000;
    const ny = oy + (this.player.vy * dt) / 1000;

    if (this.worldConfig) {
      const p = constrainMove(this.worldConfig, ox, oy, nx, ny, PLAYER_R);
      this.player.x = p.x;
      this.player.y = p.y;
      this.camera?.follow(this.player.x, this.player.y);
    } else {
      this.player.x = clamp(nx, PLAYER_R, this.worldW - PLAYER_R);
      this.player.y = clamp(ny, PLAYER_R, this.worldH - PLAYER_R);
    }

    this.heroSprite.update(dt, this.player.vx, this.player.vy);

    if (!this._bossSpawned && !this._bossFightLocked) {
      this.spawnTimer -= dt;
      const spawnEvery = Math.max(220, 1100 / diff);
      const maxEnemies = Math.min(50, Math.floor(14 + diff * 10));
      if (this.spawnTimer <= 0 && this.enemies.length < maxEnemies) {
        this.spawnTimer = spawnEvery;
        if (this.worldConfig) this._spawnEnemyWorld(diff);
        else this._spawnEnemy(diff);
      }

      const decade = Math.floor(sec / 10);
      if (decade >= 1 && decade !== this._lastEliteDecade) {
        this._lastEliteDecade = decade;
        if (this.worldConfig) this._spawnEliteWorld(decade, diff);
        else this._spawnElite(decade, diff);
      }
    }

    if (this.worldConfig) {
      this._updateAdventureBoss();
    } else if (this.elapsedMs >= this.bossWarnMs && !this._bossSpawned && !this._bossWarning) {
      this._bossWarning = { startedAt: this.elapsedMs, duration: 2000 };
    }

    if (this._bossWarning && !this._bossSpawned) {
      if (this.elapsedMs - this._bossWarning.startedAt >= this._bossWarning.duration) {
        this._spawnStageBoss();
        this._bossSpawned = true;
        this._bossFightLocked = Boolean(this.worldConfig);
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
      if (this.worldConfig) this._spawnPickupWorld();
      else this._spawnPickup();
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

    const enemySpeed = (42 + diff * 26) * this.difficultyMult;
    for (const e of this.enemies) {
      this._updateBossBehavior(e, dt, enemySpeed);
    }

    for (const b of this.bullets) {
      b.x += b.vx * (dt / 1000);
      b.y += b.vy * (dt / 1000);
      b.life -= dt;
    }
    this.bullets = this.bullets.filter(
      (b) =>
        b.life > 0 &&
        b.x >= -40 &&
        b.y >= -40 &&
        b.x <= this.worldW + 40 &&
        b.y <= this.worldH + 40,
    );

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
            const wasStageBoss = e.kind === "boss" && e.bossId === this._stageBossId;
            if (e.kind === "boss") {
              this.bossBonusScore += e.bonusScore ?? BOSS_BONUS;
            }
            this.enemies.splice(i, 1);
            this.kills += 1;
            this.sfx.kill();
            this.onImpact?.("light");
            if (wasStageBoss) {
              this._victory();
              return;
            }
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

  _updateBossBehavior(e, dt, baseSpeed) {
    const d = dist(e.x, e.y, this.player.x, this.player.y) || 1;
    const dx = (this.player.x - e.x) / d;
    const dy = (this.player.y - e.y) / d;
    let mul = e.kind === "elite" ? 0.78 : e.kind === "boss" ? e.speedMul || 0.55 : e.speedMul || 1;

    if (e.kind === "boss" && e.behavior) {
      e.behaviorTimer = (e.behaviorTimer || 0) + dt;

      if (e.behavior === "slime" && e.regenPerSec) {
        e.hp = Math.min(e.maxHp, e.hp + (e.regenPerSec * dt) / 1000);
      }

      if (e.behavior === "dash") {
        const interval = e.dashIntervalMs || 3200;
        if (!e.dashing && e.behaviorTimer >= interval) {
          e.dashing = true;
          e.dashLeftMs = 450;
          e.behaviorTimer = 0;
        }
        if (e.dashing) {
          mul *= e.dashSpeedMul || 2.5;
          e.dashLeftMs -= dt;
          if (e.dashLeftMs <= 0) e.dashing = false;
        }
      }

      if (e.behavior === "hop") {
        const interval = e.hopIntervalMs || 2800;
        if (!e.hopping && e.behaviorTimer >= interval) {
          e.hopping = true;
          e.hopLeftMs = 380;
          e.behaviorTimer = 0;
        }
        if (e.hopping) {
          mul *= e.hopSpeedMul || 3;
          e.hopLeftMs -= dt;
          if (e.hopLeftMs <= 0) e.hopping = false;
        } else {
          mul *= 0.25;
        }
      }

      if (e.behavior === "guardian") {
        const interval = e.minionIntervalMs || 8000;
        if (e.behaviorTimer >= interval) {
          e.behaviorTimer = 0;
          this._spawnMinion(e.x, e.y);
        }
      }
    }

    e.x += dx * ((baseSpeed * mul * dt) / 1000);
    e.y += dy * ((baseSpeed * mul * dt) / 1000);

    if (this.worldConfig) {
      if (!isWalkable(this.worldConfig, e.x, e.y, e.r * 0.45)) {
        e.x -= dx * ((baseSpeed * mul * dt) / 1000);
        e.y -= dy * ((baseSpeed * mul * dt) / 1000);
      }
    }
  }

  _updateAdventureBoss() {
    if (this._bossSpawned) return;

    if (!this._bossArenaUnlocked && canUnlockBoss(this.worldConfig, this.elapsedMs, this.kills)) {
      this._bossArenaUnlocked = true;
      this._bossPortalOpenBanner = { startedAt: this.elapsedMs, duration: 3500 };
    }

    if (
      this._bossArenaUnlocked &&
      !this._bossWarning &&
      !this._bossSpawned
    ) {
      this._bossWarning = { startedAt: this.elapsedMs, duration: 2000 };
    }
  }

  _spawnEnemyWorld(diff) {
    const minDist = Math.max(this.viewW, this.viewH) * 0.52;
    const maxDist = minDist + 140;
    const pos = randomSpawnNearPlayer(
      this.worldConfig,
      this.player.x,
      this.player.y,
      this.rand,
      minDist,
      maxDist,
      12,
    );
    const type = ENEMY_TYPES[Math.floor(this.rand() * ENEMY_TYPES.length)];
    const hpScale = Math.max(1, Math.floor(type.hp * this.difficultyMult));
    this.enemies.push({
      ...type,
      x: pos.x,
      y: pos.y,
      kind: "normal",
      color: PALETTE[Math.floor(this.rand() * PALETTE.length)],
      hp: hpScale,
      maxHp: hpScale,
    });
  }

  _spawnEliteWorld(decade, diff) {
    const minDist = Math.max(this.viewW, this.viewH) * 0.45;
    const pos = randomSpawnNearPlayer(
      this.worldConfig,
      this.player.x,
      this.player.y,
      this.rand,
      minDist,
      minDist + 100,
      18,
    );
    const hp = Math.floor((4 + decade) * this.difficultyMult);
    this.enemies.push({
      id: "elite",
      shape: "star",
      x: pos.x,
      y: pos.y,
      r: 18 + decade,
      kind: "elite",
      color: "#ff6eb4",
      hp,
      maxHp: hp,
      speedMul: 0.78,
    });
  }

  _spawnPickupWorld() {
    const pos = randomSpawnNearPlayer(
      this.worldConfig,
      this.player.x,
      this.player.y,
      this.rand,
      40,
      Math.max(this.viewW, this.viewH) * 0.45,
      8,
    );
    this.pickups.push({
      x: pos.x,
      y: pos.y,
      value: 15 + Math.floor(this.rand() * 25),
      lifeMs: 4000,
    });
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
    const hpScale = Math.max(1, Math.floor(type.hp * this.difficultyMult));
    this.enemies.push({
      ...type,
      x,
      y,
      kind: "normal",
      color: PALETTE[Math.floor(this.rand() * PALETTE.length)],
      hp: hpScale,
      maxHp: hpScale,
    });
  }

  _spawnMinion(bx, by) {
    const angle = this.rand() * Math.PI * 2;
    this.enemies.push({
      id: "minion",
      shape: "circle",
      x: bx + Math.cos(angle) * 20,
      y: by + Math.sin(angle) * 20,
      r: 10,
      kind: "normal",
      color: "#86efac",
      hp: 2,
      maxHp: 2,
      speedMul: 1.1,
    });
  }

  _spawnElite(decade, diff) {
    const x = this.rand() < 0.5 ? 30 : ARENA_W - 30;
    const y = this.rand() < 0.5 ? 30 : ARENA_H - 30;
    const hp = Math.floor((4 + decade) * this.difficultyMult);
    this.enemies.push({
      id: "elite",
      shape: "star",
      x,
      y,
      r: 18 + decade,
      kind: "elite",
      color: "#ff6eb4",
      hp,
      maxHp: hp,
      speedMul: 0.78,
    });
  }

  _spawnStageBoss() {
    const def = getBossDefinition(this._stageBossId);
    if (!def) return;
    const hp = Math.floor(def.hp * this.difficultyMult);
    const ba = this.worldConfig?.bossArena;
    const bx = ba ? ba.x : VIEWPORT_W / 2;
    const by = ba ? ba.y : -40;
    this.enemies.push({
      ...def,
      x: bx,
      y: by,
      kind: "boss",
      bossId: def.id,
      hp,
      maxHp: hp,
      behaviorTimer: 0,
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
      canRevive: this.allowRevive && !this.revived,
      revived: this.revived,
    });
  }

  _victory() {
    this._stageCleared = true;
    this.running = false;
    this.sfx.boss();
    this.onVictory({
      score: this.score(),
      elapsedMs: this.elapsedMs,
      kills: this.kills,
      revived: this.revived,
      bossName: this.stageConfig?.bossName,
      stageName: this.stageConfig?.name,
      stageId: this.stageConfig?.id,
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

  _drawWorldBackground(ctx) {
    const w = this.worldW;
    const h = this.worldH;

    if (this._bgImageReady && this._bgImage) {
      ctx.drawImage(this._bgImage, 0, 0, w, h);
    } else {
      ctx.fillStyle = "#071008";
      ctx.fillRect(0, 0, w, h);

      for (const r of this.worldConfig?.walkableRects || []) {
        const grd = ctx.createLinearGradient(r.x, r.y, r.x, r.y + r.h);
        if (r.zone === "clearing") {
          grd.addColorStop(0, "#1a3d28");
          grd.addColorStop(1, "#142f20");
        } else if (r.zone === "spawn") {
          grd.addColorStop(0, "#152a1c");
          grd.addColorStop(1, "#0f2016");
        } else {
          grd.addColorStop(0, "#132618");
          grd.addColorStop(1, "#0e1d12");
        }
        ctx.fillStyle = grd;
        ctx.fillRect(r.x, r.y, r.w, r.h);
      }

      const ba = this.worldConfig?.bossArena;
      if (ba) {
        ctx.fillStyle = "#1a3328";
        ctx.beginPath();
        ctx.arc(ba.x, ba.y, ba.radius, 0, Math.PI * 2);
        ctx.fill();
        ctx.strokeStyle = "rgba(94, 234, 212, 0.35)";
        ctx.lineWidth = 3;
        ctx.beginPath();
        ctx.arc(ba.x, ba.y, ba.radius, 0, Math.PI * 2);
        ctx.stroke();
      }
    }

    if (this.running) {
      ctx.fillStyle = "rgba(3, 8, 10, 0.18)";
      ctx.fillRect(0, 0, w, h);
    }
  }

  _drawCollisionDebug(ctx) {
    const zoneColors = {
      arena: "rgba(34, 197, 94, 0.22)",
      main_clearing: "rgba(250, 204, 21, 0.22)",
    };

    for (const r of this.worldConfig?.walkableRects || []) {
      ctx.fillStyle = zoneColors[r.zone] || "rgba(34, 197, 94, 0.38)";
      ctx.fillRect(r.x, r.y, r.w, r.h);
      ctx.strokeStyle = "rgba(255, 255, 255, 0.45)";
      ctx.lineWidth = 1;
      ctx.strokeRect(r.x, r.y, r.w, r.h);
      ctx.font = "10px monospace";
      ctx.fillStyle = "rgba(255, 255, 255, 0.85)";
      ctx.textAlign = "left";
      ctx.fillText(r.zone || "zone", r.x + 4, r.y + 12);
    }

    for (const c of this.worldConfig?.walkableCircles || []) {
      ctx.fillStyle = zoneColors[c.zone] || "rgba(34, 197, 94, 0.35)";
      ctx.beginPath();
      ctx.arc(c.x, c.y, c.radius, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = "rgba(255, 255, 255, 0.45)";
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.arc(c.x, c.y, c.radius, 0, Math.PI * 2);
      ctx.stroke();
      ctx.font = "10px monospace";
      ctx.fillStyle = "rgba(255, 255, 255, 0.85)";
      ctx.textAlign = "center";
      ctx.fillText(c.zone || "circle", c.x, c.y - c.radius + 12);
    }

    for (const c of this.worldConfig?.blockedCircles || []) {
      ctx.fillStyle = "rgba(239, 68, 68, 0.45)";
      ctx.beginPath();
      ctx.arc(c.x, c.y, c.radius, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = "rgba(239, 68, 68, 0.85)";
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.arc(c.x, c.y, c.radius, 0, Math.PI * 2);
      ctx.stroke();
      ctx.font = "10px monospace";
      ctx.fillStyle = "rgba(255, 220, 220, 0.95)";
      ctx.textAlign = "center";
      ctx.fillText(c.zone || "blocked", c.x, c.y);
    }

    const ba = this.worldConfig?.bossArena;
    if (ba) {
      ctx.fillStyle = "rgba(94, 234, 212, 0.08)";
      ctx.beginPath();
      ctx.arc(ba.x, ba.y, ba.radius, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = "rgba(94, 234, 212, 0.55)";
      ctx.lineWidth = 2;
      ctx.setLineDash([6, 6]);
      ctx.beginPath();
      ctx.arc(ba.x, ba.y, ba.radius, 0, Math.PI * 2);
      ctx.stroke();
      ctx.setLineDash([]);
      ctx.font = "10px monospace";
      ctx.fillStyle = "rgba(255, 255, 255, 0.85)";
      ctx.textAlign = "center";
      ctx.fillText("boss trigger", ba.x, ba.y);
    }

    ctx.fillStyle = "rgba(232, 121, 249, 0.9)";
    ctx.beginPath();
    ctx.arc(this.player.x, this.player.y, 6, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = "#fff";
    ctx.lineWidth = 1.5;
    ctx.stroke();

    if (this.camera) {
      ctx.strokeStyle = "rgba(255, 255, 255, 0.55)";
      ctx.lineWidth = 1;
      ctx.setLineDash([6, 4]);
      ctx.strokeRect(this.camera.x, this.camera.y, this.viewW, this.viewH);
      ctx.setLineDash([]);
    }
  }

  _drawArenaBackground(ctx) {
    ctx.fillStyle = "#0c0f14";
    ctx.fillRect(0, 0, this.viewW, this.viewH);

    ctx.strokeStyle = "#2a3347";
    ctx.lineWidth = 1;
    const gridStep = 40;
    for (let g = 0; g <= this.viewW; g += gridStep) {
      ctx.beginPath();
      ctx.moveTo(g, 0);
      ctx.lineTo(g, this.viewH);
      ctx.stroke();
    }
    for (let g = 0; g <= this.viewH; g += gridStep) {
      ctx.beginPath();
      ctx.moveTo(0, g);
      ctx.lineTo(this.viewW, g);
      ctx.stroke();
    }
  }

  _draw() {
    const ctx = this.ctx;
    ctx.save();
    if (this.shakeMs > 0) {
      ctx.translate((this.rand() - 0.5) * 6, (this.rand() - 0.5) * 6);
    }

    if (this.worldConfig && this.camera) {
      ctx.save();
      this.camera.applyTransform(ctx);
      this._drawWorldBackground(ctx);
      this._drawEntities(ctx);
      if (this._collisionDebug) this._drawCollisionDebug(ctx);
      ctx.restore();
      this._drawScreenOverlay(ctx);
    } else {
      this._drawArenaBackground(ctx);
      this._drawEntities(ctx);
      this._drawScreenOverlay(ctx);
    }

    ctx.restore();
  }

  _drawEntities(ctx) {
    for (const p of this.pickups) {
      const pulse = 0.7 + 0.3 * Math.sin(this.elapsedMs / 120 + p.x);
      ctx.fillStyle = `rgba(255, 229, 102, ${pulse})`;
      ctx.beginPath();
      ctx.arc(p.x, p.y, 5, 0, Math.PI * 2);
      ctx.fill();
    }

    for (const b of this.bullets) {
      ctx.fillStyle = "#93c5fd";
      ctx.strokeStyle = "#1e3a5f";
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.arc(b.x, b.y, 5, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();
    }

    for (const e of this.enemies) {
      ctx.save();
      ctx.translate(e.x, e.y);
      ctx.fillStyle = e.color;
      ctx.strokeStyle = e.kind === "boss" ? "#fbbf24" : "rgba(255,255,255,0.55)";
      ctx.lineWidth = e.kind === "boss" ? 3 : 1.5;
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
        ctx.fillStyle = e.kind === "boss" ? "#fbbf24" : "#3ecf8e";
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

    const heroAlpha = 1;
    const drawnHero = this.heroSprite.draw(
      ctx,
      this.player.x,
      this.player.y,
      this.player.vx,
      this.player.vy,
      this.elapsedMs,
      { alpha: heroAlpha },
    );
    if (!drawnHero) {
      ctx.save();
      ctx.globalAlpha = heroAlpha;
      ctx.fillStyle = "#7dd3fc";
      ctx.strokeStyle = "#c084fc";
      ctx.lineWidth = 2.5;
      ctx.beginPath();
      ctx.moveTo(this.player.x, this.player.y - PLAYER_R);
      ctx.lineTo(this.player.x + PLAYER_R * 0.85, this.player.y + PLAYER_R * 0.7);
      ctx.lineTo(this.player.x - PLAYER_R * 0.85, this.player.y + PLAYER_R * 0.7);
      ctx.closePath();
      ctx.fill();
      ctx.stroke();
      ctx.restore();
    }
  }

  _drawScreenOverlay(ctx) {
    if (this._collisionDebug && this.worldConfig) {
      const cam = this.camera;
      const u = this.worldConfig.bossUnlock || {};
      const remainSec = Math.max(0, Math.ceil(((u.minSurvivalMs || 0) - this.elapsedMs) / 1000));
      const remainKills = Math.max(0, (u.minKills || 0) - this.kills);
      let portalState = "sealed";
      if (this._bossFightLocked) portalState = "boss fight";
      else if (this._bossArenaUnlocked) portalState = "open";
      const lines = [
        "DEBUG COLLISIONS (F2)",
        `Joueur: ${Math.round(this.player.x)}, ${Math.round(this.player.y)}`,
        cam ? `Caméra: ${Math.round(cam.x)}, ${Math.round(cam.y)}` : "",
        `Portail: ${portalState}`,
        `Kills: ${this.kills} (besoin -${remainKills})`,
        `Temps avant ouverture: ${remainSec}s`,
      ].filter(Boolean);
      ctx.font = "11px monospace";
      ctx.textAlign = "left";
      let y = 72;
      for (const line of lines) {
        ctx.fillStyle = "rgba(0, 0, 0, 0.65)";
        ctx.fillRect(8, y - 11, ctx.measureText(line).width + 8, 14);
        ctx.fillStyle = "rgba(94, 234, 212, 0.95)";
        ctx.fillText(line, 12, y);
        y += 14;
      }
    }

    if (this._bossPortalOpenBanner) {
      const elapsed = this.elapsedMs - this._bossPortalOpenBanner.startedAt;
      if (elapsed < this._bossPortalOpenBanner.duration) {
        const fade = elapsed < 400 ? elapsed / 400 : elapsed > 3000 ? (3500 - elapsed) / 500 : 1;
        ctx.fillStyle = `rgba(94, 234, 212, ${0.75 * fade})`;
        ctx.font = "bold 15px system-ui,sans-serif";
        ctx.textAlign = "center";
        ctx.fillText(this.tPortalOpen(), this.viewW / 2, 52);
      } else {
        this._bossPortalOpenBanner = null;
      }
    }

    if (
      !this._bossArenaUnlocked &&
      !canUnlockBoss(this.worldConfig, this.elapsedMs, this.kills) &&
      playerNearBossArena(this.worldConfig, this.player.x, this.player.y)
    ) {
      ctx.fillStyle = "rgba(255, 255, 255, 0.92)";
      ctx.font = "600 12px system-ui,sans-serif";
      ctx.textAlign = "center";
      ctx.fillText(this.tPortalSealed(), this.viewW / 2, this.viewH - 28);
    }

    if (this._bossWarning) {
      const t = (this.elapsedMs - this._bossWarning.startedAt) / this._bossWarning.duration;
      const bossLabel = this.stageConfig?.bossName || this.tBoss();
      ctx.fillStyle = `rgba(168, 85, 247, ${0.35 + 0.35 * Math.sin(t * 20)})`;
      ctx.font = "bold 22px system-ui,sans-serif";
      ctx.textAlign = "center";
      ctx.fillText(bossLabel, this.viewW / 2, this.viewH / 2 - 12);
      ctx.font = "bold 16px system-ui,sans-serif";
      ctx.fillText(this.tBoss(), this.viewW / 2, this.viewH / 2 + 16);
    }

    if (this.levelUpPending) {
      ctx.fillStyle = "rgba(0, 0, 0, 0.55)";
      ctx.fillRect(0, 0, this.viewW, this.viewH);
    }
  }
}

export { formatTime, difficultyAt };
