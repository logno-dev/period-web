import { createContext, useContext, createSignal, createEffect, ParentComponent } from "solid-js";
import { isServer } from "solid-js/web";

type Theme = "light" | "dark" | "system";

interface ThemeContextType {
  theme: () => Theme;
  resolvedTheme: () => "light" | "dark";
  setTheme: (theme: Theme) => void;
}

const ThemeContext = createContext<ThemeContextType>();

function getSystemTheme(): "light" | "dark" {
  if (isServer) return "light";
  return window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light";
}

function getStoredTheme(): Theme {
  if (isServer) return "system";
  const stored = localStorage.getItem("theme");
  if (stored === "light" || stored === "dark" || stored === "system") {
    return stored;
  }
  return "system";
}

export const ThemeProvider: ParentComponent = (props) => {
  const [theme, setTheme] = createSignal<Theme>(getStoredTheme());
  const [systemTheme, setSystemTheme] = createSignal<"light" | "dark">(getSystemTheme());

  const resolvedTheme = (): "light" | "dark" => {
    return theme() === "system" ? systemTheme() : theme() as "light" | "dark";
  };

  createEffect(() => {
    if (isServer) return;
    
    // Listen to system theme changes
    const mediaQuery = window.matchMedia("(prefers-color-scheme: dark)");
    const handleChange = (e: MediaQueryListEvent) => {
      setSystemTheme(e.matches ? "dark" : "light");
    };
    
    mediaQuery.addEventListener("change", handleChange);
    return () => mediaQuery.removeEventListener("change", handleChange);
  });

  createEffect(() => {
    if (isServer) return;
    
    // Apply theme to document
    const resolved = resolvedTheme();
    document.documentElement.classList.toggle("dark", resolved === "dark");
    
    // Store theme preference
    localStorage.setItem("theme", theme());
  });

  const handleSetTheme = (newTheme: Theme) => {
    setTheme(newTheme);
  };

  const contextValue: ThemeContextType = {
    theme,
    resolvedTheme,
    setTheme: handleSetTheme,
  };

  return (
    <ThemeContext.Provider value={contextValue}>
      {props.children}
    </ThemeContext.Provider>
  );
};

export function useTheme() {
  const context = useContext(ThemeContext);
  if (!context) {
    throw new Error("useTheme must be used within a ThemeProvider");
  }
  return context;
}