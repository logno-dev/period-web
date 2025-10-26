import { A } from "@solidjs/router";
import ThemeToggle from "./ThemeToggle";

export default function Header() {
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
              Period Tracker
            </h1>
          </A>
        </div>
        
        <div class="flex items-center space-x-4">
          <A
            href="/settings"
            class="p-2 rounded-full transition-colors hover:bg-gray-100 dark:hover:bg-gray-700"
            title="Settings"
          >
            <svg
              xmlns="http://www.w3.org/2000/svg"
              width="20"
              height="20"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              stroke-width="2"
              stroke-linecap="round"
              stroke-linejoin="round"
              style={{ "color": "var(--text-secondary)" }}
            >
              <path d="M12.22 2h-.44a2 2 0 0 0-2 2v.18a2 2 0 0 1-1 1.73l-.43.25a2 2 0 0 1-2 0l-.15-.08a2 2 0 0 0-2.73.73l-.22.38a2 2 0 0 0 .73 2.73l.15.1a2 2 0 0 1 1 1.72v.51a2 2 0 0 1-1 1.74l-.15.09a2 2 0 0 0-.73 2.73l.22.38a2 2 0 0 0 2.73.73l.15-.08a2 2 0 0 1 2 0l.43.25a2 2 0 0 1 1 1.73V20a2 2 0 0 0 2 2h.44a2 2 0 0 0 2-2v-.18a2 2 0 0 1 1-1.73l.43-.25a2 2 0 0 1 2 0l.15.08a2 2 0 0 0 2.73-.73l.22-.39a2 2 0 0 0-.73-2.73l-.15-.08a2 2 0 0 1-1-1.74v-.5a2 2 0 0 1 1-1.74l.15-.09a2 2 0 0 0 .73-2.73l-.22-.38a2 2 0 0 0-2.73-.73l-.15.08a2 2 0 0 1-2 0l-.43-.25a2 2 0 0 1-1-1.73V4a2 2 0 0 0-2-2z"/>
              <circle cx="12" cy="12" r="3"/>
            </svg>
          </A>
          <ThemeToggle />
        </div>
      </div>
    </header>
  );
}