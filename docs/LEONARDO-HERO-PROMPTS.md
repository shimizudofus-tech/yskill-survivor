# Leonardo.ai — Prompts finaux héros YSkill Survivor

> **Format cible :** 1536×1024 px · grille **6×8** · cellules **256×128** · 5 frames utilisées par rangée  
> **Après export :** remplacer les drafts, puis `python scripts/build-hero-pack.py --bg green`

---

## Réglages Leonardo

| Paramètre | Valeur |
|-----------|--------|
| Modèle | Alchemy ou PhotoReal (tester les deux) |
| Dimensions | **1536 × 1024** (paysage) |
| Image Guidance | **0.45–0.55** |
| Références | `style-bible-arin-lyra.png` (+ spritesheet Arin pour Lyra) |
| Prompt Magic | Off |

---

## Negative prompt (tous les prompts)

```
photorealistic, 3d render, blurry, low resolution, messy lines, inconsistent proportions, front view portrait, side scroller, isometric tiles, checkerboard, white background, gradient background, watermark, text, logo, UI frame, overlapping characters, deformed hands, extra limbs, baby chibi, anime screenshot, heavy bloom, oversaturated, ground shadow oval, cast shadow on floor, multiple characters in one cell, uneven grid, different character sizes between frames
```

---

## Prompt 1 — Arin (spritesheet gameplay)

```
2D game sprite sheet, single male hero ARIN, YSkill Survivor mobile top-down survivor game.

TECHNICAL LAYOUT (CRITICAL):
- Image size exactly 1536x1024 pixels landscape
- Perfect uniform grid: 6 columns x 8 rows
- Each cell exactly 256x128 pixels, equal spacing, no overlap
- Pure chroma green background #00FF00 only (for keying)
- One character per cell, same scale every frame, feet on same baseline in each row

CAMERA: top-down 75 degree angle, slight 3/4, NOT front portrait

CHARACTER ARIN:
- Young male adventurer, short spiky teal-cyan hair, blue eyes
- Navy and teal fantasy outfit, gold trim, small blue cape
- Glowing cyan energy sword
- Chibi proportions: head 1/3 body, bold 2px black outline, cel-shading flat colors
- Palette: cyan #19D7F2, blue #267BFF, navy, gold #FFD166, cream skin

8 ROWS x 5 FRAMES (use columns 1-5, leave column 6 empty or duplicate spacing):
Row 1: idle breathing loop
Row 2: walk toward camera (walk down)
Row 3: walk side profile right
Row 4: walk away from camera (walk up)
Row 5: front slash attack, cyan energy arc
Row 6: circle slash 360 spin, cyan magic ring
Row 7: dash forward, cyan motion streak
Row 8: magic shot, cyan projectile from sword

Style: manga fantasy arcade like Dofus, high mobile readability, no micro details, professional indie game asset sheet
```

**Image Guidance :** `style-bible-arin-lyra.png`

---

## Prompt 2 — Lyra (spritesheet gameplay)

```
2D game sprite sheet, single female hero LYRA, YSkill Survivor mobile top-down survivor game.

TECHNICAL LAYOUT (CRITICAL):
- Image size exactly 1536x1024 pixels landscape
- Perfect uniform grid: 6 columns x 8 rows
- Each cell exactly 256x128 pixels, equal spacing, no overlap
- Pure chroma green background #00FF00 only (for keying)
- One character per cell, same scale every frame, feet on same baseline in each row
- EXACT same grid layout line weight chibi ratio and top-down 75 degree angle as attached ARIN sprite sheet reference

CAMERA: top-down 75 degree, same as Arin reference

CHARACTER LYRA:
- Young female mage-fighter, long dark violet hair high ponytail bright pink ribbon
- Purple eyes, dark purple and black combat dress, flowing violet scarf
- Magic spear with glowing lavender tip
- Chibi proportions matching Arin, bold 2px outline, cel-shading
- Palette: deep purple, magenta #E82D98, lavender #7B61FF, charcoal, cream skin

8 ROWS x 5 FRAMES (columns 1-5):
Row 1: idle breathing loop
Row 2: walk toward camera (walk down)
Row 3: walk side profile right
Row 4: walk away from camera (walk up)
Row 5: front slash spear thrust, purple energy
Row 6: circle slash 360 spin, violet crescent trail
Row 7: dash forward, purple motion streak
Row 8: magic shot, purple projectile from spear (character only in all 5 frames, no detached projectile-only frames)

Same art pipeline as Arin reference sheet — only gender outfit colors and weapon differ
```

**Image Guidance :** `style-bible-arin-lyra.png` + **spritesheet Arin exportée** (priorité)

---

## Prompt 3 — Portraits (optionnel, séparé)

**Arin :**
```
Anime manga fantasy game portrait 512x512, bust up ARIN male hero, teal cyan hair, navy teal outfit gold trim, cyan magic sparks, dark background #080D18, bold clean lines, character select screen art, YSkill Survivor
```

**Lyra :**
```
Same style as Arin portrait reference, LYRA female hero, violet hair ponytail pink ribbon, purple outfit, magic spear, violet sparks, dark background #080D18, character select screen
```

---

## Pipeline après Leonardo

1. Exporter PNG → renommer :
   - `www/play/assets/hero/references/arin-spritesheet-draft.png`
   - `www/play/assets/hero/references/lyra-spritesheet-draft.png`

2. Rebuild packs :
   ```bash
   cd yskill-survivor
   python scripts/build-hero-pack.py --bg green
   ```

3. Test local :
   ```bash
   npm start
   ```
   Réglages → Héros → Arin / Lyra

4. Deploy :
   ```bash
   npm run deploy
   ```

---

## Si la grille Leonardo est incorrecte

Regénérer en 2 passes (mouvement puis attaques), ou retoucher la grille dans Photopea avant le script.

---

## ⚠️ Leonardo ne fait PAS des animations cohérentes

**Ne génère pas frame par frame** (idle_01, idle_02…) : chaque image sera un personnage différent (armure, cheveux, épée).

| Approche | Verdict |
|----------|---------|
| 40 images séparées Leonardo | ❌ incohérent |
| 1 spritesheet en **1 seule** génération | ⚠️ possible, retouche grille |
| Pack draft → `build-hero-pack.py` | ✅ même perso par rangée |
| **Arin v7** en ligne | ✅ déjà cohérent |
| Portrait Leonardo + sheet manuelle (Aseprite) | ✅ prod classique |

**Workflow réaliste :** Leonardo = ref style / portrait · gameplay = une spritesheet unique (IA retouchée ou dessin).

---

Options script :

```bash
python scripts/build-hero-pack.py --bg auto      # détecte vert ou noir
python scripts/build-hero-pack.py --bg dark      # fond noir uniquement
python scripts/build-hero-pack.py --cols 6 --rows 8 --frames 5
```
