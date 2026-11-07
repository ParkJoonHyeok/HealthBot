import { test, before, after } from "node:test";
import assert from "node:assert/strict";
import { server } from "../src/server.js";
let base;
before(async () => {
  await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
  base = `http://127.0.0.1:${server.address().port}`;
});
after(() => new Promise((resolve) => server.close(resolve)));
const post = (body) =>
  fetch(base + "/api/guide", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
test("serves Korean homepage and security headers", async () => {
  const r = await fetch(base);
  assert.equal(r.status, 200);
  assert.match(await r.text(), /증상으로 알아보기/);
  assert.match(
    r.headers.get("content-security-policy"),
    /frame-ancestors 'none'/,
  );
});
test("symptom mapping returns department and explicit rules mode", async () => {
  const r = await post({ symptoms: "기침과 콧물이 나요" });
  const data = await r.json();
  assert.equal(r.status, 200);
  assert.equal(data.mode, "rules");
  assert.equal(data.matches[0].department, "내과");
});
test("emergency takes priority over routine symptoms", async () => {
  const data = await (
    await post({ symptoms: "기침이 나고 호흡곤란이 있어요" })
  ).json();
  assert.equal(data.emergency, true);
  assert.deepEqual(data.matches, []);
  assert.match(data.notice, /119/);
});
test("unknown symptoms produce no invented diagnosis", async () => {
  const data = await (await post({ symptoms: "불편합니다" })).json();
  assert.deepEqual(data.matches, []);
});
test("rejects invalid inputs", async () => {
  for (const body of [
    null,
    {},
    { symptoms: 3 },
    { symptoms: " " },
    { symptoms: "가".repeat(1001) },
  ])
    assert.equal((await post(body)).status, 400);
});
test("rejects malformed JSON and oversized requests", async () => {
  assert.equal(
    (
      await fetch(base + "/api/guide", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: "{",
      })
    ).status,
    400,
  );
  assert.equal((await post({ symptoms: "가".repeat(10000) })).status, 413);
});
test("does not expose arbitrary files", async () => {
  assert.equal((await fetch(base + "/package.json")).status, 404);
});
test("hospital endpoint rejects unsupported region before contacting upstream", async () => {
  const response = await fetch(base + "/api/hospitals?region=invalid");
  assert.equal(response.status, 400);
  assert.match((await response.json()).error, /지역/);
});
