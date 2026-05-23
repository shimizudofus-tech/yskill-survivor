import { t, setLocale, applyI18n, getLocale } from "./i18n.js";
import {
  getYs,
  addYs,
  buyUpgrade,
  upgradeCost,
  upgradeLevel,
  getUpgradeEffects,
  recordRun,
  ysFromScore,
  getSettings,
  patchSettings,
  getState,
} from "./storage.js";
import { UPGRADE_CATALOG } from "./config.js";
import { YSkillSurvivorGame } from "./game.js";
import { Sfx } from "./audio.js";
import { VirtualJoystick, prefersTouchControls } from "./joystick.js";
import {
  initPlatform,
  lockDocumentScroll,
  configureNativeChrome,
  hapticImpact,
  isCoarsePointer,
} from "./platform.js";

const screens = {
  home: document.getElementById("screenHome"),
  run: document.getElementById("screenRun"),
  over: document.getElementById("screenGameOver"),
  shop: document.getElementById("screenShop"),
  scores: document.getElementById("screenScores"),
  settings: document.getElementById("screenSettings"),
};

const canvas = document.getElementById("gameCanvas");
const hudScore = document.getElementById("hudScore");
const hudTime = document.getElementById("hudTime");
const hudHp = document.getElementById("hudHp");
const hudRunLevel = document.getElementById("hudRunLevel");
const ysBalanceEl = document.getElementById("ysBalance");
const goScore = document.getElementById("goScore");
const goYs = document.getElementById("goYs");
const goBest = document.getElementById("goBest");
const shopList = document.getElementById("shopList");
const scoresList = document.getElementById("scoresList");
const btnRevive = document.getElementById("btnRevive");
const pauseOverlay = document.getElementById("pauseOverlay");
const levelUpOverlay = document.getElementById("levelUpOverlay");
const levelUpChoices = document.getElementById("levelUpChoices");
const joystickRoot = document.getElementById("joystickRoot");
const runHint = document.getElementById("runHint");

let game = null;
let sfx = null;
let joystick = null;
let lastRunScore = 0;
let lastYsEarned = 0;
let ysDoubled = false;
let runPaused = false;

function useTouchLayout() {
  return prefersTouchControls() || isCoarsePointer();
}

function showScreen(name) {
  Object.entries(screens).forEach(([key, el]) => {
    el.hidden = key !== name;
  });
  const inRun = name === "run";
  document.body.classList.toggle("run-active", inRun);
  lockDocumentScroll(inRun && !runPaused);
}

function refreshYs() {
  const ys = getYs();
  document.querySelectorAll("[data-ys-balance]").forEach((el) => {
    el.textContent = String(ys);
  });
  if (ysBalanceEl) ysBalanceEl.textContent = String(ys);
}

function triggerHaptic(style) {
  if (!getSettings().haptics) return;
  void hapticImpact(style);
}

function pauseRun(showOverlay = true) {
  if (!game?.running || game.paused || game.levelUpPending) return false;
  game.pause();
  runPaused = true;
  if (showOverlay) pauseOverlay.hidden = false;
  lockDocumentScroll(false);
  return true;
}

function resumeRun() {
  if (!game?.paused) return;
  game.resume();
  runPaused = false;
  pauseOverlay.hidden = true;
  lockDocumentScroll(true);
}

function destroyJoystick() {
  if (joystick) {
    joystick.destroy();
    joystick = null;
  }
  if (joystickRoot) {
    joystickRoot.hidden = true;
  }
}

function setupJoystick() {
  destroyJoystick();
  if (!useTouchLayout() || !joystickRoot) return null;
  joystickRoot.hidden = false;
  joystick = new VirtualJoystick(joystickRoot, { size: 136, knobSize: 54 });
  return joystick;
}

function initLocale() {
  const settings = getSettings();
  setLocale(settings.locale || "fr");
  applyI18n();
  updateRunHint();
}

function updateRunHint() {
  if (!runHint) return;
  runHint.textContent = useTouchLayout() ? t("run.hintTouch") : t("run.hintKeyboard");
}

function bindNav() {
  document.querySelectorAll("[data-nav]").forEach((btn) => {
    btn.addEventListener("click", () => {
      const target = btn.dataset.nav;
      if (target === "play") startRun();
      else if (target === "shop") openShop();
      else if (target === "scores") openScores();
      else if (target === "settings") openSettings();
      else if (target === "home") goHome();
    });
  });
}

function hideLevelUp() {
  if (levelUpOverlay) levelUpOverlay.hidden = true;
  if (levelUpChoices) levelUpChoices.innerHTML = "";
}

function showLevelUp(choices) {
  if (!levelUpOverlay || !levelUpChoices) return;
  pauseOverlay.hidden = true;
  runPaused = false;
  levelUpChoices.innerHTML = "";
  choices.forEach(({ id, level, max }) => {
    const btn = document.createElement("button");
    btn.type = "button";
    btn.className = "btn levelup-choice";
    btn.innerHTML = `
      <strong>${t(`runUpgrade.${id}`)}</strong>
      <span>${t(`runUpgrade.${id}Desc`)}</span>
      <small>${t("shop.max")} ${level}/${max}</small>
    `;
    btn.addEventListener("click", () => {
      if (game?.pickRunUpgrade(id)) {
        hideLevelUp();
        triggerHaptic("light");
      }
    });
    levelUpChoices.appendChild(btn);
  });
  levelUpOverlay.hidden = false;
  triggerHaptic("medium");
}

function goHome() {
  runPaused = false;
  pauseOverlay.hidden = true;
  hideLevelUp();
  lockDocumentScroll(false);
  destroyJoystick();
  if (game) {
    game.stop();
    game.destroy();
    game = null;
  }
  showScreen("home");
  refreshYs();
}

function startRun() {
  if (game) {
    game.destroy();
    game = null;
  }
  destroyJoystick();
  const settings = getSettings();
  const stick = setupJoystick();
  sfx = new Sfx(settings.sound);
  game = new YSkillSurvivorGame(canvas, {
    seed: Date.now(),
    effects: getUpgradeEffects(),
    sfx,
    sound: settings.sound,
    useCanvasTouch: !stick,
    getMoveVector: stick ? () => stick.getVector() : null,
    onImpact: (style) => triggerHaptic(style),
    tBoss: () => t("boss.incoming"),
    onLevelUp: ({ choices }) => showLevelUp(choices),
    onState: (s) => {
      hudScore.textContent = String(s.score);
      hudTime.textContent = s.timeLabel;
      if (hudRunLevel) hudRunLevel.textContent = String(s.runLevel ?? 0);
      hudHp.textContent = s.maxHp > 1 ? `${s.hp}/${s.maxHp}` : String(s.hp);
    },
    onGameOver: (payload) => finishRun(payload),
  });
  ysDoubled = false;
  runPaused = false;
  pauseOverlay.hidden = true;
  hideLevelUp();
  showScreen("run");
  updateRunHint();
  game.start();
  lockDocumentScroll(true);
}

function finishRun({ score, canRevive }) {
  lockDocumentScroll(false);
  hideLevelUp();
  destroyJoystick();
  lastRunScore = score;
  lastYsEarned = ysFromScore(score);
  addYs(lastYsEarned);
  recordRun(score);
  const best = getState().scores[0]?.score ?? score;
  goScore.textContent = String(score);
  goYs.textContent = String(lastYsEarned);
  goBest.textContent = String(best);
  btnRevive.hidden = !canRevive;
  triggerHaptic("heavy");
  showScreen("over");
  refreshYs();
}

function finishRunAfterReviveDeath() {
  if (!game) return;
  const score = game.score();
  finishRun({ score, canRevive: false });
}

/** Stub AdMob — replace with @capacitor-community/admob in M4 */
export function showRewardedAd(onReward) {
  const msg = t("ad.stub");
  if (window.Capacitor?.isNativePlatform?.()) {
    onReward();
  } else if (confirm(msg + "\n\nOK = pub vue")) {
    onReward();
  }
}

function bindRunControls() {
  document.getElementById("btnPause").addEventListener("click", () => {
    pauseRun(true);
  });
  document.getElementById("btnResume").addEventListener("click", () => {
    resumeRun();
  });
}

function bindGameOver() {
  document.getElementById("btnRetry").addEventListener("click", () => startRun());
  document.getElementById("btnGoMenu").addEventListener("click", () => goHome());

  btnRevive.addEventListener("click", () => {
    showRewardedAd(() => {
      if (game?.revive()) {
        setupJoystick();
        game.useCanvasTouch = !joystick;
        game.getMoveVector = joystick ? () => joystick.getVector() : null;
        showScreen("run");
        lockDocumentScroll(true);
        game.onGameOver = () => finishRunAfterReviveDeath();
      }
    });
  });

  document.getElementById("btnDoubleYs").addEventListener("click", () => {
    if (ysDoubled) return;
    showRewardedAd(() => {
      if (ysDoubled) return;
      ysDoubled = true;
      addYs(lastYsEarned);
      goYs.textContent = String(lastYsEarned * 2);
      refreshYs();
      triggerHaptic("light");
    });
  });
}

function openShop() {
  shopList.innerHTML = "";
  UPGRADE_CATALOG.forEach(({ id }) => {
    const lv = upgradeLevel(id);
    const cost = upgradeCost(id);
    const row = document.createElement("div");
    row.className = "shop-row";
    row.innerHTML = `
      <div class="shop-row-info">
        <strong>${t(`upgrade.${id}`)}</strong>
        <span>${t("shop.max")} ${lv}</span>
      </div>
      <button type="button" class="btn btn-accent" data-buy="${id}">${cost} YS</button>
    `;
    shopList.appendChild(row);
  });
  shopList.querySelectorAll("[data-buy]").forEach((btn) => {
    btn.addEventListener("click", () => {
      const id = btn.dataset.buy;
      const res = buyUpgrade(id);
      if (res.ok) openShop();
      refreshYs();
    });
  });
  refreshYs();
  showScreen("shop");
}

function openScores() {
  const scores = getState().scores;
  scoresList.innerHTML = "";
  if (!scores.length) {
    scoresList.innerHTML = `<p class="muted">${t("scores.empty")}</p>`;
  } else {
    scores.forEach((row, i) => {
      const el = document.createElement("div");
      el.className = "score-row";
      el.innerHTML = `<span>#${i + 1}</span><strong>${row.score}</strong><span>${new Date(row.at).toLocaleDateString()}</span>`;
      scoresList.appendChild(el);
    });
  }
  showScreen("scores");
}

function openSettings() {
  const s = getSettings();
  document.getElementById("settingSound").checked = s.sound;
  document.getElementById("settingMusic").checked = s.music;
  document.getElementById("settingHaptics").checked = s.haptics !== false;
  document.getElementById("settingLang").value = s.locale || getLocale();
  showScreen("settings");
}

function bindSettings() {
  document.getElementById("settingSound").addEventListener("change", (e) => {
    patchSettings({ sound: e.target.checked });
  });
  document.getElementById("settingMusic").addEventListener("change", (e) => {
    patchSettings({ music: e.target.checked });
  });
  document.getElementById("settingHaptics").addEventListener("change", (e) => {
    patchSettings({ haptics: e.target.checked });
  });
  document.getElementById("settingLang").addEventListener("change", (e) => {
    patchSettings({ locale: e.target.value });
    setLocale(e.target.value);
    applyI18n();
    updateRunHint();
  });
}

function bindResize() {
  window.addEventListener("resize", () => {
    game?._resize?.();
  });
  window.addEventListener("orientationchange", () => {
    setTimeout(() => game?._resize?.(), 150);
  });
}

async function boot() {
  document.body.classList.toggle("is-touch", useTouchLayout());
  initLocale();
  bindNav();
  bindRunControls();
  bindGameOver();
  bindSettings();
  bindResize();
  refreshYs();
  showScreen("home");

  await configureNativeChrome();
  await initPlatform({
    onPause: () => {
      if (screens.run.hidden) return;
      pauseRun(true);
    },
    onBack: () => {
      if (screens.run.hidden) return false;
      if (game?.levelUpPending) return true;
      if (game?.paused) {
        goHome();
        return true;
      }
      return pauseRun(true);
    },
  });
}

boot();
