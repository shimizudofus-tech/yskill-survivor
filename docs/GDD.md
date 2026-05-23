# GDD — YSkill Survivor v1.0

**Studio :** YSkill (micro-entreprise, France)  
**Plateforme :** Android (web prototype → Capacitor)  
**Monétisation :** Gratuit + publicités récompense  
**Durée de dev cible :** 6 mois (solo + assistance IA)  
**Session typique :** 3–10 minutes  

---

## 1. Pitch

> Survis dans l’arène YSkill, auto-attaque les vagues, collecte des orbes de score, affronte un boss à 5 minutes — bats ton record et débloque des améliorations permanentes avec des **YS**.

Inspiré du genre survivor (Vampire Survivors, Brotato) mais **IP 100 % originale** : formes géométriques néon, pas d’univers Spekter ni assets tiers sous licence restrictive.

---

## 2. Piliers de design

| Pilier | Détail |
|--------|--------|
| **Lisible en 30 s** | Joystick + auto-tir ; ennemis colorés distincts |
| **Rejouable** | Score + classement local ; meta YS entre les runs |
| **Mobile-first** | Touch plein écran, 60 fps, APK < 100 Mo |
| **Sessions courtes** | Mort = fin de run ; revive limité (pub ou YS) |
| **Scope maîtrisé** | 1 héros, 1 arène, 1 mode Endless v1 |

---

## 3. Boucle de gameplay

```
Menu → Run (1 vie) → Survivre + score → Mort ou Boss vaincu
  → Écran résultat (+YS) → Shop meta → Rejouer
```

### Contrôles

- **Mobile :** joystick virtuel (glisser depuis le canvas)
- **Desktop :** WASD / ZQSD / flèches
- **Tir :** automatique vers l’ennemi le plus proche
- **Pause :** bouton HUD (v1.1 : pause auto en arrière-plan Android)

### Score

```
score = temps(ms)/100 + kills×30 + orbes collectées + bonus boss
```

Difficulté : `1 + floor(secondes/10) × 0.25`

---

## 4. Contenu v1.0 (IN)

### Ennemis (8 types visuels)

| ID | Forme | Comportement |
|----|-------|--------------|
| drifter | Cercle | Lent, swarm |
| spark | Petit cercle | Rapide, faible HP |
| wedge | Triangle | Charge légère |
| ring | Anneau | HP ×2 |
| hex | Hexagone | Résistant |
| elite | Étoile | Spawn toutes les 10 s de run, lent |
| boss | Grande étoile | 1× à 5 min, +1000 score |
| (v1.1) splitter | — | Se divise à la mort |

### Upgrades in-run (pickups temporaires — v1.1)

v0 prototype : pas de level-up mid-run ; focus sur score pur.  
v1 : choix 1/3 toutes les 45 s (cadence, dégâts, magnet, multishot).

### Meta-progression (YS — permanent)

| Upgrade | Effet | Coût base YS |
|---------|-------|--------------|
| attackSpeed | Tir ×2 par niveau | 20 |
| damage | Dégâts ×2 par niveau | 25 |
| moveSpeed | Vitesse +25 % / niv | 15 |
| bulletSpeed | Projectiles +30 % / niv | 25 |
| pickupMagnet | Rayon collecte +10 | 35 |
| scoreBoost | Orbes +25 % / niv | 50 |
| thickSkin | Invuln après hit +500 ms | 60 |
| multishot | +1 cible / tir / niv | 100 |

Prix : `base × 2^level` (comme build-sim, monnaie = YS).

### Économie YS

| Source | Montant |
|--------|---------|
| Fin de run | `floor(score / 50)` YS |
| Pub récompense (revive) | 0 YS direct — 1 revive gratuit |
| Pub récompense (double YS) | ×2 gains fin de run |
| Daily bonus (v1.1) | +5 YS |

---

## 5. Contenu v1.0 (OUT — reporté)

- Multijoueur / leaderboard en ligne
- Compte cloud
- Plusieurs personnages
- Campagne / niveaux
- IAP payants (hors pub)
- Traductions au-delà FR/EN

---

## 6. UI / UX

### Écrans

1. **Splash** — logo YSkill 1,5 s  
2. **Home** — Jouer, Shop, Scores, Réglages  
3. **Run** — canvas + HUD (score, temps, HP, pause)  
4. **Game Over** — score, YS gagnés, boutons Rejouer / Pub revive / Menu  
5. **Shop** — liste upgrades YS  
6. **Scores** — top 10 local  
7. **Réglages** — son, musique, langue FR/EN  

### Identité visuelle

- Fond : `#0c0f14`
- Accent joueur : `#6ea8fe` / `#a855f7`
- Ennemis : palette néon (cyan, violet, orange, vert, jaune)
- Typo : system-ui, titres uppercase légers

---

## 7. Audio

| Élément | v0 | v1 |
|---------|----|----|
| SFX | Web Audio procédural (tir, hit, mort, pickup) | idem |
| BGM | Loop MP3 optionnelle | 1 piste Suno / licence |

---

## 8. Monétisation (gratuit + pub)

| Emplacement | Type | Moment |
|-------------|------|--------|
| Revive | Rewarded video | Après mort, max 1/run |
| Double YS | Rewarded video | Écran game over |
| Bannière | Banner | Menu home uniquement (v1.1) |

**Pas de pub interstitielle** en pleine run (UX mobile).

SDK cible : **Google AdMob** via `@capacitor-community/admob` (Android).

---

## 9. Technique

| Couche | Choix |
|--------|-------|
| Rendu | Canvas 2D 420×420 logical, DPR max 2 |
| App shell | Vanilla JS modules |
| Mobile | Capacitor 7 |
| Save | localStorage `yskill-survivor:v1` |
| Backend v1 | Aucun (offline-first) |
| Backend v2 | Leaderboard optionnel Cloudflare Workers |

---

## 10. KPIs launch

| Métrique | Objectif M+1 |
|----------|----------------|
| Installs | 100+ |
| Rétention J1 | ≥ 25 % |
| Session moyenne | ≥ 4 min |
| Crash-free | ≥ 99 % |
| eCPM rewarded | suivre (pas d’objectif v0) |

---

## 11. Jalons validation

| # | Critère | Date cible |
|---|---------|------------|
| J0 | Prototype 5 min fun (ce repo v0.1) | Semaine 4 |
| J1 | Touch polish + 60 fps mid-range | Mois 2 |
| J2 | Meta shop + 10 testeurs ≥ 3,5/5 | Mois 3 |
| J3 | APK + AdMob test ads | Mois 4 |
| J4 | Play Store soft launch FR | Mois 5–6 |

---

## 12. Risques

| Risque | Mitigation |
|--------|------------|
| Confusion IP Spekter | Assets 100 % procéduraux / originaux |
| Scope creep | GDD IN/OUT strict |
| Rejet Play Store | Privacy policy, pas de fausses promesses IAP |
| Perf mobile | Limiter particules + max 55 ennemis |

---

*Document v1.0 — YSkill — Mai 2026*
