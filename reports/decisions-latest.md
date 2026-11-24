# Decision telemetry

19880 games, 1826727 decisions (telemetry schema 1). Sim v9, hard bot, seed 1.

> Descriptive association only: win rates in games where a card was used a given way, with 95% Wilson intervals. They are not the value of the card or of the choice (no counterfactual comparison yet; ROADMAP §5 steps 3 and 5). A slice from fewer than 20 games shows only its count ("thin").

Stages: early turns 1–4, middle turns 5–8, late turn 9+. Ahead / even / behind: the acting player's Gig count against the rival's when the decision was made. "Not chosen": share of the turns (attacks, for reactions) in which the use was legal but not taken.

Measured: games 19880, recordsPerGame 91.9, rawBytesPerGame 60667.2, aggregateBytesPerGame 13080.2, mergedBytes 1450083, seconds 3033.7.

## Addin' Trash — 560 games, 27% won, 26883 decisions

| Card | Use | Uses | Win rate in games used (95%) | Legal turns → used | Not chosen | Early / mid / late uses | Ahead | Even | Behind |
|---|---|---|---|---|---|---|---|---|---|
| Viktor Vektor: You Might Feel a Little Pinch | attacked | 811 | 28% (24–33) n=356 | 995 → 740 | 26% | 109 / 367 / 335 | 49% (41–57) n=154 | 31% (24–39) n=138 | 18% (13–23) n=224 |
| Muamar Reyes: El Capitán | ability | 791 | 23% (19–27) n=449 | 2098 → 791 | 62% | 53 / 195 / 543 | 40% (34–46) n=224 | 15% (10–23) n=117 | 6% (3–9) n=252 |
| Trauma Team Operatives | attacked | 690 | 32% (27–37) n=323 | 743 → 642 | 14% | 0 / 194 / 496 | 56% (47–65) n=109 | 45% (35–57) n=75 | 25% (20–31) n=230 |
| Viktor Vektor: You Might Feel a Little Pinch | played | 662 | 27% (23–31) n=437 | 784 → 651 | 17% | 368 / 137 / 157 | 36% (30–42) n=223 | 27% (21–34) n=187 | 10% (6–17) n=135 |
| Augmented Negotiators | played | 598 | 28% (24–32) n=423 | 967 → 577 | 40% | 219 / 206 / 173 | 35% (29–42) n=179 | 26% (20–34) n=155 | 19% (14–26) n=173 |
| Trauma Team Operatives | played | 590 | 30% (25–34) n=410 | 775 → 579 | 25% | 23 / 349 / 218 | 41% (35–48) n=194 | 26% (18–35) n=104 | 19% (14–25) n=200 |
| Secondhand Bombus | played | 532 | 29% (25–34) n=395 | 1268 → 514 | 59% | 179 / 214 / 139 | 33% (27–39) n=251 | 27% (19–36) n=97 | 21% (15–29) n=114 |
| Mandibular Upgrade | sold | 531 | 24% (20–28) n=386 | 669 → 531 | 21% | 278 / 135 / 118 | 31% (24–38) n=179 | 24% (18–32) n=147 | 12% (7–18) n=137 |
| Cyberpsychosis | sold | 487 | 28% (23–32) n=362 | 1384 → 487 | 65% | 72 / 221 / 194 | 39% (32–47) n=151 | 32% (22–43) n=73 | 16% (12–22) n=202 |
| The Heist | sold | 467 | 26% (22–31) n=363 | 1003 → 467 | 53% | 150 / 198 / 119 | 34% (26–42) n=136 | 30% (22–38) n=124 | 14% (9–20) n=158 |
| Safety Override | sold | 461 | 26% (22–31) n=363 | 1047 → 461 | 56% | 158 / 174 / 129 | 33% (26–41) n=147 | 25% (18–34) n=112 | 17% (12–24) n=149 |
| Muamar Reyes: El Capitán | called | 425 | 25% (21–29) n=425 | 425 → 425 | 0% | 269 / 91 / 65 | 29% (24–36) n=222 | 25% (18–32) n=138 | 9% (4–19) n=65 |
| River Ward: Detective on the Hunt | called | 425 | 26% (22–30) n=425 | 425 → 425 | 0% | 257 / 104 / 64 | 34% (28–40) n=232 | 19% (13–26) n=128 | 11% (5–21) n=65 |
| River Ward: Detective on the Hunt | ability | 414 | 26% (21–31) n=288 | 2139 → 414 | 81% | 43 / 91 / 280 | 41% (33–49) n=147 | 22% (13–34) n=59 | 8% (4–13) n=132 |
| Dum Dum: Maelstrom Triggerman | called | 392 | 27% (23–31) n=392 | 392 → 392 | 0% | 247 / 81 / 64 | 33% (27–40) n=209 | 22% (16–30) n=139 | 9% (4–21) n=44 |

(30 more card uses in the JSON report.)

Legal but never taken: Safety Override (played, legal in 1060 turns).

| Decision type | Decisions | First-listed option taken | Options offered (1 / 2 / 3–5 / 6–10 / 11–20 / 21+) |
|---|---|---|---|
| main | 13692 | 13% | 0 / 760 / 3249 / 6317 / 3318 / 48 |
| react | 3189 | 61% | 0 / 1493 / 1628 / 68 / 0 / 0 |
| gig/rollIn | 2240 | 0% | 0 / 560 / 1680 / 0 / 0 / 0 |
| gig/steal | 2077 | 36% | 133 / 404 / 817 / 705 / 18 / 0 |
| gigValue/adjust | 1277 | 24% | 0 / 1 / 28 / 118 / 856 / 274 |
| unit/equip | 1223 | 74% | 85 / 293 / 771 / 74 / 0 / 0 |
| mulligan | 560 | 19% | 0 / 560 / 0 / 0 / 0 / 0 |
| mode/muamarCall | 544 | 67% | 0 / 544 / 0 / 0 / 0 / 0 |
| card/playFree | 485 | 86% | 340 / 84 / 56 / 5 / 0 / 0 |
| unit/pump | 440 | 66% | 186 / 154 / 98 / 2 / 0 / 0 |
| card/trash | 390 | 53% | 0 / 390 / 0 / 0 / 0 / 0 |
| unit/protect | 379 | 61% | 152 / 152 / 74 / 1 / 0 / 0 |
| card/defeatGear | 122 | 84% | 0 / 70 / 52 / 0 / 0 / 0 |
| card/discard | 95 | 75% | 9 / 57 / 29 / 0 / 0 / 0 |
| card/search | 85 | 85% | 41 / 34 / 10 / 0 / 0 / 0 |
| unit/sacrifice | 42 | 81% | 28 / 13 / 1 / 0 / 0 / 0 |
| yesno/playFree | 30 | 100% | 0 / 30 / 0 / 0 / 0 / 0 |
| yesno/draw | 9 | 100% | 0 / 9 / 0 / 0 / 0 / 0 |
| mode/foolOnTheHill | 3 | 33% | 0 / 3 / 0 / 0 / 0 / 0 |
| mode/rivalChoice | 1 | 0% | 0 / 1 / 0 / 0 / 0 / 0 |

Reaction windows: 2553 attacks. Reacted to 930 (deck won 25% (22–29) n=480): stole 275, stoleNothing 2, attackerGone 37, targetGone 489, bothGone 71, noneGone 56. Let 1623 resolve (25% (21–29) n=456): stole 1271, stoleNothing 22, attackerGone 9, targetGone 253, bothGone 65, noneGone 3. Choices: call 372, endReact 1954, block 587, ability 198, play 78.

## Alt + V + Del — 560 games, 42% won, 25468 decisions

| Card | Use | Uses | Win rate in games used (95%) | Legal turns → used | Not chosen | Early / mid / late uses | Ahead | Even | Behind |
|---|---|---|---|---|---|---|---|---|---|
| 6th Street Recruits | attacked | 910 | 47% (42–52) n=364 | 1095 → 812 | 26% | 87 / 355 / 468 | 73% (65–79) n=150 | 57% (48–65) n=128 | 41% (35–47) n=273 |
| V: Streetkid | attacked | 599 | 37% (32–42) n=359 | 719 → 599 | 17% | 76 / 182 / 341 | 54% (46–61) n=185 | 41% (28–56) n=46 | 27% (21–33) n=207 |
| Yorinobu Arasaka: Steel Dragon | played | 584 | 44% (40–49) n=416 | 670 → 584 | 13% | 0 / 204 / 380 | 63% (54–71) n=121 | 55% (43–66) n=69 | 36% (31–42) n=294 |
| 6th Street Recruits | played | 573 | 43% (38–48) n=411 | 909 → 566 | 38% | 332 / 123 / 118 | 52% (45–59) n=204 | 40% (33–47) n=185 | 33% (25–42) n=110 |
| Johnny Silverhand: Never Stop Fighting | attacked | 572 | 55% (49–62) n=231 | 441 → 397 | 10% | 0 / 120 / 452 | 77% (68–84) n=113 | 77% (64–87) n=53 | 46% (38–54) n=145 |
| All is Lost | sold | 548 | 44% (39–49) n=398 | 714 → 548 | 23% | 266 / 122 / 160 | 53% (46–61) n=172 | 44% (36–52) n=147 | 33% (26–41) n=150 |
| Meredith Stout: Stone Cold Corpo | attacked | 545 | 45% (39–50) n=283 | 1053 → 507 | 52% | 36 / 122 / 387 | 72% (63–79) n=117 | 50% (40–60) n=92 | 28% (22–35) n=171 |
| Yorinobu Arasaka: Steel Dragon | attacked | 513 | 54% (48–59) n=281 | 494 → 456 | 8% | 0 / 0 / 513 | 78% (69–84) n=121 | 84% (72–91) n=61 | 44% (37–51) n=180 |
| Screw: Lovelorn Fool | attacked | 490 | 48% (42–55) n=225 | 598 → 478 | 20% | 0 / 203 / 287 | 66% (57–74) n=118 | 64% (50–77) n=45 | 45% (38–53) n=150 |
| Industrial Assembly | sold | 479 | 40% (35–45) n=356 | 987 → 479 | 51% | 119 / 202 / 158 | 52% (43–60) n=126 | 39% (31–49) n=107 | 34% (27–40) n=191 |
| Meredith Stout: Stone Cold Corpo | played | 458 | 41% (36–46) n=351 | 1328 → 450 | 66% | 156 / 147 / 155 | 59% (49–68) n=105 | 39% (31–47) n=147 | 32% (25–40) n=147 |
| Alt Cunningham: Soulkiller Architect | ability | 441 | 37% (32–42) n=325 | 1771 → 441 | 75% | 5 / 42 / 394 | 65% (57–72) n=156 | 35% (23–48) n=52 | 7% (4–12) n=166 |
| Mantis Blades | sold | 438 | 41% (36–46) n=356 | 638 → 438 | 31% | 273 / 75 / 90 | 50% (42–58) n=160 | 38% (31–47) n=138 | 31% (23–41) n=100 |
| Johnny Silverhand: Rocking Renegade | called | 433 | 43% (38–47) n=433 | 433 → 433 | 0% | 156 / 154 / 123 | 53% (47–59) n=266 | 32% (22–44) n=65 | 22% (15–31) n=102 |
| Alt Cunningham: Soulkiller Architect | called | 425 | 41% (37–46) n=425 | 425 → 425 | 0% | 157 / 156 / 112 | 50% (44–56) n=280 | 31% (22–43) n=67 | 19% (12–29) n=78 |

(33 more card uses in the JSON report.)

| Decision type | Decisions | First-listed option taken | Options offered (1 / 2 / 3–5 / 6–10 / 11–20 / 21+) |
|---|---|---|---|
| main | 14697 | 9% | 0 / 1140 / 3587 / 5061 / 4620 / 289 |
| gig/steal | 2768 | 27% | 150 / 332 / 1116 / 1141 / 29 / 0 |
| gig/rollIn | 2240 | 0% | 0 / 560 / 1680 / 0 / 0 / 0 |
| react | 1844 | 68% | 0 / 1226 / 609 / 9 / 0 / 0 |
| card/search | 628 | 68% | 287 / 174 / 131 / 36 / 0 / 0 |
| gigValue/adjust | 560 | 9% | 0 / 29 / 128 / 60 / 93 / 250 |
| mulligan | 560 | 39% | 0 / 560 / 0 / 0 / 0 / 0 |
| card/playFree | 505 | 81% | 0 / 223 / 273 / 9 / 0 / 0 |
| unit/lagAttack | 310 | 83% | 48 / 81 / 176 / 5 / 0 / 0 |
| unit/defeat | 278 | 53% | 47 / 57 / 105 / 69 / 0 / 0 |
| unit/equip | 275 | 79% | 28 / 72 / 145 / 30 / 0 / 0 |
| card/playFromTrash | 221 | 65% | 96 / 88 / 35 / 2 / 0 / 0 |
| mode/mode | 208 | 100% | 0 / 0 / 208 / 0 / 0 / 0 |
| card/freePlay | 142 | 84% | 0 / 56 / 81 / 5 / 0 / 0 |
| unit/pump | 60 | 78% | 34 / 14 / 11 / 1 / 0 / 0 |
| unit/sacrifice | 48 | 83% | 31 / 9 / 7 / 1 / 0 / 0 |
| card/discard | 45 | 49% | 6 / 8 / 26 / 5 / 0 / 0 |
| card/defeat | 40 | 93% | 32 / 6 / 2 / 0 / 0 / 0 |
| yesno/draw | 31 | 100% | 0 / 31 / 0 / 0 / 0 / 0 |
| mode/foolOnTheHill | 5 | 60% | 0 / 5 / 0 / 0 / 0 / 0 |
| mode/rivalChoice | 3 | 0% | 0 / 3 / 0 / 0 / 0 / 0 |

Reaction windows: 1681 attacks. Reacted to 533 (deck won 38% (33–43) n=362): stole 205, stoleNothing 3, attackerGone 13, targetGone 289, bothGone 23. Let 1148 resolve (45% (40–50) n=410): stole 806, stoleNothing 11, attackerGone 8, targetGone 295, bothGone 28. Choices: endReact 1256, call 300, block 277, play 11.

## BBG Cunningham Econ — 560 games, 53% won, 27741 decisions

| Card | Use | Uses | Win rate in games used (95%) | Legal turns → used | Not chosen | Early / mid / late uses | Ahead | Even | Behind |
|---|---|---|---|---|---|---|---|---|---|
| Jacked-In Voodoo Boy | played | 678 | 55% (51–60) n=444 | 994 → 634 | 36% | 280 / 205 / 193 | 63% (57–68) n=304 | 42% (34–51) n=133 | 29% (21–39) n=86 |
| Jacked-In Voodoo Boy | attacked | 664 | 57% (51–62) n=326 | 649 → 572 | 12% | 70 / 253 / 341 | 70% (64–76) n=226 | 47% (37–58) n=85 | 34% (26–42) n=122 |
| Alt Cunningham: Soulkiller Architect | ability | 640 | 47% (42–52) n=393 | 1761 → 629 | 64% | 5 / 167 / 468 | 63% (57–69) n=257 | 42% (31–54) n=71 | 18% (13–24) n=173 |
| Psycho Squad | attacked | 568 | 56% (50–62) n=275 | 629 → 537 | 15% | 59 / 254 / 255 | 65% (58–72) n=173 | 51% (41–61) n=88 | 48% (39–57) n=118 |
| Pepe Najarro: Working Doubles | attacked | 568 | 55% (49–61) n=265 | 631 → 538 | 15% | 66 / 249 / 253 | 69% (61–76) n=154 | 60% (50–69) n=99 | 44% (36–53) n=122 |
| Floor It | sold | 525 | 51% (46–56) n=385 | 847 → 525 | 38% | 234 / 131 / 160 | 62% (55–69) n=186 | 45% (37–53) n=156 | 39% (30–48) n=114 |
| Hanako Arasaka: Daughter of the Emperor | ability | 506 | 40% (35–46) n=335 | 1781 → 506 | 72% | 8 / 137 / 361 | 60% (53–67) n=182 | 32% (22–44) n=69 | 14% (10–21) n=160 |
| Peace Offering | sold | 483 | 54% (49–59) n=366 | 827 → 483 | 42% | 226 / 109 / 148 | 65% (58–71) n=192 | 50% (42–58) n=145 | 35% (26–45) n=92 |
| Chrome Reverie | sold | 476 | 55% (49–60) n=355 | 857 → 476 | 44% | 220 / 120 / 136 | 64% (58–70) n=225 | 45% (36–55) n=104 | 39% (29–49) n=83 |
| Trust No One | sold | 458 | 53% (48–58) n=357 | 795 → 458 | 42% | 201 / 108 / 149 | 60% (53–67) n=168 | 50% (41–58) n=139 | 46% (36–56) n=94 |
| Mox Inciters | played | 453 | 52% (47–57) n=362 | 941 → 432 | 54% | 74 / 210 / 169 | 65% (59–71) n=213 | 39% (29–49) n=85 | 32% (23–41) n=98 |
| Psycho Squad | played | 451 | 55% (50–60) n=365 | 677 → 442 | 35% | 173 / 132 / 146 | 69% (62–75) n=199 | 44% (35–52) n=128 | 37% (27–48) n=73 |
| Pepe Najarro: Working Doubles | played | 448 | 52% (47–57) n=358 | 725 → 440 | 39% | 169 / 127 / 152 | 59% (52–66) n=195 | 48% (40–57) n=126 | 28% (19–38) n=80 |
| Alt Cunningham: Soulkiller Architect | called | 419 | 53% (49–58) n=419 | 419 → 419 | 0% | 158 / 208 / 53 | 59% (54–65) n=301 | 44% (33–55) n=78 | 30% (18–45) n=40 |
| Hanako Arasaka: Daughter of the Emperor | called | 419 | 55% (50–60) n=419 | 419 → 419 | 0% | 142 / 216 / 61 | 61% (55–66) n=306 | 37% (27–48) n=73 | 43% (29–58) n=40 |

(28 more card uses in the JSON report.)

| Decision type | Decisions | First-listed option taken | Options offered (1 / 2 / 3–5 / 6–10 / 11–20 / 21+) |
|---|---|---|---|
| main | 13519 | 6% | 0 / 1183 / 3352 / 5794 / 3134 / 56 |
| gig/steal | 2340 | 36% | 196 / 551 / 1055 / 528 / 10 / 0 |
| gig/rollIn | 2240 | 100% | 0 / 560 / 1680 / 0 / 0 / 0 |
| gigValue/adjust | 1346 | 19% | 0 / 36 / 340 / 549 / 368 / 53 |
| react | 1342 | 56% | 0 / 901 / 433 / 8 / 0 / 0 |
| unit/bottomdeck | 1112 | 79% | 741 / 199 / 167 / 5 / 0 / 0 |
| card/search | 874 | 57% | 0 / 186 / 688 / 0 / 0 / 0 |
| card/discard | 858 | 51% | 135 / 335 / 369 / 19 / 0 / 0 |
| mulligan | 560 | 19% | 0 / 560 / 0 / 0 / 0 / 0 |
| gig/swapGive | 506 | 38% | 16 / 35 / 256 / 197 / 2 / 0 |
| gig/swapTake | 506 | 30% | 36 / 57 / 229 / 179 / 5 / 0 |
| card/playFromTrash | 445 | 64% | 182 / 142 / 114 / 7 / 0 / 0 |
| unit/mustAttack | 360 | 67% | 174 / 109 / 77 / 0 / 0 / 0 |
| card/freePlay | 297 | 60% | 0 / 69 / 190 / 36 / 2 / 0 |
| yesno/discardFor | 286 | 100% | 0 / 286 / 0 / 0 / 0 / 0 |
| unit/ready | 258 | 100% | 0 / 168 / 90 / 0 / 0 / 0 |
| unit/weaken | 258 | 68% | 102 / 86 / 70 / 0 / 0 / 0 |
| gigValue/setGig | 183 | 18% | 0 / 3 / 14 / 23 / 34 / 109 |
| unit/cantAttack | 175 | 55% | 58 / 64 / 52 / 1 / 0 / 0 |
| mode/mode | 133 | 90% | 0 / 14 / 119 / 0 / 0 / 0 |
| unit/call | 71 | 100% | 0 / 39 / 32 / 0 / 0 / 0 |
| unit/sacrifice | 57 | 95% | 49 / 6 / 2 / 0 / 0 / 0 |
| yesno/draw | 7 | 100% | 0 / 7 / 0 / 0 / 0 / 0 |
| card/discardForNothing | 4 | 0% | 0 / 0 / 4 / 0 / 0 / 0 |
| mode/foolOnTheHill | 4 | 75% | 0 / 4 / 0 / 0 / 0 / 0 |

Reaction windows: 1194 attacks. Reacted to 520 (deck won 49% (44–54) n=364): stole 195, stoleNothing 2, attackerGone 4, targetGone 300, bothGone 18, noneGone 1. Let 674 resolve (48% (42–54) n=285): stole 454, stoleNothing 1, attackerGone 2, targetGone 188, bothGone 29. Choices: call 289, block 265, endReact 751, play 37.

## BBG Draw and Wipe — 560 games, 55% won, 29923 decisions

| Card | Use | Uses | Win rate in games used (95%) | Legal turns → used | Not chosen | Early / mid / late uses | Ahead | Even | Behind |
|---|---|---|---|---|---|---|---|---|---|
| Jacked-In Voodoo Boy | played | 832 | 55% (51–60) n=492 | 1155 → 757 | 34% | 386 / 208 / 238 | 70% (64–75) n=287 | 42% (35–48) n=207 | 20% (14–29) n=109 |
| Jacked-In Voodoo Boy | attacked | 808 | 57% (52–62) n=360 | 755 → 686 | 9% | 127 / 327 / 354 | 71% (65–76) n=235 | 57% (48–65) n=123 | 30% (23–38) n=150 |
| Maman Brigitte: Spirit of Death | played | 646 | 54% (49–59) n=449 | 1118 → 638 | 43% | 221 / 219 / 206 | 67% (61–73) n=246 | 52% (44–60) n=158 | 34% (27–43) n=132 |
| Maman Brigitte: Spirit of Death | attacked | 605 | 58% (53–64) n=330 | 703 → 563 | 20% | 0 / 276 / 329 | 76% (69–82) n=179 | 65% (56–74) n=101 | 39% (31–47) n=140 |
| Peace Offering | sold | 605 | 55% (51–60) n=417 | 901 → 605 | 33% | 290 / 144 / 171 | 69% (62–75) n=204 | 50% (43–58) n=167 | 39% (31–48) n=120 |
| Delamain: Rideshare AI | played | 590 | 52% (47–57) n=411 | 1555 → 553 | 64% | 143 / 219 / 228 | 68% (62–74) n=224 | 44% (36–53) n=140 | 25% (18–34) n=114 |
| Lizzy Wizzy: Delicate Weapon | played | 536 | 53% (48–58) n=398 | 1604 → 527 | 67% | 30 / 241 / 265 | 66% (59–72) n=204 | 53% (43–62) n=102 | 36% (29–43) n=163 |
| Chrome Reverie | sold | 515 | 55% (50–60) n=392 | 855 → 515 | 40% | 263 / 97 / 155 | 71% (64–77) n=187 | 50% (42–58) n=151 | 32% (23–41) n=101 |
| Trust No One | sold | 510 | 57% (52–62) n=372 | 838 → 510 | 39% | 195 / 115 / 200 | 70% (63–77) n=171 | 55% (47–63) n=134 | 39% (31–48) n=127 |
| Nocturne OP55 N1 | sold | 472 | 55% (49–60) n=363 | 1084 → 472 | 56% | 153 / 150 / 169 | 71% (64–77) n=173 | 54% (45–63) n=105 | 30% (22–38) n=132 |
| Jackie Welles: Pour One Out For Me | called | 459 | 54% (50–59) n=459 | 459 → 459 | 0% | 164 / 234 / 61 | 66% (60–71) n=262 | 45% (37–53) n=136 | 26% (17–38) n=61 |
| Judy Álvarez: Braindance Maestro | ability | 449 | 51% (46–57) n=336 | 1793 → 449 | 75% | 20 / 137 / 292 | 73% (66–78) n=212 | 30% (20–44) n=53 | 13% (8–20) n=123 |
| Placide: Voodoo Sentinel | played | 441 | 51% (46–56) n=375 | 541 → 441 | 18% | 0 / 0 / 441 | 85% (78–90) n=143 | 60% (47–72) n=55 | 26% (20–32) n=204 |
| Judy Álvarez: Braindance Maestro | called | 431 | 58% (53–62) n=431 | 431 → 431 | 0% | 158 / 226 / 47 | 70% (64–75) n=255 | 44% (35–53) n=118 | 33% (22–46) n=58 |
| Hanako Arasaka: Daughter of the Emperor | called | 427 | 53% (48–58) n=427 | 427 → 427 | 0% | 140 / 235 / 52 | 65% (59–71) n=250 | 37% (29–46) n=120 | 33% (22–46) n=57 |

(24 more card uses in the JSON report.)

| Decision type | Decisions | First-listed option taken | Options offered (1 / 2 / 3–5 / 6–10 / 11–20 / 21+) |
|---|---|---|---|
| main | 14080 | 9% | 0 / 1120 / 3466 / 5719 / 3585 / 190 |
| gig/rollIn | 2240 | 100% | 0 / 560 / 1680 / 0 / 0 / 0 |
| gig/steal | 2221 | 31% | 204 / 355 / 958 / 694 / 10 / 0 |
| gigValue/adjust | 1667 | 22% | 0 / 49 / 565 / 671 / 325 / 57 |
| unit/bottomdeck | 1407 | 71% | 798 / 300 / 302 / 7 / 0 / 0 |
| card/discard | 1367 | 50% | 155 / 463 / 657 / 92 / 0 / 0 |
| card/search | 1139 | 58% | 0 / 244 / 895 / 0 / 0 / 0 |
| unit/pump | 980 | 53% | 208 / 291 / 456 / 25 / 0 / 0 |
| react | 839 | 54% | 0 / 655 / 184 / 0 / 0 / 0 |
| gig/swapGive | 646 | 34% | 26 / 27 / 353 / 239 / 1 / 0 |
| gig/swapTake | 606 | 37% | 75 / 95 / 264 / 164 / 8 / 0 |
| mulligan | 560 | 41% | 0 / 560 / 0 / 0 / 0 / 0 |
| card/freePlay | 507 | 59% | 0 / 132 / 318 / 56 / 1 / 0 |
| yesno/discardFor | 417 | 100% | 0 / 417 / 0 / 0 / 0 / 0 |
| yesno/addToHand | 277 | 100% | 0 / 277 / 0 / 0 / 0 / 0 |
| unit/weaken | 184 | 67% | 94 / 56 / 32 / 2 / 0 / 0 |
| unit/cantAttack | 178 | 67% | 79 / 59 / 40 / 0 / 0 / 0 |
| mode/mode | 174 | 91% | 0 / 17 / 157 / 0 / 0 / 0 |
| gigValue/setGig | 151 | 19% | 0 / 2 / 8 / 16 / 19 / 106 |
| unit/spend | 96 | 63% | 43 / 32 / 20 / 1 / 0 / 0 |
| unit/call | 87 | 100% | 0 / 46 / 41 / 0 / 0 / 0 |
| unit/sacrifice | 45 | 96% | 31 / 7 / 6 / 1 / 0 / 0 |
| card/discardForNothing | 30 | 0% | 0 / 6 / 20 / 4 / 0 / 0 |
| yesno/draw | 19 | 100% | 0 / 19 / 0 / 0 / 0 / 0 |
| mode/foolOnTheHill | 6 | 50% | 0 / 6 / 0 / 0 / 0 / 0 |

Reaction windows: 796 attacks. Reacted to 366 (deck won 47% (42–53) n=290): stole 141, stoleNothing 1, targetGone 218, bothGone 6. Let 430 resolve (48% (42–54) n=236): stole 293, attackerGone 1, targetGone 131, bothGone 5. Choices: call 189, endReact 452, block 198.

## Discord 5k #1: Smasher / River / Reyes (RYY) — 560 games, 50% won, 25914 decisions

| Card | Use | Uses | Win rate in games used (95%) | Legal turns → used | Not chosen | Early / mid / late uses | Ahead | Even | Behind |
|---|---|---|---|---|---|---|---|---|---|
| Johnny Silverhand: Never Stop Fighting | attacked | 730 | 61% (55–67) n=284 | 551 → 494 | 10% | 0 / 170 / 560 | 83% (77–88) n=167 | 71% (59–81) n=59 | 44% (36–52) n=147 |
| Meredith Stout: Stone Cold Corpo | played | 561 | 48% (43–53) n=415 | 999 → 547 | 45% | 169 / 202 / 190 | 62% (55–68) n=220 | 36% (28–44) n=135 | 31% (23–39) n=124 |
| Muamar Reyes: El Capitán | ability | 554 | 41% (36–47) n=348 | 1629 → 554 | 66% | 43 / 88 / 423 | 62% (55–68) n=206 | 17% (10–27) n=75 | 12% (8–18) n=154 |
| Safety Override | sold | 540 | 49% (44–54) n=401 | 940 → 540 | 43% | 224 / 187 / 129 | 62% (56–69) n=202 | 39% (32–47) n=157 | 29% (22–38) n=112 |
| Secondhand Bombus | played | 493 | 46% (41–51) n=369 | 1436 → 471 | 67% | 89 / 212 / 192 | 58% (52–64) n=238 | 33% (24–45) n=72 | 25% (18–34) n=108 |
| Johnny Silverhand: Never Stop Fighting | played | 492 | 54% (49–59) n=379 | 855 → 492 | 42% | 0 / 299 / 193 | 71% (64–77) n=186 | 39% (29–51) n=71 | 36% (29–44) n=161 |
| Zetatech Faceplate | sold | 455 | 49% (44–54) n=352 | 1193 → 455 | 62% | 91 / 219 / 145 | 61% (54–68) n=183 | 45% (36–55) n=95 | 37% (29–46) n=120 |
| Adam Smasher: Ender of Legends | called | 443 | 50% (45–55) n=443 | 443 → 443 | 0% | 181 / 147 / 115 | 61% (55–66) n=286 | 36% (27–46) n=94 | 22% (14–34) n=63 |
| Meredith Stout: Stone Cold Corpo | attacked | 436 | 50% (44–56) n=249 | 700 → 421 | 40% | 42 / 137 / 257 | 73% (65–80) n=145 | 41% (31–52) n=82 | 23% (16–33) n=90 |
| Dexter DeShawn: One Last Chance | attacked | 432 | 54% (47–60) n=222 | 578 → 407 | 30% | 51 / 190 / 191 | 65% (56–72) n=127 | 56% (45–67) n=78 | 47% (38–57) n=99 |
| River Ward: Detective on the Hunt | called | 412 | 49% (44–54) n=412 | 412 → 412 | 0% | 175 / 142 / 95 | 58% (53–64) n=272 | 33% (24–44) n=79 | 26% (17–38) n=61 |
| Muamar Reyes: El Capitán | called | 401 | 49% (44–54) n=401 | 401 → 401 | 0% | 171 / 148 / 82 | 61% (55–67) n=254 | 30% (22–41) n=82 | 23% (15–35) n=65 |
| Mantis Blades | sold | 392 | 50% (44–55) n=327 | 676 → 392 | 42% | 213 / 82 / 97 | 63% (56–70) n=178 | 37% (28–47) n=103 | 29% (20–41) n=69 |
| Mandibular Upgrade | sold | 390 | 47% (42–53) n=327 | 431 → 390 | 10% | 222 / 70 / 98 | 61% (53–68) n=157 | 39% (31–48) n=133 | 30% (20–42) n=61 |
| River Ward: Detective on the Hunt | ability | 389 | 45% (40–51) n=286 | 1631 → 389 | 76% | 17 / 114 / 258 | 66% (59–73) n=167 | 30% (19–45) n=46 | 16% (11–24) n=117 |

(34 more card uses in the JSON report.)

| Decision type | Decisions | First-listed option taken | Options offered (1 / 2 / 3–5 / 6–10 / 11–20 / 21+) |
|---|---|---|---|
| main | 13887 | 10% | 0 / 1054 / 3540 / 6297 / 2946 / 50 |
| gig/steal | 2373 | 36% | 191 / 455 / 1051 / 665 / 11 / 0 |
| gig/rollIn | 2240 | 0% | 0 / 560 / 1680 / 0 / 0 / 0 |
| react | 2108 | 66% | 0 / 1134 / 963 / 11 / 0 / 0 |
| gigValue/adjust | 1600 | 24% | 0 / 1 / 120 / 279 / 942 / 258 |
| unit/equip | 946 | 78% | 195 / 220 / 480 / 51 / 0 / 0 |
| mulligan | 560 | 17% | 0 / 560 / 0 / 0 / 0 / 0 |
| mode/muamarCall | 501 | 67% | 0 / 501 / 0 / 0 / 0 / 0 |
| unit/defeat | 393 | 52% | 120 / 77 / 181 / 15 / 0 / 0 |
| unit/protect | 334 | 44% | 91 / 138 / 103 / 2 / 0 / 0 |
| card/search | 279 | 80% | 0 / 151 / 120 / 7 / 1 / 0 |
| card/trash | 226 | 52% | 0 / 226 / 0 / 0 / 0 / 0 |
| card/playFree | 217 | 93% | 173 / 37 / 7 / 0 / 0 / 0 |
| unit/sacrifice | 206 | 60% | 82 / 75 / 49 / 0 / 0 / 0 |
| card/discard | 34 | 71% | 12 / 10 / 12 / 0 / 0 / 0 |
| yesno/draw | 5 | 100% | 0 / 5 / 0 / 0 / 0 / 0 |
| mode/rivalChoice | 3 | 0% | 0 / 3 / 0 / 0 / 0 / 0 |
| mode/foolOnTheHill | 2 | 50% | 0 / 2 / 0 / 0 / 0 / 0 |

Reaction windows: 1783 attacks. Reacted to 582 (deck won 39% (34–44) n=361): stole 171, stoleNothing 1, attackerGone 21, targetGone 324, bothGone 26, noneGone 39. Let 1201 resolve (43% (38–48) n=412): stole 888, stoleNothing 11, attackerGone 4, targetGone 261, bothGone 35, noneGone 2. Choices: endReact 1381, block 376, call 269, ability 64, play 18.

## Discord 5k #2: Jackie / Alt / Hanako (BBG) — 560 games, 54% won, 28599 decisions

| Card | Use | Uses | Win rate in games used (95%) | Legal turns → used | Not chosen | Early / mid / late uses | Ahead | Even | Behind |
|---|---|---|---|---|---|---|---|---|---|
| Pepe Najarro: Working Doubles | attacked | 975 | 60% (55–65) n=363 | 989 → 852 | 14% | 107 / 395 / 473 | 74% (68–79) n=247 | 53% (45–61) n=139 | 45% (37–53) n=160 |
| Alt Cunningham: Soulkiller Architect | ability | 917 | 49% (45–54) n=475 | 1757 → 885 | 50% | 10 / 194 / 713 | 63% (58–68) n=338 | 41% (32–51) n=99 | 12% (8–17) n=225 |
| Jacked-In Voodoo Boy | attacked | 846 | 56% (51–61) n=379 | 832 → 710 | 15% | 79 / 265 / 502 | 68% (63–74) n=263 | 60% (51–69) n=103 | 31% (24–39) n=147 |
| Jacked-In Voodoo Boy | played | 773 | 54% (49–58) n=467 | 1058 → 712 | 33% | 300 / 235 / 238 | 63% (57–68) n=320 | 43% (36–51) n=150 | 24% (16–34) n=84 |
| Pepe Najarro: Working Doubles | played | 724 | 54% (50–59) n=452 | 985 → 710 | 28% | 265 / 226 / 233 | 67% (61–72) n=260 | 49% (42–56) n=191 | 26% (19–35) n=107 |
| Maman Brigitte: Spirit of Death | played | 685 | 55% (50–59) n=451 | 928 → 682 | 27% | 216 / 200 / 269 | 66% (61–72) n=265 | 48% (40–55) n=162 | 33% (25–41) n=120 |
| Maman Brigitte: Spirit of Death | attacked | 682 | 59% (54–64) n=358 | 765 → 617 | 19% | 0 / 311 / 371 | 73% (67–78) n=225 | 63% (54–71) n=118 | 35% (27–44) n=115 |
| Hanako Arasaka: Daughter of the Emperor | ability | 599 | 39% (34–44) n=354 | 1698 → 599 | 65% | 5 / 144 / 450 | 54% (48–61) n=223 | 29% (19–41) n=66 | 8% (5–13) n=187 |
| Floor It | sold | 468 | 50% (45–55) n=361 | 886 → 468 | 47% | 193 / 130 / 145 | 63% (56–70) n=186 | 43% (35–52) n=136 | 27% (19–37) n=89 |
| Riot Shield | sold | 444 | 54% (49–59) n=355 | 509 → 444 | 13% | 220 / 78 / 146 | 68% (61–74) n=185 | 48% (40–57) n=133 | 30% (22–41) n=82 |
| Alt Cunningham: Soulkiller Architect | called | 432 | 54% (49–59) n=432 | 432 → 432 | 0% | 144 / 222 / 66 | 63% (57–68) n=307 | 42% (32–53) n=76 | 18% (10–31) n=49 |
| Jackie Welles: Pour One Out For Me | called | 426 | 57% (52–61) n=426 | 426 → 426 | 0% | 149 / 208 / 69 | 63% (57–68) n=297 | 46% (36–56) n=90 | 36% (23–52) n=39 |
| Les Élémens | played | 425 | 59% (54–64) n=318 | 935 → 422 | 55% | 94 / 167 / 164 | 72% (65–78) n=186 | 61% (52–70) n=101 | 31% (23–42) n=86 |
| Hanako Arasaka: Daughter of the Emperor | called | 421 | 55% (50–59) n=421 | 421 → 421 | 0% | 138 / 213 / 70 | 62% (56–67) n=298 | 42% (32–53) n=79 | 27% (16–42) n=44 |
| Trust No One | sold | 408 | 52% (47–58) n=332 | 808 → 408 | 50% | 159 / 103 / 146 | 62% (54–69) n=161 | 55% (46–64) n=121 | 23% (15–33) n=84 |

(28 more card uses in the JSON report.)

Legal but never taken: Maman Brigitte: Spirit of Death (reaction, legal in 7 turns).

| Decision type | Decisions | First-listed option taken | Options offered (1 / 2 / 3–5 / 6–10 / 11–20 / 21+) |
|---|---|---|---|
| main | 14162 | 7% | 0 / 1045 / 3553 / 6049 / 3396 / 119 |
| gig/steal | 2332 | 40% | 249 / 551 / 1061 / 465 / 6 / 0 |
| gig/rollIn | 2240 | 100% | 0 / 560 / 1680 / 0 / 0 / 0 |
| unit/bottomdeck | 1174 | 83% | 877 / 193 / 102 / 2 / 0 / 0 |
| card/search | 1057 | 57% | 0 / 234 / 823 / 0 / 0 / 0 |
| card/discard | 1043 | 43% | 153 / 317 / 534 / 37 / 2 / 0 |
| gigValue/adjust | 955 | 24% | 0 / 29 / 225 / 333 / 304 / 64 |
| react | 861 | 49% | 0 / 507 / 349 / 5 / 0 / 0 |
| card/playFromTrash | 736 | 53% | 210 / 214 / 271 / 41 / 0 / 0 |
| gig/swapGive | 599 | 37% | 21 / 44 / 298 / 235 / 1 / 0 |
| gig/swapTake | 599 | 29% | 32 / 70 / 258 / 231 / 8 / 0 |
| mulligan | 560 | 30% | 0 / 560 / 0 / 0 / 0 / 0 |
| yesno/discardFor | 518 | 99% | 0 / 518 / 0 / 0 / 0 / 0 |
| unit/ready | 352 | 100% | 0 / 245 / 107 / 0 / 0 / 0 |
| unit/weaken | 302 | 69% | 113 / 93 / 96 / 0 / 0 / 0 |
| mode/mode | 285 | 91% | 0 / 26 / 259 / 0 / 0 / 0 |
| gigValue/setGig | 243 | 13% | 0 / 5 / 12 / 22 / 40 / 164 |
| unit/adrenaline | 188 | 66% | 86 / 63 / 39 / 0 / 0 / 0 |
| unit/cantAttack | 158 | 59% | 56 / 55 / 47 / 0 / 0 / 0 |
| unit/stealMod | 97 | 70% | 22 / 37 / 37 / 1 / 0 / 0 |
| unit/sacrifice | 51 | 92% | 39 / 7 / 5 / 0 / 0 / 0 |
| unit/call | 48 | 100% | 0 / 18 / 30 / 0 / 0 / 0 |
| unit/equip | 31 | 77% | 1 / 2 / 20 / 8 / 0 / 0 |
| yesno/draw | 6 | 100% | 0 / 6 / 0 / 0 / 0 / 0 |
| mode/foolOnTheHill | 2 | 100% | 0 / 2 / 0 / 0 / 0 / 0 |

Reaction windows: 776 attacks. Reacted to 381 (deck won 44% (39–50) n=312): stole 216, stoleNothing 75, attackerGone 3, targetGone 84, bothGone 3. Let 395 resolve (40% (33–47) n=200): stole 293, targetGone 98, bothGone 4. Choices: call 279, endReact 424, play 151, block 7.

## Discord 5k #3: Smasher / River / Viktor (RYY) — 560 games, 56% won, 26565 decisions

| Card | Use | Uses | Win rate in games used (95%) | Legal turns → used | Not chosen | Early / mid / late uses | Ahead | Even | Behind |
|---|---|---|---|---|---|---|---|---|---|
| Johnny Silverhand: Never Stop Fighting | attacked | 761 | 71% (66–76) n=277 | 539 → 499 | 7% | 0 / 124 / 637 | 88% (82–92) n=165 | 78% (67–87) n=65 | 58% (50–66) n=151 |
| Meredith Stout: Stone Cold Corpo | played | 571 | 57% (52–62) n=418 | 1129 → 560 | 50% | 205 / 189 / 177 | 70% (63–75) n=223 | 49% (41–56) n=166 | 41% (32–50) n=115 |
| MaxTac Suppression Team | attacked | 508 | 65% (59–71) n=227 | 566 → 494 | 13% | 0 / 217 / 291 | 80% (73–86) n=149 | 77% (65–86) n=57 | 54% (44–63) n=110 |
| Zetatech Faceplate | sold | 486 | 58% (53–63) n=358 | 1477 → 486 | 67% | 78 / 200 / 208 | 67% (60–73) n=188 | 55% (44–65) n=84 | 46% (38–54) n=145 |
| Meredith Stout: Stone Cold Corpo | attacked | 476 | 58% (52–64) n=251 | 758 → 457 | 40% | 55 / 164 / 257 | 73% (66–79) n=164 | 51% (40–61) n=89 | 38% (29–49) n=89 |
| Johnny Silverhand: Never Stop Fighting | played | 468 | 60% (55–65) n=377 | 990 → 468 | 53% | 0 / 249 / 219 | 76% (69–82) n=187 | 49% (36–62) n=55 | 48% (40–55) n=172 |
| Mantis Blades | sold | 449 | 55% (50–60) n=349 | 740 → 449 | 39% | 236 / 89 / 124 | 66% (59–73) n=178 | 52% (43–61) n=125 | 36% (27–46) n=94 |
| Adam Smasher: Ender of Legends | called | 448 | 56% (51–61) n=448 | 448 → 448 | 0% | 182 / 128 / 138 | 66% (61–71) n=284 | 44% (35–54) n=95 | 30% (21–42) n=69 |
| Arasaka Emergency Radioport | sold | 432 | 54% (49–59) n=345 | 893 → 432 | 52% | 135 / 142 / 155 | 66% (58–73) n=155 | 52% (43–62) n=101 | 39% (31–48) n=127 |
| River Ward: Detective on the Hunt | called | 420 | 58% (54–63) n=420 | 429 → 420 | 2% | 169 / 154 / 97 | 65% (59–70) n=283 | 52% (41–62) n=81 | 34% (23–47) n=56 |
| Adam Smasher: Ender of Legends | attacked | 416 | 55% (50–60) n=318 | 445 → 416 | 7% | 0 / 0 / 416 | 85% (78–90) n=145 | 73% (60–83) n=59 | 28% (21–35) n=167 |
| Mandibular Upgrade | sold | 411 | 56% (50–61) n=333 | 465 → 411 | 12% | 207 / 91 / 113 | 66% (59–73) n=176 | 46% (38–56) n=114 | 46% (35–57) n=76 |
| Viktor Vektor: Sit Down and Relax | called | 402 | 56% (51–61) n=402 | 410 → 402 | 2% | 157 / 148 / 97 | 67% (61–73) n=255 | 39% (29–50) n=80 | 34% (24–46) n=67 |
| Sketchy Ripper | played | 394 | 53% (47–58) n=327 | 700 → 386 | 45% | 219 / 62 / 113 | 68% (61–74) n=190 | 34% (26–44) n=116 | 26% (15–40) n=47 |
| River Ward: Detective on the Hunt | ability | 384 | 55% (49–61) n=269 | 1610 → 384 | 76% | 25 / 121 / 238 | 71% (64–77) n=175 | 29% (18–43) n=48 | 32% (24–41) n=107 |

(39 more card uses in the JSON report.)

| Decision type | Decisions | First-listed option taken | Options offered (1 / 2 / 3–5 / 6–10 / 11–20 / 21+) |
|---|---|---|---|
| main | 14144 | 9% | 0 / 1125 / 3720 / 6199 / 3026 / 74 |
| gig/steal | 2731 | 35% | 219 / 472 / 1170 / 859 / 11 / 0 |
| gig/rollIn | 2240 | 0% | 0 / 560 / 1680 / 0 / 0 / 0 |
| react | 1917 | 63% | 0 / 1145 / 757 / 15 / 0 / 0 |
| unit/equip | 1386 | 73% | 231 / 246 / 783 / 126 / 0 / 0 |
| card/search | 1182 | 71% | 0 / 494 / 675 / 11 / 2 / 0 |
| gigValue/adjust | 823 | 27% | 0 / 0 / 76 / 162 / 430 / 155 |
| mulligan | 560 | 23% | 0 / 560 / 0 / 0 / 0 / 0 |
| unit/defeat | 412 | 44% | 86 / 87 / 218 / 21 / 0 / 0 |
| card/playFree | 336 | 86% | 178 / 109 / 48 / 1 / 0 / 0 |
| card/trash | 304 | 48% | 0 / 304 / 0 / 0 / 0 / 0 |
| card/defeatGear | 182 | 16% | 0 / 100 / 79 / 3 / 0 / 0 |
| unit/sacrifice | 166 | 57% | 60 / 62 / 44 / 0 / 0 / 0 |
| card/discard | 53 | 38% | 11 / 12 / 28 / 2 / 0 / 0 |
| yesno/draw | 43 | 100% | 0 / 43 / 0 / 0 / 0 / 0 |
| unit/call | 40 | 100% | 0 / 13 / 27 / 0 / 0 / 0 |
| unit/protect | 29 | 69% | 12 / 12 / 5 / 0 / 0 / 0 |
| yesno/call | 10 | 100% | 0 / 10 / 0 / 0 / 0 / 0 |
| mode/foolOnTheHill | 6 | 67% | 0 / 6 / 0 / 0 / 0 / 0 |
| mode/rivalChoice | 1 | 0% | 0 / 1 / 0 / 0 / 0 / 0 |

Reaction windows: 1613 attacks. Reacted to 563 (deck won 51% (46–56) n=370): stole 182, stoleNothing 4, attackerGone 32, targetGone 304, bothGone 41. Let 1050 resolve (52% (47–57) n=414): stole 799, stoleNothing 10, attackerGone 6, targetGone 198, bothGone 37. Choices: block 330, endReact 1215, call 241, ability 103, play 28.

## Discord 5k #4: Jackie / Alt / Hanako (BBG) — 560 games, 51% won, 28320 decisions

| Card | Use | Uses | Win rate in games used (95%) | Legal turns → used | Not chosen | Early / mid / late uses | Ahead | Even | Behind |
|---|---|---|---|---|---|---|---|---|---|
| Pepe Najarro: Working Doubles | attacked | 962 | 55% (50–60) n=399 | 1015 → 867 | 15% | 109 / 427 / 426 | 69% (64–75) n=272 | 59% (51–66) n=152 | 37% (30–45) n=158 |
| Alt Cunningham: Soulkiller Architect | ability | 877 | 47% (43–52) n=466 | 1702 → 858 | 50% | 9 / 183 / 685 | 64% (58–69) n=313 | 40% (31–51) n=84 | 12% (9–17) n=228 |
| Jacked-In Voodoo Boy | attacked | 792 | 56% (50–61) n=369 | 767 → 664 | 13% | 78 / 251 / 463 | 68% (62–74) n=261 | 56% (46–66) n=93 | 31% (24–39) n=141 |
| Pepe Najarro: Working Doubles | played | 758 | 52% (47–56) n=476 | 1054 → 746 | 29% | 274 / 244 / 240 | 63% (57–68) n=282 | 51% (44–57) n=205 | 25% (18–33) n=122 |
| Jacked-In Voodoo Boy | played | 746 | 53% (49–58) n=470 | 1023 → 692 | 32% | 296 / 221 / 229 | 63% (58–68) n=331 | 40% (32–48) n=144 | 23% (15–33) n=83 |
| Maman Brigitte: Spirit of Death | played | 647 | 56% (51–60) n=434 | 899 → 641 | 29% | 194 / 199 / 254 | 67% (62–73) n=261 | 54% (46–63) n=136 | 30% (23–38) n=131 |
| Hanako Arasaka: Daughter of the Emperor | ability | 637 | 41% (36–46) n=379 | 1723 → 637 | 63% | 9 / 160 / 468 | 59% (53–65) n=236 | 32% (22–43) n=73 | 10% (7–16) n=182 |
| Maman Brigitte: Spirit of Death | attacked | 621 | 61% (56–67) n=318 | 695 → 560 | 19% | 0 / 249 / 372 | 77% (71–82) n=216 | 63% (53–72) n=89 | 35% (27–45) n=102 |
| Les Élémens | played | 444 | 55% (50–60) n=330 | 952 → 436 | 54% | 110 / 159 / 175 | 65% (58–72) n=178 | 50% (41–59) n=106 | 38% (29–48) n=99 |
| Riot Shield | sold | 435 | 51% (46–57) n=336 | 492 → 435 | 12% | 213 / 80 / 142 | 62% (55–68) n=195 | 46% (37–55) n=115 | 21% (13–32) n=72 |
| Jackie Welles: Pour One Out For Me | called | 426 | 55% (50–60) n=426 | 426 → 426 | 0% | 134 / 217 / 75 | 62% (57–67) n=304 | 42% (32–54) n=73 | 31% (20–45) n=49 |
| Alt Cunningham: Soulkiller Architect | called | 425 | 51% (46–56) n=425 | 425 → 425 | 0% | 129 / 217 / 79 | 59% (53–64) n=299 | 38% (28–50) n=78 | 25% (15–39) n=48 |
| Trust No One | sold | 422 | 47% (42–53) n=325 | 832 → 422 | 49% | 152 / 120 / 150 | 61% (53–68) n=157 | 46% (37–54) n=125 | 24% (16–33) n=97 |
| Hanako Arasaka: Daughter of the Emperor | called | 417 | 54% (49–59) n=417 | 417 → 417 | 0% | 143 / 217 / 57 | 63% (58–69) n=292 | 44% (33–55) n=78 | 15% (7–28) n=47 |
| Peace Offering | sold | 409 | 54% (48–59) n=332 | 855 → 409 | 52% | 212 / 108 / 89 | 62% (54–68) n=190 | 50% (41–59) n=122 | 30% (20–43) n=60 |

(30 more card uses in the JSON report.)

| Decision type | Decisions | First-listed option taken | Options offered (1 / 2 / 3–5 / 6–10 / 11–20 / 21+) |
|---|---|---|---|
| main | 14039 | 7% | 0 / 1052 / 3613 / 5946 / 3320 / 108 |
| gig/rollIn | 2240 | 100% | 0 / 560 / 1680 / 0 / 0 / 0 |
| gig/steal | 2226 | 41% | 226 / 542 / 1023 / 428 / 7 / 0 |
| unit/bottomdeck | 1154 | 85% | 891 / 166 / 96 / 1 / 0 / 0 |
| card/search | 1095 | 59% | 0 / 247 / 848 / 0 / 0 / 0 |
| gigValue/adjust | 988 | 21% | 0 / 30 / 234 / 363 / 284 / 77 |
| card/discard | 964 | 46% | 157 / 306 / 449 / 51 / 1 / 0 |
| react | 850 | 48% | 0 / 525 / 319 / 6 / 0 / 0 |
| card/playFromTrash | 685 | 55% | 215 / 190 / 242 / 37 / 1 / 0 |
| gig/swapGive | 637 | 33% | 15 / 48 / 311 / 263 / 0 / 0 |
| gig/swapTake | 637 | 33% | 46 / 75 / 284 / 226 / 6 / 0 |
| mulligan | 560 | 27% | 0 / 560 / 0 / 0 / 0 / 0 |
| yesno/discardFor | 471 | 99% | 0 / 471 / 0 / 0 / 0 / 0 |
| unit/ready | 338 | 100% | 0 / 228 / 110 / 0 / 0 / 0 |
| mode/mode | 276 | 93% | 0 / 18 / 258 / 0 / 0 / 0 |
| gigValue/setGig | 265 | 12% | 0 / 3 / 9 / 22 / 49 / 182 |
| unit/weaken | 228 | 73% | 100 / 64 / 64 / 0 / 0 / 0 |
| unit/adrenaline | 178 | 63% | 85 / 50 / 43 / 0 / 0 / 0 |
| unit/cantAttack | 171 | 61% | 65 / 58 / 48 / 0 / 0 / 0 |
| unit/stealMod | 106 | 67% | 16 / 45 / 45 / 0 / 0 / 0 |
| unit/equip | 85 | 76% | 11 / 6 / 46 / 22 / 0 / 0 |
| unit/call | 63 | 100% | 0 / 34 / 29 / 0 / 0 / 0 |
| unit/sacrifice | 52 | 87% | 39 / 8 / 5 / 0 / 0 / 0 |
| mode/foolOnTheHill | 6 | 33% | 0 / 6 / 0 / 0 / 0 / 0 |
| yesno/draw | 5 | 100% | 0 / 5 / 0 / 0 / 0 / 0 |
| mode/rivalChoice | 1 | 0% | 0 / 1 / 0 / 0 / 0 / 0 |

Reaction windows: 774 attacks. Reacted to 385 (deck won 42% (37–47) n=313): stole 224, stoleNothing 77, attackerGone 3, targetGone 77, bothGone 4. Let 389 resolve (36% (30–43) n=205): stole 287, targetGone 94, bothGone 8. Choices: endReact 410, call 296, play 139, block 5.

## Discord 5k #5: V / Smasher / Padre (RRG) — 560 games, 58% won, 26376 decisions

| Card | Use | Uses | Win rate in games used (95%) | Legal turns → used | Not chosen | Early / mid / late uses | Ahead | Even | Behind |
|---|---|---|---|---|---|---|---|---|---|
| Pepe Najarro: Working Doubles | attacked | 751 | 62% (57–67) n=345 | 874 → 697 | 20% | 73 / 303 / 375 | 79% (72–84) n=183 | 62% (53–71) n=117 | 53% (46–60) n=195 |
| 6th Street Recruits | attacked | 740 | 61% (56–66) n=338 | 908 → 681 | 25% | 72 / 295 / 373 | 81% (74–86) n=161 | 66% (57–74) n=106 | 53% (46–59) n=219 |
| Animals Wrecker | attacked | 570 | 68% (62–74) n=240 | 548 → 531 | 3% | 0 / 136 / 434 | 93% (87–97) n=105 | 81% (70–89) n=64 | 63% (56–69) n=185 |
| Synapse Burnout | sold | 520 | 58% (53–63) n=386 | 701 → 520 | 26% | 304 / 106 / 110 | 63% (55–69) n=192 | 56% (48–64) n=141 | 52% (43–61) n=118 |
| Peace Offering | sold | 519 | 55% (50–60) n=385 | 1017 → 519 | 49% | 192 / 200 / 127 | 63% (56–70) n=180 | 54% (45–63) n=118 | 46% (39–54) n=158 |
| V: Streetkid | attacked | 511 | 47% (41–52) n=304 | 617 → 511 | 17% | 74 / 158 / 279 | 56% (49–63) n=185 | 67% (52–79) n=42 | 36% (29–45) n=135 |
| Pepe Najarro: Working Doubles | played | 510 | 61% (56–65) n=385 | 1049 → 501 | 52% | 250 / 109 / 151 | 69% (62–76) n=176 | 59% (52–67) n=165 | 47% (38–57) n=106 |
| 6th Street Recruits | played | 499 | 59% (54–64) n=380 | 995 → 494 | 50% | 251 / 129 / 119 | 68% (61–75) n=174 | 57% (50–65) n=160 | 45% (36–55) n=100 |
| Memory Relapse | sold | 440 | 58% (53–63) n=344 | 1437 → 440 | 69% | 50 / 180 / 210 | 67% (59–75) n=138 | 67% (54–77) n=63 | 49% (42–56) n=184 |
| Padre: Man of the Cross | ability | 434 | 48% (42–53) n=302 | 1828 → 434 | 76% | 3 / 89 / 342 | 70% (63–76) n=182 | 26% (16–39) n=54 | 16% (11–24) n=134 |
| Industrial Assembly | sold | 422 | 53% (48–59) n=330 | 935 → 422 | 55% | 128 / 180 / 114 | 65% (56–73) n=122 | 57% (47–66) n=106 | 41% (33–49) n=144 |
| Adam Smasher: Ender of Legends | called | 421 | 61% (56–65) n=421 | 421 → 421 | 0% | 185 / 138 / 98 | 68% (62–73) n=294 | 53% (41–65) n=62 | 35% (25–48) n=65 |
| V: Streetkid | called | 418 | 57% (52–62) n=418 | 418 → 418 | 0% | 202 / 122 / 94 | 58% (53–64) n=277 | 59% (47–70) n=68 | 49% (38–61) n=73 |
| Mantis Blades | sold | 409 | 54% (49–60) n=328 | 598 → 409 | 32% | 253 / 68 / 88 | 53% (45–61) n=160 | 57% (48–65) n=122 | 44% (34–55) n=88 |
| Bonnie and Clyde | sold | 407 | 58% (52–63) n=317 | 1591 → 407 | 74% | 44 / 150 / 213 | 64% (56–71) n=145 | 63% (52–74) n=71 | 47% (39–55) n=144 |

(30 more card uses in the JSON report.)

Legal but never taken: V: Streetkid (Legend play, legal in 1010 turns).

| Decision type | Decisions | First-listed option taken | Options offered (1 / 2 / 3–5 / 6–10 / 11–20 / 21+) |
|---|---|---|---|
| main | 14512 | 8% | 0 / 1104 / 3813 / 5242 / 4217 / 136 |
| gig/steal | 3348 | 28% | 174 / 454 / 1503 / 1200 / 17 / 0 |
| gig/rollIn | 2240 | 0% | 0 / 560 / 1680 / 0 / 0 / 0 |
| react | 1402 | 59% | 0 / 939 / 460 / 3 / 0 / 0 |
| unit/defeat | 666 | 64% | 222 / 186 / 248 / 10 / 0 / 0 |
| mulligan | 560 | 14% | 0 / 560 / 0 / 0 / 0 / 0 |
| card/search | 543 | 60% | 159 / 189 / 160 / 35 / 0 / 0 |
| gigValue/setGig | 527 | 10% | 0 / 0 / 8 / 41 / 140 / 338 |
| mode/mode | 519 | 60% | 0 / 519 / 0 / 0 / 0 / 0 |
| unit/spend | 445 | 80% | 280 / 102 / 63 / 0 / 0 / 0 |
| gigValue/adjust | 341 | 6% | 0 / 8 / 95 / 9 / 38 / 191 |
| unit/equip | 337 | 87% | 48 / 99 / 153 / 37 / 0 / 0 |
| card/playFree | 331 | 60% | 0 / 45 / 244 / 42 / 0 / 0 |
| unit/adrenaline | 253 | 62% | 120 / 84 / 49 / 0 / 0 / 0 |
| unit/ready | 211 | 91% | 0 / 165 / 46 / 0 / 0 / 0 |
| unit/sacrifice | 57 | 79% | 34 / 9 / 14 / 0 / 0 / 0 |
| card/discard | 42 | 43% | 6 / 10 / 24 / 2 / 0 / 0 |
| unit/pump | 24 | 67% | 5 / 13 / 6 / 0 / 0 / 0 |
| yesno/draw | 11 | 100% | 0 / 11 / 0 / 0 / 0 / 0 |
| mode/foolOnTheHill | 4 | 50% | 0 / 4 / 0 / 0 / 0 / 0 |
| mode/rivalChoice | 3 | 0% | 0 / 3 / 0 / 0 / 0 / 0 |

Reaction windows: 1275 attacks. Reacted to 530 (deck won 51% (45–56) n=368): stole 264, attackerGone 24, targetGone 213, bothGone 29. Let 745 resolve (57% (51–62) n=329): stole 503, stoleNothing 4, attackerGone 6, targetGone 203, bothGone 29. Choices: call 363, endReact 827, block 189, play 23.

## Discord 5k #6: Jackie / Alt / Hanako (BBG) — 560 games, 47% won, 28320 decisions

| Card | Use | Uses | Win rate in games used (95%) | Legal turns → used | Not chosen | Early / mid / late uses | Ahead | Even | Behind |
|---|---|---|---|---|---|---|---|---|---|
| Pepe Najarro: Working Doubles | attacked | 924 | 50% (45–55) n=390 | 971 → 818 | 16% | 100 / 378 / 446 | 64% (57–70) n=234 | 53% (45–61) n=144 | 37% (31–44) n=190 |
| Alt Cunningham: Soulkiller Architect | ability | 757 | 41% (37–46) n=434 | 1735 → 736 | 58% | 7 / 163 / 587 | 58% (52–63) n=269 | 33% (24–44) n=90 | 11% (8–17) n=209 |
| Jacked-In Voodoo Boy | played | 713 | 46% (41–50) n=465 | 1035 → 661 | 36% | 293 / 209 / 211 | 55% (49–61) n=290 | 40% (32–48) n=145 | 18% (12–27) n=98 |
| Jacked-In Voodoo Boy | attacked | 711 | 48% (43–53) n=343 | 697 → 603 | 13% | 81 / 217 / 413 | 64% (57–70) n=211 | 52% (41–62) n=85 | 29% (23–37) n=156 |
| Pepe Najarro: Working Doubles | played | 707 | 48% (43–53) n=451 | 967 → 693 | 28% | 257 / 239 / 211 | 59% (53–65) n=263 | 43% (37–51) n=191 | 23% (16–31) n=117 |
| Hanako Arasaka: Daughter of the Emperor | ability | 563 | 37% (32–42) n=354 | 1703 → 563 | 67% | 10 / 125 / 428 | 53% (46–59) n=203 | 30% (20–42) n=67 | 10% (6–15) n=173 |
| Peace Offering | sold | 488 | 46% (41–51) n=373 | 808 → 488 | 40% | 271 / 91 / 126 | 53% (46–60) n=190 | 47% (39–55) n=145 | 29% (20–39) n=84 |
| Valentino Street Racer | played | 460 | 45% (40–50) n=368 | 753 → 436 | 42% | 123 / 178 / 159 | 57% (51–64) n=213 | 40% (31–50) n=97 | 21% (14–31) n=89 |
| Jackie Welles: Pour One Out For Me | called | 448 | 48% (43–52) n=448 | 448 → 448 | 0% | 175 / 199 / 74 | 56% (51–61) n=312 | 36% (27–46) n=89 | 13% (6–25) n=47 |
| Trust No One | sold | 442 | 46% (41–51) n=334 | 778 → 442 | 43% | 183 / 117 / 142 | 55% (48–62) n=174 | 44% (36–53) n=125 | 23% (16–33) n=91 |
| Hanako Arasaka: Daughter of the Emperor | called | 433 | 47% (42–52) n=433 | 433 → 433 | 0% | 150 / 202 / 81 | 53% (48–59) n=300 | 38% (28–48) n=87 | 24% (14–38) n=46 |
| Valentino Street Racer | attacked | 425 | 52% (46–59) n=244 | 551 → 396 | 28% | 24 / 173 / 228 | 70% (63–77) n=152 | 51% (38–63) n=59 | 32% (23–42) n=91 |
| Nocturne OP55 N1 | sold | 424 | 42% (37–48) n=319 | 1110 → 424 | 62% | 140 / 151 / 133 | 51% (43–58) n=186 | 44% (34–54) n=87 | 18% (12–26) n=101 |
| Alt Cunningham: Soulkiller Architect | called | 420 | 49% (44–53) n=420 | 420 → 420 | 0% | 148 / 197 / 75 | 58% (52–64) n=280 | 36% (27–46) n=92 | 17% (9–30) n=48 |
| Maman Brigitte: Spirit of Death | attacked | 410 | 56% (50–62) n=252 | 527 → 394 | 25% | 0 / 175 / 235 | 71% (63–78) n=152 | 67% (54–78) n=55 | 30% (21–40) n=91 |

(35 more card uses in the JSON report.)

| Decision type | Decisions | First-listed option taken | Options offered (1 / 2 / 3–5 / 6–10 / 11–20 / 21+) |
|---|---|---|---|
| main | 14392 | 7% | 0 / 1183 / 3586 / 6110 / 3414 / 99 |
| gig/steal | 2385 | 38% | 244 / 541 / 1004 / 585 / 11 / 0 |
| gig/rollIn | 2240 | 100% | 0 / 560 / 1680 / 0 / 0 / 0 |
| react | 1211 | 58% | 0 / 819 / 388 / 4 / 0 / 0 |
| gigValue/adjust | 1168 | 23% | 0 / 42 / 313 / 426 / 311 / 76 |
| card/search | 887 | 57% | 0 / 195 / 692 / 0 / 0 / 0 |
| unit/bottomdeck | 877 | 87% | 675 / 138 / 64 / 0 / 0 / 0 |
| card/discard | 635 | 48% | 113 / 220 / 293 / 9 / 0 / 0 |
| gig/swapGive | 563 | 37% | 19 / 31 / 278 / 234 / 1 / 0 |
| gig/swapTake | 563 | 29% | 39 / 63 / 245 / 207 / 9 / 0 |
| mulligan | 560 | 19% | 0 / 560 / 0 / 0 / 0 / 0 |
| card/playFromTrash | 495 | 65% | 211 / 147 / 124 / 13 / 0 / 0 |
| unit/ready | 382 | 100% | 0 / 251 / 131 / 0 / 0 / 0 |
| unit/adrenaline | 332 | 60% | 158 / 104 / 70 / 0 / 0 / 0 |
| yesno/discardFor | 307 | 99% | 0 / 307 / 0 / 0 / 0 / 0 |
| unit/mustAttack | 219 | 67% | 93 / 84 / 39 / 3 / 0 / 0 |
| mode/mode | 215 | 92% | 0 / 17 / 198 / 0 / 0 / 0 |
| gigValue/setGig | 208 | 11% | 0 / 1 / 11 / 19 / 26 / 151 |
| unit/weaken | 187 | 66% | 69 / 52 / 65 / 1 / 0 / 0 |
| card/freePlay | 182 | 64% | 0 / 49 / 107 / 25 / 1 / 0 |
| unit/cantAttack | 117 | 62% | 43 / 39 / 34 / 1 / 0 / 0 |
| unit/stealMod | 76 | 64% | 16 / 31 / 29 / 0 / 0 / 0 |
| unit/sacrifice | 59 | 92% | 46 / 7 / 6 / 0 / 0 / 0 |
| unit/call | 34 | 100% | 0 / 15 / 19 / 0 / 0 / 0 |
| unit/equip | 13 | 77% | 0 / 0 / 8 / 5 / 0 / 0 |
| yesno/draw | 9 | 100% | 0 / 9 / 0 / 0 / 0 / 0 |
| mode/foolOnTheHill | 3 | 33% | 0 / 3 / 0 / 0 / 0 / 0 |
| mode/rivalChoice | 1 | 0% | 0 / 1 / 0 / 0 / 0 / 0 |

Reaction windows: 1109 attacks. Reacted to 458 (deck won 40% (35–46) n=347): stole 192, stoleNothing 55, attackerGone 2, targetGone 198, bothGone 11. Let 651 resolve (38% (32–44) n=285): stole 441, stoleNothing 2, targetGone 191, bothGone 17. Choices: endReact 698, call 285, play 85, block 143.

## Discord 5k #7: Smasher / River / Viktor (RYY) — 560 games, 60% won, 25731 decisions

| Card | Use | Uses | Win rate in games used (95%) | Legal turns → used | Not chosen | Early / mid / late uses | Ahead | Even | Behind |
|---|---|---|---|---|---|---|---|---|---|
| Rockn' Rockerboy | attacked | 824 | 67% (62–72) n=313 | 836 → 763 | 9% | 0 / 366 / 458 | 80% (74–84) n=210 | 67% (56–76) n=84 | 58% (50–65) n=153 |
| Johnny Silverhand: Never Stop Fighting | attacked | 690 | 70% (64–75) n=261 | 489 → 448 | 8% | 0 / 118 / 572 | 85% (79–89) n=182 | 75% (63–84) n=61 | 51% (41–60) n=97 |
| Arasaka Emergency Radioport | sold | 636 | 58% (53–62) n=445 | 1138 → 636 | 44% | 219 / 217 / 200 | 72% (66–78) n=227 | 48% (40–56) n=155 | 44% (36–52) n=142 |
| Mandibular Upgrade | sold | 595 | 58% (53–62) n=411 | 676 → 595 | 12% | 315 / 136 / 144 | 69% (62–75) n=221 | 50% (42–58) n=151 | 42% (33–51) n=120 |
| Meredith Stout: Stone Cold Corpo | played | 574 | 60% (56–65) n=416 | 1078 → 568 | 47% | 167 / 229 / 178 | 73% (66–78) n=209 | 50% (42–58) n=151 | 48% (40–57) n=129 |
| 6th Street Recruits | attacked | 557 | 66% (60–72) n=244 | 626 → 534 | 15% | 67 / 231 / 259 | 79% (71–84) n=149 | 67% (58–76) n=98 | 54% (45–64) n=103 |
| Rockn' Rockerboy | played | 515 | 63% (58–67) n=390 | 689 → 513 | 26% | 210 / 178 / 127 | 76% (70–81) n=225 | 54% (45–62) n=136 | 40% (30–50) n=86 |
| Zetatech Faceplate | sold | 513 | 58% (52–63) n=370 | 1484 → 513 | 65% | 111 / 197 / 205 | 69% (62–75) n=188 | 50% (41–59) n=115 | 50% (41–58) n=129 |
| Johnny Silverhand: Never Stop Fighting | played | 469 | 62% (57–66) n=370 | 938 → 469 | 50% | 0 / 247 / 222 | 77% (71–83) n=208 | 44% (33–55) n=73 | 42% (34–51) n=130 |
| Secondhand Bombus | played | 463 | 54% (49–59) n=352 | 1410 → 445 | 68% | 69 / 229 / 165 | 64% (57–69) n=245 | 34% (24–46) n=68 | 38% (28–49) n=76 |
| Meredith Stout: Stone Cold Corpo | attacked | 454 | 60% (54–66) n=249 | 682 → 429 | 37% | 49 / 152 / 253 | 77% (70–83) n=163 | 48% (38–59) n=81 | 35% (25–46) n=77 |
| Adam Smasher: Ender of Legends | called | 431 | 59% (54–64) n=431 | 431 → 431 | 0% | 144 / 159 / 128 | 72% (66–76) n=281 | 28% (20–39) n=85 | 46% (35–58) n=65 |
| Adam Smasher: Ender of Legends | attacked | 430 | 56% (51–61) n=327 | 467 → 430 | 8% | 0 / 0 / 430 | 84% (78–89) n=164 | 62% (50–73) n=61 | 25% (18–32) n=151 |
| Viktor Vektor: Sit Down and Relax | called | 425 | 58% (53–62) n=425 | 428 → 425 | 1% | 149 / 177 / 99 | 67% (61–72) n=288 | 38% (27–49) n=69 | 41% (30–53) n=68 |
| River Ward: Detective on the Hunt | called | 419 | 58% (53–62) n=419 | 446 → 419 | 6% | 148 / 157 / 114 | 68% (63–73) n=289 | 35% (25–46) n=75 | 35% (23–48) n=55 |

(29 more card uses in the JSON report.)

Legal but never taken: Adam Smasher: Ender of Legends (Legend play, legal in 358 turns), Sketchy Ripper (reaction, legal in 11 turns).

| Decision type | Decisions | First-listed option taken | Options offered (1 / 2 / 3–5 / 6–10 / 11–20 / 21+) |
|---|---|---|---|
| main | 14071 | 9% | 0 / 1101 / 3711 / 6214 / 2973 / 72 |
| gig/steal | 2755 | 40% | 323 / 581 / 1175 / 670 / 6 / 0 |
| gig/rollIn | 2240 | 0% | 0 / 560 / 1680 / 0 / 0 / 0 |
| react | 1875 | 66% | 0 / 1067 / 798 / 10 / 0 / 0 |
| unit/equip | 1320 | 74% | 219 / 250 / 734 / 117 / 0 / 0 |
| card/search | 1226 | 65% | 0 / 428 / 781 / 17 / 0 / 0 |
| mulligan | 560 | 16% | 0 / 560 / 0 / 0 / 0 / 0 |
| gigValue/adjust | 493 | 14% | 0 / 0 / 1 / 36 / 274 / 182 |
| unit/defeat | 342 | 42% | 29 / 77 / 225 / 11 / 0 / 0 |
| card/playFree | 282 | 86% | 142 / 105 / 34 / 1 / 0 / 0 |
| card/trash | 235 | 51% | 0 / 235 / 0 / 0 / 0 / 0 |
| unit/sacrifice | 198 | 57% | 74 / 74 / 49 / 1 / 0 / 0 |
| unit/call | 58 | 100% | 0 / 18 / 40 / 0 / 0 / 0 |
| card/discard | 49 | 55% | 14 / 9 / 23 / 3 / 0 / 0 |
| yesno/call | 16 | 100% | 0 / 16 / 0 / 0 / 0 / 0 |
| yesno/draw | 6 | 100% | 0 / 6 / 0 / 0 / 0 / 0 |
| mode/rivalChoice | 3 | 33% | 0 / 3 / 0 / 0 / 0 / 0 |
| mode/foolOnTheHill | 2 | 0% | 0 / 2 / 0 / 0 / 0 / 0 |

Reaction windows: 1626 attacks. Reacted to 529 (deck won 50% (45–56) n=357): stole 156, attackerGone 16, targetGone 334, bothGone 22, noneGone 1. Let 1097 resolve (56% (51–60) n=415): stole 835, stoleNothing 13, attackerGone 12, targetGone 185, bothGone 52. Choices: call 225, ability 66, endReact 1238, block 346.

## Discord 5k #8: V / Smasher / Saburo (RRG) — 560 games, 61% won, 24255 decisions

| Card | Use | Uses | Win rate in games used (95%) | Legal turns → used | Not chosen | Early / mid / late uses | Ahead | Even | Behind |
|---|---|---|---|---|---|---|---|---|---|
| Pepe Najarro: Working Doubles | attacked | 757 | 64% (59–69) n=351 | 914 → 685 | 25% | 92 / 249 / 416 | 81% (74–86) n=170 | 60% (51–68) n=129 | 55% (48–62) n=197 |
| MaxTac AV | attacked | 546 | 72% (66–77) n=239 | 608 → 525 | 14% | 0 / 277 / 269 | 85% (78–89) n=149 | 71% (59–81) n=63 | 67% (59–75) n=132 |
| V: Streetkid | attacked | 544 | 48% (43–54) n=314 | 643 → 544 | 15% | 53 / 225 / 266 | 64% (57–70) n=185 | 42% (30–55) n=55 | 39% (31–47) n=145 |
| Detonate | sold | 512 | 61% (56–66) n=380 | 799 → 512 | 36% | 245 / 141 / 126 | 70% (63–76) n=188 | 58% (50–66) n=129 | 46% (38–55) n=119 |
| Animals Wrecker | attacked | 501 | 73% (67–78) n=230 | 498 → 473 | 5% | 0 / 149 / 352 | 89% (82–93) n=115 | 83% (71–91) n=54 | 68% (60–75) n=165 |
| Pepe Najarro: Working Doubles | played | 494 | 61% (56–65) n=376 | 977 → 488 | 50% | 255 / 136 / 103 | 73% (66–79) n=183 | 51% (43–58) n=163 | 48% (37–58) n=82 |
| Arasaka Emergency Radioport | sold | 475 | 59% (54–64) n=366 | 799 → 475 | 41% | 219 / 122 / 134 | 70% (62–76) n=159 | 53% (44–61) n=127 | 51% (42–59) n=124 |
| Yorinobu Arasaka: Steel Dragon | played | 466 | 67% (62–72) n=353 | 618 → 466 | 25% | 0 / 189 / 277 | 76% (69–82) n=155 | 68% (55–78) n=62 | 58% (51–65) n=193 |
| Peace Offering | sold | 435 | 64% (58–69) n=338 | 1112 → 435 | 61% | 117 / 204 / 114 | 70% (62–77) n=147 | 60% (50–69) n=92 | 60% (52–68) n=141 |
| Adam Smasher: Ender of Legends | called | 432 | 60% (55–65) n=432 | 432 → 432 | 0% | 171 / 163 / 98 | 70% (64–75) n=280 | 43% (32–54) n=75 | 43% (32–54) n=77 |
| V: Streetkid | called | 426 | 60% (55–64) n=426 | 426 → 426 | 0% | 180 / 170 / 76 | 68% (62–73) n=276 | 42% (32–53) n=76 | 49% (38–60) n=74 |
| Yorinobu Arasaka: Steel Dragon | attacked | 426 | 79% (73–83) n=267 | 434 → 405 | 7% | 0 / 0 / 426 | 96% (91–98) n=136 | 88% (78–94) n=60 | 64% (55–72) n=133 |
| Saburo Arasaka: Stubborn Patriarch | called | 411 | 61% (56–65) n=411 | 411 → 411 | 0% | 162 / 161 / 88 | 67% (62–73) n=288 | 49% (38–61) n=67 | 39% (28–52) n=56 |
| Mantis Blades | sold | 404 | 59% (53–64) n=324 | 608 → 404 | 34% | 256 / 64 / 84 | 74% (66–80) n=155 | 46% (38–55) n=128 | 49% (39–60) n=81 |
| Industrial Assembly | sold | 354 | 57% (51–62) n=288 | 929 → 354 | 62% | 74 / 154 / 126 | 70% (60–78) n=105 | 53% (43–63) n=92 | 49% (40–58) n=123 |

(31 more card uses in the JSON report.)

Legal but never taken: V: Streetkid (Legend play, legal in 999 turns).

| Decision type | Decisions | First-listed option taken | Options offered (1 / 2 / 3–5 / 6–10 / 11–20 / 21+) |
|---|---|---|---|
| main | 13207 | 8% | 0 / 1232 / 3476 / 5158 / 3232 / 109 |
| gig/steal | 3355 | 28% | 208 / 522 / 1422 / 1193 / 10 / 0 |
| gig/rollIn | 2240 | 0% | 0 / 560 / 1680 / 0 / 0 / 0 |
| react | 1134 | 68% | 0 / 815 / 316 / 3 / 0 / 0 |
| unit/defeat | 660 | 62% | 202 / 230 / 213 / 15 / 0 / 0 |
| unit/ready | 622 | 73% | 0 / 326 / 287 / 9 / 0 / 0 |
| mulligan | 560 | 33% | 0 / 560 / 0 / 0 / 0 / 0 |
| card/search | 546 | 62% | 178 / 198 / 149 / 19 / 2 / 0 |
| card/playFree | 431 | 56% | 0 / 134 / 290 / 7 / 0 / 0 |
| gig/swapGive | 328 | 34% | 0 / 15 / 263 / 47 / 3 / 0 |
| gig/swapTake | 269 | 51% | 66 / 99 / 67 / 36 / 1 / 0 |
| gigValue/adjust | 196 | 10% | 0 / 10 / 63 / 15 / 56 / 52 |
| unit/equip | 183 | 85% | 44 / 68 / 64 / 7 / 0 / 0 |
| gigValue/setGig | 148 | 9% | 0 / 0 / 8 / 18 / 39 / 83 |
| unit/spend | 148 | 76% | 74 / 41 / 33 / 0 / 0 / 0 |
| unit/sacrifice | 68 | 81% | 45 / 15 / 8 / 0 / 0 / 0 |
| unit/call | 45 | 100% | 0 / 14 / 31 / 0 / 0 / 0 |
| yesno/call | 45 | 100% | 0 / 45 / 0 / 0 / 0 / 0 |
| card/discard | 33 | 42% | 5 / 12 / 14 / 2 / 0 / 0 |
| card/defeat | 20 | 100% | 16 / 4 / 0 / 0 / 0 / 0 |
| yesno/draw | 7 | 100% | 0 / 7 / 0 / 0 / 0 / 0 |
| mode/foolOnTheHill | 6 | 33% | 0 / 6 / 0 / 0 / 0 / 0 |
| mode/rivalChoice | 4 | 0% | 0 / 4 / 0 / 0 / 0 / 0 |

Reaction windows: 1056 attacks. Reacted to 339 (deck won 56% (50–62) n=264): stole 167, attackerGone 6, targetGone 144, bothGone 22. Let 717 resolve (59% (53–64) n=310): stole 549, stoleNothing 7, attackerGone 5, targetGone 131, bothGone 25. Choices: endReact 772, call 233, block 121, play 8.

## Fills up Discard super quickly then heavily discounted Trauma Team Operatives and high power Rockerboys fill the board. — 560 games, 53% won, 25508 decisions

| Card | Use | Uses | Win rate in games used (95%) | Legal turns → used | Not chosen | Early / mid / late uses | Ahead | Even | Behind |
|---|---|---|---|---|---|---|---|---|---|
| Rockn' Rockerboy | attacked | 906 | 57% (51–62) n=338 | 936 → 808 | 14% | 0 / 421 / 485 | 73% (67–79) n=207 | 56% (45–67) n=80 | 48% (41–55) n=208 |
| Johnny Silverhand: Never Stop Fighting | attacked | 641 | 65% (59–70) n=244 | 475 → 434 | 9% | 0 / 83 / 558 | 84% (77–89) n=145 | 78% (67–86) n=64 | 51% (42–59) n=124 |
| Rockn' Rockerboy | played | 542 | 53% (48–58) n=397 | 687 → 541 | 21% | 241 / 173 / 128 | 66% (59–72) n=198 | 46% (38–54) n=149 | 37% (29–45) n=135 |
| All is Lost | sold | 516 | 52% (47–57) n=372 | 613 → 516 | 16% | 272 / 113 / 131 | 61% (54–68) n=180 | 46% (39–54) n=158 | 44% (35–53) n=113 |
| Shattered Memories | sold | 515 | 54% (49–59) n=386 | 1360 → 515 | 62% | 108 / 186 / 221 | 66% (58–73) n=161 | 57% (47–66) n=106 | 44% (37–51) n=182 |
| V: Streetkid | attacked | 507 | 47% (42–53) n=316 | 592 → 507 | 14% | 55 / 97 / 355 | 65% (58–72) n=164 | 58% (46–69) n=66 | 30% (23–38) n=160 |
| 6th Street Recruits | attacked | 483 | 56% (50–62) n=228 | 571 → 460 | 19% | 71 / 171 / 241 | 81% (72–88) n=94 | 57% (47–67) n=91 | 46% (38–55) n=134 |
| Muamar Reyes: El Capitán | ability | 480 | 48% (42–53) n=323 | 1625 → 480 | 70% | 9 / 63 / 408 | 72% (65–78) n=187 | 31% (20–44) n=52 | 19% (13–26) n=140 |
| Trauma Team Operatives | played | 474 | 50% (45–56) n=338 | 1078 → 432 | 60% | 37 / 134 / 303 | 67% (59–75) n=131 | 46% (35–57) n=70 | 41% (34–48) n=176 |
| Trauma Team Operatives | attacked | 470 | 56% (49–62) n=233 | 465 → 400 | 14% | 3 / 80 / 387 | 79% (71–85) n=114 | 65% (52–77) n=55 | 42% (34–50) n=136 |
| Bonnie and Clyde | sold | 465 | 53% (48–59) n=344 | 1487 → 465 | 69% | 89 / 175 / 201 | 62% (54–69) n=150 | 57% (46–67) n=79 | 45% (38–53) n=168 |
| Johnny Silverhand: Rocking Renegade | called | 420 | 52% (47–57) n=420 | 420 → 420 | 0% | 188 / 130 / 102 | 62% (56–67) n=276 | 39% (29–51) n=74 | 27% (18–39) n=70 |
| V: Streetkid | called | 413 | 55% (50–60) n=413 | 413 → 413 | 0% | 194 / 115 / 104 | 65% (59–71) n=257 | 44% (33–55) n=75 | 33% (24–44) n=81 |
| Johnny Silverhand: Never Stop Fighting | played | 409 | 58% (53–64) n=324 | 1058 → 409 | 61% | 0 / 189 / 220 | 77% (68–83) n=120 | 63% (50–74) n=62 | 45% (38–52) n=185 |
| Johnny Silverhand: Rocking Renegade | ability | 391 | 52% (46–57) n=277 | 1551 → 391 | 75% | 7 / 53 / 331 | 73% (65–79) n=153 | 48% (35–61) n=54 | 28% (21–37) n=117 |

(33 more card uses in the JSON report.)

Legal but never taken: V: Streetkid (Legend play, legal in 1143 turns).

| Decision type | Decisions | First-listed option taken | Options offered (1 / 2 / 3–5 / 6–10 / 11–20 / 21+) |
|---|---|---|---|
| main | 14680 | 7% | 0 / 1252 / 3722 / 5015 / 4434 / 257 |
| gig/steal | 3068 | 29% | 165 / 464 / 1302 / 1123 / 14 / 0 |
| gig/rollIn | 2240 | 0% | 0 / 560 / 1680 / 0 / 0 / 0 |
| react | 1453 | 62% | 0 / 862 / 584 / 7 / 0 / 0 |
| gigValue/adjust | 892 | 12% | 0 / 10 / 64 / 46 / 454 / 318 |
| card/search | 833 | 69% | 226 / 313 / 269 / 22 / 3 / 0 |
| mulligan | 560 | 31% | 0 / 560 / 0 / 0 / 0 / 0 |
| mode/muamarCall | 504 | 74% | 0 / 504 / 0 / 0 / 0 / 0 |
| unit/lagAttack | 391 | 86% | 54 / 117 / 206 / 14 / 0 / 0 |
| unit/protect | 353 | 45% | 80 / 142 / 129 / 2 / 0 / 0 |
| unit/defeat | 296 | 75% | 155 / 94 / 46 / 1 / 0 / 0 |
| card/defeatGear | 79 | 91% | 0 / 64 / 15 / 0 / 0 / 0 |
| card/discard | 54 | 39% | 7 / 9 / 35 / 3 / 0 / 0 |
| unit/sacrifice | 54 | 93% | 33 / 15 / 6 / 0 / 0 / 0 |
| yesno/draw | 35 | 100% | 0 / 35 / 0 / 0 / 0 / 0 |
| card/defeat | 11 | 100% | 9 / 2 / 0 / 0 / 0 / 0 |
| mode/foolOnTheHill | 5 | 60% | 0 / 5 / 0 / 0 / 0 / 0 |

Reaction windows: 1286 attacks. Reacted to 469 (deck won 45% (40–50) n=351): stole 191, stoleNothing 1, attackerGone 9, targetGone 213, bothGone 16, noneGone 39. Let 817 resolve (51% (46–56) n=332): stole 613, stoleNothing 7, attackerGone 2, targetGone 179, bothGone 16. Choices: endReact 899, call 312, block 236, play 6.

## Gear'n'Go — 560 games, 37% won, 23489 decisions

| Card | Use | Uses | Win rate in games used (95%) | Legal turns → used | Not chosen | Early / mid / late uses | Ahead | Even | Behind |
|---|---|---|---|---|---|---|---|---|---|
| Goro Takemura: Hands Unclean | attacked | 739 | 37% (32–41) n=446 | 1014 → 738 | 27% | 46 / 246 / 447 | 57% (51–63) n=241 | 35% (26–45) n=98 | 21% (16–27) n=203 |
| Dexter DeShawn: One Last Chance | attacked | 677 | 38% (33–44) n=325 | 825 → 609 | 26% | 56 / 267 / 354 | 62% (54–70) n=139 | 46% (36–55) n=103 | 25% (19–31) n=201 |
| Corpo Security | played | 602 | 37% (33–42) n=418 | 938 → 577 | 38% | 260 / 175 / 167 | 51% (45–57) n=236 | 23% (16–31) n=124 | 20% (14–27) n=140 |
| Dexter DeShawn: One Last Chance | played | 594 | 36% (32–41) n=408 | 782 → 575 | 26% | 251 / 165 / 178 | 50% (43–57) n=195 | 28% (22–35) n=165 | 21% (15–29) n=131 |
| Corporate Surveillance | sold | 593 | 34% (30–39) n=414 | 1107 → 593 | 46% | 200 / 214 / 179 | 44% (37–51) n=202 | 31% (24–39) n=152 | 23% (17–30) n=155 |
| Mandibular Upgrade | sold | 577 | 34% (30–39) n=414 | 690 → 577 | 16% | 314 / 115 / 148 | 45% (38–52) n=195 | 27% (21–34) n=168 | 22% (15–30) n=120 |
| Riot Shield | sold | 527 | 36% (31–41) n=388 | 941 → 527 | 44% | 229 / 170 / 128 | 48% (41–55) n=186 | 29% (22–38) n=127 | 19% (13–26) n=135 |
| Goro Takemura: Losing His Way | played | 513 | 34% (30–39) n=371 | 1346 → 497 | 63% | 131 / 150 / 232 | 47% (40–54) n=173 | 25% (18–33) n=121 | 23% (17–30) n=146 |
| Caliber: Totentanz's Top Dog | played | 503 | 35% (31–40) n=376 | 1148 → 503 | 56% | 98 / 179 / 226 | 54% (47–61) n=187 | 21% (14–31) n=81 | 18% (13–24) n=170 |
| Goro Takemura: Hands Unclean | Go Solo (self-paid 501) | 501 | 36% (32–40) n=501 | 773 → 501 | 35% | 75 / 226 / 200 | 49% (42–56) n=188 | 33% (25–43) n=108 | 25% (19–31) n=205 |
| Goro Takemura: Losing His Way | attacked | 484 | 37% (31–43) n=255 | 540 → 454 | 16% | 25 / 164 / 295 | 63% (54–71) n=108 | 46% (36–57) n=78 | 25% (18–32) n=151 |
| Caliber: Totentanz's Top Dog | attacked | 484 | 41% (35–47) n=271 | 540 → 459 | 15% | 0 / 180 / 304 | 64% (55–71) n=132 | 51% (37–65) n=45 | 26% (20–33) n=161 |
| Sandevistan | sold | 477 | 35% (31–40) n=357 | 912 → 477 | 48% | 213 / 133 / 131 | 47% (40–54) n=188 | 30% (22–40) n=97 | 16% (10–23) n=122 |
| Goro Takemura: Hands Unclean | called | 410 | 36% (32–41) n=410 | 410 → 410 | 0% | 208 / 129 / 73 | 43% (37–50) n=220 | 33% (25–42) n=121 | 20% (12–31) n=69 |
| Panam Palmer: Nomad Cavalry | called | 407 | 34% (29–38) n=407 | 407 → 407 | 0% | 176 / 140 / 91 | 44% (37–50) n=231 | 23% (16–31) n=106 | 17% (10–28) n=70 |

(31 more card uses in the JSON report.)

| Decision type | Decisions | First-listed option taken | Options offered (1 / 2 / 3–5 / 6–10 / 11–20 / 21+) |
|---|---|---|---|
| main | 13018 | 8% | 0 / 810 / 3371 / 5433 / 3337 / 67 |
| react | 2399 | 67% | 0 / 1387 / 991 / 21 / 0 / 0 |
| gig/rollIn | 2240 | 0% | 0 / 560 / 1680 / 0 / 0 / 0 |
| gig/steal | 2142 | 34% | 140 / 395 / 914 / 684 / 9 / 0 |
| gigValue/adjust | 1426 | 37% | 0 / 0 / 141 / 268 / 798 / 219 |
| mulligan | 560 | 8% | 0 / 560 / 0 / 0 / 0 / 0 |
| unit/equip | 521 | 78% | 103 / 137 / 266 / 15 / 0 / 0 |
| unit/defeat | 433 | 57% | 140 / 100 / 185 / 8 / 0 / 0 |
| unit/ready | 325 | 62% | 129 / 135 / 61 / 0 / 0 / 0 |
| unit/pump | 209 | 46% | 46 / 62 / 95 / 6 / 0 / 0 |
| card/defeatGear | 79 | 85% | 0 / 58 / 21 / 0 / 0 / 0 |
| card/discard | 73 | 53% | 8 / 19 / 43 / 3 / 0 / 0 |
| unit/sacrifice | 42 | 86% | 23 / 12 / 7 / 0 / 0 / 0 |
| yesno/draw | 7 | 100% | 0 / 7 / 0 / 0 / 0 / 0 |
| card/moveGear | 6 | 100% | 6 / 0 / 0 / 0 / 0 / 0 |
| mode/foolOnTheHill | 5 | 20% | 0 / 5 / 0 / 0 / 0 / 0 |
| mode/rivalChoice | 2 | 0% | 0 / 2 / 0 / 0 / 0 / 0 |
| unit/spend | 2 | 100% | 1 / 1 / 0 / 0 / 0 / 0 |

Reaction windows: 2080 attacks. Reacted to 663 (deck won 36% (31–40) n=419): fizzled 17, stole 181, stoleNothing 2, attackerGone 34, targetGone 400, bothGone 29. Let 1417 resolve (35% (31–39) n=445): stole 952, stoleNothing 12, attackerGone 10, targetGone 412, bothGone 31. Choices: endReact 1601, call 334, block 435, ability 29.

## GRY Trauma Team — 560 games, 46% won, 28232 decisions

| Card | Use | Uses | Win rate in games used (95%) | Legal turns → used | Not chosen | Early / mid / late uses | Ahead | Even | Behind |
|---|---|---|---|---|---|---|---|---|---|
| 6th Street Recruits | attacked | 764 | 46% (41–51) n=330 | 891 → 711 | 20% | 78 / 264 / 422 | 65% (58–72) n=161 | 47% (39–55) n=134 | 39% (33–46) n=201 |
| Pepe Najarro: Working Doubles | attacked | 740 | 48% (43–54) n=330 | 836 → 672 | 20% | 56 / 301 / 383 | 65% (58–72) n=181 | 51% (42–60) n=117 | 37% (31–44) n=185 |
| V: Streetkid | attacked | 680 | 43% (38–48) n=429 | 824 → 680 | 17% | 64 / 180 / 436 | 59% (53–65) n=230 | 54% (43–64) n=80 | 26% (21–32) n=220 |
| Meredith Stout: Stone Cold Corpo | played | 601 | 44% (39–49) n=419 | 1374 → 585 | 57% | 137 / 146 / 318 | 58% (51–65) n=179 | 38% (31–46) n=146 | 31% (25–39) n=169 |
| Padre: Man of the Cross | ability | 585 | 37% (32–42) n=360 | 1959 → 585 | 70% | 3 / 107 / 475 | 58% (51–64) n=212 | 19% (12–28) n=81 | 7% (4–12) n=170 |
| Muamar Reyes: El Capitán | ability | 579 | 38% (33–43) n=369 | 1800 → 579 | 68% | 8 / 107 / 464 | 59% (52–65) n=219 | 16% (10–27) n=73 | 11% (7–16) n=179 |
| Pepe Najarro: Working Doubles | played | 567 | 46% (41–51) n=403 | 1014 → 558 | 45% | 242 / 133 / 192 | 58% (51–65) n=196 | 40% (33–48) n=152 | 33% (26–42) n=130 |
| 6th Street Recruits | played | 558 | 46% (41–51) n=398 | 980 → 551 | 44% | 236 / 116 / 206 | 57% (51–64) n=200 | 41% (34–49) n=157 | 33% (25–42) n=110 |
| Johnny Silverhand: Never Stop Fighting | attacked | 547 | 56% (50–63) n=218 | 444 → 379 | 15% | 0 / 128 / 419 | 71% (63–78) n=129 | 75% (62–85) n=53 | 39% (30–48) n=101 |
| Trauma Team Operatives | played | 542 | 44% (39–49) n=386 | 1018 → 520 | 49% | 17 / 238 / 287 | 55% (48–62) n=196 | 39% (27–52) n=57 | 34% (27–41) n=193 |
| Augmented Negotiators | played | 539 | 44% (39–49) n=395 | 1242 → 513 | 59% | 84 / 189 / 266 | 58% (51–66) n=166 | 35% (27–44) n=119 | 34% (28–42) n=174 |
| Detonate | sold | 537 | 45% (40–50) n=377 | 830 → 537 | 35% | 268 / 143 / 126 | 47% (40–54) n=202 | 46% (38–54) n=142 | 32% (24–42) n=111 |
| Trauma Team Operatives | attacked | 536 | 47% (41–52) n=283 | 550 → 475 | 14% | 0 / 94 / 442 | 65% (57–72) n=148 | 59% (45–71) n=51 | 33% (26–40) n=166 |
| The Heist | sold | 518 | 44% (40–50) n=380 | 1049 → 518 | 51% | 158 / 212 / 148 | 52% (45–59) n=193 | 34% (26–43) n=114 | 35% (27–43) n=147 |
| All is Lost | sold | 491 | 44% (39–49) n=374 | 755 → 491 | 35% | 222 / 145 / 124 | 50% (43–57) n=180 | 41% (33–49) n=148 | 35% (27–44) n=106 |

(29 more card uses in the JSON report.)

Legal but never taken: V: Streetkid (Legend play, legal in 1058 turns).

| Decision type | Decisions | First-listed option taken | Options offered (1 / 2 / 3–5 / 6–10 / 11–20 / 21+) |
|---|---|---|---|
| main | 15502 | 9% | 0 / 930 / 3527 / 5554 / 5213 / 278 |
| gig/steal | 2892 | 30% | 165 / 476 / 1310 / 917 / 24 / 0 |
| react | 2265 | 61% | 0 / 1404 / 848 / 13 / 0 / 0 |
| gig/rollIn | 2240 | 0% | 0 / 560 / 1680 / 0 / 0 / 0 |
| gigValue/adjust | 984 | 10% | 0 / 0 / 1 / 64 / 568 / 351 |
| gigValue/setGig | 739 | 8% | 0 / 1 / 5 / 47 / 197 / 489 |
| unit/spend | 609 | 59% | 226 / 173 / 207 / 3 / 0 / 0 |
| mulligan | 560 | 11% | 0 / 560 / 0 / 0 / 0 / 0 |
| mode/mode | 538 | 62% | 0 / 538 / 0 / 0 / 0 / 0 |
| card/search | 519 | 76% | 253 / 125 / 93 / 45 / 3 / 0 |
| mode/muamarCall | 518 | 79% | 0 / 518 / 0 / 0 / 0 / 0 |
| unit/protect | 393 | 56% | 113 / 158 / 117 / 5 / 0 / 0 |
| unit/equip | 233 | 78% | 50 / 84 / 73 / 26 / 0 / 0 |
| unit/ready | 72 | 100% | 0 / 72 / 0 / 0 / 0 / 0 |
| unit/sacrifice | 55 | 78% | 33 / 14 / 8 / 0 / 0 / 0 |
| yesno/draw | 39 | 100% | 0 / 39 / 0 / 0 / 0 / 0 |
| card/defeat | 35 | 97% | 26 / 7 / 2 / 0 / 0 / 0 |
| card/discard | 27 | 41% | 5 / 4 / 16 / 2 / 0 / 0 |
| mode/foolOnTheHill | 8 | 63% | 0 / 8 / 0 / 0 / 0 / 0 |
| yesno/playFree | 3 | 100% | 0 / 3 / 0 / 0 / 0 / 0 |
| mode/rivalChoice | 1 | 0% | 0 / 1 / 0 / 0 / 0 / 0 |

Reaction windows: 1962 attacks. Reacted to 737 (deck won 42% (37–46) n=441): stole 246, attackerGone 10, targetGone 377, bothGone 31, noneGone 73. Let 1225 resolve (42% (37–47) n=398): stole 843, stoleNothing 7, attackerGone 9, targetGone 337, bothGone 29. Choices: endReact 1380, block 450, call 423, play 12.

## Keep 'Em Guessing — 560 games, 19% won, 25913 decisions

| Card | Use | Uses | Win rate in games used (95%) | Legal turns → used | Not chosen | Early / mid / late uses | Ahead | Even | Behind |
|---|---|---|---|---|---|---|---|---|---|
| Jackie Welles: Ride or Die Choom | attacked | 683 | 30% (25–35) n=303 | 658 → 638 | 3% | 0 / 175 / 508 | 53% (44–62) n=114 | 51% (37–64) n=49 | 20% (16–26) n=237 |
| Viktor Vektor: You Might Feel a Little Pinch | played | 597 | 19% (15–23) n=420 | 727 → 578 | 20% | 254 / 174 / 169 | 25% (20–31) n=219 | 15% (10–21) n=162 | 6% (3–12) n=116 |
| Mandibular Upgrade | sold | 592 | 19% (15–23) n=405 | 688 → 592 | 14% | 281 / 143 / 168 | 24% (19–31) n=192 | 15% (10–21) n=150 | 11% (7–17) n=156 |
| Augmented Negotiators | played | 591 | 20% (16–24) n=409 | 942 → 563 | 40% | 174 / 233 / 184 | 29% (23–36) n=195 | 14% (9–21) n=135 | 13% (9–19) n=165 |
| Viktor Vektor: You Might Feel a Little Pinch | attacked | 587 | 19% (15–23) n=321 | 737 → 540 | 27% | 87 / 244 / 256 | 32% (25–40) n=145 | 15% (10–23) n=113 | 12% (8–17) n=173 |
| Jackie Welles: Ride or Die Choom | played | 575 | 23% (19–27) n=411 | 732 → 574 | 22% | 0 / 343 / 232 | 35% (29–41) n=216 | 17% (10–28) n=70 | 9% (6–13) n=208 |
| Sketchy Ripper | played | 571 | 18% (15–23) n=406 | 805 → 548 | 32% | 288 / 114 / 169 | 24% (19–30) n=239 | 13% (8–20) n=126 | 12% (7–19) n=104 |
| Corporate Surveillance | sold | 534 | 19% (15–23) n=384 | 960 → 534 | 44% | 208 / 178 / 148 | 26% (20–33) n=188 | 14% (9–21) n=137 | 14% (9–20) n=139 |
| Secondhand Bombus | played | 533 | 21% (17–25) n=401 | 1171 → 521 | 56% | 138 / 219 / 176 | 28% (22–34) n=238 | 15% (9–23) n=96 | 9% (5–15) n=123 |
| Sketchy Ripper | attacked | 476 | 19% (15–25) n=263 | 792 → 445 | 44% | 97 / 173 / 206 | 28% (22–36) n=156 | 18% (11–29) n=66 | 9% (5–15) n=125 |
| Goro Takemura: Vengeful Bodyguard | called | 460 | 19% (15–23) n=460 | 509 → 460 | 10% | 227 / 137 / 96 | 26% (21–32) n=256 | 11% (7–18) n=126 | 6% (3–14) n=78 |
| River Ward: Detective on the Hunt | called | 457 | 20% (16–24) n=457 | 509 → 457 | 10% | 228 / 142 / 87 | 27% (22–33) n=250 | 12% (8–19) n=131 | 9% (5–18) n=76 |
| Kiroshi Optics | sold | 443 | 20% (16–25) n=349 | 710 → 443 | 38% | 226 / 101 / 116 | 30% (24–37) n=173 | 11% (6–18) n=110 | 10% (5–17) n=102 |
| Dum Dum: Maelstrom Triggerman | called | 416 | 20% (16–24) n=416 | 453 → 416 | 8% | 230 / 132 / 54 | 28% (22–34) n=217 | 11% (7–18) n=140 | 12% (6–23) n=59 |
| Zetatech Faceplate | sold | 404 | 18% (14–22) n=331 | 1159 → 404 | 65% | 86 / 156 / 162 | 23% (17–31) n=131 | 18% (12–28) n=87 | 13% (8–19) n=151 |

(31 more card uses in the JSON report.)

| Decision type | Decisions | First-listed option taken | Options offered (1 / 2 / 3–5 / 6–10 / 11–20 / 21+) |
|---|---|---|---|
| main | 14274 | 10% | 0 / 777 / 3523 / 6299 / 3542 / 133 |
| react | 2672 | 65% | 0 / 1451 / 1202 / 19 / 0 / 0 |
| gig/rollIn | 2240 | 0% | 0 / 560 / 1680 / 0 / 0 / 0 |
| gig/steal | 2145 | 35% | 191 / 386 / 771 / 773 / 24 / 0 |
| unit/equip | 846 | 80% | 174 / 176 / 397 / 99 / 0 / 0 |
| mulligan | 560 | 7% | 0 / 560 / 0 / 0 / 0 / 0 |
| unit/blocker | 408 | 73% | 178 / 137 / 92 / 1 / 0 / 0 |
| card/discard | 388 | 49% | 13 / 72 / 259 / 44 / 0 / 0 |
| unit/ready | 384 | 81% | 0 / 231 / 153 / 0 / 0 / 0 |
| card/search | 299 | 87% | 0 / 200 / 99 / 0 / 0 / 0 |
| unit/pump | 294 | 55% | 81 / 106 / 105 / 2 / 0 / 0 |
| gigValue/adjust | 253 | 23% | 0 / 0 / 2 / 51 / 140 / 60 |
| card/trash | 245 | 53% | 0 / 245 / 0 / 0 / 0 / 0 |
| unit/sacrifice | 232 | 70% | 107 / 88 / 36 / 1 / 0 / 0 |
| card/playFree | 215 | 92% | 167 / 30 / 18 / 0 / 0 / 0 |
| gigValue/setGig | 184 | 7% | 0 / 0 / 17 / 20 / 36 / 111 |
| card/look | 150 | 100% | 69 / 51 / 30 / 0 / 0 / 0 |
| card/defeatGear | 104 | 81% | 0 / 65 / 38 / 1 / 0 / 0 |
| mode/foolOnTheHill | 7 | 57% | 0 / 7 / 0 / 0 / 0 / 0 |
| unit/spend | 7 | 57% | 0 / 3 / 4 / 0 / 0 / 0 |
| yesno/draw | 6 | 100% | 0 / 6 / 0 / 0 / 0 / 0 |

Reaction windows: 2286 attacks. Reacted to 749 (deck won 17% (14–21) n=442): stole 174, attackerGone 9, targetGone 550, bothGone 16. Let 1537 resolve (19% (16–23) n=445): stole 1231, stoleNothing 14, attackerGone 3, targetGone 253, bothGone 36. Choices: call 286, block 561, endReact 1728, ability 97.

## Ladder S1 #1: V / Smasher / Padre (RRG) — 560 games, 62% won, 26065 decisions

| Card | Use | Uses | Win rate in games used (95%) | Legal turns → used | Not chosen | Early / mid / late uses | Ahead | Even | Behind |
|---|---|---|---|---|---|---|---|---|---|
| 6th Street Recruits | attacked | 791 | 67% (61–71) n=341 | 923 → 715 | 23% | 65 / 303 / 423 | 82% (76–87) n=184 | 63% (54–71) n=116 | 63% (56–69) n=207 |
| Pepe Najarro: Working Doubles | attacked | 774 | 69% (64–73) n=339 | 940 → 707 | 25% | 69 / 306 / 399 | 90% (84–93) n=175 | 70% (61–78) n=113 | 60% (54–67) n=212 |
| Animals Wrecker | attacked | 729 | 75% (70–80) n=302 | 690 → 657 | 5% | 0 / 185 / 544 | 91% (86–95) n=149 | 86% (76–92) n=76 | 68% (62–74) n=219 |
| Yorinobu Arasaka: Steel Dragon | played | 524 | 62% (57–67) n=397 | 641 → 524 | 18% | 0 / 215 / 309 | 79% (72–85) n=150 | 64% (51–75) n=58 | 52% (46–59) n=244 |
| Yorinobu Arasaka: Steel Dragon | attacked | 524 | 69% (63–74) n=294 | 538 → 479 | 11% | 0 / 0 / 524 | 88% (82–92) n=168 | 78% (64–87) n=45 | 54% (47–61) n=170 |
| V: Streetkid | attacked | 521 | 53% (47–58) n=297 | 643 → 521 | 19% | 71 / 159 / 291 | 69% (62–75) n=184 | 56% (41–70) n=43 | 38% (30–46) n=144 |
| Peace Offering | sold | 486 | 64% (59–69) n=368 | 1029 → 486 | 53% | 150 / 212 / 124 | 78% (71–84) n=156 | 64% (54–73) n=95 | 55% (48–62) n=178 |
| Pepe Najarro: Working Doubles | played | 483 | 64% (58–68) n=362 | 1009 → 478 | 53% | 257 / 109 / 117 | 77% (70–83) n=158 | 59% (51–66) n=152 | 44% (35–54) n=106 |
| Animals Wrecker | played | 477 | 69% (65–74) n=367 | 721 → 477 | 34% | 0 / 337 / 140 | 80% (73–86) n=143 | 67% (56–76) n=78 | 63% (56–69) n=200 |
| 6th Street Recruits | played | 476 | 63% (58–68) n=357 | 1030 → 468 | 55% | 246 / 104 / 126 | 75% (68–81) n=166 | 58% (50–66) n=145 | 48% (39–58) n=97 |
| Memory Relapse | sold | 441 | 63% (58–68) n=350 | 1396 → 441 | 68% | 60 / 194 / 187 | 72% (64–78) n=141 | 56% (45–67) n=80 | 57% (49–64) n=171 |
| Padre: Man of the Cross | ability | 416 | 51% (45–56) n=292 | 1766 → 416 | 76% | 7 / 71 / 338 | 73% (66–79) n=162 | 29% (19–41) n=62 | 25% (18–33) n=127 |
| Adam Smasher: Ender of Legends | called | 412 | 66% (61–70) n=412 | 412 → 412 | 0% | 181 / 117 / 114 | 72% (67–77) n=275 | 53% (42–64) n=73 | 52% (40–63) n=64 |
| Mantis Blades | sold | 407 | 62% (56–67) n=331 | 580 → 407 | 30% | 260 / 62 / 85 | 67% (59–74) n=156 | 56% (48–64) n=141 | 53% (42–63) n=80 |
| V: Streetkid | called | 404 | 64% (59–69) n=404 | 404 → 404 | 0% | 215 / 99 / 90 | 70% (64–75) n=274 | 49% (38–61) n=69 | 54% (42–66) n=61 |

(35 more card uses in the JSON report.)

Legal but never taken: V: Streetkid (Legend play, legal in 1074 turns), Synapse Burnout (played, legal in 550 turns).

| Decision type | Decisions | First-listed option taken | Options offered (1 / 2 / 3–5 / 6–10 / 11–20 / 21+) |
|---|---|---|---|
| main | 14384 | 8% | 0 / 1145 / 3711 / 5092 / 4207 / 229 |
| gig/steal | 3457 | 29% | 193 / 473 / 1519 / 1262 / 10 / 0 |
| gig/rollIn | 2240 | 0% | 0 / 560 / 1680 / 0 / 0 / 0 |
| react | 1227 | 61% | 0 / 854 / 367 / 6 / 0 / 0 |
| unit/defeat | 645 | 63% | 198 / 204 / 235 / 8 / 0 / 0 |
| mulligan | 560 | 18% | 0 / 560 / 0 / 0 / 0 / 0 |
| mode/mode | 510 | 52% | 0 / 510 / 0 / 0 / 0 / 0 |
| gigValue/setGig | 506 | 8% | 0 / 0 / 7 / 49 / 155 / 295 |
| card/playFree | 502 | 58% | 0 / 107 / 352 / 43 / 0 / 0 |
| card/search | 502 | 64% | 174 / 161 / 129 / 38 / 0 / 0 |
| unit/spend | 378 | 82% | 244 / 93 / 41 / 0 / 0 / 0 |
| unit/equip | 360 | 86% | 50 / 105 / 166 / 39 / 0 / 0 |
| gigValue/adjust | 316 | 5% | 0 / 9 / 56 / 10 / 33 / 208 |
| unit/ready | 216 | 94% | 0 / 179 / 37 / 0 / 0 / 0 |
| unit/adrenaline | 129 | 74% | 71 / 40 / 18 / 0 / 0 / 0 |
| unit/sacrifice | 61 | 77% | 38 / 13 / 9 / 1 / 0 / 0 |
| card/discard | 32 | 50% | 7 / 9 / 14 / 2 / 0 / 0 |
| unit/pump | 15 | 73% | 6 / 1 / 8 / 0 / 0 / 0 |
| yesno/draw | 12 | 100% | 0 / 12 / 0 / 0 / 0 / 0 |
| card/defeat | 6 | 100% | 6 / 0 / 0 / 0 / 0 / 0 |
| mode/rivalChoice | 5 | 20% | 0 / 5 / 0 / 0 / 0 / 0 |
| mode/foolOnTheHill | 2 | 50% | 0 / 2 / 0 / 0 / 0 / 0 |

Reaction windows: 1149 attacks. Reacted to 457 (deck won 52% (47–58) n=328): stole 258, attackerGone 12, targetGone 161, bothGone 26. Let 692 resolve (59% (53–64) n=284): stole 474, stoleNothing 3, attackerGone 3, targetGone 188, bothGone 24. Choices: endReact 746, call 335, play 17, block 129.

## Ladder S1 #10: Jackie / Judy / Hanako (BBG) — 560 games, 51% won, 29509 decisions

| Card | Use | Uses | Win rate in games used (95%) | Legal turns → used | Not chosen | Early / mid / late uses | Ahead | Even | Behind |
|---|---|---|---|---|---|---|---|---|---|
| Jacked-In Voodoo Boy | attacked | 867 | 52% (47–57) n=401 | 839 → 756 | 10% | 161 / 365 / 341 | 65% (59–70) n=257 | 50% (42–58) n=145 | 33% (26–40) n=166 |
| Jacked-In Voodoo Boy | played | 842 | 51% (46–55) n=495 | 1098 → 781 | 29% | 427 / 214 / 201 | 67% (61–72) n=291 | 37% (31–44) n=214 | 23% (16–32) n=96 |
| Delamain: Rideshare AI | played | 659 | 52% (47–56) n=442 | 1535 → 618 | 60% | 186 / 250 / 223 | 65% (59–70) n=271 | 41% (33–48) n=153 | 23% (16–31) n=110 |
| Peace Offering | sold | 553 | 51% (46–56) n=398 | 884 → 553 | 37% | 276 / 113 / 164 | 62% (55–69) n=192 | 46% (39–54) n=158 | 29% (22–38) n=119 |
| Lizzy Wizzy: Delicate Weapon | played | 521 | 52% (47–57) n=377 | 1537 → 512 | 67% | 47 / 229 / 245 | 64% (57–70) n=217 | 49% (39–59) n=92 | 27% (20–35) n=127 |
| Trust No One | sold | 514 | 53% (48–58) n=381 | 865 → 514 | 41% | 196 / 130 / 188 | 67% (60–74) n=190 | 53% (45–61) n=144 | 29% (21–38) n=107 |
| Chrome Reverie | sold | 512 | 55% (50–60) n=395 | 915 → 512 | 44% | 245 / 121 / 146 | 66% (59–72) n=218 | 47% (39–56) n=127 | 38% (29–47) n=104 |
| Placide: Voodoo Sentinel | played | 487 | 49% (44–54) n=391 | 577 → 487 | 16% | 0 / 0 / 487 | 73% (65–79) n=171 | 64% (51–75) n=58 | 25% (19–31) n=199 |
| Judy Álvarez: Braindance Maestro | ability | 485 | 47% (42–53) n=331 | 1898 → 485 | 74% | 30 / 165 / 290 | 63% (57–70) n=216 | 35% (25–47) n=71 | 12% (7–19) n=125 |
| Maman Brigitte: Spirit of Death | played | 482 | 57% (52–61) n=387 | 696 → 482 | 31% | 178 / 148 / 156 | 71% (64–77) n=206 | 50% (41–58) n=125 | 34% (26–44) n=99 |
| Nocturne OP55 N1 | sold | 472 | 51% (46–57) n=344 | 1199 → 472 | 61% | 129 / 193 / 150 | 63% (56–70) n=186 | 46% (37–56) n=106 | 29% (21–38) n=108 |
| Maman Brigitte: Spirit of Death | attacked | 460 | 63% (57–68) n=284 | 546 → 446 | 18% | 0 / 235 / 225 | 81% (74–87) n=143 | 71% (60–79) n=82 | 44% (35–53) n=123 |
| Les Élémens | played | 453 | 52% (47–57) n=352 | 981 → 452 | 54% | 134 / 206 / 113 | 63% (56–69) n=191 | 49% (40–58) n=121 | 36% (27–47) n=85 |
| Hanako Arasaka: Daughter of the Emperor | ability | 438 | 42% (37–48) n=300 | 1770 → 438 | 75% | 21 / 141 / 276 | 59% (51–66) n=162 | 40% (29–52) n=68 | 14% (9–21) n=128 |
| Hanako Arasaka: Daughter of the Emperor | called | 431 | 51% (46–56) n=431 | 431 → 431 | 0% | 163 / 198 / 70 | 63% (57–69) n=251 | 40% (32–49) n=121 | 20% (12–32) n=59 |

(25 more card uses in the JSON report.)

| Decision type | Decisions | First-listed option taken | Options offered (1 / 2 / 3–5 / 6–10 / 11–20 / 21+) |
|---|---|---|---|
| main | 13901 | 9% | 0 / 1144 / 3344 / 5495 / 3690 / 228 |
| gig/rollIn | 2240 | 100% | 0 / 560 / 1680 / 0 / 0 / 0 |
| gig/steal | 2081 | 35% | 206 / 321 / 870 / 676 / 8 / 0 |
| gigValue/adjust | 1608 | 24% | 0 / 42 / 540 / 637 / 337 / 52 |
| unit/bottomdeck | 1472 | 71% | 820 / 310 / 337 / 5 / 0 / 0 |
| card/discard | 1301 | 42% | 106 / 346 / 693 / 154 / 2 / 0 |
| card/search | 1207 | 56% | 0 / 248 / 959 / 0 / 0 / 0 |
| unit/pump | 1181 | 63% | 389 / 310 / 461 / 21 / 0 / 0 |
| react | 856 | 56% | 0 / 613 / 242 / 1 / 0 / 0 |
| mulligan | 560 | 36% | 0 / 560 / 0 / 0 / 0 / 0 |
| card/freePlay | 490 | 60% | 0 / 108 / 289 / 91 / 2 / 0 |
| gig/swapGive | 438 | 40% | 21 / 42 / 205 / 169 / 1 / 0 |
| gig/swapTake | 438 | 35% | 36 / 44 / 206 / 147 / 5 / 0 |
| yesno/discardFor | 342 | 100% | 0 / 342 / 0 / 0 / 0 / 0 |
| yesno/addToHand | 315 | 100% | 0 / 315 / 0 / 0 / 0 / 0 |
| unit/weaken | 228 | 68% | 102 / 70 / 54 / 2 / 0 / 0 |
| unit/cantAttack | 193 | 65% | 85 / 68 / 40 / 0 / 0 / 0 |
| gigValue/setGig | 185 | 18% | 0 / 4 / 20 / 15 / 37 / 109 |
| mode/mode | 163 | 88% | 0 / 19 / 144 / 0 / 0 / 0 |
| unit/spend | 136 | 60% | 54 / 54 / 28 / 0 / 0 / 0 |
| unit/call | 91 | 100% | 0 / 38 / 53 / 0 / 0 / 0 |
| card/discardForNothing | 33 | 0% | 0 / 7 / 16 / 10 / 0 / 0 |
| unit/sacrifice | 32 | 97% | 23 / 6 / 2 / 1 / 0 / 0 |
| yesno/draw | 13 | 100% | 0 / 13 / 0 / 0 / 0 / 0 |
| mode/foolOnTheHill | 5 | 40% | 0 / 5 / 0 / 0 / 0 / 0 |

Reaction windows: 798 attacks. Reacted to 349 (deck won 42% (37–48) n=281): stole 140, stoleNothing 1, attackerGone 2, targetGone 203, bothGone 3. Let 449 resolve (44% (38–50) n=252): stole 332, stoleNothing 1, targetGone 111, bothGone 5. Choices: endReact 476, block 162, call 204, play 14.

## Ladder S1 #2: V / Smasher / Saburo (RRG) — 560 games, 68% won, 24230 decisions

| Card | Use | Uses | Win rate in games used (95%) | Legal turns → used | Not chosen | Early / mid / late uses | Ahead | Even | Behind |
|---|---|---|---|---|---|---|---|---|---|
| Pepe Najarro: Working Doubles | attacked | 930 | 70% (65–75) n=364 | 1067 → 855 | 20% | 115 / 343 / 472 | 84% (79–88) n=219 | 71% (63–78) n=137 | 63% (56–69) n=223 |
| Animals Wrecker | attacked | 668 | 78% (73–83) n=282 | 637 → 608 | 5% | 0 / 181 / 487 | 91% (85–95) n=155 | 85% (74–91) n=65 | 75% (68–80) n=206 |
| Synapse Burnout | sold | 511 | 67% (62–71) n=375 | 802 → 511 | 36% | 265 / 141 / 105 | 74% (67–80) n=185 | 63% (54–70) n=131 | 56% (47–65) n=109 |
| V: Streetkid | attacked | 505 | 58% (52–63) n=299 | 611 → 505 | 17% | 72 / 157 / 276 | 72% (65–78) n=177 | 58% (45–71) n=53 | 50% (42–58) n=136 |
| Yorinobu Arasaka: Steel Dragon | played | 493 | 70% (65–74) n=373 | 718 → 493 | 31% | 0 / 195 / 298 | 90% (84–94) n=134 | 69% (56–80) n=52 | 58% (52–64) n=229 |
| Pepe Najarro: Working Doubles | played | 489 | 67% (62–72) n=376 | 957 → 479 | 50% | 292 / 110 / 87 | 75% (68–81) n=188 | 65% (58–72) n=170 | 46% (34–58) n=61 |
| Yorinobu Arasaka: Steel Dragon | attacked | 463 | 80% (75–84) n=281 | 454 → 432 | 5% | 0 / 0 / 463 | 96% (91–98) n=137 | 94% (85–98) n=53 | 70% (63–76) n=180 |
| Animals Wrecker | played | 458 | 73% (68–77) n=352 | 646 → 458 | 29% | 0 / 337 / 121 | 81% (75–87) n=161 | 71% (59–80) n=68 | 67% (59–74) n=169 |
| Adam Smasher: Ender of Legends | called | 458 | 67% (63–71) n=458 | 458 → 458 | 0% | 195 / 140 / 123 | 77% (72–81) n=324 | 48% (37–59) n=79 | 40% (28–53) n=55 |
| V: Streetkid | called | 438 | 68% (63–72) n=438 | 438 → 438 | 0% | 210 / 134 / 94 | 75% (69–79) n=299 | 47% (36–58) n=77 | 60% (47–71) n=62 |
| Saburo Arasaka: Stubborn Patriarch | called | 431 | 68% (64–72) n=431 | 431 → 431 | 0% | 194 / 132 / 105 | 76% (70–80) n=285 | 59% (48–70) n=69 | 48% (37–59) n=77 |
| Meredith Stout: Stone Cold Corpo | attacked | 427 | 75% (69–80) n=240 | 802 → 413 | 49% | 44 / 135 / 248 | 93% (88–96) n=134 | 72% (61–81) n=78 | 60% (51–68) n=112 |
| Peace Offering | sold | 404 | 67% (62–72) n=319 | 1172 → 404 | 66% | 110 / 177 / 117 | 74% (67–81) n=141 | 68% (57–77) n=81 | 58% (50–66) n=142 |
| Mantis Blades | sold | 390 | 66% (60–71) n=326 | 594 → 390 | 34% | 242 / 58 / 90 | 72% (65–79) n=152 | 62% (53–70) n=131 | 52% (41–63) n=77 |
| Industrial Assembly | sold | 362 | 65% (59–70) n=297 | 1026 → 362 | 65% | 84 / 147 / 131 | 70% (60–78) n=103 | 60% (50–70) n=88 | 61% (52–68) n=142 |

(31 more card uses in the JSON report.)

Legal but never taken: V: Streetkid (Legend play, legal in 1006 turns).

| Decision type | Decisions | First-listed option taken | Options offered (1 / 2 / 3–5 / 6–10 / 11–20 / 21+) |
|---|---|---|---|
| main | 13453 | 9% | 0 / 1250 / 3544 / 4995 / 3562 / 102 |
| gig/steal | 3355 | 30% | 216 / 502 / 1438 / 1191 / 8 / 0 |
| gig/rollIn | 2240 | 0% | 0 / 560 / 1680 / 0 / 0 / 0 |
| react | 1140 | 66% | 0 / 802 / 331 / 7 / 0 / 0 |
| unit/defeat | 825 | 66% | 288 / 264 / 266 / 7 / 0 / 0 |
| card/search | 561 | 60% | 153 / 175 / 189 / 44 / 0 / 0 |
| mulligan | 560 | 41% | 0 / 560 / 0 / 0 / 0 / 0 |
| unit/equip | 437 | 84% | 79 / 104 / 228 / 26 / 0 / 0 |
| card/playFree | 432 | 85% | 0 / 232 / 198 / 2 / 0 / 0 |
| gigValue/adjust | 235 | 9% | 0 / 8 / 71 / 23 / 54 / 79 |
| unit/ready | 187 | 93% | 0 / 161 / 26 / 0 / 0 / 0 |
| unit/spend | 185 | 71% | 97 / 59 / 27 / 2 / 0 / 0 |
| gigValue/setGig | 169 | 12% | 0 / 0 / 9 / 23 / 38 / 99 |
| gig/swapGive | 148 | 37% | 0 / 9 / 119 / 19 / 1 / 0 |
| gig/swapTake | 123 | 56% | 32 / 41 / 32 / 17 / 1 / 0 |
| unit/sacrifice | 66 | 80% | 42 / 9 / 15 / 0 / 0 / 0 |
| card/discard | 49 | 45% | 10 / 6 / 28 / 5 / 0 / 0 |
| unit/pump | 33 | 67% | 14 / 11 / 8 / 0 / 0 / 0 |
| card/defeat | 17 | 100% | 16 / 1 / 0 / 0 / 0 / 0 |
| yesno/draw | 12 | 100% | 0 / 12 / 0 / 0 / 0 / 0 |
| mode/foolOnTheHill | 2 | 0% | 0 / 2 / 0 / 0 / 0 / 0 |
| mode/rivalChoice | 1 | 0% | 0 / 1 / 0 / 0 / 0 / 0 |

Reaction windows: 1036 attacks. Reacted to 353 (deck won 65% (60–71) n=269): stole 160, attackerGone 31, targetGone 133, bothGone 28, noneGone 1. Let 683 resolve (72% (67–77) n=316): stole 528, stoleNothing 7, attackerGone 6, targetGone 117, bothGone 25. Choices: endReact 751, call 208, play 39, block 142.

## Ladder S1 #3: Smasher / Dexter / Saburo (RRG) — 560 games, 66% won, 24657 decisions

| Card | Use | Uses | Win rate in games used (95%) | Legal turns → used | Not chosen | Early / mid / late uses | Ahead | Even | Behind |
|---|---|---|---|---|---|---|---|---|---|
| Pepe Najarro: Working Doubles | attacked | 909 | 70% (65–74) n=358 | 1064 → 831 | 22% | 87 / 388 / 434 | 84% (78–88) n=202 | 65% (56–72) n=130 | 68% (61–73) n=238 |
| Animals Wrecker | attacked | 760 | 74% (69–78) n=315 | 743 → 690 | 7% | 0 / 218 / 542 | 92% (86–95) n=168 | 78% (66–87) n=59 | 68% (61–73) n=226 |
| Dexter DeShawn: Off the Grid | ability | 554 | 62% (57–67) n=369 | 1888 → 554 | 71% | 12 / 101 / 441 | 78% (72–83) n=244 | 32% (21–44) n=57 | 38% (30–46) n=151 |
| 6th Street Recruits | attacked | 544 | 70% (64–75) n=250 | 677 → 520 | 23% | 51 / 225 / 268 | 85% (78–90) n=127 | 68% (57–77) n=87 | 65% (57–72) n=153 |
| Yorinobu Arasaka: Steel Dragon | attacked | 528 | 80% (75–84) n=294 | 519 → 490 | 6% | 0 / 0 / 528 | 96% (91–98) n=158 | 90% (80–95) n=62 | 69% (62–76) n=167 |
| Pepe Najarro: Working Doubles | played | 514 | 65% (61–70) n=393 | 902 → 508 | 44% | 311 / 100 / 103 | 77% (71–82) n=196 | 54% (46–61) n=168 | 53% (42–63) n=83 |
| Animals Wrecker | played | 497 | 69% (64–74) n=375 | 658 → 497 | 24% | 0 / 346 / 151 | 76% (68–82) n=142 | 68% (56–77) n=77 | 64% (57–70) n=199 |
| Yorinobu Arasaka: Steel Dragon | played | 473 | 75% (70–79) n=366 | 606 → 473 | 22% | 0 / 256 / 217 | 83% (75–88) n=133 | 74% (60–85) n=47 | 73% (67–78) n=226 |
| Saburo Arasaka: Stubborn Patriarch | called | 462 | 65% (61–69) n=462 | 462 → 462 | 0% | 239 / 114 / 109 | 72% (67–77) n=298 | 56% (44–66) n=72 | 50% (40–60) n=92 |
| Dexter DeShawn: Off the Grid | called | 452 | 69% (65–73) n=452 | 452 → 452 | 0% | 235 / 135 / 82 | 76% (70–80) n=294 | 57% (45–68) n=70 | 58% (48–68) n=88 |
| Adam Smasher: Ender of Legends | called | 432 | 68% (64–72) n=432 | 432 → 432 | 0% | 232 / 92 / 108 | 75% (70–80) n=289 | 53% (42–63) n=87 | 55% (42–68) n=56 |
| Peace Offering | sold | 426 | 68% (63–73) n=331 | 929 → 426 | 54% | 163 / 162 / 101 | 77% (69–84) n=128 | 57% (48–66) n=107 | 68% (60–75) n=148 |
| Mantis Blades | sold | 411 | 65% (60–70) n=337 | 600 → 411 | 31% | 252 / 62 / 97 | 75% (67–81) n=147 | 54% (46–62) n=147 | 62% (51–72) n=79 |
| Satori: Sword of Saburo | sold | 376 | 68% (63–73) n=306 | 980 → 376 | 62% | 111 / 136 / 129 | 76% (68–83) n=117 | 60% (49–70) n=77 | 67% (59–74) n=144 |
| Detonate | sold | 356 | 65% (59–70) n=302 | 554 → 356 | 36% | 169 / 102 / 85 | 73% (65–80) n=138 | 61% (51–70) n=95 | 57% (47–66) n=95 |

(35 more card uses in the JSON report.)

Legal but never taken: Adam Smasher: Ender of Legends (Legend play, legal in 309 turns).

| Decision type | Decisions | First-listed option taken | Options offered (1 / 2 / 3–5 / 6–10 / 11–20 / 21+) |
|---|---|---|---|
| main | 13585 | 8% | 0 / 1280 / 3872 / 5530 / 2818 / 85 |
| gig/steal | 3569 | 28% | 144 / 478 / 1659 / 1281 / 7 / 0 |
| gig/rollIn | 2240 | 0% | 0 / 560 / 1680 / 0 / 0 / 0 |
| react | 1081 | 67% | 0 / 777 / 298 / 6 / 0 / 0 |
| gigValue/adjust | 690 | 9% | 0 / 0 / 4 / 48 / 428 / 210 |
| unit/defeat | 673 | 61% | 213 / 204 / 250 / 6 / 0 / 0 |
| mulligan | 560 | 21% | 0 / 560 / 0 / 0 / 0 / 0 |
| mode/mode | 526 | 63% | 0 / 526 / 0 / 0 / 0 / 0 |
| card/playFree | 434 | 68% | 0 / 173 / 257 / 4 / 0 / 0 |
| unit/equip | 373 | 86% | 48 / 121 / 168 / 36 / 0 / 0 |
| unit/pump | 337 | 68% | 150 / 106 / 80 / 1 / 0 / 0 |
| unit/spend | 164 | 71% | 92 / 44 / 28 / 0 / 0 / 0 |
| unit/ready | 122 | 100% | 0 / 122 / 0 / 0 / 0 / 0 |
| gigValue/setGig | 110 | 15% | 0 / 0 / 4 / 21 / 31 / 54 |
| unit/sacrifice | 70 | 87% | 54 / 9 / 7 / 0 / 0 / 0 |
| card/discard | 51 | 61% | 11 / 19 / 21 / 0 / 0 / 0 |
| card/search | 47 | 68% | 0 / 22 / 21 / 4 / 0 / 0 |
| card/defeat | 17 | 88% | 13 / 3 / 1 / 0 / 0 / 0 |
| yesno/draw | 4 | 100% | 0 / 4 / 0 / 0 / 0 / 0 |
| mode/foolOnTheHill | 2 | 100% | 0 / 2 / 0 / 0 / 0 / 0 |
| mode/rivalChoice | 2 | 0% | 0 / 2 / 0 / 0 / 0 / 0 |

Reaction windows: 994 attacks. Reacted to 323 (deck won 56% (50–62) n=243): stole 154, attackerGone 20, targetGone 120, bothGone 29. Let 671 resolve (63% (57–68) n=291): stole 514, stoleNothing 3, attackerGone 5, targetGone 120, bothGone 29. Choices: call 216, endReact 725, block 125, play 15.

## Ladder S1 #4: V / Padre / Jackie (RGG) — 560 games, 63% won, 25875 decisions

| Card | Use | Uses | Win rate in games used (95%) | Legal turns → used | Not chosen | Early / mid / late uses | Ahead | Even | Behind |
|---|---|---|---|---|---|---|---|---|---|
| MaxTac AV | attacked | 854 | 68% (63–73) n=291 | 841 → 776 | 8% | 0 / 378 / 476 | 80% (74–85) n=198 | 75% (66–83) n=97 | 60% (53–67) n=172 |
| Jackie Welles: Mama's Favorite | attacked | 737 | 61% (56–65) n=380 | 804 → 737 | 8% | 0 / 292 / 445 | 76% (71–81) n=233 | 59% (47–69) n=70 | 49% (42–56) n=187 |
| MaxTac Squadron | attacked | 663 | 67% (62–72) n=299 | 798 → 619 | 22% | 81 / 266 / 316 | 80% (73–85) n=168 | 65% (56–73) n=125 | 62% (54–69) n=152 |
| Padre: Man of the Cross | ability | 577 | 52% (47–57) n=354 | 1683 → 577 | 66% | 7 / 88 / 482 | 72% (66–78) n=235 | 20% (13–30) n=84 | 17% (11–24) n=133 |
| V: Streetkid | attacked | 548 | 59% (53–64) n=314 | 649 → 548 | 16% | 49 / 163 / 336 | 72% (65–77) n=204 | 67% (56–77) n=70 | 40% (32–49) n=117 |
| MaxTac Squadron | played | 523 | 65% (60–69) n=394 | 997 → 501 | 50% | 256 / 133 / 134 | 74% (68–80) n=191 | 59% (51–66) n=168 | 58% (48–68) n=89 |
| Sandevistan | sold | 513 | 63% (58–68) n=379 | 700 → 513 | 27% | 295 / 122 / 96 | 72% (65–78) n=194 | 53% (45–61) n=150 | 50% (40–60) n=88 |
| Peace Offering | sold | 511 | 64% (58–68) n=370 | 993 → 511 | 49% | 177 / 200 / 134 | 69% (62–75) n=194 | 59% (51–68) n=123 | 61% (52–69) n=123 |
| Meredith Stout: Stone Cold Corpo | played | 484 | 61% (55–65) n=365 | 1356 → 471 | 65% | 151 / 123 / 210 | 72% (64–78) n=160 | 52% (44–60) n=144 | 49% (40–57) n=125 |
| Memory Relapse | sold | 483 | 61% (56–66) n=364 | 1474 → 483 | 67% | 84 / 172 / 227 | 70% (63–76) n=176 | 57% (47–67) n=91 | 47% (39–55) n=146 |
| MaxTac AV | played | 442 | 65% (60–70) n=346 | 720 → 442 | 39% | 219 / 105 / 118 | 75% (69–81) n=183 | 61% (53–69) n=124 | 41% (32–52) n=87 |
| Jackie Welles: Mama's Favorite | called | 425 | 64% (59–68) n=425 | 425 → 425 | 0% | 166 / 163 / 96 | 70% (65–76) n=267 | 55% (45–65) n=89 | 48% (36–59) n=69 |
| Johnny Silverhand: Never Stop Fighting | attacked | 424 | 71% (63–77) n=173 | 306 → 281 | 8% | 0 / 63 / 361 | 90% (83–95) n=105 | 73% (59–84) n=45 | 51% (41–62) n=84 |
| V: Streetkid | called | 415 | 62% (57–66) n=415 | 415 → 415 | 0% | 188 / 125 / 102 | 68% (63–74) n=271 | 43% (33–53) n=91 | 60% (47–72) n=53 |
| Jackie Welles: Mama's Favorite | Go Solo (self-paid 396) | 396 | 60% (55–65) n=396 | 779 → 396 | 49% | 0 / 218 / 178 | 73% (66–79) n=164 | 52% (39–65) n=52 | 50% (43–57) n=180 |

(35 more card uses in the JSON report.)

Legal but never taken: Jackie Welles: Mama's Favorite (Legend play, legal in 779 turns), V: Streetkid (Legend play, legal in 986 turns).

| Decision type | Decisions | First-listed option taken | Options offered (1 / 2 / 3–5 / 6–10 / 11–20 / 21+) |
|---|---|---|---|
| main | 13837 | 7% | 0 / 1370 / 3632 / 5065 / 3706 / 64 |
| gig/steal | 2880 | 34% | 205 / 519 / 1391 / 757 / 8 / 0 |
| gig/rollIn | 2240 | 0% | 0 / 560 / 1680 / 0 / 0 / 0 |
| react | 1697 | 63% | 0 / 1113 / 576 / 8 / 0 / 0 |
| gigValue/setGig | 644 | 7% | 0 / 2 / 9 / 46 / 151 / 436 |
| unit/ready | 602 | 52% | 252 / 241 / 109 / 0 / 0 / 0 |
| mulligan | 560 | 19% | 0 / 560 / 0 / 0 / 0 / 0 |
| unit/equip | 553 | 82% | 144 / 165 / 230 / 14 / 0 / 0 |
| mode/mode | 508 | 58% | 0 / 508 / 0 / 0 / 0 / 0 |
| gig/swapGive | 440 | 32% | 0 / 10 / 344 / 86 / 0 / 0 |
| unit/defeat | 408 | 60% | 157 / 108 / 142 / 1 / 0 / 0 |
| gig/swapTake | 367 | 48% | 81 / 115 / 106 / 63 / 2 / 0 |
| unit/spend | 362 | 76% | 209 / 111 / 41 / 1 / 0 / 0 |
| yesno/replaceDefeat | 282 | 13% | 0 / 282 / 0 / 0 / 0 / 0 |
| card/search | 265 | 83% | 173 / 40 / 32 / 20 / 0 / 0 |
| gigValue/adjust | 92 | 8% | 0 / 0 / 0 / 2 / 42 / 48 |
| card/discard | 69 | 45% | 16 / 16 / 36 / 1 / 0 / 0 |
| unit/sacrifice | 53 | 79% | 33 / 10 / 9 / 1 / 0 / 0 |
| yesno/draw | 14 | 100% | 0 / 14 / 0 / 0 / 0 / 0 |
| mode/foolOnTheHill | 1 | 100% | 0 / 1 / 0 / 0 / 0 / 0 |
| mode/rivalChoice | 1 | 0% | 0 / 1 / 0 / 0 / 0 / 0 |

Reaction windows: 1492 attacks. Reacted to 531 (deck won 58% (53–63) n=376): fizzled 12, stole 181, attackerGone 17, targetGone 292, bothGone 28, noneGone 1. Let 961 resolve (60% (55–65) n=394): stole 683, stoleNothing 9, attackerGone 13, targetGone 226, bothGone 28, noneGone 2. Choices: endReact 1066, call 324, block 293, ability 14.

## Ladder S1 #5: V / Smasher / Dum Dum (RRY) — 560 games, 66% won, 24087 decisions

| Card | Use | Uses | Win rate in games used (95%) | Legal turns → used | Not chosen | Early / mid / late uses | Ahead | Even | Behind |
|---|---|---|---|---|---|---|---|---|---|
| 6th Street Recruits | attacked | 1020 | 71% (67–75) n=405 | 1206 → 932 | 23% | 116 / 323 / 581 | 84% (79–88) n=256 | 71% (63–78) n=155 | 62% (56–68) n=223 |
| Animals Wrecker | attacked | 761 | 70% (65–75) n=331 | 719 → 678 | 6% | 0 / 201 / 560 | 92% (86–95) n=166 | 85% (75–91) n=73 | 64% (57–70) n=231 |
| Rockn' Rockerboy | attacked | 739 | 76% (70–80) n=299 | 802 → 679 | 15% | 0 / 337 / 402 | 89% (84–93) n=188 | 92% (83–97) n=66 | 67% (59–74) n=166 |
| Animals Wrecker | played | 532 | 67% (62–71) n=393 | 746 → 532 | 29% | 0 / 361 / 171 | 75% (69–81) n=194 | 69% (58–79) n=71 | 57% (50–64) n=195 |
| All is Lost | sold | 494 | 69% (64–73) n=359 | 646 → 494 | 24% | 240 / 131 / 123 | 79% (72–84) n=180 | 62% (54–70) n=142 | 57% (48–66) n=110 |
| Rockn' Rockerboy | played | 478 | 71% (66–76) n=355 | 914 → 478 | 48% | 229 / 124 / 125 | 80% (74–85) n=204 | 69% (60–77) n=123 | 52% (42–63) n=86 |
| Yorinobu Arasaka: Steel Dragon | played | 477 | 69% (65–74) n=370 | 667 → 477 | 28% | 0 / 207 / 270 | 85% (79–90) n=158 | 64% (51–76) n=53 | 58% (51–65) n=195 |
| 6th Street Recruits | played | 475 | 69% (64–74) n=373 | 1088 → 472 | 57% | 266 / 127 / 82 | 75% (68–81) n=171 | 65% (58–72) n=188 | 62% (50–72) n=71 |
| Industrial Assembly | sold | 454 | 63% (57–67) n=347 | 868 → 454 | 48% | 153 / 172 / 129 | 64% (56–71) n=158 | 64% (55–72) n=118 | 56% (47–64) n=126 |
| Yorinobu Arasaka: Steel Dragon | attacked | 439 | 75% (70–80) n=273 | 486 → 414 | 15% | 0 / 0 / 439 | 92% (87–95) n=164 | 87% (75–94) n=47 | 59% (50–67) n=127 |
| Zetatech Faceplate | sold | 433 | 64% (58–69) n=338 | 1018 → 433 | 57% | 130 / 165 / 138 | 70% (62–76) n=171 | 57% (46–67) n=86 | 56% (48–65) n=128 |
| V: Streetkid | attacked | 427 | 54% (48–60) n=261 | 499 → 427 | 14% | 70 / 133 / 224 | 68% (60–74) n=173 | 38% (25–54) n=39 | 38% (29–48) n=100 |
| Mantis Blades | sold | 423 | 68% (63–73) n=334 | 595 → 423 | 29% | 267 / 76 / 80 | 77% (70–83) n=169 | 64% (55–72) n=124 | 50% (39–61) n=74 |
| Augmented Negotiators | played | 422 | 64% (59–69) n=330 | 1420 → 406 | 71% | 146 / 121 / 155 | 81% (74–87) n=148 | 45% (36–53) n=130 | 63% (53–72) n=97 |
| Satori: Sword of Saburo | sold | 395 | 65% (60–70) n=319 | 972 → 395 | 59% | 165 / 133 / 97 | 72% (64–79) n=137 | 56% (47–65) n=108 | 63% (54–71) n=114 |

(27 more card uses in the JSON report.)

Legal but never taken: V: Streetkid (Legend play, legal in 953 turns), Adam Smasher: Ender of Legends (Legend play, legal in 276 turns), Appetite for Destruction (played, legal in 331 turns).

| Decision type | Decisions | First-listed option taken | Options offered (1 / 2 / 3–5 / 6–10 / 11–20 / 21+) |
|---|---|---|---|
| main | 13573 | 8% | 0 / 1147 / 3327 / 4918 / 3943 / 238 |
| gig/steal | 3423 | 31% | 272 / 592 / 1517 / 1031 / 11 / 0 |
| gig/rollIn | 2240 | 0% | 0 / 560 / 1680 / 0 / 0 / 0 |
| react | 1377 | 64% | 0 / 843 / 534 / 0 / 0 / 0 |
| unit/defeat | 745 | 63% | 209 / 212 / 298 / 26 / 0 / 0 |
| gigValue/adjust | 624 | 7% | 0 / 11 / 91 / 55 / 181 / 286 |
| mulligan | 560 | 37% | 0 / 560 / 0 / 0 / 0 / 0 |
| card/playFree | 447 | 78% | 0 / 183 / 260 / 4 / 0 / 0 |
| unit/equip | 426 | 83% | 133 / 107 / 159 / 27 / 0 / 0 |
| card/search | 414 | 76% | 224 / 129 / 61 / 0 / 0 / 0 |
| unit/pump | 94 | 54% | 27 / 32 / 34 / 1 / 0 / 0 |
| unit/sacrifice | 64 | 84% | 45 / 11 / 8 / 0 / 0 / 0 |
| card/defeatGear | 53 | 91% | 0 / 34 / 19 / 0 / 0 / 0 |
| card/discard | 34 | 44% | 5 / 4 / 22 / 3 / 0 / 0 |
| yesno/draw | 8 | 100% | 0 / 8 / 0 / 0 / 0 / 0 |
| mode/rivalChoice | 3 | 0% | 0 / 3 / 0 / 0 / 0 / 0 |
| mode/foolOnTheHill | 2 | 100% | 0 / 2 / 0 / 0 / 0 / 0 |

Reaction windows: 1265 attacks. Reacted to 444 (deck won 58% (53–64) n=334): stole 191, stoleNothing 1, attackerGone 1, targetGone 239, bothGone 12. Let 821 resolve (69% (64–74) n=355): stole 573, stoleNothing 2, attackerGone 6, targetGone 191, bothGone 49. Choices: call 284, endReact 878, block 213, ability 2.

## Ladder S1 #6: Dexter / V / Reyes (RRY) — 560 games, 61% won, 27714 decisions

| Card | Use | Uses | Win rate in games used (95%) | Legal turns → used | Not chosen | Early / mid / late uses | Ahead | Even | Behind |
|---|---|---|---|---|---|---|---|---|---|
| 6th Street Recruits | attacked | 925 | 62% (57–67) n=375 | 1052 → 836 | 21% | 95 / 408 / 422 | 74% (67–79) n=209 | 60% (52–67) n=144 | 57% (50–63) n=222 |
| Animals Wrecker | attacked | 742 | 72% (66–76) n=316 | 717 → 673 | 6% | 0 / 192 / 550 | 84% (77–88) n=172 | 81% (72–88) n=95 | 66% (60–72) n=208 |
| V: Streetkid | attacked | 637 | 52% (47–57) n=375 | 771 → 637 | 17% | 91 / 212 / 334 | 66% (60–72) n=228 | 49% (38–60) n=80 | 39% (31–46) n=158 |
| 6th Street Recruits | played | 555 | 62% (57–66) n=407 | 910 → 551 | 39% | 316 / 110 / 129 | 70% (64–76) n=225 | 55% (48–62) n=182 | 46% (35–57) n=70 |
| Meredith Stout: Stone Cold Corpo | attacked | 540 | 63% (57–68) n=297 | 969 → 517 | 47% | 43 / 164 / 333 | 78% (72–84) n=186 | 55% (45–65) n=92 | 44% (36–53) n=124 |
| Yorinobu Arasaka: Steel Dragon | played | 539 | 64% (59–69) n=378 | 643 → 539 | 16% | 0 / 189 / 350 | 75% (68–81) n=174 | 62% (51–72) n=74 | 54% (47–61) n=198 |
| Animals Wrecker | played | 508 | 66% (61–70) n=378 | 702 → 508 | 28% | 0 / 349 / 159 | 71% (64–77) n=170 | 67% (56–76) n=90 | 60% (53–67) n=181 |
| Yorinobu Arasaka: Steel Dragon | attacked | 495 | 69% (63–74) n=277 | 505 → 442 | 12% | 0 / 0 / 495 | 89% (83–93) n=164 | 75% (62–84) n=55 | 52% (44–60) n=143 |
| Dexter DeShawn: Off the Grid | ability | 473 | 50% (44–55) n=333 | 1692 → 473 | 72% | 9 / 67 / 397 | 71% (64–76) n=208 | 25% (16–37) n=60 | 9% (5–15) n=133 |
| Augmented Negotiators | played | 472 | 60% (55–65) n=348 | 1372 → 446 | 67% | 119 / 150 / 203 | 72% (64–78) n=160 | 53% (45–61) n=132 | 51% (41–60) n=104 |
| Muamar Reyes: El Capitán | ability | 470 | 49% (43–54) n=315 | 1715 → 470 | 73% | 19 / 71 / 380 | 68% (61–74) n=205 | 25% (15–37) n=57 | 12% (7–18) n=128 |
| Industrial Assembly | sold | 452 | 60% (55–65) n=344 | 947 → 452 | 52% | 130 / 206 / 116 | 69% (61–76) n=148 | 52% (43–61) n=115 | 60% (51–68) n=128 |
| V: Streetkid | called | 447 | 63% (58–67) n=447 | 447 → 447 | 0% | 222 / 114 / 111 | 64% (58–69) n=321 | 65% (54–75) n=74 | 52% (39–65) n=52 |
| Zetatech Faceplate | sold | 445 | 59% (54–64) n=344 | 1065 → 445 | 58% | 132 / 156 / 157 | 63% (55–69) n=182 | 58% (48–67) n=104 | 50% (41–59) n=120 |
| Meredith Stout: Stone Cold Corpo | played | 413 | 58% (52–63) n=321 | 1123 → 407 | 64% | 180 / 98 / 135 | 69% (61–76) n=143 | 52% (44–61) n=124 | 45% (35–55) n=93 |

(27 more card uses in the JSON report.)

| Decision type | Decisions | First-listed option taken | Options offered (1 / 2 / 3–5 / 6–10 / 11–20 / 21+) |
|---|---|---|---|
| main | 14498 | 8% | 0 / 1174 / 3479 / 5224 / 4405 / 216 |
| gig/steal | 3137 | 30% | 238 / 489 / 1449 / 939 / 22 / 0 |
| gig/rollIn | 2240 | 0% | 0 / 560 / 1680 / 0 / 0 / 0 |
| react | 1911 | 63% | 0 / 1253 / 643 / 15 / 0 / 0 |
| gigValue/adjust | 1509 | 11% | 0 / 8 / 103 / 125 / 866 / 407 |
| unit/defeat | 584 | 71% | 237 / 163 / 155 / 29 / 0 / 0 |
| mulligan | 560 | 20% | 0 / 560 / 0 / 0 / 0 / 0 |
| card/playFree | 520 | 61% | 0 / 117 / 378 / 25 / 0 / 0 |
| card/search | 511 | 70% | 238 / 122 / 103 / 47 / 1 / 0 |
| mode/mode | 507 | 70% | 0 / 507 / 0 / 0 / 0 / 0 |
| mode/muamarCall | 497 | 70% | 0 / 497 / 0 / 0 / 0 / 0 |
| unit/equip | 433 | 87% | 146 / 100 / 149 / 38 / 0 / 0 |
| unit/pump | 343 | 57% | 115 / 129 / 94 / 5 / 0 / 0 |
| unit/protect | 335 | 62% | 122 / 125 / 83 / 5 / 0 / 0 |
| unit/sacrifice | 49 | 78% | 33 / 9 / 6 / 1 / 0 / 0 |
| card/discard | 43 | 49% | 10 / 9 / 17 / 7 / 0 / 0 |
| yesno/draw | 16 | 100% | 0 / 16 / 0 / 0 / 0 / 0 |
| card/defeat | 13 | 92% | 10 / 2 / 1 / 0 / 0 / 0 |
| mode/foolOnTheHill | 6 | 33% | 0 / 6 / 0 / 0 / 0 / 0 |
| mode/rivalChoice | 2 | 0% | 0 / 2 / 0 / 0 / 0 / 0 |

Reaction windows: 1683 attacks. Reacted to 588 (deck won 54% (49–59) n=372): stole 158, attackerGone 29, targetGone 321, bothGone 22, noneGone 58. Let 1095 resolve (62% (57–66) n=400): stole 790, stoleNothing 6, attackerGone 9, targetGone 239, bothGone 51. Choices: endReact 1204, call 287, block 414, play 6.

## Ladder S1 #7: Dexter / V / Padre (RRG) — 560 games, 63% won, 28597 decisions

| Card | Use | Uses | Win rate in games used (95%) | Legal turns → used | Not chosen | Early / mid / late uses | Ahead | Even | Behind |
|---|---|---|---|---|---|---|---|---|---|
| Pepe Najarro: Working Doubles | attacked | 978 | 65% (60–69) n=404 | 1159 → 871 | 25% | 76 / 318 / 584 | 80% (74–84) n=232 | 66% (58–74) n=136 | 57% (50–63) n=249 |
| 6th Street Recruits | attacked | 885 | 66% (61–71) n=362 | 1074 → 799 | 26% | 85 / 285 / 515 | 85% (79–89) n=205 | 68% (59–75) n=128 | 58% (52–65) n=226 |
| Animals Wrecker | attacked | 830 | 71% (66–76) n=339 | 793 → 757 | 5% | 0 / 201 / 629 | 88% (82–92) n=156 | 87% (79–92) n=107 | 66% (60–72) n=248 |
| V: Streetkid | attacked | 641 | 56% (51–61) n=368 | 772 → 641 | 17% | 88 / 187 / 366 | 62% (56–68) n=244 | 57% (45–68) n=72 | 46% (38–54) n=145 |
| Animals Wrecker | played | 555 | 66% (62–71) n=408 | 784 → 555 | 29% | 0 / 351 / 204 | 75% (67–81) n=155 | 67% (58–75) n=106 | 59% (53–66) n=229 |
| Peace Offering | sold | 547 | 59% (54–64) n=391 | 926 → 547 | 41% | 238 / 171 / 138 | 61% (54–68) n=192 | 60% (52–68) n=134 | 50% (42–58) n=147 |
| Yorinobu Arasaka: Steel Dragon | played | 532 | 64% (59–68) n=399 | 657 → 532 | 19% | 0 / 202 / 330 | 78% (71–84) n=162 | 77% (64–86) n=56 | 53% (47–59) n=238 |
| Yorinobu Arasaka: Steel Dragon | attacked | 530 | 73% (68–78) n=297 | 531 → 478 | 10% | 0 / 0 / 530 | 90% (85–94) n=179 | 87% (78–93) n=77 | 55% (46–63) n=139 |
| Pepe Najarro: Working Doubles | played | 521 | 64% (59–68) n=387 | 1063 → 517 | 51% | 261 / 116 / 144 | 71% (64–77) n=177 | 64% (56–71) n=163 | 52% (43–61) n=112 |
| Industrial Assembly | sold | 501 | 61% (56–66) n=370 | 890 → 501 | 44% | 178 / 171 / 152 | 67% (58–74) n=138 | 62% (54–70) n=132 | 55% (48–62) n=172 |
| Memory Relapse | sold | 496 | 64% (59–69) n=356 | 1388 → 496 | 64% | 96 / 220 / 180 | 66% (58–73) n=152 | 61% (51–70) n=94 | 64% (56–70) n=181 |
| 6th Street Recruits | played | 492 | 64% (58–68) n=370 | 962 → 488 | 49% | 245 / 110 / 137 | 71% (64–77) n=175 | 63% (56–71) n=156 | 49% (40–59) n=104 |
| Satori: Sword of Saburo | sold | 471 | 62% (57–67) n=360 | 930 → 471 | 49% | 226 / 141 / 104 | 65% (58–72) n=171 | 59% (50–67) n=133 | 58% (48–66) n=111 |
| Dexter DeShawn: Off the Grid | ability | 465 | 59% (53–64) n=332 | 1824 → 465 | 75% | 15 / 45 / 405 | 77% (71–82) n=234 | 29% (18–42) n=52 | 17% (11–25) n=96 |
| Padre: Man of the Cross | ability | 436 | 55% (50–61) n=310 | 1800 → 436 | 76% | 5 / 59 / 372 | 74% (67–79) n=199 | 35% (24–47) n=63 | 17% (11–26) n=104 |

(24 more card uses in the JSON report.)

Legal but never taken: V: Streetkid (Legend play, legal in 1032 turns).

| Decision type | Decisions | First-listed option taken | Options offered (1 / 2 / 3–5 / 6–10 / 11–20 / 21+) |
|---|---|---|---|
| main | 15791 | 8% | 0 / 1228 / 3795 / 5304 / 5070 / 394 |
| gig/steal | 3776 | 29% | 230 / 495 / 1745 / 1290 / 16 / 0 |
| gig/rollIn | 2240 | 0% | 0 / 560 / 1680 / 0 / 0 / 0 |
| mode/mode | 1025 | 62% | 0 / 1025 / 0 / 0 / 0 / 0 |
| gigValue/adjust | 842 | 8% | 0 / 15 / 82 / 28 / 401 / 316 |
| unit/defeat | 642 | 71% | 240 / 193 / 163 / 46 / 0 / 0 |
| react | 621 | 45% | 0 / 320 / 301 / 0 / 0 / 0 |
| mulligan | 560 | 15% | 0 / 560 / 0 / 0 / 0 / 0 |
| card/playFree | 509 | 62% | 0 / 113 / 357 / 39 / 0 / 0 |
| gigValue/setGig | 501 | 8% | 0 / 1 / 3 / 36 / 121 / 340 |
| card/search | 460 | 70% | 193 / 159 / 107 / 1 / 0 / 0 |
| unit/spend | 406 | 79% | 251 / 104 / 50 / 1 / 0 / 0 |
| unit/pump | 362 | 57% | 102 / 148 / 103 / 9 / 0 / 0 |
| unit/equip | 323 | 79% | 45 / 85 / 150 / 42 / 1 / 0 |
| unit/adrenaline | 291 | 76% | 148 / 89 / 54 / 0 / 0 / 0 |
| unit/ready | 117 | 100% | 0 / 117 / 0 / 0 / 0 / 0 |
| unit/sacrifice | 56 | 71% | 31 / 11 / 14 / 0 / 0 / 0 |
| card/discard | 55 | 53% | 13 / 8 / 29 / 5 / 0 / 0 |
| yesno/draw | 15 | 100% | 0 / 15 / 0 / 0 / 0 / 0 |
| mode/foolOnTheHill | 5 | 80% | 0 / 5 / 0 / 0 / 0 / 0 |

Reaction windows: 621 attacks. Reacted to 339 (deck won 54% (48–60) n=289): stole 253, targetGone 67, bothGone 19. Let 282 resolve (61% (53–68) n=157): stole 220, attackerGone 1, targetGone 53, bothGone 8. Choices: call 339, endReact 282.

## Ladder S1 #8: Smasher / River / Viktor (RYY) — 560 games, 59% won, 26718 decisions

| Card | Use | Uses | Win rate in games used (95%) | Legal turns → used | Not chosen | Early / mid / late uses | Ahead | Even | Behind |
|---|---|---|---|---|---|---|---|---|---|
| Rockn' Rockerboy | attacked | 968 | 64% (59–69) n=343 | 934 → 877 | 6% | 0 / 435 / 533 | 76% (70–81) n=241 | 59% (49–69) n=88 | 52% (45–60) n=170 |
| 6th Street Recruits | attacked | 849 | 65% (60–70) n=338 | 948 → 778 | 18% | 99 / 341 / 409 | 75% (69–80) n=231 | 60% (52–68) n=134 | 57% (49–64) n=153 |
| Johnny Silverhand: Never Stop Fighting | attacked | 786 | 71% (66–76) n=277 | 542 → 502 | 7% | 0 / 104 / 682 | 86% (80–90) n=198 | 71% (59–81) n=62 | 53% (44–62) n=118 |
| Mandibular Upgrade | sold | 659 | 59% (55–64) n=436 | 733 → 659 | 10% | 345 / 141 / 173 | 70% (64–75) n=238 | 48% (40–56) n=161 | 47% (38–56) n=118 |
| Sketchy Ripper | played | 573 | 57% (52–62) n=419 | 960 → 556 | 42% | 301 / 128 / 144 | 69% (64–74) n=288 | 35% (27–43) n=127 | 32% (22–44) n=63 |
| 6th Street Recruits | played | 569 | 62% (57–66) n=414 | 854 → 565 | 34% | 260 / 187 / 122 | 74% (68–79) n=225 | 50% (43–57) n=174 | 50% (39–61) n=78 |
| Rockn' Rockerboy | played | 561 | 61% (57–66) n=402 | 728 → 560 | 23% | 228 / 201 / 132 | 72% (66–77) n=235 | 48% (40–56) n=148 | 49% (39–59) n=98 |
| Johnny Silverhand: Never Stop Fighting | played | 498 | 62% (57–67) n=375 | 955 → 498 | 48% | 0 / 268 / 230 | 75% (68–80) n=224 | 48% (36–61) n=60 | 46% (38–54) n=145 |
| Sketchy Ripper | attacked | 492 | 55% (49–60) n=297 | 838 → 472 | 44% | 147 / 164 / 181 | 69% (62–75) n=188 | 41% (32–52) n=87 | 32% (23–42) n=91 |
| Adam Smasher: Ender of Legends | attacked | 471 | 55% (50–60) n=355 | 505 → 471 | 7% | 0 / 0 / 471 | 85% (79–90) n=168 | 74% (63–83) n=66 | 25% (19–31) n=179 |
| Zetatech Faceplate | sold | 451 | 59% (54–64) n=349 | 1449 → 451 | 69% | 71 / 181 / 199 | 72% (65–78) n=180 | 51% (41–62) n=82 | 46% (37–54) n=134 |
| Adam Smasher: Ender of Legends | called | 423 | 59% (54–63) n=423 | 423 → 423 | 0% | 124 / 167 / 132 | 65% (60–70) n=298 | 55% (43–66) n=64 | 31% (21–44) n=61 |
| Mantis Blades | sold | 421 | 55% (50–61) n=330 | 786 → 421 | 46% | 199 / 97 / 125 | 68% (61–74) n=181 | 44% (35–53) n=103 | 33% (24–44) n=90 |
| River Ward: Detective on the Hunt | called | 408 | 59% (54–63) n=408 | 422 → 408 | 3% | 122 / 179 / 107 | 65% (60–70) n=300 | 47% (36–59) n=70 | 29% (17–45) n=38 |
| Adrenaline Converter | played | 385 | 60% (54–65) n=326 | 939 → 369 | 61% | 112 / 169 / 104 | 70% (63–77) n=175 | 41% (32–51) n=95 | 56% (45–66) n=82 |

(31 more card uses in the JSON report.)

| Decision type | Decisions | First-listed option taken | Options offered (1 / 2 / 3–5 / 6–10 / 11–20 / 21+) |
|---|---|---|---|
| main | 14462 | 8% | 0 / 1142 / 3736 / 6354 / 3107 / 123 |
| gig/steal | 3123 | 39% | 416 / 651 / 1241 / 811 / 4 / 0 |
| gig/rollIn | 2240 | 0% | 0 / 560 / 1680 / 0 / 0 / 0 |
| unit/equip | 1582 | 72% | 319 / 288 / 856 / 119 / 0 / 0 |
| react | 1522 | 66% | 0 / 883 / 636 / 3 / 0 / 0 |
| card/search | 1251 | 72% | 0 / 495 / 753 / 3 / 0 / 0 |
| gigValue/adjust | 628 | 11% | 0 / 0 / 1 / 47 / 290 / 290 |
| mulligan | 560 | 26% | 0 / 560 / 0 / 0 / 0 / 0 |
| unit/defeat | 371 | 39% | 37 / 69 / 250 / 15 / 0 / 0 |
| card/playFree | 321 | 86% | 172 / 102 / 47 / 0 / 0 / 0 |
| card/trash | 284 | 51% | 0 / 284 / 0 / 0 / 0 / 0 |
| unit/sacrifice | 248 | 54% | 76 / 98 / 74 / 0 / 0 / 0 |
| card/discard | 57 | 54% | 9 / 17 / 26 / 5 / 0 / 0 |
| unit/call | 32 | 100% | 0 / 9 / 23 / 0 / 0 / 0 |
| unit/protect | 13 | 77% | 8 / 3 / 2 / 0 / 0 / 0 |
| yesno/call | 10 | 100% | 0 / 10 / 0 / 0 / 0 / 0 |
| yesno/draw | 7 | 100% | 0 / 7 / 0 / 0 / 0 / 0 |
| mode/foolOnTheHill | 6 | 17% | 0 / 6 / 0 / 0 / 0 / 0 |
| mode/rivalChoice | 1 | 0% | 0 / 1 / 0 / 0 / 0 / 0 |

Reaction windows: 1371 attacks. Reacted to 445 (deck won 50% (45–56) n=337): stole 249, stoleNothing 1, attackerGone 9, targetGone 168, bothGone 17, noneGone 1. Let 926 resolve (51% (46–57) n=373): stole 716, stoleNothing 7, attackerGone 1, targetGone 156, bothGone 46. Choices: call 287, endReact 998, block 139, ability 87, play 11.

## Ladder S1 #9: River / Reyes / Rogue (YYY) — 560 games, 44% won, 25335 decisions

| Card | Use | Uses | Win rate in games used (95%) | Legal turns → used | Not chosen | Early / mid / late uses | Ahead | Even | Behind |
|---|---|---|---|---|---|---|---|---|---|
| MaxTac Suppression Team | attacked | 735 | 50% (44–55) n=320 | 836 → 688 | 18% | 0 / 329 / 406 | 62% (55–69) n=204 | 53% (42–64) n=75 | 40% (33–47) n=177 |
| Dexter DeShawn: One Last Chance | attacked | 701 | 49% (43–54) n=319 | 914 → 660 | 28% | 86 / 291 / 324 | 60% (53–67) n=181 | 48% (39–57) n=121 | 39% (32–47) n=157 |
| Rogue Amendiares: Preem Solo | attacked | 677 | 42% (37–46) n=443 | 790 → 677 | 14% | 0 / 199 / 478 | 62% (55–68) n=238 | 49% (38–61) n=67 | 26% (21–32) n=215 |
| Augmented Negotiators | played | 622 | 46% (41–50) n=434 | 1322 → 588 | 56% | 145 / 215 / 262 | 60% (53–66) n=223 | 37% (30–44) n=158 | 27% (20–35) n=141 |
| Muamar Reyes: El Capitán | ability | 620 | 37% (33–42) n=382 | 2114 → 620 | 71% | 62 / 106 / 452 | 55% (49–62) n=228 | 19% (12–29) n=83 | 12% (8–18) n=182 |
| Dexter DeShawn: One Last Chance | played | 604 | 46% (41–50) n=423 | 950 → 569 | 40% | 279 / 179 / 146 | 56% (49–62) n=216 | 42% (35–49) n=180 | 30% (22–40) n=96 |
| Mandibular Upgrade | sold | 598 | 42% (37–47) n=406 | 700 → 598 | 15% | 328 / 130 / 140 | 51% (45–58) n=220 | 35% (28–43) n=155 | 31% (23–40) n=111 |
| MaxTac Suppression Team | played | 569 | 46% (41–51) n=414 | 997 → 567 | 43% | 200 / 163 / 206 | 58% (51–64) n=223 | 42% (34–50) n=129 | 26% (19–34) n=136 |
| Safety Override | sold | 552 | 45% (40–50) n=401 | 1033 → 552 | 47% | 196 / 203 / 153 | 58% (51–65) n=178 | 40% (32–48) n=135 | 30% (24–38) n=159 |
| The Heist | sold | 480 | 46% (41–51) n=361 | 963 → 480 | 50% | 157 / 201 / 122 | 52% (45–59) n=180 | 43% (34–52) n=124 | 36% (28–45) n=119 |
| Rogue Amendiares: Preem Solo | called | 478 | 44% (39–48) n=478 | 478 → 478 | 0% | 285 / 147 / 46 | 50% (45–56) n=305 | 33% (25–41) n=123 | 28% (17–42) n=50 |
| Rogue Amendiares: Preem Solo | Go Solo (self-paid 472) | 472 | 40% (36–45) n=472 | 809 → 472 | 42% | 0 / 231 / 241 | 56% (49–62) n=208 | 35% (24–49) n=51 | 27% (21–33) n=213 |
| River Ward: Detective on the Hunt | called | 453 | 43% (39–48) n=453 | 453 → 453 | 0% | 245 / 112 / 96 | 53% (47–59) n=261 | 32% (25–41) n=133 | 22% (13–34) n=59 |
| Muamar Reyes: El Capitán | called | 442 | 45% (41–50) n=442 | 442 → 442 | 0% | 269 / 108 / 65 | 50% (44–56) n=260 | 38% (31–46) n=146 | 44% (30–60) n=36 |
| Zetatech Faceplate | sold | 435 | 43% (38–48) n=330 | 1409 → 435 | 69% | 52 / 207 / 176 | 57% (49–64) n=150 | 37% (27–48) n=73 | 31% (24–39) n=142 |

(29 more card uses in the JSON report.)

| Decision type | Decisions | First-listed option taken | Options offered (1 / 2 / 3–5 / 6–10 / 11–20 / 21+) |
|---|---|---|---|
| main | 13639 | 9% | 0 / 1190 / 3415 / 5316 / 3595 / 123 |
| gig/steal | 2606 | 35% | 221 / 506 / 1153 / 718 / 8 / 0 |
| gig/rollIn | 2240 | 0% | 0 / 560 / 1680 / 0 / 0 / 0 |
| gigValue/adjust | 2127 | 23% | 0 / 1 / 190 / 392 / 1176 / 368 |
| react | 1740 | 66% | 0 / 1092 / 647 / 1 / 0 / 0 |
| unit/equip | 781 | 78% | 8 / 238 / 519 / 16 / 0 / 0 |
| mulligan | 560 | 37% | 0 / 560 / 0 / 0 / 0 / 0 |
| mode/muamarCall | 530 | 54% | 0 / 530 / 0 / 0 / 0 / 0 |
| unit/protect | 277 | 60% | 127 / 99 / 51 / 0 / 0 / 0 |
| card/trash | 258 | 50% | 0 / 258 / 0 / 0 / 0 / 0 |
| card/playFree | 235 | 91% | 172 / 39 / 23 / 1 / 0 / 0 |
| unit/sacrifice | 199 | 60% | 82 / 73 / 44 / 0 / 0 / 0 |
| card/search | 51 | 78% | 29 / 15 / 7 / 0 / 0 / 0 |
| card/discard | 47 | 38% | 4 / 14 / 28 / 1 / 0 / 0 |
| yesno/playFree | 32 | 100% | 0 / 32 / 0 / 0 / 0 / 0 |
| yesno/draw | 9 | 100% | 0 / 9 / 0 / 0 / 0 / 0 |
| mode/foolOnTheHill | 2 | 100% | 0 / 2 / 0 / 0 / 0 / 0 |
| mode/rivalChoice | 2 | 0% | 0 / 2 / 0 / 0 / 0 / 0 |

Reaction windows: 1535 attacks. Reacted to 487 (deck won 41% (36–46) n=336): stole 198, attackerGone 9, targetGone 214, bothGone 35, noneGone 31. Let 1048 resolve (42% (37–47) n=381): stole 842, stoleNothing 4, attackerGone 5, targetGone 172, bothGone 25. Choices: call 230, endReact 1156, ability 72, block 256, play 26.

## Ladder: Dexter / V / Wakako (RRB) — 560 games, 53% won, 27314 decisions

| Card | Use | Uses | Win rate in games used (95%) | Legal turns → used | Not chosen | Early / mid / late uses | Ahead | Even | Behind |
|---|---|---|---|---|---|---|---|---|---|
| 6th Street Recruits | attacked | 940 | 54% (49–59) n=368 | 1088 → 838 | 23% | 75 / 309 / 556 | 73% (67–79) n=198 | 60% (52–68) n=135 | 42% (35–48) n=233 |
| Psycho Squad | attacked | 814 | 54% (49–59) n=358 | 980 → 742 | 24% | 73 / 274 / 467 | 70% (63–76) n=184 | 60% (51–68) n=129 | 43% (36–49) n=220 |
| Animals Wrecker | attacked | 714 | 61% (55–66) n=310 | 696 → 662 | 5% | 0 / 186 / 528 | 89% (82–93) n=122 | 84% (74–91) n=64 | 53% (47–59) n=244 |
| V: Streetkid | attacked | 617 | 48% (43–53) n=387 | 738 → 617 | 16% | 55 / 140 / 422 | 67% (61–73) n=224 | 63% (49–75) n=49 | 31% (25–38) n=195 |
| Wakako Okada: Peace and Harmony | ability | 573 | 45% (40–50) n=368 | 1778 → 573 | 68% | 27 / 60 / 486 | 68% (61–74) n=224 | 22% (15–32) n=81 | 11% (7–16) n=161 |
| Dexter DeShawn: Off the Grid | ability | 572 | 49% (44–54) n=381 | 1815 → 572 | 68% | 20 / 57 / 495 | 73% (67–78) n=236 | 23% (15–34) n=78 | 13% (9–19) n=155 |
| Yorinobu Arasaka: Steel Dragon | played | 506 | 55% (50–60) n=377 | 602 → 506 | 16% | 0 / 208 / 298 | 72% (64–79) n=134 | 65% (50–78) n=40 | 45% (39–51) n=251 |
| 6th Street Recruits | played | 504 | 55% (50–60) n=366 | 1036 → 500 | 52% | 244 / 107 / 153 | 65% (58–72) n=165 | 56% (48–63) n=153 | 39% (30–47) n=122 |
| Yorinobu Arasaka: Steel Dragon | attacked | 499 | 63% (57–68) n=272 | 507 → 449 | 11% | 0 / 0 / 499 | 89% (83–93) n=151 | 85% (72–93) n=47 | 43% (35–51) n=152 |
| Nocturne OP55 N1 | sold | 496 | 53% (48–58) n=384 | 992 → 496 | 50% | 197 / 198 / 101 | 61% (53–67) n=180 | 48% (39–57) n=117 | 48% (40–56) n=141 |
| Animals Wrecker | played | 488 | 56% (51–61) n=380 | 636 → 488 | 23% | 0 / 336 / 152 | 69% (61–77) n=130 | 64% (54–74) n=87 | 45% (38–52) n=216 |
| Psycho Squad | played | 462 | 50% (45–55) n=347 | 983 → 459 | 53% | 215 / 108 / 139 | 57% (49–64) n=159 | 49% (41–57) n=141 | 38% (29–47) n=112 |
| Bonnie and Clyde | sold | 441 | 52% (47–57) n=336 | 1451 → 441 | 70% | 79 / 152 / 210 | 61% (53–69) n=136 | 64% (52–74) n=72 | 40% (33–47) n=186 |
| V: Streetkid | called | 424 | 52% (47–57) n=424 | 424 → 424 | 0% | 213 / 79 / 132 | 60% (54–65) n=272 | 42% (31–54) n=71 | 35% (25–45) n=81 |
| V: Streetkid | Go Solo (self-paid 424) | 424 | 48% (43–53) n=424 | 1044 → 424 | 59% | 59 / 92 / 273 | 67% (60–73) n=198 | 43% (29–58) n=40 | 29% (23–36) n=186 |

(33 more card uses in the JSON report.)

Legal but never taken: V: Streetkid (Legend play, legal in 1045 turns).

| Decision type | Decisions | First-listed option taken | Options offered (1 / 2 / 3–5 / 6–10 / 11–20 / 21+) |
|---|---|---|---|
| main | 15294 | 7% | 0 / 1232 / 3930 / 5600 / 4299 / 233 |
| gig/steal | 3505 | 28% | 204 / 449 / 1449 / 1386 / 17 / 0 |
| gig/rollIn | 2240 | 0% | 0 / 560 / 1680 / 0 / 0 / 0 |
| gigValue/adjust | 1405 | 6% | 0 / 2 / 15 / 81 / 814 / 493 |
| mode/mode | 1098 | 76% | 0 / 1028 / 70 / 0 / 0 / 0 |
| react | 602 | 49% | 0 / 332 / 270 / 0 / 0 / 0 |
| mulligan | 560 | 15% | 0 / 560 / 0 / 0 / 0 / 0 |
| unit/defeat | 526 | 75% | 243 / 155 / 105 / 23 / 0 / 0 |
| card/playFree | 481 | 71% | 0 / 132 / 322 / 27 / 0 / 0 |
| unit/pump | 420 | 54% | 112 / 149 / 150 / 9 / 0 / 0 |
| unit/weaken | 401 | 73% | 171 / 139 / 88 / 3 / 0 / 0 |
| card/search | 372 | 81% | 208 / 116 / 48 / 0 / 0 / 0 |
| unit/equip | 186 | 80% | 43 / 61 / 61 / 20 / 1 / 0 |
| unit/cantAttack | 75 | 77% | 40 / 19 / 16 / 0 / 0 / 0 |
| card/discard | 46 | 54% | 9 / 13 / 22 / 2 / 0 / 0 |
| unit/sacrifice | 44 | 77% | 24 / 11 / 9 / 0 / 0 / 0 |
| unit/call | 25 | 100% | 0 / 11 / 14 / 0 / 0 / 0 |
| yesno/draw | 23 | 100% | 0 / 23 / 0 / 0 / 0 / 0 |
| mode/foolOnTheHill | 8 | 50% | 0 / 8 / 0 / 0 / 0 / 0 |
| mode/rivalChoice | 3 | 0% | 0 / 3 / 0 / 0 / 0 / 0 |

Reaction windows: 593 attacks. Reacted to 304 (deck won 42% (37–48) n=267): stole 244, stoleNothing 1, targetGone 50, bothGone 9. Let 289 resolve (56% (48–63) n=167): stole 221, targetGone 65, bothGone 3. Choices: call 299, endReact 296, play 7.

## Ladder: Jackie / Alt / Hanako (BBG) — 560 games, 60% won, 27366 decisions

| Card | Use | Uses | Win rate in games used (95%) | Legal turns → used | Not chosen | Early / mid / late uses | Ahead | Even | Behind |
|---|---|---|---|---|---|---|---|---|---|
| Psycho Squad | attacked | 999 | 63% (58–68) n=394 | 1039 → 878 | 15% | 96 / 389 / 514 | 78% (72–82) n=252 | 58% (50–66) n=141 | 47% (40–54) n=192 |
| Psycho Squad | played | 689 | 61% (57–66) n=457 | 1080 → 674 | 38% | 243 / 250 / 196 | 72% (66–77) n=275 | 52% (45–60) n=168 | 41% (32–50) n=120 |
| Valentino Street Racer | played | 666 | 59% (55–64) n=432 | 1251 → 599 | 52% | 127 / 316 / 223 | 72% (67–77) n=264 | 41% (33–50) n=128 | 43% (35–52) n=121 |
| Alt Cunningham: Soulkiller Architect | ability | 650 | 56% (52–61) n=411 | 1905 → 643 | 66% | 5 / 177 / 468 | 72% (67–77) n=289 | 45% (32–58) n=56 | 18% (13–25) n=154 |
| Valentino Street Racer | attacked | 628 | 61% (56–67) n=318 | 744 → 554 | 26% | 35 / 213 / 380 | 80% (74–85) n=194 | 57% (46–67) n=84 | 50% (42–58) n=149 |
| Floor It | sold | 557 | 57% (52–62) n=396 | 761 → 557 | 27% | 281 / 110 / 166 | 70% (63–76) n=191 | 50% (42–58) n=160 | 43% (34–53) n=111 |
| Maman Brigitte: Spirit of Death | attacked | 541 | 66% (61–72) n=289 | 666 → 507 | 24% | 0 / 225 / 316 | 79% (72–84) n=200 | 73% (62–82) n=74 | 46% (36–56) n=94 |
| Maman Brigitte: Spirit of Death | played | 533 | 64% (59–69) n=399 | 1044 → 532 | 49% | 191 / 159 / 183 | 75% (69–80) n=231 | 60% (51–68) n=134 | 44% (35–54) n=108 |
| Hanako Arasaka: Daughter of the Emperor | ability | 526 | 49% (43–54) n=341 | 1883 → 526 | 72% | 13 / 180 / 333 | 70% (63–76) n=210 | 26% (17–38) n=69 | 15% (10–22) n=147 |
| Jackie Welles: Pour One Out For Me | called | 463 | 62% (57–66) n=463 | 463 → 463 | 0% | 209 / 203 / 51 | 69% (64–74) n=337 | 45% (35–56) n=80 | 37% (25–51) n=46 |
| Hanako Arasaka: Daughter of the Emperor | called | 445 | 61% (57–66) n=445 | 445 → 445 | 0% | 188 / 209 / 48 | 68% (63–73) n=335 | 38% (27–49) n=69 | 44% (30–59) n=41 |
| Alt Cunningham: Soulkiller Architect | called | 444 | 60% (56–65) n=444 | 444 → 444 | 0% | 208 / 197 / 39 | 70% (65–75) n=318 | 37% (27–47) n=87 | 36% (23–52) n=39 |
| Pyramid Song | sold | 399 | 59% (54–65) n=313 | 1148 → 399 | 65% | 89 / 176 / 134 | 72% (65–78) n=181 | 53% (41–64) n=72 | 40% (31–50) n=98 |
| Placide: Voodoo Sentinel | played | 384 | 62% (57–67) n=325 | 430 → 384 | 11% | 0 / 0 / 384 | 86% (79–90) n=161 | 75% (61–84) n=51 | 31% (24–39) n=143 |
| Chrome Reverie | sold | 332 | 62% (56–67) n=289 | 557 → 332 | 40% | 163 / 75 / 94 | 71% (63–78) n=155 | 59% (48–69) n=83 | 44% (32–56) n=64 |

(30 more card uses in the JSON report.)

| Decision type | Decisions | First-listed option taken | Options offered (1 / 2 / 3–5 / 6–10 / 11–20 / 21+) |
|---|---|---|---|
| main | 13566 | 7% | 0 / 1277 / 3599 / 5192 / 3385 / 113 |
| gig/steal | 2570 | 31% | 116 / 545 / 1322 / 584 / 3 / 0 |
| gig/rollIn | 2240 | 100% | 0 / 560 / 1680 / 0 / 0 / 0 |
| unit/bottomdeck | 1267 | 73% | 743 / 290 / 231 / 3 / 0 / 0 |
| gigValue/adjust | 1223 | 23% | 0 / 39 / 341 / 458 / 350 / 35 |
| card/discard | 1207 | 56% | 147 / 504 / 535 / 21 / 0 / 0 |
| card/search | 754 | 58% | 0 / 162 / 592 / 0 / 0 / 0 |
| gig/swapGive | 724 | 38% | 13 / 53 / 388 / 268 / 2 / 0 |
| gig/swapTake | 693 | 38% | 62 / 135 / 302 / 187 / 7 / 0 |
| mulligan | 560 | 29% | 0 / 560 / 0 / 0 / 0 / 0 |
| unit/adrenaline | 494 | 56% | 203 / 189 / 102 / 0 / 0 / 0 |
| react | 489 | 46% | 0 / 311 / 178 / 0 / 0 / 0 |
| card/playFromTrash | 411 | 53% | 154 / 119 / 129 / 9 / 0 / 0 |
| yesno/discardFor | 379 | 99% | 0 / 379 / 0 / 0 / 0 / 0 |
| unit/ready | 179 | 100% | 0 / 115 / 64 / 0 / 0 / 0 |
| unit/weaken | 118 | 69% | 42 / 46 / 30 / 0 / 0 / 0 |
| mode/mode | 89 | 89% | 0 / 11 / 78 / 0 / 0 / 0 |
| unit/cantAttack | 86 | 65% | 40 / 35 / 11 / 0 / 0 / 0 |
| unit/spend | 80 | 63% | 34 / 29 / 17 / 0 / 0 / 0 |
| unit/sacrifice | 61 | 82% | 41 / 15 / 5 / 0 / 0 / 0 |
| unit/bottomdeckOwn | 44 | 77% | 24 / 11 / 9 / 0 / 0 / 0 |
| gigValue/setGig | 36 | 8% | 0 / 2 / 1 / 7 / 1 / 25 |
| unit/equip | 28 | 79% | 2 / 3 / 14 / 9 / 0 / 0 |
| card/discardForNothing | 26 | 0% | 0 / 6 / 15 / 5 / 0 / 0 |
| unit/call | 26 | 100% | 0 / 17 / 9 / 0 / 0 / 0 |
| mode/foolOnTheHill | 7 | 43% | 0 / 7 / 0 / 0 / 0 / 0 |
| yesno/draw | 6 | 100% | 0 / 6 / 0 / 0 / 0 / 0 |
| mode/rivalChoice | 3 | 33% | 0 / 3 / 0 / 0 / 0 / 0 |

Reaction windows: 480 attacks. Reacted to 259 (deck won 48% (42–54) n=234): stole 195, attackerGone 3, targetGone 53, bothGone 8. Let 221 resolve (46% (38–55) n=132): stole 147, stoleNothing 1, targetGone 66, bothGone 7. Choices: endReact 223, call 245, play 21.

## Ladder: Smasher / River / Viktor (RYY) — 560 games, 43% won, 23859 decisions

| Card | Use | Uses | Win rate in games used (95%) | Legal turns → used | Not chosen | Early / mid / late uses | Ahead | Even | Behind |
|---|---|---|---|---|---|---|---|---|---|
| 6th Street Recruits | attacked | 745 | 47% (42–53) n=334 | 863 → 661 | 23% | 75 / 252 / 418 | 68% (60–75) n=146 | 51% (42–61) n=107 | 41% (35–48) n=214 |
| Jackie Welles: Ride or Die Choom | attacked | 589 | 56% (51–62) n=289 | 564 → 540 | 4% | 0 / 119 / 470 | 84% (76–90) n=100 | 82% (70–89) n=65 | 49% (42–55) n=212 |
| 6th Street Recruits | played | 567 | 45% (40–49) n=400 | 941 → 552 | 41% | 254 / 142 / 171 | 55% (48–62) n=169 | 39% (32–47) n=150 | 37% (30–45) n=152 |
| Dexter DeShawn: One Last Chance | attacked | 560 | 43% (38–49) n=309 | 719 → 503 | 30% | 29 / 168 / 363 | 64% (56–72) n=129 | 59% (48–70) n=71 | 32% (26–39) n=196 |
| Dexter DeShawn: One Last Chance | played | 548 | 43% (38–48) n=399 | 1093 → 510 | 53% | 156 / 247 / 145 | 51% (44–58) n=175 | 41% (33–49) n=133 | 35% (28–43) n=164 |
| Jackie Welles: Ride or Die Choom | played | 526 | 46% (41–51) n=395 | 884 → 526 | 40% | 0 / 291 / 235 | 68% (60–75) n=148 | 34% (24–46) n=65 | 34% (28–40) n=237 |
| Kerry Eurodyne: The Last Rockerboy | played | 464 | 42% (37–47) n=342 | 1323 → 451 | 66% | 122 / 149 / 193 | 53% (45–61) n=140 | 35% (27–44) n=118 | 34% (27–42) n=153 |
| Gorilla Arms | sold | 462 | 43% (38–48) n=359 | 946 → 462 | 51% | 204 / 127 / 131 | 52% (45–59) n=175 | 42% (33–52) n=95 | 31% (24–38) n=150 |
| River Ward: Detective on the Hunt | called | 446 | 45% (41–50) n=446 | 458 → 446 | 3% | 242 / 113 / 91 | 53% (47–59) n=286 | 41% (31–53) n=73 | 22% (14–32) n=87 |
| Zetatech Faceplate | sold | 437 | 44% (39–49) n=354 | 842 → 437 | 48% | 102 / 197 / 138 | 55% (46–63) n=132 | 38% (28–49) n=82 | 38% (32–46) n=177 |
| Adam Smasher: Ender of Legends | called | 433 | 46% (42–51) n=433 | 433 → 433 | 0% | 217 / 123 / 93 | 54% (48–59) n=280 | 32% (22–43) n=72 | 35% (25–45) n=81 |
| Adam Smasher: Ender of Legends | attacked | 433 | 49% (43–54) n=331 | 452 → 433 | 4% | 0 / 0 / 433 | 90% (83–94) n=120 | 74% (62–83) n=62 | 22% (17–28) n=195 |
| MaxTac Suppression Team | attacked | 415 | 48% (41–54) n=222 | 510 → 401 | 21% | 0 / 183 / 232 | 68% (58–76) n=103 | 50% (36–64) n=42 | 42% (34–50) n=136 |
| Viktor Vektor: Sit Down and Relax | called | 413 | 45% (41–50) n=413 | 427 → 413 | 3% | 194 / 132 / 87 | 53% (47–59) n=271 | 33% (23–46) n=63 | 28% (19–39) n=79 |
| Over the Edge | sold | 408 | 45% (40–50) n=322 | 1446 → 408 | 72% | 37 / 174 / 197 | 58% (49–67) n=108 | 49% (36–62) n=53 | 36% (29–43) n=194 |

(33 more card uses in the JSON report.)

| Decision type | Decisions | First-listed option taken | Options offered (1 / 2 / 3–5 / 6–10 / 11–20 / 21+) |
|---|---|---|---|
| main | 13728 | 8% | 0 / 1096 / 3522 / 5501 / 3451 / 158 |
| gig/steal | 3025 | 27% | 137 / 390 / 1145 / 1343 / 10 / 0 |
| gig/rollIn | 2240 | 0% | 0 / 560 / 1680 / 0 / 0 / 0 |
| gigValue/adjust | 1453 | 16% | 0 / 1 / 85 / 209 / 819 / 339 |
| react | 1191 | 74% | 0 / 730 / 461 / 0 / 0 / 0 |
| mulligan | 560 | 13% | 0 / 560 / 0 / 0 / 0 / 0 |
| unit/defeat | 402 | 37% | 32 / 75 / 257 / 37 / 1 / 0 |
| unit/equip | 376 | 73% | 36 / 80 / 211 / 49 / 0 / 0 |
| card/search | 267 | 92% | 8 / 217 / 42 / 0 / 0 / 0 |
| unit/sacrifice | 184 | 63% | 67 / 70 / 46 / 1 / 0 / 0 |
| card/playFree | 139 | 99% | 130 / 9 / 0 / 0 / 0 / 0 |
| card/trash | 122 | 61% | 0 / 122 / 0 / 0 / 0 / 0 |
| card/discard | 91 | 68% | 8 / 44 / 34 / 5 / 0 / 0 |
| unit/call | 33 | 79% | 0 / 16 / 17 / 0 / 0 / 0 |
| yesno/draw | 23 | 100% | 0 / 23 / 0 / 0 / 0 / 0 |
| unit/protect | 14 | 64% | 4 / 5 / 5 / 0 / 0 / 0 |
| mode/foolOnTheHill | 5 | 60% | 0 / 5 / 0 / 0 / 0 / 0 |
| yesno/playFree | 5 | 100% | 0 / 5 / 0 / 0 / 0 / 0 |
| mode/rivalChoice | 1 | 0% | 0 / 1 / 0 / 0 / 0 / 0 |

Reaction windows: 1131 attacks. Reacted to 297 (deck won 32% (27–38) n=258): stole 236, stoleNothing 1, attackerGone 1, targetGone 44, bothGone 15. Let 834 resolve (40% (35–45) n=320): stole 591, stoleNothing 11, targetGone 212, bothGone 20. Choices: endReact 877, call 257, ability 44, play 13.

## Ladder: V / Smasher / Padre (RRG) — 560 games, 65% won, 26058 decisions

| Card | Use | Uses | Win rate in games used (95%) | Legal turns → used | Not chosen | Early / mid / late uses | Ahead | Even | Behind |
|---|---|---|---|---|---|---|---|---|---|
| Pepe Najarro: Working Doubles | attacked | 766 | 66% (61–71) n=347 | 919 → 683 | 26% | 64 / 225 / 477 | 83% (77–88) n=186 | 67% (58–75) n=106 | 54% (47–61) n=187 |
| MaxTac AV | attacked | 699 | 70% (65–75) n=303 | 773 → 637 | 18% | 0 / 324 / 375 | 78% (72–84) n=195 | 81% (71–88) n=78 | 67% (59–74) n=144 |
| 6th Street Recruits | attacked | 698 | 65% (60–70) n=337 | 857 → 628 | 27% | 67 / 219 / 412 | 82% (76–87) n=188 | 63% (53–71) n=107 | 57% (49–64) n=180 |
| Animals Wrecker | attacked | 695 | 73% (68–78) n=316 | 678 → 634 | 6% | 0 / 188 / 507 | 86% (80–91) n=165 | 85% (76–91) n=80 | 66% (59–72) n=199 |
| Bonnie and Clyde | sold | 516 | 67% (62–72) n=375 | 1339 → 516 | 61% | 112 / 218 / 186 | 74% (67–80) n=187 | 64% (53–73) n=88 | 60% (52–67) n=160 |
| Animals Wrecker | played | 470 | 70% (65–74) n=374 | 661 → 470 | 29% | 0 / 335 / 135 | 78% (71–84) n=146 | 78% (68–86) n=79 | 60% (53–67) n=193 |
| Yorinobu Arasaka: Steel Dragon | attacked | 466 | 72% (66–77) n=274 | 495 → 432 | 13% | 0 / 0 / 466 | 89% (84–93) n=167 | 80% (68–89) n=51 | 58% (50–66) n=138 |
| Yorinobu Arasaka: Steel Dragon | played | 458 | 65% (60–70) n=359 | 566 → 458 | 19% | 0 / 205 / 253 | 75% (68–82) n=151 | 77% (64–86) n=52 | 55% (48–61) n=198 |
| Valentino Street Racer | played | 454 | 62% (57–67) n=343 | 1420 → 424 | 70% | 98 / 154 / 202 | 76% (69–82) n=176 | 53% (44–63) n=105 | 39% (31–49) n=107 |
| MaxTac AV | played | 453 | 68% (63–73) n=349 | 765 → 453 | 41% | 241 / 91 / 121 | 80% (74–85) n=183 | 62% (54–70) n=125 | 51% (42–61) n=103 |
| Over the Edge | sold | 452 | 61% (56–66) n=342 | 1173 → 452 | 61% | 95 / 184 / 173 | 71% (63–78) n=142 | 59% (49–68) n=95 | 49% (41–56) n=156 |
| Pepe Najarro: Working Doubles | played | 451 | 64% (59–69) n=348 | 1169 → 443 | 62% | 184 / 131 / 136 | 72% (65–79) n=167 | 63% (54–70) n=134 | 47% (37–57) n=94 |
| 6th Street Recruits | played | 449 | 65% (60–70) n=346 | 1150 → 440 | 62% | 188 / 106 / 155 | 75% (68–81) n=153 | 61% (53–69) n=141 | 57% (47–67) n=93 |
| Valentino Street Racer | attacked | 444 | 61% (55–67) n=261 | 615 → 401 | 35% | 12 / 105 / 327 | 76% (68–82) n=132 | 73% (61–82) n=70 | 46% (38–55) n=128 |
| V: Streetkid | called | 419 | 67% (62–71) n=419 | 419 → 419 | 0% | 165 / 124 / 130 | 69% (63–74) n=280 | 65% (52–76) n=57 | 61% (50–71) n=82 |

(32 more card uses in the JSON report.)

| Decision type | Decisions | First-listed option taken | Options offered (1 / 2 / 3–5 / 6–10 / 11–20 / 21+) |
|---|---|---|---|
| main | 14398 | 7% | 0 / 1224 / 3650 / 5121 / 4118 / 285 |
| gig/steal | 3735 | 29% | 213 / 558 / 1734 / 1214 / 16 / 0 |
| gig/rollIn | 2240 | 0% | 0 / 560 / 1680 / 0 / 0 / 0 |
| react | 673 | 55% | 0 / 385 / 288 / 0 / 0 / 0 |
| mulligan | 560 | 21% | 0 / 560 / 0 / 0 / 0 / 0 |
| unit/defeat | 538 | 62% | 154 / 171 / 193 / 20 / 0 / 0 |
| mode/mode | 500 | 57% | 0 / 500 / 0 / 0 / 0 / 0 |
| gig/swapGive | 448 | 34% | 0 / 34 / 331 / 81 / 2 / 0 |
| card/playFree | 437 | 66% | 0 / 108 / 302 / 27 / 0 / 0 |
| unit/adrenaline | 396 | 61% | 168 / 129 / 98 / 1 / 0 / 0 |
| gigValue/setGig | 383 | 11% | 0 / 0 / 0 / 29 / 105 / 249 |
| gig/swapTake | 353 | 48% | 74 / 117 / 102 / 60 / 0 / 0 |
| card/search | 331 | 85% | 208 / 100 / 23 / 0 / 0 / 0 |
| unit/spend | 307 | 81% | 183 / 83 / 41 / 0 / 0 / 0 |
| unit/ready | 246 | 92% | 0 / 195 / 51 / 0 / 0 / 0 |
| gigValue/adjust | 204 | 2% | 0 / 0 / 0 / 0 / 12 / 192 |
| unit/equip | 132 | 87% | 19 / 42 / 53 / 18 / 0 / 0 |
| unit/sacrifice | 61 | 84% | 37 / 12 / 12 / 0 / 0 / 0 |
| unit/pump | 44 | 77% | 21 / 10 / 13 / 0 / 0 / 0 |
| card/discard | 39 | 56% | 14 / 5 / 19 / 1 / 0 / 0 |
| yesno/draw | 18 | 100% | 0 / 18 / 0 / 0 / 0 / 0 |
| card/defeat | 8 | 100% | 8 / 0 / 0 / 0 / 0 / 0 |
| mode/foolOnTheHill | 4 | 75% | 0 / 4 / 0 / 0 / 0 / 0 |
| mode/rivalChoice | 3 | 0% | 0 / 3 / 0 / 0 / 0 / 0 |

Reaction windows: 671 attacks. Reacted to 302 (deck won 53% (47–59) n=271): stole 222, targetGone 68, bothGone 12. Let 369 resolve (58% (51–65) n=197): stole 252, stoleNothing 1, targetGone 109, bothGone 7. Choices: call 302, endReact 369, play 2.

## Ladder: V / Smasher / Saburo (RRG) — 560 games, 69% won, 24919 decisions

| Card | Use | Uses | Win rate in games used (95%) | Legal turns → used | Not chosen | Early / mid / late uses | Ahead | Even | Behind |
|---|---|---|---|---|---|---|---|---|---|
| Pepe Najarro: Working Doubles | attacked | 788 | 69% (64–73) n=344 | 958 → 709 | 26% | 59 / 276 / 453 | 81% (76–86) n=205 | 70% (61–78) n=105 | 61% (54–68) n=198 |
| Animals Wrecker | attacked | 721 | 78% (73–83) n=289 | 697 → 645 | 7% | 0 / 181 / 540 | 90% (85–94) n=155 | 92% (84–96) n=83 | 73% (66–79) n=195 |
| 6th Street Recruits | attacked | 708 | 70% (64–74) n=328 | 895 → 641 | 28% | 61 / 215 / 432 | 86% (80–90) n=176 | 69% (58–77) n=86 | 63% (56–69) n=200 |
| Memory Relapse | sold | 546 | 70% (66–75) n=401 | 952 → 546 | 43% | 188 / 214 / 144 | 76% (69–81) n=181 | 66% (57–74) n=118 | 65% (58–72) n=172 |
| Yorinobu Arasaka: Steel Dragon | attacked | 506 | 80% (75–84) n=299 | 504 → 470 | 7% | 0 / 0 / 506 | 96% (91–98) n=161 | 92% (83–97) n=63 | 67% (60–74) n=166 |
| V: Streetkid | attacked | 497 | 59% (54–65) n=276 | 597 → 497 | 17% | 58 / 141 / 298 | 72% (65–78) n=190 | 57% (42–71) n=42 | 44% (36–53) n=120 |
| Bonnie and Clyde | sold | 496 | 70% (65–75) n=375 | 1301 → 496 | 62% | 105 / 202 / 189 | 78% (71–84) n=152 | 72% (62–79) n=109 | 62% (55–69) n=172 |
| Yorinobu Arasaka: Steel Dragon | played | 495 | 71% (67–76) n=382 | 598 → 495 | 17% | 0 / 197 / 298 | 83% (76–89) n=131 | 75% (63–84) n=63 | 64% (58–70) n=237 |
| MaxTac AV | attacked | 481 | 73% (67–78) n=233 | 586 → 456 | 22% | 0 / 230 / 251 | 84% (77–89) n=145 | 84% (72–92) n=51 | 62% (53–71) n=117 |
| 6th Street Recruits | played | 455 | 68% (63–73) n=329 | 1042 → 443 | 57% | 189 / 127 / 139 | 77% (69–83) n=141 | 62% (54–70) n=137 | 60% (50–68) n=109 |
| Animals Wrecker | played | 452 | 73% (68–77) n=347 | 652 → 452 | 31% | 0 / 318 / 134 | 80% (72–86) n=124 | 79% (68–87) n=70 | 68% (61–75) n=186 |
| Pepe Najarro: Working Doubles | played | 438 | 66% (61–71) n=339 | 1011 → 436 | 57% | 206 / 116 / 116 | 77% (70–83) n=167 | 60% (52–68) n=142 | 51% (41–62) n=82 |
| Valentino Street Racer | attacked | 437 | 69% (64–75) n=262 | 615 → 400 | 35% | 20 / 100 / 317 | 86% (79–90) n=152 | 73% (61–82) n=63 | 54% (45–63) n=118 |
| Valentino Street Racer | played | 431 | 68% (63–73) n=336 | 1298 → 399 | 69% | 95 / 160 / 176 | 82% (75–87) n=152 | 63% (54–71) n=111 | 52% (43–61) n=109 |
| V: Streetkid | called | 430 | 68% (64–72) n=430 | 430 → 430 | 0% | 198 / 124 / 108 | 72% (67–77) n=301 | 63% (51–73) n=70 | 54% (42–66) n=59 |

(33 more card uses in the JSON report.)

Legal but never taken: V: Streetkid (Legend play, legal in 1143 turns).

| Decision type | Decisions | First-listed option taken | Options offered (1 / 2 / 3–5 / 6–10 / 11–20 / 21+) |
|---|---|---|---|
| main | 14145 | 6% | 0 / 1126 / 3738 / 5308 / 3740 / 233 |
| gig/steal | 4151 | 29% | 247 / 567 / 1934 / 1385 / 18 / 0 |
| gig/rollIn | 2240 | 0% | 0 / 560 / 1680 / 0 / 0 / 0 |
| react | 623 | 59% | 0 / 346 / 277 / 0 / 0 / 0 |
| mulligan | 560 | 17% | 0 / 560 / 0 / 0 / 0 / 0 |
| unit/defeat | 551 | 59% | 147 / 174 / 202 / 28 / 0 / 0 |
| card/playFree | 483 | 67% | 0 / 100 / 348 / 35 / 0 / 0 |
| unit/adrenaline | 391 | 60% | 163 / 135 / 93 / 0 / 0 / 0 |
| card/search | 344 | 88% | 220 / 101 / 22 / 1 / 0 / 0 |
| gig/swapGive | 335 | 36% | 0 / 16 / 241 / 74 / 4 / 0 |
| gig/swapTake | 274 | 48% | 56 / 84 / 81 / 53 / 0 / 0 |
| gigValue/adjust | 236 | 3% | 0 / 0 / 0 / 1 / 27 / 208 |
| unit/ready | 225 | 92% | 0 / 186 / 39 / 0 / 0 / 0 |
| unit/equip | 135 | 84% | 30 / 33 / 49 / 23 / 0 / 0 |
| unit/sacrifice | 51 | 76% | 29 / 12 / 10 / 0 / 0 / 0 |
| unit/spend | 50 | 68% | 20 / 22 / 8 / 0 / 0 / 0 |
| card/discard | 48 | 58% | 12 / 11 / 22 / 3 / 0 / 0 |
| unit/pump | 38 | 82% | 18 / 10 / 10 / 0 / 0 / 0 |
| yesno/draw | 17 | 100% | 0 / 17 / 0 / 0 / 0 / 0 |
| card/defeat | 14 | 100% | 14 / 0 / 0 / 0 / 0 / 0 |
| mode/foolOnTheHill | 7 | 57% | 0 / 7 / 0 / 0 / 0 / 0 |
| mode/rivalChoice | 1 | 0% | 0 / 1 / 0 / 0 / 0 / 0 |

Reaction windows: 618 attacks. Reacted to 255 (deck won 63% (57–69) n=231): stole 209, attackerGone 1, targetGone 44, bothGone 1. Let 363 resolve (68% (61–74) n=190): stole 266, targetGone 81, bothGone 16. Choices: call 254, endReact 365, play 4.

## NC-01 Rockerboy Express (RRY) — 560 games, 55% won, 24510 decisions

| Card | Use | Uses | Win rate in games used (95%) | Legal turns → used | Not chosen | Early / mid / late uses | Ahead | Even | Behind |
|---|---|---|---|---|---|---|---|---|---|
| Animals Wrecker | attacked | 832 | 64% (58–69) n=329 | 756 → 732 | 3% | 0 / 194 / 638 | 79% (72–84) n=185 | 75% (65–83) n=80 | 54% (47–60) n=217 |
| Rockn' Rockerboy | attacked | 719 | 60% (54–65) n=313 | 805 → 668 | 17% | 0 / 320 / 399 | 73% (67–79) n=196 | 75% (65–84) n=77 | 52% (45–60) n=170 |
| 6th Street Recruits | attacked | 655 | 53% (48–59) n=316 | 790 → 620 | 22% | 93 / 253 / 309 | 69% (61–76) n=149 | 52% (43–61) n=118 | 45% (38–53) n=162 |
| Animals Wrecker | played | 546 | 59% (55–64) n=395 | 650 → 546 | 16% | 0 / 383 / 163 | 70% (63–76) n=182 | 58% (47–69) n=72 | 49% (43–56) n=207 |
| Detonate | sold | 528 | 55% (50–60) n=385 | 666 → 528 | 21% | 315 / 105 / 108 | 64% (57–70) n=201 | 50% (42–58) n=143 | 46% (37–55) n=111 |
| 6th Street Recruits | played | 522 | 53% (48–58) n=382 | 1067 → 513 | 52% | 260 / 113 / 149 | 62% (55–68) n=188 | 46% (39–53) n=170 | 47% (37–57) n=92 |
| Dexter DeShawn: Off the Grid | ability | 502 | 49% (44–54) n=349 | 1681 → 502 | 70% | 8 / 72 / 422 | 71% (64–77) n=207 | 25% (16–36) n=69 | 20% (14–27) n=153 |
| Zetatech Faceplate | sold | 480 | 56% (51–61) n=365 | 975 → 480 | 51% | 148 / 205 / 127 | 66% (58–73) n=158 | 45% (35–54) n=103 | 54% (46–62) n=154 |
| Rockn' Rockerboy | played | 475 | 57% (51–62) n=364 | 749 → 475 | 37% | 218 / 147 / 110 | 66% (59–72) n=190 | 55% (46–63) n=126 | 38% (29–48) n=103 |
| Mantis Blades | sold | 444 | 54% (49–59) n=359 | 598 → 444 | 26% | 297 / 53 / 94 | 62% (54–69) n=178 | 51% (43–59) n=148 | 40% (30–51) n=80 |
| Adam Smasher: Ender of Legends | called | 436 | 53% (49–58) n=436 | 436 → 436 | 0% | 177 / 133 / 126 | 60% (54–65) n=305 | 43% (31–56) n=58 | 34% (24–46) n=73 |
| Dexter DeShawn: Off the Grid | called | 418 | 56% (51–61) n=418 | 418 → 418 | 0% | 169 / 151 / 98 | 63% (58–69) n=263 | 42% (30–55) n=55 | 44% (35–54) n=100 |
| River Ward: Detective on the Hunt | called | 415 | 54% (49–59) n=415 | 415 → 415 | 0% | 157 / 148 / 110 | 61% (55–67) n=277 | 47% (35–59) n=64 | 34% (24–45) n=74 |
| Kerry Eurodyne: The Last Rockerboy | played | 401 | 51% (46–57) n=313 | 1536 → 372 | 76% | 122 / 73 / 206 | 65% (57–73) n=139 | 45% (36–55) n=108 | 33% (25–43) n=100 |
| Industrial Assembly | sold | 396 | 55% (50–61) n=311 | 770 → 396 | 49% | 147 / 149 / 100 | 60% (51–69) n=111 | 51% (43–60) n=125 | 52% (43–61) n=123 |

(31 more card uses in the JSON report.)

Legal but never taken: Adam Smasher: Ender of Legends (Legend play, legal in 230 turns).

| Decision type | Decisions | First-listed option taken | Options offered (1 / 2 / 3–5 / 6–10 / 11–20 / 21+) |
|---|---|---|---|
| main | 13729 | 8% | 0 / 1153 / 3620 / 5428 / 3421 / 107 |
| gig/steal | 3227 | 28% | 175 / 509 / 1399 / 1136 / 8 / 0 |
| gig/rollIn | 2240 | 0% | 0 / 560 / 1680 / 0 / 0 / 0 |
| react | 1474 | 74% | 0 / 886 / 586 / 2 / 0 / 0 |
| gigValue/adjust | 1202 | 11% | 0 / 12 / 126 / 96 / 690 / 278 |
| mulligan | 560 | 23% | 0 / 560 / 0 / 0 / 0 / 0 |
| mode/mode | 509 | 71% | 0 / 509 / 0 / 0 / 0 / 0 |
| unit/defeat | 476 | 58% | 124 / 162 / 178 / 12 / 0 / 0 |
| unit/pump | 374 | 53% | 103 / 129 / 138 / 4 / 0 / 0 |
| unit/equip | 270 | 80% | 41 / 90 / 120 / 19 / 0 / 0 |
| card/defeatGear | 113 | 60% | 0 / 81 / 32 / 0 / 0 / 0 |
| card/trash | 84 | 57% | 0 / 84 / 0 / 0 / 0 / 0 |
| card/playFree | 77 | 97% | 63 / 12 / 2 / 0 / 0 / 0 |
| unit/sacrifice | 65 | 88% | 36 / 18 / 11 / 0 / 0 / 0 |
| card/discard | 51 | 53% | 11 / 15 / 25 / 0 / 0 / 0 |
| card/search | 31 | 58% | 0 / 12 / 12 / 7 / 0 / 0 |
| card/defeat | 11 | 100% | 10 / 1 / 0 / 0 / 0 / 0 |
| yesno/draw | 9 | 100% | 0 / 9 / 0 / 0 / 0 / 0 |
| mode/foolOnTheHill | 6 | 67% | 0 / 6 / 0 / 0 / 0 / 0 |
| mode/rivalChoice | 2 | 0% | 0 / 2 / 0 / 0 / 0 / 0 |

Reaction windows: 1371 attacks. Reacted to 344 (deck won 44% (38–49) n=282): stole 182, attackerGone 20, targetGone 123, bothGone 19. Let 1027 resolve (52% (47–57) n=382): stole 739, stoleNothing 8, attackerGone 3, targetGone 238, bothGone 39. Choices: call 253, endReact 1098, block 104, ability 17, play 2.

## NC-02 Stormrider Stampede (GGR) — 560 games, 54% won, 25330 decisions

| Card | Use | Uses | Win rate in games used (95%) | Legal turns → used | Not chosen | Early / mid / late uses | Ahead | Even | Behind |
|---|---|---|---|---|---|---|---|---|---|
| MaxTac AV | attacked | 805 | 58% (52–63) n=305 | 796 → 721 | 9% | 0 / 381 / 424 | 70% (63–76) n=197 | 70% (59–78) n=82 | 47% (39–55) n=155 |
| 6th Street Recruits | attacked | 703 | 50% (45–56) n=322 | 802 → 653 | 19% | 72 / 256 / 375 | 67% (60–73) n=181 | 60% (50–69) n=102 | 36% (29–44) n=166 |
| Pepe Najarro: Working Doubles | attacked | 637 | 51% (46–57) n=307 | 723 → 595 | 18% | 61 / 258 / 318 | 71% (63–78) n=149 | 54% (45–64) n=101 | 42% (35–49) n=173 |
| Sandayu Oda: Hanako's Guardian | attacked | 532 | 59% (53–64) n=304 | 572 → 507 | 11% | 0 / 131 / 401 | 75% (68–81) n=185 | 73% (60–83) n=55 | 43% (35–51) n=138 |
| Corporate Surveillance | sold | 523 | 54% (49–59) n=385 | 1046 → 523 | 50% | 187 / 190 / 146 | 68% (61–75) n=173 | 47% (39–55) n=130 | 43% (36–51) n=155 |
| Detonate | sold | 517 | 56% (51–61) n=375 | 770 → 517 | 33% | 248 / 145 / 124 | 64% (57–71) n=191 | 54% (45–62) n=130 | 48% (39–57) n=121 |
| Valentino Street Racer | attacked | 516 | 52% (46–58) n=273 | 634 → 464 | 27% | 23 / 157 / 336 | 70% (62–77) n=160 | 50% (38–62) n=68 | 38% (30–47) n=131 |
| 6th Street Recruits | played | 508 | 53% (48–58) n=373 | 1037 → 502 | 52% | 219 / 142 / 147 | 61% (54–68) n=180 | 48% (40–56) n=143 | 36% (28–46) n=110 |
| Synapse Burnout | sold | 506 | 56% (51–61) n=383 | 741 → 506 | 32% | 245 / 133 / 128 | 62% (55–68) n=204 | 53% (44–61) n=118 | 48% (39–57) n=119 |
| Valentino Street Racer | played | 492 | 51% (46–56) n=359 | 1287 → 449 | 65% | 105 / 223 / 164 | 65% (57–71) n=172 | 44% (35–53) n=108 | 37% (29–45) n=134 |
| MaxTac AV | played | 486 | 54% (49–59) n=356 | 671 → 486 | 28% | 214 / 171 / 101 | 68% (60–74) n=170 | 52% (43–61) n=125 | 33% (26–42) n=129 |
| Pepe Najarro: Working Doubles | played | 472 | 50% (45–55) n=363 | 1031 → 468 | 55% | 203 / 151 / 118 | 57% (49–65) n=156 | 46% (38–54) n=144 | 40% (31–48) n=124 |
| Padre: Man of the Cross | ability | 471 | 44% (38–49) n=309 | 1834 → 471 | 74% | 3 / 106 / 362 | 59% (52–65) n=199 | 21% (13–33) n=61 | 17% (12–25) n=126 |
| Peace Offering | sold | 436 | 55% (50–60) n=331 | 1107 → 436 | 61% | 100 / 234 / 102 | 61% (52–68) n=137 | 55% (45–64) n=99 | 49% (41–57) n=139 |
| Adam Smasher: Ender of Legends | called | 423 | 54% (49–59) n=423 | 423 → 423 | 0% | 168 / 177 / 78 | 58% (52–63) n=295 | 48% (36–61) n=56 | 42% (31–53) n=72 |

(28 more card uses in the JSON report.)

Legal but never taken: Adam Smasher: Ender of Legends (Legend play, legal in 187 turns).

| Decision type | Decisions | First-listed option taken | Options offered (1 / 2 / 3–5 / 6–10 / 11–20 / 21+) |
|---|---|---|---|
| main | 13571 | 8% | 0 / 1214 / 3912 / 6011 / 2380 / 54 |
| gig/steal | 3255 | 30% | 161 / 556 / 1514 / 1009 / 15 / 0 |
| gig/rollIn | 2240 | 0% | 0 / 560 / 1680 / 0 / 0 / 0 |
| react | 1057 | 59% | 0 / 680 / 374 / 3 / 0 / 0 |
| unit/ready | 780 | 74% | 0 / 390 / 378 / 12 / 0 / 0 |
| unit/spend | 642 | 76% | 344 / 196 / 102 / 0 / 0 / 0 |
| mulligan | 560 | 14% | 0 / 560 / 0 / 0 / 0 / 0 |
| gigValue/setGig | 557 | 8% | 0 / 0 / 8 / 49 / 178 / 322 |
| mode/mode | 521 | 60% | 0 / 521 / 0 / 0 / 0 / 0 |
| gig/swapGive | 485 | 33% | 0 / 31 / 380 / 73 / 1 / 0 |
| gig/swapTake | 397 | 48% | 69 / 131 / 128 / 69 / 0 / 0 |
| unit/adrenaline | 388 | 56% | 166 / 139 / 83 / 0 / 0 / 0 |
| unit/equip | 299 | 89% | 37 / 105 / 141 / 16 / 0 / 0 |
| gigValue/adjust | 187 | 6% | 0 / 0 / 0 / 2 / 18 / 167 |
| unit/defeat | 174 | 46% | 10 / 36 / 124 / 4 / 0 / 0 |
| unit/sacrifice | 61 | 79% | 36 / 15 / 10 / 0 / 0 / 0 |
| card/discard | 57 | 56% | 14 / 13 / 30 / 0 / 0 / 0 |
| card/search | 33 | 58% | 0 / 12 / 18 / 3 / 0 / 0 |
| unit/pump | 27 | 74% | 6 / 15 / 6 / 0 / 0 / 0 |
| card/defeat | 19 | 100% | 17 / 2 / 0 / 0 / 0 / 0 |
| yesno/draw | 9 | 100% | 0 / 9 / 0 / 0 / 0 / 0 |
| mode/foolOnTheHill | 7 | 43% | 0 / 7 / 0 / 0 / 0 / 0 |
| mode/rivalChoice | 4 | 25% | 0 / 4 / 0 / 0 / 0 / 0 |

Reaction windows: 964 attacks. Reacted to 400 (deck won 47% (41–52) n=314): stole 230, stoleNothing 3, attackerGone 19, targetGone 125, bothGone 23. Let 564 resolve (54% (48–59) n=269): stole 404, stoleNothing 1, attackerGone 1, targetGone 140, bothGone 18. Choices: endReact 622, block 93, call 313, play 29.

## NC-03 Static Shock (BBR) — 560 games, 37% won, 26915 decisions

| Card | Use | Uses | Win rate in games used (95%) | Legal turns → used | Not chosen | Early / mid / late uses | Ahead | Even | Behind |
|---|---|---|---|---|---|---|---|---|---|
| 6th Street Recruits | attacked | 783 | 39% (34–45) n=325 | 864 → 696 | 19% | 65 / 305 / 413 | 56% (49–63) n=186 | 43% (34–53) n=104 | 25% (19–32) n=178 |
| Psycho Squad | attacked | 767 | 37% (32–43) n=316 | 842 → 701 | 17% | 88 / 305 / 374 | 55% (48–62) n=180 | 32% (24–41) n=119 | 27% (21–34) n=163 |
| Wakako Okada: Peace and Harmony | ability | 606 | 30% (26–35) n=381 | 1706 → 606 | 64% | 6 / 124 / 476 | 46% (40–53) n=224 | 17% (10–27) n=76 | 6% (3–10) n=196 |
| Alt Cunningham: Soulkiller Architect | ability | 605 | 32% (27–36) n=397 | 1738 → 605 | 65% | 1 / 102 / 502 | 50% (43–56) n=227 | 25% (16–37) n=63 | 8% (5–12) n=209 |
| Jacked-In Voodoo Boy | played | 566 | 34% (29–38) n=410 | 1010 → 534 | 47% | 195 / 230 / 141 | 43% (38–50) n=253 | 19% (13–28) n=99 | 17% (12–25) n=115 |
| Dexter DeShawn: Off the Grid | ability | 564 | 31% (26–35) n=370 | 1740 → 564 | 68% | 1 / 137 / 426 | 47% (41–54) n=217 | 23% (14–35) n=61 | 5% (3–9) n=185 |
| 6th Street Recruits | played | 556 | 37% (32–42) n=399 | 817 → 550 | 33% | 207 / 189 / 160 | 46% (39–52) n=206 | 33% (26–41) n=136 | 23% (17–31) n=133 |
| Psycho Squad | played | 540 | 35% (30–40) n=383 | 810 → 534 | 34% | 207 / 185 / 148 | 46% (39–53) n=211 | 27% (20–35) n=141 | 19% (12–27) n=113 |
| Floor It | sold | 466 | 34% (29–39) n=355 | 797 → 466 | 42% | 221 / 122 / 123 | 40% (33–47) n=166 | 37% (29–45) n=135 | 22% (16–31) n=107 |
| Alt Cunningham: Soulkiller Architect | called | 432 | 37% (32–41) n=432 | 432 → 432 | 0% | 157 / 188 / 87 | 44% (39–50) n=313 | 14% (8–25) n=63 | 20% (11–32) n=56 |
| Dexter DeShawn: Off the Grid | called | 421 | 36% (32–41) n=421 | 421 → 421 | 0% | 152 / 200 / 69 | 42% (36–48) n=293 | 26% (16–40) n=53 | 21% (14–32) n=75 |
| Jacked-In Voodoo Boy | attacked | 413 | 40% (34–46) n=228 | 403 → 350 | 13% | 56 / 119 / 238 | 53% (44–61) n=137 | 35% (23–49) n=49 | 29% (21–39) n=100 |
| Wakako Okada: Peace and Harmony | called | 388 | 37% (33–42) n=388 | 388 → 388 | 0% | 149 / 166 / 73 | 42% (36–48) n=274 | 27% (17–41) n=51 | 27% (18–39) n=63 |
| Trust No One | sold | 387 | 35% (30–40) n=303 | 688 → 387 | 44% | 199 / 100 / 88 | 45% (37–54) n=141 | 29% (21–37) n=122 | 23% (15–34) n=78 |
| Meredith Stout: Stone Cold Corpo | played | 384 | 34% (29–39) n=326 | 967 → 381 | 61% | 68 / 152 / 164 | 48% (41–56) n=153 | 36% (26–47) n=73 | 18% (12–26) n=128 |

(35 more card uses in the JSON report.)

| Decision type | Decisions | First-listed option taken | Options offered (1 / 2 / 3–5 / 6–10 / 11–20 / 21+) |
|---|---|---|---|
| main | 14007 | 8% | 0 / 1205 / 3567 / 5880 / 3301 / 54 |
| gig/steal | 2446 | 33% | 159 / 515 / 1062 / 690 / 20 / 0 |
| gig/rollIn | 2240 | 100% | 0 / 560 / 1680 / 0 / 0 / 0 |
| react | 1635 | 66% | 0 / 1079 / 547 / 9 / 0 / 0 |
| gigValue/adjust | 1584 | 9% | 0 / 19 / 50 / 115 / 943 / 457 |
| mode/mode | 1059 | 80% | 0 / 1059 / 0 / 0 / 0 / 0 |
| unit/weaken | 622 | 64% | 220 / 170 / 227 / 5 / 0 / 0 |
| mulligan | 560 | 7% | 0 / 560 / 0 / 0 / 0 / 0 |
| unit/bottomdeck | 473 | 86% | 366 / 58 / 44 / 5 / 0 / 0 |
| card/search | 469 | 55% | 0 / 84 / 383 / 2 / 0 / 0 |
| card/discard | 449 | 60% | 106 / 217 / 126 / 0 / 0 / 0 |
| unit/pump | 436 | 45% | 83 / 193 / 157 / 3 / 0 / 0 |
| card/playFromTrash | 352 | 80% | 217 / 97 / 38 / 0 / 0 / 0 |
| card/freePlay | 180 | 79% | 0 / 100 / 80 / 0 / 0 / 0 |
| yesno/discardFor | 133 | 100% | 0 / 133 / 0 / 0 / 0 / 0 |
| unit/cantAttack | 88 | 50% | 26 / 29 / 32 / 1 / 0 / 0 |
| unit/equip | 73 | 85% | 11 / 8 / 40 / 14 / 0 / 0 |
| unit/sacrifice | 54 | 83% | 38 / 8 / 7 / 1 / 0 / 0 |
| unit/call | 30 | 100% | 0 / 10 / 20 / 0 / 0 / 0 |
| card/defeat | 9 | 89% | 7 / 2 / 0 / 0 / 0 / 0 |
| mode/foolOnTheHill | 8 | 75% | 0 / 8 / 0 / 0 / 0 / 0 |
| yesno/draw | 6 | 100% | 0 / 6 / 0 / 0 / 0 / 0 |
| card/discardForNothing | 2 | 0% | 0 / 2 / 0 / 0 / 0 / 0 |

Reaction windows: 1482 attacks. Reacted to 493 (deck won 32% (27–37) n=359): stole 222, stoleNothing 7, attackerGone 33, targetGone 206, bothGone 25. Let 989 resolve (35% (30–40) n=365): stole 667, stoleNothing 5, attackerGone 4, targetGone 279, bothGone 34. Choices: call 315, endReact 1075, block 219, play 26.

## NC-04 Chrome Rockers (YYR) — 560 games, 49% won, 25679 decisions

| Card | Use | Uses | Win rate in games used (95%) | Legal turns → used | Not chosen | Early / mid / late uses | Ahead | Even | Behind |
|---|---|---|---|---|---|---|---|---|---|
| Rockn' Rockerboy | attacked | 832 | 57% (52–62) n=330 | 861 → 765 | 11% | 0 / 373 / 459 | 69% (63–75) n=209 | 63% (52–73) n=79 | 48% (41–55) n=169 |
| 6th Street Recruits | attacked | 695 | 51% (46–57) n=321 | 813 → 647 | 20% | 81 / 257 / 357 | 64% (57–71) n=174 | 55% (46–64) n=123 | 41% (33–49) n=148 |
| Rockn' Rockerboy | played | 566 | 52% (47–56) n=411 | 749 → 566 | 24% | 218 / 185 / 163 | 60% (54–67) n=222 | 51% (43–59) n=143 | 33% (25–41) n=129 |
| Detonate | sold | 550 | 49% (44–54) n=389 | 737 → 550 | 25% | 298 / 129 / 123 | 53% (46–59) n=218 | 51% (43–59) n=143 | 39% (30–49) n=100 |
| Zetatech Faceplate | sold | 533 | 46% (41–51) n=396 | 1454 → 533 | 63% | 67 / 219 / 247 | 55% (48–61) n=196 | 53% (43–64) n=86 | 33% (26–40) n=174 |
| Meredith Stout: Stone Cold Corpo | played | 528 | 50% (45–55) n=401 | 1378 → 515 | 63% | 93 / 164 / 271 | 58% (51–65) n=195 | 53% (43–62) n=108 | 39% (32–47) n=161 |
| 6th Street Recruits | played | 513 | 48% (44–53) n=390 | 1071 → 507 | 53% | 242 / 129 / 142 | 56% (49–63) n=191 | 51% (43–59) n=152 | 28% (20–37) n=104 |
| MaxTac Suppression Team | attacked | 510 | 52% (46–58) n=251 | 562 → 474 | 16% | 0 / 159 / 351 | 65% (57–72) n=145 | 70% (57–81) n=54 | 39% (31–48) n=132 |
| Dexter DeShawn: One Last Chance | played | 502 | 47% (42–52) n=372 | 1156 → 476 | 59% | 146 / 171 / 185 | 57% (50–64) n=190 | 40% (32–48) n=142 | 26% (18–35) n=109 |
| Dexter DeShawn: One Last Chance | attacked | 488 | 46% (40–52) n=274 | 644 → 452 | 30% | 44 / 153 / 291 | 65% (57–73) n=132 | 51% (41–62) n=84 | 29% (22–37) n=142 |
| The Heist | sold | 478 | 49% (43–54) n=371 | 934 → 478 | 49% | 155 / 208 / 115 | 57% (49–64) n=164 | 46% (38–55) n=121 | 39% (32–48) n=140 |
| MaxTac Suppression Team | played | 461 | 49% (44–55) n=352 | 1089 → 460 | 58% | 67 / 204 / 190 | 59% (52–66) n=187 | 44% (34–55) n=88 | 40% (32–49) n=132 |
| Mantis Blades | sold | 454 | 49% (44–55) n=346 | 768 → 454 | 41% | 242 / 85 / 127 | 56% (48–63) n=185 | 56% (47–64) n=122 | 27% (19–36) n=97 |
| River Ward: Detective on the Hunt | called | 446 | 49% (44–54) n=446 | 446 → 446 | 0% | 168 / 164 / 114 | 54% (49–60) n=317 | 51% (39–63) n=65 | 22% (14–33) n=64 |
| Royce: Psycho on the Edge | called | 441 | 49% (44–54) n=441 | 441 → 441 | 0% | 165 / 173 / 103 | 54% (49–59) n=322 | 39% (28–51) n=62 | 32% (21–44) n=57 |

(28 more card uses in the JSON report.)

Legal but never taken: Royce: Psycho on the Edge (Legend play, legal in 1126 turns), Safety Override (played, legal in 769 turns).

| Decision type | Decisions | First-listed option taken | Options offered (1 / 2 / 3–5 / 6–10 / 11–20 / 21+) |
|---|---|---|---|
| main | 14212 | 9% | 0 / 1262 / 3673 / 5485 / 3632 / 160 |
| gig/steal | 3253 | 32% | 266 / 614 / 1335 / 1023 / 15 / 0 |
| gig/rollIn | 2240 | 0% | 0 / 560 / 1680 / 0 / 0 / 0 |
| react | 2067 | 73% | 0 / 1339 / 725 / 3 / 0 / 0 |
| gigValue/adjust | 1421 | 16% | 0 / 0 / 95 / 159 / 776 / 391 |
| unit/equip | 757 | 67% | 88 / 166 / 408 / 95 / 0 / 0 |
| card/search | 568 | 84% | 20 / 352 / 189 / 6 / 1 / 0 |
| mulligan | 560 | 23% | 0 / 560 / 0 / 0 / 0 / 0 |
| card/trash | 210 | 48% | 0 / 210 / 0 / 0 / 0 / 0 |
| card/playFree | 185 | 97% | 154 / 26 / 5 / 0 / 0 / 0 |
| unit/sacrifice | 92 | 65% | 40 / 22 / 29 / 1 / 0 / 0 |
| card/discard | 41 | 56% | 11 / 10 / 20 / 0 / 0 / 0 |
| unit/protect | 21 | 52% | 3 / 9 / 9 / 0 / 0 / 0 |
| card/defeat | 20 | 90% | 16 / 3 / 1 / 0 / 0 / 0 |
| yesno/playFree | 12 | 100% | 0 / 12 / 0 / 0 / 0 / 0 |
| yesno/draw | 11 | 100% | 0 / 11 / 0 / 0 / 0 / 0 |
| mode/foolOnTheHill | 8 | 50% | 0 / 8 / 0 / 0 / 0 / 0 |
| mode/rivalChoice | 1 | 0% | 0 / 1 / 0 / 0 / 0 / 0 |

Reaction windows: 1890 attacks. Reacted to 496 (deck won 44% (39–49) n=348): stole 220, stoleNothing 2, attackerGone 27, targetGone 204, bothGone 43. Let 1394 resolve (47% (43–52) n=436): stole 971, stoleNothing 10, attackerGone 4, targetGone 367, bothGone 42. Choices: ability 96, endReact 1513, call 256, block 176, play 26.

## NC-05 Emperor's Guard (GGB) — 560 games, 49% won, 26315 decisions

| Card | Use | Uses | Win rate in games used (95%) | Legal turns → used | Not chosen | Early / mid / late uses | Ahead | Even | Behind |
|---|---|---|---|---|---|---|---|---|---|
| MaxTac AV | attacked | 891 | 56% (51–61) n=341 | 908 → 820 | 10% | 0 / 418 / 473 | 70% (63–76) n=216 | 61% (51–71) n=85 | 50% (43–57) n=197 |
| Psycho Squad | attacked | 788 | 52% (47–57) n=335 | 836 → 708 | 15% | 64 / 275 / 449 | 71% (64–77) n=185 | 51% (42–60) n=118 | 43% (36–50) n=188 |
| Pepe Najarro: Working Doubles | attacked | 702 | 49% (43–54) n=311 | 766 → 645 | 16% | 65 / 261 / 376 | 69% (62–75) n=174 | 53% (44–63) n=101 | 38% (31–45) n=172 |
| MaxTac AV | played | 602 | 50% (46–55) n=423 | 851 → 597 | 30% | 259 / 143 / 200 | 65% (58–71) n=233 | 44% (36–53) n=136 | 30% (24–38) n=148 |
| Corporate Surveillance | sold | 601 | 50% (45–54) n=418 | 799 → 601 | 25% | 299 / 118 / 184 | 62% (55–68) n=217 | 41% (33–48) n=158 | 33% (25–41) n=135 |
| Corpo Security | played | 569 | 49% (44–53) n=402 | 969 → 541 | 44% | 221 / 179 / 169 | 59% (52–65) n=239 | 36% (27–45) n=112 | 33% (25–42) n=117 |
| Psycho Squad | played | 558 | 49% (44–53) n=400 | 1063 → 548 | 48% | 180 / 200 / 178 | 60% (53–67) n=177 | 37% (30–46) n=139 | 41% (33–48) n=153 |
| Riot Shield | sold | 537 | 49% (44–54) n=395 | 653 → 537 | 18% | 280 / 111 / 146 | 59% (53–66) n=217 | 42% (34–50) n=139 | 36% (28–45) n=114 |
| Pepe Najarro: Working Doubles | played | 536 | 47% (42–52) n=392 | 1084 → 523 | 52% | 175 / 173 / 188 | 60% (53–67) n=169 | 45% (37–53) n=146 | 37% (29–45) n=145 |
| Peace Offering | sold | 508 | 48% (44–53) n=392 | 1056 → 508 | 52% | 190 / 163 / 155 | 61% (54–67) n=195 | 44% (35–53) n=116 | 35% (27–43) n=147 |
| Floor It | sold | 466 | 49% (44–54) n=362 | 972 → 466 | 52% | 181 / 159 / 126 | 63% (55–70) n=167 | 39% (31–47) n=124 | 43% (35–52) n=118 |
| Goro Takemura: Vengeful Bodyguard | called | 424 | 46% (41–51) n=424 | 424 → 424 | 0% | 167 / 156 / 101 | 54% (48–60) n=280 | 34% (24–45) n=74 | 24% (16–35) n=70 |
| Hanako Arasaka: Daughter of the Emperor | called | 418 | 48% (43–53) n=418 | 418 → 418 | 0% | 145 / 168 / 105 | 58% (52–64) n=289 | 23% (15–34) n=74 | 27% (17–40) n=55 |
| Sandayu Oda: Hanako's Guardian | attacked | 408 | 52% (46–58) n=240 | 454 → 400 | 12% | 0 / 92 / 316 | 76% (68–83) n=126 | 60% (46–72) n=50 | 30% (23–39) n=120 |
| Hanako Arasaka: Daughter of the Emperor | ability | 405 | 38% (32–44) n=283 | 1645 → 405 | 75% | 2 / 76 / 327 | 59% (51–66) n=160 | 22% (14–33) n=64 | 9% (5–16) n=121 |

(31 more card uses in the JSON report.)

Legal but never taken: Corporate Surveillance (played, legal in 762 turns).

| Decision type | Decisions | First-listed option taken | Options offered (1 / 2 / 3–5 / 6–10 / 11–20 / 21+) |
|---|---|---|---|
| main | 13948 | 7% | 0 / 1101 / 3671 / 6104 / 2968 / 104 |
| gig/steal | 2803 | 30% | 109 / 510 / 1315 / 845 / 24 / 0 |
| gig/rollIn | 2240 | 100% | 0 / 560 / 1680 / 0 / 0 / 0 |
| react | 1860 | 62% | 0 / 1162 / 685 / 13 / 0 / 0 |
| unit/ready | 1018 | 76% | 0 / 522 / 477 / 19 / 0 / 0 |
| gig/swapGive | 1004 | 38% | 7 / 63 / 607 / 325 / 2 / 0 |
| gig/swapTake | 897 | 40% | 109 / 163 / 339 / 274 / 12 / 0 |
| mulligan | 560 | 12% | 0 / 560 / 0 / 0 / 0 / 0 |
| gigValue/adjust | 309 | 22% | 0 / 23 / 94 / 104 / 72 / 16 |
| unit/adrenaline | 302 | 47% | 111 / 112 / 78 / 1 / 0 / 0 |
| unit/defeat | 296 | 59% | 97 / 91 / 107 / 1 / 0 / 0 |
| card/discard | 262 | 50% | 15 / 59 / 187 / 1 / 0 / 0 |
| unit/spend | 257 | 69% | 115 / 93 / 49 / 0 / 0 / 0 |
| unit/blocker | 251 | 53% | 75 / 93 / 83 / 0 / 0 / 0 |
| gigValue/setGig | 116 | 4% | 0 / 0 / 6 / 14 / 27 / 69 |
| unit/weaken | 99 | 59% | 21 / 36 / 42 / 0 / 0 / 0 |
| unit/sacrifice | 53 | 85% | 30 / 13 / 10 / 0 / 0 / 0 |
| unit/equip | 27 | 78% | 5 / 0 / 14 / 8 / 0 / 0 |
| yesno/draw | 6 | 100% | 0 / 6 / 0 / 0 / 0 / 0 |
| mode/foolOnTheHill | 5 | 60% | 0 / 5 / 0 / 0 / 0 / 0 |
| mode/rivalChoice | 2 | 0% | 0 / 2 / 0 / 0 / 0 / 0 |

Reaction windows: 1611 attacks. Reacted to 575 (deck won 44% (39–49) n=387): stole 168, attackerGone 24, targetGone 350, bothGone 33. Let 1036 resolve (44% (39–49) n=375): stole 682, stoleNothing 10, attackerGone 1, targetGone 254, bothGone 89. Choices: endReact 1152, block 363, call 263, ability 40, play 42.

## NC-06 Metal Over Meat (YYY) — 560 games, 37% won, 21703 decisions

| Card | Use | Uses | Win rate in games used (95%) | Legal turns → used | Not chosen | Early / mid / late uses | Ahead | Even | Behind |
|---|---|---|---|---|---|---|---|---|---|
| Rockn' Rockerboy | attacked | 775 | 41% (36–46) n=315 | 840 → 714 | 15% | 0 / 345 / 430 | 59% (52–67) n=165 | 48% (36–59) n=69 | 29% (23–35) n=206 |
| Safety Override | sold | 636 | 37% (33–42) n=421 | 739 → 636 | 14% | 338 / 139 / 159 | 48% (41–55) n=208 | 33% (27–40) n=175 | 26% (20–34) n=145 |
| MaxTac Suppression Team | attacked | 580 | 43% (38–49) n=270 | 662 → 545 | 18% | 0 / 198 / 382 | 65% (57–72) n=139 | 61% (48–72) n=56 | 26% (20–33) n=164 |
| Rockn' Rockerboy | played | 551 | 36% (32–41) n=401 | 708 → 551 | 22% | 197 / 189 / 165 | 49% (42–56) n=184 | 31% (24–39) n=138 | 21% (15–28) n=144 |
| Augmented Negotiators | played | 497 | 41% (36–46) n=375 | 1320 → 470 | 64% | 145 / 141 / 211 | 54% (47–62) n=156 | 37% (30–46) n=142 | 28% (21–36) n=135 |
| Secondhand Bombus | played | 454 | 40% (35–45) n=351 | 1735 → 438 | 75% | 50 / 170 / 234 | 50% (43–57) n=193 | 29% (19–41) n=66 | 27% (20–35) n=134 |
| River Ward: Detective on the Hunt | called | 445 | 35% (31–40) n=445 | 445 → 445 | 0% | 256 / 113 / 76 | 43% (37–50) n=235 | 27% (21–35) n=146 | 23% (15–35) n=64 |
| Live with the Aftermath | sold | 443 | 39% (34–45) n=332 | 1096 → 443 | 60% | 127 / 151 / 165 | 53% (45–60) n=152 | 36% (27–47) n=91 | 25% (19–33) n=138 |
| Dum Dum: Maelstrom Triggerman | called | 435 | 37% (33–42) n=435 | 435 → 435 | 0% | 236 / 124 / 75 | 48% (41–54) n=220 | 30% (22–38) n=132 | 20% (13–30) n=83 |
| Muamar Reyes: El Capitán | ability | 433 | 37% (32–43) n=295 | 1872 → 433 | 77% | 59 / 85 / 289 | 63% (55–70) n=152 | 20% (12–30) n=71 | 14% (9–21) n=126 |
| MaxTac Suppression Team | played | 426 | 39% (34–44) n=337 | 1023 → 426 | 58% | 106 / 188 / 132 | 49% (42–57) n=166 | 41% (31–52) n=80 | 22% (16–30) n=134 |
| Muamar Reyes: El Capitán | called | 423 | 37% (32–42) n=423 | 423 → 423 | 0% | 240 / 107 / 76 | 50% (44–57) n=229 | 24% (17–32) n=134 | 15% (8–26) n=60 |
| Jackie Welles: Ride or Die Choom | played | 423 | 37% (32–42) n=334 | 964 → 423 | 56% | 0 / 177 / 246 | 61% (52–70) n=116 | 47% (33–61) n=45 | 21% (16–27) n=206 |
| Jackie Welles: Ride or Die Choom | attacked | 395 | 49% (42–55) n=214 | 400 → 378 | 6% | 0 / 60 / 335 | 86% (76–92) n=70 | 78% (64–87) n=45 | 38% (31–46) n=156 |
| Gorilla Arms | sold | 381 | 37% (32–42) n=319 | 644 → 381 | 41% | 180 / 124 / 77 | 46% (38–54) n=159 | 35% (27–45) n=102 | 23% (15–32) n=93 |

(31 more card uses in the JSON report.)

Legal but never taken: Safety Override (played, legal in 698 turns).

| Decision type | Decisions | First-listed option taken | Options offered (1 / 2 / 3–5 / 6–10 / 11–20 / 21+) |
|---|---|---|---|
| main | 12491 | 9% | 0 / 919 / 3197 / 5181 / 3052 / 142 |
| gig/steal | 2253 | 31% | 89 / 386 / 796 / 974 / 8 / 0 |
| gig/rollIn | 2240 | 0% | 0 / 560 / 1680 / 0 / 0 / 0 |
| react | 1946 | 64% | 0 / 1054 / 885 / 7 / 0 / 0 |
| gigValue/adjust | 892 | 20% | 0 / 2 / 99 / 179 / 476 / 136 |
| mulligan | 560 | 50% | 0 / 560 / 0 / 0 / 0 / 0 |
| mode/muamarCall | 516 | 57% | 0 / 516 / 0 / 0 / 0 / 0 |
| unit/protect | 273 | 38% | 62 / 83 / 125 / 3 / 0 / 0 |
| card/defeatGear | 106 | 84% | 0 / 86 / 20 / 0 / 0 / 0 |
| card/discard | 100 | 73% | 6 / 48 / 39 / 7 / 0 / 0 |
| unit/sacrifice | 96 | 65% | 33 / 43 / 20 / 0 / 0 / 0 |
| unit/pump | 90 | 21% | 12 / 21 / 55 / 2 / 0 / 0 |
| unit/defeat | 58 | 98% | 50 / 8 / 0 / 0 / 0 / 0 |
| unit/equip | 51 | 84% | 6 / 19 / 23 / 3 / 0 / 0 |
| yesno/draw | 10 | 100% | 0 / 10 / 0 / 0 / 0 / 0 |
| card/trash | 8 | 50% | 0 / 8 / 0 / 0 / 0 / 0 |
| mode/foolOnTheHill | 8 | 75% | 0 / 8 / 0 / 0 / 0 / 0 |
| card/playFree | 5 | 100% | 5 / 0 / 0 / 0 / 0 / 0 |

Reaction windows: 1709 attacks. Reacted to 597 (deck won 35% (31–40) n=390): stole 145, stoleNothing 2, attackerGone 1, targetGone 396, bothGone 14, noneGone 39. Let 1112 resolve (38% (33–43) n=390): stole 748, stoleNothing 23, attackerGone 6, targetGone 305, bothGone 30. Choices: block 443, endReact 1247, call 243, ability 8, play 5.

## NC-07 Braindance Burn (RRB) — 560 games, 56% won, 24831 decisions

| Card | Use | Uses | Win rate in games used (95%) | Legal turns → used | Not chosen | Early / mid / late uses | Ahead | Even | Behind |
|---|---|---|---|---|---|---|---|---|---|
| Animals Wrecker | attacked | 757 | 60% (55–65) n=313 | 723 → 683 | 6% | 0 / 209 / 548 | 84% (77–89) n=161 | 70% (59–79) n=73 | 50% (44–57) n=213 |
| Psycho Squad | attacked | 749 | 59% (53–64) n=340 | 942 → 701 | 26% | 68 / 324 / 357 | 77% (71–83) n=186 | 65% (55–74) n=103 | 50% (43–57) n=191 |
| 6th Street Recruits | attacked | 725 | 58% (53–64) n=314 | 859 → 669 | 22% | 73 / 290 / 362 | 74% (67–80) n=174 | 61% (53–70) n=122 | 49% (42–56) n=175 |
| Detonate | sold | 531 | 56% (51–61) n=387 | 691 → 531 | 23% | 277 / 125 / 129 | 61% (54–67) n=198 | 54% (46–62) n=145 | 48% (39–57) n=112 |
| Psycho Squad | played | 521 | 57% (52–62) n=390 | 987 → 513 | 48% | 294 / 89 / 138 | 65% (58–71) n=192 | 53% (46–61) n=167 | 34% (25–44) n=88 |
| Dexter DeShawn: Off the Grid | ability | 483 | 50% (45–56) n=336 | 1700 → 483 | 72% | 11 / 59 / 413 | 71% (65–77) n=213 | 25% (16–37) n=63 | 17% (12–25) n=122 |
| 6th Street Recruits | played | 479 | 57% (51–62) n=350 | 923 → 468 | 49% | 251 / 93 / 135 | 69% (62–76) n=163 | 49% (41–57) n=148 | 35% (26–45) n=95 |
| Animals Wrecker | played | 467 | 57% (52–62) n=358 | 557 → 467 | 16% | 0 / 350 / 117 | 70% (61–77) n=141 | 47% (37–58) n=78 | 51% (44–58) n=179 |
| Johnny Silverhand: Never Stop Fighting | attacked | 433 | 66% (59–73) n=187 | 330 → 307 | 7% | 0 / 84 / 349 | 88% (81–93) n=109 | 86% (72–94) n=37 | 45% (35–55) n=89 |
| Bonnie and Clyde | sold | 433 | 53% (48–59) n=328 | 1141 → 433 | 62% | 98 / 173 / 162 | 69% (61–77) n=134 | 47% (37–57) n=92 | 47% (40–55) n=156 |
| Dexter DeShawn: Off the Grid | called | 421 | 54% (50–59) n=421 | 421 → 421 | 0% | 193 / 115 / 113 | 66% (60–71) n=263 | 44% (32–57) n=59 | 30% (22–40) n=99 |
| Adam Smasher: Ender of Legends | called | 420 | 56% (51–61) n=420 | 420 → 420 | 0% | 166 / 122 / 132 | 65% (59–70) n=275 | 36% (25–48) n=59 | 43% (33–54) n=86 |
| Satori: Sword of Saburo | sold | 408 | 53% (47–58) n=333 | 922 → 408 | 56% | 163 / 155 / 90 | 68% (59–75) n=139 | 47% (37–56) n=105 | 40% (31–48) n=124 |
| Meredith Stout: Stone Cold Corpo | played | 406 | 50% (45–56) n=321 | 1177 → 397 | 66% | 126 / 117 / 163 | 68% (60–76) n=132 | 46% (37–56) n=110 | 33% (25–41) n=120 |
| Judy Álvarez: Braindance Maestro | called | 405 | 56% (51–60) n=405 | 405 → 405 | 0% | 194 / 103 / 108 | 63% (57–69) n=272 | 45% (33–57) n=65 | 35% (25–47) n=68 |

(29 more card uses in the JSON report.)

Legal but never taken: Adam Smasher: Ender of Legends (Legend play, legal in 236 turns).

| Decision type | Decisions | First-listed option taken | Options offered (1 / 2 / 3–5 / 6–10 / 11–20 / 21+) |
|---|---|---|---|
| main | 14022 | 8% | 0 / 1191 / 3969 / 5934 / 2843 / 85 |
| gig/steal | 3130 | 30% | 186 / 448 / 1445 / 1036 / 15 / 0 |
| gig/rollIn | 2240 | 0% | 0 / 560 / 1680 / 0 / 0 / 0 |
| react | 1354 | 65% | 0 / 887 / 456 / 11 / 0 / 0 |
| gigValue/adjust | 808 | 8% | 0 / 4 / 57 / 43 / 450 / 254 |
| unit/pump | 694 | 52% | 212 / 237 / 237 / 8 / 0 / 0 |
| mulligan | 560 | 12% | 0 / 560 / 0 / 0 / 0 / 0 |
| unit/defeat | 522 | 65% | 181 / 147 / 186 / 8 / 0 / 0 |
| mode/mode | 512 | 75% | 0 / 512 / 0 / 0 / 0 / 0 |
| card/playFree | 300 | 78% | 0 / 111 / 182 / 7 / 0 / 0 |
| unit/equip | 288 | 82% | 52 / 76 / 126 / 34 / 0 / 0 |
| yesno/addToHand | 157 | 100% | 0 / 157 / 0 / 0 / 0 / 0 |
| unit/weaken | 76 | 67% | 31 / 24 / 21 / 0 / 0 / 0 |
| card/search | 48 | 56% | 0 / 19 / 26 / 3 / 0 / 0 |
| unit/sacrifice | 43 | 84% | 30 / 4 / 9 / 0 / 0 / 0 |
| card/discard | 42 | 74% | 16 / 13 / 13 / 0 / 0 / 0 |
| card/defeat | 22 | 95% | 20 / 2 / 0 / 0 / 0 / 0 |
| yesno/draw | 10 | 100% | 0 / 10 / 0 / 0 / 0 / 0 |
| mode/foolOnTheHill | 2 | 50% | 0 / 2 / 0 / 0 / 0 / 0 |
| mode/rivalChoice | 1 | 0% | 0 / 1 / 0 / 0 / 0 / 0 |

Reaction windows: 1228 attacks. Reacted to 418 (deck won 45% (40–51) n=311): stole 203, attackerGone 27, targetGone 168, bothGone 20. Let 810 resolve (53% (48–58) n=330): stole 589, stoleNothing 11, attackerGone 7, targetGone 176, bothGone 27. Choices: call 267, endReact 884, block 159, play 44.

## NC-08 Merc Contract (RRG) — 560 games, 56% won, 23445 decisions

| Card | Use | Uses | Win rate in games used (95%) | Legal turns → used | Not chosen | Early / mid / late uses | Ahead | Even | Behind |
|---|---|---|---|---|---|---|---|---|---|
| Animals Wrecker | attacked | 726 | 66% (61–72) n=301 | 688 → 658 | 4% | 0 / 169 / 557 | 86% (80–90) n=173 | 81% (70–88) n=77 | 57% (50–64) n=200 |
| Pepe Najarro: Working Doubles | attacked | 605 | 58% (52–63) n=290 | 735 → 562 | 24% | 45 / 260 / 300 | 75% (68–81) n=170 | 60% (50–70) n=88 | 42% (34–50) n=142 |
| Jackie Welles: Mama's Favorite | attacked | 593 | 49% (44–54) n=336 | 659 → 593 | 10% | 0 / 243 / 350 | 69% (63–76) n=190 | 57% (44–69) n=56 | 33% (26–41) n=161 |
| 6th Street Recruits | attacked | 539 | 54% (48–60) n=270 | 645 → 497 | 23% | 63 / 231 / 245 | 65% (57–72) n=143 | 64% (54–73) n=97 | 47% (38–55) n=128 |
| Bonnie and Clyde | sold | 522 | 54% (49–59) n=393 | 1331 → 522 | 61% | 94 / 239 / 189 | 60% (54–67) n=205 | 57% (47–67) n=93 | 42% (35–50) n=152 |
| Peace Offering | sold | 512 | 54% (49–59) n=383 | 967 → 512 | 47% | 208 / 186 / 118 | 60% (53–67) n=183 | 54% (45–62) n=134 | 46% (37–54) n=136 |
| Animals Wrecker | played | 480 | 61% (56–66) n=364 | 649 → 480 | 26% | 0 / 312 / 168 | 70% (63–76) n=169 | 69% (57–78) n=70 | 49% (41–56) n=175 |
| Detonate | sold | 472 | 56% (50–61) n=365 | 694 → 472 | 32% | 249 / 118 / 105 | 59% (51–66) n=184 | 58% (50–66) n=136 | 42% (33–52) n=104 |
| Pepe Najarro: Working Doubles | played | 462 | 54% (48–59) n=352 | 988 → 459 | 54% | 236 / 80 / 146 | 62% (55–69) n=183 | 53% (45–61) n=141 | 30% (21–41) n=83 |
| V: Streetkid | called | 430 | 54% (49–59) n=430 | 430 → 430 | 0% | 216 / 110 / 104 | 57% (51–62) n=331 | 47% (35–60) n=57 | 40% (27–56) n=42 |
| Jackie Welles: Mama's Favorite | called | 429 | 58% (54–63) n=429 | 429 → 429 | 0% | 177 / 145 / 107 | 62% (57–68) n=322 | 54% (42–66) n=59 | 35% (23–50) n=48 |
| Adam Smasher: Ender of Legends | called | 427 | 53% (48–57) n=427 | 427 → 427 | 0% | 189 / 130 / 108 | 60% (55–66) n=310 | 40% (28–53) n=53 | 27% (17–38) n=64 |
| 6th Street Recruits | played | 417 | 52% (46–57) n=332 | 895 → 415 | 54% | 211 / 98 / 108 | 59% (51–66) n=164 | 56% (48–64) n=139 | 21% (13–32) n=71 |
| Carnage at the Colosseum | sold | 417 | 54% (48–59) n=327 | 1653 → 417 | 75% | 22 / 152 / 243 | 66% (58–73) n=148 | 62% (49–73) n=55 | 44% (37–51) n=169 |
| V: Streetkid | attacked | 410 | 40% (34–46) n=253 | 505 → 410 | 19% | 65 / 120 / 225 | 50% (42–57) n=167 | 57% (41–71) n=37 | 20% (13–30) n=93 |

(34 more card uses in the JSON report.)

Legal but never taken: Jackie Welles: Mama's Favorite (Legend play, legal in 852 turns), V: Streetkid (Legend play, legal in 1113 turns), Adam Smasher: Ender of Legends (Legend play, legal in 98 turns), Synapse Burnout (played, legal in 516 turns).

| Decision type | Decisions | First-listed option taken | Options offered (1 / 2 / 3–5 / 6–10 / 11–20 / 21+) |
|---|---|---|---|
| main | 13522 | 8% | 0 / 1179 / 3623 / 4857 / 3730 / 133 |
| gig/steal | 3387 | 31% | 251 / 549 / 1504 / 1066 / 17 / 0 |
| gig/rollIn | 2240 | 0% | 0 / 560 / 1680 / 0 / 0 / 0 |
| react | 1333 | 69% | 0 / 946 / 380 / 7 / 0 / 0 |
| mulligan | 560 | 6% | 0 / 560 / 0 / 0 / 0 / 0 |
| card/search | 372 | 79% | 207 / 88 / 61 / 16 / 0 / 0 |
| yesno/replaceDefeat | 370 | 22% | 0 / 370 / 0 / 0 / 0 / 0 |
| unit/defeat | 331 | 63% | 108 / 105 / 109 / 9 / 0 / 0 |
| card/playFree | 294 | 53% | 0 / 24 / 188 / 82 / 0 / 0 |
| unit/equip | 237 | 84% | 40 / 99 / 85 / 13 / 0 / 0 |
| unit/ready | 226 | 85% | 0 / 143 / 83 / 0 / 0 / 0 |
| unit/adrenaline | 181 | 53% | 81 / 66 / 34 / 0 / 0 / 0 |
| gigValue/adjust | 130 | 4% | 0 / 0 / 0 / 1 / 13 / 116 |
| gigValue/setGig | 81 | 10% | 0 / 0 / 1 / 9 / 14 / 57 |
| unit/sacrifice | 57 | 75% | 27 / 12 / 18 / 0 / 0 / 0 |
| card/discard | 52 | 60% | 14 / 12 / 24 / 2 / 0 / 0 |
| unit/pump | 37 | 78% | 18 / 10 / 9 / 0 / 0 / 0 |
| card/defeat | 21 | 100% | 19 / 1 / 1 / 0 / 0 / 0 |
| yesno/draw | 8 | 100% | 0 / 8 / 0 / 0 / 0 / 0 |
| mode/rivalChoice | 4 | 0% | 0 / 4 / 0 / 0 / 0 / 0 |
| mode/foolOnTheHill | 2 | 50% | 0 / 2 / 0 / 0 / 0 / 0 |

Reaction windows: 1241 attacks. Reacted to 389 (deck won 47% (41–53) n=284): stole 193, attackerGone 13, targetGone 162, bothGone 21. Let 852 resolve (57% (51–62) n=335): stole 545, stoleNothing 6, attackerGone 18, targetGone 232, bothGone 46, noneGone 5. Choices: endReact 917, call 255, block 142, play 19.

## Rainbow Fixer Stuff — 560 games, 48% won, 28857 decisions

| Card | Use | Uses | Win rate in games used (95%) | Legal turns → used | Not chosen | Early / mid / late uses | Ahead | Even | Behind |
|---|---|---|---|---|---|---|---|---|---|
| Pepe Najarro: Working Doubles | attacked | 911 | 49% (44–54) n=386 | 971 → 838 | 14% | 67 / 360 / 484 | 66% (60–72) n=233 | 48% (40–57) n=124 | 39% (33–46) n=195 |
| 6th Street Recruits | attacked | 805 | 50% (45–55) n=356 | 846 → 728 | 14% | 52 / 318 / 435 | 65% (58–71) n=209 | 48% (39–57) n=113 | 43% (36–50) n=187 |
| Pepe Najarro: Working Doubles | played | 638 | 48% (44–53) n=442 | 1008 → 634 | 37% | 236 / 219 / 183 | 65% (58–71) n=222 | 36% (29–44) n=154 | 40% (33–48) n=166 |
| 6th Street Recruits | played | 630 | 49% (44–54) n=427 | 992 → 618 | 38% | 217 / 220 / 193 | 60% (53–66) n=226 | 35% (28–43) n=151 | 44% (36–51) n=163 |
| Valentino Street Racer | played | 624 | 46% (42–51) n=418 | 1100 → 586 | 47% | 116 / 317 / 191 | 56% (49–62) n=225 | 29% (22–38) n=119 | 40% (33–48) n=167 |
| Field Operator | attacked | 605 | 50% (45–56) n=315 | 762 → 525 | 31% | 9 / 191 / 405 | 67% (59–73) n=171 | 54% (44–64) n=87 | 36% (29–43) n=176 |
| Valentino Street Racer | attacked | 604 | 50% (44–55) n=323 | 773 → 540 | 30% | 19 / 193 / 392 | 64% (57–70) n=205 | 48% (37–58) n=80 | 38% (31–46) n=151 |
| Field Operator | played | 598 | 47% (42–52) n=406 | 1256 → 562 | 55% | 75 / 340 / 183 | 58% (52–65) n=214 | 30% (21–39) n=98 | 38% (31–46) n=164 |
| Detonate | sold | 581 | 48% (43–53) n=410 | 894 → 581 | 35% | 265 / 170 / 146 | 60% (53–66) n=210 | 36% (28–44) n=149 | 41% (33–49) n=135 |
| Padre: Man of the Cross | ability | 567 | 40% (35–46) n=359 | 1953 → 567 | 71% | 2 / 131 / 434 | 54% (47–60) n=222 | 17% (10–26) n=78 | 21% (15–28) n=164 |
| Synapse Burnout | sold | 561 | 50% (45–54) n=405 | 892 → 561 | 37% | 275 / 142 / 144 | 61% (54–67) n=211 | 42% (34–50) n=134 | 43% (35–52) n=134 |
| Psycho Squad | attacked | 558 | 52% (45–58) n=262 | 632 → 534 | 16% | 44 / 230 / 284 | 68% (60–75) n=158 | 53% (43–64) n=86 | 41% (33–50) n=117 |
| Wakako Okada: Peace and Harmony | ability | 541 | 40% (35–45) n=344 | 1987 → 541 | 73% | 2 / 129 / 410 | 52% (46–58) n=233 | 13% (7–22) n=71 | 13% (8–19) n=140 |
| Nocturne OP55 N1 | sold | 422 | 49% (44–55) n=341 | 1520 → 422 | 72% | 41 / 211 / 170 | 61% (53–68) n=158 | 43% (32–55) n=70 | 42% (34–49) n=154 |
| Adam Smasher: Ender of Legends | called | 402 | 51% (46–56) n=402 | 402 → 402 | 0% | 188 / 129 / 85 | 55% (49–61) n=293 | 33% (22–46) n=52 | 46% (33–58) n=57 |

(30 more card uses in the JSON report.)

| Decision type | Decisions | First-listed option taken | Options offered (1 / 2 / 3–5 / 6–10 / 11–20 / 21+) |
|---|---|---|---|
| main | 15522 | 8% | 0 / 968 / 4058 / 5785 / 4524 / 187 |
| gig/steal | 3084 | 33% | 183 / 577 / 1428 / 879 / 17 / 0 |
| gig/rollIn | 2240 | 0% | 0 / 560 / 1680 / 0 / 0 / 0 |
| react | 1473 | 60% | 0 / 899 / 560 / 14 / 0 / 0 |
| mode/mode | 1267 | 75% | 0 / 1061 / 206 / 0 / 0 / 0 |
| gigValue/adjust | 730 | 10% | 0 / 0 / 3 / 41 / 444 / 242 |
| unit/adrenaline | 579 | 55% | 222 / 186 / 168 / 3 / 0 / 0 |
| unit/weaken | 578 | 61% | 170 / 194 / 208 / 6 / 0 / 0 |
| mulligan | 560 | 6% | 0 / 560 / 0 / 0 / 0 / 0 |
| gigValue/setGig | 552 | 9% | 0 / 0 / 6 / 61 / 158 / 327 |
| unit/equip | 539 | 91% | 36 / 163 / 269 / 71 / 0 / 0 |
| unit/spend | 514 | 67% | 233 / 159 / 121 / 1 / 0 / 0 |
| unit/defeat | 328 | 33% | 14 / 48 / 228 / 38 / 0 / 0 |
| card/freePlay | 229 | 80% | 0 / 134 / 91 / 4 / 0 / 0 |
| unit/cantAttack | 178 | 44% | 37 / 68 / 70 / 3 / 0 / 0 |
| card/playFree | 119 | 92% | 0 / 79 / 40 / 0 / 0 / 0 |
| unit/ready | 92 | 100% | 0 / 92 / 0 / 0 / 0 / 0 |
| unit/call | 63 | 100% | 0 / 32 / 31 / 0 / 0 / 0 |
| card/discard | 59 | 46% | 12 / 17 / 28 / 2 / 0 / 0 |
| unit/pump | 55 | 69% | 9 / 17 / 29 / 0 / 0 / 0 |
| unit/sacrifice | 54 | 89% | 37 / 12 / 5 / 0 / 0 / 0 |
| card/defeat | 28 | 89% | 24 / 4 / 0 / 0 / 0 / 0 |
| yesno/draw | 9 | 100% | 0 / 9 / 0 / 0 / 0 / 0 |
| mode/rivalChoice | 3 | 0% | 0 / 3 / 0 / 0 / 0 / 0 |
| mode/foolOnTheHill | 2 | 50% | 0 / 2 / 0 / 0 / 0 / 0 |

Reaction windows: 1332 attacks. Reacted to 517 (deck won 37% (32–42) n=361): stole 291, stoleNothing 5, attackerGone 37, targetGone 147, bothGone 36, noneGone 1. Let 815 resolve (44% (39–49) n=332): stole 510, stoleNothing 3, attackerGone 2, targetGone 263, bothGone 37. Choices: call 372, endReact 880, play 129, block 92.

## RRB Wakako Midrange — 560 games, 42% won, 27000 decisions

| Card | Use | Uses | Win rate in games used (95%) | Legal turns → used | Not chosen | Early / mid / late uses | Ahead | Even | Behind |
|---|---|---|---|---|---|---|---|---|---|
| 6th Street Recruits | attacked | 1013 | 46% (41–51) n=362 | 1087 → 882 | 19% | 89 / 416 / 508 | 63% (56–69) n=190 | 44% (36–52) n=143 | 42% (36–49) n=239 |
| Psycho Squad | attacked | 642 | 51% (45–57) n=271 | 767 → 605 | 21% | 49 / 247 / 346 | 71% (63–78) n=128 | 46% (36–56) n=98 | 43% (36–50) n=181 |
| Wakako Okada: Peace and Harmony | ability | 591 | 40% (35–45) n=384 | 1885 → 591 | 69% | 18 / 154 / 419 | 56% (50–63) n=229 | 20% (13–30) n=79 | 15% (10–21) n=172 |
| Yorinobu Arasaka: Steel Dragon | attacked | 575 | 51% (45–57) n=296 | 550 → 501 | 9% | 0 / 0 / 575 | 81% (73–86) n=139 | 65% (52–75) n=62 | 37% (31–44) n=190 |
| Yorinobu Arasaka: Steel Dragon | played | 568 | 44% (40–49) n=413 | 699 → 568 | 19% | 0 / 282 / 286 | 59% (51–66) n=166 | 45% (34–57) n=69 | 34% (28–40) n=247 |
| Jacked-In Voodoo Boy | played | 552 | 38% (34–43) n=403 | 935 → 512 | 45% | 283 / 156 / 113 | 49% (42–55) n=226 | 27% (20–35) n=136 | 26% (18–35) n=100 |
| 6th Street Recruits | played | 542 | 44% (39–49) n=388 | 826 → 541 | 35% | 291 / 160 / 91 | 57% (49–63) n=191 | 36% (29–44) n=169 | 38% (30–48) n=107 |
| Detonate | sold | 522 | 40% (36–45) n=371 | 691 → 522 | 24% | 275 / 118 / 129 | 52% (45–60) n=183 | 33% (26–41) n=142 | 26% (19–34) n=120 |
| Dexter DeShawn: Off the Grid | ability | 512 | 39% (34–44) n=344 | 1903 → 512 | 73% | 6 / 125 / 381 | 57% (50–64) n=197 | 21% (13–32) n=70 | 14% (10–21) n=152 |
| Floor It | sold | 437 | 44% (39–49) n=331 | 870 → 437 | 50% | 167 / 156 / 114 | 52% (44–60) n=150 | 40% (32–49) n=112 | 35% (27–44) n=119 |
| Dexter DeShawn: Off the Grid | called | 417 | 44% (39–49) n=417 | 417 → 417 | 0% | 174 / 172 / 71 | 52% (46–58) n=246 | 27% (19–38) n=77 | 37% (28–47) n=94 |
| Adam Smasher: Ender of Legends | called | 410 | 47% (42–51) n=410 | 410 → 410 | 0% | 156 / 147 / 107 | 53% (47–59) n=276 | 38% (26–51) n=56 | 29% (21–40) n=78 |
| Nocturne OP55 N1 | sold | 404 | 44% (39–50) n=324 | 1122 → 404 | 64% | 90 / 186 / 128 | 51% (43–59) n=146 | 37% (27–48) n=78 | 44% (36–52) n=144 |
| Wakako Okada: Peace and Harmony | called | 399 | 45% (40–50) n=399 | 399 → 399 | 0% | 168 / 147 / 84 | 54% (48–60) n=242 | 34% (24–45) n=74 | 28% (19–38) n=83 |
| Mantis Blades | sold | 390 | 42% (37–48) n=326 | 598 → 390 | 35% | 228 / 55 / 107 | 53% (45–61) n=152 | 42% (33–50) n=125 | 23% (15–33) n=82 |

(32 more card uses in the JSON report.)

Legal but never taken: Adam Smasher: Ender of Legends (Legend play, legal in 264 turns).

| Decision type | Decisions | First-listed option taken | Options offered (1 / 2 / 3–5 / 6–10 / 11–20 / 21+) |
|---|---|---|---|
| main | 14108 | 8% | 0 / 1213 / 4018 / 6093 / 2739 / 45 |
| gig/steal | 2622 | 28% | 166 / 412 / 1099 / 933 / 12 / 0 |
| gig/rollIn | 2240 | 0% | 0 / 560 / 1680 / 0 / 0 / 0 |
| react | 1728 | 64% | 0 / 1170 / 539 / 19 / 0 / 0 |
| gigValue/adjust | 1432 | 8% | 0 / 10 / 32 / 135 / 889 / 366 |
| mode/mode | 1198 | 83% | 0 / 1061 / 137 / 0 / 0 / 0 |
| unit/defeat | 592 | 67% | 262 / 143 / 174 / 13 / 0 / 0 |
| mulligan | 560 | 18% | 0 / 560 / 0 / 0 / 0 / 0 |
| unit/weaken | 555 | 70% | 230 / 179 / 140 / 6 / 0 / 0 |
| card/playFree | 462 | 78% | 0 / 226 / 229 / 7 / 0 / 0 |
| unit/pump | 417 | 57% | 128 / 156 / 129 / 4 / 0 / 0 |
| unit/equip | 374 | 85% | 49 / 106 / 173 / 46 / 0 / 0 |
| card/freePlay | 219 | 74% | 0 / 111 / 101 / 7 / 0 / 0 |
| unit/cantAttack | 126 | 69% | 67 / 43 / 15 / 1 / 0 / 0 |
| card/discard | 119 | 79% | 13 / 75 / 31 / 0 / 0 / 0 |
| unit/bottomdeck | 80 | 55% | 10 / 20 / 49 / 1 / 0 / 0 |
| card/search | 52 | 44% | 0 / 16 / 32 / 4 / 0 / 0 |
| unit/sacrifice | 51 | 82% | 33 / 9 / 8 / 1 / 0 / 0 |
| unit/call | 36 | 100% | 0 / 5 / 31 / 0 / 0 / 0 |
| card/defeat | 19 | 95% | 16 / 3 / 0 / 0 / 0 / 0 |
| mode/foolOnTheHill | 5 | 60% | 0 / 5 / 0 / 0 / 0 / 0 |
| card/discardForNothing | 2 | 0% | 0 / 1 / 1 / 0 / 0 / 0 |
| yesno/draw | 2 | 100% | 0 / 2 / 0 / 0 / 0 / 0 |
| mode/rivalChoice | 1 | 0% | 0 / 1 / 0 / 0 / 0 / 0 |

Reaction windows: 1558 attacks. Reacted to 544 (deck won 34% (30–39) n=381): stole 238, stoleNothing 3, attackerGone 34, targetGone 240, bothGone 29. Let 1014 resolve (39% (35–44) n=371): stole 740, stoleNothing 11, attackerGone 1, targetGone 221, bothGone 41. Choices: call 327, endReact 1103, block 243, play 55.

## RRG Dexter Midrange — 560 games, 69% won, 24950 decisions

| Card | Use | Uses | Win rate in games used (95%) | Legal turns → used | Not chosen | Early / mid / late uses | Ahead | Even | Behind |
|---|---|---|---|---|---|---|---|---|---|
| Animals Wrecker | attacked | 842 | 79% (74–83) n=331 | 778 → 745 | 4% | 0 / 230 / 612 | 89% (85–93) n=218 | 78% (66–87) n=60 | 74% (67–79) n=220 |
| 6th Street Recruits | attacked | 769 | 70% (65–75) n=338 | 898 → 713 | 21% | 79 / 311 / 379 | 81% (75–86) n=193 | 63% (54–72) n=112 | 68% (61–74) n=193 |
| Pepe Najarro: Working Doubles | attacked | 758 | 70% (65–75) n=323 | 915 → 700 | 23% | 76 / 346 / 336 | 82% (76–87) n=189 | 65% (55–73) n=108 | 69% (62–75) n=189 |
| Dexter DeShawn: Off the Grid | ability | 551 | 63% (58–68) n=354 | 1863 → 551 | 70% | 13 / 117 / 421 | 77% (71–82) n=254 | 33% (22–46) n=58 | 37% (30–46) n=134 |
| Animals Wrecker | played | 549 | 74% (69–78) n=388 | 724 → 549 | 24% | 0 / 380 / 169 | 82% (75–87) n=163 | 68% (57–78) n=73 | 71% (64–76) n=225 |
| Synapse Burnout | sold | 510 | 70% (65–74) n=374 | 806 → 510 | 37% | 240 / 161 / 109 | 77% (71–83) n=190 | 59% (50–67) n=122 | 69% (61–76) n=139 |
| 6th Street Recruits | played | 499 | 68% (63–72) n=373 | 954 → 492 | 48% | 275 / 99 / 125 | 76% (69–81) n=189 | 58% (50–65) n=159 | 59% (48–68) n=92 |
| Detonate | sold | 494 | 70% (65–74) n=373 | 761 → 494 | 35% | 236 / 160 / 98 | 78% (71–83) n=180 | 61% (52–69) n=127 | 70% (61–77) n=126 |
| Pepe Najarro: Working Doubles | played | 492 | 66% (61–71) n=372 | 883 → 486 | 45% | 293 / 82 / 117 | 79% (72–84) n=180 | 55% (48–63) n=161 | 53% (43–63) n=89 |
| Yorinobu Arasaka: Steel Dragon | attacked | 489 | 81% (76–85) n=289 | 483 → 458 | 5% | 0 / 0 / 489 | 91% (86–94) n=180 | 83% (70–91) n=52 | 74% (67–81) n=152 |
| Yorinobu Arasaka: Steel Dragon | played | 462 | 76% (72–80) n=367 | 578 → 462 | 20% | 0 / 254 / 208 | 83% (75–89) n=124 | 72% (58–82) n=53 | 72% (66–78) n=219 |
| Adam Smasher: Ender of Legends | called | 450 | 69% (65–73) n=450 | 450 → 450 | 0% | 224 / 118 / 108 | 73% (68–77) n=333 | 55% (41–68) n=51 | 64% (52–74) n=66 |
| Saburo Arasaka: Stubborn Patriarch | called | 446 | 69% (65–73) n=446 | 446 → 446 | 0% | 238 / 122 / 86 | 76% (71–81) n=310 | 45% (33–57) n=62 | 59% (48–70) n=74 |
| Dexter DeShawn: Off the Grid | called | 433 | 71% (67–75) n=433 | 433 → 433 | 0% | 232 / 121 / 80 | 78% (73–82) n=295 | 57% (45–69) n=63 | 59% (47–69) n=75 |
| Peace Offering | sold | 433 | 69% (64–74) n=351 | 963 → 433 | 55% | 179 / 163 / 91 | 77% (70–83) n=160 | 55% (46–64) n=109 | 73% (64–80) n=125 |

(28 more card uses in the JSON report.)

| Decision type | Decisions | First-listed option taken | Options offered (1 / 2 / 3–5 / 6–10 / 11–20 / 21+) |
|---|---|---|---|
| main | 13614 | 9% | 0 / 1204 / 3865 / 5603 / 2865 / 77 |
| gig/steal | 3650 | 31% | 201 / 575 / 1800 / 1064 / 10 / 0 |
| gig/rollIn | 2240 | 0% | 0 / 560 / 1680 / 0 / 0 / 0 |
| react | 1331 | 66% | 0 / 953 / 374 / 4 / 0 / 0 |
| gigValue/adjust | 818 | 8% | 0 / 3 / 26 / 63 / 457 / 269 |
| unit/defeat | 603 | 59% | 169 / 193 / 233 / 8 / 0 / 0 |
| mulligan | 560 | 19% | 0 / 560 / 0 / 0 / 0 / 0 |
| mode/mode | 525 | 68% | 0 / 525 / 0 / 0 / 0 / 0 |
| card/playFree | 426 | 78% | 0 / 167 / 249 / 10 / 0 / 0 |
| unit/pump | 423 | 61% | 166 / 154 / 99 / 4 / 0 / 0 |
| unit/equip | 363 | 87% | 43 / 103 / 190 / 27 / 0 / 0 |
| gigValue/setGig | 105 | 11% | 0 / 0 / 6 / 22 / 31 / 46 |
| unit/ready | 104 | 100% | 0 / 104 / 0 / 0 / 0 / 0 |
| card/search | 59 | 73% | 0 / 29 / 27 / 3 / 0 / 0 |
| card/discard | 50 | 52% | 15 / 20 / 15 / 0 / 0 / 0 |
| unit/sacrifice | 50 | 80% | 29 / 14 / 7 / 0 / 0 / 0 |
| card/defeat | 18 | 94% | 15 / 3 / 0 / 0 / 0 / 0 |
| yesno/draw | 5 | 100% | 0 / 5 / 0 / 0 / 0 / 0 |
| mode/foolOnTheHill | 4 | 50% | 0 / 4 / 0 / 0 / 0 / 0 |
| mode/rivalChoice | 2 | 0% | 0 / 2 / 0 / 0 / 0 / 0 |

Reaction windows: 1221 attacks. Reacted to 399 (deck won 58% (52–63) n=285): stole 168, stoleNothing 1, attackerGone 42, targetGone 165, bothGone 22, noneGone 1. Let 822 resolve (68% (63–73) n=342): stole 594, stoleNothing 3, attackerGone 9, targetGone 170, bothGone 46. Choices: endReact 881, block 166, call 240, play 44.

## RRY Smasher Aggro — 560 games, 54% won, 23481 decisions

| Card | Use | Uses | Win rate in games used (95%) | Legal turns → used | Not chosen | Early / mid / late uses | Ahead | Even | Behind |
|---|---|---|---|---|---|---|---|---|---|
| Animals Wrecker | attacked | 700 | 65% (60–71) n=298 | 638 → 622 | 3% | 0 / 178 / 522 | 81% (74–86) n=160 | 81% (70–88) n=72 | 58% (51–65) n=191 |
| Rockn' Rockerboy | attacked | 585 | 62% (56–67) n=273 | 625 → 555 | 11% | 0 / 293 / 292 | 72% (64–78) n=163 | 70% (58–79) n=66 | 54% (45–62) n=142 |
| 6th Street Recruits | attacked | 552 | 57% (52–63) n=291 | 664 → 522 | 21% | 72 / 201 / 279 | 78% (70–84) n=139 | 51% (42–61) n=105 | 48% (41–56) n=159 |
| La Llorona: Ghost of the Past | played | 468 | 54% (49–59) n=359 | 1218 → 440 | 64% | 82 / 172 / 214 | 66% (58–73) n=167 | 47% (38–56) n=114 | 43% (35–52) n=127 |
| Animals Wrecker | played | 465 | 60% (55–65) n=355 | 610 → 465 | 24% | 0 / 313 / 152 | 71% (63–78) n=149 | 62% (51–72) n=74 | 49% (42–56) n=175 |
| 6th Street Recruits | played | 454 | 56% (51–61) n=347 | 1019 → 448 | 56% | 207 / 115 / 132 | 64% (56–70) n=170 | 48% (40–56) n=150 | 48% (38–59) n=87 |
| Detonate | sold | 453 | 52% (47–58) n=349 | 584 → 453 | 22% | 253 / 93 / 107 | 61% (54–68) n=179 | 45% (36–54) n=118 | 42% (33–52) n=99 |
| Bonnie and Clyde | sold | 438 | 54% (48–59) n=336 | 1216 → 438 | 64% | 75 / 193 / 170 | 69% (61–75) n=160 | 51% (40–62) n=76 | 40% (33–49) n=146 |
| Rockn' Rockerboy | played | 426 | 57% (51–62) n=342 | 762 → 426 | 44% | 197 / 111 / 118 | 69% (62–75) n=184 | 49% (40–58) n=112 | 37% (28–47) n=100 |
| Meredith Stout: Stone Cold Corpo | played | 414 | 52% (47–57) n=321 | 1222 → 406 | 67% | 88 / 105 / 221 | 65% (57–73) n=130 | 45% (35–55) n=98 | 41% (33–50) n=138 |
| V: Streetkid | attacked | 403 | 43% (37–49) n=261 | 468 → 403 | 14% | 57 / 103 / 243 | 55% (47–63) n=148 | 54% (40–67) n=48 | 28% (20–37) n=109 |
| Dum Dum: Maelstrom Triggerman | called | 398 | 53% (48–58) n=398 | 398 → 398 | 0% | 139 / 145 / 114 | 62% (56–68) n=269 | 39% (28–52) n=59 | 29% (19–40) n=70 |
| Adam Smasher: Ender of Legends | called | 396 | 56% (51–61) n=396 | 396 → 396 | 0% | 134 / 143 / 119 | 63% (57–68) n=269 | 47% (33–61) n=47 | 38% (28–48) n=80 |
| Zetatech Faceplate | sold | 395 | 54% (49–60) n=310 | 800 → 395 | 51% | 141 / 133 / 121 | 64% (56–71) n=148 | 53% (43–63) n=92 | 43% (34–52) n=107 |
| V: Streetkid | called | 392 | 53% (48–57) n=392 | 392 → 392 | 0% | 143 / 143 / 106 | 61% (55–66) n=265 | 35% (23–50) n=48 | 35% (26–46) n=79 |

(37 more card uses in the JSON report.)

Legal but never taken: V: Streetkid (Legend play, legal in 946 turns), Adam Smasher: Ender of Legends (Legend play, legal in 250 turns).

| Decision type | Decisions | First-listed option taken | Options offered (1 / 2 / 3–5 / 6–10 / 11–20 / 21+) |
|---|---|---|---|
| main | 13219 | 7% | 0 / 1136 / 3335 / 4821 / 3820 / 107 |
| gig/steal | 3120 | 30% | 165 / 509 / 1383 / 1048 / 15 / 0 |
| gig/rollIn | 2240 | 0% | 0 / 560 / 1680 / 0 / 0 / 0 |
| react | 1952 | 68% | 0 / 1170 / 765 / 17 / 0 / 0 |
| unit/defeat | 695 | 69% | 277 / 176 / 224 / 18 / 0 / 0 |
| mulligan | 560 | 28% | 0 / 560 / 0 / 0 / 0 / 0 |
| card/search | 512 | 69% | 254 / 125 / 102 / 30 / 1 / 0 |
| gigValue/adjust | 510 | 7% | 0 / 7 / 61 / 18 / 206 / 218 |
| unit/equip | 212 | 84% | 44 / 77 / 79 / 12 / 0 / 0 |
| unit/pump | 207 | 37% | 47 / 74 / 82 / 4 / 0 / 0 |
| unit/spend | 77 | 81% | 48 / 19 / 10 / 0 / 0 / 0 |
| unit/sacrifice | 56 | 82% | 27 / 24 / 4 / 1 / 0 / 0 |
| card/discard | 47 | 60% | 9 / 18 / 19 / 1 / 0 / 0 |
| card/defeatGear | 37 | 95% | 0 / 30 / 6 / 1 / 0 / 0 |
| card/defeat | 18 | 89% | 15 / 3 / 0 / 0 / 0 / 0 |
| yesno/draw | 14 | 100% | 0 / 14 / 0 / 0 / 0 / 0 |
| mode/rivalChoice | 3 | 0% | 0 / 3 / 0 / 0 / 0 / 0 |
| mode/foolOnTheHill | 2 | 50% | 0 / 2 / 0 / 0 / 0 / 0 |

Reaction windows: 1719 attacks. Reacted to 553 (deck won 46% (41–51) n=364): stole 198, stoleNothing 1, attackerGone 5, targetGone 326, bothGone 23. Let 1166 resolve (52% (47–57) n=431): stole 786, stoleNothing 2, attackerGone 7, targetGone 314, bothGone 57. Choices: call 307, endReact 1322, block 312, ability 6, play 5.

## Running and Dancing — 560 games, 12% won, 24710 decisions

| Card | Use | Uses | Win rate in games used (95%) | Legal turns → used | Not chosen | Early / mid / late uses | Ahead | Even | Behind |
|---|---|---|---|---|---|---|---|---|---|
| Modded Kusanagi | played | 723 | 10% (7–13) n=384 | 1304 → 723 | 45% | 0 / 165 / 558 | 23% (16–31) n=111 | 25% (15–38) n=52 | 5% (3–8) n=333 |
| Psycho Squad | attacked | 686 | 13% (10–17) n=347 | 814 → 630 | 23% | 85 / 321 / 280 | 28% (21–36) n=137 | 15% (10–23) n=110 | 8% (5–13) n=224 |
| Modded Kusanagi | attacked | 682 | 11% (8–14) n=360 | 696 → 682 | 2% | 0 / 165 / 517 | 23% (16–32) n=112 | 24% (15–37) n=54 | 5% (3–8) n=303 |
| Dying Night: V's Pistol | sold | 590 | 11% (9–15) n=427 | 700 → 590 | 16% | 308 / 135 / 147 | 15% (10–20) n=190 | 12% (8–19) n=145 | 4% (2–9) n=163 |
| Psycho Squad | played | 554 | 14% (11–17) n=406 | 780 → 553 | 29% | 297 / 160 / 97 | 18% (14–24) n=207 | 12% (8–17) n=164 | 6% (3–12) n=113 |
| Floor It | sold | 545 | 14% (11–18) n=391 | 884 → 545 | 38% | 198 / 194 / 153 | 21% (16–28) n=188 | 14% (9–22) n=112 | 6% (3–11) n=169 |
| Chrome Reverie | sold | 539 | 13% (10–17) n=386 | 879 → 539 | 39% | 245 / 147 / 147 | 17% (12–22) n=210 | 12% (7–20) n=106 | 7% (4–12) n=151 |
| Evelyn Parker: Scheming Siren | attacked | 521 | 6% (4–10) n=263 | 1011 → 456 | 55% | 87 / 124 / 310 | 12% (7–20) n=94 | 12% (6–23) n=58 | 4% (2–7) n=195 |
| Evelyn Parker: Scheming Siren | played | 498 | 9% (7–13) n=374 | 1037 → 475 | 54% | 206 / 127 / 165 | 13% (9–18) n=210 | 6% (3–13) n=96 | 2% (1–7) n=127 |
| Mox Inciters | played | 498 | 14% (11–18) n=357 | 1292 → 462 | 64% | 100 / 211 / 187 | 21% (16–28) n=169 | 8% (4–15) n=100 | 8% (5–14) n=147 |
| Trust No One | sold | 493 | 12% (9–16) n=370 | 817 → 493 | 40% | 174 / 165 / 154 | 16% (11–23) n=151 | 13% (8–20) n=120 | 11% (7–17) n=159 |
| Rita Wheeler: No Stupid Questions | played | 475 | 14% (11–18) n=354 | 1264 → 470 | 63% | 90 / 220 / 165 | 20% (15–27) n=158 | 13% (8–21) n=93 | 8% (5–13) n=164 |
| MT0D12 Flathead | sold | 463 | 13% (10–17) n=351 | 927 → 463 | 50% | 154 / 132 / 177 | 21% (15–27) n=178 | 15% (9–24) n=88 | 3% (1–7) n=147 |
| Alt Cunningham: Soulkiller Architect | called | 406 | 14% (11–18) n=406 | 406 → 406 | 0% | 159 / 147 / 100 | 19% (15–25) n=262 | 6% (2–15) n=65 | 3% (1–9) n=79 |
| Judy Álvarez: Braindance Maestro | called | 393 | 12% (10–16) n=393 | 393 → 393 | 0% | 149 / 160 / 84 | 16% (12–21) n=246 | 9% (4–19) n=56 | 5% (2–12) n=91 |

(25 more card uses in the JSON report.)

| Decision type | Decisions | First-listed option taken | Options offered (1 / 2 / 3–5 / 6–10 / 11–20 / 21+) |
|---|---|---|---|
| main | 13061 | 10% | 0 / 1040 / 3110 / 5530 / 3254 / 127 |
| react | 2361 | 69% | 0 / 1428 / 925 / 8 / 0 / 0 |
| gig/rollIn | 2240 | 100% | 0 / 560 / 1680 / 0 / 0 / 0 |
| gig/steal | 1923 | 34% | 68 / 391 / 658 / 771 / 35 / 0 |
| gigValue/adjust | 1797 | 17% | 0 / 60 / 732 / 674 / 281 / 50 |
| card/discard | 641 | 40% | 55 / 125 / 360 / 101 / 0 / 0 |
| mulligan | 560 | 16% | 0 / 560 / 0 / 0 / 0 / 0 |
| mode/cardType | 545 | 100% | 0 / 0 / 545 / 0 / 0 / 0 |
| unit/mustAttack | 454 | 51% | 112 / 169 / 166 / 7 / 0 / 0 |
| unit/pump | 209 | 61% | 44 / 62 / 101 / 2 / 0 / 0 |
| card/freePlay | 178 | 88% | 0 / 110 / 68 / 0 / 0 / 0 |
| unit/cantAttack | 164 | 55% | 49 / 44 / 70 / 1 / 0 / 0 |
| unit/weaken | 113 | 54% | 18 / 27 / 62 / 6 / 0 / 0 |
| card/playFromTrash | 85 | 85% | 45 / 27 / 13 / 0 / 0 / 0 |
| yesno/addToHand | 82 | 100% | 0 / 82 / 0 / 0 / 0 / 0 |
| unit/call | 69 | 100% | 0 / 30 / 39 / 0 / 0 / 0 |
| unit/bottomdeck | 68 | 74% | 44 / 7 / 14 / 3 / 0 / 0 |
| unit/equip | 56 | 82% | 20 / 9 / 14 / 13 / 0 / 0 |
| yesno/discardFor | 48 | 100% | 0 / 48 / 0 / 0 / 0 / 0 |
| unit/sacrifice | 34 | 100% | 27 / 6 / 1 / 0 / 0 / 0 |
| mode/foolOnTheHill | 11 | 36% | 0 / 11 / 0 / 0 / 0 / 0 |
| yesno/draw | 9 | 100% | 0 / 9 / 0 / 0 / 0 / 0 |
| mode/rivalChoice | 2 | 0% | 0 / 2 / 0 / 0 / 0 / 0 |

Reaction windows: 2096 attacks. Reacted to 613 (deck won 12% (9–16) n=413): stole 181, stoleNothing 2, attackerGone 9, targetGone 398, bothGone 23. Let 1483 resolve (10% (8–14) n=435): stole 1090, stoleNothing 5, attackerGone 1, targetGone 356, bothGone 31. Choices: block 402, call 302, endReact 1634, play 23.

## S1-01 Mutant (RRY) — 560 games, 62% won, 25820 decisions

| Card | Use | Uses | Win rate in games used (95%) | Legal turns → used | Not chosen | Early / mid / late uses | Ahead | Even | Behind |
|---|---|---|---|---|---|---|---|---|---|
| Animals Wrecker | attacked | 816 | 71% (66–76) n=319 | 765 → 724 | 5% | 0 / 220 / 596 | 87% (81–92) n=158 | 80% (70–87) n=85 | 66% (59–72) n=223 |
| Rockn' Rockerboy | attacked | 714 | 65% (60–70) n=298 | 797 → 657 | 18% | 0 / 338 / 376 | 81% (75–86) n=176 | 72% (60–81) n=74 | 57% (50–64) n=181 |
| 6th Street Recruits | attacked | 676 | 64% (58–69) n=319 | 843 → 620 | 26% | 76 / 233 / 367 | 81% (74–86) n=172 | 56% (46–65) n=102 | 55% (48–63) n=175 |
| Kerry Eurodyne: The Last Rockerboy | attacked | 575 | 60% (55–65) n=325 | 865 → 525 | 39% | 20 / 120 / 435 | 84% (78–89) n=147 | 67% (56–77) n=70 | 47% (40–54) n=203 |
| Yorinobu Arasaka: Steel Dragon | attacked | 551 | 71% (66–76) n=280 | 548 → 488 | 11% | 0 / 0 / 551 | 93% (88–96) n=163 | 77% (65–86) n=61 | 55% (48–63) n=157 |
| Dexter DeShawn: One Last Chance | attacked | 516 | 64% (58–69) n=281 | 669 → 463 | 31% | 33 / 120 / 363 | 85% (78–90) n=135 | 77% (66–84) n=81 | 48% (40–56) n=158 |
| Animals Wrecker | played | 513 | 67% (62–71) n=392 | 744 → 513 | 31% | 0 / 351 / 162 | 79% (71–85) n=146 | 71% (59–80) n=69 | 60% (54–66) n=228 |
| Yorinobu Arasaka: Steel Dragon | played | 508 | 63% (59–68) n=389 | 630 → 508 | 19% | 0 / 256 / 252 | 81% (73–87) n=130 | 71% (59–82) n=56 | 54% (48–60) n=250 |
| Bonnie and Clyde | sold | 496 | 62% (57–67) n=371 | 1277 → 496 | 61% | 117 / 205 / 174 | 77% (70–83) n=157 | 58% (49–68) n=101 | 51% (44–58) n=182 |
| Rockn' Rockerboy | played | 479 | 61% (56–66) n=365 | 889 → 479 | 46% | 239 / 96 / 144 | 76% (70–82) n=182 | 60% (51–68) n=123 | 38% (30–47) n=128 |
| Dexter DeShawn: One Last Chance | played | 462 | 61% (56–66) n=343 | 1271 → 436 | 66% | 137 / 151 / 174 | 75% (68–81) n=158 | 53% (44–62) n=120 | 48% (39–57) n=119 |
| 6th Street Recruits | played | 450 | 61% (55–66) n=348 | 970 → 439 | 55% | 227 / 94 / 129 | 75% (68–81) n=154 | 50% (42–58) n=148 | 44% (35–55) n=90 |
| Detonate | sold | 439 | 63% (57–67) n=360 | 557 → 439 | 21% | 246 / 88 / 105 | 72% (64–78) n=165 | 55% (46–64) n=120 | 53% (43–62) n=108 |
| Adam Smasher: Ender of Legends | called | 409 | 60% (55–65) n=409 | 409 → 409 | 0% | 184 / 77 / 148 | 71% (65–76) n=261 | 43% (33–54) n=81 | 37% (27–49) n=67 |
| Dexter DeShawn: Off the Grid | called | 401 | 60% (55–65) n=401 | 401 → 401 | 0% | 193 / 91 / 117 | 70% (64–75) n=247 | 49% (37–61) n=65 | 40% (31–51) n=89 |

(32 more card uses in the JSON report.)

Legal but never taken: Adam Smasher: Ender of Legends (Legend play, legal in 343 turns).

| Decision type | Decisions | First-listed option taken | Options offered (1 / 2 / 3–5 / 6–10 / 11–20 / 21+) |
|---|---|---|---|
| main | 14432 | 8% | 0 / 981 / 3537 / 5191 / 4346 / 377 |
| gig/steal | 3731 | 26% | 131 / 486 / 1650 / 1447 / 17 / 0 |
| gig/rollIn | 2240 | 0% | 0 / 560 / 1680 / 0 / 0 / 0 |
| gigValue/adjust | 1554 | 13% | 0 / 0 / 83 / 168 / 923 / 380 |
| react | 822 | 61% | 0 / 387 / 435 / 0 / 0 / 0 |
| unit/defeat | 599 | 58% | 145 / 168 / 263 / 23 / 0 / 0 |
| mulligan | 560 | 16% | 0 / 560 / 0 / 0 / 0 / 0 |
| mode/mode | 505 | 74% | 0 / 505 / 0 / 0 / 0 / 0 |
| unit/pump | 502 | 46% | 145 / 135 / 200 / 22 / 0 / 0 |
| card/playFree | 490 | 63% | 0 / 134 / 328 / 28 / 0 / 0 |
| unit/equip | 147 | 76% | 24 / 34 / 59 / 30 / 0 / 0 |
| unit/sacrifice | 63 | 59% | 23 / 15 / 22 / 3 / 0 / 0 |
| card/search | 55 | 71% | 26 / 22 / 7 / 0 / 0 / 0 |
| card/discard | 48 | 44% | 8 / 10 / 30 / 0 / 0 / 0 |
| card/defeatGear | 33 | 79% | 0 / 31 / 2 / 0 / 0 / 0 |
| yesno/draw | 20 | 100% | 0 / 20 / 0 / 0 / 0 / 0 |
| card/defeat | 13 | 92% | 11 / 2 / 0 / 0 / 0 / 0 |
| mode/foolOnTheHill | 4 | 25% | 0 / 4 / 0 / 0 / 0 / 0 |
| mode/rivalChoice | 2 | 0% | 0 / 2 / 0 / 0 / 0 / 0 |

Reaction windows: 796 attacks. Reacted to 314 (deck won 55% (49–61) n=270): stole 245, attackerGone 4, targetGone 56, bothGone 9. Let 482 resolve (57% (51–64) n=237): stole 350, stoleNothing 2, targetGone 123, bothGone 7. Choices: endReact 505, call 311, play 5, ability 1.

## S1-02 Mutant (RYY) — 560 games, 29% won, 25511 decisions

| Card | Use | Uses | Win rate in games used (95%) | Legal turns → used | Not chosen | Early / mid / late uses | Ahead | Even | Behind |
|---|---|---|---|---|---|---|---|---|---|
| Rockn' Rockerboy | attacked | 871 | 35% (30–41) n=322 | 871 → 775 | 11% | 0 / 381 / 490 | 52% (45–60) n=168 | 48% (38–59) n=83 | 31% (25–37) n=220 |
| 6th Street Recruits | attacked | 768 | 35% (30–40) n=338 | 835 → 701 | 16% | 74 / 263 / 431 | 53% (45–61) n=146 | 49% (40–58) n=115 | 28% (23–34) n=217 |
| Dexter DeShawn: Off the Grid | ability | 678 | 29% (25–34) n=417 | 2007 → 678 | 66% | 31 / 96 / 551 | 50% (43–56) n=232 | 15% (9–24) n=99 | 10% (7–15) n=214 |
| 6th Street Recruits | played | 615 | 32% (28–37) n=406 | 1020 → 604 | 41% | 209 / 180 / 226 | 38% (31–46) n=158 | 36% (29–44) n=151 | 26% (20–32) n=192 |
| Dexter DeShawn: One Last Chance | played | 570 | 30% (26–35) n=401 | 1043 → 531 | 49% | 159 / 223 / 188 | 39% (32–46) n=170 | 27% (20–35) n=127 | 27% (21–34) n=180 |
| Dexter DeShawn: One Last Chance | attacked | 549 | 32% (27–38) n=298 | 718 → 487 | 32% | 33 / 157 / 359 | 50% (40–59) n=105 | 41% (31–53) n=70 | 24% (19–31) n=205 |
| Rockn' Rockerboy | played | 533 | 33% (29–38) n=393 | 719 → 532 | 26% | 231 / 140 / 162 | 45% (38–52) n=181 | 31% (24–39) n=136 | 26% (20–34) n=150 |
| Minotaur | played | 520 | 28% (23–32) n=391 | 733 → 520 | 29% | 0 / 170 / 350 | 49% (40–57) n=125 | 28% (18–42) n=53 | 16% (12–21) n=261 |
| River Ward: Detective on the Hunt | called | 458 | 29% (25–33) n=458 | 458 → 458 | 0% | 192 / 150 / 116 | 34% (28–39) n=274 | 20% (12–30) n=76 | 24% (17–33) n=108 |
| Dexter DeShawn: Off the Grid | called | 457 | 29% (25–34) n=457 | 457 → 457 | 0% | 215 / 140 / 102 | 36% (30–42) n=257 | 22% (15–32) n=86 | 20% (14–28) n=114 |
| Gilded Matón | played | 452 | 30% (26–35) n=345 | 1724 → 430 | 75% | 58 / 105 / 289 | 48% (40–57) n=130 | 22% (15–32) n=90 | 19% (13–25) n=162 |
| Viktor Vektor: Sit Down and Relax | called | 445 | 29% (25–33) n=445 | 445 → 445 | 0% | 208 / 117 / 120 | 35% (30–41) n=262 | 17% (11–26) n=93 | 21% (14–31) n=90 |
| River Ward: Detective on the Hunt | ability | 430 | 28% (24–34) n=299 | 1872 → 430 | 77% | 34 / 85 / 311 | 50% (42–58) n=147 | 16% (9–26) n=76 | 15% (10–22) n=147 |
| Minotaur | attacked | 412 | 34% (28–40) n=240 | 412 → 386 | 6% | 0 / 1 / 411 | 52% (42–62) n=92 | 65% (50–78) n=43 | 23% (17–31) n=151 |
| Heywood Ripperdoc | attacked | 406 | 33% (27–39) n=210 | 423 → 391 | 8% | 0 / 94 / 312 | 55% (44–65) n=82 | 59% (44–72) n=46 | 26% (19–34) n=140 |

(31 more card uses in the JSON report.)

| Decision type | Decisions | First-listed option taken | Options offered (1 / 2 / 3–5 / 6–10 / 11–20 / 21+) |
|---|---|---|---|
| main | 14428 | 7% | 0 / 1227 / 3783 / 5593 / 3691 / 134 |
| gig/steal | 2817 | 25% | 137 / 362 / 1112 / 1180 / 26 / 0 |
| gig/rollIn | 2240 | 0% | 0 / 560 / 1680 / 0 / 0 / 0 |
| gigValue/adjust | 1927 | 13% | 0 / 0 / 100 / 243 / 1199 / 385 |
| react | 1190 | 78% | 0 / 784 / 406 / 0 / 0 / 0 |
| mulligan | 560 | 16% | 0 / 560 / 0 / 0 / 0 / 0 |
| mode/mode | 535 | 66% | 0 / 535 / 0 / 0 / 0 / 0 |
| unit/pump | 353 | 59% | 117 / 124 / 110 / 2 / 0 / 0 |
| unit/equip | 336 | 83% | 29 / 82 / 185 / 40 / 0 / 0 |
| card/defeatGear | 224 | 42% | 0 / 184 / 40 / 0 / 0 / 0 |
| unit/defeat | 211 | 77% | 111 / 43 / 40 / 17 / 0 / 0 |
| unit/sacrifice | 197 | 53% | 57 / 64 / 76 / 0 / 0 / 0 |
| card/search | 173 | 92% | 18 / 140 / 15 / 0 / 0 / 0 |
| card/playFree | 121 | 95% | 108 / 6 / 7 / 0 / 0 / 0 |
| card/trash | 112 | 58% | 0 / 112 / 0 / 0 / 0 / 0 |
| card/discard | 50 | 60% | 12 / 17 / 19 / 2 / 0 / 0 |
| yesno/draw | 30 | 100% | 0 / 30 / 0 / 0 / 0 / 0 |
| mode/foolOnTheHill | 4 | 25% | 0 / 4 / 0 / 0 / 0 / 0 |
| yesno/playFree | 2 | 100% | 0 / 2 / 0 / 0 / 0 / 0 |
| mode/rivalChoice | 1 | 0% | 0 / 1 / 0 / 0 / 0 / 0 |

Reaction windows: 1140 attacks. Reacted to 253 (deck won 23% (18–29) n=230): stole 205, stoleNothing 1, attackerGone 5, targetGone 33, bothGone 9. Let 887 resolve (27% (23–32) n=335): stole 668, stoleNothing 3, targetGone 197, bothGone 19. Choices: call 243, endReact 924, ability 21, play 2.

## S1-03 Mutant (RBG) — 560 games, 44% won, 24546 decisions

| Card | Use | Uses | Win rate in games used (95%) | Legal turns → used | Not chosen | Early / mid / late uses | Ahead | Even | Behind |
|---|---|---|---|---|---|---|---|---|---|
| 6th Street Recruits | attacked | 712 | 49% (44–55) n=300 | 835 → 644 | 23% | 56 / 253 / 403 | 67% (59–74) n=156 | 52% (42–62) n=90 | 39% (32–46) n=181 |
| Nadia: Fighting Through Grief | attacked | 708 | 45% (40–51) n=295 | 762 → 643 | 16% | 0 / 251 / 457 | 69% (61–76) n=140 | 63% (49–75) n=49 | 39% (33–45) n=236 |
| Psycho Squad | attacked | 686 | 51% (46–57) n=317 | 844 → 633 | 25% | 60 / 244 / 382 | 70% (62–76) n=159 | 55% (46–65) n=101 | 43% (36–50) n=173 |
| Wakako Okada: Peace and Harmony | ability | 556 | 42% (37–47) n=385 | 1961 → 556 | 72% | 5 / 176 / 375 | 67% (61–73) n=208 | 14% (8–24) n=70 | 17% (12–23) n=180 |
| Valentino Street Racer | played | 526 | 43% (38–48) n=376 | 1128 → 478 | 58% | 109 / 294 / 123 | 57% (50–64) n=172 | 24% (17–33) n=109 | 33% (26–41) n=141 |
| Psycho Squad | played | 520 | 48% (43–53) n=385 | 977 → 516 | 47% | 215 / 169 / 136 | 58% (51–65) n=173 | 41% (33–49) n=145 | 37% (30–46) n=142 |
| MaxTac AV | attacked | 504 | 52% (46–58) n=231 | 585 → 489 | 16% | 0 / 221 / 283 | 68% (60–76) n=132 | 64% (51–76) n=53 | 40% (32–49) n=127 |
| 6th Street Recruits | played | 501 | 45% (40–50) n=367 | 998 → 492 | 51% | 207 / 155 / 139 | 62% (54–69) n=156 | 37% (29–45) n=139 | 34% (27–43) n=132 |
| Nocturne OP55 N1 | sold | 501 | 44% (39–49) n=380 | 958 → 501 | 48% | 185 / 211 / 105 | 55% (48–63) n=159 | 39% (30–47) n=122 | 36% (29–44) n=155 |
| Valentino Street Racer | attacked | 496 | 45% (39–51) n=274 | 664 → 432 | 35% | 20 / 151 / 325 | 64% (55–71) n=143 | 38% (27–51) n=55 | 29% (22–37) n=128 |
| Nadia: Fighting Through Grief | played | 446 | 43% (38–49) n=346 | 728 → 446 | 39% | 0 / 309 / 137 | 54% (45–62) n=126 | 42% (31–54) n=64 | 37% (31–44) n=203 |
| Adam Smasher: Ender of Legends | called | 437 | 45% (41–50) n=437 | 437 → 437 | 0% | 194 / 154 / 89 | 53% (47–59) n=286 | 29% (20–41) n=72 | 32% (22–43) n=79 |
| Wakako Okada: Peace and Harmony | called | 424 | 48% (43–52) n=424 | 424 → 424 | 0% | 229 / 125 / 70 | 57% (51–63) n=269 | 40% (30–52) n=72 | 24% (16–34) n=83 |
| Saburo Arasaka: Stubborn Patriarch | called | 407 | 44% (40–49) n=407 | 407 → 407 | 0% | 197 / 141 / 69 | 50% (44–56) n=271 | 35% (25–48) n=62 | 32% (23–44) n=74 |
| Placide: Voodoo Sentinel | played | 372 | 47% (41–52) n=319 | 467 → 372 | 20% | 0 / 0 / 372 | 80% (72–86) n=110 | 40% (26–55) n=40 | 31% (25–37) n=193 |

(32 more card uses in the JSON report.)

Legal but never taken: Adam Smasher: Ender of Legends (Legend play, legal in 268 turns), Synapse Burnout (played, legal in 535 turns).

| Decision type | Decisions | First-listed option taken | Options offered (1 / 2 / 3–5 / 6–10 / 11–20 / 21+) |
|---|---|---|---|
| main | 13692 | 7% | 0 / 1178 / 4006 / 5294 / 3092 / 122 |
| gig/steal | 3322 | 27% | 132 / 513 / 1366 / 1286 / 25 / 0 |
| gig/rollIn | 2240 | 0% | 0 / 560 / 1680 / 0 / 0 / 0 |
| react | 753 | 58% | 0 / 444 / 309 / 0 / 0 / 0 |
| gigValue/adjust | 701 | 6% | 0 / 0 / 2 / 49 / 418 / 232 |
| mode/mode | 591 | 75% | 0 / 531 / 60 / 0 / 0 / 0 |
| mulligan | 560 | 16% | 0 / 560 / 0 / 0 / 0 / 0 |
| unit/adrenaline | 436 | 61% | 210 / 145 / 80 / 1 / 0 / 0 |
| unit/weaken | 382 | 68% | 148 / 123 / 110 / 1 / 0 / 0 |
| gig/swapGive | 319 | 41% | 0 / 25 / 246 / 48 / 0 / 0 |
| gig/swapTake | 265 | 51% | 51 / 70 / 95 / 47 / 2 / 0 |
| unit/bottomdeck | 260 | 44% | 56 / 65 / 137 / 2 / 0 / 0 |
| unit/defeat | 256 | 38% | 25 / 48 / 165 / 18 / 0 / 0 |
| card/discard | 237 | 74% | 15 / 124 / 97 / 1 / 0 / 0 |
| unit/equip | 175 | 85% | 23 / 66 / 72 / 14 / 0 / 0 |
| unit/spend | 93 | 59% | 35 / 32 / 26 / 0 / 0 / 0 |
| unit/bottomdeckOwn | 75 | 64% | 35 / 20 / 20 / 0 / 0 / 0 |
| unit/sacrifice | 63 | 81% | 41 / 10 / 11 / 1 / 0 / 0 |
| yesno/draw | 38 | 100% | 0 / 38 / 0 / 0 / 0 / 0 |
| unit/ready | 34 | 100% | 0 / 34 / 0 / 0 / 0 / 0 |
| card/playFree | 25 | 100% | 0 / 18 / 7 / 0 / 0 / 0 |
| unit/pump | 12 | 83% | 5 / 5 / 2 / 0 / 0 / 0 |
| mode/foolOnTheHill | 7 | 29% | 0 / 7 / 0 / 0 / 0 / 0 |
| mode/rivalChoice | 6 | 17% | 0 / 6 / 0 / 0 / 0 / 0 |
| card/discardForNothing | 4 | 0% | 0 / 3 / 1 / 0 / 0 / 0 |

Reaction windows: 740 attacks. Reacted to 314 (deck won 37% (32–43) n=285): stole 237, stoleNothing 3, attackerGone 7, targetGone 55, bothGone 12. Let 426 resolve (42% (36–49) n=212): stole 339, targetGone 82, bothGone 5. Choices: endReact 433, call 307, play 13.

## S1-04 Cross (RBG) — 560 games, 37% won, 27051 decisions

| Card | Use | Uses | Win rate in games used (95%) | Legal turns → used | Not chosen | Early / mid / late uses | Ahead | Even | Behind |
|---|---|---|---|---|---|---|---|---|---|
| 6th Street Recruits | attacked | 776 | 44% (38–49) n=337 | 859 → 697 | 19% | 71 / 260 / 445 | 63% (56–70) n=163 | 39% (31–49) n=114 | 37% (31–44) n=199 |
| Psycho Squad | attacked | 722 | 40% (35–45) n=335 | 834 → 674 | 19% | 67 / 236 / 419 | 59% (51–66) n=162 | 32% (24–41) n=113 | 35% (28–42) n=191 |
| MaxTac AV | attacked | 662 | 43% (37–49) n=268 | 718 → 631 | 12% | 0 / 308 / 354 | 58% (50–65) n=160 | 57% (45–68) n=65 | 35% (28–42) n=169 |
| Dexter DeShawn: Off the Grid | ability | 647 | 35% (31–40) n=417 | 1947 → 647 | 67% | 5 / 128 / 514 | 59% (53–65) n=239 | 10% (5–18) n=83 | 7% (4–11) n=191 |
| Wakako Okada: Peace and Harmony | ability | 647 | 35% (30–40) n=406 | 1955 → 647 | 67% | 5 / 156 / 486 | 55% (48–61) n=237 | 16% (10–25) n=92 | 9% (6–14) n=180 |
| Nadia: Fighting Through Grief | attacked | 634 | 39% (34–45) n=266 | 665 → 582 | 12% | 0 / 208 / 426 | 67% (58–75) n=124 | 50% (36–64) n=44 | 33% (27–40) n=216 |
| Valentino Street Racer | played | 584 | 37% (32–42) n=416 | 1117 → 538 | 52% | 112 / 292 / 180 | 51% (44–58) n=198 | 18% (12–26) n=108 | 31% (25–38) n=170 |
| 6th Street Recruits | played | 572 | 40% (36–45) n=410 | 1085 → 565 | 48% | 198 / 194 / 180 | 49% (42–56) n=196 | 35% (28–43) n=148 | 30% (23–37) n=149 |
| Psycho Squad | played | 572 | 38% (34–43) n=409 | 998 → 565 | 43% | 188 / 186 / 198 | 54% (47–61) n=181 | 27% (21–35) n=135 | 28% (22–36) n=169 |
| Valentino Street Racer | attacked | 509 | 36% (30–41) n=284 | 722 → 458 | 37% | 15 / 143 / 351 | 54% (46–62) n=138 | 41% (30–53) n=66 | 25% (19–33) n=162 |
| Nocturne OP55 N1 | sold | 478 | 38% (33–43) n=367 | 926 → 478 | 48% | 154 / 222 / 102 | 46% (39–54) n=165 | 34% (25–44) n=97 | 31% (24–39) n=161 |
| Placide: Voodoo Sentinel | played | 456 | 41% (36–46) n=361 | 509 → 456 | 10% | 0 / 0 / 456 | 63% (54–71) n=119 | 51% (37–65) n=47 | 28% (23–34) n=237 |
| Dexter DeShawn: Off the Grid | called | 440 | 37% (33–42) n=440 | 440 → 440 | 0% | 191 / 176 / 73 | 43% (38–49) n=277 | 24% (16–36) n=66 | 29% (21–39) n=97 |
| Saburo Arasaka: Stubborn Patriarch | called | 424 | 38% (33–43) n=424 | 424 → 424 | 0% | 199 / 128 / 97 | 46% (40–52) n=274 | 24% (16–34) n=76 | 23% (15–34) n=74 |
| Wakako Okada: Peace and Harmony | called | 402 | 38% (33–42) n=402 | 402 → 402 | 0% | 199 / 155 / 48 | 44% (38–50) n=264 | 25% (16–38) n=56 | 27% (18–37) n=82 |

(30 more card uses in the JSON report.)

| Decision type | Decisions | First-listed option taken | Options offered (1 / 2 / 3–5 / 6–10 / 11–20 / 21+) |
|---|---|---|---|
| main | 14636 | 7% | 0 / 1356 / 4079 / 5487 / 3589 / 125 |
| gig/steal | 3179 | 26% | 154 / 500 / 1370 / 1132 / 23 / 0 |
| gig/rollIn | 2240 | 0% | 0 / 560 / 1680 / 0 / 0 / 0 |
| gigValue/adjust | 1468 | 7% | 0 / 0 / 1 / 72 / 876 / 519 |
| mode/mode | 1118 | 74% | 0 / 1054 / 64 / 0 / 0 / 0 |
| react | 689 | 54% | 0 / 391 / 298 / 0 / 0 / 0 |
| mulligan | 560 | 18% | 0 / 560 / 0 / 0 / 0 / 0 |
| unit/adrenaline | 470 | 59% | 206 / 157 / 107 / 0 / 0 / 0 |
| unit/weaken | 395 | 70% | 155 / 132 / 107 / 1 / 0 / 0 |
| gig/swapGive | 381 | 39% | 0 / 22 / 289 / 70 / 0 / 0 |
| unit/pump | 362 | 59% | 111 / 153 / 96 / 2 / 0 / 0 |
| gig/swapTake | 325 | 52% | 72 / 92 / 111 / 47 / 3 / 0 |
| unit/bottomdeck | 321 | 51% | 82 / 89 / 146 / 4 / 0 / 0 |
| card/discard | 272 | 78% | 8 / 171 / 91 / 2 / 0 / 0 |
| unit/equip | 206 | 86% | 23 / 57 / 103 / 23 / 0 / 0 |
| unit/spend | 124 | 54% | 39 / 59 / 26 / 0 / 0 / 0 |
| unit/bottomdeckOwn | 95 | 61% | 43 / 30 / 22 / 0 / 0 / 0 |
| unit/defeat | 54 | 46% | 5 / 2 / 29 / 18 / 0 / 0 |
| gigValue/setGig | 47 | 6% | 0 / 0 / 0 / 5 / 8 / 34 |
| unit/sacrifice | 43 | 88% | 23 / 10 / 9 / 1 / 0 / 0 |
| yesno/draw | 37 | 100% | 0 / 37 / 0 / 0 / 0 / 0 |
| card/playFree | 18 | 94% | 0 / 14 / 4 / 0 / 0 / 0 |
| mode/foolOnTheHill | 6 | 83% | 0 / 6 / 0 / 0 / 0 / 0 |
| card/discardForNothing | 5 | 0% | 0 / 3 / 2 / 0 / 0 / 0 |

Reaction windows: 684 attacks. Reacted to 317 (deck won 28% (23–33) n=281): stole 259, stoleNothing 4, attackerGone 6, targetGone 40, bothGone 8. Let 367 resolve (39% (33–46) n=197): stole 287, stoleNothing 1, targetGone 76, bothGone 2, noneGone 1. Choices: call 314, endReact 371, play 4.

## S1-05 Cross (RBB) — 560 games, 50% won, 24093 decisions

| Card | Use | Uses | Win rate in games used (95%) | Legal turns → used | Not chosen | Early / mid / late uses | Ahead | Even | Behind |
|---|---|---|---|---|---|---|---|---|---|
| Psycho Squad | attacked | 776 | 48% (43–54) n=327 | 876 → 706 | 19% | 61 / 295 / 420 | 60% (53–67) n=203 | 47% (38–56) n=113 | 44% (37–52) n=172 |
| 6th Street Recruits | attacked | 750 | 49% (44–54) n=338 | 859 → 698 | 19% | 67 / 295 / 388 | 59% (52–65) n=202 | 64% (55–73) n=112 | 36% (29–44) n=174 |
| Alt Cunningham: Soulkiller Architect | ability | 660 | 47% (42–52) n=429 | 1712 → 660 | 61% | 4 / 104 / 552 | 61% (55–67) n=273 | 42% (32–53) n=83 | 18% (13–24) n=176 |
| V: Streetkid | attacked | 635 | 47% (42–52) n=390 | 746 → 635 | 15% | 24 / 213 / 398 | 60% (54–66) n=235 | 56% (44–67) n=70 | 29% (23–37) n=164 |
| Jacked-In Voodoo Boy | played | 565 | 47% (42–52) n=409 | 1076 → 531 | 51% | 237 / 188 / 140 | 52% (46–58) n=271 | 42% (33–52) n=109 | 30% (21–41) n=76 |
| Psycho Squad | played | 527 | 48% (43–53) n=380 | 942 → 522 | 45% | 220 / 169 / 138 | 54% (47–61) n=213 | 44% (36–52) n=148 | 26% (18–37) n=87 |
| 6th Street Recruits | played | 516 | 48% (43–53) n=397 | 1014 → 510 | 50% | 210 / 172 / 134 | 54% (47–60) n=212 | 47% (39–55) n=146 | 34% (25–44) n=92 |
| Trust No One | sold | 483 | 46% (41–51) n=366 | 711 → 483 | 32% | 242 / 120 / 121 | 56% (49–64) n=172 | 46% (38–55) n=142 | 24% (17–33) n=101 |
| Jackie Welles: Pour One Out For Me | called | 416 | 52% (47–56) n=416 | 416 → 416 | 0% | 130 / 201 / 85 | 55% (50–61) n=313 | 48% (36–60) n=67 | 28% (16–44) n=36 |
| V: Streetkid | called | 413 | 51% (46–56) n=413 | 413 → 413 | 0% | 145 / 184 / 84 | 57% (51–62) n=292 | 42% (31–54) n=66 | 29% (19–42) n=55 |
| V: Streetkid | Go Solo (self-paid 411) | 411 | 46% (41–51) n=411 | 963 → 411 | 57% | 26 / 191 / 194 | 56% (49–63) n=204 | 50% (37–63) n=50 | 32% (25–39) n=157 |
| Alt Cunningham: Soulkiller Architect | called | 408 | 53% (49–58) n=408 | 408 → 408 | 0% | 121 / 198 / 89 | 59% (53–64) n=300 | 47% (35–60) n=55 | 30% (20–44) n=53 |
| Maman Brigitte: Spirit of Death | attacked | 388 | 50% (43–57) n=218 | 486 → 374 | 23% | 0 / 180 / 208 | 61% (53–68) n=148 | 64% (50–77) n=45 | 29% (20–40) n=76 |
| Johnny Silverhand: Never Stop Fighting | attacked | 372 | 63% (55–70) n=161 | 279 → 258 | 8% | 0 / 71 / 301 | 72% (63–79) n=113 | 88% (71–96) n=26 | 50% (38–62) n=64 |
| All is Lost | sold | 370 | 50% (44–55) n=305 | 412 → 370 | 10% | 227 / 72 / 71 | 57% (49–64) n=152 | 46% (37–55) n=124 | 32% (22–45) n=59 |

(33 more card uses in the JSON report.)

Legal but never taken: V: Streetkid (Legend play, legal in 963 turns).

| Decision type | Decisions | First-listed option taken | Options offered (1 / 2 / 3–5 / 6–10 / 11–20 / 21+) |
|---|---|---|---|
| main | 13385 | 7% | 0 / 1271 / 3796 / 5468 / 2793 / 57 |
| gig/steal | 2968 | 33% | 223 / 588 / 1321 / 817 / 19 / 0 |
| gig/rollIn | 2240 | 100% | 0 / 560 / 1680 / 0 / 0 / 0 |
| gigValue/adjust | 1186 | 19% | 0 / 40 / 232 / 364 / 309 / 241 |
| react | 856 | 56% | 0 / 520 / 336 / 0 / 0 / 0 |
| unit/bottomdeck | 832 | 79% | 551 / 132 / 146 / 3 / 0 / 0 |
| card/discard | 606 | 64% | 108 / 303 / 193 / 2 / 0 / 0 |
| mulligan | 560 | 16% | 0 / 560 / 0 / 0 / 0 / 0 |
| card/search | 459 | 71% | 228 / 127 / 94 / 10 / 0 / 0 |
| card/playFromTrash | 413 | 63% | 148 / 124 / 140 / 1 / 0 / 0 |
| yesno/discardFor | 196 | 100% | 0 / 196 / 0 / 0 / 0 / 0 |
| unit/weaken | 84 | 62% | 28 / 29 / 27 / 0 / 0 / 0 |
| unit/bottomdeckOwn | 70 | 66% | 17 / 23 / 30 / 0 / 0 / 0 |
| mode/mode | 67 | 94% | 0 / 4 / 63 / 0 / 0 / 0 |
| unit/cantAttack | 59 | 61% | 14 / 18 / 27 / 0 / 0 / 0 |
| unit/sacrifice | 56 | 95% | 43 / 11 / 2 / 0 / 0 / 0 |
| yesno/draw | 27 | 100% | 0 / 27 / 0 / 0 / 0 / 0 |
| unit/call | 20 | 100% | 0 / 8 / 12 / 0 / 0 / 0 |
| mode/foolOnTheHill | 6 | 50% | 0 / 6 / 0 / 0 / 0 / 0 |
| card/discardForNothing | 2 | 0% | 0 / 0 / 2 / 0 / 0 / 0 |
| mode/rivalChoice | 1 | 0% | 0 / 1 / 0 / 0 / 0 / 0 |

Reaction windows: 829 attacks. Reacted to 371 (deck won 43% (38–48) n=315): stole 267, stoleNothing 2, attackerGone 4, targetGone 92, bothGone 6. Let 458 resolve (39% (33–45) n=225): stole 327, stoleNothing 5, attackerGone 1, targetGone 119, bothGone 6. Choices: endReact 476, call 337, block 37, play 6.

## S1-06 Cross (BGY) — 560 games, 24% won, 25381 decisions

| Card | Use | Uses | Win rate in games used (95%) | Legal turns → used | Not chosen | Early / mid / late uses | Ahead | Even | Behind |
|---|---|---|---|---|---|---|---|---|---|
| Psycho Squad | attacked | 933 | 29% (25–34) n=368 | 1059 → 826 | 22% | 101 / 399 / 433 | 52% (43–60) n=130 | 26% (19–34) n=132 | 27% (22–32) n=270 |
| Psycho Squad | played | 672 | 27% (23–31) n=448 | 893 → 666 | 25% | 365 / 174 / 133 | 36% (30–42) n=210 | 21% (16–28) n=180 | 22% (17–29) n=183 |
| Valentino Street Racer | played | 643 | 25% (21–29) n=440 | 1114 → 584 | 48% | 207 / 302 / 134 | 39% (31–46) n=158 | 12% (8–18) n=151 | 25% (19–31) n=220 |
| Alt Cunningham: Soulkiller Architect | ability | 580 | 24% (20–29) n=401 | 1983 → 579 | 71% | 11 / 171 / 398 | 48% (41–55) n=177 | 17% (10–27) n=66 | 9% (6–14) n=243 |
| Trauma Team Operatives | played | 571 | 25% (21–30) n=410 | 905 → 564 | 38% | 13 / 341 / 217 | 40% (32–48) n=142 | 16% (10–27) n=73 | 19% (14–24) n=275 |
| Muamar Reyes: El Capitán | ability | 556 | 22% (18–26) n=379 | 2058 → 556 | 73% | 14 / 182 / 360 | 48% (41–56) n=151 | 18% (10–29) n=62 | 6% (4–10) n=244 |
| Trauma Team Operatives | attacked | 529 | 30% (25–35) n=299 | 588 → 500 | 15% | 0 / 145 / 384 | 71% (61–80) n=84 | 44% (30–59) n=43 | 19% (15–25) n=233 |
| Placide: Voodoo Sentinel | played | 514 | 29% (25–34) n=403 | 539 → 514 | 5% | 0 / 0 / 514 | 71% (61–80) n=80 | 59% (42–74) n=34 | 19% (15–23) n=319 |
| Hanako Arasaka: Daughter of the Emperor | ability | 503 | 19% (15–24) n=353 | 2010 → 503 | 75% | 13 / 174 / 316 | 46% (37–55) n=118 | 17% (10–28) n=69 | 8% (5–12) n=238 |
| Valentino Street Racer | attacked | 495 | 29% (24–34) n=295 | 768 → 446 | 42% | 42 / 171 / 282 | 55% (45–65) n=93 | 25% (16–36) n=69 | 26% (20–32) n=207 |
| Alt Cunningham: Soulkiller Architect | called | 425 | 24% (20–28) n=425 | 425 → 425 | 0% | 264 / 121 / 40 | 30% (25–37) n=246 | 14% (8–23) n=92 | 15% (9–24) n=87 |
| Muamar Reyes: El Capitán | called | 412 | 27% (23–31) n=412 | 412 → 412 | 0% | 262 / 119 / 31 | 32% (27–38) n=260 | 15% (9–25) n=74 | 22% (14–32) n=78 |
| Hanako Arasaka: Daughter of the Emperor | called | 410 | 22% (19–27) n=410 | 410 → 410 | 0% | 272 / 92 / 46 | 29% (23–34) n=266 | 6% (3–14) n=80 | 17% (10–28) n=64 |
| Chrome Reverie | sold | 374 | 30% (25–35) n=303 | 923 → 374 | 59% | 154 / 126 / 94 | 38% (30–47) n=126 | 35% (25–45) n=81 | 21% (15–29) n=133 |
| The Heist | sold | 373 | 25% (20–30) n=311 | 497 → 373 | 25% | 180 / 80 / 113 | 34% (26–42) n=136 | 17% (11–25) n=101 | 18% (12–27) n=109 |

(30 more card uses in the JSON report.)

| Decision type | Decisions | First-listed option taken | Options offered (1 / 2 / 3–5 / 6–10 / 11–20 / 21+) |
|---|---|---|---|
| main | 13618 | 8% | 0 / 928 / 3109 / 5086 / 4370 / 125 |
| gig/rollIn | 2240 | 100% | 0 / 560 / 1680 / 0 / 0 / 0 |
| gig/steal | 2060 | 27% | 37 / 281 / 767 / 962 / 13 / 0 |
| gigValue/adjust | 846 | 10% | 0 / 28 / 61 / 104 / 507 / 146 |
| react | 752 | 44% | 0 / 420 / 331 / 1 / 0 / 0 |
| unit/bottomdeck | 645 | 47% | 144 / 145 / 348 / 8 / 0 / 0 |
| mulligan | 560 | 27% | 0 / 560 / 0 / 0 / 0 / 0 |
| mode/muamarCall | 547 | 75% | 0 / 547 / 0 / 0 / 0 / 0 |
| card/discard | 504 | 73% | 9 / 262 / 231 / 2 / 0 / 0 |
| gig/swapGive | 503 | 49% | 45 / 90 / 241 / 127 / 0 / 0 |
| gig/swapTake | 503 | 29% | 16 / 37 / 213 / 228 / 9 / 0 |
| card/playFromTrash | 376 | 66% | 177 / 98 / 98 / 3 / 0 / 0 |
| unit/adrenaline | 376 | 78% | 244 / 106 / 26 / 0 / 0 / 0 |
| unit/protect | 368 | 71% | 199 / 129 / 40 / 0 / 0 / 0 |
| unit/spend | 305 | 48% | 78 / 123 / 101 / 3 / 0 / 0 |
| mode/mode | 232 | 100% | 0 / 0 / 232 / 0 / 0 / 0 |
| unit/cantAttack | 219 | 59% | 86 / 73 / 59 / 1 / 0 / 0 |
| unit/bottomdeckOwn | 176 | 76% | 99 / 53 / 24 / 0 / 0 / 0 |
| unit/stealMod | 121 | 70% | 12 / 46 / 63 / 0 / 0 / 0 |
| unit/call | 91 | 100% | 0 / 42 / 49 / 0 / 0 / 0 |
| gigValue/setGig | 82 | 7% | 0 / 1 / 6 / 15 / 16 / 44 |
| unit/equip | 70 | 71% | 9 / 3 / 46 / 12 / 0 / 0 |
| unit/weaken | 67 | 61% | 18 / 19 / 26 / 4 / 0 / 0 |
| unit/ready | 46 | 100% | 0 / 46 / 0 / 0 / 0 / 0 |
| unit/sacrifice | 43 | 81% | 25 / 13 / 5 / 0 / 0 / 0 |
| yesno/draw | 13 | 100% | 0 / 13 / 0 / 0 / 0 / 0 |
| card/discardForNothing | 12 | 0% | 0 / 7 / 4 / 1 / 0 / 0 |
| mode/foolOnTheHill | 4 | 100% | 0 / 4 / 0 / 0 / 0 / 0 |
| card/search | 1 | 100% | 1 / 0 / 0 / 0 / 0 / 0 |
| yesno/playFree | 1 | 100% | 0 / 1 / 0 / 0 / 0 / 0 |

Reaction windows: 696 attacks. Reacted to 372 (deck won 20% (16–25) n=296): stole 230, stoleNothing 98, attackerGone 1, targetGone 29, bothGone 5, noneGone 9. Let 324 resolve (22% (16–28) n=176): stole 272, stoleNothing 3, targetGone 45, bothGone 4. Choices: call 290, endReact 334, play 128.

## S1-07 Explorer (RYY) — 560 games, 34% won, 25858 decisions

| Card | Use | Uses | Win rate in games used (95%) | Legal turns → used | Not chosen | Early / mid / late uses | Ahead | Even | Behind |
|---|---|---|---|---|---|---|---|---|---|
| Rockn' Rockerboy | attacked | 1066 | 38% (33–43) n=409 | 1071 → 962 | 10% | 0 / 446 / 620 | 54% (47–60) n=223 | 51% (42–60) n=108 | 31% (26–37) n=275 |
| 6th Street Recruits | attacked | 790 | 38% (34–43) n=365 | 899 → 713 | 21% | 87 / 235 / 468 | 59% (51–66) n=162 | 43% (34–51) n=127 | 31% (25–37) n=225 |
| Rockn' Rockerboy | played | 683 | 36% (31–40) n=459 | 863 → 680 | 21% | 241 / 193 / 249 | 51% (44–58) n=211 | 29% (22–37) n=137 | 25% (20–31) n=229 |
| 6th Street Recruits | played | 635 | 35% (30–39) n=432 | 1074 → 627 | 42% | 225 / 186 / 224 | 49% (42–56) n=174 | 31% (24–38) n=162 | 28% (22–34) n=205 |
| Gilded Matón | played | 497 | 30% (26–35) n=363 | 1643 → 461 | 72% | 64 / 137 / 296 | 46% (38–54) n=153 | 19% (13–28) n=100 | 20% (15–27) n=161 |
| Johnny Silverhand: Rocking Renegade | ability | 474 | 35% (30–40) n=341 | 1694 → 474 | 72% | 1 / 74 / 399 | 56% (49–63) n=169 | 25% (17–36) n=75 | 14% (10–20) n=163 |
| Johnny Silverhand: Rocking Renegade | called | 466 | 34% (30–38) n=466 | 466 → 466 | 0% | 215 / 157 / 94 | 40% (35–46) n=292 | 21% (14–31) n=81 | 25% (17–34) n=93 |
| River Ward: Detective on the Hunt | called | 463 | 34% (30–39) n=463 | 463 → 463 | 0% | 217 / 134 / 112 | 40% (35–46) n=300 | 24% (16–34) n=92 | 24% (16–35) n=71 |
| Kerry Eurodyne: Axe, Attitude, Audience | called | 450 | 34% (30–39) n=450 | 450 → 450 | 0% | 214 / 124 / 112 | 43% (37–48) n=298 | 20% (12–29) n=82 | 16% (9–26) n=70 |
| River Ward: Detective on the Hunt | ability | 429 | 32% (27–38) n=308 | 1880 → 429 | 77% | 25 / 77 / 327 | 52% (44–59) n=170 | 20% (12–32) n=60 | 9% (5–15) n=134 |
| Viktor Vektor: You Might Feel a Little Pinch | played | 422 | 34% (29–39) n=339 | 897 → 405 | 55% | 90 / 186 / 146 | 48% (40–56) n=145 | 24% (16–33) n=97 | 27% (20–35) n=134 |
| Dexter DeShawn: One Last Chance | played | 418 | 33% (28–38) n=341 | 725 → 403 | 44% | 95 / 186 / 137 | 41% (33–50) n=138 | 24% (17–33) n=96 | 30% (23–38) n=142 |
| Minotaur | played | 409 | 32% (27–37) n=345 | 634 → 409 | 35% | 0 / 146 / 263 | 53% (43–62) n=110 | 35% (23–49) n=46 | 21% (16–27) n=218 |
| Cyberpsychosis | sold | 400 | 32% (27–37) n=338 | 744 → 400 | 46% | 121 / 145 / 134 | 43% (35–51) n=136 | 32% (22–44) n=68 | 22% (16–28) n=172 |
| The Heist | sold | 383 | 32% (27–38) n=325 | 580 → 383 | 34% | 169 / 120 / 94 | 43% (35–52) n=121 | 27% (19–36) n=109 | 25% (18–34) n=123 |

(30 more card uses in the JSON report.)

| Decision type | Decisions | First-listed option taken | Options offered (1 / 2 / 3–5 / 6–10 / 11–20 / 21+) |
|---|---|---|---|
| main | 14709 | 7% | 0 / 1137 / 3884 / 5649 / 3842 / 197 |
| gig/steal | 2742 | 28% | 133 / 381 / 1187 / 1030 / 11 / 0 |
| gig/rollIn | 2240 | 0% | 0 / 560 / 1680 / 0 / 0 / 0 |
| yesno/kerryReroll | 1598 | 56% | 0 / 1598 / 0 / 0 / 0 / 0 |
| gigValue/adjust | 1067 | 10% | 0 / 9 / 111 / 138 / 552 / 257 |
| react | 1037 | 76% | 0 / 700 / 337 / 0 / 0 / 0 |
| mulligan | 560 | 20% | 0 / 560 / 0 / 0 / 0 / 0 |
| unit/lagAttack | 474 | 93% | 89 / 142 / 228 / 15 / 0 / 0 |
| unit/equip | 350 | 75% | 22 / 70 / 203 / 55 / 0 / 0 |
| unit/defeat | 312 | 67% | 105 / 52 / 100 / 55 / 0 / 0 |
| unit/sacrifice | 255 | 54% | 69 / 98 / 87 / 1 / 0 / 0 |
| card/defeatGear | 145 | 55% | 0 / 128 / 17 / 0 / 0 / 0 |
| card/trash | 101 | 42% | 0 / 101 / 0 / 0 / 0 / 0 |
| card/playFree | 92 | 85% | 70 / 4 / 17 / 1 / 0 / 0 |
| yesno/draw | 55 | 100% | 0 / 55 / 0 / 0 / 0 / 0 |
| card/discard | 52 | 48% | 14 / 12 / 26 / 0 / 0 / 0 |
| card/search | 52 | 69% | 24 / 24 / 4 / 0 / 0 / 0 |
| mode/foolOnTheHill | 6 | 33% | 0 / 6 / 0 / 0 / 0 / 0 |
| yesno/playFree | 6 | 100% | 0 / 6 / 0 / 0 / 0 / 0 |
| unit/pump | 5 | 80% | 4 / 1 / 0 / 0 / 0 / 0 |

Reaction windows: 1003 attacks. Reacted to 239 (deck won 27% (22–34) n=222): stole 203, targetGone 32, bothGone 4. Let 764 resolve (30% (25–36) n=307): stole 577, stoleNothing 5, attackerGone 1, targetGone 169, bothGone 12. Choices: call 230, endReact 793, ability 11, play 3.

## S1-08 Explorer (BGG) — 560 games, 46% won, 23997 decisions

| Card | Use | Uses | Win rate in games used (95%) | Legal turns → used | Not chosen | Early / mid / late uses | Ahead | Even | Behind |
|---|---|---|---|---|---|---|---|---|---|
| Nadia: Fighting Through Grief | attacked | 730 | 45% (40–51) n=304 | 751 → 659 | 12% | 0 / 230 / 500 | 75% (67–82) n=129 | 57% (43–69) n=53 | 38% (32–44) n=243 |
| Psycho Squad | attacked | 728 | 50% (45–56) n=306 | 850 → 665 | 22% | 46 / 281 / 401 | 69% (62–76) n=162 | 56% (47–65) n=114 | 41% (34–49) n=177 |
| Pepe Najarro: Working Doubles | attacked | 654 | 51% (45–56) n=273 | 757 → 587 | 22% | 52 / 220 / 382 | 70% (62–78) n=132 | 58% (47–67) n=90 | 43% (36–51) n=163 |
| MaxTac AV | attacked | 546 | 56% (49–62) n=232 | 592 → 519 | 12% | 0 / 251 / 295 | 69% (61–75) n=153 | 70% (57–81) n=54 | 48% (39–56) n=130 |
| Hanako Arasaka: Daughter of the Emperor | ability | 530 | 37% (32–42) n=341 | 1900 → 530 | 72% | 5 / 103 / 422 | 62% (55–69) n=178 | 22% (15–32) n=89 | 13% (9–19) n=159 |
| Psycho Squad | played | 518 | 46% (41–51) n=374 | 1004 → 505 | 50% | 225 / 133 / 160 | 54% (47–61) n=187 | 44% (36–52) n=141 | 29% (21–38) n=112 |
| Valentino Street Racer | played | 509 | 46% (41–51) n=375 | 1169 → 463 | 60% | 105 / 210 / 194 | 59% (52–66) n=172 | 35% (27–44) n=117 | 32% (24–40) n=130 |
| Judy Álvarez: Braindance Maestro | ability | 507 | 42% (37–48) n=344 | 1898 → 507 | 73% | 7 / 106 / 394 | 65% (58–71) n=195 | 20% (12–30) n=71 | 19% (14–26) n=164 |
| Pepe Najarro: Working Doubles | played | 494 | 49% (43–54) n=352 | 1018 → 485 | 52% | 192 / 127 / 175 | 62% (55–69) n=159 | 44% (36–53) n=140 | 30% (23–38) n=127 |
| Nadia: Fighting Through Grief | played | 484 | 46% (41–51) n=364 | 922 → 484 | 48% | 0 / 257 / 227 | 66% (58–74) n=137 | 43% (31–56) n=56 | 35% (29–42) n=224 |
| Valentino Street Racer | attacked | 469 | 45% (39–51) n=269 | 622 → 434 | 30% | 23 / 112 / 334 | 70% (61–77) n=129 | 40% (29–53) n=60 | 27% (21–35) n=150 |
| Hanako Arasaka: Daughter of the Emperor | called | 444 | 47% (42–51) n=444 | 444 → 444 | 0% | 221 / 142 / 81 | 52% (46–58) n=298 | 35% (25–46) n=74 | 38% (27–49) n=72 |
| Saburo Arasaka: Stubborn Patriarch | called | 440 | 47% (42–51) n=440 | 440 → 440 | 0% | 228 / 132 / 80 | 50% (45–56) n=301 | 35% (24–47) n=66 | 41% (31–53) n=73 |
| Judy Álvarez: Braindance Maestro | called | 438 | 47% (42–51) n=438 | 438 → 438 | 0% | 234 / 130 / 74 | 54% (48–59) n=312 | 28% (19–39) n=72 | 31% (21–45) n=54 |
| Placide: Voodoo Sentinel | played | 415 | 45% (40–51) n=342 | 484 → 415 | 14% | 0 / 0 / 415 | 75% (66–82) n=111 | 57% (43–70) n=49 | 27% (21–33) n=208 |

(33 more card uses in the JSON report.)

Legal but never taken: Take Control (played, legal in 277 turns).

| Decision type | Decisions | First-listed option taken | Options offered (1 / 2 / 3–5 / 6–10 / 11–20 / 21+) |
|---|---|---|---|
| main | 13822 | 7% | 0 / 1242 / 3955 / 5661 / 2872 / 92 |
| gig/steal | 2962 | 30% | 129 / 409 / 1309 / 1101 / 14 / 0 |
| gig/rollIn | 2240 | 0% | 0 / 560 / 1680 / 0 / 0 / 0 |
| gig/swapGive | 860 | 34% | 10 / 63 / 470 / 315 / 2 / 0 |
| gig/swapTake | 808 | 38% | 65 / 139 / 347 / 252 / 5 / 0 |
| react | 682 | 54% | 0 / 472 / 207 / 3 / 0 / 0 |
| mulligan | 560 | 27% | 0 / 560 / 0 / 0 / 0 / 0 |
| card/discard | 431 | 63% | 31 / 218 / 179 / 3 / 0 / 0 |
| unit/adrenaline | 378 | 55% | 166 / 151 / 61 / 0 / 0 / 0 |
| unit/defeat | 353 | 66% | 143 / 92 / 115 / 3 / 0 / 0 |
| unit/equip | 258 | 87% | 73 / 37 / 133 / 15 / 0 / 0 |
| yesno/addToHand | 218 | 100% | 0 / 218 / 0 / 0 / 0 / 0 |
| unit/bottomdeck | 212 | 45% | 33 / 65 / 111 / 3 / 0 / 0 |
| unit/sacrifice | 54 | 89% | 35 / 13 / 6 / 0 / 0 / 0 |
| unit/spend | 52 | 62% | 22 / 17 / 13 / 0 / 0 / 0 |
| mode/mode | 29 | 100% | 0 / 0 / 29 / 0 / 0 / 0 |
| unit/pump | 23 | 65% | 7 / 9 / 7 / 0 / 0 / 0 |
| unit/stealMod | 14 | 71% | 3 / 2 / 9 / 0 / 0 / 0 |
| card/playFree | 12 | 100% | 0 / 9 / 3 / 0 / 0 / 0 |
| yesno/draw | 12 | 100% | 0 / 12 / 0 / 0 / 0 / 0 |
| unit/bottomdeckOwn | 8 | 63% | 3 / 3 / 2 / 0 / 0 / 0 |
| card/discardForNothing | 4 | 0% | 0 / 2 / 2 / 0 / 0 / 0 |
| mode/foolOnTheHill | 4 | 100% | 0 / 4 / 0 / 0 / 0 / 0 |
| mode/rivalChoice | 1 | 0% | 0 / 1 / 0 / 0 / 0 / 0 |

Reaction windows: 653 attacks. Reacted to 294 (deck won 38% (32–44) n=256): fizzled 14, stole 184, stoleNothing 12, attackerGone 2, targetGone 78, bothGone 4. Let 359 resolve (44% (37–51) n=206): stole 258, stoleNothing 4, targetGone 88, bothGone 9. Choices: call 238, endReact 368, play 14, block 48, ability 14.

## S2-01 Mutant (RYY) — 560 games, 38% won, 25896 decisions

| Card | Use | Uses | Win rate in games used (95%) | Legal turns → used | Not chosen | Early / mid / late uses | Ahead | Even | Behind |
|---|---|---|---|---|---|---|---|---|---|
| Rockn' Rockerboy | attacked | 874 | 47% (42–52) n=337 | 894 → 786 | 12% | 0 / 373 / 501 | 60% (54–67) n=202 | 60% (49–70) n=85 | 38% (31–45) n=189 |
| 6th Street Recruits | attacked | 819 | 42% (37–47) n=355 | 883 → 746 | 16% | 100 / 263 / 456 | 57% (50–64) n=192 | 42% (35–51) n=139 | 31% (25–38) n=187 |
| Rockn' Rockerboy | played | 643 | 41% (36–45) n=438 | 873 → 643 | 26% | 238 / 176 / 229 | 52% (46–59) n=227 | 45% (37–53) n=149 | 23% (17–29) n=177 |
| 6th Street Recruits | played | 616 | 39% (35–44) n=418 | 1079 → 600 | 44% | 221 / 204 / 191 | 47% (40–54) n=190 | 37% (30–45) n=175 | 31% (24–39) n=151 |
| Dexter DeShawn: One Last Chance | played | 615 | 37% (33–42) n=419 | 1138 → 557 | 51% | 144 / 274 / 197 | 48% (42–55) n=211 | 30% (23–38) n=140 | 28% (22–36) n=141 |
| Dexter DeShawn: Off the Grid | ability | 609 | 35% (30–40) n=397 | 1884 → 609 | 68% | 25 / 103 / 481 | 56% (49–62) n=223 | 20% (13–29) n=90 | 11% (7–16) n=176 |
| Rogue Amendiares: Preem Solo | attacked | 585 | 34% (30–39) n=401 | 634 → 585 | 8% | 0 / 130 / 455 | 57% (49–64) n=175 | 44% (32–57) n=59 | 23% (18–29) n=238 |
| Dexter DeShawn: One Last Chance | attacked | 573 | 40% (34–45) n=308 | 729 → 508 | 30% | 32 / 183 / 358 | 57% (49–65) n=149 | 48% (38–59) n=83 | 29% (23–36) n=173 |
| Rogue Amendiares: Preem Solo | Go Solo (self-paid 422) | 422 | 34% (29–38) n=422 | 869 → 422 | 51% | 0 / 141 / 281 | 55% (46–63) n=137 | 28% (16–44) n=36 | 23% (18–28) n=249 |
| Cyberpsychosis | sold | 413 | 37% (32–42) n=345 | 777 → 413 | 47% | 103 / 171 / 139 | 45% (38–53) n=159 | 37% (27–47) n=87 | 25% (19–33) n=140 |
| Detonate | sold | 407 | 36% (31–41) n=346 | 519 → 407 | 22% | 220 / 80 / 107 | 46% (39–54) n=151 | 35% (28–44) n=127 | 19% (12–28) n=96 |
| Dum Dum: Maelstrom Triggerman | called | 404 | 34% (30–39) n=404 | 436 → 404 | 7% | 184 / 110 / 110 | 42% (36–48) n=260 | 25% (17–35) n=81 | 16% (9–27) n=63 |
| Dexter DeShawn: Off the Grid | called | 400 | 38% (33–42) n=400 | 425 → 400 | 6% | 184 / 121 / 95 | 44% (38–50) n=262 | 28% (18–40) n=65 | 22% (14–33) n=73 |
| Over the Edge | sold | 397 | 35% (30–41) n=308 | 1756 → 397 | 77% | 39 / 157 / 201 | 45% (37–54) n=119 | 34% (23–47) n=56 | 28% (22–35) n=173 |
| Rogue Amendiares: Preem Solo | called | 383 | 37% (33–42) n=383 | 407 → 383 | 6% | 181 / 112 / 90 | 43% (37–49) n=251 | 30% (21–42) n=66 | 24% (16–36) n=66 |

(36 more card uses in the JSON report.)

Legal but never taken: Rogue Amendiares: Preem Solo (Legend play, legal in 869 turns), Cyberpsychosis (played, legal in 150 turns).

| Decision type | Decisions | First-listed option taken | Options offered (1 / 2 / 3–5 / 6–10 / 11–20 / 21+) |
|---|---|---|---|
| main | 14769 | 7% | 0 / 1035 / 3575 / 5343 / 4581 / 235 |
| gig/steal | 2933 | 28% | 174 / 494 / 1240 / 1015 / 10 / 0 |
| gig/rollIn | 2240 | 0% | 0 / 560 / 1680 / 0 / 0 / 0 |
| gigValue/adjust | 2150 | 10% | 0 / 7 / 150 / 315 / 1230 / 448 |
| react | 979 | 70% | 0 / 511 / 467 / 1 / 0 / 0 |
| mulligan | 560 | 16% | 0 / 560 / 0 / 0 / 0 / 0 |
| mode/mode | 526 | 69% | 0 / 526 / 0 / 0 / 0 / 0 |
| unit/pump | 460 | 53% | 123 / 171 / 162 / 4 / 0 / 0 |
| unit/equip | 414 | 86% | 67 / 82 / 226 / 39 / 0 / 0 |
| unit/sacrifice | 208 | 53% | 67 / 76 / 65 / 0 / 0 / 0 |
| unit/defeat | 204 | 57% | 32 / 36 / 81 / 54 / 1 / 0 |
| card/defeatGear | 166 | 71% | 0 / 136 / 30 / 0 / 0 / 0 |
| card/discard | 120 | 71% | 7 / 60 / 50 / 3 / 0 / 0 |
| unit/call | 98 | 100% | 0 / 49 / 49 / 0 / 0 / 0 |
| yesno/draw | 34 | 100% | 0 / 34 / 0 / 0 / 0 / 0 |
| card/playFree | 17 | 100% | 16 / 1 / 0 / 0 / 0 / 0 |
| mode/foolOnTheHill | 10 | 50% | 0 / 10 / 0 / 0 / 0 / 0 |
| card/defeat | 8 | 88% | 7 / 1 / 0 / 0 / 0 / 0 |

Reaction windows: 952 attacks. Reacted to 295 (deck won 32% (27–38) n=262): stole 210, stoleNothing 2, attackerGone 8, targetGone 62, bothGone 13. Let 657 resolve (35% (29–41) n=279): stole 467, stoleNothing 6, attackerGone 9, targetGone 160, bothGone 15. Choices: endReact 682, call 287, ability 7, play 3.

## S2-02 Mutant (RGG) — 560 games, 53% won, 22790 decisions

| Card | Use | Uses | Win rate in games used (95%) | Legal turns → used | Not chosen | Early / mid / late uses | Ahead | Even | Behind |
|---|---|---|---|---|---|---|---|---|---|
| Jackie Welles: Mama's Favorite | attacked | 769 | 50% (45–55) n=404 | 863 → 769 | 11% | 0 / 319 / 450 | 64% (57–70) n=234 | 53% (43–64) n=86 | 47% (41–54) n=203 |
| Pepe Najarro: Working Doubles | attacked | 703 | 53% (48–59) n=302 | 802 → 646 | 19% | 58 / 263 / 382 | 69% (62–75) n=170 | 48% (38–58) n=98 | 47% (40–54) n=177 |
| 6th Street Recruits | attacked | 670 | 52% (46–57) n=299 | 769 → 616 | 20% | 58 / 240 / 372 | 68% (60–74) n=157 | 47% (37–57) n=96 | 46% (39–54) n=171 |
| Nadia: Fighting Through Grief | attacked | 662 | 51% (45–56) n=290 | 690 → 607 | 12% | 0 / 180 / 482 | 77% (70–84) n=133 | 71% (58–82) n=49 | 43% (37–49) n=224 |
| MaxTac AV | attacked | 510 | 61% (55–67) n=229 | 563 → 490 | 13% | 0 / 242 / 268 | 74% (66–80) n=144 | 74% (60–84) n=46 | 56% (47–64) n=125 |
| 6th Street Recruits | played | 478 | 48% (43–53) n=358 | 1005 → 476 | 53% | 225 / 107 / 146 | 55% (47–63) n=158 | 48% (40–56) n=138 | 34% (26–43) n=116 |
| Pepe Najarro: Working Doubles | played | 474 | 51% (46–56) n=359 | 1011 → 469 | 54% | 226 / 113 / 135 | 56% (48–63) n=169 | 47% (39–55) n=144 | 43% (34–53) n=95 |
| Jackie Welles: Mama's Favorite | called | 463 | 53% (48–57) n=463 | 463 → 463 | 0% | 231 / 161 / 71 | 55% (50–60) n=341 | 46% (34–58) n=63 | 46% (34–58) n=59 |
| Saburo Arasaka: Stubborn Patriarch | called | 460 | 54% (50–59) n=460 | 460 → 460 | 0% | 213 / 152 / 95 | 61% (56–66) n=334 | 45% (34–57) n=66 | 25% (16–37) n=60 |
| Valentino Street Racer | attacked | 453 | 55% (49–61) n=258 | 573 → 414 | 28% | 18 / 122 / 313 | 68% (60–75) n=142 | 63% (52–73) n=78 | 39% (30–48) n=111 |
| Adam Smasher: Ender of Legends | called | 449 | 52% (48–57) n=449 | 449 → 449 | 0% | 218 / 129 / 102 | 55% (50–61) n=328 | 47% (36–59) n=74 | 38% (26–53) n=47 |
| Memory Relapse | sold | 443 | 54% (49–60) n=345 | 1150 → 443 | 61% | 114 / 189 / 140 | 55% (48–63) n=159 | 51% (41–61) n=92 | 55% (47–63) n=134 |
| Valentino Street Racer | played | 435 | 53% (48–58) n=342 | 1269 → 401 | 68% | 112 / 143 / 180 | 66% (58–72) n=169 | 48% (39–58) n=104 | 37% (28–47) n=95 |
| Nadia: Fighting Through Grief | played | 429 | 50% (44–55) n=342 | 874 → 429 | 51% | 0 / 233 / 196 | 57% (49–65) n=131 | 58% (45–71) n=53 | 39% (32–46) n=198 |
| Jackie Welles: Mama's Favorite | Go Solo (self-paid 424) | 424 | 48% (44–53) n=424 | 853 → 424 | 50% | 0 / 255 / 169 | 53% (45–60) n=168 | 43% (32–55) n=67 | 46% (39–53) n=189 |

(32 more card uses in the JSON report.)

Legal but never taken: Jackie Welles: Mama's Favorite (Legend play, legal in 855 turns).

| Decision type | Decisions | First-listed option taken | Options offered (1 / 2 / 3–5 / 6–10 / 11–20 / 21+) |
|---|---|---|---|
| main | 13148 | 5% | 0 / 1376 / 3997 / 5359 / 2331 / 85 |
| gig/steal | 3403 | 29% | 159 / 542 / 1595 / 1085 / 22 / 0 |
| gig/rollIn | 2240 | 0% | 0 / 560 / 1680 / 0 / 0 / 0 |
| unit/ready | 838 | 74% | 0 / 404 / 425 / 9 / 0 / 0 |
| mulligan | 560 | 27% | 0 / 560 / 0 / 0 / 0 / 0 |
| react | 498 | 56% | 0 / 306 / 192 / 0 / 0 / 0 |
| unit/defeat | 449 | 58% | 128 / 127 / 187 / 7 / 0 / 0 |
| unit/adrenaline | 319 | 56% | 150 / 113 / 56 / 0 / 0 / 0 |
| gig/swapGive | 304 | 34% | 0 / 23 / 225 / 56 / 0 / 0 |
| yesno/replaceDefeat | 274 | 6% | 0 / 274 / 0 / 0 / 0 / 0 |
| gig/swapTake | 254 | 50% | 53 / 71 / 83 / 42 / 5 / 0 |
| gigValue/adjust | 156 | 7% | 0 / 0 / 0 / 1 / 16 / 139 |
| unit/spend | 85 | 71% | 48 / 25 / 12 / 0 / 0 / 0 |
| unit/equip | 79 | 82% | 7 / 24 / 46 / 2 / 0 / 0 |
| unit/sacrifice | 65 | 83% | 37 / 21 / 7 / 0 / 0 / 0 |
| card/discard | 47 | 60% | 5 / 12 / 30 / 0 / 0 / 0 |
| gigValue/setGig | 22 | 9% | 0 / 0 / 1 / 1 / 4 / 16 |
| yesno/draw | 19 | 100% | 0 / 19 / 0 / 0 / 0 / 0 |
| card/playFree | 10 | 70% | 0 / 6 / 4 / 0 / 0 / 0 |
| unit/pump | 10 | 80% | 2 / 7 / 1 / 0 / 0 / 0 |
| mode/foolOnTheHill | 6 | 83% | 0 / 6 / 0 / 0 / 0 / 0 |
| mode/rivalChoice | 4 | 25% | 0 / 4 / 0 / 0 / 0 / 0 |

Reaction windows: 492 attacks. Reacted to 218 (deck won 43% (37–50) n=199): stole 181, attackerGone 7, targetGone 24, bothGone 6. Let 274 resolve (46% (38–54) n=159): stole 205, targetGone 60, bothGone 9. Choices: endReact 279, call 210, play 9.

## S2-03 Cross (RGY) — 560 games, 49% won, 26726 decisions

| Card | Use | Uses | Win rate in games used (95%) | Legal turns → used | Not chosen | Early / mid / late uses | Ahead | Even | Behind |
|---|---|---|---|---|---|---|---|---|---|
| Rockn' Rockerboy | attacked | 814 | 58% (53–63) n=325 | 816 → 718 | 12% | 0 / 365 / 449 | 72% (66–78) n=201 | 67% (56–76) n=78 | 52% (45–59) n=181 |
| 6th Street Recruits | attacked | 704 | 53% (47–58) n=328 | 793 → 637 | 20% | 55 / 226 / 423 | 75% (67–81) n=143 | 52% (43–61) n=108 | 46% (39–53) n=204 |
| Corporate Surveillance | sold | 628 | 48% (44–53) n=427 | 819 → 628 | 23% | 267 / 162 / 199 | 61% (54–67) n=204 | 44% (36–52) n=146 | 37% (31–45) n=177 |
| Viktor Vektor: You Might Feel a Little Pinch | attacked | 601 | 51% (45–56) n=316 | 773 → 520 | 33% | 18 / 178 / 405 | 75% (68–82) n=151 | 44% (33–56) n=70 | 37% (30–44) n=187 |
| 6th Street Recruits | played | 586 | 48% (43–53) n=412 | 1048 → 575 | 45% | 211 / 201 / 174 | 63% (55–69) n=176 | 43% (35–51) n=142 | 37% (30–44) n=185 |
| Field Operator | attacked | 576 | 52% (47–58) n=307 | 725 → 513 | 29% | 14 / 134 / 428 | 77% (69–83) n=141 | 55% (43–67) n=67 | 40% (33–47) n=192 |
| Viktor Vektor: You Might Feel a Little Pinch | played | 571 | 48% (43–53) n=408 | 1151 → 520 | 55% | 102 / 328 / 141 | 63% (56–70) n=180 | 41% (32–50) n=116 | 39% (32–46) n=177 |
| Rockn' Rockerboy | played | 538 | 53% (48–58) n=401 | 846 → 538 | 36% | 236 / 160 / 142 | 66% (59–73) n=178 | 53% (44–61) n=133 | 43% (35–50) n=160 |
| Field Operator | played | 536 | 48% (43–53) n=380 | 1332 → 497 | 63% | 61 / 341 / 134 | 60% (52–67) n=176 | 35% (26–45) n=92 | 42% (35–50) n=172 |
| Shattered Memories | sold | 490 | 53% (47–58) n=373 | 1592 → 490 | 69% | 83 / 209 / 198 | 63% (54–70) n=136 | 57% (47–67) n=87 | 44% (37–51) n=207 |
| Adam Smasher: Ender of Legends | attacked | 463 | 57% (52–62) n=342 | 482 → 463 | 4% | 0 / 0 / 463 | 91% (83–95) n=90 | 84% (73–91) n=68 | 43% (37–49) n=243 |
| Valentino Street Racer | attacked | 439 | 52% (46–58) n=257 | 567 → 416 | 27% | 12 / 123 / 304 | 79% (71–85) n=126 | 59% (44–72) n=44 | 38% (30–46) n=151 |
| Kerry Eurodyne: Axe, Attitude, Audience | called | 426 | 50% (45–54) n=426 | 426 → 426 | 0% | 218 / 146 / 62 | 58% (53–64) n=295 | 37% (27–49) n=70 | 23% (14–35) n=61 |
| Pepe Najarro: Working Doubles | attacked | 425 | 53% (47–60) n=243 | 540 → 418 | 23% | 37 / 131 / 257 | 72% (63–80) n=105 | 65% (52–75) n=62 | 44% (36–52) n=145 |
| Saburo Arasaka: Stubborn Patriarch | called | 425 | 50% (45–55) n=425 | 425 → 425 | 0% | 241 / 112 / 72 | 58% (52–63) n=299 | 32% (22–44) n=68 | 33% (22–46) n=58 |

(27 more card uses in the JSON report.)

| Decision type | Decisions | First-listed option taken | Options offered (1 / 2 / 3–5 / 6–10 / 11–20 / 21+) |
|---|---|---|---|
| main | 14510 | 7% | 0 / 950 / 3812 / 5425 / 3973 / 350 |
| gig/steal | 3884 | 26% | 143 / 510 / 1547 / 1634 / 50 / 0 |
| gig/rollIn | 2240 | 0% | 0 / 560 / 1680 / 0 / 0 / 0 |
| yesno/kerryReroll | 1633 | 59% | 0 / 1633 / 0 / 0 / 0 / 0 |
| unit/ready | 1290 | 62% | 0 / 468 / 775 / 47 / 0 / 0 |
| react | 692 | 53% | 0 / 479 / 213 / 0 / 0 / 0 |
| mulligan | 560 | 4% | 0 / 560 / 0 / 0 / 0 / 0 |
| unit/defeat | 430 | 34% | 17 / 54 / 281 / 78 / 0 / 0 |
| unit/adrenaline | 373 | 49% | 137 / 128 / 105 / 3 / 0 / 0 |
| card/search | 333 | 73% | 0 / 161 / 172 / 0 / 0 / 0 |
| gigValue/adjust | 279 | 8% | 0 / 11 / 50 / 3 / 30 / 185 |
| unit/spend | 164 | 52% | 32 / 62 / 70 / 0 / 0 / 0 |
| card/playFree | 81 | 79% | 0 / 45 / 36 / 0 / 0 / 0 |
| gigValue/setGig | 65 | 0% | 0 / 0 / 0 / 3 / 14 / 48 |
| unit/sacrifice | 60 | 77% | 30 / 9 / 20 / 1 / 0 / 0 |
| card/discard | 49 | 49% | 8 / 11 / 26 / 4 / 0 / 0 |
| yesno/draw | 45 | 100% | 0 / 45 / 0 / 0 / 0 / 0 |
| unit/pump | 27 | 67% | 3 / 7 / 17 / 0 / 0 / 0 |
| mode/foolOnTheHill | 10 | 60% | 0 / 10 / 0 / 0 / 0 / 0 |
| mode/rivalChoice | 1 | 0% | 0 / 1 / 0 / 0 / 0 / 0 |

Reaction windows: 684 attacks. Reacted to 320 (deck won 45% (39–51) n=274): stole 241, stoleNothing 1, attackerGone 15, targetGone 48, bothGone 15. Let 364 resolve (42% (35–49) n=205): stole 238, targetGone 116, bothGone 10. Choices: call 300, endReact 368, play 24.

## S2-04 Cross (RRG) — 560 games, 54% won, 26211 decisions

| Card | Use | Uses | Win rate in games used (95%) | Legal turns → used | Not chosen | Early / mid / late uses | Ahead | Even | Behind |
|---|---|---|---|---|---|---|---|---|---|
| 6th Street Recruits | attacked | 848 | 54% (49–59) n=366 | 1033 → 757 | 27% | 78 / 308 / 462 | 72% (65–78) n=189 | 53% (44–62) n=124 | 48% (42–55) n=233 |
| Animals Wrecker | attacked | 755 | 64% (59–69) n=308 | 717 → 677 | 6% | 0 / 180 / 575 | 84% (77–89) n=138 | 86% (77–92) n=73 | 59% (53–65) n=244 |
| V: Streetkid | attacked | 679 | 49% (44–54) n=413 | 830 → 679 | 18% | 71 / 193 / 415 | 63% (57–68) n=258 | 46% (34–57) n=68 | 36% (29–43) n=179 |
| Dexter DeShawn: Off the Grid | ability | 677 | 50% (46–55) n=427 | 1931 → 677 | 65% | 18 / 85 / 574 | 72% (66–77) n=285 | 20% (12–31) n=70 | 15% (10–21) n=183 |
| Valentino Street Racer | attacked | 603 | 55% (49–61) n=296 | 766 → 531 | 31% | 35 / 168 / 400 | 72% (65–79) n=154 | 55% (46–65) n=103 | 43% (36–51) n=162 |
| Pepe Najarro: Working Doubles | attacked | 577 | 57% (52–63) n=282 | 755 → 545 | 28% | 49 / 212 / 316 | 76% (68–82) n=141 | 64% (53–73) n=86 | 49% (41–56) n=171 |
| Valentino Street Racer | played | 540 | 53% (48–58) n=377 | 1211 → 501 | 59% | 159 / 175 / 206 | 64% (57–71) n=162 | 44% (36–52) n=144 | 46% (38–54) n=140 |
| 6th Street Recruits | played | 536 | 54% (49–59) n=391 | 908 → 528 | 42% | 270 / 107 / 159 | 64% (57–71) n=183 | 53% (45–61) n=152 | 42% (34–51) n=130 |
| Animals Wrecker | played | 512 | 60% (55–65) n=382 | 684 → 512 | 25% | 0 / 349 / 163 | 70% (62–76) n=152 | 61% (50–71) n=77 | 53% (47–60) n=222 |
| Shattered Memories | sold | 486 | 53% (48–58) n=378 | 1433 → 486 | 66% | 93 / 205 / 188 | 57% (50–65) n=155 | 53% (43–63) n=89 | 50% (43–57) n=191 |
| V: Streetkid | Go Solo (self-paid 454) | 454 | 49% (45–54) n=454 | 1038 → 454 | 56% | 81 / 111 / 262 | 60% (54–66) n=221 | 45% (33–58) n=60 | 37% (30–44) n=173 |
| Memory Relapse | sold | 454 | 56% (51–61) n=345 | 1353 → 454 | 66% | 79 / 200 / 175 | 65% (56–72) n=127 | 67% (56–76) n=78 | 47% (40–54) n=198 |
| Dexter DeShawn: Off the Grid | called | 452 | 56% (52–61) n=452 | 452 → 452 | 0% | 201 / 148 / 103 | 62% (57–68) n=292 | 49% (38–61) n=67 | 42% (32–52) n=93 |
| V: Streetkid | called | 431 | 53% (48–58) n=431 | 431 → 431 | 0% | 226 / 103 / 102 | 57% (51–63) n=266 | 49% (38–59) n=82 | 43% (33–54) n=83 |
| Saburo Arasaka: Stubborn Patriarch | called | 431 | 53% (48–58) n=431 | 431 → 431 | 0% | 226 / 112 / 93 | 59% (53–64) n=289 | 47% (36–59) n=70 | 36% (26–48) n=72 |

(30 more card uses in the JSON report.)

Legal but never taken: V: Streetkid (Legend play, legal in 1038 turns), Appetite for Destruction (played, legal in 483 turns).

| Decision type | Decisions | First-listed option taken | Options offered (1 / 2 / 3–5 / 6–10 / 11–20 / 21+) |
|---|---|---|---|
| main | 14795 | 8% | 0 / 1199 / 3903 / 5094 / 4403 / 196 |
| gig/steal | 3490 | 28% | 177 / 468 / 1503 / 1323 / 19 / 0 |
| gig/rollIn | 2240 | 0% | 0 / 560 / 1680 / 0 / 0 / 0 |
| gigValue/adjust | 1012 | 8% | 0 / 10 / 62 / 46 / 549 / 345 |
| unit/defeat | 710 | 69% | 252 / 202 / 206 / 50 / 0 / 0 |
| mulligan | 560 | 20% | 0 / 560 / 0 / 0 / 0 / 0 |
| react | 560 | 47% | 0 / 319 / 241 / 0 / 0 / 0 |
| mode/mode | 546 | 67% | 0 / 546 / 0 / 0 / 0 / 0 |
| unit/adrenaline | 476 | 74% | 260 / 152 / 64 / 0 / 0 / 0 |
| card/search | 455 | 72% | 190 / 172 / 92 / 1 / 0 / 0 |
| card/playFree | 405 | 72% | 0 / 135 / 258 / 12 / 0 / 0 |
| unit/pump | 360 | 60% | 123 / 139 / 98 / 0 / 0 / 0 |
| unit/equip | 228 | 86% | 37 / 77 / 86 / 28 / 0 / 0 |
| unit/spend | 159 | 67% | 67 / 53 / 39 / 0 / 0 / 0 |
| card/discard | 51 | 53% | 13 / 8 / 25 / 5 / 0 / 0 |
| yesno/draw | 50 | 100% | 0 / 50 / 0 / 0 / 0 / 0 |
| unit/sacrifice | 49 | 84% | 36 / 6 / 7 / 0 / 0 / 0 |
| unit/ready | 45 | 100% | 0 / 45 / 0 / 0 / 0 / 0 |
| card/defeat | 9 | 89% | 8 / 1 / 0 / 0 / 0 / 0 |
| mode/foolOnTheHill | 7 | 43% | 0 / 7 / 0 / 0 / 0 / 0 |
| mode/rivalChoice | 4 | 0% | 0 / 4 / 0 / 0 / 0 / 0 |

Reaction windows: 557 attacks. Reacted to 298 (deck won 47% (41–53) n=275): stole 240, attackerGone 2, targetGone 52, bothGone 4. Let 259 resolve (42% (34–50) n=151): stole 190, targetGone 68, bothGone 1. Choices: call 297, endReact 261, play 2.

## S2-05 Counter (RRG) — 560 games, 59% won, 26162 decisions

| Card | Use | Uses | Win rate in games used (95%) | Legal turns → used | Not chosen | Early / mid / late uses | Ahead | Even | Behind |
|---|---|---|---|---|---|---|---|---|---|
| Pepe Najarro: Working Doubles | attacked | 879 | 62% (57–67) n=355 | 1027 → 802 | 22% | 88 / 342 / 449 | 78% (71–84) n=173 | 61% (53–68) n=150 | 58% (52–65) n=216 |
| 6th Street Recruits | attacked | 834 | 65% (60–70) n=348 | 1010 → 754 | 25% | 66 / 301 / 467 | 81% (75–86) n=189 | 64% (55–73) n=107 | 59% (53–65) n=225 |
| Animals Wrecker | attacked | 823 | 69% (63–73) n=325 | 779 → 733 | 6% | 0 / 229 / 594 | 86% (80–91) n=144 | 84% (76–91) n=90 | 62% (56–68) n=248 |
| Animals Wrecker | played | 521 | 63% (59–68) n=401 | 729 → 521 | 29% | 0 / 369 / 152 | 66% (57–74) n=120 | 65% (54–74) n=85 | 61% (54–67) n=244 |
| Valentino Street Racer | attacked | 499 | 62% (56–67) n=280 | 682 → 451 | 34% | 18 / 129 / 352 | 81% (74–87) n=145 | 52% (40–64) n=61 | 53% (46–61) n=167 |
| Hanako Arasaka: Daughter of the Emperor | ability | 493 | 53% (48–58) n=348 | 1926 → 493 | 74% | 18 / 73 / 402 | 77% (70–82) n=188 | 36% (26–47) n=73 | 30% (23–37) n=155 |
| Pepe Najarro: Working Doubles | played | 484 | 61% (56–66) n=368 | 917 → 474 | 48% | 279 / 91 / 114 | 76% (69–82) n=161 | 54% (46–61) n=167 | 49% (39–59) n=98 |
| Dexter DeShawn: Off the Grid | ability | 483 | 53% (48–58) n=347 | 2004 → 483 | 76% | 16 / 79 / 388 | 76% (70–81) n=204 | 31% (21–42) n=75 | 26% (19–34) n=143 |
| 6th Street Recruits | played | 476 | 64% (58–68) n=354 | 919 → 471 | 49% | 270 / 99 / 107 | 72% (65–79) n=167 | 60% (52–68) n=144 | 58% (48–67) n=98 |
| Dexter DeShawn: Off the Grid | called | 465 | 61% (56–65) n=465 | 465 → 465 | 0% | 264 / 108 / 93 | 67% (62–72) n=305 | 47% (36–59) n=70 | 50% (40–60) n=90 |
| Adam Smasher: Ender of Legends | called | 464 | 60% (56–64) n=464 | 464 → 464 | 0% | 275 / 74 / 115 | 68% (62–73) n=315 | 42% (31–53) n=77 | 47% (36–59) n=72 |
| Valentino Street Racer | played | 461 | 57% (52–62) n=351 | 1237 → 430 | 65% | 131 / 170 / 160 | 71% (64–78) n=154 | 41% (32–50) n=120 | 55% (46–64) n=121 |
| Hanako Arasaka: Daughter of the Emperor | called | 438 | 61% (57–66) n=438 | 438 → 438 | 0% | 245 / 106 / 87 | 72% (66–76) n=288 | 37% (27–49) n=70 | 46% (36–57) n=80 |
| Adam Smasher: Ender of Legends | attacked | 423 | 64% (59–69) n=328 | 457 → 423 | 7% | 0 / 0 / 423 | 89% (84–93) n=167 | 80% (70–87) n=75 | 34% (27–42) n=145 |
| Over the Edge | sold | 419 | 60% (55–65) n=319 | 1462 → 419 | 71% | 54 / 161 / 204 | 76% (67–84) n=102 | 56% (44–68) n=64 | 55% (49–62) n=204 |

(32 more card uses in the JSON report.)

| Decision type | Decisions | First-listed option taken | Options offered (1 / 2 / 3–5 / 6–10 / 11–20 / 21+) |
|---|---|---|---|
| main | 14718 | 7% | 0 / 1204 / 4149 / 5130 / 4040 / 195 |
| gig/steal | 3463 | 25% | 99 / 412 / 1547 / 1394 / 11 / 0 |
| gig/rollIn | 2240 | 0% | 0 / 560 / 1680 / 0 / 0 / 0 |
| unit/defeat | 783 | 61% | 238 / 218 / 307 / 20 / 0 / 0 |
| gigValue/adjust | 680 | 8% | 0 / 0 / 3 / 43 / 382 / 252 |
| mulligan | 560 | 20% | 0 / 560 / 0 / 0 / 0 / 0 |
| mode/mode | 543 | 67% | 0 / 543 / 0 / 0 / 0 / 0 |
| gig/swapGive | 493 | 46% | 36 / 58 / 187 / 207 / 5 / 0 |
| gig/swapTake | 493 | 25% | 30 / 38 / 243 / 177 / 5 / 0 |
| react | 464 | 47% | 0 / 286 / 178 / 0 / 0 / 0 |
| unit/pump | 425 | 63% | 175 / 141 / 102 / 7 / 0 / 0 |
| unit/adrenaline | 361 | 73% | 204 / 117 / 40 / 0 / 0 / 0 |
| card/playFree | 336 | 74% | 0 / 118 / 211 / 7 / 0 / 0 |
| unit/equip | 191 | 88% | 25 / 51 / 79 / 36 / 0 / 0 |
| unit/ready | 138 | 100% | 0 / 138 / 0 / 0 / 0 / 0 |
| unit/spend | 83 | 64% | 36 / 31 / 16 / 0 / 0 / 0 |
| gigValue/setGig | 57 | 11% | 0 / 0 / 2 / 10 / 11 / 34 |
| unit/sacrifice | 57 | 79% | 29 / 7 / 20 / 1 / 0 / 0 |
| card/discard | 44 | 43% | 9 / 12 / 22 / 1 / 0 / 0 |
| yesno/draw | 30 | 100% | 0 / 30 / 0 / 0 / 0 / 0 |
| mode/foolOnTheHill | 2 | 100% | 0 / 2 / 0 / 0 / 0 / 0 |
| mode/rivalChoice | 1 | 0% | 0 / 1 / 0 / 0 / 0 / 0 |

Reaction windows: 464 attacks. Reacted to 248 (deck won 48% (42–55) n=223): stole 208, attackerGone 2, targetGone 31, bothGone 7. Let 216 resolve (48% (40–56) n=139): stole 168, targetGone 45, bothGone 3. Choices: call 248, endReact 216.

## S2-06 Counter (RGG) — 560 games, 56% won, 23334 decisions

| Card | Use | Uses | Win rate in games used (95%) | Legal turns → used | Not chosen | Early / mid / late uses | Ahead | Even | Behind |
|---|---|---|---|---|---|---|---|---|---|
| Pepe Najarro: Working Doubles | attacked | 780 | 62% (56–67) n=319 | 860 → 712 | 17% | 70 / 362 / 348 | 79% (72–84) n=182 | 53% (44–61) n=116 | 57% (50–64) n=181 |
| Nadia: Fighting Through Grief | attacked | 732 | 60% (55–66) n=320 | 760 → 691 | 9% | 0 / 269 / 463 | 84% (77–89) n=141 | 75% (62–84) n=55 | 56% (50–62) n=251 |
| Valentino Street Racer | attacked | 608 | 57% (52–63) n=307 | 754 → 545 | 28% | 36 / 214 / 358 | 80% (73–86) n=162 | 47% (37–57) n=96 | 47% (39–55) n=156 |
| Valentino Street Racer | played | 545 | 56% (51–61) n=388 | 1197 → 496 | 59% | 200 / 220 / 125 | 69% (62–75) n=177 | 41% (33–49) n=149 | 55% (47–64) n=119 |
| Hanako Arasaka: Daughter of the Emperor | ability | 545 | 49% (44–54) n=363 | 2008 → 545 | 73% | 15 / 190 / 340 | 72% (66–78) n=207 | 21% (13–32) n=67 | 33% (27–40) n=191 |
| 6th Street Recruits | attacked | 525 | 67% (60–72) n=236 | 608 → 507 | 17% | 45 / 233 / 247 | 81% (74–87) n=133 | 65% (54–75) n=74 | 61% (53–69) n=137 |
| Pepe Najarro: Working Doubles | played | 492 | 60% (55–65) n=373 | 932 → 486 | 48% | 290 / 100 / 102 | 74% (67–80) n=175 | 49% (41–57) n=159 | 49% (39–60) n=91 |
| Adam Smasher: Ender of Legends | called | 467 | 59% (55–63) n=467 | 467 → 467 | 0% | 286 / 113 / 68 | 66% (61–71) n=325 | 41% (31–52) n=83 | 44% (32–57) n=59 |
| Saburo Arasaka: Stubborn Patriarch | called | 446 | 57% (53–62) n=446 | 446 → 446 | 0% | 272 / 136 / 38 | 64% (58–69) n=316 | 34% (24–45) n=77 | 53% (40–66) n=53 |
| Hanako Arasaka: Daughter of the Emperor | called | 442 | 58% (53–63) n=442 | 442 → 442 | 0% | 263 / 129 / 50 | 64% (59–69) n=318 | 43% (33–55) n=76 | 42% (29–56) n=48 |
| Nadia: Fighting Through Grief | played | 438 | 58% (53–63) n=359 | 871 → 438 | 50% | 0 / 304 / 134 | 72% (64–79) n=139 | 48% (38–59) n=81 | 52% (45–60) n=183 |
| Adam Smasher: Ender of Legends | attacked | 428 | 65% (59–70) n=331 | 449 → 428 | 5% | 0 / 0 / 428 | 95% (89–98) n=114 | 90% (80–95) n=62 | 44% (37–51) n=196 |
| Memory Relapse | sold | 402 | 60% (54–65) n=309 | 1176 → 402 | 66% | 115 / 145 / 142 | 73% (65–80) n=126 | 53% (43–64) n=86 | 51% (43–59) n=144 |
| Corporate Surveillance | sold | 392 | 57% (52–63) n=336 | 459 → 392 | 15% | 213 / 89 / 90 | 64% (56–71) n=152 | 49% (41–58) n=128 | 56% (45–65) n=90 |
| Over the Edge | sold | 375 | 57% (51–63) n=301 | 1492 → 375 | 75% | 50 / 151 / 174 | 68% (58–76) n=108 | 53% (41–64) n=68 | 48% (40–55) n=165 |

(31 more card uses in the JSON report.)

Legal but never taken: Corporate Surveillance (played, legal in 420 turns).

| Decision type | Decisions | First-listed option taken | Options offered (1 / 2 / 3–5 / 6–10 / 11–20 / 21+) |
|---|---|---|---|
| main | 12873 | 6% | 0 / 1258 / 3780 / 4998 / 2775 / 62 |
| gig/steal | 3039 | 29% | 117 / 426 / 1347 / 1129 / 20 / 0 |
| gig/rollIn | 2240 | 0% | 0 / 560 / 1680 / 0 / 0 / 0 |
| unit/ready | 950 | 72% | 0 / 492 / 449 / 9 / 0 / 0 |
| unit/defeat | 948 | 54% | 256 / 279 / 396 / 17 / 0 / 0 |
| mulligan | 560 | 26% | 0 / 560 / 0 / 0 / 0 / 0 |
| gig/swapGive | 545 | 37% | 25 / 83 / 255 / 175 / 7 / 0 |
| gig/swapTake | 545 | 30% | 37 / 57 / 287 / 158 / 6 / 0 |
| react | 455 | 43% | 0 / 272 / 183 / 0 / 0 / 0 |
| unit/adrenaline | 343 | 73% | 223 / 95 / 25 / 0 / 0 / 0 |
| unit/equip | 275 | 90% | 49 / 43 / 171 / 12 / 0 / 0 |
| gigValue/adjust | 168 | 8% | 0 / 4 / 24 / 3 / 20 / 117 |
| unit/spend | 151 | 65% | 79 / 52 / 20 / 0 / 0 / 0 |
| card/discard | 89 | 44% | 17 / 16 / 56 / 0 / 0 / 0 |
| gigValue/setGig | 53 | 4% | 0 / 0 / 1 / 12 / 14 / 26 |
| unit/sacrifice | 53 | 91% | 38 / 9 / 6 / 0 / 0 / 0 |
| yesno/draw | 24 | 100% | 0 / 24 / 0 / 0 / 0 / 0 |
| card/playFree | 18 | 100% | 0 / 14 / 4 / 0 / 0 / 0 |
| mode/rivalChoice | 3 | 0% | 0 / 3 / 0 / 0 / 0 / 0 |
| mode/foolOnTheHill | 2 | 0% | 0 / 2 / 0 / 0 / 0 / 0 |

Reaction windows: 439 attacks. Reacted to 250 (deck won 44% (37–50) n=220): fizzled 19, stole 199, targetGone 26, bothGone 6. Let 189 resolve (47% (38–56) n=119): stole 148, stoleNothing 1, targetGone 31, bothGone 9. Choices: call 238, endReact 196, ability 21.

## S2-07 Explorer (RRB) — 560 games, 46% won, 21570 decisions

| Card | Use | Uses | Win rate in games used (95%) | Legal turns → used | Not chosen | Early / mid / late uses | Ahead | Even | Behind |
|---|---|---|---|---|---|---|---|---|---|
| V: Corporate Exile | attacked | 756 | 41% (37–46) n=403 | 910 → 756 | 17% | 85 / 307 / 364 | 57% (50–63) n=229 | 47% (36–59) n=74 | 31% (25–37) n=200 |
| Animals Wrecker | attacked | 686 | 59% (53–65) n=285 | 646 → 609 | 6% | 0 / 145 / 541 | 77% (70–84) n=133 | 87% (78–93) n=78 | 50% (43–57) n=199 |
| 6th Street Recruits | attacked | 679 | 50% (45–56) n=302 | 900 → 623 | 31% | 69 / 245 / 365 | 66% (58–73) n=155 | 55% (46–64) n=105 | 41% (34–49) n=175 |
| Psycho Squad | attacked | 667 | 47% (42–53) n=303 | 880 → 611 | 31% | 55 / 243 / 369 | 65% (57–72) n=160 | 46% (36–56) n=85 | 40% (33–47) n=196 |
| Unlikely Bond | sold | 503 | 45% (40–50) n=370 | 1155 → 503 | 56% | 123 / 201 / 179 | 55% (47–63) n=149 | 46% (37–56) n=102 | 38% (31–45) n=188 |
| Johnny Silverhand: Never Stop Fighting | attacked | 487 | 59% (52–65) n=207 | 359 → 325 | 9% | 0 / 47 / 440 | 83% (75–89) n=119 | 68% (53–80) n=41 | 43% (34–53) n=100 |
| Animals Wrecker | played | 482 | 53% (48–58) n=361 | 650 → 482 | 26% | 0 / 303 / 179 | 62% (54–70) n=140 | 59% (47–70) n=66 | 46% (39–53) n=211 |
| 6th Street Recruits | played | 461 | 45% (40–50) n=348 | 1068 → 457 | 57% | 245 / 94 / 122 | 54% (46–61) n=160 | 44% (37–52) n=160 | 18% (11–28) n=82 |
| V: Corporate Exile | called | 454 | 48% (44–53) n=454 | 454 → 454 | 0% | 248 / 110 / 96 | 54% (49–60) n=312 | 38% (27–51) n=60 | 32% (23–42) n=82 |
| Adam Smasher: Ender of Legends | called | 452 | 46% (41–51) n=452 | 452 → 452 | 0% | 207 / 134 / 111 | 54% (49–60) n=319 | 23% (15–35) n=64 | 29% (20–41) n=69 |
| Johnny Silverhand: Rocking Renegade | called | 445 | 47% (43–52) n=445 | 445 → 445 | 0% | 206 / 139 / 100 | 56% (51–62) n=323 | 22% (13–36) n=45 | 23% (15–34) n=77 |
| V: Corporate Exile | Go Solo (self-paid 429) | 429 | 41% (36–45) n=429 | 764 → 429 | 44% | 89 / 189 / 151 | 51% (44–58) n=175 | 45% (34–57) n=64 | 29% (23–36) n=190 |
| Psycho Squad | played | 419 | 44% (39–50) n=340 | 950 → 417 | 56% | 233 / 95 / 91 | 57% (50–65) n=162 | 38% (30–46) n=139 | 25% (17–36) n=75 |
| Carnage at the Colosseum | sold | 383 | 47% (42–53) n=310 | 1381 → 383 | 72% | 28 / 169 / 186 | 66% (57–75) n=104 | 56% (43–69) n=55 | 36% (29–43) n=176 |
| Yorinobu Arasaka: Steel Dragon | played | 351 | 52% (46–58) n=287 | 447 → 351 | 21% | 0 / 101 / 250 | 74% (65–82) n=104 | 71% (54–83) n=34 | 35% (29–43) n=175 |

(35 more card uses in the JSON report.)

Legal but never taken: V: Corporate Exile (Legend play, legal in 766 turns), Adam Smasher: Ender of Legends (Legend play, legal in 126 turns).

| Decision type | Decisions | First-listed option taken | Options offered (1 / 2 / 3–5 / 6–10 / 11–20 / 21+) |
|---|---|---|---|
| main | 13543 | 8% | 0 / 1237 / 3818 / 5372 / 2929 / 187 |
| gig/steal | 3346 | 28% | 202 / 396 / 1492 / 1225 / 31 / 0 |
| gig/rollIn | 2240 | 0% | 0 / 560 / 1680 / 0 / 0 / 0 |
| mulligan | 560 | 21% | 0 / 560 / 0 / 0 / 0 / 0 |
| react | 508 | 58% | 0 / 293 / 215 / 0 / 0 / 0 |
| unit/defeat | 371 | 65% | 145 / 102 / 112 / 12 / 0 / 0 |
| card/playFree | 324 | 68% | 0 / 125 / 198 / 1 / 0 / 0 |
| unit/lagAttack | 284 | 88% | 33 / 58 / 181 / 12 / 0 / 0 |
| gigValue/adjust | 170 | 5% | 0 / 6 / 19 / 1 / 9 / 135 |
| unit/sacrifice | 65 | 83% | 45 / 13 / 6 / 1 / 0 / 0 |
| card/discard | 47 | 49% | 9 / 11 / 25 / 2 / 0 / 0 |
| unit/pump | 33 | 79% | 22 / 7 / 4 / 0 / 0 / 0 |
| mode/mode | 21 | 100% | 0 / 0 / 21 / 0 / 0 / 0 |
| unit/bottomdeck | 19 | 79% | 14 / 5 / 0 / 0 / 0 / 0 |
| unit/bottomdeckOwn | 19 | 42% | 2 / 12 / 5 / 0 / 0 / 0 |
| mode/foolOnTheHill | 7 | 43% | 0 / 7 / 0 / 0 / 0 / 0 |
| yesno/draw | 7 | 100% | 0 / 7 / 0 / 0 / 0 / 0 |
| mode/rivalChoice | 4 | 0% | 0 / 4 / 0 / 0 / 0 / 0 |
| unit/equip | 2 | 100% | 1 / 0 / 1 / 0 / 0 / 0 |

Reaction windows: 508 attacks. Reacted to 215 (deck won 32% (26–39) n=191): stole 184, targetGone 29, bothGone 2. Let 293 resolve (44% (36–52) n=153): stole 220, targetGone 68, bothGone 5. Choices: call 215, endReact 293.

## S2-08 Explorer (GGY) — 560 games, 49% won, 26816 decisions

| Card | Use | Uses | Win rate in games used (95%) | Legal turns → used | Not chosen | Early / mid / late uses | Ahead | Even | Behind |
|---|---|---|---|---|---|---|---|---|---|
| Pepe Najarro: Working Doubles | attacked | 850 | 56% (51–62) n=339 | 961 → 774 | 19% | 69 / 314 / 467 | 73% (66–79) n=182 | 57% (48–66) n=124 | 50% (43–56) n=206 |
| Nadia: Fighting Through Grief | attacked | 811 | 48% (43–54) n=326 | 827 → 751 | 9% | 0 / 256 / 555 | 78% (70–84) n=136 | 62% (48–74) n=52 | 43% (37–49) n=264 |
| Rockn' Rockerboy | attacked | 681 | 59% (53–64) n=261 | 719 → 648 | 10% | 0 / 290 / 391 | 70% (62–77) n=154 | 65% (54–75) n=78 | 51% (44–59) n=156 |
| Pepe Najarro: Working Doubles | played | 568 | 53% (48–58) n=404 | 967 → 558 | 42% | 257 / 143 / 168 | 63% (56–69) n=197 | 48% (40–55) n=163 | 46% (37–54) n=127 |
| Valentino Street Racer | attacked | 558 | 50% (44–55) n=282 | 686 → 493 | 28% | 19 / 130 / 409 | 73% (65–79) n=147 | 49% (38–60) n=75 | 33% (26–41) n=149 |
| Valentino Street Racer | played | 504 | 48% (43–53) n=372 | 1229 → 474 | 61% | 115 / 196 / 193 | 62% (54–69) n=156 | 39% (31–49) n=114 | 40% (33–48) n=155 |
| Nadia: Fighting Through Grief | played | 481 | 49% (43–54) n=371 | 869 → 481 | 45% | 0 / 273 / 208 | 60% (51–68) n=137 | 53% (40–65) n=59 | 41% (35–48) n=225 |
| Padre: Man of the Cross | ability | 470 | 45% (39–50) n=328 | 1954 → 470 | 76% | 5 / 92 / 373 | 63% (56–70) n=184 | 27% (18–37) n=82 | 20% (14–27) n=127 |
| Muamar Reyes: El Capitán | ability | 463 | 47% (42–53) n=301 | 1923 → 463 | 76% | 5 / 92 / 366 | 68% (61–74) n=189 | 18% (11–29) n=66 | 16% (11–24) n=116 |
| Memory Relapse | sold | 462 | 50% (45–55) n=366 | 1209 → 462 | 62% | 134 / 172 / 156 | 62% (54–69) n=152 | 50% (41–60) n=105 | 41% (33–49) n=157 |
| Goro Takemura: Vengeful Bodyguard | called | 428 | 48% (44–53) n=428 | 428 → 428 | 0% | 230 / 131 / 67 | 53% (47–59) n=272 | 41% (32–52) n=92 | 38% (27–50) n=64 |
| Padre: Man of the Cross | called | 404 | 51% (46–56) n=404 | 412 → 404 | 2% | 232 / 115 / 57 | 57% (50–63) n=251 | 44% (34–55) n=86 | 37% (27–49) n=67 |
| Cyberpsychosis | sold | 401 | 49% (44–55) n=334 | 620 → 401 | 35% | 202 / 118 / 81 | 50% (43–58) n=157 | 51% (42–60) n=110 | 42% (33–52) n=97 |
| Saul Bright: Stormrider | played | 387 | 51% (45–56) n=322 | 443 → 387 | 13% | 0 / 0 / 387 | 78% (69–85) n=104 | 67% (53–80) n=43 | 36% (30–43) n=201 |
| Sandevistan | sold | 387 | 46% (41–52) n=323 | 469 → 387 | 17% | 245 / 73 / 69 | 51% (43–59) n=150 | 46% (38–55) n=128 | 32% (23–44) n=71 |

(36 more card uses in the JSON report.)

Legal but never taken: Cyberpsychosis (played, legal in 84 turns).

| Decision type | Decisions | First-listed option taken | Options offered (1 / 2 / 3–5 / 6–10 / 11–20 / 21+) |
|---|---|---|---|
| main | 14158 | 6% | 0 / 1138 / 3773 / 5604 / 3495 / 148 |
| gig/steal | 3327 | 28% | 121 / 420 / 1503 / 1255 / 28 / 0 |
| gig/rollIn | 2240 | 0% | 0 / 560 / 1680 / 0 / 0 / 0 |
| unit/ready | 1124 | 68% | 0 / 452 / 658 / 14 / 0 / 0 |
| gigValue/adjust | 903 | 10% | 0 / 0 / 46 / 100 / 548 / 209 |
| react | 788 | 51% | 0 / 448 / 340 / 0 / 0 / 0 |
| mulligan | 560 | 31% | 0 / 560 / 0 / 0 / 0 / 0 |
| mode/mode | 523 | 59% | 0 / 523 / 0 / 0 / 0 / 0 |
| mode/muamarCall | 515 | 71% | 0 / 515 / 0 / 0 / 0 / 0 |
| gigValue/setGig | 464 | 9% | 0 / 1 / 4 / 35 / 91 / 333 |
| unit/spend | 400 | 80% | 245 / 100 / 55 / 0 / 0 / 0 |
| unit/adrenaline | 387 | 47% | 145 / 159 / 83 / 0 / 0 / 0 |
| unit/defeat | 372 | 65% | 144 / 102 / 124 / 2 / 0 / 0 |
| unit/protect | 351 | 58% | 133 / 119 / 96 / 3 / 0 / 0 |
| unit/blocker | 255 | 55% | 81 / 101 / 72 / 1 / 0 / 0 |
| unit/equip | 202 | 80% | 31 / 42 / 110 / 19 / 0 / 0 |
| card/discard | 110 | 44% | 14 / 24 / 70 / 2 / 0 / 0 |
| unit/call | 57 | 96% | 0 / 40 / 17 / 0 / 0 / 0 |
| unit/sacrifice | 52 | 77% | 30 / 13 / 9 / 0 / 0 / 0 |
| card/playFree | 15 | 87% | 0 / 11 / 4 / 0 / 0 / 0 |
| mode/foolOnTheHill | 6 | 50% | 0 / 6 / 0 / 0 / 0 / 0 |
| yesno/draw | 4 | 100% | 0 / 4 / 0 / 0 / 0 / 0 |
| unit/pump | 2 | 100% | 2 / 0 / 0 / 0 / 0 / 0 |
| mode/rivalChoice | 1 | 0% | 0 / 1 / 0 / 0 / 0 / 0 |

Reaction windows: 704 attacks. Reacted to 344 (deck won 47% (41–52) n=289): fizzled 18, stole 246, attackerGone 14, targetGone 44, bothGone 8, noneGone 14. Let 360 resolve (44% (37–51) n=203): stole 304, stoleNothing 2, targetGone 48, bothGone 6. Choices: call 297, endReact 400, ability 65, block 24, play 2.

## S3-02 Mutant (RGY) — 560 games, 43% won, 28060 decisions

| Card | Use | Uses | Win rate in games used (95%) | Legal turns → used | Not chosen | Early / mid / late uses | Ahead | Even | Behind |
|---|---|---|---|---|---|---|---|---|---|
| 6th Street Recruits | attacked | 811 | 46% (41–51) n=339 | 895 → 739 | 17% | 72 / 257 / 482 | 64% (57–71) n=183 | 50% (41–59) n=110 | 34% (28–41) n=189 |
| Jackie Welles: Mama's Favorite | attacked | 809 | 40% (36–45) n=461 | 923 → 809 | 12% | 0 / 333 / 476 | 55% (49–60) n=264 | 48% (37–59) n=73 | 28% (23–34) n=242 |
| Pepe Najarro: Working Doubles | attacked | 770 | 44% (39–49) n=338 | 889 → 714 | 20% | 66 / 258 / 446 | 57% (50–64) n=195 | 42% (33–51) n=120 | 35% (29–43) n=186 |
| Dexter DeShawn: One Last Chance | attacked | 645 | 45% (40–51) n=302 | 731 → 559 | 24% | 22 / 163 / 460 | 63% (55–70) n=155 | 51% (40–61) n=83 | 34% (28–41) n=186 |
| MaxTac Suppression Team | attacked | 640 | 48% (42–53) n=294 | 727 → 598 | 18% | 0 / 193 / 447 | 60% (53–67) n=177 | 59% (47–70) n=66 | 34% (27–41) n=155 |
| Corporate Surveillance | sold | 607 | 45% (40–50) n=415 | 1057 → 607 | 43% | 211 / 219 / 177 | 51% (44–57) n=205 | 43% (35–52) n=134 | 35% (28–42) n=185 |
| Dexter DeShawn: One Last Chance | played | 574 | 43% (38–48) n=395 | 1247 → 514 | 59% | 122 / 242 / 210 | 52% (46–59) n=204 | 37% (29–45) n=130 | 33% (26–41) n=144 |
| 6th Street Recruits | played | 558 | 43% (39–48) n=405 | 1139 → 554 | 51% | 226 / 154 / 178 | 53% (46–60) n=193 | 42% (35–50) n=152 | 31% (24–40) n=137 |
| Pepe Najarro: Working Doubles | played | 556 | 40% (36–45) n=405 | 1178 → 551 | 53% | 233 / 134 / 189 | 51% (44–58) n=199 | 35% (28–43) n=146 | 28% (22–36) n=145 |
| MaxTac Suppression Team | played | 542 | 43% (38–48) n=385 | 1181 → 542 | 54% | 108 / 197 / 237 | 50% (43–57) n=190 | 44% (35–53) n=103 | 29% (23–36) n=175 |
| Dexter DeShawn: Off the Grid | ability | 536 | 39% (34–44) n=359 | 1867 → 536 | 71% | 3 / 107 / 426 | 58% (52–65) n=216 | 26% (17–37) n=70 | 14% (9–20) n=144 |
| Jackie Welles: Mama's Favorite | Go Solo (self-paid 491) | 491 | 40% (35–44) n=491 | 782 → 491 | 37% | 0 / 308 / 183 | 51% (44–58) n=210 | 41% (30–54) n=58 | 29% (23–35) n=223 |
| Dexter DeShawn: Off the Grid | called | 448 | 41% (36–45) n=448 | 448 → 448 | 0% | 174 / 194 / 80 | 48% (42–54) n=286 | 30% (20–43) n=60 | 27% (20–37) n=102 |
| Jackie Welles: Mama's Favorite | called | 439 | 43% (39–48) n=439 | 439 → 439 | 0% | 198 / 177 / 64 | 48% (42–54) n=285 | 30% (21–41) n=77 | 39% (29–50) n=77 |
| Detonate | sold | 400 | 44% (39–50) n=329 | 546 → 400 | 27% | 218 / 81 / 101 | 48% (41–55) n=173 | 44% (35–53) n=103 | 31% (22–41) n=91 |

(33 more card uses in the JSON report.)

| Decision type | Decisions | First-listed option taken | Options offered (1 / 2 / 3–5 / 6–10 / 11–20 / 21+) |
|---|---|---|---|
| main | 15356 | 7% | 0 / 1003 / 3716 / 5351 / 4952 / 334 |
| gig/steal | 3364 | 28% | 229 / 601 / 1365 / 1155 / 14 / 0 |
| gig/rollIn | 2240 | 0% | 0 / 560 / 1680 / 0 / 0 / 0 |
| gigValue/adjust | 2115 | 8% | 0 / 3 / 114 / 185 / 1297 / 516 |
| react | 1049 | 69% | 0 / 622 / 427 / 0 / 0 / 0 |
| unit/ready | 1007 | 72% | 0 / 402 / 581 / 24 / 0 / 0 |
| mulligan | 560 | 12% | 0 / 560 / 0 / 0 / 0 / 0 |
| mode/mode | 531 | 77% | 0 / 531 / 0 / 0 / 0 / 0 |
| unit/pump | 531 | 49% | 126 / 181 / 222 / 2 / 0 / 0 |
| unit/equip | 319 | 82% | 29 / 70 / 200 / 20 / 0 / 0 |
| yesno/replaceDefeat | 249 | 10% | 0 / 249 / 0 / 0 / 0 / 0 |
| unit/spend | 209 | 54% | 55 / 72 / 82 / 0 / 0 / 0 |
| unit/defeat | 200 | 49% | 11 / 21 / 102 / 65 / 1 / 0 |
| card/playFree | 67 | 97% | 0 / 40 / 27 / 0 / 0 / 0 |
| card/discard | 56 | 30% | 6 / 11 / 35 / 4 / 0 / 0 |
| card/search | 52 | 81% | 25 / 20 / 7 / 0 / 0 / 0 |
| yesno/draw | 45 | 100% | 0 / 45 / 0 / 0 / 0 / 0 |
| card/defeatGear | 43 | 93% | 0 / 32 / 11 / 0 / 0 / 0 |
| unit/sacrifice | 43 | 79% | 23 / 11 / 9 / 0 / 0 / 0 |
| card/defeat | 17 | 94% | 15 / 2 / 0 / 0 / 0 / 0 |
| mode/foolOnTheHill | 4 | 50% | 0 / 4 / 0 / 0 / 0 / 0 |
| mode/rivalChoice | 3 | 0% | 0 / 3 / 0 / 0 / 0 / 0 |

Reaction windows: 1008 attacks. Reacted to 317 (deck won 39% (33–45) n=279): stole 242, stoleNothing 2, attackerGone 4, targetGone 60, bothGone 9. Let 691 resolve (38% (33–44) n=286): stole 524, stoleNothing 4, attackerGone 2, targetGone 152, bothGone 9. Choices: endReact 728, call 315, play 4, ability 2.

## S3-03 Cross (RRR) — 560 games, 53% won, 24751 decisions

| Card | Use | Uses | Win rate in games used (95%) | Legal turns → used | Not chosen | Early / mid / late uses | Ahead | Even | Behind |
|---|---|---|---|---|---|---|---|---|---|
| 6th Street Recruits | attacked | 745 | 54% (49–59) n=341 | 915 → 686 | 25% | 90 / 306 / 349 | 73% (66–80) n=147 | 57% (48–65) n=125 | 50% (43–57) n=222 |
| Animals Wrecker | attacked | 726 | 65% (59–70) n=297 | 695 → 665 | 4% | 0 / 182 / 544 | 85% (78–90) n=128 | 80% (70–87) n=80 | 59% (53–65) n=227 |
| V: Streetkid | attacked | 564 | 44% (39–49) n=350 | 679 → 564 | 17% | 67 / 188 / 309 | 64% (57–71) n=186 | 46% (35–57) n=70 | 26% (20–33) n=162 |
| Dexter DeShawn: Off the Grid | ability | 525 | 50% (44–55) n=342 | 1788 → 525 | 71% | 15 / 92 / 418 | 71% (65–77) n=213 | 41% (30–53) n=66 | 18% (12–25) n=142 |
| 6th Street Recruits | played | 493 | 53% (47–58) n=371 | 868 → 490 | 44% | 290 / 104 / 99 | 62% (56–69) n=202 | 48% (41–56) n=151 | 29% (21–40) n=78 |
| Animals Wrecker | played | 465 | 60% (55–65) n=353 | 627 → 465 | 26% | 0 / 329 / 136 | 72% (64–79) n=138 | 58% (46–69) n=71 | 52% (44–59) n=188 |
| Bonnie and Clyde | sold | 449 | 54% (49–59) n=338 | 1400 → 449 | 68% | 77 / 168 / 204 | 65% (57–72) n=145 | 55% (44–65) n=80 | 42% (35–50) n=168 |
| V: Streetkid | called | 433 | 53% (48–57) n=433 | 433 → 433 | 0% | 221 / 101 / 111 | 61% (54–66) n=246 | 45% (36–55) n=104 | 39% (29–49) n=83 |
| Dexter DeShawn: Off the Grid | called | 420 | 54% (49–58) n=420 | 421 → 420 | 0% | 192 / 131 / 97 | 63% (57–68) n=252 | 36% (27–47) n=85 | 43% (33–54) n=83 |
| Over the Edge | sold | 414 | 55% (49–60) n=316 | 1388 → 414 | 70% | 83 / 173 / 158 | 68% (59–76) n=117 | 54% (43–64) n=78 | 47% (40–55) n=172 |
| Adam Smasher: Ender of Legends | called | 398 | 53% (48–58) n=398 | 398 → 398 | 0% | 179 / 114 / 105 | 61% (55–67) n=248 | 44% (34–55) n=77 | 33% (23–44) n=73 |
| V: Streetkid | Go Solo (self-paid 373) | 373 | 42% (37–47) n=373 | 1023 → 373 | 64% | 70 / 125 / 178 | 60% (52–68) n=148 | 37% (26–49) n=68 | 28% (22–36) n=157 |
| Meredith Stout: Stone Cold Corpo | played | 369 | 51% (45–57) n=296 | 1202 → 363 | 70% | 123 / 98 / 148 | 66% (57–73) n=119 | 44% (35–54) n=95 | 36% (28–45) n=117 |
| Shattered Memories | sold | 361 | 52% (46–57) n=301 | 905 → 361 | 60% | 77 / 171 / 113 | 70% (60–78) n=100 | 62% (51–71) n=86 | 37% (30–45) n=151 |
| Ruthless Lowlife | played | 356 | 47% (41–52) n=300 | 463 → 344 | 26% | 238 / 59 / 59 | 62% (54–69) n=152 | 32% (25–41) n=121 | 29% (18–43) n=45 |

(36 more card uses in the JSON report.)

Legal but never taken: V: Streetkid (Legend play, legal in 1023 turns).

| Decision type | Decisions | First-listed option taken | Options offered (1 / 2 / 3–5 / 6–10 / 11–20 / 21+) |
|---|---|---|---|
| main | 14132 | 9% | 0 / 1222 / 3797 / 5223 / 3743 / 147 |
| gig/steal | 3039 | 26% | 134 / 382 / 1326 / 1179 / 18 / 0 |
| gig/rollIn | 2240 | 0% | 0 / 560 / 1680 / 0 / 0 / 0 |
| react | 1256 | 65% | 0 / 818 / 438 / 0 / 0 / 0 |
| gigValue/adjust | 772 | 9% | 0 / 7 / 45 / 61 / 450 / 209 |
| unit/defeat | 658 | 59% | 197 / 188 / 245 / 28 / 0 / 0 |
| mulligan | 560 | 15% | 0 / 560 / 0 / 0 / 0 / 0 |
| mode/mode | 512 | 75% | 0 / 512 / 0 / 0 / 0 / 0 |
| card/search | 466 | 76% | 239 / 116 / 85 / 26 / 0 / 0 |
| unit/pump | 418 | 54% | 124 / 155 / 132 / 7 / 0 / 0 |
| card/playFree | 308 | 71% | 0 / 87 / 202 / 19 / 0 / 0 |
| unit/equip | 236 | 83% | 79 / 66 / 77 / 14 / 0 / 0 |
| unit/sacrifice | 53 | 79% | 34 / 7 / 11 / 1 / 0 / 0 |
| card/discard | 27 | 52% | 6 / 10 / 9 / 2 / 0 / 0 |
| yesno/draw | 27 | 100% | 0 / 27 / 0 / 0 / 0 / 0 |
| unit/call | 17 | 100% | 0 / 4 / 13 / 0 / 0 / 0 |
| card/defeat | 15 | 93% | 13 / 2 / 0 / 0 / 0 / 0 |
| yesno/call | 11 | 100% | 0 / 11 / 0 / 0 / 0 / 0 |
| mode/foolOnTheHill | 3 | 33% | 0 / 3 / 0 / 0 / 0 / 0 |
| mode/rivalChoice | 1 | 0% | 0 / 1 / 0 / 0 / 0 / 0 |

Reaction windows: 1179 attacks. Reacted to 416 (deck won 46% (40–51) n=331): stole 221, attackerGone 11, targetGone 166, bothGone 18. Let 763 resolve (56% (50–61) n=307): stole 539, stoleNothing 8, attackerGone 12, targetGone 182, bothGone 22. Choices: block 143, call 293, endReact 817, play 3.

## S3-05 Counter (RRG) — 560 games, 52% won, 25303 decisions

| Card | Use | Uses | Win rate in games used (95%) | Legal turns → used | Not chosen | Early / mid / late uses | Ahead | Even | Behind |
|---|---|---|---|---|---|---|---|---|---|
| Pepe Najarro: Working Doubles | attacked | 1001 | 55% (50–60) n=391 | 1172 → 882 | 25% | 100 / 372 / 529 | 78% (71–83) n=182 | 60% (51–67) n=136 | 48% (42–54) n=271 |
| Animals Wrecker | attacked | 738 | 68% (63–73) n=298 | 698 → 668 | 4% | 0 / 155 / 583 | 91% (85–95) n=128 | 90% (81–95) n=80 | 62% (55–68) n=229 |
| V: Streetkid | attacked | 607 | 43% (38–48) n=364 | 753 → 607 | 19% | 91 / 236 / 280 | 61% (54–68) n=195 | 60% (46–73) n=48 | 30% (24–37) n=195 |
| Pepe Najarro: Working Doubles | played | 550 | 53% (48–58) n=395 | 971 → 549 | 43% | 322 / 137 / 91 | 62% (55–69) n=185 | 51% (44–59) n=179 | 41% (32–51) n=102 |
| Valentino Street Racer | attacked | 543 | 51% (46–57) n=313 | 765 → 487 | 36% | 31 / 155 / 357 | 82% (74–88) n=114 | 64% (53–74) n=81 | 37% (30–43) n=205 |
| Hanako Arasaka: Daughter of the Emperor | ability | 524 | 44% (39–49) n=349 | 1990 → 524 | 74% | 29 / 143 / 352 | 64% (57–71) n=183 | 43% (32–54) n=68 | 19% (14–25) n=174 |
| Valentino Street Racer | played | 493 | 51% (46–56) n=372 | 1307 → 463 | 65% | 173 / 184 / 136 | 58% (50–66) n=151 | 45% (38–54) n=143 | 45% (37–54) n=131 |
| Animals Wrecker | played | 465 | 62% (57–67) n=364 | 700 → 465 | 34% | 0 / 331 / 134 | 72% (64–79) n=131 | 69% (57–79) n=64 | 56% (49–62) n=219 |
| Memory Relapse | sold | 452 | 53% (47–58) n=356 | 1308 → 452 | 65% | 102 / 200 / 150 | 64% (55–72) n=125 | 52% (41–62) n=85 | 45% (39–52) n=203 |
| Satori: Sword of Saburo | sold | 450 | 49% (44–54) n=345 | 800 → 450 | 44% | 200 / 124 / 126 | 54% (46–62) n=145 | 49% (40–58) n=120 | 40% (32–48) n=138 |
| Adam Smasher: Ender of Legends | called | 448 | 52% (47–56) n=448 | 448 → 448 | 0% | 218 / 138 / 92 | 60% (55–66) n=303 | 39% (30–50) n=84 | 26% (17–38) n=61 |
| Hanako Arasaka: Daughter of the Emperor | called | 441 | 55% (50–59) n=441 | 441 → 441 | 0% | 211 / 158 / 72 | 59% (53–65) n=294 | 46% (37–56) n=95 | 46% (33–59) n=52 |
| V: Streetkid | called | 435 | 52% (47–57) n=435 | 435 → 435 | 0% | 258 / 119 / 58 | 59% (53–65) n=263 | 39% (29–49) n=90 | 43% (33–53) n=82 |
| V: Streetkid | Go Solo (self-paid 388) | 388 | 42% (37–47) n=388 | 1063 → 388 | 63% | 107 / 151 / 130 | 59% (51–67) n=154 | 34% (23–47) n=56 | 30% (24–37) n=178 |
| Peace Offering | sold | 352 | 52% (46–58) n=295 | 592 → 352 | 41% | 159 / 108 / 85 | 58% (49–67) n=122 | 51% (41–61) n=90 | 47% (38–56) n=113 |

(35 more card uses in the JSON report.)

Legal but never taken: V: Streetkid (Legend play, legal in 1064 turns).

| Decision type | Decisions | First-listed option taken | Options offered (1 / 2 / 3–5 / 6–10 / 11–20 / 21+) |
|---|---|---|---|
| main | 14148 | 7% | 0 / 1212 / 3716 / 4642 / 4296 / 282 |
| gig/steal | 3366 | 27% | 169 / 380 / 1374 / 1422 / 21 / 0 |
| gig/rollIn | 2240 | 0% | 0 / 560 / 1680 / 0 / 0 / 0 |
| unit/defeat | 864 | 63% | 273 / 240 / 313 / 37 / 1 / 0 |
| unit/ready | 757 | 76% | 0 / 374 / 365 / 18 / 0 / 0 |
| mulligan | 560 | 33% | 0 / 560 / 0 / 0 / 0 / 0 |
| gig/swapGive | 524 | 43% | 31 / 71 / 255 / 161 / 6 / 0 |
| gig/swapTake | 524 | 30% | 36 / 61 / 232 / 194 / 1 / 0 |
| react | 518 | 46% | 0 / 282 / 236 / 0 / 0 / 0 |
| card/search | 454 | 69% | 198 / 166 / 90 / 0 / 0 / 0 |
| unit/adrenaline | 364 | 80% | 224 / 94 / 46 / 0 / 0 / 0 |
| card/playFree | 310 | 76% | 0 / 113 / 195 / 2 / 0 / 0 |
| gigValue/adjust | 193 | 5% | 0 / 2 / 63 / 11 / 33 / 84 |
| unit/spend | 146 | 66% | 66 / 51 / 29 / 0 / 0 / 0 |
| unit/equip | 120 | 86% | 9 / 41 / 57 / 13 / 0 / 0 |
| unit/sacrifice | 55 | 84% | 32 / 10 / 13 / 0 / 0 / 0 |
| unit/pump | 49 | 84% | 31 / 11 / 7 / 0 / 0 / 0 |
| gigValue/setGig | 39 | 3% | 0 / 0 / 2 / 7 / 8 / 22 |
| card/discard | 35 | 51% | 6 / 10 / 18 / 1 / 0 / 0 |
| yesno/draw | 24 | 100% | 0 / 24 / 0 / 0 / 0 / 0 |
| card/defeat | 7 | 100% | 6 / 1 / 0 / 0 / 0 / 0 |
| mode/foolOnTheHill | 4 | 100% | 0 / 4 / 0 / 0 / 0 / 0 |
| mode/rivalChoice | 2 | 0% | 0 / 2 / 0 / 0 / 0 / 0 |

Reaction windows: 518 attacks. Reacted to 279 (deck won 44% (38–50) n=253): stole 231, stoleNothing 2, targetGone 41, bothGone 5. Let 239 resolve (39% (31–47) n=142): stole 184, targetGone 50, bothGone 5. Choices: call 278, endReact 239, play 1.

## S3-06 Counter (RBG) — 560 games, 47% won, 24882 decisions

| Card | Use | Uses | Win rate in games used (95%) | Legal turns → used | Not chosen | Early / mid / late uses | Ahead | Even | Behind |
|---|---|---|---|---|---|---|---|---|---|
| MaxTac AV | attacked | 884 | 59% (54–64) n=323 | 910 → 785 | 14% | 0 / 389 / 495 | 81% (74–86) n=177 | 63% (51–73) n=72 | 54% (47–60) n=211 |
| Psycho Squad | attacked | 816 | 55% (50–60) n=354 | 942 → 735 | 22% | 85 / 313 / 418 | 81% (75–87) n=161 | 45% (36–54) n=110 | 51% (44–57) n=235 |
| Psycho Squad | played | 584 | 50% (46–55) n=425 | 1000 → 576 | 42% | 251 / 235 / 98 | 68% (61–74) n=189 | 34% (28–42) n=166 | 48% (41–56) n=159 |
| Valentino Street Racer | played | 562 | 48% (43–53) n=403 | 1137 → 510 | 55% | 167 / 301 / 94 | 65% (57–72) n=165 | 25% (18–33) n=141 | 48% (40–56) n=158 |
| MaxTac AV | played | 513 | 55% (50–60) n=374 | 726 → 513 | 29% | 244 / 175 / 94 | 76% (70–82) n=182 | 44% (36–52) n=142 | 32% (24–41) n=116 |
| Hanako Arasaka: Daughter of the Emperor | ability | 508 | 39% (34–44) n=356 | 1878 → 508 | 73% | 17 / 233 / 258 | 64% (57–71) n=175 | 16% (8–27) n=58 | 19% (14–25) n=189 |
| Placide: Voodoo Sentinel | played | 480 | 54% (49–59) n=385 | 577 → 480 | 17% | 0 / 0 / 480 | 89% (82–94) n=111 | 71% (57–82) n=48 | 39% (34–45) n=264 |
| Valentino Street Racer | attacked | 450 | 51% (45–57) n=273 | 672 → 409 | 39% | 35 / 150 / 265 | 77% (69–84) n=114 | 44% (32–56) n=62 | 40% (32–47) n=159 |
| Jackie Welles: Pour One Out For Me | called | 447 | 47% (43–52) n=447 | 447 → 447 | 0% | 216 / 190 / 41 | 59% (53–65) n=270 | 22% (15–32) n=86 | 36% (27–47) n=91 |
| Adam Smasher: Ender of Legends | called | 423 | 49% (45–54) n=423 | 423 → 423 | 0% | 212 / 170 / 41 | 58% (52–64) n=288 | 28% (19–40) n=64 | 34% (24–45) n=71 |
| Hanako Arasaka: Daughter of the Emperor | called | 421 | 47% (42–52) n=421 | 421 → 421 | 0% | 205 / 175 / 41 | 58% (52–64) n=273 | 22% (14–32) n=79 | 32% (22–44) n=69 |
| Nocturne OP55 N1 | sold | 411 | 46% (41–51) n=328 | 1005 → 411 | 59% | 109 / 185 / 117 | 58% (49–65) n=144 | 42% (30–54) n=65 | 38% (31–46) n=153 |
| Adam Smasher: Ender of Legends | attacked | 381 | 56% (50–62) n=283 | 399 → 381 | 5% | 0 / 0 / 381 | 93% (86–96) n=120 | 79% (66–87) n=56 | 27% (21–35) n=152 |
| Industrial Assembly | sold | 356 | 49% (44–55) n=307 | 589 → 356 | 40% | 174 / 92 / 90 | 67% (58–74) n=132 | 31% (22–41) n=91 | 45% (36–54) n=112 |
| We Gotta Live Together | sold | 330 | 49% (43–55) n=285 | 647 → 330 | 49% | 152 / 83 / 95 | 68% (59–76) n=110 | 36% (27–46) n=95 | 40% (31–49) n=106 |

(32 more card uses in the JSON report.)

| Decision type | Decisions | First-listed option taken | Options offered (1 / 2 / 3–5 / 6–10 / 11–20 / 21+) |
|---|---|---|---|
| main | 13151 | 7% | 0 / 1226 / 3579 / 5034 / 3215 / 97 |
| gig/steal | 2681 | 26% | 108 / 412 / 1091 / 1062 / 8 / 0 |
| gig/rollIn | 2240 | 100% | 0 / 560 / 1680 / 0 / 0 / 0 |
| gig/swapGive | 1019 | 42% | 41 / 102 / 660 / 209 / 7 / 0 |
| gig/swapTake | 930 | 38% | 127 / 204 / 385 / 210 / 4 / 0 |
| gigValue/adjust | 824 | 22% | 0 / 44 / 297 / 292 / 166 / 25 |
| unit/bottomdeck | 629 | 48% | 162 / 153 / 307 / 7 / 0 / 0 |
| react | 604 | 50% | 0 / 382 / 222 / 0 / 0 / 0 |
| mulligan | 560 | 29% | 0 / 560 / 0 / 0 / 0 / 0 |
| card/discard | 547 | 63% | 5 / 229 / 295 / 18 / 0 / 0 |
| unit/adrenaline | 401 | 61% | 184 / 138 / 79 / 0 / 0 / 0 |
| unit/defeat | 321 | 39% | 41 / 76 / 183 / 21 / 0 / 0 |
| unit/spend | 210 | 56% | 75 / 87 / 48 / 0 / 0 / 0 |
| unit/equip | 131 | 89% | 2 / 31 / 88 / 10 / 0 / 0 |
| mode/mode | 117 | 100% | 0 / 0 / 117 / 0 / 0 / 0 |
| unit/bottomdeckOwn | 115 | 69% | 60 / 33 / 22 / 0 / 0 / 0 |
| unit/ready | 112 | 82% | 0 / 71 / 41 / 0 / 0 / 0 |
| yesno/draw | 56 | 100% | 0 / 56 / 0 / 0 / 0 / 0 |
| unit/sacrifice | 55 | 89% | 39 / 7 / 9 / 0 / 0 / 0 |
| unit/cantAttack | 40 | 45% | 12 / 23 / 5 / 0 / 0 / 0 |
| unit/weaken | 37 | 59% | 9 / 12 / 16 / 0 / 0 / 0 |
| card/playFree | 35 | 100% | 0 / 28 / 7 / 0 / 0 / 0 |
| gigValue/setGig | 27 | 4% | 0 / 0 / 0 / 5 / 5 / 17 |
| card/discardForNothing | 20 | 0% | 0 / 9 / 11 / 0 / 0 / 0 |
| unit/call | 17 | 100% | 0 / 6 / 11 / 0 / 0 / 0 |
| mode/foolOnTheHill | 2 | 100% | 0 / 2 / 0 / 0 / 0 / 0 |
| mode/rivalChoice | 1 | 0% | 0 / 1 / 0 / 0 / 0 / 0 |

Reaction windows: 592 attacks. Reacted to 298 (deck won 41% (35–47) n=271): stole 248, stoleNothing 1, attackerGone 1, targetGone 46, bothGone 2. Let 294 resolve (45% (38–52) n=190): stole 230, targetGone 52, bothGone 12. Choices: call 288, endReact 301, play 15.

## S3-07 Explorer (RRG) — 560 games, 49% won, 26303 decisions

| Card | Use | Uses | Win rate in games used (95%) | Legal turns → used | Not chosen | Early / mid / late uses | Ahead | Even | Behind |
|---|---|---|---|---|---|---|---|---|---|
| Pepe Najarro: Working Doubles | attacked | 843 | 53% (48–58) n=358 | 1036 → 756 | 27% | 61 / 284 / 498 | 75% (68–81) n=178 | 57% (49–66) n=122 | 41% (35–47) n=231 |
| 6th Street Recruits | attacked | 816 | 52% (47–57) n=365 | 1003 → 734 | 27% | 62 / 288 / 466 | 70% (64–77) n=183 | 58% (48–66) n=111 | 44% (38–51) n=235 |
| Animals Wrecker | attacked | 738 | 60% (54–65) n=307 | 716 → 667 | 7% | 0 / 184 / 554 | 81% (74–87) n=138 | 75% (65–83) n=88 | 56% (49–62) n=223 |
| V: Streetkid | attacked | 632 | 44% (39–49) n=390 | 789 → 632 | 20% | 79 / 164 / 389 | 57% (50–63) n=219 | 50% (39–61) n=80 | 34% (27–41) n=178 |
| Valentino Street Racer | attacked | 539 | 53% (47–59) n=293 | 742 → 484 | 35% | 20 / 127 / 392 | 73% (65–79) n=147 | 68% (56–77) n=71 | 35% (28–43) n=165 |
| Hanako Arasaka: Daughter of the Emperor | ability | 533 | 39% (34–44) n=361 | 1970 → 533 | 73% | 20 / 93 / 420 | 62% (55–68) n=196 | 20% (12–31) n=70 | 15% (10–21) n=177 |
| Animals Wrecker | played | 519 | 54% (49–59) n=379 | 713 → 519 | 27% | 0 / 328 / 191 | 66% (57–74) n=120 | 67% (57–76) n=89 | 47% (40–53) n=230 |
| Valentino Street Racer | played | 515 | 48% (43–53) n=382 | 1356 → 482 | 64% | 138 / 160 / 217 | 64% (56–71) n=169 | 43% (34–51) n=129 | 34% (27–42) n=140 |
| Pepe Najarro: Working Doubles | played | 513 | 53% (48–58) n=375 | 943 → 503 | 47% | 241 / 105 / 167 | 60% (53–67) n=186 | 53% (44–61) n=139 | 35% (27–44) n=112 |
| 6th Street Recruits | played | 499 | 51% (46–56) n=374 | 965 → 493 | 49% | 241 / 113 / 145 | 63% (56–70) n=169 | 48% (40–56) n=149 | 34% (26–43) n=118 |
| Bonnie and Clyde | sold | 449 | 47% (41–52) n=336 | 1528 → 449 | 71% | 87 / 166 / 196 | 57% (48–65) n=127 | 44% (34–55) n=81 | 37% (31–45) n=182 |
| Hanako Arasaka: Daughter of the Emperor | called | 447 | 50% (45–55) n=447 | 447 → 447 | 0% | 223 / 129 / 95 | 55% (50–61) n=293 | 48% (38–58) n=92 | 29% (19–41) n=62 |
| V: Streetkid | called | 443 | 48% (43–52) n=443 | 443 → 443 | 0% | 220 / 112 / 111 | 55% (49–61) n=286 | 37% (27–48) n=84 | 30% (21–41) n=73 |
| Johnny Silverhand: Rocking Renegade | called | 441 | 48% (43–53) n=441 | 444 → 441 | 1% | 235 / 116 / 90 | 55% (50–61) n=283 | 40% (30–50) n=86 | 29% (20–41) n=72 |
| V: Streetkid | Go Solo (self-paid 423) | 423 | 43% (38–48) n=423 | 1038 → 423 | 59% | 88 / 91 / 244 | 55% (47–62) n=173 | 38% (28–49) n=74 | 33% (26–40) n=176 |

(32 more card uses in the JSON report.)

Legal but never taken: V: Streetkid (Legend play, legal in 1038 turns).

| Decision type | Decisions | First-listed option taken | Options offered (1 / 2 / 3–5 / 6–10 / 11–20 / 21+) |
|---|---|---|---|
| main | 15217 | 8% | 0 / 1152 / 3910 / 5041 / 4742 / 372 |
| gig/steal | 3531 | 28% | 173 / 417 / 1590 / 1324 / 27 / 0 |
| gig/rollIn | 2240 | 0% | 0 / 560 / 1680 / 0 / 0 / 0 |
| unit/defeat | 589 | 67% | 210 / 162 / 173 / 42 / 2 / 0 |
| react | 566 | 51% | 0 / 350 / 216 / 0 / 0 / 0 |
| mulligan | 560 | 19% | 0 / 560 / 0 / 0 / 0 / 0 |
| gig/swapGive | 533 | 44% | 29 / 63 / 217 / 218 / 6 / 0 |
| gig/swapTake | 533 | 30% | 33 / 57 / 219 / 215 / 9 / 0 |
| unit/adrenaline | 443 | 68% | 204 / 166 / 71 / 2 / 0 / 0 |
| card/search | 438 | 74% | 227 / 152 / 59 / 0 / 0 / 0 |
| card/playFree | 410 | 70% | 0 / 117 / 263 / 30 / 0 / 0 |
| gigValue/adjust | 324 | 4% | 0 / 9 / 57 / 5 / 27 / 226 |
| unit/lagAttack | 261 | 80% | 31 / 64 / 156 / 10 / 0 / 0 |
| unit/ready | 229 | 83% | 0 / 176 / 53 / 0 / 0 / 0 |
| unit/equip | 109 | 77% | 8 / 35 / 45 / 21 / 0 / 0 |
| unit/spend | 96 | 64% | 32 / 37 / 27 / 0 / 0 / 0 |
| unit/pump | 66 | 77% | 31 / 13 / 22 / 0 / 0 / 0 |
| unit/sacrifice | 59 | 92% | 40 / 12 / 7 / 0 / 0 / 0 |
| card/discard | 45 | 47% | 8 / 14 / 21 / 2 / 0 / 0 |
| yesno/draw | 27 | 100% | 0 / 27 / 0 / 0 / 0 / 0 |
| unit/call | 13 | 100% | 0 / 2 / 11 / 0 / 0 / 0 |
| yesno/call | 8 | 100% | 0 / 8 / 0 / 0 / 0 / 0 |
| mode/foolOnTheHill | 5 | 100% | 0 / 5 / 0 / 0 / 0 / 0 |
| mode/rivalChoice | 1 | 0% | 0 / 1 / 0 / 0 / 0 / 0 |

Reaction windows: 566 attacks. Reacted to 278 (deck won 47% (41–53) n=258): stole 233, targetGone 38, bothGone 7. Let 288 resolve (43% (35–51) n=142): stole 201, targetGone 83, bothGone 4. Choices: endReact 288, call 278.

## S3-08 Explorer (RRB) — 560 games, 52% won, 24084 decisions

| Card | Use | Uses | Win rate in games used (95%) | Legal turns → used | Not chosen | Early / mid / late uses | Ahead | Even | Behind |
|---|---|---|---|---|---|---|---|---|---|
| Animals Wrecker | attacked | 790 | 68% (62–73) n=308 | 751 → 709 | 6% | 0 / 210 / 580 | 85% (78–90) n=131 | 80% (70–87) n=93 | 63% (56–69) n=238 |
| Psycho Squad | attacked | 772 | 55% (50–60) n=331 | 989 → 710 | 28% | 76 / 300 / 396 | 73% (65–79) n=146 | 54% (45–63) n=107 | 49% (42–55) n=225 |
| 6th Street Recruits | attacked | 768 | 56% (50–61) n=347 | 963 → 705 | 27% | 63 / 301 / 404 | 81% (73–86) n=139 | 58% (48–67) n=107 | 49% (43–55) n=250 |
| Dexter DeShawn: Off the Grid | ability | 563 | 51% (46–56) n=380 | 1977 → 563 | 72% | 6 / 94 / 463 | 76% (70–82) n=221 | 28% (18–41) n=54 | 28% (22–35) n=181 |
| Yorinobu Arasaka: Steel Dragon | attacked | 532 | 59% (53–64) n=275 | 534 → 483 | 10% | 0 / 0 / 532 | 88% (82–92) n=144 | 74% (58–85) n=38 | 44% (37–51) n=183 |
| Animals Wrecker | played | 505 | 61% (56–66) n=368 | 656 → 505 | 23% | 0 / 354 / 151 | 69% (60–77) n=106 | 63% (52–73) n=78 | 56% (50–62) n=242 |
| Yorinobu Arasaka: Steel Dragon | played | 489 | 52% (47–57) n=365 | 576 → 489 | 15% | 0 / 229 / 260 | 73% (63–81) n=90 | 69% (54–80) n=45 | 43% (37–49) n=272 |
| 6th Street Recruits | played | 486 | 52% (47–57) n=375 | 908 → 482 | 47% | 267 / 98 / 121 | 68% (60–75) n=165 | 50% (42–58) n=147 | 28% (21–37) n=120 |
| Bonnie and Clyde | sold | 481 | 53% (48–58) n=366 | 1100 → 481 | 56% | 146 / 183 / 152 | 64% (55–71) n=138 | 50% (40–60) n=100 | 45% (38–52) n=184 |
| Psycho Squad | played | 478 | 52% (47–57) n=372 | 865 → 475 | 45% | 258 / 111 / 109 | 67% (60–74) n=166 | 43% (36–51) n=157 | 36% (28–45) n=114 |
| Dexter DeShawn: Off the Grid | called | 450 | 55% (51–60) n=450 | 450 → 450 | 0% | 246 / 119 / 85 | 61% (55–67) n=277 | 46% (35–57) n=72 | 47% (37–56) n=101 |
| Swordwise Huscle | played | 444 | 47% (42–53) n=339 | 1312 → 411 | 69% | 117 / 153 / 174 | 68% (60–76) n=136 | 30% (22–39) n=113 | 40% (32–48) n=133 |
| Sasha Yakovleva: Won't Let You Down | called | 433 | 53% (49–58) n=433 | 433 → 433 | 0% | 247 / 101 / 85 | 64% (58–69) n=281 | 32% (22–43) n=72 | 36% (27–47) n=80 |
| Swordwise Huscle | attacked | 426 | 49% (43–55) n=264 | 632 → 385 | 39% | 11 / 121 / 294 | 79% (70–86) n=99 | 53% (41–65) n=62 | 34% (27–42) n=155 |
| Adam Smasher: Ender of Legends | called | 418 | 53% (48–57) n=418 | 418 → 418 | 0% | 230 / 89 / 99 | 64% (58–69) n=283 | 27% (17–40) n=59 | 32% (22–43) n=76 |

(35 more card uses in the JSON report.)

Legal but never taken: Sasha Yakovleva: Won't Let You Down (Legend play, legal in 1664 turns).

| Decision type | Decisions | First-listed option taken | Options offered (1 / 2 / 3–5 / 6–10 / 11–20 / 21+) |
|---|---|---|---|
| main | 14206 | 7% | 0 / 1107 / 3807 / 5010 / 4041 / 241 |
| gig/steal | 3454 | 23% | 83 / 367 / 1476 / 1508 / 20 / 0 |
| gig/rollIn | 2240 | 0% | 0 / 560 / 1680 / 0 / 0 / 0 |
| gigValue/adjust | 818 | 10% | 0 / 7 / 57 / 53 / 472 / 229 |
| unit/defeat | 575 | 66% | 230 / 147 / 187 / 11 / 0 / 0 |
| mode/mode | 560 | 75% | 0 / 535 / 25 / 0 / 0 / 0 |
| mulligan | 560 | 15% | 0 / 560 / 0 / 0 / 0 / 0 |
| react | 531 | 51% | 0 / 328 / 203 / 0 / 0 / 0 |
| card/playFree | 444 | 72% | 0 / 171 / 262 / 11 / 0 / 0 |
| unit/pump | 442 | 56% | 139 / 160 / 135 / 8 / 0 / 0 |
| unit/equip | 56 | 86% | 9 / 15 / 25 / 7 / 0 / 0 |
| unit/bottomdeck | 44 | 82% | 27 / 12 / 5 / 0 / 0 / 0 |
| unit/bottomdeckOwn | 44 | 52% | 14 / 11 / 19 / 0 / 0 / 0 |
| unit/sacrifice | 40 | 80% | 23 / 8 / 9 / 0 / 0 / 0 |
| card/discard | 39 | 51% | 13 / 10 / 16 / 0 / 0 / 0 |
| yesno/draw | 17 | 100% | 0 / 17 / 0 / 0 / 0 / 0 |
| unit/call | 7 | 100% | 0 / 2 / 5 / 0 / 0 / 0 |
| yesno/call | 4 | 100% | 0 / 4 / 0 / 0 / 0 / 0 |
| mode/foolOnTheHill | 2 | 0% | 0 / 2 / 0 / 0 / 0 / 0 |
| mode/rivalChoice | 1 | 0% | 0 / 1 / 0 / 0 / 0 / 0 |

Reaction windows: 531 attacks. Reacted to 261 (deck won 37% (31–44) n=234): stole 211, targetGone 43, bothGone 7. Let 270 resolve (43% (35–51) n=154): stole 202, attackerGone 1, targetGone 58, bothGone 9. Choices: call 261, endReact 270.

## Samurai — 560 games, 41% won, 25858 decisions

| Card | Use | Uses | Win rate in games used (95%) | Legal turns → used | Not chosen | Early / mid / late uses | Ahead | Even | Behind |
|---|---|---|---|---|---|---|---|---|---|
| Rockn' Rockerboy | attacked | 951 | 47% (42–53) n=365 | 960 → 856 | 11% | 0 / 422 / 529 | 65% (59–71) n=207 | 56% (46–66) n=98 | 36% (30–43) n=214 |
| Johnny Silverhand: Never Stop Fighting | attacked | 882 | 53% (48–59) n=292 | 607 → 572 | 6% | 0 / 142 / 740 | 72% (65–78) n=177 | 77% (66–86) n=71 | 38% (31–46) n=159 |
| Rockn' Rockerboy | played | 565 | 47% (42–52) n=405 | 704 → 565 | 20% | 248 / 168 / 149 | 60% (54–67) n=207 | 39% (32–48) n=142 | 32% (25–41) n=136 |
| Kerry Eurodyne: The Last Rockerboy | attacked | 492 | 42% (36–48) n=264 | 690 → 471 | 32% | 51 / 207 / 234 | 53% (44–61) n=135 | 41% (31–51) n=91 | 36% (28–44) n=131 |
| Johnny Silverhand: Rocking Renegade | ability | 464 | 40% (35–46) n=322 | 1434 → 464 | 68% | 4 / 87 / 373 | 59% (52–66) n=186 | 37% (25–50) n=54 | 12% (8–19) n=137 |
| Johnny Silverhand: Never Stop Fighting | played | 460 | 47% (42–53) n=361 | 891 → 460 | 48% | 0 / 276 / 184 | 59% (51–66) n=167 | 46% (34–59) n=54 | 38% (31–45) n=176 |
| Kerry Eurodyne: The Last Rockerboy | played | 456 | 43% (38–48) n=342 | 821 → 454 | 45% | 196 / 142 / 118 | 52% (45–59) n=180 | 33% (26–41) n=136 | 28% (19–39) n=79 |
| Johnny Silverhand: Rocking Renegade | called | 421 | 40% (36–45) n=421 | 430 → 421 | 2% | 160 / 166 / 95 | 48% (42–54) n=265 | 27% (18–39) n=70 | 26% (18–36) n=86 |
| Alt Cunningham: Soulkiller Architect | ability | 420 | 39% (33–45) n=286 | 1628 → 420 | 74% | 11 / 75 / 334 | 55% (48–63) n=168 | 25% (16–37) n=67 | 14% (9–21) n=117 |
| Kerry Eurodyne: Axe, Attitude, Audience | called | 415 | 43% (38–48) n=415 | 431 → 415 | 4% | 159 / 169 / 87 | 51% (45–57) n=278 | 21% (13–32) n=72 | 34% (24–46) n=65 |
| Alt Cunningham: Soulkiller Architect | called | 412 | 42% (37–47) n=412 | 427 → 412 | 4% | 152 / 151 / 109 | 53% (46–59) n=255 | 28% (19–40) n=71 | 21% (14–31) n=86 |
| Japantown Jonin | played | 369 | 38% (33–43) n=312 | 568 → 361 | 36% | 196 / 95 / 78 | 47% (40–55) n=161 | 25% (17–34) n=101 | 32% (22–43) n=76 |
| Modded Kusanagi | played | 367 | 33% (27–39) n=215 | 1032 → 367 | 64% | 0 / 118 / 249 | 48% (38–58) n=90 | 41% (26–57) n=37 | 20% (14–27) n=148 |
| Modded Kusanagi | attacked | 355 | 32% (26–39) n=208 | 364 → 355 | 2% | 0 / 115 / 240 | 48% (39–58) n=95 | 47% (32–63) n=38 | 16% (10–23) n=134 |
| Rita Wheeler: No Stupid Questions | played | 352 | 43% (37–49) n=298 | 824 → 349 | 58% | 108 / 126 / 118 | 60% (51–68) n=117 | 38% (29–47) n=104 | 32% (24–42) n=99 |

(41 more card uses in the JSON report.)

| Decision type | Decisions | First-listed option taken | Options offered (1 / 2 / 3–5 / 6–10 / 11–20 / 21+) |
|---|---|---|---|
| main | 14305 | 10% | 0 / 1122 / 3478 / 6146 / 3446 / 113 |
| gig/steal | 2520 | 32% | 201 / 483 / 1010 / 815 / 11 / 0 |
| gig/rollIn | 2240 | 0% | 0 / 560 / 1680 / 0 / 0 / 0 |
| react | 1608 | 62% | 0 / 1060 / 538 / 10 / 0 / 0 |
| yesno/kerryReroll | 1327 | 53% | 0 / 1327 / 0 / 0 / 0 / 0 |
| mulligan | 560 | 27% | 0 / 560 / 0 / 0 / 0 / 0 |
| card/discard | 524 | 44% | 33 / 166 / 288 / 37 / 0 / 0 |
| gigValue/adjust | 498 | 14% | 0 / 10 / 46 / 84 / 221 / 137 |
| unit/lagAttack | 464 | 79% | 115 / 151 / 193 / 5 / 0 / 0 |
| unit/equip | 389 | 80% | 101 / 108 / 150 / 30 / 0 / 0 |
| unit/pump | 369 | 79% | 174 / 73 / 120 / 2 / 0 / 0 |
| unit/bottomdeck | 216 | 45% | 63 / 37 / 111 / 5 / 0 / 0 |
| unit/cantAttack | 185 | 59% | 58 / 58 / 68 / 1 / 0 / 0 |
| card/playFromTrash | 179 | 89% | 118 / 48 / 13 / 0 / 0 / 0 |
| card/freePlay | 147 | 86% | 0 / 90 / 57 / 0 / 0 / 0 |
| unit/weaken | 85 | 62% | 21 / 27 / 36 / 1 / 0 / 0 |
| unit/bottomdeckOwn | 74 | 69% | 29 / 27 / 18 / 0 / 0 / 0 |
| unit/call | 57 | 100% | 0 / 13 / 44 / 0 / 0 / 0 |
| unit/sacrifice | 51 | 86% | 31 / 13 / 7 / 0 / 0 / 0 |
| card/look | 42 | 100% | 19 / 18 / 5 / 0 / 0 / 0 |
| yesno/draw | 11 | 100% | 0 / 11 / 0 / 0 / 0 / 0 |
| mode/foolOnTheHill | 5 | 80% | 0 / 5 / 0 / 0 / 0 / 0 |
| card/discardForNothing | 1 | 0% | 0 / 0 / 1 / 0 / 0 / 0 |
| mode/rivalChoice | 1 | 0% | 0 / 1 / 0 / 0 / 0 / 0 |

Reaction windows: 1427 attacks. Reacted to 529 (deck won 36% (31–41) n=379): stole 144, stoleNothing 1, attackerGone 5, targetGone 352, bothGone 18, noneGone 9. Let 898 resolve (39% (34–44) n=345): stole 661, stoleNothing 4, attackerGone 3, targetGone 193, bothGone 37. Choices: call 239, endReact 1001, block 345, play 23.

## Smash the Curve — 560 games, 63% won, 24097 decisions

| Card | Use | Uses | Win rate in games used (95%) | Legal turns → used | Not chosen | Early / mid / late uses | Ahead | Even | Behind |
|---|---|---|---|---|---|---|---|---|---|
| Pepe Najarro: Working Doubles | attacked | 769 | 62% (57–67) n=328 | 917 → 700 | 24% | 82 / 317 / 370 | 87% (80–91) n=151 | 66% (57–74) n=120 | 54% (47–61) n=202 |
| 6th Street Recruits | attacked | 767 | 64% (58–68) n=343 | 903 → 698 | 23% | 71 / 293 / 403 | 83% (77–88) n=166 | 59% (50–67) n=119 | 57% (50–63) n=217 |
| Animals Wrecker | attacked | 707 | 74% (69–79) n=316 | 692 → 647 | 7% | 0 / 190 / 517 | 86% (80–91) n=167 | 91% (83–96) n=70 | 70% (64–76) n=214 |
| Synapse Burnout | sold | 524 | 64% (59–69) n=377 | 758 → 524 | 31% | 275 / 132 / 117 | 74% (67–79) n=182 | 53% (45–61) n=143 | 60% (51–68) n=124 |
| 6th Street Recruits | played | 507 | 61% (56–66) n=367 | 976 → 494 | 49% | 255 / 124 / 128 | 72% (65–79) n=178 | 52% (44–60) n=159 | 50% (40–60) n=94 |
| Animals Wrecker | played | 497 | 68% (63–73) n=387 | 683 → 497 | 27% | 0 / 353 / 144 | 78% (70–84) n=136 | 68% (57–77) n=80 | 61% (54–67) n=218 |
| Pepe Najarro: Working Doubles | played | 495 | 61% (56–66) n=372 | 991 → 490 | 51% | 272 / 98 / 125 | 70% (63–77) n=169 | 59% (51–66) n=167 | 38% (29–49) n=89 |
| Yorinobu Arasaka: Steel Dragon | played | 483 | 67% (62–72) n=370 | 600 → 483 | 19% | 0 / 191 / 292 | 86% (78–91) n=111 | 86% (74–93) n=51 | 57% (51–63) n=246 |
| V: Streetkid | attacked | 470 | 43% (37–49) n=269 | 555 → 470 | 15% | 65 / 170 / 235 | 56% (48–63) n=159 | 35% (22–50) n=40 | 34% (26–43) n=126 |
| Peace Offering | sold | 461 | 64% (58–68) n=357 | 966 → 461 | 52% | 175 / 175 / 111 | 69% (62–76) n=162 | 62% (52–71) n=100 | 58% (50–66) n=142 |
| Yorinobu Arasaka: Steel Dragon | attacked | 449 | 77% (71–81) n=272 | 447 → 419 | 6% | 0 / 0 / 449 | 96% (91–98) n=140 | 89% (78–95) n=54 | 64% (57–72) n=152 |
| Bonnie and Clyde | sold | 442 | 65% (60–70) n=336 | 1436 → 442 | 69% | 62 / 185 / 195 | 71% (63–78) n=137 | 70% (60–79) n=84 | 54% (47–62) n=168 |
| Adam Smasher: Ender of Legends | called | 441 | 62% (58–67) n=441 | 441 → 441 | 0% | 201 / 125 / 115 | 70% (65–75) n=317 | 51% (38–63) n=59 | 32% (22–44) n=65 |
| Mantis Blades | sold | 429 | 61% (56–66) n=340 | 623 → 429 | 31% | 237 / 71 / 121 | 68% (61–75) n=149 | 58% (50–66) n=139 | 51% (42–60) n=111 |
| V: Streetkid | called | 419 | 62% (57–67) n=419 | 419 → 419 | 0% | 193 / 140 / 86 | 65% (59–70) n=305 | 46% (34–59) n=56 | 62% (49–73) n=58 |

(32 more card uses in the JSON report.)

Legal but never taken: V: Streetkid (Legend play, legal in 1110 turns), Adam Smasher: Ender of Legends (Legend play, legal in 278 turns).

| Decision type | Decisions | First-listed option taken | Options offered (1 / 2 / 3–5 / 6–10 / 11–20 / 21+) |
|---|---|---|---|
| main | 13584 | 8% | 0 / 1212 / 3673 / 5073 / 3479 / 147 |
| gig/steal | 3638 | 29% | 216 / 490 / 1631 / 1286 / 15 / 0 |
| gig/rollIn | 2240 | 0% | 0 / 560 / 1680 / 0 / 0 / 0 |
| react | 1407 | 66% | 0 / 980 / 414 / 13 / 0 / 0 |
| unit/defeat | 623 | 58% | 200 / 174 / 232 / 17 / 0 / 0 |
| mulligan | 560 | 20% | 0 / 560 / 0 / 0 / 0 / 0 |
| card/search | 464 | 69% | 202 / 143 / 90 / 29 / 0 / 0 |
| card/playFree | 457 | 74% | 0 / 137 / 290 / 30 / 0 / 0 |
| unit/equip | 310 | 85% | 46 / 84 / 149 / 31 / 0 / 0 |
| gigValue/adjust | 285 | 9% | 0 / 16 / 46 / 18 / 33 / 172 |
| unit/ready | 160 | 96% | 0 / 139 / 21 / 0 / 0 / 0 |
| gigValue/setGig | 132 | 8% | 0 / 0 / 3 / 23 / 27 / 79 |
| unit/pump | 76 | 83% | 35 / 21 / 20 / 0 / 0 / 0 |
| unit/sacrifice | 66 | 83% | 35 / 23 / 8 / 0 / 0 / 0 |
| card/discard | 47 | 51% | 11 / 15 / 20 / 1 / 0 / 0 |
| yesno/draw | 22 | 100% | 0 / 22 / 0 / 0 / 0 / 0 |
| card/defeat | 16 | 94% | 14 / 2 / 0 / 0 / 0 / 0 |
| mode/rivalChoice | 8 | 0% | 0 / 8 / 0 / 0 / 0 / 0 |
| mode/foolOnTheHill | 2 | 50% | 0 / 2 / 0 / 0 / 0 / 0 |

Reaction windows: 1295 attacks. Reacted to 429 (deck won 57% (52–62) n=310): stole 193, attackerGone 25, targetGone 174, bothGone 36, noneGone 1. Let 866 resolve (65% (60–70) n=356): stole 615, stoleNothing 8, attackerGone 6, targetGone 196, bothGone 40, noneGone 1. Choices: endReact 935, call 269, block 167, play 36.

## The Red Chrome - Aggro — 560 games, 42% won, 21145 decisions

| Card | Use | Uses | Win rate in games used (95%) | Legal turns → used | Not chosen | Early / mid / late uses | Ahead | Even | Behind |
|---|---|---|---|---|---|---|---|---|---|
| 6th Street Recruits | attacked | 680 | 43% (38–49) n=322 | 830 → 620 | 25% | 84 / 302 / 294 | 55% (46–63) n=141 | 44% (35–53) n=108 | 43% (37–50) n=211 |
| Animals Wrecker | attacked | 669 | 53% (47–58) n=270 | 611 → 594 | 3% | 0 / 161 / 508 | 78% (69–84) n=117 | 70% (57–80) n=60 | 44% (37–51) n=203 |
| Detonate | sold | 542 | 42% (38–47) n=397 | 696 → 542 | 22% | 334 / 93 / 115 | 51% (44–58) n=183 | 36% (29–43) n=163 | 40% (32–50) n=114 |
| Over the Edge | sold | 505 | 45% (40–50) n=387 | 1105 → 505 | 54% | 124 / 237 / 144 | 54% (46–61) n=156 | 40% (30–50) n=90 | 43% (37–51) n=189 |
| Carnage at the Colosseum | sold | 500 | 41% (36–46) n=367 | 1452 → 500 | 66% | 42 / 214 / 244 | 49% (41–58) n=128 | 49% (38–60) n=74 | 31% (26–38) n=223 |
| 6th Street Recruits | played | 480 | 41% (36–47) n=358 | 823 → 476 | 42% | 296 / 97 / 87 | 48% (41–55) n=175 | 37% (30–44) n=158 | 28% (19–39) n=82 |
| V: Streetkid | attacked | 451 | 31% (25–36) n=278 | 558 → 451 | 19% | 60 / 122 / 269 | 48% (40–56) n=146 | 53% (39–67) n=45 | 21% (15–29) n=146 |
| Animals Wrecker | played | 447 | 46% (41–52) n=343 | 561 → 447 | 20% | 0 / 293 / 154 | 59% (49–68) n=104 | 53% (41–65) n=66 | 41% (35–48) n=217 |
| Mantis Blades | sold | 439 | 43% (38–48) n=358 | 596 → 439 | 26% | 244 / 74 / 121 | 50% (43–58) n=165 | 40% (32–49) n=131 | 33% (24–42) n=104 |
| Royce: Psycho on the Edge | called | 436 | 40% (35–45) n=436 | 436 → 436 | 0% | 184 / 120 / 132 | 49% (43–55) n=281 | 36% (25–48) n=67 | 15% (9–24) n=88 |
| V: Streetkid | called | 432 | 41% (36–46) n=432 | 432 → 432 | 0% | 192 / 109 / 131 | 48% (42–54) n=276 | 31% (22–43) n=70 | 27% (19–37) n=86 |
| Adam Smasher: Ender of Legends | called | 425 | 41% (36–46) n=425 | 425 → 425 | 0% | 197 / 91 / 137 | 50% (44–56) n=291 | 28% (19–40) n=67 | 15% (8–25) n=67 |
| Valentino Guerrera | attacked | 422 | 41% (35–47) n=251 | 626 → 384 | 39% | 36 / 144 / 242 | 63% (53–72) n=89 | 41% (31–52) n=82 | 36% (29–44) n=154 |
| Valentino Guerrera | played | 409 | 37% (32–43) n=323 | 1278 → 387 | 70% | 185 / 90 / 134 | 52% (43–60) n=126 | 28% (22–36) n=145 | 26% (17–36) n=78 |
| Appetite for Destruction | sold | 389 | 44% (39–49) n=331 | 590 → 389 | 34% | 176 / 116 / 97 | 55% (46–64) n=123 | 43% (35–52) n=120 | 35% (27–44) n=119 |

(34 more card uses in the JSON report.)

Legal but never taken: V: Streetkid (Legend play, legal in 966 turns), Royce: Psycho on the Edge (Legend play, legal in 1237 turns), Adam Smasher: Ender of Legends (Legend play, legal in 126 turns), Appetite for Destruction (played, legal in 494 turns).

| Decision type | Decisions | First-listed option taken | Options offered (1 / 2 / 3–5 / 6–10 / 11–20 / 21+) |
|---|---|---|---|
| main | 12760 | 7% | 0 / 1047 / 3544 / 5005 / 2983 / 181 |
| gig/steal | 3277 | 27% | 148 / 421 / 1374 / 1315 / 19 / 0 |
| gig/rollIn | 2240 | 0% | 0 / 560 / 1680 / 0 / 0 / 0 |
| react | 1055 | 69% | 0 / 717 / 338 / 0 / 0 / 0 |
| mulligan | 560 | 33% | 0 / 560 / 0 / 0 / 0 / 0 |
| unit/defeat | 306 | 57% | 83 / 86 / 127 / 10 / 0 / 0 |
| card/playFree | 232 | 67% | 0 / 81 / 144 / 7 / 0 / 0 |
| gigValue/adjust | 213 | 8% | 0 / 15 / 38 / 36 / 7 / 117 |
| unit/equip | 185 | 90% | 61 / 69 / 48 / 7 / 0 / 0 |
| card/search | 159 | 87% | 119 / 13 / 14 / 13 / 0 / 0 |
| card/discard | 60 | 43% | 9 / 17 / 33 / 1 / 0 / 0 |
| unit/sacrifice | 49 | 88% | 28 / 15 / 6 / 0 / 0 / 0 |
| card/defeat | 16 | 88% | 13 / 3 / 0 / 0 / 0 / 0 |
| yesno/draw | 14 | 100% | 0 / 14 / 0 / 0 / 0 / 0 |
| unit/pump | 13 | 77% | 9 / 2 / 2 / 0 / 0 / 0 |
| mode/foolOnTheHill | 5 | 60% | 0 / 5 / 0 / 0 / 0 / 0 |
| mode/rivalChoice | 1 | 0% | 0 / 1 / 0 / 0 / 0 / 0 |

Reaction windows: 1007 attacks. Reacted to 307 (deck won 35% (29–41) n=259): stole 177, attackerGone 3, targetGone 118, bothGone 9. Let 700 resolve (38% (32–43) n=285): stole 487, stoleNothing 8, attackerGone 3, targetGone 173, bothGone 29. Choices: endReact 733, call 219, block 101, play 2.

## YYB Rogue Gear — 560 games, 53% won, 25912 decisions

| Card | Use | Uses | Win rate in games used (95%) | Legal turns → used | Not chosen | Early / mid / late uses | Ahead | Even | Behind |
|---|---|---|---|---|---|---|---|---|---|
| V: Corporate Exile | attacked | 979 | 51% (47–56) n=480 | 1136 → 979 | 14% | 110 / 359 / 510 | 60% (55–65) n=342 | 48% (39–57) n=113 | 37% (30–44) n=158 |
| Psycho Squad | attacked | 779 | 55% (50–61) n=312 | 877 → 728 | 17% | 108 / 304 / 367 | 62% (56–69) n=212 | 52% (44–61) n=132 | 44% (36–53) n=136 |
| The Heist | sold | 521 | 50% (45–55) n=376 | 967 → 521 | 46% | 193 / 193 / 135 | 56% (49–62) n=217 | 40% (31–49) n=118 | 37% (28–46) n=104 |
| Psycho Squad | played | 513 | 56% (51–61) n=385 | 969 → 510 | 47% | 251 / 129 / 133 | 61% (55–67) n=219 | 53% (45–60) n=168 | 36% (24–49) n=53 |
| Dying Night: V's Pistol | sold | 513 | 51% (46–56) n=376 | 1090 → 513 | 53% | 204 / 153 / 156 | 59% (52–65) n=215 | 47% (39–55) n=142 | 28% (20–39) n=85 |
| V: Corporate Exile | Go Solo (self-paid 506) | 506 | 51% (47–56) n=506 | 595 → 506 | 15% | 116 / 206 / 184 | 60% (55–66) n=313 | 33% (24–44) n=81 | 39% (31–49) n=112 |
| V: Corporate Exile | called | 483 | 53% (48–57) n=483 | 483 → 483 | 0% | 241 / 156 / 86 | 59% (54–64) n=333 | 38% (29–47) n=101 | 41% (28–55) n=49 |
| Zetatech Faceplate | sold | 479 | 52% (47–57) n=352 | 1558 → 479 | 69% | 71 / 188 / 220 | 58% (52–65) n=219 | 44% (34–55) n=77 | 39% (30–48) n=114 |
| River Ward: Detective on the Hunt | called | 473 | 50% (46–55) n=473 | 473 → 473 | 0% | 226 / 163 / 84 | 55% (50–60) n=347 | 38% (29–49) n=91 | 34% (21–51) n=35 |
| Trauma Team Operatives | played | 465 | 51% (46–56) n=346 | 1010 → 440 | 56% | 10 / 164 / 291 | 60% (54–66) n=234 | 42% (30–55) n=55 | 28% (21–38) n=102 |
| River Ward: Detective on the Hunt | ability | 459 | 47% (42–53) n=291 | 1901 → 459 | 76% | 51 / 88 / 320 | 62% (55–68) n=209 | 18% (11–30) n=60 | 19% (12–28) n=89 |
| Viktor Vektor: Sit Down and Relax | called | 446 | 52% (47–56) n=446 | 446 → 446 | 0% | 212 / 152 / 82 | 58% (53–64) n=322 | 37% (27–47) n=87 | 30% (17–46) n=37 |
| Trauma Team Operatives | attacked | 416 | 54% (48–61) n=230 | 421 → 377 | 10% | 0 / 60 / 356 | 74% (67–81) n=137 | 66% (53–76) n=61 | 31% (23–41) n=99 |
| Dexter DeShawn: One Last Chance | attacked | 410 | 53% (46–59) n=222 | 550 → 384 | 30% | 37 / 164 / 209 | 62% (53–69) n=143 | 49% (37–61) n=65 | 28% (20–39) n=81 |
| Modded Kusanagi | played | 409 | 40% (34–46) n=262 | 1106 → 409 | 63% | 0 / 60 / 349 | 58% (50–67) n=130 | 46% (32–61) n=41 | 15% (11–22) n=156 |

(37 more card uses in the JSON report.)

Legal but never taken: Safety Override (played, legal in 644 turns).

| Decision type | Decisions | First-listed option taken | Options offered (1 / 2 / 3–5 / 6–10 / 11–20 / 21+) |
|---|---|---|---|
| main | 14115 | 8% | 0 / 1212 / 3576 / 5920 / 3273 / 134 |
| gig/steal | 3057 | 42% | 511 / 668 / 1091 / 777 / 10 / 0 |
| gig/rollIn | 2240 | 100% | 0 / 560 / 1680 / 0 / 0 / 0 |
| react | 2024 | 69% | 0 / 1343 / 677 / 4 / 0 / 0 |
| gigValue/adjust | 1456 | 9% | 0 / 1 / 82 / 322 / 869 / 182 |
| unit/equip | 949 | 77% | 125 / 240 / 543 / 41 / 0 / 0 |
| card/search | 645 | 84% | 19 / 370 / 256 / 0 / 0 / 0 |
| mulligan | 560 | 16% | 0 / 560 / 0 / 0 / 0 / 0 |
| card/playFree | 307 | 95% | 208 / 88 / 11 / 0 / 0 / 0 |
| card/trash | 259 | 52% | 0 / 259 / 0 / 0 / 0 / 0 |
| unit/sacrifice | 188 | 56% | 77 / 65 / 44 / 2 / 0 / 0 |
| card/discard | 47 | 45% | 6 / 15 / 23 / 3 / 0 / 0 |
| yesno/playFree | 30 | 100% | 0 / 30 / 0 / 0 / 0 / 0 |
| unit/protect | 15 | 27% | 3 / 6 / 6 / 0 / 0 / 0 |
| yesno/draw | 9 | 100% | 0 / 9 / 0 / 0 / 0 / 0 |
| mode/rivalChoice | 8 | 0% | 0 / 8 / 0 / 0 / 0 / 0 |
| mode/foolOnTheHill | 3 | 67% | 0 / 3 / 0 / 0 / 0 / 0 |

Reaction windows: 1810 attacks. Reacted to 518 (deck won 48% (43–54) n=339): stole 166, attackerGone 7, targetGone 302, bothGone 28, noneGone 15. Let 1292 resolve (45% (41–50) n=416): stole 931, stoleNothing 13, attackerGone 2, targetGone 280, bothGone 66. Choices: call 185, block 305, endReact 1395, ability 106, play 33.

## YYY Adam v1 - Ready for Brawl — 560 games, 45% won, 27304 decisions

| Card | Use | Uses | Win rate in games used (95%) | Legal turns → used | Not chosen | Early / mid / late uses | Ahead | Even | Behind |
|---|---|---|---|---|---|---|---|---|---|
| MaxTac Suppression Team | attacked | 689 | 50% (44–55) n=320 | 797 → 636 | 20% | 0 / 290 / 399 | 65% (58–72) n=172 | 60% (50–70) n=81 | 41% (34–48) n=185 |
| Dexter DeShawn: One Last Chance | attacked | 674 | 49% (44–54) n=334 | 902 → 616 | 32% | 81 / 280 / 313 | 62% (54–69) n=175 | 47% (37–56) n=105 | 45% (38–53) n=181 |
| Muamar Reyes: El Capitán | ability | 651 | 42% (37–47) n=401 | 2181 → 651 | 70% | 43 / 157 / 451 | 60% (54–66) n=242 | 23% (15–34) n=69 | 19% (14–25) n=181 |
| Safety Override | sold | 642 | 44% (39–48) n=433 | 1038 → 642 | 38% | 250 / 207 / 185 | 52% (45–58) n=214 | 40% (32–47) n=159 | 36% (29–43) n=171 |
| Augmented Negotiators | played | 627 | 47% (42–52) n=426 | 1319 → 592 | 55% | 103 / 285 / 239 | 59% (52–65) n=210 | 36% (28–45) n=121 | 40% (33–47) n=177 |
| Dexter DeShawn: One Last Chance | played | 623 | 45% (41–50) n=422 | 860 → 596 | 31% | 251 / 218 / 154 | 58% (51–64) n=224 | 36% (29–44) n=161 | 38% (30–47) n=129 |
| Maelstrom Goons | played | 595 | 44% (40–49) n=416 | 1152 → 552 | 52% | 148 / 255 / 192 | 57% (50–63) n=203 | 34% (27–42) n=150 | 37% (29–45) n=131 |
| The Heist | sold | 593 | 47% (42–51) n=415 | 987 → 593 | 40% | 226 / 187 / 180 | 59% (52–66) n=194 | 36% (29–44) n=151 | 38% (31–45) n=173 |
| MaxTac Suppression Team | played | 570 | 46% (42–51) n=405 | 971 → 568 | 42% | 184 / 156 / 230 | 61% (54–68) n=199 | 35% (28–43) n=142 | 37% (30–45) n=150 |
| Maelstrom Goons | attacked | 549 | 47% (42–53) n=309 | 762 → 494 | 35% | 42 / 195 / 312 | 69% (61–76) n=143 | 48% (38–58) n=88 | 37% (30–45) n=170 |
| Zetatech Faceplate | sold | 490 | 46% (41–51) n=366 | 1360 → 490 | 64% | 68 / 231 / 191 | 56% (49–64) n=163 | 49% (39–59) n=94 | 35% (28–42) n=176 |
| River Ward: Detective on the Hunt | called | 457 | 46% (41–50) n=457 | 457 → 457 | 0% | 250 / 146 / 61 | 54% (48–60) n=278 | 34% (26–43) n=124 | 29% (19–42) n=55 |
| The Relic: Experimental Biochip | sold | 451 | 45% (40–50) n=360 | 947 → 451 | 52% | 238 / 87 / 126 | 51% (43–58) n=167 | 39% (32–47) n=143 | 35% (27–44) n=106 |
| Kerry Eurodyne: Axe, Attitude, Audience | called | 450 | 47% (42–52) n=450 | 450 → 450 | 0% | 262 / 135 / 53 | 55% (49–61) n=276 | 35% (27–44) n=121 | 32% (21–45) n=53 |
| Muamar Reyes: El Capitán | called | 444 | 43% (38–47) n=444 | 444 → 444 | 0% | 293 / 116 / 35 | 49% (43–55) n=259 | 33% (26–41) n=145 | 35% (22–50) n=40 |

(23 more card uses in the JSON report.)

Legal but never taken: Safety Override (played, legal in 1058 turns).

| Decision type | Decisions | First-listed option taken | Options offered (1 / 2 / 3–5 / 6–10 / 11–20 / 21+) |
|---|---|---|---|
| main | 13682 | 8% | 0 / 1079 / 3305 / 5525 / 3619 / 154 |
| gig/steal | 2498 | 32% | 163 / 418 / 1096 / 817 / 4 / 0 |
| gig/rollIn | 2240 | 0% | 0 / 560 / 1680 / 0 / 0 / 0 |
| gigValue/adjust | 2135 | 27% | 0 / 0 / 172 / 372 / 1289 / 302 |
| react | 1906 | 62% | 0 / 1189 / 713 / 4 / 0 / 0 |
| yesno/kerryReroll | 1794 | 63% | 0 / 1794 / 0 / 0 / 0 / 0 |
| unit/equip | 719 | 75% | 1 / 164 / 456 / 98 / 0 / 0 |
| mulligan | 560 | 29% | 0 / 560 / 0 / 0 / 0 / 0 |
| mode/muamarCall | 544 | 54% | 0 / 544 / 0 / 0 / 0 / 0 |
| unit/protect | 306 | 53% | 113 / 110 / 81 / 2 / 0 / 0 |
| card/trash | 298 | 54% | 0 / 298 / 0 / 0 / 0 / 0 |
| card/playFree | 243 | 84% | 156 / 37 / 47 / 3 / 0 / 0 |
| unit/sacrifice | 242 | 65% | 109 / 80 / 53 / 0 / 0 / 0 |
| card/discard | 50 | 40% | 9 / 9 / 32 / 0 / 0 / 0 |
| card/search | 46 | 76% | 24 / 19 / 3 / 0 / 0 / 0 |
| yesno/playFree | 23 | 100% | 0 / 23 / 0 / 0 / 0 / 0 |
| yesno/draw | 11 | 100% | 0 / 11 / 0 / 0 / 0 / 0 |
| mode/foolOnTheHill | 6 | 17% | 0 / 6 / 0 / 0 / 0 / 0 |
| mode/rivalChoice | 1 | 0% | 0 / 1 / 0 / 0 / 0 / 0 |

Reaction windows: 1667 attacks. Reacted to 609 (deck won 44% (40–49) n=403): stole 227, attackerGone 12, targetGone 306, bothGone 37, noneGone 27. Let 1058 resolve (44% (39–49) n=396): stole 797, stoleNothing 4, attackerGone 2, targetGone 227, bothGone 28. Choices: block 334, endReact 1174, ability 76, call 288, play 34.

## The bot’s own scores against outcomes (calibration check)

> Association only, like the rest of this report: the deciding side's win rate over its decisions, by the margin the bot claimed for its choice (its value minus the best other option's, in Gigs), and by whether the deep rollouts kept the 1-ply screen's top pick. A big claimed margin often comes in positions that are already won or lost, so a rising win rate is not proof the margins are right; a flat one says they carry little. Intervals use the game count (decisions in one game are not independent); under 20 games a cell shows only its counts.

| Bot | Scores | Scored | <0 Gigs | 0–0.05 Gigs | 0.05–0.15 Gigs | 0.15–0.5 Gigs | 0.5–1 Gigs | 1+ Gigs |
|---|---|---|---|---|---|---|---|---|
| hard | main deep | 765603 | — | 50% (50–51) 299887 in 39672 games | 53% (52–53) 147641 in 38611 games | 53% (53–54) 110508 in 37784 games | 49% (49–50) 42367 in 25768 games | 54% (54–55) 165200 in 38878 games |
| hard | sell deep | 180789 | — | 51% (50–51) 155709 in 38967 games | 47% (46–49) 4070 in 3848 games | 50% (49–51) 5374 in 5060 games | 51% (50–53) 3044 in 2933 games | 54% (53–55) 12592 in 11116 games |
| hard | react deep | 89931 | 39% (38–40) 16102 in 9120 games | 38% (37–39) 36030 in 18594 games | 38% (36–39) 3909 in 3516 games | 39% (38–41) 7443 in 6516 games | 39% (38–41) 5025 in 4318 games | 45% (44–46) 21422 in 12362 games |

| Bot | Scores | Deep decisions | Rollouts kept the 1-ply pick | Rollouts overturned it | Overturned |
|---|---|---|---|---|---|
| hard | main deep | 765603 | 52% (52–53) 629198 in 39760 games | 51% (51–52) 136405 in 38399 games | 18% |
