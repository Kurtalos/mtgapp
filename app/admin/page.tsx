import type { Metadata } from "next";
import { AdminClient } from "./AdminClient";

export const metadata: Metadata = {
  title: "Content admin — Cards with Kurt & Friends",
};

export default function AdminPage() {
  return <AdminClient />;
}
