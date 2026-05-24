/**
 * Run skill inventory and level-up option engine (data-driven, no hardcoded skill names).
 */

import { ACTIVES, PASSIVES, EVOLUTIONS, buildSkillLookup } from "./skills-config.js";

const DEFAULT_COMBAT = {
  fireRateMult: 1,
  bulletDamage: 1,
  multishotHits: 1,
  moveSpeedMult: 1,
  bulletSpeedMult: 1,
  pickupRadius: 18,
  pickupScoreMult: 1,
  invulnMs: 900,
};

function shufflePick(pool, rand) {
  if (!pool.length) return null;
  const idx = Math.floor(rand() * pool.length);
  return pool.splice(idx, 1)[0];
}

function applyEffectStat(target, effect, level) {
  if (level <= 0) return;
  const { stat, apply, perLevel, usePow } = effect;
  if (apply === "add") {
    target[stat] = (target[stat] ?? 0) + perLevel * level;
  } else if (apply === "mult") {
    const base = target[stat] ?? 1;
    target[stat] = usePow ? base * Math.pow(perLevel, level) : base + perLevel * level;
  }
}

export class SkillManager {
  /**
   * @param {{ rand?: () => number }} [options]
   */
  constructor(options = {}) {
    this.rand = options.rand || Math.random;
    /** @type {Record<string, number>} skill id → current level */
    this.inventory = {};
    this._lookup = buildSkillLookup(ACTIVES, PASSIVES, EVOLUTIONS);
    this._actives = ACTIVES;
    this._passives = PASSIVES;
    this._evolutions = EVOLUTIONS;
    /** @type {Array<SkillDef | EvolutionDef> | null} */
    this._lastOptions = null;
  }

  reset() {
    this.inventory = {};
    this._lastOptions = null;
  }

  getLevel(skillId) {
    return Math.max(0, Math.floor(Number(this.inventory[skillId]) || 0));
  }

  /** @returns {SkillDef | EvolutionDef | null} */
  getDefinition(skillId) {
    return this._lookup.get(skillId) || null;
  }

  isMaxed(skillId) {
    const def = this.getDefinition(skillId);
    if (!def) return true;
    return this.getLevel(skillId) >= def.max;
  }

  /** Requirements read from EVOLUTIONS config — no skill-name branching. */
  getEligibleEvolutions() {
    return this._evolutions.filter((evo) => {
      if (this.isMaxed(evo.id)) return false;
      const activeDef = this._lookup.get(evo.requiredActive);
      const passiveDef = this._lookup.get(evo.requiredPassive);
      if (!activeDef || !passiveDef) return false;
      return (
        this.getLevel(evo.requiredActive) >= activeDef.max &&
        this.getLevel(evo.requiredPassive) >= passiveDef.max
      );
    });
  }

  /** Upgradeable actives/passives (not maxed, not hidden by pending evolution replace). */
  _upgradeableBaseSkills() {
    const list = [...this._actives, ...this._passives];
    return list.filter((def) => !this.isMaxed(def.id));
  }

  /**
   * Roll level-up choices for the player.
   * @param {number} [count=3]
   * @returns {Array<SkillDef | EvolutionDef>}
   */
  generateLevelUpOptions(count = 3) {
    const options = [];
    const used = new Set();

    for (const evo of this.getEligibleEvolutions()) {
      options.push(evo);
      used.add(evo.id);
    }

    const pool = this._upgradeableBaseSkills().filter((def) => !used.has(def.id));
    const target = Math.max(count, options.length);

    while (options.length < target && pool.length) {
      const pick = shufflePick(pool, this.rand);
      if (!pick || used.has(pick.id)) continue;
      options.push(pick);
      used.add(pick.id);
    }

    this._lastOptions = options;
    return options;
  }

  /**
   * Apply a chosen upgrade.
   * @param {string} skillId
   * @param {{ validatePending?: boolean }} [opts]
   * @returns {{ ok: boolean, heal?: number, maxHpDelta?: number }}
   */
  applyUpgrade(skillId, { validatePending = false } = {}) {
    const def = this.getDefinition(skillId);
    if (!def) return { ok: false };

    if (validatePending && this._lastOptions) {
      const allowed = this._lastOptions.some((o) => o.id === skillId);
      if (!allowed) return { ok: false };
    }

    if (this.isMaxed(skillId)) return { ok: false };

    if (def.kind === "evolution") {
      const replaceId = def.replacesActive || def.requiredActive;
      if (replaceId && this.inventory[replaceId] != null) {
        delete this.inventory[replaceId];
      }
      this.inventory[skillId] = this.getLevel(skillId) + 1;
      this._lastOptions = null;
      return { ok: true };
    }

    this.inventory[skillId] = this.getLevel(skillId) + 1;

    let heal = 0;
    let maxHpDelta = 0;
    if (def.healOnPick) heal = def.healOnPick;
    for (const fx of def.effects || []) {
      if (fx.stat === "maxHp" && fx.apply === "add") maxHpDelta += fx.perLevel;
    }

    this._lastOptions = null;
    return { ok: true, heal, maxHpDelta };
  }

  /** Aggregate combat modifiers from owned skills + permanent meta upgrades. */
  computeCombatEffects(metaEffects = {}) {
    const out = {
      ...DEFAULT_COMBAT,
      fireRateMult: metaEffects.fireRateMult ?? 1,
      bulletDamage: metaEffects.bulletDamage ?? 1,
      multishotHits: metaEffects.multishotHits ?? 1,
      moveSpeedMult: metaEffects.moveSpeedMult ?? 1,
      bulletSpeedMult: metaEffects.bulletSpeedMult ?? 1,
      pickupRadius: metaEffects.pickupRadius ?? 18,
      pickupScoreMult: metaEffects.pickupScoreMult ?? 1,
      invulnMs: metaEffects.invulnMs ?? 900,
    };

    for (const [skillId, rawLevel] of Object.entries(this.inventory)) {
      const level = Math.max(0, Math.floor(Number(rawLevel) || 0));
      if (level <= 0) continue;
      const def = this.getDefinition(skillId);
      if (!def?.effects) continue;
      for (const fx of def.effects) {
        if (fx.stat === "maxHp") continue;
        applyEffectStat(out, fx, level);
      }
    }

    out.multishotHits = Math.max(1, Math.floor(out.multishotHits));
    return out;
  }

  totalPicks() {
    return Object.values(this.inventory).reduce(
      (sum, n) => sum + Math.max(0, Math.floor(Number(n) || 0)),
      0,
    );
  }
}
