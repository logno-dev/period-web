import { redirect } from "@solidjs/router";
import { useSession } from "vinxi/http";
import { getRandomValues, subtle, timingSafeEqual } from "crypto";
import { createUser, findUser } from "./db";
import { db } from "../db";
import { users } from "../db/schema";
import { periods, moodMarkers } from "../db/schema";
import { count, eq, sql } from "drizzle-orm";

export interface Session {
  id?: number | string;
  email?: string;
  userId?: number | string;
}

export const getSession = () =>
  useSession<Session>({
    password: process.env.SESSION_SECRET!,
    maxAge: 30 * 24 * 60 * 60 // 30 days in seconds
  });

export async function createSession(user: Session, redirectTo?: string) {
  const validDest = redirectTo?.[0] === "/" && redirectTo[1] !== "/";
  const session = await getSession();
  await session.update(user);
  return redirect(validDest ? redirectTo : "/");
}

type ResolvedSessionUser = {
  id: number;
  email: string;
};

function normalizeId(candidate: unknown): number | null {
  const parsed = Number(candidate);
  if (!Number.isFinite(parsed) || !Number.isInteger(parsed)) return null;
  return parsed;
}

async function findUserById(id: number): Promise<ResolvedSessionUser | null> {
  const found = await db
    .select({ id: users.id, email: users.email })
    .from(users)
    .where(eq(users.id, id))
    .limit(1);

  return found.length > 0
    ? { id: found[0].id, email: found[0].email }
    : null;
}

async function findUserByEmail(email: string): Promise<ResolvedSessionUser | null> {
  const normalized = email.trim().toLowerCase();

  const exactMatch = await db
    .select({ id: users.id, email: users.email })
    .from(users)
    .where(eq(users.email, normalized))
    .limit(1);

  if (exactMatch.length > 0) {
    return { id: exactMatch[0].id, email: exactMatch[0].email };
  }

  const caseInsensitiveMatch = await db
    .select({ id: users.id, email: users.email })
    .from(users)
    .where(sql`lower(${users.email}) = ${normalized}`)
    .limit(1);

  if (caseInsensitiveMatch.length > 0) {
    return { id: caseInsensitiveMatch[0].id, email: caseInsensitiveMatch[0].email };
  }

  return null;
}

async function countUserRows(table: typeof periods | typeof moodMarkers, userId: number) {
  const result = await db.select({ count: count() }).from(table).where(eq(table.userId, userId));
  return Number(result[0]?.count || 0);
}

async function migrateLegacyRows(legacyUserId: number, canonicalUserId: number) {
  const legacyPeriods = await countUserRows(periods, legacyUserId);
  const legacyMarkers = await countUserRows(moodMarkers, legacyUserId);

  if (legacyPeriods === 0 && legacyMarkers === 0) return;

  const canonicalPeriods = await countUserRows(periods, canonicalUserId);
  const canonicalMarkers = await countUserRows(moodMarkers, canonicalUserId);

  // Only migrate if canonical account is currently empty, to avoid moving data between two active accounts.
  if (canonicalPeriods > 0 || canonicalMarkers > 0) return;

  if (legacyPeriods > 0) {
    await db.update(periods).set({ userId: canonicalUserId }).where(eq(periods.userId, legacyUserId));
  }

  if (legacyMarkers > 0) {
    await db.update(moodMarkers).set({ userId: canonicalUserId }).where(eq(moodMarkers.userId, legacyUserId));
  }
}

export async function getSessionUser(): Promise<ResolvedSessionUser | null> {
  const session = await getSession();
  const data = session.data;

  if (!data || typeof data !== "object") {
    return null;
  }

  const payload = data as Record<string, unknown>;
  const candidates = new Set<number>();

  const primaryId = normalizeId(payload.id);
  const alternateId = normalizeId(payload.userId);
  const alternateUserId = normalizeId((payload as { user_id?: unknown }).user_id);

  if (primaryId != null) candidates.add(primaryId);
  if (alternateId != null) candidates.add(alternateId);
  if (alternateUserId != null) candidates.add(alternateUserId);

  const email = typeof payload.email === "string" ? payload.email.trim() : "";
  const byEmail = email ? await findUserByEmail(email) : null;
  if (byEmail) {
    if ((payload.id || payload.userId || (payload as { user_id?: unknown }).user_id) && !candidates.has(byEmail.id)) {
      await session.update({ id: byEmail.id, email: byEmail.email });
      for (const legacyId of candidates) {
        if (legacyId !== byEmail.id) {
          await migrateLegacyRows(legacyId, byEmail.id);
        }
      }
    } else if (payload.email !== byEmail.email) {
      await session.update({ id: byEmail.id, email: byEmail.email });
    }
    return byEmail;
  }

  if (candidates.size === 0) {
    return null;
  }

  for (const candidateId of candidates) {
    const byId = await findUserById(candidateId);
    if (byId) {
      if (byId.email !== payload.email) {
        await session.update({ id: byId.id, email: byId.email });
      }
      return byId;
    }
  }

  return null;
}

async function createHash(password: string) {
  const salt = getRandomValues(new Uint8Array(16));
  const saltHex = Buffer.from(salt).toString("hex");
  const key = await subtle.deriveBits(
    {
      name: "PBKDF2",
      salt,
      iterations: 100_000,
      hash: "SHA-512"
    },
    await subtle.importKey("raw", new TextEncoder().encode(password), "PBKDF2", false, [
      "deriveBits"
    ]),
    512
  );
  const hash = Buffer.from(key).toString("hex");
  return `${saltHex}:${hash}`;
}

async function checkPassword(storedPassword: string, providedPassword: string) {
  const [storedSalt, storedHash] = storedPassword.split(":");
  if (!storedSalt || !storedHash) throw new Error("Invalid stored password format");
  const key = await subtle.deriveBits(
    {
      name: "PBKDF2",
      salt: Buffer.from(storedSalt, "hex"),
      iterations: 100_000,
      hash: "SHA-512"
    },
    await subtle.importKey("raw", new TextEncoder().encode(providedPassword), "PBKDF2", false, [
      "deriveBits"
    ]),
    512
  );
  const hash = Buffer.from(key);
  const stored = Buffer.from(storedHash, "hex");
  if (stored.length !== hash.length || !timingSafeEqual(stored, hash))
    throw new Error("Invalid email or password");
}

export async function passwordLogin(email: string, password: string) {
  let user = await findUser({ email });
  if (!user)
    user = await createUser({
      email,
      password: await createHash(password)
    });
  else if (!user.password)
    throw new Error("Account exists via OAuth. Sign in with your OAuth provider");
  else await checkPassword(user.password, password);
  return createSession(user);
}
