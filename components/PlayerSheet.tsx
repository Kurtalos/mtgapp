"use client";

import { useState } from "react";
import type { PlayerState, RoomState } from "@/lib/types";
import type { RoomAction } from "@/lib/room/reducer";
import {
  COMMANDER_DAMAGE_LETHAL,
  POISON_LETHAL,
  lethalReason,
} from "@/lib/room/rules";
import { Badge, Modal, SegmentedControl } from "./ui";

type Tab = "life" | "commander" | "counters";

export function PlayerSheet({
  player,
  state,
  open,
  onClose,
  dispatch,
  canEdit,
}: {
  player: PlayerState | null;
  state: RoomState;
  open: boolean;
  onClose: () => void;
  dispatch: (action: RoomAction) => void;
  canEdit: boolean;
}) {
  const [tab, setTab] = useState<Tab>("life");
  const [draft, setDraft] = useState("");

  if (!player) return null;
  // The sheet is open on a stale player object after an update; re-read.
  const live = state.players.find((p) => p.id === player.id) ?? player;
  const opponents = state.players.filter((p) => p.id !== live.id);
  const reason = lethalReason(live, state);

  const setLifeTo = () => {
    const value = Number.parseInt(draft, 10);
    if (Number.isFinite(value)) {
      dispatch({ type: "setLife", playerId: live.id, value });
      setDraft("");
    }
  };

  return (
    <Modal open={open} onClose={onClose} title={live.name} wide>
      <div className="mb-3 flex items-center justify-between">
        <Badge tone={live.eliminated ? "danger" : "mana"}>
          {live.eliminated ? "Eliminated" : "In the game"}
        </Badge>
        {reason && <span className="text-[11px] text-danger">{reason}</span>}
      </div>

      <SegmentedControl<Tab>
        value={tab}
        onChange={setTab}
        options={[
          { value: "life", label: "Life" },
          { value: "commander", label: "Cmdr dmg" },
          { value: "counters", label: "Counters" },
        ]}
      />

      {tab === "life" && (
        <div className="mt-4 space-y-4">
          <div className="text-center">
            <div className="tnum text-6xl font-black leading-none tracking-tighter">
              {live.life}
            </div>
            <div className="mt-1 text-[10px] font-bold uppercase tracking-widest text-slate-500">
              Life total
            </div>
          </div>

          {canEdit && (
            <>
              <div className="grid grid-cols-4 gap-2">
                {[-5, -1, 1, 5].map((delta) => (
                  <button
                    key={delta}
                    onClick={() =>
                      dispatch({ type: "adjustLife", playerId: live.id, delta })
                    }
                    className={`btn py-3.5 text-base ${
                      delta < 0
                        ? "border border-danger/30 bg-danger/10 text-danger"
                        : "border border-mana/30 bg-mana/10 text-mana"
                    }`}
                  >
                    {delta > 0 ? `+${delta}` : delta}
                  </button>
                ))}
              </div>

              <div className="flex gap-2">
                <input
                  className="field tnum"
                  inputMode="numeric"
                  placeholder="Set life to…"
                  value={draft}
                  onChange={(event) => setDraft(event.target.value)}
                  onKeyDown={(event) => {
                    if (event.key === "Enter") setLifeTo();
                  }}
                />
                <button className="btn btn-ghost px-4" onClick={setLifeTo}>
                  Set
                </button>
              </div>

              <button
                onClick={() =>
                  dispatch(
                    live.eliminated
                      ? { type: "revive", playerId: live.id }
                      : { type: "eliminate", playerId: live.id },
                  )
                }
                className="btn w-full border border-white/10 bg-white/5 py-3 text-sm text-slate-300"
              >
                {live.eliminated ? "Put back in the game" : "Eliminate player"}
              </button>
            </>
          )}
        </div>
      )}

      {tab === "commander" && (
        <div className="mt-4 space-y-2">
          <p className="mb-2 text-[11px] leading-relaxed text-slate-500">
            Damage dealt to {live.name} by each opponent&apos;s commander.
            {" "}At {COMMANDER_DAMAGE_LETHAL} from a single commander they lose the game.
          </p>
          {opponents.length === 0 && (
            <p className="text-sm text-slate-500">No opponents yet.</p>
          )}
          {opponents.map((opponent) => {
            const damage = live.commanderDamage[opponent.id] ?? 0;
            const lethal = damage >= COMMANDER_DAMAGE_LETHAL;
            return (
              <div
                key={opponent.id}
                className={`flex items-center justify-between rounded-xl border px-3 py-2 ${
                  lethal
                    ? "border-danger/50 bg-danger/10"
                    : "border-line bg-surface-2"
                }`}
              >
                <span className="min-w-0 flex-1 truncate text-sm font-bold text-slate-200">
                  {opponent.name}
                </span>
                <div className="flex items-center gap-2">
                  <button
                    disabled={!canEdit || damage === 0}
                    onClick={() =>
                      dispatch({
                        type: "adjustCommanderDamage",
                        sourceId: opponent.id,
                        targetId: live.id,
                        delta: -1,
                      })
                    }
                    className="btn h-8 w-8 rounded-lg bg-white/5 text-white disabled:opacity-30"
                  >
                    −
                  </button>
                  <span
                    className={`tnum w-8 text-center text-base font-black ${
                      lethal ? "text-danger" : "text-amber"
                    }`}
                  >
                    {damage}
                  </span>
                  <button
                    disabled={!canEdit}
                    onClick={() =>
                      dispatch({
                        type: "adjustCommanderDamage",
                        sourceId: opponent.id,
                        targetId: live.id,
                        delta: 1,
                      })
                    }
                    className="btn h-8 w-8 rounded-lg bg-white/5 text-white disabled:opacity-30"
                  >
                    +
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {tab === "counters" && (
        <div className="mt-4 space-y-2">
          <CounterRow
            label="Poison"
            hint={`${POISON_LETHAL} loses the game`}
            value={live.poison}
            tone="emerald"
            disabled={!canEdit}
            onChange={(delta) =>
              dispatch({ type: "adjustPoison", playerId: live.id, delta })
            }
          />
          <CounterRow
            label="Energy"
            value={live.energy}
            tone="sky"
            disabled={!canEdit}
            onChange={(delta) =>
              dispatch({
                type: "adjustCounter",
                playerId: live.id,
                counter: "energy",
                delta,
              })
            }
          />
          <CounterRow
            label="Experience"
            value={live.experience}
            tone="violet"
            disabled={!canEdit}
            onChange={(delta) =>
              dispatch({
                type: "adjustCounter",
                playerId: live.id,
                counter: "experience",
                delta,
              })
            }
          />
          <CounterRow
            label="Commander tax"
            hint="Extra {2} per previous cast"
            value={live.commanderTax}
            tone="amber"
            disabled={!canEdit}
            onChange={(delta) =>
              dispatch({
                type: "adjustCounter",
                playerId: live.id,
                counter: "commanderTax",
                delta,
              })
            }
          />
        </div>
      )}
    </Modal>
  );
}

function CounterRow({
  label,
  hint,
  value,
  tone,
  disabled,
  onChange,
}: {
  label: string;
  hint?: string;
  value: number;
  tone: "emerald" | "sky" | "violet" | "amber";
  disabled: boolean;
  onChange: (delta: number) => void;
}) {
  const tones = {
    emerald: "text-emerald-400",
    sky: "text-sky-400",
    violet: "text-violet",
    amber: "text-amber",
  };
  return (
    <div className="flex items-center justify-between rounded-xl border border-line bg-surface-2 px-3 py-2.5">
      <div>
        <div className={`text-sm font-bold ${tones[tone]}`}>{label}</div>
        {hint && (
          <div className="text-[10px] text-slate-500">{hint}</div>
        )}
      </div>
      <div className="flex items-center gap-2">
        <button
          disabled={disabled || value === 0}
          onClick={() => onChange(-1)}
          className="btn h-9 w-9 rounded-lg bg-white/5 text-white disabled:opacity-30"
        >
          −
        </button>
        <span className={`tnum w-7 text-center text-lg font-black ${tones[tone]}`}>
          {value}
        </span>
        <button
          disabled={disabled}
          onClick={() => onChange(1)}
          className="btn h-9 w-9 rounded-lg bg-white/5 text-white disabled:opacity-30"
        >
          +
        </button>
      </div>
    </div>
  );
}
