interface Props {
  /** Pixel size of the mark. */
  size?: number;
  /** Round (orb) instead of squircle — used for chat avatars. */
  round?: boolean;
  /** Enable the subtle sparkle / glow animations. */
  animated?: boolean;
  className?: string;
}

/**
 * Close AI brand mark — a clean rounded speech bubble with a soft 4-point AI
 * sparkle nested inside it. Reads instantly as "AI chat" at any size, no
 * letterforms required. The sparkle uses concave Bezier curves (not straight
 * star points) so it stays soft and elegant rather than sharp / Gemini-like.
 *
 * SMIL animation inside the SVG → survives hot-reload and re-renders, no JS.
 */
export function Logo({ size = 32, round = false, animated = true, className = '' }: Props) {
  const shape = round ? 'rounded-full' : 'rounded-[28%]';

  return (
    <span
      className={`relative inline-flex flex-shrink-0 ${className}`}
      style={{ width: size, height: size }}
      aria-hidden="true"
    >
      {/* Soft accent halo behind the mark */}
      <span
        className={`absolute inset-[-14%] ${shape} bg-gradient-to-br from-[var(--accent)] to-[var(--accent-strong)] blur-lg opacity-45 ${
          animated ? 'animate-pulse' : ''
        }`}
        style={animated ? { animationDuration: '4.5s' } : undefined}
      />

      {/* Gradient body */}
      <span
        className={`relative inline-flex items-center justify-center w-full h-full ${shape} bg-gradient-to-br from-[var(--accent)] via-[var(--accent-strong)] to-[var(--accent-strong)] shadow-[inset_0_1px_1px_rgba(255,255,255,0.22)]`}
      >
        <svg viewBox="0 0 100 100" style={{ width: '76%', height: '76%' }} fill="none">
          {/* Speech bubble — rounded rectangle with a small tail at lower-left */}
          <path
            d="
              M 28,18
              L 76,18
              Q 86,18 86,28
              L 86,60
              Q 86,70 76,70
              L 46,70
              L 32,84
              L 32,70
              L 28,70
              Q 18,70 18,60
              L 18,28
              Q 18,18 28,18
              Z
            "
            fill="#ffffff"
          />

          {/* Soft 4-point AI sparkle inside the bubble — concave Bezier petals */}
          <g transform="translate(52 44)">
            <path
              d="
                M 0,-16
                Q 3,-3 16,0
                Q 3,3 0,16
                Q -3,3 -16,0
                Q -3,-3 0,-16
                Z
              "
              fill="var(--accent-strong)"
            >
              {animated && (
                <animateTransform
                  attributeName="transform"
                  type="rotate"
                  from="0"
                  to="360"
                  dur="14s"
                  repeatCount="indefinite"
                />
              )}
            </path>
            {/* Tiny bright pinpoint at the sparkle's center for depth */}
            <circle cx="0" cy="0" r="2.2" fill="#ffffff">
              {animated && (
                <animate
                  attributeName="r"
                  values="2.2;3.2;2.2"
                  dur="2.4s"
                  repeatCount="indefinite"
                />
              )}
            </circle>
          </g>
        </svg>
      </span>
    </span>
  );
}
