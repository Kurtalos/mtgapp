"use client";

import { useState } from "react";
import type { RoomState } from "@/lib/types";
import type { RoomAction } from "@/lib/room/reducer";
import { cardArtFor } from "@/lib/scryfall";
import { schemeNames, useSchemeArt } from "@/lib/useCardArt";
import { Badge } from "./ui";

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
  const [nameDraft, setNameDraft] = useState("");

  const archenemy = state.players.find((p) => p.id === state.archenemy.archenemyId);
  const isArchenemy = state.archenemy.archenemyId === myId;
  const deck = state.archenemy.deck;
  const last = state.archenemy.lastRevealed;
  const lastArt = last ? cardArtFor(artMap, last) : null;
  const available = schemeNames(artMap);

  return (
    <div className="space-y-3">
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
      </div>

      {last && (
        <div className="animate-pop flex gap-3 rounded-2xl border border-violet/30 bg-violet/5 p-2.5">
          {lastArt ? (
            /* eslint-disable-next-line @next/next/no-img-element */
            <img
              src={lastArt.image}
              alt={last}
              className="h-24 w-[68px] shrink-0 rounded-lg border border-white/10 object-cover"
              loading="lazy"
            />
          ) : (
            <div className="flex h-24 w-[68px] shrink-0 items-center justify-center rounded-lg border border-dashed border-white/15 text-[9px] text-slate-600">
              scheme
            </div>
          )}
          <div className="min-w-0 flex-1">
            <div className="text-[9px] font-black uppercase tracking-wider text-violet">
              In motion
            </div>
            <div className="text-sm font-extrabold leading-tight text-white">{last}</div>
            {lastArt?.oracleText && (
              <p className="mt-1 line-clamp-4 text-[11px] leading-snug text-slate-400">
                {lastArt.oracleText}
              </p>
            )}
          </div>
        </div>
      )}

      {state.archenemy.active.length > 0 && (
        <div className="space-y-1">
          <div className="text-[9px] font-black uppercase tracking-wider text-slate-500">
            Ongoing schemes
          </div>
          {state.archenemy.active.map((name) => (
            <div
              key={name}
              className="flex items-center justify-between rounded-xl border border-line bg-surface-2 px-3 py-2"
            >
              <span className="min-w-0 flex-1 truncate text-xs font-bold text-slate-200">
                {name}
              </span>
              <button
                onClick={() => dispatch({ type: "resolveScheme", playerId: myId, name })}
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

      {(deck.length === 0 || state.phase === "lobby") && isHost && (
        <div className="rounded-xl border border-line bg-surface-2 p-3">
          <div className="text-[9px] font-black uppercase tracking-wider text-slate-500">
            Scheme deck
          </div>
          {available.length > 0 ? (
            <>
              <p className="mt-1 text-[11px] leading-snug text-slate-500">
                {available.length} schemes found online.
              </p>
              <button
                onClick={() =>
                  dispatch({ type: "setSchemeDeck", playerId: myId, names: available })
                }
                className="btn btn-ghost mt-2 w-full py-2 text-xs"
              >
                Shuffle {available.length} schemes into the deck
              </button>
            </>
          ) : (
            <>
              <p className="mt-1 text-[11px] leading-snug text-slate-500">
                Card data unavailable offline — add a scheme by name instead.
              </p>
              <div className="mt-2 flex gap-2">
                <input
                  className="field py-2 text-xs"
                  placeholder="Scheme name"
                  value={nameDraft}
                  onChange={(event) => setNameDraft(event.target.value)}
                  onKeyDown={(event) => {
                    if (event.key === "Enter" && nameDraft.trim()) {
                      dispatch({
                        type: "setSchemeDeck",
                        playerId: myId,
                        names: [...deck, nameDraft.trim()],
                      });
                      setNameDraft("");
                    }
                  }}
                />
                <button
                  className="btn btn-ghost px-3 text-xs"
                  onClick={() => {
                    if (!nameDraft.trim()) return;
                    dispatch({
                      type: "setSchemeDeck",
                      playerId: myId,
                      names: [...deck, nameDraft.trim()],
                    });
                    setNameDraft("");
                  }}
                >
                  Add
                </button>
              </div>
            </>
          )}
        </div>
      )}

      {isHost && state.phase === "lobby" && (
        <div className="space-y-1">
          <div className="text-[9px] font-black uppercase tracking-wider text-slate-500">
            Who is the archenemy?
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
                className={`rounded-lg border px-2.5 py-1.5 text-xs font-bold ${
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

      <div className="flex items-center justify-between">
        <Badge tone="amber">40 life vs 20 each</Badge>
        <span className="text-[10px] text-slate-500">
          {state.archenemy.resolved.length} resolved
        </span>
      </div>
    </div>
  );
}
