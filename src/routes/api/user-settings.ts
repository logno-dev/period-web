import { json } from "@solidjs/router";
import { getSession } from "../../auth/server";
import { db } from "../../db";
import { users } from "../../db/schema";
import { eq } from "drizzle-orm";

type PushSubscriptionBody = {
  endpoint?: unknown;
  expirationTime?: unknown;
  keys?: {
    p256dh?: unknown;
    auth?: unknown;
  };
};

function parseNotificationEmails(rawEmails: unknown): string[] {
  if (!rawEmails || typeof rawEmails !== 'string') {
    return [];
  }

  try {
    const parsed = JSON.parse(rawEmails);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function isValidPushSubscription(payload: unknown): payload is PushSubscriptionBody {
  if (!payload || typeof payload !== 'object') return false;

  const candidate = payload as {
    endpoint?: unknown;
    keys?: {
      p256dh?: unknown;
      auth?: unknown;
    };
  };

  if (typeof candidate.endpoint !== 'string' || candidate.endpoint.length < 1) return false;

  const keys = candidate.keys;
  if (!keys || typeof keys !== 'object') return false;
  if (typeof keys.p256dh !== 'string' || keys.p256dh.length === 0) return false;
  if (typeof keys.auth !== 'string' || keys.auth.length === 0) return false;

  return true;
}

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
    const notificationEmails = parseNotificationEmails(userData.notificationEmails);

    return json({
      notificationsEnabled: userData.notificationsEnabled,
      pushNotificationsEnabled: userData.pushNotificationsEnabled,
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
    const {
      notificationsEnabled,
      pushNotificationsEnabled,
      pushSubscription,
      notificationEmails,
      timezone
    } = body;

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

    // Validate push subscription when provided
    if (pushSubscription !== undefined && pushSubscription !== null && !isValidPushSubscription(pushSubscription)) {
      return new Response("Invalid push subscription format", { status: 400 });
    }

    // Validate timezone (basic check - should be a string)
    if (timezone && typeof timezone !== 'string') {
      return new Response("Invalid timezone format", { status: 400 });
    }

    const user = await db.select()
      .from(users)
      .where(eq(users.id, session.id))
      .limit(1);

    if (user.length === 0) {
      return new Response("User not found", { status: 404 });
    }

    const userSettings = user[0];

    const pushEnabled =
      pushNotificationsEnabled === undefined
        ? userSettings.pushNotificationsEnabled
        : Boolean(pushNotificationsEnabled);

    const nextNotificationEmails = Array.isArray(notificationEmails)
      ? JSON.stringify(notificationEmails)
      : userSettings.notificationEmails;

    const nextTimezone =
      typeof timezone === 'string' && timezone.trim().length > 0
        ? timezone
        : userSettings.timezone || "America/Los_Angeles";

    const nextNotificationsEnabled =
      typeof notificationsEnabled === 'boolean'
        ? notificationsEnabled
        : userSettings.notificationsEnabled;

    const normalizedPushSubscription =
      pushEnabled && isValidPushSubscription(pushSubscription)
        ? JSON.stringify(pushSubscription)
        : null;

    await db.update(users)
      .set({
        notificationsEnabled: nextNotificationsEnabled,
        pushNotificationsEnabled: pushEnabled,
        pushSubscription: normalizedPushSubscription,
        notificationEmails: nextNotificationEmails,
        timezone: nextTimezone,
        updatedAt: new Date()
      })
      .where(eq(users.id, session.id));

    return json({ success: true });
  } catch (error) {
    console.error("Error updating user settings:", error);
    return new Response("Internal server error", { status: 500 });
  }
}
