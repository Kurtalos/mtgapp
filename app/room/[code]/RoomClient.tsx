"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  MODE_META,
  isKingdomMode,
  type GameMode,
  type PlayerState,
  type RoomState,
} from "@/lib/types";
import { useRoom } from "@/lib/useRoom";
import { useContent } from "@/lib/useContent";
import { BrandMark } from "@/components/Brand";
import { RollBanner } from "@/components/RollBanner";
import { SpectatorView } from "@/components/SpectatorView";
import { ROLES } from "@/lib/data/roles";
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
  const content = useContent();

  const [name, setName] = useState("");
  const [gateOpen, setGateOpen] = useState(false);
  const [sheetId, setSheetId] = useState<string | null>(null);
  const [tab, setTab] = useState<Tab>("table");
  const [menuOpen, setMenuOpen] = useState(false);
  const [copied, setCopied] = useState(false);
  const [toolsOpen, setToolsOpen] = useState(false);
  const [manualOpen, setManualOpen] = useState(false);
  const [manualValue, setManualValue] = useState("");
  const [resultsDismissed, setResultsDismissed] = useState(false);
  const [watchMode, setWatchMode] = useState(false);
  const [watchResolved, setWatchResolved] = useState(false);

  useEffect(() => {
    // A new game clears the previous result screen.
    if (room?.state.phase !== "finished") setResultsDismissed(false);
  }, [room?.state.phase]);

  // Read persisted identity only after mount so server and client agree.
  useEffect(() => {
    setName(getSavedName());
    setWatchMode(new URLSearchParams(window.location.search).get("watch") === "1");
    setWatchResolved(true);
  }, []);

  const inLobby = room?.state.phase === "lobby";
  const isPlayer = Boolean(me);

  const isSpectator = Boolean(
    room?.state.spectators.some((sp) => sp.id === meId),
  );

  // Take a seat — or, if the table is full / already running / they asked to
  // watch, sit in the spectator rows instead of forcing a name prompt.
  useEffect(() => {
    if (!watchResolved || !room || !meId || isPlayer || isSpectator) return;

    const stored = getSavedName();
    const full = room.state.players.length >= room.state.maxPlayers;

    if (!inLobby || full) {
      dispatch({
        type: "spectate",
        spectatorId: meId,
        name: stored || "Spectator",
      });
      return;
    }
    if (watchMode) {
      dispatch({
        type: "spectate",
        spectatorId: meId,
        name: stored || "Spectator",
      });
      return;
    }

    const taken = room.state.players.some(
      (p) => p.name.trim().toLowerCase() === stored.trim().toLowerCase(),
    );
    if (!stored || taken) {
      setGateOpen(true);
      return;
    }
    dispatch({ type: "join", playerId: meId, name: stored });
  }, [
    dispatch,
    inLobby,
    isPlayer,
    isSpectator,
    meId,
    room,
    watchMode,
    watchResolved,
  ]);

  useEffect(() => {
    if (!room || !meId) return;
    if (!inLobby && !isPlayer) setGateOpen(false);
  }, [inLobby, isPlayer, meId, room]);

  const players = useMemo(
    () => [...(room?.state.players ?? [])].sort((a, b) => a.seat - b.seat),
    [room],
  );

  // Someone else at the table already goes by this name.
  // When a Kingdom game ends, everyone gets to see who was what.
  const kingdomRoster = useMemo(() => {
    if (!room || !isKingdomMode(room.state.mode)) return null;
    const { roles, classes } = room.state.kingdom;
    if (!roles || Object.keys(roles).length === 0) return null;
    return [...room.state.players]
      .sort((a, b) => a.seat - b.seat)
      .map((player) => {
        const role = roles[player.id];
        const className = content.classes.find(
          (entry) => entry.id === classes[player.id],
        )?.name;
        return {
          id: player.id,
          name: player.name,
          role: role ? ROLES[role].name : "—",
          colour: role ? ROLES[role].colour : "#64748b",
          className: className ?? null,
          eliminated: player.eliminated,
        };
      });
  }, [content.classes, room]);

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
        await navigator.share({
          title: "Cards with Kurt & Friends",
          text: `Join my table: ${code}`,
          url,
        });
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

  // Phone: one narrow column. Desktop: wide enough for the table and the mode
  // panel to sit side by side, so neither is buried behind a tab.
  return (
    <main
      className="mx-auto flex min-h-screen w-full max-w-xl flex-col px-3 pb-6 lg:max-w-5xl lg:px-6 lg:pb-10"
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
          {/* The brand travels with the table: this is the screen every player
              stares at for three hours, so it should look like the app. */}
          <BrandMark className="h-[18px] w-[18px] shrink-0 opacity-80" />
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

      {/* ----------------------------------------------------------------- lobby */}
      {inLobby ? (
        <LobbyView
          state={state}
          players={players}
          meId={meId}
          isHost={isHost}
          onlineIds={onlineIds}
          onStart={() => {
            // Hand the engine its content so a game keeps its own copy of the
            // cards it was dealt, whatever an admin does later.
            dispatch({
              type: "start",
              byId: meId,
              planes: content.planes,
              schemes: content.schemes,
              classes: content.classes,
            });
          }}
          onMode={(mode) => dispatch({ type: "setMode", mode })}
          onLife={(life) => dispatch({ type: "setStartingLife", life })}
          onMaxPlayers={(max) =>
            dispatch({ type: "setMaxPlayers", byId: meId, max })
          }
          onTakeSeat={() => {
            setWatchMode(false);
            setGateOpen(true);
          }}
          onKick={(playerId) => dispatch({ type: "kick", byId: meId, playerId })}
          onOpenPlayer={setSheetId}
          onCopy={copyCode}
          copied={copied}
        />
      ) : !isPlayer ? (
        <SpectatorView state={state} onlineIds={onlineIds} />
      ) : (
        <>
          {/* Phone: tiles, then the tab strip underneath.
              Desktop: the table on the left, the panel on the right, so a
              player can see the board and the mode at the same time. */}
          <div className="lg:grid lg:grid-cols-[minmax(0,1.1fr)_minmax(0,1fr)] lg:items-start lg:gap-4">
              {/* ------------------------------------------------------------- players */}
              <div
                className={`mb-3 grid gap-2 lg:mb-0 ${
                  players.length <= 2 ? "grid-cols-1" : "grid-cols-2"
                }`}
              >
                {players.map((player) => (
                  <PlayerTile
                    key={player.id}
                    player={player}
                    state={state}
                    isMe={player.id === meId}
                    // Anyone seated may touch any total (damage is aimed
                    // outward); only your own, or the host, may raise one.
                    canEdit={Boolean(me)}
                    canIncrease={isHost || player.id === meId}
                    isOnline={onlineIds.size === 0 || onlineIds.has(player.id)}
                    onAdjust={(delta) =>
                      dispatch({
                        type: "adjustLife",
                        playerId: player.id,
                        delta,
                        byPlayerId: meId,
                      })
                    }
                    onOpen={() => setSheetId(player.id)}
                  />
                ))}
              </div>

              <div className="min-w-0">
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
                      {isKingdomMode(state.mode) && (
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
              </div>
            </div>
        </>
      )}

      {/* -------------------------------------------------------------- overlays */}
      {state.phase === "finished" && !resultsDismissed && (
        <WinnerOverlay
          state={state}
          isHost={isHost}
          roster={kingdomRoster}
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
        meId={meId}
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
          <p className="rounded-lg border border-line bg-surface-2 px-2.5 py-2 text-[10px] leading-snug text-slate-500">
            Rolls are shared with the whole table. Landed under the sofa? Enter
            the result by hand instead.
          </p>

          <div>
            <div className="label">Coin</div>
            <div className="flex items-center gap-2">
              <button
                onClick={() => dispatch({ type: "flipCoin", playerId: meId })}
                className="btn btn-primary flex-1 py-3 text-sm uppercase"
              >
                Flip
              </button>
              <div className="tnum flex h-12 min-w-24 items-center justify-center rounded-xl bg-amber/15 px-4 text-sm font-black uppercase text-amber">
                {state.lastRoll?.kind === "coin" ? state.lastRoll.value : "—"}
              </div>
            </div>
            <div className="mt-1.5 grid grid-cols-2 gap-2">
              {(["heads", "tails"] as const).map((face) => (
                <button
                  key={face}
                  onClick={() =>
                    dispatch({ type: "flipCoin", playerId: meId, value: face })
                  }
                  className="btn btn-ghost py-1.5 text-[10px] uppercase"
                >
                  It landed {face}
                </button>
              ))}
            </div>
          </div>

          <div>
            <div className="label">Dice</div>
            <div className="grid grid-cols-6 gap-1.5">
              {[4, 6, 8, 10, 12, 20].map((sides) => (
                <button
                  key={sides}
                  onClick={() => dispatch({ type: "rollDie", playerId: meId, sides })}
                  className={`btn py-2 text-xs ${
                    state.lastRoll?.kind === "die" && state.lastRoll.sides === sides
                      ? "bg-violet text-black"
                      : "btn-ghost"
                  }`}
                >
                  d{sides}
                </button>
              ))}
            </div>
          </div>

          {state.lastRoll && state.lastRoll.kind !== "planar" && (
            <div className="animate-pop rounded-xl border border-white/10 bg-black/30 px-4 py-3 text-center">
              <div className="tnum text-5xl font-black text-violet">
                {state.lastRoll.value}
              </div>
              <div className="mt-1 text-[10px] font-bold uppercase tracking-widest text-slate-500">
                {state.lastRoll.label}
                {state.lastRoll.manual ? " · entered by hand" : ""}
              </div>
            </div>
          )}

          <div className="border-t border-line pt-3">
            <button
              onClick={() => setManualOpen((value) => !value)}
              className="text-[11px] font-bold uppercase tracking-wider text-slate-500 hover:text-white"
            >
              {manualOpen ? "Hide override" : "Override a result"}
            </button>
            {manualOpen && (
              <div className="mt-2 space-y-2">
                <div className="flex gap-2">
                  <input
                    className="field tnum py-2 text-sm"
                    inputMode="numeric"
                    placeholder={`e.g. 17`}
                    value={manualValue}
                    onChange={(event) => setManualValue(event.target.value)}
                  />
                  <button
                    className="btn btn-ghost px-3 text-xs"
                    onClick={() => {
                      const value = Number.parseInt(manualValue, 10);
                      if (!Number.isFinite(value)) return;
                      dispatch({
                        type: "rollDie",
                        playerId: meId,
                        sides: Math.max(value, 2),
                        value,
                      });
                      setManualValue("");
                    }}
                  >
                    Log it
                  </button>
                </div>
                <p className="text-[10px] text-slate-600">
                  Logs the number as a d{manualValue || "20"} result so everyone
                  sees it.
                </p>
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
  onMaxPlayers,
  onKick,
  onOpenPlayer,
  onCopy,
  copied,
  onTakeSeat,
}: {
  state: RoomState;
  players: PlayerState[];
  meId: string;
  isHost: boolean;
  onlineIds: Set<string>;
  onStart: () => void;
  onMode: (mode: GameMode) => void;
  onLife: (life: number) => void;
  onMaxPlayers: (max: number) => void;
  onKick: (playerId: string) => void;
  onOpenPlayer: (playerId: string) => void;
  onCopy: () => void;
  copied: boolean;
  onTakeSeat: () => void;
}) {
  const modes: GameMode[] = [
    "commander",
    "planechase",
    "archenemy",
    "kingdom",
    "advanced",
  ];
  const meta = MODE_META[state.mode];
  const [lifeDraft, setLifeDraft] = useState("");
  const seatsLeft = state.maxPlayers - players.length;
  const amWatching = state.spectators.some((sp) => sp.id === meId);
  const lifeIsFixed = state.mode === "archenemy";

  const commitLife = () => {
    const value = Number.parseInt(lifeDraft, 10);
    if (Number.isFinite(value) && value > 0) {
      onLife(Math.min(999, value));
      setLifeDraft("");
    }
  };

  return (
    <div className="space-y-3 lg:grid lg:grid-cols-2 lg:items-start lg:gap-3 lg:space-y-0">
      <div className="card p-4">
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-extrabold uppercase tracking-wider text-slate-300">
            At the table
          </h2>
          <Badge tone={seatsLeft === 0 ? "amber" : "mana"}>
            {players.length} / {state.maxPlayers} seats
          </Badge>
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

          {players.length === 0 && (
            <p className="py-3 text-center text-xs text-slate-500">
              Nobody has sat down yet.
            </p>
          )}
        </div>

        {state.spectators.length > 0 && (
          <div className="mt-3 rounded-xl border border-sky-500/20 bg-sky-500/5 px-3 py-2">
            <div className="text-[9px] font-black uppercase tracking-wider text-sky-400/80">
              👁 Watching ({state.spectators.length})
            </div>
            <div className="mt-1 flex flex-wrap gap-x-2 gap-y-0.5">
              {state.spectators.map((sp) => (
                <span key={sp.id} className="text-xs text-sky-200/80">
                  {sp.name}
                </span>
              ))}
            </div>
          </div>
        )}

        <button onClick={onCopy} className="btn btn-ghost mt-3 w-full py-2.5 text-xs">
          {copied ? "Link copied" : "Share the join link"}
        </button>
      </div>

      {amWatching && (
        <div className="card p-4 text-center">
          <p className="text-sm font-bold text-slate-300">You are watching</p>
          <p className="mt-1 text-[11px] text-slate-500">
            {seatsLeft > 0
              ? `${seatsLeft} seat${seatsLeft === 1 ? "" : "s"} still open.`
              : "The table is full."}
          </p>
          {seatsLeft > 0 && (
            <button onClick={onTakeSeat} className="btn btn-primary mt-3 w-full py-2.5 text-sm">
              Take a seat instead
            </button>
          )}
        </div>
      )}

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
              {meta.summary}
            </p>
          </div>

          <div className="card p-4">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-sm font-extrabold uppercase tracking-wider text-slate-300">
                  Player limit
                </h2>
                <p className="text-[10px] text-slate-500">
                  {seatsLeft === 0
                    ? "Full — latecomers join as spectators"
                    : `${seatsLeft} seat${seatsLeft === 1 ? "" : "s"} left`}
                </p>
              </div>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => onMaxPlayers(state.maxPlayers - 1)}
                  disabled={state.maxPlayers <= Math.max(meta.minPlayers, players.length)}
                  className="btn h-9 w-9 rounded-lg bg-white/5 text-white disabled:opacity-30"
                >
                  −
                </button>
                <span className="tnum w-6 text-center text-xl font-black">
                  {state.maxPlayers}
                </span>
                <button
                  onClick={() => onMaxPlayers(state.maxPlayers + 1)}
                  disabled={state.maxPlayers >= meta.maxPlayers}
                  className="btn h-9 w-9 rounded-lg bg-white/5 text-white disabled:opacity-30"
                >
                  +
                </button>
              </div>
            </div>
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

            {lifeIsFixed ? (
              <p className="mt-2 rounded-lg border border-orange-500/25 bg-orange-500/10 px-2.5 py-2 text-[11px] leading-snug text-orange-200/80">
                Archenemy is fixed by the rules: 40 life for the archenemy,
                20 each for the team.
              </p>
            ) : (
              <>
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
                <div className="mt-2 flex gap-2">
                  <input
                    className="field tnum py-2 text-sm"
                    inputMode="numeric"
                    placeholder="Custom…"
                    value={lifeDraft}
                    onChange={(event) => setLifeDraft(event.target.value)}
                    onKeyDown={(event) => {
                      if (event.key === "Enter") commitLife();
                    }}
                  />
                  <button className="btn btn-ghost px-4 text-xs" onClick={commitLife}>
                    Set
                  </button>
                </div>
              </>
            )}

            {isKingdomMode(state.mode) && (
              <p className="mt-2 text-[10px] leading-snug text-slate-500">
                {state.mode === "advanced"
                  ? "The King starts 10 life above this total."
                  : "The King always starts on 50, whatever is set here."}
              </p>
            )}
          </div>

          <button
            onClick={onStart}
            disabled={players.length < meta.minPlayers}
            className="btn btn-primary w-full py-4 text-base"
          >
            {players.length < meta.minPlayers
              ? `Need ${meta.minPlayers - players.length} more player${
                  meta.minPlayers - players.length === 1 ? "" : "s"
                }`
              : "Start game"}
          </button>
        </>
      ) : (
        !amWatching && (
          <div className="card p-5 text-center">
            <div className="mx-auto mb-2 h-6 w-6 animate-spin rounded-full border-2 border-line border-t-mana" />
            <p className="text-sm font-bold text-slate-300">Waiting for the host</p>
            <p className="mt-1 text-[11px] text-slate-500">
              The table starts as soon as they hit go.
            </p>
          </div>
        )
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
          Actions
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

      {state.lastRoll && <RollBanner roll={state.lastRoll} />}

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
                  ? "#d9b45e"
                  : entry.kind === "commander"
                    ? "#e8a95c"
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

interface RosterRow {
  id: string;
  name: string;
  role: string;
  colour: string;
  className: string | null;
  eliminated: boolean;
}

function WinnerOverlay({
  state,
  isHost,
  roster,
  onNextGame,
  onDismiss,
}: {
  state: RoomState;
  isHost: boolean;
  roster: RosterRow[] | null;
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
        {roster && roster.length > 0 && (
          <div className="mt-4 rounded-xl border border-white/10 bg-black/25 p-2.5 text-left">
            <div className="mb-1.5 text-[9px] font-black uppercase tracking-[0.14em] text-slate-500">
              Who was what
            </div>
            <div className="space-y-1">
              {roster.map((row) => (
                <div key={row.id} className="flex items-center gap-2">
                  <span className="min-w-0 flex-1 truncate text-[11px] font-bold text-slate-300">
                    {row.name}
                  </span>
                  <span
                    className="shrink-0 text-[11px] font-black"
                    style={{ color: row.colour }}
                  >
                    {row.className ?? row.role}
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}

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
