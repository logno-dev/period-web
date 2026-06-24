import { JSX } from 'solid-js';

interface BrandDotProps {
  className?: string;
  size?: number;
  label?: string;
}

export default function BrandDot(props: BrandDotProps): JSX.Element {
  const size = `${props.size ?? 11}px`;
  const label = props.label || 'Period Tracker';

  return (
    <span
      class={`inline-flex items-center ${props.className || ''}`}
      role="img"
      aria-label={label}
      title={label}
    >
      <span
        style={{
          display: 'inline-block',
          width: size,
          height: size,
          'border-radius': '999px',
          'background-color': '#8b5cf6',
          'line-height': '1',
          flex: '0 0 auto',
        }}
      />
    </span>
  );
}
