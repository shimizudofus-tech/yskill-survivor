import { ACTIVE_HERO_CONFIG, heroDisplaySize } from "./hero-config.js";

const MOVEMENT_CLIPS = ["idle", "walkDown", "walkSide", "walkUp"];
const IDLE_SPEED = 8;
const WALK_SPEED = 14;

function loadImage(src) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.decoding = "async";
    img.onload = () => resolve({ src, img });
    img.onerror = () => reject(new Error(`hero sprite failed: ${src}`));
    img.src = src;
  });
}

export class HeroSprite {
  constructor(config = ACTIVE_HERO_CONFIG) {
    this.config = config;
    /** @type {Map<string, HTMLImageElement>} */
    this.frames = new Map();
    this.ready = false;
    this._clip = "idle";
    this._frameIdx = 0;
    this._frameAccMs = 0;
    this._flip = false;
    this._moving = false;
  }

  load() {
    const paths = new Set();
    for (const clip of MOVEMENT_CLIPS) {
      for (const p of this.config.animations[clip] || []) paths.add(p);
    }
    return Promise.allSettled([...paths].map(loadImage)).then((results) => {
      for (const r of results) {
        if (r.status !== "fulfilled") continue;
        const { src, img } = r.value;
        this.frames.set(src, img);
      }
      this.ready = MOVEMENT_CLIPS.every((key) =>
        this.config.animations[key].every((p) => this.frames.has(p)),
      );
    });
  }

  reset() {
    this._clip = "idle";
    this._frameIdx = 0;
    this._frameAccMs = 0;
    this._flip = false;
    this._moving = false;
  }

  _pickClip(vx, vy) {
    const speed = Math.hypot(vx, vy);
    if (this._moving) {
      if (speed < IDLE_SPEED) this._moving = false;
    } else if (speed > WALK_SPEED) {
      this._moving = true;
    }
    if (!this._moving) return { clip: "idle", flip: false };
    if (Math.abs(vy) >= Math.abs(vx) * 0.85) {
      return { clip: vy > 0 ? "walkDown" : "walkUp", flip: false };
    }
    return { clip: "walkSide", flip: vx < 0 };
  }

  _frameMsForClip(clip, speed) {
    const base =
      clip === "idle"
        ? (this.config.idleFrameMs ?? this.config.frameMs ?? 100)
        : (this.config.walkFrameMs ?? this.config.frameMs ?? 90);
    if (clip === "idle" || speed <= 0) return base;
    const ref = this.config.walkRefSpeed ?? 200;
    const ratio = ref / speed;
    return base * Math.min(1.25, Math.max(0.82, ratio));
  }

  _switchClip(nextClip) {
    if (nextClip === this._clip) return;
    const oldPaths = this.config.animations[this._clip] || [];
    const newPaths = this.config.animations[nextClip] || [];
    if (oldPaths.length && newPaths.length) {
      const phase = (this._frameIdx + this._frameAccMs / Math.max(1, this._frameMsForClip(this._clip, 0))) / oldPaths.length;
      this._frameIdx = Math.min(newPaths.length - 1, Math.floor(phase * newPaths.length));
    } else {
      this._frameIdx = 0;
    }
    this._frameAccMs = 0;
    this._clip = nextClip;
  }

  update(dt, vx, vy) {
    if (!this.ready || dt <= 0) return;
    const { clip, flip } = this._pickClip(vx, vy);
    this._switchClip(clip);
    this._flip = flip;

    const speed = Math.hypot(vx, vy);
    const frameMs = this._frameMsForClip(this._clip, speed);
    this._frameAccMs += dt;
    const paths = this.config.animations[this._clip] || [];
    if (!paths.length) return;

    while (this._frameAccMs >= frameMs) {
      this._frameAccMs -= frameMs;
      this._frameIdx = (this._frameIdx + 1) % paths.length;
    }
  }

  draw(ctx, x, y, _vx, _vy, _elapsedMs, { alpha = 1 } = {}) {
    if (!this.ready) return false;
    const paths = this.config.animations[this._clip];
    if (!paths?.length) return false;

    const img = this.frames.get(paths[this._frameIdx]);
    if (!img) return false;

    const size = heroDisplaySize(this.config);
    const footY = y + this.config.collisionRadius * 0.15;

    ctx.save();
    ctx.globalAlpha = alpha;
    if (this._flip) {
      ctx.translate(x, footY);
      ctx.scale(-1, 1);
      ctx.drawImage(img, -size / 2, -size / 2, size, size);
    } else {
      ctx.drawImage(img, x - size / 2, footY - size / 2, size, size);
    }
    ctx.restore();
    return true;
  }
}
