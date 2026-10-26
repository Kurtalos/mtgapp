/**
 * Optional card art.
 *
 * The app deliberately ships no card images: plane and scheme art is
 * copyrighted, and bundling it would make the repo enormous. Instead we ask
 * Scryfall for the handful of cards we care about, once, and cache the result
 * in localStorage for a week. If the request fails — offline, blocked, rate
 * limited — every screen still works, just without the picture.
 */

const CACHE_PREFIX = "manatable:scryfall:";
const TTL_MS = 7 * 24 * 60 * 60 * 1000;
const ENDPOINT = "https://api.scryfall.com";

export interface CardArt {
  name: string;
  image: string;
  typeLine: string;
  oracleText: string;
}

export function normaliseCardName(name: string): string {
  return name
    .toLowerCase()
    .replace(/[\u2018\u2019]/g, "'")
    .replace(/[^a-z0-9]/g, "");
}

interface CacheEntry {
  at: number;
  value: unknown;
}

function readCache<T>(key: string): T | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.localStorage.getItem(CACHE_PREFIX + key);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as CacheEntry;
    if (Date.now() - parsed.at > TTL_MS) return null;
    return parsed.value as T;
  } catch {
    return null;
  }
}

function writeCache(key: string, value: unknown) {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(
      CACHE_PREFIX + key,
      JSON.stringify({ at: Date.now(), value }),
    );
  } catch {
    /* quota exceeded — art is a nice-to-have */
  }
}

async function fetchType(type: string): Promise<CardArt[]> {
  const url = `${ENDPOINT}/cards/search?q=${encodeURIComponent(
    `t:${type} game:paper`,
  )}&unique=cards&order=name`;
  const response = await fetch(url, { headers: { Accept: "application/json" } });
  if (!response.ok) throw new Error(`Scryfall ${response.status}`);
  const payload = (await response.json()) as {
    data?: Array<{
      name: string;
      type_line?: string;
      oracle_text?: string;
      image_uris?: { normal?: string; small?: string };
    }>;
  };
  return (payload.data ?? [])
    .map((card) => ({
      name: card.name,
      image: card.image_uris?.normal ?? card.image_uris?.small ?? "",
      typeLine: card.type_line ?? type,
      oracleText: card.oracle_text ?? "",
    }))
    .filter((card) => card.name);
}

function toMap(cards: CardArt[]): Record<string, CardArt> {
  const map: Record<string, CardArt> = {};
  for (const card of cards) {
    map[normaliseCardName(card.name)] = card;
    // Plane cards are printed as "Name" but sometimes referenced with the
    // "Plane — X" suffix; the normalised name handles the common case.
  }
  return map;
}

export async function loadPlaneArt(): Promise<Record<string, CardArt>> {
  const cached = readCache<Record<string, CardArt>>("planes");
  if (cached) return cached;
  try {
    const cards = await fetchType("plane");
    const map = toMap(cards);
    writeCache("planes", map);
    return map;
  } catch {
    return {};
  }
}

export async function loadSchemeArt(): Promise<Record<string, CardArt>> {
  const cached = readCache<Record<string, CardArt>>("schemes");
  if (cached) return cached;
  try {
    const cards = await fetchType("scheme");
    const map = toMap(cards);
    writeCache("schemes", map);
    return map;
  } catch {
    return {};
  }
}

export function cardArtFor(
  map: Record<string, CardArt> | null,
  name: string,
): CardArt | null {
  if (!map) return null;
  return map[normaliseCardName(name)] ?? null;
}
