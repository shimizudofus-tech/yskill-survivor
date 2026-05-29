import {
  FULL_SKILL_MAX_MS,
  FULL_SKILL_MAX_SCORE,
  PACT_IDS,
  RUN_EXPIRY_MS,
  STAGE_IDS,
  getStage,
  stageBounds,
} from "./stages.js";
import {
  compareAdventure,
  compareFullSkill,
  getLeaderboard,
  getRun,
  publicUser,
  putLeaderboard,
  putRun,
  rankRows,
  upsertLeaderboardRow,
} from "./store.js";

function randomHex(byteCount) {
  const bytes = new Uint8Array(byteCount);
  crypto.getRandomValues(bytes);
  return Array.from(bytes, (byte) => byte.toString(16).padStart(2, "0")).join("");
}

function randomUInt32() {
  const bytes = new Uint8Array(4);
  crypto.getRandomValues(bytes);
  return ((bytes[0] << 24) | (bytes[1] << 16) | (bytes[2] << 8) | bytes[3]) >>> 0;
}

async function activeRunForUser(kv, userId) {
  const prefix = `run:active:${userId}:`;
  const listed = await kv.list({ prefix, limit: 1 });
  if (!listed.keys.length) return null;
  const runId = listed.keys[0].name.slice(prefix.length);
  const run = await getRun(kv, runId);
  if (!run || run.status !== "active") return null;
  if (Date.now() - run.startedAt > RUN_EXPIRY_MS) {
    run.status = "expired";
    await putRun(kv, run);
    await kv.delete(listed.keys[0].name);
    return null;
  }
  return run;
}

export async function startRun(kv, user, body) {
  const mode = String(body?.mode || "").trim();
  const stageId = Math.floor(Number(body?.stageId) || 0);
  const pactId = String(body?.pactId || "").trim();

  if (mode !== "adventure" && mode !== "fullskill") {
    return { error: "invalid_mode", status: 400 };
  }
  if (mode === "adventure" && !STAGE_IDS.includes(stageId)) {
    return { error: "invalid_stage", status: 400 };
  }
  if (mode === "fullskill" && pactId && !PACT_IDS.includes(pactId)) {
    return { error: "invalid_pact", status: 400 };
  }

  const existing = await activeRunForUser(kv, user.id);
  if (existing) {
    return {
      error: "run_active",
      status: 409,
      runId: existing.id,
      seed: existing.seed,
      mode: existing.mode,
      stageId: existing.stageId ?? null,
      pactId: existing.pactId ?? null,
    };
  }

  const runId = randomHex(12);
  const seed = randomUInt32();
  const now = Date.now();
  const run = {
    id: runId,
    userId: user.id,
    mode,
    stageId: mode === "adventure" ? stageId : null,
    pactId: mode === "fullskill" ? pactId || null : null,
    seed,
    startedAt: now,
    status: "active",
    updatedAt: now,
  };

  await putRun(kv, run);
  await kv.put(`run:active:${user.id}:${runId}`, "1", { expirationTtl: Math.ceil(RUN_EXPIRY_MS / 1000) + 60 });

  return {
    ok: true,
    runId,
    seed,
    mode,
    stageId: run.stageId,
    pactId: run.pactId,
    expiresAt: now + RUN_EXPIRY_MS,
  };
}

function validateCompletePayload(run, body) {
  const durationMs = Math.floor(Number(body?.durationMs) || 0);
  const score = Math.floor(Number(body?.score) || 0);
  const kills = Math.floor(Number(body?.kills) || 0);
  const bossDefeated = Boolean(body?.bossDefeated);
  const revived = Boolean(body?.revived);

  if (durationMs < 0) return { error: "invalid_duration", status: 400 };
  if (score < 0 || kills < 0) return { error: "invalid_score", status: 400 };

  if (run.mode === "adventure") {
    const bounds = stageBounds(run.stageId);
    if (!bounds) return { error: "invalid_stage", status: 400 };
    if (durationMs > bounds.maxMs + 5000) return { error: "invalid_duration", status: 400 };
    if (bossDefeated && durationMs < bounds.minMs) return { error: "invalid_duration", status: 400 };
    if (score > bounds.maxScore) return { error: "invalid_score", status: 400 };
  }

  if (run.mode === "fullskill") {
    if (durationMs > FULL_SKILL_MAX_MS + 5000) return { error: "invalid_duration", status: 400 };
    if (score > FULL_SKILL_MAX_SCORE) return { error: "invalid_score", status: 400 };
  }

  const ranked = bossDefeated && !revived && (run.mode === "fullskill" || run.mode === "adventure");

  return {
    durationMs,
    score,
    kills,
    bossDefeated,
    revived,
    ranked,
  };
}

export async function completeRun(kv, user, body) {
  const runId = String(body?.runId || "").trim();
  if (!runId) return { error: "run_not_found", status: 404 };

  const run = await getRun(kv, runId);
  if (!run || run.userId !== user.id) return { error: "run_not_found", status: 404 };
  if (run.status !== "active") return { error: "run_closed", status: 409 };
  if (Date.now() - run.startedAt > RUN_EXPIRY_MS) {
    run.status = "expired";
    await putRun(kv, run);
    return { error: "run_expired", status: 409 };
  }

  const validated = validateCompletePayload(run, body);
  if (validated.error) return validated;

  const now = Date.now();
  run.status = "completed";
  run.completedAt = now;
  run.updatedAt = now;
  run.result = {
    score: validated.score,
    durationMs: validated.durationMs,
    kills: validated.kills,
    bossDefeated: validated.bossDefeated,
    revived: validated.revived,
    ranked: validated.ranked,
  };
  await putRun(kv, run);
  await kv.delete(`run:active:${user.id}:${runId}`);

  let leaderboard = null;
  if (validated.ranked) {
    leaderboard = await applyLeaderboard(kv, user, run, validated, now);
  }

  return {
    ok: true,
    ranked: validated.ranked,
    leaderboard,
    user: publicUser(user),
  };
}

export async function abandonRun(kv, user, body) {
  const runId = String(body?.runId || "").trim();
  const run = runId ? await getRun(kv, runId) : await activeRunForUser(kv, user.id);
  if (!run || run.userId !== user.id) return { error: "run_not_found", status: 404 };

  if (run.status !== "active") {
    return {
      ok: true,
      abandoned: false,
      status: run.status,
    };
  }

  const now = Date.now();
  run.status = "abandoned";
  run.updatedAt = now;
  await putRun(kv, run);
  await kv.delete(`run:active:${user.id}:${run.id}`);

  return {
    ok: true,
    abandoned: true,
  };
}

async function applyLeaderboard(kv, user, run, validated, now) {
  const entry = {
    userId: user.id,
    displayName: user.displayName,
    avatarUrl: user.avatarUrl || "",
    score: validated.score,
    durationMs: validated.durationMs,
    updatedAt: now,
    stageId: run.stageId,
    pactId: run.pactId,
  };

  if (run.mode === "adventure") {
    const rows = await getLeaderboard(kv, "adventure", run.stageId);
    const next = upsertLeaderboardRow(rows, entry, compareAdventure);
    await putLeaderboard(kv, "adventure", run.stageId, next);
    return rankRows(next, user.id);
  }

  const rows = await getLeaderboard(kv, "fullskill");
  const next = upsertLeaderboardRow(rows, entry, compareFullSkill);
  await putLeaderboard(kv, "fullskill", null, next);
  return rankRows(next, user.id);
}

export async function fetchLeaderboard(kv, mode, stageId, userId) {
  if (mode === "adventure") {
    const sid = Math.floor(Number(stageId) || 0);
    if (!STAGE_IDS.includes(sid)) return { error: "invalid_stage", status: 400 };
    const rows = await getLeaderboard(kv, "adventure", sid);
    return { ok: true, mode, stageId: sid, ...rankRows(rows, userId) };
  }
  if (mode === "fullskill") {
    const rows = await getLeaderboard(kv, "fullskill");
    return { ok: true, mode, stageId: null, ...rankRows(rows, userId) };
  }
  return { error: "invalid_mode", status: 400 };
}

export function publicConfig() {
  return {
    modes: ["adventure", "fullskill"],
    stages: STAGE_IDS,
    pacts: PACT_IDS,
    runExpiryMs: RUN_EXPIRY_MS,
    leaderboardLimit: 50,
  };
}
