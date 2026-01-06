import { eq } from "drizzle-orm";
import { db } from "../db/index";
import { users } from "../db/schema";

interface User {
  id: number;
  email: string;
  password?: string;
}

export async function createUser(data: Pick<User, "email" | "password"> & { timezone?: string }) {
  const now = new Date();
  const result = await db
    .insert(users)
    .values({
      email: data.email,
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
    const result = await query.where(eq(users.email, email)).limit(1);
    return result[0] ? {
      id: result[0].id,
      email: result[0].email,
      password: result[0].password,
    } : undefined;
  }
  
  return undefined;
}
