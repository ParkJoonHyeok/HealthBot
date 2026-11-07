import { XMLParser, XMLValidator } from "fast-xml-parser";
import { fetch as proxyFetch, EnvHttpProxyAgent } from "undici";

export const regions = {
  서울: "110000",
  부산: "210000",
  인천: "220000",
  대구: "230000",
  광주: "240000",
  대전: "250000",
  울산: "260000",
  경기: "310000",
  강원: "320000",
  충북: "330000",
  충남: "340000",
  전북: "350000",
  전남: "360000",
  경북: "370000",
  경남: "380000",
  제주: "390000",
  세종: "410000",
};
export const departments = {
  내과: "01",
  신경과: "02",
  정형외과: "05",
  소아청소년과: "11",
  이비인후과: "13",
  피부과: "14",
  가정의학과: "23",
};
const endpoint =
  "https://apis.data.go.kr/B551182/hospInfoServicev2/getHospBasisList";
const parser = new XMLParser({
  parseTagValue: false,
  ignoreAttributes: true,
  processEntities: false,
});
const agent = new EnvHttpProxyAgent();
const failure = (status, message) =>
  Object.assign(new Error(message), { status });

export function validateSearch(params) {
  const region = params.get("region") || "서울";
  const department = params.get("department") || "내과";
  const pageText = params.get("page") || "1";
  if (
    !Object.hasOwn(regions, region) ||
    !Object.hasOwn(departments, department) ||
    !/^[1-9]\d{0,3}$/.test(pageText)
  ) {
    throw failure(400, "지역, 진료과 또는 페이지 번호를 확인해 주세요.");
  }
  return { region, department, page: Number(pageText) };
}

export function parseHospitals(xml) {
  if (/<!DOCTYPE|<!ENTITY/i.test(xml) || XMLValidator.validate(xml) !== true)
    throw failure(502, "병원 정보 응답 형식이 올바르지 않습니다.");
  const response = parser.parse(xml)?.response;
  if (!response || String(response.header?.resultCode) !== "00")
    throw failure(
      502,
      "병원 정보 제공기관에서 요청을 처리하지 못했습니다. 잠시 후 다시 시도해 주세요.",
    );
  const body = response.body;
  const total = Number(body?.totalCount);
  if (!Number.isSafeInteger(total) || total < 0)
    throw failure(502, "병원 정보 응답 형식이 올바르지 않습니다.");
  const raw = body.items?.item;
  const items = raw ? (Array.isArray(raw) ? raw : [raw]) : [];
  if (
    (total > 0 && !body.items) ||
    items.some((item) => !item.yadmNm || !item.addr)
  )
    throw failure(502, "병원 정보 응답 형식이 올바르지 않습니다.");
  return {
    total,
    items: items.map((item) => ({
      name: String(item.yadmNm),
      address: String(item.addr),
      phone: String(item.telno || ""),
      type: String(item.clCdNm || ""),
    })),
  };
}

export async function searchHospitals(
  query,
  {
    key = process.env.HOSPITAL_API_KEY,
    request = proxyFetch,
    demo = process.env.HOSPITAL_DEMO === "true",
  } = {},
) {
  if (demo) {
    const items =
      query.region === "서울" && query.department === "내과" && query.page === 1
        ? [
            {
              name: "샘플 건강의원 (가상)",
              address: "서울 샘플 주소 — 실제 병원이 아닙니다",
              phone: "",
              type: "개발용 예시",
            },
          ]
        : [];
    return {
      mode: "demo",
      source: "개발용 가상 데이터",
      page: query.page,
      pageSize: 10,
      total: query.region === "서울" && query.department === "내과" ? 1 : 0,
      items,
    };
  }
  if (!key)
    throw failure(
      503,
      "병원 정보 연동이 아직 준비되지 않았습니다. 아래 지도 검색을 이용해 주세요.",
    );
  const url = new URL(endpoint);
  url.search = new URLSearchParams({
    ServiceKey: key,
    sidoCd: regions[query.region],
    dgsbjtCd: departments[query.department],
    pageNo: String(query.page),
    numOfRows: "10",
  });
  try {
    const response = await request(url, {
      dispatcher: agent,
      signal: AbortSignal.timeout(8000),
      redirect: "error",
    });
    if (!response.ok)
      throw failure(
        502,
        "병원 정보 제공기관에 연결할 수 없습니다. 잠시 후 다시 시도해 주세요.",
      );
    const chunks = [];
    let size = 0;
    for await (const chunk of response.body) {
      size += chunk.length;
      if (size > 1024 * 1024)
        throw failure(502, "병원 정보 응답이 너무 큽니다.");
      chunks.push(Buffer.from(chunk));
    }
    return {
      ...parseHospitals(Buffer.concat(chunks).toString("utf8")),
      mode: "live",
      source: "건강보험심사평가원 병원정보서비스",
      page: query.page,
      pageSize: 10,
    };
  } catch (error) {
    if (error.status) throw error;
    throw failure(
      502,
      "병원 정보를 불러오지 못했습니다. 잠시 후 다시 시도해 주세요.",
    );
  }
}
