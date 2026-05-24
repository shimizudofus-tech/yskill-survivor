# YSkill Survivor — Assets Manifest

> **Studio :** YSkill Studio · **Jeu :** YSkill Survivor · **Domaine :** https://yskillstudio.com  
> **Plateforme cible :** Android mobile vertical 9:16 · **App ID :** `com.yskillstudio.survivor`

Ce manifeste recense les fichiers graphiques et audio **à produire ou intégrés**.  
Référence unique du projet — mettre à jour ce fichier à chaque nouvel asset.

## Où placer les fichiers (important)

| Dossier | Rôle |
|---------|------|
| **`www/play/assets/`** | **Runtime** — chargé par le jeu et déployé sur Cloudflare Pages. Tout asset in-game va ici. |
| **`www/assets/`** | **Manifeste + branding source** — structure cible, `.gitkeep`, logos source. Pas de doublon gameplay si déjà dans `play/assets`. |
| **`www/play/assets/hero/references/`** | Spritesheets source (Layer/Gemini) avant `build-hero-pack.py`. |
| **`scripts/`** | Pipeline build (`build-hero-pack.py`, etc.). |
| **`docs/`** | Prompts IA, déploiement, GDD. |

**Règle :** un asset gameplay = **un seul chemin** sous `www/play/assets/`. Ne pas copier la map Stage 1 dans `www/assets/` (référencer le chemin `play` ci-dessous).

**Légende des états**

| État | Signification |
|------|---------------|
| `TODO` | À produire |
| `READY` | Fichier livré dans le dossier, pas encore branché au code |
| `INTEGRATED` | Référencé et utilisé par le jeu ou le site |

---

## Branding

### `branding/logo/`

| Fichier | Dimensions | Utilité | État |
|---------|------------|---------|------|
| `logo-yskill-survivor-full.png` | ~1024×1024 (transparent) | Logo complet menu accueil, site studio, press kit | INTEGRATED |

> **Copie Capacitor :** le même fichier est dupliqué dans `www/play/assets/branding/logo/` pour le `webDir` Android (`com.yskillstudio.survivor`). Source canonique : `www/assets/branding/logo/`.
| `logo-yskill-survivor-full.svg` | vectoriel | Variante scalable web / print | TODO |
| `logo-yskill-wordmark.png` | 512×128 | « YSKILL » seul (header compact) | TODO |
| `logo-survivor-script.png` | 512×128 | « SURVIVOR » script/cyan (sous-titre logo) | TODO |
| `logo-yskill-studio.png` | 512×128 | Signature studio (footer, crédits) | TODO |

### `branding/app-icon/`

| Fichier | Dimensions | Utilité | État |
|---------|------------|---------|------|
| `icon-foreground.png` | 432×432 (safe zone 66 %) | Adaptive icon Android — avant-plan | TODO |
| `icon-background.png` | 432×432 | Adaptive icon Android — fond | TODO |
| `icon-legacy.png` | 512×512 | Icône legacy / fallback | TODO |
| `icon-monochrome.png` | 432×432 | Themed icon Android 13+ | TODO |

### `branding/splash/`

| Fichier | Dimensions | Utilité | État |
|---------|------------|---------|------|
| `splash-portrait.png` | 1080×1920 | Splash Capacitor / Play Store preview | TODO |
| `splash-portrait@2x.png` | 1440×2560 | Haute densité (xxhdpi+) | TODO |
| `splash-logo-center.png` | 512×512 (transparent) | Logo centré sur fond `#080D18` | TODO |

---

## Héros v1 — **Arin** (héros masculin · `hero_male`)

> Chemin jeu : `www/play/assets/hero/male/` · Config : `HERO_MALE_CONFIG` dans `hero-config.js`  
> Sources : `www/play/assets/hero/references/arin-spritesheet-layer.png`, `arin-ref-v2.png`

### Arborescence intégrée

```
www/play/assets/hero/male/
  movement/frames_128/
  attacks/{front_slash,circle_slash,dash,magic_shot}/frames_128/
  ui/portrait_512.png, ui/icon_128.png
  full_sheet/hero_sprite_sheet_transparent_128.png
  manifest.json
  README_CURSOR.md
```

### Animations (5 frames)

| Clé config | Fichiers |
|------------|----------|
| `idle` | `idle_01.png` … `idle_05.png` |
| `walkDown` / `walkSide` / `walkUp` | `walk_*_01.png` … |
| `frontSlash` / `circleSlash` / `dash` / `magicShot` | `attacks/*/frames_128/*.png` |

In-game : frames **128 px**, `visualScale: 0.44`, hitbox **18 px**.

| Fichier | État |
|---------|------|
| `movement/frames_128/*` | INTEGRATED |
| `attacks/*/frames_128/*` | INTEGRATED |
| `ui/portrait_512.png`, `ui/icon_128.png` | INTEGRATED |
| `full_sheet/hero_sprite_sheet_transparent_128.png` | INTEGRATED |

Génération : `npm run build:heroes` → `scripts/build-hero-pack.py --only male --cols 5 --rows 8 --frames 5`

---

## Héroïne v1 — **Lyra** (héroïne féminine · `hero_female`)

> Chemin jeu : `www/play/assets/hero/female/` · Config : `HERO_FEMALE_CONFIG` dans `hero-config.js`  
> Sources : `www/play/assets/hero/references/lyra-spritesheet-layer.png`, `lyra-ref.png`

Même arborescence qu’Arin ; **8 frames** par animation (`frameCount: 8`).

| Dossier | Contenu | État |
|---------|---------|------|
| `movement/frames_128/` | idle, walk_* (8 frames) | INTEGRATED |
| `attacks/*/frames_128/` | front_slash, circle_slash, dash, magic_shot | INTEGRATED |
| `ui/portrait_512.png`, `ui/icon_128.png` | Sélection héros | INTEGRATED |
| `full_sheet/` | Spritesheet compacte | INTEGRATED |

Génération : `npm run build:heroes:female` → grille **8×8**, `--frames 8`

Sélection joueur Arin / Lyra : **INTEGRATED** (accueil + Réglages).

---

## Aventure — Stage 01 · Clairière Runique

**Boss :** Gelée Runique (`rune_slime`) · **Thème :** forêt runique, teal/vert

### `www/play/assets/adventure/stage-01/backgrounds/`

| Fichier | Dimensions | Utilité | État |
|---------|------------|---------|------|
| `stage_01_gameplay_map.png` | **720×1280** | Fond world map Aventure (forêt / arène circulaire) | INTEGRATED |
| `stage_01_collision_overlay.png` | 720×1280 | Référence debug collisions (vert/rouge) | INTEGRATED |
| `stage-01-map-thumb.png` | 220×330 (2∶3) | Vignette carte Aventure | TODO |
| `stage-01-briefing-bg.png` | 720×1280 | Fond panneau briefing (optionnel) | TODO |

Collisions : `www/play/js/adventure-world.js` → `STAGE_01_WORLD` · debug **F2** avec `?debug=1`

### `adventure/stage-01/boss/`

| Fichier | Dimensions | Utilité | État |
|---------|------------|---------|------|
| `boss-rune-slime-portrait.png` | 512×512 | Portrait briefing / victoire | TODO |
| `boss-rune-slime-sprite.png` | 128×128 ou spritesheet | Sprite boss in-game | TODO |

### `adventure/stage-01/enemies/`

| Fichier | Dimensions | Utilité | État |
|---------|------------|---------|------|
| `enemy-drifter.png` | 48×48 | Ennemi basique | TODO |
| `enemy-spark.png` | 48×48 | Ennemi rapide | TODO |
| `enemy-elite.png` | 64×64 | Élite décennale | TODO |

---

## Aventure — Stage 02 · Sentier Envahi

**Boss :** Champignon Brutal (`brutal_mushroom`) · **Thème :** sentier envahi, vert/or

### `adventure/stage-02/backgrounds/`

| Fichier | Dimensions | Utilité | État |
|---------|------------|---------|------|
| `stage-02-map-thumb.png` | 220×330 | Vignette carte Aventure | TODO |
| `stage-02-arena-bg.png` | 360×640 | Fond canvas run | TODO |
| `stage-02-briefing-bg.png` | 720×1280 | Fond briefing (optionnel) | TODO |

### `adventure/stage-02/boss/`

| Fichier | Dimensions | Utilité | État |
|---------|------------|---------|------|
| `boss-brutal-mushroom-portrait.png` | 512×512 | Portrait briefing / victoire | TODO |
| `boss-brutal-mushroom-sprite.png` | 128×128 | Sprite boss in-game | TODO |

### `adventure/stage-02/enemies/`

| Fichier | Dimensions | Utilité | État |
|---------|------------|---------|------|
| `enemy-wedge.png` | 48×48 | Ennemi triangle | TODO |
| `enemy-ring.png` | 48×48 | Ennemi anneau (2 HP) | TODO |
| `enemy-elite.png` | 64×64 | Élite | TODO |

---

## Aventure — Stage 03 · Marais Lumineux

**Boss :** Crapaud Astral (`astral_toad`) · **Thème :** marais, violet/teal

### `adventure/stage-03/backgrounds/`

| Fichier | Dimensions | Utilité | État |
|---------|------------|---------|------|
| `stage-03-map-thumb.png` | 220×330 | Vignette carte Aventure | TODO |
| `stage-03-arena-bg.png` | 360×640 | Fond canvas run | TODO |
| `stage-03-briefing-bg.png` | 720×1280 | Fond briefing (optionnel) | TODO |

### `adventure/stage-03/boss/`

| Fichier | Dimensions | Utilité | État |
|---------|------------|---------|------|
| `boss-astral-toad-portrait.png` | 512×512 | Portrait briefing / victoire | TODO |
| `boss-astral-toad-sprite.png` | 128×128 | Sprite boss in-game | TODO |

### `adventure/stage-03/enemies/`

| Fichier | Dimensions | Utilité | État |
|---------|------------|---------|------|
| `enemy-hex.png` | 48×48 | Ennemi hex (3 HP) | TODO |
| `enemy-spark.png` | 48×48 | Ennemi rapide | TODO |
| `enemy-minion.png` | 40×40 | Sbire invoqué (Gardien — réutilisable) | TODO |

---

## Aventure — Stage 04 · Bois des Brumes

**Boss :** Loup des Brumes (`mist_wolf`) · **Thème :** brumes, bleu/gris/violet

### `adventure/stage-04/backgrounds/`

| Fichier | Dimensions | Utilité | État |
|---------|------------|---------|------|
| `stage-04-map-thumb.png` | 220×330 | Vignette carte Aventure | TODO |
| `stage-04-arena-bg.png` | 360×640 | Fond canvas run | TODO |
| `stage-04-briefing-bg.png` | 720×1280 | Fond briefing (optionnel) | TODO |

### `adventure/stage-04/boss/`

| Fichier | Dimensions | Utilité | État |
|---------|------------|---------|------|
| `boss-mist-wolf-portrait.png` | 512×512 | Portrait briefing / victoire | TODO |
| `boss-mist-wolf-sprite.png` | 128×128 | Sprite boss in-game | TODO |

### `adventure/stage-04/enemies/`

| Fichier | Dimensions | Utilité | État |
|---------|------------|---------|------|
| `enemy-drifter.png` | 48×48 | Ennemi basique | TODO |
| `enemy-ring.png` | 48×48 | Ennemi anneau | TODO |
| `enemy-elite.png` | 64×64 | Élite | TODO |

---

## Aventure — Stage 05 · Arbre Ancien

**Boss :** Gardien Sylvestre (`sylvan_guardian`) · **Thème :** arbre ancien, or/vert

### `adventure/stage-05/backgrounds/`

| Fichier | Dimensions | Utilité | État |
|---------|------------|---------|------|
| `stage-05-map-thumb.png` | 220×330 | Vignette carte Aventure | TODO |
| `stage-05-arena-bg.png` | 360×640 | Fond canvas run | TODO |
| `stage-05-briefing-bg.png` | 720×1280 | Fond briefing (optionnel) | TODO |

### `adventure/stage-05/boss/`

| Fichier | Dimensions | Utilité | État |
|---------|------------|---------|------|
| `boss-sylvan-guardian-portrait.png` | 512×512 | Portrait briefing / victoire | TODO |
| `boss-sylvan-guardian-sprite.png` | 160×160 | Sprite boss (plus grand) | TODO |

### `adventure/stage-05/enemies/`

| Fichier | Dimensions | Utilité | État |
|---------|------------|---------|------|
| `enemy-hex.png` | 48×48 | Ennemi hex | TODO |
| `enemy-wedge.png` | 48×48 | Ennemi triangle | TODO |
| `enemy-minion.png` | 40×40 | Sbires du Gardien | TODO |

---

## Full Skill

### `full-skill/pacts/`

| Fichier | Dimensions | Utilité | État |
|---------|------------|---------|------|
| `pact-berserker-icon.png` | 128×128 | Carte pacte Berserker | TODO |
| `pact-velocity-icon.png` | 128×128 | Carte pacte Vélocité | TODO |
| `pact-harvester-icon.png` | 128×128 | Carte pacte Moissonneur | TODO |
| `pact-berserker-banner.png` | 640×200 | Détail pacte sélectionné | TODO |
| `pact-velocity-banner.png` | 640×200 | Détail pacte sélectionné | TODO |
| `pact-harvester-banner.png` | 640×200 | Détail pacte sélectionné | TODO |

### `full-skill/ranks/`

| Fichier | Dimensions | Utilité | État |
|---------|------------|---------|------|
| `rank-bronze.png` | 128×128 | Badge classement | TODO |
| `rank-silver.png` | 128×128 | Badge classement | TODO |
| `rank-gold.png` | 128×128 | Badge classement | TODO |
| `rank-diamond.png` | 128×128 | Badge classement | TODO |
| `rank-legend.png` | 128×128 | Badge classement | TODO |

### `full-skill/backgrounds/`

| Fichier | Dimensions | Utilité | État |
|---------|------------|---------|------|
| `arena-menu-bg.png` | 720×1280 | Fond écran Full Skill | TODO |
| `arena-run-bg.png` | 360×640 | Fond canvas mode Full Skill | TODO |

---

## UI

### `ui/hud/`

| Fichier | Dimensions | Utilité | État |
|---------|------------|---------|------|
| `hud-bar-hp.png` | 200×24 (9-slice) | Barre de vie | TODO |
| `hud-bar-exp.png` | 200×12 (9-slice) | Barre expérience run | TODO |
| `hud-frame-portrait.png` | 72×72 | Cadre portrait héros HUD | TODO |
| `hud-pause-icon.png` | 48×48 | Bouton pause | TODO |

### `ui/buttons/`

| Fichier | Dimensions | Utilité | État |
|---------|------------|---------|------|
| `btn-primary.png` | 640×96 (9-slice) | Bouton principal (Aventure cyan) | TODO |
| `btn-arena.png` | 640×96 (9-slice) | Bouton Full Skill | TODO |
| `btn-secondary.png` | 640×72 (9-slice) | Boutons secondaires | TODO |
| `btn-fight.png` | 640×96 (9-slice) | Bouton « Combattre » briefing | TODO |

### `ui/icons/`

| Fichier | Dimensions | Utilité | État |
|---------|------------|---------|------|
| `logo-ys-currency.svg` | 128×128 (vector) | Icône monnaie YS in-game (pill, shop) | INTEGRATED |
| `icon-ys-512.png` | 512×512 | Favicon, Open Graph, Twitter, Apple touch icon | INTEGRATED |
| `icon-lock.png` | 32×32 | Stage verrouillé | TODO |
| `icon-star.png` | 32×32 | Stage terminé | TODO |
| `icon-settings.png` | 32×32 | Réglages | TODO |
| `icon-leaderboard.png` | 32×32 | Classements | TODO |
| `icon-upgrade.png` | 32×32 | Améliorations | TODO |
| `icon-orb-pickup.png` | 24×24 | Orbe score in-game | TODO |
| `icon-projectile.png` | 16×16 | Projectile joueur | TODO |

---

## Audio

### `audio/music/`

| Fichier | Format | Utilité | État |
|---------|--------|---------|------|
| `bgm-menu.ogg` | OGG + MP3 fallback | Menu accueil | TODO |
| `bgm-adventure-run.ogg` | OGG | Boucle run Aventure (lumineux) | TODO |
| `bgm-fullskill-run.ogg` | OGG | Boucle run Full Skill (sombre) | TODO |
| `bgm-boss.ogg` | OGG | Stinger / loop boss | TODO |
| `bgm-victory.ogg` | OGG | Jingle victoire stage | TODO |

### `audio/sfx/`

| Fichier | Format | Utilité | État |
|---------|--------|---------|------|
| `sfx-shoot.ogg` | OGG | Tir joueur | TODO |
| `sfx-hit.ogg` | OGG | Impact projectile | TODO |
| `sfx-kill.ogg` | OGG | Ennemi détruit | TODO |
| `sfx-pickup.ogg` | OGG | Orbe collectée | TODO |
| `sfx-hurt.ogg` | OGG | Dégâts joueur | TODO |
| `sfx-levelup.ogg` | OGG | Level up run | TODO |
| `sfx-boss-spawn.ogg` | OGG | Apparition boss | TODO |
| `sfx-victory.ogg` | OGG | Victoire stage | TODO |
| `sfx-defeat.ogg` | OGG | Défaite | TODO |
| `sfx-ui-tap.ogg` | OGG | Clic bouton UI | TODO |

---

## Conventions de nommage

- **Minuscules**, tirets `-`, pas d'espaces.
- **PNG** pour sprites/UI (transparence) · **WebP** acceptable en variante `@2x`.
- **SVG** réservé au branding vectoriel.
- **Audio** : OGG Vorbis prioritaire (web/Android) ; dupliquer en MP3 si besoin iOS futur.
- **Canvas logique** : 360×640 (9:16) — exporter fonds et sprites pensés pour ce ratio.

## Intégration future (hors scope actuel)

Quand un asset passe en `READY` ou `INTEGRATED` :

1. Placer le fichier dans **`www/play/assets/...`** (chemin runtime).
2. Ajouter son chemin dans **`www/play/js/runtime-assets.js`** (catalogue du preloader).
3. Mettre à jour **ce manifeste** (`www/assets/ASSETS_MANIFEST.md`).
4. Référencer dans le code si nouveau chemin (`hero-config.js`, `adventure-world.js`, etc.).
5. `npm run deploy` pour Cloudflare Pages.

**Preloader :** `www/play/js/asset-manager.js` — singleton `assets`, barre de progression canvas avant chaque run Aventure.

Prompts héros IA : `docs/LEONARDO-HERO-PROMPTS.md`

---

*Dernière mise à jour : Arin + Lyra intégrés, Stage 1 map, pipeline `scripts/build-hero-pack.py`.*
