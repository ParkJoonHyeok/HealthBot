import { test, expect } from "@playwright/test";
test("symptoms to department and sample hospital, without page overflow", async ({
  page,
}) => {
  await page.goto("/");
  await page.getByRole("button", { name: "기침·콧물" }).click();
  await page.getByRole("button", { name: "관련 진료과 확인하기" }).click();
  await expect(page.locator("#result")).toContainText(
    "AI 분석이나 의학적 진단이 아닙니다",
  );
  await page.getByRole("button", { name: "내과 병원 찾기" }).click();
  await expect(page.locator("#department")).toHaveValue("내과");
  await page.getByRole("button", { name: "병원 검색하기" }).click();
  await expect(page.locator("#hospital-result")).toContainText("샘플 모드");
  await expect(page.locator("#hospital-result")).toContainText("샘플 건강의원");
  await expect(page.locator("#hospital-result a")).toHaveCount(0);
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true);
});
test("emergency advice, empty hospital search and map fallback", async ({
  page,
}) => {
  await page.goto("/");
  await page.locator("#input").fill("호흡곤란이 있어요");
  await page.getByRole("button", { name: "관련 진료과 확인하기" }).click();
  await expect(
    page.getByRole("link", { name: "119에 전화하기" }),
  ).toHaveAttribute("href", "tel:119");
  await page.locator("#region").selectOption("부산");
  await page.getByRole("button", { name: "병원 검색하기" }).click();
  await expect(page.locator("#hospital-result")).toContainText(
    "조건에 맞는 병원이 없습니다",
  );
  await expect(page.locator("#map-result a")).toHaveAttribute(
    "href",
    /map.naver.com/,
  );
});
test("provider failure remains recoverable", async ({ page }) => {
  await page.route("**/api/hospitals?*", (route) =>
    route.fulfill({
      status: 503,
      contentType: "application/json",
      body: JSON.stringify({
        error: "병원 정보 연동이 아직 준비되지 않았습니다.",
      }),
    }),
  );
  await page.goto("/");
  await page.getByRole("button", { name: "병원 검색하기" }).click();
  await expect(page.locator("#hospital-result")).toContainText("연동이 아직");
  await expect(
    page.getByRole("button", { name: "병원 검색하기" }),
  ).toBeEnabled();
  await expect(page.locator("#map-result a")).toBeVisible();
});
test("pagination keeps submitted filters and renders provider text safely", async ({
  page,
}) => {
  const requested = [];
  await page.route("**/api/hospitals?*", async (route) => {
    const url = new URL(route.request().url());
    requested.push(url.searchParams);
    const current = Number(url.searchParams.get("page"));
    await route.fulfill({
      contentType: "application/json",
      body: JSON.stringify({
        mode: "live",
        source: "테스트 응답",
        total: 11,
        page: current,
        pageSize: 10,
        items: [
          {
            name: "<img src=x onerror=alert(1)>",
            address: "테스트 주소",
            phone: "02-123-4567",
            type: "의원",
          },
        ],
      }),
    });
  });
  await page.goto("/");
  await page.getByRole("button", { name: "병원 검색하기" }).click();
  await expect(page.locator("#hospital-result h3")).toHaveText(
    "<img src=x onerror=alert(1)>",
  );
  await expect(page.locator("#hospital-result img")).toHaveCount(0);
  await page.locator("#region").selectOption("부산");
  await page.getByRole("button", { name: "다음", exact: true }).click();
  await expect(page.locator("#hospital-result")).toContainText("2페이지");
  expect(requested[1].get("region")).toBe("서울");
  await expect(
    page.getByRole("button", { name: "다음", exact: true }),
  ).toHaveCount(0);
  await expect(
    page.getByRole("button", { name: "이전", exact: true }),
  ).toBeVisible();
});
test("rate-limit message preserves emergency guidance and hospital map fallback", async ({
  page,
}) => {
  await page.route("**/api/guide", (route) =>
    route.fulfill({
      status: 429,
      contentType: "application/json",
      headers: { "Retry-After": "30" },
      body: JSON.stringify({
        error: "요청이 많습니다. 30초 후 다시 시도해 주세요.",
        retryAfter: 30,
      }),
    }),
  );
  await page.route("**/api/hospitals?*", (route) =>
    route.fulfill({
      status: 429,
      contentType: "application/json",
      body: JSON.stringify({
        error: "요청이 많습니다. 30초 후 다시 시도해 주세요.",
      }),
    }),
  );
  await page.goto("/");
  await page.locator("#input").fill("기침");
  await page.getByRole("button", { name: "관련 진료과 확인하기" }).click();
  await expect(page.locator("#result")).toContainText("30초 후");
  await expect(page.locator(".warning")).toContainText("119");
  await page.getByRole("button", { name: "병원 검색하기" }).click();
  await expect(page.locator("#hospital-result")).toContainText("30초 후");
  await expect(page.locator("#map-result a")).toBeVisible();
  await expect(
    page.getByRole("button", { name: "병원 검색하기" }),
  ).toBeEnabled();
});
