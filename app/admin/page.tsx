import type { Metadata } from "next";
import { AdminClient } from "./AdminClient";

export const metadata: Metadata = {
  title: "Content admin — Mana Table",
};

export default function AdminPage() {
  return <AdminClient />;
}
