import { createMemo, For, Show } from "solid-js";
import { A } from "@solidjs/router";
import { Period, PeriodStats } from "~/types/period";
import { calculatePeriodStats } from "~/utils/periodUtils";

interface StatsWidgetProps {
  periods: Period[];
  compact?: boolean;
  showViewAllLink?: boolean;
}

export default function StatsWidget(props: StatsWidgetProps) {
  // Calculate stats using a memo
  const stats = createMemo(() => {
    return props.periods ? calculatePeriodStats(props.periods) : [];
  });

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
    });
  };

  const calculateAverages = createMemo(() => {
    const currentStats = stats();
    if (currentStats.length === 0) return { avgMenstruation: 0, avgCycle: 0 };

    const avgMenstruation = currentStats.reduce((sum, stat) => sum + stat.lengthInDays, 0) / currentStats.length;

    const cyclesWithData = currentStats.filter(stat => stat.daysBetweenPeriods !== undefined);
    const avgCycle = cyclesWithData.length > 0
      ? cyclesWithData.reduce((sum, stat) => sum + (stat.daysBetweenPeriods || 0), 0) / cyclesWithData.length
      : 0;

    return { avgMenstruation, avgCycle };
  });

  const renderAverageCard = (title: string, value: number, color: string) => (
    <div 
      class="rounded-lg shadow-sm p-3 border-l-4"
      style={{ 
        'border-left-color': color,
        'background-color': 'var(--bg-primary)',
        'border': '1px solid var(--border-color)'
      }}
    >
      <div class="flex justify-between items-center">
        <h3 class="text-sm font-bold" style={{"color": "var(--text-primary)"}}>{title}</h3>
        <span class="text-sm font-semibold" style={{ color }}>
          {value > 0 ? `${Math.round(value * 10) / 10} days` : 'No data'}
        </span>
      </div>
    </div>
  );

  const renderPeriodCard = (stat: PeriodStats, index: number) => (
    <div 
      class="rounded-lg shadow-sm border-l-4 mb-3"
      style={{
        'background-color': 'var(--bg-primary)',
        'border': '1px solid var(--border-color)',
        'border-left-color': 'var(--accent-color)'
      }}
    >
      <div class="p-3">
        <div class="flex justify-between items-center mb-2">
          <h3 class="text-sm font-bold" style={{"color": "var(--text-primary)"}}>Period #{stats().length - index}</h3>
          <span class="text-sm font-semibold" style={{"color": "var(--accent-color)"}}>
            {stat.lengthInDays} days
          </span>
        </div>
        <div class="text-xs" style={{"color": "var(--text-secondary)"}}>
          {formatDate(stat.startDate)} - {formatDate(stat.endDate)}
        </div>
        <Show when={stat.daysBetweenPeriods !== undefined}>
          <div class="text-xs mt-1" style={{"color": "var(--text-secondary)"}}>
            Cycle: {stat.daysBetweenPeriods} days
          </div>
        </Show>
      </div>
    </div>
  );

  return (
    <div class="space-y-4">
      <div class="flex items-center justify-between">
        <h2 class="text-lg font-bold" style={{"color": "var(--text-primary)"}}>
          {props.compact ? "Quick Stats" : "Statistics"}
        </h2>
        <Show when={props.showViewAllLink}>
          <A 
            href="/stats" 
            class="text-sm transition-colors"
            style={{"color": "var(--text-secondary)"}}
            onmouseover={(e) => e.currentTarget.style.color = "var(--accent-color)"}
            onmouseout={(e) => e.currentTarget.style.color = "var(--text-secondary)"}
          >
            View All →
          </A>
        </Show>
      </div>

      <Show when={stats().length === 0}>
        <div 
          class="rounded-lg shadow-sm p-6 text-center border"
          style={{
            "background-color": "var(--bg-primary)",
            "border-color": "var(--border-color)"
          }}
        >
          <h3 class="text-sm font-bold mb-2" style={{"color": "var(--text-primary)"}}>No Data Available</h3>
          <p class="text-xs" style={{"color": "var(--text-secondary)"}}>
            Start tracking your periods to see statistics here.
          </p>
        </div>
      </Show>

      <Show when={stats().length > 0}>
        {/* Averages */}
        <div class="space-y-3">
          <h3 class="text-sm font-semibold" style={{"color": "var(--text-primary)"}}>Averages</h3>
          <div class="space-y-2">
            {renderAverageCard('Period Length', calculateAverages().avgMenstruation, '#ec4899')}
            <Show when={calculateAverages().avgCycle > 0}>
              {renderAverageCard('Cycle Length', calculateAverages().avgCycle, '#10b981')}
            </Show>
          </div>
        </div>

        {/* Recent Periods */}
        <div class="space-y-3">
          <h3 class="text-sm font-semibold" style={{"color": "var(--text-primary)"}}>
            Recent Periods
          </h3>
          <div class="space-y-2 max-h-64 overflow-y-auto">
            <For each={stats().slice(0, props.compact ? 3 : stats().length)}>
              {(stat, index) => renderPeriodCard(stat, index())}
            </For>
          </div>
        </div>
      </Show>
    </div>
  );
}