import type { APIEvent } from "@solidjs/start/server";
import { pkceChallenge, signMobileToken, verifyMobileToken } from "../../../auth/mobileTokens";
import { findUser } from "../../../auth/db";

export async function POST({ request }: APIEvent) {
  const headers = { "Cache-Control": "no-store", "Content-Type": "application/json" };
  try {
    const { code, verifier } = await request.json();
    if (typeof code !== "string" || typeof verifier !== "string" || !/^[A-Za-z0-9_-]{43,128}$/.test(verifier)) throw new Error();
    const claims = verifyMobileToken(code, "code");
    if (!claims || claims.challenge !== pkceChallenge(verifier)) throw new Error();
    const user = await findUser({ id: claims.sub });
    if (!user) throw new Error();
    const expiresAt = Math.floor(Date.now() / 1000) + 30 * 24 * 60 * 60;
    const token = signMobileToken({ purpose: "access", sub: user.id, exp: expiresAt });
    return new Response(JSON.stringify({ token, expiresAt, email: user.email }), { headers });
  } catch {
    return new Response(JSON.stringify({ error: "Authorization expired or invalid. Connect again." }), { status: 401, headers });
  }
}
