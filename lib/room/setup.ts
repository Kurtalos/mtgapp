import type { GameMode, RoomState } from "@/lib/types";
import { MODE_META } from "@/lib/types";
import { baseLifeFor, blankPlayer } from "./reducer";

export function createRoomState(options: {
  code: string;
  hostId: string;
  hostName: string;
  mode: GameMode;
  startingLife?: number;
}): RoomState {
  const { code, hostId, hostName, mode } = options;
  const startingLife = options.startingLife ?? MODE_META[mode].defaultLife;
  const now = Date.now();

  return {
    code,
    mode,
    phase: "lobby",
    startingLife,
    hostId,
    players: [blankPlayer(hostId, hostName, 0, baseLifeFor(mode, startingLife))],
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
    kingdom: { dealt: false, roles: {}, revealed: [], claims: {} },
    log: [
      {
        id: "log_boot",
        at: now,
        actorId: null,
        text: `${hostName} opened the table.`,
        kind: "system",
      },
    ],
    winners: null,
    createdAt: now,
    updatedAt: now,
  };
}
