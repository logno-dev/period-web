import { createSignal } from "solid-js";
import PhaseTooltip, { InfoIcon } from "./PhaseTooltip";
import { CyclePhase } from "../types/period";

export default function CyclePhaseLegend() {
  const [tooltip, setTooltip] = createSignal({ visible: false, phase: 'menstrual' as CyclePhase, position: { x: 0, y: 0 } });
  const [isMobile, setIsMobile] = createSignal(false);

  const phases = [
    { name: 'Menstrual', color: '#D53F8C', description: 'Period days', phase: 'menstrual' as CyclePhase },
    { name: 'Follicular', color: '#FBB6CE', description: 'After period', phase: 'follicular' as CyclePhase },
    { name: 'Ovulation', color: '#3182CE', description: 'Fertile window', phase: 'ovulation' as CyclePhase },
    { name: 'Luteal', color: '#805AD5', description: 'Before period', phase: 'luteal' as CyclePhase },
  ];

  // Detect mobile for touch interface
  const checkIsMobile = () => {
    return window.innerWidth <= 768 || 'ontouchstart' in window;
  };

  // Initialize mobile detection
  if (typeof window !== 'undefined') {
    setIsMobile(checkIsMobile());
    window.addEventListener('resize', () => setIsMobile(checkIsMobile()));
  }

  const showTooltip = (event: MouseEvent, phase: CyclePhase) => {
    if (isMobile()) return;

    const rect = (event.target as HTMLElement).getBoundingClientRect();
    setTooltip({
      visible: true,
      phase,
      position: {
        x: rect.left + rect.width / 2,
        y: rect.top - 10
      }
    });
  };

  const hideTooltip = () => {
    setTooltip(prev => ({ ...prev, visible: false }));
  };

  const toggleMobileTooltip = (phase: CyclePhase) => {
    if (!isMobile()) return;

    const isCurrentlyVisible = tooltip().visible && tooltip().phase === phase;
    if (isCurrentlyVisible) {
      hideTooltip();
    } else {
      setTooltip({
        visible: true,
        phase,
        position: { x: window.innerWidth / 2 - 150, y: 200 }
      });
    }
  };

  return (
    <div 
      class="rounded-lg shadow-md p-4 mx-5 mb-4 border"
      style={{
        "background-color": "var(--bg-primary)",
        "border-color": "var(--border-color)"
      }}
    >
      <h3 class="text-sm font-semibold mb-3" style={{"color": "var(--text-primary)"}}>Cycle Phases</h3>
      <div class="grid grid-cols-2 gap-2">
        {phases.map((phase) => (
          <div 
            class="flex items-center gap-2 relative cursor-pointer rounded p-1 transition-colors hover:bg-opacity-10"
            style={{ 'background-color': 'transparent' }}
            onmouseover={(e) => {
              if (!isMobile()) {
                e.currentTarget.style.backgroundColor = "var(--bg-secondary)";
                showTooltip(e, phase.phase);
              }
            }}
            onmouseout={(e) => {
              e.currentTarget.style.backgroundColor = "transparent";
              hideTooltip();
            }}
          >
            <div
              class="w-4 h-4 rounded-full flex-shrink-0"
              style={{ 'background-color': phase.color }}
            ></div>
            <div class="min-w-0 flex-1">
              <div class="text-xs font-medium" style={{"color": "var(--text-primary)"}}>{phase.name}</div>
              <div class="text-xs" style={{"color": "var(--text-secondary)"}}>{phase.description}</div>
            </div>
            {/* Mobile info icon */}
            {isMobile() && (
              <button
                onClick={() => toggleMobileTooltip(phase.phase)}
                class="ml-1 opacity-60 hover:opacity-100 transition-opacity"
                style={{ color: "var(--text-secondary)" }}
              >
                <InfoIcon class="w-3 h-3" />
              </button>
            )}
          </div>
        ))}
      </div>
      
      {/* Tooltip */}
      <PhaseTooltip
        phase={tooltip().phase}
        visible={tooltip().visible}
        position={tooltip().position}
      />
    </div>
  );
}