import { sqliteTable, text, integer } from "drizzle-orm/sqlite-core";

export const users = sqliteTable("users", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  email: text("email").notNull().unique(),
  password: text("password"), // Optional for OAuth users
  notificationsEnabled: integer("notifications_enabled", { mode: "boolean" }).notNull().default(true),
  notificationEmails: text("notification_emails"), // JSON array of additional email addresses
  timezone: text("timezone").notNull().default("America/Los_Angeles"), // IANA timezone identifier
  createdAt: integer("created_at", { mode: "timestamp" }).notNull().default(new Date()),
  updatedAt: integer("updated_at", { mode: "timestamp" }).notNull().default(new Date()),
});

export const periods = sqliteTable("periods", {
  id: text("id").primaryKey(),
  userId: integer("user_id").notNull().references(() => users.id),
  startDate: text("start_date").notNull(), // YYYY-MM-DD format
  endDate: text("end_date"), // NULL for active periods
  createdAt: integer("created_at", { mode: "timestamp" }).notNull().default(new Date()),
  updatedAt: integer("updated_at", { mode: "timestamp" }).notNull().default(new Date()),
});

export const moodMarkers = sqliteTable("mood_markers", {
  id: text("id").primaryKey(),
  userId: integer("user_id").notNull().references(() => users.id),
  date: text("date").notNull(), // YYYY-MM-DD format
  mood: text("mood").notNull(),
  createdAt: integer("created_at", { mode: "timestamp" }).notNull().default(new Date()),
  updatedAt: integer("updated_at", { mode: "timestamp" }).notNull().default(new Date()),
});

export type User = typeof users.$inferSelect;
export type NewUser = typeof users.$inferInsert;
export type Period = typeof periods.$inferSelect;
export type NewPeriod = typeof periods.$inferInsert;
export type MoodMarker = typeof moodMarkers.$inferSelect;
export type NewMoodMarker = typeof moodMarkers.$inferInsert;
