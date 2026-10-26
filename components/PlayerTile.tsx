"use client";

import type { PlayerState, RoomState } from "@/lib/types";
import {
  COMMANDER_DAMAGE_LETHAL,
  POISON_LETHAL,
  highestCommanderDamage,
} from "@/lib/room/rules";

export const SEAT_COLOURS = [
  "#00f296",
  "#a881ff",
  "#38bdf8",
  "#facc15",
  "#fb7185",
  "#34d399",
  "#f97316",
  "#e879f9",
];

export function seatColour(seat: number): string {
  return SEAT_COLOURS[seat % SEAT_COLOURS.length];
}

export function PlayerTile({
  player,
  state,
  isMe,
  canEdit,
  isOnline,
  onAdjust,
  onOpen,
}: {
  player: PlayerState;
  state: RoomState;
  isMe: boolean;
  canEdit: boolean;
  isOnline: boolean;
  onAdjust: (delta: number) => void;
  onOpen: () => void;
}) {
  const colour = seatColour(player.seat);
  const cmd = highestCommanderDamage(player);
  const lethal = player.eliminated;
  const poisoned = player.poison > 0;
  const role = state.kingdom.roles[player.id];
  const rolePublic = state.kingdom.revealed.includes(player.id);
  const isKing = state.mode === "kingdom" && role === "king" && rolePublic;
  const isArchenemy = state.mode === "archenemy" && state.archenemy.archenemyId === player.id;
  const atRisk =
    !lethal &&
    (player.life <= 5 ||
      player.poison >= POISON_LETHAL - 2 ||
      cmd >= COMMANDER_DAMAGE_LETHAL - 4);

  return (
    <div
      className={`relative flex flex-col overflow-hidden rounded-2xl border transition-colors ${
        lethal
          ? "border-white/5 bg-black/40 opacity-60"
          : isMe
            ? "border-transparent bg-surface-2"
            : "border-line bg-surface"
      }`}
      style={
        isMe && !lethal
          ? { boxShadow: `inset 0 0 0 2px ${colour}66, 0 8px 24px -12px ${colour}55` }
          : undefined
      }
    >
      <div
        className="absolute inset-x-0 top-0 h-[3px]"
        style={{ background: lethal ? "#334155" : colour }}
      />

      <button
        onClick={onOpen}
        className="flex min-h-0 flex-1 flex-col items-center justify-center px-2 pt-3 pb-1 text-center"
      >
        <div className="flex w-full items-center justify-center gap-1">
          <span
            className={`max-w-full truncate text-[11px] font-extrabold uppercase tracking-wide ${
              isMe ? "text-white" : "text-slate-300"
            }`}
          >
            {player.name}
          </span>
          {!isOnline && !lethal && (
            <span
              title="Not connected right now"
              className="h-1.5 w-1.5 shrink-0 rounded-full bg-slate-600"
            />
          )}
        </div>

        <div className="flex flex-1 items-center justify-center">
          <span
            className={`tnum text-[clamp(2.1rem,11vw,3.4rem)] font-black leading-none tracking-tighter ${
              lethal
                ? "text-slate-600 line-through"
                : atRisk
                  ? "text-danger"
                  : "text-white"
            }`}
          >
            {player.life}
          </span>
        </div>

        <div className="flex h-4 items-center gap-1.5">
          {isKing && (
            <span className="rounded bg-amber/20 px-1 text-[9px] font-black uppercase tracking-wider text-amber">
              👑 King
            </span>
          )}
          {isArchenemy && (
            <span className="rounded bg-orange-500/20 px-1 text-[9px] font-black uppercase tracking-wider text-orange-300">
              Archenemy
            </span>
          )}
          {poisoned && (
            <span className="tnum rounded bg-emerald-500/15 px-1 text-[9px] font-black text-emerald-300">
              ☠ {player.poison}
            </span>
          )}
          {cmd > 0 && (
            <span
              className={`tnum rounded px-1 text-[9px] font-black ${
                cmd >= COMMANDER_DAMAGE_LETHAL
                  ? "bg-danger/20 text-danger"
                  : "bg-amber/15 text-amber"
              }`}
            >
              ⚔ {cmd}
            </span>
          )}
          {lethal && (
            <span className="rounded bg-white/5 px-1 text-[9px] font-black uppercase text-slate-500">
              Out
            </span>
          )}
        </div>
      </button>

      <div className="grid grid-cols-4 border-t border-white/5">
        {canEdit && !lethal ? (
          [-5, -1, 1, 5].map((delta) => (
            <button
              key={delta}
              onClick={() => onAdjust(delta)}
              className={`tnum py-3 text-sm font-black transition-colors active:bg-white/10 ${
                delta < 0
                  ? "text-danger/90 hover:bg-danger/10"
                  : "text-mana/90 hover:bg-mana/10"
              } ${delta === -5 || delta === 1 ? "border-r border-white/5" : ""}`}
            >
              {delta > 0 ? `+${delta}` : delta}
            </button>
          ))
        ) : (
          <div className="col-span-4 py-2 text-center text-[9px] font-bold uppercase tracking-wider text-slate-600">
            {lethal ? "Eliminated" : "View only"}
          </div>
        )}
      </div>
    </div>
  );
}
