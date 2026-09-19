import { createHash, createHmac, timingSafeEqual } from "node:crypto";

type Claims = { purpose: "code" | "access"; sub: number; exp: number; challenge?: string };

function signature(payload: string, secret: string) {
  return createHmac("sha256", secret).update(`period-android-v1.${payload}`).digest();
}

export function signMobileToken(claims: Claims, secret = process.env.SESSION_SECRET!) {
  if (!secret || secret.length < 32) throw new Error("SESSION_SECRET must contain at least 32 characters");
  const payload = Buffer.from(JSON.stringify(claims)).toString("base64url");
  return `${payload}.${signature(payload, secret).toString("base64url")}`;
}

export function verifyMobileToken(token: string, purpose: Claims["purpose"], secret = process.env.SESSION_SECRET!): Claims | null {
  try {
    if (!secret || token.length > 2048) return null;
    const parts = token.split(".");
    if (parts.length !== 2) return null;
    const expected = signature(parts[0], secret);
    const actual = Buffer.from(parts[1], "base64url");
    if (actual.length !== expected.length || !timingSafeEqual(actual, expected)) return null;
    const claims = JSON.parse(Buffer.from(parts[0], "base64url").toString()) as Claims;
    if (claims.purpose !== purpose || !Number.isSafeInteger(claims.sub) || claims.sub <= 0 ||
        !Number.isFinite(claims.exp) || claims.exp <= Date.now() / 1000) return null;
    return claims;
  } catch { return null; }
}

export function pkceChallenge(verifier: string) {
  return createHash("sha256").update(verifier).digest("base64url");
}
