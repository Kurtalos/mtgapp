"use client";

import type { RollResult } from "@/lib/types";

/**
 * The shared roll banner.
 *
 * Lives in its own file because both the player table and the spectator view
 * show it — and because a spectator very much needs to know whether the planar
 * die came up chaos.
 */
export function RollBanner({ roll }: { roll: RollResult }) {
  const who = roll.byId ? "rolled" : "";
  const icons: Record<string, string> = { die: "🎲", coin: "🪙", planar: "🌀" };

  return (
    <div className="flex items-center gap-3 rounded-xl border border-violet/30 bg-violet/10 px-3 py-2.5">
      <span className="text-lg">{icons[roll.kind] ?? "🎲"}</span>
      <div className="min-w-0 flex-1">
        <div className="text-[9px] font-black uppercase tracking-wider text-violet/80">
          {roll.label} {who} {roll.manual ? "· entered by hand" : ""}
        </div>
        <div className="tnum text-lg font-black leading-tight text-white">
          {roll.value}
        </div>
      </div>
    </div>
  );
}
