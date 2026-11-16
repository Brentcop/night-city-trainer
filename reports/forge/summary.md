# Forge summary

Adoption rule: evidence: stages of 224 fresh paired games up to 896; adopt when the lower bound of the paired gain is above 1 point with at least 200 games, reject when the upper bound is below it, otherwise could not tell; a nominee with no gain after 2 stages (448 games) stops early as could not tell; α = 0.05 spent over 4 looks (O'Brien–Fleming-type, z = 4.33 / 2.96 / 2.36 / 2.01); change ledger on: a nominee with held-out games from earlier runs (same simulator version, bot and field) is judged on those games first, then on them and each new stage pooled, by an always-valid boundary (normal mixture, Howard et al. 2021, ρ = 250 games, one-sided 0.025 each: z = 3.32 at 448 games, 3.11 at 896, 3.04 at 1,792, 3.06 at 3,584); screened with the Medium bot, confirmed with the Hard bot.

Result: each adopted change with its held-out paired gain (fresh games that screening never used, the same seed, opponent and seat for both lists), or "no change adopted"; a "could not tell" change was not adopted. Each generation: the list being forged, scored on that generation's own new screening games — new games every generation, so not a trend and not comparable with the held-out gain.

| Deck | Result (held-out, paired) | Each generation (its own screening games) | Games |
|---|---|---|---|
| S3-02 Mutant (RGY) | no change adopted | gen 1: 57.1% on 112 games | 672 |
| S3-03 Cross (RRR) | adopted -1 Gunpoint Diplomacy → +1 Johnny Silverhand: Never Stop Fighting (held-out +4.6 pts [+2.0, +7.2], 672 games) | gen 1: 52.7% on 112 games | 2016 |
| S3-05 Counter (RRG) | no change adopted (could not tell: -1 Memory Relapse → +1 Johnny Silverhand: Never Stop Fighting, +0.0 pts [−4.4, +4.4], 448 games; stopped early: no gain after 448 games) | gen 1: 55.4% on 112 games | 1568 |
| S3-06 Counter (RBG) | adopted -1 Chrome Reverie → +1 Johnny Silverhand: Never Stop Fighting (held-out +3.1 pts [+1.1, +5.2], 896 games) | gen 1: 41.1% on 112 games | 2464 |
| S3-07 Explorer (RRG) | no change adopted (could not tell: -1 Nadia: Fighting Through Grief → +1 Swordwise Huscle, −1.1 pts [−5.2, +3.0], 448 games; stopped early: no gain after 448 games) | gen 1: 55.4% on 112 games | 1568 |
| S3-08 Explorer (RRB) | no change adopted (could not tell: -1 Royce: Don't Call Me Simon → +1 Johnny Silverhand: Never Stop Fighting, +1.9 pts [+0.0, +3.8], 896 games) | gen 1: 52.7% on 112 games | 2464 |