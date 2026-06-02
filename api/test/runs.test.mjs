import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { completeRun, startRun } from "../src/lib/runs.js";
import { compareAdventure, upsertLeaderboardRow } from "../src/lib/store.js";
import { stageBounds } from "../src/lib/stages.js";

class MemoryKv {
  constructor() {
    this.values = new Map();
  }

  async get(key, type) {
    const raw = this.values.get(key);
    if (raw == null) return null;
    return type === "json" ? JSON.parse(raw) : raw;
  }

  async put(key, value) {
    this.values.set(key, String(value));
  }

  async delete(key) {
    this.values.delete(key);
  }

  async list({ prefix = "", limit = 1000 } = {}) {
    const keys = [...this.values.keys()]
      .filter((name) => name.startsWith(prefix))
      .slice(0, limit)
      .map((name) => ({ name }));
    return { keys };
  }
}

const user = {
  id: "user-1",
  provider: "discord",
  displayName: "Runner",
  avatarUrl: "",
};

describe("ranked adventure completion", () => {
  it("accepts a boss clear at the client boss unlock minimum", async () => {
    const kv = new MemoryKv();
    const started = await startRun(kv, user, { mode: "adventure", stageId: 1 });
    assert.equal(started.ok, true);

    const bounds = stageBounds(1);
    assert.equal(bounds.minMs, 48_000);

    const completed = await completeRun(kv, user, {
      runId: started.runId,
      durationMs: bounds.minMs,
      score: 1200,
      kills: 22,
      bossDefeated: true,
      revived: false,
    });

    assert.equal(completed.ok, true);
    assert.equal(completed.ranked, true);
    assert.equal(completed.leaderboard.myRank.score, 1200);
  });

  it("still rejects impossible boss clears before the unlock minimum", async () => {
    const kv = new MemoryKv();
    const started = await startRun(kv, user, { mode: "adventure", stageId: 1 });
    const completed = await completeRun(kv, user, {
      runId: started.runId,
      durationMs: stageBounds(1).minMs - 1,
      score: 1200,
      kills: 22,
      bossDefeated: true,
      revived: false,
    });

    assert.equal(completed.error, "invalid_duration");
    assert.equal(completed.status, 400);
  });
});

describe("leaderboard upsert", () => {
  it("does not replace a player's better adventure score with a worse replay", () => {
    const rows = [
      { userId: "user-1", score: 12_000, durationMs: 95_000, updatedAt: 1 },
      { userId: "user-2", score: 10_000, durationMs: 90_000, updatedAt: 2 },
    ];
    const worseReplay = { userId: "user-1", score: 8_000, durationMs: 110_000, updatedAt: 3 };

    const next = upsertLeaderboardRow(rows, worseReplay, compareAdventure);

    assert.equal(next.find((row) => row.userId === "user-1").score, 12_000);
    assert.equal(next.length, 2);
  });

  it("replaces a player's leaderboard row when the replay ranks better", () => {
    const rows = [{ userId: "user-1", score: 12_000, durationMs: 95_000, updatedAt: 1 }];
    const betterReplay = { userId: "user-1", score: 12_000, durationMs: 90_000, updatedAt: 3 };

    const next = upsertLeaderboardRow(rows, betterReplay, compareAdventure);

    assert.equal(next.length, 1);
    assert.equal(next[0].durationMs, 90_000);
    assert.equal(next[0].updatedAt, 3);
  });
});
