import { useTheme } from "~/contexts/ThemeContext";

export default function ThemeToggle() {
  const { setTheme, resolvedTheme } = useTheme();

  const isDark = () => resolvedTheme() === "dark";

  const toggleTheme = () => {
    const resolved = resolvedTheme();
    if (resolved === "dark") {
      setTheme("light");
    } else {
      setTheme("dark");
    }
  };

  return (
    <button
      onclick={toggleTheme}
      class="flex items-center justify-center p-2 rounded-full transition-colors duration-200"
      style={{
        "background-color": "var(--bg-secondary)",
        "border": "1px solid var(--border-color)",
        "color": "var(--text-primary)"
      }}
      title={`Switch to ${resolvedTheme() === "dark" ? "light" : "dark"} mode`}
      aria-label="Toggle theme"
    >
      {isDark() ? (
        <svg
          xmlns="http://www.w3.org/2000/svg"
          width="18"
          height="18"
          viewBox="0 0 24 24"
          aria-hidden="true"
        >
          <circle cx="12" cy="12" r="5" fill="#f59e0b" />
          <g fill="#f59e0b">
            <rect x="11" y="1" width="2" height="4" rx="1" />
            <rect x="11" y="19" width="2" height="4" rx="1" />
            <rect x="1" y="11" width="4" height="2" rx="1" />
            <rect x="19" y="11" width="4" height="2" rx="1" />
            <rect x="3.2" y="3.2" width="2" height="4" rx="1" transform="rotate(-45 4.2 5.2)" />
            <rect x="18.8" y="16.8" width="2" height="4" rx="1" transform="rotate(-45 19.8 18.8)" />
            <rect x="16.8" y="3.2" width="4" height="2" rx="1" transform="rotate(45 18.8 4.2)" />
            <rect x="3.2" y="18.8" width="4" height="2" rx="1" transform="rotate(45 5.2 19.8)" />
          </g>
        </svg>
      ) : (
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
          aria-hidden="true"
        >
          <path d="M20.985 12.486a9 9 0 1 1-9.473-9.472c.405-.022.617.46.402.803a6 6 0 0 0 8.268 8.268c.344-.215.825-.004.803.401" />
        </svg>
      )}
    </button>
  );
}
