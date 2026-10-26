# Mana Table

A shared life counter for paper Magic. The host opens a table, reads out a
five-character code, and everyone joins from their phone browser — no app
install, no accounts.

The host sets the format, the **player limit** and the **starting life total**
when they create the table, and anyone who arrives late, or would rather just
watch, joins as a **spectator** — read-only, not counted toward the limit, and
visible to the host as "watching".

Built for the four multiplayer formats our group actually plays:

| Format | What it tracks |
| --- | --- |
| **Commander** | 40 life, 21 commander damage per opponent, 10 poison, commander tax, energy/experience, last-one-standing |
| **Planechase** | Shared planar deck, the planar die (3 blank / 1 chaos / 2 planeswalk), chaos prompts, planar controller, planeswalk with phenomenon skipping |
| **Archenemy** | Archenemy on 40 vs the team on 20, scheme deck, ongoing vs one-shot schemes |
| **Kingdoms** | Role setup window (choose how many of each role), secret roles dealt at random, a random class within each role, private tap-to-peek cards, asymmetric win conditions, the usurpation swap |
| **Advanced Kingdoms** | The printed 21-card set for 5–9 players: deal from the official composition table, a real role card with its art and rules, Bandit reveal, and the printed win conditions |

**Advanced Kingdoms** is the full printed expansion, not a reskin. Pick it in
the lobby and the setup window runs the official composition table — 5 players
gets one King, one Knight, two Assassins and a Renegade; 9 gets one King, two
Knights, three Bandits and three Assassins. Each player is dealt a specific card
from the printed set, so their private screen shows the actual card with its art
and wording, and the win conditions come from the reference sheet rather than
from memory.

A handful of cards (The Cultist, The Champion, The Straw Man, The Sellsword and
friends) depend on table history the app cannot see — who landed the killing
blow, what another player's card says. Those are marked *host adjudicates*: the
card is dealt and displayed, and the table finishes the job with **Call game**
rather than the app inventing a result.

Everything is editable from **`/admin`**: add planes, schemes and role classes as
new sets come out. Anything you add is dealt alongside the bundled content, and
because a running game keeps its own copy of the cards it was dealt, editing
content can never disturb a table that is mid-game.

## Running it

```bash
npm install
npm run dev      # http://localhost:3000
```

That works with **no configuration at all**, and no third-party services.
Rooms are stored on the machine running the app (`./.data/rooms` by default) and
pushed to every phone over Server-Sent Events. Nothing to sign up for, nothing
to pause for inactivity, and nothing to pay for beyond the box it runs on.

A badge on the home screen tells you which backend is active. The three
available are:

| Backend | What it does |
| --- | --- |
| **Self-hosted** (default) | Rooms on this server's disk. Play from any device. |
| **Supabase** | Rooms in a Supabase project, if you already have one. |
| **Local** | No server at all — rooms live in the browser and sync between tabs. |

Force one with `NEXT_PUBLIC_BACKEND=selfhosted|supabase|local`. Local mode is
handy for a single tablet at the table, or for working on the UI with no server
involved.

### Using Supabase instead

Set `NEXT_PUBLIC_BACKEND=supabase`, add the two keys from **Project Settings →
API** to `.env.local`, and run [`supabase/schema.sql`](supabase/schema.sql) once
in the SQL editor (it creates the table, the policies, and registers it for
Realtime).

```dotenv
NEXT_PUBLIC_BACKEND=supabase
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key
```

Worth knowing before you choose it: **Supabase pauses free projects after seven
days of low activity.** A playgroup that plays once a fortnight will find the
project asleep every time they sit down, until someone opens the dashboard and
hits Resume. That is the whole reason the self-hosted backend is the default.

> The anon key is designed to be public — row level security is what protects
> the data. Never put your `service_role` key in a `NEXT_PUBLIC_` variable.

## How it works

**One document per room.** The entire game — players, life, commander damage,
planar deck, scheme deck, roles, event log — is a single JSON object stored in
one `rooms` row. Rendering a phone is therefore just "draw this object", and
there is no partial-update state to get wrong.

**Optimistic concurrency.** Every write is
`update rooms set state = …, version = version + 1 where code = … and version = …`.
If two people tap at the same moment, exactly one write lands; the loser gets
the winner's state back, replays its own action on top of it, and retries once.
A tap is never silently dropped and the table never desyncs.

**A pure game engine.** All rules live in `lib/room/reducer.ts` as
`applyAction(state, action) → state`, with no clock, no network and no
`Math.random`. Randomness (shuffles, the planar die) is seeded and passed in,
so every phone computes the identical result and the whole engine is testable.

**Shared dice.** Die, coin and planar-die results live in the room document, so
the whole table sees the same roll instead of it existing only on the phone that
made it. Every roll can also be entered by hand — the die that went under the
sofa, the coin you flipped physically — and the log records that it was manual.

**A backend that fits in the app.** `app/api/rt/**` serves the rooms, and
`lib/server/` holds the two pieces behind it: a file store that writes each room
atomically and enforces the version compare-and-set, and an in-memory hub that
fans changes out to every open phone over SSE. No database, no ORM, no
dependency — which is what keeps a $5 VPS honest. Room data is in `DATA_DIR`
(`./.data/rooms` by default); deployments must keep that on a volume.

**An interface in between.** `lib/transport/` defines one `RoomTransport` and
three implementations — self-hosted, Supabase, and browser-local — so the UI
never learns which backend it is talking to.

**No bundled card art.** Plane and scheme images are pulled from the
[Scryfall API](https://scryfall.com/docs/api) in the browser, cached in
`localStorage` for a week, and degrade silently to text when offline. This
keeps the repository small and avoids redistributing copyrighted artwork.

```
app/
  page.tsx                 create / join a table
  admin/                   content admin: planes, schemes, role classes
  room/[code]/               the table itself
  api/rt/rooms/            the bundled backend (create, load, save, SSE)
  api/content/             custom game content for the admin panel
components/                player tiles, sheets, per-format panels
lib/
  room/reducer.ts          the whole rules engine (pure)
  room/rules.ts            lethality and win conditions
  room/random.ts           seeded PRNG + planar die
  data/planechase.ts       85 planes and phenomena with oracle text
  data/roles.ts            Kingdoms role metadata and composition
  server/                   file store (atomic writes, CAS) + SSE fan-out hub
  transport/               self-hosted, Supabase and local implementations
  useRoom.ts               live room state + optimistic writes
tests/                     engine and transport tests
supabase/schema.sql        one-paste database setup
```

## Tests

```bash
npm test
```

69 tests cover the rules that are easy to get subtly wrong: commander damage
accumulating per source rather than in total, poison at exactly ten, the planar
die distribution, phenomenon skipping, role composition by table size, the
Bandit/Knight/Assassin win conditions, a Usurper taking the throne only when
they land the killing blow themselves, seat limits refusing an extra player,
spectators never reaching the win conditions, role compositions chosen in the
setup window, and classes always matching their role. The transport and store tests
cover the version-conflict path two phones hit in the real world: ten
simultaneous writes from the same starting version, of which exactly one may
win.

## Deployment

Any Node host works. `npm run build && npm start` serves the production build on
`PORT` (default 3000). Vercel needs nothing beyond the two environment
variables.

**Measured capacity** (`npm run loadtest`, production build, 4 simultaneous
games of 8 players = 32 live connections, 20 seconds of continuous play):

```
Writes          2080 (96.8/s)
Write latency   p50 8.2ms · p95 24.5ms · max 64.4ms
Server memory   131 MB → 135 MB
Errors          0
```

Four times the load you asked for, using about 4 MB more than idle. Run the same
script against your own box before deciding you need a bigger one:

```bash
node scripts/loadtest.mjs --url http://localhost:3000 --rooms 4 --players 8
```

For a VPS, start with **[INSTALL.md](INSTALL.md)** — a numbered, copy-paste
walkthrough from a bare Ubuntu box to HTTPS. **[DEPLOY.md](DEPLOY.md)** is the
reference version. — sizing (1 vCPU / 2 GB is plenty, and
the reasoning is in there), Docker + Caddy, a plain Node + systemd install,
backups, firewall and verification steps. A `Dockerfile` and
`docker-compose.yml` are included, complete with a volume for the room data.

Two things worth repeating: keep `DATA_DIR` on a volume or a redeploy wipes the
table, and run **one** instance — live updates are fanned out from the memory of
the process that handled the write.

## Notes

- Room codes are five characters from a 32-character alphabet (~33 million
  combinations) and the code itself is the only access control. Fine for a
  friends' table; do not run a tournament on it.
- Abandoned rooms are not cleaned up automatically — `supabase/schema.sql`
  includes an optional `delete_stale_rooms()` helper.
- Unofficial fan project. Not affiliated with or endorsed by Wizards of the
  Coast. Card data and imagery belong to their respective owners.
