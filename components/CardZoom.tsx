"use client";

import { Modal } from "./ui";

/**
 * A card the table can enlarge.
 *
 * Planes, schemes and role cards all want the same behaviour: show a small
 * thumbnail in the panel, and let a tap open the whole card big enough to read
 * across a table. One component so they cannot drift apart.
 */
export interface ZoomCard {
  /** Image URL. Empty string renders the text fallback instead. */
  src: string;
  title: string;
  /** Shown under the image — usually the card's rules text. */
  body?: string;
  /** Small line above the body, e.g. "Kingdom Role — Knight". */
  eyebrow?: string;
}

export function CardZoom({
  card,
  onClose,
}: {
  card: ZoomCard | null;
  onClose: () => void;
}) {
  return (
    <Modal open={Boolean(card)} onClose={onClose} title={card?.title ?? ""}>
      {card && (
        <div>
          {card.src ? (
            /* eslint-disable-next-line @next/next/no-img-element */
            <img
              src={card.src}
              alt={card.title}
              className="mx-auto w-full max-w-sm rounded-xl border border-white/10"
            />
          ) : null}

          {card.eyebrow && (
            <div className="mt-3 text-[9px] font-black uppercase tracking-[0.14em] text-slate-500">
              {card.eyebrow}
            </div>
          )}

          {card.body && (
            <p className="mt-1.5 whitespace-pre-line text-[12px] leading-relaxed text-slate-300">
              {card.body}
            </p>
          )}
        </div>
      )}
    </Modal>
  );
}

/**
 * The tappable thumbnail. Keeps the tap target, the border and the "tap to
 * enlarge" hint identical wherever a card appears.
 */
export function ZoomThumb({
  src,
  alt,
  onZoom,
  className = "h-24 w-[68px]",
}: {
  src?: string | null;
  alt: string;
  onZoom: () => void;
  className?: string;
}) {
  if (!src) {
    return (
      <div
        className={`flex shrink-0 items-center justify-center rounded-lg border border-dashed border-white/15 bg-black/30 text-[9px] text-slate-600 ${className}`}
      >
        no art
      </div>
    );
  }

  return (
    <button
      onClick={onZoom}
      className={`group relative shrink-0 overflow-hidden rounded-lg border border-white/10 shadow-lg focus:outline-none focus-visible:ring-2 focus-visible:ring-mana ${className}`}
      aria-label={`Enlarge ${alt}`}
    >
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src={src} alt={alt} className="h-full w-full object-cover" loading="lazy" />
      <span className="pointer-events-none absolute inset-0 flex items-center justify-center bg-black/0 text-[9px] font-black uppercase tracking-wider text-white/0 transition-colors group-hover:bg-black/40 group-hover:text-white/90">
        Zoom
      </span>
    </button>
  );
}
