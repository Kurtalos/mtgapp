import { promises as fs } from "node:fs";
import path from "node:path";
import type { ContentBundle } from "@/lib/content";

/**
 * Admin-managed game content, stored next to the rooms.
 *
 * Only *custom* items live here. The bundled planes and classes are always
 * present, so a bad edit or a missing file can never leave the app with no
 * planes at all — it just falls back to what shipped.
 */

const EMPTY: ContentBundle = { planes: [], schemes: [], classes: [] };

function dataDir(): string {
  return process.env.DATA_DIR
    ? path.resolve(process.env.DATA_DIR)
    : path.join(process.cwd(), ".data");
}

function contentPath(): string {
  return path.join(dataDir(), "content.json");
}

export async function readContent(): Promise<ContentBundle> {
  try {
    const raw = await fs.readFile(contentPath(), "utf8");
    const parsed = JSON.parse(raw) as Partial<ContentBundle>;
    return {
      planes: Array.isArray(parsed.planes) ? parsed.planes : [],
      schemes: Array.isArray(parsed.schemes) ? parsed.schemes : [],
      classes: Array.isArray(parsed.classes) ? parsed.classes : [],
    };
  } catch {
    return { ...EMPTY };
  }
}

export async function writeContent(bundle: ContentBundle): Promise<void> {
  await fs.mkdir(dataDir(), { recursive: true });
  const target = contentPath();
  const temp = `${target}.${process.pid}.tmp`;
  await fs.writeFile(temp, JSON.stringify(bundle, null, 2), "utf8");
  await fs.rename(temp, target);
}

export function adminToken(): string | null {
  const token = process.env.ADMIN_TOKEN?.trim();
  return token ? token : null;
}

/**
 * True when the request may change content.
 *
 * With ADMIN_TOKEN unset the panel is open, which is what you want while
 * developing locally and on a freshly installed box before you have decided on
 * a password. The admin UI says so plainly rather than pretending it is safe.
 */
export function isAuthorised(request: Request): boolean {
  const expected = adminToken();
  if (!expected) return true;
  const supplied = request.headers.get("x-admin-token") ?? "";
  return supplied === expected;
}

export function validateContent(input: unknown): ContentBundle | null {
  if (!input || typeof input !== "object") return null;
  const body = input as Partial<ContentBundle>;
  if (!Array.isArray(body.planes) || !Array.isArray(body.schemes) || !Array.isArray(body.classes)) {
    return null;
  }

  const planes = body.planes
    .filter((card) => card && typeof card.id === "string" && typeof card.name === "string")
    .map((card) => ({
      id: card.id.slice(0, 60),
      name: String(card.name).slice(0, 120),
      type: card.type === "Phenomenon" ? ("Phenomenon" as const) : ("Plane" as const),
      oracleText: String(card.oracleText ?? "").slice(0, 2000),
      chaosText: String(card.chaosText ?? "").slice(0, 2000),
      image: card.image ? String(card.image).slice(0, 500) : null,
      custom: true,
    }));

  const schemes = body.schemes
    .filter((card) => card && typeof card.id === "string" && typeof card.name === "string")
    .map((card) => ({
      id: card.id.slice(0, 60),
      name: String(card.name).slice(0, 120),
      oracleText: String(card.oracleText ?? "").slice(0, 2000),
      image: card.image ? String(card.image).slice(0, 500) : null,
      custom: true,
    }));

  const roles = new Set(["king", "knight", "bandit", "assassin", "usurper"]);
  const classes = body.classes
    .filter(
      (entry) =>
        entry &&
        typeof entry.id === "string" &&
        typeof entry.name === "string" &&
        roles.has(entry.role),
    )
    .map((entry) => ({
      id: entry.id.slice(0, 60),
      role: entry.role,
      name: String(entry.name).slice(0, 120),
      description: String(entry.description ?? "").slice(0, 500),
      custom: true,
    }));

  return { planes, schemes, classes };
}
