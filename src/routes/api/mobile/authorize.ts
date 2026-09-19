import type { APIEvent } from "@solidjs/start/server";
import { getSessionUser } from "../../../auth/server";
import { signMobileToken } from "../../../auth/mobileTokens";

const headers = {
  "Cache-Control": "no-store",
  "Content-Type": "text/html; charset=utf-8",
  "Content-Security-Policy": "default-src 'none'; style-src 'unsafe-inline'; form-action 'self'; frame-ancestors 'none'; base-uri 'none'",
  "Referrer-Policy": "no-referrer",
};
const escape = (s: string) => s.replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]!));

export async function GET({ request }: APIEvent) {
  const url = new URL(request.url);
  const challenge = url.searchParams.get("challenge") || "";
  const state = url.searchParams.get("state") || "";
  if (!/^[A-Za-z0-9_-]{43}$/.test(challenge) || !/^[A-Za-z0-9_-]{32,128}$/.test(state)) {
    return new Response("Invalid authorization request", { status: 400 });
  }
  const user = await getSessionUser();
  if (!user) return Response.redirect(new URL(`/login?redirect=${encodeURIComponent(url.pathname + url.search)}`, url.origin), 302);
  return new Response(`<!doctype html><html><meta name="viewport" content="width=device-width,initial-scale=1"><title>Connect Android</title>
    <body style="font:18px system-ui;max-width:32rem;margin:4rem auto;padding:1rem"><h1>Connect Period Tracker</h1>
    <p>Authorize the Android app to read and update tracking data for ${escape(user.email)} for 30 days.</p>
    <form method="post"><input type="hidden" name="challenge" value="${challenge}"><input type="hidden" name="state" value="${state}">
    <button style="font:inherit;padding:1rem">Connect Android app</button></form></body></html>`, { headers });
}

export async function POST({ request }: APIEvent) {
  const url = new URL(request.url);
  if (request.headers.get("origin") !== url.origin) return new Response("Forbidden", { status: 403 });
  const user = await getSessionUser();
  if (!user) return new Response("Sign in again", { status: 401 });
  const form = await request.formData();
  const challenge = String(form.get("challenge") || "");
  const state = String(form.get("state") || "");
  if (!/^[A-Za-z0-9_-]{43}$/.test(challenge) || !/^[A-Za-z0-9_-]{32,128}$/.test(state)) return new Response("Invalid request", { status: 400 });
  const code = signMobileToken({ purpose: "code", sub: user.id, challenge, exp: Math.floor(Date.now() / 1000) + 120 });
  const callback = `dev.logno.period://authorize?code=${encodeURIComponent(code)}&state=${state}`;
  return new Response(`<!doctype html><html><meta name="viewport" content="width=device-width,initial-scale=1"><title>Open Android app</title>
    <body style="font:18px system-ui;padding:2rem"><h1>Account connected</h1><p><a href="${escape(callback)}">Return to Period Tracker</a></p></body></html>`, { headers });
}
