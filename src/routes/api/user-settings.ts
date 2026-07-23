import { json } from "@solidjs/router";
import { getSessionUser } from "../../auth/server";
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

type NormalizedPushSubscription = {
  endpoint: string;
  expirationTime: number | null;
  keys: {
    p256dh: string;
    auth: string;
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

function toBase64(value: unknown): string | null {
  if (typeof value === 'string') {
    return value || null;
  }

  if (!value) {
    return null;
  }

  if (value instanceof ArrayBuffer) {
    const bytes = new Uint8Array(value);
    let binary = "";
    for (let i = 0; i < bytes.length; i++) {
      binary += String.fromCharCode(bytes[i]);
    }
    return btoa(binary);
  }

  if (ArrayBuffer.isView(value)) {
    const view = new Uint8Array(value.buffer.slice(value.byteOffset, value.byteOffset + value.byteLength));
    let binary = "";
    for (let i = 0; i < view.length; i++) {
      binary += String.fromCharCode(view[i]);
    }
    return btoa(binary);
  }

  return null;
}

function normalizePushSubscription(payload: unknown): NormalizedPushSubscription | null {
  if (typeof payload === 'string') {
    const trimmed = payload.trim();
    if (!trimmed) {
      return null;
    }

    try {
      payload = JSON.parse(trimmed);
    } catch {
      return null;
    }
  }

  if (!payload || typeof payload !== 'object') {
    return null;
  }

  const candidate = payload as PushSubscriptionBody;

  if (typeof candidate.endpoint !== 'string' || candidate.endpoint.length < 1) {
    return null;
  }

  let p256dh =
    candidate.keys &&
    typeof candidate.keys === 'object' &&
    typeof (candidate.keys as { p256dh?: unknown }).p256dh !== 'undefined'
      ? toBase64((candidate.keys as { p256dh?: unknown }).p256dh)
      : null;

  if (!p256dh && typeof (candidate as Record<string, unknown>).p256dh !== 'undefined') {
    p256dh = toBase64((candidate as Record<string, unknown>).p256dh);
  }

  let auth =
    candidate.keys &&
    typeof candidate.keys === 'object' &&
    typeof (candidate.keys as { auth?: unknown }).auth !== 'undefined'
      ? toBase64((candidate.keys as { auth?: unknown }).auth)
      : null;

  if (!auth && typeof (candidate as Record<string, unknown>).auth !== 'undefined') {
    auth = toBase64((candidate as Record<string, unknown>).auth);
  }

  if (!p256dh || !auth) {
    return null;
  }

  let expirationTime: number | null = null;
  if (candidate.expirationTime === null) {
    expirationTime = null;
  } else if (typeof candidate.expirationTime === 'number') {
    expirationTime = candidate.expirationTime;
  } else if (typeof candidate.expirationTime === 'string' && candidate.expirationTime.length > 0) {
    const parsed = Number(candidate.expirationTime);
    if (Number.isFinite(parsed)) {
      expirationTime = parsed;
    }
  }

  return {
    endpoint: candidate.endpoint,
    expirationTime,
    keys: {
      p256dh,
      auth,
    },
  };
}

function isMissingPushColumnsError(error: unknown): boolean {
  const message = error instanceof Error ? error.message : "";
  return (
    message.includes("no such column: push_notifications_enabled") ||
    message.includes("no such column: push_subscription")
  );
}

export async function GET() {
  const sessionUser = await getSessionUser();
  if (!sessionUser) {
    return new Response("Unauthorized", { status: 401 });
  }

  try {
    const resolvedUserId = sessionUser.id;

    try {
      const user = await db
        .select()
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

      const fallback = await db
        .select({
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
  const sessionUser = await getSessionUser();
  if (!sessionUser) {
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

    // Validate timezone (basic check - should be a string)
    if (timezone && typeof timezone !== 'string') {
      return new Response("Invalid timezone format", { status: 400 });
    }

    const resolvedUserId = sessionUser.id;

    const hasPushPayload =
      pushNotificationsEnabled !== undefined || pushSubscription !== undefined;

    if (!hasPushPayload) {
      const user = await db
        .select({
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

      const nextNotificationEmails =
        Array.isArray(notificationEmails)
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

    const user = await db
      .select()
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
    let normalizedPushSubscription =
      pushEnabled
        ? normalizePushSubscription(pushSubscription)
        : null;

    if (pushEnabled && !normalizedPushSubscription && userSettings.pushSubscription) {
      normalizedPushSubscription = normalizePushSubscription(userSettings.pushSubscription);
    }

    if (pushEnabled && !normalizedPushSubscription) {
      console.warn("Invalid push subscription format provided while enabling notifications", {
        userId: resolvedUserId,
        hasPushPayload,
        hasPushSubscription: pushSubscription !== undefined,
      });
      return new Response("Invalid push subscription format", { status: 400 });
    }

    const updateValues = {
      notificationsEnabled: nextNotificationsEnabled,
      notificationEmails: nextNotificationEmails,
      timezone: nextTimezone,
      updatedAt: new Date(),
      pushNotificationsEnabled: pushEnabled,
      pushSubscription: pushEnabled
        ? JSON.stringify(normalizedPushSubscription)
        : null
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
