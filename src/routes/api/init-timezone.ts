import { json } from "@solidjs/router";
import { getSession } from "../../auth/server";
import { db } from "../../db";
import { users } from "../../db/schema";
import { eq } from "drizzle-orm";

export async function POST(event: { request: Request }) {
  const { data: session } = await getSession();
  if (!session?.id) {
    return new Response("Unauthorized", { status: 401 });
  }

  try {
    const body = await event.request.json();
    const { timezone } = body;

    if (!timezone || typeof timezone !== 'string') {
      return new Response("Invalid timezone", { status: 400 });
    }

    // Get current user settings
    const user = await db.select()
      .from(users)
      .where(eq(users.id, session.id))
      .limit(1);

    if (user.length === 0) {
      return new Response("User not found", { status: 404 });
    }

    // Only update timezone if it's still the default value
    // This prevents overriding a user's manually configured timezone
    if (user[0].timezone === "America/Los_Angeles") {
      await db.update(users)
        .set({
          timezone: timezone,
          updatedAt: new Date()
        })
        .where(eq(users.id, session.id));
      
      return json({ success: true, updated: true });
    }

    return json({ success: true, updated: false });
  } catch (error) {
    console.error("Error initializing timezone:", error);
    return new Response("Internal server error", { status: 500 });
  }
}
