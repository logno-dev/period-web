export default function CyclePhaseLegend() {
  const phases = [
    { name: 'Menstrual', color: '#D53F8C', description: 'Period days' },
    { name: 'Follicular', color: '#FBB6CE', description: 'After period' },
    { name: 'Ovulation', color: '#3182CE', description: 'Fertile window' },
    { name: 'Luteal', color: '#805AD5', description: 'Before period' },
  ];

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
          <div class="flex items-center gap-2">
            <div
              class="w-4 h-4 rounded-full flex-shrink-0"
              style={{ 'background-color': phase.color }}
            ></div>
            <div class="min-w-0">
              <div class="text-xs font-medium" style={{"color": "var(--text-primary)"}}>{phase.name}</div>
              <div class="text-xs" style={{"color": "var(--text-secondary)"}}>{phase.description}</div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}