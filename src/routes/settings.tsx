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
  const [isPwa, setIsPwa] = createSignal(false);
  const [pushPermissionGranted, setPushPermissionGranted] = createSignal(false);
  const [newEmail, setNewEmail] = createSignal("");
  const [saving, setSaving] = createSignal(false);
  const [message, setMessage] = createSignal("");

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
        if (response.ok) {
          const data = await response.json();
          console.log('Loaded user settings:', data);
          setNotificationsEnabled(data.notificationsEnabled);
          setPushNotificationsEnabled(data.pushNotificationsEnabled);
          setNotificationEmails(data.notificationEmails || []);
          setTimezone(data.timezone || "America/Los_Angeles");
          console.log('Timezone set to:', data.timezone || "America/Los_Angeles");
        return data;
      }
      return null;
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

  const saveSettings = async (options?: {
    pushEnabled?: boolean;
    pushSub?: PushSubscription | null;
  }) => {
    if (!session()?.id) return;
    
    setSaving(true);
    setMessage("");
    
    try {
      const normalizeBase64 = (value: ArrayBuffer | null): string | null => {
      if (!value) return null;
      const bytes = new Uint8Array(value);
      let binary = "";
      for (let i = 0; i < bytes.length; i++) {
        binary += String.fromCharCode(bytes[i]);
      }
      return btoa(binary);
    };

      const normalizePushSubscriptionPayload = (subscription: PushSubscription | null) => {
      if (!subscription) return null;

      if (typeof subscription.toJSON === "function") {
        const value = subscription.toJSON();
        const keys = value?.keys as Record<string, unknown> | undefined;
        const p256dh =
          typeof keys?.p256dh === 'string' ? keys.p256dh : null;
        const auth =
          typeof keys?.auth === 'string' ? keys.auth : null;

        if (
          value?.endpoint &&
          typeof p256dh === 'string' &&
          p256dh.length > 0 &&
          typeof auth === 'string' &&
          auth.length > 0
        ) {
          return {
            endpoint: value.endpoint,
            expirationTime: value.expirationTime ?? null,
            keys: {
              p256dh,
              auth,
            },
          };
        }
      }

      const p256dh =
        normalizeBase64(subscription.getKey("p256dh"));
      const auth =
        normalizeBase64(subscription.getKey("auth"));

      if (!subscription.endpoint || !p256dh || !auth) {
        return null;
      }

      return {
        endpoint: subscription.endpoint,
        expirationTime: subscription.expirationTime,
        keys: { p256dh, auth }
      };
    };

      const hasPushOptions = options !== undefined;
      const serializedPushSub = normalizePushSubscriptionPayload(options?.pushSub ?? null);

      if (options?.pushEnabled === true && options?.pushSub && !serializedPushSub) {
        setMessage("Unable to serialize push subscription");
        setSaving(false);
        return;
      }
      const pushSubscription =
        !hasPushOptions
          ? undefined
          : options?.pushEnabled === false
            ? null
            : serializedPushSub;

      const payload: Record<string, unknown> = {
        userId: session()?.id,
        notificationsEnabled: notificationsEnabled(),
        notificationEmails: notificationEmails(),
        timezone: timezone()
      };

      if (options !== undefined) {
        payload.pushNotificationsEnabled = options?.pushEnabled ?? pushNotificationsEnabled();
        payload.pushSubscription = pushSubscription;
      }
      console.log('Saving settings:', payload);
      
      const response = await fetch("/api/user-settings", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload)
      });

      if (response.ok) {
        const result = await response.json();
        console.log('Save response:', result);
        setMessage("Settings saved successfully!");
        setTimeout(() => setMessage(""), 3000);
      } else {
        const errorText = await response.text();
        console.error('Save failed:', errorText);
        setMessage(`Failed to save settings: ${errorText || "Request rejected"}`);
      }
    } catch (error) {
      console.error('Save error:', error);
      setMessage("Error saving settings");
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

      const registration = await navigator.serviceWorker.ready;
      const existing = await registration.pushManager.getSubscription();
      if (existing) {
        return { success: true, subscription: existing };
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

      return { success: true, subscription };
    } catch (error) {
      console.error('Failed to subscribe to push notifications:', error);
      return { success: false, subscription: null };
    }
  };

  const togglePushNotifications = async (enabled: boolean) => {
    if (!isPwa()) {
      setMessage("Push notifications can only be enabled in installed PWA mode");
      return;
    }

    setPushNotificationsEnabled(enabled);

    if (!enabled) {
      const registration = await navigator.serviceWorker.ready;
      const existing = await registration.pushManager.getSubscription();
      if (existing) {
        await existing.unsubscribe();
      }
      await saveSettings({ pushEnabled: false, pushSub: null });
      return;
    }

    const { success, subscription } = await subscribeToPush();
    if (!success || !subscription) {
      setPushNotificationsEnabled(false);
      setMessage("Enable browser notifications to receive push reminders");
      return;
    }

    await saveSettings({
      pushEnabled: true,
      pushSub: subscription
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
                onChange={(e) => setTimezone(e.target.value)}
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
                <div class={`text-sm ${message().includes("success") ? "text-green-600" : "text-red-600"}`}>
                  {message()}
                </div>
              </Show>
            </div>
          </div>
        </Show>
      </div>
    </div>
  );
}
