import { Title } from "@solidjs/meta";
import { createResource, Show, createSignal, createEffect, createMemo } from "solid-js";
import { A } from "@solidjs/router";
import { useAuth } from "~/components/Context";
import Header from "~/components/Header";
import StatsWidget from "~/components/StatsWidget";
import { Period, MoodMarker } from "~/types/period";
import { calculateAverageCycleLength, getCyclePhaseForDate } from "~/utils/periodUtils";

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

  const [moodMarkers] = createResource(
    () => {
      if (typeof window === 'undefined') return null;
      return session()?.id;
    },
    async (userId) => {
      if (!userId) return [];

      const response = await fetch('/api/mood-markers');

      if (!response.ok) {
        if (response.status === 401) {
          return [];
        }
        throw new Error(`Failed to fetch mood markers: ${response.status}`);
      }

      const data = await response.json();
      return data.markers || [];
    }
  );

  const moodPatterns = createMemo(() => {
    const markers = moodMarkers();
    const periodsData = periods();
    if (!markers || !periodsData) return [];

    const averageCycleLength = calculateAverageCycleLength(periodsData);
    const summary: Record<string, {
      total: number;
      dayCounts: Record<number, number>;
      phaseCounts: Record<string, number>;
      unknownCycleCount: number;
    }> = {};

    markers.forEach((marker: MoodMarker) => {
      if (!summary[marker.mood]) {
        summary[marker.mood] = {
          total: 0,
          dayCounts: {},
          phaseCounts: {},
          unknownCycleCount: 0,
        };
      }

      summary[marker.mood].total += 1;

      const phaseInfo = getCyclePhaseForDate(marker.date, periodsData, averageCycleLength);
      if (phaseInfo?.dayInCycle) {
        summary[marker.mood].dayCounts[phaseInfo.dayInCycle] =
          (summary[marker.mood].dayCounts[phaseInfo.dayInCycle] || 0) + 1;
      } else {
        summary[marker.mood].unknownCycleCount += 1;
      }

      if (phaseInfo?.phase) {
        summary[marker.mood].phaseCounts[phaseInfo.phase] =
          (summary[marker.mood].phaseCounts[phaseInfo.phase] || 0) + 1;
      }
    });

    const phaseLabels: Record<string, string> = {
      menstrual: "Menstrual",
      follicular: "Follicular",
      ovulation: "Ovulation",
      luteal: "Luteal",
    };

    return Object.entries(summary)
      .map(([mood, data]) => {
        let bestDay: number | null = null;
        let bestDayCount = 0;

        Object.entries(data.dayCounts).forEach(([day, count]) => {
          const dayNum = Number(day);
          if (count > bestDayCount || (count === bestDayCount && (bestDay === null || dayNum < bestDay))) {
            bestDay = dayNum;
            bestDayCount = count;
          }
        });

        let bestPhase: string | null = null;
        let bestPhaseCount = 0;

        Object.entries(data.phaseCounts).forEach(([phase, count]) => {
          if (count > bestPhaseCount) {
            bestPhase = phase;
            bestPhaseCount = count;
          }
        });

        return {
          mood,
          total: data.total,
          mostCommonDay: bestDay,
          mostCommonDayCount: bestDayCount,
          mostCommonPhase: bestPhase ? phaseLabels[bestPhase] : null,
          mostCommonPhaseCount: bestPhaseCount,
          unknownCycleCount: data.unknownCycleCount,
        };
      })
      .sort((a, b) => b.total - a.total);
  });




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
        <div class="p-5 max-w-4xl mx-auto space-y-4">
          <StatsWidget 
            periods={periods() || []} 
            compact={false}
            showViewAllLink={false}
          />
          <div
            class="rounded-lg shadow-md p-4 border"
            style={{
              "background-color": "var(--bg-primary)",
              "border-color": "var(--border-color)"
            }}
          >
            <div class="flex items-center justify-between mb-3">
              <h2 class="text-base font-bold" style={{"color": "var(--text-primary)"}}>
                Mood Patterns
              </h2>
              <span class="text-xs" style={{"color": "var(--text-secondary)"}}>
                {(moodMarkers()?.length || 0)} markers
              </span>
            </div>
            <Show when={!moodMarkers.loading} fallback={
              <p class="text-sm text-center" style={{"color": "var(--text-secondary)"}}>
                Loading mood markers...
              </p>
            }>
              <Show when={(moodMarkers()?.length || 0) > 0} fallback={
                <p class="text-sm text-center" style={{"color": "var(--text-secondary)"}}>
                  No mood markers yet. Use "Add Mood Marker" on the calendar to start tracking.
                </p>
              }>
                <div class="space-y-3">
                  {moodPatterns().map((pattern) => (
                    <div
                      class="rounded-md p-3 border"
                      style={{
                        "background-color": "var(--bg-secondary)",
                        "border-color": "var(--border-color)"
                      }}
                    >
                      <div class="font-semibold" style={{"color": "var(--text-primary)"}}>
                        {pattern.mood}
                      </div>
                      <div class="text-sm" style={{"color": "var(--text-secondary)"}}>
                        {pattern.mostCommonDay
                          ? `Most common cycle day: ${pattern.mostCommonDay} (${pattern.mostCommonDayCount}x)`
                          : "Not enough cycle data yet"}
                      </div>
                      <div class="text-sm" style={{"color": "var(--text-secondary)"}}>
                        {pattern.mostCommonPhase
                          ? `Most common phase: ${pattern.mostCommonPhase} (${pattern.mostCommonPhaseCount}x)`
                          : ""}
                      </div>
                      <div class="text-xs" style={{"color": "var(--text-secondary)"}}>
                        Total: {pattern.total} marker{pattern.total === 1 ? "" : "s"}
                        {pattern.unknownCycleCount > 0 ? `, ${pattern.unknownCycleCount} outside cycle data` : ""}
                      </div>
                    </div>
                  ))}
                </div>
              </Show>
            </Show>
          </div>
        </div>
      </Show>
    </main>
  );
}
