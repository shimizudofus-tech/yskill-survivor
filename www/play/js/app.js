import { t, setLocale, applyI18n, getLocale, stageName, bossName, formatDurationMs, STAGES } from "./i18n.js";
import {
  getYs,
  addYs,
  buyUpgrade,
  upgradeCost,
  upgradeLevel,
  getUpgradeEffects,
  ysFromScore,
  getSettings,
  patchSettings,
  isStageUnlocked,
  isStageCompleted,
  getStageRecord,
  recordAdventureVictory,
  recordAdventureDefeat,
} from "./storage.js";
import { UPGRADE_CATALOG } from "./config.js";
import { getStageById, getNextStageId } from "./stages.js";
import { YSkillSurvivorGame, formatTime } from "./game.js";
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
  adventure: document.getElementById("screenAdventure"),
  run: document.getElementById("screenRun"),
  over: document.getElementById("screenGameOver"),
  victory: document.getElementById("screenVictory"),
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
const goStageName = document.getElementById("goStageName");
const shopList = document.getElementById("shopList");
const scoresList = document.getElementById("scoresList");
const btnRevive = document.getElementById("btnRevive");
const pauseOverlay = document.getElementById("pauseOverlay");
const levelUpOverlay = document.getElementById("levelUpOverlay");
const levelUpChoices = document.getElementById("levelUpChoices");
const joystickRoot = document.getElementById("joystickRoot");
const runHint = document.getElementById("runHint");
const adventurePath = document.getElementById("adventurePath");
const stagePanel = document.getElementById("stagePanel");
const stagePanelName = document.getElementById("stagePanelName");
const stagePanelBoss = document.getElementById("stagePanelBoss");
const stagePanelScore = document.getElementById("stagePanelScore");
const stagePanelTime = document.getElementById("stagePanelTime");
const stagePanelRewardFirst = document.getElementById("stagePanelRewardFirst");
const stagePanelRewardReplay = document.getElementById("stagePanelRewardReplay");
const btnStageLaunch = document.getElementById("btnStageLaunch");
const btnStageClose = document.getElementById("btnStageClose");
const vicStageName = document.getElementById("vicStageName");
const vicBossName = document.getElementById("vicBossName");
const vicScore = document.getElementById("vicScore");
const vicTime = document.getElementById("vicTime");
const vicYs = document.getElementById("vicYs");
const vicRewardLabel = document.getElementById("vicRewardLabel");
const btnNextStage = document.getElementById("btnNextStage");

let game = null;
let sfx = null;
let joystick = null;
let currentRunConfig = null;
let selectedStageId = null;
let runSettled = false;
let lastRunResult = null;
let scoresTab = "adventure";
let runPaused = false;

function useTouchLayout() {
  return prefersTouchControls() || isCoarsePointer();
}

function showScreen(name) {
  Object.entries(screens).forEach(([key, el]) => {
    if (el) el.hidden = key !== name;
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

function buildRunConfig(stageId) {
  const stageConfig = getStageById(stageId);
  return {
    mode: "adventure",
    stageId: Number(stageId),
    stageConfig,
    allowPermanentUpgrades: true,
    allowRevive: true,
    leaderboardEligible: true,
  };
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
  if (joystickRoot) joystickRoot.hidden = true;
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
  if (!runHint || !currentRunConfig?.stageConfig) return;
  const mins = Math.round(currentRunConfig.stageConfig.durationBeforeBossMs / 60000);
  const base = useTouchLayout() ? t("run.hintTouch") : t("run.hintKeyboard");
  runHint.textContent = `${base} · ~${mins} min`;
}

function bindNav() {
  document.querySelectorAll("[data-nav]").forEach((btn) => {
    btn.addEventListener("click", () => {
      const target = btn.dataset.nav;
      if (target === "adventure") openAdventure();
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
  runSettled = false;
  pauseOverlay.hidden = true;
  hideLevelUp();
  closeStagePanel();
  lockDocumentScroll(false);
  destroyJoystick();
  if (game) {
    game.stop();
    game.destroy();
    game = null;
  }
  currentRunConfig = null;
  showScreen("home");
  refreshYs();
}

function openAdventure() {
  renderAdventureMap();
  showScreen("adventure");
}

function closeStagePanel() {
  if (stagePanel) stagePanel.hidden = true;
  selectedStageId = null;
}

function openStagePanel(stageId) {
  const stage = getStageById(stageId);
  if (!stage || !isStageUnlocked(stageId)) return;
  selectedStageId = stageId;
  const record = getStageRecord(stageId);
  stagePanelName.textContent = `${stage.id}. ${stageName(stage)}`;
  stagePanelBoss.textContent = bossName(stage.bossId);
  stagePanelScore.textContent = record?.bestScore ? String(record.bestScore) : "—";
  stagePanelTime.textContent =
    record?.bestTimeMs && record.bossDefeated ? formatDurationMs(record.bestTimeMs) : "—";
  stagePanelRewardFirst.textContent = String(stage.rewardFirstClear);
  stagePanelRewardReplay.textContent = String(stage.rewardReplay);
  stagePanel.hidden = false;
}

function renderAdventureMap() {
  if (!adventurePath) return;
  adventurePath.innerHTML = "";
  STAGES.forEach((stage, index) => {
    const unlocked = isStageUnlocked(stage.id);
    const completed = isStageCompleted(stage.id);
    const node = document.createElement("button");
    node.type = "button";
    node.className = "adventure-node";
    if (completed) node.classList.add("is-completed");
    else if (unlocked) node.classList.add("is-available");
    else node.classList.add("is-locked");
    node.disabled = !unlocked;
    node.innerHTML = `
      <span class="adventure-node-num">${stage.id}</span>
      <span class="adventure-node-body">
        <strong>${stageName(stage)}</strong>
        <small>${bossName(stage.bossId)}</small>
      </span>
      <span class="adventure-node-badge">${completed ? "★" : unlocked ? "▶" : "🔒"}</span>
    `;
    node.addEventListener("click", () => openStagePanel(stage.id));
    adventurePath.appendChild(node);
    if (index < STAGES.length - 1) {
      const connector = document.createElement("div");
      connector.className = "adventure-connector";
      if (completed) connector.classList.add("is-done");
      adventurePath.appendChild(connector);
    }
  });
}

function startAdventureRun(stageId) {
  const stage = getStageById(stageId);
  if (!stage || !isStageUnlocked(stageId)) return;
  closeStagePanel();
  currentRunConfig = buildRunConfig(stageId);
  runSettled = false;
  lastRunResult = null;

  if (game) {
    game.destroy();
    game = null;
  }
  destroyJoystick();
  const settings = getSettings();
  const stick = setupJoystick();
  sfx = new Sfx(settings.sound);
  const effects = currentRunConfig.allowPermanentUpgrades ? getUpgradeEffects() : {};

  game = new YSkillSurvivorGame(canvas, {
    seed: Date.now(),
    effects,
    runConfig: currentRunConfig,
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
    onGameOver: (payload) => finishDefeat(payload),
    onVictory: (payload) => finishVictory(payload),
  });

  runPaused = false;
  pauseOverlay.hidden = true;
  hideLevelUp();
  showScreen("run");
  updateRunHint();
  game.start();
  lockDocumentScroll(true);
}

function settleRunOnce(fn) {
  if (runSettled) return false;
  runSettled = true;
  fn();
  return true;
}

function finishDefeat(payload) {
  lockDocumentScroll(false);
  hideLevelUp();
  destroyJoystick();
  triggerHaptic("heavy");

  const stageId = currentRunConfig?.stageId;
  const stage = getStageById(stageId);
  lastRunResult = { ...payload, stageId };

  goScore.textContent = String(payload.score);
  if (goStageName && stage) goStageName.textContent = stageName(stage);
  btnRevive.hidden = !payload.canRevive;

  if (payload.canRevive) {
    goYs.textContent = "—";
    showScreen("over");
    return;
  }

  if (settleRunOnce(() => _applyDefeat(payload))) {
    showScreen("over");
    refreshYs();
  }
}

function settlePendingDefeat() {
  if (runSettled || !lastRunResult) return;
  const { score, elapsedMs, revived, stageId } = lastRunResult;
  if (settleRunOnce(() => _applyDefeat({ score, elapsedMs, revived, canRevive: false }))) {
    refreshYs();
  }
}

function _applyDefeat({ score, elapsedMs, canRevive, revived }) {
  const stageId = currentRunConfig?.stageId;
  const stage = getStageById(stageId);
  const ysEarned = ysFromScore(score);
  if (ysEarned > 0) addYs(ysEarned);
  recordAdventureDefeat(stageId, { score, timeMs: elapsedMs, revived });
  lastRunResult = { score, elapsedMs, ysEarned, canRevive, revived, stageId };
  goScore.textContent = String(score);
  goYs.textContent = String(ysEarned);
  if (goStageName && stage) goStageName.textContent = stageName(stage);
  btnRevive.hidden = !canRevive;
}

function finishVictory(payload) {
  if (!settleRunOnce(() => _applyVictory(payload))) return;
  lockDocumentScroll(false);
  hideLevelUp();
  destroyJoystick();
  triggerHaptic("heavy");
  showScreen("victory");
  refreshYs();
}

function _applyVictory({ score, elapsedMs, revived, stageId, stageName: sName, bossName: bName }) {
  const sid = stageId ?? currentRunConfig?.stageId;
  const result = recordAdventureVictory(sid, { score, timeMs: elapsedMs, revived });
  lastRunResult = {
    score,
    elapsedMs,
    ysEarned: result.ysEarned,
    firstClear: result.firstClear,
    nextStageId: result.nextStageId,
    stageId: sid,
  };
  const stage = getStageById(sid);
  vicStageName.textContent = sName || (stage ? stageName(stage) : "—");
  vicBossName.textContent = bName || (stage ? bossName(stage.bossId) : "—");
  vicScore.textContent = String(score);
  vicTime.textContent = formatTime(elapsedMs);
  vicYs.textContent = String(result.ysEarned);
  vicRewardLabel.textContent = result.firstClear ? t("victory.firstClear") : t("victory.replay");
  const nextUnlocked = result.nextStageId && isStageUnlocked(result.nextStageId);
  btnNextStage.hidden = !nextUnlocked;
  if (nextUnlocked) btnNextStage.dataset.nextStage = String(result.nextStageId);
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
  document.getElementById("btnPause").addEventListener("click", () => pauseRun(true));
  document.getElementById("btnResume").addEventListener("click", () => resumeRun());
}

function bindGameOver() {
  document.getElementById("btnRetry").addEventListener("click", () => {
    settlePendingDefeat();
    if (lastRunResult?.stageId) startAdventureRun(lastRunResult.stageId);
  });
  document.getElementById("btnGoMenu").addEventListener("click", () => {
    settlePendingDefeat();
    goHome();
  });
  document.getElementById("btnGoAdventure").addEventListener("click", () => {
    settlePendingDefeat();
    goHome();
    openAdventure();
  });

  btnRevive.addEventListener("click", () => {
    showRewardedAd(() => {
      if (game?.revive()) {
        setupJoystick();
        game.useCanvasTouch = !joystick;
        game.getMoveVector = joystick ? () => joystick.getVector() : null;
        showScreen("run");
        lockDocumentScroll(true);
        game.onGameOver = (payload) => finishDefeat(payload);
      }
    });
  });

  btnStageLaunch?.addEventListener("click", () => {
    if (selectedStageId) startAdventureRun(selectedStageId);
  });
  btnStageClose?.addEventListener("click", () => closeStagePanel());

  btnNextStage?.addEventListener("click", () => {
    const nextId = btnNextStage.dataset.nextStage;
    if (nextId) startAdventureRun(Number(nextId));
  });
  document.getElementById("btnVictoryRetry")?.addEventListener("click", () => {
    if (lastRunResult?.stageId) startAdventureRun(lastRunResult.stageId);
  });
  document.getElementById("btnVictoryMap")?.addEventListener("click", () => {
    goHome();
    openAdventure();
  });
  document.getElementById("btnVictoryMenu")?.addEventListener("click", () => goHome());
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
      buyUpgrade(id);
      openShop();
      refreshYs();
    });
  });
  refreshYs();
  showScreen("shop");
}

function renderScoresTab() {
  scoresList.innerHTML = "";
  document.querySelectorAll(".scores-tab").forEach((tab) => {
    tab.classList.toggle("is-active", tab.dataset.scoresTab === scoresTab);
  });

  if (scoresTab === "fullskill") {
    scoresList.innerHTML = `<p class="muted scores-soon">${t("scores.soon")}</p>`;
    return;
  }

  let hasAny = false;
  STAGES.forEach((stage) => {
    const record = getStageRecord(stage.id);
    const row = document.createElement("div");
    row.className = "score-stage-row";
    const bossStatus = record?.bossDefeated ? t("scores.bossDefeated") : t("scores.bossPending");
    const runType =
      record?.bossDefeated && record?.assisted
        ? t("scores.assisted")
        : record?.bossDefeated
          ? t("scores.clean")
          : "—";
    row.innerHTML = `
      <div class="score-stage-head">
        <strong>${stage.id}. ${stageName(stage)}</strong>
        <span class="muted">${bossName(stage.bossId)}</span>
      </div>
      <div class="score-stage-stats">
        <span>${t("adventure.bestScore")}: <strong>${record?.bestScore ?? "—"}</strong></span>
        <span>${t("adventure.bestTime")}: <strong>${record?.bestTimeMs && record.bossDefeated ? formatDurationMs(record.bestTimeMs) : "—"}</strong></span>
        <span>${bossStatus}</span>
        <span>${runType}</span>
      </div>
    `;
    scoresList.appendChild(row);
    if (record?.bestScore) hasAny = true;
  });

  if (!hasAny) {
    scoresList.innerHTML = `<p class="muted">${t("scores.empty")}</p>`;
  }
}

function openScores() {
  scoresTab = "adventure";
  renderScoresTab();
  showScreen("scores");
}

function bindScoresTabs() {
  document.querySelectorAll(".scores-tab").forEach((tab) => {
    tab.addEventListener("click", () => {
      scoresTab = tab.dataset.scoresTab || "adventure";
      renderScoresTab();
    });
  });
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
    if (!screens.adventure.hidden) renderAdventureMap();
  });
}

function bindResize() {
  window.addEventListener("resize", () => game?._resize?.());
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
  bindScoresTabs();
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
      if (!stagePanel?.hidden) {
        closeStagePanel();
        return true;
      }
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
