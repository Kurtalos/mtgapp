/**
 * Small deterministic PRNG so that every shuffle can be reproduced from a
 * seed. Game state stays pure (no Math.random inside the reducer), which makes
 * the whole engine unit-testable and keeps every phone in sync — the client
 * that triggers an action picks the seed and everyone else replays it.
 */

/** mulberry32 — tiny, fast, good enough for shuffling a card deck. */
export function createRng(seed: number): () => number {
  let a = seed >>> 0;
  return function next() {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function randomSeed(): number {
  return Math.floor(Math.random() * 0xffffffff) >>> 0;
}

/** Fisher–Yates, driven by the supplied rng. Returns a new array. */
export function shuffle<T>(items: readonly T[], rng: () => number): T[] {
  const out = items.slice();
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [out[i], out[j]] = [out[j], out[i]];
  }
  return out;
}

export function pick<T>(items: readonly T[], rng: () => number): T {
  return items[Math.floor(rng() * items.length)];
}

/**
 * The planar die has six faces: three blank, one chaos and two planeswalk.
 * Returning the face rather than a number keeps the calling code readable.
 */
export function rollPlanarFace(rng: () => number): "blank" | "chaos" | "planeswalk" {
  const roll = Math.floor(rng() * 6);
  if (roll < 3) return "blank";
  if (roll === 3) return "chaos";
  return "planeswalk";
}

export function uid(prefix = ""): string {
  const raw =
    typeof crypto !== "undefined" && "randomUUID" in crypto
      ? crypto.randomUUID().replace(/-/g, "").slice(0, 10)
      : Math.random().toString(36).slice(2, 12);
  return prefix ? `${prefix}_${raw}` : raw;
}
