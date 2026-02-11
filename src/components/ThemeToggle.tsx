import Moon from "lucide-solid/icons/moon";
import Sun from "lucide-solid/icons/sun";
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
        <Sun size={18} color="#f59e0b" />
      ) : (
        <Moon size={18} color="#1e293b" />
      )}
    </button>
  );
}
