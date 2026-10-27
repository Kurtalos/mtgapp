"use client";

import { useMemo, useState } from "react";
import type { RoleId, RoomState } from "@/lib/types";
import type { RoomAction } from "@/lib/room/reducer";
import {
  FAMILY_COLOUR,
  FAMILY_GOAL,
  FAMILY_LABEL,
  ROLES,
  ROLE_FAMILIES,
  roleSetFor,
  type RoleFamily,
} from "@/lib/data/roles";
import {
  ADVANCED_MAX_PLAYERS,
  ADVANCED_MIN_PLAYERS,
  ADVANCED_SETUP_BY_SIZE,
  advancedSetupFor,
  announceText,
  cardById,
  describeSetup,
  emptySetup,
  hasAnnounce,
  setupTotal,
  type AdvancedSetup,
  type KingdomCard,
} from "@/lib/data/advancedKingdoms";
import { useContent } from "@/lib/useContent";
import { Badge, Modal } from "./ui";

/** Classic setup uses the legacy five roles; advanced uses the five families. */
type ClassicSetup = Record<RoleId, number>;

const EMPTY_CLASSIC: ClassicSetup = {
  king: 0,
  knight: 0,
  bandit: 0,
  assassin: 0,
  renegade: 0,
  usurper: 0,
};

const CLASSIC_ORDER: RoleId[] = ["king", "knight", "bandit", "assassin", "usurper"];

function classicDefault(playerCount: number): ClassicSetup {
  const setup = { ...EMPTY_CLASSIC };
  for (const role of roleSetFor(playerCount)) setup[role] += 1;
  return setup;
}

/* -------------------------------------------------------------------------- */

export function KingdomPanel({
  state,
  dispatch,
  myId,
  isHost,
}: {
  state: RoomState;
  dispatch: (action: RoomAction) => void;
  myId: string;
  isHost: boolean;
}) {
  const content = useContent();
  const [peeking, setPeeking] = useState(false);
  const [rulesOpen, setRulesOpen] = useState(false);
  const [setupOpen, setSetupOpen] = useState(false);
  const [zoom, setZoom] = useState<string | null>(null);

  const { kingdom } = state;
  const advanced = kingdom.variant === "advanced";
  const dealt = kingdom.dealt;

  const myRole = kingdom.roles[myId];
  const myCardId = kingdom.cards[myId];
  const myCard = myCardId ? cardById(myCardId) : undefined;
  const myMeta = myRole ? ROLES[myRole] : null;
  const myClass = useMemo(
    () => content.classes.find((entry) => entry.id === kingdom.classes[myId]) ?? null,
    [content.classes, kingdom.classes, myId],
  );

  const king = state.players.find((p) => kingdom.roles[p.id] === "king");
  const showAll = dealt && (state.phase === "finished" || kingdom.revealAll);
  const facing = myCard?.image ?? null;

  // Advanced Kingdoms only: whether *this* player has turned their card up,
  // and who else at the table has. Announcements are public — the whole point
  // of the action is that everyone hears what the card does.
  const myAnnouncedAt = kingdom.announced[myId] ?? null;
  const myAnnounced = myAnnouncedAt !== null;
  // Once the card is face up there is nothing left to peek at.
  const faceUp = peeking || myAnnounced;
  const canAnnounce =
    advanced && dealt && state.phase === "playing" && Boolean(myCard) && !myAnnounced;
  const announcedBy = state.players
    .filter((player) => kingdom.announced[player.id] !== undefined)
    .sort((a, b) => (kingdom.announced[a.id] ?? 0) - (kingdom.announced[b.id] ?? 0));

  return (
    <div className="space-y-3">
      {/* ---------------------------------------------------------- role card */}
      {dealt && myMeta ? (
        <div
          className="relative overflow-hidden rounded-2xl border p-3"
          style={{
            borderColor: `${myMeta.colour}55`,
            background: `linear-gradient(160deg, ${myMeta.colour}22, transparent 70%)`,
          }}
        >
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0 flex-1">
              <div className="text-[9px] font-black uppercase tracking-[0.14em] text-slate-400">
                {advanced ? "Your role card" : "Your secret role"}
              </div>

              {faceUp ? (
                <div className="animate-pop">
                  <div
                    className="text-xl font-black leading-tight"
                    style={{ color: myMeta.colour }}
                  >
                    {myCard?.name ?? myClass?.name ?? myMeta.name}
                  </div>
                  <div className="mt-0.5 text-[10px] font-bold uppercase tracking-wider text-slate-500">
                    Kingdom Role — {FAMILY_LABEL[myMeta.family]}
                  </div>

                  {/* The actual printed card, tappable to enlarge */}
                  {facing && (
                    <button
                      onClick={() => setZoom(facing)}
                      className="mt-2 block w-full overflow-hidden rounded-xl border border-white/10"
                    >
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img
                        src={facing}
                        alt={myCard?.name ?? "Your role card"}
                        className="w-full"
                      />
                      <span className="block bg-black/40 py-1 text-center text-[9px] font-bold uppercase tracking-wider text-slate-400">
                        Tap to enlarge
                      </span>
                    </button>
                  )}

                  {!facing && myCard && (
                    <div className="mt-2 space-y-1.5 rounded-xl border border-white/10 bg-black/25 p-2.5">
                      <p className="text-[11px] leading-relaxed text-slate-300">
                        {myCard.text}
                      </p>
                      {myCard.secondary && (
                        <p className="whitespace-pre-line text-[11px] leading-relaxed text-slate-400">
                          {myCard.secondary}
                        </p>
                      )}
                    </div>
                  )}

                  {myClass?.description && !myCard && (
                    <p className="mt-1 text-[11px] italic text-slate-400">
                      {myClass.description}
                    </p>
                  )}

                  <div className="mt-2 rounded-lg bg-black/25 px-2 py-1.5">
                    <div className="text-[9px] font-black uppercase tracking-wider text-slate-500">
                      {FAMILY_LABEL[myMeta.family]} — victory
                    </div>
                    <div className="text-[11px] leading-snug text-slate-300">
                      {myCard && myCard.family === "renegade"
                        ? "As printed on your card."
                        : FAMILY_GOAL[myMeta.family].victory}
                    </div>
                  </div>

                  {/* The printed setup has the Bandits open their eyes
                      together at the start of the game. This is that moment,
                      privately: only a Bandit is ever shown it. */}
                  {advanced && myMeta.family === "bandit" && (
                    <div className="mt-1.5 rounded-lg border border-white/10 bg-black/25 px-2 py-1.5">
                      <div className="text-[9px] font-black uppercase tracking-wider text-slate-500">
                        Your bandits
                      </div>
                      <div className="text-[11px] leading-snug text-slate-300">
                        {otherBandits(state, myId)}
                      </div>
                    </div>
                  )}

                  {myCard?.tracksManually && (
                    <p className="mt-1.5 rounded-lg border border-amber/25 bg-amber/10 px-2 py-1.5 text-[10px] leading-snug text-amber">
                      This card depends on table history the app cannot see —
                      resolve its effect out loud and let the host call the
                      result.
                    </p>
                  )}
                </div>
              ) : (
                <div className="mt-1">
                  <div className="text-sm font-bold text-slate-400">
                    Tap to look — keep it to yourself.
                  </div>
                  <div className="mt-0.5 text-[10px] text-slate-600">
                    {advanced
                      ? `${FAMILY_LABEL[myMeta.family]} · your card stays face down until you Announce`
                      : myMeta.goal}
                  </div>
                </div>
              )}
            </div>

            {myAnnounced ? (
              <span
                className="shrink-0 rounded-xl border px-3 py-2 text-[10px] font-black uppercase tracking-wider"
                style={{
                  color: myMeta.colour,
                  borderColor: `${myMeta.colour}66`,
                  background: `${myMeta.colour}1a`,
                }}
              >
                Face up
              </span>
            ) : (
              <button
                onClick={() => setPeeking((v) => !v)}
                className="shrink-0 rounded-xl border border-white/10 bg-black/30 px-3 py-2 text-xs font-black uppercase tracking-wider"
                style={{ color: myMeta.colour }}
              >
                {peeking ? "Hide" : "Peek"}
              </button>
            )}
          </div>
        </div>
      ) : (
        <div className="rounded-2xl border border-dashed border-white/15 bg-black/20 px-3 py-4 text-center">
          <div className="text-sm font-bold text-slate-400">
            {state.phase === "lobby"
              ? "Roles are dealt when the game starts"
              : "No role assigned"}
          </div>
          <div className="mt-1 text-[11px] text-slate-600">
            Only the King is public. Everyone else keeps theirs face down.
          </div>
        </div>
      )}

      {/* ------------------------------------------------------------ announce */}
      {advanced && dealt && myCard && hasAnnounce(myCard) && (
        <AnnouncePanel
          state={state}
          myId={myId}
          dispatch={dispatch}
          card={myCard}
          announcedAt={myAnnouncedAt}
          canAnnounce={canAnnounce}
        />
      )}

      {advanced && announcedBy.length > 0 && (
        <div className="rounded-xl border border-line bg-surface-2 px-3 py-2">
          <div className="text-[9px] font-black uppercase tracking-wider text-slate-500">
            Announced
          </div>
          <div className="mt-1 space-y-0.5">
            {announcedBy.map((player) => {
              const cardId = kingdom.cards[player.id];
              const card = cardId ? cardById(cardId) : undefined;
              return (
                <button
                  key={player.id}
                  onClick={() => card && setZoom(card.image)}
                  className="flex w-full items-center gap-2 text-left text-[11px]"
                >
                  <span className="min-w-0 flex-1 truncate font-bold text-slate-200">
                    {player.name}
                  </span>
                  <span className="shrink-0 text-slate-400">{card?.name ?? "—"}</span>
                  {card && <span className="shrink-0 text-slate-600">›</span>}
                </button>
              );
            })}
          </div>
        </div>
      )}

      {/* ------------------------------------------------------- table state */}
      <div className="flex items-center justify-between rounded-xl border border-line bg-surface-2 px-3 py-2">
        <div>
          <div className="text-[9px] font-black uppercase tracking-wider text-slate-500">
            The throne
          </div>
          <div className="text-sm font-extrabold text-amber">
            {king ? king.name : "—"}
          </div>
        </div>
        <div className="text-right">
          <div className="text-[9px] font-black uppercase tracking-wider text-slate-500">
            Still standing
          </div>
          <div className="tnum text-sm font-extrabold text-white">
            {state.players.filter((p) => !p.eliminated).length} / {state.players.length}
          </div>
        </div>
      </div>

      {/* --------------------------------------------------- variant + setup */}
      {isHost && state.phase === "lobby" && (
        <div className="rounded-xl border border-line bg-surface-2 p-2">
          <div className="mb-1.5 text-[9px] font-black uppercase tracking-wider text-slate-500">
            Ruleset
          </div>
          <div className="grid grid-cols-2 gap-1.5">
            <button
              onClick={() => dispatch({ type: "setMode", mode: "kingdom" })}
              className={`btn py-2 text-[11px] ${!advanced ? "btn-primary" : "btn-ghost"}`}
            >
              Classic
            </button>
            <button
              onClick={() => dispatch({ type: "setMode", mode: "advanced" })}
              className={`btn py-2 text-[11px] ${advanced ? "btn-primary" : "btn-ghost"}`}
            >
              Advanced
            </button>
          </div>
          <p className="mt-1.5 text-[10px] leading-snug text-slate-500">
            {advanced
              ? "21 printed role cards, 5–9 players. Each player is dealt one card, face down until they Announce."
              : "The standard five roles, 2–8 players. Switches the room to Advanced Kingdoms — the two are separate formats."}
          </p>
        </div>
      )}

      {isHost && state.phase === "lobby" && (
        <div className="flex gap-2">
          <button onClick={() => setSetupOpen(true)} className="btn btn-primary flex-1 py-2.5 text-xs">
            {advanced ? "Role setup" : "Role setup"}
          </button>
          <button
            onClick={() => setRulesOpen((v) => !v)}
            className="btn btn-ghost px-3 py-2.5 text-xs"
          >
            Rules
          </button>
        </div>
      )}

      {isHost && state.phase !== "lobby" && (
        <div className="flex gap-2">
          <button
            onClick={() =>
              dispatch({ type: "dealRoles", byId: myId, classes: content.classes })
            }
            className="btn btn-ghost flex-1 py-2.5 text-xs"
          >
            Re-deal roles
          </button>
          <button
            onClick={() => setRulesOpen((v) => !v)}
            className="btn btn-ghost px-3 py-2.5 text-xs"
          >
            Rules
          </button>
        </div>
      )}

      {rulesOpen && <RulesBlock advanced={advanced} />}

      {/* -------------------------------------------------------- claim roles */}
      {dealt && (
        <div className="space-y-1">
          <div className="text-[9px] font-black uppercase tracking-wider text-slate-500">
            Claim a role (bluffing allowed)
          </div>
          <div className="flex flex-wrap gap-1.5">
            {(advanced ? ROLE_FAMILIES : CLASSIC_ORDER).map((roleId) => {
              const claimed = kingdom.claims[myId] === roleId;
              const meta = ROLES[roleId];
              if (!meta) return null;
              return (
                <button
                  key={roleId}
                  onClick={() =>
                    dispatch({
                      type: "claimRole",
                      playerId: myId,
                      role: claimed ? null : roleId,
                    })
                  }
                  className={`rounded-lg border px-2.5 py-1.5 text-[11px] font-bold ${
                    claimed
                      ? "border-white/30 bg-white/10 text-white"
                      : "border-line bg-surface-2 text-slate-400"
                  }`}
                >
                  {FAMILY_LABEL[roleId as RoleFamily] ?? meta.name}
                </button>
              );
            })}
          </div>
        </div>
      )}

      {/* ------------------------------------------------------ host override */}
      {isHost && dealt && (
        <div className="flex gap-2">
          <button
            onClick={() =>
              dispatch({
                type: "revealAllRoles",
                byId: myId,
                reveal: !kingdom.revealAll,
              })
            }
            className={`btn flex-1 py-2.5 text-xs ${
              kingdom.revealAll ? "btn-primary" : "btn-ghost"
            }`}
          >
            {kingdom.revealAll ? "Hide roles again" : "Reveal every role"}
          </button>
          {state.phase === "playing" && (
            <button
              onClick={() => setZoom("__declare__")}
              className="btn btn-ghost px-3 py-2.5 text-xs"
            >
              Call game
            </button>
          )}
        </div>
      )}

      {showAll && <RoleRoster state={state} myId={myId} onZoom={setZoom} />}

      <div className="flex items-center justify-between">
        <Badge tone="amber">{advanced ? "Advanced Kingdoms" : "Secret roles"}</Badge>
        <span className="text-[10px] text-slate-500">
          {Object.keys(kingdom.claims).length} claims made
        </span>
      </div>

      <SetupModal
        open={setupOpen}
        onClose={() => setSetupOpen(false)}
        state={state}
        advanced={advanced}
        myId={myId}
        dispatch={dispatch}
      />

      <DeclareModal
        open={zoom === "__declare__"}
        onClose={() => setZoom(null)}
        state={state}
        myId={myId}
        dispatch={dispatch}
      />

      <Modal
        open={Boolean(zoom && zoom.startsWith("/kingdoms/"))}
        onClose={() => setZoom(null)}
        title={zoomCardName(state, zoom) ?? "Role card"}
      >
        {zoom?.startsWith("/kingdoms/") && (
          /* eslint-disable-next-line @next/next/no-img-element */
          <img src={zoom} alt="Role card" className="w-full rounded-xl" />
        )}
      </Modal>
    </div>
  );
}

/* -------------------------------------------------------------------------- */

/**
 * The Announce button.
 *
 * Announcing is a one-way door in the printed game — the card stays face up and
 * the table gets to see it — so the button explains itself before it fires,
 * names the player it will affect, and says plainly when the app is only
 * logging the ability rather than resolving it.
 */
function AnnouncePanel({
  state,
  myId,
  dispatch,
  card,
  announcedAt,
  canAnnounce,
}: {
  state: RoomState;
  myId: string;
  dispatch: (action: RoomAction) => void;
  card: KingdomCard;
  announcedAt: number | null;
  canAnnounce: boolean;
}) {
  const [picking, setPicking] = useState(false);
  const [confirming, setConfirming] = useState(false);
  const announced = announcedAt !== null;
  const effect = announceText(card);
  const automated = card.announceEffect?.kind === "exchangeWithTarget";
  const opponents = state.players.filter((p) => p.id !== myId);

  const announceFor = (targetId?: string) => {
    dispatch({ type: "announce", playerId: myId, byId: myId, targetId });
    setPicking(false);
    setConfirming(false);
  };

  return (
    <div
      className={`rounded-2xl border p-3 ${
        announced
          ? "border-mana/30 bg-mana/5"
          : "border-[#c9a227]/40 bg-[#c9a227]/10"
      }`}
    >
      <div className="flex items-center justify-between gap-2">
        <div className="text-[9px] font-black uppercase tracking-[0.14em] text-[#c9a227]">
          {announced ? "Announced" : "Announce"}
        </div>
        {announced && (
          <span className="rounded-full bg-mana/20 px-2 py-0.5 text-[9px] font-black uppercase tracking-wider text-mana">
            Face up
          </span>
        )}
      </div>

      <p className="mt-1.5 whitespace-pre-line text-[11px] leading-relaxed text-slate-300">
        {effect}
      </p>

      {!announced && card.announceWhen && (
        <p className="mt-1.5 rounded-lg bg-black/25 px-2 py-1.5 text-[10px] leading-snug text-amber">
          {describeAnnounceWhen(card.announceWhen)} — the app leaves the timing to
          the table.
        </p>
      )}

      {announced ? (
        <p className="mt-1.5 text-[10px] leading-snug text-slate-500">
          {automated
            ? "Resolved on the spot when it was announced."
            : "Play this out on the battlefield — the app has done all it can."}
        </p>
      ) : !canAnnounce ? (
        <p className="mt-1.5 text-[10px] leading-snug text-slate-500">
          {state.phase === "playing"
            ? "Announce once the game is under way."
            : "You can announce once the game starts."}
        </p>
      ) : confirming ? (
        <div className="mt-2 space-y-1.5">
          <p className="text-[11px] font-bold text-white">
            Turn {card.name} face up for the whole table?
          </p>
          <p className="text-[10px] leading-snug text-slate-400">
            The card stays face up for the rest of the game. Everyone will see
            your role.
          </p>
          <div className="flex gap-2">
            <button
              onClick={() => setConfirming(false)}
              className="btn btn-ghost flex-1 py-2 text-xs"
            >
              Not yet
            </button>
            <button
              onClick={() => (automated ? setPicking(true) : announceFor())}
              className="btn btn-primary flex-1 py-2 text-xs"
            >
              Announce
            </button>
          </div>
        </div>
      ) : (
        <button
          onClick={() => setConfirming(true)}
          className="btn mt-2 w-full py-2.5 text-xs"
          style={{ background: "#c9a227", color: "#1a1405" }}
        >
          Announce — turn {card.name} face up
        </button>
      )}

      <Modal
        open={picking}
        onClose={() => setPicking(false)}
        title="Exchange with whom?"
      >
        <p className="mb-3 text-[11px] leading-relaxed text-slate-400">
          The Priestess swaps your life total, accumulated commander damage and
          poison counters with one player. Pick the player — the app does the
          arithmetic.
        </p>
        <div className="space-y-1">
          {opponents.map((player) => (
            <button
              key={player.id}
              onClick={() => announceFor(player.id)}
              className="flex w-full items-center gap-2 rounded-lg border border-line bg-surface-2 px-2.5 py-2 text-left"
            >
              <span className="min-w-0 flex-1 truncate text-xs font-bold text-slate-200">
                {player.name}
              </span>
              <span className="tnum shrink-0 text-[11px] text-slate-400">
                {player.life} life · {player.poison} poison
              </span>
            </button>
          ))}
          {opponents.length === 0 && (
            <p className="text-[11px] text-slate-500">Nobody else at the table.</p>
          )}
        </div>
        <button
          onClick={() => announceFor()}
          className="btn btn-ghost mt-3 w-full py-2 text-[11px]"
        >
          Announce without exchanging
        </button>
      </Modal>
    </div>
  );
}

/**
 * The other Bandits at the table, or a line saying there are none.
 *
 * Advanced Kingdoms opens with a "Bandit Reveal" — all players close their
 * eyes, the Bandits look around, then everyone opens them again. This is that
 * step without the theatre; the list is only ever rendered for a Bandit.
 */
function otherBandits(state: RoomState, myId: string): string {
  const family = (id: string) => {
    const role = state.kingdom.roles[id];
    return role ? ROLES[role]?.family : undefined;
  };
  const names = state.players
    .filter((p) => p.id !== myId && family(p.id) === "bandit")
    .map((p) => p.name);
  return names.length > 0 ? names.join(", ") : "Nobody else — you are on your own.";
}

/** The card behind an image path, so the zoom modal can title itself. */
function zoomCardName(state: RoomState, path: string | null): string | null {
  if (!path) return null;
  const cardId = Object.values(state.kingdom.cards).find(
    (id) => cardById(id)?.image === path,
  );
  return cardId ? (cardById(cardId)?.name ?? null) : null;
}

/** Plain-English version of a card's printed Announce trigger. */
function describeAnnounceWhen(
  condition: NonNullable<KingdomCard["announceWhen"]>,
): string {
  switch (condition.kind) {
    case "selfLife":
      return `Your card allows this at ${condition.atOrBelow} life or less`;
    case "anyPlayerLife":
      return `Your card allows this once any player is at ${condition.atOrBelow} life or less`;
    case "onElimination":
      return "Your card allows this when you eliminate a player";
    case "onOtherAnnounce":
      return "Your card says to announce when anyone else does";
  }
}

/* -------------------------------------------------------------------------- */

function RulesBlock({ advanced }: { advanced: boolean }) {
  return (
    <div className="space-y-2 rounded-xl border border-line bg-surface-2 p-3 text-[11px] leading-relaxed text-slate-400">
      {advanced ? (
        <>
          {ROLE_FAMILIES.map((family) => (
            <div key={family}>
              <span className="font-black" style={{ color: FAMILY_COLOUR[family] }}>
                {FAMILY_LABEL[family]}
              </span>
              <span className="text-slate-500">
                {" — "}
                win: {FAMILY_GOAL[family].victory} Lose: {FAMILY_GOAL[family].defeat}
              </span>
            </div>
          ))}
          <p className="border-t border-line pt-2 text-slate-500">
            Deal from the printed set with the table below. Players may look at
            their own card, then choose a deck. Bandits open their eyes together
            and identify each other. The King turns face up, takes the first
            turn, and starts 10 life higher than everyone else.
          </p>
        </>
      ) : (
        <>
          {CLASSIC_ORDER.map((roleId) => (
            <div key={roleId}>
              <span className="font-black" style={{ color: ROLES[roleId].colour }}>
                {ROLES[roleId].name}
              </span>
              <span className="text-slate-500"> — {ROLES[roleId].goal}</span>
            </div>
          ))}
          <p className="border-t border-line pt-2 text-slate-500">
            The King starts at 50 life and takes the first turn. If the King
            loses while a Bandit is still alive, the Bandits win. The Knight wins
            with the King. The Assassin must be last. A Usurper who lands the
            killing blow swaps roles with the King.
          </p>
        </>
      )}
    </div>
  );
}

/* -------------------------------------------------------------------------- */

function RoleRoster({
  state,
  myId,
  onZoom,
}: {
  state: RoomState;
  myId: string;
  onZoom: (image: string) => void;
}) {
  const rows = [...state.players].sort((a, b) => a.seat - b.seat);
  return (
    <div className="rounded-2xl border border-white/10 bg-black/25 p-3">
      <div className="mb-2 text-[9px] font-black uppercase tracking-[0.14em] text-slate-400">
        {state.phase === "finished" ? "Final roles" : "Revealed by the host"}
      </div>
      <div className="space-y-1">
        {rows.map((player) => {
          const role = state.kingdom.roles[player.id];
          if (!role) return null;
          const meta = ROLES[role];
          const cardId = state.kingdom.cards[player.id];
          const card = cardId ? cardById(cardId) : undefined;
          return (
            <button
              key={player.id}
              onClick={() => card && onZoom(card.image)}
              className="flex w-full items-center gap-2 rounded-lg bg-white/5 px-2.5 py-1.5 text-left"
            >
              <span className="min-w-0 flex-1 truncate text-xs font-bold text-slate-200">
                {player.name}
                {player.id === myId && (
                  <span className="ml-1 text-[9px] uppercase text-mana">you</span>
                )}
              </span>
              {player.eliminated && (
                <span className="text-[9px] font-black uppercase text-slate-600">
                  out
                </span>
              )}
              <span
                className="shrink-0 text-[11px] font-black"
                style={{ color: meta?.colour ?? "#64748b" }}
              >
                {card?.name ?? meta?.name ?? role}
              </span>
            </button>
          );
        })}
      </div>
    </div>
  );
}

/* -------------------------------------------------------------------------- */

function SetupModal({
  open,
  onClose,
  state,
  advanced,
  myId,
  dispatch,
}: {
  open: boolean;
  onClose: () => void;
  state: RoomState;
  advanced: boolean;
  myId: string;
  dispatch: (action: RoomAction) => void;
}) {
  const playerCount = state.players.length;
  const [draft, setDraft] = useState<AdvancedSetup>(() => emptySetup());

  // Seed the draft each time the window opens, from the stored setup.
  const seeded = useMemo(() => {
    const stored = state.kingdom.setup;
    const values = Object.values(stored).reduce((a, b) => a + (b ?? 0), 0);
    if (!values) {
      const preset = advanced ? advancedSetupFor(playerCount) : null;
      return preset ?? emptySetup();
    }
    return {
      king: stored.king ?? 0,
      knight: stored.knight ?? 0,
      bandit: stored.bandit ?? 0,
      assassin: stored.assassin ?? 0,
      renegade: (stored.renegade ?? 0) + (stored.usurper ?? 0),
    };
  }, [advanced, playerCount, state.kingdom.setup]);

  const [touched, setTouched] = useState(false);
  const value = touched ? draft : seeded;
  const total = setupTotal(value);
  const valid = value.king === 1 && total === playerCount;

  const adjust = (family: RoleFamily, delta: number) => {
    setTouched(true);
    setDraft((current) => {
      const base = touched ? current : seeded;
      const next = { ...base };
      const cap = family === "king" ? 1 : Math.max(1, playerCount);
      next[family] = Math.max(0, Math.min(cap, base[family] + delta));
      if (family === "king") next.king = 1;
      return next;
    });
  };

  const useStandard = () => {
    setTouched(true);
    const preset = advancedSetupFor(playerCount);
    if (preset) return setDraft(preset);
    // Below five players the printed table does not apply — fall back to the
    // classic composition expressed as families.
    const classic = classicDefault(playerCount);
    setDraft({
      king: classic.king,
      knight: classic.knight,
      bandit: classic.bandit,
      assassin: classic.assassin,
      renegade: classic.usurper,
    });
  };

  const save = () => {
    dispatch({
      type: "configureRoles",
      byId: myId,
      setup: {
        king: value.king,
        knight: value.knight,
        bandit: value.bandit,
        assassin: value.assassin,
        renegade: value.renegade,
        usurper: 0,
      },
    });
    setTouched(false);
    onClose();
  };

  return (
    <Modal open={open} onClose={onClose} title={advanced ? "Advanced Kingdoms setup" : "Role setup"}>
      {advanced && (
        <p className="mb-3 text-[11px] leading-relaxed text-slate-400">
          Separate the cards into piles by family, then deal the number below at
          random. {ADVANCED_MIN_PLAYERS}–{ADVANCED_MAX_PLAYERS} players.
        </p>
      )}

      <div className="space-y-1.5">
        {ROLE_FAMILIES.map((family) => {
          const label = FAMILY_LABEL[family];
          const count = value[family as keyof AdvancedSetup] ?? 0;
          return (
            <div
              key={family}
              className="flex items-center justify-between rounded-xl border border-line bg-surface-2 px-3 py-2"
            >
              <div className="min-w-0">
                <div className="text-sm font-black" style={{ color: FAMILY_COLOUR[family] }}>
                  {label}
                </div>
                <div className="truncate text-[10px] text-slate-500">
                  {FAMILY_GOAL[family].victory}
                </div>
              </div>
              <div className="flex shrink-0 items-center gap-2">
                <button
                  onClick={() => adjust(family, -1)}
                  disabled={family === "king" || count === 0}
                  className="btn h-8 w-8 rounded-lg bg-white/5 text-white disabled:opacity-25"
                >
                  −
                </button>
                <span className="tnum w-5 text-center text-base font-black">
                  {family === "king" ? 1 : count}
                </span>
                <button
                  onClick={() => adjust(family, 1)}
                  disabled={family === "king" || count >= playerCount}
                  className="btn h-8 w-8 rounded-lg bg-white/5 text-white disabled:opacity-25"
                >
                  +
                </button>
              </div>
            </div>
          );
        })}
      </div>

      {/* Official table, as a tap-to-apply reference */}
      {advanced && (
        <div className="mt-3 rounded-xl border border-line bg-black/20 p-2">
          <div className="mb-1 text-[9px] font-black uppercase tracking-wider text-slate-500">
            Printed setup table
          </div>
          <div className="space-y-0.5">
            {Object.entries(ADVANCED_SETUP_BY_SIZE).map(([size, setup]) => {
              const active = Number(size) === playerCount;
              return (
                <div
                  key={size}
                  className={`flex items-center gap-2 rounded px-1.5 py-1 text-[10px] ${
                    active ? "bg-mana/10 text-mana" : "text-slate-500"
                  }`}
                >
                  <span className="w-6 font-black">{size}p</span>
                  <span className="flex-1">{describeSetup(setup)}</span>
                  {active && <span className="font-black uppercase">you</span>}
                </div>
              );
            })}
          </div>
        </div>
      )}

      <div
        className={`mt-3 flex items-center justify-between rounded-xl border px-3 py-2 text-[11px] font-bold ${
          valid
            ? "border-mana/30 bg-mana/10 text-mana"
            : "border-amber/30 bg-amber/10 text-amber"
        }`}
      >
        <span>
          {total} of {playerCount} seats
        </span>
        <span>
          {valid
            ? "Ready"
            : value.king !== 1
              ? "Needs exactly one King"
              : total > playerCount
                ? "Too many roles"
                : "Too few roles"}
        </span>
      </div>

      <div className="mt-3 flex gap-2">
        <button onClick={useStandard} className="btn btn-ghost flex-1 py-2.5 text-xs">
          Standard for {playerCount}
        </button>
        <button onClick={save} disabled={!valid} className="btn btn-primary flex-1 py-2.5 text-xs">
          Save
        </button>
      </div>
    </Modal>
  );
}

/* -------------------------------------------------------------------------- */

function DeclareModal({
  open,
  onClose,
  state,
  myId,
  dispatch,
}: {
  open: boolean;
  onClose: () => void;
  state: RoomState;
  myId: string;
  dispatch: (action: RoomAction) => void;
}) {
  const [picked, setPicked] = useState<string[]>([]);
  return (
    <Modal open={open} onClose={onClose} title="Declare the winner">
      <p className="mb-3 text-[11px] leading-relaxed text-slate-400">
        For cards the app cannot resolve on its own — Renegade victories, a
        Cultist who has converted enough of the table, a Straw Man who was
        eliminated first. Pick who won and the game ends for everyone.
      </p>
      <div className="space-y-1">
        {state.players.map((player) => {
          const role = state.kingdom.roles[player.id];
          const cardId = state.kingdom.cards[player.id];
          const card = cardId ? cardById(cardId) : undefined;
          const on = picked.includes(player.id);
          return (
            <button
              key={player.id}
              onClick={() =>
                setPicked((cur) =>
                  cur.includes(player.id)
                    ? cur.filter((id) => id !== player.id)
                    : [...cur, player.id],
                )
              }
              className={`flex w-full items-center gap-2 rounded-lg border px-2.5 py-2 text-left ${
                on ? "border-mana/50 bg-mana/10" : "border-line bg-surface-2"
              }`}
            >
              <span className="min-w-0 flex-1 truncate text-xs font-bold text-slate-200">
                {player.name}
              </span>
              <span className="shrink-0 text-[10px] text-slate-500">
                {card?.name ?? (role ? ROLES[role]?.name : "")}
              </span>
            </button>
          );
        })}
      </div>
      <button
        disabled={picked.length === 0}
        onClick={() => {
          dispatch({ type: "declareWinner", byId: myId, winnerIds: picked });
          setPicked([]);
          onClose();
        }}
        className="btn btn-primary mt-3 w-full py-2.5 text-xs"
      >
        End the game
      </button>
    </Modal>
  );
}
