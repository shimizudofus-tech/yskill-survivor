# YSkill Survivor

Premier jeu Android de **YSkill** — survivor arcade score-chase (web + Capacitor).

## Démarrage rapide

```bash
cd yskill-survivor
npm install
npm start
```

API classements (Worker séparé) :

```bash
npm run api:dev    # http://localhost:8787
```

Voir [docs/SURVIVOR-API.md](docs/SURVIVOR-API.md) — OAuth, KV, déploiement `survivor-api.yskillstudio.com`.

Ouvre [http://localhost:5173](http://localhost:5173) — accueil studio ; jeu sur [/play/](http://localhost:5173/play/).

Site production : **https://yskillstudio.com** · Privacy : **https://yskillstudio.com/privacy.html**

## Android (après prototype web stable)

```bash
npm run android:init   # une seule fois
npm run cap:sync
npm run cap:open       # Android Studio → Run
```

### Polish mobile v0.2

- Joystick virtuel dédié (bas gauche) sur écrans touch
- Mode run plein écran (header/footer masqués)
- Safe areas notch + barre gestes
- Pause auto : arrière-plan app, bouton Retour Android, changement d’onglet
- Vibrations légères (Capacitor Haptics) — réglage dans Options
- Status bar sombre sur APK natif

Voir `docs/ANDROID-ADS.md` pour AdMob et Play Store.

## Documentation

| Fichier | Contenu |
|---------|---------|
| [docs/GDD.md](docs/GDD.md) | Game design document v1 |
| [docs/EXTRACTION-CHECKLIST.md](docs/EXTRACTION-CHECKLIST.md) | Reprise depuis build-sim |
| [docs/ROADMAP.md](docs/ROADMAP.md) | Plan 6 mois |
| [docs/CLOUDFLARE-YSKILLSTUDIO.md](docs/CLOUDFLARE-YSKILLSTUDIO.md) | Domaine **yskillstudio.com** + Pages |
| [docs/SURVIVOR-API.md](docs/SURVIVOR-API.md) | API online — auth optionnelle + leaderboards |
| [docs/LEONARDO-HERO-PROMPTS.md](docs/LEONARDO-HERO-PROMPTS.md) | Prompts Gemini / Layer — spritesheets héros |
| [www/assets/ASSETS_MANIFEST.md](www/assets/ASSETS_MANIFEST.md) | **Manifeste assets** — chemins et états INTEGRATED/TODO |

## Stack

- HTML5 Canvas (pas de moteur)
- Capacitor 7 → Android
- Monnaie meta : **YS** (localStorage v0)
- i18n : FR / EN

## Licence

Propriété YSkill — IP originale (aucun asset Spekter Agency).
