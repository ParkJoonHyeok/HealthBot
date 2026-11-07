import { test } from "node:test";
import assert from "node:assert/strict";
import {
  parseHospitals,
  searchHospitals,
  validateSearch,
} from "../src/hospitals.js";
const xml =
  "<response><header><resultCode>00</resultCode></header><body><totalCount>1</totalCount><items><item><yadmNm>테스트의원</yadmNm><addr>서울 테스트</addr><telno>02-123-4567</telno></item></items></body></response>";
const query = { region: "서울", department: "내과", page: 1 };
test("maps single XML item and preserves telephone leading zero", () => {
  assert.equal(parseHospitals(xml).items[0].phone, "02-123-4567");
  assert.equal(parseHospitals(xml).total, 1);
});
test("validates search fields including inherited property names", () => {
  for (const q of [
    "region=없는지역",
    "department=응급실",
    "page=0",
    "page=1x",
    "page=10000",
    "region=constructor",
  ])
    assert.throws(() => validateSearch(new URLSearchParams(q)), {
      status: 400,
    });
});
test("rejects error envelopes and entity declarations", () => {
  for (const x of [
    "<html>error</html>",
    xml.replace("00", "30"),
    "<!DOCTYPE x>" + xml,
  ])
    assert.throws(() => parseHospitals(x), { status: 502 });
});
test("empty result is valid", () =>
  assert.deepEqual(
    parseHospitals(
      "<response><header><resultCode>00</resultCode></header><body><totalCount>0</totalCount><items/></body></response>",
    ),
    { total: 0, items: [] },
  ));
test("missing key is unavailable rather than silently serving sample hospitals", async () => {
  await assert.rejects(searchHospitals(query, { key: "", demo: false }), {
    status: 503,
  });
});
test("builds provider query and normalizes response", async () => {
  const result = await searchHospitals(query, {
    demo: false,
    key: "test+key=",
    request: async (url) => {
      assert.equal(url.hostname, "apis.data.go.kr");
      assert.equal(url.searchParams.get("ServiceKey"), "test+key=");
      assert.equal(url.searchParams.get("sidoCd"), "110000");
      assert.equal(url.searchParams.get("dgsbjtCd"), "01");
      return new Response(xml);
    },
  });
  assert.equal(result.mode, "live");
  assert.equal(result.items[0].name, "테스트의원");
});
test("upstream errors do not expose key or request details", async () => {
  await assert.rejects(
    searchHospitals(query, {
      demo: false,
      key: "secret",
      request: async () => {
        throw new Error("secret URL");
      },
    }),
    (error) => error.status === 502 && !error.message.includes("secret"),
  );
});
test("demo is explicit and filters results", async () => {
  const data = await searchHospitals(query, { demo: true });
  assert.equal(data.mode, "demo");
  assert.equal(data.items.length, 1);
  assert.equal(
    (await searchHospitals({ ...query, region: "부산" }, { demo: true })).total,
    0,
  );
});
