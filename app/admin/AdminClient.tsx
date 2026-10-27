"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import type { ContentBundle, RoleClass, SchemeCard } from "@/lib/content";
import { BUNDLED_CLASSES, DEFAULT_PLANES } from "@/lib/content";
import type { PlaneCard } from "@/lib/data/planechase";
import { ADVANCED_KINGDOM_CARDS } from "@/lib/data/advancedKingdoms";
import {
  FAMILY_COLOUR,
  FAMILY_LABEL,
  ROLES,
  ROLE_FAMILIES,
  type RoleFamily,
} from "@/lib/data/roles";
import { invalidateContent } from "@/lib/useContent";
import { Badge } from "@/components/ui";

type Tab = "planes" | "schemes" | "classes" | "kingdom" | "rooms";

const empty: ContentBundle = { planes: [], schemes: [], classes: [] };

const TABS: Array<{ id: Tab; label: string }> = [
  { id: "planes", label: "Planes" },
  { id: "schemes", label: "Schemes" },
  { id: "classes", label: "Classes" },
  { id: "kingdom", label: "Kingdom" },
  { id: "rooms", label: "Rooms" },
];

function slug(value: string): string {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 48);
}

export function AdminClient() {
  const [tab, setTab] = useState<Tab>("planes");
  const [content, setContent] = useState<ContentBundle>(empty);
  const [token, setToken] = useState("");
  const [tokenRequired, setTokenRequired] = useState(false);
  const [status, setStatus] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setToken(window.localStorage.getItem("manatable:adminToken") ?? "");
    void fetch("/api/content", { method: "HEAD" })
      .then((r) => setTokenRequired(r.headers.get("x-admin-required") === "1"))
      .catch(() => setTokenRequired(false));
  }, []);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const response = await fetch("/api/content", { cache: "no-store" });
      const data = (await response.json()) as ContentBundle;
      setContent({
        planes: data.planes ?? [],
        schemes: data.schemes ?? [],
        classes: data.classes ?? [],
      });
    } catch {
      setError("Could not load content.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const save = async (next: ContentBundle) => {
    setStatus(null);
    setError(null);
    try {
      const response = await fetch("/api/content", {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
          "x-admin-token": token,
        },
        body: JSON.stringify(next),
      });
      const payload = await response.json().catch(() => ({}));
      if (!response.ok) {
        setError(payload.error ?? `Save failed (${response.status})`);
        return;
      }
      window.localStorage.setItem("manatable:adminToken", token);
      invalidateContent();
      setContent(next);
      setStatus("Saved.");
      window.setTimeout(() => setStatus(null), 2000);
    } catch {
      setError("Could not reach the server.");
    }
  };

  const saveWith = (patch: Partial<ContentBundle>) =>
    save({ ...content, ...patch });

  return (
    <main className="mx-auto w-full max-w-2xl px-4 py-8">
      <div className="mb-5 flex items-center justify-between">
        <div>
          <Link
            href="/"
            className="text-[11px] font-bold uppercase tracking-wider text-slate-500"
          >
            ← Back to the table
          </Link>
          <h1 className="mt-1 text-2xl font-black tracking-tight">Content admin</h1>
        </div>
        <Badge tone="violet">Admin</Badge>
      </div>

      <TokenBox
        token={token}
        setToken={setToken}
        required={tokenRequired}
      />

      <div className="mb-4 grid grid-cols-5 gap-1 rounded-xl bg-surface-2 p-1">
        {TABS.map((item) => (
          <button
            key={item.id}
            onClick={() => setTab(item.id)}
            className={`rounded-lg px-1 py-2 text-[10px] font-extrabold uppercase tracking-wide ${
              tab === item.id ? "bg-mana text-black" : "text-slate-400"
            }`}
          >
            {item.label}
          </button>
        ))}
      </div>

      {(status || error) && (
        <div
          className={`mb-4 rounded-xl border px-3 py-2 text-[12px] font-bold ${
            error
              ? "border-danger/30 bg-danger/10 text-danger"
              : "border-mana/30 bg-mana/10 text-mana"
          }`}
        >
          {error ?? status}
        </div>
      )}

      {loading ? (
        <p className="py-8 text-center text-sm text-slate-500">Loading…</p>
      ) : (
        <>
          {tab === "planes" && (
            <PlanesTab
              custom={content.planes}
              onChange={(planes) => saveWith({ planes })}
            />
          )}
          {tab === "schemes" && (
            <SchemesTab
              custom={content.schemes}
              onChange={(schemes) => saveWith({ schemes })}
            />
          )}
          {tab === "classes" && (
            <ClassesTab
              custom={content.classes}
              onChange={(classes) => saveWith({ classes })}
            />
          )}
          {tab === "kingdom" && <KingdomTab />}
          {tab === "rooms" && <RoomsTab token={token} />}
        </>
      )}
    </main>
  );
}

/* -------------------------------------------------------------------------- */

interface RoomRow {
  code: string;
  mode: string;
  phase: string;
  players: number;
  maxPlayers: number;
  hostName: string;
  updatedAt: string;
  bytes: number;
}

function ago(iso: string): string {
  const then = new Date(iso).getTime();
  if (!Number.isFinite(then)) return "unknown";
  const minutes = Math.max(0, Math.round((Date.now() - then) / 60000));
  if (minutes < 1) return "just now";
  if (minutes < 60) return `${minutes} min ago`;
  const hours = Math.round(minutes / 60);
  if (hours < 24) return `${hours} h ago`;
  return `${Math.round(hours / 24)} d ago`;
}

function size(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  return `${(bytes / 1024).toFixed(1)} kB`;
}

/**
 * Live rooms, and a way to close them.
 *
 * The app already deletes a room once the whole table has left it, but that
 * only covers the tidy case. This is the manual override: a game abandoned
 * mid-swing, a code read out wrong, a test room left behind. Closing one tells
 * every phone still watching to go back to the lobby instead of leaving them on
 * a board that can no longer be saved.
 */
function RoomsTab({ token }: { token: string }) {
  const [rooms, setRooms] = useState<RoomRow[] | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [confirming, setConfirming] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  const load = useCallback(async () => {
    setError(null);
    try {
      const response = await fetch("/api/rt/rooms", {
        headers: { "x-admin-token": token },
        cache: "no-store",
      });
      if (!response.ok) {
        setError(
          response.status === 401
            ? "The admin token was rejected. Check the box at the top of the page."
            : `Could not list rooms (${response.status}).`,
        );
        setRooms([]);
        return;
      }
      const payload = (await response.json()) as { rooms?: RoomRow[] };
      setRooms(payload.rooms ?? []);
    } catch {
      setError("Could not reach the server.");
      setRooms([]);
    }
  }, [token]);

  useEffect(() => {
    void load();
  }, [load]);

  const close = async (code: string) => {
    setBusy(code);
    setError(null);
    setNotice(null);
    try {
      const response = await fetch(`/api/rt/rooms/${code}`, {
        method: "DELETE",
        headers: { "x-admin-token": token },
      });
      if (!response.ok && response.status !== 404) {
        setError(`Could not close ${code} (${response.status}).`);
        return;
      }
      setNotice(`${code} closed.`);
      setRooms((current) => (current ?? []).filter((room) => room.code !== code));
      setConfirming(null);
    } catch {
      setError("Could not reach the server.");
    } finally {
      setBusy(null);
    }
  };

  return (
    <div className="space-y-3">
      <div className="card p-4">
        <div className="flex items-start justify-between gap-3">
          <div>
            <h2 className="text-sm font-extrabold uppercase tracking-wider text-slate-300">
              Open rooms
            </h2>
            <p className="mt-1 text-[11px] leading-relaxed text-slate-500">
              Rooms clean themselves up once everyone has gone. Close one here if
              a table was abandoned mid-game, or a code needs to stop working
              now.
            </p>
          </div>
          <button
            onClick={() => void load()}
            className="btn btn-ghost shrink-0 px-3 py-1.5 text-[11px]"
          >
            Refresh
          </button>
        </div>

        {notice && (
          <p className="mt-3 rounded-lg border border-mana/25 bg-mana/10 px-2.5 py-2 text-[11px] font-semibold text-mana">
            {notice}
          </p>
        )}
        {error && (
          <p className="mt-3 rounded-lg border border-danger/30 bg-danger/10 px-2.5 py-2 text-[11px] font-semibold text-danger">
            {error}
          </p>
        )}
      </div>

      {rooms === null ? (
        <p className="py-6 text-center text-xs text-slate-500">Loading rooms…</p>
      ) : rooms.length === 0 ? (
        <p className="rounded-xl border border-dashed border-line py-8 text-center text-xs text-slate-500">
          No rooms on disk. Everyone has gone home.
        </p>
      ) : (
        <div className="space-y-2">
          {rooms.map((room) => (
            <div key={room.code} className="card p-3">
              <div className="flex items-center gap-3">
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <span className="tnum text-base font-black tracking-[0.18em] text-mana">
                      {room.code}
                    </span>
                    <Badge tone={room.phase === "playing" ? "violet" : "neutral"}>
                      {room.phase}
                    </Badge>
                  </div>
                  <p className="mt-0.5 text-[11px] text-slate-500">
                    {room.mode} · {room.players}/{room.maxPlayers} seats ·{" "}
                    {room.hostName} · {ago(room.updatedAt)} · {size(room.bytes)}
                  </p>
                </div>

                {confirming === room.code ? (
                  <div className="flex shrink-0 gap-1.5">
                    <button
                      onClick={() => setConfirming(null)}
                      className="btn btn-ghost px-2.5 py-1.5 text-[11px]"
                    >
                      Keep
                    </button>
                    <button
                      onClick={() => void close(room.code)}
                      disabled={busy === room.code}
                      className="btn bg-danger px-2.5 py-1.5 text-[11px] font-bold text-black disabled:opacity-50"
                    >
                      {busy === room.code ? "Closing…" : "Close it"}
                    </button>
                  </div>
                ) : (
                  <button
                    onClick={() => setConfirming(room.code)}
                    className="btn btn-ghost shrink-0 px-3 py-1.5 text-[11px] text-danger/90"
                  >
                    Close room
                  </button>
                )}
              </div>

              {confirming === room.code && (
                <p className="mt-2 text-[10px] leading-snug text-amber">
                  This deletes the room and every life total in it. Anyone still
                  on that phone is sent back to the lobby. It cannot be undone.
                </p>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

/* -------------------------------------------------------------------------- */

function TokenBox({
  token,
  setToken,
  required,
}: {
  token: string;
  setToken: (value: string) => void;
  required: boolean;
}) {
  const [open, setOpen] = useState(false);
  return (
    <div className="mb-4 rounded-xl border border-line bg-surface-2 px-3 py-2">
      <button
        onClick={() => setOpen((v) => !v)}
        className="flex w-full items-center justify-between text-left"
      >
        <span className="text-[11px] font-bold text-slate-400">
          {required ? "Admin token required" : "No token set — saving is open"}
        </span>
        <span className="text-[10px] font-black uppercase text-slate-500">
          {open ? "Hide" : "Set"}
        </span>
      </button>
      {open && (
        <div className="mt-2">
          <input
            className="field"
            type="password"
            value={token}
            placeholder="ADMIN_TOKEN from .env"
            onChange={(e) => setToken(e.target.value)}
          />
          <p className="mt-1.5 text-[10px] leading-snug text-slate-500">
            {required
              ? "Must match the ADMIN_TOKEN on the server."
              : "No ADMIN_TOKEN is configured on the server, so anyone who finds this page can change game content. Set one before the box is public."}
          </p>
        </div>
      )}
    </div>
  );
}

/* -------------------------------------------------------------------------- */

/** Small shared header for a list of cards. */
function ListHeader({
  title,
  count,
  note,
}: {
  title: string;
  count: number;
  note: string;
}) {
  return (
    <div className="mb-2">
      <div className="flex items-baseline justify-between">
        <h2 className="text-sm font-black text-white">{title}</h2>
        <span className="tnum text-[11px] font-bold text-slate-500">{count}</span>
      </div>
      <p className="mt-0.5 text-[10px] leading-snug text-slate-500">{note}</p>
    </div>
  );
}

/** One row in a registered list — read-only, clearly marked as shipped. */
function RegisteredRow({
  name,
  meta,
  colour,
  image,
}: {
  name: string;
  meta?: string;
  colour?: string;
  image?: string | null;
}) {
  return (
    <div className="flex items-center gap-2 rounded-lg bg-white/[0.03] px-2 py-1.5">
      {image ? (
        /* eslint-disable-next-line @next/next/no-img-element */
        <img
          src={image}
          alt=""
          className="h-8 w-6 shrink-0 rounded object-cover"
          loading="lazy"
        />
      ) : (
        <span
          className="h-2 w-2 shrink-0 rounded-full"
          style={{ background: colour ?? "#334155" }}
        />
      )}
      <span className="min-w-0 flex-1 truncate text-[11px] font-bold text-slate-300">
        {name}
      </span>
      {meta && (
        <span className="shrink-0 text-[9px] font-bold uppercase tracking-wide text-slate-600">
          {meta}
        </span>
      )}
    </div>
  );
}

/* -------------------------------------------------------------------------- */

function PlanesTab({
  custom,
  onChange,
}: {
  custom: PlaneCard[];
  onChange: (items: PlaneCard[]) => void;
}) {
  const [name, setName] = useState("");
  const [type, setType] = useState<"Plane" | "Phenomenon">("Plane");
  const [oracle, setOracle] = useState("");
  const [chaos, setChaos] = useState("");
  const [showAll, setShowAll] = useState(false);
  const [filter, setFilter] = useState("");

  const registered = useMemo(() => {
    const needle = filter.trim().toLowerCase();
    const list = DEFAULT_PLANES;
    return needle ? list.filter((p) => p.name.toLowerCase().includes(needle)) : list;
  }, [filter]);

  const add = () => {
    if (!name.trim()) return;
    onChange([
      ...custom,
      {
        id: `plane_${slug(name)}`,
        name: name.trim(),
        type,
        oracleText: oracle.trim(),
        chaosText: chaos.trim(),
        custom: true,
      },
    ]);
    setName("");
    setOracle("");
    setChaos("");
  };

  return (
    <div className="space-y-4">
      <section>
        <ListHeader
          title="Your planes"
          count={custom.length}
          note="Dealt alongside the bundled set. Stored on the server, so they survive a redeploy."
        />
        {custom.length === 0 ? (
          <p className="rounded-xl border border-dashed border-line px-3 py-4 text-center text-[11px] text-slate-500">
            Nothing added yet.
          </p>
        ) : (
          <div className="space-y-1">
            {custom.map((card) => (
              <div
                key={card.id}
                className="flex items-center gap-2 rounded-xl border border-line bg-surface-2 px-3 py-2"
              >
                <div className="min-w-0 flex-1">
                  <div className="truncate text-sm font-bold text-slate-200">
                    {card.name}
                  </div>
                  <div className="text-[10px] text-slate-500">{card.type}</div>
                </div>
                <button
                  onClick={() => onChange(custom.filter((e) => e.id !== card.id))}
                  className="rounded-lg px-2 py-1 text-[10px] font-bold uppercase text-danger/80 hover:bg-danger/10"
                >
                  Delete
                </button>
              </div>
            ))}
          </div>
        )}
      </section>

      <section className="card p-4">
        <h2 className="mb-3 text-sm font-black text-white">Add a plane</h2>
        <input
          className="field"
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="Name — e.g. The Beach Episode"
        />
        <div className="mt-2 grid grid-cols-2 gap-2">
          {(["Plane", "Phenomenon"] as const).map((option) => (
            <button
              key={option}
              onClick={() => setType(option)}
              className={`btn py-2 text-xs ${type === option ? "btn-primary" : "btn-ghost"}`}
            >
              {option}
            </button>
          ))}
        </div>
        <textarea
          className="field mt-2"
          rows={2}
          value={oracle}
          onChange={(e) => setOracle(e.target.value)}
          placeholder="Rules text"
        />
        <textarea
          className="field mt-2"
          rows={2}
          value={chaos}
          onChange={(e) => setChaos(e.target.value)}
          placeholder="Chaos text"
        />
        <button
          onClick={add}
          disabled={!name.trim()}
          className="btn btn-primary mt-3 w-full py-2.5 text-sm"
        >
          Add plane
        </button>
      </section>

      <section>
        <button
          onClick={() => setShowAll((v) => !v)}
          className="flex w-full items-center justify-between rounded-xl border border-line bg-surface-2 px-3 py-2.5"
        >
          <span className="text-[11px] font-bold text-slate-300">
            Registered planes ({DEFAULT_PLANES.length})
          </span>
          <span className="text-[10px] font-black uppercase text-slate-500">
            {showAll ? "Hide" : "Show"}
          </span>
        </button>
        {showAll && (
          <div className="mt-2">
            <input
              className="field mb-2 py-2 text-xs"
              value={filter}
              onChange={(e) => setFilter(e.target.value)}
              placeholder="Filter…"
            />
            <div className="max-h-72 space-y-0.5 overflow-y-auto pr-1">
              {registered.map((card) => (
                <RegisteredRow
                  key={card.id}
                  name={card.name}
                  meta={card.type === "Phenomenon" ? "phenomenon" : undefined}
                />
              ))}
            </div>
          </div>
        )}
      </section>
    </div>
  );
}

/* -------------------------------------------------------------------------- */

function SchemesTab({
  custom,
  onChange,
}: {
  custom: SchemeCard[];
  onChange: (items: SchemeCard[]) => void;
}) {
  const [name, setName] = useState("");
  const [oracle, setOracle] = useState("");

  return (
    <div className="space-y-4">
      <section>
        <ListHeader
          title="Your schemes"
          count={custom.length}
          note="The official scheme set is pulled from Scryfall by each device. Add your own for homebrew, or if the card database is unreachable."
        />
        {custom.length === 0 ? (
          <p className="rounded-xl border border-dashed border-line px-3 py-4 text-center text-[11px] text-slate-500">
            Nothing added yet.
          </p>
        ) : (
          <div className="space-y-1">
            {custom.map((card) => (
              <div
                key={card.id}
                className="flex items-center gap-2 rounded-xl border border-line bg-surface-2 px-3 py-2"
              >
                <span className="min-w-0 flex-1 truncate text-sm font-bold text-slate-200">
                  {card.name}
                </span>
                <button
                  onClick={() => onChange(custom.filter((e) => e.id !== card.id))}
                  className="rounded-lg px-2 py-1 text-[10px] font-bold uppercase text-danger/80 hover:bg-danger/10"
                >
                  Delete
                </button>
              </div>
            ))}
          </div>
        )}
      </section>

      <section className="card p-4">
        <h2 className="mb-3 text-sm font-black text-white">Add a scheme</h2>
        <input
          className="field"
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="Name"
        />
        <textarea
          className="field mt-2"
          rows={3}
          value={oracle}
          onChange={(e) => setOracle(e.target.value)}
          placeholder="Rules text"
        />
        <button
          onClick={() => {
            if (!name.trim()) return;
            onChange([
              ...custom,
              {
                id: `scheme_${slug(name)}`,
                name: name.trim(),
                oracleText: oracle.trim(),
                custom: true,
              },
            ]);
            setName("");
            setOracle("");
          }}
          disabled={!name.trim()}
          className="btn btn-primary mt-3 w-full py-2.5 text-sm"
        >
          Add scheme
        </button>
      </section>
    </div>
  );
}

/* -------------------------------------------------------------------------- */

function ClassesTab({
  custom,
  onChange,
}: {
  custom: RoleClass[];
  onChange: (items: RoleClass[]) => void;
}) {
  const [name, setName] = useState("");
  const [role, setRole] = useState<RoleFamily>("knight");
  const [description, setDescription] = useState("");

  return (
    <div className="space-y-4">
      <section>
        <ListHeader
          title="Your classes"
          count={custom.length}
          note="A class is a flavour variant inside a role — the White Knight and the Black Knight both win as Knights, but the table reads a different card. It never changes how a role wins."
        />
        {custom.length === 0 ? (
          <p className="rounded-xl border border-dashed border-line px-3 py-4 text-center text-[11px] text-slate-500">
            Nothing added yet.
          </p>
        ) : (
          <div className="space-y-1">
            {custom.map((entry) => (
              <div
                key={entry.id}
                className="flex items-center gap-2 rounded-xl border border-line bg-surface-2 px-3 py-2"
              >
                <span
                  className="h-2 w-2 shrink-0 rounded-full"
                  style={{ background: FAMILY_COLOUR[entry.role as RoleFamily] ?? "#64748b" }}
                />
                <div className="min-w-0 flex-1">
                  <div className="truncate text-sm font-bold text-slate-200">
                    {entry.name}
                  </div>
                  <div className="text-[10px] text-slate-500">
                    {ROLES[entry.role]?.name ?? entry.role}
                  </div>
                </div>
                <button
                  onClick={() => onChange(custom.filter((r) => r.id !== entry.id))}
                  className="rounded-lg px-2 py-1 text-[10px] font-bold uppercase text-danger/80 hover:bg-danger/10"
                >
                  Delete
                </button>
              </div>
            ))}
          </div>
        )}
      </section>

      <section className="card p-4">
        <h2 className="mb-3 text-sm font-black text-white">Add a class</h2>
        <input
          className="field"
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="Name — e.g. Black Knight"
        />
        <div className="mt-2 grid grid-cols-3 gap-1.5">
          {ROLE_FAMILIES.map((family) => (
            <button
              key={family}
              onClick={() => setRole(family)}
              className={`btn py-2 text-[10px] ${role === family ? "btn-primary" : "btn-ghost"}`}
            >
              {FAMILY_LABEL[family]}
            </button>
          ))}
        </div>
        <textarea
          className="field mt-2"
          rows={2}
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          placeholder="Flavour text"
        />
        <button
          onClick={() => {
            if (!name.trim()) return;
            onChange([
              ...custom,
              {
                id: `class_${slug(name)}`,
                role,
                name: name.trim(),
                description: description.trim(),
                custom: true,
              },
            ]);
            setName("");
            setDescription("");
          }}
          disabled={!name.trim()}
          className="btn btn-primary mt-3 w-full py-2.5 text-sm"
        >
          Add class
        </button>
      </section>

      <section>
        <ListHeader
          title={`Registered classes (${BUNDLED_CLASSES.length})`}
          count={BUNDLED_CLASSES.length}
          note="These ship with the app and are always available."
        />
        <div className="space-y-0.5">
          {BUNDLED_CLASSES.map((entry) => (
            <RegisteredRow
              key={entry.id}
              name={entry.name}
              colour={FAMILY_COLOUR[entry.role as RoleFamily]}
              meta={FAMILY_LABEL[entry.role as RoleFamily] ?? entry.role}
            />
          ))}
        </div>
      </section>
    </div>
  );
}

/* -------------------------------------------------------------------------- */

function KingdomTab() {
  const [family, setFamily] = useState<RoleFamily | "all">("all");
  const cards = useMemo(
    () =>
      family === "all"
        ? ADVANCED_KINGDOM_CARDS
        : ADVANCED_KINGDOM_CARDS.filter((c) => c.family === family),
    [family],
  );

  return (
    <div className="space-y-4">
      <div className="rounded-xl border border-line bg-surface-2 p-3">
        <div className="flex items-baseline justify-between">
          <h2 className="text-sm font-black text-white">Advanced Kingdoms</h2>
          <span className="tnum text-[11px] font-bold text-slate-500">
            {ADVANCED_KINGDOM_CARDS.length} cards
          </span>
        </div>
        <p className="mt-1 text-[10px] leading-relaxed text-slate-500">
          The printed role card set, with the art bundled into the app. These
          are registered in code rather than added here: each card&apos;s text
          and family are what the engine reads when it deals and decides a
          winner, so they cannot be edited safely from a web form.
        </p>
        <p className="mt-1.5 text-[10px] leading-relaxed text-slate-500">
          New cards, or house rules, go in <strong>Classes</strong> instead —
          those are free-form and dealt alongside.
        </p>
      </div>

      <div className="flex flex-wrap gap-1.5">
        <button
          onClick={() => setFamily("all")}
          className={`rounded-lg border px-2.5 py-1.5 text-[10px] font-bold uppercase ${
            family === "all"
              ? "border-white/30 bg-white/10 text-white"
              : "border-line bg-surface-2 text-slate-400"
          }`}
        >
          All
        </button>
        {ROLE_FAMILIES.map((entry) => (
          <button
            key={entry}
            onClick={() => setFamily(entry)}
            className={`rounded-lg border px-2.5 py-1.5 text-[10px] font-bold uppercase ${
              family === entry
                ? "border-white/30 bg-white/10 text-white"
                : "border-line bg-surface-2 text-slate-400"
            }`}
            style={family === entry ? { color: FAMILY_COLOUR[entry] } : undefined}
          >
            {FAMILY_LABEL[entry]}
          </button>
        ))}
      </div>

      <div className="space-y-1">
        {cards.map((card) => (
          <div
            key={card.id}
            className="flex items-start gap-2.5 rounded-xl border border-line bg-surface-2 p-2"
          >
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={card.image}
              alt={card.name}
              className="h-16 w-12 shrink-0 rounded object-cover"
              loading="lazy"
            />
            <div className="min-w-0 flex-1">
              <div className="flex items-baseline gap-2">
                <span className="truncate text-[12px] font-black text-slate-200">
                  {card.name}
                </span>
                <span
                  className="shrink-0 text-[9px] font-black uppercase tracking-wide"
                  style={{ color: FAMILY_COLOUR[card.family] }}
                >
                  {FAMILY_LABEL[card.family]}
                </span>
              </div>
              <p className="mt-0.5 line-clamp-2 text-[10px] leading-snug text-slate-500">
                {card.text}
              </p>
              {card.tracksManually && (
                <span className="mt-1 inline-block rounded bg-amber/15 px-1.5 py-0.5 text-[9px] font-bold uppercase text-amber">
                  Host adjudicates
                </span>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
