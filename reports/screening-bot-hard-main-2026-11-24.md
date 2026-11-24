# A cheaper screening bot: Hard (main-phase rollouts only), 2026-11-24

docs/REVIEW_2026-11-24.md row 14, §10 B.7. The bot `hard-main` is Hard's settings (noise 0.15, deep 3, no attack
rollouts, plain mulligan, best profiles, `DEFAULT_WEIGHTS`) with `deepReactions: 0` and `sellLookahead: 0`: reactions
are one step ahead and the sold card is chosen by rule, as Medium does. It is `VARIANT_SETTINGS['hard-main']` in
`src/ai/tiers.ts` (not a tier), `HARD_MAIN_SPEC` in `scripts/agent-spec.ts`, and `--bot hard-main` in every script.

## The rule, written before any game

Adopted as the screening bot if all of:

- (a) the Spearman rank correlation of its library ranking with Hard's has a paired-bootstrap 95% lower bound of at least 0.90;
- (b) at least 8 of Hard's top 10 are in its top 10;
- (c) the BBG control family's (colour pill BBG: 7 decks) mean shift against Hard, relative to the rest of the library, is within ±3 points (point estimate);
- (d) its games take at most 0.6 of Hard's time on the same deals (the same run, back to back, 5 threads).

One change to the suggested rule, the layout: `--per 6`, not 2 or 4. The bootstrap interval of rho sits below the
point estimate (review §8). Simulating a perfect stand-in (Hard's expected results, independent game noise, the
library's rated strengths) gives a lower bound of 0.85 to 0.87 at `--per 2` (criterion (a) always fails), 0.89 to 0.92
at `--per 4` (fails about 3 times in 10) and 0.92 to 0.95 at `--per 6`. At `--per 6` a perfect stand-in still misses
(b) about 1 time in 10 (top-10 overlap 7 to 9).

## The run

`npx tsx scripts/rank-stability.ts --bots medium,hard,hard-main --decks all --per 6 --seed 61001 --boot 2000 --threads 5 --cache`:
71 decks, 29,820 deals per bot, the same deals for every bot, no game errors. Medium came along as the reference.
Wall clock on a shared machine: Medium 289 s, Hard 6,607 s, hard-main 3,755 s.

| Criterion | hard-main against Hard | Medium against Hard (same deals) | Verdict |
|---|---|---|---|
| (a) Spearman [95%] | 0.966 [0.948, 0.972] | 0.893 [0.856, 0.904] | pass |
| (b) Hard's top 10 in its top 10 | 8 (top 5: 3, top 20: 18) | 7 (3, 16) | pass, at the bar |
| (c) BBG family shift, variant minus Hard, relative to the rest | −2.4 [−3.4, −1.4] points | −10.3 [−11.6, −9.0] | pass (point); interval reaches −3.4 |
| (d) time against Hard | 0.568 (library run); 0.599 in an ABBA check on the meta decks (3 × 168 games each) | 0.044 | pass, at the bar |

Also: band letter differs for 11 of 71 decks (6 beyond noise) against Medium's 31 (22); ranks moved beyond noise 11
against 28; mean |win-rate change| 1.9 points against 4.0; the same result on the same deal 82.9% against 71.5%.
Split halves (deals 0–2 against 3–5 of each pairing): hard × hard 0.953, hard-main × hard 0.933 across halves,
disattenuated 0.983 (Medium 0.902).

Decks whose rank moved beyond the noise (Hard → hard-main): BBG Draw and Wipe 25 → 37.5; Ladder S1 #10 Jackie / Judy /
Hanako 36 → 51.5; Ladder S1 #4 V / Padre / Jackie 7 → 14 (S → A); Ladder S1 #6 Dexter / V / Reyes 14 → 18.5; BBG
Cunningham Econ 18 → 25.5 (A → B); Ladder: V / Smasher / Padre 13 → 6 (A → S); NC-02 Stormrider Stampede 28 → 17
(B → A); S1-01 Mutant 11 → 5 (A → S); S1-03 Mutant 53 → 45 (C → B); S2-03 Cross 48 → 36; S2-07 Explorer 42.5 → 27.
Hard's top 10 missing from hard-main's: Ladder S1 #4 (14th) and Discord 5k #7 (15th); in their place S1-01 Mutant and
Ladder: V / Smasher / Padre.

## What it does not fix

Where hard-main differs from Hard, it differs in Medium's direction: its per-deck error correlates 0.62 with Medium's,
and it carries about 0.7 of Hard's per-deck change from Medium (slope across decks, not corrected for noise). The
per-deck error's spread is 2.4 points (paired noise about 1.4), against Medium's 5.1. By class, relative to the rest:
bred decks +2.2 [1.5, 2.8] (Medium +2.5), the sim-ladder lists +2.6, player lists −1.7, meta −1.4. So the reaction
rollouts and the sell lookahead carry some of what Hard sees in the control decks, as the review's head-to-head
figures suggested (2.6 and 2.3 points).

It costs about 13 Medium games a game here (0.568 / 0.044), not "roughly a third of Hard": the parts removed are not
additive with the main-phase rollouts.

## Verdict

Passes all four criteria, (b) and (d) at the bar. Not yet measured, and needed before a tool's numbers can use it:
its per-game SD for paired changes (the analogues of `GATE_SD`, `DEFAULT_SD` / `HARD_SD`), how much of its gain on a
change Hard shows (the analogue of `HARD_OF_MEDIUM`), and its time ratio as a constant beside `HARD_TIME_RATIO`.
