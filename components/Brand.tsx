/**
 * The brand, in one place.
 *
 * The wordmark used to be typed straight into the home page, and the "logo" was
 * 🎴 — an emoji that renders as a different picture on every phone. These are
 * the real thing: one inline SVG that inherits size from a class, so the mark on
 * a 320px phone and the mark on a poster are the same shape.
 *
 * No font files and no image requests: the whole brand is a handful of paths.
 */

/** Gold used by the mark when it is not being tinted by its container. */
export const BRAND_GOLD = "#d9b45e";

export function BrandMark({
  className = "h-7 w-7",
  title,
}: {
  className?: string;
  /** Only pass this when the mark stands alone and needs its own accessible name. */
  title?: string;
}) {
  return (
    <svg
      viewBox="0 0 64 64"
      className={className}
      role={title ? "img" : undefined}
      aria-hidden={title ? undefined : true}
      aria-label={title}
      focusable="false"
    >
      {title && <title>{title}</title>}
      {/* Two fanned cards. The back one is faded so the pair reads as a fan
          rather than a smudge at 24px. */}
      <rect
        x="10"
        y="8"
        width="33"
        height="46"
        rx="5"
        transform="rotate(-10 26.5 31)"
        fill="#1a1730"
        stroke={BRAND_GOLD}
        strokeOpacity="0.45"
        strokeWidth="2"
      />
      <rect
        x="24"
        y="11"
        width="33"
        height="46"
        rx="5"
        transform="rotate(8 40.5 34)"
        fill="#0f0d19"
        stroke={BRAND_GOLD}
        strokeWidth="2.4"
      />
      {/* The pip sits on the card's axis, so it rotates with it. */}
      <g transform="rotate(8 40.5 34)">
        <path d="M40.5 26.5 47 34.5 40.5 42.5 34 34.5Z" fill={BRAND_GOLD} />
      </g>
    </svg>
  );
}

/**
 * "Cards with Kurt" over "& Friends".
 *
 * The name carries the weight and the invitation is smaller — the opposite of
 * what the old home page did, where a serif italic fought the caps for the same
 * amount of attention.
 */
export function Wordmark({
  size = "sm",
  className = "",
}: {
  size?: "sm" | "md";
  className?: string;
}) {
  if (size === "md") {
    return (
      <span className={`block text-center leading-none ${className}`}>
        <span className="block text-[clamp(1.45rem,7vw,1.9rem)] font-extrabold tracking-[-0.03em] text-white">
          Cards with Kurt
        </span>
        <span className="mt-2 block font-serif text-[0.95rem] uppercase tracking-[0.22em] text-mana">
          &amp; Friends
        </span>
      </span>
    );
  }

  return (
    <span className={`block leading-none ${className}`}>
      <span className="block text-[12px] font-extrabold tracking-[0.01em] text-white">
        Cards with Kurt
      </span>
      <span className="mt-1 block text-[9.5px] font-bold uppercase tracking-[0.16em] text-mana">
        &amp; Friends
      </span>
    </span>
  );
}

/** Mark and wordmark side by side — the standard header lockup. */
export function BrandLockup({
  className = "",
  markClassName = "h-7 w-7",
}: {
  className?: string;
  markClassName?: string;
}) {
  return (
    <span className={`flex items-center gap-2.5 ${className}`}>
      <BrandMark className={`${markClassName} shrink-0`} />
      <Wordmark />
    </span>
  );
}
