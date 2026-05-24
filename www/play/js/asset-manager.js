/**
 * Central preloader for images and audio (Canvas survivor — www/play/assets/).
 */

import {
  AUDIO_PATHS,
  CORE_IMAGE_PATHS,
  collectRunImagePaths,
  heroPortraitPaths,
} from "./runtime-assets.js";
import { VIEWPORT_W, VIEWPORT_H } from "./config.js";

export class AssetManager {
  constructor() {
    /** @type {Map<string, HTMLImageElement>} */
    this.images = new Map();
    /** @type {Map<string, HTMLAudioElement>} */
    this.audio = new Map();
    /** @type {Set<string>} */
    this._pending = new Set();
  }

  hasImage(src) {
    return this.images.has(src);
  }

  getImage(src) {
    return this.images.get(src) || null;
  }

  getAudio(key) {
    return this.audio.get(key) || null;
  }

  loadImage(src) {
    if (this.images.has(src)) {
      return Promise.resolve(this.images.get(src));
    }
    if (this._pending.has(src)) {
      return new Promise((resolve, reject) => {
        const tick = () => {
          if (this.images.has(src)) resolve(this.images.get(src));
          else if (!this._pending.has(src)) reject(new Error(`load aborted: ${src}`));
          else requestAnimationFrame(tick);
        };
        tick();
      });
    }

    this._pending.add(src);
    return new Promise((resolve, reject) => {
      const img = new Image();
      img.decoding = "async";
      img.onload = () => {
        this.images.set(src, img);
        this._pending.delete(src);
        resolve(img);
      };
      img.onerror = () => {
        this._pending.delete(src);
        reject(new Error(`image failed: ${src}`));
      };
      img.src = src;
    });
  }

  loadAudioEntry({ key, src }) {
    if (this.audio.has(key)) {
      return Promise.resolve(this.audio.get(key));
    }
    return new Promise((resolve, reject) => {
      const el = new Audio();
      el.preload = "auto";
      const done = () => {
        el.removeEventListener("canplaythrough", done);
        el.removeEventListener("error", fail);
        this.audio.set(key, el);
        resolve(el);
      };
      const fail = () => {
        el.removeEventListener("canplaythrough", done);
        el.removeEventListener("error", fail);
        reject(new Error(`audio failed: ${src}`));
      };
      el.addEventListener("canplaythrough", done, { once: true });
      el.addEventListener("error", fail, { once: true });
      el.src = src;
      el.load();
    });
  }

  /**
   * @param {string[]} paths
   * @param {{ onProgress?: (ratio: number) => void, optional?: boolean }} [opts]
   */
  async loadImages(paths, { onProgress, optional = false } = {}) {
    const unique = [...new Set(paths.filter(Boolean))];
    if (!unique.length) {
      onProgress?.(1);
      return { loaded: 0, failed: 0 };
    }

    let done = 0;
    let failed = 0;
    const bump = () => {
      done += 1;
      onProgress?.(Math.min(1, done / unique.length));
    };

    for (const src of unique) {
      try {
        await this.loadImage(src);
      } catch {
        failed += 1;
        if (!optional) throw new Error(`Asset load failed: ${src}`);
      }
      bump();
    }
    return { loaded: unique.length - failed, failed };
  }

  async loadAudioCatalog(entries = AUDIO_PATHS, { onProgress } = {}) {
    const list = entries.filter((e) => e?.key && e?.src);
    if (!list.length) {
      onProgress?.(1);
      return;
    }
    let done = 0;
    await Promise.allSettled(
      list.map(({ key, src }) =>
        this.loadAudioEntry({ key, src }).finally(() => {
          done += 1;
          onProgress?.(done / list.length);
        }),
      ),
    );
  }

  preloadCore({ onProgress } = {}) {
    const paths = [...new Set([...CORE_IMAGE_PATHS, ...heroPortraitPaths()])];
    return this.loadImages(paths, { onProgress, optional: true });
  }

  preloadForRun({ stageId, heroId }, { onProgress } = {}) {
    const images = collectRunImagePaths({ stageId, heroId });
    return this.loadImages(images, { onProgress, optional: false });
  }

  /** Canvas loading bar (360×640 logical). */
  static drawProgress(ctx, progress, label = "Chargement…") {
    const w = VIEWPORT_W;
    const h = VIEWPORT_H;
    const p = Math.max(0, Math.min(1, progress));

    ctx.save();
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.fillStyle = "#080d18";
    ctx.fillRect(0, 0, w, h);

    ctx.fillStyle = "rgba(94, 234, 212, 0.12)";
    ctx.fillRect(48, h * 0.52, w - 96, 12);
    ctx.fillStyle = "#5eead4";
    ctx.fillRect(48, h * 0.52, (w - 96) * p, 12);

    ctx.fillStyle = "#e2e8f0";
    ctx.font = "600 14px system-ui, sans-serif";
    ctx.textAlign = "center";
    ctx.fillText(label, w / 2, h * 0.48);

    ctx.fillStyle = "#94a3b8";
    ctx.font = "12px monospace";
    ctx.fillText(`${Math.round(p * 100)}%`, w / 2, h * 0.52 + 32);
    ctx.restore();
  }
}

/** Shared singleton for the app lifecycle. */
export const assets = new AssetManager();
