import assert from "node:assert/strict";

export async function verifyRoutes(base, { admin, partner, projectId }) {
  const publicPaths = [
    "/", "/market", "/developers", "/countries", "/locations", "/guide", "/privacy", "/login",
    "/methodology", "/quick-assessment", "/registry", "/registry/login", "/services", "/design-system",
    "/protection", "/protection/contact", "/protection/how-it-works", "/protection/problems",
    "/protection/representative", "/offline-map/app", "/robots.txt", "/sitemap.xml",
    "/project/e2e-sales-test-999",
  ];
  const adminPaths = [
    "/admin", "/admin/catalog", "/admin/developers", "/admin/projects", "/admin/projects/new",
    "/admin/moderation", "/admin/evidence", "/admin/imports", "/admin/ingest/whatsapp",
    "/admin/leads", "/admin/deals", "/admin/commissions", "/admin/corrections", "/admin/settings",
    "/admin/readiness", "/admin/guide", "/admin/methodology",
    ...["info", "units", "sales", "photos", "news", "materials", "advanced"]
      .map((tab) => `/admin/projects/${projectId}?tab=${tab}`),
    `/admin/projects/${projectId}/inventory`,
  ];
  const partnerPaths = [
    "/partner", "/partner/projects", "/partner/projects/new", "/partner/leads", "/partner/deals",
    "/partner/analytics", "/partner/corrections",
    ...["", "/facts", "/inventory", "/materials", "/updates", "/campaigns", "/verification"]
      .map((tab) => `/partner/projects/${projectId}${tab}`),
  ];

  const scenarios = [
    ...publicPaths.map((path) => [path, null]),
    ...adminPaths.map((path) => [path, admin]),
    ...partnerPaths.map((path) => [path, partner]),
  ];
  // A bounded batch avoids overwhelming Next dev during first compilation.
  const failures = [];
  for (let i = 0; i < scenarios.length; i += 4) {
    await Promise.all(scenarios.slice(i, i + 4).map(async ([path, cookie]) => {
      try {
        const response = await fetch(base + path, { headers: cookie ? { cookie } : {}, redirect: "manual" });
        const html = await response.text();
        assert.equal(response.status, 200, path);
        assert.ok(html.length > 100, path + " renders a body");
        assert.ok(!html.includes("NEXT_HTTP_ERROR_FALLBACK;404"), path + " unexpectedly streamed a 404");
        assert.ok(!html.includes("Application error: a server-side exception"), path + " failed after streaming");
        if (cookie === admin) assert.ok(!html.includes("Пароль администратора"), path + " must show authenticated content");
      } catch (error) {
        failures.push(`${path}: ${error.message}`);
      }
    }));
  }
  assert.deepEqual(failures, []);
  const locked = await fetch(base + "/admin/leads");
  const lockedHtml = await locked.text();
  assert.ok(lockedHtml.includes("Пароль администратора"));
  assert.ok(!lockedHtml.includes("e2e@example.invalid"));
  for (const [path, target] of [
    ["/partner/projects", "/partner/login"], ["/account", "/login"], ["/registry/review", "/registry/login"],
  ]) {
    const response = await fetch(base + path, { redirect: "manual" });
    assert.ok([303, 307, 308].includes(response.status), path);
    assert.equal(new URL(response.headers.get("location"), base).pathname, target);
  }
  console.log(`PASS: ${scenarios.length} public and authenticated route smokes; protected sections reject anonymous access`);
}

export async function verifyApiGuards(base, admin) {
  const post = (path, body, headers = {}) => fetch(base + path, {
    method: "POST",
    body,
    headers: { "content-type": "application/json", ...headers },
  });
  const cases = [
    ["/api/analytics/public", "null", {}, 400],
    ["/api/analytics/public", '{"name":"unlisted"}', {}, 400],
    ["/api/analytics/public", '{"name":"project.view"}', { origin: "https://example.invalid" }, 403],
    ["/api/analytics/public", '{"name":"project.view"}', { origin: base }, 200],
    ["/api/analytics/event", "null", {}, 401],
    ["/api/analytics/event", "null", { authorization: "Bearer local-test-analytics" }, 400],
    ["/api/ai/lead-summary", '{"text":"local"}', {}, 401],
    ["/api/ai/lead-summary", "null", { cookie: admin }, 400],
    ["/api/webhooks/stripe", "{}", {}, 501],
  ];
  for (const [path, body, headers, expected] of cases) {
    const response = await post(path, body, headers);
    assert.equal(response.status, expected, `${path} with ${body}`);
  }
  console.log(`PASS: ${cases.length} API guards and valid local analytics event`);
}
