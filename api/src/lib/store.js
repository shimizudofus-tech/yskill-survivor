export function publicUser(user) {
  if (!user) return null;
  return {
    id: user.id,
    provider: user.provider,
    displayName: user.displayName,
    avatarUrl: user.avatarUrl || "",
  };
}

export async function getUser(kv, userId) {
  if (!userId) return null;
  const raw = await kv.get(`user:${userId}`, "json");
  return raw || null;
}

export async function putUser(kv, user) {
  await kv.put(`user:${user.id}`, JSON.stringify(user));
  return user;
}

export async function getRun(kv, runId) {
  if (!runId) return null;
  return (await kv.get(`run:${runId}`, "json")) || null;
}

export async function putRun(kv, run) {
  await kv.put(`run:${run.id}`, JSON.stringify(run), {
    expirationTtl: Math.ceil(RUN_TTL_SECONDS),
  });
  return run;
}

const RUN_TTL_SECONDS = 60 * 60 * 24;

export function leaderboardKey(mode, stageId = null) {
  if (mode === "adventure") return `lb:adventure:stage:${stageId}`;
  if (mode === "fullskill") return "lb:fullskill:global";
  throw new Error("Unknown leaderboard mode");
}

export async function getLeaderboard(kv, mode, stageId = null) {
  const key = leaderboardKey(mode, stageId);
  const rows = (await kv.get(key, "json")) || [];
  return Array.isArray(rows) ? rows : [];
}

export async function putLeaderboard(kv, mode, stageId, rows) {
  const key = leaderboardKey(mode, stageId);
  await kv.put(key, JSON.stringify(rows));
}

export function upsertLeaderboardRow(rows, entry, compareFn) {
  const existing = rows.find((r) => r.userId === entry.userId);
  if (existing && compareFn(existing, entry) <= 0) {
    return rows.slice().sort(compareFn).slice(0, 50);
  }
  const next = rows.filter((r) => r.userId !== entry.userId);
  next.push(entry);
  next.sort(compareFn);
  return next.slice(0, 50);
}

export function compareAdventure(a, b) {
  const scoreDiff = (b.score || 0) - (a.score || 0);
  if (scoreDiff !== 0) return scoreDiff;
  const timeDiff = (a.durationMs || 0) - (b.durationMs || 0);
  if (timeDiff !== 0) return timeDiff;
  return (a.updatedAt || 0) - (b.updatedAt || 0);
}

export function compareFullSkill(a, b) {
  const scoreDiff = (b.score || 0) - (a.score || 0);
  if (scoreDiff !== 0) return scoreDiff;
  const timeDiff = (a.durationMs || 0) - (b.durationMs || 0);
  if (timeDiff !== 0) return timeDiff;
  return (a.updatedAt || 0) - (b.updatedAt || 0);
}

export function rankRows(rows, userId) {
  const entries = rows.map((row, index) => ({
    rank: index + 1,
    userId: row.userId,
    displayName: row.displayName,
    avatarUrl: row.avatarUrl || "",
    score: row.score,
    durationMs: row.durationMs,
    stageId: row.stageId ?? null,
    pactId: row.pactId ?? null,
    updatedAt: row.updatedAt,
  }));
  let myRank = null;
  if (userId) {
    const idx = rows.findIndex((r) => r.userId === userId);
    if (idx >= 0) {
      myRank = {
        rank: idx + 1,
        score: rows[idx].score,
        durationMs: rows[idx].durationMs,
      };
    }
  }
  return { entries, myRank, totalPlayers: rows.length };
}
