import type { Metadata } from "next";
import { RoomClient } from "./RoomClient";

export const metadata: Metadata = {
  title: "Table — Mana Table",
};

export default async function RoomPage({
  params,
}: {
  params: Promise<{ code: string }>;
}) {
  const { code } = await params;
  return <RoomClient code={decodeURIComponent(code).toUpperCase()} />;
}
