import { departments } from "./hospitals.js";
// This validates a future provider's structure, not medical truth or safety.
export function validateAiResponse(value) {
  const invalid = () => {
    throw new TypeError("AI 응답 형식이 올바르지 않습니다.");
  };
  const exact = (object, keys) =>
    object &&
    typeof object === "object" &&
    !Array.isArray(object) &&
    Object.keys(object).length === keys.length &&
    keys.every((key) => Object.hasOwn(object, key));
  const text = (v, max) =>
    typeof v === "string" && v.trim().length > 0 && v.length <= max;
  if (
    !exact(value, ["schemaVersion", "urgency", "summary", "recommendations"]) ||
    value.schemaVersion !== 1 ||
    !["emergency", "consult", "uncertain"].includes(value.urgency) ||
    !text(value.summary, 500) ||
    !Array.isArray(value.recommendations) ||
    value.recommendations.length > 3
  )
    invalid();
  if (value.urgency === "emergency" && value.recommendations.length !== 0)
    invalid();
  if (value.urgency === "consult" && value.recommendations.length === 0)
    invalid();
  const seen = new Set();
  for (const item of value.recommendations) {
    if (
      !exact(item, ["department", "reason"]) ||
      !Object.hasOwn(departments, item.department) ||
      !text(item.reason, 300) ||
      seen.has(item.department)
    )
      invalid();
    seen.add(item.department);
  }
  return {
    schemaVersion: 1,
    urgency: value.urgency,
    summary: value.summary,
    recommendations: value.recommendations.map((item) => ({ ...item })),
  };
}
