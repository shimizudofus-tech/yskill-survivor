# YSkill Survivor API (Worker séparé)

API dédiée aux **runs classées** et **classements globaux**. Le jeu reste jouable **sans compte** ; la connexion sert à enregistrer un score sur les leaderboards **Aventure** et **Full Skill**.

## Déploiement

```bash
cd api
npm install
wrangler kv namespace create SURVIVOR_KV
# Copier l’id dans api/wrangler.jsonc → kv_namespaces[0].id
```

Secrets (dashboard Cloudflare ou CLI) :

| Secret | Usage |
|--------|--------|
| `SESSION_SECRET` | Cookie de session signé (32+ caractères aléatoires) |
| `DISCORD_CLIENT_ID` / `DISCORD_CLIENT_SECRET` | OAuth Discord |
| `GOOGLE_CLIENT_ID` / `GOOGLE_CLIENT_SECRET` | OAuth Google |
| `PUBLIC_API_URL` | `https://survivor-api.yskillstudio.com` |
| `PUBLIC_PLAY_URL` | `https://yskillstudio.com/play/` |
| `CORS_ORIGINS` | `https://yskillstudio.com,http://localhost:5173` |

```bash
cd api
wrangler secret put SESSION_SECRET
wrangler secret put DISCORD_CLIENT_ID
# …
npm run deploy
```

Route custom : `survivor-api.yskillstudio.com` → Worker `yskill-survivor-api`.

OAuth redirect URIs à enregistrer chez Discord/Google :

- `https://survivor-api.yskillstudio.com/v1/auth/callback/discord`
- `https://survivor-api.yskillstudio.com/v1/auth/callback/google`

## Dev local

Terminal 1 — API :

```bash
cd api && npm run dev
```

Terminal 2 — jeu :

```bash
npm start
```

Le client pointe vers `http://localhost:8787` sur localhost. Les cookies cross-origin nécessitent HTTPS ou localhost (Chrome).

## Endpoints

| Méthode | Chemin | Auth | Description |
|---------|--------|------|-------------|
| GET | `/health` | Non | Santé |
| GET | `/v1/config` | Non | Config publique |
| GET | `/v1/auth/me` | Cookie | Utilisateur courant |
| GET | `/v1/auth/login/discord?returnTo=` | Non | OAuth Discord |
| GET | `/v1/auth/login/google?returnTo=` | Non | OAuth Google |
| POST | `/v1/auth/logout` | Cookie | Déconnexion |
| POST | `/v1/runs/start` | Oui | Démarre une run classée |
| POST | `/v1/runs/complete` | Oui | Termine la run + leaderboard si éligible |
| GET | `/v1/leaderboards/adventure?stageId=1` | Non* | Top 50 stage |
| GET | `/v1/leaderboards/fullskill` | Non* | Top 50 Full Skill |

\* `myRank` renseigné si cookie session valide.

### Run classée

1. Joueur connecté → `POST /v1/runs/start` `{ "mode": "adventure", "stageId": 1 }` ou `{ "mode": "fullskill", "pactId": "velocity" }`.
2. Réponse : `runId`, `seed`, `expiresAt`.
3. Fin de run → `POST /v1/runs/complete` avec `runId`, `score`, `durationMs`, `bossDefeated`, `revived`, `kills`.
4. Entrée leaderboard si **boss vaincu** et **pas de revive** (Aventure) ; Full Skill : score valide sans revive.

## Client

`www/play/js/survivor-api.js` — override prod :

```html
<script>window.__YSKILL_SURVIVOR_API__ = "https://survivor-api.yskillstudio.com";</script>
```
