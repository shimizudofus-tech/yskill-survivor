# YSkill Survivor — Héros masculin / sprites transparents v2

## Correction effectuée
Le premier découpage suivait une grille régulière et faisait apparaître des fragments de la rangée précédente en haut de certaines frames, notamment `walk_down`.

Cette version :
- cadre chaque ligne d'animation séparément ;
- retire le faux damier clair de la spritesheet ;
- place chaque frame sur un canevas transparent fixe ;
- fournit une version 256 px et une version légère 128 px.

## Dossiers à utiliser dans Cursor
- `movement/frames_128/` : animations de déplacement à tester en jeu.
- `attacks/*/frames_128/` : attaques à tester en jeu.
- `full_sheet/hero_sprite_sheet_transparent_128.png` : spritesheet compacte.
- `previews/preview_frames_transparent_dark.png` : contrôle visuel.

## Animations
- `idle` : 5 frames
- `walk_down` : 5 frames
- `walk_side` : 5 frames
- `walk_up` : 5 frames
- `front_slash` : 5 frames
- `circle_slash` : 5 frames
- `dash` : 5 frames
- `magic_shot` : 5 frames

## Limite
Les images viennent d'une génération IA : pour la version finale, il faudra contrôler en jeu la fluidité des frames et éventuellement corriger les variations de posture.


## v4
Correction supplémentaire des attaques avec filtrage par centre de composant dans chaque rangée.
