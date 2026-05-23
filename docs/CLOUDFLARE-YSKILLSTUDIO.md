# Cloudflare — yskillstudio.com

Domaine : **yskillstudio.com** (registrar + DNS Cloudflare)

---

## Structure du site (déployée)

| URL | Contenu |
|-----|---------|
| `https://yskillstudio.com/` | Landing studio |
| `https://yskillstudio.com/play/` | YSkill Survivor (jeu web) |
| `https://yskillstudio.com/privacy.html` | Politique de confidentialité (Play Store + AdMob) |

Redirection automatique : `www.yskillstudio.com` → `yskillstudio.com` (fichier `www/_redirects`).

---

## Étape 1 — Repo GitHub

```bash
cd yskill-survivor
git init
git add .
git commit -m "YSkill Studio site + Survivor v0.2"
git remote add origin git@github.com:TON_USER/yskill-survivor.git
git push -u origin main
```

---

## Étape 2 — Cloudflare Pages

1. [dash.cloudflare.com](https://dash.cloudflare.com) → **Workers & Pages** → **Create**
2. **Pages** → **Connect to Git** → repo `yskill-survivor`
3. Paramètres build :

| Champ | Valeur |
|-------|--------|
| Production branch | `main` |
| Framework preset | **None** |
| Build command | *(vide)* |
| Build output directory | **`www`** |

4. **Save and Deploy**

URL temporaire : `https://yskillstudio.pages.dev` (nom selon projet)

---

## Étape 3 — Domaine personnalisé

Pages project → **Custom domains** → **Set up a custom domain** :

1. `yskillstudio.com`
2. `www.yskillstudio.com`

Cloudflare crée les enregistrements DNS automatiquement (domaine déjà sur Cloudflare).

Vérifier dans **DNS** → **Records** :

| Type | Name | Content | Proxy |
|------|------|---------|-------|
| CNAME | `@` ou A flatten | Pages | Proxied |
| CNAME | `www` | `yskillstudio.com` ou Pages | Proxied |

Attendre 5–30 min → HTTPS actif.

---

## Étape 4 — Email pro (gratuit)

**Email Routing** (Cloudflare → yskillstudio.com → Email → Email Routing) :

1. Activer Email Routing
2. Créer `contact@yskillstudio.com` → forward vers ta boîte perso
3. Ajouter l’enregistrement MX + TXT proposés par Cloudflare

Utiliser `contact@yskillstudio.com` sur :
- Google Play Console (support)
- Politique de confidentialité
- Page d’accueil

---

## Étape 5 — SSL & perf (recommandé)

**SSL/TLS** → mode **Full (strict)**

**Speed** → activer Brotli

**Caching** → laisser par défaut (HTML dynamique minimal)

---

## Étape 6 — Vérifications post-deploy

- [ ] `https://yskillstudio.com/` — landing OK
- [ ] `https://yskillstudio.com/play/` — jeu jouable mobile
- [ ] `https://yskillstudio.com/privacy.html` — accessible sans login
- [ ] `https://www.yskillstudio.com` redirige vers apex
- [ ] Email `contact@yskillstudio.com` reçu

---

## Google Play (plus tard)

Dans la fiche Play Store :

- **Site web** : `https://yskillstudio.com`
- **Email support** : `contact@yskillstudio.com`
- **Privacy policy URL** : `https://yskillstudio.com/privacy.html`

---

## Déploiement manuel (option CLI)

```bash
npm install -g wrangler
wrangler pages deploy www --project-name=yskillstudio
```

---

*YSkill Studio — Mai 2026*
