/** Capacitor hooks, haptics, lifecycle — safe on web (no bundler required). */

let listenersBound = false;

export function isNativeApp() {
  return Boolean(window.Capacitor?.isNativePlatform?.());
}

export function isCoarsePointer() {
  return (
    window.matchMedia("(pointer: coarse)").matches ||
    window.matchMedia("(hover: none)").matches
  );
}

function plugin(name) {
  return window.Capacitor?.Plugins?.[name] ?? null;
}

/**
 * @param {"light"|"medium"|"heavy"} style
 */
export async function hapticImpact(style = "light") {
  const Haptics = plugin("Haptics");
  if (!Haptics?.impact) return;
  try {
    await Haptics.impact({ style });
  } catch {
    /* ignored */
  }
}

export async function hapticNotification(type = "SUCCESS") {
  const Haptics = plugin("Haptics");
  if (!Haptics?.notification) return;
  try {
    await Haptics.notification({ type });
  } catch {
    /* ignored */
  }
}

/**
 * @param {{ onPause?: () => void, onBack?: () => boolean|void }} handlers
 */
export async function initPlatform(handlers = {}) {
  document.addEventListener("visibilitychange", () => {
    if (document.hidden) handlers.onPause?.();
  });
  window.addEventListener("pagehide", () => handlers.onPause?.());

  if (!isNativeApp()) return;

  const App = plugin("App");
  if (App?.addListener && !listenersBound) {
    listenersBound = true;
    await App.addListener("appStateChange", ({ isActive }) => {
      if (!isActive) handlers.onPause?.();
    });
    await App.addListener("backButton", () => {
      handlers.onBack?.();
    });
  }

  await configureNativeChrome();
}

/** Block pull-to-refresh / overscroll during gameplay */
export function lockDocumentScroll(lock) {
  document.documentElement.classList.toggle("scroll-locked", lock);
  document.body.classList.toggle("scroll-locked", lock);
}

export async function configureNativeChrome() {
  if (!isNativeApp()) return;
  const StatusBar = plugin("StatusBar");
  if (!StatusBar) return;
  try {
    if (StatusBar.setStyle) await StatusBar.setStyle({ style: "DARK" });
    if (StatusBar.setBackgroundColor) {
      await StatusBar.setBackgroundColor({ color: "#0c0f14" });
    }
  } catch {
    /* optional */
  }
}
