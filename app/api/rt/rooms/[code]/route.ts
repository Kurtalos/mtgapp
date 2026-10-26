import { NextResponse } from "next/server";
import { readRoom, saveRoom } from "@/lib/server/store";
import { publish } from "@/lib/server/hub";
import type { StoredRoom } from "@/lib/types";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const CODE_PATTERN = /^[A-Z0-9]{4,8}$/;

function normalise(code: string): string | null {
  const upper = code.toUpperCase();
  return CODE_PATTERN.test(upper) ? upper : null;
}

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ code: string }> },
) {
  const code = normalise((await params).code);
  if (!code) return NextResponse.json({ error: "Invalid room code" }, { status: 400 });

  const record = await readRoom(code);
  if (!record) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const room: StoredRoom = {
    code: record.code,
    state: record.state as StoredRoom["state"],
    version: record.version,
    updatedAt: record.updatedAt,
  };
  return NextResponse.json({ room });
}

/**
 * Compare-and-set write.
 *
 * `expectedVersion` must match what the client last saw. A mismatch is a 409
 * carrying the current document, which is exactly what the client needs to
 * replay its action on top of whoever won the race.
 */
export async function PUT(
  request: Request,
  { params }: { params: Promise<{ code: string }> },
) {
  const code = normalise((await params).code);
  if (!code) return NextResponse.json({ error: "Invalid room code" }, { status: 400 });

  let body: { state?: unknown; expectedVersion?: number };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  if (!body.state || typeof body.state !== "object") {
    return NextResponse.json({ error: "Missing room state" }, { status: 400 });
  }
  if (typeof body.expectedVersion !== "number") {
    return NextResponse.json({ error: "Missing expectedVersion" }, { status: 400 });
  }

  const result = await saveRoom(code, body.state, body.expectedVersion);

  if (!result.ok) {
    if (!result.room) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }
    const room: StoredRoom = {
      code: result.room.code,
      state: result.room.state as StoredRoom["state"],
      version: result.room.version,
      updatedAt: result.room.updatedAt,
    };
    return NextResponse.json({ room }, { status: 409 });
  }

  const room: StoredRoom = {
    code: result.room.code,
    state: result.room.state as StoredRoom["state"],
    version: result.room.version,
    updatedAt: result.room.updatedAt,
  };
  publish(code, room);
  return NextResponse.json({ room });
}
