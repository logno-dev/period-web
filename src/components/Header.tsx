import { A } from "@solidjs/router";
import { Show } from "solid-js";
import { logout } from "~/auth";
import { useAuth } from "~/components/Context";
import ThemeToggle from "./ThemeToggle";

export default function Header() {
  const { session } = useAuth();

  return (
    <header
      class="sticky top-0 z-30 border-b px-4 py-3"
      style={{
        "background-color": "var(--bg-primary)",
        "border-color": "var(--border-color)"
      }}
    >
      <div class="flex items-center justify-between max-w-4xl mx-auto">
        <div class="flex items-center space-x-3">
          <A href="/">
            <h1
              class="text-xl font-bold hover:opacity-80 transition-opacity"
              style={{ "color": "var(--text-primary)" }}
            >
              PT
            </h1>
          </A>
        </div>
        
        <div class="flex items-center space-x-3">
          <A
            href="/stats"
            class="p-2 rounded-full transition-colors"
            style={{
              "background-color": "var(--bg-secondary)",
              "border": "1px solid var(--border-color)",
              "color": "var(--text-primary)"
            }}
            title="Stats"
            aria-label="Stats"
          >
            <svg
              xmlns="http://www.w3.org/2000/svg"
              width="18"
              height="18"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              stroke-width="2"
              stroke-linecap="round"
              stroke-linejoin="round"
            >
              <path d="M3 3v18h18" />
              <path d="M7 15v4" />
              <path d="M12 11v8" />
              <path d="M17 7v12" />
            </svg>
          </A>
          <A
            href="/settings"
            class="p-2 rounded-full transition-colors"
            style={{
              "background-color": "var(--bg-secondary)",
              "border": "1px solid var(--border-color)",
              "color": "var(--text-primary)"
            }}
            title="Settings"
            aria-label="Settings"
          >
            <svg
              xmlns="http://www.w3.org/2000/svg"
              width="18"
              height="18"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              stroke-width="2"
              stroke-linecap="round"
              stroke-linejoin="round"
            >
              <path d="M12.22 2h-.44a2 2 0 0 0-2 2v.18a2 2 0 0 1-1 1.73l-.43.25a2 2 0 0 1-2 0l-.15-.08a2 2 0 0 0-2.73.73l-.22.38a2 2 0 0 0 .73 2.73l.15.1a2 2 0 0 1 1 1.72v.51a2 2 0 0 1-1 1.74l-.15.09a2 2 0 0 0-.73 2.73l.22.38a2 2 0 0 0 2.73.73l.15-.08a2 2 0 0 1 2 0l.43.25a2 2 0 0 1 1 1.73V20a2 2 0 0 0 2 2h.44a2 2 0 0 0 2-2v-.18a2 2 0 0 1 1-1.73l.43-.25a2 2 0 0 1 2 0l.15.08a2 2 0 0 0 2.73-.73l.22-.39a2 2 0 0 0-.73-2.73l-.15-.08a2 2 0 0 1-1-1.74v-.5a2 2 0 0 1 1-1.74l.15-.09a2 2 0 0 0 .73-2.73l-.22-.38a2 2 0 0 0-2.73-.73l-.15.08a2 2 0 0 1-2 0l-.43-.25a2 2 0 0 1-1-1.73V4a2 2 0 0 0-2-2z"/>
              <circle cx="12" cy="12" r="3"/>
            </svg>
          </A>
          <ThemeToggle />
          <Show when={session()?.id}>
            <form action={logout} method="post">
              <button
                type="submit"
                class="p-2 rounded-full transition-colors"
                style={{
                  "background-color": "var(--bg-secondary)",
                  "border": "1px solid var(--border-color)",
                  "color": "var(--text-primary)"
                }}
                title="Sign Out"
                aria-label="Sign Out"
              >
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  width="18"
                  height="18"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  stroke-width="2"
                  stroke-linecap="round"
                  stroke-linejoin="round"
                >
                  <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
                  <path d="M16 17l5-5-5-5" />
                  <path d="M21 12H9" />
                </svg>
              </button>
            </form>
          </Show>
        </div>
      </div>
    </header>
  );
}
