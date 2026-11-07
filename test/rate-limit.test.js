import { test } from "node:test";
import assert from "node:assert/strict";
import { createRateLimiter } from "../src/rate-limit.js";
import { createServer } from "../src/server.js";
test("allows exact quota, isolates keys, and recovers at window boundary", () => {
  let time = 0;
  const consume = createRateLimiter({
    limit: 2,
    windowMs: 1000,
    now: () => time,
  });
  assert.equal(consume("a").allowed, true);
  assert.equal(consume("a").allowed, true);
  assert.deepEqual(consume("a"), { allowed: false, retryAfter: 1 });
  assert.equal(consume("b").allowed, true);
  time = 1000;
  assert.equal(consume("a").allowed, true);
});
test("bounded storage does not reset active quotas and reclaims expired entries", () => {
  let time = 0;
  const consume = createRateLimiter({
    limit: 1,
    windowMs: 1000,
    maxEntries: 1,
    now: () => time,
  });
  consume("a");
  assert.equal(consume("b").allowed, false);
  assert.equal(consume("a").allowed, false);
  time = 1000;
  assert.equal(consume("b").allowed, true);
});
test("HTTP limit cannot be bypassed by forwarded headers, leaves health and static pages accessible", async () => {
  const server = createServer({ consume: createRateLimiter({ limit: 1 }) });
  await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
  const base = `http://127.0.0.1:${server.address().port}`;
  try {
    const request = (ip) =>
      fetch(base + "/api/guide", {
        method: "POST",
        headers: { "Content-Type": "application/json", "X-Forwarded-For": ip },
        body: JSON.stringify({ symptoms: "기침" }),
      });
    assert.equal((await request("1.1.1.1")).status, 200);
    const blocked = await request("2.2.2.2");
    assert.equal(blocked.status, 429);
    assert.equal(Number(blocked.headers.get("retry-after")) > 0, true);
    assert.match((await blocked.json()).error, /다시 시도/);
    assert.equal((await fetch(base + "/api/health")).status, 200);
    assert.equal((await fetch(base)).status, 200);
    // Another route gets its own quota; malformed queries still count.
    assert.equal(
      (await fetch(base + "/api/hospitals?region=invalid")).status,
      400,
    );
    assert.equal(
      (await fetch(base + "/api/hospitals?region=invalid")).status,
      429,
    );
  } finally {
    await new Promise((resolve) => server.close(resolve));
  }
});
