import assert from "node:assert/strict";

function cookiesFrom(response) {
  return response.headers.getSetCookie()
    .filter((cookie) => !cookie.includes("Max-Age=0"))
    .map((cookie) => cookie.split(";", 1)[0])
    .join("; ");
}

export async function verifyEmailLogin(base) {
  const verifier = "sb-127-auth-token-code-verifier=base64-" +
    Buffer.from(JSON.stringify("local-verifier")).toString("base64url");

  for (const [path, code, content] of [
    ["/partner", "partner-code", "Мои проекты"],
    ["/account", "account-code", "Личный кабинет"],
    ["/registry/review", "registry-code", "Кабинет эксперта реестра"],
  ]) {
    const incoming = `${base}${path}?code=${code}`;
    const exchange = await fetch(incoming, {
      headers: { cookie: verifier }, redirect: "manual",
    });
    assert.equal(exchange.status, 303);
    assert.match(exchange.headers.get("cache-control"), /no-store/);
    assert.equal(new URL(exchange.headers.get("location"), base).pathname, path);
    const cookie = cookiesFrom(exchange);
    assert.match(cookie, /sb-127-auth-token=/);

    const page = await fetch(base + path, { headers: { cookie }, redirect: "manual" });
    assert.equal(page.status, 200, path);
    assert.ok((await page.text()).includes(content), `authenticated content for ${path}`);

    const reused = await fetch(incoming, {
      headers: { cookie: verifier }, redirect: "manual",
    });
    assert.equal(new URL(reused.headers.get("location"), base).pathname, "/auth/error");
    assert.equal(cookiesFrom(reused), "", "reused codes must not set a session");
  }
  const escaped = await fetch(base + "/auth/callback?next=https://example.invalid&code=partner-code", {
    headers: { cookie: verifier }, redirect: "manual",
  });
  assert.equal(new URL(escaped.headers.get("location"), base).origin, base);
  assert.equal(new URL(escaped.headers.get("location"), base).pathname, "/auth/error");

  const denied = await fetch(base + "/account", { redirect: "manual" });
  assert.equal(new URL(denied.headers.get("location"), base).pathname, "/login");
  console.log("PASS: email-link callback opens partner, investor and registry sessions; reused codes and external redirects denied");
}

export async function verifySameRequestRefresh(base) {
  const part = (value) => Buffer.from(JSON.stringify(value)).toString("base64url");
  const exp = Math.floor(Date.now() / 1000) - 120;
  const access = part({ alg: "HS256", typ: "JWT" }) + "." +
    part({ sub: "00000000-0000-4000-8000-000000990011", exp }) + ".local-test-signature";
  const session = {
    access_token: access, refresh_token: "expired-local-token", expires_at: exp,
    expires_in: 3600, token_type: "bearer",
  };
  const response = await fetch(base + "/partner/projects", {
    headers: { cookie: "sb-127-auth-token=base64-" + part(session) }, redirect: "manual",
  });
  assert.equal(response.status, 200, "the same request must receive the refreshed session");
  assert.ok((await response.text()).includes("Мои проекты"), "protected content available on first request");
  assert.match(cookiesFrom(response), /sb-127-auth-token=/);
  console.log("PASS: expired session refreshed for both the browser and protected server route");
}
