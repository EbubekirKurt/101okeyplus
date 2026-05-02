# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

```bash
npm run dev        # Start dev server at http://localhost:5173
npm run build      # tsc + vite build (always run to verify before finishing)
npx tsc -p tsconfig.app.json --noEmit   # Type-check only (faster than full build)

firebase deploy --only firestore:rules --project okey101-oyun  # Deploy Firestore rules
```

No test suite exists yet. TypeScript compilation is the primary correctness check.

**Node version constraint:** Vite 5 is pinned (not 6/7/8) because the machine runs Node 20.18 — do not upgrade vite.

## Architecture

### Stack
React 19 + TypeScript, Vite 5, Tailwind CSS v4 (via `@tailwindcss/vite` plugin — no `tailwind.config.js`), Firebase 12 (Firestore + Anonymous Auth), @dnd-kit/sortable, Framer Motion, Zustand.

### Multiplayer Model — Host-Authoritative Client
There are no Cloud Functions. The room host's browser is the authority:
- Host validates moves, writes updated `GameState` to Firestore, and drives bot turns for disconnected players.
- Other clients are read-only observers; they subscribe to `games/{id}` and `games/{id}/hands/{uid}`.
- Move history is append-only at `games/{id}/moves/{moveId}` (for audit/reconnect, not for re-driving state).

### Firestore Schema
```
rooms/{code}                   Room metadata, playerUids[], playerNames{}
rooms/{code}/chat/{id}         Chat messages
games/{gameId}                 Public GameState snapshot (see types/game.ts)
games/{gameId}/hands/{uid}     Private hand — security rule: only owner can read
games/{gameId}/moves/{id}      Append-only move log
```
`games/{gameId}` has a `version` integer for optimistic concurrency. Always increment on write.

### Game Rules (101 Okey — critical differences from regular Okey)
- **Deal**: dealer gets 22 tiles, others get 21. 1 indicator tile left face-up. ~20 tiles remain in draw pile.
- **Opening**: player must lay down melds totalling **≥ 101 points** to open (`MIN_OPEN_POINTS` constant). Alternative: 5 pairs (çift açma) using exactly 10 tiles.
- **Okey tile**: one number above the indicator, same color. Fake jokers (2 in deck) are always wildcards.
- **Tile ID format**: `"R-7-0"` (color initial, number, copy 0/1), fake jokers `"FJ-0"` / `"FJ-1"`.
- **Penalties**: threw okey = +101, can't open when game ends = +202, draw pile empties without opening = +404.
- **işlek**: if a player discards a tile someone could use, opponents can call işlek (+101 to discarder). State tracked in `game.islek`.

### Pure Game Logic (`src/lib/`)
All game logic is pure TypeScript with no Firebase imports — testable in isolation:
- `lib/engine/gameEngine.ts` — `createInitialGameState`, `getNextPlayer`, `canOpenMelds`, `canOpenFivePairs`, `calculateRoundPenalties`
- `lib/engine/deal.ts` — deterministic deal using seeded RNG
- `lib/melds/validateMeld.ts` — group/run/5-pairs validation, `totalMeldPoints`
- `lib/scoring/scoreHand.ts` — tile values, `PENALTY` constants
- `lib/rng/seeded.ts` — Mulberry32 PRNG + Fisher-Yates shuffle
- `lib/bot/botStrategy.ts` — `getBotDiscard`: scores each tile by potential in runs/groups, never discards okey/joker

### State Split
- **Firestore** (`useGame`, `useHand`, `useRoom` hooks) — shared game state, opponents' tile counts, melds on table
- **Zustand** (`src/state/store.ts`) — local UI only: `handOrder`, `selectedTileIds`. Never mirror Firestore data here.
- Hand tile *ordering* is local-only (Zustand) — not synced — to avoid write spam.

### Auth
Firebase Anonymous Auth. `displayName` and UID are also persisted to `localStorage` keys `okey101_name` / `okey101_uid` so returning users skip the register screen. `useAuth` hook restores display name from localStorage if Firebase lost it between sessions.

### Routing
`/` → `LandingPage` (register/menu/create/join)  
`/room/:code` → `RoomPage` (lobby, host starts game)  
`/game/:gameId` → `GamePage` (full game, host drives bots)

### Bot Behaviour
When a player's `connected` field is `false` (set by `beforeunload`), the host detects it on turn change (via `useEffect` on `game.version`) and fires a `setTimeout(2500)` before running `runBotTurn`. Bot always draws from pile, then calls `getBotDiscard` to pick the least-useful tile.

### UI Conventions
- CSS utility classes `.card`, `.btn-primary`, `.btn-secondary`, `.btn-ghost`, `.input`, `.spinner`, `.bg-felt` are defined in `src/index.css` — prefer these over inline Tailwind for structural components.
- Tile sizes: `xs` (28×40) `sm` (36×52) `md` (44×62) `lg` (54×76) — controlled by the `SIZE` map in `features/tile/Tile.tsx`.
- `PlayerHand` splits tiles into 2 rows (`Math.ceil(n/2)` each) for the 21-tile hand.
- Game table background is pure CSS gradients — no image assets.
