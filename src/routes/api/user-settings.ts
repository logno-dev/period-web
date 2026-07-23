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

type SessionData = {
  id: number;
  email: string;
};

async function resolveSessionUserId(session: SessionData): Promise<number | null> {
  const numericId = Number(session.id);

  if (Number.isFinite(numericId)) {
    const exactMatch = await db.select({ id: users.id })
      .from(users)
      .where(eq(users.id, numericId))
      .limit(1);

    if (exactMatch.length > 0) {
      return exactMatch[0].id;
    }
  }

  if (!session.email) {
    return null;
  }

  const byEmail = await db.select({ id: users.id })
    .from(users)
    .where(eq(users.email, session.email))
    .limit(1);

  return byEmail.length > 0 ? byEmail[0].id : null;
}

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

function isMissingPushColumnsError(error: unknown): boolean {
  const message = error instanceof Error ? error.message : "";
  return (
    message.includes("no such column: push_notifications_enabled") ||
    message.includes("no such column: push_subscription")
  );
}

export async function GET() {
  const { data: session } = await getSession();
  if (!session?.id) {
    return new Response("Unauthorized", { status: 401 });
  }

  try {
    const resolvedUserId = await resolveSessionUserId(session);
    if (!resolvedUserId) {
      return new Response("User not found", { status: 404 });
    }

    try {
      const user = await db.select()
        .from(users)
        .where(eq(users.id, resolvedUserId))
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
      if (!isMissingPushColumnsError(error)) {
        throw error;
      }

      const fallback = await db.select({
        notificationsEnabled: users.notificationsEnabled,
        notificationEmails: users.notificationEmails,
        timezone: users.timezone
      })
        .from(users)
        .where(eq(users.id, resolvedUserId))
        .limit(1);

      if (fallback.length === 0) {
        return new Response("User not found", { status: 404 });
      }

      const fallbackUser = fallback[0];
      const notificationEmails = parseNotificationEmails(fallbackUser.notificationEmails);

      return json({
        notificationsEnabled: fallbackUser.notificationsEnabled,
        pushNotificationsEnabled: false,
        notificationEmails,
        timezone: fallbackUser.timezone || "America/Los_Angeles"
      });
    }
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

    const resolvedUserId = await resolveSessionUserId(session);
    if (!resolvedUserId) {
      return new Response("User not found", { status: 404 });
    }

    const hasPushPayload =
      pushNotificationsEnabled !== undefined || pushSubscription !== undefined;

    if (!hasPushPayload) {
      const user = await db.select({
        notificationsEnabled: users.notificationsEnabled,
        notificationEmails: users.notificationEmails,
        timezone: users.timezone
      })
        .from(users)
        .where(eq(users.id, resolvedUserId))
        .limit(1);

      if (user.length === 0) {
        return new Response("User not found", { status: 404 });
      }

      const userSettings = user[0];

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

      await db.update(users)
        .set({
          notificationsEnabled: nextNotificationsEnabled,
          notificationEmails: nextNotificationEmails,
          timezone: nextTimezone,
          updatedAt: new Date()
        })
        .where(eq(users.id, resolvedUserId));

      return json({ success: true });
    }

    const user = await db.select()
      .from(users)
      .where(eq(users.id, resolvedUserId))
      .limit(1);

    if (user.length === 0) {
      return new Response("User not found", { status: 404 });
    }

    const userSettings = user[0];
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

    const pushEnabled = Boolean(pushNotificationsEnabled);

    if (pushEnabled && !isValidPushSubscription(pushSubscription)) {
      return new Response("Invalid push subscription format", { status: 400 });
    }

    const normalizedPushSubscription =
      pushEnabled
        ? JSON.stringify(pushSubscription)
        : null;

    const updateValues = {
      notificationsEnabled: nextNotificationsEnabled,
      notificationEmails: nextNotificationEmails,
      timezone: nextTimezone,
      updatedAt: new Date(),
      pushNotificationsEnabled: pushEnabled,
      pushSubscription: normalizedPushSubscription
    };

    try {
      await db.update(users)
        .set(updateValues)
        .where(eq(users.id, resolvedUserId));
    } catch (error) {
      if (isMissingPushColumnsError(error)) {
        return new Response(
          "Database schema not migrated. Add push_notifications_enabled and push_subscription to users table first.",
          { status: 409 }
        );
      }
      throw error;
    }

    return json({ success: true });
  } catch (error) {
    console.error("Error updating user settings:", error);
    return new Response("Internal server error", { status: 500 });
  }
}
