"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  MODE_META,
  type GameMode,
  type PlayerState,
  type RoomState,
} from "@/lib/types";
import { useRoom } from "@/lib/useRoom";
import { getSavedName, saveName } from "@/lib/identity";
import { PlayerTile } from "@/components/PlayerTile";
import { PlayerSheet } from "@/components/PlayerSheet";
import { PlanechasePanel } from "@/components/PlanechasePanel";
import { ArchenemyPanel } from "@/components/ArchenemyPanel";
import { KingdomPanel } from "@/components/KingdomPanel";
import { Badge, Modal } from "@/components/ui";

type Tab = "table" | "mode" | "log";

export function RoomClient({ code }: { code: string }) {
  const router = useRouter();
  const { status, room, me, meId, isHost, dispatch, onlineIds } = useRoom(code);

  const [name, setName] = useState("");
  const [gateOpen, setGateOpen] = useState(false);
  const [sheetId, setSheetId] = useState<string | null>(null);
  const [tab, setTab] = useState<Tab>("table");
  const [menuOpen, setMenuOpen] = useState(false);
  const [copied, setCopied] = useState(false);
  const [toolsOpen, setToolsOpen] = useState(false);
  const [dice, setDice] = useState<{ sides: number; value: number } | null>(null);
  const [coin, setCoin] = useState<"heads" | "tails" | null>(null);
  const [resultsDismissed, setResultsDismissed] = useState(false);

  useEffect(() => {
    // A new game clears the previous result screen.
    if (room?.state.phase !== "finished") setResultsDismissed(false);
  }, [room?.state.phase]);

  // Read persisted identity only after mount so server and client agree.
  useEffect(() => {
    setName(getSavedName());
  }, []);

  const inLobby = room?.state.phase === "lobby";
  const isPlayer = Boolean(me);

  // Auto-join once we know who we are and the table still has room. If the
  // saved name is already taken at this table (two Daves, or a second tab in
  // local mode) ask for a different one instead of silently creating a clone.
  useEffect(() => {
    if (!room || !meId || isPlayer) return;
    if (!inLobby) return;
    const stored = getSavedName();
    const taken = room.state.players.some(
      (p) => p.name.trim().toLowerCase() === stored.trim().toLowerCase(),
    );
    if (!stored || taken) {
      setGateOpen(true);
      return;
    }
    dispatch({ type: "join", playerId: meId, name: stored });
  }, [dispatch, inLobby, isPlayer, meId, room]);

  useEffect(() => {
    if (!room || !meId) return;
    if (!inLobby && !isPlayer) setGateOpen(false);
  }, [inLobby, isPlayer, meId, room]);

  const players = useMemo(
    () => [...(room?.state.players ?? [])].sort((a, b) => a.seat - b.seat),
    [room],
  );

  // Someone else at the table already goes by this name.
  const nameTaken = useMemo(() => {
    const wanted = name.trim().toLowerCase();
    if (!wanted) return false;
    return players.some(
      (p) => p.id !== meId && p.name.trim().toLowerCase() === wanted,
    );
  }, [meId, name, players]);

  const sheetPlayer = players.find((p) => p.id === sheetId) ?? null;
  const canEditSheet = Boolean(me) && (isHost || sheetId === meId);

  const copyCode = async () => {
    const url =
      typeof window !== "undefined"
        ? `${window.location.origin}/room/${code}`
        : `/room/${code}`;
    try {
      if (navigator.share) {
        await navigator.share({ title: "Mana Table", text: `Join my table: ${code}`, url });
        return;
      }
      await navigator.clipboard.writeText(url);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1800);
    } catch {
      try {
        await navigator.clipboard.writeText(code);
        setCopied(true);
        window.setTimeout(() => setCopied(false), 1800);
      } catch {
        /* clipboard unavailable */
      }
    }
  };

  // ------------------------------------------------------------- loading states
  if (status === "loading") {
    return (
      <Skeleton label="Opening the table…" />
    );
  }

  if (status === "missing") {
    return (
      <main className="mx-auto flex min-h-screen max-w-md flex-col items-center justify-center gap-4 p-6 text-center">
        <div className="card w-full p-6">
          <h1 className="text-xl font-black">Table not found</h1>
          <p className="mt-2 text-sm text-slate-400">
            There is no room <span className="font-mono text-mana">{code}</span>{" "}
            {room ? "on this table" : "here"}. Ask your host for the code again —
            they may have closed it.
          </p>
          <Link href="/" className="btn btn-primary mt-5 w-full py-3">
            Back to the lobby
          </Link>
        </div>
      </main>
    );
  }

  if (!room) return <Skeleton label="Loading…" />;

  const { state } = room;
  const meta = MODE_META[state.mode];

  return (
    <main
      className="mx-auto flex min-h-screen w-full max-w-xl flex-col px-3 pb-6"
      style={{ paddingTop: "calc(0.75rem + var(--sat))" }}
    >
      {/* ---------------------------------------------------------------- header */}
      <header className="mb-3 flex items-center gap-2">
        <Link
          href="/"
          className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border border-line bg-surface-2 text-slate-400"
          aria-label="Leave table"
        >
          ←
        </Link>
        <button
          onClick={copyCode}
          className="flex min-w-0 flex-1 items-center gap-2 rounded-xl border border-line bg-surface-2 px-3 py-1.5 text-left"
        >
          <div className="min-w-0 flex-1">
            <div className="text-[9px] font-black uppercase tracking-[0.14em] text-slate-500">
              {meta.name} · {state.phase === "lobby" ? "Lobby" : state.phase === "finished" ? "Finished" : "In play"}
            </div>
            <div className="tnum truncate text-sm font-black tracking-[0.2em] text-mana">
              {code}
            </div>
          </div>
          <span className="shrink-0 rounded-lg bg-white/5 px-2 py-1 text-[10px] font-bold text-slate-400">
            {copied ? "Copied" : "Share"}
          </span>
        </button>
        <button
          onClick={() => setMenuOpen(true)}
          className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border border-line bg-surface-2 text-slate-300"
          aria-label="Table menu"
        >
          ⋯
        </button>
      </header>

      {!isPlayer && !inLobby && (
        <div className="mb-3 rounded-xl border border-sky-500/30 bg-sky-500/10 px-3 py-2 text-[11px] font-bold text-sky-300">
          You are watching this table — changes are read-only.
        </div>
      )}

      {/* ----------------------------------------------------------------- lobby */}
      {inLobby ? (
        <LobbyView
          state={state}
          players={players}
          meId={meId}
          isHost={isHost}
          onlineIds={onlineIds}
          onStart={() => dispatch({ type: "start", byId: meId })}
          onMode={(mode) => dispatch({ type: "setMode", mode })}
          onLife={(life) => dispatch({ type: "setStartingLife", life })}
          onKick={(playerId) => dispatch({ type: "kick", byId: meId, playerId })}
          onOpenPlayer={setSheetId}
          onCopy={copyCode}
          copied={copied}
        />
      ) : (
        <>
          {/* ------------------------------------------------------------- players */}
          <div
            className={`mb-3 grid gap-2 ${
              players.length <= 2 ? "grid-cols-1" : "grid-cols-2"
            }`}
          >
            {players.map((player) => (
              <PlayerTile
                key={player.id}
                player={player}
                state={state}
                isMe={player.id === meId}
                canEdit={Boolean(me)}
                isOnline={onlineIds.size === 0 || onlineIds.has(player.id)}
                onAdjust={(delta) =>
                  dispatch({ type: "adjustLife", playerId: player.id, delta })
                }
                onOpen={() => setSheetId(player.id)}
              />
            ))}
          </div>

          {/* ----------------------------------------------------------------- tabs */}
          <div className="mb-3 flex gap-1 rounded-xl bg-surface-2 p-1">
            {(
              [
                { id: "table", label: "Table" },
                { id: "mode", label: meta.name },
                { id: "log", label: "Log" },
              ] as Array<{ id: Tab; label: string }>
            ).map((item) => (
              <button
                key={item.id}
                onClick={() => setTab(item.id)}
                className={`flex-1 rounded-lg px-2 py-2 text-[11px] font-extrabold uppercase tracking-wide transition-colors ${
                  tab === item.id ? "bg-mana text-black" : "text-slate-400"
                }`}
              >
                {item.label}
              </button>
            ))}
          </div>

          <div className="flex-1">
            {tab === "table" && (
              <TableTab
                state={state}
                meId={meId}
                isHost={isHost}
                dispatch={dispatch}
                onOpenPlayer={setSheetId}
                onTools={() => setToolsOpen(true)}
              />
            )}

            {tab === "mode" && (
              <div className="space-y-3">
                {state.mode === "planechase" && (
                  <PlanechasePanel
                    state={state}
                    dispatch={dispatch}
                    canAct={Boolean(me)}
                    myId={meId}
                  />
                )}
                {state.mode === "archenemy" && (
                  <ArchenemyPanel
                    state={state}
                    dispatch={dispatch}
                    canAct={Boolean(me)}
                    myId={meId}
                    isHost={isHost}
                  />
                )}
                {state.mode === "kingdom" && (
                  <KingdomPanel
                    state={state}
                    dispatch={dispatch}
                    myId={meId}
                    isHost={isHost}
                  />
                )}
                {state.mode === "commander" && (
                  <div className="card p-4">
                    <h3 className="text-sm font-extrabold">Commander</h3>
                    <p className="mt-1 text-[11px] leading-relaxed text-slate-400">
                      40 life, 21 commander damage from a single commander, and
                      ten poison counters. Open any player and switch to
                      <b className="text-slate-200"> Cmdr dmg</b> to track damage
                      per opponent.
                    </p>
                  </div>
                )}
              </div>
            )}

            {tab === "log" && <LogTab state={state} />}
          </div>
        </>
      )}

      {/* -------------------------------------------------------------- overlays */}
      {state.phase === "finished" && !resultsDismissed && (
        <WinnerOverlay
          state={state}
          isHost={isHost}
          onNextGame={() => dispatch({ type: "reset", byId: meId })}
          onDismiss={() => setResultsDismissed(true)}
        />
      )}

      <Modal open={gateOpen} onClose={() => router.push("/")} title="Join the table">
        <p className="mb-3 text-sm text-slate-400">
          What should we call you at this table?
        </p>
        <input
          className="field mb-3"
          placeholder="Your name"
          value={name}
          maxLength={24}
          onChange={(event) => setName(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === "Enter" && name.trim() && !nameTaken) {
              saveName(name);
              dispatch({ type: "join", playerId: meId, name: name.trim() });
              setGateOpen(false);
            }
          }}
        />
        {nameTaken && (
          <p className="mb-2 text-[11px] font-semibold text-amber">
            Someone here is already called that — pick another.
          </p>
        )}
        <button
          className="btn btn-primary w-full py-3"
          disabled={!name.trim() || nameTaken}
          onClick={() => {
            saveName(name);
            dispatch({ type: "join", playerId: meId, name: name.trim() });
            setGateOpen(false);
          }}
        >
          Take a seat
        </button>
      </Modal>

      <PlayerSheet
        player={sheetPlayer}
        state={state}
        open={Boolean(sheetPlayer)}
        onClose={() => setSheetId(null)}
        dispatch={dispatch}
        canEdit={canEditSheet}
      />

      <Modal open={menuOpen} onClose={() => setMenuOpen(false)} title="Table">
        <div className="space-y-2">
          <button onClick={copyCode} className="btn btn-ghost w-full py-3 text-sm">
            {copied ? "Link copied" : "Share table link"}
          </button>
          <button
            onClick={() => {
              setMenuOpen(false);
              setToolsOpen(true);
            }}
            className="btn btn-ghost w-full py-3 text-sm"
          >
            Dice & coin
          </button>
          {isHost && (
            <button
              onClick={() => {
                dispatch({ type: "reset", byId: meId });
                setMenuOpen(false);
              }}
              className="btn btn-ghost w-full py-3 text-sm"
            >
              Reset the table
            </button>
          )}
          <div className="rounded-xl border border-line bg-surface-2 p-3 text-[11px] leading-relaxed text-slate-500">
            <b className="text-slate-300">{meta.name}</b> — {meta.summary}
          </div>
        </div>
      </Modal>

      <Modal open={toolsOpen} onClose={() => setToolsOpen(false)} title="Dice & coin">
        <div className="space-y-4">
          <div>
            <div className="label">Coin</div>
            <div className="flex items-center gap-2">
              <button
                onClick={() => setCoin(Math.random() > 0.5 ? "heads" : "tails")}
                className="btn btn-ghost flex-1 py-3 text-sm uppercase"
              >
                Flip
              </button>
              <div className="tnum flex h-12 min-w-24 items-center justify-center rounded-xl bg-amber/15 px-4 text-sm font-black uppercase text-amber">
                {coin ?? "—"}
              </div>
            </div>
          </div>
          <div>
            <div className="label">Dice</div>
            <div className="grid grid-cols-6 gap-1.5">
              {[4, 6, 8, 10, 12, 20].map((sides) => (
                <button
                  key={sides}
                  onClick={() =>
                    setDice({
                      sides,
                      value: Math.floor(Math.random() * sides) + 1,
                    })
                  }
                  className={`btn py-2 text-xs ${
                    dice?.sides === sides ? "bg-violet text-black" : "btn-ghost"
                  }`}
                >
                  d{sides}
                </button>
              ))}
            </div>
            {dice && (
              <div className="animate-pop mt-3 text-center">
                <div className="tnum text-5xl font-black text-violet">{dice.value}</div>
                <div className="text-[10px] font-bold uppercase tracking-widest text-slate-500">
                  d{dice.sides}
                </div>
              </div>
            )}
          </div>
        </div>
      </Modal>
    </main>
  );
}

/* -------------------------------------------------------------------------- */

function Skeleton({ label }: { label: string }) {
  return (
    <main className="flex min-h-screen items-center justify-center p-6">
      <div className="flex flex-col items-center gap-3 text-slate-500">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-line border-t-mana" />
        <span className="text-xs font-bold uppercase tracking-widest">{label}</span>
      </div>
    </main>
  );
}

function LobbyView({
  state,
  players,
  meId,
  isHost,
  onlineIds,
  onStart,
  onMode,
  onLife,
  onKick,
  onOpenPlayer,
  onCopy,
  copied,
}: {
  state: RoomState;
  players: PlayerState[];
  meId: string;
  isHost: boolean;
  onlineIds: Set<string>;
  onStart: () => void;
  onMode: (mode: GameMode) => void;
  onLife: (life: number) => void;
  onKick: (playerId: string) => void;
  onOpenPlayer: (playerId: string) => void;
  onCopy: () => void;
  copied: boolean;
}) {
  const modes: GameMode[] = ["commander", "planechase", "archenemy", "kingdom"];

  return (
    <div className="space-y-3">
      <div className="card p-4">
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-extrabold uppercase tracking-wider text-slate-300">
            At the table
          </h2>
          <Badge tone="mana">{players.length} joined</Badge>
        </div>

        <div className="mt-3 space-y-1.5">
          {players.map((player) => (
            <div
              key={player.id}
              className="flex items-center gap-2 rounded-xl border border-line bg-surface-2 px-3 py-2"
            >
              <button
                onClick={() => onOpenPlayer(player.id)}
                className="flex min-w-0 flex-1 items-center gap-2 text-left"
              >
                <span className="truncate text-sm font-bold text-slate-200">
                  {player.name}
                </span>
                {player.id === state.hostId && <Badge tone="violet">Host</Badge>}
                {player.id === meId && <Badge tone="mana">You</Badge>}
                {onlineIds.size > 0 && !onlineIds.has(player.id) && (
                  <span className="h-1.5 w-1.5 rounded-full bg-slate-600" />
                )}
              </button>
              {isHost && player.id !== meId && (
                <button
                  onClick={() => onKick(player.id)}
                  className="rounded-lg px-2 py-1 text-[10px] font-bold uppercase text-danger/80 hover:bg-danger/10"
                >
                  Kick
                </button>
              )}
            </div>
          ))}
        </div>

        <button onClick={onCopy} className="btn btn-ghost mt-3 w-full py-2.5 text-xs">
          {copied ? "Link copied" : "Share the join link"}
        </button>
      </div>

      {isHost ? (
        <>
          <div className="card p-4">
            <h2 className="mb-2 text-sm font-extrabold uppercase tracking-wider text-slate-300">
              Format
            </h2>
            <div className="grid grid-cols-2 gap-2">
              {modes.map((mode) => {
                const info = MODE_META[mode];
                const active = state.mode === mode;
                return (
                  <button
                    key={mode}
                    onClick={() => onMode(mode)}
                    className={`rounded-xl border p-3 text-left transition-colors ${
                      active
                        ? "border-transparent bg-white/10"
                        : "border-line bg-surface-2 hover:border-white/20"
                    }`}
                    style={active ? { boxShadow: `inset 0 0 0 2px ${info.accent}` } : undefined}
                  >
                    <div
                      className="text-sm font-black"
                      style={{ color: active ? info.accent : undefined }}
                    >
                      {info.name}
                    </div>
                    <div className="text-[10px] text-slate-500">{info.players}</div>
                  </button>
                );
              })}
            </div>
            <p className="mt-2 text-[11px] leading-relaxed text-slate-500">
              {MODE_META[state.mode].summary}
            </p>
          </div>

          <div className="card p-4">
            <div className="flex items-center justify-between">
              <h2 className="text-sm font-extrabold uppercase tracking-wider text-slate-300">
                Starting life
              </h2>
              <span className="tnum text-lg font-black text-mana">
                {state.startingLife}
              </span>
            </div>
            <div className="mt-2 grid grid-cols-4 gap-2">
              {[20, 30, 40, 60].map((preset) => (
                <button
                  key={preset}
                  onClick={() => onLife(preset)}
                  className={`btn py-2.5 text-sm ${
                    state.startingLife === preset ? "btn-primary" : "btn-ghost"
                  }`}
                >
                  {preset}
                </button>
              ))}
            </div>
          </div>

          <button onClick={onStart} className="btn btn-primary w-full py-4 text-base">
            Start game
          </button>
        </>
      ) : (
        <div className="card p-5 text-center">
          <div className="mx-auto mb-2 h-6 w-6 animate-spin rounded-full border-2 border-line border-t-mana" />
          <p className="text-sm font-bold text-slate-300">Waiting for the host</p>
          <p className="mt-1 text-[11px] text-slate-500">
            The table starts as soon as they hit go.
          </p>
        </div>
      )}
    </div>
  );
}

function TableTab({
  state,
  meId,
  isHost,
  dispatch,
  onOpenPlayer,
  onTools,
}: {
  state: RoomState;
  meId: string;
  isHost: boolean;
  dispatch: ReturnType<typeof useRoom>["dispatch"];
  onOpenPlayer: (playerId: string) => void;
  onTools: () => void;
}) {
  const me = state.players.find((p) => p.id === meId);
  const living = state.players.filter((p) => !p.eliminated);

  return (
    <div className="space-y-3">
      <div className="grid grid-cols-3 gap-2">
        <button
          onClick={() => me && onOpenPlayer(me.id)}
          className="btn btn-ghost flex-col gap-0.5 py-3 text-[10px] uppercase tracking-wider"
        >
          <span className="text-base">🃏</span>
          My card
        </button>
        <button
          onClick={onTools}
          className="btn btn-ghost flex-col gap-0.5 py-3 text-[10px] uppercase tracking-wider"
        >
          <span className="text-base">🎲</span>
          Dice
        </button>
        {isHost ? (
          <button
            onClick={() => dispatch({ type: "reset", byId: meId })}
            className="btn btn-ghost flex-col gap-0.5 py-3 text-[10px] uppercase tracking-wider"
          >
            <span className="text-base">↺</span>
            Reset
          </button>
        ) : (
          <button
            onClick={() => me && onOpenPlayer(me.id)}
            className="btn btn-ghost flex-col gap-0.5 py-3 text-[10px] uppercase tracking-wider"
          >
            <span className="text-base">☠</span>
            Counters
          </button>
        )}
      </div>

      <div className="rounded-xl border border-line bg-surface-2 px-3 py-2.5 text-[11px] text-slate-400">
        <span className="font-black uppercase tracking-wider text-slate-500">
          Alive
        </span>{" "}
        {living.length} of {state.players.length}
        {state.mode === "archenemy" && state.archenemy.archenemyId && (
          <>
            {" · "}
            <span className="text-orange-300">
              Archenemy:{" "}
              {state.players.find((p) => p.id === state.archenemy.archenemyId)?.name}
            </span>
          </>
        )}
        {state.mode === "planechase" && state.planechase.current && (
          <>
            {" · "}
            <span className="text-sky-300">
              Plane in play
            </span>
          </>
        )}
      </div>
    </div>
  );
}

function LogTab({
  state,
}: {
  state: RoomState;
}) {
  return (
    <div className="card divide-y divide-white/5 overflow-hidden">
      {state.log.length === 0 && (
        <p className="p-4 text-center text-sm text-slate-500">
          Nothing has happened yet.
        </p>
      )}
      {state.log.map((entry) => (
        <div key={entry.id} className="flex gap-3 px-3 py-2.5">
          <span
            className="mt-1 h-1.5 w-1.5 shrink-0 rounded-full"
            style={{
              background:
                entry.kind === "life"
                  ? "#00f296"
                  : entry.kind === "commander"
                    ? "#facc15"
                    : entry.kind === "mode"
                      ? "#a881ff"
                      : entry.kind === "roll"
                        ? "#38bdf8"
                        : "#475569",
            }}
          />
          <p className="text-[12px] leading-snug text-slate-300">{entry.text}</p>
        </div>
      ))}
    </div>
  );
}

function WinnerOverlay({
  state,
  isHost,
  onNextGame,
  onDismiss,
}: {
  state: RoomState;
  isHost: boolean;
  onNextGame: () => void;
  onDismiss: () => void;
}) {
  const winners = state.winners ?? [];
  if (winners.length === 0) return null;

  return (
    <div className="fixed inset-0 z-40 flex items-center justify-center bg-black/80 p-5 backdrop-blur-sm">
      <div className="animate-pop card w-full max-w-sm p-6 text-center">
        <div className="text-3xl">🏆</div>
        <h2 className="mt-2 text-xl font-black">
          {winners.length > 1 ? "Joint winners" : "Winner"}
        </h2>
        <div className="mt-3 space-y-1">
          {winners.map((id) => {
            const player = state.players.find((p) => p.id === id);
            return (
              <div key={id} className="text-lg font-extrabold text-mana">
                {player?.name ?? "Unknown"}
              </div>
            );
          })}
        </div>
        {isHost ? (
          <button onClick={onNextGame} className="btn btn-primary mt-5 w-full py-3">
            Set up the next game
          </button>
        ) : (
          <button onClick={onDismiss} className="btn btn-ghost mt-5 w-full py-3">
            Look at the table
          </button>
        )}
      </div>
    </div>
  );
}
