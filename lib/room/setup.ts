import type { GameMode, RoomState } from "@/lib/types";
import { MODE_META } from "@/lib/types";
import { baseLifeFor, blankPlayer } from "./reducer";

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, Math.round(value)));
}

export function createRoomState(options: {
  code: string;
  hostId: string;
  hostName: string;
  mode: GameMode;
  startingLife?: number;
  maxPlayers?: number;
}): RoomState {
  const { code, hostId, hostName, mode } = options;
  const meta = MODE_META[mode];
  const startingLife = clamp(
    options.startingLife ?? meta.defaultLife,
    1,
    999,
  );
  const maxPlayers = clamp(
    options.maxPlayers ?? meta.defaultMaxPlayers,
    meta.minPlayers,
    meta.maxPlayers,
  );
  const now = Date.now();

  return {
    code,
    mode,
    phase: "lobby",
    startingLife,
    hostId,
    players: [blankPlayer(hostId, hostName, 0, baseLifeFor(mode, startingLife))],
    maxPlayers,
    spectators: [],
    planechase: {
      deck: [],
      current: null,
      bottom: [],
      controllerId: hostId,
      chaosPending: false,
      rollsThisTurn: 0,
    },
    archenemy: {
      archenemyId: hostId,
      deck: [],
      active: [],
      lastRevealed: null,
      resolved: [],
    },
    kingdom: {
      dealt: false,
      setup: null as unknown as RoomState["kingdom"]["setup"],
      roles: {},
      classes: {},
      revealed: [],
      claims: {},
    },
    log: [
      {
        id: "log_boot",
        at: now,
        actorId: null,
        text: `${hostName} opened the table.`,
        kind: "system",
      },
    ],
    lastRoll: null,
    winners: null,
    createdAt: now,
    updatedAt: now,
  };
}
