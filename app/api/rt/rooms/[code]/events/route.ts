import { readRoom } from "@/lib/server/store";
import { presenceFor, subscribe } from "@/lib/server/hub";
import type { StoredRoom } from "@/lib/types";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const CODE_PATTERN = /^[A-Z0-9]{4,8}$/;
const HEARTBEAT_MS = 20_000;

/**
 * Server-Sent Events for one room.
 *
 * A phone opens this once and keeps it open. Room changes arrive as `room`
 * events, and who is currently connected arrives as `presence` events.
 *
 * SSE rather than WebSockets on purpose: the traffic here is entirely
 * server-to-client (the client writes through PUT), browsers reconnect
 * automatically, and it survives every proxy and reverse proxy without upgrade
 * negotiation. One less moving part on a small box.
 */
export async function GET(
  request: Request,
  { params }: { params: Promise<{ code: string }> },
) {
  const raw = (await params).code.toUpperCase();
  if (!CODE_PATTERN.test(raw)) {
    return new Response("Invalid room code", { status: 400 });
  }
  const code = raw;

  const room = await readRoom(code);
  if (!room) {
    return new Response("Not found", { status: 404 });
  }

  const url = new URL(request.url);
  const playerId = url.searchParams.get("playerId") ?? `anon_${Math.random()}`;
  const name = url.searchParams.get("name") ?? "Player";
  const subscriberId = `${playerId}:${Math.random().toString(36).slice(2, 8)}`;

  const encoder = new TextEncoder();
  let closed = false;
  // Assigned once the stream is wired up inside start(). The stream can be torn
  // down three ways — client cancellation, the request aborting, or a write
  // failing — and all of them must unsubscribe: a subscriber we forget to drop
  // keeps the room looking occupied, which also keeps the empty-room cleanup in
  // lib/server/lifecycle.ts from ever running.
  let teardown = () => {
    closed = true;
  };

  const stream = new ReadableStream({
    start(controller) {
      const write = (chunk: string) => {
        if (closed) return;
        try {
          controller.enqueue(encoder.encode(chunk));
        } catch {
          // The socket is gone. Tear down properly rather than sitting in the
          // presence list forever as a player who is not really there.
          closed = true;
          teardown();
        }
      };

      const send = (event: string, data: unknown) => {
        write(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`);
      };

      // Send the current document immediately so the subscriber has a base
      // before it starts receiving diffs.
      const current: StoredRoom = {
        code: room.code,
        state: room.state as StoredRoom["state"],
        version: room.version,
        updatedAt: room.updatedAt,
      };
      send("room", current);
      send("presence", presenceFor(code));

      const unsubscribe = subscribe(code, {
        id: subscriberId,
        playerId,
        name,
        send,
      });

      const heartbeat = setInterval(() => {
        if (closed) return;
        write(`: keep-alive\n\n`);
      }, HEARTBEAT_MS);

      let tornDown = false;
      const cleanup = () => {
        if (tornDown) return;
        tornDown = true;
        closed = true;
        clearInterval(heartbeat);
        unsubscribe();
        try {
          controller.close();
        } catch {
          /* already closed */
        }
      };
      teardown = cleanup;

      request.signal.addEventListener("abort", cleanup);
    },
    cancel() {
      teardown();
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream; charset=utf-8",
      "Cache-Control": "no-cache, no-transform",
      Connection: "keep-alive",
      // Stops nginx from buffering the stream into uselessness.
      "X-Accel-Buffering": "no",
    },
  });
}
