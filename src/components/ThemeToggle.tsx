import { useTheme } from "~/contexts/ThemeContext";
import { createSignal, Show } from "solid-js";

export default function ThemeToggle() {
  const { theme, setTheme, resolvedTheme } = useTheme();
  const [isDropdownOpen, setIsDropdownOpen] = createSignal(false);

  const getThemeIcon = () => {
    const resolved = resolvedTheme();
    if (resolved === "dark") {
      return "🌙";
    }
    return "☀️";
  };

  const getThemeLabel = () => {
    const currentTheme = theme();
    switch (currentTheme) {
      case "light": return "Light";
      case "dark": return "Dark";
      case "system": return "System";
      default: return "System";
    }
  };

  const handleThemeSelect = (newTheme: "light" | "dark" | "system") => {
    setTheme(newTheme);
    setIsDropdownOpen(false);
  };

  return (
    <div class="relative">
      <button
        onclick={() => setIsDropdownOpen(!isDropdownOpen())}
        class="flex items-center space-x-2 px-3 py-2 rounded-lg transition-colors duration-200"
        style={{
          "background-color": "var(--bg-secondary)",
          "border": "1px solid var(--border-color)",
          "color": "var(--text-primary)"
        }}
        title={`Current theme: ${getThemeLabel()}`}
      >
        <span class="text-lg">{getThemeIcon()}</span>
        <span class="text-sm font-medium">{getThemeLabel()}</span>
        <svg
          class="w-4 h-4 transition-transform duration-200"
          classList={{ "rotate-180": isDropdownOpen() }}
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 9l-7 7-7-7" />
        </svg>
      </button>

      <Show when={isDropdownOpen()}>
        <div
          class="absolute right-0 mt-2 w-32 rounded-lg shadow-lg border z-50"
          style={{
            "background-color": "var(--modal-bg)",
            "border-color": "var(--border-color)"
          }}
        >
          <div class="py-1">
            <button
              onclick={() => handleThemeSelect("light")}
              class="w-full px-4 py-2 text-left text-sm transition-colors duration-200 flex items-center space-x-2"
              classList={{ "font-semibold": theme() === "light" }}
              style={{
                "color": "var(--text-primary)",
                "background-color": theme() === "light" ? "var(--bg-secondary)" : "transparent"
              }}
              onmouseover={(e) => {
                if (theme() !== "light") {
                  e.currentTarget.style.backgroundColor = "var(--bg-secondary)";
                }
              }}
              onmouseout={(e) => {
                if (theme() !== "light") {
                  e.currentTarget.style.backgroundColor = "transparent";
                }
              }}
            >
              <span>☀️</span>
              <span>Light</span>
            </button>
            <button
              onclick={() => handleThemeSelect("dark")}
              class="w-full px-4 py-2 text-left text-sm transition-colors duration-200 flex items-center space-x-2"
              classList={{ "font-semibold": theme() === "dark" }}
              style={{
                "color": "var(--text-primary)",
                "background-color": theme() === "dark" ? "var(--bg-secondary)" : "transparent"
              }}
              onmouseover={(e) => {
                if (theme() !== "dark") {
                  e.currentTarget.style.backgroundColor = "var(--bg-secondary)";
                }
              }}
              onmouseout={(e) => {
                if (theme() !== "dark") {
                  e.currentTarget.style.backgroundColor = "transparent";
                }
              }}
            >
              <span>🌙</span>
              <span>Dark</span>
            </button>
            <button
              onclick={() => handleThemeSelect("system")}
              class="w-full px-4 py-2 text-left text-sm transition-colors duration-200 flex items-center space-x-2"
              classList={{ "font-semibold": theme() === "system" }}
              style={{
                "color": "var(--text-primary)",
                "background-color": theme() === "system" ? "var(--bg-secondary)" : "transparent"
              }}
              onmouseover={(e) => {
                if (theme() !== "system") {
                  e.currentTarget.style.backgroundColor = "var(--bg-secondary)";
                }
              }}
              onmouseout={(e) => {
                if (theme() !== "system") {
                  e.currentTarget.style.backgroundColor = "transparent";
                }
              }}
            >
              <span>🖥️</span>
              <span>System</span>
            </button>
          </div>
        </div>
      </Show>

      <Show when={isDropdownOpen()}>
        <div
          class="fixed inset-0 z-40"
          onclick={() => setIsDropdownOpen(false)}
        />
      </Show>
    </div>
  );
}