# Checklist d’extraction — build-sim → YSkill Survivor

Référence : dépôt `build-sim` (Spekter Agency Build Simulator).  
Objectif : **réutiliser la logique**, **jeter l’IP Spekter**, **simplifier** pour un produit Android standalone.

---

## À réutiliser (logique, pas les assets)

| Élément | Source build-sim | Fichier YSkill | Statut |
|---------|------------------|----------------|--------|
| Boucle game update/draw | `assets/skill-survivor.js` | `www/js/game.js` | ✅ Réécrit (v0.1) |
| Courbe difficulté | `difficultyAt()` | `game.js` | ✅ |
| Formule score | idem | `game.js` | ✅ |
| Upgrades meta (8 ids) | `lib/skill-survivor.cjs` | `www/js/storage.js` | ✅ YS au lieu de KRAPS |
| Prix upgrade ×2^n | `upgradeCostAtLevel()` | `storage.js` | ✅ |
| Effets upgrades | `getUpgradeEffects()` | `game.js` | ✅ |
| Touch joystick | `SkillSurvivorGame._bindInput` | `game.js` | ✅ |
| SFX procédural Web Audio | `SurvivorSfx` | `www/js/audio.js` | ✅ Simplifié |
| i18n clés FR/EN | pattern `locales/*.json` | `www/js/i18n.js` | ✅ Minimal |

---

## À ne PAS reprendre (IP / scope)

| Élément | Raison |
|---------|--------|
| PNG skills / bosses Spekter | IP tierce — remplacer par formes Canvas |
| KRAPS / fake-sparks / Discord auth | Économie fan site, pas produit store |
| API `/api/skill-survivor/*` | Backend communautaire — v0 offline |
| Anti-triche serveur | Réintroduire en v2 si leaderboard online |
| `BuilderAudioSettings` global | Remplacé par `storage.js` settings |
| BGM `skill-survivor-bgm.mp3` | Créer piste originale YSkill ou silence v0 |
| Liens Spekter / build-sim | Aucune mention in-game v1 |

---

## Mapping monnaie & labels

| build-sim | YSkill Survivor |
|-----------|-----------------|
| KRAPS | **YS** (YSkill Points) |
| Skill Survivor | **YSkill Survivor** |
| 1 KRAPS / vie | 1 vie gratuite/run + revive pub |
| Leaderboard daily UTC | Top 10 **local** v0 |

---

## Fichiers build-sim utiles en référence

```
build-sim/
  assets/skill-survivor.js      # ~1300 lignes — client game
  lib/skill-survivor.cjs        # ~900 lignes — API + validation
  assets/skill-survivor-bgm.mp3 # NE PAS copier tel quel
  locales/fr.json               # clés skillSurvivor.* pour textes shop
```

---

## Étapes d’extraction restantes

### Phase A — Prototype (fait v0.1)

- [x] Repo `yskill-survivor` standalone
- [x] Game loop Canvas sans PNG externes
- [x] Meta YS + shop local
- [x] Scores locaux top 10
- [x] Touch + clavier

### Phase B — Parité gameplay (Mois 1–2)

- [ ] Elite spawn par décade (déjà partiel)
- [ ] Boss 5 min avec telegraph 2 s (déjà partiel)
- [ ] Level-up in-run (choix 1/3)
- [ ] Revive via bouton (sans pub en web dev)
- [ ] Particules + screen shake polish

### Phase C — Mobile (Mois 2–3)

- [ ] Joystick dédié UI (zone bas écran)
- [ ] Safe area notch / barre navigation
- [ ] Haptics léger (Capacitor)
- [ ] Pause on `App.addListener('pause')`

### Phase D — Android release (Mois 4–6)

- [ ] `cap add android` + icône adaptive YSkill
- [ ] AdMob rewarded (revive + double YS)
- [ ] Privacy policy URL
- [ ] Play Store listing FR + EN

---

## Test de non-régression IP

Avant tout build Play Store, vérifier :

```bash
# Aucune référence Spekter / KRAPS / build-sim
rg -i "spekter|kraps|build-sim|shuriken-purple|prism_shell" www/
```

Résultat attendu : **0 match**.

---

*Checklist v1 — YSkill — Mai 2026*
