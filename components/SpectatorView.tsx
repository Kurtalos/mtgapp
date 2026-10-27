"use client";

import { useState } from "react";
import { isKingdomMode, type RoomState } from "@/lib/types";
import { cardById } from "@/lib/data/advancedKingdoms";
import { ROLES } from "@/lib/data/roles";
import { cardArtFor } from "@/lib/scryfall";
import { usePlaneArt, useSchemeArt } from "@/lib/useCardArt";
import { PlayerTile } from "./PlayerTile";
import { RollBanner } from "./RollBanner";
import { CardZoom, ZoomThumb, type ZoomCard } from "./CardZoom";

/**
 * What someone sees when they are watching rather than playing.
 *
 * Deliberately stripped back: no tabs, no tools, no edit affordances. A
 * spectator gets the two things they actually came for — everybody's life
 * total, and whichever card is face up on the table — and nothing they could
 * accidentally press.
 */
export function SpectatorView({
  state,
  onlineIds,
}: {
  state: RoomState;
  onlineIds: Set<string>;
}) {
  const [zoom, setZoom] = useState<ZoomCard | null>(null);
  const players = state.players;
  const sound = players.length <= 2 ? "grid-cols-1" : "grid-cols-2";

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-center gap-1.5 rounded-lg border border-sky-500/25 bg-sky-500/10 py-1.5">
        <span className="text-[10px]">👁</span>
        <span className="text-[10px] font-black uppercase tracking-[0.14em] text-sky-300">
          Watching
        </span>
      </div>

      {/* Life totals, read-only */}
      <div className={`grid gap-2 ${sound}`}>
        {players.map((player) => (
          <PlayerTile
            key={player.id}
            player={player}
            state={state}
            isMe={false}
            canEdit={false}
            canIncrease={false}
            isOnline={onlineIds.size === 0 || onlineIds.has(player.id)}
            onAdjust={() => {}}
            onOpen={() => {}}
          />
        ))}
      </div>

      {state.lastRoll && <RollBanner roll={state.lastRoll} />}

      {state.mode === "planechase" && (
        <PlaneInPlay state={state} onZoom={setZoom} />
      )}
      {state.mode === "archenemy" && (
        <SchemeInPlay state={state} onZoom={setZoom} />
      )}
      {isKingdomMode(state.mode) && (
        <RevealedRoles state={state} onZoom={setZoom} />
      )}

      <CardZoom card={zoom} onClose={() => setZoom(null)} />
    </div>
  );
}

/* -------------------------------------------------------------------------- */

function Section({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div className="rounded-2xl border border-line bg-surface p-3">
      <div className="mb-2 text-[9px] font-black uppercase tracking-[0.14em] text-slate-500">
        {label}
      </div>
      {children}
    </div>
  );
}

function PlaneInPlay({
  state,
  onZoom,
}: {
  state: RoomState;
  onZoom: (card: ZoomCard) => void;
}) {
  // Bundled planes carry no image of their own — the art comes from Scryfall,
  // fetched in the browser. A spectator is looking at the same card the table
  // is, so it has to go through exactly the same lookup.
  const planeArt = usePlaneArt();
  const plane = state.planechase.current;
  if (!plane) {
    return (
      <Section label="Plane in play">
        <p className="py-2 text-center text-[11px] text-slate-500">
          No plane face up.
        </p>
      </Section>
    );
  }

  const art = cardArtFor(planeArt, plane.name);
  const image = plane.image ?? art?.image ?? null;
  const rules = plane.oracleText || art?.oracleText || "";

  const toCard = (): ZoomCard => ({
    src: image ?? "",
    title: plane.name,
    eyebrow: plane.type,
    body: [rules, plane.chaosText && `Chaos: ${plane.chaosText}`]
      .filter(Boolean)
      .join("\n\n"),
  });

  return (
    <Section label="Plane in play">
      <div className="flex gap-3">
        <ZoomThumb
          src={image}
          alt={plane.name}
          onZoom={() => onZoom(toCard())}
          className="h-28 w-20"
        />
        <div className="min-w-0 flex-1">
          <button
            onClick={() => onZoom(toCard())}
            className="text-left text-sm font-extrabold leading-tight text-white"
          >
            {plane.name}
          </button>
          <p className="mt-1 line-clamp-4 text-[11px] leading-snug text-slate-400">
            {rules}
          </p>
          {plane.chaosText && (
            <p className="mt-1 line-clamp-2 text-[11px] leading-snug text-violet/80">
              Chaos: {plane.chaosText}
            </p>
          )}
        </div>
      </div>
      {state.planechase.chaosPending && (
        <div className="mt-2 rounded-lg border border-violet/30 bg-violet/10 px-2 py-1 text-[10px] font-bold text-violet">
          Chaos is waiting to resolve
        </div>
      )}
    </Section>
  );
}

function SchemeInPlay({
  state,
  onZoom,
}: {
  state: RoomState;
  onZoom: (card: ZoomCard) => void;
}) {
  const { lastRevealed, active } = state.archenemy;
  // Same story as planes: the official scheme set is fetched by the browser,
  // so a scheme dealt from Scryfall has no image field of its own.
  const schemeArt = useSchemeArt();
  const archenemy = state.players.find(
    (p) => p.id === state.archenemy.archenemyId,
  );

  return (
    <Section label={`Schemes${archenemy ? ` — ${archenemy.name}` : ""}`}>
      {!lastRevealed && active.length === 0 && (
        <p className="py-2 text-center text-[11px] text-slate-500">
          No scheme in motion yet.
        </p>
      )}

      {lastRevealed && (() => {
        const art = cardArtFor(schemeArt, lastRevealed.name);
        const image = lastRevealed.image ?? art?.image ?? null;
        const rules = lastRevealed.oracleText || art?.oracleText || "";
        const card: ZoomCard = {
          src: image ?? "",
          title: lastRevealed.name,
          eyebrow: "Scheme in motion",
          body: rules,
        };
        return (
          <div className="flex gap-3">
            <ZoomThumb
              src={image}
              alt={lastRevealed.name}
              onZoom={() => onZoom(card)}
              className="h-28 w-20"
            />
            <div className="min-w-0 flex-1">
              <div className="text-[9px] font-black uppercase tracking-wider text-violet">
                In motion
              </div>
              <button
                onClick={() => onZoom(card)}
                className="text-left text-sm font-extrabold leading-tight text-white"
              >
                {lastRevealed.name}
              </button>
              {rules && (
                <p className="mt-1 line-clamp-4 text-[11px] leading-snug text-slate-400">
                  {rules}
                </p>
              )}
            </div>
          </div>
        );
      })()}

      {active.length > 0 && (
        <div className="mt-2 space-y-1 border-t border-white/5 pt-2">
          <div className="text-[9px] font-black uppercase tracking-wider text-slate-500">
            Ongoing
          </div>
          {active.map((scheme) => (
            <button
              key={scheme.id}
              onClick={() => {
                const art = cardArtFor(schemeArt, scheme.name);
                onZoom({
                  src: scheme.image ?? art?.image ?? "",
                  title: scheme.name,
                  eyebrow: "Ongoing scheme",
                  body: scheme.oracleText || art?.oracleText || "",
                });
              }}
              className="block w-full truncate rounded-lg bg-white/5 px-2 py-1.5 text-left text-[11px] font-bold text-slate-300"
            >
              {scheme.name}
            </button>
          ))}
        </div>
      )}
    </Section>
  );
}

function RevealedRoles({
  state,
  onZoom,
}: {
  state: RoomState;
  onZoom: (card: ZoomCard) => void;
}) {
  const { roles, cards, revealed, revealAll } = state.kingdom;
  const everyone = revealAll || state.phase === "finished";

  // Only what the table is allowed to know: the King, anyone who announced,
  // and the whole spread once the game is over or the host reveals it.
  const known = state.players.filter(
    (player) =>
      everyone ||
      revealed.includes(player.id) ||
      roles[player.id] === "king",
  );

  if (known.length === 0) {
    return (
      <Section label="Revealed roles">
        <p className="py-2 text-center text-[11px] text-slate-500">
          Nobody has revealed a role yet.
        </p>
      </Section>
    );
  }

  return (
    <Section label={everyone ? "Every role" : "Revealed so far"}>
      <div className="space-y-1.5">
        {known.map((player) => {
          const role = roles[player.id];
          const card = cards[player.id] ? cardById(cards[player.id]) : undefined;
          const colour = role ? ROLES[role]?.colour : undefined;
          return (
            <button
              key={player.id}
              onClick={() =>
                card &&
                onZoom({
                  src: card.image,
                  title: card.name,
                  eyebrow: `${player.name}`,
                  body: card.text,
                })
              }
              className="flex w-full items-center gap-2 rounded-lg bg-white/5 px-2.5 py-1.5 text-left"
            >
              <span className="min-w-0 flex-1 truncate text-xs font-bold text-slate-200">
                {player.name}
                {player.eliminated && (
                  <span className="ml-1.5 text-[9px] font-black uppercase text-slate-600">
                    out
                  </span>
                )}
              </span>
              <span
                className="shrink-0 text-[11px] font-black"
                style={{ color: colour ?? "#94a3b8" }}
              >
                {card?.name ?? (role ? ROLES[role]?.name : "—")}
              </span>
            </button>
          );
        })}
      </div>
    </Section>
  );
}
