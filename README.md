# Mana Table

A shared life counter for paper Magic. The host opens a table, reads out a
five-character code, and everyone joins from their phone browser — no app
install, no accounts.

Built for the four multiplayer formats our group actually plays:

| Format | What it tracks |
| --- | --- |
| **Commander** | 40 life, 21 commander damage per opponent, 10 poison, commander tax, energy/experience, last-one-standing |
| **Planechase** | Shared planar deck, the planar die (3 blank / 1 chaos / 2 planeswalk), chaos prompts, planar controller, planeswalk with phenomenon skipping |
| **Archenemy** | Archenemy on 40 vs the team on 20, scheme deck, ongoing vs one-shot schemes |
| **Kingdoms** | Secret roles (King, Knight, Bandit ×2, Assassin, Usurper), private role cards, asymmetric win conditions, the usurpation swap |

## Running it

```bash
npm install
npm run dev      # http://localhost:3000
```

That works with **no configuration at all**. Without database credentials the
app runs in *local mode*: rooms live in your browser and sync between tabs, so
you can open two tabs and play a full game against yourself. A badge on the
home screen tells you which mode you are in.

### Playing from separate phones

Local mode only reaches one browser. To let your mates join from their own
devices you need a shared backend. [Supabase](https://supabase.com) has a free
tier that is more than enough for a playgroup.

1. Create a project at supabase.com.
2. Open **SQL Editor**, paste the whole of [`supabase/schema.sql`](supabase/schema.sql),
   and run it. It creates one table, its policies, and registers it for Realtime.
3. Go to **Project Settings → API** and copy the project URL and the `anon`
   (or `publishable`) key.
4. Create `.env.local` from the template:

   ```bash
   cp .env.example .env.local
   ```

   ```dotenv
   NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
   NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key
   ```

5. Restart `npm run dev`. The badge should now read **Cloud rooms**.

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

**No bundled card art.** Plane and scheme images are pulled from the
[Scryfall API](https://scryfall.com/docs/api) in the browser, cached in
`localStorage` for a week, and degrade silently to text when offline. This
keeps the repository small and avoids redistributing copyrighted artwork.

```
app/
  page.tsx                 create / join a table
  room/[code]/page.tsx     server wrapper
  room/[code]/RoomClient.tsx  the table itself
components/                player tiles, sheets, per-format panels
lib/
  room/reducer.ts          the whole rules engine (pure)
  room/rules.ts            lethality and win conditions
  room/random.ts           seeded PRNG + planar die
  data/planechase.ts       85 planes and phenomena with oracle text
  data/roles.ts            Kingdoms role metadata and composition
  transport/               cloud (Supabase) and local implementations
  useRoom.ts               live room state + optimistic writes
tests/                     engine and transport tests
supabase/schema.sql        one-paste database setup
```

## Tests

```bash
npm test
```

35 tests cover the rules that are easy to get subtly wrong: commander damage
accumulating per source rather than in total, poison at exactly ten, the planar
die distribution, phenomenon skipping, role composition by table size, the
Bandit/Knight/Assassin win conditions, and a Usurper taking the throne only when
they land the killing blow themselves. The transport tests cover the
version-conflict path that two phones hit in the real world.

## Deployment

Any Node host works. `npm run build && npm start` serves the production build on
`PORT` (default 3000). Vercel needs nothing beyond the two environment
variables.

## Notes

- Room codes are five characters from a 32-character alphabet (~33 million
  combinations) and the code itself is the only access control. Fine for a
  friends' table; do not run a tournament on it.
- Abandoned rooms are not cleaned up automatically — `supabase/schema.sql`
  includes an optional `delete_stale_rooms()` helper.
- Unofficial fan project. Not affiliated with or endorsed by Wizards of the
  Coast. Card data and imagery belong to their respective owners.
