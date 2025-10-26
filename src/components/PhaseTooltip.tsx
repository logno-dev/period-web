import { createSignal, createEffect, createMemo } from "solid-js";
import { CyclePhase } from "../types/period";

interface PhaseTooltipProps {
  phase: CyclePhase;
  visible: boolean;
  position: { x: number; y: number };
  children?: any;
}

const getPhaseInfo = (phase: CyclePhase) => {
  switch (phase) {
    case 'menstrual':
      return {
        title: 'Menstrual Phase',
        description: 'Your period is here! The lining of your uterus is shedding.',
        characteristics: [
          'Bleeding typically lasts 3-7 days',
          'Hormone levels are at their lowest',
          'You might experience cramps, fatigue, or mood changes',
          'Good time for rest and self-care'
        ],
        tips: [
          'Stay hydrated and eat iron-rich foods',
          'Use heat therapy for cramps',
          'Get adequate rest',
          'Track your symptoms'
        ]
      };
    case 'follicular':
      return {
        title: 'Follicular Phase',
        description: 'Your body is preparing for ovulation. Energy levels start to rise.',
        characteristics: [
          'Starts after your period ends',
          'Estrogen levels begin to rise',
          'Follicles in ovaries start developing',
          'You may feel more energetic and optimistic'
        ],
        tips: [
          'Great time to start new projects',
          'Try more intense workouts',
          'Focus on goal-setting',
          'Take advantage of increased energy'
        ]
      };
    case 'ovulation':
      return {
        title: 'Ovulation Phase',
        description: 'Your most fertile time! An egg is released from your ovary.',
        characteristics: [
          'Usually occurs around day 14 of your cycle',
          'Estrogen peaks, then drops',
          'Body temperature may rise slightly',
          'You might notice changes in cervical mucus'
        ],
        tips: [
          'Peak fertility window for conception',
          'You may feel more confident and social',
          'Great time for important conversations',
          'Listen to your body\'s signals'
        ]
      };
    case 'luteal':
      return {
        title: 'Luteal Phase',
        description: 'Your body is either preparing for pregnancy or your next period.',
        characteristics: [
          'Progesterone levels rise',
          'If no pregnancy, hormone levels will drop',
          'You might experience PMS symptoms',
          'Energy levels may decrease'
        ],
        tips: [
          'Focus on self-care and stress management',
          'Eat magnesium-rich foods',
          'Practice gentle exercise like yoga',
          'Be patient with mood changes'
        ]
      };
    default:
      return {
        title: 'Cycle Phase',
        description: 'Track your menstrual cycle phases.',
        characteristics: [],
        tips: []
      };
  }
};

export default function PhaseTooltip(props: PhaseTooltipProps) {
  const [isVisible, setIsVisible] = createSignal(false);
  const phaseInfo = createMemo(() => getPhaseInfo(props.phase));

  createEffect(() => {
    setIsVisible(props.visible);
  });

  return (
    <div
      class="fixed z-50 pointer-events-none transition-all duration-200"
      style={{
        left: `${props.position.x}px`,
        top: `${props.position.y}px`,
        opacity: isVisible() ? 1 : 0,
        transform: `scale(${isVisible() ? 1 : 0.9})`,
        "transform-origin": "top left"
      }}
    >
      <div
        class="bg-white dark:bg-gray-800 rounded-lg shadow-lg border p-4 max-w-xs"
        style={{
          "background-color": "var(--bg-primary)",
          "border-color": "var(--border-color)",
          "box-shadow": "0 10px 25px rgba(0, 0, 0, 0.1)"
        }}
      >
        <h4 class="font-semibold text-sm mb-2" style={{"color": "var(--text-primary)"}}>
          {phaseInfo().title}
        </h4>
        <p class="text-xs mb-3" style={{"color": "var(--text-secondary)"}}>
          {phaseInfo().description}
        </p>
        
        {phaseInfo().characteristics.length > 0 && (
          <div class="mb-3">
            <h5 class="font-medium text-xs mb-1" style={{"color": "var(--text-primary)"}}>
              What's happening:
            </h5>
            <ul class="text-xs space-y-1" style={{"color": "var(--text-secondary)"}}>
              {phaseInfo().characteristics.map((item) => (
                <li class="flex items-start">
                  <span class="mr-1">•</span>
                  <span>{item}</span>
                </li>
              ))}
            </ul>
          </div>
        )}
        
        {phaseInfo().tips.length > 0 && (
          <div>
            <h5 class="font-medium text-xs mb-1" style={{"color": "var(--text-primary)"}}>
              Tips:
            </h5>
            <ul class="text-xs space-y-1" style={{"color": "var(--text-secondary)"}}>
              {phaseInfo().tips.map((tip) => (
                <li class="flex items-start">
                  <span class="mr-1">•</span>
                  <span>{tip}</span>
                </li>
              ))}
            </ul>
          </div>
        )}
      </div>
    </div>
  );
}

export function InfoIcon(props: { class?: string; onClick?: () => void }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      stroke-width="2"
      stroke-linecap="round"
      stroke-linejoin="round"
      class={props.class}
      onClick={props.onClick}
    >
      <circle cx="12" cy="12" r="10" />
      <line x1="12" y1="16" x2="12" y2="12" />
      <line x1="12" y1="8" x2="12.01" y2="8" />
    </svg>
  );
}