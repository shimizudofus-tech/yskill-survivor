# Android — export & publicités (AdMob)

Guide pour passer de `www/` à un APK Play Store avec **gratuit + pub récompense**.

---

## Prérequis

- Node.js 20+
- [Android Studio](https://developer.android.com/studio) (SDK 34+)
- Compte [Google Play Console](https://play.google.com/console) — **25 $** unique
- Compte [AdMob](https://admob.google.com/) lié au même Google account

---

## 1. Initialiser Capacitor Android

```bash
cd yskill-survivor
npm install
npx cap add android
npx cap sync android
npx cap open android
```

Dans Android Studio : **Run** sur émulateur ou device USB.

---

## 2. Icône & splash

- Adaptive icon : `android/app/src/main/res/mipmap-*`
- Outil : [Android Asset Studio](https://romannurik.github.io/AndroidAssetStudio/icons-launcher.html)
- Couleur brand : `#0c0f14` fond, logo **Y** cyan/violet

---

## 2b. Forcer le portrait 9:16 (recommandé)

Le jeu utilise une arène **360×640** (ratio **9:16**).

Après `npx cap add android`, dans  
`android/app/src/main/AndroidManifest.xml`, sur l’activité principale :

```xml
android:screenOrientation="portrait"
```

Cela évite la rotation paysage sur téléphone.

---

### Install plugin (quand prêt M4)

```bash
npm install @capacitor-community/admob
npx cap sync android
```

### AndroidManifest (extrait)

Ajouter dans `android/app/src/main/AndroidManifest.xml` :

```xml
<meta-data
    android:name="com.google.android.gms.ads.APPLICATION_ID"
    android:value="ca-app-pub-XXXXXXXX~YYYYYYYY"/>
```

Utiliser l’**App ID test** Google en dev :

`ca-app-pub-3940256099942544~3347511713`

### Emplacements prévus (GDD)

| Emplacement | Type | ID unit test |
|-------------|------|--------------|
| Revive | Rewarded | `ca-app-pub-3940256099942544/5224354917` |
| Double YS | Rewarded | idem (unit séparée en prod) |

### Bridge JS (stub dans app.js)

```javascript
// await AdMob.showRewardVideoAd({ adId: REWARDED_ID });
// on reward → game.revive() ou doubleYs()
```

Le stub `showRewardedAd()` est déjà dans `www/js/app.js` — brancher le plugin en M4.

---

## 4. Privacy & conformité

Obligatoire Play Store :

1. **Politique de confidentialité** (URL publique)
   - Données : scores locaux, identifiant pub AdMob, pas de compte v0
2. **Formulaire Data safety** : Advertising ID déclaré si AdMob
3. **UMP / consent** (UE) : SDK AdMob User Messaging Platform pour EEE

Modèle gratuit : [PrivacyPolicies generator](https://www.privacypolicies.com/) + relecture.

---

## 5. Build release (AAB)

```bash
# Keystore (une fois)
keytool -genkey -v -keystore yskill-release.keystore -alias yskill -keyalg RSA -keysize 2048 -validity 10000

# android/app/build.gradle → signingConfigs release
# Build → Generate Signed Bundle / APK → Android App Bundle
```

Uploader le **.aab** sur Play Console → Production ou Closed testing.

---

## 6. Fiche Play Store (brouillon)

**Titre :** YSkill Survivor  
**Catégorie :** Jeux > Action  
**Tags :** survivor, arcade, offline  

**Description courte :**  
Survis, tire auto, bats ton score. Améliorations permanentes YS. Gratuit.

**Contient des annonces :** Oui  
**Achats in-app :** Non (v1)

---

## 7. Checklist avant soumission

- [ ] Aucune référence Spekter / KRAPS (`rg` sur `www/`)
- [ ] Jeu jouable offline (pub fail gracefully)
- [ ] Pas de crash au retour arrière Android
- [ ] Target SDK à jour (Play exige dernière policy)
- [ ] Tests sur 3 tailles d’écran

---

*Guide v1 — YSkill — Mai 2026*
