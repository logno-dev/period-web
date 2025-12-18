import { json } from "@solidjs/router";
import { getSession } from "../../auth/server";
import { db } from "../../db";
import { users } from "../../db/schema";
import { eq } from "drizzle-orm";

export async function GET() {
  const { data: session } = await getSession();
  if (!session?.id) {
    return new Response("Unauthorized", { status: 401 });
  }

  try {
    const user = await db.select()
      .from(users)
      .where(eq(users.id, session.id))
      .limit(1);

    if (user.length === 0) {
      return new Response("User not found", { status: 404 });
    }

    const userData = user[0];
    const notificationEmails = userData.notificationEmails 
      ? JSON.parse(userData.notificationEmails) 
      : [];

    return json({
      notificationsEnabled: userData.notificationsEnabled,
      notificationEmails,
      timezone: userData.timezone || "America/Los_Angeles"
    });
  } catch (error) {
    console.error("Error fetching user settings:", error);
    return new Response("Internal server error", { status: 500 });
  }
}

export async function POST(event: { request: Request }) {
  const { data: session } = await getSession();
  if (!session?.id) {
    return new Response("Unauthorized", { status: 401 });
  }

  try {
    const body = await event.request.json();
    const { notificationsEnabled, notificationEmails, timezone } = body;

    // Validate email addresses
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (notificationEmails && !Array.isArray(notificationEmails)) {
      return new Response("Invalid notification emails format", { status: 400 });
    }

    if (notificationEmails) {
      for (const email of notificationEmails) {
        if (!emailRegex.test(email)) {
          return new Response(`Invalid email address: ${email}`, { status: 400 });
        }
      }
    }

    // Validate timezone (basic check - should be a string)
    if (timezone && typeof timezone !== 'string') {
      return new Response("Invalid timezone format", { status: 400 });
    }

    await db.update(users)
      .set({
        notificationsEnabled: notificationsEnabled,
        notificationEmails: notificationEmails ? JSON.stringify(notificationEmails) : null,
        timezone: timezone || "America/Los_Angeles",
        updatedAt: new Date()
      })
      .where(eq(users.id, session.id));

    return json({ success: true });
  } catch (error) {
    console.error("Error updating user settings:", error);
    return new Response("Internal server error", { status: 500 });
  }
}