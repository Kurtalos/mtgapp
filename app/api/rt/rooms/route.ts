import { NextResponse } from "next/server";
import { createRoom } from "@/lib/server/store";
import { publish } from "@/lib/server/hub";
import type { StoredRoom } from "@/lib/types";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const CODE_PATTERN = /^[A-Z0-9]{4,8}$/;

export async function POST(request: Request) {
  let body: { code?: string; state?: unknown };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const code = (body.code ?? "").toUpperCase();
  if (!CODE_PATTERN.test(code)) {
    return NextResponse.json({ error: "Invalid room code" }, { status: 400 });
  }
  if (!body.state || typeof body.state !== "object") {
    return NextResponse.json({ error: "Missing room state" }, { status: 400 });
  }

  const result = await createRoom(code, body.state);
  const room: StoredRoom = {
    code: result.room.code,
    state: result.room.state as StoredRoom["state"],
    version: result.room.version,
    updatedAt: result.room.updatedAt,
  };

  if (!result.ok) {
    // The code is taken. The client treats this as "try another code".
    return NextResponse.json({ room }, { status: 409 });
  }

  publish(code, room);
  return NextResponse.json({ room }, { status: 201 });
}
