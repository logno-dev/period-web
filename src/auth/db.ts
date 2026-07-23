import { eq } from "drizzle-orm";
import { db } from "../db/index";
import { users } from "../db/schema";
import { sql } from "drizzle-orm";

interface User {
  id: number;
  email: string;
  password?: string;
}

export async function createUser(data: Pick<User, "email" | "password"> & { timezone?: string }) {
  const email = data.email.trim().toLowerCase();
  const now = new Date();
  const result = await db
    .insert(users)
    .values({
      email,
      password: data.password,
      timezone: data.timezone || "America/Los_Angeles",
      createdAt: now,
      updatedAt: now,
    })
    .returning();
  
  return {
    id: result[0].id,
    email: result[0].email,
    password: result[0].password,
  };
}

export async function findUser({ email, id }: { email?: string; id?: number }) {
  let query = db.select().from(users);
  
  if (id) {
    const result = await query.where(eq(users.id, id)).limit(1);
    return result[0] ? {
      id: result[0].id,
      email: result[0].email,
      password: result[0].password,
    } : undefined;
  }
  
  if (email) {
    const normalized = email.trim().toLowerCase();
    const result = await query
      .where(eq(users.email, normalized))
      .limit(1);

    if (result.length > 0) {
      return result[0] ? {
        id: result[0].id,
        email: result[0].email,
        password: result[0].password,
      } : undefined;
    }

    const insensitiveResult = await db
      .select()
      .from(users)
      .where(sql`lower(${users.email}) = ${normalized}`)
      .limit(1);

    const matched = insensitiveResult[0];

    if (matched) {
      return {
        id: matched.id,
        email: matched.email,
        password: matched.password,
      };
    }

    return undefined;
  }

  return undefined;
}
