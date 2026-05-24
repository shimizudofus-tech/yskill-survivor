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
import { getStageById, getNextStageId, getBossDefinition } from "./stages.js";
import { PACTS } from "./pacts.js";
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
import {
  fetchAdventureLeaderboard,
  fetchAuthMe,
  fetchFullSkillLeaderboard,
  completeRankedRun,
  loginUrl,
  logoutApi,
  startRankedRun,
} from "./survivor-api.js";

const SCREEN_META = {
  home: { topBar: false, theme: null },
  adventure: { topBar: true, titleKey: "adventure.title", theme: "adventure" },
  fullskill: { topBar: true, titleKey: "nav.fullSkill", theme: "arena" },
  shop: { topBar: true, titleKey: "nav.upgrades", theme: null },
  scores: { topBar: true, titleKey: "scores.title", theme: null },
  settings: { topBar: true, titleKey: "nav.settings", theme: null },
  over: { topBar: true, titleKey: "go.defeat", theme: null },
  victory: { topBar: true, titleKey: "victory.title", theme: "adventure" },
  run: { topBar: false, theme: null },
};

const screens = {
  home: document.getElementById("screenHome"),
  adventure: document.getElementById("screenAdventure"),
  fullskill: document.getElementById("screenFullSkill"),
  run: document.getElementById("screenRun"),
  over: document.getElementById("screenGameOver"),
  victory: document.getElementById("screenVictory"),
  shop: document.getElementById("screenShop"),
  scores: document.getElementById("screenScores"),
  settings: document.getElementById("screenSettings"),
};

const topBar = document.getElementById("topBar");
const topBarTitle = document.getElementById("topBarTitle");
const btnBack = document.getElementById("btnBack");

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
const stagePanelDifficulty = document.getElementById("stagePanelDifficulty");
const stagePanelReward = document.getElementById("stagePanelReward");
const stagePanelAttacks = document.getElementById("stagePanelAttacks");
const bossPortraitIcon = document.getElementById("bossPortraitIcon");
const pactList = document.getElementById("pactList");
const pactDetail = document.getElementById("pactDetail");
const fullSkillLb = document.getElementById("fullSkillLb");
const btnStageLaunch = document.getElementById("btnStageLaunch");
const btnStageClose = document.getElementById("btnStageClose");
const vicStageName = document.getElementById("vicStageName");
const vicBossName = document.getElementById("vicBossName");
const vicScore = document.getElementById("vicScore");
const vicTime = document.getElementById("vicTime");
const vicYs = document.getElementById("vicYs");
const vicRewardLabel = document.getElementById("vicRewardLabel");
const btnNextStage = document.getElementById("btnNextStage");
const authUserEl = document.getElementById("authUser");
const authSignInEl = document.getElementById("authSignIn");
const authAvatar = document.getElementById("authAvatar");
const authName = document.getElementById("authName");
const btnSignIn = document.getElementById("btnSignIn");
const btnSignOut = document.getElementById("btnSignOut");
const authProviders = document.getElementById("authProviders");
const scoresStagePicker = document.getElementById("scoresStagePicker");
const vicRankedStatus = document.getElementById("vicRankedStatus");

let game = null;
let sfx = null;
let joystick = null;
let currentRunConfig = null;
let selectedStageId = null;
let runSettled = false;
let lastRunResult = null;
let scoresTab = "adventure";
let scoresScope = "local";
let globalLbStageId = 1;
let authUser = null;
let authProvidersState = null;
let rankedRunId = null;
let runPaused = false;
let selectedPactId = "velocity";
let lastScreen = "home";

function useTouchLayout() {
  return prefersTouchControls() || isCoarsePointer();
}

let upgradeTipEl = null;
let upgradeTipAnchor = null;
let upgradeTipPressTimer = null;
const UPGRADE_TIP_LONG_MS = 450;

function escapeHtml(text) {
  return String(text)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function ensureUpgradeTip() {
  if (upgradeTipEl) return upgradeTipEl;
  upgradeTipEl = document.createElement("div");
  upgradeTipEl.id = "upgradeTip";
  upgradeTipEl.className = "upgrade-tip";
  upgradeTipEl.hidden = true;
  upgradeTipEl.setAttribute("role", "tooltip");
  document.body.appendChild(upgradeTipEl);

  document.addEventListener("pointerdown", (e) => {
    if (!upgradeTipEl || upgradeTipEl.hidden) return;
    if (upgradeTipEl.contains(e.target) || upgradeTipAnchor?.contains(e.target)) return;
    hideUpgradeTip();
  });
  window.addEventListener("scroll", hideUpgradeTip, { passive: true, capture: true });
  window.addEventListener("resize", hideUpgradeTip);
  return upgradeTipEl;
}

function positionUpgradeTip(anchor) {
  const tip = ensureUpgradeTip();
  tip.hidden = false;
  tip.style.visibility = "hidden";
  requestAnimationFrame(() => {
    const rect = anchor.getBoundingClientRect();
    const tipRect = tip.getBoundingClientRect();
    const pad = 10;
    let left = rect.left + rect.width / 2 - tipRect.width / 2;
    left = Math.max(pad, Math.min(left, window.innerWidth - tipRect.width - pad));
    let top = rect.top - tipRect.height - pad;
    if (top < pad) top = rect.bottom + pad;
    tip.style.left = `${left}px`;
    tip.style.top = `${top}px`;
    tip.style.visibility = "";
  });
}

function showUpgradeTip(anchor, title, desc) {
  const tip = ensureUpgradeTip();
  upgradeTipAnchor = anchor;
  tip.innerHTML = `<strong>${escapeHtml(title)}</strong><p>${escapeHtml(desc)}</p>`;
  tip.hidden = false;
  positionUpgradeTip(anchor);
}

function hideUpgradeTip() {
  clearTimeout(upgradeTipPressTimer);
  upgradeTipPressTimer = null;
  if (!upgradeTipEl) return;
  upgradeTipEl.hidden = true;
  upgradeTipAnchor = null;
}

function attachUpgradeTip(el, id) {
  const show = () => showUpgradeTip(el, t(`upgrade.${id}`), t(`upgrade.${id}Desc`));
  el.classList.add("has-upgrade-tip");
  el.setAttribute("aria-describedby", "upgradeTip");

  el.addEventListener("mouseenter", show);
  el.addEventListener("mouseleave", hideUpgradeTip);
  el.addEventListener("focus", show);
  el.addEventListener("blur", hideUpgradeTip);

  el.addEventListener(
    "pointerdown",
    (e) => {
      if (e.pointerType === "mouse" && e.button !== 0) return;
      clearTimeout(upgradeTipPressTimer);
      if (e.pointerType === "touch") {
        upgradeTipPressTimer = setTimeout(show, UPGRADE_TIP_LONG_MS);
      }
    },
    { passive: true },
  );
  el.addEventListener("pointerup", () => clearTimeout(upgradeTipPressTimer));
  el.addEventListener("pointercancel", () => clearTimeout(upgradeTipPressTimer));
  el.addEventListener("pointerleave", () => clearTimeout(upgradeTipPressTimer));
}

function showScreen(name) {
  hideUpgradeTip();
  if (name !== "home" && screens[name]?.hidden === false) {
    lastScreen = name;
  } else if (name !== "home" && !screens.home.hidden && name !== lastScreen) {
    /* navigating from home */
  }
  if (name === "home") lastScreen = "home";

  Object.entries(screens).forEach(([key, el]) => {
    if (el) el.hidden = key !== name;
  });

  const meta = SCREEN_META[name] || { topBar: true, theme: null };
  if (topBar) topBar.hidden = !meta.topBar;
  if (topBarTitle && meta.titleKey) topBarTitle.textContent = t(meta.titleKey);
  document.body.classList.toggle("theme-adventure", meta.theme === "adventure");
  document.body.classList.toggle("theme-arena", meta.theme === "arena");
  document.body.classList.toggle("is-home", name === "home");

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

function playReturnTo() {
  return `${location.origin}${location.pathname}`;
}

async function refreshAuthUser() {
  try {
    const data = await fetchAuthMe();
    authUser = data?.user || null;
    authProvidersState = data?.providers || null;
  } catch {
    authUser = null;
  }
  renderAuthUI();
  return authUser;
}

function renderAuthUI() {
  const signedIn = Boolean(authUser);
  if (authUserEl) authUserEl.hidden = !signedIn;
  if (authSignInEl) {
    const canLogin = Boolean(authProvidersState?.discord || authProvidersState?.google);
    authSignInEl.hidden = signedIn || !canLogin;
  }
  if (signedIn && authName) authName.textContent = authUser.displayName || "Player";
  if (signedIn && authAvatar) {
    if (authUser.avatarUrl) {
      authAvatar.src = authUser.avatarUrl;
      authAvatar.hidden = false;
    } else {
      authAvatar.removeAttribute("src");
      authAvatar.hidden = true;
    }
  }
  if (authProviders) {
    const hasProvider = authProvidersState?.discord || authProvidersState?.google;
    authProviders.hidden = !hasProvider;
    authProviders.querySelectorAll("[data-login]").forEach((btn) => {
      btn.hidden = !authProvidersState?.[btn.dataset.login];
    });
  }
}

function bindAuth() {
  btnSignIn?.addEventListener("click", () => {
    if (authProviders && !authProviders.hidden) {
      authProviders.hidden = !authProviders.hidden;
      return;
    }
    if (authProvidersState?.discord) {
      location.href = loginUrl("discord", playReturnTo());
    } else if (authProvidersState?.google) {
      location.href = loginUrl("google", playReturnTo());
    }
  });
  authProviders?.querySelectorAll("[data-login]").forEach((btn) => {
    btn.addEventListener("click", () => {
      const provider = btn.dataset.login;
      if (provider) location.href = loginUrl(provider, playReturnTo());
    });
  });
  btnSignOut?.addEventListener("click", async () => {
    try {
      await logoutApi();
    } catch {
      /* offline */
    }
    authUser = null;
    renderAuthUI();
  });
}

async function beginRankedRun(config) {
  rankedRunId = null;
  if (!authUser) return null;
  try {
    const body =
      config.mode === "fullskill"
        ? { mode: "fullskill", pactId: config.pactId || null }
        : { mode: "adventure", stageId: config.stageId };
    const started = await startRankedRun(body);
    if (started?.runId) rankedRunId = started.runId;
    return started;
  } catch (err) {
    console.warn("ranked run start failed", err);
    return null;
  }
}

async function submitRankedResult(payload, { bossDefeated = false } = {}) {
  if (!rankedRunId || !authUser) return null;
  try {
    const result = await completeRankedRun({
      runId: rankedRunId,
      score: payload.score,
      durationMs: payload.elapsedMs,
      kills: payload.kills ?? 0,
      bossDefeated,
      revived: Boolean(payload.revived),
    });
    rankedRunId = null;
    return result;
  } catch (err) {
    console.warn("ranked run complete failed", err);
    rankedRunId = null;
    return null;
  }
}

function showRankedStatus(result, { revived = false } = {}) {
  if (!vicRankedStatus) return;
  vicRankedStatus.hidden = false;
  if (result?.ranked && result.leaderboard?.myRank?.rank) {
    vicRankedStatus.textContent = t("auth.rankedSaved").replace("{rank}", String(result.leaderboard.myRank.rank));
  } else if (!authUser || revived) {
    vicRankedStatus.textContent = t("auth.rankedSkipped");
  } else if (result === null && authUser) {
    vicRankedStatus.textContent = t("auth.rankedFailed");
  } else {
    vicRankedStatus.textContent = t("auth.rankedSkipped");
  }
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
      else if (target === "fullskill") openFullSkill();
      else if (target === "shop") openShop();
      else if (target === "scores") openScores();
      else if (target === "settings") openSettings();
      else if (target === "home") goHome();
    });
  });
  btnBack?.addEventListener("click", () => {
    if (stagePanel && !stagePanel.hidden) {
      closeStagePanel();
      return;
    }
    goHome();
  });
}

const PACT_ICONS = { berserker: "⚔", velocity: "⚡", harvester: "☽" };

function formatDifficulty(mult) {
  const n = Number(mult) || 1;
  return `×${Number.isInteger(n) ? n : n.toFixed(2)}`;
}

function getBossAttackLines(bossId) {
  const def = getBossDefinition(bossId);
  const behavior = def?.behavior;
  const primary = behavior ? t(`bossAttack.${behavior}`) : t("briefing.attackTbd");
  return [primary, t("briefing.attackPhaseSoon")];
}

function openFullSkill() {
  renderPacts();
  renderFullSkillLb();
  showScreen("fullskill");
}

function renderPacts() {
  if (!pactList) return;
  pactList.innerHTML = "";
  PACTS.forEach((pact) => {
    const btn = document.createElement("button");
    btn.type = "button";
    btn.className = `pact-card pact-card--${pact.theme}`;
    if (pact.id === selectedPactId) btn.classList.add("is-selected");
    btn.innerHTML = `
      <span class="pact-icon">${PACT_ICONS[pact.id] || "◆"}</span>
      <span>
        <strong>${t(`pact.${pact.id}`)}</strong>
        <small>${t(`pact.${pact.id}Desc`)}</small>
      </span>
      <span>${pact.id === selectedPactId ? "✓" : ""}</span>
    `;
    btn.addEventListener("click", () => {
      selectedPactId = pact.id;
      renderPacts();
      renderPactDetail(pact.id);
    });
    pactList.appendChild(btn);
  });
  renderPactDetail(selectedPactId);
}

function renderPactDetail(pactId) {
  if (!pactDetail) return;
  const pact = PACTS.find((p) => p.id === pactId);
  if (!pact) {
    pactDetail.hidden = true;
    return;
  }
  pactDetail.hidden = false;
  pactDetail.innerHTML = `
    <strong>${t(`pact.${pact.id}`)}</strong>
    <p class="muted">${t(`pact.${pact.id}Desc`)}</p>
    <ul>${pact.stats.map((s) => `<li>${s}</li>`).join("")}</ul>
  `;
}

function renderFullSkillLb() {
  if (!fullSkillLb) return;
  fullSkillLb.innerHTML = `<p class="muted scores-soon">${t("fullskill.lbEmpty")}</p>`;
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
  const completed = isStageCompleted(stageId);
  const bossDef = getBossDefinition(stage.bossId);

  stagePanelName.textContent = `${String(stage.id).padStart(2, "0")} · ${stageName(stage)}`;
  stagePanelBoss.textContent = bossName(stage.bossId);
  stagePanelScore.textContent = record?.bestScore ? String(record.bestScore) : "—";
  if (stagePanelDifficulty) {
    stagePanelDifficulty.textContent = formatDifficulty(stage.difficultyMultiplier);
  }
  if (stagePanelReward) {
    const reward = completed ? stage.rewardReplay : stage.rewardFirstClear;
    stagePanelReward.textContent = `${reward} YS`;
  }
  if (bossPortraitIcon) {
    bossPortraitIcon.textContent = String(stage.id);
  }
  if (stagePanelAttacks) {
    stagePanelAttacks.innerHTML = getBossAttackLines(stage.bossId)
      .map((line) => `<li>${line}</li>`)
      .join("");
  }
  const portraitSlot = document.getElementById("bossPortraitSlot");
  if (portraitSlot && bossDef?.color) {
    portraitSlot.style.setProperty("--boss-glow", bossDef.color);
  }
  stagePanel.hidden = false;
}

function renderAdventureMap() {
  if (!adventurePath) return;
  adventurePath.innerHTML = "";
  STAGES.forEach((stage) => {
    const unlocked = isStageUnlocked(stage.id);
    const completed = isStageCompleted(stage.id);
    const theme = stage.theme || "forest";
    const statusKey = completed ? "completed" : unlocked ? "available" : "locked";
    const reward = completed ? stage.rewardReplay : stage.rewardFirstClear;

    const card = document.createElement("button");
    card.type = "button";
    card.className = "stage-card";
    card.classList.add(completed ? "is-completed" : unlocked ? "is-available" : "is-locked");
    card.disabled = !unlocked;
    card.innerHTML = `
      <div class="stage-card-thumb stage-theme-${theme}" aria-hidden="true"></div>
      <div class="stage-card-body">
        <span class="stage-card-num">${String(stage.id).padStart(2, "0")}</span>
        <strong>${stageName(stage)}</strong>
        <span class="stage-card-meta">${bossName(stage.bossId)}</span>
        <span class="stage-card-reward">${reward} YS</span>
        <span class="stage-card-status">${t(`adventure.${statusKey}`)}</span>
      </div>
    `;
    card.addEventListener("click", () => openStagePanel(stage.id));
    adventurePath.appendChild(card);
  });
}

function startAdventureRun(stageId) {
  void startAdventureRunAsync(stageId);
}

async function startAdventureRunAsync(stageId) {
  const stage = getStageById(stageId);
  if (!stage || !isStageUnlocked(stageId)) return;
  closeStagePanel();
  currentRunConfig = buildRunConfig(stageId);
  runSettled = false;
  lastRunResult = null;
  if (vicRankedStatus) vicRankedStatus.hidden = true;

  const ranked = await beginRankedRun(currentRunConfig);
  let seed = Date.now();
  if (ranked?.seed != null) seed = ranked.seed;

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
    seed,
    effects,
    runConfig: currentRunConfig,
    sfx,
    sound: settings.sound,
    useCanvasTouch: !stick,
    getMoveVector: stick ? () => stick.getVector() : null,
    onImpact: (style) => triggerHaptic(style),
    tBoss: () => t("boss.incoming"),
    tPortalSealed: () => t("adventure.portalSealed"),
    tPortalOpen: () => t("adventure.portalOpen"),
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

function _applyDefeat({ score, elapsedMs, canRevive, revived, kills }) {
  const stageId = currentRunConfig?.stageId;
  const stage = getStageById(stageId);
  const ysEarned = ysFromScore(score);
  if (ysEarned > 0) addYs(ysEarned);
  recordAdventureDefeat(stageId, { score, timeMs: elapsedMs, revived });
  lastRunResult = { score, elapsedMs, ysEarned, canRevive, revived, stageId, kills };
  goScore.textContent = String(score);
  goYs.textContent = String(ysEarned);
  if (goStageName && stage) goStageName.textContent = stageName(stage);
  btnRevive.hidden = !canRevive;
  void submitRankedResult({ score, elapsedMs, revived, kills }, { bossDefeated: false });
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

function _applyVictory({ score, elapsedMs, revived, stageId, stageName: sName, bossName: bName, kills }) {
  const sid = stageId ?? currentRunConfig?.stageId;
  const result = recordAdventureVictory(sid, { score, timeMs: elapsedMs, revived });
  lastRunResult = {
    score,
    elapsedMs,
    ysEarned: result.ysEarned,
    firstClear: result.firstClear,
    nextStageId: result.nextStageId,
    stageId: sid,
    kills,
    revived,
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
  void submitRankedResult({ score, elapsedMs, revived, kills }, { bossDefeated: true }).then((ranked) => {
    showRankedStatus(ranked, { revived });
  });
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
  hideUpgradeTip();
  shopList.innerHTML = "";
  UPGRADE_CATALOG.forEach(({ id }) => {
    const lv = upgradeLevel(id);
    const cost = upgradeCost(id);
    const row = document.createElement("div");
    row.className = "shop-row";
    row.innerHTML = `
      <button type="button" class="shop-row-info" data-tip-upgrade="${id}">
        <strong>${t(`upgrade.${id}`)}</strong>
        <span>${t("shop.max")} ${lv}</span>
      </button>
      <button type="button" class="btn btn-accent" data-buy="${id}">${cost} YS</button>
    `;
    shopList.appendChild(row);
  });
  shopList.querySelectorAll("[data-tip-upgrade]").forEach((el) => {
    attachUpgradeTip(el, el.dataset.tipUpgrade);
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

function renderScoresStagePicker() {
  if (!scoresStagePicker) return;
  if (scoresScope !== "global" || scoresTab !== "adventure") {
    scoresStagePicker.hidden = true;
    return;
  }
  scoresStagePicker.hidden = false;
  scoresStagePicker.innerHTML = "";
  STAGES.forEach((stage) => {
    const btn = document.createElement("button");
    btn.type = "button";
    btn.className = "btn btn-sm";
    btn.classList.toggle("is-active", stage.id === globalLbStageId);
    btn.textContent = String(stage.id);
    btn.addEventListener("click", () => {
      globalLbStageId = stage.id;
      renderScoresTab();
    });
    scoresStagePicker.appendChild(btn);
  });
}

function renderGlobalLeaderboardRows(data) {
  scoresList.innerHTML = "";
  if (!data?.entries?.length) {
    scoresList.innerHTML = `<p class="muted">${t("scores.globalEmpty")}</p>`;
    return;
  }
  if (data.myRank) {
    const mine = document.createElement("p");
    mine.className = "muted scores-my-rank";
    mine.textContent = `${t("scores.globalRank")}: #${data.myRank.rank} — ${data.myRank.score}`;
    scoresList.appendChild(mine);
  } else if (!authUser) {
    const hint = document.createElement("p");
    hint.className = "muted";
    hint.textContent = t("scores.signInGlobal");
    scoresList.appendChild(hint);
  }
  data.entries.forEach((entry) => {
    const row = document.createElement("div");
    row.className = "global-lb-row";
    if (authUser && entry.userId === authUser.id) row.classList.add("is-me");
    const rank = document.createElement("span");
    rank.className = "global-lb-rank";
    rank.textContent = `#${entry.rank}`;
    row.appendChild(rank);
    if (entry.avatarUrl) {
      const img = document.createElement("img");
      img.className = "global-lb-avatar";
      img.src = entry.avatarUrl;
      img.alt = "";
      img.width = 28;
      img.height = 28;
      img.decoding = "async";
      row.appendChild(img);
    } else {
      const ph = document.createElement("span");
      ph.className = "global-lb-avatar";
      ph.setAttribute("aria-hidden", "true");
      row.appendChild(ph);
    }
    const main = document.createElement("div");
    main.className = "global-lb-main";
    const name = document.createElement("strong");
    name.textContent = entry.displayName || "Player";
    const meta = document.createElement("span");
    meta.textContent = `${entry.score} · ${formatDurationMs(entry.durationMs)}`;
    main.appendChild(name);
    main.appendChild(meta);
    row.appendChild(main);
    scoresList.appendChild(row);
  });
}

async function renderGlobalScores() {
  scoresList.innerHTML = `<p class="muted">${t("scores.loading")}</p>`;
  renderScoresStagePicker();
  try {
    const data =
      scoresTab === "adventure"
        ? await fetchAdventureLeaderboard(globalLbStageId)
        : await fetchFullSkillLeaderboard();
    renderGlobalLeaderboardRows(data);
  } catch {
    scoresList.innerHTML = `<p class="muted">${t("scores.globalError")}</p>`;
  }
}

function renderScoresTab() {
  scoresList.innerHTML = "";
  document.querySelectorAll(".scores-tab").forEach((tab) => {
    tab.classList.toggle("is-active", tab.dataset.scoresTab === scoresTab);
  });
  document.querySelectorAll(".scores-scope").forEach((tab) => {
    tab.classList.toggle("is-active", tab.dataset.scoresScope === scoresScope);
  });

  if (scoresScope === "global") {
    void renderGlobalScores();
    return;
  }

  if (scoresStagePicker) scoresStagePicker.hidden = true;

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
  document.querySelectorAll(".scores-scope").forEach((tab) => {
    tab.addEventListener("click", () => {
      scoresScope = tab.dataset.scoresScope || "local";
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
    if (!screens.fullskill.hidden) renderPacts();
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
  bindAuth();
  bindRunControls();
  bindGameOver();
  bindScoresTabs();
  bindSettings();
  bindResize();
  refreshYs();
  showScreen("home");
  void refreshAuthUser();

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
