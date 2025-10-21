import { eq, and, desc, isNull } from "drizzle-orm";
import { db } from "./index";
import { periods } from "./schema";
import { Period } from "../types/period";
import { generateId } from "../utils/periodUtils";

export async function getUserPeriods(userId: number): Promise<Period[]> {
  const result = await db
    .select()
    .from(periods)
    .where(eq(periods.userId, userId))
    .orderBy(desc(periods.startDate));
  
  return result.map(period => ({
    id: period.id,
    userId: period.userId,
    startDate: period.startDate,
    endDate: period.endDate,
    createdAt: period.createdAt,
    updatedAt: period.updatedAt,
  }));
}

export async function createPeriod(userId: number, startDate: string, endDate?: string | null): Promise<Period> {
  const id = generateId();
  const now = new Date();
  
  const newPeriod = {
    id,
    userId,
    startDate,
    endDate: endDate || null,
    createdAt: now,
    updatedAt: now,
  };
  
  await db.insert(periods).values(newPeriod);
  
  return {
    id,
    userId,
    startDate,
    endDate: endDate || null,
    createdAt: now,
    updatedAt: now,
  };
}

export async function updatePeriod(periodId: string, userId: number, updates: { startDate?: string; endDate?: string | null }): Promise<Period | null> {
  const now = new Date();
  
  const result = await db
    .update(periods)
    .set({
      ...updates,
      updatedAt: now,
    })
    .where(and(eq(periods.id, periodId), eq(periods.userId, userId)))
    .returning();
  
  if (result.length === 0) return null;
  
  const period = result[0];
  return {
    id: period.id,
    userId: period.userId,
    startDate: period.startDate,
    endDate: period.endDate,
    createdAt: period.createdAt,
    updatedAt: period.updatedAt,
  };
}

export async function deletePeriod(periodId: string, userId: number): Promise<boolean> {
  const result = await db
    .delete(periods)
    .where(and(eq(periods.id, periodId), eq(periods.userId, userId)));
  
  return result.rowsAffected > 0;
}

export async function getActivePeriod(userId: number): Promise<Period | null> {
  const result = await db
    .select()
    .from(periods)
    .where(and(eq(periods.userId, userId), isNull(periods.endDate)))
    .limit(1);
  
  if (result.length === 0) return null;
  
  const period = result[0];
  return {
    id: period.id,
    userId: period.userId,
    startDate: period.startDate,
    endDate: period.endDate,
    createdAt: period.createdAt,
    updatedAt: period.updatedAt,
  };
}

export async function getPeriodById(periodId: string, userId: number): Promise<Period | null> {
  const result = await db
    .select()
    .from(periods)
    .where(and(eq(periods.id, periodId), eq(periods.userId, userId)))
    .limit(1);
  
  if (result.length === 0) return null;
  
  const period = result[0];
  return {
    id: period.id,
    userId: period.userId,
    startDate: period.startDate,
    endDate: period.endDate,
    createdAt: period.createdAt,
    updatedAt: period.updatedAt,
  };
}