"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { PlayerState, StoredRoom } from "@/lib/types";
import { applyAction, type RoomAction } from "@/lib/room/reducer";
import { normaliseRoomState } from "@/lib/room/migrate";
import { getTransport } from "@/lib/transport";
import type { PresencePlayer } from "@/lib/transport/types";
import { getPlayerId, getSavedName } from "@/lib/identity";

export type RoomStatus = "loading" | "missing" | "ready" | "error";

export interface UseRoom {
  status: RoomStatus;
  room: StoredRoom | null;
  me: PlayerState | null;
  meId: string;
  isHost: boolean;
  presence: PresencePlayer[];
  onlineIds: Set<string>;
  dispatch: (action: RoomAction) => void;
  refresh: () => void;
  saveName: (name: string) => void;
}

/**
 * Binds a room code to live state.
 *
 * Writes are optimistic: the tapped number changes instantly, then the change
 * is persisted with a compare-and-set on the room version. If another phone
 * won the race, we adopt their state and replay our action once — so a tap is
 * never silently swallowed.
 */
export function useRoom(code: string): UseRoom {
  const [status, setStatus] = useState<RoomStatus>("loading");
  const [room, setRoom] = useState<StoredRoom | null>(null);
  const [presence, setPresence] = useState<PresencePlayer[]>([]);
  const [meId, setMeId] = useState("");

  const roomRef = useRef<StoredRoom | null>(null);
  const transport = useMemo(() => getTransport(), []);
  const inFlight = useRef(0);

  const adopt = useCallback((incoming: StoredRoom) => {
    // Ignore out-of-order pushes; version only ever moves forward.
    if (roomRef.current && incoming.version < roomRef.current.version) return;
    // A table opened by an older build is missing fields this one expects.
    const next = { ...incoming, state: normaliseRoomState(incoming.state) as StoredRoom["state"] };
    roomRef.current = next;
    setRoom(next);
  }, []);

  const load = useCallback(async () => {
    const found = await transport.load(code);
    if (!found) {
      setStatus("missing");
      return;
    }
    adopt(found);
    setStatus("ready");
  }, [adopt, code, transport]);

  useEffect(() => {
    setMeId(getPlayerId());
  }, []);

  useEffect(() => {
    let cancelled = false;
    setStatus("loading");
    void load().then(() => {
      if (cancelled) return;
    });

    const unsubscribe = transport.subscribe(code, (next) => {
      adopt(next);
      setStatus("ready");
    });

    // An admin can close a room out from under the table. When that happens the
    // phones should say so straight away rather than sit on a board that can no
    // longer be saved.
    const unwatchClosed = transport.onClosed?.(code, () => {
      roomRef.current = null;
      setRoom(null);
      setStatus("missing");
    });

    return () => {
      cancelled = true;
      unsubscribe();
      unwatchClosed?.();
    };
  }, [adopt, code, load, transport]);

  // Presence is informational only — dropping a socket never removes a player.
  useEffect(() => {
    if (!meId) return;
    const name = getSavedName() || "Player";
    const stop = transport.watchPresence(
      code,
      { playerId: meId, name, onlineAt: Date.now() },
      setPresence,
    );
    return stop;
  }, [code, meId, transport]);

  const commit = useCallback(
    async (action: RoomAction, base: StoredRoom) => {
      const token = ++inFlight.current;
      const optimistic: StoredRoom = {
        ...base,
        state: { ...applyAction(base.state, action), updatedAt: Date.now() },
      };
      // Only paint the optimistic frame if no newer write is in flight.
      if (token === inFlight.current) {
        roomRef.current = optimistic;
        setRoom(optimistic);
      }

      let attemptState = optimistic.state;
      let expectedVersion = base.version;

      for (let attempt = 0; attempt < 2; attempt++) {
        const result = await transport.save(code, attemptState, expectedVersion);
        if (result.ok && result.room) {
          if (token === inFlight.current) adopt(result.room);
          return;
        }
        if (!result.room) {
          await load();
          return;
        }
        // Someone else got there first: adopt their state and re-apply.
        adopt(result.room);
        expectedVersion = result.room.version;
        attemptState = {
          ...applyAction(result.room.state, action),
          updatedAt: Date.now(),
        };
        if (token === inFlight.current) {
          roomRef.current = { ...result.room, state: attemptState };
          setRoom(roomRef.current);
        }
      }
    },
    [adopt, code, load, transport],
  );

  const dispatch = useCallback(
    (action: RoomAction) => {
      const base = roomRef.current;
      if (!base) return;
      void commit(action, base);
    },
    [commit],
  );

  const me = useMemo(() => {
    if (!room || !meId) return null;
    return room.state.players.find((p) => p.id === meId) ?? null;
  }, [meId, room]);

  const onlineIds = useMemo(
    () => new Set(presence.map((p) => p.playerId)),
    [presence],
  );

  const saveName = useCallback(
    (name: string) => {
      const trimmed = name.trim().slice(0, 24);
      if (!trimmed || !meId) return;
      dispatch({ type: "rename", playerId: meId, name: trimmed });
      void import("@/lib/identity").then((m) => m.saveName(trimmed));
    },
    [dispatch, meId],
  );

  return {
    status,
    room,
    me,
    meId,
    isHost: Boolean(room && room.state.hostId === meId),
    presence,
    onlineIds,
    dispatch,
    refresh: () => void load(),
    saveName,
  };
}
