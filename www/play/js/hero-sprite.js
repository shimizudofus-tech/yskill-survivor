import { ACTIVE_HERO_CONFIG, heroDisplaySize } from "./hero-config.js";

const MOVEMENT_CLIPS = ["idle", "walkDown", "walkSide", "walkUp"];

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
  }

  load() {
    const paths = new Set();
    for (const list of Object.values(this.config.animations)) {
      for (const p of list) paths.add(p);
    }
    return Promise.all([...paths].map(loadImage)).then((loaded) => {
      for (const { src, img } of loaded) this.frames.set(src, img);
      this.ready = MOVEMENT_CLIPS.every((key) =>
        this.config.animations[key].every((p) => this.frames.has(p)),
      );
    });
  }

  _pickClip(vx, vy) {
    const speed = Math.hypot(vx, vy);
    if (speed < 10) return { clip: "idle", flip: false };
    if (Math.abs(vy) >= Math.abs(vx) * 0.85) {
      return { clip: vy > 0 ? "walkDown" : "walkUp", flip: false };
    }
    return { clip: "walkSide", flip: vx < 0 };
  }

  draw(ctx, x, y, vx, vy, elapsedMs, { alpha = 1 } = {}) {
    if (!this.ready) return false;
    const { clip, flip } = this._pickClip(vx, vy);
    const paths = this.config.animations[clip];
    if (!paths?.length) return false;

    const frameIdx = Math.floor(elapsedMs / this.config.frameMs) % paths.length;
    const img = this.frames.get(paths[frameIdx]);
    if (!img) return false;

    const size = heroDisplaySize(this.config);
    const footY = y + this.config.collisionRadius * 0.15;

    ctx.save();
    ctx.globalAlpha = alpha;
    if (flip) {
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
