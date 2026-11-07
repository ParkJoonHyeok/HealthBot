import http from "node:http";
import { readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { createRateLimiter } from "./rate-limit.js";
import { guide } from "./guide.js";
import { searchHospitals, validateSearch } from "./hospitals.js";
const assets = {
  "/": ["index.html", "text/html; charset=utf-8"],
  "/app.js": ["app.js", "text/javascript; charset=utf-8"],
  "/style.css": ["style.css", "text/css; charset=utf-8"],
};
export function createServer({ consume = createRateLimiter() } = {}) {
  return http.createServer(async (req, res) => {
    res.setHeader("X-Content-Type-Options", "nosniff");
    res.setHeader("Referrer-Policy", "no-referrer");
    res.setHeader("Cache-Control", "no-store");
    res.setHeader(
      "Content-Security-Policy",
      "default-src 'self'; script-src 'self'; style-src 'self'; base-uri 'none'; frame-ancestors 'none'; form-action 'self'",
    );
    const json = (status, data) => {
      res.writeHead(status, {
        "Content-Type": "application/json; charset=utf-8",
      });
      res.end(JSON.stringify(data));
    };
    try {
      const url = new URL(req.url, "http://localhost");
      const path = url.pathname;
      if (
        (path === "/api/hospitals" && req.method === "GET") ||
        (path === "/api/guide" && req.method === "POST")
      ) {
        const quota = consume(
          `${req.socket.remoteAddress || "unknown"}:${path}`,
        );
        if (!quota.allowed) {
          res.setHeader("Retry-After", String(quota.retryAfter));
          return json(429, {
            error: `요청이 많습니다. ${quota.retryAfter}초 후 다시 시도해 주세요.`,
            retryAfter: quota.retryAfter,
          });
        }
      }
      if (path === "/api/hospitals" && req.method === "GET")
        return json(
          200,
          await searchHospitals(validateSearch(url.searchParams)),
        );
      if (path === "/api/health" && req.method === "GET")
        return json(200, { status: "ok" });
      if (path === "/api/guide" && req.method === "POST") {
        if (!req.headers["content-type"]?.startsWith("application/json"))
          return json(415, { error: "JSON 요청이 필요합니다." });
        const chunks = [];
        let bytes = 0;
        for await (const chunk of req) {
          bytes += chunk.length;
          if (bytes > 8192)
            return json(413, { error: "입력 용량을 초과했습니다." });
          chunks.push(chunk);
        }
        let data;
        try {
          data = JSON.parse(Buffer.concat(chunks).toString("utf8"));
        } catch {
          return json(400, { error: "유효한 JSON이 필요합니다." });
        }
        return json(200, guide(data?.symptoms));
      }
      if (req.method === "GET" && Object.hasOwn(assets, path)) {
        const [name, type] = assets[path];
        const content = await readFile(
          new URL("../public/" + name, import.meta.url),
        );
        res.writeHead(200, { "Content-Type": type });
        return res.end(content);
      }
      json(404, { error: "요청한 경로를 찾을 수 없습니다." });
    } catch (error) {
      json(error.status || 500, {
        error: error.status
          ? error.message
          : "요청 처리 중 문제가 발생했습니다.",
      });
    }
  });
}
export const server = createServer();
if (process.argv[1] === fileURLToPath(import.meta.url))
  server.listen(Number(process.env.PORT || 3000), "0.0.0.0", () =>
    console.log("HealBot server started"),
  );
