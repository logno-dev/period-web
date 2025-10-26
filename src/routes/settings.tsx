import { createSignal, createResource, For, Show } from "solid-js";
import { A } from "@solidjs/router";
import { useAuth } from "../components/Context";
import Header from "../components/Header";

export default function Settings() {
  const { session } = useAuth();
  const [notificationsEnabled, setNotificationsEnabled] = createSignal(true);
  const [notificationEmails, setNotificationEmails] = createSignal<string[]>([]);
  const [newEmail, setNewEmail] = createSignal("");
  const [saving, setSaving] = createSignal(false);
  const [message, setMessage] = createSignal("");

  // Load current settings
  const [userSettings] = createResource(
    () => session()?.id,
    async (userId) => {
      if (!userId) return null;
      const response = await fetch(`/api/user-settings?userId=${userId}`);
      if (response.ok) {
        const data = await response.json();
        setNotificationsEnabled(data.notificationsEnabled);
        setNotificationEmails(data.notificationEmails || []);
        return data;
      }
      return null;
    }
  );

  const saveSettings = async () => {
    if (!session()?.id) return;
    
    setSaving(true);
    setMessage("");
    
    try {
      const response = await fetch("/api/user-settings", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          userId: session()?.id,
          notificationsEnabled: notificationsEnabled(),
          notificationEmails: notificationEmails()
        })
      });

      if (response.ok) {
        setMessage("Settings saved successfully!");
        setTimeout(() => setMessage(""), 3000);
      } else {
        setMessage("Failed to save settings");
      }
    } catch (error) {
      setMessage("Error saving settings");
    } finally {
      setSaving(false);
    }
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