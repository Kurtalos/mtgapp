"use client";

import { useMemo, useState } from "react";
import type { PlanarFace, RoomState } from "@/lib/types";
import type { RoomAction } from "@/lib/room/reducer";
import { createRng, randomSeed, rollPlanarFace } from "@/lib/room/random";
import { planesOf } from "@/lib/content";
import { useContent } from "@/lib/useContent";
import { cardArtFor } from "@/lib/scryfall";
import { usePlaneArt } from "@/lib/useCardArt";
import { Badge, Modal } from "./ui";
import { CardZoom, ZoomThumb, type ZoomCard } from "./CardZoom";

const FACE_LABEL = {
  blank: "Blank",
  chaos: "Chaos",
  planeswalk: "Planeswalk",
} as const;

export function PlanechasePanel({
  state,
  dispatch,
  canAct,
  myId,
}: {
  state: RoomState;
  dispatch: (action: RoomAction) => void;
  canAct: boolean;
  myId: string;
}) {
  const content = useContent();
  const allPlanes = useMemo(() => planesOf(content), [content]);
  const planeArt = usePlaneArt();
  const [rolling, setRolling] = useState(false);
  const [lastFace, setLastFace] = useState<"blank" | "chaos" | "planeswalk" | null>(null);
  const [pickerOpen, setPickerOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [manualOpen, setManualOpen] = useState(false);
  const [zoom, setZoom] = useState<ZoomCard | null>(null);

  const plane = state.planechase.current;
  const art = plane?.image
    ? { image: plane.image, name: plane.name, typeLine: "", oracleText: "" }
    : plane
      ? cardArtFor(planeArt, plane.name)
      : null;
  const rolls = state.planechase.rollsThisTurn;
  // First roll each turn is free, then {1}, {2}, {3}…
  const nextCost = Math.max(0, rolls);

  const filtered = useMemo(() => {
    const needle = query.trim().toLowerCase();
    if (!needle) return allPlanes;
    return allPlanes.filter((card) => card.name.toLowerCase().includes(needle));
  }, [allPlanes, query]);

  const commitRoll = (seed: number, manual?: PlanarFace) => {
    const face = manual ?? rollPlanarFace(createRng(seed));
    setLastFace(face);
    setRolling(true);
    window.setTimeout(() => {
      dispatch({ type: "rollPlanarDie", playerId: myId, seed, face: manual });
      setRolling(false);
    }, manual ? 120 : 520);
  };

  const roll = () => {
    if (!canAct || rolling) return;
    commitRoll(randomSeed());
  };

  return (
    <div className="space-y-3">
      {/* Current plane */}
      <div className="overflow-hidden rounded-2xl border border-sky-500/20 bg-gradient-to-b from-sky-500/10 to-transparent">
        <div className="flex items-start justify-between gap-2 px-3 pt-2.5">
          <div className="min-w-0">
            <div className="text-[9px] font-black uppercase tracking-[0.14em] text-sky-400/80">
              Current plane
            </div>
            <h3 className="truncate text-sm font-extrabold text-white">
              {plane?.name ?? "No plane in play"}
            </h3>
          </div>
          <button
            onClick={() => setPickerOpen(true)}
            className="shrink-0 rounded-lg border border-white/10 bg-white/5 px-2 py-1 text-[10px] font-bold text-slate-300"
          >
            Change
          </button>
        </div>

        <div className="flex gap-3 px-3 py-2.5">
          <ZoomThumb
            src={art?.image}
            alt={plane?.name ?? "Plane"}
            onZoom={() =>
              plane &&
              setZoom({
                src: art?.image ?? plane.image ?? "",
                title: plane.name,
                eyebrow: plane.type,
                body: [
                  plane.oracleText || art?.oracleText || "",
                  plane.chaosText && `Chaos: ${plane.chaosText}`,
                ]
                  .filter(Boolean)
                  .join("\n\n"),
              })
            }
          />
          <div className="min-w-0 flex-1 text-[11px] leading-relaxed text-slate-300">
            {plane?.oracleText ? (
              <p>{plane.oracleText}</p>
            ) : (
              <p className="text-slate-500">
                Points at the physical plane card on the table.
              </p>
            )}
            {plane?.chaosText && (
              <p className="mt-1.5 border-t border-white/5 pt-1.5 text-violet">
                <span className="font-black uppercase tracking-wide">Chaos:</span>{" "}
                {plane.chaosText}
              </p>
            )}
          </div>
        </div>

        <div className="flex items-center justify-between border-t border-white/5 px-3 py-1.5 text-[10px] font-bold uppercase tracking-wider text-slate-500">
          <span>{state.planechase.deck.length} cards left in deck</span>
          <span>
            Controller:{" "}
            {state.players.find((p) => p.id === state.planechase.controllerId)?.name ??
              "—"}
          </span>
        </div>
      </div>

      {/* Chaos alert */}
      {state.planechase.chaosPending && (
        <div className="animate-pop chaos-glow rounded-2xl border border-violet/50 bg-violet/10 px-3 py-3">
          <div className="flex items-center justify-between">
            <span className="text-sm font-black uppercase tracking-wider text-violet">
              Chaos ensues!
            </span>
            <button
              onClick={() => dispatch({ type: "ackChaos", playerId: myId })}
              className="rounded-lg bg-violet/20 px-2 py-1 text-[10px] font-black uppercase tracking-wider text-violet"
            >
              Resolve
            </button>
          </div>
          <p className="mt-1 text-[11px] leading-relaxed text-violet/80">
            {plane?.chaosText ?? "Trigger the chaos ability of the current plane."}
          </p>
        </div>
      )}

      {/* Die */}
      <div className="flex gap-2">
        <button
          onClick={roll}
          disabled={!canAct || rolling}
          className={`btn flex-1 py-3.5 text-sm ${
            rolling ? "btn-ghost" : "btn-primary"
          }`}
        >
          {rolling ? (
            <span className="animate-pulse">Rolling…</span>
          ) : (
            <>
              <span className="text-base">🎲</span> Roll planar die
              <span className="rounded bg-black/20 px-1.5 py-0.5 text-[10px] font-black">
                {nextCost === 0 ? "free" : `{${nextCost}}`}
              </span>
            </>
          )}
        </button>
        <button
          onClick={() => dispatch({ type: "newturn" })}
          className="btn btn-ghost px-3 text-[11px] uppercase"
          title="Reset the per-turn roll count"
        >
          New turn
        </button>
      </div>

      <div className="flex items-center justify-between">
        <button
          onClick={() => setManualOpen((value) => !value)}
          className="text-[10px] font-bold uppercase tracking-wider text-slate-500 hover:text-white"
        >
          {manualOpen ? "Hide manual result" : "Die landed off the table?"}
        </button>
        <span className="text-[10px] text-slate-600">click a face to log it</span>
      </div>

      {manualOpen && (
        <div className="grid grid-cols-3 gap-2">
          {(
            [
              { face: "blank" as PlanarFace, label: "Blank" },
              { face: "chaos" as PlanarFace, label: "Chaos" },
              { face: "planeswalk" as PlanarFace, label: "Planeswalk" },
            ]
          ).map((option) => (
            <button
              key={option.face}
              disabled={!canAct || rolling}
              onClick={() => commitRoll(randomSeed(), option.face)}
              className="btn btn-ghost py-2 text-[11px] font-black uppercase tracking-wider disabled:opacity-40"
            >
              {option.label}
            </button>
          ))}
        </div>
      )}

      <div className="flex items-center justify-between text-[10px] text-slate-500">
        <span>
          Rolls this turn: <b className="text-slate-300">{rolls}</b>
          {lastFace && !rolling && (
            <>
              {" · last: "}
              <b className="text-slate-300">{FACE_LABEL[lastFace]}</b>
            </>
          )}
        </span>
        <button
          onClick={() =>
            dispatch({
              type: "planeswalk",
              playerId: myId,
            })
          }
          disabled={!canAct}
          className="font-black uppercase tracking-wider text-sky-400 disabled:opacity-40"
        >
          Planeswalk →
        </button>
      </div>

      <CardZoom card={zoom} onClose={() => setZoom(null)} />

      <Modal open={pickerOpen} onClose={() => setPickerOpen(false)} title="Set the plane">
        <input
          className="field mb-3"
          placeholder="Search planes…"
          value={query}
          onChange={(event) => setQuery(event.target.value)}
        />
        <div className="max-h-[50vh] space-y-1 overflow-y-auto scrollbar-thin">
          {filtered.map((card) => (
            <button
              key={card.id}
              onClick={() => {
                dispatch({ type: "setPlane", playerId: myId, plane: card });
                setPickerOpen(false);
              }}
              className={`w-full rounded-lg px-3 py-2 text-left text-sm transition-colors hover:bg-white/5 ${
                card.id === plane?.id
                  ? "bg-sky-500/15 font-bold text-sky-300"
                  : "text-slate-300"
              }`}
            >
              {card.name}
            </button>
          ))}
          {filtered.length === 0 && (
            <p className="py-6 text-center text-sm text-slate-500">No planes match.</p>
          )}
          <p className="px-3 pt-2 text-[10px] text-slate-600">
            {allPlanes.length} planes available · add more in the admin panel
          </p>
        </div>
        <div className="mt-3 flex items-center justify-between border-t border-line pt-3">
          <Badge tone="info">{state.planechase.deck.length} in deck</Badge>
          <button
            onClick={() => {
              dispatch({ type: "resetPlanarDeck", planes: content.planes });
              setPickerOpen(false);
            }}
            className="text-[11px] font-bold uppercase tracking-wider text-slate-400 hover:text-white"
          >
            Reshuffle deck
          </button>
        </div>
      </Modal>
    </div>
  );
}
