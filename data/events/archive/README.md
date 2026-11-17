# Archived tournament events 1 to 19

Moved out of the active set on 2026-11-17, byte for byte as recorded (from `public/tournaments/`).
The state before the move is tagged `archive/events-1-19-pre-reset-2026-11-17` (commit `a284f6e`).

These events are kept as the audit trail (docs/ROADMAP.md §4, retention rule). They are not served by the site
and do not feed the power ratings, head-to-heads, Sim tiers, card impact, breeding or recommendations: every
reader of recorded events reads `public/tournaments/` only.

Their ids stay taken: `npm run tournament` numbers a new event after the highest id recorded or archived here
(`ARCHIVED_EVENTS_DIR` in `scripts/lib-node.ts`), so the active set continues at event 20. A few tests replay
games from these files (`tests/replay-events.test.ts`, `tests/watch-game.test.ts`, `tests/watch-ui.test.tsx`):
they were recorded on SIM_VERSION 9 and still replay on it.
