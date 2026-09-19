import type { APIEvent } from "@solidjs/start/server";
import { authenticatePassword } from "../../../auth/server";
import { signMobileToken } from "../../../auth/mobileTokens";

const headers = { "Cache-Control": "no-store", "Content-Type": "application/json" };
const reply = (body: object, status = 200) => new Response(JSON.stringify(body), { status, headers });

export async function POST({ request }: APIEvent) {
  if (!request.headers.get("content-type")?.startsWith("application/json")) {
    return reply({ error: "Send email and password as JSON." }, 415);
  }
  let body: unknown;
  try {
    const text = await request.text();
    if (text.length > 8192) return reply({ error: "Sign-in request is too large." }, 413);
    body = JSON.parse(text);
  } catch {
    return reply({ error: "Invalid sign-in request." }, 400);
  }
  const { email, password } = (body ?? {}) as { email?: unknown; password?: unknown };
  if (typeof email !== "string" || typeof password !== "string" ||
      !email.trim() || email.length > 254 || !password || password.length > 1024) {
    return reply({ error: "Enter your email and password." }, 400);
  }
  try {
    const user = await authenticatePassword(email, password);
    if (!user) return reply({ error: "Invalid email or password. Use the password for your existing Period Tracker account." }, 401);
    const expiresAt = Math.floor(Date.now() / 1000) + 30 * 24 * 60 * 60;
    const token = signMobileToken({ purpose: "access", sub: user.id, exp: expiresAt });
    return reply({ token, expiresAt, email: user.email });
  } catch {
    return reply({ error: "Sign-in is temporarily unavailable. Please try again." }, 503);
  }
}
