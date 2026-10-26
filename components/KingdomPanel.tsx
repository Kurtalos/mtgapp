"use client";

import { useState } from "react";
import type { RoleId, RoomState } from "@/lib/types";
import type { RoomAction } from "@/lib/room/reducer";
import { ROLES } from "@/lib/data/roles";
import { Badge } from "./ui";

const ROLE_ORDER: RoleId[] = ["king", "knight", "bandit", "assassin", "usurper"];

export function KingdomPanel({
  state,
  dispatch,
  myId,
  isHost,
}: {
  state: RoomState;
  dispatch: (action: RoomAction) => void;
  myId: string;
  isHost: boolean;
}) {
  const [peeking, setPeeking] = useState(false);
  const [rulesOpen, setRulesOpen] = useState(false);

  const myRole = state.kingdom.roles[myId];
  const meta = myRole ? ROLES[myRole] : null;
  const king = state.players.find((p) => state.kingdom.roles[p.id] === "king");
  const dealt = state.kingdom.dealt;
  const myClaim = state.kingdom.claims[myId];

  return (
    <div className="space-y-3">
      {/* Private role card */}
      {dealt && meta ? (
        <div
          className="relative overflow-hidden rounded-2xl border p-3"
          style={{
            borderColor: `${meta.colour}55`,
            background: `linear-gradient(160deg, ${meta.colour}22, transparent 70%)`,
          }}
        >
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <div className="text-[9px] font-black uppercase tracking-[0.14em] text-slate-400">
                Your secret role
              </div>
              {peeking ? (
                <div className="animate-pop">
                  <div
                    className="text-lg font-black leading-tight"
                    style={{ color: meta.colour }}
                  >
                    {meta.name}
                  </div>
                  <p className="mt-1 text-[11px] leading-relaxed text-slate-300">
                    {meta.detail}
                  </p>
                </div>
              ) : (
                <div className="mt-1 text-sm font-bold text-slate-400">
                  Tap to look — keep it to yourself.
                </div>
              )}
            </div>
            <button
              onClick={() => setPeeking((value) => !value)}
              className="shrink-0 rounded-xl border border-white/10 bg-black/30 px-3 py-2 text-xs font-black uppercase tracking-wider"
              style={{ color: meta.colour }}
            >
              {peeking ? "Hide" : "Peek"}
            </button>
          </div>
          {peeking && (
            <div className="mt-2 border-t border-white/10 pt-2 text-[10px] font-bold uppercase tracking-wider text-slate-500">
              {meta.goal}
            </div>
          )}
        </div>
      ) : (
        <div className="rounded-2xl border border-dashed border-white/15 bg-black/20 px-3 py-4 text-center">
          <div className="text-sm font-bold text-slate-400">
            {state.phase === "lobby" ? "Roles are dealt when the game starts" : "No role assigned"}
          </div>
          <div className="mt-1 text-[11px] text-slate-600">
            Only the King is public. Everyone else keeps theirs hidden.
          </div>
        </div>
      )}

      {/* Public table state */}
      <div className="flex items-center justify-between rounded-xl border border-line bg-surface-2 px-3 py-2">
        <div>
          <div className="text-[9px] font-black uppercase tracking-wider text-slate-500">
            The throne
          </div>
          <div className="text-sm font-extrabold text-amber">
            {king ? king.name : "—"}
          </div>
        </div>
        <div className="text-right">
          <div className="text-[9px] font-black uppercase tracking-wider text-slate-500">
            Still standing
          </div>
          <div className="tnum text-sm font-extrabold text-white">
            {state.players.filter((p) => !p.eliminated).length} / {state.players.length}
          </div>
        </div>
      </div>

      {/* Claim a role out loud */}
      {dealt && (
        <div className="space-y-1">
          <div className="text-[9px] font-black uppercase tracking-wider text-slate-500">
            Claim a role (bluffing allowed)
          </div>
          <div className="flex flex-wrap gap-1.5">
            {ROLE_ORDER.map((roleId) => (
              <button
                key={roleId}
                onClick={() =>
                  dispatch({
                    type: "claimRole",
                    playerId: myId,
                    role: myClaim === roleId ? null : roleId,
                  })
                }
                className={`rounded-lg border px-2.5 py-1.5 text-[11px] font-bold ${
                  myClaim === roleId
                    ? "border-white/30 bg-white/10 text-white"
                    : "border-line bg-surface-2 text-slate-400"
                }`}
              >
                {ROLES[roleId].name}
              </button>
            ))}
          </div>
        </div>
      )}

      {isHost && (
        <div className="flex gap-2">
          <button
            onClick={() => dispatch({ type: "dealRoles", byId: myId })}
            className="btn btn-ghost flex-1 py-2.5 text-xs"
          >
            {dealt ? "Re-deal roles" : "Deal roles now"}
          </button>
          <button
            onClick={() => setRulesOpen((value) => !value)}
            className="btn btn-ghost px-3 py-2.5 text-xs"
          >
            Rules
          </button>
        </div>
      )}

      {rulesOpen && (
        <div className="space-y-2 rounded-xl border border-line bg-surface-2 p-3 text-[11px] leading-relaxed text-slate-400">
          {ROLE_ORDER.map((roleId) => (
            <div key={roleId}>
              <span
                className="font-black"
                style={{ color: ROLES[roleId].colour }}
              >
                {ROLES[roleId].name}
              </span>
              <span className="text-slate-500"> — {ROLES[roleId].goal}</span>
            </div>
          ))}
          <p className="border-t border-line pt-2 text-slate-500">
            The King starts at 50 life and takes the first turn. If the King loses
            while a Bandit is still alive, the Bandits win. The Knight wins with
            the King. The Assassin must be last. A Usurper who lands the killing
            blow swaps roles with the King.
          </p>
        </div>
      )}

      <div className="flex items-center justify-between">
        <Badge tone="amber">Secret roles</Badge>
        <span className="text-[10px] text-slate-500">
          {Object.keys(state.kingdom.claims).length} claims made
        </span>
      </div>
    </div>
  );
}
