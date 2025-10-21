import { Title } from "@solidjs/meta";
import { createResource, Show, createSignal, createEffect } from "solid-js";
import { A } from "@solidjs/router";
import { useAuth } from "~/components/Context";
import Header from "~/components/Header";
import StatsWidget from "~/components/StatsWidget";
import { Period } from "~/types/period";

export default function Stats() {
  const { session } = useAuth();
  
  // Track if we're on the client to prevent hydration mismatch
  const [isClient, setIsClient] = createSignal(false);
  
  createEffect(() => {
    setIsClient(true);
  });

  // Create a resource for periods data
  const [periods] = createResource(
    () => {
      // Only fetch on client side and when user is logged in
      if (typeof window === 'undefined') return null;
      return session()?.id;
    },
    async (userId) => {
      if (!userId) return [];
      
      // Simple relative URL works fine on client side
      const response = await fetch('/api/periods');
      
      if (!response.ok) {
        if (response.status === 401) {
          return [];
        }
        throw new Error(`Failed to fetch periods: ${response.status}`);
      }
      
      const data = await response.json();
      return data.periods || [];
    }
  );




  return (
    <main class="min-h-screen" style={{"background-color": "var(--bg-primary)"}}>
      <Title>Statistics - Period Tracker</Title>
      
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
            Period Statistics
          </h1>
        </div>
      </div>

      <Show when={isClient() && periods.loading}>
        <div class="flex items-center justify-center py-12">
          <div class="text-center">
            <div 
              class="animate-spin rounded-full h-12 w-12 border-b-2 mx-auto mb-4"
              style={{"border-color": "var(--accent-color)"}}
            ></div>
            <p style={{"color": "var(--text-secondary)"}}>Loading statistics...</p>
          </div>
        </div>
      </Show>

      <Show when={isClient() && periods.error}>
        <div 
          class="border rounded-lg p-4 mx-5 mt-4"
          style={{
            "background-color": "var(--bg-secondary)",
            "border-color": "var(--error-color)"
          }}
        >
          <p class="text-center" style={{"color": "var(--error-color)"}}>
            Failed to load statistics: {periods.error?.message}
          </p>
        </div>
      </Show>

      <Show when={isClient() && !periods.loading && !periods.error}>
        <div class="p-5 max-w-4xl mx-auto">
          <StatsWidget 
            periods={periods() || []} 
            compact={false}
            showViewAllLink={false}
          />
        </div>
      </Show>
    </main>
  );
}