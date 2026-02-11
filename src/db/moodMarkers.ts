import { eq, and, desc } from "drizzle-orm";
import { db } from "./index";
import { moodMarkers } from "./schema";
import { generateId } from "../utils/periodUtils";
import { MoodMarker } from "../types/period";

export async function getUserMoodMarkers(userId: number): Promise<MoodMarker[]> {
  const result = await db
    .select()
    .from(moodMarkers)
    .where(eq(moodMarkers.userId, userId))
    .orderBy(desc(moodMarkers.date));

  return result.map(marker => ({
    id: marker.id,
    userId: marker.userId,
    date: marker.date,
    mood: marker.mood,
    createdAt: marker.createdAt,
    updatedAt: marker.updatedAt,
  }));
}

export async function createMoodMarker(userId: number, date: string, mood: string): Promise<MoodMarker> {
  const id = generateId();
  const now = new Date();

  const newMarker = {
    id,
    userId,
    date,
    mood,
    createdAt: now,
    updatedAt: now,
  };

  await db.insert(moodMarkers).values(newMarker);

  return {
    id,
    userId,
    date,
    mood,
    createdAt: now,
    updatedAt: now,
  };
}

export async function deleteMoodMarker(markerId: string, userId: number): Promise<boolean> {
  const result = await db
    .delete(moodMarkers)
    .where(and(eq(moodMarkers.id, markerId), eq(moodMarkers.userId, userId)));

  return result.rowsAffected > 0;
}
