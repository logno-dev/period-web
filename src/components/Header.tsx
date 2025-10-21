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
          <h1
            class="text-xl font-bold"
            style={{ "color": "var(--text-primary)" }}
          >
            Period Tracker
          </h1>
        </div>
        
        <ThemeToggle />
      </div>
    </header>
  );
}