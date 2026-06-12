import { useId } from 'react';

interface Props {
  /** Pixel size of the mark. */
  size?: number;
  /** Round (orb) instead of squircle — used for chat avatars. */
  round?: boolean;
  /** Aperture breathing — thinking/loading states only. */
  animated?: boolean;
  className?: string;
}

/**
 * Close AI brand mark — "The Aperture".
 *
 * One solid mass with a C carved out of it in negative space: a deep rounded
 * bite entering from the right edge. The C (Close) is felt, not drawn — the
 * negative-space school of FedEx's arrow and Apple's bite. Survives 16px and
 * monochrome because it is a single solid shape with a single cut; a
 * non-designer can sketch it from memory ("square with a bite on the right").
 *
 * No rings, orbits, dots, nodes, sparkles, or gradients. The symbol carries
 * the brand. `animated` makes the aperture breathe — the only motion, reserved
 * for thinking/loading.
 */
export function Logo({ size = 32, round = false, animated = false, className = '' }: Props) {
  const maskId = useId();

  return (
    <span
      className={`relative inline-flex flex-shrink-0 ${className}`}
      style={{ width: size, height: size }}
      aria-hidden="true"
    >
      <svg
        viewBox="0 0 100 100"
        className="w-full h-full"
        style={{ filter: 'drop-shadow(0 1px 2px rgba(0,0,0,0.28))' }}
      >
        <mask id={maskId}>
          {/* The mass */}
          <rect width="100" height="100" rx={round ? 50 : 26} fill="#fff" />
          {/* The aperture: a round void + a channel opening to the right edge.
              Channel is narrower than the void, so the remaining mass forms
              the C's upper and lower lips. */}
          <circle cx="56" cy="50" r="23" fill="#000">
            {animated && (
              <animate attributeName="r" values="23;26;23" dur="1.5s" repeatCount="indefinite" />
            )}
          </circle>
          <rect x="56" y="41" width="44" height="18" rx="9" fill="#000" />
        </mask>
        {/* fill via style (not the presentation attribute): var() is guaranteed
            in CSS properties but not in SVG attribute grammar. */}
        <rect width="100" height="100" style={{ fill: 'var(--accent)' }} mask={`url(#${maskId})`} />
      </svg>
    </span>
  );
}
