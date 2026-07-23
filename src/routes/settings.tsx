import { createSignal, createResource, createEffect, For, Show } from "solid-js";
import { A } from "@solidjs/router";
import { useAuth } from "../components/Context";
import Header from "../components/Header";

export default function Settings() {
  const { session } = useAuth();
  const [notificationsEnabled, setNotificationsEnabled] = createSignal(true);
  const [pushNotificationsEnabled, setPushNotificationsEnabled] = createSignal(false);
  const [notificationEmails, setNotificationEmails] = createSignal<string[]>([]);
  const [timezone, setTimezone] = createSignal("America/Los_Angeles");
  const [timezoneDirty, setTimezoneDirty] = createSignal(false);
  const [isPwa, setIsPwa] = createSignal(false);
  const [pushPermissionGranted, setPushPermissionGranted] = createSignal(false);
  const [newEmail, setNewEmail] = createSignal("");
  const [saving, setSaving] = createSignal(false);
  const [message, setMessage] = createSignal("");
  const [messageType, setMessageType] = createSignal<"info" | "success" | "error">("info");
  const [messageDetails, setMessageDetails] = createSignal("");
  const [copiedDetails, setCopiedDetails] = createSignal(false);
  const [timezoneLoaded, setTimezoneLoaded] = createSignal(false);

  const waitForServiceWorkerReady = async (timeoutMs = 8000): Promise<ServiceWorkerRegistration | null> => {
    if (!('serviceWorker' in navigator)) {
      return null;
    }

    return new Promise((resolve) => {
      const timeout = setTimeout(() => {
        clearTimeout(timeout);
        resolve(null);
      }, timeoutMs);

      navigator.serviceWorker.ready
        .then((registration) => {
          clearTimeout(timeout);
          resolve(registration);
        })
        .catch(() => {
          clearTimeout(timeout);
          resolve(null);
        });
    });
  };

  createEffect(() => {
    if (typeof window === 'undefined') return;

    const isStandalone = window.matchMedia("(display-mode: standalone)").matches
      || (window.navigator as { standalone?: boolean }).standalone === true;
    setIsPwa(isStandalone);
    if (typeof Notification !== 'undefined') {
      setPushPermissionGranted(Notification.permission === 'granted');
    }
  });

  // Load current settings
  const [userSettings] = createResource(
    () => session()?.id,
    async (userId) => {
      if (!userId) return null;
      const response = await fetch(`/api/user-settings?userId=${userId}`);
      if (!response.ok) {
        setTimezoneLoaded(false);
        return null;
      }

      const data = await response.json();
      console.log('Loaded user settings:', data);
      setNotificationsEnabled(data.notificationsEnabled);
      setPushNotificationsEnabled(data.pushNotificationsEnabled);
      setNotificationEmails(data.notificationEmails || []);
      setTimezone(data.timezone || "America/Los_Angeles");
      setTimezoneDirty(false);
      setTimezoneLoaded(true);
      console.log('Timezone set to:', data.timezone || "America/Los_Angeles");
      return data;
    }
  );

  const urlBase64ToUint8Array = (base64String: string) => {
    const padding = '='.repeat((4 - (base64String.length % 4)) % 4);
    const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/');
    const rawData = atob(base64);
    const outputArray = new Uint8Array(rawData.length);

    for (let i = 0; i < rawData.length; i++) {
      outputArray[i] = rawData.charCodeAt(i);
    }
    return outputArray;
  };

  const summarizePushSubscription = (subscription: PushSubscription | null) => {
    if (!subscription) {
      return {
        exists: false
      };
    }

    let p256dhLength = 0;
    let authLength = 0;

    try {
      const p256dh = subscription.getKey("p256dh");
      const auth = subscription.getKey("auth");
      p256dhLength = p256dh ? p256dh.byteLength : 0;
      authLength = auth ? auth.byteLength : 0;
    } catch (error) {
      return {
        exists: true,
        endpoint: !!subscription.endpoint,
        endpointLength: subscription.endpoint ? subscription.endpoint.length : 0,
        getKeyError: true
      };
    }

    return {
      exists: true,
      endpointLength: subscription.endpoint ? subscription.endpoint.length : 0,
      expirationTime: subscription.expirationTime ?? null,
      p256dhLength,
      authLength,
      hasKeys: p256dhLength > 0 && authLength > 0
    };
  };

  const collectPushErrorContext = async (options: {
    pushEnabled?: boolean;
    pushSub?: PushSubscription | null;
    pushSubSerialized: unknown;
  }) => {
    const waitWithTimeout = async (promise: Promise<unknown>, ms: number) => {
      const timeout = new Promise<null>((resolve) => {
        setTimeout(() => resolve(null), ms);
      });

      return Promise.race([promise, timeout]);
    };

    const context: Record<string, unknown> = {
      isPwa: isPwa(),
      userAgent: typeof navigator !== 'undefined' ? navigator.userAgent : 'unknown',
      pushEnabledRequested: options.pushEnabled,
      hasWindow: typeof window !== 'undefined',
      hasServiceWorker: typeof window !== 'undefined' && 'serviceWorker' in navigator,
      hasPushManager: typeof window !== 'undefined' && 'PushManager' in window,
      notificationApiSupported: typeof Notification !== 'undefined',
    };

    if (typeof Notification !== 'undefined') {
      context.notificationPermission = Notification.permission;
    }

    const submittedPushSummary = summarizePushSubscription(options.pushSub ?? null);
    context.submittedPush = submittedPushSummary;
    context.submittedPushSerialized = {
      type: options.pushSubSerialized === undefined ? 'undefined' : options.pushSubSerialized === null ? 'null' : typeof options.pushSubSerialized,
      hasEndpoint: typeof (options.pushSubSerialized as { endpoint?: unknown })?.endpoint === 'string',
      hasKeys: (options.pushSubSerialized && typeof options.pushSubSerialized === 'object' &&
        typeof (options.pushSubSerialized as { keys?: unknown }).keys === 'object'),
      hasP256dh: typeof (options.pushSubSerialized as { keys?: { p256dh?: unknown } })?.keys?.p256dh === 'string',
      hasAuth: typeof (options.pushSubSerialized as { keys?: { auth?: unknown } })?.keys?.auth === 'string'
    };

    if (typeof window === 'undefined' || !('serviceWorker' in navigator) || !('PushManager' in window)) {
      return context;
    }

    try {
      const registration = await waitWithTimeout(
        navigator.serviceWorker.getRegistration(),
        1500
      ) as ServiceWorkerRegistration | null;

      context.pushManagerReady = !!registration;
      context.hasServiceWorkerController = !!navigator.serviceWorker.controller;

      if (!registration) {
        context.serviceWorkerReadyError = "Timed out waiting for service worker registration";
        return context;
      }

      const existing = await waitWithTimeout(
        registration.pushManager.getSubscription(),
        1500
      ) as PushSubscription | null;
      context.hasExistingSubscription = Boolean(existing);

      context.existingSubscription = existing ? {
        endpointLength: existing.endpoint ? existing.endpoint.length : 0,
        expirationTime: existing.expirationTime ?? null
      } : null;

      try {
        const existingKey = existing?.getKey("p256dh");
        const existingAuth = existing?.getKey("auth");
        const baseSubscription =
          context.existingSubscription && typeof context.existingSubscription === 'object'
            ? context.existingSubscription
            : {};

        context.existingSubscription = {
          ...baseSubscription,
          p256dhLength: existingKey ? existingKey.byteLength : 0,
          authLength: existingAuth ? existingAuth.byteLength : 0,
        };
      } catch {
        const baseSubscription =
          context.existingSubscription && typeof context.existingSubscription === 'object'
            ? context.existingSubscription
            : {};

        context.existingSubscription = {
          ...baseSubscription,
          hasGetKeyError: true
        };
      }
    } catch (error) {
      context.serviceWorkerReadyError = String(error);
    }

    return context;
  };

  const parseErrorPayload = async (response: Response) => {
    try {
      const responseText = await response.text();
      try {
        const parsed = JSON.parse(responseText);
        if (parsed && typeof parsed === 'object') {
          const message =
            typeof parsed.error === 'string' ? parsed.error :
            typeof parsed.message === 'string' ? parsed.message :
            responseText;
          return { message, details: parsed };
        }
      } catch {
        return { message: responseText || `Request failed (${response.status})`, details: null };
      }
      return { message: responseText || `Request failed (${response.status})`, details: null };
    } catch {
      return { message: `Request failed (${response.status})`, details: null };
    }
  };

  const summarizePayloadForDebug = (payload: Record<string, unknown>) => {
    try {
      return JSON.stringify(payload, (_key, value) => {
        if (value instanceof Date) {
          return value.toISOString();
        }

        if (value instanceof PushSubscription) {
          return summarizePushSubscription(value);
        }

        return value;
      }, 2);
    } catch {
      return JSON.stringify({
        keys: Object.keys(payload),
        error: "Unable to stringify payload"
      });
    }
  };

  const clearStatusMessage = () => {
    setMessage("");
    setMessageType("info");
    setMessageDetails("");
  };

  const showStatusMessage = (
    text: string,
    type: "info" | "success" | "error" = "info",
    details = "",
    autoClearMs?: number
  ) => {
    setMessage(text);
    setMessageType(type);
    setMessageDetails(details);

    if (autoClearMs && autoClearMs > 0) {
      const snapshotText = text;
      const snapshotType = type;
      setTimeout(() => {
        if (message() === snapshotText && messageType() === snapshotType) {
          clearStatusMessage();
        }
      }, autoClearMs);
    }
  };

  const copyMessageDetails = async () => {
    const details = messageDetails();
    if (!details || typeof navigator === 'undefined' || !navigator.clipboard) return;

    try {
      await navigator.clipboard.writeText(details);
      setCopiedDetails(true);
      setTimeout(() => setCopiedDetails(false), 1200);
    } catch {
      // no-op
    }
  };

  const normalizeBase64 = (value: unknown): string | null => {
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

    if (Array.isArray(value)) {
      const bytes = new Uint8Array(value.length);
      for (let i = 0; i < value.length; i++) {
        const byte = value[i];
        if (typeof byte !== 'number' || !Number.isFinite(byte)) {
          return null;
        }

        const normalized = Math.max(0, Math.min(255, Math.floor(byte)));
        bytes[i] = normalized;
      }
      let binary = "";
      for (let i = 0; i < bytes.length; i++) {
        binary += String.fromCharCode(bytes[i]);
      }
      return btoa(binary);
    }

    return null;
  };

  const normalizePushSubscriptionPayload = (subscription: PushSubscription | null) => {
    if (!subscription) return null;

    const fromRaw = (rawValue: unknown) => {
      if (rawValue === undefined || rawValue === null) return null;

      if (typeof rawValue === 'string') {
        return rawValue || null;
      }

      return normalizeBase64(rawValue);
    };

    let value: Record<string, unknown> = {};

    try {
      if (typeof subscription.toJSON === 'function') {
        const jsonValue = subscription.toJSON();
        if (jsonValue && typeof jsonValue === 'object') {
          value = jsonValue as Record<string, unknown>;
        }
      }
    } catch {
      value = {};
    }

    const endpoint = typeof value.endpoint === 'string' && value.endpoint.length > 0
      ? value.endpoint
      : typeof subscription.endpoint === 'string'
        ? subscription.endpoint
        : null;

    const keys = typeof value.keys === 'object' && value.keys !== null ? value.keys as Record<string, unknown> : undefined;

    let p256dh =
      keys ? fromRaw(keys.p256dh) : null;

    if (!p256dh) {
      const fallback = (value as Record<string, unknown>).p256dh;
      p256dh = fromRaw(fallback);
    }

    if (!p256dh) {
      p256dh = fromRaw(subscription.getKey('p256dh'));
    }

    let auth =
      keys ? fromRaw(keys.auth) : null;

    if (!auth) {
      const fallback = (value as Record<string, unknown>).auth;
      auth = fromRaw(fallback);
    }

    if (!auth) {
      auth = fromRaw(subscription.getKey('auth'));
    }

    if (!endpoint || !p256dh || !auth) {
      return null;
    }

    const expirationTime = typeof value.expirationTime === 'number'
      ? value.expirationTime
      : typeof value.expirationTime === 'string'
        ? Number(value.expirationTime) || null
        : null;

    return {
      endpoint,
      expirationTime,
      keys: {
        p256dh,
        auth
      }
    };
  };

  const saveSettings = async (options?: {
    pushEnabled?: boolean;
    pushSub?: PushSubscription | null;
    includeTimezone?: boolean;
  }) => {
    if (!session()?.id) return;
    
    setSaving(true);
    clearStatusMessage();
    
    try {
      const hasPushOptions = options !== undefined;
      const pushEnabled = options?.pushEnabled ?? pushNotificationsEnabled();
      let pushSubFromOptions = options?.pushSub ?? null;

      if (hasPushOptions && pushEnabled && !pushSubFromOptions) {
        const registration = await waitForServiceWorkerReady(5000);

        if (!registration) {
          showStatusMessage(
            "Unable to save push settings",
            "error",
            "No push subscription object was provided and no active service worker registration was found."
          );
          setSaving(false);
          return;
        }

        const existing = await registration.pushManager.getSubscription();
        if (!existing) {
          showStatusMessage(
            "Unable to save push settings",
            "error",
            "No active push subscription was found in the service worker while enabling notifications."
          );
          setSaving(false);
          return;
        }

        pushSubFromOptions = existing;
      }

      const serializedPushSub = normalizePushSubscriptionPayload(pushSubFromOptions);

      if (hasPushOptions && pushEnabled && !serializedPushSub) {
        showStatusMessage(
          "Unable to serialize push subscription",
          "error",
          `Push subscription could not be normalized. Summary: ${JSON.stringify(
            summarizePushSubscription(pushSubFromOptions)
          )}`
        );
        setSaving(false);
        return;
      }

      const pushSubscription =
        !hasPushOptions
          ? undefined
          : pushEnabled === false
            ? null
            : serializedPushSub;

      const shouldIncludeTimezone = options?.includeTimezone !== false;

      const payload: Record<string, unknown> = {
        userId: session()?.id,
        notificationsEnabled: notificationsEnabled(),
        notificationEmails: notificationEmails(),
      };

      if (shouldIncludeTimezone && timezoneLoaded() && timezoneDirty()) {
        payload.timezone = timezone();
        setTimezoneDirty(false);
      }

      if (options !== undefined) {
        payload.pushNotificationsEnabled = pushEnabled;
        payload.pushSubscription = pushSubscription;
      }
      const payloadSummary = summarizePayloadForDebug(payload);
      console.log('Saving settings payload:', payloadSummary);
      
      const controller = new AbortController();
      const timeout = setTimeout(() => {
        controller.abort();
      }, 12000);

      const response = await fetch("/api/user-settings", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
        signal: controller.signal
      });

      clearTimeout(timeout);

      if (response.ok) {
        const result = await response.json();
        console.log('Save response:', result);
        showStatusMessage("Settings saved successfully!", "success", "", 3000);
      } else {
        const parsedError = await parseErrorPayload(response);
        console.error('Save failed:', parsedError);

          let debugDetails = "";
           if (hasPushOptions && pushEnabled) {
            const pushContext = await collectPushErrorContext({
              pushEnabled,
              pushSub: pushSubFromOptions,
              pushSubSerialized: pushSubscription
            });

            debugDetails = ` | Context: ${JSON.stringify(pushContext)}`;
          } else if (hasPushOptions && options?.pushEnabled === false) {
            debugDetails = " | Context: pushNotificationsEnabled=false (payload intentionally null)";
          }

            const details =
              (parsedError.details && typeof parsedError.details === 'object' && 'details' in (parsedError.details as Record<string, unknown>))
                ? ` Details: ${JSON.stringify((parsedError.details as { details?: unknown }).details)}`
                : '';

        showStatusMessage(
          `Failed to save settings: ${parsedError.message}`,
          "error",
          `Message: ${parsedError.message}\nStatus: ${response.status}\nDebug: ${payloadSummary}${debugDetails}${details}`
        );
      }
    } catch (error) {
      console.error('Save error:', error);
      if (error instanceof DOMException && error.name === "AbortError") {
        showStatusMessage("Error saving settings: request timed out while saving", "error");
      } else {
        showStatusMessage("Error saving settings", "error");
      }
    } finally {
      setSaving(false);
    }
  };

  const subscribeToPush = async (): Promise<{ success: boolean; subscription: PushSubscription | null }> => {
    try {
      if (!('serviceWorker' in navigator) || !('PushManager' in window)) {
        return { success: false, subscription: null };
      }

      if (typeof Notification === 'undefined') {
        return { success: false, subscription: null };
      }

      const permission = await Notification.requestPermission();
      setPushPermissionGranted(permission === 'granted');

      if (permission !== 'granted') {
        return { success: false, subscription: null };
      }

      const registration = await waitForServiceWorkerReady(8000);
      if (!registration) {
        return { success: false, subscription: null };
      }
      const existing = await registration.pushManager.getSubscription();
      if (existing) {
        const existingPayload = normalizePushSubscriptionPayload(existing);
        if (existingPayload) {
          return { success: true, subscription: existing };
        }

        await existing.unsubscribe();
      }

      const keyResponse = await fetch('/api/push/vapid-public-key');
      if (!keyResponse.ok) {
        return { success: false, subscription: null };
      }

      const keyData = await keyResponse.json();
      if (!keyData?.success || !keyData.publicKey) {
        return { success: false, subscription: null };
      }

      const subscription = await registration.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(keyData.publicKey)
      });

      const normalized = normalizePushSubscriptionPayload(subscription);
      if (!normalized) {
        await subscription.unsubscribe();
        return { success: false, subscription: null };
      }

      return { success: true, subscription };
    } catch (error) {
      console.error('Failed to subscribe to push notifications:', error);
      return { success: false, subscription: null };
    }
  };

  const togglePushNotifications = async (enabled: boolean) => {
    if (!isPwa()) {
      showStatusMessage("Push notifications can only be enabled in installed PWA mode", "error");
      return;
    }

    setPushNotificationsEnabled(enabled);

    if (!enabled) {
      const registration = await waitForServiceWorkerReady(8000);
      if (!registration) {
        showStatusMessage("Service worker not available yet. Please try again in a moment.", "error");
        return;
      }
      const existing = await registration.pushManager.getSubscription();
      if (existing) {
        await existing.unsubscribe();
      }
      await saveSettings({ pushEnabled: false, pushSub: null, includeTimezone: false });
      return;
    }

    const { success, subscription } = await subscribeToPush();
    if (!success || !subscription) {
      setPushNotificationsEnabled(false);
      showStatusMessage("Enable browser notifications to receive push reminders", "error");
      return;
    }

    await saveSettings({
      pushEnabled: true,
      pushSub: subscription,
      includeTimezone: false
    });
  };

  const addEmail = () => {
    const email = newEmail().trim();
    if (email && !notificationEmails().includes(email)) {
      setNotificationEmails([...notificationEmails(), email]);
      setNewEmail("");
    }
  };

  const removeEmail = (emailToRemove: string) => {
    setNotificationEmails(notificationEmails().filter(email => email !== emailToRemove));
  };

  return (
    <div class="min-h-screen" style={{"background-color": "var(--bg-primary)"}}>
      <Header />
      
      {/* Navigation and Page Title */}
      <div 
        class="border-b p-4"
        style={{
          "background-color": "var(--bg-secondary)",
          "border-color": "var(--border-color)"
        }}
      >
        <div class="flex items-center gap-4 max-w-4xl mx-auto">
          <A 
            href="/" 
            class="transition-colors"
            style={{"color": "var(--text-secondary)"}}
            onmouseover={(e) => e.currentTarget.style.color = "var(--text-primary)"}
            onmouseout={(e) => e.currentTarget.style.color = "var(--text-secondary)"}
          >
            ← Back
          </A>
          <h1 class="text-xl font-bold" style={{"color": "var(--text-primary)"}}>
            Notification Settings
          </h1>
        </div>
      </div>
      
      <div class="container mx-auto px-4 py-8 max-w-2xl">

        <Show when={session()} fallback={
          <div class="text-center" style={{"color": "var(--text-secondary)"}}>
            Please log in to access settings
          </div>
        }>
            <div class="space-y-6">
              <Show when={isPwa()}>
                <div class="p-6 rounded-lg" style={{"background-color": "var(--bg-secondary)"}}>
                  <div class="flex items-center justify-between">
                    <div>
                      <h3 class="text-lg font-medium" style={{"color": "var(--text-primary)"}}>
                        Push Notifications
                      </h3>
                      <p class="text-sm" style={{"color": "var(--text-secondary)"}}>
                        Receive reminders directly on this device when your phase changes, ovulation or period is near
                      </p>
                    </div>
                    <label class="relative inline-flex items-center cursor-pointer">
                      <input
                        type="checkbox"
                        class="sr-only peer"
                        checked={pushNotificationsEnabled()}
                        onChange={(e) => togglePushNotifications(e.currentTarget.checked)}
                      />
                      <div class="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-blue-300 dark:peer-focus:ring-blue-800 rounded-full peer dark:bg-gray-700 peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all dark:border-gray-600 peer-checked:bg-blue-600"></div>
                    </label>
                  </div>
                  <Show when={pushPermissionGranted() === false}>
                    <p class="text-sm mt-3" style={{"color": "var(--text-secondary)"}}>
                      Allow notifications in your browser/device settings to receive push alerts.
                    </p>
                  </Show>
                  <Show when={pushNotificationsEnabled() && isPwa()}>
                    <p class="text-sm mt-3" style={{"color": "var(--text-secondary)"}}>
                      Push reminders are now enabled for this device.
                    </p>
                  </Show>
                </div>
              </Show>

              {/* Email Notifications Toggle */}
              <div class="p-6 rounded-lg" style={{"background-color": "var(--bg-secondary)"}}>
              <div class="flex items-center justify-between">
                <div>
                  <h3 class="text-lg font-medium" style={{"color": "var(--text-primary)"}}>
                    Email Notifications
                  </h3>
                  <p class="text-sm" style={{"color": "var(--text-secondary)"}}>
                    Receive email reminders for ovulation and upcoming periods
                  </p>
                </div>
                <label class="relative inline-flex items-center cursor-pointer">
                  <input
                    type="checkbox"
                    class="sr-only peer"
                    checked={notificationsEnabled()}
                    onChange={(e) => setNotificationsEnabled(e.target.checked)}
                  />
                  <div class="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-blue-300 dark:peer-focus:ring-blue-800 rounded-full peer dark:bg-gray-700 peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all dark:border-gray-600 peer-checked:bg-blue-600"></div>
                </label>
              </div>
            </div>

            {/* Timezone Setting */}
            <div class="p-6 rounded-lg" style={{"background-color": "var(--bg-secondary)"}}>
              <h3 class="text-lg font-medium mb-4" style={{"color": "var(--text-primary)"}}>
                Timezone
              </h3>
              <p class="text-sm mb-4" style={{"color": "var(--text-secondary)"}}>
                Set your timezone for accurate predictions and notifications
              </p>
                <select
                  value={timezone()}
                  onChange={(e) => {
                    setTimezone(e.target.value);
                    setTimezoneDirty(true);
                  }}
                  class="w-full px-3 py-2 border rounded-md"
                style={{
                  "background-color": "var(--bg-primary)",
                  "border-color": "var(--border-color)",
                  "color": "var(--text-primary)"
                }}
              >
                <optgroup label="US & Canada">
                  <option value="America/New_York">Eastern Time</option>
                  <option value="America/Chicago">Central Time</option>
                  <option value="America/Denver">Mountain Time</option>
                  <option value="America/Phoenix">Arizona</option>
                  <option value="America/Los_Angeles">Pacific Time</option>
                  <option value="America/Anchorage">Alaska</option>
                  <option value="Pacific/Honolulu">Hawaii</option>
                </optgroup>
                <optgroup label="Europe">
                  <option value="Europe/London">London (GMT)</option>
                  <option value="Europe/Paris">Paris (CET)</option>
                  <option value="Europe/Berlin">Berlin (CET)</option>
                  <option value="Europe/Rome">Rome (CET)</option>
                  <option value="Europe/Madrid">Madrid (CET)</option>
                  <option value="Europe/Athens">Athens (EET)</option>
                </optgroup>
                <optgroup label="Asia">
                  <option value="Asia/Dubai">Dubai</option>
                  <option value="Asia/Kolkata">India</option>
                  <option value="Asia/Bangkok">Bangkok</option>
                  <option value="Asia/Singapore">Singapore</option>
                  <option value="Asia/Hong_Kong">Hong Kong</option>
                  <option value="Asia/Tokyo">Tokyo</option>
                  <option value="Asia/Seoul">Seoul</option>
                </optgroup>
                <optgroup label="Australia & Pacific">
                  <option value="Australia/Sydney">Sydney</option>
                  <option value="Australia/Melbourne">Melbourne</option>
                  <option value="Australia/Perth">Perth</option>
                  <option value="Pacific/Auckland">Auckland</option>
                </optgroup>
                <optgroup label="Other">
                  <option value="UTC">UTC</option>
                </optgroup>
              </select>
            </div>

            {/* Additional Email Addresses */}
            <Show when={notificationsEnabled()}>
              <div class="p-6 rounded-lg" style={{"background-color": "var(--bg-secondary)"}}>
                <h3 class="text-lg font-medium mb-4" style={{"color": "var(--text-primary)"}}>
                  Additional Email Addresses
                </h3>
                <p class="text-sm mb-4" style={{"color": "var(--text-secondary)"}}>
                  Add extra email addresses to receive notifications (e.g., partner, family member)
                </p>

                {/* Current emails list */}
                <Show when={notificationEmails().length > 0}>
                  <div class="mb-4 space-y-2">
                    <For each={notificationEmails()}>
                      {(email) => (
                        <div class="flex items-center justify-between p-3 rounded border" style={{"background-color": "var(--bg-primary)", "border-color": "var(--border-color)"}}>
                          <span style={{"color": "var(--text-primary)"}}>{email}</span>
                          <button
                            onClick={() => removeEmail(email)}
                            class="text-red-600 hover:text-red-800 transition-colors"
                          >
                            Remove
                          </button>
                        </div>
                      )}
                    </For>
                  </div>
                </Show>

                {/* Add new email */}
                <div class="flex gap-2">
                  <input
                    type="email"
                    placeholder="Enter email address"
                    value={newEmail()}
                    onInput={(e) => setNewEmail(e.target.value)}
                    class="flex-1 px-3 py-2 border rounded-md"
                    style={{
                      "background-color": "var(--bg-primary)",
                      "border-color": "var(--border-color)",
                      "color": "var(--text-primary)"
                    }}
                  />
                  <button
                    onClick={addEmail}
                    disabled={!newEmail().trim()}
                    class="px-4 py-2 text-white rounded-md transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                    style={{"background-color": "var(--accent-color)"}}
                    onmouseover={(e) => {
                      if (!e.currentTarget.disabled) {
                        e.currentTarget.style.opacity = "0.9";
                      }
                    }}
                    onmouseout={(e) => {
                      e.currentTarget.style.opacity = "1";
                    }}
                  >
                    Add
                  </button>
                </div>
              </div>
            </Show>

            {/* Save button */}
            <div class="flex items-center justify-between">
              <button
                onClick={saveSettings}
                disabled={saving()}
                class="px-6 py-2 text-white rounded-md transition-colors disabled:opacity-50"
                style={{"background-color": "var(--success-color)"}}
                onmouseover={(e) => {
                  if (!e.currentTarget.disabled) {
                    e.currentTarget.style.opacity = "0.9";
                  }
                }}
                onmouseout={(e) => {
                  e.currentTarget.style.opacity = "1";
                }}
              >
                {saving() ? "Saving..." : "Save Settings"}
              </button>
              
              <Show when={message()}>
                <div
                  class="text-sm max-w-xl"
                  style={{
                    "background-color": "var(--bg-primary)",
                    "border": "1px solid var(--border-color)",
                    "border-left": `4px solid ${messageType() === 'success' ? 'var(--success-color)' : 'var(--error-color)'}`,
                    "color": messageType() === 'success' ? 'var(--success-color)' : 'var(--error-color)' ,
                    "padding": "0.6rem",
                    "border-radius": "0.5rem",
                    "white-space": "pre-wrap"
                  }}
                >
                  <div class="flex items-start justify-between gap-2">
                    <div style={{"color": messageType() === 'success' ? 'var(--success-color)' : 'var(--text-primary)'}}>
                      {message()}
                    </div>
                    <button
                      onClick={clearStatusMessage}
                      class="text-xs"
                      style={{"color": "var(--text-secondary)"}}
                    >
                      Dismiss
                    </button>
                  </div>

                  <Show when={messageType() === 'error' && messageDetails()}>
                    <div class="mt-2">
                      <details class="text-xs">
                        <summary style={{"color": "var(--text-secondary)", "cursor": "pointer"}}>
                          Technical details (tap to expand)
                        </summary>
                        <pre
                          class="text-xs mt-2 max-h-56 overflow-auto p-2"
                          style={{
                            "background-color": "var(--bg-secondary)",
                            "white-space": "pre-wrap",
                            "word-break": "break-word"
                          }}
                        >
                          {messageDetails()}
                        </pre>
                      </details>
                      <div class="flex items-center justify-end gap-2 mt-2">
                        <button
                          onClick={copyMessageDetails}
                          class="text-xs"
                          style={{"color": "var(--accent-color)"}}
                        >
                          Copy details
                        </button>
                        <Show when={copiedDetails()}>
                          <span class="text-xs" style={{"color": "var(--success-color)"}}>Copied</span>
                        </Show>
                      </div>
                    </div>
                  </Show>
                </div>
              </Show>
            </div>
          </div>
        </Show>
      </div>
    </div>
  );
}
