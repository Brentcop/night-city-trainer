# rolloutWins and the matchup profiles on Hard, 2026-11-24

docs/REVIEW_2026-11-24.md §10 C.5 and C.6 (B6). Code at cd0ee37 (4f40177 plus the per-deck sensitivity report),
SIM_VERSION 9. Measurements only: no default changed. Hard's spec is `HARD_SPEC` (scripts/agent-spec.ts):
`{"noise":0.15,"deep":3,"deepAttacks":0,"deepReactions":3,"sellLookahead":3,"mulligan":"plain","profiles":"best"}`;
each variant differs from it in one field only (checked by a key-by-key comparison). 6 threads (the per-2 report 3), a
shared machine, so the seconds are rough.

## C.5 `rolloutWins` for Hard

**Measured before?** Once, on 2026-11-12 (docs/IMPROVEMENT_BACKLOG.md, BOT-1 status; commit 9ac701c), on the hand
weights before SIM_VERSION 6: meta decks, `--per 20`, 840 pairs: Hard + rolloutWins vs Hard 49.9% [49.7, 50.0], 838 of
840 pairs split. Never on SIM_VERSION 9 or the fitted weights (no report, commit or doc says so).

**Rule, fixed before the run:** it lands only as a strength gain: the paired 95% lower bound above 50%.

`npx tsx scripts/botcheck.ts '<Hard + rolloutWins>' '<Hard>' --decks all --per 1 --threads 6 --cache` (seed 31337):
4,970 pairs, 9,940 games, 71 decks, 1,288 s.

| | |
|---|---|
| A's paired win rate | **50.23% [49.97, 50.50]** (printed [50.0, 50.5]; exact bounds recomputed with `duplicateSummary`'s formula) |
| Pairs | split 4,789, swept 181 (A 102, B 79), ties 0 |
| Per-pair SD of the difference | 0.19 (half-width ±0.3 paired, ±1.0 unpaired) |

**Verdict: does not land.** The lower bound, 49.97%, is not above 50%. The point estimate is +0.2 points, and 96% of
deals give the same result either way, as on the hand weights: the option changes few decisions, nearly all in decided
endgames.

## C.6 the matchup profiles on Hard

**Rule, fixed before the run:** drop the profiles only if Hard agrees with Medium: strength not shown worse (lower
bound at least 49.0%), decks beyond 2 SE at most twice the chance count, Spearman of the orders at least 0.98.

### Strength

`npx tsx scripts/botcheck.ts '<Hard without profiles>' '<Hard>' --decks all --per 1 --threads 6 --cache`: 4,970 pairs,
9,940 games, 1,954 s.

| | |
|---|---|
| A (no profiles) paired win rate | **50.41% [49.99, 50.83]** (printed [50.0, 50.8]) |
| Pairs | split 4,519, swept 451 (A 246, B 205), ties 0 |
| Per-pair SD of the difference | 0.30 (half-width ±0.4 paired) |

### Per deck, `--per 2` (the layout the rule is judged on)

The rule did not fix a layout. Its Medium reference (B6: 5 decks, Spearman 0.988) was a `--per 2` round robin, so
the rule is judged at `--per 2`. The `--per 1` run below came first and is kept as a record.

`npx tsx scripts/deck-sensitivity.ts '<Hard>' '<Hard without profiles>' --decks all --per 2 --threads 3 --cache`
(seed 61001): 9,940 deals a configuration, both seats changed. Base 3,766 s, change 2,716 s, on 3 threads.
The per-2 layout deals no per-1 deal again: 2 cache hits of 19,880, so these are 9,940 fresh deals.

- Decks beyond 2 SE: **3 of 71** (chance about 3.2); beyond 3 SE: **0** (chance 0.19).
  - Addin' Trash (YYY): −5.0 ± 4.4.
  - S2-04 Cross (RRG): −2.9 ± 2.7.
  - Alt + V + Del (RRB): +4.3 ± 4.3.
- Spearman of the two orders: **0.987**, paired bootstrap 95% [0.971, 0.986]. The interval sits below the point
  because resampling adds noise to both orders (review §8).
- Same result on the same deal 91.3%; mean |change| 1.4 points. The changes spread 1.8 points across decks, of which
  noise accounts for 1.8, so about 0.2 points is beyond the noise.
- No list feature is significant: the largest are Gear (r −0.20, p 0.10) and Programs (r +0.18, p 0.14). By
  archetype: aggro −0.6, midrange +0.5, control 0.0.
- Families: BBG control (7 decks) +1.1 against −0.1 for the rest, difference **+1.2 ± 1.2** (p 0.081). The other
  families are within ±0.4 points (p 0.43 to 0.93).
- A no-effect check: give each deck its base win rate plus only its paired noise (its own SE, 4,000 draws). That gives
  a Spearman with median 0.985 (5% to 95%: 0.979 to 0.990), with 91% of draws at 0.98 or more. The observed 0.987 is
  what a change with no effect gives at this layout.

### Verdict under the rule (strength from the botcheck, per deck from `--per 2`)

| Criterion | Bar | Hard | |
|---|---|---|---|
| Strength lower bound | ≥ 49.0% | 49.99% | pass |
| Decks beyond 2 SE | ≤ 2 × 3.2 = 6.4 | 3 | pass |
| Spearman of the orders | ≥ 0.98 | 0.987 (point; Medium's reference 0.988 was a point estimate too) | pass |

**Hard agrees with Medium: the profiles may be dropped**, as their own measured bump (C.6). Nothing here changes a
default. Without them Hard is not shown worse (+0.4 points, interval to −0.01). On these deals no more decks moved
than chance, and the order of the library is what a change with no effect gives. The bootstrap interval of the
Spearman, [0.971, 0.986], does not reach 0.98 at its lower end. The rule reads the point estimate, as the Medium
reference was one. The bump itself still needs its own strength botcheck, per-deck report and corpus rebuild, per
§10 C.

### Per deck, `--per 1` (the first run, superseded)

`--per 1` (seed 61001, 4,970 deals a configuration, 6 threads; base 1,048 s, change 1,032 s):

- Decks beyond 2 SE: 2 of 71, beyond 3 SE: 0.
  - Ladder S1 #10 Jackie / Judy / Hanako (BBG): +5.7 ± 4.9.
  - YYB Rogue Gear: −6.4 ± 6.2.
- Spearman 0.969, with no interval at one deal a pairing. 91.2% of deals gave the same result; mean |change| 1.9
  points.
- BBG family +2.8 ± 1.9 (p 0.003); aggroScore r −0.35 (p 0.002).

On that layout even a change with no effect cannot pass the Spearman bar: the same check gives median 0.972 (5% to
95%: 0.961 to 0.981), and only 6.8% of draws reach 0.98. So 0.969 was no evidence against the change. That is why the
rule is judged at `--per 2`.

The per-1 run's BBG and aggroScore signals did not hold at `--per 2`, on fresh deals. The BBG family fell to
+1.2 ± 1.2 (p 0.08), and aggroScore to r −0.16 (p 0.19). Read them as a weak lean at most: without the profiles the
BBG control decks do about a point better.
