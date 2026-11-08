import { test } from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { guide } from "../src/guide.js";
test("Node preserves the shared migration contract (including documented keyword limitations)", async () => {
  const cases = JSON.parse(
    await readFile(new URL("../contracts/guide.json", import.meta.url), "utf8"),
  );
  for (const fixture of cases)
    assert.deepEqual(guide(fixture.symptoms), fixture.result, fixture.symptoms);
});
