/** Client for YSkill Survivor API (optional auth + ranked leaderboards). */

export function getApiBase() {
  if (typeof window !== "undefined" && window.__YSKILL_SURVIVOR_API__) {
    return String(window.__YSKILL_SURVIVOR_API__).replace(/\/+$/, "");
  }
  const host = typeof location !== "undefined" ? location.hostname : "";
  if (host === "localhost" || host === "127.0.0.1") {
    return "http://localhost:8787";
  }
  if (host.endsWith(".pages.dev") || host === "yskillstudio.com" || host === "www.yskillstudio.com") {
    return "https://yskill-survivor-api.shimizudofus.workers.dev";
  }
  return "https://yskill-survivor-api.shimizudofus.workers.dev";
}

export function isApiConfigured() {
  return Boolean(getApiBase());
}

async function apiFetch(path, options = {}) {
  const headers = { Accept: "application/json", ...(options.headers || {}) };
  if (options.body && !headers["Content-Type"]) {
    headers["Content-Type"] = "application/json";
  }
  const res = await fetch(`${getApiBase()}${path}`, {
    ...options,
    credentials: "include",
    headers,
  });
  let data = null;
  try {
    data = await res.json();
  } catch {
    data = null;
  }
  if (!res.ok) {
    const err = new Error(data?.error || `HTTP ${res.status}`);
    err.status = res.status;
    err.data = data;
    throw err;
  }
  return data;
}

export function loginUrl(provider, returnTo) {
  const params = new URLSearchParams();
  if (returnTo) params.set("returnTo", returnTo);
  const q = params.toString();
  return `${getApiBase()}/v1/auth/login/${provider}${q ? `?${q}` : ""}`;
}

export async function fetchAuthMe() {
  return apiFetch("/v1/auth/me");
}

export async function logoutApi() {
  return apiFetch("/v1/auth/logout", { method: "POST" });
}

export async function startRankedRun(body) {
  return apiFetch("/v1/runs/start", {
    method: "POST",
    body: JSON.stringify(body),
  });
}

export async function completeRankedRun(body) {
  return apiFetch("/v1/runs/complete", {
    method: "POST",
    body: JSON.stringify(body),
  });
}

export async function abandonRankedRun(body) {
  return apiFetch("/v1/runs/abandon", {
    method: "POST",
    body: JSON.stringify(body),
  });
}

export async function fetchAdventureLeaderboard(stageId) {
  return apiFetch(`/v1/leaderboards/adventure?stageId=${encodeURIComponent(stageId)}`);
}

export async function fetchFullSkillLeaderboard() {
  return apiFetch("/v1/leaderboards/fullskill");
}
