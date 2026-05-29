import assert from "node:assert/strict";
import test from "node:test";

import { abandonRun, completeRun, startRun } from "../src/lib/runs.js";

class MemoryKV {
  constructor() {
    this.values = new Map();
  }

  async get(key, type) {
    const value = this.values.get(key);
    if (value === undefined) return null;
    return type === "json" ? JSON.parse(value) : value;
  }

  async put(key, value) {
    this.values.set(key, value);
  }

  async delete(key) {
    this.values.delete(key);
  }

  async list({ prefix = "", limit = 1000 } = {}) {
    const keys = [...this.values.keys()]
      .filter((name) => name.startsWith(prefix))
      .sort()
      .slice(0, limit)
      .map((name) => ({ name }));
    return { keys };
  }
}

const user = {
  id: "user-1",
  provider: "google",
  displayName: "Player One",
  avatarUrl: "",
};

test("abandonRun clears the active run gate", async () => {
  const kv = new MemoryKV();

  const started = await startRun(kv, user, { mode: "adventure", stageId: 1 });
  assert.equal(started.ok, true);

  const blocked = await startRun(kv, user, { mode: "adventure", stageId: 1 });
  assert.equal(blocked.error, "run_active");
  assert.equal(blocked.status, 409);

  const abandoned = await abandonRun(kv, user, { runId: started.runId });
  assert.deepEqual(abandoned, { ok: true, abandoned: true });

  const stored = await kv.get(`run:${started.runId}`, "json");
  assert.equal(stored.status, "abandoned");
  assert.equal(await kv.get(`run:active:${user.id}:${started.runId}`), null);

  const next = await startRun(kv, user, { mode: "adventure", stageId: 1 });
  assert.equal(next.ok, true);
  assert.notEqual(next.runId, started.runId);
});

test("abandonRun cannot close another user's run", async () => {
  const kv = new MemoryKV();
  const started = await startRun(kv, user, { mode: "adventure", stageId: 1 });

  const otherUser = { ...user, id: "user-2" };
  const result = await abandonRun(kv, otherUser, { runId: started.runId });
  assert.equal(result.error, "run_not_found");
  assert.equal(result.status, 404);

  const stored = await kv.get(`run:${started.runId}`, "json");
  assert.equal(stored.status, "active");
  assert.equal(await kv.get(`run:active:${user.id}:${started.runId}`), "1");
});

test("abandonRun is idempotent for already completed runs", async () => {
  const kv = new MemoryKV();
  const started = await startRun(kv, user, { mode: "adventure", stageId: 1 });
  const completed = await completeRun(kv, user, {
    runId: started.runId,
    score: 100,
    durationMs: 1000,
    kills: 2,
    bossDefeated: false,
    revived: false,
  });
  assert.equal(completed.ok, true);

  const abandoned = await abandonRun(kv, user, { runId: started.runId });
  assert.deepEqual(abandoned, { ok: true, abandoned: false, status: "completed" });
});
