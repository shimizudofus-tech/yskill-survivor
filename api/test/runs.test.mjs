import test from "node:test";
import assert from "node:assert/strict";

import { completeRun, startRun } from "../src/lib/runs.js";
import { stageBounds } from "../src/lib/stages.js";

class MemoryKv {
  constructor() {
    this.values = new Map();
  }

  async get(key, type) {
    const value = this.values.get(key);
    if (value == null) return null;
    if (type === "json") return JSON.parse(value);
    return value;
  }

  async put(key, value) {
    this.values.set(key, value);
  }

  async delete(key) {
    this.values.delete(key);
  }

  async list({ prefix, limit } = {}) {
    const keys = [];
    for (const name of this.values.keys()) {
      if (!prefix || name.startsWith(prefix)) {
        keys.push({ name });
        if (limit && keys.length >= limit) break;
      }
    }
    return { keys };
  }
}

const user = {
  id: "user-1",
  provider: "discord",
  displayName: "Lyra",
  avatarUrl: "",
};

test("adventure stage bounds accept the client boss-unlock completion window", () => {
  assert.equal(stageBounds(1).minMs, 48_000);
  assert.equal(stageBounds(2).minMs, 59_000);
  assert.equal(stageBounds(5).minMs, 83_000);
});

test("ranked adventure completion accepts a legitimate fast stage 1 boss kill", async () => {
  const kv = new MemoryKv();
  const started = await startRun(kv, user, { mode: "adventure", stageId: 1 });

  assert.equal(started.ok, true);

  const completed = await completeRun(kv, user, {
    runId: started.runId,
    score: 1_200,
    durationMs: 50_000,
    kills: 24,
    bossDefeated: true,
    revived: false,
  });

  assert.equal(completed.ok, true);
  assert.equal(completed.ranked, true);
  assert.equal(completed.leaderboard.myRank.rank, 1);
});

test("ranked adventure completion still rejects impossible boss kills", async () => {
  const kv = new MemoryKv();
  const started = await startRun(kv, user, { mode: "adventure", stageId: 1 });

  const completed = await completeRun(kv, user, {
    runId: started.runId,
    score: 1_200,
    durationMs: 47_000,
    kills: 24,
    bossDefeated: true,
    revived: false,
  });

  assert.equal(completed.error, "invalid_duration");
  assert.equal(completed.status, 400);
});
