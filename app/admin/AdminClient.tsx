"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import type { ContentBundle, RoleClass, SchemeCard } from "@/lib/content";
import type { PlaneCard } from "@/lib/data/planechase";
import type { RoleId } from "@/lib/types";
import { ROLES } from "@/lib/data/roles";
import { BUNDLED_CLASSES, DEFAULT_PLANES } from "@/lib/content";
import { invalidateContent } from "@/lib/useContent";
import { Badge } from "@/components/ui";

type Tab = "planes" | "schemes" | "classes";

const ROLES_ORDER: RoleId[] = ["king", "knight", "bandit", "assassin", "usurper"];

const empty: ContentBundle = { planes: [], schemes: [], classes: [] };

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
      .then((response) => {
        setTokenRequired(response.headers.get("x-admin-required") === "1");
      })
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
      <div className="mb-6 flex items-center justify-between">
        <div>
          <Link href="/" className="text-[11px] font-bold uppercase tracking-wider text-slate-500">
            ← Back to the table
          </Link>
          <h1 className="mt-1 text-2xl font-black tracking-tight">Content admin</h1>
        </div>
        <Badge tone="violet">Admin</Badge>
      </div>

      <div className="card mb-4 p-4">
        <label className="label" htmlFor="token">
          Admin token
        </label>
        <input
          id="token"
          className="field"
          type="password"
          value={token}
          placeholder="ADMIN_TOKEN from .env.local"
          onChange={(event) => setToken(event.target.value)}
        />
        <p className="mt-2 text-[11px] leading-relaxed text-slate-500">
          {tokenRequired ? (
            <>Required. Set <code className="font-mono">ADMIN_TOKEN</code> in your environment to match.</>
          ) : (
            <>
              No <code className="font-mono">ADMIN_TOKEN</code> is set, so saving
              is open to anyone who finds this page. Set one before you put this
              on the internet.
            </>
          )}
        </p>
      </div>

      <div className="mb-4 flex gap-1 rounded-xl bg-surface-2 p-1">
        {(
          [
            { id: "planes", label: `Planes (${content.planes.length})` },
            { id: "schemes", label: `Schemes (${content.schemes.length})` },
            { id: "classes", label: `Classes (${content.classes.length})` },
          ] as Array<{ id: Tab; label: string }>
        ).map((item) => (
          <button
            key={item.id}
            onClick={() => setTab(item.id)}
            className={`flex-1 rounded-lg px-2 py-2 text-[11px] font-extrabold uppercase tracking-wide ${
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
            <PlaneEditor
              items={content.planes}
              onChange={(planes) => saveWith({ planes })}
              bundledCount={DEFAULT_PLANES.length}
            />
          )}
          {tab === "schemes" && (
            <SchemeEditor
              items={content.schemes}
              onChange={(schemes) => saveWith({ schemes })}
            />
          )}
          {tab === "classes" && (
            <ClassEditor
              items={content.classes}
              onChange={(classes) => saveWith({ classes })}
              bundledCount={BUNDLED_CLASSES.length}
            />
          )}
        </>
      )}
    </main>
  );
}

/* -------------------------------------------------------------------------- */

function PlaneEditor({
  items,
  onChange,
  bundledCount,
}: {
  items: PlaneCard[];
  onChange: (items: PlaneCard[]) => void;
  bundledCount: number;
}) {
  const [name, setName] = useState("");
  const [type, setType] = useState<"Plane" | "Phenomenon">("Plane");
  const [oracleText, setOracle] = useState("");
  const [chaosText, setChaos] = useState("");
  const [image, setImage] = useState("");

  const add = () => {
    if (!name.trim()) return;
    onChange([
      ...items,
      {
        id: `plane_${slug(name)}`,
        name: name.trim(),
        type,
        oracleText: oracleText.trim(),
        chaosText: chaosText.trim(),
        image: image.trim() || null,
        custom: true,
      },
    ]);
    setName("");
    setOracle("");
    setChaos("");
    setImage("");
  };

  return (
    <div className="space-y-3">
      <p className="text-[11px] leading-relaxed text-slate-500">
        {bundledCount} planes ship with the app. Anything you add here appears in
        the planar deck for every game.
      </p>

      <div className="card p-4">
        <div className="label">Name</div>
        <input className="field" value={name} onChange={(e) => setName(e.target.value)} placeholder="E.g. The Beach Episode" />

        <div className="mt-3 grid grid-cols-2 gap-2">
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

        <div className="label mt-3">Rules text</div>
        <textarea className="field" rows={2} value={oracleText} onChange={(e) => setOracle(e.target.value)} />

        <div className="label mt-3">Chaos text</div>
        <textarea className="field" rows={2} value={chaosText} onChange={(e) => setChaos(e.target.value)} />

        <div className="label mt-3">Image URL (optional)</div>
        <input className="field" value={image} onChange={(e) => setImage(e.target.value)} placeholder="https://…" />

        <button onClick={add} disabled={!name.trim()} className="btn btn-primary mt-4 w-full py-3 text-sm">
          Add plane
        </button>
      </div>

      {items.length === 0 ? (
        <p className="py-4 text-center text-sm text-slate-500">No custom planes yet.</p>
      ) : (
        <div className="space-y-1">
          {items.map((card) => (
            <div key={card.id} className="flex items-center gap-2 rounded-xl border border-line bg-surface-2 px-3 py-2">
              <div className="min-w-0 flex-1">
                <div className="truncate text-sm font-bold text-slate-200">{card.name}</div>
                <div className="text-[10px] text-slate-500">{card.type}</div>
              </div>
              <button
                onClick={() => onChange(items.filter((entry) => entry.id !== card.id))}
                className="rounded-lg px-2 py-1 text-[10px] font-bold uppercase text-danger/80 hover:bg-danger/10"
              >
                Delete
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function SchemeEditor({
  items,
  onChange,
}: {
  items: SchemeCard[];
  onChange: (items: SchemeCard[]) => void;
}) {
  const [name, setName] = useState("");
  const [oracleText, setOracle] = useState("");
  const [image, setImage] = useState("");

  return (
    <div className="space-y-3">
      <p className="text-[11px] leading-relaxed text-slate-500">
        The full official scheme set is fetched from Scryfall by each device.
        Add your own here for homebrew schemes, or if the card database is
        unreachable.
      </p>

      <div className="card p-4">
        <div className="label">Name</div>
        <input className="field" value={name} onChange={(e) => setName(e.target.value)} />
        <div className="label mt-3">Rules text</div>
        <textarea className="field" rows={3} value={oracleText} onChange={(e) => setOracle(e.target.value)} />
        <div className="label mt-3">Image URL (optional)</div>
        <input className="field" value={image} onChange={(e) => setImage(e.target.value)} />
        <button
          onClick={() => {
            if (!name.trim()) return;
            onChange([
              ...items,
              {
                id: `scheme_${slug(name)}`,
                name: name.trim(),
                oracleText: oracleText.trim(),
                image: image.trim() || null,
                custom: true,
              },
            ]);
            setName("");
            setOracle("");
            setImage("");
          }}
          disabled={!name.trim()}
          className="btn btn-primary mt-4 w-full py-3 text-sm"
        >
          Add scheme
        </button>
      </div>

      {items.length === 0 ? (
        <p className="py-4 text-center text-sm text-slate-500">No custom schemes yet.</p>
      ) : (
        <div className="space-y-1">
          {items.map((card) => (
            <div key={card.id} className="flex items-center gap-2 rounded-xl border border-line bg-surface-2 px-3 py-2">
              <div className="min-w-0 flex-1 truncate text-sm font-bold text-slate-200">{card.name}</div>
              <button
                onClick={() => onChange(items.filter((entry) => entry.id !== card.id))}
                className="rounded-lg px-2 py-1 text-[10px] font-bold uppercase text-danger/80 hover:bg-danger/10"
              >
                Delete
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function ClassEditor({
  items,
  onChange,
  bundledCount,
}: {
  items: RoleClass[];
  onChange: (items: RoleClass[]) => void;
  bundledCount: number;
}) {
  const [name, setName] = useState("");
  const [role, setRole] = useState<RoleId>("knight");
  const [description, setDescription] = useState("");

  return (
    <div className="space-y-3">
      <p className="text-[11px] leading-relaxed text-slate-500">
        {bundledCount} default classes ship with the app. A class is a flavour
        variant inside a role — the White Knight and the Black Knight both win as
        Knights, but players are dealt a different card. It never changes how a
        role wins.
      </p>

      <div className="card p-4">
        <div className="label">Name</div>
        <input className="field" value={name} onChange={(e) => setName(e.target.value)} placeholder="E.g. Black Knight" />

        <div className="label mt-3">Role</div>
        <div className="grid grid-cols-3 gap-1.5">
          {ROLES_ORDER.map((entry) => (
            <button
              key={entry}
              onClick={() => setRole(entry)}
              className={`btn py-2 text-[11px] ${role === entry ? "btn-primary" : "btn-ghost"}`}
            >
              {ROLES[entry].name}
            </button>
          ))}
        </div>

        <div className="label mt-3">Flavour text</div>
        <textarea className="field" rows={2} value={description} onChange={(e) => setDescription(e.target.value)} />

        <button
          onClick={() => {
            if (!name.trim()) return;
            onChange([
              ...items,
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
          className="btn btn-primary mt-4 w-full py-3 text-sm"
        >
          Add class
        </button>
      </div>

      {items.length === 0 ? (
        <p className="py-4 text-center text-sm text-slate-500">No custom classes yet.</p>
      ) : (
        <div className="space-y-1">
          {items.map((entry) => (
            <div key={entry.id} className="flex items-center gap-2 rounded-xl border border-line bg-surface-2 px-3 py-2">
              <div className="min-w-0 flex-1">
                <div className="truncate text-sm font-bold text-slate-200">{entry.name}</div>
                <div className="text-[10px] text-slate-500">{ROLES[entry.role].name}</div>
              </div>
              <button
                onClick={() => onChange(items.filter((row) => row.id !== entry.id))}
                className="rounded-lg px-2 py-1 text-[10px] font-bold uppercase text-danger/80 hover:bg-danger/10"
              >
                Delete
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
