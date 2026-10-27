"use client";

import { useMemo, useState } from "react";
import type { RoomState } from "@/lib/types";
import type { RoomAction } from "@/lib/room/reducer";
import type { SchemeCard } from "@/lib/content";
import { cardArtFor } from "@/lib/scryfall";
import { schemeNames, useSchemeArt } from "@/lib/useCardArt";
import { useContent } from "@/lib/useContent";
import { Badge, Modal } from "./ui";
import { CardZoom, ZoomThumb, type ZoomCard } from "./CardZoom";

export function ArchenemyPanel({
  state,
  dispatch,
  canAct,
  myId,
  isHost,
}: {
  state: RoomState;
  dispatch: (action: RoomAction) => void;
  canAct: boolean;
  myId: string;
  isHost: boolean;
}) {
  const artMap = useSchemeArt();
  const content = useContent();
  const [deckOpen, setDeckOpen] = useState(false);
  const [zoom, setZoom] = useState<ZoomCard | null>(null);
  const [nameDraft, setNameDraft] = useState("");
  const [textDraft, setTextDraft] = useState("");

  const archenemy = state.players.find((p) => p.id === state.archenemy.archenemyId);
  const isArchenemy = state.archenemy.archenemyId === myId;
  const { deck, active, lastRevealed: last } = state.archenemy;
  const lastArt = last ? cardArtFor(artMap, last.name) : null;

  /**
   * Every scheme we can deal: the admin's custom cards, plus the full official
   * set pulled from Scryfall in the browser. Scryfall entries arrive as names,
   * which is why the deck is normalised to SchemeCard here.
   */
  const available = useMemo<SchemeCard[]>(() => {
    const fromScryfall = schemeNames(artMap).map((name) => ({
      id: `sf_${name.toLowerCase().replace(/[^a-z0-9]/g, "")}`,
      name,
      oracleText: "",
    }));
    const map = new Map<string, SchemeCard>();
    for (const card of fromScryfall) map.set(card.id, card);
    for (const card of content.schemes) map.set(card.id, card);
    return Array.from(map.values());
  }, [artMap, content.schemes]);

  const shuffleDeck = (cards: SchemeCard[]) =>
    dispatch({ type: "setSchemeDeck", playerId: myId, schemes: cards });

  return (
    <div className="space-y-3">
      {/* Who is the archenemy */}
      <div className="rounded-2xl border border-orange-500/25 bg-gradient-to-b from-orange-500/10 to-transparent px-3 py-2.5">
        <div className="flex items-center justify-between">
          <div>
            <div className="text-[9px] font-black uppercase tracking-[0.14em] text-orange-400/80">
              Archenemy
            </div>
            <div className="text-sm font-extrabold text-white">
              {archenemy?.name ?? "Not chosen"}
            </div>
          </div>
          <div className="text-right">
            <div className="tnum text-xl font-black text-orange-300">
              {deck.length}
            </div>
            <div className="text-[9px] font-bold uppercase tracking-wider text-slate-500">
              schemes left
            </div>
          </div>
        </div>

        {isHost && (
          <div className="mt-2 border-t border-white/5 pt-2">
            <div className="mb-1 text-[9px] font-black uppercase tracking-wider text-slate-500">
              Playing as the archenemy
            </div>
            <div className="flex flex-wrap gap-1.5">
              {state.players.map((player) => (
                <button
                  key={player.id}
                  onClick={() =>
                    dispatch({
                      type: "setArchenemy",
                      playerId: myId,
                      archenemyId: player.id,
                    })
                  }
                  className={`rounded-lg border px-2.5 py-1.5 text-[11px] font-bold ${
                    state.archenemy.archenemyId === player.id
                      ? "border-orange-400/60 bg-orange-500/15 text-orange-300"
                      : "border-line bg-surface-2 text-slate-400"
                  }`}
                >
                  {player.name}
                </button>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* The scheme currently in motion */}
      {last && (
        <div className="animate-pop flex gap-3 rounded-2xl border border-violet/30 bg-violet/5 p-2.5">
          <ZoomThumb
            src={last.image ?? lastArt?.image}
            alt={last.name}
            onZoom={() =>
              setZoom({
                src: last.image ?? lastArt?.image ?? "",
                title: last.name,
                eyebrow: "Scheme in motion",
                body: last.oracleText || lastArt?.oracleText || "",
              })
            }
          />
          <div className="min-w-0 flex-1">
            <div className="text-[9px] font-black uppercase tracking-wider text-violet">
              In motion
            </div>
            <div className="text-sm font-extrabold leading-tight text-white">
              {last.name}
            </div>
            {(last.oracleText || lastArt?.oracleText) && (
              <p className="mt-1 line-clamp-4 text-[11px] leading-snug text-slate-400">
                {last.oracleText || lastArt?.oracleText}
              </p>
            )}
          </div>
        </div>
      )}

      {active.length > 0 && (
        <div className="space-y-1">
          <div className="text-[9px] font-black uppercase tracking-wider text-slate-500">
            Ongoing schemes
          </div>
          {active.map((card) => (
            <div
              key={card.id}
              className="flex items-center justify-between rounded-xl border border-line bg-surface-2 px-3 py-2"
            >
              <span className="min-w-0 flex-1 truncate text-xs font-bold text-slate-200">
                {card.name}
              </span>
              <button
                onClick={() =>
                  dispatch({
                    type: "resolveScheme",
                    playerId: myId,
                    schemeId: card.id,
                    name: card.name,
                  })
                }
                disabled={!canAct}
                className="ml-2 rounded-md bg-white/5 px-2 py-1 text-[10px] font-bold uppercase text-slate-400 hover:text-white disabled:opacity-30"
              >
                Done
              </button>
            </div>
          ))}
        </div>
      )}

      <button
        onClick={() => dispatch({ type: "revealScheme", playerId: myId })}
        disabled={!isArchenemy || deck.length === 0}
        className={`btn w-full py-3.5 text-sm ${
          isArchenemy && deck.length > 0 ? "btn-primary" : "btn-ghost"
        }`}
      >
        <span>😈</span>
        {isArchenemy
          ? deck.length > 0
            ? "Set top scheme in motion"
            : "Scheme deck is empty"
          : "Only the archenemy can reveal"}
      </button>

      {isHost && (
        <button
          onClick={() => setDeckOpen(true)}
          className="btn btn-ghost w-full py-2.5 text-xs"
        >
          Manage scheme deck ({deck.length} in deck)
        </button>
      )}

      <div className="flex items-center justify-between">
        <Badge tone="amber">40 life vs 20 each</Badge>
        <span className="text-[10px] text-slate-500">
          {state.archenemy.resolved.length} resolved
        </span>
      </div>

      <CardZoom card={zoom} onClose={() => setZoom(null)} />

      <Modal open={deckOpen} onClose={() => setDeckOpen(false)} title="Scheme deck">
        <div className="space-y-3">
          <div className="rounded-xl border border-line bg-surface-2 p-3">
            <div className="text-[9px] font-black uppercase tracking-wider text-slate-500">
              Build the deck
            </div>
            <p className="mt-1 text-[11px] leading-snug text-slate-400">
              {available.length > 0
                ? `${available.length} schemes ready — the official set plus anything you added.`
                : "Could not reach the card database. Add schemes by hand below."}
            </p>
            {available.length > 0 && (
              <button
                onClick={() => {
                  shuffleDeck(available);
                  setDeckOpen(false);
                }}
                className="btn btn-primary mt-2 w-full py-2 text-xs"
              >
                Shuffle all {available.length} schemes
              </button>
            )}
          </div>

          <div className="rounded-xl border border-line bg-surface-2 p-3">
            <div className="text-[9px] font-black uppercase tracking-wider text-slate-500">
              Add a scheme by hand
            </div>
            <input
              className="field mt-2 py-2 text-xs"
              placeholder="Scheme name"
              value={nameDraft}
              onChange={(event) => setNameDraft(event.target.value)}
            />
            <textarea
              className="field mt-2 py-2 text-xs"
              placeholder="Rules text (optional)"
              rows={2}
              value={textDraft}
              onChange={(event) => setTextDraft(event.target.value)}
            />
            <button
              disabled={!nameDraft.trim()}
              onClick={() => {
                const card: SchemeCard = {
                  id: `custom_${nameDraft.toLowerCase().replace(/[^a-z0-9]/g, "").slice(0, 24)}`,
                  name: nameDraft.trim(),
                  oracleText: textDraft.trim(),
                };
                shuffleDeck([...deck, ...active, card]);
                setNameDraft("");
                setTextDraft("");
              }}
              className="btn btn-ghost mt-2 w-full py-2 text-xs"
            >
              Add and reshuffle
            </button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
