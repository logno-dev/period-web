import { test } from "node:test";
import assert from "node:assert/strict";
import { pkceChallenge, signMobileToken, verifyMobileToken } from "../src/auth/mobileTokens.ts";

const secret = "test-only-secret-at-least-32-characters-long";
const exp = Math.floor(Date.now() / 1000) + 60;

test("mobile tokens authenticate claims and reject tampering, expiry, and wrong purpose", () => {
  const token = signMobileToken({ sub: 7, purpose: "access", exp }, secret);
  assert.equal(verifyMobileToken(token, "access", secret)?.sub, 7);
  assert.equal(verifyMobileToken(token, "code", secret), null);
  assert.equal(verifyMobileToken(token, "access", "different-secret"), null);
  assert.equal(verifyMobileToken(token + ".extra", "access", secret), null);
  const forgedPayload = Buffer.from(JSON.stringify({ sub: 8, purpose: "access", exp })).toString("base64url");
  assert.equal(verifyMobileToken(`${forgedPayload}.${token.split(".")[1]}`, "access", secret), null);
  assert.equal(verifyMobileToken(signMobileToken({ sub: 7, purpose: "access", exp: 1 }, secret), "access", secret), null);
  assert.equal(verifyMobileToken(signMobileToken({ sub: -1, purpose: "access", exp }, secret), "access", secret), null);
});

test("PKCE uses the RFC 7636 S256 test vector and binds the authorization code", () => {
  const challenge = pkceChallenge("dBjftJeZ4CVP-mB92K27uhbUJU1p1r_wW1gFWFOEjXk");
  assert.equal(challenge, "E9Melhoa2OwvFrEMTJguCHaoeK1t8URWbuGJSstw-cM");
  const code = signMobileToken({ sub: 7, purpose: "code", challenge, exp }, secret);
  assert.equal(verifyMobileToken(code, "code", secret)?.challenge, challenge);
  assert.notEqual(pkceChallenge("wrong-verifier"), challenge);
});
