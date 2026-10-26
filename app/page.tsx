"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { MODE_META, type GameMode } from "@/lib/types";
import { createRoomState } from "@/lib/room/setup";
import {
  backendChoice,
  backendLabel,
  getTransport,
  generateRoomCode,
  normaliseCode,
} from "@/lib/transport";
import { getPlayerId, getSavedName, saveName } from "@/lib/identity";
import { Badge } from "@/components/ui";

const MODES: GameMode[] = ["commander", "planechase", "archenemy", "kingdom"];

export default function Home() {
  const router = useRouter();

  const [name, setName] = useState("");
  const [mode, setMode] = useState<GameMode>("commander");
  const [seats, setSeats] = useState(MODE_META.commander.defaultMaxPlayers);
  const [startingLife, setStartingLife] = useState(
    MODE_META.commander.defaultLife,
  );
  const [lifeDraft, setLifeDraft] = useState("");
  const [joinCode, setJoinCode] = useState("");
  const [watchOnly, setWatchOnly] = useState(false);
  const [busy, setBusy] = useState<"create" | "join" | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [hydrated, setHydrated] = useState(false);

  useEffect(() => {
    setName(getSavedName());
    setHydrated(true);
  }, []);

  const transport = getTransport();
  const meta = MODE_META[mode];
  const lifeIsFixed = mode === "archenemy";

  const chooseMode = (next: GameMode) => {
    setMode(next);
    const info = MODE_META[next];
    setSeats(info.defaultMaxPlayers);
    setStartingLife(info.defaultLife);
    setLifeDraft("");
  };

  const create = async () => {
    const trimmed = name.trim();
    if (!trimmed) {
      setError("Pick a name first — your mates need something to shout at.");
      return;
    }
    setBusy("create");
    setError(null);
    saveName(trimmed);

    try {
      const playerId = getPlayerId();
      for (let attempt = 0; attempt < 4; attempt++) {
        const code = generateRoomCode();
        const state = createRoomState({
          code,
          hostId: playerId,
          hostName: trimmed,
          mode,
          startingLife,
          maxPlayers: seats,
        });
        const result = await transport.create(code, state);
        if (result.ok) {
          router.push(`/room/${code}`);
          return;
        }
        if (result.room) continue; // code collision, try another

        const detail = transport.describeError();
        if (detail) {
          setError(detail);
          return;
        }
      }
      setError("Could not open a table just now. Try again in a moment.");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong.");
    } finally {
      setBusy(null);
    }
  };

  const join = async () => {
    const code = normaliseCode(joinCode);
    if (code.length < 4) {
      setError("Room codes are five characters.");
      return;
    }
    const trimmed = name.trim();
    if (!trimmed) {
      setError("Pick a name first.");
      return;
    }
    setBusy("join");
    setError(null);
    saveName(trimmed);

    try {
      const found = await transport.load(code);
      if (!found) {
        const detail = transport.describeError();
        setError(detail ?? `No table found with the code ${code}.`);
        return;
      }
      router.push(`/room/${code}${watchOnly ? "?watch=1" : ""}`);
    } catch {
      setError("Could not reach the table. Check your connection.");
    } finally {
      setBusy(null);
    }
  };

  return (
    <main
      className="mx-auto flex min-h-screen w-full max-w-md flex-col px-4 pb-10"
      style={{ paddingTop: "calc(2.5rem + var(--sat))" }}
    >
      <header className="text-center">
        <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-2xl border border-mana/30 bg-mana/10 text-2xl">
          🎴
        </div>
        <h1 className="text-4xl font-black leading-none tracking-tighter">
          MANA<span className="text-mana">TABLE</span>
        </h1>
        <p className="mt-3 text-sm leading-relaxed text-slate-400">
          A shared life counter for Commander, Planechase, Archenemy and
          Kingdoms. Create a table, share the code, everyone joins from their
          phone.
        </p>
      </header>

      <div className="mt-6 space-y-4">
        <div className="card p-4">
          <label className="label" htmlFor="name">
            Your name
          </label>
          <input
            id="name"
            className="field"
            placeholder="Atraxa enjoyer"
            value={name}
            maxLength={24}
            onChange={(event) => setName(event.target.value)}
            autoComplete="nickname"
          />

          <div className="label mt-4">Table format</div>
          <div className="grid grid-cols-2 gap-2">
            {MODES.map((id) => {
              const info = MODE_META[id];
              const active = mode === id;
              return (
                <button
                  key={id}
                  onClick={() => chooseMode(id)}
                  className={`rounded-xl border p-3 text-left transition-colors ${
                    active
                      ? "border-transparent bg-white/10"
                      : "border-line bg-surface-2 hover:border-white/20"
                  }`}
                  style={
                    active ? { boxShadow: `inset 0 0 0 2px ${info.accent}` } : undefined
                  }
                >
                  <div
                    className="text-sm font-black leading-tight"
                    style={{ color: active ? info.accent : "#e5e9f2" }}
                  >
                    {info.name}
                  </div>
                  <div className="text-[10px] text-slate-500">{info.tagline}</div>
                </button>
              );
            })}
          </div>
          <p className="mt-2 text-[11px] leading-relaxed text-slate-500">
            {meta.summary}
          </p>

          <div className="mt-4 flex items-center justify-between rounded-xl border border-line bg-surface-2 px-3 py-2.5">
            <div>
              <div className="text-xs font-bold text-slate-200">Player limit</div>
              <div className="text-[10px] text-slate-500">
                Extra people join as spectators
              </div>
            </div>
            <div className="flex items-center gap-2">
              <button
                onClick={() => setSeats((n) => Math.max(meta.minPlayers, n - 1))}
                disabled={seats <= meta.minPlayers}
                className="btn h-8 w-8 rounded-lg bg-white/5 text-white disabled:opacity-30"
              >
                −
              </button>
              <span className="tnum w-5 text-center text-lg font-black">{seats}</span>
              <button
                onClick={() => setSeats((n) => Math.min(meta.maxPlayers, n + 1))}
                disabled={seats >= meta.maxPlayers}
                className="btn h-8 w-8 rounded-lg bg-white/5 text-white disabled:opacity-30"
              >
                +
              </button>
            </div>
          </div>

          <div className="mt-3">
            <div className="mb-1 flex items-center justify-between">
              <span className="label mb-0">Starting life</span>
              <span className="tnum text-sm font-black text-mana">
                {lifeIsFixed ? "40 / 20" : startingLife}
              </span>
            </div>
            {lifeIsFixed ? (
              <p className="rounded-lg border border-orange-500/25 bg-orange-500/10 px-2.5 py-2 text-[10px] leading-snug text-orange-200/80">
                Fixed by the rules: 40 for the archenemy, 20 for the team.
              </p>
            ) : (
              <>
                <div className="grid grid-cols-4 gap-2">
                  {[20, 30, 40, 60].map((preset) => (
                    <button
                      key={preset}
                      onClick={() => setStartingLife(preset)}
                      className={`btn py-2 text-xs ${
                        startingLife === preset ? "btn-primary" : "btn-ghost"
                      }`}
                    >
                      {preset}
                    </button>
                  ))}
                </div>
                <div className="mt-2 flex gap-2">
                  <input
                    className="field tnum py-2 text-xs"
                    inputMode="numeric"
                    placeholder="Custom life total…"
                    value={lifeDraft}
                    onChange={(event) => setLifeDraft(event.target.value)}
                    onKeyDown={(event) => {
                      const value = Number.parseInt(lifeDraft, 10);
                      if (event.key === "Enter" && Number.isFinite(value) && value > 0) {
                        setStartingLife(Math.min(999, value));
                        setLifeDraft("");
                      }
                    }}
                  />
                  <button
                    className="btn btn-ghost px-3 text-[11px]"
                    onClick={() => {
                      const value = Number.parseInt(lifeDraft, 10);
                      if (Number.isFinite(value) && value > 0) {
                        setStartingLife(Math.min(999, value));
                        setLifeDraft("");
                      }
                    }}
                  >
                    Set
                  </button>
                </div>
              </>
            )}
          </div>

          <button
            onClick={create}
            disabled={busy !== null || !hydrated}
            className="btn btn-primary mt-4 w-full py-4 text-base"
          >
            {busy === "create" ? "Opening table…" : "Create a table"}
          </button>
        </div>

        <div className="card p-4">
          <label className="label" htmlFor="code">
            Join with a code
          </label>
          <div className="flex gap-2">
            <input
              id="code"
              className="field tnum text-center text-lg font-black tracking-[0.35em] uppercase"
              placeholder="ABCDE"
              value={joinCode}
              maxLength={8}
              autoCapitalize="characters"
              autoComplete="off"
              spellCheck={false}
              onChange={(event) => setJoinCode(normaliseCode(event.target.value))}
              onKeyDown={(event) => {
                if (event.key === "Enter") void join();
              }}
            />
            <button
              onClick={join}
              disabled={busy !== null || !hydrated}
              className={`btn px-5 ${watchOnly ? "btn-ghost" : "btn-primary"}`}
            >
              {busy === "join" ? "…" : watchOnly ? "Watch" : "Join"}
            </button>
          </div>

          <label className="mt-2.5 flex cursor-pointer select-none items-center gap-2 text-[11px] text-slate-400">
            <input
              type="checkbox"
              checked={watchOnly}
              onChange={(event) => setWatchOnly(event.target.checked)}
              className="h-3.5 w-3.5 rounded border-line bg-surface-2 accent-sky-400"
            />
            Join as a spectator — watch without taking a seat
          </label>
        </div>

        {error && (
          <div className="animate-pop rounded-xl border border-danger/30 bg-danger/10 px-3 py-2.5 text-[12px] font-semibold text-danger">
            {error}
          </div>
        )}

        <div className="flex flex-wrap items-center justify-center gap-2 pt-1">
          <Badge tone="mana">No install</Badge>
          <Badge tone="neutral">No accounts</Badge>
          <Badge tone={backendChoice() === "local" ? "amber" : "violet"}>
            {backendLabel()}
          </Badge>
        </div>

        {backendChoice() === "local" && (
          <p className="rounded-xl border border-amber/20 bg-amber/5 px-3 py-2.5 text-[11px] leading-relaxed text-amber/80">
            Local mode: rooms live in this browser only and sync between tabs.
            Unset{" "}
            <code className="font-mono text-amber">NEXT_PUBLIC_BACKEND</code> to
            play from separate phones.
          </p>
        )}
      </div>

      <footer className="mt-auto pt-8 text-center text-[10px] leading-relaxed text-slate-600">
        Unofficial fan project. Not affiliated with Wizards of the Coast.
        Card art, when shown, comes from the Scryfall API.
      </footer>
    </main>
  );
}
