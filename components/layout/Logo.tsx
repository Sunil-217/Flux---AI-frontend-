interface Props {
  /** Pixel size of the mark. */
  size?: number;
  /** Round (orb) instead of squircle — used for chat avatars. */
  round?: boolean;
  /** Enable the orbit / glow animations. */
  animated?: boolean;
  className?: string;
}

/**
 * Close AI brand mark — a geometric "C" ring with a glowing spark that
 * orbits around it (the spark "closes" the C). Pulsing glow halo behind.
 *
 * Animation uses in-SVG SMIL + Tailwind's built-in `animate-pulse`, so it
 * hot-reloads reliably without a dev-server restart.
 */
export function Logo({ size = 32, round = false, animated = true, className = '' }: Props) {
  const shape = round ? 'rounded-full' : 'rounded-[28%]';

  return (
    <span
      className={`relative inline-flex flex-shrink-0 ${className}`}
      style={{ width: size, height: size }}
      aria-hidden="true"
    >
      {/* Glow halo */}
      <span
        className={`absolute inset-0 ${shape} bg-gradient-to-br from-violet-500 to-indigo-500 blur-md opacity-50 ${
          animated ? 'animate-pulse' : ''
        }`}
        style={animated ? { animationDuration: '4s' } : undefined}
      />

      {/* Gradient body */}
      <span
        className={`relative inline-flex items-center justify-center w-full h-full ${shape} bg-gradient-to-br from-[#8b7bff] to-[#6366f1]`}
      >
        <svg viewBox="0 0 24 24" style={{ width: '62%', height: '62%' }} fill="none">
          {/* The "C" — an open ring, gap on the right */}
          <path
            d="M17.4 7.6 A7 7 0 1 0 17.4 16.4"
            stroke="white"
            strokeWidth="2.6"
            strokeLinecap="round"
          />
          {/* Spark that orbits the C (closes it) */}
          <circle cx="12" cy="5" r="1.7" fill="white">
            {animated && (
              <animateTransform
                attributeName="transform"
                type="rotate"
                from="0 12 12"
                to="360 12 12"
                dur="3.2s"
                repeatCount="indefinite"
              />
            )}
          </circle>
        </svg>
      </span>
    </span>
  );
}
