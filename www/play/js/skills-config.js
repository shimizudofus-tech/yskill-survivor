/**
 * Data-driven run skills (Vampire Survivors style).
 * ACTIVES = weapons, PASSIVES = stat boosts, EVOLUTIONS = synergies at max level.
 */

/** @typedef {"mult" | "add"} EffectApply */
/** @typedef {{ stat: string, apply: EffectApply, perLevel: number, usePow?: boolean }} SkillEffect */

/** @typedef {{ id: string, max: number, effects?: SkillEffect[], healOnPick?: number }} SkillDef */
/** @typedef {{ id: string, max: number, requiredActive: string, requiredPassive: string, replacesActive?: string, effects?: SkillEffect[] }} EvolutionDef */

/** @type {SkillDef[]} */
export const ACTIVES = [
  {
    id: "magicWand",
    max: 8,
    effects: [{ stat: "fireRateMult", apply: "mult", perLevel: 1.18, usePow: true }],
  },
  {
    id: "arcBolt",
    max: 5,
    effects: [{ stat: "multishotHits", apply: "add", perLevel: 1 }],
  },
];

/** @type {SkillDef[]} */
export const PASSIVES = [
  {
    id: "emptyTome",
    max: 10,
    effects: [{ stat: "bulletDamage", apply: "add", perLevel: 1 }],
  },
  {
    id: "bracer",
    max: 6,
    effects: [{ stat: "moveSpeedMult", apply: "mult", perLevel: 1.12, usePow: true }],
  },
  {
    id: "magnetCharm",
    max: 6,
    effects: [{ stat: "pickupRadius", apply: "add", perLevel: 10 }],
  },
  {
    id: "vitalityCharm",
    max: 2,
    effects: [{ stat: "maxHp", apply: "add", perLevel: 1 }],
    healOnPick: 1,
  },
];

/** @type {EvolutionDef[]} */
export const EVOLUTIONS = [
  {
    id: "holyWand",
    max: 1,
    requiredActive: "magicWand",
    requiredPassive: "emptyTome",
    replacesActive: "magicWand",
    effects: [
      { stat: "fireRateMult", apply: "mult", perLevel: 1.28, usePow: true },
      { stat: "bulletDamage", apply: "add", perLevel: 2 },
    ],
  },
];

/** Flat lookup — built once for SkillManager and combat resolution. */
export function buildSkillLookup(
  actives = ACTIVES,
  passives = PASSIVES,
  evolutions = EVOLUTIONS,
) {
  /** @type {Map<string, SkillDef | EvolutionDef & { kind: string }>} */
  const byId = new Map();
  for (const s of actives) byId.set(s.id, { ...s, kind: "active" });
  for (const s of passives) byId.set(s.id, { ...s, kind: "passive" });
  for (const s of evolutions) byId.set(s.id, { ...s, kind: "evolution" });
  return byId;
}

/** @deprecated Use ACTIVES / PASSIVES via SkillManager — kept for tooling references. */
export const RUN_UPGRADE_POOL = [...ACTIVES, ...PASSIVES].map(({ id, max }) => ({ id, max }));
