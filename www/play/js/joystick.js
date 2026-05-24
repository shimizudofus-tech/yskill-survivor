/**
 * Floating virtual joystick — canvas overlay, normalized vector, multi-touch safe.
 */

import { VIEWPORT_W, VIEWPORT_H } from "./config.js";

export class VirtualJoystick {
  /**
   * @param {HTMLCanvasElement} canvas
   * @param {{ maxRadius?: number, baseRadius?: number, knobRadius?: number, deadZone?: number }} [opts]
   */
  constructor(canvas, opts = {}) {
    this.canvas = canvas;
    this.maxRadius = opts.maxRadius ?? 50;
    this.baseRadius = opts.baseRadius ?? 62;
    this.knobRadius = opts.knobRadius ?? 22;
    this.deadZone = opts.deadZone ?? 0.12;

    this.active = false;
    this.touchId = null;
    /** @type {{ x: number, y: number }} anchor in logical viewport coords */
    this.anchor = { x: 0, y: 0 };
    /** @type {{ x: number, y: number }} knob offset from anchor (clamped) */
    this.knob = { x: 0, y: 0 };
    this.vector = { x: 0, y: 0 };

    this._onStart = this._onStart.bind(this);
    this._onMove = this._onMove.bind(this);
    this._onEnd = this._onEnd.bind(this);

    const passive = { passive: false };
    this.canvas.addEventListener("touchstart", this._onStart, passive);
    this.canvas.addEventListener("touchmove", this._onMove, passive);
    this.canvas.addEventListener("touchend", this._onEnd, passive);
    this.canvas.addEventListener("touchcancel", this._onEnd, passive);
  }

  /** Map touch client coords → logical canvas space (360×640). */
  _touchToCanvas(t) {
    const rect = this.canvas.getBoundingClientRect();
    return {
      x: ((t.clientX - rect.left) / rect.width) * VIEWPORT_W,
      y: ((t.clientY - rect.top) / rect.height) * VIEWPORT_H,
    };
  }

  _touchById(e) {
    if (this.touchId == null) return null;
    for (let i = 0; i < e.touches.length; i++) {
      if (e.touches[i].identifier === this.touchId) return e.touches[i];
    }
    return null;
  }

  _applyKnob(dx, dy) {
    const len = Math.hypot(dx, dy) || 0;
    if (len === 0) {
      this.knob = { x: 0, y: 0 };
      this.vector = { x: 0, y: 0 };
      return;
    }
    const clamped = Math.min(this.maxRadius, len);
    const nx = dx / len;
    const ny = dy / len;
    this.knob = { x: nx * clamped, y: ny * clamped };
    const vx = this.knob.x / this.maxRadius;
    const vy = this.knob.y / this.maxRadius;
    if (Math.hypot(vx, vy) < this.deadZone) {
      this.vector = { x: 0, y: 0 };
      return;
    }
    this.vector = { x: vx, y: vy };
  }

  _reset() {
    this.active = false;
    this.touchId = null;
    this.knob = { x: 0, y: 0 };
    this.vector = { x: 0, y: 0 };
  }

  _onStart(e) {
    if (this.touchId != null) return;
    e.preventDefault();
    const t = e.changedTouches[0];
    if (!t) return;
    this.touchId = t.identifier;
    this.active = true;
    const p = this._touchToCanvas(t);
    this.anchor = { x: p.x, y: p.y };
    this._applyKnob(0, 0);
  }

  _onMove(e) {
    if (this.touchId == null) return;
    e.preventDefault();
    const t = this._touchById(e);
    if (!t) return;
    const p = this._touchToCanvas(t);
    this._applyKnob(p.x - this.anchor.x, p.y - this.anchor.y);
  }

  _onEnd(e) {
    if (this.touchId == null) return;
    e.preventDefault();
    for (let i = 0; i < e.changedTouches.length; i++) {
      if (e.changedTouches[i].identifier === this.touchId) {
        this._reset();
        break;
      }
    }
  }

  /** @returns {{ x: number, y: number }} normalized direction (-1…1) */
  getVector() {
    return this.vector;
  }

  /** Draw base + knob in screen space while the player is touching. */
  draw(ctx) {
    if (!this.active) return;

    const bx = this.anchor.x;
    const by = this.anchor.y;
    const kx = bx + this.knob.x;
    const ky = by + this.knob.y;

    ctx.save();

    ctx.beginPath();
    ctx.arc(bx, by, this.baseRadius, 0, Math.PI * 2);
    ctx.fillStyle = "rgba(148, 163, 184, 0.18)";
    ctx.fill();
    ctx.strokeStyle = "rgba(226, 232, 240, 0.28)";
    ctx.lineWidth = 2;
    ctx.stroke();

    ctx.beginPath();
    ctx.arc(kx, ky, this.knobRadius, 0, Math.PI * 2);
    ctx.fillStyle = "rgba(94, 234, 212, 0.38)";
    ctx.fill();
    ctx.strokeStyle = "rgba(226, 232, 240, 0.55)";
    ctx.lineWidth = 2;
    ctx.stroke();

    ctx.restore();
  }

  destroy() {
    this.canvas.removeEventListener("touchstart", this._onStart);
    this.canvas.removeEventListener("touchmove", this._onMove);
    this.canvas.removeEventListener("touchend", this._onEnd);
    this.canvas.removeEventListener("touchcancel", this._onEnd);
    this._reset();
  }
}

export function prefersTouchControls() {
  return (
    window.matchMedia("(pointer: coarse)").matches ||
    window.matchMedia("(hover: none)").matches ||
    "ontouchstart" in window
  );
}
