const $ = (id) => document.getElementById(id);
for (const chip of document.querySelectorAll("[data-symptom]"))
  chip.addEventListener("click", () => {
    $("input").value = chip.dataset.symptom;
    $("input").focus();
  });
function paragraph(parent, text) {
  const p = document.createElement("p");
  p.textContent = text;
  parent.append(p);
}
$("symptom-form").addEventListener("submit", async (event) => {
  event.preventDefault();
  const result = $("result");
  result.replaceChildren();
  $("submit").disabled = true;
  $("submit").textContent = "확인 중…";
  try {
    const response = await fetch("/api/guide", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ symptoms: $("input").value }),
      signal: AbortSignal.timeout(10000),
    });
    const data = await response.json();
    if (!response.ok) throw new Error(data.error);
    paragraph(result, data.notice);
    if (data.emergency) {
      const a = document.createElement("a");
      a.href = "tel:119";
      a.textContent = "119에 전화하기";
      result.append(a);
    } else if (!data.matches.length)
      paragraph(
        result,
        "일치하는 안내가 없습니다. 증상이 지속되거나 걱정된다면 가정의학과 등 의료진과 상담하세요.",
      );
    for (const match of data.matches) {
      const section = document.createElement("div");
      section.className = "match";
      paragraph(section, match.department + " · " + match.topics.join(", "));
      const button = document.createElement("button");
      button.textContent = match.department + " 병원 찾기";
      button.addEventListener("click", () => {
        $("department").value = match.department;
        $("region").focus();
      });
      section.append(button);
      result.append(section);
    }
    paragraph(result, data.disclaimer);
  } catch (error) {
    paragraph(
      result,
      error.name === "TimeoutError"
        ? "응답이 늦어지고 있습니다. 잠시 후 다시 시도해 주세요."
        : error.message,
    );
  } finally {
    $("submit").disabled = false;
    $("submit").textContent = "관련 진료과 확인하기 →";
  }
});
function mapLink(label, query) {
  const a = document.createElement("a");
  a.href = "https://map.naver.com/p/search/" + encodeURIComponent(query);
  a.target = "_blank";
  a.rel = "noopener noreferrer";
  a.textContent = label;
  return a;
}
async function loadHospitals(query) {
  const result = $("hospital-result");
  result.replaceChildren();
  $("pagination").replaceChildren();
  $("hospital-submit").disabled = true;
  $("hospital-submit").textContent = "검색 중…";
  $("map-result").replaceChildren(
    mapLink(
      "네이버 지도에서 직접 검색 ↗",
      query.region + " " + query.department,
    ),
  );
  paragraph(result, "병원 정보를 불러오는 중입니다.");
  try {
    const response = await fetch(
      "/api/hospitals?" + new URLSearchParams(query),
      { signal: AbortSignal.timeout(12000) },
    );
    const data = await response.json();
    if (!response.ok) throw new Error(data.error);
    result.replaceChildren();
    paragraph(
      result,
      data.mode === "demo"
        ? "샘플 모드 · 아래 정보는 가상의 개발용 데이터입니다."
        : data.source + " · 방문 전 전화로 확인하세요.",
    );
    paragraph(
      result,
      data.total
        ? `총 ${data.total}건 · ${data.page}페이지`
        : "조건에 맞는 병원이 없습니다. 지역이나 진료과를 바꿔 보세요.",
    );
    for (const hospital of data.items) {
      const card = document.createElement("article");
      card.className = "hospital-card";
      const title = document.createElement("h3");
      title.textContent = hospital.name;
      card.append(title);
      paragraph(card, hospital.type);
      paragraph(card, hospital.address);
      if (data.mode === "live") {
        const phone = hospital.phone.replace(/[^0-9+]/g, "");
        if (phone) {
          const a = document.createElement("a");
          a.href = "tel:" + phone;
          a.textContent = hospital.phone;
          card.append(a);
        }
        card.append(
          mapLink(
            "지도에서 위치 확인 ↗",
            hospital.address + " " + hospital.name,
          ),
        );
      }
      result.append(card);
    }
    for (const [label, page] of [
      ["이전", data.page - 1],
      ["다음", data.page + 1],
    ]) {
      if (page < 1 || page > Math.ceil(data.total / data.pageSize)) continue;
      const button = document.createElement("button");
      button.textContent = label;
      button.addEventListener("click", () => loadHospitals({ ...query, page }));
      $("pagination").append(button);
    }
  } catch (error) {
    result.replaceChildren();
    paragraph(
      result,
      error.name === "TimeoutError"
        ? "검색 시간이 초과되었습니다. 다시 시도해 주세요."
        : error.message,
    );
  } finally {
    $("hospital-submit").disabled = false;
    $("hospital-submit").textContent = "병원 검색하기 →";
  }
}
$("hospital-form").addEventListener("submit", (event) => {
  event.preventDefault();
  loadHospitals({
    region: $("region").value,
    department: $("department").value,
    page: 1,
  });
});
