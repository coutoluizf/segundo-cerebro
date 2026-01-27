/**
 * RajiLogo - HeyRaji mascot logo component
 *
 * Design: "A2 - Ears Overflow" - French Bulldog with bat ears
 * that overflow outside the main circle for a dynamic effect.
 *
 * Named after Raji, a beloved French Bulldog who inspired this project.
 *
 * Colors:
 * - Primary gradient: #ff7733 → #f59e0b (orange/amber)
 * - Inner ear detail: #e85d20 (darker orange)
 * - Face: white
 * - Eyes/nose/mouth: #1a1a2e (dark blue-black)
 *
 * Usage:
 *   <RajiLogo size={24} />           // Default header size
 *   <RajiLogo size={40} />           // Larger for empty states
 *   <RajiLogo className="opacity-50" /> // With additional styles
 *
 * @see public/icons/raji.svg - Static SVG version for extension icons
 */

interface RajiLogoProps {
  /** Additional CSS classes for the SVG element */
  className?: string
  /** Size in pixels (width and height are equal) */
  size?: number
}

export function RajiLogo({ className, size = 24 }: RajiLogoProps) {
  return (
    <svg
      viewBox="0 0 140 140"
      width={size}
      height={size}
      className={className}
      aria-label="HeyRaji logo"
    >
      {/* Gradient definition for the orange/amber color scheme */}
      <defs>
        <linearGradient id="rajiGrad" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" style={{ stopColor: '#ff7733' }} />
          <stop offset="100%" style={{ stopColor: '#f59e0b' }} />
        </linearGradient>
      </defs>

      {/* Ears BEHIND/OUTSIDE circle - creates overflow effect */}
      {/* Left ear */}
      <path
        fill="url(#rajiGrad)"
        d="M18 62 C14 36, 26 8, 38 8 C48 8, 52 24, 50 40 L48 58 C38 62, 24 64, 18 62 Z"
      />
      {/* Right ear */}
      <path
        fill="url(#rajiGrad)"
        d="M122 62 C126 36, 114 8, 102 8 C92 8, 88 24, 90 40 L92 58 C102 62, 116 64, 122 62 Z"
      />

      {/* Inner ear detail (darker orange) */}
      <path
        fill="#e85d20"
        d="M26 54 C24 38, 32 18, 38 18 C44 18, 46 28, 45 40 L44 52 C38 55, 30 56, 26 54 Z"
      />
      <path
        fill="#e85d20"
        d="M114 54 C116 38, 108 18, 102 18 C96 18, 94 28, 95 40 L96 52 C102 55, 110 56, 114 54 Z"
      />

      {/* Main circle (on top of ears) */}
      <circle cx="70" cy="76" r="54" fill="url(#rajiGrad)" />

      {/* Face (white) */}
      <ellipse cx="70" cy="82" rx="36" ry="34" fill="white" />

      {/* Eyes */}
      <ellipse cx="54" cy="78" rx="8" ry="9" fill="#1a1a2e" />
      <ellipse cx="86" cy="78" rx="8" ry="9" fill="#1a1a2e" />

      {/* Eye shine */}
      <circle cx="52" cy="76" r="2.5" fill="white" />
      <circle cx="84" cy="76" r="2.5" fill="white" />

      {/* Nose */}
      <ellipse cx="70" cy="94" rx="9" ry="6" fill="#1a1a2e" />

      {/* Mouth */}
      <path
        d="M60 102 Q70 110, 80 102"
        stroke="#1a1a2e"
        strokeWidth="2.5"
        fill="none"
        strokeLinecap="round"
      />
    </svg>
  )
}
