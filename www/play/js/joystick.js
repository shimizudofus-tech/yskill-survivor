/**
 * Virtual joystick for mobile — fixed zone, visual knob, normalized vector.
 */
export class VirtualJoystick {
  /**
   * @param {HTMLElement} root
   * @param {{ size?: number, knobSize?: number, deadZone?: number, maxRadius?: number }} [opts]
   */
  constructor(root, opts = {}) {
    this.root = root;
    this.size = opts.size ?? 132;
    this.knobSize = opts.knobSize ?? 52;
    this.deadZone = opts.deadZone ?? 0.14;
    this.maxRadius = opts.maxRadius ?? (this.size * 0.36);
    this.active = false;
    this.touchId = null;
    this.vector = { x: 0, y: 0 };
    this._center = { x: 0, y: 0 };

    this.root.classList.add("vjoy");
    this.root.style.setProperty("--vjoy-size", `${this.size}px`);
    this.root.style.setProperty("--vjoy-knob", `${this.knobSize}px`);
    this.root.innerHTML = `
      <div class="vjoy-base" aria-hidden="true"></div>
      <div class="vjoy-knob" aria-hidden="true"></div>
    `;
    this.knobEl = this.root.querySelector(".vjoy-knob");

    this._onStart = this._onStart.bind(this);
    this._onMove = this._onMove.bind(this);
    this._onEnd = this._onEnd.bind(this);

    this.root.addEventListener("touchstart", this._onStart, { passive: false });
    this.root.addEventListener("touchmove", this._onMove, { passive: false });
    this.root.addEventListener("touchend", this._onEnd);
    this.root.addEventListener("touchcancel", this._onEnd);
  }

  _pointFromTouch(t) {
    const rect = this.root.getBoundingClientRect();
    return {
      x: t.clientX - rect.left - rect.width / 2,
      y: t.clientY - rect.top - rect.height / 2,
    };
  }

  _applyVector(dx, dy) {
    const len = Math.hypot(dx, dy) || 1;
    const clamped = Math.min(this.maxRadius, len);
    const nx = (dx / len) * (clamped / this.maxRadius);
    const ny = (dy / len) * (clamped / this.maxRadius);
    if (Math.hypot(nx, ny) < this.deadZone) {
      this.vector = { x: 0, y: 0 };
      this.knobEl.style.transform = "translate(-50%, -50%)";
      return;
    }
    this.vector = { x: nx, y: ny };
    this.knobEl.style.transform = `translate(calc(-50% + ${nx * this.maxRadius}px), calc(-50% + ${ny * this.maxRadius}px))`;
  }

  _onStart(e) {
    if (this.touchId != null) return;
    e.preventDefault();
    const t = e.changedTouches[0];
    if (!t) return;
    this.touchId = t.identifier;
    this.active = true;
    this.root.classList.add("vjoy-active");
    const p = this._pointFromTouch(t);
    this._applyVector(p.x, p.y);
  }

  _onMove(e) {
    if (this.touchId == null) return;
    e.preventDefault();
    const t = [...e.changedTouches].find((x) => x.identifier === this.touchId);
    if (!t) return;
    const p = this._pointFromTouch(t);
    this._applyVector(p.x, p.y);
  }

  _onEnd(e) {
    const t = [...e.changedTouches].find((x) => x.identifier === this.touchId);
    if (!t) return;
    this.touchId = null;
    this.active = false;
    this.vector = { x: 0, y: 0 };
    this.root.classList.remove("vjoy-active");
    this.knobEl.style.transform = "translate(-50%, -50%)";
  }

  /** @returns {{ x: number, y: number }} */
  getVector() {
    return this.vector;
  }

  destroy() {
    this.root.removeEventListener("touchstart", this._onStart);
    this.root.removeEventListener("touchmove", this._onMove);
    this.root.removeEventListener("touchend", this._onEnd);
    this.root.removeEventListener("touchcancel", this._onEnd);
    this.root.innerHTML = "";
    this.root.classList.remove("vjoy", "vjoy-active");
  }
}

export function prefersTouchControls() {
  return (
    window.matchMedia("(pointer: coarse)").matches ||
    window.matchMedia("(hover: none)").matches ||
    "ontouchstart" in window
  );
}
