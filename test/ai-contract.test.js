import { test } from "node:test";
import assert from "node:assert/strict";
import { validateAiResponse } from "../src/ai-contract.js";
const valid = () => ({
  schemaVersion: 1,
  urgency: "consult",
  summary: "의료진 상담을 고려하세요.",
  recommendations: [
    { department: "내과", reason: "증상에 관한 상담이 필요합니다." },
  ],
});
test("accepts bounded response and copies provider objects", () => {
  const input = valid();
  const output = validateAiResponse(input);
  assert.deepEqual(output, input);
  assert.notEqual(output.recommendations[0], input.recommendations[0]);
});
test("emergency output cannot recommend routine departments", () => {
  assert.throws(() => validateAiResponse({ ...valid(), urgency: "emergency" }));
  assert.equal(
    validateAiResponse({
      ...valid(),
      urgency: "emergency",
      recommendations: [],
    }).urgency,
    "emergency",
  );
});
test("rejects unknown fields, departments, oversized output and invalid shapes", () => {
  for (const input of [
    null,
    [],
    { ...valid(), diagnosis: "확정" },
    { ...valid(), summary: "a".repeat(501) },
    { ...valid(), urgency: "safe" },
    { ...valid(), recommendations: [] },
    {
      ...valid(),
      recommendations: [{ department: "constructor", reason: "test" }],
    },
    {
      ...valid(),
      recommendations: [...valid().recommendations, ...valid().recommendations],
    },
  ])
    assert.throws(() => validateAiResponse(input), TypeError);
});
