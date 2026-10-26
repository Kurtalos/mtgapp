import { NextResponse } from "next/server";
import {
  adminToken,
  isAuthorised,
  readContent,
  validateContent,
  writeContent,
} from "@/lib/server/content-store";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** Public: the custom content every client needs to merge in. */
export async function GET() {
  const content = await readContent();
  return NextResponse.json(content, {
    headers: { "Cache-Control": "no-store" },
  });
}

/** Admin: replace the custom content set. */
export async function PUT(request: Request) {
  if (!isAuthorised(request)) {
    return NextResponse.json({ error: "Bad or missing admin token" }, { status: 401 });
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const content = validateContent(body);
  if (!content) {
    return NextResponse.json(
      { error: "Expected { planes: [], schemes: [], classes: [] }" },
      { status: 400 },
    );
  }

  await writeContent(content);
  return NextResponse.json({ ok: true, content });
}

/** Whether the admin panel needs a token, so the UI can say so. */
export async function HEAD() {
  return new Response(null, {
    status: 204,
    headers: { "x-admin-required": adminToken() ? "1" : "0" },
  });
}
