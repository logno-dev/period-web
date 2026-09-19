import { test } from "node:test";
import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { once } from "node:events";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { createRequire } from "node:module";
import { pbkdf2Sync } from "node:crypto";
import { createClient } from "@libsql/client";
import { pkceChallenge, signMobileToken } from "../src/auth/mobileTokens.ts";

// Run after npm run build. All requests use an isolated temporary SQLite database.
test("mobile authorization and existing APIs enforce account ownership", { timeout: 30_000 }, async () => {
  const folder = await mkdtemp(join(tmpdir(), "period-mobile-test-"));
  const url = `file:${join(folder, "test.db")}`;
  const db = createClient({ url });
  const secret = "integration-test-secret-at-least-32-characters";
  const origin = "http://127.0.0.1:31987";
  let logs = "";
  let server: ReturnType<typeof spawn> | undefined;
  try {
    // Nitro's output does not copy libsql's optional native SQLite binary. Resolve it from the dev install for this local-only database test.
    const require = createRequire(import.meta.url);
    const nativeModules = dirname(dirname(require.resolve("libsql", { paths: [require.resolve("@libsql/client")] })));
    await db.executeMultiple(`
      CREATE TABLE users (id INTEGER PRIMARY KEY, email TEXT, password TEXT,
        notifications_enabled INTEGER DEFAULT 0, push_notifications_enabled INTEGER DEFAULT 0,
        notification_emails TEXT, push_subscription TEXT, timezone TEXT DEFAULT 'UTC', created_at INTEGER, updated_at INTEGER);
      INSERT INTO users (id, email) VALUES (1, 'one@example.test'), (2, 'two@example.test');
      CREATE TABLE periods (id TEXT PRIMARY KEY, user_id INTEGER, start_date TEXT, end_date TEXT, created_at INTEGER, updated_at INTEGER);
      CREATE TABLE mood_markers (id TEXT PRIMARY KEY, user_id INTEGER, date TEXT, mood TEXT, created_at INTEGER, updated_at INTEGER);
    `);
    const password = "test-password-with-spaces ";
    const salt = "ab".repeat(16);
    const hash = pbkdf2Sync(password, Buffer.from(salt, "hex"), 100_000, 64, "sha512").toString("hex");
    await db.execute({ sql: "UPDATE users SET password = ? WHERE id = 1", args: [`${salt}:${hash}`] });
    server = spawn(process.execPath, [".output/server/index.mjs"], {
      env: { ...process.env, NODE_PATH: nativeModules, PORT: "31987", HOST: "127.0.0.1", SESSION_SECRET: secret, TURSO_DATABASE_URL: url, TURSO_AUTH_TOKEN: "", NODE_ENV: "test" },
      stdio: ["ignore", "pipe", "pipe"],
    });
    server.stdout?.on("data", chunk => { logs += chunk; });
    server.stderr?.on("data", chunk => { logs += chunk; });
    let ready = false;
    for (let i = 0; i < 100; i++) {
      try { await fetch(origin + "/api/periods"); ready = true; break; } catch { await new Promise(resolve => setTimeout(resolve, 100)); }
    }
    assert.ok(ready, logs);
    const token = (sub: number) => signMobileToken({ purpose: "access", sub, exp: Math.floor(Date.now() / 1000) + 60 }, secret);
    const auth = { Authorization: `Bearer ${token(1)}` };
    assert.equal((await fetch(origin + "/api/periods")).status, 401);
    assert.equal((await fetch(origin + "/api/periods", { headers: { Authorization: "Bearer forged" } })).status, 401);
    const login = (email: unknown, password: unknown) => fetch(origin + "/api/mobile/login", {
      method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ email, password }),
    });
    assert.equal((await login("one@example.test", "wrong-password")).status, 401);
    assert.equal((await login("unknown@example.test", password)).status, 401);
    assert.equal((await login("two@example.test", password)).status, 401); // OAuth-only account
    assert.equal((await login("one@example.test", password.trim())).status, 401); // Passwords must not be normalized.
    assert.equal((await login("", password)).status, 400);
    assert.equal((await login("one@example.test", "x".repeat(1025))).status, 400);
    assert.equal((await login({ email: "one@example.test" }, password)).status, 400);
    assert.equal((await fetch(origin + "/api/mobile/login", { method: "POST", body: "email=one@example.test" })).status, 415);
    const signedIn = await login(" ONE@EXAMPLE.TEST ", password);
    assert.equal(signedIn.status, 200);
    assert.equal(signedIn.headers.get("cache-control"), "no-store");
    assert.equal(signedIn.headers.get("set-cookie"), null); // Native login needs no browser session.
    const nativeSession = await signedIn.json();
    assert.equal(nativeSession.email, "one@example.test");
    assert.equal(typeof nativeSession.token, "string");
    assert.ok(nativeSession.expiresAt > Date.now() / 1000);
    assert.equal(nativeSession.password, undefined);
    assert.equal((await db.execute("SELECT count(*) AS count FROM users")).rows[0].count, 2);
    const verifier = "v".repeat(43);
    const state = "s".repeat(43);
    const challenge = pkceChallenge(verifier);
    const authorize = `/api/mobile/authorize?challenge=${challenge}&state=${state}`;
    const unauthenticated = await fetch(origin + authorize, { redirect: "manual" });
    assert.equal(unauthenticated.status, 302);
    assert.ok(unauthenticated.headers.get("location")?.includes("/login?redirect="));
    const consent = await fetch(origin + authorize, { headers: auth });
    assert.equal(consent.status, 200);
    assert.match(await consent.text(), /one@example.test/);
    const form = new URLSearchParams({ challenge, state });
    assert.equal((await fetch(origin + authorize, { method: "POST", headers: { ...auth, Origin: "https://other.example" }, body: form })).status, 403);
    const approval = await fetch(origin + authorize, { method: "POST", headers: { ...auth, Origin: origin }, body: form });
    assert.equal(approval.status, 200);
    const code = (await approval.text()).match(/code=([^&"]+)/)?.[1];
    assert.ok(code);
    const exchange = (verifier: string) => fetch(origin + "/api/mobile/token", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ code: decodeURIComponent(code), verifier }) });
    assert.equal((await exchange("wrong".repeat(10))).status, 401);
    const exchanged = await exchange(verifier);
    assert.equal(exchanged.status, 200);
    const session = await exchanged.json();
    assert.equal(session.email, "one@example.test");
    const headers = { Authorization: `Bearer ${nativeSession.token}`, "Content-Type": "application/json" };
    const created = await fetch(origin + "/api/periods", { method: "POST", headers, body: JSON.stringify({ startDate: "2026-01-01", endDate: "2026-01-05" }) });
    assert.equal(created.status, 200);
    const { period } = await created.json();
    const otherHeaders = { Authorization: `Bearer ${token(2)}`, "Content-Type": "application/json" };
    assert.deepEqual((await (await fetch(origin + "/api/periods", { headers: otherHeaders })).json()).periods, []);
    assert.equal((await fetch(origin + "/api/periods", { method: "PUT", headers: otherHeaders, body: JSON.stringify({ id: period.id, endDate: "2026-01-06" }) })).status, 404);
    assert.equal((await fetch(origin + `/api/periods?id=${period.id}`, { method: "DELETE", headers: otherHeaders })).status, 404);
    assert.equal((await fetch(origin + "/api/periods", { method: "PUT", headers, body: JSON.stringify({ id: period.id, endDate: "2026-01-06" }) })).status, 200);
    const moodResponse = await fetch(origin + "/api/mood-markers", { method: "POST", headers, body: JSON.stringify({ date: "2026-01-01", mood: "Happy" }) });
    assert.equal(moodResponse.status, 200);
    const { marker } = await moodResponse.json();
    assert.equal((await fetch(origin + `/api/mood-markers?id=${marker.id}`, { method: "DELETE", headers: otherHeaders })).status, 404);
    assert.equal((await fetch(origin + `/api/mood-markers?id=${marker.id}`, { method: "DELETE", headers })).status, 200);
    assert.equal((await fetch(origin + `/api/periods?id=${period.id}`, { method: "DELETE", headers })).status, 200);
  } catch (error) {
    console.error(logs);
    throw error;
  } finally {
    if (server && server.exitCode === null) { const exited = once(server, "exit"); server.kill(); await exited; }
    db.close();
    await rm(folder, { recursive: true, force: true });
  }
});
