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
import { BrandLockup } from "@/components/Brand";

const MODES: GameMode[] = [
  "commander",
  "planechase",
  "archenemy",
  "kingdom",
  "advanced",
];

/** Codes are minted at this length. Longer ones still paste in — see the boxes. */
const CODE_LENGTH = 5;

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
  const [codeFocused, setCodeFocused] = useState(false);

  useEffect(() => {
    setName(getSavedName());
    setHydrated(true);
  }, []);

  const transport = getTransport();
  const meta = MODE_META[mode];
  const lifeIsFixed = mode === "archenemy";
  const codeReady = joinCode.length >= 4;

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

  /**
   * Joining does not need a name.
   *
   * The room asks for one on arrival if it does not already know you, which is
   * the better moment to ask: you have seen the table, and the keyboard is not
   * standing between you and the code you were just read out.
   */
  const join = async () => {
    const code = normaliseCode(joinCode);
    if (code.length < 4) {
      setError("Room codes are five characters.");
      return;
    }
    setBusy("join");
    setError(null);
    const trimmed = name.trim();
    if (trimmed) saveName(trimmed);

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

  // One box per character, plus the empty box the next letter lands in. A
  // pasted six-character code grows the row rather than truncating.
  const codeBoxes = Math.max(CODE_LENGTH, joinCode.length);

  return (
    <main
      className="mx-auto flex min-h-screen w-full max-w-md flex-col px-4 pb-10"
      style={{ paddingTop: "calc(1.75rem + var(--sat))" }}
    >
      <header className="mb-8 flex items-center justify-between">
        <BrandLockup />
      </header>

      <section className="mb-7">
        <h1 className="text-[1.85rem] font-extrabold leading-[1.05] tracking-[-0.035em] text-white">
          Got a code?
          <span className="mt-0.5 block text-mana">Take a seat.</span>
        </h1>
        <p className="mt-3 max-w-[30ch] text-[13px] leading-relaxed text-slate-400">
          Commander, Planechase, Archenemy and both Kingdoms. Every life total at
          the table, in sync.
        </p>
      </section>

      {/* ------------------------------------------------------------- join */}
      <div
        className="rounded-[1.25rem] border border-mana/25 p-4"
        style={{
          background:
            "linear-gradient(180deg, rgba(28,25,48,0.9), rgba(20,18,31,0.9))",
          boxShadow: "0 20px 40px -28px rgba(217,180,94,0.5)",
        }}
      >
        <label
          htmlFor="code"
          className="mb-2.5 block text-[9.5px] font-extrabold uppercase tracking-[0.16em] text-slate-500"
        >
          Table code
        </label>

        <div className="relative mb-3">
          <div className="flex gap-2" aria-hidden="true">
            {Array.from({ length: codeBoxes }).map((_, index) => {
              const char = joinCode[index] ?? "";
              const isCaret = codeFocused && index === joinCode.length;
              return (
                <span
                  key={index}
                  className={`flex h-[54px] flex-1 items-center justify-center rounded-xl border text-2xl font-extrabold tnum ${
                    char
                      ? "border-line bg-[#0f0d19] text-cream"
                      : isCaret
                        ? "border-mana bg-[#0f0d19] text-mana shadow-[0_0_0_3px_rgba(217,180,94,0.12)]"
                        : "border-line bg-[#0f0d19] text-slate-700"
                  }`}
                >
                  {char}
                </span>
              );
            })}
          </div>

          {/* The real input sits on top, fully transparent but still a normal
              input: one element to focus, so tapping anywhere in the row opens
              the keyboard and paste, backspace and autocomplete all behave.
              Deliberately not `opacity: 0` — some mobile browsers treat an
              invisible field as not worth focusing and skip the keyboard. */}
          <input
            id="code"
            className="absolute inset-0 h-full w-full cursor-text rounded-xl border-0 bg-transparent p-0 text-base text-transparent caret-transparent outline-none selection:bg-transparent"
            value={joinCode}
            maxLength={8}
            inputMode="text"
            autoCapitalize="characters"
            autoComplete="off"
            autoCorrect="off"
            spellCheck={false}
            aria-label="Table code"
            onChange={(event) => setJoinCode(normaliseCode(event.target.value))}
            onFocus={() => setCodeFocused(true)}
            onBlur={() => setCodeFocused(false)}
            onKeyDown={(event) => {
              if (event.key === "Enter" && codeReady) void join();
            }}
          />
        </div>

        <button
          onClick={join}
          disabled={busy !== null || !hydrated || !codeReady}
          className="btn btn-primary h-[50px] w-full text-[15px]"
        >
          {busy === "join" ? "Opening…" : "Join the table"}
        </button>

        <label className="mt-3 flex cursor-pointer select-none items-center justify-center gap-2 text-[11px] text-slate-500">
          <input
            type="checkbox"
            checked={watchOnly}
            onChange={(event) => setWatchOnly(event.target.checked)}
            className="h-3.5 w-3.5 rounded border-line bg-surface-2 accent-[#d9b45e]"
          />
          Watch as a spectator instead — no seat, no controls
        </label>
      </div>

      <div className="my-6 flex items-center gap-3 text-[10px] font-extrabold uppercase tracking-[0.16em] text-slate-600">
        <span className="h-px flex-1 bg-gradient-to-r from-transparent to-line" />
        or open your own
        <span className="h-px flex-1 bg-gradient-to-l from-transparent to-line" />
      </div>

      {/* ----------------------------------------------------------- create */}
      <div>
        <label className="label" htmlFor="name">
          Your name
        </label>
        <input
          id="name"
          className="field h-[46px]"
          placeholder="What should we call you?"
          value={name}
          maxLength={24}
          onChange={(event) => setName(event.target.value)}
          autoComplete="nickname"
        />

        <div className="label mt-4">Format</div>
        {/* These wrap rather than scroll sideways.
            A horizontal scroller looked tidy, but with the scrollbar hidden
            there is nothing to grab with a mouse and no gesture on a desktop —
            the fifth format sat half-visible and unreachable. Wrapping costs a
            second line and makes every format reachable everywhere. */}
        <div className="flex flex-wrap gap-2">
          {MODES.map((id) => {
            const active = mode === id;
            return (
              <button
                key={id}
                onClick={() => chooseMode(id)}
                aria-pressed={active}
                className={`rounded-full border px-3.5 py-2 text-[12px] font-bold transition-colors ${
                  active
                    ? "border-mana/50 bg-mana/10 text-mana"
                    : "border-line bg-transparent text-slate-400 hover:border-white/20 hover:text-slate-300"
                }`}
              >
                {MODE_META[id].name}
              </button>
            );
          })}
        </div>
        <p className="mt-2 text-[11px] leading-relaxed text-slate-500">
          {meta.summary}
        </p>

        <div className="mt-3 rounded-2xl border border-line bg-surface-2/50 px-3.5">
          <div className="flex items-center justify-between gap-3 border-b border-line/70 py-3">
            <div>
              <div className="text-[13px] font-bold text-slate-200">
                Player limit
              </div>
              <div className="text-[10px] text-slate-500">
                {meta.players} · extra people join as spectators
              </div>
            </div>
            <div className="flex items-center gap-1 rounded-lg border border-line bg-[#0f0d19] p-0.5">
              <button
                onClick={() => setSeats((n) => Math.max(meta.minPlayers, n - 1))}
                disabled={seats <= meta.minPlayers}
                aria-label="One fewer player"
                className="btn h-7 w-7 rounded-md text-white disabled:opacity-30"
              >
                −
              </button>
              <span className="tnum w-6 text-center text-sm font-extrabold">
                {seats}
              </span>
              <button
                onClick={() => setSeats((n) => Math.min(meta.maxPlayers, n + 1))}
                disabled={seats >= meta.maxPlayers}
                aria-label="One more player"
                className="btn h-7 w-7 rounded-md text-white disabled:opacity-30"
              >
                +
              </button>
            </div>
          </div>

          <div className="py-3">
            <div className="mb-2 flex items-center justify-between">
              <span className="text-[13px] font-bold text-slate-200">
                Starting life
              </span>
              <span className="tnum text-sm font-extrabold text-mana">
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
                      className={`btn h-[30px] text-xs tnum ${
                        startingLife === preset ? "btn-primary" : "btn-ghost"
                      }`}
                    >
                      {preset}
                    </button>
                  ))}
                </div>
                <div className="mt-2 flex gap-2">
                  <input
                    className="field tnum h-[34px] py-0 text-xs"
                    inputMode="numeric"
                    placeholder="Custom life total…"
                    value={lifeDraft}
                    onChange={(event) => setLifeDraft(event.target.value)}
                    onKeyDown={(event) => {
                      const value = Number.parseInt(lifeDraft, 10);
                      if (
                        event.key === "Enter" &&
                        Number.isFinite(value) &&
                        value > 0
                      ) {
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
        </div>

        <button
          onClick={create}
          disabled={busy !== null || !hydrated}
          className="mt-4 h-[50px] w-full rounded-xl border border-mana/35 text-[14.5px] font-bold text-mana transition-colors hover:bg-mana/5 disabled:opacity-45"
        >
          {busy === "create" ? "Opening table…" : "Open a new table"}
        </button>
        <p className="mt-3 text-[11px] leading-relaxed text-slate-600">
          You&apos;ll get a five-letter code to read out. Anyone with it can join
          from their phone.
        </p>
      </div>

      {error && (
        <div className="animate-pop mt-4 rounded-xl border border-danger/30 bg-danger/10 px-3 py-2.5 text-[12px] font-semibold text-danger">
          {error}
        </div>
      )}

      <div className="mt-6 flex flex-wrap items-center justify-center gap-2">
        <Badge tone="mana">No install</Badge>
        <Badge tone="neutral">No accounts</Badge>
        <Badge tone={backendChoice() === "local" ? "amber" : "violet"}>
          {backendLabel()}
        </Badge>
      </div>

      {backendChoice() === "local" && (
        <p className="mt-3 rounded-xl border border-amber/20 bg-amber/5 px-3 py-2.5 text-[11px] leading-relaxed text-amber/80">
          Local mode: rooms live in this browser only and sync between tabs.
          Unset{" "}
          <code className="font-mono text-amber">NEXT_PUBLIC_BACKEND</code> to play
          from separate phones.
        </p>
      )}

      <footer className="mt-auto pt-8 text-center text-[10px] leading-relaxed text-slate-600">
        Unofficial fan project. Not affiliated with Wizards of the Coast. Card
        art, when shown, comes from the Scryfall API.
      </footer>
    </main>
  );
}
