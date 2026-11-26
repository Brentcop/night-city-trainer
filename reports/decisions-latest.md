# Decision telemetry

19880 games, 1842219 decisions (telemetry schema 1). Sim v13, hard bot, seed 1.

> Descriptive association only: win rates in games where a card was used a given way, with 95% Wilson intervals. They are not the value of the card or of the choice (no counterfactual comparison yet; ROADMAP §5 steps 3 and 5). A slice from fewer than 20 games shows only its count ("thin").

Stages: early turns 1–4, middle turns 5–8, late turn 9+. Ahead / even / behind: the acting player's Gig count against the rival's when the decision was made. "Not chosen": share of the turns (attacks, for reactions) in which the use was legal but not taken.

Measured: games 19880, recordsPerGame 92.7, rawBytesPerGame 61267.2, aggregateBytesPerGame 13147.3, mergedBytes 1451752, seconds 2052.0.

## Addin' Trash — 560 games, 23% won, 26346 decisions

| Card | Use | Uses | Win rate in games used (95%) | Legal turns → used | Not chosen | Early / mid / late uses | Ahead | Even | Behind |
|---|---|---|---|---|---|---|---|---|---|
| Viktor Vektor: You Might Feel a Little Pinch | attacked | 795 | 25% (20–29) n=359 | 974 → 734 | 25% | 111 / 360 / 324 | 40% (32–48) n=149 | 25% (19–33) n=140 | 14% (10–19) n=219 |
| Muamar Reyes: El Capitán | ability | 760 | 20% (17–24) n=434 | 2103 → 760 | 64% | 45 / 180 / 535 | 38% (31–44) n=216 | 11% (6–19) n=99 | 4% (2–7) n=261 |
| Trauma Team Operatives | attacked | 647 | 27% (22–32) n=302 | 687 → 593 | 14% | 0 / 182 / 465 | 49% (39–58) n=101 | 45% (32–58) n=56 | 19% (14–24) n=225 |
| Viktor Vektor: You Might Feel a Little Pinch | played | 639 | 24% (20–28) n=434 | 770 → 631 | 18% | 373 / 143 / 123 | 28% (22–34) n=207 | 22% (17–29) n=185 | 12% (8–18) n=141 |
| Augmented Negotiators | played | 597 | 25% (21–29) n=418 | 984 → 577 | 41% | 214 / 214 / 169 | 33% (27–40) n=190 | 26% (20–34) n=155 | 10% (6–16) n=167 |
| Trauma Team Operatives | played | 583 | 24% (20–28) n=408 | 764 → 570 | 25% | 20 / 349 / 214 | 35% (28–42) n=188 | 28% (20–38) n=89 | 12% (8–17) n=205 |
| Secondhand Bombus | played | 531 | 24% (20–28) n=405 | 1332 → 521 | 61% | 164 / 207 / 160 | 31% (26–37) n=251 | 18% (12–28) n=88 | 14% (9–21) n=125 |
| Mandibular Upgrade | sold | 530 | 21% (17–26) n=387 | 677 → 530 | 22% | 268 / 143 / 119 | 23% (17–30) n=174 | 24% (18–31) n=150 | 12% (7–18) n=138 |
| Cyberpsychosis | sold | 460 | 23% (19–28) n=341 | 1360 → 460 | 66% | 67 / 210 / 183 | 32% (25–40) n=135 | 29% (21–40) n=78 | 15% (10–21) n=177 |
| The Heist | sold | 445 | 22% (18–27) n=352 | 973 → 445 | 54% | 152 / 178 / 115 | 28% (21–36) n=135 | 24% (17–33) n=116 | 15% (11–22) n=156 |
| Safety Override | sold | 443 | 22% (18–27) n=346 | 985 → 443 | 55% | 166 / 163 / 114 | 27% (21–35) n=151 | 25% (17–34) n=106 | 13% (8–20) n=138 |
| River Ward: Detective on the Hunt | called | 432 | 22% (19–27) n=432 | 432 → 432 | 0% | 255 / 115 / 62 | 27% (21–33) n=240 | 20% (14–28) n=126 | 12% (6–22) n=66 |
| Muamar Reyes: El Capitán | called | 416 | 22% (18–26) n=416 | 416 → 416 | 0% | 269 / 92 / 55 | 26% (20–32) n=217 | 23% (17–31) n=134 | 6% (2–15) n=65 |
| Dum Dum: Maelstrom Triggerman | called | 398 | 22% (19–27) n=398 | 398 → 398 | 0% | 239 / 87 / 72 | 26% (20–32) n=205 | 20% (14–28) n=133 | 15% (8–26) n=60 |
| River Ward: Detective on the Hunt | ability | 395 | 21% (17–26) n=290 | 2125 → 395 | 81% | 38 / 98 / 259 | 40% (32–49) n=122 | 24% (14–36) n=55 | 5% (3–10) n=154 |

(31 more card uses in the JSON report.)

| Decision type | Decisions | First-listed option taken | Options offered (1 / 2 / 3–5 / 6–10 / 11–20 / 21+) |
|---|---|---|---|
| main | 13511 | 13% | 0 / 714 / 3185 / 6381 / 3186 / 45 |
| react | 3225 | 62% | 0 / 1465 / 1688 / 72 / 0 / 0 |
| gig/rollIn | 2240 | 0% | 0 / 560 / 1680 / 0 / 0 / 0 |
| gig/steal | 1983 | 35% | 119 / 373 / 800 / 680 / 11 / 0 |
| gigValue/adjust | 1201 | 25% | 0 / 1 / 23 / 117 / 825 / 235 |
| unit/equip | 1123 | 78% | 78 / 300 / 683 / 62 / 0 / 0 |
| mulligan | 560 | 19% | 0 / 560 / 0 / 0 / 0 / 0 |
| mode/muamarCall | 541 | 65% | 0 / 541 / 0 / 0 / 0 / 0 |
| unit/pump | 427 | 67% | 196 / 140 / 91 / 0 / 0 / 0 |
| card/playFree | 414 | 86% | 288 / 69 / 50 / 7 / 0 / 0 |
| unit/protect | 393 | 64% | 180 / 151 / 62 / 0 / 0 / 0 |
| card/trash | 358 | 49% | 0 / 358 / 0 / 0 / 0 / 0 |
| card/defeatGear | 112 | 88% | 0 / 69 / 42 / 1 / 0 / 0 |
| card/discard | 97 | 74% | 9 / 52 / 36 / 0 / 0 / 0 |
| card/search | 79 | 80% | 38 / 29 / 12 / 0 / 0 / 0 |
| unit/sacrifice | 42 | 90% | 30 / 12 / 0 / 0 / 0 / 0 |
| yesno/playFree | 28 | 100% | 0 / 28 / 0 / 0 / 0 / 0 |
| mode/foolOnTheHill | 6 | 83% | 0 / 6 / 0 / 0 / 0 / 0 |
| yesno/draw | 6 | 100% | 0 / 6 / 0 / 0 / 0 / 0 |

Reaction windows: 2630 attacks. Reacted to 970 (deck won 21% (18–25) n=498): stole 282, stoleNothing 1, attackerGone 30, targetGone 510, bothGone 92, noneGone 55. Let 1660 resolve (22% (18–26) n=473): stole 1300, stoleNothing 24, attackerGone 9, targetGone 268, bothGone 57, noneGone 2. Choices: endReact 1986, call 362, block 604, ability 151, play 122.

## Alt + V + Del — 560 games, 39% won, 25196 decisions

| Card | Use | Uses | Win rate in games used (95%) | Legal turns → used | Not chosen | Early / mid / late uses | Ahead | Even | Behind |
|---|---|---|---|---|---|---|---|---|---|
| 6th Street Recruits | attacked | 905 | 42% (37–47) n=376 | 1084 → 813 | 25% | 84 / 370 / 451 | 64% (56–71) n=152 | 50% (42–59) n=123 | 36% (30–41) n=276 |
| V: Streetkid | attacked | 602 | 37% (32–42) n=356 | 715 → 602 | 16% | 76 / 196 / 330 | 53% (46–60) n=182 | 53% (40–66) n=51 | 27% (22–34) n=202 |
| 6th Street Recruits | played | 581 | 39% (34–44) n=412 | 913 → 576 | 37% | 341 / 121 / 119 | 47% (41–54) n=215 | 35% (28–42) n=187 | 32% (23–41) n=95 |
| Yorinobu Arasaka: Steel Dragon | played | 577 | 40% (36–45) n=413 | 668 → 577 | 14% | 0 / 198 / 379 | 62% (53–69) n=130 | 51% (39–62) n=69 | 28% (23–34) n=280 |
| Johnny Silverhand: Never Stop Fighting | attacked | 562 | 51% (44–57) n=235 | 414 → 383 | 7% | 0 / 110 / 452 | 76% (67–83) n=113 | 64% (49–76) n=44 | 38% (30–46) n=138 |
| All is Lost | sold | 544 | 40% (35–45) n=395 | 716 → 544 | 24% | 272 / 119 / 153 | 50% (43–58) n=175 | 38% (31–46) n=149 | 27% (21–35) n=146 |
| Meredith Stout: Stone Cold Corpo | attacked | 533 | 40% (34–46) n=288 | 995 → 498 | 50% | 38 / 121 / 374 | 67% (58–74) n=120 | 46% (36–56) n=87 | 23% (17–30) n=168 |
| Yorinobu Arasaka: Steel Dragon | attacked | 488 | 50% (44–56) n=274 | 485 → 447 | 8% | 0 / 0 / 488 | 75% (66–82) n=114 | 82% (70–89) n=60 | 35% (28–42) n=175 |
| Industrial Assembly | sold | 477 | 37% (32–42) n=357 | 989 → 477 | 52% | 121 / 194 / 162 | 48% (40–57) n=133 | 36% (28–45) n=116 | 28% (21–35) n=178 |
| Screw: Lovelorn Fool | attacked | 460 | 44% (38–50) n=221 | 539 → 442 | 18% | 0 / 183 / 277 | 63% (54–72) n=106 | 60% (45–72) n=47 | 38% (31–47) n=138 |
| Meredith Stout: Stone Cold Corpo | played | 448 | 35% (30–40) n=346 | 1321 → 438 | 67% | 157 / 145 / 146 | 53% (43–62) n=102 | 37% (29–45) n=147 | 25% (18–33) n=141 |
| Mantis Blades | sold | 440 | 40% (35–45) n=361 | 633 → 440 | 30% | 273 / 73 / 94 | 47% (39–54) n=161 | 37% (30–46) n=137 | 33% (25–43) n=105 |
| V: Streetkid | called | 425 | 39% (34–44) n=425 | 425 → 425 | 0% | 187 / 128 / 110 | 49% (44–55) n=277 | 24% (15–37) n=54 | 16% (10–25) n=94 |
| Alt Cunningham: Soulkiller Architect | called | 424 | 39% (35–44) n=424 | 424 → 424 | 0% | 161 / 155 / 108 | 48% (42–54) n=271 | 33% (23–45) n=66 | 16% (10–25) n=87 |
| Johnny Silverhand: Rocking Renegade | called | 411 | 39% (35–44) n=411 | 411 → 411 | 0% | 154 / 145 / 112 | 51% (44–57) n=255 | 27% (18–39) n=70 | 15% (9–24) n=86 |

(33 more card uses in the JSON report.)

| Decision type | Decisions | First-listed option taken | Options offered (1 / 2 / 3–5 / 6–10 / 11–20 / 21+) |
|---|---|---|---|
| main | 14507 | 9% | 0 / 1142 / 3533 / 5078 / 4497 / 257 |
| gig/steal | 2718 | 27% | 154 / 350 / 1086 / 1110 / 18 / 0 |
| gig/rollIn | 2240 | 0% | 0 / 560 / 1680 / 0 / 0 / 0 |
| react | 1885 | 69% | 0 / 1271 / 607 / 7 / 0 / 0 |
| card/search | 616 | 67% | 281 / 161 / 134 / 38 / 2 / 0 |
| mulligan | 560 | 39% | 0 / 560 / 0 / 0 / 0 / 0 |
| gigValue/adjust | 533 | 7% | 0 / 27 / 126 / 44 / 75 / 261 |
| card/playFree | 500 | 83% | 0 / 206 / 286 / 8 / 0 / 0 |
| unit/lagAttack | 323 | 83% | 44 / 105 / 168 / 6 / 0 / 0 |
| unit/equip | 271 | 80% | 34 / 68 / 138 / 31 / 0 / 0 |
| unit/defeat | 247 | 61% | 41 / 41 / 110 / 53 / 2 / 0 |
| mode/mode | 206 | 100% | 0 / 0 / 206 / 0 / 0 / 0 |
| card/playFromTrash | 185 | 66% | 90 / 59 / 35 / 1 / 0 / 0 |
| card/freePlay | 148 | 80% | 0 / 58 / 84 / 6 / 0 / 0 |
| unit/pump | 69 | 72% | 37 / 17 / 15 / 0 / 0 / 0 |
| unit/sacrifice | 53 | 89% | 34 / 11 / 8 / 0 / 0 / 0 |
| card/discard | 49 | 37% | 4 / 12 / 27 / 6 / 0 / 0 |
| yesno/draw | 40 | 100% | 0 / 40 / 0 / 0 / 0 / 0 |
| card/defeat | 39 | 92% | 32 / 6 / 1 / 0 / 0 / 0 |
| mode/foolOnTheHill | 5 | 80% | 0 / 5 / 0 / 0 / 0 / 0 |
| mode/rivalChoice | 2 | 0% | 0 / 2 / 0 / 0 / 0 / 0 |

Reaction windows: 1733 attacks. Reacted to 526 (deck won 34% (30–39) n=372): stole 226, stoleNothing 3, attackerGone 16, targetGone 262, bothGone 18, noneGone 1. Let 1207 resolve (39% (34–43) n=409): stole 821, stoleNothing 12, attackerGone 10, targetGone 324, bothGone 40. Choices: call 307, endReact 1308, block 262, play 8.

## BBG Cunningham Econ — 560 games, 55% won, 28637 decisions

| Card | Use | Uses | Win rate in games used (95%) | Legal turns → used | Not chosen | Early / mid / late uses | Ahead | Even | Behind |
|---|---|---|---|---|---|---|---|---|---|
| Jacked-In Voodoo Boy | attacked | 752 | 59% (53–64) n=345 | 704 → 623 | 12% | 66 / 262 / 424 | 70% (64–76) n=246 | 63% (53–72) n=96 | 37% (30–46) n=131 |
| Jacked-In Voodoo Boy | played | 709 | 57% (52–61) n=455 | 1029 → 655 | 36% | 283 / 214 / 212 | 62% (57–68) n=311 | 49% (41–57) n=146 | 32% (22–43) n=73 |
| Alt Cunningham: Soulkiller Architect | ability | 649 | 49% (45–54) n=396 | 1795 → 639 | 64% | 7 / 150 / 492 | 66% (60–71) n=264 | 37% (27–47) n=82 | 19% (14–26) n=171 |
| Psycho Squad | attacked | 608 | 58% (52–64) n=281 | 640 → 573 | 10% | 58 / 272 / 278 | 69% (62–75) n=174 | 59% (49–69) n=91 | 44% (36–53) n=127 |
| Pepe Najarro: Working Doubles | attacked | 556 | 56% (50–62) n=268 | 603 → 530 | 12% | 66 / 233 / 257 | 67% (59–74) n=160 | 55% (45–65) n=93 | 50% (41–59) n=122 |
| Hanako Arasaka: Daughter of the Emperor | ability | 526 | 44% (39–50) n=344 | 1821 → 526 | 71% | 14 / 136 / 376 | 62% (55–68) n=199 | 34% (25–45) n=85 | 15% (10–22) n=145 |
| Floor It | sold | 503 | 55% (50–60) n=375 | 896 → 503 | 44% | 224 / 118 / 161 | 66% (59–73) n=176 | 48% (40–56) n=149 | 46% (37–55) n=107 |
| Peace Offering | sold | 485 | 54% (49–59) n=365 | 858 → 485 | 43% | 227 / 105 / 153 | 65% (58–71) n=190 | 49% (41–57) n=143 | 38% (28–48) n=88 |
| Chrome Reverie | sold | 475 | 57% (51–62) n=355 | 867 → 475 | 45% | 219 / 128 / 128 | 63% (57–69) n=218 | 52% (43–62) n=105 | 38% (28–49) n=84 |
| Trust No One | sold | 474 | 57% (51–61) n=368 | 841 → 474 | 44% | 205 / 111 / 158 | 65% (58–71) n=179 | 52% (44–60) n=143 | 47% (37–57) n=92 |
| Psycho Squad | played | 458 | 56% (51–61) n=365 | 696 → 452 | 35% | 166 / 145 / 147 | 68% (61–74) n=189 | 48% (40–57) n=132 | 39% (29–50) n=80 |
| Pepe Najarro: Working Doubles | played | 455 | 54% (49–59) n=365 | 740 → 449 | 39% | 169 / 128 / 158 | 65% (58–71) n=203 | 49% (40–57) n=134 | 29% (20–39) n=80 |
| Mox Inciters | played | 438 | 53% (48–58) n=355 | 953 → 418 | 56% | 77 / 205 / 156 | 66% (59–72) n=213 | 42% (33–52) n=100 | 30% (21–41) n=76 |
| Maman Brigitte: Spirit of Death | played | 427 | 55% (49–60) n=355 | 745 → 422 | 43% | 146 / 115 / 166 | 67% (60–73) n=196 | 50% (40–59) n=105 | 32% (24–42) n=96 |
| Hanako Arasaka: Daughter of the Emperor | called | 419 | 55% (50–60) n=419 | 419 → 419 | 0% | 144 / 216 / 59 | 61% (55–66) n=303 | 41% (31–52) n=78 | 37% (23–53) n=38 |

(28 more card uses in the JSON report.)

| Decision type | Decisions | First-listed option taken | Options offered (1 / 2 / 3–5 / 6–10 / 11–20 / 21+) |
|---|---|---|---|
| main | 13843 | 6% | 0 / 1162 / 3442 / 5924 / 3225 / 90 |
| gig/steal | 2478 | 35% | 197 / 548 / 1140 / 585 / 8 / 0 |
| gig/rollIn | 2240 | 100% | 0 / 560 / 1680 / 0 / 0 / 0 |
| react | 1423 | 54% | 0 / 940 / 476 / 7 / 0 / 0 |
| gigValue/adjust | 1391 | 19% | 0 / 36 / 337 / 541 / 411 / 66 |
| unit/bottomdeck | 1157 | 77% | 752 / 203 / 199 / 3 / 0 / 0 |
| card/search | 1022 | 57% | 0 / 229 / 793 / 0 / 0 / 0 |
| card/discard | 914 | 51% | 146 / 329 / 400 / 39 / 0 / 0 |
| mulligan | 560 | 19% | 0 / 560 / 0 / 0 / 0 / 0 |
| gig/swapGive | 526 | 39% | 19 / 38 / 243 / 225 / 1 / 0 |
| gig/swapTake | 526 | 33% | 43 / 49 / 254 / 175 / 5 / 0 |
| card/playFromTrash | 451 | 61% | 182 / 131 / 123 / 15 / 0 / 0 |
| unit/mustAttack | 341 | 67% | 165 / 109 / 67 / 0 / 0 / 0 |
| card/freePlay | 306 | 62% | 0 / 74 / 189 / 40 / 3 / 0 |
| yesno/discardFor | 302 | 100% | 0 / 302 / 0 / 0 / 0 / 0 |
| unit/weaken | 260 | 68% | 88 / 82 / 89 / 1 / 0 / 0 |
| unit/ready | 217 | 100% | 0 / 150 / 67 / 0 / 0 / 0 |
| unit/cantAttack | 187 | 60% | 66 / 62 / 58 / 1 / 0 / 0 |
| gigValue/setGig | 183 | 15% | 0 / 1 / 16 / 23 / 26 / 117 |
| mode/mode | 161 | 91% | 0 / 15 / 146 / 0 / 0 / 0 |
| unit/call | 73 | 100% | 0 / 38 / 35 / 0 / 0 / 0 |
| unit/sacrifice | 54 | 89% | 44 / 6 / 4 / 0 / 0 / 0 |
| yesno/draw | 13 | 100% | 0 / 13 / 0 / 0 / 0 / 0 |
| card/discardForNothing | 4 | 0% | 0 / 3 / 1 / 0 / 0 / 0 |
| mode/foolOnTheHill | 4 | 75% | 0 / 4 / 0 / 0 / 0 / 0 |
| mode/rivalChoice | 1 | 100% | 0 / 1 / 0 / 0 / 0 / 0 |

Reaction windows: 1252 attacks. Reacted to 571 (deck won 50% (45–55) n=395): stole 213, stoleNothing 1, attackerGone 9, targetGone 331, bothGone 17. Let 681 resolve (49% (44–55) n=305): stole 465, stoleNothing 3, attackerGone 2, targetGone 175, bothGone 36. Choices: block 280, call 305, endReact 766, play 72.

## BBG Draw and Wipe — 560 games, 55% won, 29844 decisions

| Card | Use | Uses | Win rate in games used (95%) | Legal turns → used | Not chosen | Early / mid / late uses | Ahead | Even | Behind |
|---|---|---|---|---|---|---|---|---|---|
| Jacked-In Voodoo Boy | attacked | 824 | 55% (50–60) n=372 | 773 → 695 | 10% | 130 / 327 / 367 | 69% (63–74) n=240 | 52% (44–61) n=130 | 32% (26–40) n=164 |
| Jacked-In Voodoo Boy | played | 823 | 56% (51–60) n=490 | 1159 → 754 | 35% | 383 / 225 / 215 | 68% (62–73) n=295 | 42% (35–49) n=201 | 24% (17–33) n=105 |
| Maman Brigitte: Spirit of Death | played | 644 | 56% (51–61) n=438 | 1150 → 639 | 44% | 212 / 225 / 207 | 68% (62–73) n=250 | 52% (44–60) n=149 | 37% (29–45) n=131 |
| Maman Brigitte: Spirit of Death | attacked | 616 | 59% (54–64) n=336 | 717 → 573 | 20% | 0 / 278 / 338 | 78% (72–84) n=176 | 69% (60–77) n=104 | 42% (34–50) n=158 |
| Peace Offering | sold | 608 | 54% (49–59) n=405 | 891 → 608 | 32% | 288 / 154 / 166 | 68% (61–74) n=201 | 45% (38–53) n=159 | 37% (29–46) n=123 |
| Delamain: Rideshare AI | played | 595 | 51% (46–55) n=415 | 1520 → 549 | 64% | 151 / 235 / 209 | 62% (55–68) n=233 | 45% (37–54) n=133 | 21% (15–29) n=122 |
| Chrome Reverie | sold | 527 | 57% (52–62) n=393 | 848 → 527 | 38% | 268 / 107 / 152 | 70% (63–76) n=204 | 50% (42–58) n=147 | 41% (32–50) n=106 |
| Lizzy Wizzy: Delicate Weapon | played | 526 | 55% (50–60) n=383 | 1595 → 517 | 68% | 29 / 240 / 257 | 69% (62–75) n=203 | 52% (42–61) n=95 | 36% (29–44) n=158 |
| Trust No One | sold | 517 | 54% (49–59) n=384 | 823 → 517 | 37% | 201 / 131 / 185 | 66% (59–73) n=178 | 53% (45–61) n=138 | 30% (22–38) n=124 |
| Nocturne OP55 N1 | sold | 471 | 53% (47–58) n=365 | 1114 → 471 | 58% | 151 / 148 / 172 | 67% (60–74) n=180 | 57% (47–66) n=102 | 27% (20–35) n=135 |
| Judy Álvarez: Braindance Maestro | ability | 465 | 54% (48–59) n=325 | 1772 → 465 | 74% | 21 / 145 / 299 | 73% (66–78) n=205 | 50% (38–62) n=64 | 16% (10–24) n=119 |
| Jackie Welles: Pour One Out For Me | called | 457 | 56% (52–61) n=457 | 457 → 457 | 0% | 167 / 237 / 53 | 68% (62–74) n=265 | 44% (36–53) n=140 | 29% (18–42) n=52 |
| Placide: Voodoo Sentinel | played | 453 | 52% (47–57) n=378 | 561 → 453 | 19% | 0 / 0 / 453 | 77% (70–83) n=152 | 66% (53–77) n=59 | 30% (24–37) n=201 |
| Judy Álvarez: Braindance Maestro | called | 436 | 58% (53–62) n=436 | 436 → 436 | 0% | 161 / 223 / 52 | 67% (61–72) n=259 | 50% (41–58) n=121 | 32% (21–45) n=56 |
| Hanako Arasaka: Daughter of the Emperor | called | 435 | 54% (49–58) n=435 | 435 → 435 | 0% | 139 / 237 / 59 | 64% (58–70) n=253 | 40% (32–49) n=119 | 37% (26–49) n=63 |

(24 more card uses in the JSON report.)

| Decision type | Decisions | First-listed option taken | Options offered (1 / 2 / 3–5 / 6–10 / 11–20 / 21+) |
|---|---|---|---|
| main | 14088 | 9% | 0 / 1125 / 3451 / 5684 / 3620 / 208 |
| gig/rollIn | 2240 | 100% | 0 / 560 / 1680 / 0 / 0 / 0 |
| gig/steal | 2180 | 34% | 198 / 353 / 913 / 708 / 8 / 0 |
| gigValue/adjust | 1677 | 28% | 0 / 52 / 594 / 679 / 305 / 47 |
| card/discard | 1393 | 49% | 159 / 475 / 662 / 96 / 1 / 0 |
| unit/bottomdeck | 1387 | 72% | 804 / 298 / 280 / 5 / 0 / 0 |
| card/search | 1183 | 57% | 0 / 264 / 919 / 0 / 0 / 0 |
| unit/pump | 968 | 52% | 190 / 293 / 457 / 28 / 0 / 0 |
| react | 820 | 56% | 0 / 649 / 171 / 0 / 0 / 0 |
| gig/swapGive | 607 | 34% | 18 / 41 / 331 / 216 / 1 / 0 |
| gig/swapTake | 570 | 38% | 66 / 95 / 263 / 144 / 2 / 0 |
| mulligan | 560 | 41% | 0 / 560 / 0 / 0 / 0 / 0 |
| card/freePlay | 497 | 57% | 0 / 130 / 304 / 63 / 0 / 0 |
| yesno/discardFor | 430 | 100% | 0 / 430 / 0 / 0 / 0 / 0 |
| yesno/addToHand | 298 | 100% | 0 / 298 / 0 / 0 / 0 / 0 |
| unit/weaken | 178 | 73% | 92 / 55 / 31 / 0 / 0 / 0 |
| mode/mode | 175 | 91% | 0 / 17 / 158 / 0 / 0 / 0 |
| unit/cantAttack | 169 | 59% | 66 / 56 / 47 / 0 / 0 / 0 |
| gigValue/setGig | 152 | 20% | 0 / 2 / 10 / 15 / 19 / 106 |
| unit/spend | 101 | 69% | 47 / 39 / 15 / 0 / 0 / 0 |
| unit/call | 70 | 100% | 0 / 29 / 41 / 0 / 0 / 0 |
| unit/sacrifice | 40 | 98% | 29 / 8 / 2 / 1 / 0 / 0 |
| card/discardForNothing | 39 | 0% | 0 / 5 / 30 / 4 / 0 / 0 |
| yesno/draw | 16 | 100% | 0 / 16 / 0 / 0 / 0 / 0 |
| mode/foolOnTheHill | 6 | 50% | 0 / 6 / 0 / 0 / 0 / 0 |

Reaction windows: 781 attacks. Reacted to 340 (deck won 46% (41–52) n=276): stole 135, targetGone 195, bothGone 10. Let 441 resolve (45% (38–51) n=228): stole 293, attackerGone 1, targetGone 140, bothGone 7. Choices: endReact 458, block 180, call 182.

## Discord 5k #1: Smasher / River / Reyes (RYY) — 560 games, 48% won, 26289 decisions

| Card | Use | Uses | Win rate in games used (95%) | Legal turns → used | Not chosen | Early / mid / late uses | Ahead | Even | Behind |
|---|---|---|---|---|---|---|---|---|---|
| Johnny Silverhand: Never Stop Fighting | attacked | 825 | 61% (55–66) n=284 | 592 → 537 | 9% | 0 / 188 / 637 | 76% (69–82) n=178 | 73% (61–82) n=70 | 46% (38–54) n=154 |
| Muamar Reyes: El Capitán | ability | 590 | 42% (37–47) n=362 | 1684 → 590 | 65% | 44 / 98 / 448 | 57% (51–64) n=225 | 28% (20–38) n=90 | 11% (7–17) n=147 |
| Meredith Stout: Stone Cold Corpo | played | 561 | 46% (41–51) n=418 | 1029 → 548 | 47% | 162 / 210 / 189 | 57% (50–63) n=212 | 34% (27–42) n=142 | 34% (26–43) n=123 |
| Safety Override | sold | 505 | 48% (43–53) n=393 | 928 → 505 | 46% | 224 / 163 / 118 | 59% (52–66) n=194 | 39% (31–47) n=148 | 42% (33–51) n=103 |
| Johnny Silverhand: Never Stop Fighting | played | 503 | 52% (47–57) n=381 | 862 → 503 | 42% | 0 / 298 / 205 | 66% (59–72) n=200 | 42% (32–53) n=78 | 41% (34–49) n=156 |
| Secondhand Bombus | played | 488 | 46% (41–51) n=359 | 1458 → 463 | 68% | 80 / 220 / 188 | 56% (50–63) n=236 | 35% (25–46) n=72 | 26% (19–36) n=95 |
| Adam Smasher: Ender of Legends | called | 458 | 48% (43–52) n=458 | 458 → 458 | 0% | 181 / 151 / 126 | 58% (52–63) n=283 | 37% (28–46) n=109 | 23% (14–34) n=66 |
| Zetatech Faceplate | sold | 453 | 48% (42–53) n=355 | 1206 → 453 | 62% | 90 / 222 / 141 | 62% (55–69) n=176 | 35% (27–45) n=96 | 36% (28–45) n=117 |
| Dexter DeShawn: One Last Chance | attacked | 445 | 54% (48–61) n=225 | 586 → 424 | 28% | 52 / 191 / 202 | 66% (57–73) n=119 | 52% (41–62) n=87 | 46% (37–56) n=108 |
| Muamar Reyes: El Capitán | called | 426 | 48% (43–53) n=426 | 426 → 426 | 0% | 179 / 156 / 91 | 60% (54–65) n=266 | 30% (21–40) n=94 | 27% (18–39) n=66 |
| Meredith Stout: Stone Cold Corpo | attacked | 423 | 46% (39–52) n=239 | 688 → 401 | 42% | 35 / 133 / 255 | 62% (54–70) n=138 | 40% (29–52) n=70 | 23% (16–33) n=90 |
| River Ward: Detective on the Hunt | called | 416 | 47% (42–51) n=416 | 416 → 416 | 0% | 174 / 150 / 92 | 54% (48–60) n=270 | 36% (27–47) n=91 | 25% (16–38) n=55 |
| Mantis Blades | sold | 394 | 48% (43–54) n=311 | 682 → 394 | 42% | 210 / 92 / 92 | 58% (51–65) n=177 | 40% (31–50) n=100 | 25% (16–37) n=60 |
| Sketchy Ripper | played | 389 | 47% (41–52) n=323 | 673 → 377 | 44% | 210 / 84 / 95 | 60% (53–67) n=185 | 30% (22–39) n=109 | 23% (13–37) n=48 |
| River Ward: Detective on the Hunt | ability | 384 | 41% (36–47) n=276 | 1673 → 384 | 77% | 18 / 98 / 268 | 59% (51–66) n=158 | 28% (18–41) n=54 | 20% (14–28) n=116 |

(34 more card uses in the JSON report.)

| Decision type | Decisions | First-listed option taken | Options offered (1 / 2 / 3–5 / 6–10 / 11–20 / 21+) |
|---|---|---|---|
| main | 14144 | 10% | 0 / 1077 / 3644 / 6412 / 2962 / 49 |
| gig/steal | 2361 | 36% | 190 / 437 / 1066 / 653 / 15 / 0 |
| gig/rollIn | 2240 | 0% | 0 / 560 / 1680 / 0 / 0 / 0 |
| react | 2120 | 66% | 0 / 1135 / 977 / 8 / 0 / 0 |
| gigValue/adjust | 1637 | 24% | 0 / 1 / 123 / 277 / 940 / 296 |
| unit/equip | 970 | 77% | 205 / 239 / 457 / 69 / 0 / 0 |
| mulligan | 560 | 17% | 0 / 560 / 0 / 0 / 0 / 0 |
| mode/muamarCall | 514 | 66% | 0 / 514 / 0 / 0 / 0 / 0 |
| unit/defeat | 383 | 54% | 121 / 73 / 179 / 10 / 0 / 0 |
| unit/protect | 362 | 46% | 98 / 145 / 118 / 1 / 0 / 0 |
| card/search | 310 | 80% | 0 / 168 / 134 / 6 / 2 / 0 |
| card/trash | 236 | 48% | 0 / 236 / 0 / 0 / 0 / 0 |
| card/playFree | 207 | 95% | 175 / 29 / 3 / 0 / 0 / 0 |
| unit/sacrifice | 205 | 60% | 87 / 76 / 42 / 0 / 0 / 0 |
| card/discard | 30 | 77% | 10 / 8 / 12 / 0 / 0 / 0 |
| yesno/draw | 8 | 100% | 0 / 8 / 0 / 0 / 0 / 0 |
| mode/foolOnTheHill | 1 | 100% | 0 / 1 / 0 / 0 / 0 / 0 |
| mode/rivalChoice | 1 | 0% | 0 / 1 / 0 / 0 / 0 / 0 |

Reaction windows: 1797 attacks. Reacted to 580 (deck won 40% (35–45) n=371): stole 156, attackerGone 21, targetGone 307, bothGone 54, noneGone 42. Let 1217 resolve (42% (38–47) n=425): stole 923, stoleNothing 11, attackerGone 5, targetGone 238, bothGone 39, noneGone 1. Choices: endReact 1399, block 378, call 247, play 41, ability 55.

## Discord 5k #2: Jackie / Alt / Hanako (BBG) — 560 games, 54% won, 28574 decisions

| Card | Use | Uses | Win rate in games used (95%) | Legal turns → used | Not chosen | Early / mid / late uses | Ahead | Even | Behind |
|---|---|---|---|---|---|---|---|---|---|
| Pepe Najarro: Working Doubles | attacked | 982 | 57% (52–62) n=369 | 983 → 855 | 13% | 107 / 400 / 475 | 72% (66–78) n=246 | 56% (48–64) n=147 | 39% (32–47) n=165 |
| Alt Cunningham: Soulkiller Architect | ability | 849 | 48% (44–53) n=454 | 1741 → 827 | 52% | 7 / 183 / 659 | 62% (56–67) n=320 | 40% (30–50) n=91 | 9% (5–13) n=199 |
| Jacked-In Voodoo Boy | attacked | 837 | 57% (52–62) n=368 | 805 → 696 | 14% | 75 / 293 / 469 | 70% (64–75) n=267 | 60% (50–69) n=92 | 28% (21–36) n=127 |
| Jacked-In Voodoo Boy | played | 792 | 54% (49–58) n=471 | 1071 → 728 | 32% | 306 / 223 / 263 | 62% (56–67) n=333 | 45% (37–53) n=151 | 29% (21–40) n=85 |
| Pepe Najarro: Working Doubles | played | 735 | 54% (49–58) n=456 | 1012 → 721 | 29% | 266 / 220 / 249 | 64% (58–69) n=270 | 51% (43–58) n=186 | 24% (17–32) n=110 |
| Maman Brigitte: Spirit of Death | played | 701 | 54% (49–58) n=456 | 947 → 695 | 27% | 215 / 200 / 286 | 65% (59–70) n=280 | 50% (42–57) n=169 | 27% (20–36) n=118 |
| Maman Brigitte: Spirit of Death | attacked | 657 | 58% (53–63) n=358 | 735 → 600 | 18% | 0 / 303 / 354 | 73% (67–78) n=228 | 61% (52–70) n=111 | 29% (22–38) n=121 |
| Hanako Arasaka: Daughter of the Emperor | ability | 584 | 39% (34–44) n=342 | 1674 → 584 | 65% | 6 / 130 / 448 | 51% (44–57) n=221 | 32% (22–44) n=66 | 9% (6–15) n=163 |
| Floor It | sold | 459 | 50% (45–56) n=347 | 912 → 459 | 50% | 183 / 131 / 145 | 64% (56–70) n=181 | 50% (42–59) n=129 | 25% (17–35) n=84 |
| Riot Shield | sold | 447 | 51% (45–56) n=366 | 514 → 447 | 13% | 219 / 89 / 139 | 60% (53–67) n=200 | 50% (41–58) n=135 | 24% (15–35) n=72 |
| Jackie Welles: Pour One Out For Me | called | 429 | 56% (51–61) n=429 | 429 → 429 | 0% | 150 / 205 / 74 | 61% (55–66) n=305 | 51% (41–61) n=88 | 31% (18–47) n=36 |
| Les Élémens | played | 423 | 59% (54–64) n=329 | 940 → 419 | 55% | 91 / 175 / 157 | 70% (63–76) n=194 | 57% (47–66) n=99 | 37% (27–49) n=70 |
| Hanako Arasaka: Daughter of the Emperor | called | 421 | 56% (51–60) n=421 | 421 → 421 | 0% | 124 / 223 / 74 | 65% (59–70) n=294 | 40% (30–51) n=82 | 22% (13–36) n=45 |
| Peace Offering | sold | 411 | 51% (46–57) n=323 | 856 → 411 | 52% | 203 / 85 / 123 | 64% (56–71) n=159 | 49% (41–58) n=130 | 28% (19–39) n=72 |
| Alt Cunningham: Soulkiller Architect | called | 410 | 55% (50–60) n=410 | 410 → 410 | 0% | 142 / 212 / 56 | 64% (58–69) n=293 | 38% (28–49) n=84 | 18% (9–34) n=33 |

(28 more card uses in the JSON report.)

| Decision type | Decisions | First-listed option taken | Options offered (1 / 2 / 3–5 / 6–10 / 11–20 / 21+) |
|---|---|---|---|
| main | 14161 | 7% | 0 / 1016 / 3478 / 6133 / 3419 / 115 |
| gig/steal | 2345 | 40% | 259 / 580 / 1083 / 421 / 2 / 0 |
| gig/rollIn | 2240 | 100% | 0 / 560 / 1680 / 0 / 0 / 0 |
| unit/bottomdeck | 1158 | 84% | 875 / 192 / 90 / 1 / 0 / 0 |
| card/search | 1039 | 58% | 0 / 238 / 801 / 0 / 0 / 0 |
| card/discard | 1035 | 43% | 157 / 313 / 533 / 32 / 0 / 0 |
| react | 980 | 48% | 0 / 564 / 410 / 6 / 0 / 0 |
| gigValue/adjust | 959 | 24% | 0 / 30 / 218 / 346 / 292 / 73 |
| card/playFromTrash | 670 | 53% | 201 / 177 / 255 / 37 / 0 / 0 |
| gig/swapGive | 584 | 35% | 18 / 32 / 268 / 265 / 1 / 0 |
| gig/swapTake | 584 | 29% | 33 / 68 / 274 / 202 / 7 / 0 |
| mulligan | 560 | 30% | 0 / 560 / 0 / 0 / 0 / 0 |
| yesno/discardFor | 512 | 99% | 0 / 512 / 0 / 0 / 0 / 0 |
| unit/ready | 319 | 100% | 0 / 214 / 105 / 0 / 0 / 0 |
| mode/mode | 300 | 90% | 0 / 30 / 270 / 0 / 0 / 0 |
| unit/weaken | 286 | 71% | 93 / 99 / 91 / 3 / 0 / 0 |
| gigValue/setGig | 257 | 11% | 0 / 3 / 10 / 20 / 36 / 188 |
| unit/adrenaline | 182 | 66% | 80 / 65 / 36 / 1 / 0 / 0 |
| unit/cantAttack | 155 | 58% | 58 / 57 / 39 / 1 / 0 / 0 |
| unit/stealMod | 118 | 64% | 26 / 43 / 48 / 1 / 0 / 0 |
| unit/sacrifice | 55 | 89% | 41 / 8 / 5 / 1 / 0 / 0 |
| unit/call | 41 | 100% | 0 / 16 / 25 / 0 / 0 / 0 |
| unit/equip | 28 | 79% | 1 / 1 / 16 / 10 / 0 / 0 |
| yesno/draw | 5 | 100% | 0 / 5 / 0 / 0 / 0 / 0 |
| mode/foolOnTheHill | 1 | 100% | 0 / 1 / 0 / 0 / 0 / 0 |

Reaction windows: 891 attacks. Reacted to 455 (deck won 46% (41–51) n=345): stole 259, stoleNothing 93, attackerGone 2, targetGone 93, bothGone 8. Let 436 resolve (42% (36–49) n=217): stole 324, stoleNothing 1, targetGone 107, bothGone 4. Choices: call 306, endReact 466, play 203, block 5.

## Discord 5k #3: Smasher / River / Viktor (RYY) — 560 games, 55% won, 26558 decisions

| Card | Use | Uses | Win rate in games used (95%) | Legal turns → used | Not chosen | Early / mid / late uses | Ahead | Even | Behind |
|---|---|---|---|---|---|---|---|---|---|
| Johnny Silverhand: Never Stop Fighting | attacked | 755 | 70% (64–75) n=274 | 536 → 500 | 7% | 0 / 130 / 625 | 87% (80–91) n=157 | 85% (75–92) n=62 | 57% (49–65) n=152 |
| Meredith Stout: Stone Cold Corpo | played | 583 | 55% (50–60) n=423 | 1152 → 576 | 50% | 195 / 199 / 189 | 68% (61–74) n=210 | 44% (37–52) n=165 | 43% (35–52) n=132 |
| MaxTac Suppression Team | attacked | 518 | 61% (54–67) n=218 | 567 → 492 | 13% | 0 / 233 / 285 | 75% (67–81) n=140 | 67% (55–77) n=66 | 48% (39–57) n=117 |
| Zetatech Faceplate | sold | 484 | 60% (55–65) n=360 | 1435 → 484 | 66% | 84 / 200 / 200 | 68% (61–75) n=186 | 57% (47–67) n=89 | 51% (43–59) n=140 |
| Johnny Silverhand: Never Stop Fighting | played | 463 | 61% (56–66) n=376 | 1006 → 463 | 54% | 0 / 248 / 215 | 72% (65–78) n=184 | 61% (50–72) n=70 | 50% (42–57) n=167 |
| Meredith Stout: Stone Cold Corpo | attacked | 458 | 57% (51–64) n=232 | 745 → 426 | 43% | 53 / 149 / 256 | 73% (65–79) n=143 | 49% (39–60) n=83 | 46% (36–56) n=90 |
| Mantis Blades | sold | 435 | 54% (48–59) n=339 | 741 → 435 | 41% | 235 / 84 / 116 | 65% (57–72) n=164 | 47% (39–55) n=130 | 40% (30–50) n=88 |
| Adam Smasher: Ender of Legends | called | 433 | 55% (50–59) n=433 | 433 → 433 | 0% | 184 / 131 / 118 | 64% (58–69) n=261 | 42% (33–52) n=98 | 39% (29–51) n=74 |
| River Ward: Detective on the Hunt | called | 428 | 54% (49–59) n=428 | 434 → 428 | 1% | 169 / 161 / 98 | 67% (61–72) n=266 | 37% (28–47) n=95 | 30% (20–42) n=67 |
| Arasaka Emergency Radioport | sold | 426 | 52% (47–57) n=345 | 869 → 426 | 51% | 141 / 134 / 151 | 68% (60–75) n=156 | 51% (42–61) n=105 | 30% (23–39) n=126 |
| Adam Smasher: Ender of Legends | attacked | 425 | 53% (47–58) n=318 | 459 → 425 | 7% | 0 / 0 / 425 | 87% (81–92) n=141 | 69% (55–79) n=54 | 26% (20–33) n=175 |
| Mandibular Upgrade | sold | 425 | 54% (49–60) n=347 | 476 → 425 | 11% | 209 / 94 / 122 | 69% (61–75) n=166 | 43% (35–52) n=122 | 41% (31–52) n=85 |
| Viktor Vektor: Sit Down and Relax | called | 400 | 54% (49–59) n=400 | 411 → 400 | 3% | 155 / 140 / 105 | 66% (60–71) n=242 | 37% (27–48) n=76 | 35% (26–46) n=82 |
| Sketchy Ripper | played | 382 | 54% (48–59) n=318 | 646 → 373 | 42% | 223 / 73 / 86 | 68% (61–75) n=177 | 41% (33–50) n=114 | 27% (17–41) n=51 |
| Sketchy Ripper | attacked | 382 | 58% (51–64) n=215 | 616 → 363 | 41% | 95 / 147 / 140 | 71% (62–78) n=136 | 55% (41–67) n=53 | 42% (32–52) n=84 |

(38 more card uses in the JSON report.)

| Decision type | Decisions | First-listed option taken | Options offered (1 / 2 / 3–5 / 6–10 / 11–20 / 21+) |
|---|---|---|---|
| main | 14157 | 9% | 0 / 1119 / 3676 / 6253 / 3031 / 78 |
| gig/steal | 2708 | 36% | 230 / 468 / 1143 / 857 / 10 / 0 |
| gig/rollIn | 2240 | 0% | 0 / 560 / 1680 / 0 / 0 / 0 |
| react | 1913 | 63% | 0 / 1074 / 821 / 18 / 0 / 0 |
| unit/equip | 1365 | 71% | 229 / 252 / 737 / 147 / 0 / 0 |
| card/search | 1187 | 70% | 0 / 495 / 680 / 12 / 0 / 0 |
| gigValue/adjust | 861 | 26% | 0 / 0 / 77 / 156 / 451 / 177 |
| mulligan | 560 | 23% | 0 / 560 / 0 / 0 / 0 / 0 |
| unit/defeat | 412 | 43% | 85 / 82 / 223 / 22 / 0 / 0 |
| card/playFree | 308 | 84% | 162 / 100 / 45 / 1 / 0 / 0 |
| card/trash | 302 | 49% | 0 / 302 / 0 / 0 / 0 / 0 |
| card/defeatGear | 194 | 18% | 0 / 103 / 87 / 4 / 0 / 0 |
| unit/sacrifice | 161 | 63% | 65 / 54 / 42 / 0 / 0 / 0 |
| card/discard | 55 | 35% | 7 / 12 / 34 / 2 / 0 / 0 |
| yesno/draw | 46 | 100% | 0 / 46 / 0 / 0 / 0 / 0 |
| unit/call | 41 | 100% | 0 / 10 / 31 / 0 / 0 / 0 |
| unit/protect | 29 | 72% | 11 / 14 / 4 / 0 / 0 / 0 |
| yesno/call | 12 | 100% | 0 / 12 / 0 / 0 / 0 / 0 |
| mode/foolOnTheHill | 6 | 83% | 0 / 6 / 0 / 0 / 0 / 0 |
| mode/rivalChoice | 1 | 0% | 0 / 1 / 0 / 0 / 0 / 0 |

Reaction windows: 1628 attacks. Reacted to 563 (deck won 50% (45–55) n=377): stole 197, attackerGone 27, targetGone 291, bothGone 46, noneGone 2. Let 1065 resolve (55% (50–59) n=407): stole 815, stoleNothing 12, attackerGone 15, targetGone 191, bothGone 32. Choices: endReact 1213, block 318, call 244, ability 109, play 29.

## Discord 5k #4: Jackie / Alt / Hanako (BBG) — 560 games, 54% won, 28655 decisions

| Card | Use | Uses | Win rate in games used (95%) | Legal turns → used | Not chosen | Early / mid / late uses | Ahead | Even | Behind |
|---|---|---|---|---|---|---|---|---|---|
| Pepe Najarro: Working Doubles | attacked | 989 | 58% (53–62) n=404 | 1029 → 891 | 13% | 109 / 434 / 446 | 71% (66–76) n=275 | 60% (53–67) n=171 | 41% (34–48) n=178 |
| Alt Cunningham: Soulkiller Architect | ability | 870 | 50% (45–54) n=469 | 1721 → 847 | 51% | 9 / 184 / 677 | 66% (61–71) n=314 | 40% (31–51) n=94 | 15% (11–20) n=222 |
| Jacked-In Voodoo Boy | attacked | 786 | 58% (53–63) n=364 | 757 → 665 | 12% | 74 / 260 / 452 | 69% (64–75) n=261 | 55% (45–65) n=98 | 35% (27–44) n=128 |
| Pepe Najarro: Working Doubles | played | 772 | 54% (50–59) n=478 | 1061 → 757 | 29% | 271 / 251 / 250 | 66% (60–71) n=279 | 50% (43–57) n=200 | 27% (20–35) n=119 |
| Jacked-In Voodoo Boy | played | 758 | 56% (52–61) n=467 | 1027 → 702 | 32% | 304 / 226 / 228 | 65% (60–70) n=335 | 45% (37–54) n=141 | 22% (14–32) n=74 |
| Maman Brigitte: Spirit of Death | played | 653 | 58% (53–62) n=440 | 940 → 648 | 31% | 194 / 205 / 254 | 70% (64–75) n=274 | 54% (46–62) n=143 | 34% (26–43) n=123 |
| Maman Brigitte: Spirit of Death | attacked | 640 | 63% (58–68) n=342 | 712 → 588 | 17% | 0 / 253 / 387 | 78% (72–83) n=229 | 67% (57–76) n=92 | 37% (29–46) n=116 |
| Hanako Arasaka: Daughter of the Emperor | ability | 583 | 41% (36–47) n=355 | 1745 → 583 | 67% | 11 / 151 / 421 | 57% (51–63) n=229 | 29% (20–41) n=69 | 7% (4–12) n=163 |
| Peace Offering | sold | 431 | 56% (50–61) n=339 | 884 → 431 | 51% | 208 / 115 / 108 | 65% (59–72) n=194 | 52% (43–61) n=117 | 29% (20–40) n=73 |
| Riot Shield | sold | 431 | 55% (50–60) n=337 | 496 → 431 | 13% | 213 / 81 / 137 | 65% (58–71) n=189 | 50% (41–59) n=120 | 26% (17–37) n=74 |
| Alt Cunningham: Soulkiller Architect | called | 425 | 56% (51–61) n=425 | 425 → 425 | 0% | 127 / 221 / 77 | 64% (58–69) n=293 | 44% (34–55) n=84 | 29% (18–43) n=48 |
| Jackie Welles: Pour One Out For Me | called | 418 | 56% (51–61) n=418 | 418 → 418 | 0% | 134 / 209 / 75 | 62% (57–68) n=311 | 45% (35–57) n=77 | 20% (10–37) n=30 |
| Trust No One | sold | 416 | 51% (46–57) n=317 | 826 → 416 | 50% | 151 / 115 / 150 | 64% (57–71) n=168 | 53% (44–61) n=116 | 27% (19–38) n=84 |
| Les Élémens | played | 416 | 58% (52–63) n=323 | 947 → 410 | 57% | 107 / 153 / 156 | 73% (66–79) n=179 | 52% (42–62) n=94 | 35% (26–45) n=91 |
| Hanako Arasaka: Daughter of the Emperor | called | 411 | 57% (52–62) n=411 | 411 → 411 | 0% | 142 / 209 / 60 | 66% (61–71) n=298 | 39% (29–51) n=76 | 19% (9–34) n=37 |

(30 more card uses in the JSON report.)

| Decision type | Decisions | First-listed option taken | Options offered (1 / 2 / 3–5 / 6–10 / 11–20 / 21+) |
|---|---|---|---|
| main | 14116 | 7% | 0 / 1005 / 3585 / 6045 / 3369 / 112 |
| gig/steal | 2297 | 40% | 219 / 564 / 1079 / 427 / 8 / 0 |
| gig/rollIn | 2240 | 100% | 0 / 560 / 1680 / 0 / 0 / 0 |
| card/search | 1174 | 58% | 0 / 270 / 904 / 0 / 0 / 0 |
| unit/bottomdeck | 1152 | 84% | 874 / 170 / 107 / 1 / 0 / 0 |
| gigValue/adjust | 1021 | 23% | 0 / 29 / 228 / 361 / 336 / 67 |
| card/discard | 993 | 46% | 158 / 313 / 476 / 45 / 1 / 0 |
| react | 978 | 50% | 0 / 585 / 389 / 4 / 0 / 0 |
| card/playFromTrash | 693 | 54% | 198 / 184 / 272 / 38 / 1 / 0 |
| gig/swapGive | 583 | 35% | 16 / 31 / 287 / 249 / 0 / 0 |
| gig/swapTake | 583 | 35% | 38 / 86 / 251 / 202 / 6 / 0 |
| mulligan | 560 | 27% | 0 / 560 / 0 / 0 / 0 / 0 |
| yesno/discardFor | 489 | 99% | 0 / 489 / 0 / 0 / 0 / 0 |
| unit/ready | 339 | 100% | 0 / 230 / 109 / 0 / 0 / 0 |
| mode/mode | 260 | 91% | 0 / 23 / 237 / 0 / 0 / 0 |
| gigValue/setGig | 249 | 13% | 0 / 2 / 8 / 22 / 47 / 170 |
| unit/weaken | 229 | 73% | 91 / 80 / 55 / 3 / 0 / 0 |
| unit/adrenaline | 181 | 68% | 89 / 54 / 38 / 0 / 0 / 0 |
| unit/cantAttack | 175 | 61% | 60 / 62 / 53 / 0 / 0 / 0 |
| unit/stealMod | 133 | 62% | 22 / 52 / 59 / 0 / 0 / 0 |
| unit/equip | 94 | 76% | 12 / 6 / 60 / 16 / 0 / 0 |
| unit/call | 56 | 100% | 0 / 19 / 37 / 0 / 0 / 0 |
| unit/sacrifice | 49 | 94% | 40 / 7 / 2 / 0 / 0 / 0 |
| mode/foolOnTheHill | 6 | 50% | 0 / 6 / 0 / 0 / 0 / 0 |
| yesno/draw | 4 | 100% | 0 / 4 / 0 / 0 / 0 / 0 |
| mode/rivalChoice | 1 | 0% | 0 / 1 / 0 / 0 / 0 / 0 |

Reaction windows: 903 attacks. Reacted to 445 (deck won 46% (41–51) n=336): stole 256, stoleNothing 98, attackerGone 1, targetGone 82, bothGone 8. Let 458 resolve (41% (35–48) n=226): stole 332, stoleNothing 1, targetGone 118, bothGone 7. Choices: endReact 487, play 177, call 309, block 5.

## Discord 5k #5: V / Smasher / Padre (RRG) — 560 games, 58% won, 26448 decisions

| Card | Use | Uses | Win rate in games used (95%) | Legal turns → used | Not chosen | Early / mid / late uses | Ahead | Even | Behind |
|---|---|---|---|---|---|---|---|---|---|
| Pepe Najarro: Working Doubles | attacked | 760 | 63% (58–68) n=347 | 892 → 706 | 21% | 70 / 307 / 383 | 80% (74–86) n=174 | 62% (53–71) n=111 | 58% (51–64) n=206 |
| 6th Street Recruits | attacked | 738 | 61% (55–66) n=330 | 901 → 674 | 25% | 71 / 296 / 371 | 77% (70–83) n=161 | 67% (58–75) n=106 | 57% (50–63) n=217 |
| Animals Wrecker | attacked | 542 | 70% (64–75) n=236 | 524 → 504 | 4% | 0 / 136 / 406 | 87% (79–92) n=101 | 79% (68–88) n=63 | 65% (58–72) n=165 |
| 6th Street Recruits | played | 517 | 57% (52–61) n=389 | 1003 → 508 | 49% | 253 / 126 / 138 | 66% (59–72) n=179 | 56% (48–63) n=166 | 43% (34–52) n=103 |
| Peace Offering | sold | 513 | 54% (49–59) n=380 | 1005 → 513 | 49% | 199 / 185 / 129 | 57% (50–65) n=174 | 51% (42–60) n=119 | 51% (43–59) n=157 |
| V: Streetkid | attacked | 511 | 44% (39–49) n=330 | 618 → 511 | 17% | 74 / 146 / 291 | 55% (48–62) n=194 | 60% (45–73) n=45 | 29% (22–37) n=146 |
| Pepe Najarro: Working Doubles | played | 507 | 61% (56–65) n=383 | 1011 → 501 | 50% | 249 / 119 / 139 | 70% (63–77) n=176 | 54% (46–61) n=163 | 52% (43–62) n=103 |
| Synapse Burnout | sold | 506 | 57% (52–62) n=372 | 733 → 506 | 31% | 287 / 107 / 112 | 60% (53–67) n=189 | 59% (51–67) n=139 | 51% (42–60) n=111 |
| Padre: Man of the Cross | ability | 449 | 47% (42–53) n=305 | 1825 → 449 | 75% | 4 / 80 / 365 | 69% (62–76) n=183 | 26% (17–39) n=57 | 17% (12–24) n=129 |
| Industrial Assembly | sold | 433 | 55% (50–60) n=333 | 926 → 433 | 53% | 123 / 192 / 118 | 67% (59–75) n=126 | 52% (43–61) n=111 | 45% (37–53) n=145 |
| Memory Relapse | sold | 423 | 60% (54–65) n=332 | 1429 → 423 | 70% | 51 / 182 / 190 | 64% (56–72) n=142 | 73% (60–83) n=59 | 51% (44–59) n=164 |
| Mantis Blades | sold | 419 | 57% (51–62) n=338 | 616 → 419 | 32% | 258 / 63 / 98 | 60% (53–68) n=167 | 57% (48–65) n=129 | 49% (38–60) n=80 |
| Adam Smasher: Ender of Legends | called | 415 | 60% (55–64) n=415 | 415 → 415 | 0% | 185 / 132 / 98 | 67% (61–72) n=280 | 53% (41–65) n=66 | 35% (25–47) n=69 |
| Meredith Stout: Stone Cold Corpo | played | 415 | 56% (50–61) n=317 | 1390 → 398 | 71% | 101 / 126 / 188 | 74% (66–81) n=117 | 56% (47–65) n=105 | 43% (35–51) n=136 |
| V: Streetkid | called | 414 | 57% (52–62) n=414 | 414 → 414 | 0% | 198 / 120 / 96 | 60% (54–65) n=278 | 57% (45–69) n=61 | 47% (36–58) n=75 |

(30 more card uses in the JSON report.)

Legal but never taken: V: Streetkid (Legend play, legal in 1036 turns), Adam Smasher: Ender of Legends (Legend play, legal in 262 turns).

| Decision type | Decisions | First-listed option taken | Options offered (1 / 2 / 3–5 / 6–10 / 11–20 / 21+) |
|---|---|---|---|
| main | 14529 | 9% | 0 / 1116 / 3822 / 5212 / 4213 / 166 |
| gig/steal | 3328 | 29% | 185 / 465 / 1473 / 1185 / 20 / 0 |
| gig/rollIn | 2240 | 0% | 0 / 560 / 1680 / 0 / 0 / 0 |
| react | 1438 | 59% | 0 / 954 / 482 / 2 / 0 / 0 |
| unit/defeat | 634 | 63% | 213 / 181 / 228 / 12 / 0 / 0 |
| mulligan | 560 | 14% | 0 / 560 / 0 / 0 / 0 / 0 |
| gigValue/setGig | 556 | 8% | 0 / 0 / 10 / 44 / 149 / 353 |
| card/search | 553 | 59% | 158 / 185 / 173 / 36 / 1 / 0 |
| mode/mode | 522 | 61% | 0 / 522 / 0 / 0 / 0 / 0 |
| unit/spend | 456 | 78% | 268 / 124 / 64 / 0 / 0 / 0 |
| unit/equip | 344 | 86% | 44 / 95 / 170 / 35 / 0 / 0 |
| gigValue/adjust | 339 | 4% | 0 / 9 / 97 / 9 / 37 / 187 |
| card/playFree | 316 | 64% | 0 / 49 / 227 / 40 / 0 / 0 |
| unit/adrenaline | 260 | 70% | 132 / 85 / 43 / 0 / 0 / 0 |
| unit/ready | 222 | 94% | 0 / 181 / 41 / 0 / 0 / 0 |
| unit/sacrifice | 62 | 81% | 37 / 16 / 9 / 0 / 0 / 0 |
| card/discard | 37 | 35% | 5 / 11 / 20 / 1 / 0 / 0 |
| unit/pump | 35 | 69% | 5 / 19 / 11 / 0 / 0 / 0 |
| yesno/draw | 11 | 100% | 0 / 11 / 0 / 0 / 0 / 0 |
| mode/foolOnTheHill | 3 | 33% | 0 / 3 / 0 / 0 / 0 / 0 |
| mode/rivalChoice | 3 | 0% | 0 / 3 / 0 / 0 / 0 / 0 |

Reaction windows: 1315 attacks. Reacted to 532 (deck won 50% (45–55) n=368): stole 262, attackerGone 31, targetGone 210, bothGone 29. Let 783 resolve (58% (53–64) n=317): stole 523, stoleNothing 5, attackerGone 7, targetGone 212, bothGone 36. Choices: endReact 852, call 377, block 176, play 33.

## Discord 5k #6: Jackie / Alt / Hanako (BBG) — 560 games, 48% won, 29131 decisions

| Card | Use | Uses | Win rate in games used (95%) | Legal turns → used | Not chosen | Early / mid / late uses | Ahead | Even | Behind |
|---|---|---|---|---|---|---|---|---|---|
| Pepe Najarro: Working Doubles | attacked | 966 | 53% (49–58) n=389 | 964 → 841 | 13% | 102 / 392 / 472 | 67% (61–73) n=246 | 56% (48–64) n=142 | 40% (33–47) n=179 |
| Jacked-In Voodoo Boy | attacked | 794 | 47% (42–52) n=353 | 745 → 656 | 12% | 79 / 227 / 488 | 58% (52–64) n=236 | 45% (36–55) n=110 | 31% (24–39) n=147 |
| Jacked-In Voodoo Boy | played | 745 | 45% (41–50) n=473 | 1051 → 698 | 34% | 297 / 207 / 241 | 55% (49–60) n=310 | 35% (28–42) n=153 | 23% (15–32) n=93 |
| Alt Cunningham: Soulkiller Architect | ability | 734 | 42% (38–47) n=426 | 1773 → 717 | 60% | 7 / 163 / 564 | 57% (51–62) n=270 | 40% (30–50) n=81 | 11% (7–16) n=210 |
| Pepe Najarro: Working Doubles | played | 700 | 51% (46–55) n=448 | 985 → 687 | 30% | 254 / 248 / 198 | 62% (55–67) n=260 | 44% (38–51) n=194 | 30% (22–39) n=106 |
| Hanako Arasaka: Daughter of the Emperor | ability | 566 | 35% (30–40) n=356 | 1769 → 566 | 68% | 6 / 130 / 430 | 49% (42–55) n=214 | 25% (17–36) n=76 | 9% (6–15) n=162 |
| Peace Offering | sold | 518 | 47% (42–52) n=383 | 848 → 518 | 39% | 273 / 94 / 151 | 55% (48–62) n=202 | 48% (40–56) n=148 | 27% (19–37) n=96 |
| Valentino Street Racer | played | 469 | 47% (42–52) n=373 | 760 → 449 | 41% | 125 / 172 / 172 | 58% (51–64) n=224 | 41% (32–51) n=105 | 22% (14–32) n=79 |
| Trust No One | sold | 451 | 47% (42–53) n=341 | 798 → 451 | 43% | 180 / 116 / 155 | 56% (48–63) n=172 | 49% (41–58) n=132 | 23% (15–33) n=87 |
| Hanako Arasaka: Daughter of the Emperor | called | 442 | 48% (43–52) n=442 | 442 → 442 | 0% | 148 / 221 / 73 | 53% (47–58) n=319 | 40% (30–51) n=85 | 21% (11–36) n=38 |
| Nocturne OP55 N1 | sold | 433 | 45% (40–51) n=316 | 1099 → 433 | 61% | 142 / 159 / 132 | 53% (46–60) n=199 | 48% (37–58) n=86 | 21% (14–31) n=90 |
| Maman Brigitte: Spirit of Death | attacked | 431 | 55% (49–61) n=261 | 518 → 413 | 20% | 0 / 183 / 248 | 69% (61–75) n=162 | 61% (48–72) n=59 | 31% (22–41) n=88 |
| Valentino Street Racer | attacked | 429 | 52% (46–58) n=247 | 539 → 400 | 26% | 27 / 179 / 223 | 66% (59–73) n=157 | 51% (40–63) n=68 | 34% (25–45) n=90 |
| Jackie Welles: Pour One Out For Me | called | 428 | 49% (44–53) n=428 | 428 → 428 | 0% | 176 / 176 / 76 | 54% (48–59) n=312 | 41% (31–52) n=82 | 21% (10–37) n=34 |
| Alt Cunningham: Soulkiller Architect | called | 411 | 48% (43–53) n=411 | 411 → 411 | 0% | 147 / 197 / 67 | 56% (50–61) n=283 | 33% (24–43) n=88 | 25% (14–40) n=40 |

(36 more card uses in the JSON report.)

Legal but never taken: Jacked-In Voodoo Boy (reaction, legal in 14 turns).

| Decision type | Decisions | First-listed option taken | Options offered (1 / 2 / 3–5 / 6–10 / 11–20 / 21+) |
|---|---|---|---|
| main | 14724 | 7% | 0 / 1160 / 3620 / 6374 / 3452 / 118 |
| gig/steal | 2534 | 39% | 242 / 581 / 1123 / 574 / 14 / 0 |
| gig/rollIn | 2240 | 100% | 0 / 560 / 1680 / 0 / 0 / 0 |
| react | 1317 | 55% | 0 / 875 / 435 / 7 / 0 / 0 |
| gigValue/adjust | 1191 | 22% | 0 / 42 / 309 / 432 / 348 / 60 |
| card/search | 980 | 59% | 0 / 224 / 756 / 0 / 0 / 0 |
| unit/bottomdeck | 904 | 87% | 699 / 137 / 68 / 0 / 0 / 0 |
| card/discard | 636 | 47% | 106 / 223 / 289 / 18 / 0 / 0 |
| gig/swapGive | 566 | 36% | 14 / 27 / 282 / 243 / 0 / 0 |
| gig/swapTake | 566 | 31% | 32 / 87 / 239 / 202 / 6 / 0 |
| mulligan | 560 | 19% | 0 / 560 / 0 / 0 / 0 / 0 |
| card/playFromTrash | 504 | 61% | 194 / 152 / 142 / 16 / 0 / 0 |
| unit/ready | 367 | 100% | 0 / 248 / 119 / 0 / 0 / 0 |
| unit/adrenaline | 339 | 60% | 160 / 102 / 77 / 0 / 0 / 0 |
| yesno/discardFor | 308 | 99% | 0 / 308 / 0 / 0 / 0 / 0 |
| unit/mustAttack | 218 | 69% | 95 / 82 / 39 / 2 / 0 / 0 |
| mode/mode | 214 | 91% | 0 / 20 / 194 / 0 / 0 / 0 |
| gigValue/setGig | 210 | 14% | 0 / 0 / 7 / 20 / 29 / 154 |
| unit/weaken | 208 | 67% | 76 / 60 / 69 / 3 / 0 / 0 |
| card/freePlay | 184 | 61% | 0 / 45 / 119 / 20 / 0 / 0 |
| unit/cantAttack | 130 | 53% | 29 / 55 / 44 / 2 / 0 / 0 |
| unit/stealMod | 121 | 73% | 23 / 48 / 50 / 0 / 0 / 0 |
| unit/sacrifice | 52 | 94% | 42 / 8 / 2 / 0 / 0 / 0 |
| unit/call | 31 | 100% | 0 / 12 / 19 / 0 / 0 / 0 |
| unit/equip | 15 | 87% | 0 / 1 / 10 / 4 / 0 / 0 |
| yesno/draw | 9 | 100% | 0 / 9 / 0 / 0 / 0 / 0 |
| mode/foolOnTheHill | 3 | 33% | 0 / 3 / 0 / 0 / 0 / 0 |

Reaction windows: 1201 attacks. Reacted to 524 (deck won 41% (36–46) n=366): stole 212, stoleNothing 86, attackerGone 3, targetGone 210, bothGone 13. Let 677 resolve (43% (38–49) n=296): stole 472, stoleNothing 1, targetGone 186, bothGone 18. Choices: call 304, play 135, block 148, endReact 730.

## Discord 5k #7: Smasher / River / Viktor (RYY) — 560 games, 61% won, 25895 decisions

| Card | Use | Uses | Win rate in games used (95%) | Legal turns → used | Not chosen | Early / mid / late uses | Ahead | Even | Behind |
|---|---|---|---|---|---|---|---|---|---|
| Rockn' Rockerboy | attacked | 874 | 66% (61–71) n=320 | 874 → 799 | 9% | 0 / 382 / 492 | 79% (73–84) n=210 | 64% (53–73) n=86 | 57% (50–65) n=164 |
| Johnny Silverhand: Never Stop Fighting | attacked | 707 | 73% (67–78) n=263 | 490 → 452 | 8% | 0 / 113 / 594 | 89% (83–93) n=179 | 75% (64–84) n=68 | 57% (48–66) n=108 |
| Arasaka Emergency Radioport | sold | 629 | 59% (55–64) n=446 | 1164 → 629 | 46% | 219 / 214 / 196 | 73% (67–79) n=214 | 53% (45–61) n=156 | 43% (35–50) n=155 |
| Mandibular Upgrade | sold | 615 | 60% (55–65) n=422 | 690 → 615 | 11% | 313 / 130 / 172 | 74% (69–80) n=235 | 47% (39–55) n=156 | 43% (35–53) n=115 |
| Meredith Stout: Stone Cold Corpo | played | 581 | 63% (59–68) n=412 | 1099 → 570 | 48% | 162 / 226 / 193 | 80% (74–85) n=202 | 49% (41–57) n=144 | 52% (44–60) n=142 |
| 6th Street Recruits | attacked | 563 | 66% (60–72) n=250 | 630 → 539 | 14% | 67 / 231 / 265 | 80% (73–86) n=140 | 68% (58–77) n=91 | 53% (44–62) n=116 |
| Zetatech Faceplate | sold | 519 | 59% (54–64) n=375 | 1500 → 519 | 65% | 112 / 191 / 216 | 71% (65–77) n=199 | 47% (37–56) n=101 | 46% (38–54) n=137 |
| Rockn' Rockerboy | played | 518 | 62% (57–67) n=392 | 675 → 517 | 23% | 212 / 190 / 116 | 75% (68–80) n=224 | 52% (44–61) n=130 | 42% (33–51) n=105 |
| Johnny Silverhand: Never Stop Fighting | played | 480 | 64% (59–69) n=365 | 954 → 480 | 50% | 0 / 249 / 231 | 82% (76–86) n=207 | 44% (33–56) n=68 | 43% (35–51) n=139 |
| Secondhand Bombus | played | 462 | 55% (50–61) n=348 | 1411 → 442 | 69% | 63 / 223 / 176 | 67% (60–72) n=234 | 35% (25–48) n=65 | 36% (27–47) n=86 |
| Meredith Stout: Stone Cold Corpo | attacked | 435 | 64% (58–70) n=236 | 678 → 417 | 38% | 41 / 150 / 244 | 80% (73–85) n=152 | 52% (41–63) n=73 | 46% (35–57) n=76 |
| Adam Smasher: Ender of Legends | called | 433 | 60% (55–64) n=433 | 433 → 433 | 0% | 150 / 159 / 124 | 73% (67–77) n=284 | 31% (22–42) n=80 | 39% (28–51) n=69 |
| Adam Smasher: Ender of Legends | attacked | 428 | 57% (51–62) n=325 | 459 → 428 | 7% | 0 / 0 / 428 | 83% (77–88) n=161 | 64% (51–76) n=56 | 27% (21–35) n=153 |
| River Ward: Detective on the Hunt | called | 420 | 58% (53–62) n=420 | 445 → 420 | 6% | 144 / 160 / 116 | 71% (65–76) n=281 | 30% (20–41) n=71 | 34% (24–46) n=68 |
| Mantis Blades | sold | 418 | 62% (57–67) n=340 | 747 → 418 | 44% | 209 / 98 / 111 | 78% (71–83) n=178 | 51% (42–60) n=110 | 38% (28–48) n=80 |

(29 more card uses in the JSON report.)

Legal but never taken: Adam Smasher: Ender of Legends (Legend play, legal in 364 turns), Sketchy Ripper (reaction, legal in 7 turns).

| Decision type | Decisions | First-listed option taken | Options offered (1 / 2 / 3–5 / 6–10 / 11–20 / 21+) |
|---|---|---|---|
| main | 14139 | 9% | 0 / 1100 / 3654 / 6234 / 3068 / 83 |
| gig/steal | 2759 | 38% | 299 / 530 / 1215 / 715 / 0 / 0 |
| gig/rollIn | 2240 | 0% | 0 / 560 / 1680 / 0 / 0 / 0 |
| react | 1938 | 66% | 0 / 1109 / 822 / 7 / 0 / 0 |
| unit/equip | 1316 | 73% | 214 / 266 / 707 / 129 / 0 / 0 |
| card/search | 1226 | 66% | 0 / 420 / 795 / 11 / 0 / 0 |
| mulligan | 560 | 16% | 0 / 560 / 0 / 0 / 0 / 0 |
| gigValue/adjust | 515 | 13% | 0 / 0 / 1 / 45 / 291 / 178 |
| unit/defeat | 337 | 42% | 34 / 89 / 198 / 16 / 0 / 0 |
| card/playFree | 281 | 88% | 141 / 97 / 42 / 1 / 0 / 0 |
| card/trash | 239 | 53% | 0 / 239 / 0 / 0 / 0 / 0 |
| unit/sacrifice | 210 | 60% | 71 / 82 / 56 / 1 / 0 / 0 |
| unit/call | 59 | 100% | 0 / 19 / 40 / 0 / 0 / 0 |
| card/discard | 50 | 54% | 15 / 11 / 20 / 4 / 0 / 0 |
| yesno/call | 17 | 100% | 0 / 17 / 0 / 0 / 0 / 0 |
| yesno/draw | 6 | 100% | 0 / 6 / 0 / 0 / 0 / 0 |
| mode/foolOnTheHill | 2 | 50% | 0 / 2 / 0 / 0 / 0 / 0 |
| mode/rivalChoice | 1 | 100% | 0 / 1 / 0 / 0 / 0 / 0 |

Reaction windows: 1681 attacks. Reacted to 556 (deck won 55% (50–60) n=377): stole 189, attackerGone 23, targetGone 323, bothGone 19, noneGone 2. Let 1125 resolve (59% (54–63) n=418): stole 864, stoleNothing 12, attackerGone 12, targetGone 178, bothGone 58, noneGone 1. Choices: call 245, endReact 1274, ability 72, block 347.

## Discord 5k #8: V / Smasher / Saburo (RRG) — 560 games, 61% won, 24483 decisions

| Card | Use | Uses | Win rate in games used (95%) | Legal turns → used | Not chosen | Early / mid / late uses | Ahead | Even | Behind |
|---|---|---|---|---|---|---|---|---|---|
| Pepe Najarro: Working Doubles | attacked | 797 | 64% (59–69) n=351 | 930 → 732 | 21% | 92 / 268 / 437 | 82% (76–87) n=189 | 61% (53–69) n=124 | 52% (45–59) n=195 |
| MaxTac AV | attacked | 569 | 74% (68–79) n=246 | 603 → 548 | 9% | 0 / 288 / 281 | 88% (82–92) n=149 | 71% (59–82) n=56 | 69% (61–76) n=148 |
| V: Streetkid | attacked | 534 | 49% (44–55) n=312 | 643 → 534 | 17% | 49 / 210 / 275 | 65% (58–71) n=182 | 56% (43–68) n=57 | 33% (26–41) n=142 |
| Detonate | sold | 523 | 60% (55–65) n=385 | 815 → 523 | 36% | 248 / 146 / 129 | 72% (65–78) n=190 | 53% (45–62) n=135 | 45% (37–54) n=127 |
| Animals Wrecker | attacked | 506 | 76% (70–81) n=235 | 503 → 479 | 5% | 0 / 146 / 360 | 90% (83–94) n=125 | 86% (75–93) n=57 | 70% (62–77) n=154 |
| Pepe Najarro: Working Doubles | played | 498 | 62% (57–67) n=376 | 954 → 492 | 48% | 261 / 134 / 103 | 73% (66–79) n=184 | 54% (47–62) n=169 | 50% (39–61) n=80 |
| Arasaka Emergency Radioport | sold | 489 | 58% (53–63) n=373 | 795 → 489 | 38% | 218 / 132 / 139 | 67% (60–74) n=166 | 54% (46–63) n=127 | 48% (39–56) n=126 |
| Yorinobu Arasaka: Steel Dragon | played | 482 | 67% (62–72) n=364 | 624 → 482 | 23% | 0 / 188 / 294 | 83% (76–88) n=149 | 66% (53–77) n=59 | 55% (48–61) n=209 |
| Yorinobu Arasaka: Steel Dragon | attacked | 443 | 77% (71–81) n=266 | 429 → 412 | 4% | 0 / 0 / 443 | 97% (93–99) n=138 | 84% (71–91) n=49 | 63% (55–71) n=142 |
| V: Streetkid | called | 427 | 61% (56–65) n=427 | 427 → 427 | 0% | 182 / 170 / 75 | 68% (62–73) n=272 | 49% (38–60) n=78 | 48% (37–59) n=77 |
| Peace Offering | sold | 427 | 64% (59–69) n=332 | 1120 → 427 | 62% | 124 / 197 / 106 | 72% (64–79) n=141 | 60% (49–69) n=94 | 60% (52–68) n=139 |
| Adam Smasher: Ender of Legends | called | 426 | 62% (57–66) n=426 | 426 → 426 | 0% | 170 / 160 / 96 | 71% (66–76) n=275 | 49% (38–60) n=74 | 39% (29–50) n=77 |
| Saburo Arasaka: Stubborn Patriarch | called | 419 | 61% (56–66) n=419 | 419 → 419 | 0% | 161 / 166 / 92 | 67% (61–72) n=290 | 53% (41–64) n=74 | 42% (30–55) n=55 |
| Mantis Blades | sold | 392 | 65% (60–70) n=320 | 596 → 392 | 34% | 254 / 60 / 78 | 76% (68–82) n=147 | 53% (44–61) n=129 | 65% (54–75) n=80 |
| Industrial Assembly | sold | 357 | 56% (50–62) n=292 | 935 → 357 | 62% | 73 / 151 / 133 | 66% (57–74) n=106 | 48% (38–59) n=83 | 53% (45–61) n=136 |

(31 more card uses in the JSON report.)

Legal but never taken: V: Streetkid (Legend play, legal in 1029 turns).

| Decision type | Decisions | First-listed option taken | Options offered (1 / 2 / 3–5 / 6–10 / 11–20 / 21+) |
|---|---|---|---|
| main | 13335 | 8% | 0 / 1231 / 3539 / 5179 / 3275 / 111 |
| gig/steal | 3416 | 28% | 199 / 524 / 1493 / 1191 / 9 / 0 |
| gig/rollIn | 2240 | 0% | 0 / 560 / 1680 / 0 / 0 / 0 |
| react | 1135 | 67% | 0 / 814 / 319 / 2 / 0 / 0 |
| unit/ready | 656 | 76% | 0 / 337 / 316 / 3 / 0 / 0 |
| unit/defeat | 637 | 61% | 190 / 205 / 233 / 9 / 0 / 0 |
| mulligan | 560 | 33% | 0 / 560 / 0 / 0 / 0 / 0 |
| card/search | 540 | 62% | 172 / 192 / 155 / 20 / 1 / 0 |
| card/playFree | 445 | 56% | 0 / 136 / 302 / 7 / 0 / 0 |
| gig/swapGive | 326 | 33% | 0 / 19 / 268 / 36 / 3 / 0 |
| gig/swapTake | 258 | 54% | 68 / 90 / 66 / 33 / 1 / 0 |
| gigValue/adjust | 210 | 9% | 0 / 10 / 64 / 15 / 58 / 63 |
| unit/equip | 191 | 86% | 38 / 68 / 76 / 9 / 0 / 0 |
| gigValue/setGig | 156 | 13% | 0 / 0 / 7 / 19 / 33 / 97 |
| unit/spend | 152 | 75% | 80 / 39 / 33 / 0 / 0 / 0 |
| unit/sacrifice | 70 | 87% | 50 / 16 / 4 / 0 / 0 / 0 |
| card/discard | 39 | 62% | 8 / 15 / 15 / 1 / 0 / 0 |
| unit/call | 38 | 100% | 0 / 10 / 28 / 0 / 0 / 0 |
| yesno/call | 38 | 100% | 0 / 38 / 0 / 0 / 0 / 0 |
| card/defeat | 19 | 95% | 16 / 3 / 0 / 0 / 0 / 0 |
| yesno/draw | 13 | 100% | 0 / 13 / 0 / 0 / 0 / 0 |
| mode/foolOnTheHill | 6 | 50% | 0 / 6 / 0 / 0 / 0 / 0 |
| mode/rivalChoice | 3 | 0% | 0 / 3 / 0 / 0 / 0 / 0 |

Reaction windows: 1066 attacks. Reacted to 350 (deck won 58% (52–64) n=270): stole 165, stoleNothing 1, attackerGone 9, targetGone 155, bothGone 20. Let 716 resolve (60% (55–65) n=321): stole 554, stoleNothing 6, attackerGone 2, targetGone 122, bothGone 32. Choices: endReact 761, call 232, block 131, play 11.

## Fills up Discard super quickly then heavily discounted Trauma Team Operatives and high power Rockerboys fill the board. — 560 games, 54% won, 25781 decisions

| Card | Use | Uses | Win rate in games used (95%) | Legal turns → used | Not chosen | Early / mid / late uses | Ahead | Even | Behind |
|---|---|---|---|---|---|---|---|---|---|
| Rockn' Rockerboy | attacked | 943 | 60% (55–65) n=341 | 955 → 824 | 14% | 0 / 418 / 525 | 74% (68–79) n=207 | 62% (52–72) n=93 | 52% (46–59) n=214 |
| Johnny Silverhand: Never Stop Fighting | attacked | 571 | 63% (57–69) n=227 | 432 → 389 | 10% | 0 / 86 / 485 | 82% (75–88) n=136 | 82% (69–90) n=50 | 49% (40–58) n=117 |
| V: Streetkid | attacked | 546 | 48% (42–53) n=325 | 651 → 546 | 16% | 49 / 112 / 385 | 64% (56–71) n=168 | 57% (46–68) n=75 | 31% (24–38) n=160 |
| Rockn' Rockerboy | played | 540 | 56% (51–60) n=394 | 699 → 540 | 23% | 242 / 163 / 135 | 69% (62–75) n=197 | 50% (42–58) n=141 | 40% (32–48) n=135 |
| All is Lost | sold | 532 | 56% (51–61) n=379 | 625 → 532 | 15% | 272 / 117 / 143 | 68% (61–74) n=183 | 50% (42–57) n=163 | 49% (40–58) n=115 |
| Shattered Memories | sold | 504 | 56% (51–61) n=381 | 1337 → 504 | 62% | 111 / 179 / 214 | 68% (60–74) n=154 | 57% (47–66) n=104 | 47% (39–54) n=178 |
| Muamar Reyes: El Capitán | ability | 498 | 50% (45–55) n=326 | 1685 → 498 | 70% | 12 / 68 / 418 | 77% (70–82) n=182 | 37% (26–50) n=59 | 26% (19–33) n=156 |
| 6th Street Recruits | attacked | 488 | 58% (52–65) n=236 | 605 → 463 | 23% | 67 / 172 / 249 | 78% (69–85) n=103 | 60% (50–70) n=91 | 51% (42–59) n=136 |
| Trauma Team Operatives | attacked | 474 | 57% (51–64) n=230 | 459 → 402 | 12% | 3 / 85 / 386 | 75% (67–82) n=113 | 77% (65–85) n=64 | 42% (34–51) n=132 |
| Trauma Team Operatives | played | 469 | 55% (50–60) n=339 | 1081 → 430 | 60% | 36 / 134 / 299 | 69% (62–76) n=156 | 54% (42–66) n=61 | 42% (35–50) n=164 |
| Bonnie and Clyde | sold | 465 | 56% (51–61) n=351 | 1515 → 465 | 69% | 85 / 172 / 208 | 63% (56–70) n=161 | 57% (46–67) n=81 | 46% (38–53) n=162 |
| Johnny Silverhand: Rocking Renegade | called | 419 | 53% (48–57) n=419 | 419 → 419 | 0% | 188 / 125 / 106 | 59% (53–65) n=268 | 39% (29–50) n=77 | 43% (33–55) n=74 |
| V: Streetkid | called | 411 | 58% (53–62) n=411 | 411 → 411 | 0% | 186 / 119 / 106 | 69% (63–74) n=254 | 45% (34–56) n=76 | 36% (26–47) n=81 |
| Johnny Silverhand: Never Stop Fighting | played | 392 | 56% (50–61) n=311 | 1070 → 392 | 63% | 0 / 173 / 219 | 81% (74–87) n=132 | 50% (36–64) n=46 | 41% (34–49) n=169 |
| Muamar Reyes: El Capitán | called | 389 | 53% (49–58) n=389 | 389 → 389 | 0% | 157 / 125 / 107 | 64% (58–70) n=242 | 44% (32–56) n=62 | 29% (21–40) n=85 |

(33 more card uses in the JSON report.)

Legal but never taken: V: Streetkid (Legend play, legal in 1160 turns).

| Decision type | Decisions | First-listed option taken | Options offered (1 / 2 / 3–5 / 6–10 / 11–20 / 21+) |
|---|---|---|---|
| main | 14806 | 8% | 0 / 1235 / 3702 / 5076 / 4536 / 257 |
| gig/steal | 3082 | 30% | 151 / 466 / 1332 / 1117 / 16 / 0 |
| gig/rollIn | 2240 | 0% | 0 / 560 / 1680 / 0 / 0 / 0 |
| react | 1523 | 62% | 0 / 907 / 615 / 1 / 0 / 0 |
| gigValue/adjust | 909 | 13% | 0 / 10 / 63 / 49 / 470 / 317 |
| card/search | 850 | 71% | 233 / 317 / 280 / 18 / 2 / 0 |
| mulligan | 560 | 31% | 0 / 560 / 0 / 0 / 0 / 0 |
| mode/muamarCall | 516 | 75% | 0 / 516 / 0 / 0 / 0 / 0 |
| unit/lagAttack | 381 | 80% | 56 / 114 / 205 / 6 / 0 / 0 |
| unit/protect | 374 | 44% | 83 / 148 / 141 / 2 / 0 / 0 |
| unit/defeat | 304 | 71% | 138 / 112 / 53 / 1 / 0 / 0 |
| card/defeatGear | 84 | 90% | 0 / 68 / 16 / 0 / 0 / 0 |
| unit/sacrifice | 59 | 86% | 34 / 11 / 14 / 0 / 0 / 0 |
| card/discard | 43 | 42% | 6 / 8 / 24 / 5 / 0 / 0 |
| yesno/draw | 33 | 100% | 0 / 33 / 0 / 0 / 0 / 0 |
| card/defeat | 10 | 100% | 9 / 1 / 0 / 0 / 0 / 0 |
| mode/foolOnTheHill | 6 | 50% | 0 / 6 / 0 / 0 / 0 / 0 |
| mode/rivalChoice | 1 | 0% | 0 / 1 / 0 / 0 / 0 / 0 |

Reaction windows: 1350 attacks. Reacted to 489 (deck won 47% (42–52) n=364): stole 196, attackerGone 10, targetGone 223, bothGone 16, noneGone 44. Let 861 resolve (57% (51–62) n=344): stole 630, stoleNothing 6, attackerGone 2, targetGone 207, bothGone 16. Choices: call 334, endReact 943, block 240, play 6.

## Gear'n'Go — 560 games, 34% won, 23406 decisions

| Card | Use | Uses | Win rate in games used (95%) | Legal turns → used | Not chosen | Early / mid / late uses | Ahead | Even | Behind |
|---|---|---|---|---|---|---|---|---|---|
| Goro Takemura: Hands Unclean | attacked | 736 | 34% (30–39) n=443 | 995 → 736 | 26% | 51 / 246 / 439 | 53% (47–60) n=227 | 37% (28–48) n=86 | 24% (19–30) n=217 |
| Dexter DeShawn: One Last Chance | attacked | 696 | 38% (33–44) n=321 | 857 → 613 | 28% | 51 / 270 / 375 | 60% (52–68) n=145 | 50% (40–60) n=102 | 25% (19–31) n=197 |
| Corpo Security | played | 595 | 34% (30–39) n=414 | 960 → 565 | 41% | 248 / 182 / 165 | 45% (39–51) n=231 | 21% (15–29) n=118 | 24% (18–31) n=155 |
| Corporate Surveillance | sold | 590 | 33% (29–38) n=417 | 1096 → 590 | 46% | 203 / 209 / 178 | 43% (37–50) n=196 | 29% (22–37) n=138 | 22% (17–29) n=167 |
| Dexter DeShawn: One Last Chance | played | 588 | 35% (31–40) n=412 | 761 → 568 | 25% | 252 / 168 / 168 | 49% (42–55) n=202 | 30% (24–38) n=158 | 20% (14–27) n=136 |
| Mandibular Upgrade | sold | 576 | 33% (29–38) n=417 | 686 → 576 | 16% | 314 / 124 / 138 | 40% (33–47) n=189 | 31% (24–38) n=163 | 19% (14–27) n=134 |
| Riot Shield | sold | 540 | 34% (29–39) n=392 | 950 → 540 | 43% | 226 / 181 / 133 | 45% (38–52) n=191 | 29% (22–37) n=128 | 20% (14–27) n=142 |
| Caliber: Totentanz's Top Dog | played | 520 | 33% (28–38) n=384 | 1163 → 520 | 55% | 91 / 182 / 247 | 47% (40–54) n=184 | 27% (18–38) n=78 | 17% (13–23) n=191 |
| Goro Takemura: Losing His Way | played | 515 | 29% (25–34) n=376 | 1345 → 502 | 63% | 133 / 145 / 237 | 42% (35–49) n=175 | 24% (17–33) n=111 | 16% (11–22) n=159 |
| Goro Takemura: Hands Unclean | Go Solo (self-paid 501) | 501 | 33% (29–37) n=501 | 818 → 501 | 39% | 77 / 225 / 199 | 44% (37–52) n=178 | 31% (22–41) n=91 | 24% (19–30) n=232 |
| Caliber: Totentanz's Top Dog | attacked | 500 | 36% (31–42) n=278 | 549 → 472 | 14% | 0 / 181 / 319 | 60% (51–68) n=123 | 46% (33–58) n=57 | 21% (16–28) n=164 |
| Goro Takemura: Losing His Way | attacked | 485 | 33% (28–39) n=259 | 542 → 452 | 17% | 28 / 168 / 289 | 58% (48–67) n=107 | 40% (30–52) n=72 | 22% (16–29) n=158 |
| Sandevistan | sold | 479 | 32% (27–37) n=349 | 932 → 479 | 49% | 212 / 126 / 141 | 40% (33–47) n=176 | 33% (24–43) n=94 | 16% (11–22) n=141 |
| Goro Takemura: Hands Unclean | called | 411 | 35% (31–40) n=411 | 411 → 411 | 0% | 212 / 132 / 67 | 41% (35–48) n=218 | 30% (23–39) n=116 | 26% (17–37) n=77 |
| Panam Palmer: Nomad Cavalry | called | 391 | 36% (32–41) n=391 | 391 → 391 | 0% | 179 / 129 / 83 | 46% (39–52) n=217 | 32% (23–41) n=98 | 16% (9–26) n=76 |

(31 more card uses in the JSON report.)

Legal but never taken: Maelstrom Zealots (reaction, legal in 8 turns).

| Decision type | Decisions | First-listed option taken | Options offered (1 / 2 / 3–5 / 6–10 / 11–20 / 21+) |
|---|---|---|---|
| main | 12999 | 8% | 0 / 833 / 3351 / 5336 / 3433 / 46 |
| react | 2365 | 66% | 0 / 1380 / 966 / 19 / 0 / 0 |
| gig/rollIn | 2240 | 0% | 0 / 560 / 1680 / 0 / 0 / 0 |
| gig/steal | 2110 | 33% | 135 / 368 / 871 / 727 / 9 / 0 |
| gigValue/adjust | 1442 | 35% | 0 / 0 / 140 / 268 / 801 / 233 |
| mulligan | 560 | 8% | 0 / 560 / 0 / 0 / 0 / 0 |
| unit/equip | 525 | 78% | 100 / 129 / 276 / 20 / 0 / 0 |
| unit/defeat | 447 | 53% | 129 / 115 / 197 / 6 / 0 / 0 |
| unit/ready | 304 | 58% | 109 / 132 / 63 / 0 / 0 / 0 |
| unit/pump | 202 | 39% | 36 / 72 / 90 / 4 / 0 / 0 |
| card/defeatGear | 80 | 83% | 0 / 59 / 20 / 1 / 0 / 0 |
| card/discard | 67 | 54% | 10 / 14 / 41 / 2 / 0 / 0 |
| unit/sacrifice | 41 | 85% | 25 / 8 / 8 / 0 / 0 / 0 |
| yesno/draw | 8 | 100% | 0 / 8 / 0 / 0 / 0 / 0 |
| card/moveGear | 7 | 100% | 7 / 0 / 0 / 0 / 0 / 0 |
| mode/foolOnTheHill | 4 | 25% | 0 / 4 / 0 / 0 / 0 / 0 |
| unit/spend | 3 | 33% | 1 / 0 / 2 / 0 / 0 / 0 |
| mode/rivalChoice | 2 | 0% | 0 / 2 / 0 / 0 / 0 / 0 |

Reaction windows: 2062 attacks. Reacted to 682 (deck won 32% (27–36) n=429): fizzled 17, stole 208, stoleNothing 1, attackerGone 25, targetGone 397, bothGone 34. Let 1380 resolve (31% (27–36) n=429): stole 938, stoleNothing 13, attackerGone 9, targetGone 386, bothGone 34. Choices: endReact 1557, block 421, call 363, ability 24.

## GRY Trauma Team — 560 games, 44% won, 28509 decisions

| Card | Use | Uses | Win rate in games used (95%) | Legal turns → used | Not chosen | Early / mid / late uses | Ahead | Even | Behind |
|---|---|---|---|---|---|---|---|---|---|
| Pepe Najarro: Working Doubles | attacked | 818 | 47% (42–53) n=346 | 894 → 736 | 18% | 59 / 309 / 450 | 67% (60–73) n=178 | 52% (43–61) n=118 | 41% (34–47) n=211 |
| 6th Street Recruits | attacked | 792 | 48% (43–54) n=315 | 892 → 719 | 19% | 77 / 282 / 433 | 68% (61–75) n=160 | 53% (43–62) n=112 | 37% (31–44) n=202 |
| V: Streetkid | attacked | 705 | 41% (36–45) n=441 | 851 → 705 | 17% | 59 / 191 / 455 | 59% (52–65) n=215 | 52% (42–63) n=84 | 23% (18–29) n=242 |
| Padre: Man of the Cross | ability | 602 | 35% (31–40) n=382 | 1944 → 602 | 69% | 1 / 116 / 485 | 58% (51–64) n=211 | 15% (9–24) n=81 | 7% (4–12) n=191 |
| Pepe Najarro: Working Doubles | played | 576 | 45% (40–50) n=407 | 962 → 571 | 41% | 251 / 147 / 178 | 54% (47–61) n=201 | 40% (33–49) n=146 | 36% (28–44) n=140 |
| Meredith Stout: Stone Cold Corpo | played | 576 | 43% (39–48) n=407 | 1362 → 558 | 59% | 135 / 136 / 305 | 61% (54–69) n=158 | 41% (33–49) n=143 | 31% (25–38) n=180 |
| Muamar Reyes: El Capitán | ability | 566 | 36% (31–41) n=365 | 1820 → 566 | 69% | 7 / 109 / 450 | 61% (55–68) n=205 | 9% (4–17) n=70 | 7% (4–12) n=176 |
| 6th Street Recruits | played | 557 | 46% (41–51) n=396 | 969 → 548 | 43% | 237 / 126 / 194 | 56% (49–63) n=193 | 46% (38–54) n=155 | 28% (21–36) n=136 |
| Trauma Team Operatives | played | 549 | 42% (37–47) n=385 | 982 → 519 | 47% | 22 / 243 / 284 | 55% (47–62) n=171 | 34% (24–46) n=65 | 31% (25–37) n=216 |
| Johnny Silverhand: Never Stop Fighting | attacked | 545 | 56% (49–63) n=204 | 405 → 366 | 10% | 0 / 133 / 412 | 78% (69–84) n=121 | 81% (66–91) n=37 | 41% (32–50) n=110 |
| Detonate | sold | 545 | 44% (39–49) n=383 | 913 → 545 | 40% | 248 / 152 / 145 | 49% (42–55) n=210 | 40% (33–49) n=136 | 31% (23–39) n=121 |
| Trauma Team Operatives | attacked | 544 | 46% (40–51) n=279 | 560 → 478 | 15% | 0 / 93 / 451 | 76% (68–82) n=132 | 59% (47–71) n=59 | 24% (18–30) n=174 |
| Augmented Negotiators | played | 525 | 42% (37–47) n=387 | 1267 → 496 | 61% | 84 / 168 / 273 | 63% (55–70) n=148 | 36% (28–45) n=118 | 30% (23–37) n=179 |
| The Heist | sold | 508 | 43% (38–48) n=374 | 1006 → 508 | 50% | 166 / 207 / 135 | 49% (42–56) n=189 | 36% (28–45) n=116 | 35% (28–43) n=147 |
| All is Lost | sold | 495 | 43% (38–48) n=377 | 758 → 495 | 35% | 229 / 143 / 123 | 50% (42–57) n=179 | 40% (32–48) n=145 | 27% (20–35) n=116 |

(29 more card uses in the JSON report.)

Legal but never taken: V: Streetkid (Legend play, legal in 1041 turns).

| Decision type | Decisions | First-listed option taken | Options offered (1 / 2 / 3–5 / 6–10 / 11–20 / 21+) |
|---|---|---|---|
| main | 15621 | 9% | 0 / 962 / 3448 / 5596 / 5300 / 315 |
| gig/steal | 2951 | 32% | 165 / 478 / 1292 / 983 / 33 / 0 |
| react | 2343 | 61% | 0 / 1453 / 865 / 25 / 0 / 0 |
| gig/rollIn | 2240 | 0% | 0 / 560 / 1680 / 0 / 0 / 0 |
| gigValue/adjust | 982 | 8% | 0 / 0 / 1 / 65 / 527 / 389 |
| gigValue/setGig | 749 | 6% | 0 / 1 / 2 / 46 / 207 / 493 |
| unit/spend | 597 | 63% | 238 / 161 / 194 / 4 / 0 / 0 |
| mulligan | 560 | 11% | 0 / 560 / 0 / 0 / 0 / 0 |
| mode/mode | 538 | 62% | 0 / 538 / 0 / 0 / 0 / 0 |
| mode/muamarCall | 520 | 79% | 0 / 520 / 0 / 0 / 0 / 0 |
| card/search | 508 | 81% | 261 / 137 / 76 / 31 / 3 / 0 |
| unit/protect | 398 | 57% | 111 / 157 / 125 / 5 / 0 / 0 |
| unit/equip | 250 | 82% | 46 / 85 / 87 / 32 / 0 / 0 |
| unit/sacrifice | 62 | 85% | 38 / 18 / 6 / 0 / 0 / 0 |
| unit/ready | 57 | 100% | 0 / 57 / 0 / 0 / 0 / 0 |
| yesno/draw | 42 | 100% | 0 / 42 / 0 / 0 / 0 / 0 |
| card/discard | 39 | 38% | 5 / 6 / 26 / 2 / 0 / 0 |
| card/defeat | 38 | 92% | 30 / 6 / 2 / 0 / 0 / 0 |
| mode/foolOnTheHill | 7 | 71% | 0 / 7 / 0 / 0 / 0 / 0 |
| yesno/playFree | 6 | 100% | 0 / 6 / 0 / 0 / 0 / 0 |
| mode/rivalChoice | 1 | 0% | 0 / 1 / 0 / 0 / 0 / 0 |

Reaction windows: 2026 attacks. Reacted to 752 (deck won 41% (36–46) n=447): stole 271, attackerGone 9, targetGone 380, bothGone 25, noneGone 67. Let 1274 resolve (42% (38–47) n=403): stole 894, stoleNothing 9, attackerGone 9, targetGone 325, bothGone 36, noneGone 1. Choices: endReact 1435, block 442, call 453, play 13.

## Keep 'Em Guessing — 560 games, 20% won, 25729 decisions

| Card | Use | Uses | Win rate in games used (95%) | Legal turns → used | Not chosen | Early / mid / late uses | Ahead | Even | Behind |
|---|---|---|---|---|---|---|---|---|---|
| Jackie Welles: Ride or Die Choom | attacked | 701 | 30% (25–35) n=303 | 666 → 644 | 3% | 0 / 183 / 518 | 56% (47–65) n=111 | 51% (37–64) n=49 | 22% (18–28) n=246 |
| Augmented Negotiators | played | 611 | 21% (17–25) n=424 | 962 → 581 | 40% | 166 / 248 / 197 | 30% (24–37) n=203 | 12% (7–18) n=138 | 11% (7–17) n=166 |
| Viktor Vektor: You Might Feel a Little Pinch | played | 589 | 19% (16–24) n=407 | 721 → 576 | 20% | 255 / 174 / 160 | 27% (21–33) n=207 | 15% (10–21) n=160 | 11% (6–18) n=121 |
| Jackie Welles: Ride or Die Choom | played | 582 | 23% (19–27) n=408 | 748 → 580 | 22% | 0 / 345 / 237 | 33% (27–39) n=222 | 17% (10–28) n=69 | 10% (7–15) n=207 |
| Sketchy Ripper | played | 582 | 21% (17–25) n=416 | 820 → 559 | 32% | 297 / 111 / 174 | 28% (23–34) n=236 | 12% (7–18) n=135 | 9% (5–15) n=114 |
| Mandibular Upgrade | sold | 581 | 20% (16–24) n=408 | 671 → 581 | 13% | 283 / 138 / 160 | 26% (21–33) n=202 | 15% (10–22) n=146 | 12% (8–18) n=142 |
| Viktor Vektor: You Might Feel a Little Pinch | attacked | 566 | 22% (18–27) n=294 | 732 → 524 | 28% | 82 / 239 / 245 | 32% (25–40) n=134 | 19% (13–27) n=111 | 16% (11–22) n=166 |
| Corporate Surveillance | sold | 557 | 20% (16–24) n=390 | 995 → 557 | 44% | 200 / 185 / 172 | 27% (21–33) n=192 | 20% (14–27) n=131 | 12% (8–19) n=153 |
| Secondhand Bombus | played | 526 | 20% (16–24) n=393 | 1214 → 510 | 58% | 124 / 224 / 178 | 25% (20–31) n=237 | 13% (7–21) n=95 | 12% (7–19) n=124 |
| Kiroshi Optics | sold | 464 | 21% (17–26) n=361 | 731 → 464 | 37% | 239 / 108 / 117 | 30% (23–37) n=172 | 12% (7–18) n=128 | 13% (7–20) n=104 |
| Sketchy Ripper | attacked | 460 | 23% (18–28) n=251 | 765 → 426 | 44% | 91 / 180 / 189 | 32% (25–40) n=144 | 19% (11–30) n=63 | 10% (6–17) n=118 |
| River Ward: Detective on the Hunt | called | 460 | 21% (17–25) n=460 | 495 → 460 | 7% | 234 / 141 / 85 | 30% (24–36) n=249 | 12% (7–18) n=135 | 7% (3–14) n=76 |
| Goro Takemura: Vengeful Bodyguard | called | 454 | 20% (16–24) n=454 | 501 → 454 | 9% | 240 / 125 / 89 | 28% (23–34) n=251 | 12% (8–19) n=130 | 4% (1–11) n=73 |
| Live with the Aftermath | played | 406 | 21% (17–26) n=315 | 899 → 394 | 56% | 154 / 137 / 115 | 30% (24–37) n=181 | 9% (4–18) n=77 | 7% (3–15) n=83 |
| Zetatech Faceplate | sold | 404 | 21% (17–26) n=320 | 1172 → 404 | 66% | 83 / 161 / 160 | 32% (24–40) n=126 | 14% (8–23) n=79 | 15% (10–21) n=156 |

(31 more card uses in the JSON report.)

| Decision type | Decisions | First-listed option taken | Options offered (1 / 2 / 3–5 / 6–10 / 11–20 / 21+) |
|---|---|---|---|
| main | 14201 | 10% | 0 / 765 / 3485 / 6239 / 3595 / 117 |
| react | 2636 | 63% | 0 / 1492 / 1129 / 15 / 0 / 0 |
| gig/rollIn | 2240 | 0% | 0 / 560 / 1680 / 0 / 0 / 0 |
| gig/steal | 2137 | 36% | 172 / 382 / 773 / 791 / 19 / 0 |
| unit/equip | 805 | 79% | 146 / 166 / 417 / 76 / 0 / 0 |
| mulligan | 560 | 7% | 0 / 560 / 0 / 0 / 0 / 0 |
| card/discard | 408 | 49% | 12 / 76 / 272 / 48 / 0 / 0 |
| unit/ready | 390 | 77% | 0 / 233 / 154 / 3 / 0 / 0 |
| unit/blocker | 367 | 72% | 174 / 111 / 81 / 1 / 0 / 0 |
| unit/pump | 339 | 50% | 99 / 120 / 116 / 4 / 0 / 0 |
| card/search | 293 | 87% | 0 / 188 / 105 / 0 / 0 / 0 |
| card/trash | 253 | 50% | 0 / 253 / 0 / 0 / 0 / 0 |
| gigValue/adjust | 252 | 22% | 0 / 0 / 1 / 50 / 140 / 61 |
| unit/sacrifice | 250 | 69% | 116 / 100 / 32 / 2 / 0 / 0 |
| card/playFree | 201 | 96% | 166 / 23 / 12 / 0 / 0 / 0 |
| gigValue/setGig | 170 | 6% | 0 / 0 / 13 / 16 / 27 / 114 |
| card/look | 116 | 100% | 52 / 46 / 18 / 0 / 0 / 0 |
| card/defeatGear | 98 | 76% | 0 / 68 / 30 / 0 / 0 / 0 |
| mode/foolOnTheHill | 6 | 50% | 0 / 6 / 0 / 0 / 0 / 0 |
| yesno/draw | 6 | 100% | 0 / 6 / 0 / 0 / 0 / 0 |
| unit/spend | 1 | 0% | 0 / 1 / 0 / 0 / 0 / 0 |

Reaction windows: 2250 attacks. Reacted to 786 (deck won 19% (16–23) n=457): stole 175, attackerGone 6, targetGone 578, bothGone 27. Let 1464 resolve (19% (16–23) n=449): stole 1177, stoleNothing 10, attackerGone 5, targetGone 233, bothGone 38, noneGone 1. Choices: call 295, block 576, endReact 1665, ability 100.

## Ladder S1 #1: V / Smasher / Padre (RRG) — 560 games, 63% won, 26096 decisions

| Card | Use | Uses | Win rate in games used (95%) | Legal turns → used | Not chosen | Early / mid / late uses | Ahead | Even | Behind |
|---|---|---|---|---|---|---|---|---|---|
| Pepe Najarro: Working Doubles | attacked | 796 | 67% (62–72) n=337 | 925 → 721 | 22% | 69 / 319 / 408 | 82% (76–87) n=192 | 69% (60–76) n=118 | 57% (50–64) n=192 |
| 6th Street Recruits | attacked | 777 | 65% (59–70) n=340 | 906 → 707 | 22% | 67 / 302 / 408 | 82% (76–87) n=185 | 60% (50–68) n=114 | 58% (51–65) n=208 |
| Animals Wrecker | attacked | 737 | 76% (71–80) n=307 | 693 → 663 | 4% | 0 / 198 / 539 | 92% (87–95) n=168 | 85% (76–91) n=81 | 70% (63–75) n=217 |
| Yorinobu Arasaka: Steel Dragon | attacked | 527 | 70% (64–75) n=299 | 539 → 483 | 10% | 0 / 0 / 527 | 90% (85–94) n=166 | 87% (74–94) n=46 | 55% (47–62) n=166 |
| V: Streetkid | attacked | 513 | 52% (46–57) n=294 | 628 → 513 | 18% | 70 / 173 / 270 | 66% (59–73) n=180 | 53% (37–67) n=40 | 36% (28–44) n=143 |
| Yorinobu Arasaka: Steel Dragon | played | 510 | 64% (59–68) n=392 | 649 → 510 | 21% | 0 / 210 / 300 | 79% (71–85) n=132 | 63% (51–74) n=60 | 55% (49–61) n=243 |
| Peace Offering | sold | 493 | 64% (59–69) n=373 | 1041 → 493 | 53% | 154 / 218 / 121 | 74% (66–80) n=155 | 64% (55–73) n=106 | 54% (46–61) n=163 |
| 6th Street Recruits | played | 488 | 62% (57–67) n=360 | 1035 → 482 | 53% | 244 / 108 / 136 | 72% (65–78) n=177 | 56% (47–64) n=142 | 51% (41–60) n=95 |
| Animals Wrecker | played | 479 | 70% (65–74) n=367 | 715 → 479 | 33% | 0 / 342 / 137 | 79% (72–85) n=145 | 73% (62–82) n=78 | 64% (57–70) n=200 |
| Pepe Najarro: Working Doubles | played | 475 | 65% (60–69) n=356 | 989 → 472 | 52% | 259 / 115 / 101 | 75% (68–81) n=165 | 61% (53–68) n=152 | 46% (36–56) n=85 |
| Memory Relapse | sold | 436 | 65% (60–70) n=344 | 1408 → 436 | 69% | 62 / 186 / 188 | 77% (70–83) n=158 | 61% (50–71) n=82 | 55% (47–62) n=154 |
| Padre: Man of the Cross | ability | 411 | 53% (48–59) n=290 | 1758 → 411 | 77% | 6 / 80 / 325 | 74% (67–80) n=179 | 33% (23–46) n=60 | 24% (17–33) n=107 |
| Adam Smasher: Ender of Legends | called | 408 | 65% (61–70) n=408 | 408 → 408 | 0% | 178 / 114 / 116 | 74% (68–79) n=267 | 54% (43–64) n=82 | 44% (32–57) n=59 |
| V: Streetkid | called | 407 | 64% (59–68) n=407 | 407 → 407 | 0% | 212 / 98 / 97 | 69% (63–74) n=289 | 56% (43–68) n=59 | 46% (34–58) n=59 |
| Mantis Blades | sold | 406 | 62% (57–67) n=334 | 586 → 406 | 31% | 258 / 64 / 84 | 72% (65–79) n=154 | 53% (45–61) n=139 | 61% (51–71) n=83 |

(37 more card uses in the JSON report.)

Legal but never taken: V: Streetkid (Legend play, legal in 1085 turns), Synapse Burnout (played, legal in 584 turns).

| Decision type | Decisions | First-listed option taken | Options offered (1 / 2 / 3–5 / 6–10 / 11–20 / 21+) |
|---|---|---|---|
| main | 14456 | 8% | 0 / 1168 / 3755 / 5171 / 4171 / 191 |
| gig/steal | 3428 | 31% | 211 / 500 / 1558 / 1152 / 7 / 0 |
| gig/rollIn | 2240 | 0% | 0 / 560 / 1680 / 0 / 0 / 0 |
| react | 1233 | 59% | 0 / 843 / 385 / 5 / 0 / 0 |
| unit/defeat | 632 | 61% | 194 / 191 / 237 / 10 / 0 / 0 |
| mulligan | 560 | 18% | 0 / 560 / 0 / 0 / 0 / 0 |
| gigValue/setGig | 516 | 9% | 0 / 0 / 5 / 49 / 144 / 318 |
| mode/mode | 509 | 51% | 0 / 509 / 0 / 0 / 0 / 0 |
| card/search | 496 | 66% | 188 / 159 / 123 / 24 / 2 / 0 |
| card/playFree | 485 | 56% | 0 / 94 / 349 / 42 / 0 / 0 |
| unit/spend | 393 | 80% | 228 / 115 / 50 / 0 / 0 / 0 |
| unit/equip | 374 | 86% | 51 / 105 / 187 / 31 / 0 / 0 |
| gigValue/adjust | 285 | 6% | 0 / 9 / 53 / 4 / 30 / 189 |
| unit/ready | 225 | 95% | 0 / 188 / 37 / 0 / 0 / 0 |
| unit/adrenaline | 127 | 76% | 76 / 33 / 18 / 0 / 0 / 0 |
| unit/sacrifice | 54 | 85% | 34 / 15 / 5 / 0 / 0 / 0 |
| card/discard | 31 | 35% | 4 / 4 / 22 / 1 / 0 / 0 |
| unit/pump | 28 | 86% | 13 / 8 / 7 / 0 / 0 / 0 |
| yesno/draw | 10 | 100% | 0 / 10 / 0 / 0 / 0 / 0 |
| card/defeat | 6 | 100% | 5 / 1 / 0 / 0 / 0 / 0 |
| mode/foolOnTheHill | 4 | 50% | 0 / 4 / 0 / 0 / 0 / 0 |
| mode/rivalChoice | 4 | 0% | 0 / 4 / 0 / 0 / 0 / 0 |

Reaction windows: 1150 attacks. Reacted to 469 (deck won 56% (50–61) n=333): stole 256, attackerGone 19, targetGone 165, bothGone 27, noneGone 2. Let 681 resolve (59% (53–64) n=294): stole 463, stoleNothing 4, attackerGone 5, targetGone 183, bothGone 26. Choices: endReact 732, call 340, block 130, play 31.

## Ladder S1 #10: Jackie / Judy / Hanako (BBG) — 560 games, 51% won, 29910 decisions

| Card | Use | Uses | Win rate in games used (95%) | Legal turns → used | Not chosen | Early / mid / late uses | Ahead | Even | Behind |
|---|---|---|---|---|---|---|---|---|---|
| Jacked-In Voodoo Boy | attacked | 921 | 52% (48–57) n=402 | 863 → 801 | 7% | 166 / 379 / 376 | 64% (58–69) n=266 | 48% (40–56) n=143 | 35% (28–43) n=163 |
| Jacked-In Voodoo Boy | played | 850 | 51% (47–56) n=500 | 1094 → 786 | 28% | 433 / 217 / 200 | 68% (62–73) n=293 | 37% (31–44) n=214 | 22% (15–31) n=101 |
| Delamain: Rideshare AI | played | 676 | 50% (45–54) n=453 | 1514 → 634 | 58% | 194 / 275 / 207 | 62% (56–68) n=275 | 40% (33–48) n=159 | 15% (9–23) n=101 |
| Peace Offering | sold | 543 | 53% (48–58) n=391 | 885 → 543 | 39% | 281 / 114 / 148 | 67% (60–73) n=185 | 49% (41–56) n=156 | 27% (20–36) n=114 |
| Chrome Reverie | sold | 528 | 53% (48–58) n=393 | 929 → 528 | 43% | 238 / 133 / 157 | 66% (59–72) n=215 | 47% (38–55) n=129 | 33% (25–42) n=118 |
| Judy Álvarez: Braindance Maestro | ability | 516 | 49% (43–54) n=346 | 1938 → 516 | 73% | 33 / 194 / 289 | 64% (57–70) n=214 | 37% (28–48) n=83 | 17% (11–24) n=131 |
| Trust No One | sold | 516 | 52% (47–57) n=383 | 845 → 516 | 39% | 199 / 123 / 194 | 65% (58–72) n=183 | 49% (41–57) n=148 | 27% (20–36) n=111 |
| Lizzy Wizzy: Delicate Weapon | played | 510 | 53% (48–58) n=376 | 1627 → 503 | 69% | 34 / 210 / 266 | 67% (60–73) n=208 | 55% (44–65) n=82 | 28% (21–36) n=132 |
| Placide: Voodoo Sentinel | played | 488 | 49% (44–54) n=387 | 607 → 488 | 20% | 0 / 0 / 488 | 80% (74–86) n=168 | 66% (53–77) n=59 | 23% (18–29) n=203 |
| Nocturne OP55 N1 | sold | 475 | 47% (42–53) n=352 | 1219 → 475 | 61% | 128 / 190 / 157 | 59% (51–65) n=188 | 44% (35–54) n=104 | 25% (18–33) n=113 |
| Maman Brigitte: Spirit of Death | played | 464 | 59% (54–64) n=377 | 705 → 461 | 35% | 176 / 157 / 131 | 73% (67–79) n=206 | 53% (44–62) n=114 | 32% (23–42) n=91 |
| Les Élémens | played | 463 | 51% (46–56) n=356 | 1031 → 462 | 55% | 134 / 199 / 130 | 61% (54–68) n=189 | 47% (38–56) n=113 | 36% (27–46) n=97 |
| Maman Brigitte: Spirit of Death | attacked | 460 | 64% (58–69) n=287 | 536 → 441 | 18% | 0 / 250 / 210 | 83% (77–88) n=155 | 69% (58–78) n=77 | 48% (39–56) n=120 |
| Jackie Welles: Pour One Out For Me | called | 440 | 52% (47–56) n=440 | 440 → 440 | 0% | 160 / 224 / 56 | 63% (57–68) n=270 | 40% (32–49) n=121 | 20% (11–34) n=49 |
| Hanako Arasaka: Daughter of the Emperor | ability | 430 | 40% (34–45) n=296 | 1812 → 430 | 76% | 21 / 130 / 279 | 61% (53–68) n=148 | 40% (30–52) n=72 | 9% (5–15) n=124 |

(25 more card uses in the JSON report.)

| Decision type | Decisions | First-listed option taken | Options offered (1 / 2 / 3–5 / 6–10 / 11–20 / 21+) |
|---|---|---|---|
| main | 14094 | 9% | 0 / 1142 / 3329 / 5606 / 3768 / 249 |
| gig/rollIn | 2240 | 100% | 0 / 560 / 1680 / 0 / 0 / 0 |
| gig/steal | 2120 | 36% | 210 / 345 / 870 / 691 / 4 / 0 |
| gigValue/adjust | 1625 | 29% | 0 / 40 / 527 / 667 / 332 / 59 |
| unit/bottomdeck | 1495 | 71% | 847 / 307 / 336 / 5 / 0 / 0 |
| card/discard | 1306 | 41% | 91 / 339 / 723 / 153 / 0 / 0 |
| card/search | 1255 | 57% | 0 / 269 / 986 / 0 / 0 / 0 |
| unit/pump | 1230 | 63% | 400 / 342 / 459 / 29 / 0 / 0 |
| react | 825 | 53% | 0 / 597 / 228 / 0 / 0 / 0 |
| mulligan | 560 | 36% | 0 / 560 / 0 / 0 / 0 / 0 |
| card/freePlay | 487 | 59% | 0 / 107 / 286 / 91 / 3 / 0 |
| gig/swapGive | 430 | 37% | 23 / 38 / 213 / 156 / 0 / 0 |
| gig/swapTake | 430 | 29% | 26 / 55 / 191 / 154 / 4 / 0 |
| yesno/addToHand | 347 | 100% | 0 / 347 / 0 / 0 / 0 / 0 |
| yesno/discardFor | 324 | 100% | 0 / 324 / 0 / 0 / 0 / 0 |
| unit/weaken | 220 | 65% | 96 / 60 / 63 / 1 / 0 / 0 |
| gigValue/setGig | 204 | 12% | 0 / 1 / 21 / 16 / 53 / 113 |
| unit/cantAttack | 204 | 64% | 78 / 79 / 47 / 0 / 0 / 0 |
| mode/mode | 190 | 87% | 0 / 27 / 163 / 0 / 0 / 0 |
| unit/spend | 142 | 55% | 52 / 48 / 42 / 0 / 0 / 0 |
| unit/call | 97 | 100% | 0 / 39 / 58 / 0 / 0 / 0 |
| unit/sacrifice | 33 | 94% | 23 / 8 / 2 / 0 / 0 / 0 |
| card/discardForNothing | 30 | 0% | 0 / 4 / 21 / 5 / 0 / 0 |
| yesno/draw | 15 | 100% | 0 / 15 / 0 / 0 / 0 / 0 |
| mode/foolOnTheHill | 7 | 29% | 0 / 7 / 0 / 0 / 0 / 0 |

Reaction windows: 770 attacks. Reacted to 359 (deck won 44% (39–50) n=293): stole 151, stoleNothing 2, attackerGone 1, targetGone 201, bothGone 4. Let 411 resolve (45% (39–52) n=220): stole 302, stoleNothing 1, attackerGone 1, targetGone 100, bothGone 7. Choices: call 212, endReact 439, block 158, play 16.

## Ladder S1 #2: V / Smasher / Saburo (RRG) — 560 games, 65% won, 24418 decisions

| Card | Use | Uses | Win rate in games used (95%) | Legal turns → used | Not chosen | Early / mid / late uses | Ahead | Even | Behind |
|---|---|---|---|---|---|---|---|---|---|
| Pepe Najarro: Working Doubles | attacked | 917 | 68% (63–73) n=363 | 1067 → 837 | 22% | 111 / 345 / 461 | 81% (75–85) n=218 | 65% (57–73) n=141 | 61% (54–67) n=211 |
| Animals Wrecker | attacked | 680 | 76% (71–80) n=300 | 659 → 628 | 5% | 0 / 179 / 501 | 95% (90–97) n=168 | 79% (67–87) n=66 | 71% (64–77) n=209 |
| Synapse Burnout | sold | 504 | 64% (59–68) n=378 | 798 → 504 | 37% | 260 / 138 / 106 | 74% (68–80) n=192 | 55% (46–63) n=122 | 55% (46–64) n=112 |
| Yorinobu Arasaka: Steel Dragon | played | 494 | 67% (62–72) n=382 | 709 → 494 | 30% | 0 / 193 / 301 | 84% (77–90) n=134 | 69% (56–79) n=58 | 56% (49–62) n=228 |
| Pepe Najarro: Working Doubles | played | 486 | 64% (59–69) n=375 | 961 → 477 | 50% | 290 / 108 / 88 | 74% (67–79) n=186 | 61% (53–68) n=165 | 46% (34–57) n=68 |
| V: Streetkid | attacked | 481 | 51% (45–57) n=280 | 565 → 481 | 15% | 76 / 170 / 235 | 68% (60–75) n=165 | 43% (29–58) n=42 | 38% (30–46) n=127 |
| Yorinobu Arasaka: Steel Dragon | attacked | 464 | 78% (73–82) n=281 | 452 → 430 | 5% | 0 / 0 / 464 | 97% (92–99) n=147 | 83% (71–91) n=54 | 67% (59–74) n=155 |
| Animals Wrecker | played | 463 | 70% (65–75) n=354 | 689 → 463 | 33% | 0 / 337 / 126 | 79% (72–85) n=157 | 66% (55–76) n=71 | 65% (58–72) n=177 |
| Adam Smasher: Ender of Legends | called | 443 | 64% (59–68) n=443 | 443 → 443 | 0% | 195 / 129 / 119 | 73% (68–78) n=304 | 45% (35–56) n=82 | 40% (29–53) n=57 |
| V: Streetkid | called | 429 | 66% (61–70) n=429 | 429 → 429 | 0% | 212 / 137 / 80 | 73% (67–78) n=276 | 46% (35–56) n=83 | 63% (51–73) n=70 |
| Meredith Stout: Stone Cold Corpo | attacked | 424 | 71% (65–76) n=242 | 814 → 415 | 49% | 43 / 149 / 232 | 88% (81–92) n=140 | 71% (59–80) n=72 | 53% (43–62) n=112 |
| Saburo Arasaka: Stubborn Patriarch | called | 423 | 64% (59–68) n=423 | 423 → 423 | 0% | 190 / 129 / 104 | 73% (68–78) n=266 | 51% (40–61) n=85 | 46% (35–57) n=72 |
| Peace Offering | sold | 385 | 64% (59–69) n=304 | 1158 → 385 | 67% | 110 / 172 / 103 | 75% (67–82) n=130 | 64% (53–73) n=80 | 57% (48–65) n=130 |
| Mantis Blades | sold | 375 | 60% (55–65) n=314 | 580 → 375 | 35% | 243 / 58 / 74 | 71% (63–78) n=145 | 57% (48–65) n=125 | 38% (28–49) n=74 |
| Industrial Assembly | sold | 358 | 63% (57–68) n=295 | 1027 → 358 | 65% | 86 / 154 / 118 | 73% (64–80) n=110 | 56% (46–66) n=87 | 52% (44–61) n=130 |

(30 more card uses in the JSON report.)

| Decision type | Decisions | First-listed option taken | Options offered (1 / 2 / 3–5 / 6–10 / 11–20 / 21+) |
|---|---|---|---|
| main | 13480 | 9% | 0 / 1210 / 3588 / 5052 / 3548 / 82 |
| gig/steal | 3401 | 31% | 230 / 525 / 1468 / 1158 / 20 / 0 |
| gig/rollIn | 2240 | 0% | 0 / 560 / 1680 / 0 / 0 / 0 |
| react | 1226 | 65% | 0 / 811 / 407 / 8 / 0 / 0 |
| unit/defeat | 816 | 63% | 261 / 274 / 278 / 3 / 0 / 0 |
| mulligan | 560 | 41% | 0 / 560 / 0 / 0 / 0 / 0 |
| card/search | 552 | 60% | 147 / 176 / 200 / 29 / 0 / 0 |
| card/playFree | 439 | 84% | 0 / 236 / 202 / 1 / 0 / 0 |
| unit/equip | 423 | 83% | 76 / 103 / 211 / 33 / 0 / 0 |
| gigValue/adjust | 242 | 8% | 0 / 8 / 70 / 26 / 55 / 83 |
| unit/ready | 217 | 93% | 0 / 184 / 33 / 0 / 0 / 0 |
| gigValue/setGig | 199 | 15% | 0 / 0 / 13 / 24 / 42 / 120 |
| unit/spend | 190 | 65% | 81 / 74 / 34 / 1 / 0 / 0 |
| gig/swapGive | 140 | 41% | 0 / 5 / 116 / 18 / 1 / 0 |
| gig/swapTake | 120 | 61% | 33 / 48 / 25 / 13 / 1 / 0 |
| unit/sacrifice | 55 | 89% | 41 / 8 / 6 / 0 / 0 / 0 |
| card/discard | 41 | 54% | 9 / 8 / 19 / 5 / 0 / 0 |
| unit/pump | 34 | 85% | 17 / 14 / 3 / 0 / 0 / 0 |
| card/defeat | 24 | 96% | 22 / 2 / 0 / 0 / 0 / 0 |
| yesno/draw | 14 | 100% | 0 / 14 / 0 / 0 / 0 / 0 |
| mode/foolOnTheHill | 3 | 33% | 0 / 3 / 0 / 0 / 0 / 0 |
| mode/rivalChoice | 2 | 0% | 0 / 2 / 0 / 0 / 0 / 0 |

Reaction windows: 1104 attacks. Reacted to 394 (deck won 59% (53–64) n=300): stole 200, attackerGone 29, targetGone 137, bothGone 27, noneGone 1. Let 710 resolve (67% (62–72) n=330): stole 552, stoleNothing 3, attackerGone 6, targetGone 123, bothGone 26. Choices: endReact 796, block 134, call 251, play 45.

## Ladder S1 #3: Smasher / Dexter / Saburo (RRG) — 560 games, 68% won, 24812 decisions

| Card | Use | Uses | Win rate in games used (95%) | Legal turns → used | Not chosen | Early / mid / late uses | Ahead | Even | Behind |
|---|---|---|---|---|---|---|---|---|---|
| Pepe Najarro: Working Doubles | attacked | 939 | 70% (65–74) n=364 | 1060 → 853 | 20% | 89 / 409 / 441 | 85% (79–89) n=200 | 65% (56–73) n=128 | 64% (58–70) n=243 |
| Animals Wrecker | attacked | 755 | 76% (71–80) n=312 | 726 → 689 | 5% | 0 / 217 / 538 | 93% (88–96) n=164 | 88% (78–94) n=65 | 71% (65–76) n=232 |
| 6th Street Recruits | attacked | 559 | 71% (65–76) n=247 | 670 → 526 | 21% | 48 / 246 / 265 | 89% (82–93) n=128 | 65% (54–74) n=88 | 65% (57–73) n=144 |
| Yorinobu Arasaka: Steel Dragon | attacked | 541 | 81% (76–85) n=294 | 526 → 505 | 4% | 0 / 0 / 541 | 96% (91–98) n=161 | 90% (81–96) n=63 | 71% (64–78) n=168 |
| Dexter DeShawn: Off the Grid | ability | 540 | 62% (57–67) n=364 | 1892 → 540 | 71% | 13 / 95 / 432 | 81% (75–85) n=236 | 48% (34–62) n=48 | 32% (25–40) n=153 |
| Pepe Najarro: Working Doubles | played | 523 | 67% (62–71) n=399 | 903 → 517 | 43% | 312 / 93 / 118 | 73% (67–79) n=202 | 58% (51–66) n=168 | 59% (48–69) n=83 |
| Animals Wrecker | played | 494 | 71% (67–76) n=374 | 661 → 494 | 25% | 0 / 347 / 147 | 79% (71–85) n=145 | 78% (67–86) n=76 | 65% (58–71) n=201 |
| Yorinobu Arasaka: Steel Dragon | played | 484 | 73% (68–77) n=372 | 600 → 484 | 19% | 0 / 265 / 219 | 85% (77–90) n=125 | 79% (64–88) n=42 | 68% (62–74) n=241 |
| Saburo Arasaka: Stubborn Patriarch | called | 443 | 67% (63–71) n=443 | 443 → 443 | 0% | 227 / 115 / 101 | 75% (69–79) n=291 | 60% (48–71) n=67 | 47% (37–58) n=85 |
| Dexter DeShawn: Off the Grid | called | 441 | 70% (65–74) n=441 | 441 → 441 | 0% | 226 / 128 / 87 | 75% (70–80) n=279 | 60% (50–70) n=81 | 60% (50–70) n=81 |
| Adam Smasher: Ender of Legends | called | 436 | 70% (65–74) n=436 | 436 → 436 | 0% | 216 / 96 / 124 | 76% (71–81) n=293 | 57% (46–67) n=83 | 57% (44–68) n=60 |
| Peace Offering | sold | 417 | 70% (65–75) n=326 | 926 → 417 | 55% | 160 / 154 / 103 | 78% (70–85) n=129 | 61% (51–69) n=104 | 68% (60–75) n=145 |
| Mantis Blades | sold | 403 | 65% (60–70) n=332 | 599 → 403 | 33% | 254 / 60 / 89 | 70% (62–77) n=138 | 62% (54–70) n=145 | 56% (45–66) n=82 |
| Satori: Sword of Saburo | sold | 375 | 67% (62–72) n=305 | 978 → 375 | 62% | 115 / 140 / 120 | 72% (63–79) n=114 | 65% (54–74) n=85 | 64% (56–72) n=137 |
| Detonate | sold | 363 | 65% (59–70) n=305 | 575 → 363 | 37% | 164 / 105 / 94 | 76% (68–82) n=124 | 64% (54–73) n=97 | 57% (47–65) n=115 |

(32 more card uses in the JSON report.)

Legal but never taken: Yorinobu Arasaka: Steel Dragon (reaction, legal in 5 turns).

| Decision type | Decisions | First-listed option taken | Options offered (1 / 2 / 3–5 / 6–10 / 11–20 / 21+) |
|---|---|---|---|
| main | 13661 | 8% | 0 / 1258 / 3905 / 5606 / 2809 / 83 |
| gig/steal | 3614 | 28% | 137 / 482 / 1657 / 1331 / 7 / 0 |
| gig/rollIn | 2240 | 0% | 0 / 560 / 1680 / 0 / 0 / 0 |
| react | 1108 | 63% | 0 / 777 / 320 / 11 / 0 / 0 |
| gigValue/adjust | 675 | 13% | 0 / 0 / 7 / 46 / 403 / 219 |
| unit/defeat | 662 | 61% | 206 / 198 / 250 / 8 / 0 / 0 |
| mulligan | 560 | 21% | 0 / 560 / 0 / 0 / 0 / 0 |
| mode/mode | 527 | 62% | 0 / 527 / 0 / 0 / 0 / 0 |
| card/playFree | 438 | 70% | 0 / 187 / 248 / 3 / 0 / 0 |
| unit/equip | 379 | 84% | 47 / 105 / 186 / 41 / 0 / 0 |
| unit/pump | 342 | 66% | 149 / 110 / 82 / 1 / 0 / 0 |
| unit/spend | 163 | 68% | 86 / 47 / 30 / 0 / 0 / 0 |
| unit/ready | 127 | 100% | 0 / 127 / 0 / 0 / 0 / 0 |
| gigValue/setGig | 121 | 12% | 0 / 0 / 5 / 20 / 38 / 58 |
| unit/sacrifice | 78 | 83% | 56 / 10 / 12 / 0 / 0 / 0 |
| card/discard | 49 | 57% | 15 / 14 / 19 / 1 / 0 / 0 |
| card/search | 44 | 61% | 0 / 12 / 22 / 10 / 0 / 0 |
| card/defeat | 15 | 93% | 14 / 1 / 0 / 0 / 0 / 0 |
| yesno/draw | 7 | 100% | 0 / 7 / 0 / 0 / 0 / 0 |
| mode/foolOnTheHill | 1 | 100% | 0 / 1 / 0 / 0 / 0 / 0 |
| mode/rivalChoice | 1 | 0% | 0 / 1 / 0 / 0 / 0 / 0 |

Reaction windows: 1015 attacks. Reacted to 382 (deck won 61% (55–66) n=277): stole 188, attackerGone 28, targetGone 137, bothGone 29. Let 633 resolve (63% (57–69) n=277): stole 508, stoleNothing 2, attackerGone 5, targetGone 95, bothGone 23. Choices: endReact 693, call 250, block 140, play 25.

## Ladder S1 #4: V / Padre / Jackie (RGG) — 560 games, 64% won, 25412 decisions

| Card | Use | Uses | Win rate in games used (95%) | Legal turns → used | Not chosen | Early / mid / late uses | Ahead | Even | Behind |
|---|---|---|---|---|---|---|---|---|---|
| MaxTac AV | attacked | 813 | 71% (66–76) n=288 | 819 → 747 | 9% | 0 / 382 / 431 | 84% (78–88) n=194 | 74% (65–82) n=97 | 63% (55–70) n=160 |
| Jackie Welles: Mama's Favorite | attacked | 711 | 59% (54–64) n=375 | 771 → 711 | 8% | 0 / 277 / 434 | 78% (73–83) n=235 | 57% (45–69) n=61 | 40% (33–48) n=171 |
| MaxTac Squadron | attacked | 648 | 64% (58–69) n=306 | 786 → 592 | 25% | 73 / 269 / 306 | 85% (79–90) n=163 | 61% (52–69) n=121 | 53% (45–60) n=156 |
| Padre: Man of the Cross | ability | 546 | 50% (44–55) n=338 | 1646 → 546 | 67% | 10 / 89 / 447 | 69% (63–75) n=222 | 18% (11–28) n=77 | 14% (9–21) n=131 |
| V: Streetkid | attacked | 525 | 60% (55–65) n=306 | 619 → 525 | 15% | 53 / 156 / 316 | 75% (69–81) n=194 | 75% (63–84) n=64 | 32% (24–41) n=112 |
| MaxTac Squadron | played | 521 | 62% (58–67) n=391 | 987 → 500 | 49% | 257 / 140 / 124 | 72% (66–78) n=196 | 53% (46–61) n=171 | 52% (41–63) n=77 |
| Sandevistan | sold | 507 | 62% (57–67) n=374 | 690 → 507 | 27% | 294 / 125 / 88 | 74% (68–80) n=197 | 52% (44–60) n=149 | 40% (31–51) n=84 |
| Peace Offering | sold | 506 | 65% (60–69) n=365 | 997 → 506 | 49% | 175 / 200 / 131 | 73% (66–78) n=190 | 62% (53–70) n=125 | 55% (46–64) n=114 |
| Memory Relapse | sold | 480 | 60% (55–65) n=361 | 1471 → 480 | 67% | 85 / 175 / 220 | 66% (59–73) n=188 | 56% (46–67) n=85 | 45% (37–53) n=146 |
| Meredith Stout: Stone Cold Corpo | played | 474 | 62% (57–67) n=360 | 1350 → 461 | 66% | 149 / 120 / 205 | 79% (72–84) n=161 | 56% (48–64) n=147 | 37% (29–46) n=111 |
| MaxTac AV | played | 445 | 67% (62–71) n=348 | 709 → 445 | 37% | 216 / 110 / 119 | 74% (68–80) n=195 | 68% (60–76) n=123 | 35% (25–45) n=81 |
| Jackie Welles: Mama's Favorite | called | 421 | 62% (57–67) n=421 | 421 → 421 | 0% | 167 / 162 / 92 | 71% (66–76) n=269 | 46% (36–56) n=92 | 45% (33–58) n=60 |
| V: Streetkid | called | 413 | 63% (58–67) n=413 | 413 → 413 | 0% | 186 / 139 / 88 | 72% (67–77) n=277 | 45% (35–55) n=91 | 42% (29–57) n=45 |
| Johnny Silverhand: Never Stop Fighting | attacked | 387 | 73% (66–80) n=157 | 270 → 253 | 6% | 0 / 70 / 317 | 93% (86–97) n=99 | 79% (63–90) n=34 | 49% (38–61) n=67 |
| Jackie Welles: Mama's Favorite | Go Solo (self-paid 386) | 386 | 59% (54–64) n=386 | 809 → 386 | 52% | 0 / 214 / 172 | 74% (67–80) n=175 | 53% (39–67) n=45 | 44% (37–52) n=166 |

(35 more card uses in the JSON report.)

Legal but never taken: Jackie Welles: Mama's Favorite (Legend play, legal in 809 turns), V: Streetkid (Legend play, legal in 1017 turns).

| Decision type | Decisions | First-listed option taken | Options offered (1 / 2 / 3–5 / 6–10 / 11–20 / 21+) |
|---|---|---|---|
| main | 13591 | 7% | 0 / 1329 / 3591 / 4941 / 3657 / 73 |
| gig/steal | 2760 | 37% | 228 / 537 / 1344 / 642 / 9 / 0 |
| gig/rollIn | 2240 | 0% | 0 / 560 / 1680 / 0 / 0 / 0 |
| react | 1616 | 60% | 0 / 1026 / 581 / 9 / 0 / 0 |
| gigValue/setGig | 610 | 8% | 0 / 3 / 11 / 53 / 141 / 402 |
| unit/ready | 590 | 51% | 235 / 237 / 118 / 0 / 0 / 0 |
| mulligan | 560 | 19% | 0 / 560 / 0 / 0 / 0 / 0 |
| unit/equip | 530 | 80% | 139 / 166 / 211 / 14 / 0 / 0 |
| mode/mode | 518 | 59% | 0 / 518 / 0 / 0 / 0 / 0 |
| gig/swapGive | 444 | 35% | 0 / 9 / 339 / 95 / 1 / 0 |
| unit/defeat | 428 | 58% | 165 / 113 / 148 / 2 / 0 / 0 |
| unit/spend | 377 | 73% | 205 / 111 / 61 / 0 / 0 / 0 |
| gig/swapTake | 363 | 49% | 83 / 111 / 111 / 56 / 2 / 0 |
| yesno/replaceDefeat | 289 | 10% | 0 / 289 / 0 / 0 / 0 / 0 |
| card/search | 265 | 79% | 174 / 39 / 35 / 17 / 0 / 0 |
| gigValue/adjust | 84 | 7% | 0 / 0 / 0 / 2 / 29 / 53 |
| card/discard | 73 | 52% | 17 / 20 / 34 / 2 / 0 / 0 |
| unit/sacrifice | 55 | 80% | 37 / 10 / 8 / 0 / 0 / 0 |
| yesno/draw | 16 | 100% | 0 / 16 / 0 / 0 / 0 / 0 |
| mode/foolOnTheHill | 2 | 100% | 0 / 2 / 0 / 0 / 0 / 0 |
| mode/rivalChoice | 1 | 0% | 0 / 1 / 0 / 0 / 0 / 0 |

Reaction windows: 1402 attacks. Reacted to 540 (deck won 59% (54–64) n=383): fizzled 10, stole 198, stoleNothing 1, attackerGone 16, targetGone 276, bothGone 39. Let 862 resolve (61% (56–66) n=380): stole 620, stoleNothing 7, attackerGone 16, targetGone 186, bothGone 31, noneGone 2. Choices: ability 12, call 353, endReact 972, block 279.

## Ladder S1 #5: V / Smasher / Dum Dum (RRY) — 560 games, 68% won, 24299 decisions

| Card | Use | Uses | Win rate in games used (95%) | Legal turns → used | Not chosen | Early / mid / late uses | Ahead | Even | Behind |
|---|---|---|---|---|---|---|---|---|---|
| 6th Street Recruits | attacked | 1049 | 73% (68–77) n=400 | 1216 → 936 | 23% | 117 / 328 / 604 | 86% (81–90) n=243 | 70% (63–77) n=158 | 62% (55–68) n=223 |
| Animals Wrecker | attacked | 767 | 73% (68–77) n=330 | 733 → 695 | 5% | 0 / 200 / 567 | 92% (87–95) n=178 | 86% (75–92) n=63 | 64% (58–70) n=223 |
| Rockn' Rockerboy | attacked | 723 | 77% (72–82) n=298 | 770 → 658 | 15% | 0 / 341 / 382 | 89% (84–93) n=185 | 91% (83–96) n=78 | 68% (60–74) n=160 |
| Animals Wrecker | played | 523 | 67% (62–71) n=391 | 743 → 523 | 30% | 0 / 360 / 163 | 76% (70–82) n=187 | 75% (63–84) n=67 | 53% (46–60) n=195 |
| All is Lost | sold | 493 | 69% (64–74) n=359 | 635 → 493 | 22% | 239 / 132 / 122 | 78% (71–83) n=181 | 62% (54–70) n=140 | 63% (54–71) n=113 |
| Yorinobu Arasaka: Steel Dragon | played | 479 | 72% (67–76) n=376 | 649 → 479 | 26% | 0 / 210 / 269 | 89% (83–93) n=146 | 74% (61–83) n=57 | 59% (52–65) n=207 |
| Yorinobu Arasaka: Steel Dragon | attacked | 478 | 80% (75–84) n=281 | 508 → 443 | 13% | 0 / 0 / 478 | 94% (90–97) n=179 | 90% (78–96) n=49 | 64% (55–72) n=127 |
| 6th Street Recruits | played | 475 | 69% (65–74) n=376 | 1075 → 471 | 56% | 266 / 122 / 87 | 74% (67–80) n=174 | 67% (60–74) n=190 | 62% (50–72) n=73 |
| Rockn' Rockerboy | played | 463 | 74% (69–78) n=348 | 931 → 463 | 50% | 229 / 118 / 116 | 82% (76–87) n=208 | 72% (63–79) n=121 | 52% (42–63) n=86 |
| Industrial Assembly | sold | 455 | 66% (61–71) n=348 | 874 → 455 | 48% | 156 / 167 / 132 | 69% (61–76) n=155 | 69% (60–76) n=125 | 57% (48–65) n=122 |
| V: Streetkid | attacked | 445 | 54% (48–60) n=262 | 522 → 445 | 15% | 65 / 125 / 255 | 68% (61–74) n=171 | 51% (37–65) n=43 | 43% (34–52) n=114 |
| Zetatech Faceplate | sold | 430 | 67% (62–72) n=338 | 1002 → 430 | 57% | 130 / 168 / 132 | 75% (69–81) n=175 | 60% (50–70) n=81 | 57% (48–66) n=124 |
| Augmented Negotiators | played | 424 | 64% (59–69) n=332 | 1464 → 405 | 72% | 143 / 114 / 167 | 81% (74–86) n=157 | 50% (42–59) n=127 | 60% (50–69) n=97 |
| Mantis Blades | sold | 423 | 69% (63–73) n=337 | 603 → 423 | 30% | 267 / 73 / 83 | 76% (69–81) n=168 | 66% (57–74) n=123 | 56% (45–66) n=84 |
| Satori: Sword of Saburo | sold | 408 | 68% (62–72) n=321 | 991 → 408 | 59% | 165 / 134 / 109 | 76% (68–83) n=134 | 63% (53–71) n=110 | 59% (50–67) n=125 |

(27 more card uses in the JSON report.)

Legal but never taken: V: Streetkid (Legend play, legal in 991 turns), Adam Smasher: Ender of Legends (Legend play, legal in 275 turns), Appetite for Destruction (played, legal in 319 turns).

| Decision type | Decisions | First-listed option taken | Options offered (1 / 2 / 3–5 / 6–10 / 11–20 / 21+) |
|---|---|---|---|
| main | 13684 | 7% | 0 / 1150 / 3386 / 4892 / 4015 / 241 |
| gig/steal | 3463 | 30% | 252 / 587 / 1491 / 1122 / 11 / 0 |
| gig/rollIn | 2240 | 0% | 0 / 560 / 1680 / 0 / 0 / 0 |
| react | 1376 | 63% | 0 / 816 / 559 / 1 / 0 / 0 |
| unit/defeat | 783 | 62% | 223 / 242 / 291 / 27 / 0 / 0 |
| gigValue/adjust | 619 | 9% | 0 / 12 / 90 / 55 / 168 / 294 |
| mulligan | 560 | 37% | 0 / 560 / 0 / 0 / 0 / 0 |
| card/playFree | 454 | 77% | 0 / 180 / 272 / 2 / 0 / 0 |
| card/search | 424 | 74% | 221 / 141 / 62 / 0 / 0 / 0 |
| unit/equip | 424 | 82% | 129 / 105 / 165 / 25 / 0 / 0 |
| unit/pump | 98 | 57% | 28 / 33 / 36 / 1 / 0 / 0 |
| unit/sacrifice | 67 | 85% | 43 / 17 / 7 / 0 / 0 / 0 |
| card/defeatGear | 57 | 91% | 0 / 40 / 17 / 0 / 0 / 0 |
| card/discard | 34 | 47% | 3 / 9 / 20 / 2 / 0 / 0 |
| yesno/draw | 12 | 100% | 0 / 12 / 0 / 0 / 0 / 0 |
| mode/foolOnTheHill | 2 | 50% | 0 / 2 / 0 / 0 / 0 / 0 |
| mode/rivalChoice | 2 | 0% | 0 / 2 / 0 / 0 / 0 / 0 |

Reaction windows: 1257 attacks. Reacted to 451 (deck won 62% (57–67) n=332): stole 194, stoleNothing 1, targetGone 246, bothGone 10. Let 806 resolve (71% (66–75) n=363): stole 556, stoleNothing 4, attackerGone 5, targetGone 200, bothGone 41. Choices: call 288, block 212, endReact 870, ability 6.

## Ladder S1 #6: Dexter / V / Reyes (RRY) — 560 games, 61% won, 27797 decisions

| Card | Use | Uses | Win rate in games used (95%) | Legal turns → used | Not chosen | Early / mid / late uses | Ahead | Even | Behind |
|---|---|---|---|---|---|---|---|---|---|
| 6th Street Recruits | attacked | 933 | 62% (57–67) n=371 | 1068 → 838 | 22% | 96 / 400 / 437 | 72% (66–78) n=205 | 58% (50–66) n=145 | 57% (50–63) n=219 |
| Animals Wrecker | attacked | 740 | 72% (67–76) n=312 | 712 → 670 | 6% | 0 / 191 / 549 | 86% (80–91) n=160 | 84% (74–91) n=75 | 67% (60–72) n=221 |
| V: Streetkid | attacked | 627 | 54% (49–59) n=374 | 766 → 627 | 18% | 86 / 213 / 328 | 68% (61–73) n=226 | 55% (43–66) n=69 | 45% (37–52) n=155 |
| 6th Street Recruits | played | 560 | 62% (58–67) n=402 | 926 → 557 | 40% | 319 / 109 / 132 | 69% (63–75) n=221 | 58% (50–65) n=179 | 39% (29–50) n=77 |
| Yorinobu Arasaka: Steel Dragon | played | 533 | 65% (60–69) n=379 | 656 → 533 | 19% | 0 / 188 / 345 | 75% (68–81) n=163 | 62% (50–72) n=73 | 56% (50–63) n=215 |
| Meredith Stout: Stone Cold Corpo | attacked | 521 | 64% (59–70) n=289 | 959 → 489 | 49% | 43 / 165 / 313 | 83% (76–88) n=172 | 58% (48–67) n=97 | 46% (37–56) n=110 |
| Animals Wrecker | played | 509 | 64% (59–69) n=384 | 689 → 509 | 26% | 0 / 337 / 172 | 74% (67–80) n=171 | 60% (49–70) n=80 | 59% (52–66) n=197 |
| Yorinobu Arasaka: Steel Dragon | attacked | 487 | 71% (66–76) n=277 | 482 → 430 | 11% | 0 / 0 / 487 | 92% (86–95) n=158 | 78% (66–87) n=59 | 55% (46–63) n=141 |
| Dexter DeShawn: Off the Grid | ability | 463 | 51% (45–56) n=335 | 1702 → 463 | 73% | 12 / 69 / 382 | 72% (66–78) n=212 | 25% (16–37) n=67 | 8% (4–14) n=117 |
| Augmented Negotiators | played | 463 | 58% (53–63) n=347 | 1374 → 438 | 68% | 121 / 142 / 200 | 68% (61–75) n=161 | 52% (44–61) n=132 | 45% (36–55) n=99 |
| Industrial Assembly | sold | 463 | 58% (53–63) n=345 | 937 → 463 | 51% | 141 / 195 / 127 | 64% (56–71) n=151 | 52% (43–61) n=115 | 58% (49–66) n=130 |
| Muamar Reyes: El Capitán | ability | 462 | 49% (44–55) n=323 | 1731 → 462 | 73% | 22 / 77 / 363 | 70% (63–76) n=201 | 26% (17–38) n=61 | 13% (8–19) n=128 |
| Zetatech Faceplate | sold | 447 | 60% (55–65) n=349 | 1064 → 447 | 58% | 133 / 161 / 153 | 66% (59–72) n=181 | 55% (45–65) n=94 | 51% (42–59) n=130 |
| V: Streetkid | called | 434 | 61% (57–66) n=434 | 434 → 434 | 0% | 221 / 109 / 104 | 65% (60–70) n=309 | 60% (48–71) n=65 | 43% (32–56) n=60 |
| Meredith Stout: Stone Cold Corpo | played | 429 | 58% (53–63) n=339 | 1132 → 423 | 63% | 177 / 114 / 138 | 68% (60–75) n=158 | 52% (43–60) n=127 | 43% (34–53) n=97 |

(27 more card uses in the JSON report.)

| Decision type | Decisions | First-listed option taken | Options offered (1 / 2 / 3–5 / 6–10 / 11–20 / 21+) |
|---|---|---|---|
| main | 14544 | 9% | 0 / 1180 / 3521 / 5214 / 4412 / 217 |
| gig/steal | 3097 | 31% | 236 / 498 / 1365 / 986 / 12 / 0 |
| gig/rollIn | 2240 | 0% | 0 / 560 / 1680 / 0 / 0 / 0 |
| react | 2063 | 64% | 0 / 1360 / 688 / 15 / 0 / 0 |
| gigValue/adjust | 1452 | 9% | 0 / 8 / 103 / 124 / 789 / 428 |
| unit/defeat | 588 | 69% | 220 / 174 / 157 / 37 / 0 / 0 |
| mulligan | 560 | 20% | 0 / 560 / 0 / 0 / 0 / 0 |
| mode/mode | 514 | 68% | 0 / 514 / 0 / 0 / 0 / 0 |
| card/playFree | 512 | 60% | 0 / 124 / 352 / 36 / 0 / 0 |
| card/search | 498 | 68% | 225 / 138 / 101 / 32 / 2 / 0 |
| mode/muamarCall | 498 | 69% | 0 / 498 / 0 / 0 / 0 / 0 |
| unit/equip | 445 | 84% | 137 / 100 / 171 / 37 / 0 / 0 |
| unit/pump | 340 | 60% | 118 / 108 / 110 / 4 / 0 / 0 |
| unit/protect | 330 | 61% | 112 / 129 / 85 / 4 / 0 / 0 |
| unit/sacrifice | 45 | 82% | 32 / 6 / 7 / 0 / 0 / 0 |
| card/discard | 37 | 59% | 10 / 10 / 12 / 5 / 0 / 0 |
| yesno/draw | 13 | 100% | 0 / 13 / 0 / 0 / 0 / 0 |
| card/defeat | 12 | 100% | 9 / 2 / 1 / 0 / 0 / 0 |
| mode/foolOnTheHill | 8 | 38% | 0 / 8 / 0 / 0 / 0 / 0 |
| mode/rivalChoice | 1 | 0% | 0 / 1 / 0 / 0 / 0 / 0 |

Reaction windows: 1818 attacks. Reacted to 613 (deck won 53% (48–58) n=376): stole 155, attackerGone 27, targetGone 341, bothGone 27, noneGone 63. Let 1205 resolve (61% (56–65) n=419): stole 868, stoleNothing 3, attackerGone 13, targetGone 262, bothGone 59. Choices: endReact 1318, block 439, call 301, play 5.

## Ladder S1 #7: Dexter / V / Padre (RRG) — 560 games, 62% won, 28696 decisions

| Card | Use | Uses | Win rate in games used (95%) | Legal turns → used | Not chosen | Early / mid / late uses | Ahead | Even | Behind |
|---|---|---|---|---|---|---|---|---|---|
| Pepe Najarro: Working Doubles | attacked | 983 | 64% (59–69) n=406 | 1157 → 872 | 25% | 76 / 320 / 587 | 82% (77–87) n=232 | 64% (55–72) n=130 | 56% (50–62) n=250 |
| 6th Street Recruits | attacked | 879 | 63% (58–68) n=376 | 1072 → 792 | 26% | 84 / 288 / 507 | 80% (75–85) n=214 | 64% (55–72) n=127 | 53% (46–59) n=221 |
| Animals Wrecker | attacked | 803 | 73% (68–77) n=325 | 766 → 734 | 4% | 0 / 197 / 606 | 86% (80–90) n=164 | 85% (77–91) n=89 | 68% (62–74) n=232 |
| V: Streetkid | attacked | 624 | 56% (51–61) n=376 | 715 → 624 | 13% | 88 / 198 / 338 | 66% (60–72) n=261 | 58% (44–71) n=48 | 41% (34–49) n=150 |
| Yorinobu Arasaka: Steel Dragon | attacked | 563 | 68% (63–73) n=310 | 554 → 503 | 9% | 0 / 0 / 563 | 93% (88–96) n=176 | 82% (71–89) n=66 | 49% (41–56) n=171 |
| Animals Wrecker | played | 557 | 67% (62–71) n=405 | 798 → 557 | 30% | 0 / 347 / 210 | 75% (68–81) n=170 | 69% (59–77) n=93 | 59% (52–65) n=229 |
| Peace Offering | sold | 544 | 60% (55–64) n=395 | 905 → 544 | 40% | 241 / 166 / 137 | 64% (57–70) n=203 | 56% (48–65) n=131 | 49% (41–58) n=138 |
| Yorinobu Arasaka: Steel Dragon | played | 542 | 61% (56–66) n=398 | 663 → 542 | 18% | 0 / 197 / 345 | 72% (65–79) n=149 | 66% (53–77) n=56 | 54% (48–60) n=252 |
| Pepe Najarro: Working Doubles | played | 516 | 63% (58–68) n=385 | 1047 → 512 | 51% | 260 / 122 / 134 | 67% (60–74) n=183 | 65% (57–72) n=160 | 47% (37–56) n=101 |
| Memory Relapse | sold | 497 | 66% (61–71) n=366 | 1403 → 497 | 65% | 96 / 212 / 189 | 70% (62–77) n=154 | 68% (58–77) n=88 | 62% (55–69) n=188 |
| 6th Street Recruits | played | 493 | 61% (56–66) n=376 | 940 → 491 | 48% | 248 / 104 / 141 | 67% (60–74) n=181 | 60% (52–67) n=154 | 46% (36–56) n=96 |
| Industrial Assembly | sold | 485 | 59% (54–64) n=363 | 866 → 485 | 44% | 177 / 175 / 133 | 60% (52–68) n=142 | 61% (52–69) n=127 | 53% (45–61) n=160 |
| Satori: Sword of Saburo | sold | 475 | 61% (56–66) n=359 | 919 → 475 | 48% | 224 / 140 / 111 | 67% (60–74) n=179 | 56% (48–65) n=126 | 56% (47–65) n=117 |
| Dexter DeShawn: Off the Grid | ability | 456 | 53% (48–59) n=322 | 1844 → 456 | 75% | 10 / 50 / 396 | 75% (69–81) n=212 | 22% (14–35) n=58 | 22% (15–30) n=115 |
| Mantis Blades | sold | 429 | 59% (53–64) n=342 | 629 → 429 | 32% | 260 / 73 / 96 | 67% (59–74) n=161 | 55% (46–63) n=135 | 41% (32–52) n=87 |

(24 more card uses in the JSON report.)

Legal but never taken: V: Streetkid (Legend play, legal in 992 turns).

| Decision type | Decisions | First-listed option taken | Options offered (1 / 2 / 3–5 / 6–10 / 11–20 / 21+) |
|---|---|---|---|
| main | 15800 | 8% | 0 / 1215 / 3781 / 5353 / 5063 / 388 |
| gig/steal | 3811 | 29% | 252 / 523 / 1683 / 1335 / 18 / 0 |
| gig/rollIn | 2240 | 0% | 0 / 560 / 1680 / 0 / 0 / 0 |
| mode/mode | 1046 | 63% | 0 / 1046 / 0 / 0 / 0 / 0 |
| gigValue/adjust | 871 | 7% | 0 / 15 / 78 / 28 / 406 / 344 |
| unit/defeat | 633 | 70% | 246 / 171 / 160 / 56 / 0 / 0 |
| react | 630 | 44% | 0 / 336 / 294 / 0 / 0 / 0 |
| mulligan | 560 | 15% | 0 / 560 / 0 / 0 / 0 / 0 |
| card/playFree | 521 | 64% | 0 / 127 / 362 / 32 / 0 / 0 |
| gigValue/setGig | 492 | 9% | 1 / 1 / 7 / 35 / 112 / 336 |
| card/search | 458 | 67% | 193 / 146 / 118 / 1 / 0 / 0 |
| unit/spend | 412 | 79% | 253 / 97 / 62 / 0 / 0 / 0 |
| unit/pump | 368 | 61% | 109 / 153 / 92 / 14 / 0 / 0 |
| unit/equip | 325 | 81% | 44 / 85 / 136 / 59 / 1 / 0 |
| unit/adrenaline | 304 | 75% | 155 / 89 / 59 / 1 / 0 / 0 |
| unit/ready | 101 | 100% | 0 / 101 / 0 / 0 / 0 / 0 |
| unit/sacrifice | 60 | 73% | 36 / 9 / 14 / 1 / 0 / 0 |
| card/discard | 48 | 50% | 7 / 10 / 26 / 5 / 0 / 0 |
| yesno/draw | 10 | 100% | 0 / 10 / 0 / 0 / 0 / 0 |
| mode/foolOnTheHill | 5 | 60% | 0 / 5 / 0 / 0 / 0 / 0 |
| mode/rivalChoice | 1 | 0% | 0 / 1 / 0 / 0 / 0 / 0 |

Reaction windows: 630 attacks. Reacted to 351 (deck won 51% (45–57) n=296): stole 262, attackerGone 4, targetGone 72, bothGone 13. Let 279 resolve (58% (50–66) n=158): stole 201, attackerGone 1, targetGone 71, bothGone 6. Choices: call 351, endReact 279.

## Ladder S1 #8: Smasher / River / Viktor (RYY) — 560 games, 61% won, 26913 decisions

| Card | Use | Uses | Win rate in games used (95%) | Legal turns → used | Not chosen | Early / mid / late uses | Ahead | Even | Behind |
|---|---|---|---|---|---|---|---|---|---|
| Rockn' Rockerboy | attacked | 1023 | 65% (59–69) n=347 | 979 → 914 | 7% | 0 / 437 / 586 | 77% (71–82) n=239 | 63% (52–72) n=91 | 55% (48–62) n=191 |
| 6th Street Recruits | attacked | 853 | 67% (62–72) n=340 | 944 → 786 | 17% | 102 / 348 / 403 | 79% (73–84) n=207 | 62% (53–70) n=125 | 56% (49–63) n=173 |
| Johnny Silverhand: Never Stop Fighting | attacked | 788 | 74% (69–79) n=269 | 535 → 490 | 8% | 0 / 102 / 686 | 87% (81–91) n=185 | 77% (65–86) n=61 | 63% (55–71) n=128 |
| Mandibular Upgrade | sold | 655 | 61% (56–65) n=438 | 732 → 655 | 11% | 342 / 150 / 163 | 70% (64–76) n=238 | 49% (42–57) n=163 | 55% (46–64) n=115 |
| Sketchy Ripper | played | 573 | 59% (54–63) n=423 | 939 → 556 | 41% | 305 / 133 / 135 | 69% (64–74) n=283 | 42% (35–51) n=139 | 35% (25–48) n=62 |
| 6th Street Recruits | played | 571 | 63% (59–68) n=408 | 848 → 565 | 33% | 264 / 188 / 119 | 77% (71–82) n=220 | 52% (45–59) n=171 | 47% (37–58) n=87 |
| Rockn' Rockerboy | played | 567 | 62% (57–67) n=403 | 743 → 566 | 24% | 231 / 197 / 139 | 77% (71–82) n=234 | 49% (41–57) n=144 | 44% (35–53) n=105 |
| Sketchy Ripper | attacked | 495 | 58% (52–63) n=295 | 819 → 474 | 42% | 136 / 197 / 162 | 67% (60–74) n=186 | 45% (35–56) n=82 | 42% (33–52) n=104 |
| Johnny Silverhand: Never Stop Fighting | played | 494 | 65% (60–69) n=373 | 928 → 494 | 47% | 0 / 255 / 239 | 73% (67–79) n=221 | 60% (47–71) n=57 | 54% (47–62) n=156 |
| Adam Smasher: Ender of Legends | attacked | 462 | 57% (52–62) n=334 | 494 → 462 | 6% | 0 / 1 / 461 | 89% (83–93) n=158 | 70% (58–79) n=66 | 28% (22–35) n=173 |
| Zetatech Faceplate | sold | 428 | 60% (55–65) n=324 | 1453 → 428 | 71% | 72 / 164 / 192 | 71% (64–78) n=168 | 55% (43–66) n=73 | 49% (40–57) n=129 |
| Adam Smasher: Ender of Legends | called | 422 | 59% (54–63) n=422 | 422 → 422 | 0% | 129 / 164 / 129 | 64% (59–70) n=291 | 51% (39–63) n=65 | 42% (31–54) n=66 |
| River Ward: Detective on the Hunt | called | 420 | 60% (55–65) n=420 | 435 → 420 | 3% | 121 / 190 / 109 | 66% (61–71) n=297 | 49% (38–60) n=75 | 38% (25–52) n=48 |
| Mantis Blades | sold | 415 | 59% (54–64) n=324 | 782 → 415 | 47% | 197 / 99 / 119 | 70% (63–77) n=179 | 44% (35–53) n=108 | 43% (33–54) n=83 |
| Adrenaline Converter | played | 408 | 61% (55–66) n=337 | 961 → 390 | 59% | 108 / 178 / 122 | 72% (65–79) n=166 | 42% (33–52) n=107 | 60% (49–69) n=94 |

(31 more card uses in the JSON report.)

Legal but never taken: 6th Street Recruits (reaction, legal in 5 turns).

| Decision type | Decisions | First-listed option taken | Options offered (1 / 2 / 3–5 / 6–10 / 11–20 / 21+) |
|---|---|---|---|
| main | 14587 | 8% | 0 / 1123 / 3751 / 6400 / 3191 / 122 |
| gig/steal | 3087 | 37% | 379 / 608 / 1213 / 877 / 10 / 0 |
| gig/rollIn | 2240 | 0% | 0 / 560 / 1680 / 0 / 0 / 0 |
| unit/equip | 1642 | 71% | 299 / 326 / 873 / 144 / 0 / 0 |
| react | 1543 | 66% | 0 / 930 / 611 / 2 / 0 / 0 |
| card/search | 1292 | 73% | 0 / 527 / 762 / 3 / 0 / 0 |
| gigValue/adjust | 651 | 11% | 0 / 0 / 0 / 49 / 327 / 275 |
| mulligan | 560 | 26% | 0 / 560 / 0 / 0 / 0 / 0 |
| unit/defeat | 351 | 38% | 38 / 74 / 223 / 16 / 0 / 0 |
| card/playFree | 314 | 85% | 163 / 100 / 51 / 0 / 0 / 0 |
| card/trash | 267 | 45% | 0 / 267 / 0 / 0 / 0 / 0 |
| unit/sacrifice | 235 | 50% | 69 / 102 / 63 / 1 / 0 / 0 |
| card/discard | 47 | 55% | 11 / 6 / 25 / 5 / 0 / 0 |
| unit/call | 37 | 100% | 0 / 8 / 29 / 0 / 0 / 0 |
| unit/protect | 34 | 76% | 12 / 18 / 4 / 0 / 0 / 0 |
| yesno/call | 10 | 100% | 0 / 10 / 0 / 0 / 0 / 0 |
| yesno/draw | 10 | 100% | 0 / 10 / 0 / 0 / 0 / 0 |
| mode/foolOnTheHill | 5 | 40% | 0 / 5 / 0 / 0 / 0 / 0 |
| mode/rivalChoice | 1 | 0% | 0 / 1 / 0 / 0 / 0 / 0 |

Reaction windows: 1384 attacks. Reacted to 449 (deck won 50% (45–56) n=327): stole 232, stoleNothing 2, attackerGone 4, targetGone 172, bothGone 39. Let 935 resolve (54% (49–59) n=378): stole 737, stoleNothing 15, attackerGone 7, targetGone 135, bothGone 41. Choices: block 142, endReact 1016, ability 90, call 261, play 34.

## Ladder S1 #9: River / Reyes / Rogue (YYY) — 560 games, 43% won, 25830 decisions

| Card | Use | Uses | Win rate in games used (95%) | Legal turns → used | Not chosen | Early / mid / late uses | Ahead | Even | Behind |
|---|---|---|---|---|---|---|---|---|---|
| MaxTac Suppression Team | attacked | 758 | 48% (43–53) n=333 | 841 → 707 | 16% | 0 / 333 / 425 | 61% (54–67) n=203 | 58% (48–67) n=97 | 42% (35–49) n=178 |
| Dexter DeShawn: One Last Chance | attacked | 716 | 45% (40–51) n=322 | 913 → 672 | 26% | 94 / 293 / 329 | 57% (50–64) n=183 | 40% (32–49) n=124 | 40% (33–48) n=165 |
| Rogue Amendiares: Preem Solo | attacked | 713 | 43% (38–47) n=467 | 809 → 713 | 12% | 0 / 202 / 511 | 62% (56–68) n=246 | 46% (35–57) n=70 | 26% (21–32) n=237 |
| Muamar Reyes: El Capitán | ability | 642 | 38% (33–43) n=395 | 2179 → 642 | 71% | 62 / 102 / 478 | 54% (48–60) n=246 | 22% (15–31) n=96 | 12% (8–18) n=160 |
| Dexter DeShawn: One Last Chance | played | 615 | 43% (39–48) n=430 | 950 → 586 | 38% | 276 / 187 / 152 | 49% (43–56) n=231 | 38% (31–45) n=180 | 34% (26–44) n=103 |
| Mandibular Upgrade | sold | 615 | 41% (36–46) n=413 | 742 → 615 | 17% | 318 / 136 / 161 | 52% (45–58) n=223 | 36% (29–44) n=156 | 26% (19–35) n=119 |
| Augmented Negotiators | played | 610 | 44% (39–48) n=433 | 1360 → 580 | 57% | 151 / 206 / 253 | 59% (53–66) n=216 | 39% (32–47) n=154 | 25% (18–33) n=136 |
| MaxTac Suppression Team | played | 581 | 44% (39–49) n=422 | 1008 → 580 | 42% | 193 / 172 / 216 | 55% (49–62) n=240 | 39% (31–48) n=132 | 23% (16–31) n=132 |
| Safety Override | sold | 526 | 44% (39–49) n=388 | 1017 → 526 | 48% | 197 / 183 / 146 | 49% (42–56) n=177 | 43% (35–52) n=127 | 32% (25–40) n=144 |
| The Heist | sold | 492 | 43% (38–48) n=358 | 953 → 492 | 48% | 159 / 202 / 131 | 53% (46–61) n=171 | 36% (28–45) n=128 | 29% (22–38) n=127 |
| Rogue Amendiares: Preem Solo | Go Solo (self-paid 488) | 488 | 42% (37–46) n=488 | 823 → 488 | 41% | 0 / 233 / 255 | 57% (50–63) n=218 | 34% (23–47) n=53 | 28% (23–34) n=217 |
| Rogue Amendiares: Preem Solo | called | 484 | 43% (39–47) n=484 | 484 → 484 | 0% | 286 / 153 / 45 | 50% (44–55) n=317 | 30% (22–38) n=121 | 30% (19–45) n=46 |
| River Ward: Detective on the Hunt | called | 461 | 43% (39–48) n=461 | 461 → 461 | 0% | 248 / 115 / 98 | 52% (46–58) n=264 | 34% (26–42) n=140 | 25% (15–37) n=57 |
| Muamar Reyes: El Capitán | called | 449 | 43% (39–48) n=449 | 449 → 449 | 0% | 271 / 112 / 66 | 51% (45–57) n=265 | 32% (25–40) n=145 | 33% (21–49) n=39 |
| Zetatech Faceplate | sold | 445 | 43% (38–48) n=345 | 1389 → 445 | 68% | 56 / 216 / 173 | 57% (50–65) n=166 | 38% (28–50) n=78 | 29% (22–37) n=145 |

(29 more card uses in the JSON report.)

| Decision type | Decisions | First-listed option taken | Options offered (1 / 2 / 3–5 / 6–10 / 11–20 / 21+) |
|---|---|---|---|
| main | 13873 | 9% | 0 / 1189 / 3513 / 5476 / 3601 / 94 |
| gig/steal | 2649 | 34% | 226 / 506 / 1138 / 768 / 11 / 0 |
| gig/rollIn | 2240 | 0% | 0 / 560 / 1680 / 0 / 0 / 0 |
| gigValue/adjust | 2210 | 23% | 0 / 0 / 192 / 389 / 1203 / 426 |
| react | 1848 | 66% | 0 / 1199 / 645 / 4 / 0 / 0 |
| unit/equip | 781 | 78% | 16 / 227 / 517 / 21 / 0 / 0 |
| mulligan | 560 | 37% | 0 / 560 / 0 / 0 / 0 / 0 |
| mode/muamarCall | 536 | 54% | 0 / 536 / 0 / 0 / 0 / 0 |
| unit/protect | 311 | 65% | 138 / 112 / 61 / 0 / 0 / 0 |
| card/trash | 258 | 48% | 0 / 258 / 0 / 0 / 0 / 0 |
| card/playFree | 236 | 91% | 165 / 47 / 24 / 0 / 0 / 0 |
| unit/sacrifice | 190 | 67% | 80 / 72 / 38 / 0 / 0 / 0 |
| card/search | 52 | 77% | 24 / 22 / 6 / 0 / 0 / 0 |
| card/discard | 41 | 41% | 4 / 11 / 25 / 1 / 0 / 0 |
| yesno/playFree | 32 | 100% | 0 / 32 / 0 / 0 / 0 / 0 |
| yesno/draw | 10 | 100% | 0 / 10 / 0 / 0 / 0 / 0 |
| mode/rivalChoice | 2 | 0% | 0 / 2 / 0 / 0 / 0 / 0 |
| mode/foolOnTheHill | 1 | 100% | 0 / 1 / 0 / 0 / 0 / 0 |

Reaction windows: 1626 attacks. Reacted to 520 (deck won 39% (34–45) n=348): stole 192, stoleNothing 2, attackerGone 8, targetGone 219, bothGone 69, noneGone 30. Let 1106 resolve (40% (35–45) n=400): stole 899, stoleNothing 6, attackerGone 6, targetGone 170, bothGone 25. Choices: call 232, ability 80, endReact 1211, block 269, play 56.

## Ladder: Dexter / V / Wakako (RRB) — 560 games, 55% won, 28136 decisions

| Card | Use | Uses | Win rate in games used (95%) | Legal turns → used | Not chosen | Early / mid / late uses | Ahead | Even | Behind |
|---|---|---|---|---|---|---|---|---|---|
| 6th Street Recruits | attacked | 962 | 57% (52–62) n=383 | 1110 → 853 | 23% | 75 / 311 / 576 | 76% (70–82) n=208 | 64% (55–72) n=127 | 45% (39–51) n=236 |
| Psycho Squad | attacked | 824 | 58% (52–63) n=365 | 995 → 754 | 24% | 74 / 274 / 476 | 73% (66–79) n=188 | 56% (47–64) n=127 | 50% (43–57) n=220 |
| Animals Wrecker | attacked | 761 | 64% (59–69) n=322 | 736 → 701 | 5% | 0 / 195 / 566 | 84% (77–89) n=145 | 89% (81–94) n=84 | 55% (49–62) n=240 |
| V: Streetkid | attacked | 654 | 53% (48–58) n=396 | 755 → 654 | 13% | 55 / 142 / 457 | 69% (63–74) n=255 | 66% (54–77) n=62 | 33% (26–40) n=174 |
| Wakako Okada: Peace and Harmony | ability | 597 | 47% (42–52) n=379 | 1814 → 597 | 67% | 27 / 75 / 495 | 67% (61–72) n=248 | 20% (13–30) n=80 | 9% (5–15) n=142 |
| Dexter DeShawn: Off the Grid | ability | 563 | 50% (45–55) n=378 | 1819 → 563 | 69% | 21 / 65 / 477 | 71% (65–77) n=243 | 23% (15–34) n=73 | 12% (8–19) n=138 |
| Yorinobu Arasaka: Steel Dragon | attacked | 547 | 63% (57–68) n=294 | 546 → 495 | 9% | 0 / 0 / 547 | 87% (81–92) n=151 | 82% (70–90) n=55 | 45% (38–53) n=170 |
| Yorinobu Arasaka: Steel Dragon | played | 522 | 57% (52–62) n=384 | 610 → 522 | 14% | 0 / 211 / 311 | 70% (62–77) n=131 | 61% (48–73) n=54 | 48% (42–54) n=245 |
| Nocturne OP55 N1 | sold | 503 | 56% (51–61) n=393 | 994 → 503 | 49% | 197 / 195 / 111 | 62% (55–69) n=180 | 54% (45–63) n=124 | 52% (44–60) n=141 |
| Animals Wrecker | played | 501 | 61% (56–66) n=385 | 648 → 501 | 23% | 0 / 340 / 161 | 75% (68–81) n=153 | 69% (59–78) n=84 | 48% (41–55) n=203 |
| 6th Street Recruits | played | 497 | 56% (51–61) n=368 | 1028 → 495 | 52% | 245 / 112 / 140 | 60% (53–67) n=168 | 58% (50–66) n=149 | 42% (33–51) n=114 |
| Psycho Squad | played | 461 | 55% (50–60) n=352 | 983 → 458 | 53% | 219 / 108 / 134 | 65% (57–72) n=168 | 53% (45–61) n=148 | 34% (25–44) n=86 |
| Bonnie and Clyde | sold | 458 | 54% (48–59) n=350 | 1460 → 458 | 69% | 78 / 158 / 222 | 60% (52–68) n=149 | 62% (51–72) n=79 | 45% (38–52) n=185 |
| V: Streetkid | called | 444 | 55% (50–59) n=444 | 444 → 444 | 0% | 209 / 85 / 150 | 61% (56–67) n=290 | 46% (35–57) n=74 | 39% (29–50) n=80 |
| V: Streetkid | Go Solo (self-paid 425) | 425 | 53% (48–58) n=425 | 1071 → 425 | 60% | 59 / 78 / 288 | 70% (63–75) n=210 | 55% (40–69) n=42 | 32% (26–40) n=173 |

(33 more card uses in the JSON report.)

| Decision type | Decisions | First-listed option taken | Options offered (1 / 2 / 3–5 / 6–10 / 11–20 / 21+) |
|---|---|---|---|
| main | 15681 | 7% | 0 / 1240 / 4041 / 5778 / 4387 / 235 |
| gig/steal | 3748 | 28% | 215 / 485 / 1628 / 1402 / 18 / 0 |
| gig/rollIn | 2240 | 0% | 0 / 560 / 1680 / 0 / 0 / 0 |
| gigValue/adjust | 1432 | 6% | 0 / 2 / 15 / 81 / 838 / 496 |
| mode/mode | 1117 | 77% | 0 / 1040 / 77 / 0 / 0 / 0 |
| react | 697 | 52% | 0 / 384 / 313 / 0 / 0 / 0 |
| mulligan | 560 | 15% | 0 / 560 / 0 / 0 / 0 / 0 |
| unit/defeat | 534 | 73% | 260 / 135 / 118 / 21 / 0 / 0 |
| card/playFree | 494 | 69% | 0 / 127 / 342 / 25 / 0 / 0 |
| unit/pump | 434 | 52% | 112 / 143 / 165 / 14 / 0 / 0 |
| unit/weaken | 425 | 72% | 176 / 140 / 104 / 5 / 0 / 0 |
| card/search | 382 | 82% | 211 / 124 / 47 / 0 / 0 / 0 |
| unit/equip | 189 | 84% | 43 / 68 / 58 / 20 / 0 / 0 |
| unit/cantAttack | 66 | 73% | 29 / 16 / 21 / 0 / 0 / 0 |
| card/discard | 45 | 47% | 11 / 10 / 22 / 2 / 0 / 0 |
| unit/sacrifice | 38 | 79% | 23 / 8 / 7 / 0 / 0 / 0 |
| yesno/draw | 23 | 100% | 0 / 23 / 0 / 0 / 0 / 0 |
| unit/call | 20 | 100% | 0 / 7 / 13 / 0 / 0 / 0 |
| mode/foolOnTheHill | 8 | 50% | 0 / 8 / 0 / 0 / 0 / 0 |
| mode/rivalChoice | 3 | 0% | 0 / 3 / 0 / 0 / 0 / 0 |

Reaction windows: 681 attacks. Reacted to 326 (deck won 47% (41–53) n=275): stole 249, stoleNothing 4, attackerGone 4, targetGone 52, bothGone 17. Let 355 resolve (58% (51–65) n=183): stole 259, stoleNothing 1, targetGone 92, bothGone 3. Choices: call 316, endReact 362, play 19.

## Ladder: Jackie / Alt / Hanako (BBG) — 560 games, 60% won, 27768 decisions

| Card | Use | Uses | Win rate in games used (95%) | Legal turns → used | Not chosen | Early / mid / late uses | Ahead | Even | Behind |
|---|---|---|---|---|---|---|---|---|---|
| Psycho Squad | attacked | 976 | 62% (57–67) n=397 | 1008 → 862 | 14% | 97 / 387 / 492 | 76% (70–81) n=258 | 56% (48–65) n=131 | 46% (39–53) n=189 |
| Psycho Squad | played | 684 | 61% (57–66) n=454 | 1074 → 666 | 38% | 247 / 247 / 190 | 73% (67–78) n=280 | 50% (43–58) n=165 | 37% (28–46) n=115 |
| Valentino Street Racer | played | 667 | 62% (57–66) n=445 | 1261 → 596 | 53% | 126 / 314 / 227 | 73% (68–78) n=273 | 47% (39–55) n=132 | 44% (35–53) n=112 |
| Alt Cunningham: Soulkiller Architect | ability | 656 | 56% (52–61) n=421 | 1924 → 652 | 66% | 6 / 172 / 478 | 72% (66–77) n=289 | 41% (30–53) n=66 | 20% (15–27) n=170 |
| Valentino Street Racer | attacked | 650 | 64% (58–68) n=340 | 765 → 579 | 24% | 37 / 218 / 395 | 80% (74–85) n=229 | 61% (51–71) n=90 | 45% (37–54) n=133 |
| Floor It | sold | 564 | 58% (53–63) n=399 | 785 → 564 | 28% | 267 / 105 / 192 | 71% (65–77) n=201 | 52% (44–59) n=166 | 39% (30–48) n=103 |
| Maman Brigitte: Spirit of Death | attacked | 561 | 65% (59–70) n=291 | 680 → 526 | 23% | 0 / 241 / 320 | 81% (74–85) n=200 | 70% (59–79) n=80 | 39% (29–49) n=93 |
| Maman Brigitte: Spirit of Death | played | 547 | 64% (59–68) n=402 | 1067 → 544 | 49% | 194 / 161 / 192 | 74% (68–79) n=242 | 59% (50–67) n=129 | 41% (32–51) n=107 |
| Hanako Arasaka: Daughter of the Emperor | ability | 542 | 48% (43–54) n=347 | 1862 → 542 | 71% | 13 / 189 / 340 | 70% (64–76) n=203 | 24% (16–34) n=76 | 16% (11–22) n=158 |
| Hanako Arasaka: Daughter of the Emperor | called | 451 | 63% (58–67) n=451 | 451 → 451 | 0% | 187 / 219 / 45 | 67% (62–72) n=351 | 49% (37–60) n=70 | 43% (27–61) n=30 |
| Jackie Welles: Pour One Out For Me | called | 439 | 65% (60–69) n=439 | 439 → 439 | 0% | 200 / 198 / 41 | 68% (63–73) n=329 | 59% (47–69) n=70 | 48% (33–63) n=40 |
| Alt Cunningham: Soulkiller Architect | called | 435 | 62% (57–66) n=435 | 435 → 435 | 0% | 199 / 200 / 36 | 68% (63–73) n=320 | 50% (39–61) n=78 | 32% (20–49) n=37 |
| Pyramid Song | sold | 392 | 58% (52–63) n=312 | 1131 → 392 | 65% | 89 / 175 / 128 | 71% (64–77) n=182 | 49% (39–60) n=79 | 39% (30–50) n=89 |
| Placide: Voodoo Sentinel | played | 383 | 61% (55–66) n=324 | 433 → 383 | 12% | 0 / 0 / 383 | 85% (79–90) n=165 | 71% (58–82) n=52 | 30% (23–38) n=141 |
| Chrome Reverie | sold | 348 | 62% (56–67) n=297 | 568 → 348 | 39% | 167 / 75 / 106 | 69% (61–75) n=169 | 58% (47–68) n=83 | 42% (31–54) n=66 |

(30 more card uses in the JSON report.)

| Decision type | Decisions | First-listed option taken | Options offered (1 / 2 / 3–5 / 6–10 / 11–20 / 21+) |
|---|---|---|---|
| main | 13640 | 7% | 0 / 1255 / 3618 / 5195 / 3437 / 135 |
| gig/steal | 2646 | 33% | 136 / 586 / 1338 / 580 / 6 / 0 |
| gig/rollIn | 2240 | 100% | 0 / 560 / 1680 / 0 / 0 / 0 |
| unit/bottomdeck | 1270 | 72% | 742 / 283 / 240 / 5 / 0 / 0 |
| card/discard | 1231 | 53% | 155 / 498 / 546 / 32 / 0 / 0 |
| gigValue/adjust | 1226 | 27% | 0 / 44 / 358 / 425 / 367 / 32 |
| card/search | 785 | 59% | 0 / 169 / 616 / 0 / 0 / 0 |
| gig/swapGive | 740 | 38% | 7 / 61 / 409 / 261 / 2 / 0 |
| gig/swapTake | 704 | 36% | 60 / 132 / 305 / 205 / 2 / 0 |
| mulligan | 560 | 29% | 0 / 560 / 0 / 0 / 0 / 0 |
| react | 556 | 45% | 0 / 362 / 194 / 0 / 0 / 0 |
| unit/adrenaline | 499 | 59% | 210 / 194 / 95 / 0 / 0 / 0 |
| card/playFromTrash | 435 | 55% | 169 / 118 / 139 / 9 / 0 / 0 |
| yesno/discardFor | 392 | 99% | 0 / 392 / 0 / 0 / 0 / 0 |
| unit/ready | 184 | 100% | 0 / 119 / 65 / 0 / 0 / 0 |
| unit/weaken | 146 | 67% | 57 / 48 / 41 / 0 / 0 / 0 |
| mode/mode | 88 | 91% | 0 / 9 / 79 / 0 / 0 / 0 |
| unit/cantAttack | 83 | 66% | 33 / 36 / 13 / 1 / 0 / 0 |
| unit/spend | 83 | 61% | 30 / 38 / 15 / 0 / 0 / 0 |
| unit/sacrifice | 63 | 87% | 45 / 14 / 4 / 0 / 0 / 0 |
| unit/bottomdeckOwn | 49 | 76% | 25 / 18 / 6 / 0 / 0 / 0 |
| gigValue/setGig | 42 | 12% | 0 / 2 / 2 / 6 / 6 / 26 |
| unit/equip | 36 | 78% | 3 / 3 / 17 / 13 / 0 / 0 |
| unit/call | 27 | 100% | 0 / 15 / 12 / 0 / 0 / 0 |
| card/discardForNothing | 25 | 0% | 0 / 10 / 11 / 4 / 0 / 0 |
| yesno/draw | 9 | 100% | 0 / 9 / 0 / 0 / 0 / 0 |
| mode/foolOnTheHill | 7 | 43% | 0 / 7 / 0 / 0 / 0 / 0 |
| mode/rivalChoice | 2 | 0% | 0 / 2 / 0 / 0 / 0 / 0 |

Reaction windows: 542 attacks. Reacted to 296 (deck won 48% (42–54) n=258): stole 231, attackerGone 1, targetGone 51, bothGone 13. Let 246 resolve (46% (38–54) n=143): stole 167, targetGone 74, bothGone 5. Choices: call 264, endReact 248, play 44.

## Ladder: Smasher / River / Viktor (RYY) — 560 games, 41% won, 23726 decisions

| Card | Use | Uses | Win rate in games used (95%) | Legal turns → used | Not chosen | Early / mid / late uses | Ahead | Even | Behind |
|---|---|---|---|---|---|---|---|---|---|
| 6th Street Recruits | attacked | 741 | 45% (40–51) n=329 | 864 → 668 | 23% | 74 / 287 / 380 | 66% (58–73) n=142 | 40% (32–50) n=109 | 40% (33–46) n=209 |
| 6th Street Recruits | played | 571 | 42% (37–46) n=404 | 902 → 553 | 39% | 271 / 129 / 171 | 53% (46–60) n=183 | 34% (27–42) n=154 | 33% (26–41) n=136 |
| Jackie Welles: Ride or Die Choom | attacked | 554 | 54% (49–60) n=285 | 525 → 509 | 3% | 0 / 114 / 440 | 85% (77–91) n=103 | 71% (59–80) n=69 | 47% (40–54) n=199 |
| Dexter DeShawn: One Last Chance | attacked | 553 | 41% (36–47) n=304 | 685 → 493 | 28% | 33 / 171 / 349 | 63% (54–71) n=126 | 51% (40–62) n=78 | 32% (26–39) n=189 |
| Dexter DeShawn: One Last Chance | played | 541 | 40% (35–45) n=394 | 1070 → 506 | 53% | 168 / 235 / 138 | 48% (41–55) n=171 | 40% (32–49) n=137 | 32% (25–39) n=160 |
| Jackie Welles: Ride or Die Choom | played | 527 | 44% (39–49) n=393 | 917 → 527 | 43% | 0 / 284 / 243 | 62% (54–70) n=143 | 37% (26–50) n=59 | 35% (29–41) n=248 |
| Gorilla Arms | sold | 469 | 41% (36–46) n=361 | 954 → 469 | 51% | 206 / 125 / 138 | 53% (46–60) n=179 | 36% (28–46) n=105 | 28% (21–36) n=138 |
| Kerry Eurodyne: The Last Rockerboy | played | 454 | 38% (33–43) n=350 | 1355 → 444 | 67% | 114 / 161 / 179 | 56% (48–64) n=137 | 23% (16–32) n=109 | 27% (21–34) n=160 |
| River Ward: Detective on the Hunt | called | 450 | 44% (39–48) n=450 | 463 → 450 | 3% | 243 / 122 / 85 | 52% (46–57) n=293 | 36% (26–48) n=72 | 22% (15–32) n=85 |
| Zetatech Faceplate | sold | 438 | 40% (35–45) n=359 | 856 → 438 | 49% | 103 / 197 / 138 | 53% (45–61) n=130 | 35% (26–45) n=91 | 34% (27–41) n=176 |
| Adam Smasher: Ender of Legends | called | 437 | 44% (40–49) n=437 | 437 → 437 | 0% | 221 / 123 / 93 | 52% (47–58) n=288 | 32% (23–44) n=71 | 26% (17–36) n=78 |
| MaxTac Suppression Team | attacked | 428 | 45% (39–52) n=227 | 518 → 412 | 20% | 0 / 181 / 247 | 69% (60–77) n=109 | 50% (37–63) n=50 | 39% (31–47) n=139 |
| Adam Smasher: Ender of Legends | attacked | 413 | 43% (38–48) n=324 | 438 → 413 | 6% | 0 / 0 / 413 | 90% (83–94) n=108 | 67% (53–79) n=46 | 19% (14–25) n=204 |
| Viktor Vektor: Sit Down and Relax | called | 413 | 43% (39–48) n=413 | 434 → 413 | 5% | 207 / 126 / 80 | 52% (46–57) n=264 | 30% (20–41) n=71 | 28% (19–39) n=78 |
| Over the Edge | sold | 397 | 43% (37–48) n=306 | 1451 → 397 | 73% | 36 / 173 / 188 | 56% (46–65) n=95 | 42% (30–56) n=52 | 36% (29–43) n=192 |

(33 more card uses in the JSON report.)

Legal but never taken: Adam Smasher: Ender of Legends (Legend play, legal in 362 turns), Safety Override (played, legal in 511 turns).

| Decision type | Decisions | First-listed option taken | Options offered (1 / 2 / 3–5 / 6–10 / 11–20 / 21+) |
|---|---|---|---|
| main | 13648 | 8% | 0 / 1100 / 3539 / 5450 / 3401 / 158 |
| gig/steal | 2941 | 26% | 125 / 373 / 1156 / 1268 / 19 / 0 |
| gig/rollIn | 2240 | 0% | 0 / 560 / 1680 / 0 / 0 / 0 |
| gigValue/adjust | 1439 | 16% | 0 / 1 / 91 / 215 / 812 / 320 |
| react | 1242 | 74% | 0 / 749 / 493 / 0 / 0 / 0 |
| mulligan | 560 | 13% | 0 / 560 / 0 / 0 / 0 / 0 |
| unit/defeat | 400 | 39% | 34 / 78 / 244 / 43 / 1 / 0 |
| unit/equip | 359 | 72% | 35 / 73 / 211 / 40 / 0 / 0 |
| card/search | 269 | 91% | 5 / 219 / 45 / 0 / 0 / 0 |
| unit/sacrifice | 196 | 62% | 71 / 63 / 61 / 1 / 0 / 0 |
| card/playFree | 137 | 98% | 125 / 12 / 0 / 0 / 0 / 0 |
| card/trash | 108 | 56% | 0 / 108 / 0 / 0 / 0 / 0 |
| card/discard | 105 | 75% | 12 / 55 / 34 / 4 / 0 / 0 |
| unit/call | 38 | 84% | 0 / 21 / 17 / 0 / 0 / 0 |
| unit/protect | 24 | 83% | 5 / 15 / 4 / 0 / 0 / 0 |
| yesno/draw | 17 | 100% | 0 / 17 / 0 / 0 / 0 / 0 |
| yesno/playFree | 2 | 100% | 0 / 2 / 0 / 0 / 0 / 0 |
| mode/foolOnTheHill | 1 | 100% | 0 / 1 / 0 / 0 / 0 / 0 |

Reaction windows: 1177 attacks. Reacted to 308 (deck won 30% (25–36) n=270): stole 223, stoleNothing 1, attackerGone 3, targetGone 54, bothGone 27. Let 869 resolve (38% (33–43) n=331): stole 638, stoleNothing 14, targetGone 196, bothGone 21. Choices: endReact 915, call 250, ability 53, play 24.

## Ladder: V / Smasher / Padre (RRG) — 560 games, 65% won, 26294 decisions

| Card | Use | Uses | Win rate in games used (95%) | Legal turns → used | Not chosen | Early / mid / late uses | Ahead | Even | Behind |
|---|---|---|---|---|---|---|---|---|---|
| Pepe Najarro: Working Doubles | attacked | 792 | 64% (59–69) n=361 | 933 → 707 | 24% | 67 / 233 / 492 | 83% (78–88) n=198 | 63% (54–71) n=111 | 54% (47–60) n=201 |
| 6th Street Recruits | attacked | 707 | 65% (60–70) n=331 | 862 → 643 | 25% | 65 / 227 / 415 | 79% (73–84) n=188 | 63% (54–72) n=109 | 59% (52–66) n=177 |
| MaxTac AV | attacked | 699 | 70% (65–75) n=306 | 774 → 641 | 17% | 0 / 326 / 373 | 80% (74–85) n=206 | 82% (73–89) n=85 | 66% (58–73) n=141 |
| Animals Wrecker | attacked | 693 | 72% (67–77) n=306 | 659 → 624 | 5% | 0 / 188 / 505 | 84% (78–89) n=165 | 82% (72–88) n=88 | 66% (59–72) n=182 |
| Bonnie and Clyde | sold | 517 | 65% (60–70) n=375 | 1338 → 517 | 61% | 113 / 211 / 193 | 72% (66–78) n=189 | 64% (54–73) n=92 | 57% (49–65) n=159 |
| Valentino Street Racer | attacked | 499 | 64% (58–70) n=265 | 657 → 443 | 33% | 13 / 121 / 365 | 82% (75–87) n=142 | 70% (59–78) n=86 | 51% (43–59) n=133 |
| Yorinobu Arasaka: Steel Dragon | attacked | 468 | 74% (69–79) n=270 | 484 → 435 | 10% | 0 / 0 / 468 | 89% (84–93) n=167 | 85% (72–92) n=52 | 59% (51–67) n=128 |
| Animals Wrecker | played | 467 | 68% (63–73) n=361 | 676 → 467 | 31% | 0 / 333 / 134 | 76% (69–82) n=154 | 77% (67–85) n=75 | 61% (54–68) n=189 |
| 6th Street Recruits | played | 462 | 63% (58–68) n=356 | 1151 → 456 | 60% | 190 / 115 / 157 | 73% (65–79) n=157 | 61% (53–69) n=149 | 52% (43–62) n=103 |
| Pepe Najarro: Working Doubles | played | 461 | 63% (57–67) n=350 | 1185 → 452 | 62% | 186 / 130 / 145 | 70% (62–76) n=162 | 60% (52–68) n=140 | 46% (37–55) n=107 |
| MaxTac AV | played | 455 | 68% (63–73) n=351 | 777 → 455 | 41% | 236 / 90 / 129 | 77% (71–83) n=185 | 62% (54–70) n=127 | 57% (47–66) n=98 |
| Yorinobu Arasaka: Steel Dragon | played | 455 | 67% (62–72) n=357 | 565 → 455 | 19% | 0 / 204 / 251 | 79% (72–85) n=156 | 71% (59–81) n=59 | 56% (49–63) n=188 |
| Valentino Street Racer | played | 453 | 63% (58–68) n=336 | 1414 → 420 | 70% | 98 / 156 / 199 | 75% (68–81) n=167 | 56% (47–65) n=103 | 50% (41–59) n=113 |
| Over the Edge | sold | 449 | 60% (55–65) n=341 | 1178 → 449 | 62% | 99 / 184 / 166 | 69% (61–76) n=142 | 57% (48–66) n=105 | 52% (44–60) n=156 |
| V: Streetkid | called | 424 | 67% (62–71) n=424 | 424 → 424 | 0% | 167 / 128 / 129 | 70% (65–75) n=292 | 59% (47–70) n=66 | 59% (47–70) n=66 |

(32 more card uses in the JSON report.)

Legal but never taken: V: Streetkid (Legend play, legal in 1112 turns).

| Decision type | Decisions | First-listed option taken | Options offered (1 / 2 / 3–5 / 6–10 / 11–20 / 21+) |
|---|---|---|---|
| main | 14495 | 7% | 0 / 1292 / 3702 / 5107 / 4105 / 289 |
| gig/steal | 3827 | 30% | 229 / 568 / 1800 / 1209 / 21 / 0 |
| gig/rollIn | 2240 | 0% | 0 / 560 / 1680 / 0 / 0 / 0 |
| react | 642 | 52% | 0 / 332 / 310 / 0 / 0 / 0 |
| mulligan | 560 | 21% | 0 / 560 / 0 / 0 / 0 / 0 |
| unit/defeat | 557 | 63% | 164 / 171 / 199 / 23 / 0 / 0 |
| mode/mode | 500 | 56% | 0 / 500 / 0 / 0 / 0 / 0 |
| gig/swapGive | 450 | 36% | 0 / 25 / 332 / 91 / 2 / 0 |
| card/playFree | 435 | 66% | 0 / 106 / 299 / 30 / 0 / 0 |
| unit/adrenaline | 401 | 58% | 166 / 133 / 102 / 0 / 0 / 0 |
| gigValue/setGig | 390 | 7% | 0 / 0 / 1 / 27 / 96 / 266 |
| gig/swapTake | 369 | 51% | 86 / 106 / 119 / 58 / 0 / 0 |
| card/search | 338 | 84% | 211 / 106 / 21 / 0 / 0 / 0 |
| unit/spend | 300 | 84% | 187 / 83 / 30 / 0 / 0 / 0 |
| unit/ready | 257 | 93% | 0 / 202 / 55 / 0 / 0 / 0 |
| gigValue/adjust | 219 | 3% | 0 / 0 / 0 / 0 / 15 / 204 |
| unit/equip | 135 | 77% | 18 / 37 / 56 / 24 / 0 / 0 |
| unit/sacrifice | 62 | 85% | 40 / 8 / 13 / 1 / 0 / 0 |
| card/discard | 45 | 42% | 11 / 7 / 26 / 1 / 0 / 0 |
| unit/pump | 38 | 84% | 21 / 9 / 8 / 0 / 0 / 0 |
| yesno/draw | 19 | 100% | 0 / 19 / 0 / 0 / 0 / 0 |
| card/defeat | 6 | 100% | 5 / 1 / 0 / 0 / 0 / 0 |
| mode/foolOnTheHill | 6 | 67% | 0 / 6 / 0 / 0 / 0 / 0 |
| mode/rivalChoice | 3 | 0% | 0 / 3 / 0 / 0 / 0 / 0 |

Reaction windows: 641 attacks. Reacted to 310 (deck won 52% (46–58) n=273): stole 234, targetGone 62, bothGone 14. Let 331 resolve (63% (56–70) n=189): stole 223, stoleNothing 1, targetGone 99, bothGone 8. Choices: call 308, endReact 331, play 3.

## Ladder: V / Smasher / Saburo (RRG) — 560 games, 68% won, 24940 decisions

| Card | Use | Uses | Win rate in games used (95%) | Legal turns → used | Not chosen | Early / mid / late uses | Ahead | Even | Behind |
|---|---|---|---|---|---|---|---|---|---|
| Pepe Najarro: Working Doubles | attacked | 813 | 67% (62–72) n=350 | 964 → 736 | 24% | 61 / 278 / 474 | 82% (76–86) n=211 | 63% (53–71) n=107 | 59% (53–66) n=202 |
| 6th Street Recruits | attacked | 723 | 68% (63–73) n=338 | 890 → 656 | 26% | 63 / 227 / 433 | 80% (73–85) n=187 | 65% (55–74) n=98 | 63% (56–69) n=206 |
| Animals Wrecker | attacked | 717 | 74% (69–79) n=291 | 679 → 651 | 4% | 0 / 183 / 534 | 86% (80–91) n=162 | 78% (67–86) n=76 | 69% (63–75) n=196 |
| Memory Relapse | sold | 533 | 71% (66–75) n=394 | 951 → 533 | 44% | 186 / 209 / 138 | 76% (69–81) n=184 | 67% (58–75) n=118 | 65% (57–72) n=158 |
| Bonnie and Clyde | sold | 498 | 66% (61–71) n=381 | 1326 → 498 | 62% | 107 / 198 / 193 | 73% (66–79) n=159 | 61% (51–71) n=93 | 61% (54–67) n=191 |
| Yorinobu Arasaka: Steel Dragon | played | 495 | 70% (66–75) n=381 | 593 → 495 | 17% | 0 / 201 / 294 | 78% (71–84) n=139 | 73% (61–82) n=66 | 63% (57–69) n=230 |
| Yorinobu Arasaka: Steel Dragon | attacked | 488 | 78% (73–83) n=287 | 485 → 454 | 6% | 0 / 0 / 488 | 93% (88–96) n=153 | 94% (85–98) n=64 | 68% (61–75) n=158 |
| V: Streetkid | attacked | 479 | 60% (54–65) n=283 | 571 → 479 | 16% | 57 / 125 / 297 | 71% (65–77) n=192 | 65% (49–78) n=37 | 45% (36–54) n=123 |
| MaxTac AV | attacked | 461 | 71% (65–77) n=235 | 531 → 442 | 17% | 0 / 237 / 224 | 85% (78–90) n=144 | 83% (70–91) n=47 | 63% (54–72) n=115 |
| 6th Street Recruits | played | 460 | 67% (61–71) n=341 | 1030 → 448 | 57% | 188 / 124 / 148 | 78% (71–84) n=143 | 59% (51–67) n=143 | 55% (46–64) n=115 |
| Animals Wrecker | played | 457 | 72% (67–76) n=349 | 659 → 457 | 31% | 0 / 317 / 140 | 76% (68–82) n=147 | 68% (56–77) n=77 | 70% (63–77) n=172 |
| Valentino Street Racer | attacked | 448 | 66% (60–71) n=265 | 638 → 411 | 36% | 16 / 115 / 317 | 82% (76–88) n=148 | 71% (60–80) n=73 | 52% (43–60) n=126 |
| Pepe Najarro: Working Doubles | played | 443 | 65% (60–70) n=338 | 1002 → 439 | 56% | 205 / 129 / 109 | 76% (69–82) n=163 | 57% (48–64) n=145 | 55% (45–65) n=87 |
| Valentino Street Racer | played | 431 | 65% (60–70) n=335 | 1307 → 401 | 69% | 95 / 151 / 185 | 77% (69–83) n=147 | 62% (53–70) n=113 | 48% (39–57) n=112 |
| Adam Smasher: Ender of Legends | called | 430 | 69% (64–73) n=430 | 430 → 430 | 0% | 181 / 126 / 123 | 76% (71–81) n=304 | 54% (42–65) n=65 | 46% (34–58) n=61 |

(33 more card uses in the JSON report.)

Legal but never taken: V: Streetkid (Legend play, legal in 1155 turns).

| Decision type | Decisions | First-listed option taken | Options offered (1 / 2 / 3–5 / 6–10 / 11–20 / 21+) |
|---|---|---|---|
| main | 14117 | 6% | 0 / 1142 / 3706 / 5301 / 3723 / 245 |
| gig/steal | 4169 | 30% | 254 / 607 / 1906 / 1388 / 14 / 0 |
| gig/rollIn | 2240 | 0% | 0 / 560 / 1680 / 0 / 0 / 0 |
| react | 672 | 59% | 0 / 402 / 270 / 0 / 0 / 0 |
| mulligan | 560 | 17% | 0 / 560 / 0 / 0 / 0 / 0 |
| unit/defeat | 542 | 61% | 142 / 182 / 197 / 21 / 0 / 0 |
| card/playFree | 481 | 67% | 0 / 104 / 338 / 39 / 0 / 0 |
| unit/adrenaline | 389 | 62% | 168 / 138 / 82 / 1 / 0 / 0 |
| card/search | 350 | 88% | 221 / 108 / 21 / 0 / 0 / 0 |
| gig/swapGive | 331 | 35% | 0 / 14 / 249 / 63 / 5 / 0 |
| gig/swapTake | 267 | 49% | 54 / 93 / 75 / 42 / 3 / 0 |
| gigValue/adjust | 246 | 2% | 0 / 0 / 0 / 1 / 24 / 221 |
| unit/ready | 220 | 93% | 0 / 180 / 40 / 0 / 0 / 0 |
| unit/equip | 131 | 82% | 28 / 36 / 47 / 20 / 0 / 0 |
| unit/spend | 56 | 70% | 17 / 24 / 15 / 0 / 0 / 0 |
| unit/sacrifice | 52 | 83% | 32 / 11 / 9 / 0 / 0 / 0 |
| card/discard | 41 | 44% | 8 / 12 / 19 / 2 / 0 / 0 |
| unit/pump | 36 | 81% | 17 / 6 / 13 / 0 / 0 / 0 |
| card/defeat | 16 | 94% | 14 / 1 / 1 / 0 / 0 / 0 |
| yesno/draw | 15 | 100% | 0 / 15 / 0 / 0 / 0 / 0 |
| mode/foolOnTheHill | 6 | 50% | 0 / 6 / 0 / 0 / 0 / 0 |
| mode/rivalChoice | 3 | 33% | 0 / 3 / 0 / 0 / 0 / 0 |

Reaction windows: 667 attacks. Reacted to 273 (deck won 63% (57–69) n=241): stole 217, attackerGone 1, targetGone 49, bothGone 6. Let 394 resolve (62% (55–68) n=206): stole 282, stoleNothing 1, targetGone 93, bothGone 18. Choices: endReact 397, call 269, play 6.

## NC-01 Rockerboy Express (RRY) — 560 games, 52% won, 24651 decisions

| Card | Use | Uses | Win rate in games used (95%) | Legal turns → used | Not chosen | Early / mid / late uses | Ahead | Even | Behind |
|---|---|---|---|---|---|---|---|---|---|
| Animals Wrecker | attacked | 852 | 61% (55–66) n=329 | 770 → 736 | 4% | 0 / 186 / 666 | 78% (71–83) n=171 | 70% (59–79) n=76 | 55% (48–61) n=232 |
| Rockn' Rockerboy | attacked | 766 | 57% (52–63) n=311 | 829 → 714 | 14% | 0 / 335 / 431 | 71% (64–77) n=192 | 71% (61–80) n=80 | 51% (43–58) n=184 |
| 6th Street Recruits | attacked | 681 | 51% (46–57) n=315 | 795 → 637 | 20% | 91 / 265 / 325 | 69% (61–76) n=140 | 47% (38–57) n=112 | 42% (35–49) n=183 |
| Animals Wrecker | played | 552 | 54% (49–59) n=397 | 659 → 552 | 16% | 0 / 381 / 171 | 65% (57–72) n=163 | 48% (38–59) n=81 | 47% (41–53) n=228 |
| Detonate | sold | 545 | 54% (49–59) n=395 | 722 → 545 | 25% | 294 / 120 / 131 | 67% (60–73) n=204 | 47% (39–55) n=149 | 43% (35–52) n=128 |
| 6th Street Recruits | played | 524 | 52% (47–57) n=378 | 1048 → 512 | 51% | 265 / 108 / 151 | 59% (52–66) n=179 | 46% (38–53) n=173 | 51% (42–61) n=101 |
| Dexter DeShawn: Off the Grid | ability | 511 | 46% (41–51) n=360 | 1677 → 511 | 70% | 9 / 69 / 433 | 70% (63–76) n=197 | 25% (16–36) n=65 | 20% (15–27) n=174 |
| Rockn' Rockerboy | played | 480 | 55% (49–60) n=363 | 757 → 480 | 37% | 218 / 139 / 123 | 65% (58–72) n=185 | 48% (39–56) n=126 | 40% (32–49) n=115 |
| Zetatech Faceplate | sold | 468 | 55% (50–60) n=361 | 967 → 468 | 52% | 154 / 192 / 122 | 62% (54–70) n=154 | 46% (37–56) n=99 | 53% (45–60) n=154 |
| Mantis Blades | sold | 455 | 52% (46–57) n=359 | 606 → 455 | 25% | 299 / 55 / 101 | 58% (51–65) n=170 | 48% (40–56) n=148 | 41% (32–51) n=90 |
| Dexter DeShawn: Off the Grid | called | 427 | 52% (47–56) n=427 | 427 → 427 | 0% | 166 / 154 / 107 | 61% (55–67) n=250 | 45% (33–58) n=58 | 35% (27–44) n=119 |
| River Ward: Detective on the Hunt | called | 418 | 53% (48–58) n=418 | 418 → 418 | 0% | 153 / 156 / 109 | 58% (52–64) n=264 | 41% (30–54) n=61 | 46% (36–56) n=93 |
| Adam Smasher: Ender of Legends | called | 409 | 51% (46–55) n=409 | 409 → 409 | 0% | 167 / 129 / 113 | 56% (50–62) n=270 | 42% (30–54) n=60 | 39% (29–50) n=79 |
| Kerry Eurodyne: The Last Rockerboy | played | 400 | 49% (44–55) n=310 | 1530 → 370 | 76% | 123 / 79 / 198 | 67% (59–75) n=129 | 43% (35–53) n=115 | 34% (26–44) n=102 |
| Industrial Assembly | sold | 387 | 53% (48–59) n=310 | 763 → 387 | 49% | 156 / 138 / 93 | 58% (49–67) n=112 | 48% (40–57) n=122 | 50% (41–59) n=120 |

(31 more card uses in the JSON report.)

| Decision type | Decisions | First-listed option taken | Options offered (1 / 2 / 3–5 / 6–10 / 11–20 / 21+) |
|---|---|---|---|
| main | 13865 | 8% | 0 / 1174 / 3608 / 5413 / 3554 / 116 |
| gig/steal | 3213 | 28% | 164 / 468 / 1378 / 1190 / 13 / 0 |
| gig/rollIn | 2240 | 0% | 0 / 560 / 1680 / 0 / 0 / 0 |
| react | 1490 | 75% | 0 / 873 / 612 / 5 / 0 / 0 |
| gigValue/adjust | 1204 | 12% | 0 / 12 / 126 / 87 / 721 / 258 |
| mulligan | 560 | 23% | 0 / 560 / 0 / 0 / 0 / 0 |
| mode/mode | 512 | 71% | 0 / 512 / 0 / 0 / 0 / 0 |
| unit/defeat | 482 | 56% | 114 / 164 / 201 / 3 / 0 / 0 |
| unit/pump | 379 | 51% | 102 / 132 / 143 / 2 / 0 / 0 |
| unit/equip | 275 | 79% | 28 / 90 / 133 / 24 / 0 / 0 |
| card/defeatGear | 97 | 65% | 0 / 75 / 22 / 0 / 0 / 0 |
| card/trash | 85 | 53% | 0 / 85 / 0 / 0 / 0 / 0 |
| card/playFree | 76 | 97% | 64 / 11 / 1 / 0 / 0 / 0 |
| unit/sacrifice | 66 | 86% | 43 / 14 / 9 / 0 / 0 / 0 |
| card/discard | 49 | 47% | 8 / 15 / 26 / 0 / 0 / 0 |
| card/search | 32 | 44% | 0 / 10 / 17 / 5 / 0 / 0 |
| mode/foolOnTheHill | 9 | 67% | 0 / 9 / 0 / 0 / 0 / 0 |
| card/defeat | 8 | 100% | 7 / 1 / 0 / 0 / 0 / 0 |
| yesno/draw | 7 | 100% | 0 / 7 / 0 / 0 / 0 / 0 |
| mode/rivalChoice | 2 | 0% | 0 / 2 / 0 / 0 / 0 / 0 |

Reaction windows: 1389 attacks. Reacted to 343 (deck won 44% (38–50) n=288): stole 179, attackerGone 19, targetGone 130, bothGone 15. Let 1046 resolve (50% (45–55) n=366): stole 785, stoleNothing 7, attackerGone 1, targetGone 213, bothGone 40. Choices: call 259, endReact 1112, block 100, ability 16, play 3.

## NC-02 Stormrider Stampede (GGR) — 560 games, 55% won, 25624 decisions

| Card | Use | Uses | Win rate in games used (95%) | Legal turns → used | Not chosen | Early / mid / late uses | Ahead | Even | Behind |
|---|---|---|---|---|---|---|---|---|---|
| MaxTac AV | attacked | 827 | 63% (58–69) n=303 | 830 → 750 | 10% | 0 / 380 / 447 | 78% (71–83) n=200 | 74% (64–82) n=89 | 52% (45–60) n=164 |
| 6th Street Recruits | attacked | 722 | 53% (47–58) n=325 | 811 → 659 | 19% | 69 / 266 / 387 | 72% (65–79) n=170 | 61% (52–69) n=117 | 38% (31–45) n=180 |
| Pepe Najarro: Working Doubles | attacked | 670 | 54% (49–60) n=309 | 748 → 621 | 17% | 61 / 270 / 339 | 69% (62–76) n=166 | 52% (42–61) n=102 | 48% (41–55) n=173 |
| Sandayu Oda: Hanako's Guardian | attacked | 552 | 60% (54–65) n=304 | 582 → 520 | 11% | 0 / 126 / 426 | 80% (74–85) n=172 | 69% (57–79) n=64 | 42% (35–50) n=156 |
| Corporate Surveillance | sold | 535 | 57% (52–62) n=382 | 1019 → 535 | 47% | 184 / 204 / 147 | 70% (63–76) n=169 | 53% (44–62) n=122 | 48% (41–56) n=162 |
| Valentino Street Racer | attacked | 521 | 54% (48–60) n=285 | 645 → 475 | 26% | 22 / 149 / 350 | 73% (66–79) n=166 | 49% (38–61) n=69 | 38% (30–46) n=144 |
| Detonate | sold | 507 | 55% (50–60) n=373 | 763 → 507 | 34% | 243 / 144 / 120 | 62% (55–69) n=187 | 55% (46–64) n=118 | 48% (40–56) n=138 |
| 6th Street Recruits | played | 505 | 53% (48–58) n=381 | 1033 → 497 | 52% | 224 / 139 / 142 | 61% (54–68) n=178 | 48% (40–56) n=147 | 39% (30–48) n=110 |
| Synapse Burnout | sold | 504 | 55% (50–60) n=375 | 753 → 504 | 33% | 240 / 133 / 131 | 64% (57–70) n=195 | 49% (40–58) n=123 | 48% (39–57) n=118 |
| Valentino Street Racer | played | 502 | 53% (48–58) n=365 | 1284 → 455 | 65% | 105 / 227 / 170 | 66% (58–72) n=169 | 45% (36–54) n=105 | 39% (31–47) n=140 |
| MaxTac AV | played | 490 | 58% (53–63) n=356 | 674 → 490 | 27% | 211 / 167 / 112 | 69% (62–75) n=170 | 58% (49–66) n=126 | 42% (34–50) n=134 |
| Padre: Man of the Cross | ability | 485 | 44% (39–50) n=335 | 1850 → 485 | 74% | 3 / 106 / 376 | 64% (57–71) n=186 | 27% (17–38) n=64 | 20% (15–27) n=154 |
| Pepe Najarro: Working Doubles | played | 463 | 51% (45–56) n=362 | 1019 → 462 | 55% | 205 / 160 / 98 | 61% (53–68) n=146 | 43% (35–51) n=145 | 44% (36–53) n=127 |
| Peace Offering | sold | 439 | 57% (52–62) n=333 | 1097 → 439 | 60% | 104 / 225 / 110 | 64% (56–72) n=137 | 55% (45–64) n=106 | 51% (42–59) n=136 |
| Mantis Blades | sold | 418 | 60% (54–65) n=339 | 603 → 418 | 31% | 264 / 60 / 94 | 63% (55–69) n=171 | 57% (49–65) n=135 | 58% (47–68) n=76 |

(28 more card uses in the JSON report.)

Legal but never taken: Synapse Burnout (played, legal in 768 turns).

| Decision type | Decisions | First-listed option taken | Options offered (1 / 2 / 3–5 / 6–10 / 11–20 / 21+) |
|---|---|---|---|
| main | 13718 | 8% | 0 / 1213 / 3916 / 5997 / 2524 / 68 |
| gig/steal | 3278 | 29% | 150 / 514 / 1512 / 1077 / 25 / 0 |
| gig/rollIn | 2240 | 0% | 0 / 560 / 1680 / 0 / 0 / 0 |
| react | 1125 | 59% | 0 / 687 / 431 / 7 / 0 / 0 |
| unit/ready | 811 | 71% | 0 / 400 / 400 / 11 / 0 / 0 |
| unit/spend | 653 | 75% | 353 / 201 / 98 / 1 / 0 / 0 |
| gigValue/setGig | 568 | 8% | 0 / 0 / 8 / 66 / 158 / 336 |
| mulligan | 560 | 14% | 0 / 560 / 0 / 0 / 0 / 0 |
| mode/mode | 526 | 63% | 0 / 526 / 0 / 0 / 0 / 0 |
| gig/swapGive | 488 | 34% | 0 / 32 / 382 / 74 / 0 / 0 |
| gig/swapTake | 412 | 49% | 74 / 122 / 144 / 71 / 1 / 0 |
| unit/adrenaline | 389 | 52% | 144 / 155 / 90 / 0 / 0 / 0 |
| unit/equip | 294 | 88% | 36 / 104 / 131 / 23 / 0 / 0 |
| gigValue/adjust | 185 | 6% | 0 / 0 / 0 / 2 / 16 / 167 |
| unit/defeat | 167 | 41% | 10 / 35 / 113 / 9 / 0 / 0 |
| unit/sacrifice | 62 | 85% | 37 / 15 / 10 / 0 / 0 / 0 |
| card/discard | 45 | 53% | 9 / 11 / 25 / 0 / 0 / 0 |
| card/search | 32 | 47% | 0 / 8 / 20 / 4 / 0 / 0 |
| unit/pump | 30 | 77% | 10 / 12 / 8 / 0 / 0 / 0 |
| card/defeat | 27 | 100% | 25 / 2 / 0 / 0 / 0 / 0 |
| mode/foolOnTheHill | 6 | 50% | 0 / 6 / 0 / 0 / 0 / 0 |
| yesno/draw | 6 | 100% | 0 / 6 / 0 / 0 / 0 / 0 |
| mode/rivalChoice | 2 | 50% | 0 / 2 / 0 / 0 / 0 / 0 |

Reaction windows: 1033 attacks. Reacted to 426 (deck won 48% (43–53) n=323): stole 257, stoleNothing 3, attackerGone 22, targetGone 118, bothGone 26. Let 607 resolve (53% (47–59) n=282): stole 444, stoleNothing 2, attackerGone 1, targetGone 144, bothGone 16. Choices: endReact 660, call 346, block 75, play 44.

## NC-03 Static Shock (BBR) — 560 games, 36% won, 27193 decisions

| Card | Use | Uses | Win rate in games used (95%) | Legal turns → used | Not chosen | Early / mid / late uses | Ahead | Even | Behind |
|---|---|---|---|---|---|---|---|---|---|
| Psycho Squad | attacked | 817 | 35% (30–41) n=322 | 890 → 757 | 15% | 91 / 323 / 403 | 49% (42–56) n=189 | 35% (28–44) n=133 | 31% (25–38) n=181 |
| 6th Street Recruits | attacked | 785 | 39% (34–45) n=326 | 847 → 705 | 17% | 67 / 310 / 408 | 51% (45–58) n=202 | 48% (39–57) n=108 | 29% (23–36) n=173 |
| Alt Cunningham: Soulkiller Architect | ability | 607 | 31% (26–35) n=408 | 1765 → 607 | 66% | 2 / 101 / 504 | 49% (43–56) n=219 | 22% (14–33) n=77 | 9% (5–13) n=211 |
| Wakako Okada: Peace and Harmony | ability | 603 | 28% (24–33) n=390 | 1752 → 603 | 66% | 5 / 123 / 475 | 44% (38–51) n=221 | 14% (8–24) n=78 | 8% (5–13) n=200 |
| Jacked-In Voodoo Boy | played | 567 | 31% (27–36) n=408 | 1024 → 532 | 48% | 196 / 230 / 141 | 39% (33–45) n=256 | 16% (10–25) n=92 | 18% (12–26) n=108 |
| 6th Street Recruits | played | 565 | 36% (32–41) n=404 | 867 → 560 | 35% | 204 / 189 / 172 | 43% (37–50) n=204 | 34% (27–42) n=143 | 25% (18–33) n=137 |
| Psycho Squad | played | 551 | 34% (30–39) n=383 | 824 → 546 | 34% | 213 / 176 / 162 | 45% (38–52) n=204 | 27% (21–35) n=153 | 21% (14–29) n=111 |
| Dexter DeShawn: Off the Grid | ability | 523 | 29% (25–34) n=357 | 1773 → 523 | 71% | 1 / 122 / 400 | 46% (40–53) n=205 | 15% (9–26) n=65 | 6% (3–11) n=167 |
| Floor It | sold | 452 | 34% (29–39) n=350 | 836 → 452 | 46% | 199 / 119 / 134 | 41% (34–49) n=155 | 32% (25–40) n=135 | 24% (17–33) n=115 |
| Jacked-In Voodoo Boy | attacked | 426 | 38% (32–44) n=234 | 418 → 362 | 13% | 47 / 135 / 244 | 50% (42–58) n=141 | 20% (11–32) n=56 | 26% (19–35) n=103 |
| Trust No One | sold | 417 | 36% (31–41) n=323 | 713 → 417 | 42% | 204 / 109 / 104 | 45% (37–53) n=145 | 31% (23–39) n=127 | 31% (22–41) n=91 |
| Dexter DeShawn: Off the Grid | called | 410 | 36% (32–41) n=410 | 410 → 410 | 0% | 132 / 202 / 76 | 41% (35–46) n=276 | 26% (16–40) n=53 | 27% (19–38) n=81 |
| Alt Cunningham: Soulkiller Architect | called | 403 | 37% (33–42) n=403 | 403 → 403 | 0% | 145 / 176 / 82 | 44% (38–50) n=287 | 18% (10–29) n=57 | 25% (16–38) n=59 |
| Wakako Okada: Peace and Harmony | called | 396 | 35% (30–40) n=396 | 396 → 396 | 0% | 140 / 186 / 70 | 39% (33–45) n=275 | 23% (14–36) n=56 | 28% (18–40) n=65 |
| Meredith Stout: Stone Cold Corpo | played | 394 | 33% (29–39) n=332 | 961 → 394 | 59% | 68 / 158 / 168 | 38% (31–46) n=151 | 41% (32–51) n=90 | 23% (17–31) n=126 |

(35 more card uses in the JSON report.)

| Decision type | Decisions | First-listed option taken | Options offered (1 / 2 / 3–5 / 6–10 / 11–20 / 21+) |
|---|---|---|---|
| main | 14119 | 9% | 0 / 1168 / 3575 / 5967 / 3360 / 49 |
| gig/steal | 2472 | 33% | 154 / 523 / 1039 / 736 / 20 / 0 |
| gig/rollIn | 2240 | 100% | 0 / 560 / 1680 / 0 / 0 / 0 |
| react | 1743 | 61% | 0 / 1111 / 612 / 20 / 0 / 0 |
| gigValue/adjust | 1503 | 10% | 0 / 17 / 45 / 101 / 899 / 441 |
| mode/mode | 1071 | 79% | 0 / 1071 / 0 / 0 / 0 / 0 |
| unit/weaken | 627 | 64% | 217 / 195 / 207 / 8 / 0 / 0 |
| mulligan | 560 | 7% | 0 / 560 / 0 / 0 / 0 / 0 |
| card/search | 528 | 53% | 0 / 95 / 426 / 7 / 0 / 0 |
| unit/bottomdeck | 478 | 86% | 364 / 67 / 46 / 1 / 0 / 0 |
| card/discard | 461 | 62% | 106 / 219 / 135 / 1 / 0 / 0 |
| unit/pump | 440 | 48% | 86 / 182 / 169 / 3 / 0 / 0 |
| card/playFromTrash | 363 | 79% | 217 / 109 / 37 / 0 / 0 / 0 |
| card/freePlay | 187 | 81% | 0 / 100 / 86 / 1 / 0 / 0 |
| yesno/discardFor | 130 | 100% | 0 / 130 / 0 / 0 / 0 / 0 |
| unit/cantAttack | 84 | 50% | 25 / 25 / 33 / 1 / 0 / 0 |
| unit/equip | 71 | 79% | 10 / 9 / 40 / 12 / 0 / 0 |
| unit/sacrifice | 51 | 88% | 39 / 8 / 4 / 0 / 0 / 0 |
| unit/call | 30 | 100% | 0 / 9 / 21 / 0 / 0 / 0 |
| card/defeat | 13 | 100% | 13 / 0 / 0 / 0 / 0 / 0 |
| mode/foolOnTheHill | 10 | 60% | 0 / 10 / 0 / 0 / 0 / 0 |
| yesno/draw | 8 | 100% | 0 / 8 / 0 / 0 / 0 / 0 |
| card/discardForNothing | 4 | 0% | 0 / 3 / 1 / 0 / 0 / 0 |

Reaction windows: 1578 attacks. Reacted to 601 (deck won 32% (28–37) n=399): stole 261, stoleNothing 6, attackerGone 27, targetGone 274, bothGone 33. Let 977 resolve (33% (29–38) n=379): stole 668, stoleNothing 7, attackerGone 3, targetGone 271, bothGone 28. Choices: endReact 1066, call 359, block 267, play 51.

## NC-04 Chrome Rockers (YYR) — 560 games, 47% won, 26060 decisions

| Card | Use | Uses | Win rate in games used (95%) | Legal turns → used | Not chosen | Early / mid / late uses | Ahead | Even | Behind |
|---|---|---|---|---|---|---|---|---|---|
| Rockn' Rockerboy | attacked | 877 | 51% (46–57) n=325 | 905 → 802 | 11% | 0 / 376 / 501 | 68% (61–74) n=196 | 60% (49–69) n=87 | 39% (33–46) n=188 |
| 6th Street Recruits | attacked | 768 | 48% (43–54) n=318 | 859 → 710 | 17% | 80 / 281 / 407 | 67% (60–74) n=166 | 60% (51–68) n=124 | 39% (32–46) n=174 |
| Rockn' Rockerboy | played | 570 | 48% (43–53) n=408 | 759 → 569 | 25% | 220 / 184 / 166 | 59% (53–66) n=214 | 49% (41–57) n=146 | 28% (21–37) n=130 |
| Detonate | sold | 550 | 47% (42–52) n=393 | 785 → 550 | 30% | 279 / 133 / 138 | 54% (47–61) n=195 | 46% (38–54) n=147 | 40% (32–49) n=126 |
| Zetatech Faceplate | sold | 539 | 45% (40–50) n=400 | 1425 → 539 | 62% | 69 / 232 / 238 | 53% (46–60) n=191 | 51% (41–61) n=86 | 36% (30–43) n=188 |
| 6th Street Recruits | played | 526 | 46% (41–50) n=393 | 1097 → 518 | 53% | 242 / 132 / 152 | 55% (48–62) n=184 | 47% (39–55) n=158 | 29% (22–38) n=117 |
| MaxTac Suppression Team | attacked | 524 | 47% (41–53) n=266 | 591 → 494 | 16% | 0 / 157 / 367 | 62% (54–69) n=144 | 62% (50–73) n=63 | 29% (22–37) n=138 |
| Dexter DeShawn: One Last Chance | played | 512 | 46% (41–51) n=368 | 1162 → 482 | 59% | 152 / 183 / 177 | 58% (51–65) n=178 | 41% (34–49) n=143 | 29% (22–38) n=112 |
| Dexter DeShawn: One Last Chance | attacked | 506 | 48% (42–54) n=265 | 638 → 464 | 27% | 48 / 150 / 308 | 71% (62–78) n=126 | 53% (43–63) n=89 | 34% (26–41) n=149 |
| Meredith Stout: Stone Cold Corpo | played | 506 | 47% (43–52) n=390 | 1425 → 490 | 66% | 84 / 145 / 277 | 57% (49–64) n=162 | 48% (39–57) n=109 | 39% (32–46) n=165 |
| The Heist | sold | 498 | 48% (43–53) n=378 | 945 → 498 | 47% | 161 / 201 / 136 | 56% (49–63) n=181 | 42% (33–51) n=112 | 37% (30–46) n=142 |
| MaxTac Suppression Team | played | 473 | 46% (41–52) n=360 | 1083 → 473 | 56% | 69 / 203 / 201 | 56% (49–63) n=188 | 42% (32–52) n=89 | 31% (24–39) n=139 |
| Mantis Blades | sold | 454 | 46% (41–51) n=346 | 775 → 454 | 41% | 243 / 99 / 112 | 50% (43–57) n=185 | 46% (38–55) n=123 | 32% (23–42) n=88 |
| Royce: Psycho on the Edge | called | 443 | 48% (43–53) n=443 | 443 → 443 | 0% | 160 / 167 / 116 | 56% (50–61) n=299 | 40% (29–52) n=70 | 24% (16–35) n=74 |
| River Ward: Detective on the Hunt | called | 435 | 46% (41–51) n=435 | 435 → 435 | 0% | 161 / 156 / 118 | 52% (46–57) n=295 | 48% (36–60) n=67 | 22% (14–33) n=73 |

(28 more card uses in the JSON report.)

Legal but never taken: Royce: Psycho on the Edge (Legend play, legal in 1158 turns), Safety Override (played, legal in 763 turns).

| Decision type | Decisions | First-listed option taken | Options offered (1 / 2 / 3–5 / 6–10 / 11–20 / 21+) |
|---|---|---|---|
| main | 14492 | 9% | 0 / 1267 / 3739 / 5595 / 3720 / 171 |
| gig/steal | 3292 | 31% | 265 / 580 / 1323 / 1107 / 17 / 0 |
| gig/rollIn | 2240 | 0% | 0 / 560 / 1680 / 0 / 0 / 0 |
| react | 2041 | 73% | 0 / 1223 / 813 / 5 / 0 / 0 |
| gigValue/adjust | 1457 | 15% | 0 / 0 / 96 / 169 / 786 / 406 |
| unit/equip | 771 | 68% | 92 / 157 / 405 / 117 / 0 / 0 |
| card/search | 572 | 85% | 19 / 355 / 194 / 4 / 0 / 0 |
| mulligan | 560 | 23% | 0 / 560 / 0 / 0 / 0 / 0 |
| card/trash | 204 | 48% | 0 / 204 / 0 / 0 / 0 / 0 |
| card/playFree | 196 | 97% | 159 / 31 / 6 / 0 / 0 / 0 |
| unit/sacrifice | 94 | 72% | 42 / 35 / 17 / 0 / 0 / 0 |
| card/discard | 44 | 55% | 11 / 13 / 17 / 3 / 0 / 0 |
| unit/protect | 41 | 73% | 4 / 21 / 16 / 0 / 0 / 0 |
| card/defeat | 20 | 95% | 17 / 3 / 0 / 0 / 0 / 0 |
| yesno/draw | 15 | 100% | 0 / 15 / 0 / 0 / 0 / 0 |
| yesno/playFree | 13 | 100% | 0 / 13 / 0 / 0 / 0 / 0 |
| mode/foolOnTheHill | 8 | 63% | 0 / 8 / 0 / 0 / 0 / 0 |

Reaction windows: 1883 attacks. Reacted to 495 (deck won 42% (37–48) n=350): stole 251, stoleNothing 3, attackerGone 23, targetGone 160, bothGone 58. Let 1388 resolve (45% (41–50) n=444): stole 981, stoleNothing 11, attackerGone 6, targetGone 363, bothGone 27. Choices: ability 94, call 272, endReact 1487, block 140, play 48.

## NC-05 Emperor's Guard (GGB) — 560 games, 50% won, 26775 decisions

| Card | Use | Uses | Win rate in games used (95%) | Legal turns → used | Not chosen | Early / mid / late uses | Ahead | Even | Behind |
|---|---|---|---|---|---|---|---|---|---|
| MaxTac AV | attacked | 939 | 58% (53–63) n=355 | 914 → 851 | 7% | 0 / 431 / 508 | 72% (66–78) n=226 | 65% (54–74) n=85 | 51% (44–58) n=201 |
| Psycho Squad | attacked | 813 | 50% (45–56) n=335 | 849 → 728 | 14% | 63 / 275 / 475 | 70% (63–77) n=175 | 46% (38–55) n=119 | 42% (36–49) n=201 |
| Pepe Najarro: Working Doubles | attacked | 725 | 49% (44–55) n=312 | 773 → 661 | 14% | 67 / 269 / 389 | 72% (65–78) n=167 | 55% (45–64) n=110 | 36% (29–43) n=180 |
| Corpo Security | played | 599 | 51% (46–56) n=406 | 988 → 563 | 43% | 218 / 187 / 194 | 59% (53–65) n=247 | 41% (33–50) n=114 | 34% (26–43) n=114 |
| Corporate Surveillance | sold | 596 | 51% (47–56) n=411 | 800 → 596 | 26% | 300 / 131 / 165 | 61% (54–67) n=220 | 45% (38–53) n=170 | 40% (31–48) n=124 |
| MaxTac AV | played | 595 | 52% (48–57) n=427 | 851 → 592 | 30% | 254 / 154 / 187 | 64% (58–70) n=237 | 52% (43–60) n=132 | 35% (28–42) n=156 |
| Psycho Squad | played | 571 | 48% (44–53) n=399 | 1086 → 563 | 48% | 182 / 198 / 191 | 61% (54–68) n=193 | 39% (31–47) n=138 | 37% (29–45) n=145 |
| Riot Shield | sold | 537 | 50% (45–55) n=395 | 657 → 537 | 18% | 276 / 118 / 143 | 60% (53–66) n=210 | 44% (36–52) n=147 | 36% (28–45) n=117 |
| Pepe Najarro: Working Doubles | played | 524 | 47% (42–52) n=378 | 1076 → 514 | 52% | 176 / 170 / 178 | 61% (53–68) n=173 | 49% (41–57) n=137 | 36% (29–44) n=147 |
| Peace Offering | sold | 494 | 51% (46–56) n=383 | 1035 → 494 | 52% | 188 / 169 / 137 | 64% (57–71) n=184 | 42% (33–51) n=118 | 42% (34–50) n=149 |
| Floor It | sold | 463 | 51% (46–56) n=349 | 999 → 463 | 54% | 181 / 149 / 133 | 61% (54–68) n=171 | 48% (39–56) n=128 | 35% (26–45) n=103 |
| Hanako Arasaka: Daughter of the Emperor | called | 414 | 50% (45–54) n=414 | 414 → 414 | 0% | 139 / 174 / 101 | 57% (51–63) n=281 | 35% (25–46) n=72 | 31% (21–44) n=61 |
| Field Operator | attacked | 412 | 52% (46–59) n=223 | 490 → 380 | 22% | 12 / 141 / 259 | 69% (61–76) n=126 | 64% (51–76) n=53 | 41% (33–50) n=117 |
| Hanako Arasaka: Daughter of the Emperor | ability | 403 | 41% (35–47) n=288 | 1638 → 403 | 75% | 5 / 74 / 324 | 61% (54–68) n=168 | 22% (14–35) n=58 | 12% (7–18) n=121 |
| Goro Takemura: Vengeful Bodyguard | called | 398 | 47% (42–52) n=398 | 398 → 398 | 0% | 158 / 138 / 102 | 57% (50–62) n=258 | 32% (22–43) n=76 | 28% (19–40) n=64 |

(31 more card uses in the JSON report.)

| Decision type | Decisions | First-listed option taken | Options offered (1 / 2 / 3–5 / 6–10 / 11–20 / 21+) |
|---|---|---|---|
| main | 14127 | 7% | 0 / 1083 / 3709 / 6145 / 3059 / 131 |
| gig/steal | 2886 | 30% | 102 / 520 / 1396 / 845 / 23 / 0 |
| gig/rollIn | 2240 | 100% | 0 / 560 / 1680 / 0 / 0 / 0 |
| react | 2040 | 62% | 0 / 1209 / 798 / 33 / 0 / 0 |
| unit/ready | 1026 | 74% | 0 / 508 / 502 / 16 / 0 / 0 |
| gig/swapGive | 997 | 37% | 9 / 56 / 603 / 324 / 5 / 0 |
| gig/swapTake | 877 | 39% | 118 / 164 / 331 / 257 / 7 / 0 |
| mulligan | 560 | 12% | 0 / 560 / 0 / 0 / 0 / 0 |
| gigValue/adjust | 307 | 25% | 0 / 23 / 98 / 94 / 77 / 15 |
| unit/adrenaline | 304 | 51% | 119 / 91 / 93 / 1 / 0 / 0 |
| unit/defeat | 300 | 61% | 93 / 98 / 105 / 4 / 0 / 0 |
| unit/spend | 278 | 72% | 129 / 95 / 54 / 0 / 0 / 0 |
| unit/blocker | 257 | 54% | 70 / 107 / 78 / 2 / 0 / 0 |
| card/discard | 241 | 49% | 18 / 41 / 180 / 2 / 0 / 0 |
| gigValue/setGig | 129 | 6% | 0 / 0 / 5 / 14 / 42 / 68 |
| unit/weaken | 110 | 60% | 18 / 43 / 49 / 0 / 0 / 0 |
| unit/sacrifice | 49 | 88% | 28 / 11 / 9 / 1 / 0 / 0 |
| unit/equip | 34 | 74% | 4 / 1 / 19 / 10 / 0 / 0 |
| mode/foolOnTheHill | 5 | 60% | 0 / 5 / 0 / 0 / 0 / 0 |
| yesno/draw | 5 | 100% | 0 / 5 / 0 / 0 / 0 / 0 |
| mode/rivalChoice | 3 | 0% | 0 / 3 / 0 / 0 / 0 / 0 |

Reaction windows: 1769 attacks. Reacted to 639 (deck won 46% (41–51) n=407): stole 215, stoleNothing 1, attackerGone 33, targetGone 356, bothGone 34. Let 1130 resolve (48% (43–53) n=389): stole 761, stoleNothing 11, targetGone 271, bothGone 87. Choices: endReact 1257, block 357, call 298, play 83, ability 45.

## NC-06 Metal Over Meat (YYY) — 560 games, 37% won, 21646 decisions

| Card | Use | Uses | Win rate in games used (95%) | Legal turns → used | Not chosen | Early / mid / late uses | Ahead | Even | Behind |
|---|---|---|---|---|---|---|---|---|---|
| Rockn' Rockerboy | attacked | 774 | 41% (36–46) n=315 | 826 → 714 | 14% | 0 / 349 / 425 | 59% (51–66) n=162 | 46% (35–57) n=74 | 31% (25–38) n=210 |
| Safety Override | sold | 625 | 37% (32–41) n=422 | 756 → 625 | 17% | 333 / 140 / 152 | 50% (44–57) n=206 | 30% (24–38) n=171 | 29% (23–37) n=143 |
| MaxTac Suppression Team | attacked | 575 | 41% (36–47) n=275 | 660 → 539 | 18% | 0 / 194 / 381 | 64% (56–72) n=132 | 55% (42–68) n=56 | 28% (22–35) n=172 |
| Rockn' Rockerboy | played | 557 | 37% (32–41) n=408 | 722 → 557 | 23% | 197 / 190 / 170 | 52% (44–59) n=186 | 28% (22–36) n=141 | 23% (17–30) n=155 |
| Augmented Negotiators | played | 496 | 40% (35–45) n=367 | 1325 → 468 | 65% | 144 / 151 / 201 | 50% (42–58) n=146 | 40% (33–48) n=151 | 30% (23–38) n=138 |
| Secondhand Bombus | played | 458 | 36% (31–41) n=344 | 1755 → 445 | 75% | 45 / 169 / 244 | 48% (42–55) n=194 | 21% (13–32) n=67 | 23% (17–31) n=136 |
| Live with the Aftermath | sold | 454 | 40% (35–45) n=347 | 1095 → 454 | 59% | 125 / 155 / 174 | 52% (44–60) n=154 | 38% (29–48) n=94 | 28% (21–35) n=152 |
| River Ward: Detective on the Hunt | called | 450 | 35% (31–40) n=450 | 450 → 450 | 0% | 256 / 121 / 73 | 46% (40–52) n=236 | 23% (17–30) n=151 | 25% (16–37) n=63 |
| Dum Dum: Maelstrom Triggerman | called | 443 | 36% (32–41) n=443 | 443 → 443 | 0% | 242 / 122 / 79 | 45% (39–52) n=234 | 25% (19–33) n=134 | 27% (18–38) n=75 |
| Muamar Reyes: El Capitán | ability | 438 | 37% (32–43) n=301 | 1871 → 438 | 77% | 60 / 78 / 300 | 64% (56–71) n=154 | 17% (11–27) n=81 | 10% (6–17) n=125 |
| MaxTac Suppression Team | played | 424 | 39% (34–44) n=344 | 1022 → 424 | 59% | 103 / 194 / 127 | 48% (41–56) n=164 | 42% (32–52) n=93 | 22% (15–30) n=124 |
| Muamar Reyes: El Capitán | called | 418 | 35% (31–40) n=418 | 418 → 418 | 0% | 239 / 101 / 78 | 48% (41–55) n=206 | 27% (20–35) n=134 | 15% (9–25) n=78 |
| Jackie Welles: Ride or Die Choom | played | 415 | 38% (33–43) n=329 | 981 → 415 | 58% | 0 / 164 / 251 | 61% (51–69) n=112 | 44% (29–61) n=34 | 24% (19–30) n=214 |
| Zetatech Faceplate | sold | 382 | 40% (35–45) n=326 | 630 → 382 | 39% | 165 / 143 / 74 | 50% (41–58) n=129 | 34% (27–43) n=122 | 32% (24–42) n=105 |
| Gorilla Arms | sold | 381 | 39% (33–44) n=318 | 638 → 381 | 40% | 183 / 118 / 80 | 52% (44–59) n=160 | 31% (23–41) n=97 | 26% (18–35) n=97 |

(31 more card uses in the JSON report.)

Legal but never taken: Safety Override (played, legal in 718 turns).

| Decision type | Decisions | First-listed option taken | Options offered (1 / 2 / 3–5 / 6–10 / 11–20 / 21+) |
|---|---|---|---|
| main | 12467 | 9% | 0 / 910 / 3230 / 5181 / 3020 / 126 |
| gig/rollIn | 2240 | 0% | 0 / 560 / 1680 / 0 / 0 / 0 |
| gig/steal | 2235 | 31% | 89 / 378 / 772 / 988 / 8 / 0 |
| react | 1910 | 63% | 0 / 1038 / 864 / 8 / 0 / 0 |
| gigValue/adjust | 893 | 20% | 0 / 2 / 100 / 180 / 478 / 133 |
| mulligan | 560 | 50% | 0 / 560 / 0 / 0 / 0 / 0 |
| mode/muamarCall | 510 | 56% | 0 / 510 / 0 / 0 / 0 / 0 |
| unit/protect | 273 | 39% | 64 / 89 / 118 / 2 / 0 / 0 |
| unit/pump | 108 | 28% | 22 / 27 / 58 / 1 / 0 / 0 |
| card/discard | 107 | 73% | 7 / 45 / 45 / 10 / 0 / 0 |
| unit/sacrifice | 104 | 71% | 41 / 41 / 22 / 0 / 0 / 0 |
| card/defeatGear | 102 | 86% | 0 / 84 / 18 / 0 / 0 / 0 |
| unit/defeat | 61 | 98% | 55 / 6 / 0 / 0 / 0 / 0 |
| unit/equip | 49 | 82% | 3 / 19 / 26 / 1 / 0 / 0 |
| card/trash | 13 | 38% | 0 / 13 / 0 / 0 / 0 / 0 |
| yesno/draw | 6 | 100% | 0 / 6 / 0 / 0 / 0 / 0 |
| mode/foolOnTheHill | 5 | 80% | 0 / 5 / 0 / 0 / 0 / 0 |
| card/playFree | 3 | 100% | 3 / 0 / 0 / 0 / 0 / 0 |

Reaction windows: 1672 attacks. Reacted to 588 (deck won 35% (31–40) n=393): stole 135, stoleNothing 2, attackerGone 1, targetGone 403, bothGone 16, noneGone 31. Let 1084 resolve (37% (33–42) n=387): stole 753, stoleNothing 19, attackerGone 5, targetGone 268, bothGone 39. Choices: block 452, endReact 1208, call 229, ability 13, play 8.

## NC-07 Braindance Burn (RRB) — 560 games, 56% won, 25115 decisions

| Card | Use | Uses | Win rate in games used (95%) | Legal turns → used | Not chosen | Early / mid / late uses | Ahead | Even | Behind |
|---|---|---|---|---|---|---|---|---|---|
| Psycho Squad | attacked | 792 | 54% (49–59) n=352 | 962 → 742 | 23% | 69 / 339 / 384 | 78% (71–83) n=174 | 62% (52–70) n=110 | 45% (38–51) n=219 |
| Animals Wrecker | attacked | 767 | 65% (59–70) n=309 | 729 → 689 | 5% | 0 / 204 / 563 | 83% (76–88) n=148 | 77% (66–86) n=66 | 56% (49–62) n=218 |
| 6th Street Recruits | attacked | 766 | 57% (52–62) n=319 | 907 → 711 | 22% | 75 / 312 / 379 | 75% (68–81) n=159 | 59% (50–67) n=122 | 48% (42–55) n=198 |
| Detonate | sold | 528 | 56% (51–61) n=391 | 737 → 528 | 28% | 249 / 142 / 137 | 67% (60–73) n=191 | 51% (43–60) n=134 | 51% (42–59) n=134 |
| Psycho Squad | played | 523 | 55% (50–60) n=385 | 951 → 517 | 46% | 298 / 98 / 127 | 65% (58–71) n=182 | 49% (41–56) n=171 | 33% (25–43) n=96 |
| Animals Wrecker | played | 484 | 58% (53–63) n=359 | 586 → 484 | 17% | 0 / 348 / 136 | 77% (69–83) n=131 | 49% (38–60) n=78 | 48% (42–55) n=198 |
| 6th Street Recruits | played | 475 | 55% (50–60) n=355 | 919 → 468 | 49% | 260 / 91 / 124 | 66% (58–73) n=155 | 49% (41–57) n=155 | 33% (25–43) n=102 |
| Dexter DeShawn: Off the Grid | ability | 473 | 50% (45–56) n=331 | 1717 → 473 | 72% | 10 / 62 / 401 | 71% (65–77) n=209 | 24% (15–37) n=54 | 18% (13–26) n=136 |
| Bonnie and Clyde | sold | 432 | 57% (51–62) n=327 | 1138 → 432 | 62% | 107 / 166 / 159 | 72% (64–79) n=127 | 54% (44–64) n=96 | 46% (39–54) n=155 |
| Industrial Assembly | sold | 429 | 55% (49–60) n=332 | 820 → 429 | 48% | 186 / 155 / 88 | 65% (57–72) n=153 | 50% (41–60) n=109 | 50% (41–58) n=127 |
| Johnny Silverhand: Never Stop Fighting | attacked | 421 | 61% (54–68) n=184 | 321 → 301 | 6% | 0 / 82 / 339 | 84% (75–90) n=94 | 89% (75–96) n=36 | 43% (34–52) n=107 |
| Judy Álvarez: Braindance Maestro | called | 420 | 57% (52–61) n=420 | 420 → 420 | 0% | 174 / 119 / 127 | 66% (60–71) n=270 | 48% (36–61) n=62 | 34% (25–44) n=88 |
| Adam Smasher: Ender of Legends | called | 416 | 55% (50–59) n=416 | 416 → 416 | 0% | 152 / 127 / 137 | 65% (59–71) n=262 | 44% (31–57) n=55 | 32% (24–42) n=99 |
| Meredith Stout: Stone Cold Corpo | played | 409 | 53% (47–58) n=323 | 1184 → 400 | 66% | 126 / 111 / 172 | 73% (65–80) n=124 | 49% (40–59) n=104 | 38% (30–46) n=130 |
| Dexter DeShawn: Off the Grid | called | 405 | 56% (51–61) n=405 | 405 → 405 | 0% | 177 / 112 / 116 | 65% (59–70) n=254 | 51% (38–64) n=53 | 38% (29–48) n=98 |

(29 more card uses in the JSON report.)

| Decision type | Decisions | First-listed option taken | Options offered (1 / 2 / 3–5 / 6–10 / 11–20 / 21+) |
|---|---|---|---|
| main | 14251 | 9% | 0 / 1232 / 4075 / 5934 / 2907 / 103 |
| gig/steal | 3224 | 28% | 158 / 447 / 1450 / 1143 / 26 / 0 |
| gig/rollIn | 2240 | 0% | 0 / 560 / 1680 / 0 / 0 / 0 |
| react | 1394 | 65% | 0 / 876 / 502 / 16 / 0 / 0 |
| gigValue/adjust | 752 | 7% | 0 / 4 / 56 / 37 / 422 / 233 |
| unit/pump | 643 | 50% | 169 / 237 / 226 / 11 / 0 / 0 |
| mulligan | 560 | 12% | 0 / 560 / 0 / 0 / 0 / 0 |
| unit/defeat | 520 | 61% | 176 / 149 / 185 / 10 / 0 / 0 |
| mode/mode | 511 | 74% | 0 / 511 / 0 / 0 / 0 / 0 |
| card/playFree | 293 | 82% | 0 / 118 / 167 / 8 / 0 / 0 |
| unit/equip | 292 | 82% | 50 / 88 / 111 / 43 / 0 / 0 |
| yesno/addToHand | 178 | 100% | 0 / 178 / 0 / 0 / 0 / 0 |
| unit/weaken | 69 | 71% | 24 / 31 / 14 / 0 / 0 / 0 |
| card/search | 57 | 44% | 0 / 15 / 34 / 8 / 0 / 0 |
| card/discard | 52 | 73% | 17 / 20 / 15 / 0 / 0 / 0 |
| unit/sacrifice | 50 | 86% | 39 / 6 / 5 / 0 / 0 / 0 |
| card/defeat | 21 | 90% | 18 / 2 / 1 / 0 / 0 / 0 |
| yesno/draw | 6 | 100% | 0 / 6 / 0 / 0 / 0 / 0 |
| mode/foolOnTheHill | 2 | 50% | 0 / 2 / 0 / 0 / 0 / 0 |

Reaction windows: 1270 attacks. Reacted to 435 (deck won 45% (40–51) n=328): stole 246, attackerGone 23, targetGone 138, bothGone 28. Let 835 resolve (58% (52–63) n=346): stole 597, stoleNothing 9, attackerGone 12, targetGone 184, bothGone 33. Choices: call 294, endReact 908, block 142, play 50.

## NC-08 Merc Contract (RRG) — 560 games, 57% won, 24163 decisions

| Card | Use | Uses | Win rate in games used (95%) | Legal turns → used | Not chosen | Early / mid / late uses | Ahead | Even | Behind |
|---|---|---|---|---|---|---|---|---|---|
| Animals Wrecker | attacked | 768 | 67% (62–72) n=306 | 719 → 687 | 4% | 0 / 165 / 603 | 90% (84–93) n=153 | 90% (81–94) n=86 | 57% (50–63) n=207 |
| Pepe Najarro: Working Doubles | attacked | 625 | 59% (53–65) n=286 | 758 → 580 | 23% | 47 / 279 / 299 | 77% (70–83) n=162 | 63% (52–72) n=86 | 45% (37–53) n=156 |
| 6th Street Recruits | attacked | 608 | 58% (52–64) n=271 | 715 → 551 | 23% | 63 / 240 / 305 | 70% (62–77) n=149 | 64% (54–73) n=103 | 50% (42–58) n=141 |
| Jackie Welles: Mama's Favorite | attacked | 606 | 51% (46–56) n=336 | 684 → 606 | 11% | 0 / 244 / 362 | 69% (62–76) n=186 | 58% (45–70) n=57 | 39% (32–47) n=178 |
| Bonnie and Clyde | sold | 533 | 57% (52–62) n=391 | 1354 → 533 | 61% | 96 / 232 / 205 | 67% (60–74) n=187 | 53% (43–62) n=100 | 47% (39–54) n=165 |
| Peace Offering | sold | 505 | 57% (52–62) n=384 | 966 → 505 | 48% | 213 / 182 / 110 | 68% (61–74) n=187 | 50% (42–59) n=125 | 48% (40–57) n=128 |
| Animals Wrecker | played | 503 | 61% (56–66) n=381 | 678 → 503 | 26% | 0 / 314 / 189 | 77% (70–83) n=164 | 63% (52–73) n=78 | 49% (42–56) n=186 |
| Detonate | sold | 472 | 58% (53–63) n=365 | 703 → 472 | 33% | 248 / 111 / 113 | 63% (56–70) n=173 | 62% (53–69) n=138 | 43% (34–53) n=106 |
| Pepe Najarro: Working Doubles | played | 471 | 57% (52–62) n=353 | 988 → 468 | 53% | 240 / 84 / 147 | 66% (59–73) n=183 | 53% (45–61) n=144 | 38% (29–49) n=86 |
| V: Streetkid | attacked | 462 | 45% (39–51) n=272 | 569 → 462 | 19% | 65 / 132 / 265 | 54% (47–61) n=170 | 58% (44–71) n=48 | 28% (20–37) n=115 |
| Adam Smasher: Ender of Legends | called | 426 | 56% (51–61) n=426 | 426 → 426 | 0% | 178 / 126 / 122 | 64% (59–70) n=315 | 38% (26–51) n=53 | 26% (16–38) n=58 |
| 6th Street Recruits | played | 421 | 54% (49–59) n=331 | 902 → 419 | 54% | 216 / 94 / 111 | 63% (55–69) n=168 | 57% (49–65) n=143 | 23% (15–35) n=65 |
| Carnage at the Colosseum | sold | 419 | 55% (50–61) n=338 | 1638 → 419 | 74% | 25 / 153 / 241 | 69% (61–76) n=144 | 65% (50–77) n=48 | 42% (35–50) n=180 |
| Jackie Welles: Mama's Favorite | called | 413 | 59% (54–64) n=413 | 413 → 413 | 0% | 161 / 143 / 109 | 67% (61–72) n=285 | 49% (37–62) n=59 | 36% (26–48) n=69 |
| V: Streetkid | called | 412 | 57% (52–62) n=412 | 412 → 412 | 0% | 198 / 105 / 109 | 60% (55–65) n=313 | 50% (37–63) n=56 | 44% (30–59) n=43 |

(34 more card uses in the JSON report.)

Legal but never taken: Jackie Welles: Mama's Favorite (Legend play, legal in 821 turns), V: Streetkid (Legend play, legal in 1096 turns), Synapse Burnout (played, legal in 526 turns).

| Decision type | Decisions | First-listed option taken | Options offered (1 / 2 / 3–5 / 6–10 / 11–20 / 21+) |
|---|---|---|---|
| main | 13914 | 9% | 0 / 1213 / 3699 / 4930 / 3874 / 198 |
| gig/steal | 3552 | 31% | 234 / 533 / 1620 / 1150 / 15 / 0 |
| gig/rollIn | 2240 | 0% | 0 / 560 / 1680 / 0 / 0 / 0 |
| react | 1463 | 69% | 0 / 964 / 491 / 8 / 0 / 0 |
| mulligan | 560 | 6% | 0 / 560 / 0 / 0 / 0 / 0 |
| card/search | 385 | 78% | 207 / 103 / 48 / 27 / 0 / 0 |
| unit/defeat | 358 | 59% | 116 / 114 / 120 / 8 / 0 / 0 |
| yesno/replaceDefeat | 334 | 22% | 0 / 334 / 0 / 0 / 0 / 0 |
| card/playFree | 285 | 56% | 0 / 33 / 188 / 64 / 0 / 0 |
| unit/equip | 242 | 82% | 39 / 109 / 81 / 13 / 0 / 0 |
| unit/ready | 204 | 91% | 0 / 142 / 62 / 0 / 0 / 0 |
| unit/adrenaline | 192 | 48% | 67 / 78 / 47 / 0 / 0 / 0 |
| gigValue/adjust | 135 | 4% | 0 / 0 / 0 / 1 / 11 / 123 |
| gigValue/setGig | 93 | 6% | 0 / 0 / 1 / 9 / 17 / 66 |
| unit/sacrifice | 61 | 80% | 37 / 10 / 14 / 0 / 0 / 0 |
| unit/pump | 53 | 77% | 21 / 14 / 18 / 0 / 0 / 0 |
| card/discard | 46 | 48% | 11 / 13 / 22 / 0 / 0 / 0 |
| card/defeat | 27 | 96% | 25 / 1 / 1 / 0 / 0 / 0 |
| yesno/draw | 11 | 100% | 0 / 11 / 0 / 0 / 0 / 0 |
| mode/foolOnTheHill | 5 | 60% | 0 / 5 / 0 / 0 / 0 / 0 |
| mode/rivalChoice | 3 | 0% | 0 / 3 / 0 / 0 / 0 / 0 |

Reaction windows: 1365 attacks. Reacted to 430 (deck won 50% (45–56) n=311): stole 223, stoleNothing 1, attackerGone 23, targetGone 153, bothGone 30. Let 935 resolve (59% (54–64) n=338): stole 620, stoleNothing 3, attackerGone 11, targetGone 246, bothGone 50, noneGone 5. Choices: block 134, call 289, endReact 1004, play 36.

## Rainbow Fixer Stuff — 560 games, 47% won, 29970 decisions

| Card | Use | Uses | Win rate in games used (95%) | Legal turns → used | Not chosen | Early / mid / late uses | Ahead | Even | Behind |
|---|---|---|---|---|---|---|---|---|---|
| Pepe Najarro: Working Doubles | attacked | 963 | 49% (44–54) n=372 | 996 → 856 | 14% | 68 / 356 / 539 | 64% (58–70) n=210 | 50% (41–58) n=129 | 41% (34–48) n=208 |
| 6th Street Recruits | attacked | 907 | 48% (43–53) n=361 | 958 → 819 | 15% | 57 / 323 / 527 | 63% (57–70) n=210 | 47% (38–55) n=128 | 39% (33–46) n=213 |
| Pepe Najarro: Working Doubles | played | 653 | 46% (42–51) n=441 | 996 → 645 | 35% | 246 / 207 / 200 | 60% (53–66) n=225 | 41% (34–49) n=164 | 37% (30–45) n=158 |
| Field Operator | attacked | 650 | 48% (42–53) n=330 | 773 → 554 | 28% | 7 / 189 / 454 | 69% (61–75) n=175 | 54% (44–64) n=89 | 33% (26–40) n=187 |
| 6th Street Recruits | played | 641 | 47% (42–52) n=431 | 993 → 628 | 37% | 223 / 212 / 206 | 60% (53–66) n=218 | 36% (29–44) n=146 | 37% (30–45) n=170 |
| Field Operator | played | 628 | 47% (42–52) n=420 | 1313 → 585 | 55% | 66 / 347 / 215 | 58% (51–64) n=226 | 39% (30–49) n=102 | 36% (29–44) n=159 |
| Valentino Street Racer | played | 621 | 46% (41–50) n=423 | 1146 → 579 | 49% | 109 / 323 / 189 | 55% (49–62) n=215 | 30% (23–39) n=120 | 38% (31–45) n=171 |
| Valentino Street Racer | attacked | 614 | 45% (40–51) n=322 | 782 → 557 | 29% | 16 / 193 / 405 | 62% (55–69) n=184 | 30% (21–42) n=69 | 35% (28–43) n=165 |
| Psycho Squad | attacked | 604 | 50% (44–55) n=278 | 689 → 576 | 16% | 45 / 221 / 338 | 66% (59–73) n=166 | 49% (38–60) n=76 | 35% (28–43) n=143 |
| Padre: Man of the Cross | ability | 574 | 36% (32–41) n=375 | 2001 → 574 | 71% | 2 / 110 / 462 | 51% (44–57) n=219 | 17% (11–26) n=92 | 16% (11–22) n=164 |
| Detonate | sold | 574 | 48% (43–53) n=409 | 947 → 574 | 39% | 249 / 165 / 160 | 60% (53–67) n=201 | 37% (29–45) n=133 | 42% (34–49) n=154 |
| Synapse Burnout | sold | 539 | 48% (43–53) n=394 | 954 → 539 | 44% | 254 / 128 / 157 | 59% (52–66) n=190 | 46% (38–54) n=140 | 31% (23–39) n=130 |
| Wakako Okada: Peace and Harmony | ability | 530 | 38% (33–43) n=351 | 2021 → 530 | 74% | 3 / 110 / 417 | 54% (48–61) n=217 | 15% (8–24) n=75 | 13% (9–20) n=143 |
| Nocturne OP55 N1 | sold | 429 | 49% (43–54) n=344 | 1482 → 429 | 71% | 51 / 210 / 168 | 58% (49–65) n=139 | 49% (38–60) n=74 | 41% (34–49) n=167 |
| Adam Smasher: Ender of Legends | attacked | 410 | 48% (43–53) n=323 | 433 → 410 | 5% | 0 / 0 / 410 | 80% (73–86) n=131 | 73% (62–83) n=64 | 21% (16–27) n=177 |

(30 more card uses in the JSON report.)

| Decision type | Decisions | First-listed option taken | Options offered (1 / 2 / 3–5 / 6–10 / 11–20 / 21+) |
|---|---|---|---|
| main | 16060 | 9% | 0 / 973 / 4060 / 5928 / 4871 / 228 |
| gig/steal | 3252 | 32% | 158 / 539 / 1488 / 1054 / 13 / 0 |
| gig/rollIn | 2240 | 0% | 0 / 560 / 1680 / 0 / 0 / 0 |
| react | 1780 | 58% | 0 / 1014 / 745 / 21 / 0 / 0 |
| mode/mode | 1296 | 74% | 0 / 1068 / 228 / 0 / 0 / 0 |
| gigValue/adjust | 753 | 7% | 0 / 0 / 4 / 27 / 434 / 288 |
| unit/weaken | 602 | 64% | 172 / 200 / 223 / 7 / 0 / 0 |
| unit/adrenaline | 583 | 52% | 216 / 187 / 176 / 4 / 0 / 0 |
| gigValue/setGig | 560 | 7% | 0 / 0 / 5 / 53 / 149 / 353 |
| mulligan | 560 | 6% | 0 / 560 / 0 / 0 / 0 / 0 |
| unit/equip | 529 | 88% | 37 / 147 / 271 / 74 / 0 / 0 |
| unit/spend | 510 | 70% | 255 / 134 / 120 / 1 / 0 / 0 |
| unit/defeat | 346 | 32% | 19 / 54 / 228 / 45 / 0 / 0 |
| card/freePlay | 247 | 76% | 0 / 122 / 122 / 3 / 0 / 0 |
| unit/cantAttack | 154 | 45% | 33 / 66 / 55 / 0 / 0 / 0 |
| card/playFree | 106 | 92% | 0 / 74 / 32 / 0 / 0 / 0 |
| unit/pump | 96 | 59% | 12 / 42 / 41 / 1 / 0 / 0 |
| unit/ready | 90 | 100% | 0 / 90 / 0 / 0 / 0 / 0 |
| card/discard | 65 | 54% | 20 / 16 / 27 / 2 / 0 / 0 |
| unit/sacrifice | 54 | 72% | 35 / 11 / 8 / 0 / 0 / 0 |
| unit/call | 44 | 100% | 0 / 18 / 26 / 0 / 0 / 0 |
| card/defeat | 29 | 93% | 26 / 2 / 1 / 0 / 0 / 0 |
| yesno/draw | 8 | 100% | 0 / 8 / 0 / 0 / 0 / 0 |
| mode/foolOnTheHill | 5 | 60% | 0 / 5 / 0 / 0 / 0 / 0 |
| mode/rivalChoice | 1 | 0% | 0 / 1 / 0 / 0 / 0 / 0 |

Reaction windows: 1580 attacks. Reacted to 648 (deck won 38% (34–43) n=400): stole 359, stoleNothing 8, attackerGone 66, targetGone 178, bothGone 37. Let 932 resolve (43% (38–49) n=366): stole 606, stoleNothing 3, attackerGone 1, targetGone 288, bothGone 34. Choices: call 447, endReact 1036, play 194, block 103.

## RRB Wakako Midrange — 560 games, 45% won, 26849 decisions

| Card | Use | Uses | Win rate in games used (95%) | Legal turns → used | Not chosen | Early / mid / late uses | Ahead | Even | Behind |
|---|---|---|---|---|---|---|---|---|---|
| 6th Street Recruits | attacked | 1028 | 47% (41–52) n=363 | 1090 → 900 | 17% | 87 / 443 / 498 | 66% (59–72) n=205 | 51% (42–59) n=132 | 38% (32–45) n=234 |
| Psycho Squad | attacked | 644 | 51% (45–57) n=272 | 758 → 602 | 21% | 54 / 266 / 324 | 69% (61–76) n=135 | 46% (37–55) n=105 | 43% (36–50) n=175 |
| Wakako Okada: Peace and Harmony | ability | 562 | 40% (35–45) n=371 | 1835 → 562 | 69% | 16 / 142 / 404 | 58% (52–64) n=227 | 12% (6–22) n=60 | 13% (9–19) n=176 |
| Jacked-In Voodoo Boy | played | 557 | 39% (34–43) n=404 | 906 → 511 | 44% | 288 / 163 / 106 | 49% (43–56) n=233 | 24% (18–32) n=131 | 21% (14–31) n=94 |
| Yorinobu Arasaka: Steel Dragon | attacked | 556 | 55% (49–61) n=284 | 546 → 498 | 9% | 0 / 0 / 556 | 80% (73–86) n=148 | 73% (61–82) n=63 | 35% (29–43) n=170 |
| Yorinobu Arasaka: Steel Dragon | played | 554 | 47% (42–52) n=401 | 683 → 554 | 19% | 0 / 280 / 274 | 63% (55–70) n=163 | 48% (36–60) n=67 | 37% (31–44) n=224 |
| 6th Street Recruits | played | 530 | 45% (41–50) n=383 | 823 → 529 | 36% | 289 / 159 / 82 | 57% (50–64) n=190 | 39% (32–46) n=173 | 33% (25–43) n=102 |
| Dexter DeShawn: Off the Grid | ability | 508 | 39% (34–44) n=342 | 1887 → 508 | 73% | 7 / 117 / 384 | 59% (52–65) n=201 | 22% (13–35) n=54 | 12% (8–18) n=162 |
| Detonate | sold | 508 | 44% (39–49) n=364 | 730 → 508 | 30% | 247 / 140 / 121 | 56% (49–63) n=174 | 36% (29–45) n=137 | 30% (23–39) n=129 |
| Nocturne OP55 N1 | sold | 414 | 47% (41–52) n=329 | 1109 → 414 | 63% | 99 / 185 / 130 | 59% (51–67) n=145 | 35% (25–46) n=77 | 38% (31–46) n=156 |
| Floor It | sold | 409 | 47% (42–52) n=315 | 924 → 409 | 56% | 131 / 164 / 114 | 59% (51–67) n=141 | 45% (35–55) n=92 | 36% (28–45) n=127 |
| Mantis Blades | sold | 398 | 41% (36–47) n=321 | 589 → 398 | 32% | 236 / 55 / 107 | 52% (44–59) n=159 | 38% (30–47) n=122 | 20% (12–30) n=76 |
| Dexter DeShawn: Off the Grid | called | 393 | 46% (41–51) n=393 | 393 → 393 | 0% | 149 / 178 / 66 | 54% (47–60) n=230 | 31% (21–42) n=71 | 38% (29–48) n=92 |
| Adam Smasher: Ender of Legends | called | 391 | 46% (41–51) n=391 | 391 → 391 | 0% | 141 / 144 / 106 | 55% (48–61) n=251 | 33% (23–46) n=60 | 29% (20–39) n=80 |
| Wakako Okada: Peace and Harmony | called | 380 | 48% (43–53) n=380 | 380 → 380 | 0% | 155 / 149 / 76 | 58% (52–64) n=244 | 34% (24–47) n=61 | 28% (19–39) n=75 |

(32 more card uses in the JSON report.)

| Decision type | Decisions | First-listed option taken | Options offered (1 / 2 / 3–5 / 6–10 / 11–20 / 21+) |
|---|---|---|---|
| main | 14043 | 9% | 0 / 1195 / 4055 / 6033 / 2719 / 41 |
| gig/steal | 2614 | 29% | 155 / 431 / 1122 / 897 / 9 / 0 |
| gig/rollIn | 2240 | 0% | 0 / 560 / 1680 / 0 / 0 / 0 |
| react | 1774 | 59% | 0 / 1124 / 626 / 24 / 0 / 0 |
| gigValue/adjust | 1372 | 9% | 0 / 11 / 36 / 123 / 877 / 325 |
| mode/mode | 1190 | 83% | 0 / 1051 / 139 / 0 / 0 / 0 |
| unit/defeat | 581 | 69% | 272 / 129 / 164 / 16 / 0 / 0 |
| unit/weaken | 568 | 73% | 212 / 213 / 139 / 4 / 0 / 0 |
| mulligan | 560 | 18% | 0 / 560 / 0 / 0 / 0 / 0 |
| card/playFree | 453 | 79% | 0 / 230 / 217 / 6 / 0 / 0 |
| unit/pump | 404 | 54% | 104 / 166 / 133 / 1 / 0 / 0 |
| unit/equip | 374 | 85% | 48 / 105 / 178 / 43 / 0 / 0 |
| card/freePlay | 210 | 77% | 0 / 101 / 100 / 9 / 0 / 0 |
| card/discard | 117 | 79% | 12 / 74 / 31 / 0 / 0 / 0 |
| unit/cantAttack | 105 | 72% | 55 / 36 / 13 / 1 / 0 / 0 |
| unit/bottomdeck | 79 | 54% | 13 / 17 / 48 / 1 / 0 / 0 |
| unit/sacrifice | 51 | 86% | 35 / 6 / 9 / 1 / 0 / 0 |
| card/search | 46 | 52% | 0 / 20 / 22 / 4 / 0 / 0 |
| unit/call | 33 | 100% | 0 / 6 / 27 / 0 / 0 / 0 |
| card/defeat | 19 | 89% | 14 / 4 / 1 / 0 / 0 / 0 |
| yesno/draw | 8 | 100% | 0 / 8 / 0 / 0 / 0 / 0 |
| mode/foolOnTheHill | 5 | 40% | 0 / 5 / 0 / 0 / 0 / 0 |
| card/discardForNothing | 3 | 0% | 0 / 2 / 1 / 0 / 0 / 0 |

Reaction windows: 1590 attacks. Reacted to 637 (deck won 37% (33–42) n=414): stole 295, stoleNothing 7, attackerGone 44, targetGone 254, bothGone 37. Let 953 resolve (41% (36–46) n=365): stole 695, stoleNothing 9, attackerGone 5, targetGone 208, bothGone 36. Choices: endReact 1043, call 381, play 86, block 264.

## RRG Dexter Midrange — 560 games, 69% won, 25222 decisions

| Card | Use | Uses | Win rate in games used (95%) | Legal turns → used | Not chosen | Early / mid / late uses | Ahead | Even | Behind |
|---|---|---|---|---|---|---|---|---|---|
| 6th Street Recruits | attacked | 833 | 69% (64–74) n=341 | 951 → 767 | 19% | 80 / 340 / 413 | 79% (73–84) n=198 | 69% (60–76) n=125 | 67% (60–73) n=201 |
| Pepe Najarro: Working Doubles | attacked | 831 | 69% (63–74) n=326 | 954 → 760 | 20% | 75 / 359 / 397 | 82% (76–87) n=200 | 64% (55–73) n=107 | 65% (58–71) n=198 |
| Animals Wrecker | attacked | 822 | 78% (73–82) n=322 | 757 → 731 | 3% | 0 / 234 / 588 | 91% (86–94) n=193 | 84% (73–91) n=67 | 73% (67–79) n=226 |
| Dexter DeShawn: Off the Grid | ability | 550 | 66% (61–70) n=358 | 1859 → 550 | 70% | 11 / 109 / 430 | 79% (74–84) n=258 | 37% (26–50) n=59 | 38% (30–47) n=123 |
| Animals Wrecker | played | 541 | 73% (68–77) n=386 | 714 → 541 | 24% | 0 / 372 / 169 | 84% (78–89) n=152 | 68% (57–78) n=72 | 68% (62–74) n=230 |
| Pepe Najarro: Working Doubles | played | 507 | 67% (62–72) n=372 | 851 → 500 | 41% | 293 / 89 / 125 | 77% (70–82) n=190 | 60% (53–67) n=161 | 57% (47–67) n=87 |
| Synapse Burnout | sold | 504 | 70% (65–74) n=378 | 833 → 504 | 39% | 230 / 162 / 112 | 77% (71–83) n=194 | 61% (52–69) n=117 | 66% (58–74) n=134 |
| Detonate | sold | 503 | 72% (67–76) n=384 | 788 → 503 | 36% | 231 / 157 / 115 | 81% (75–86) n=183 | 65% (56–72) n=136 | 72% (63–79) n=127 |
| 6th Street Recruits | played | 502 | 67% (62–72) n=373 | 938 → 497 | 47% | 277 / 102 / 123 | 76% (69–81) n=180 | 63% (55–70) n=163 | 51% (41–61) n=90 |
| Yorinobu Arasaka: Steel Dragon | attacked | 471 | 82% (78–87) n=274 | 463 → 436 | 6% | 0 / 0 / 471 | 93% (87–96) n=162 | 83% (71–90) n=58 | 77% (69–83) n=151 |
| Yorinobu Arasaka: Steel Dragon | played | 455 | 75% (70–79) n=359 | 580 → 455 | 22% | 0 / 245 / 210 | 83% (76–89) n=132 | 69% (55–80) n=51 | 71% (65–77) n=216 |
| Peace Offering | sold | 439 | 68% (62–72) n=351 | 968 → 439 | 55% | 189 / 160 / 90 | 74% (67–80) n=155 | 59% (50–68) n=118 | 67% (59–75) n=126 |
| Dexter DeShawn: Off the Grid | called | 418 | 71% (67–75) n=418 | 418 → 418 | 0% | 211 / 132 / 75 | 76% (71–81) n=272 | 64% (52–74) n=66 | 60% (49–70) n=80 |
| Saburo Arasaka: Stubborn Patriarch | called | 414 | 70% (66–74) n=414 | 414 → 414 | 0% | 217 / 114 / 83 | 73% (68–78) n=298 | 58% (44–70) n=52 | 69% (57–79) n=64 |
| Adam Smasher: Ender of Legends | called | 413 | 69% (64–73) n=413 | 413 → 413 | 0% | 198 / 106 / 109 | 72% (67–77) n=297 | 61% (48–72) n=61 | 58% (45–70) n=55 |

(28 more card uses in the JSON report.)

Legal but never taken: Adam Smasher: Ender of Legends (Legend play, legal in 308 turns).

| Decision type | Decisions | First-listed option taken | Options offered (1 / 2 / 3–5 / 6–10 / 11–20 / 21+) |
|---|---|---|---|
| main | 13743 | 9% | 0 / 1202 / 3897 / 5652 / 2913 / 79 |
| gig/steal | 3667 | 30% | 184 / 535 / 1749 / 1190 / 9 / 0 |
| gig/rollIn | 2240 | 0% | 0 / 560 / 1680 / 0 / 0 / 0 |
| react | 1410 | 64% | 0 / 954 / 447 / 9 / 0 / 0 |
| gigValue/adjust | 834 | 7% | 0 / 3 / 24 / 77 / 428 / 302 |
| unit/defeat | 616 | 60% | 190 / 187 / 230 / 9 / 0 / 0 |
| mulligan | 560 | 19% | 0 / 560 / 0 / 0 / 0 / 0 |
| mode/mode | 522 | 66% | 0 / 522 / 0 / 0 / 0 / 0 |
| unit/pump | 426 | 68% | 173 / 156 / 94 / 3 / 0 / 0 |
| card/playFree | 418 | 78% | 0 / 174 / 237 / 7 / 0 / 0 |
| unit/equip | 373 | 88% | 43 / 106 / 178 / 46 / 0 / 0 |
| unit/ready | 113 | 100% | 0 / 113 / 0 / 0 / 0 / 0 |
| gigValue/setGig | 97 | 9% | 0 / 0 / 5 / 18 / 24 / 50 |
| card/search | 74 | 65% | 0 / 27 / 41 / 6 / 0 / 0 |
| unit/sacrifice | 60 | 83% | 34 / 15 / 11 / 0 / 0 / 0 |
| card/discard | 41 | 56% | 11 / 16 / 13 / 1 / 0 / 0 |
| card/defeat | 18 | 100% | 16 / 2 / 0 / 0 / 0 / 0 |
| yesno/draw | 4 | 100% | 0 / 4 / 0 / 0 / 0 / 0 |
| mode/foolOnTheHill | 3 | 33% | 0 / 3 / 0 / 0 / 0 / 0 |
| mode/rivalChoice | 3 | 0% | 0 / 3 / 0 / 0 / 0 / 0 |

Reaction windows: 1283 attacks. Reacted to 467 (deck won 62% (57–67) n=338): stole 241, attackerGone 49, targetGone 160, bothGone 17. Let 816 resolve (69% (64–74) n=344): stole 595, stoleNothing 2, attackerGone 12, targetGone 170, bothGone 37. Choices: endReact 896, block 161, call 309, play 44.

## RRY Smasher Aggro — 560 games, 56% won, 23699 decisions

| Card | Use | Uses | Win rate in games used (95%) | Legal turns → used | Not chosen | Early / mid / late uses | Ahead | Even | Behind |
|---|---|---|---|---|---|---|---|---|---|
| Animals Wrecker | attacked | 708 | 68% (62–73) n=297 | 652 → 635 | 3% | 0 / 175 / 533 | 85% (79–90) n=144 | 82% (72–89) n=82 | 62% (55–68) n=202 |
| Rockn' Rockerboy | attacked | 637 | 63% (58–69) n=289 | 682 → 599 | 12% | 0 / 308 / 329 | 79% (71–84) n=150 | 68% (56–77) n=74 | 58% (51–65) n=176 |
| 6th Street Recruits | attacked | 594 | 60% (54–65) n=294 | 700 → 557 | 20% | 74 / 208 / 312 | 78% (70–84) n=131 | 59% (49–68) n=107 | 50% (43–57) n=178 |
| Animals Wrecker | played | 467 | 61% (55–66) n=355 | 603 → 467 | 23% | 0 / 312 / 155 | 74% (66–81) n=134 | 63% (51–73) n=67 | 51% (44–58) n=190 |
| La Llorona: Ghost of the Past | played | 463 | 57% (51–62) n=352 | 1256 → 442 | 65% | 79 / 163 / 221 | 69% (61–76) n=141 | 55% (46–64) n=110 | 43% (36–51) n=159 |
| 6th Street Recruits | played | 459 | 58% (53–63) n=349 | 1003 → 454 | 55% | 207 / 119 / 133 | 66% (58–73) n=158 | 52% (44–60) n=150 | 52% (42–61) n=102 |
| Detonate | sold | 449 | 54% (49–59) n=348 | 595 → 449 | 25% | 244 / 101 / 104 | 59% (52–67) n=162 | 56% (47–65) n=121 | 46% (38–56) n=114 |
| Rockn' Rockerboy | played | 441 | 58% (53–63) n=348 | 771 → 441 | 43% | 203 / 112 / 126 | 71% (64–77) n=184 | 51% (42–60) n=112 | 37% (29–46) n=113 |
| Bonnie and Clyde | sold | 438 | 57% (52–62) n=334 | 1212 → 438 | 64% | 75 / 196 / 167 | 68% (60–74) n=160 | 54% (43–64) n=80 | 48% (40–56) n=141 |
| V: Streetkid | attacked | 414 | 43% (37–49) n=255 | 493 → 414 | 16% | 53 / 93 / 268 | 51% (43–59) n=141 | 68% (55–79) n=53 | 30% (23–39) n=122 |
| Zetatech Faceplate | sold | 407 | 54% (48–59) n=317 | 788 → 407 | 48% | 147 / 131 / 129 | 62% (54–70) n=139 | 51% (41–60) n=93 | 46% (38–55) n=132 |
| Meredith Stout: Stone Cold Corpo | played | 402 | 52% (47–58) n=317 | 1215 → 392 | 68% | 83 / 117 / 202 | 63% (54–71) n=114 | 53% (43–63) n=92 | 42% (34–50) n=149 |
| Adam Smasher: Ender of Legends | called | 400 | 56% (52–61) n=400 | 400 → 400 | 0% | 136 / 142 / 122 | 65% (59–70) n=264 | 51% (38–64) n=51 | 34% (25–45) n=85 |
| Dum Dum: Maelstrom Triggerman | called | 395 | 55% (50–60) n=395 | 395 → 395 | 0% | 139 / 137 / 119 | 65% (59–71) n=251 | 39% (28–51) n=62 | 35% (26–46) n=82 |
| V: Streetkid | called | 394 | 55% (50–59) n=394 | 394 → 394 | 0% | 140 / 144 / 110 | 57% (51–63) n=261 | 49% (36–62) n=53 | 50% (39–61) n=80 |

(37 more card uses in the JSON report.)

Legal but never taken: V: Streetkid (Legend play, legal in 956 turns), Adam Smasher: Ender of Legends (Legend play, legal in 247 turns).

| Decision type | Decisions | First-listed option taken | Options offered (1 / 2 / 3–5 / 6–10 / 11–20 / 21+) |
|---|---|---|---|
| main | 13376 | 7% | 0 / 1139 / 3394 / 4785 / 3955 / 103 |
| gig/steal | 3168 | 30% | 160 / 481 / 1379 / 1132 / 16 / 0 |
| gig/rollIn | 2240 | 0% | 0 / 560 / 1680 / 0 / 0 / 0 |
| react | 1960 | 69% | 0 / 1150 / 797 / 13 / 0 / 0 |
| unit/defeat | 681 | 70% | 283 / 167 / 219 / 12 / 0 / 0 |
| mulligan | 560 | 28% | 0 / 560 / 0 / 0 / 0 / 0 |
| card/search | 515 | 69% | 248 / 130 / 102 / 35 / 0 / 0 |
| gigValue/adjust | 515 | 6% | 0 / 7 / 61 / 20 / 191 / 236 |
| unit/equip | 219 | 85% | 48 / 67 / 98 / 6 / 0 / 0 |
| unit/pump | 200 | 34% | 33 / 78 / 86 / 3 / 0 / 0 |
| unit/spend | 83 | 87% | 58 / 14 / 11 / 0 / 0 / 0 |
| unit/sacrifice | 57 | 81% | 32 / 16 / 8 / 1 / 0 / 0 |
| card/discard | 51 | 45% | 10 / 12 / 28 / 1 / 0 / 0 |
| card/defeatGear | 34 | 88% | 0 / 26 / 7 / 1 / 0 / 0 |
| card/defeat | 22 | 95% | 18 / 4 / 0 / 0 / 0 / 0 |
| yesno/draw | 13 | 100% | 0 / 13 / 0 / 0 / 0 / 0 |
| mode/rivalChoice | 3 | 0% | 0 / 3 / 0 / 0 / 0 / 0 |
| mode/foolOnTheHill | 2 | 50% | 0 / 2 / 0 / 0 / 0 / 0 |

Reaction windows: 1750 attacks. Reacted to 537 (deck won 46% (41–52) n=357): stole 205, stoleNothing 1, attackerGone 10, targetGone 306, bothGone 15. Let 1213 resolve (53% (49–58) n=419): stole 814, stoleNothing 4, attackerGone 13, targetGone 335, bothGone 47. Choices: call 304, endReact 1347, block 299, play 7, ability 3.

## Running and Dancing — 560 games, 11% won, 24802 decisions

| Card | Use | Uses | Win rate in games used (95%) | Legal turns → used | Not chosen | Early / mid / late uses | Ahead | Even | Behind |
|---|---|---|---|---|---|---|---|---|---|
| Modded Kusanagi | played | 741 | 10% (7–13) n=392 | 1296 → 741 | 43% | 0 / 166 / 575 | 21% (14–30) n=109 | 22% (13–35) n=54 | 4% (3–7) n=333 |
| Modded Kusanagi | attacked | 688 | 10% (8–14) n=365 | 718 → 688 | 4% | 0 / 163 / 525 | 22% (15–30) n=114 | 20% (12–32) n=55 | 4% (2–7) n=296 |
| Psycho Squad | attacked | 662 | 10% (7–14) n=335 | 829 → 616 | 26% | 87 / 297 / 278 | 21% (14–29) n=116 | 14% (9–22) n=108 | 5% (3–9) n=220 |
| Dying Night: V's Pistol | sold | 589 | 12% (9–15) n=417 | 700 → 589 | 16% | 309 / 136 / 144 | 16% (11–22) n=189 | 14% (9–20) n=145 | 6% (3–11) n=156 |
| Floor It | sold | 559 | 12% (9–15) n=402 | 882 → 559 | 37% | 207 / 186 / 166 | 16% (11–22) n=187 | 12% (7–19) n=120 | 6% (3–11) n=178 |
| Psycho Squad | played | 557 | 11% (9–15) n=407 | 802 → 557 | 31% | 294 / 154 / 109 | 16% (12–22) n=207 | 9% (6–15) n=158 | 3% (1–7) n=120 |
| Chrome Reverie | sold | 548 | 10% (8–14) n=392 | 886 → 548 | 38% | 247 / 159 / 142 | 13% (9–18) n=211 | 12% (7–19) n=110 | 5% (3–10) n=156 |
| Evelyn Parker: Scheming Siren | attacked | 519 | 6% (4–10) n=265 | 1010 → 458 | 55% | 87 / 133 / 299 | 14% (9–23) n=97 | 5% (2–15) n=56 | 2% (1–5) n=195 |
| Evelyn Parker: Scheming Siren | played | 497 | 9% (7–13) n=365 | 1042 → 477 | 54% | 211 / 121 / 165 | 14% (10–19) n=196 | 9% (5–16) n=104 | 1% (0–4) n=132 |
| Trust No One | sold | 494 | 11% (8–15) n=373 | 820 → 494 | 40% | 171 / 162 / 161 | 18% (12–24) n=148 | 9% (5–16) n=119 | 8% (5–13) n=167 |
| Mox Inciters | played | 483 | 13% (10–17) n=349 | 1306 → 450 | 66% | 98 / 213 / 172 | 21% (15–28) n=141 | 11% (6–19) n=100 | 7% (4–12) n=159 |
| Rita Wheeler: No Stupid Questions | played | 480 | 12% (9–16) n=366 | 1261 → 477 | 62% | 93 / 214 / 173 | 19% (13–26) n=140 | 14% (8–22) n=103 | 6% (4–11) n=176 |
| MT0D12 Flathead | sold | 449 | 11% (8–15) n=350 | 947 → 449 | 53% | 147 / 128 / 174 | 15% (10–21) n=161 | 15% (9–24) n=85 | 3% (1–7) n=161 |
| Alt Cunningham: Soulkiller Architect | called | 385 | 11% (9–15) n=385 | 385 → 385 | 0% | 148 / 150 / 87 | 16% (12–21) n=240 | 6% (2–15) n=65 | 1% (0–7) n=80 |
| Jackie Welles: Pour One Out For Me | called | 379 | 10% (8–14) n=379 | 379 → 379 | 0% | 143 / 138 / 98 | 15% (10–20) n=212 | 7% (3–17) n=55 | 4% (1–9) n=112 |

(25 more card uses in the JSON report.)

| Decision type | Decisions | First-listed option taken | Options offered (1 / 2 / 3–5 / 6–10 / 11–20 / 21+) |
|---|---|---|---|
| main | 13137 | 11% | 0 / 1059 / 3155 / 5439 / 3364 / 120 |
| react | 2429 | 68% | 0 / 1525 / 892 / 12 / 0 / 0 |
| gig/rollIn | 2240 | 100% | 0 / 560 / 1680 / 0 / 0 / 0 |
| gig/steal | 1912 | 33% | 57 / 376 / 647 / 798 / 34 / 0 |
| gigValue/adjust | 1765 | 16% | 0 / 60 / 747 / 659 / 259 / 40 |
| card/discard | 661 | 37% | 51 / 125 / 385 / 100 / 0 / 0 |
| mode/cardType | 578 | 100% | 0 / 0 / 578 / 0 / 0 / 0 |
| mulligan | 560 | 16% | 0 / 560 / 0 / 0 / 0 / 0 |
| unit/mustAttack | 447 | 55% | 116 / 175 / 150 / 6 / 0 / 0 |
| unit/pump | 201 | 58% | 38 / 62 / 93 / 8 / 0 / 0 |
| card/freePlay | 170 | 89% | 0 / 110 / 60 / 0 / 0 / 0 |
| unit/cantAttack | 168 | 47% | 41 / 45 / 77 / 5 / 0 / 0 |
| unit/weaken | 89 | 57% | 14 / 29 / 46 / 0 / 0 / 0 |
| card/playFromTrash | 84 | 80% | 50 / 20 / 14 / 0 / 0 / 0 |
| yesno/addToHand | 78 | 100% | 0 / 78 / 0 / 0 / 0 / 0 |
| unit/call | 67 | 100% | 0 / 27 / 40 / 0 / 0 / 0 |
| unit/bottomdeck | 60 | 83% | 43 / 5 / 11 / 1 / 0 / 0 |
| unit/equip | 52 | 87% | 20 / 8 / 14 / 10 / 0 / 0 |
| yesno/discardFor | 45 | 100% | 0 / 45 / 0 / 0 / 0 / 0 |
| unit/sacrifice | 37 | 92% | 28 / 7 / 2 / 0 / 0 / 0 |
| yesno/draw | 12 | 100% | 0 / 12 / 0 / 0 / 0 / 0 |
| mode/foolOnTheHill | 9 | 44% | 0 / 9 / 0 / 0 / 0 / 0 |
| mode/rivalChoice | 1 | 0% | 0 / 1 / 0 / 0 / 0 / 0 |

Reaction windows: 2153 attacks. Reacted to 667 (deck won 11% (8–14) n=431): stole 211, stoleNothing 1, attackerGone 14, targetGone 417, bothGone 23, noneGone 1. Let 1486 resolve (10% (7–13) n=442): stole 1093, stoleNothing 5, attackerGone 3, targetGone 349, bothGone 36. Choices: block 400, endReact 1660, call 342, play 27.

## S1-01 Mutant (RRY) — 560 games, 62% won, 26085 decisions

| Card | Use | Uses | Win rate in games used (95%) | Legal turns → used | Not chosen | Early / mid / late uses | Ahead | Even | Behind |
|---|---|---|---|---|---|---|---|---|---|
| Animals Wrecker | attacked | 811 | 71% (66–76) n=317 | 774 → 728 | 6% | 0 / 211 / 600 | 89% (84–93) n=161 | 88% (79–93) n=82 | 65% (59–71) n=221 |
| Rockn' Rockerboy | attacked | 715 | 66% (60–71) n=288 | 808 → 661 | 18% | 0 / 337 / 378 | 81% (74–86) n=177 | 72% (62–80) n=86 | 59% (51–66) n=162 |
| 6th Street Recruits | attacked | 682 | 62% (56–67) n=317 | 853 → 633 | 26% | 78 / 236 / 368 | 80% (73–85) n=173 | 59% (49–68) n=107 | 49% (41–56) n=170 |
| Kerry Eurodyne: The Last Rockerboy | attacked | 600 | 60% (55–65) n=339 | 878 → 547 | 38% | 17 / 124 / 459 | 85% (79–90) n=148 | 59% (48–70) n=74 | 46% (39–53) n=213 |
| Dexter DeShawn: One Last Chance | attacked | 536 | 66% (60–71) n=274 | 690 → 479 | 31% | 38 / 126 / 372 | 85% (78–90) n=139 | 71% (61–80) n=83 | 52% (44–60) n=151 |
| Yorinobu Arasaka: Steel Dragon | attacked | 534 | 73% (68–78) n=279 | 547 → 483 | 12% | 0 / 0 / 534 | 93% (89–96) n=178 | 80% (68–88) n=55 | 57% (49–65) n=143 |
| Yorinobu Arasaka: Steel Dragon | played | 521 | 63% (58–67) n=391 | 644 → 521 | 19% | 0 / 251 / 270 | 82% (75–88) n=140 | 64% (51–76) n=56 | 53% (46–59) n=247 |
| Animals Wrecker | played | 516 | 65% (61–70) n=394 | 743 → 516 | 31% | 0 / 347 / 169 | 79% (72–85) n=139 | 75% (64–83) n=83 | 57% (51–64) n=225 |
| Bonnie and Clyde | sold | 484 | 61% (56–66) n=364 | 1270 → 484 | 62% | 114 / 198 / 172 | 76% (68–82) n=156 | 63% (53–72) n=99 | 45% (38–52) n=174 |
| Rockn' Rockerboy | played | 468 | 62% (56–66) n=359 | 895 → 468 | 48% | 240 / 91 / 137 | 75% (69–81) n=182 | 58% (49–66) n=126 | 45% (36–54) n=120 |
| Dexter DeShawn: One Last Chance | played | 466 | 62% (57–67) n=349 | 1276 → 441 | 65% | 140 / 152 / 174 | 80% (73–85) n=162 | 50% (42–59) n=123 | 49% (40–58) n=118 |
| 6th Street Recruits | played | 458 | 60% (54–65) n=352 | 987 → 447 | 55% | 228 / 95 / 135 | 71% (63–77) n=161 | 55% (47–63) n=149 | 41% (32–52) n=94 |
| Detonate | sold | 436 | 63% (58–68) n=358 | 569 → 436 | 23% | 242 / 93 / 101 | 72% (65–78) n=172 | 57% (48–65) n=120 | 51% (42–61) n=103 |
| Adam Smasher: Ender of Legends | called | 415 | 61% (56–66) n=415 | 415 → 415 | 0% | 187 / 84 / 144 | 70% (64–75) n=261 | 46% (35–56) n=83 | 46% (35–58) n=71 |
| Dexter DeShawn: Off the Grid | called | 395 | 62% (57–66) n=395 | 395 → 395 | 0% | 192 / 90 / 113 | 75% (69–80) n=240 | 46% (35–57) n=70 | 39% (29–49) n=85 |

(32 more card uses in the JSON report.)

Legal but never taken: Adam Smasher: Ender of Legends (Legend play, legal in 327 turns).

| Decision type | Decisions | First-listed option taken | Options offered (1 / 2 / 3–5 / 6–10 / 11–20 / 21+) |
|---|---|---|---|
| main | 14535 | 8% | 0 / 1000 / 3562 / 5247 / 4397 / 329 |
| gig/steal | 3785 | 25% | 134 / 495 / 1696 / 1439 / 21 / 0 |
| gig/rollIn | 2240 | 0% | 0 / 560 / 1680 / 0 / 0 / 0 |
| gigValue/adjust | 1587 | 13% | 0 / 0 / 89 / 168 / 956 / 374 |
| react | 892 | 63% | 0 / 463 / 429 / 0 / 0 / 0 |
| unit/defeat | 615 | 61% | 166 / 177 / 251 / 19 / 2 / 0 |
| mulligan | 560 | 16% | 0 / 560 / 0 / 0 / 0 / 0 |
| mode/mode | 505 | 72% | 0 / 505 / 0 / 0 / 0 / 0 |
| unit/pump | 500 | 47% | 144 / 144 / 199 / 13 / 0 / 0 |
| card/playFree | 498 | 61% | 0 / 122 / 343 / 33 / 0 / 0 |
| unit/equip | 143 | 75% | 22 / 35 / 57 / 29 / 0 / 0 |
| unit/sacrifice | 59 | 64% | 24 / 16 / 18 / 1 / 0 / 0 |
| card/search | 54 | 69% | 25 / 23 / 6 / 0 / 0 / 0 |
| card/discard | 38 | 42% | 6 / 9 / 23 / 0 / 0 / 0 |
| card/defeatGear | 32 | 84% | 0 / 31 / 1 / 0 / 0 / 0 |
| yesno/draw | 20 | 100% | 0 / 20 / 0 / 0 / 0 / 0 |
| card/defeat | 16 | 81% | 11 / 3 / 1 / 1 / 0 / 0 |
| mode/foolOnTheHill | 5 | 20% | 0 / 5 / 0 / 0 / 0 / 0 |
| mode/rivalChoice | 1 | 0% | 0 / 1 / 0 / 0 / 0 / 0 |

Reaction windows: 857 attacks. Reacted to 323 (deck won 50% (44–56) n=279): stole 263, attackerGone 4, targetGone 44, bothGone 12. Let 534 resolve (52% (46–58) n=245): stole 374, stoleNothing 3, targetGone 147, bothGone 10. Choices: endReact 566, call 316, play 7, ability 3.

## S1-02 Mutant (RYY) — 560 games, 31% won, 25647 decisions

| Card | Use | Uses | Win rate in games used (95%) | Legal turns → used | Not chosen | Early / mid / late uses | Ahead | Even | Behind |
|---|---|---|---|---|---|---|---|---|---|
| Rockn' Rockerboy | attacked | 850 | 38% (33–44) n=313 | 866 → 770 | 11% | 0 / 366 / 484 | 55% (47–62) n=163 | 54% (44–64) n=93 | 34% (28–40) n=210 |
| 6th Street Recruits | attacked | 799 | 37% (32–42) n=346 | 865 → 726 | 16% | 74 / 264 / 461 | 49% (42–57) n=164 | 46% (37–55) n=115 | 30% (24–36) n=209 |
| Dexter DeShawn: Off the Grid | ability | 672 | 31% (27–36) n=405 | 2026 → 672 | 67% | 32 / 102 / 538 | 51% (44–57) n=226 | 15% (9–24) n=93 | 10% (7–15) n=201 |
| 6th Street Recruits | played | 611 | 34% (30–39) n=416 | 1019 → 598 | 41% | 206 / 188 / 217 | 44% (37–51) n=169 | 31% (24–39) n=151 | 24% (19–31) n=188 |
| Dexter DeShawn: One Last Chance | played | 570 | 32% (28–37) n=401 | 1034 → 531 | 49% | 165 / 215 / 190 | 43% (36–51) n=176 | 27% (20–35) n=132 | 22% (17–29) n=166 |
| Dexter DeShawn: One Last Chance | attacked | 552 | 35% (30–41) n=305 | 719 → 494 | 31% | 32 / 159 / 361 | 61% (52–70) n=110 | 51% (40–62) n=78 | 23% (18–30) n=202 |
| Rockn' Rockerboy | played | 520 | 36% (32–41) n=381 | 720 → 519 | 28% | 221 / 154 / 145 | 49% (42–57) n=182 | 30% (23–39) n=129 | 27% (20–35) n=142 |
| Minotaur | played | 503 | 30% (26–35) n=380 | 750 → 503 | 33% | 0 / 158 / 345 | 52% (44–60) n=137 | 38% (25–52) n=48 | 15% (11–20) n=242 |
| Gilded Matón | played | 461 | 32% (27–37) n=352 | 1745 → 440 | 75% | 62 / 104 / 295 | 51% (43–59) n=145 | 20% (13–29) n=87 | 19% (14–26) n=159 |
| River Ward: Detective on the Hunt | called | 456 | 30% (26–35) n=456 | 456 → 456 | 0% | 200 / 148 / 108 | 35% (29–40) n=275 | 25% (17–35) n=85 | 23% (16–32) n=96 |
| Dexter DeShawn: Off the Grid | called | 448 | 32% (28–37) n=448 | 448 → 448 | 0% | 217 / 137 / 94 | 40% (34–46) n=256 | 27% (19–37) n=89 | 18% (12–27) n=103 |
| Viktor Vektor: Sit Down and Relax | called | 427 | 32% (27–36) n=427 | 427 → 427 | 0% | 209 / 123 / 95 | 41% (35–47) n=253 | 19% (12–28) n=85 | 18% (11–27) n=89 |
| Heywood Ripperdoc | attacked | 410 | 32% (26–38) n=223 | 437 → 399 | 9% | 0 / 94 / 316 | 60% (49–69) n=89 | 60% (44–73) n=42 | 20% (14–27) n=150 |
| River Ward: Detective on the Hunt | ability | 404 | 32% (27–38) n=291 | 1894 → 404 | 79% | 34 / 75 / 295 | 50% (42–57) n=155 | 26% (16–39) n=54 | 13% (8–20) n=138 |
| Minotaur | attacked | 377 | 35% (29–42) n=218 | 382 → 354 | 7% | 0 / 1 / 376 | 59% (48–68) n=92 | 73% (58–84) n=44 | 25% (18–33) n=132 |

(31 more card uses in the JSON report.)

Legal but never taken: Cyberpsychosis (played, legal in 113 turns).

| Decision type | Decisions | First-listed option taken | Options offered (1 / 2 / 3–5 / 6–10 / 11–20 / 21+) |
|---|---|---|---|
| main | 14379 | 8% | 0 / 1226 / 3763 / 5585 / 3649 / 156 |
| gig/steal | 2837 | 26% | 146 / 384 / 1129 / 1160 / 18 / 0 |
| gig/rollIn | 2240 | 0% | 0 / 560 / 1680 / 0 / 0 / 0 |
| gigValue/adjust | 1941 | 13% | 0 / 0 / 101 / 246 / 1200 / 394 |
| react | 1311 | 79% | 0 / 904 / 407 / 0 / 0 / 0 |
| mulligan | 560 | 16% | 0 / 560 / 0 / 0 / 0 / 0 |
| mode/mode | 534 | 66% | 0 / 534 / 0 / 0 / 0 / 0 |
| unit/pump | 352 | 60% | 118 / 135 / 98 / 1 / 0 / 0 |
| unit/equip | 343 | 81% | 30 / 82 / 184 / 47 / 0 / 0 |
| card/defeatGear | 225 | 46% | 0 / 176 / 49 / 0 / 0 / 0 |
| unit/defeat | 224 | 82% | 131 / 35 / 43 / 15 / 0 / 0 |
| unit/sacrifice | 192 | 57% | 65 / 58 / 67 / 2 / 0 / 0 |
| card/search | 171 | 95% | 21 / 137 / 13 / 0 / 0 / 0 |
| card/playFree | 126 | 92% | 110 / 6 / 10 / 0 / 0 / 0 |
| card/trash | 107 | 55% | 0 / 107 / 0 / 0 / 0 / 0 |
| card/discard | 53 | 57% | 11 / 12 / 29 / 1 / 0 / 0 |
| yesno/draw | 43 | 100% | 0 / 43 / 0 / 0 / 0 / 0 |
| mode/foolOnTheHill | 8 | 25% | 0 / 8 / 0 / 0 / 0 / 0 |
| yesno/playFree | 1 | 100% | 0 / 1 / 0 / 0 / 0 / 0 |

Reaction windows: 1260 attacks. Reacted to 269 (deck won 23% (18–28) n=246): stole 223, stoleNothing 1, attackerGone 9, targetGone 27, bothGone 9. Let 991 resolve (28% (24–33) n=357): stole 730, stoleNothing 1, targetGone 245, bothGone 15. Choices: call 257, endReact 1033, play 3, ability 18.

## S1-03 Mutant (RBG) — 560 games, 46% won, 24562 decisions

| Card | Use | Uses | Win rate in games used (95%) | Legal turns → used | Not chosen | Early / mid / late uses | Ahead | Even | Behind |
|---|---|---|---|---|---|---|---|---|---|
| 6th Street Recruits | attacked | 745 | 48% (42–53) n=318 | 840 → 660 | 21% | 55 / 271 / 419 | 68% (60–74) n=173 | 54% (44–63) n=99 | 37% (31–44) n=191 |
| Nadia: Fighting Through Grief | attacked | 711 | 47% (42–53) n=308 | 755 → 649 | 14% | 0 / 241 / 470 | 70% (62–77) n=150 | 70% (56–81) n=50 | 41% (35–47) n=241 |
| Psycho Squad | attacked | 692 | 51% (46–57) n=314 | 825 → 622 | 25% | 58 / 239 / 395 | 67% (60–74) n=170 | 52% (42–61) n=99 | 41% (33–48) n=165 |
| Wakako Okada: Peace and Harmony | ability | 537 | 40% (35–46) n=359 | 1977 → 537 | 73% | 7 / 149 / 381 | 61% (54–68) n=206 | 17% (10–27) n=72 | 15% (10–21) n=156 |
| MaxTac AV | attacked | 525 | 54% (47–60) n=240 | 583 → 510 | 13% | 0 / 241 / 284 | 66% (58–73) n=148 | 72% (57–83) n=46 | 43% (34–51) n=122 |
| Valentino Street Racer | played | 522 | 44% (39–49) n=373 | 1137 → 480 | 58% | 111 / 286 / 125 | 56% (49–63) n=171 | 28% (21–37) n=116 | 36% (29–45) n=137 |
| Psycho Squad | played | 521 | 49% (44–54) n=383 | 962 → 513 | 47% | 216 / 171 / 134 | 59% (52–67) n=170 | 42% (34–50) n=147 | 41% (33–49) n=139 |
| 6th Street Recruits | played | 519 | 45% (40–50) n=371 | 1021 → 509 | 50% | 205 / 155 / 159 | 57% (50–65) n=167 | 41% (34–50) n=145 | 31% (23–40) n=123 |
| Nocturne OP55 N1 | sold | 507 | 46% (41–51) n=385 | 959 → 507 | 47% | 186 / 209 / 112 | 57% (49–65) n=156 | 36% (28–45) n=123 | 41% (34–49) n=168 |
| Valentino Street Racer | attacked | 491 | 45% (40–51) n=283 | 649 → 442 | 32% | 19 / 155 / 317 | 62% (54–69) n=150 | 45% (33–57) n=67 | 30% (23–38) n=135 |
| Nadia: Fighting Through Grief | played | 449 | 46% (41–52) n=350 | 712 → 449 | 37% | 0 / 314 / 135 | 53% (45–61) n=138 | 51% (39–63) n=61 | 41% (34–48) n=200 |
| Adam Smasher: Ender of Legends | called | 426 | 47% (42–52) n=426 | 426 → 426 | 0% | 192 / 155 / 79 | 55% (49–60) n=286 | 30% (20–42) n=64 | 34% (25–45) n=76 |
| Saburo Arasaka: Stubborn Patriarch | called | 418 | 45% (41–50) n=418 | 418 → 418 | 0% | 196 / 156 / 66 | 51% (45–57) n=292 | 33% (23–46) n=63 | 30% (20–42) n=63 |
| Wakako Okada: Peace and Harmony | called | 405 | 49% (44–53) n=405 | 405 → 405 | 0% | 227 / 115 / 63 | 55% (49–60) n=275 | 39% (28–52) n=59 | 34% (24–45) n=71 |
| Placide: Voodoo Sentinel | played | 364 | 47% (41–52) n=312 | 458 → 364 | 21% | 0 / 0 / 364 | 76% (67–83) n=116 | 54% (38–69) n=37 | 29% (23–36) n=182 |

(32 more card uses in the JSON report.)

Legal but never taken: Synapse Burnout (played, legal in 550 turns).

| Decision type | Decisions | First-listed option taken | Options offered (1 / 2 / 3–5 / 6–10 / 11–20 / 21+) |
|---|---|---|---|
| main | 13701 | 7% | 0 / 1183 / 4034 / 5381 / 2972 / 131 |
| gig/steal | 3357 | 28% | 129 / 535 / 1424 / 1247 / 22 / 0 |
| gig/rollIn | 2240 | 0% | 0 / 560 / 1680 / 0 / 0 / 0 |
| react | 765 | 55% | 0 / 456 / 309 / 0 / 0 / 0 |
| gigValue/adjust | 690 | 6% | 0 / 0 / 2 / 43 / 394 / 251 |
| mode/mode | 578 | 75% | 0 / 529 / 49 / 0 / 0 / 0 |
| mulligan | 560 | 16% | 0 / 560 / 0 / 0 / 0 / 0 |
| unit/adrenaline | 428 | 60% | 192 / 156 / 80 / 0 / 0 / 0 |
| unit/weaken | 382 | 68% | 136 / 129 / 114 / 3 / 0 / 0 |
| gig/swapGive | 319 | 35% | 0 / 19 / 248 / 52 / 0 / 0 |
| gig/swapTake | 262 | 53% | 53 / 71 / 88 / 50 / 0 / 0 |
| unit/defeat | 257 | 34% | 20 / 39 / 180 / 18 / 0 / 0 |
| unit/bottomdeck | 256 | 48% | 69 / 49 / 135 / 3 / 0 / 0 |
| card/discard | 226 | 73% | 13 / 132 / 80 / 1 / 0 / 0 |
| unit/equip | 179 | 85% | 18 / 66 / 80 / 15 / 0 / 0 |
| unit/spend | 89 | 52% | 21 / 37 / 31 / 0 / 0 / 0 |
| unit/bottomdeckOwn | 81 | 69% | 40 / 20 / 21 / 0 / 0 / 0 |
| unit/sacrifice | 55 | 82% | 34 / 10 / 10 / 1 / 0 / 0 |
| yesno/draw | 43 | 100% | 0 / 43 / 0 / 0 / 0 / 0 |
| unit/ready | 34 | 100% | 0 / 34 / 0 / 0 / 0 / 0 |
| card/playFree | 23 | 100% | 0 / 18 / 5 / 0 / 0 / 0 |
| unit/pump | 22 | 73% | 6 / 9 / 7 / 0 / 0 / 0 |
| mode/foolOnTheHill | 7 | 14% | 0 / 7 / 0 / 0 / 0 / 0 |
| mode/rivalChoice | 5 | 20% | 0 / 5 / 0 / 0 / 0 / 0 |
| card/discardForNothing | 3 | 0% | 0 / 2 / 1 / 0 / 0 / 0 |

Reaction windows: 746 attacks. Reacted to 334 (deck won 36% (31–42) n=292): stole 243, stoleNothing 3, attackerGone 17, targetGone 52, bothGone 18, noneGone 1. Let 412 resolve (41% (35–48) n=214): stole 316, stoleNothing 2, targetGone 88, bothGone 6. Choices: endReact 424, call 319, play 22.

## S1-04 Cross (RBG) — 560 games, 37% won, 27405 decisions

| Card | Use | Uses | Win rate in games used (95%) | Legal turns → used | Not chosen | Early / mid / late uses | Ahead | Even | Behind |
|---|---|---|---|---|---|---|---|---|---|
| 6th Street Recruits | attacked | 812 | 45% (40–50) n=347 | 867 → 722 | 17% | 70 / 274 / 468 | 62% (55–69) n=171 | 45% (37–54) n=117 | 37% (31–44) n=202 |
| Psycho Squad | attacked | 749 | 41% (36–46) n=340 | 852 → 691 | 19% | 68 / 225 / 456 | 63% (56–70) n=163 | 33% (25–42) n=109 | 33% (27–40) n=201 |
| Wakako Okada: Peace and Harmony | ability | 675 | 33% (29–38) n=422 | 1983 → 675 | 66% | 5 / 164 / 506 | 51% (45–57) n=241 | 20% (14–29) n=108 | 10% (7–15) n=193 |
| Dexter DeShawn: Off the Grid | ability | 648 | 34% (29–38) n=411 | 1980 → 648 | 67% | 7 / 143 / 498 | 54% (47–60) n=239 | 15% (9–24) n=91 | 9% (6–14) n=192 |
| MaxTac AV | attacked | 630 | 41% (35–47) n=268 | 702 → 601 | 14% | 0 / 306 / 324 | 53% (46–61) n=169 | 48% (35–61) n=52 | 34% (27–41) n=155 |
| Nadia: Fighting Through Grief | attacked | 627 | 36% (30–42) n=272 | 649 → 578 | 11% | 0 / 202 / 425 | 67% (57–75) n=111 | 56% (41–70) n=41 | 31% (25–37) n=225 |
| 6th Street Recruits | played | 595 | 41% (37–46) n=415 | 1113 → 585 | 47% | 196 / 194 / 205 | 50% (43–56) n=202 | 39% (32–47) n=143 | 29% (22–36) n=157 |
| Valentino Street Racer | played | 582 | 36% (32–41) n=409 | 1138 → 540 | 53% | 114 / 288 / 180 | 47% (41–54) n=207 | 22% (15–31) n=105 | 29% (23–36) n=166 |
| Psycho Squad | played | 574 | 38% (34–43) n=409 | 1019 → 564 | 45% | 188 / 187 / 199 | 54% (47–61) n=191 | 28% (21–36) n=138 | 29% (22–36) n=159 |
| Valentino Street Racer | attacked | 531 | 38% (33–44) n=291 | 721 → 482 | 33% | 18 / 141 / 372 | 53% (45–61) n=146 | 45% (34–56) n=78 | 28% (21–35) n=154 |
| Nocturne OP55 N1 | sold | 468 | 38% (33–43) n=359 | 930 → 468 | 50% | 157 / 216 / 95 | 45% (38–53) n=172 | 29% (21–38) n=104 | 33% (26–41) n=136 |
| Placide: Voodoo Sentinel | played | 458 | 41% (37–47) n=364 | 518 → 458 | 12% | 0 / 0 / 458 | 67% (59–75) n=131 | 55% (40–70) n=38 | 29% (23–35) n=233 |
| Dexter DeShawn: Off the Grid | called | 436 | 39% (34–43) n=436 | 436 → 436 | 0% | 189 / 181 / 66 | 46% (40–51) n=283 | 18% (10–30) n=55 | 31% (22–40) n=98 |
| Saburo Arasaka: Stubborn Patriarch | called | 422 | 35% (31–40) n=422 | 422 → 422 | 0% | 204 / 131 / 87 | 42% (37–48) n=274 | 25% (17–36) n=75 | 19% (12–30) n=73 |
| Wakako Okada: Peace and Harmony | called | 406 | 38% (33–43) n=406 | 406 → 406 | 0% | 197 / 156 / 53 | 42% (37–48) n=276 | 25% (16–37) n=60 | 31% (22–43) n=70 |

(30 more card uses in the JSON report.)

| Decision type | Decisions | First-listed option taken | Options offered (1 / 2 / 3–5 / 6–10 / 11–20 / 21+) |
|---|---|---|---|
| main | 14767 | 7% | 0 / 1371 / 4139 / 5486 / 3619 / 152 |
| gig/steal | 3244 | 26% | 161 / 526 / 1345 / 1197 / 15 / 0 |
| gig/rollIn | 2240 | 0% | 0 / 560 / 1680 / 0 / 0 / 0 |
| gigValue/adjust | 1485 | 6% | 0 / 0 / 1 / 77 / 921 / 486 |
| mode/mode | 1140 | 74% | 0 / 1066 / 74 / 0 / 0 / 0 |
| react | 756 | 56% | 0 / 480 / 276 / 0 / 0 / 0 |
| mulligan | 560 | 18% | 0 / 560 / 0 / 0 / 0 / 0 |
| unit/adrenaline | 472 | 56% | 206 / 145 / 121 / 0 / 0 / 0 |
| unit/weaken | 403 | 68% | 145 / 149 / 108 / 1 / 0 / 0 |
| gig/swapGive | 387 | 37% | 0 / 15 / 298 / 73 / 1 / 0 |
| unit/pump | 364 | 60% | 125 / 137 / 100 / 2 / 0 / 0 |
| unit/bottomdeck | 337 | 50% | 86 / 84 / 164 / 3 / 0 / 0 |
| gig/swapTake | 323 | 52% | 70 / 98 / 98 / 54 / 3 / 0 |
| card/discard | 284 | 77% | 8 / 185 / 89 / 2 / 0 / 0 |
| unit/equip | 213 | 88% | 21 / 55 / 109 / 28 / 0 / 0 |
| unit/spend | 117 | 59% | 36 / 51 / 30 / 0 / 0 / 0 |
| unit/bottomdeckOwn | 99 | 71% | 51 / 29 / 19 / 0 / 0 / 0 |
| unit/defeat | 54 | 56% | 3 / 4 / 27 / 20 / 0 / 0 |
| yesno/draw | 51 | 100% | 0 / 51 / 0 / 0 / 0 / 0 |
| unit/sacrifice | 43 | 88% | 24 / 13 / 6 / 0 / 0 / 0 |
| gigValue/setGig | 41 | 7% | 0 / 0 / 0 / 4 / 6 / 31 |
| card/playFree | 14 | 93% | 0 / 11 / 3 / 0 / 0 / 0 |
| mode/foolOnTheHill | 6 | 83% | 0 / 6 / 0 / 0 / 0 / 0 |
| card/discardForNothing | 5 | 0% | 0 / 2 / 3 / 0 / 0 / 0 |

Reaction windows: 750 attacks. Reacted to 329 (deck won 27% (22–32) n=290): stole 275, stoleNothing 6, attackerGone 6, targetGone 34, bothGone 8. Let 421 resolve (36% (30–43) n=219): stole 319, stoleNothing 1, targetGone 99, bothGone 2. Choices: endReact 426, call 326, play 4.

## S1-05 Cross (RBB) — 560 games, 51% won, 24243 decisions

| Card | Use | Uses | Win rate in games used (95%) | Legal turns → used | Not chosen | Early / mid / late uses | Ahead | Even | Behind |
|---|---|---|---|---|---|---|---|---|---|
| 6th Street Recruits | attacked | 746 | 50% (44–55) n=339 | 860 → 693 | 19% | 65 / 306 / 375 | 60% (53–66) n=196 | 60% (50–68) n=114 | 40% (33–47) n=178 |
| Psycho Squad | attacked | 733 | 52% (47–57) n=332 | 836 → 669 | 20% | 66 / 287 / 380 | 61% (55–68) n=205 | 54% (44–63) n=102 | 46% (38–53) n=160 |
| Alt Cunningham: Soulkiller Architect | ability | 688 | 50% (45–54) n=436 | 1707 → 688 | 60% | 6 / 101 / 581 | 63% (57–68) n=284 | 48% (38–58) n=94 | 20% (15–27) n=182 |
| V: Streetkid | attacked | 679 | 50% (45–55) n=402 | 794 → 679 | 14% | 19 / 223 / 437 | 62% (56–67) n=253 | 59% (48–70) n=76 | 33% (26–41) n=166 |
| Jacked-In Voodoo Boy | played | 550 | 48% (43–53) n=406 | 1072 → 520 | 51% | 240 / 181 / 129 | 53% (47–58) n=283 | 45% (35–55) n=93 | 25% (17–35) n=81 |
| Psycho Squad | played | 525 | 51% (46–56) n=383 | 944 → 520 | 45% | 218 / 172 / 135 | 56% (49–63) n=210 | 48% (40–56) n=149 | 29% (20–39) n=91 |
| 6th Street Recruits | played | 522 | 51% (46–56) n=398 | 1004 → 517 | 49% | 212 / 176 / 134 | 55% (48–61) n=220 | 51% (43–59) n=141 | 36% (27–47) n=88 |
| Trust No One | sold | 478 | 50% (45–55) n=367 | 723 → 478 | 34% | 238 / 114 / 126 | 55% (48–62) n=184 | 54% (45–62) n=134 | 33% (25–43) n=103 |
| V: Streetkid | Go Solo (self-paid 418) | 418 | 49% (44–54) n=418 | 969 → 418 | 57% | 22 / 196 / 200 | 59% (52–65) n=219 | 44% (30–59) n=43 | 36% (29–44) n=156 |
| Jackie Welles: Pour One Out For Me | called | 413 | 52% (47–56) n=413 | 413 → 413 | 0% | 126 / 192 / 95 | 56% (51–62) n=311 | 42% (31–54) n=66 | 28% (16–44) n=36 |
| V: Streetkid | called | 411 | 54% (49–59) n=411 | 411 → 411 | 0% | 142 / 190 / 79 | 58% (52–63) n=291 | 52% (40–63) n=66 | 35% (24–49) n=54 |
| Alt Cunningham: Soulkiller Architect | called | 409 | 52% (47–56) n=409 | 409 → 409 | 0% | 120 / 207 / 82 | 57% (51–62) n=307 | 41% (29–54) n=54 | 29% (18–43) n=48 |
| Maman Brigitte: Spirit of Death | attacked | 388 | 49% (43–56) n=226 | 492 → 376 | 24% | 0 / 182 / 206 | 60% (52–68) n=148 | 56% (42–68) n=52 | 31% (21–42) n=71 |
| Shattered Memories | sold | 373 | 53% (47–58) n=316 | 843 → 373 | 56% | 114 / 142 / 117 | 60% (52–67) n=155 | 50% (40–60) n=96 | 40% (30–50) n=90 |
| Jacked-In Voodoo Boy | attacked | 369 | 49% (42–55) n=217 | 344 → 317 | 8% | 44 / 81 / 244 | 60% (51–67) n=139 | 52% (38–66) n=46 | 26% (18–36) n=84 |

(33 more card uses in the JSON report.)

Legal but never taken: V: Streetkid (Legend play, legal in 969 turns).

| Decision type | Decisions | First-listed option taken | Options offered (1 / 2 / 3–5 / 6–10 / 11–20 / 21+) |
|---|---|---|---|
| main | 13410 | 7% | 0 / 1279 / 3816 / 5468 / 2776 / 71 |
| gig/steal | 2991 | 33% | 220 / 594 / 1367 / 792 / 18 / 0 |
| gig/rollIn | 2240 | 100% | 0 / 560 / 1680 / 0 / 0 / 0 |
| gigValue/adjust | 1175 | 19% | 0 / 43 / 221 / 342 / 314 / 255 |
| react | 902 | 58% | 0 / 549 / 352 / 1 / 0 / 0 |
| unit/bottomdeck | 842 | 78% | 552 / 143 / 142 / 5 / 0 / 0 |
| card/discard | 616 | 64% | 115 / 310 / 190 / 1 / 0 / 0 |
| mulligan | 560 | 16% | 0 / 560 / 0 / 0 / 0 / 0 |
| card/search | 450 | 70% | 217 / 144 / 83 / 6 / 0 / 0 |
| card/playFromTrash | 445 | 62% | 161 / 140 / 141 / 3 / 0 / 0 |
| yesno/discardFor | 200 | 100% | 0 / 200 / 0 / 0 / 0 / 0 |
| unit/weaken | 80 | 64% | 28 / 25 / 26 / 1 / 0 / 0 |
| mode/mode | 79 | 91% | 0 / 7 / 72 / 0 / 0 / 0 |
| unit/bottomdeckOwn | 76 | 70% | 24 / 23 / 29 / 0 / 0 / 0 |
| unit/cantAttack | 61 | 57% | 18 / 19 / 23 / 1 / 0 / 0 |
| unit/sacrifice | 61 | 90% | 45 / 12 / 4 / 0 / 0 / 0 |
| unit/call | 23 | 100% | 0 / 10 / 13 / 0 / 0 / 0 |
| yesno/draw | 21 | 100% | 0 / 21 / 0 / 0 / 0 / 0 |
| card/discardForNothing | 6 | 0% | 0 / 4 / 2 / 0 / 0 / 0 |
| mode/foolOnTheHill | 4 | 75% | 0 / 4 / 0 / 0 / 0 / 0 |
| mode/rivalChoice | 1 | 0% | 0 / 1 / 0 / 0 / 0 / 0 |

Reaction windows: 869 attacks. Reacted to 370 (deck won 45% (39–50) n=314): stole 267, stoleNothing 1, attackerGone 4, targetGone 89, bothGone 9. Let 499 resolve (43% (36–49) n=232): stole 327, stoleNothing 4, attackerGone 1, targetGone 156, bothGone 11. Choices: endReact 523, call 332, block 38, play 9.

## S1-06 Cross (BGY) — 560 games, 26% won, 26267 decisions

| Card | Use | Uses | Win rate in games used (95%) | Legal turns → used | Not chosen | Early / mid / late uses | Ahead | Even | Behind |
|---|---|---|---|---|---|---|---|---|---|
| Psycho Squad | attacked | 967 | 31% (27–36) n=374 | 1072 → 849 | 21% | 98 / 415 / 454 | 56% (49–64) n=154 | 33% (26–42) n=138 | 29% (24–34) n=274 |
| Psycho Squad | played | 672 | 29% (25–33) n=442 | 902 → 666 | 26% | 359 / 186 / 127 | 36% (29–42) n=211 | 23% (17–30) n=178 | 26% (20–33) n=171 |
| Valentino Street Racer | played | 656 | 27% (23–32) n=447 | 1129 → 599 | 47% | 213 / 297 / 146 | 40% (33–48) n=176 | 20% (14–27) n=157 | 21% (16–27) n=198 |
| Trauma Team Operatives | attacked | 581 | 30% (25–35) n=299 | 624 → 540 | 13% | 0 / 152 / 429 | 70% (60–79) n=88 | 48% (35–61) n=54 | 19% (15–25) n=236 |
| Trauma Team Operatives | played | 580 | 25% (21–29) n=406 | 957 → 566 | 41% | 14 / 331 / 235 | 35% (28–43) n=153 | 19% (12–29) n=79 | 20% (15–25) n=256 |
| Alt Cunningham: Soulkiller Architect | ability | 576 | 27% (22–31) n=400 | 2040 → 573 | 72% | 8 / 143 / 425 | 56% (49–64) n=165 | 19% (12–30) n=73 | 8% (5–13) n=239 |
| Valentino Street Racer | attacked | 556 | 31% (26–36) n=321 | 803 → 506 | 37% | 48 / 198 / 310 | 54% (45–63) n=117 | 33% (24–44) n=82 | 22% (17–28) n=208 |
| Placide: Voodoo Sentinel | played | 540 | 32% (27–36) n=409 | 564 → 540 | 4% | 0 / 0 / 540 | 78% (68–85) n=91 | 45% (30–62) n=33 | 20% (16–25) n=324 |
| Muamar Reyes: El Capitán | ability | 522 | 27% (23–32) n=357 | 2105 → 522 | 75% | 13 / 160 / 349 | 55% (47–62) n=157 | 14% (7–24) n=66 | 9% (6–13) n=214 |
| Hanako Arasaka: Daughter of the Emperor | ability | 514 | 25% (21–30) n=345 | 2051 → 514 | 75% | 15 / 151 / 348 | 50% (42–58) n=145 | 16% (9–27) n=68 | 9% (6–14) n=214 |
| Alt Cunningham: Soulkiller Architect | called | 418 | 28% (24–32) n=418 | 418 → 418 | 0% | 246 / 122 / 50 | 37% (32–43) n=255 | 10% (6–19) n=86 | 17% (10–27) n=77 |
| Hanako Arasaka: Daughter of the Emperor | called | 399 | 27% (22–31) n=399 | 399 → 399 | 0% | 261 / 96 / 42 | 32% (27–38) n=266 | 13% (7–22) n=77 | 20% (11–32) n=56 |
| The Heist | sold | 396 | 28% (23–33) n=329 | 517 → 396 | 23% | 180 / 86 / 130 | 39% (32–47) n=148 | 23% (16–32) n=100 | 17% (11–25) n=119 |
| Muamar Reyes: El Capitán | called | 391 | 28% (24–33) n=391 | 391 → 391 | 0% | 252 / 103 / 36 | 33% (28–39) n=260 | 14% (8–24) n=72 | 22% (13–34) n=59 |
| Chrome Reverie | sold | 387 | 30% (25–35) n=306 | 941 → 387 | 59% | 161 / 132 / 94 | 40% (32–49) n=131 | 25% (17–35) n=96 | 20% (14–28) n=125 |

(30 more card uses in the JSON report.)

Legal but never taken: Take Control (played, legal in 826 turns).

| Decision type | Decisions | First-listed option taken | Options offered (1 / 2 / 3–5 / 6–10 / 11–20 / 21+) |
|---|---|---|---|
| main | 14021 | 9% | 0 / 924 / 3204 / 5280 / 4483 / 130 |
| gig/rollIn | 2240 | 100% | 0 / 560 / 1680 / 0 / 0 / 0 |
| gig/steal | 2225 | 28% | 44 / 324 / 825 / 1022 / 10 / 0 |
| react | 954 | 44% | 0 / 534 / 418 / 2 / 0 / 0 |
| gigValue/adjust | 792 | 11% | 0 / 27 / 56 / 99 / 471 / 139 |
| unit/bottomdeck | 653 | 45% | 135 / 146 / 361 / 11 / 0 / 0 |
| mulligan | 560 | 27% | 0 / 560 / 0 / 0 / 0 / 0 |
| mode/muamarCall | 549 | 75% | 0 / 549 / 0 / 0 / 0 / 0 |
| card/discard | 526 | 74% | 8 / 291 / 223 / 4 / 0 / 0 |
| gig/swapGive | 514 | 46% | 33 / 79 / 243 / 156 / 3 / 0 |
| gig/swapTake | 514 | 28% | 23 / 47 / 208 / 226 / 10 / 0 |
| card/playFromTrash | 393 | 58% | 154 / 95 / 136 / 8 / 0 / 0 |
| unit/protect | 375 | 70% | 198 / 131 / 46 / 0 / 0 / 0 |
| unit/adrenaline | 374 | 78% | 232 / 118 / 24 / 0 / 0 / 0 |
| unit/spend | 358 | 44% | 80 / 124 / 152 / 2 / 0 / 0 |
| mode/mode | 224 | 100% | 0 / 0 / 224 / 0 / 0 / 0 |
| unit/cantAttack | 207 | 54% | 66 / 74 / 67 / 0 / 0 / 0 |
| unit/bottomdeckOwn | 165 | 77% | 91 / 49 / 25 / 0 / 0 / 0 |
| unit/stealMod | 162 | 64% | 18 / 65 / 77 / 2 / 0 / 0 |
| gigValue/setGig | 97 | 8% | 0 / 1 / 7 / 21 / 20 / 48 |
| unit/call | 89 | 100% | 0 / 44 / 45 / 0 / 0 / 0 |
| unit/weaken | 84 | 57% | 12 / 35 / 35 / 2 / 0 / 0 |
| unit/equip | 71 | 73% | 11 / 2 / 51 / 7 / 0 / 0 |
| unit/ready | 53 | 100% | 0 / 53 / 0 / 0 / 0 / 0 |
| unit/sacrifice | 43 | 84% | 23 / 15 / 5 / 0 / 0 / 0 |
| card/discardForNothing | 10 | 0% | 0 / 7 / 3 / 0 / 0 / 0 |
| yesno/draw | 8 | 100% | 0 / 8 / 0 / 0 / 0 / 0 |
| card/search | 2 | 100% | 2 / 0 / 0 / 0 / 0 / 0 |
| mode/foolOnTheHill | 2 | 100% | 0 / 2 / 0 / 0 / 0 / 0 |
| yesno/playFree | 2 | 100% | 0 / 2 / 0 / 0 / 0 / 0 |

Reaction windows: 899 attacks. Reacted to 488 (deck won 22% (18–27) n=357): stole 285, stoleNothing 145, attackerGone 5, targetGone 31, bothGone 6, noneGone 16. Let 411 resolve (20% (15–25) n=214): stole 328, stoleNothing 3, targetGone 75, bothGone 5. Choices: endReact 424, call 332, play 198.

## S1-07 Explorer (RYY) — 560 games, 33% won, 25756 decisions

| Card | Use | Uses | Win rate in games used (95%) | Legal turns → used | Not chosen | Early / mid / late uses | Ahead | Even | Behind |
|---|---|---|---|---|---|---|---|---|---|
| Rockn' Rockerboy | attacked | 1040 | 39% (34–43) n=402 | 1033 → 928 | 10% | 0 / 434 / 606 | 54% (47–60) n=218 | 46% (37–56) n=102 | 32% (26–37) n=260 |
| 6th Street Recruits | attacked | 786 | 38% (33–43) n=363 | 887 → 714 | 20% | 84 / 228 / 474 | 60% (52–67) n=156 | 42% (33–50) n=125 | 29% (23–35) n=227 |
| Rockn' Rockerboy | played | 664 | 36% (32–40) n=451 | 846 → 660 | 22% | 244 / 198 / 222 | 52% (45–59) n=212 | 29% (22–38) n=136 | 24% (19–30) n=218 |
| 6th Street Recruits | played | 627 | 36% (31–40) n=429 | 1064 → 613 | 42% | 220 / 181 / 226 | 51% (44–58) n=184 | 32% (25–39) n=161 | 27% (21–33) n=188 |
| Gilded Matón | played | 511 | 33% (29–38) n=374 | 1639 → 482 | 71% | 64 / 138 / 309 | 50% (42–57) n=167 | 20% (14–29) n=104 | 23% (17–30) n=160 |
| Johnny Silverhand: Rocking Renegade | ability | 468 | 33% (28–38) n=329 | 1694 → 468 | 72% | 2 / 77 / 389 | 51% (44–58) n=175 | 25% (15–37) n=57 | 14% (10–20) n=168 |
| Johnny Silverhand: Rocking Renegade | called | 465 | 35% (30–39) n=465 | 465 → 465 | 0% | 214 / 153 / 98 | 40% (35–46) n=298 | 20% (13–29) n=87 | 31% (22–42) n=80 |
| Kerry Eurodyne: Axe, Attitude, Audience | called | 454 | 32% (28–37) n=454 | 454 → 454 | 0% | 213 / 127 / 114 | 41% (35–46) n=299 | 16% (10–26) n=85 | 16% (9–26) n=70 |
| River Ward: Detective on the Hunt | ability | 451 | 31% (27–37) n=315 | 1889 → 451 | 76% | 24 / 82 / 345 | 48% (41–55) n=183 | 16% (8–27) n=58 | 10% (6–16) n=139 |
| River Ward: Detective on the Hunt | called | 445 | 34% (30–38) n=445 | 445 → 445 | 0% | 218 / 128 / 99 | 40% (35–46) n=295 | 23% (15–33) n=84 | 21% (13–33) n=66 |
| Viktor Vektor: You Might Feel a Little Pinch | played | 419 | 33% (28–38) n=341 | 896 → 402 | 55% | 89 / 186 / 144 | 47% (39–55) n=152 | 21% (14–30) n=99 | 23% (17–31) n=126 |
| Minotaur | played | 412 | 32% (27–37) n=343 | 633 → 412 | 35% | 0 / 149 / 263 | 57% (48–66) n=112 | 27% (17–41) n=51 | 19% (15–25) n=221 |
| Dexter DeShawn: One Last Chance | played | 410 | 32% (27–37) n=334 | 724 → 393 | 46% | 94 / 187 / 129 | 41% (34–50) n=147 | 25% (18–35) n=99 | 25% (19–34) n=126 |
| Cyberpsychosis | sold | 397 | 30% (26–35) n=334 | 744 → 397 | 47% | 119 / 144 / 134 | 44% (36–52) n=132 | 28% (19–40) n=74 | 20% (14–26) n=163 |
| Gilded Matón | attacked | 384 | 35% (29–41) n=240 | 482 → 355 | 26% | 15 / 76 / 293 | 58% (48–68) n=88 | 44% (33–57) n=61 | 24% (18–32) n=146 |

(30 more card uses in the JSON report.)

Legal but never taken: Cyberpsychosis (played, legal in 154 turns).

| Decision type | Decisions | First-listed option taken | Options offered (1 / 2 / 3–5 / 6–10 / 11–20 / 21+) |
|---|---|---|---|
| main | 14671 | 7% | 0 / 1119 / 3891 / 5697 / 3785 / 179 |
| gig/steal | 2743 | 29% | 128 / 406 / 1162 / 1036 / 11 / 0 |
| gig/rollIn | 2240 | 0% | 0 / 560 / 1680 / 0 / 0 / 0 |
| yesno/kerryReroll | 1585 | 56% | 0 / 1585 / 0 / 0 / 0 / 0 |
| react | 1031 | 75% | 0 / 697 / 334 / 0 / 0 / 0 |
| gigValue/adjust | 1029 | 10% | 0 / 9 / 111 / 133 / 525 / 251 |
| mulligan | 560 | 20% | 0 / 560 / 0 / 0 / 0 / 0 |
| unit/lagAttack | 468 | 93% | 96 / 141 / 220 / 11 / 0 / 0 |
| unit/equip | 353 | 75% | 23 / 66 / 206 / 58 / 0 / 0 |
| unit/defeat | 322 | 69% | 108 / 56 / 107 / 50 / 1 / 0 |
| unit/sacrifice | 243 | 60% | 78 / 107 / 58 / 0 / 0 / 0 |
| card/defeatGear | 157 | 55% | 0 / 139 / 18 / 0 / 0 / 0 |
| card/playFree | 100 | 94% | 84 / 7 / 9 / 0 / 0 / 0 |
| card/trash | 88 | 55% | 0 / 88 / 0 / 0 / 0 / 0 |
| yesno/draw | 61 | 100% | 0 / 61 / 0 / 0 / 0 / 0 |
| card/discard | 46 | 35% | 6 / 6 / 33 / 1 / 0 / 0 |
| card/search | 46 | 72% | 22 / 19 / 5 / 0 / 0 / 0 |
| yesno/playFree | 5 | 100% | 0 / 5 / 0 / 0 / 0 / 0 |
| mode/foolOnTheHill | 4 | 75% | 0 / 4 / 0 / 0 / 0 / 0 |
| unit/pump | 3 | 100% | 3 / 0 / 0 / 0 / 0 / 0 |
| mode/rivalChoice | 1 | 0% | 0 / 1 / 0 / 0 / 0 / 0 |

Reaction windows: 993 attacks. Reacted to 254 (deck won 29% (24–35) n=237): stole 207, attackerGone 2, targetGone 41, bothGone 4. Let 739 resolve (33% (28–38) n=310): stole 550, stoleNothing 2, attackerGone 2, targetGone 167, bothGone 18. Choices: call 243, endReact 770, ability 15, play 3.

## S1-08 Explorer (BGG) — 560 games, 45% won, 24351 decisions

| Card | Use | Uses | Win rate in games used (95%) | Legal turns → used | Not chosen | Early / mid / late uses | Ahead | Even | Behind |
|---|---|---|---|---|---|---|---|---|---|
| Psycho Squad | attacked | 719 | 48% (42–53) n=305 | 836 → 656 | 22% | 46 / 281 / 392 | 66% (59–73) n=160 | 54% (45–63) n=113 | 38% (32–46) n=180 |
| Nadia: Fighting Through Grief | attacked | 701 | 42% (37–48) n=307 | 726 → 649 | 11% | 0 / 227 / 474 | 71% (62–78) n=121 | 62% (48–74) n=52 | 34% (28–40) n=243 |
| Pepe Najarro: Working Doubles | attacked | 663 | 49% (43–54) n=302 | 742 → 607 | 18% | 52 / 228 / 383 | 71% (63–78) n=146 | 55% (45–64) n=99 | 37% (30–45) n=170 |
| MaxTac AV | attacked | 563 | 54% (48–60) n=237 | 606 → 541 | 11% | 0 / 250 / 313 | 65% (57–72) n=155 | 75% (63–84) n=63 | 45% (37–54) n=132 |
| Hanako Arasaka: Daughter of the Emperor | ability | 543 | 38% (33–43) n=348 | 1946 → 543 | 72% | 6 / 118 / 419 | 65% (57–71) n=176 | 17% (11–26) n=88 | 16% (11–22) n=166 |
| Psycho Squad | played | 521 | 45% (40–50) n=377 | 1049 → 510 | 51% | 223 / 132 / 166 | 50% (43–57) n=183 | 46% (38–54) n=138 | 29% (21–38) n=118 |
| Pepe Najarro: Working Doubles | played | 514 | 48% (43–53) n=364 | 1022 → 506 | 50% | 191 / 131 / 192 | 66% (59–73) n=170 | 38% (30–47) n=136 | 30% (23–38) n=137 |
| Valentino Street Racer | played | 513 | 44% (39–49) n=386 | 1180 → 469 | 60% | 110 / 205 / 198 | 54% (47–61) n=197 | 32% (24–41) n=106 | 34% (26–42) n=130 |
| Judy Álvarez: Braindance Maestro | ability | 499 | 40% (35–46) n=327 | 1927 → 499 | 74% | 6 / 105 / 388 | 64% (57–71) n=177 | 19% (12–30) n=73 | 21% (15–28) n=160 |
| Valentino Street Racer | attacked | 486 | 42% (37–48) n=280 | 626 → 441 | 30% | 22 / 121 / 343 | 66% (58–74) n=127 | 46% (34–58) n=61 | 27% (21–35) n=164 |
| Nadia: Fighting Through Grief | played | 466 | 44% (39–49) n=356 | 940 → 466 | 50% | 0 / 254 / 212 | 57% (48–65) n=132 | 38% (27–51) n=60 | 33% (28–40) n=227 |
| Judy Álvarez: Braindance Maestro | called | 453 | 46% (41–51) n=453 | 453 → 453 | 0% | 235 / 127 / 91 | 53% (48–59) n=309 | 32% (23–43) n=81 | 27% (18–39) n=63 |
| Saburo Arasaka: Stubborn Patriarch | called | 446 | 44% (40–49) n=446 | 446 → 446 | 0% | 228 / 127 / 91 | 50% (44–56) n=291 | 33% (23–43) n=83 | 35% (25–46) n=72 |
| Hanako Arasaka: Daughter of the Emperor | called | 437 | 46% (41–50) n=437 | 437 → 437 | 0% | 222 / 144 / 71 | 49% (44–55) n=295 | 31% (22–42) n=77 | 46% (35–58) n=65 |
| Placide: Voodoo Sentinel | played | 431 | 42% (37–47) n=340 | 498 → 431 | 13% | 0 / 0 / 431 | 65% (56–73) n=114 | 54% (41–67) n=52 | 27% (21–33) n=208 |

(33 more card uses in the JSON report.)

Legal but never taken: Take Control (played, legal in 292 turns).

| Decision type | Decisions | First-listed option taken | Options offered (1 / 2 / 3–5 / 6–10 / 11–20 / 21+) |
|---|---|---|---|
| main | 13995 | 7% | 0 / 1239 / 4046 / 5748 / 2855 / 107 |
| gig/steal | 3020 | 30% | 125 / 385 / 1387 / 1111 / 12 / 0 |
| gig/rollIn | 2240 | 0% | 0 / 560 / 1680 / 0 / 0 / 0 |
| gig/swapGive | 885 | 36% | 13 / 72 / 475 / 319 / 6 / 0 |
| gig/swapTake | 842 | 37% | 93 / 136 / 328 / 279 / 6 / 0 |
| react | 751 | 57% | 0 / 512 / 236 / 3 / 0 / 0 |
| mulligan | 560 | 27% | 0 / 560 / 0 / 0 / 0 / 0 |
| card/discard | 415 | 60% | 37 / 189 / 185 / 4 / 0 / 0 |
| unit/adrenaline | 384 | 52% | 170 / 135 / 79 / 0 / 0 / 0 |
| unit/defeat | 353 | 64% | 134 / 92 / 125 / 2 / 0 / 0 |
| unit/equip | 262 | 87% | 73 / 37 / 138 / 14 / 0 / 0 |
| yesno/addToHand | 212 | 100% | 0 / 212 / 0 / 0 / 0 / 0 |
| unit/bottomdeck | 186 | 46% | 36 / 54 / 94 / 2 / 0 / 0 |
| unit/spend | 61 | 56% | 26 / 22 / 13 / 0 / 0 / 0 |
| unit/sacrifice | 60 | 90% | 40 / 15 / 5 / 0 / 0 / 0 |
| mode/mode | 33 | 100% | 0 / 0 / 33 / 0 / 0 / 0 |
| unit/pump | 30 | 63% | 12 / 11 / 7 / 0 / 0 / 0 |
| unit/stealMod | 17 | 71% | 1 / 8 / 8 / 0 / 0 / 0 |
| card/playFree | 14 | 86% | 0 / 7 / 7 / 0 / 0 / 0 |
| yesno/draw | 12 | 100% | 0 / 12 / 0 / 0 / 0 / 0 |
| unit/bottomdeckOwn | 11 | 73% | 5 / 4 / 2 / 0 / 0 / 0 |
| mode/foolOnTheHill | 4 | 50% | 0 / 4 / 0 / 0 / 0 / 0 |
| card/discardForNothing | 2 | 0% | 0 / 1 / 1 / 0 / 0 / 0 |
| mode/rivalChoice | 2 | 0% | 0 / 2 / 0 / 0 / 0 / 0 |

Reaction windows: 717 attacks. Reacted to 307 (deck won 36% (30–42) n=253): fizzled 23, stole 188, stoleNothing 16, attackerGone 2, targetGone 73, bothGone 5. Let 410 resolve (39% (33–46) n=215): stole 319, targetGone 84, bothGone 7. Choices: endReact 426, call 239, block 46, play 17, ability 23.

## S2-01 Mutant (RYY) — 560 games, 38% won, 26136 decisions

| Card | Use | Uses | Win rate in games used (95%) | Legal turns → used | Not chosen | Early / mid / late uses | Ahead | Even | Behind |
|---|---|---|---|---|---|---|---|---|---|
| Rockn' Rockerboy | attacked | 884 | 46% (40–51) n=347 | 897 → 800 | 11% | 0 / 376 / 508 | 61% (54–68) n=196 | 56% (46–66) n=93 | 39% (33–46) n=202 |
| 6th Street Recruits | attacked | 822 | 41% (36–47) n=360 | 899 → 755 | 16% | 96 / 272 / 454 | 58% (51–65) n=183 | 41% (33–49) n=137 | 31% (25–37) n=203 |
| Rockn' Rockerboy | played | 664 | 40% (35–44) n=435 | 899 → 663 | 26% | 233 / 187 / 244 | 56% (49–62) n=231 | 37% (30–46) n=139 | 22% (16–28) n=189 |
| Dexter DeShawn: One Last Chance | played | 623 | 38% (33–42) n=421 | 1131 → 566 | 50% | 143 / 281 / 199 | 50% (43–57) n=212 | 27% (20–35) n=145 | 27% (20–35) n=144 |
| 6th Street Recruits | played | 618 | 39% (35–44) n=423 | 1111 → 610 | 45% | 220 / 203 / 195 | 49% (42–56) n=185 | 36% (29–43) n=173 | 33% (27–41) n=168 |
| Dexter DeShawn: One Last Chance | attacked | 615 | 39% (34–45) n=328 | 781 → 544 | 30% | 33 / 194 / 388 | 59% (51–66) n=155 | 52% (42–62) n=91 | 28% (22–35) n=184 |
| Dexter DeShawn: Off the Grid | ability | 610 | 36% (31–41) n=393 | 1924 → 610 | 68% | 24 / 104 / 482 | 58% (51–64) n=225 | 19% (12–29) n=80 | 11% (8–17) n=175 |
| Rogue Amendiares: Preem Solo | attacked | 601 | 35% (31–40) n=413 | 641 → 601 | 6% | 0 / 128 / 473 | 57% (50–65) n=169 | 48% (37–60) n=64 | 26% (21–32) n=253 |
| Rogue Amendiares: Preem Solo | Go Solo (self-paid 429) | 429 | 34% (30–39) n=429 | 883 → 429 | 51% | 0 / 137 / 292 | 52% (43–60) n=131 | 31% (19–46) n=39 | 26% (21–32) n=259 |
| Detonate | sold | 406 | 36% (31–41) n=344 | 549 → 406 | 26% | 216 / 79 / 111 | 46% (38–54) n=150 | 33% (26–42) n=123 | 20% (13–29) n=100 |
| Cyberpsychosis | sold | 406 | 37% (32–42) n=338 | 796 → 406 | 49% | 104 / 159 / 143 | 45% (38–53) n=152 | 38% (28–48) n=87 | 25% (19–33) n=139 |
| Over the Edge | sold | 405 | 37% (32–43) n=308 | 1763 → 405 | 77% | 39 / 161 / 205 | 46% (37–55) n=117 | 42% (31–55) n=59 | 29% (23–36) n=175 |
| Dexter DeShawn: Off the Grid | called | 401 | 36% (31–41) n=401 | 421 → 401 | 5% | 185 / 127 / 89 | 41% (35–47) n=250 | 24% (16–35) n=70 | 30% (21–40) n=81 |
| Dum Dum: Maelstrom Triggerman | called | 398 | 37% (33–42) n=398 | 414 → 398 | 4% | 188 / 105 / 105 | 45% (39–51) n=255 | 30% (21–41) n=80 | 16% (9–27) n=63 |
| Rogue Amendiares: Preem Solo | called | 388 | 36% (31–41) n=388 | 420 → 388 | 8% | 184 / 112 / 92 | 44% (38–50) n=246 | 25% (16–36) n=68 | 20% (13–31) n=74 |

(36 more card uses in the JSON report.)

Legal but never taken: Rogue Amendiares: Preem Solo (Legend play, legal in 883 turns), Cyberpsychosis (played, legal in 174 turns).

| Decision type | Decisions | First-listed option taken | Options offered (1 / 2 / 3–5 / 6–10 / 11–20 / 21+) |
|---|---|---|---|
| main | 14850 | 7% | 0 / 1033 / 3591 / 5345 / 4647 / 234 |
| gig/steal | 2994 | 27% | 174 / 472 / 1284 / 1055 / 9 / 0 |
| gig/rollIn | 2240 | 0% | 0 / 560 / 1680 / 0 / 0 / 0 |
| gigValue/adjust | 2214 | 10% | 0 / 7 / 148 / 300 / 1298 / 461 |
| react | 1048 | 71% | 0 / 572 / 476 / 0 / 0 / 0 |
| mulligan | 560 | 16% | 0 / 560 / 0 / 0 / 0 / 0 |
| mode/mode | 527 | 69% | 0 / 527 / 0 / 0 / 0 / 0 |
| unit/pump | 473 | 51% | 129 / 181 / 161 / 2 / 0 / 0 |
| unit/equip | 412 | 86% | 71 / 74 / 231 / 36 / 0 / 0 |
| unit/defeat | 200 | 56% | 24 / 34 / 100 / 41 / 1 / 0 |
| unit/sacrifice | 182 | 59% | 69 / 58 / 55 / 0 / 0 / 0 |
| card/defeatGear | 150 | 71% | 0 / 128 / 22 / 0 / 0 / 0 |
| card/discard | 107 | 68% | 3 / 56 / 46 / 2 / 0 / 0 |
| unit/call | 95 | 100% | 0 / 48 / 47 / 0 / 0 / 0 |
| yesno/draw | 38 | 100% | 0 / 38 / 0 / 0 / 0 / 0 |
| card/playFree | 18 | 100% | 18 / 0 / 0 / 0 / 0 / 0 |
| card/defeat | 13 | 92% | 11 / 2 / 0 / 0 / 0 / 0 |
| mode/foolOnTheHill | 13 | 54% | 0 / 13 / 0 / 0 / 0 / 0 |
| mode/rivalChoice | 2 | 0% | 0 / 2 / 0 / 0 / 0 / 0 |

Reaction windows: 1020 attacks. Reacted to 308 (deck won 33% (28–39) n=271): stole 234, stoleNothing 1, attackerGone 7, targetGone 53, bothGone 13. Let 712 resolve (35% (30–41) n=302): stole 502, stoleNothing 8, attackerGone 7, targetGone 182, bothGone 13. Choices: endReact 739, call 299, ability 2, play 8.

## S2-02 Mutant (RGG) — 560 games, 55% won, 22742 decisions

| Card | Use | Uses | Win rate in games used (95%) | Legal turns → used | Not chosen | Early / mid / late uses | Ahead | Even | Behind |
|---|---|---|---|---|---|---|---|---|---|
| Jackie Welles: Mama's Favorite | attacked | 768 | 50% (45–55) n=406 | 856 → 768 | 10% | 0 / 325 / 443 | 61% (54–67) n=239 | 54% (44–65) n=83 | 45% (38–52) n=187 |
| Pepe Najarro: Working Doubles | attacked | 694 | 56% (51–62) n=303 | 787 → 637 | 19% | 59 / 267 / 368 | 74% (67–80) n=166 | 60% (50–69) n=105 | 47% (40–55) n=166 |
| 6th Street Recruits | attacked | 664 | 57% (51–62) n=292 | 746 → 604 | 19% | 58 / 239 / 367 | 71% (64–78) n=157 | 58% (48–67) n=98 | 50% (43–58) n=159 |
| Nadia: Fighting Through Grief | attacked | 626 | 53% (47–58) n=289 | 641 → 580 | 10% | 0 / 167 / 459 | 81% (73–87) n=136 | 76% (62–85) n=49 | 45% (39–52) n=216 |
| MaxTac AV | attacked | 518 | 62% (56–68) n=223 | 553 → 487 | 12% | 0 / 237 / 281 | 73% (65–79) n=146 | 76% (62–85) n=49 | 59% (50–67) n=116 |
| Pepe Najarro: Working Doubles | played | 477 | 55% (50–60) n=361 | 1027 → 472 | 54% | 225 / 107 / 145 | 60% (53–67) n=176 | 48% (40–56) n=141 | 47% (37–57) n=94 |
| Jackie Welles: Mama's Favorite | called | 459 | 56% (51–60) n=459 | 459 → 459 | 0% | 233 / 167 / 59 | 57% (52–63) n=343 | 50% (38–62) n=58 | 50% (38–62) n=58 |
| 6th Street Recruits | played | 457 | 53% (48–58) n=342 | 1003 → 455 | 55% | 222 / 107 / 128 | 57% (49–65) n=152 | 55% (47–63) n=138 | 38% (29–48) n=100 |
| Memory Relapse | sold | 456 | 55% (49–60) n=350 | 1154 → 456 | 60% | 114 / 195 / 147 | 57% (49–64) n=176 | 50% (40–60) n=92 | 55% (46–63) n=126 |
| Saburo Arasaka: Stubborn Patriarch | called | 454 | 56% (51–60) n=454 | 454 → 454 | 0% | 212 / 157 / 85 | 62% (56–67) n=343 | 45% (33–57) n=67 | 27% (16–42) n=44 |
| Valentino Street Racer | attacked | 447 | 55% (49–61) n=255 | 570 → 408 | 28% | 19 / 125 / 303 | 68% (60–75) n=143 | 55% (44–66) n=78 | 39% (30–49) n=105 |
| Adam Smasher: Ender of Legends | called | 443 | 56% (52–61) n=443 | 443 → 443 | 0% | 220 / 130 / 93 | 60% (54–65) n=331 | 53% (41–64) n=68 | 36% (24–51) n=44 |
| Valentino Street Racer | played | 441 | 54% (49–59) n=342 | 1257 → 403 | 68% | 118 / 141 / 182 | 66% (58–72) n=172 | 48% (39–57) n=109 | 39% (30–50) n=89 |
| Jackie Welles: Mama's Favorite | Go Solo (self-paid 423) | 423 | 49% (44–54) n=423 | 875 → 423 | 52% | 0 / 256 / 167 | 55% (47–62) n=174 | 48% (37–60) n=66 | 44% (37–51) n=183 |
| Nadia: Fighting Through Grief | played | 416 | 53% (48–59) n=334 | 913 → 416 | 54% | 0 / 222 / 194 | 66% (58–73) n=135 | 56% (43–69) n=55 | 43% (36–50) n=181 |

(32 more card uses in the JSON report.)

Legal but never taken: Jackie Welles: Mama's Favorite (Legend play, legal in 876 turns).

| Decision type | Decisions | First-listed option taken | Options offered (1 / 2 / 3–5 / 6–10 / 11–20 / 21+) |
|---|---|---|---|
| main | 13115 | 5% | 0 / 1385 / 3963 / 5402 / 2285 / 80 |
| gig/steal | 3380 | 30% | 151 / 533 / 1642 / 1038 / 16 / 0 |
| gig/rollIn | 2240 | 0% | 0 / 560 / 1680 / 0 / 0 / 0 |
| unit/ready | 777 | 77% | 0 / 393 / 379 / 5 / 0 / 0 |
| mulligan | 560 | 27% | 0 / 560 / 0 / 0 / 0 / 0 |
| react | 520 | 53% | 0 / 309 / 211 / 0 / 0 / 0 |
| unit/defeat | 451 | 54% | 118 / 144 / 180 / 9 / 0 / 0 |
| unit/adrenaline | 323 | 55% | 157 / 113 / 53 / 0 / 0 / 0 |
| gig/swapGive | 316 | 37% | 0 / 24 / 233 / 56 / 3 / 0 |
| yesno/replaceDefeat | 272 | 4% | 0 / 272 / 0 / 0 / 0 / 0 |
| gig/swapTake | 269 | 51% | 58 / 77 / 84 / 44 / 6 / 0 |
| gigValue/adjust | 156 | 4% | 0 / 0 / 0 / 1 / 19 / 136 |
| unit/spend | 82 | 73% | 45 / 22 / 15 / 0 / 0 / 0 |
| unit/equip | 78 | 85% | 5 / 28 / 42 / 3 / 0 / 0 |
| unit/sacrifice | 61 | 89% | 39 / 19 / 3 / 0 / 0 / 0 |
| card/discard | 55 | 51% | 8 / 14 / 32 / 1 / 0 / 0 |
| gigValue/setGig | 28 | 7% | 0 / 0 / 1 / 2 / 5 / 20 |
| yesno/draw | 27 | 100% | 0 / 27 / 0 / 0 / 0 / 0 |
| unit/pump | 17 | 71% | 3 / 11 / 3 / 0 / 0 / 0 |
| card/playFree | 9 | 89% | 0 / 7 / 2 / 0 / 0 / 0 |
| mode/foolOnTheHill | 3 | 67% | 0 / 3 / 0 / 0 / 0 / 0 |
| mode/rivalChoice | 3 | 0% | 0 / 3 / 0 / 0 / 0 / 0 |

Reaction windows: 511 attacks. Reacted to 241 (deck won 42% (36–49) n=218): stole 190, attackerGone 13, targetGone 31, bothGone 7. Let 270 resolve (43% (35–50) n=167): stole 183, targetGone 78, bothGone 9. Choices: call 229, endReact 276, play 15.

## S2-03 Cross (RGY) — 560 games, 47% won, 27074 decisions

| Card | Use | Uses | Win rate in games used (95%) | Legal turns → used | Not chosen | Early / mid / late uses | Ahead | Even | Behind |
|---|---|---|---|---|---|---|---|---|---|
| Rockn' Rockerboy | attacked | 801 | 54% (49–59) n=324 | 820 → 713 | 13% | 0 / 373 / 428 | 69% (62–75) n=193 | 64% (53–73) n=85 | 47% (39–54) n=178 |
| 6th Street Recruits | attacked | 741 | 48% (43–53) n=344 | 817 → 667 | 18% | 55 / 243 / 443 | 69% (61–76) n=152 | 43% (34–52) n=109 | 42% (36–49) n=219 |
| Viktor Vektor: You Might Feel a Little Pinch | attacked | 629 | 48% (43–54) n=326 | 805 → 554 | 31% | 16 / 171 / 442 | 72% (65–79) n=148 | 55% (43–65) n=75 | 34% (28–41) n=203 |
| Corporate Surveillance | sold | 626 | 46% (41–50) n=424 | 823 → 626 | 24% | 266 / 169 / 191 | 59% (52–66) n=187 | 43% (35–51) n=149 | 34% (27–41) n=186 |
| Field Operator | attacked | 616 | 52% (46–57) n=308 | 731 → 539 | 26% | 11 / 161 / 444 | 72% (64–79) n=143 | 56% (44–68) n=64 | 42% (36–50) n=193 |
| 6th Street Recruits | played | 591 | 46% (41–51) n=422 | 1056 → 577 | 45% | 210 / 203 / 178 | 60% (53–67) n=186 | 37% (29–45) n=145 | 35% (29–42) n=184 |
| Viktor Vektor: You Might Feel a Little Pinch | played | 568 | 46% (41–51) n=405 | 1159 → 526 | 55% | 106 / 323 / 139 | 62% (55–69) n=174 | 36% (28–45) n=124 | 36% (29–43) n=171 |
| Rockn' Rockerboy | played | 543 | 48% (43–53) n=397 | 863 → 542 | 37% | 234 / 155 / 154 | 64% (56–71) n=164 | 45% (37–53) n=138 | 32% (25–39) n=167 |
| Field Operator | played | 530 | 49% (44–54) n=373 | 1334 → 484 | 64% | 64 / 341 / 125 | 58% (50–65) n=175 | 38% (29–49) n=86 | 44% (37–51) n=173 |
| Shattered Memories | sold | 517 | 49% (44–54) n=380 | 1610 → 517 | 68% | 83 / 207 / 227 | 60% (52–68) n=133 | 50% (40–60) n=96 | 42% (36–49) n=214 |
| Pepe Najarro: Working Doubles | attacked | 464 | 50% (44–56) n=250 | 574 → 458 | 20% | 34 / 132 / 298 | 70% (61–77) n=119 | 50% (38–62) n=64 | 38% (31–46) n=151 |
| Adam Smasher: Ender of Legends | attacked | 454 | 53% (48–59) n=341 | 471 → 454 | 4% | 0 / 0 / 454 | 90% (82–95) n=91 | 79% (68–86) n=75 | 35% (29–42) n=226 |
| Valentino Street Racer | played | 429 | 45% (40–51) n=349 | 889 → 413 | 54% | 80 / 243 / 106 | 60% (51–68) n=131 | 37% (28–47) n=97 | 39% (31–47) n=149 |
| Adam Smasher: Ender of Legends | called | 428 | 48% (43–53) n=428 | 428 → 428 | 0% | 217 / 134 / 77 | 55% (50–61) n=289 | 35% (26–46) n=79 | 30% (20–43) n=60 |
| Valentino Street Racer | attacked | 426 | 47% (41–53) n=252 | 553 → 403 | 27% | 12 / 118 / 296 | 69% (60–76) n=125 | 55% (41–69) n=47 | 33% (26–41) n=137 |

(27 more card uses in the JSON report.)

| Decision type | Decisions | First-listed option taken | Options offered (1 / 2 / 3–5 / 6–10 / 11–20 / 21+) |
|---|---|---|---|
| main | 14653 | 6% | 0 / 941 / 3855 / 5458 / 3997 / 402 |
| gig/steal | 3939 | 26% | 129 / 505 / 1612 / 1647 / 46 / 0 |
| gig/rollIn | 2240 | 0% | 0 / 560 / 1680 / 0 / 0 / 0 |
| yesno/kerryReroll | 1670 | 59% | 0 / 1670 / 0 / 0 / 0 / 0 |
| unit/ready | 1338 | 64% | 0 / 485 / 800 / 53 / 0 / 0 |
| react | 725 | 53% | 0 / 505 / 220 / 0 / 0 / 0 |
| mulligan | 560 | 4% | 0 / 560 / 0 / 0 / 0 / 0 |
| unit/defeat | 442 | 35% | 19 / 58 / 295 / 69 / 1 / 0 |
| unit/adrenaline | 380 | 49% | 140 / 125 / 111 / 4 / 0 / 0 |
| card/search | 313 | 77% | 0 / 163 / 150 / 0 / 0 / 0 |
| gigValue/adjust | 305 | 10% | 0 / 11 / 46 / 7 / 32 / 209 |
| unit/spend | 180 | 51% | 33 / 70 / 77 / 0 / 0 / 0 |
| gigValue/setGig | 81 | 1% | 0 / 0 / 2 / 6 / 16 / 57 |
| card/playFree | 69 | 81% | 0 / 36 / 32 / 1 / 0 / 0 |
| unit/sacrifice | 52 | 87% | 33 / 10 / 9 / 0 / 0 / 0 |
| card/discard | 49 | 49% | 10 / 9 / 30 / 0 / 0 / 0 |
| yesno/draw | 41 | 100% | 0 / 41 / 0 / 0 / 0 / 0 |
| unit/pump | 28 | 54% | 0 / 8 / 19 / 1 / 0 / 0 |
| mode/foolOnTheHill | 7 | 43% | 0 / 7 / 0 / 0 / 0 / 0 |
| mode/rivalChoice | 2 | 50% | 0 / 2 / 0 / 0 / 0 / 0 |

Reaction windows: 718 attacks. Reacted to 337 (deck won 39% (34–45) n=292): stole 254, attackerGone 16, targetGone 51, bothGone 16. Let 381 resolve (43% (37–50) n=206): stole 270, targetGone 102, bothGone 9. Choices: call 314, endReact 384, play 27.

## S2-04 Cross (RRG) — 560 games, 51% won, 26520 decisions

| Card | Use | Uses | Win rate in games used (95%) | Legal turns → used | Not chosen | Early / mid / late uses | Ahead | Even | Behind |
|---|---|---|---|---|---|---|---|---|---|
| 6th Street Recruits | attacked | 902 | 52% (47–57) n=382 | 1054 → 800 | 24% | 78 / 310 / 514 | 68% (61–74) n=197 | 52% (43–60) n=132 | 45% (39–52) n=233 |
| Animals Wrecker | attacked | 749 | 61% (56–67) n=310 | 693 → 666 | 4% | 0 / 192 / 557 | 79% (72–85) n=145 | 81% (71–89) n=75 | 56% (50–62) n=239 |
| Dexter DeShawn: Off the Grid | ability | 744 | 47% (42–51) n=451 | 1943 → 744 | 62% | 20 / 114 / 610 | 65% (60–70) n=309 | 18% (11–27) n=96 | 14% (10–19) n=188 |
| V: Streetkid | attacked | 705 | 45% (40–50) n=424 | 813 → 705 | 13% | 78 / 209 / 418 | 59% (53–64) n=269 | 38% (27–49) n=69 | 30% (24–37) n=174 |
| Valentino Street Racer | attacked | 598 | 50% (44–55) n=303 | 744 → 535 | 28% | 34 / 183 / 381 | 64% (56–71) n=149 | 53% (43–63) n=98 | 41% (34–49) n=174 |
| Pepe Najarro: Working Doubles | attacked | 588 | 52% (46–57) n=296 | 755 → 557 | 26% | 51 / 220 / 317 | 71% (63–77) n=146 | 51% (41–61) n=90 | 46% (39–53) n=183 |
| 6th Street Recruits | played | 541 | 51% (46–56) n=394 | 955 → 534 | 44% | 261 / 112 / 168 | 54% (47–61) n=187 | 52% (45–60) n=162 | 42% (34–51) n=124 |
| Valentino Street Racer | played | 537 | 50% (45–55) n=377 | 1199 → 509 | 58% | 163 / 175 / 199 | 57% (49–64) n=171 | 44% (36–52) n=149 | 47% (39–55) n=136 |
| Animals Wrecker | played | 526 | 57% (52–61) n=391 | 714 → 526 | 26% | 0 / 343 / 183 | 65% (57–72) n=152 | 52% (41–63) n=77 | 52% (46–58) n=229 |
| Shattered Memories | sold | 496 | 50% (45–55) n=377 | 1446 → 496 | 66% | 92 / 199 / 205 | 54% (45–62) n=140 | 53% (43–63) n=90 | 46% (40–53) n=210 |
| Dexter DeShawn: Off the Grid | called | 461 | 52% (47–56) n=461 | 461 → 461 | 0% | 201 / 156 / 104 | 58% (52–63) n=305 | 49% (37–61) n=63 | 34% (26–45) n=93 |
| V: Streetkid | Go Solo (self-paid 459) | 459 | 46% (41–50) n=459 | 1057 → 459 | 57% | 84 / 119 / 256 | 56% (49–62) n=236 | 42% (30–55) n=55 | 33% (27–41) n=168 |
| Memory Relapse | sold | 448 | 53% (47–58) n=348 | 1345 → 448 | 67% | 81 / 194 / 173 | 52% (43–61) n=123 | 57% (46–67) n=88 | 49% (42–56) n=191 |
| Saburo Arasaka: Stubborn Patriarch | called | 439 | 50% (46–55) n=439 | 439 → 439 | 0% | 221 / 124 / 94 | 55% (50–61) n=296 | 37% (27–48) n=81 | 44% (32–56) n=62 |
| V: Streetkid | called | 424 | 51% (46–56) n=424 | 424 → 424 | 0% | 226 / 101 / 97 | 55% (49–61) n=276 | 49% (38–60) n=76 | 39% (28–50) n=72 |

(30 more card uses in the JSON report.)

Legal but never taken: V: Streetkid (Legend play, legal in 1058 turns), Detonate (reaction, legal in 25 turns).

| Decision type | Decisions | First-listed option taken | Options offered (1 / 2 / 3–5 / 6–10 / 11–20 / 21+) |
|---|---|---|---|
| main | 14931 | 7% | 0 / 1226 / 3994 / 5100 / 4412 / 199 |
| gig/steal | 3611 | 28% | 207 / 494 / 1543 / 1354 / 13 / 0 |
| gig/rollIn | 2240 | 0% | 0 / 560 / 1680 / 0 / 0 / 0 |
| gigValue/adjust | 1082 | 9% | 0 / 10 / 66 / 54 / 576 / 376 |
| unit/defeat | 720 | 68% | 259 / 200 / 217 / 44 / 0 / 0 |
| mulligan | 560 | 20% | 0 / 560 / 0 / 0 / 0 / 0 |
| mode/mode | 546 | 67% | 0 / 546 / 0 / 0 / 0 / 0 |
| react | 539 | 45% | 0 / 312 / 227 / 0 / 0 / 0 |
| unit/adrenaline | 464 | 73% | 246 / 157 / 61 / 0 / 0 / 0 |
| card/search | 459 | 71% | 193 / 176 / 87 / 3 / 0 / 0 |
| card/playFree | 395 | 71% | 0 / 130 / 251 / 14 / 0 / 0 |
| unit/pump | 362 | 57% | 118 / 143 / 98 / 3 / 0 / 0 |
| unit/equip | 218 | 89% | 37 / 74 / 88 / 19 / 0 / 0 |
| unit/spend | 154 | 60% | 59 / 55 / 40 / 0 / 0 / 0 |
| card/discard | 67 | 54% | 17 / 10 / 35 / 5 / 0 / 0 |
| yesno/draw | 62 | 100% | 0 / 62 / 0 / 0 / 0 / 0 |
| unit/sacrifice | 50 | 84% | 37 / 6 / 7 / 0 / 0 / 0 |
| unit/ready | 39 | 100% | 0 / 39 / 0 / 0 / 0 / 0 |
| card/defeat | 10 | 90% | 9 / 1 / 0 / 0 / 0 / 0 |
| mode/foolOnTheHill | 7 | 29% | 0 / 7 / 0 / 0 / 0 / 0 |
| mode/rivalChoice | 4 | 0% | 0 / 4 / 0 / 0 / 0 / 0 |

Reaction windows: 535 attacks. Reacted to 294 (deck won 42% (36–48) n=267): stole 231, stoleNothing 1, targetGone 52, bothGone 10. Let 241 resolve (39% (31–47) n=145): stole 170, targetGone 70, bothGone 1. Choices: call 294, endReact 245.

## S2-05 Counter (RRG) — 560 games, 60% won, 26949 decisions

| Card | Use | Uses | Win rate in games used (95%) | Legal turns → used | Not chosen | Early / mid / late uses | Ahead | Even | Behind |
|---|---|---|---|---|---|---|---|---|---|
| Pepe Najarro: Working Doubles | attacked | 926 | 64% (59–68) n=363 | 1076 → 833 | 23% | 93 / 347 / 486 | 80% (74–85) n=198 | 61% (53–68) n=150 | 60% (54–66) n=226 |
| 6th Street Recruits | attacked | 897 | 65% (60–70) n=357 | 1064 → 813 | 24% | 61 / 336 / 500 | 81% (75–86) n=203 | 67% (58–75) n=119 | 59% (53–66) n=232 |
| Animals Wrecker | attacked | 840 | 68% (63–73) n=324 | 784 → 747 | 5% | 0 / 233 / 607 | 86% (80–91) n=159 | 82% (72–88) n=88 | 62% (56–68) n=238 |
| Yorinobu Arasaka: Steel Dragon | attacked | 556 | 72% (67–77) n=289 | 560 → 511 | 9% | 0 / 0 / 556 | 91% (86–95) n=164 | 80% (68–89) n=56 | 62% (55–69) n=164 |
| Yorinobu Arasaka: Steel Dragon | played | 522 | 64% (59–69) n=382 | 701 → 522 | 26% | 0 / 263 / 259 | 82% (74–87) n=125 | 72% (60–82) n=58 | 56% (50–62) n=250 |
| Animals Wrecker | played | 514 | 64% (59–68) n=394 | 763 → 514 | 33% | 0 / 361 / 153 | 72% (64–80) n=116 | 67% (57–75) n=93 | 59% (53–65) n=245 |
| Dexter DeShawn: Off the Grid | ability | 505 | 52% (47–58) n=347 | 2090 → 505 | 76% | 22 / 89 / 394 | 68% (62–74) n=215 | 36% (25–49) n=61 | 32% (25–40) n=147 |
| Valentino Street Racer | attacked | 485 | 59% (53–65) n=283 | 702 → 451 | 36% | 17 / 121 / 347 | 81% (73–86) n=139 | 61% (49–71) n=66 | 45% (38–53) n=159 |
| Pepe Najarro: Working Doubles | played | 472 | 62% (57–67) n=363 | 918 → 467 | 49% | 282 / 91 / 99 | 75% (68–81) n=165 | 54% (46–61) n=168 | 51% (40–61) n=83 |
| Adam Smasher: Ender of Legends | called | 462 | 61% (57–66) n=462 | 462 → 462 | 0% | 277 / 75 / 110 | 69% (64–74) n=318 | 42% (31–54) n=69 | 44% (33–55) n=75 |
| Dexter DeShawn: Off the Grid | called | 459 | 63% (58–67) n=459 | 459 → 459 | 0% | 268 / 98 / 93 | 70% (65–75) n=304 | 49% (38–61) n=71 | 49% (38–59) n=84 |
| Hanako Arasaka: Daughter of the Emperor | ability | 458 | 51% (45–56) n=318 | 2001 → 458 | 77% | 19 / 78 / 361 | 72% (65–78) n=173 | 36% (24–49) n=53 | 29% (22–36) n=157 |
| 6th Street Recruits | played | 456 | 64% (59–69) n=348 | 956 → 449 | 53% | 265 / 86 / 105 | 74% (67–81) n=160 | 60% (52–68) n=143 | 48% (38–58) n=92 |
| Adam Smasher: Ender of Legends | attacked | 455 | 62% (57–67) n=346 | 487 → 455 | 7% | 0 / 0 / 455 | 90% (85–94) n=165 | 85% (73–92) n=59 | 34% (28–42) n=174 |
| Valentino Street Racer | played | 449 | 57% (52–62) n=350 | 1294 → 417 | 68% | 129 / 142 / 178 | 74% (66–80) n=167 | 43% (35–52) n=118 | 43% (33–52) n=101 |

(32 more card uses in the JSON report.)

Legal but never taken: Appetite for Destruction (played, legal in 476 turns).

| Decision type | Decisions | First-listed option taken | Options offered (1 / 2 / 3–5 / 6–10 / 11–20 / 21+) |
|---|---|---|---|
| main | 15107 | 7% | 0 / 1221 / 4155 / 5335 / 4126 / 270 |
| gig/steal | 3768 | 24% | 113 / 461 / 1666 / 1504 / 24 / 0 |
| gig/rollIn | 2240 | 0% | 0 / 560 / 1680 / 0 / 0 / 0 |
| unit/defeat | 779 | 59% | 218 / 210 / 326 / 24 / 1 / 0 |
| gigValue/adjust | 735 | 7% | 0 / 0 / 3 / 58 / 394 / 280 |
| mulligan | 560 | 21% | 0 / 560 / 0 / 0 / 0 / 0 |
| mode/mode | 540 | 68% | 0 / 540 / 0 / 0 / 0 / 0 |
| react | 490 | 47% | 0 / 288 / 202 / 0 / 0 / 0 |
| card/playFree | 477 | 72% | 0 / 175 / 275 / 27 / 0 / 0 |
| gig/swapGive | 458 | 46% | 22 / 60 / 189 / 183 / 4 / 0 |
| gig/swapTake | 458 | 28% | 32 / 46 / 217 / 158 / 5 / 0 |
| unit/pump | 417 | 61% | 172 / 140 / 99 / 6 / 0 / 0 |
| unit/adrenaline | 377 | 70% | 207 / 120 / 50 / 0 / 0 / 0 |
| unit/ready | 161 | 100% | 0 / 161 / 0 / 0 / 0 / 0 |
| unit/equip | 125 | 82% | 12 / 31 / 58 / 24 / 0 / 0 |
| unit/spend | 79 | 65% | 34 / 25 / 20 / 0 / 0 / 0 |
| card/discard | 56 | 54% | 16 / 17 / 23 / 0 / 0 / 0 |
| gigValue/setGig | 52 | 6% | 0 / 0 / 3 / 10 / 13 / 26 |
| unit/sacrifice | 45 | 80% | 24 / 10 / 11 / 0 / 0 / 0 |
| yesno/draw | 23 | 100% | 0 / 23 / 0 / 0 / 0 / 0 |
| mode/foolOnTheHill | 2 | 100% | 0 / 2 / 0 / 0 / 0 / 0 |

Reaction windows: 490 attacks. Reacted to 258 (deck won 48% (42–55) n=231): stole 205, attackerGone 1, targetGone 48, bothGone 4. Let 232 resolve (52% (44–61) n=132): stole 180, stoleNothing 1, targetGone 46, bothGone 5. Choices: call 258, endReact 232.

## S2-06 Counter (RGG) — 560 games, 57% won, 23558 decisions

| Card | Use | Uses | Win rate in games used (95%) | Legal turns → used | Not chosen | Early / mid / late uses | Ahead | Even | Behind |
|---|---|---|---|---|---|---|---|---|---|
| Pepe Najarro: Working Doubles | attacked | 809 | 63% (58–68) n=316 | 883 → 734 | 17% | 69 / 371 / 369 | 82% (76–87) n=183 | 53% (44–62) n=111 | 58% (50–65) n=179 |
| Nadia: Fighting Through Grief | attacked | 735 | 62% (56–67) n=312 | 751 → 688 | 8% | 0 / 273 / 462 | 88% (81–92) n=139 | 85% (72–92) n=46 | 55% (48–61) n=244 |
| Valentino Street Racer | attacked | 599 | 58% (53–64) n=299 | 760 → 548 | 28% | 38 / 221 / 340 | 79% (72–85) n=163 | 46% (37–56) n=95 | 47% (40–55) n=156 |
| Valentino Street Racer | played | 540 | 58% (53–62) n=385 | 1242 → 496 | 60% | 200 / 216 / 124 | 71% (64–77) n=188 | 35% (28–44) n=141 | 55% (46–64) n=114 |
| 6th Street Recruits | attacked | 534 | 70% (64–75) n=236 | 621 → 511 | 18% | 46 / 236 / 252 | 85% (78–90) n=142 | 65% (54–75) n=80 | 63% (54–71) n=132 |
| Hanako Arasaka: Daughter of the Emperor | ability | 509 | 49% (44–55) n=343 | 1997 → 509 | 75% | 12 / 176 / 321 | 73% (66–79) n=186 | 25% (16–36) n=72 | 29% (22–36) n=159 |
| Pepe Najarro: Working Doubles | played | 497 | 61% (56–65) n=376 | 925 → 490 | 47% | 293 / 99 / 105 | 78% (71–83) n=177 | 47% (40–55) n=158 | 51% (40–61) n=87 |
| Adam Smasher: Ender of Legends | called | 471 | 59% (55–63) n=471 | 471 → 471 | 0% | 287 / 115 / 69 | 69% (63–73) n=327 | 41% (31–52) n=81 | 33% (23–46) n=63 |
| Adam Smasher: Ender of Legends | attacked | 451 | 63% (58–68) n=355 | 468 → 451 | 4% | 0 / 0 / 451 | 95% (90–98) n=131 | 93% (84–97) n=59 | 40% (33–47) n=206 |
| Hanako Arasaka: Daughter of the Emperor | called | 442 | 60% (55–64) n=442 | 442 → 442 | 0% | 266 / 124 / 52 | 67% (61–72) n=317 | 38% (28–50) n=73 | 48% (35–61) n=52 |
| Saburo Arasaka: Stubborn Patriarch | called | 442 | 58% (54–63) n=442 | 442 → 442 | 0% | 265 / 132 / 45 | 65% (59–70) n=324 | 36% (26–47) n=73 | 51% (37–65) n=45 |
| Nadia: Fighting Through Grief | played | 419 | 60% (54–65) n=345 | 877 → 419 | 52% | 0 / 295 / 124 | 75% (67–81) n=139 | 47% (36–59) n=72 | 54% (46–61) n=177 |
| Memory Relapse | sold | 396 | 57% (52–63) n=318 | 1189 → 396 | 67% | 113 / 149 / 134 | 71% (62–78) n=129 | 58% (48–68) n=84 | 45% (37–53) n=143 |
| Corporate Surveillance | sold | 392 | 57% (52–63) n=333 | 458 → 392 | 14% | 212 / 87 / 93 | 68% (60–74) n=154 | 43% (35–52) n=120 | 58% (48–68) n=93 |
| Over the Edge | sold | 377 | 57% (51–62) n=301 | 1523 → 377 | 75% | 50 / 142 / 185 | 70% (61–78) n=109 | 52% (40–64) n=61 | 49% (41–56) n=170 |

(31 more card uses in the JSON report.)

Legal but never taken: Adam Smasher: Ender of Legends (Legend play, legal in 399 turns), Corporate Surveillance (played, legal in 423 turns).

| Decision type | Decisions | First-listed option taken | Options offered (1 / 2 / 3–5 / 6–10 / 11–20 / 21+) |
|---|---|---|---|
| main | 12933 | 5% | 0 / 1225 / 3765 / 5050 / 2817 / 76 |
| gig/steal | 3196 | 30% | 138 / 456 / 1426 / 1160 / 16 / 0 |
| gig/rollIn | 2240 | 0% | 0 / 560 / 1680 / 0 / 0 / 0 |
| unit/ready | 993 | 73% | 0 / 521 / 465 / 7 / 0 / 0 |
| unit/defeat | 970 | 53% | 253 / 271 / 424 / 22 / 0 / 0 |
| mulligan | 560 | 26% | 0 / 560 / 0 / 0 / 0 / 0 |
| gig/swapGive | 509 | 39% | 15 / 78 / 220 / 194 / 2 / 0 |
| gig/swapTake | 509 | 33% | 40 / 54 / 261 / 151 / 3 / 0 |
| react | 474 | 46% | 0 / 280 / 194 / 0 / 0 / 0 |
| unit/adrenaline | 349 | 72% | 231 / 90 / 28 / 0 / 0 / 0 |
| unit/equip | 267 | 89% | 48 / 46 / 156 / 17 / 0 / 0 |
| gigValue/adjust | 178 | 5% | 0 / 4 / 24 / 2 / 22 / 126 |
| unit/spend | 153 | 64% | 75 / 52 / 26 / 0 / 0 / 0 |
| card/discard | 82 | 44% | 11 / 24 / 47 / 0 / 0 / 0 |
| unit/sacrifice | 50 | 84% | 30 / 14 / 6 / 0 / 0 / 0 |
| gigValue/setGig | 44 | 2% | 0 / 0 / 1 / 7 / 14 / 22 |
| yesno/draw | 25 | 100% | 0 / 25 / 0 / 0 / 0 / 0 |
| card/playFree | 20 | 100% | 0 / 16 / 4 / 0 / 0 / 0 |
| mode/foolOnTheHill | 3 | 67% | 0 / 3 / 0 / 0 / 0 / 0 |
| mode/rivalChoice | 3 | 0% | 0 / 3 / 0 / 0 / 0 / 0 |

Reaction windows: 459 attacks. Reacted to 245 (deck won 45% (39–52) n=217): fizzled 19, stole 197, targetGone 23, bothGone 6. Let 214 resolve (44% (36–53) n=131): stole 174, targetGone 32, bothGone 8. Choices: call 234, endReact 220, ability 20.

## S2-07 Explorer (RRB) — 560 games, 48% won, 21657 decisions

| Card | Use | Uses | Win rate in games used (95%) | Legal turns → used | Not chosen | Early / mid / late uses | Ahead | Even | Behind |
|---|---|---|---|---|---|---|---|---|---|
| V: Corporate Exile | attacked | 752 | 43% (38–48) n=394 | 900 → 752 | 16% | 85 / 301 / 366 | 58% (51–64) n=248 | 49% (37–60) n=68 | 30% (24–37) n=178 |
| Animals Wrecker | attacked | 723 | 62% (56–67) n=291 | 681 → 643 | 6% | 0 / 151 / 572 | 84% (77–89) n=139 | 83% (74–90) n=84 | 51% (44–58) n=208 |
| 6th Street Recruits | attacked | 672 | 49% (44–55) n=316 | 918 → 617 | 33% | 64 / 243 / 365 | 67% (60–74) n=156 | 63% (53–71) n=105 | 34% (27–41) n=181 |
| Psycho Squad | attacked | 663 | 47% (42–53) n=309 | 882 → 604 | 32% | 55 / 242 / 366 | 65% (58–72) n=169 | 48% (38–59) n=83 | 39% (33–46) n=191 |
| Unlikely Bond | sold | 508 | 48% (43–53) n=371 | 1150 → 508 | 56% | 123 / 204 / 181 | 57% (50–65) n=162 | 46% (37–56) n=102 | 42% (35–50) n=179 |
| Animals Wrecker | played | 485 | 55% (50–60) n=362 | 641 → 485 | 24% | 0 / 312 / 173 | 70% (62–77) n=138 | 64% (53–74) n=70 | 45% (38–51) n=206 |
| 6th Street Recruits | played | 463 | 45% (40–50) n=350 | 1064 → 457 | 57% | 245 / 93 / 125 | 53% (45–60) n=165 | 43% (35–50) n=155 | 22% (15–32) n=85 |
| Johnny Silverhand: Rocking Renegade | called | 449 | 49% (44–53) n=449 | 449 → 449 | 0% | 206 / 141 / 102 | 57% (52–63) n=328 | 24% (15–38) n=49 | 26% (18–38) n=72 |
| Johnny Silverhand: Never Stop Fighting | attacked | 449 | 62% (55–68) n=202 | 345 → 307 | 11% | 0 / 42 / 407 | 84% (76–89) n=118 | 74% (59–85) n=39 | 37% (27–47) n=87 |
| V: Corporate Exile | called | 448 | 51% (46–55) n=448 | 448 → 448 | 0% | 245 / 115 / 88 | 57% (51–62) n=316 | 40% (29–53) n=60 | 33% (24–45) n=72 |
| Adam Smasher: Ender of Legends | called | 444 | 48% (43–52) n=444 | 444 → 444 | 0% | 205 / 137 / 102 | 56% (51–62) n=311 | 28% (19–40) n=64 | 26% (17–38) n=69 |
| Psycho Squad | played | 435 | 45% (40–51) n=351 | 960 → 431 | 55% | 233 / 99 / 103 | 59% (51–66) n=167 | 38% (30–46) n=142 | 24% (16–35) n=79 |
| V: Corporate Exile | Go Solo (self-paid 424) | 424 | 42% (38–47) n=424 | 786 → 424 | 46% | 89 / 184 / 151 | 54% (47–61) n=188 | 46% (34–58) n=59 | 29% (23–36) n=177 |
| Carnage at the Colosseum | sold | 384 | 49% (43–54) n=310 | 1392 → 384 | 72% | 28 / 159 / 197 | 67% (57–75) n=105 | 55% (42–68) n=56 | 39% (32–47) n=171 |
| Yorinobu Arasaka: Steel Dragon | played | 352 | 55% (49–61) n=294 | 453 → 352 | 22% | 0 / 99 / 253 | 77% (68–83) n=115 | 62% (46–76) n=37 | 37% (30–44) n=166 |

(35 more card uses in the JSON report.)

Legal but never taken: Adam Smasher: Ender of Legends (Legend play, legal in 132 turns), Appetite for Destruction (played, legal in 331 turns).

| Decision type | Decisions | First-listed option taken | Options offered (1 / 2 / 3–5 / 6–10 / 11–20 / 21+) |
|---|---|---|---|
| main | 13563 | 8% | 0 / 1217 / 3828 / 5319 / 3025 / 174 |
| gig/steal | 3410 | 29% | 205 / 426 / 1487 / 1257 / 35 / 0 |
| gig/rollIn | 2240 | 0% | 0 / 560 / 1680 / 0 / 0 / 0 |
| mulligan | 560 | 21% | 0 / 560 / 0 / 0 / 0 / 0 |
| react | 505 | 55% | 0 / 289 / 216 / 0 / 0 / 0 |
| unit/defeat | 377 | 67% | 159 / 102 / 102 / 13 / 1 / 0 |
| card/playFree | 329 | 68% | 0 / 124 / 203 / 2 / 0 / 0 |
| unit/lagAttack | 292 | 88% | 23 / 65 / 196 / 8 / 0 / 0 |
| gigValue/adjust | 164 | 5% | 0 / 6 / 19 / 1 / 11 / 127 |
| unit/sacrifice | 56 | 88% | 41 / 9 / 6 / 0 / 0 / 0 |
| card/discard | 45 | 51% | 10 / 7 / 26 / 2 / 0 / 0 |
| unit/pump | 30 | 80% | 21 / 6 / 3 / 0 / 0 / 0 |
| mode/mode | 26 | 100% | 0 / 0 / 26 / 0 / 0 / 0 |
| unit/bottomdeck | 16 | 75% | 11 / 3 / 2 / 0 / 0 / 0 |
| unit/bottomdeckOwn | 16 | 50% | 2 / 9 / 5 / 0 / 0 / 0 |
| yesno/draw | 13 | 100% | 0 / 13 / 0 / 0 / 0 / 0 |
| mode/foolOnTheHill | 8 | 50% | 0 / 8 / 0 / 0 / 0 / 0 |
| mode/rivalChoice | 4 | 0% | 0 / 4 / 0 / 0 / 0 / 0 |
| unit/equip | 3 | 67% | 0 / 0 / 3 / 0 / 0 / 0 |

Reaction windows: 505 attacks. Reacted to 227 (deck won 32% (26–39) n=197): stole 196, targetGone 27, bothGone 4. Let 278 resolve (42% (34–50) n=155): stole 200, targetGone 72, bothGone 6. Choices: call 227, endReact 278.

## S2-08 Explorer (GGY) — 560 games, 51% won, 26709 decisions

| Card | Use | Uses | Win rate in games used (95%) | Legal turns → used | Not chosen | Early / mid / late uses | Ahead | Even | Behind |
|---|---|---|---|---|---|---|---|---|---|
| Rockn' Rockerboy | attacked | 965 | 58% (52–63) n=330 | 957 → 868 | 9% | 0 / 396 / 569 | 64% (57–70) n=201 | 70% (60–78) n=105 | 53% (47–60) n=217 |
| Pepe Najarro: Working Doubles | attacked | 821 | 57% (52–62) n=339 | 948 → 754 | 20% | 70 / 298 / 453 | 69% (62–75) n=195 | 56% (48–65) n=126 | 47% (40–54) n=200 |
| Nadia: Fighting Through Grief | attacked | 783 | 51% (45–56) n=329 | 787 → 717 | 9% | 0 / 224 / 559 | 73% (65–80) n=136 | 68% (55–78) n=59 | 44% (38–50) n=259 |
| Pepe Najarro: Working Doubles | played | 566 | 55% (50–59) n=403 | 1024 → 557 | 46% | 240 / 150 / 176 | 64% (57–70) n=198 | 48% (40–56) n=161 | 43% (35–51) n=131 |
| Valentino Street Racer | attacked | 551 | 51% (46–57) n=284 | 687 → 491 | 29% | 29 / 135 / 387 | 72% (65–79) n=151 | 48% (37–58) n=80 | 36% (29–44) n=141 |
| Rockn' Rockerboy | played | 542 | 53% (48–58) n=395 | 776 → 541 | 30% | 224 / 156 / 162 | 62% (55–68) n=200 | 52% (43–60) n=133 | 41% (33–49) n=141 |
| Valentino Street Racer | played | 499 | 53% (48–58) n=370 | 1240 → 464 | 63% | 125 / 171 / 203 | 67% (59–73) n=168 | 43% (35–52) n=120 | 47% (39–55) n=136 |
| Memory Relapse | sold | 469 | 51% (46–56) n=362 | 1197 → 469 | 61% | 133 / 181 / 155 | 57% (49–64) n=159 | 56% (46–65) n=99 | 43% (35–50) n=155 |
| Nadia: Fighting Through Grief | played | 465 | 50% (45–55) n=371 | 927 → 465 | 50% | 0 / 247 / 218 | 61% (52–69) n=128 | 50% (38–62) n=62 | 42% (36–49) n=226 |
| Padre: Man of the Cross | ability | 465 | 44% (38–49) n=310 | 1963 → 465 | 76% | 7 / 96 / 362 | 59% (52–66) n=182 | 30% (20–41) n=71 | 22% (16–30) n=133 |
| Muamar Reyes: El Capitán | ability | 430 | 43% (38–49) n=299 | 1909 → 430 | 77% | 9 / 93 / 328 | 63% (55–69) n=184 | 21% (12–33) n=57 | 15% (10–23) n=117 |
| Goro Takemura: Vengeful Bodyguard | called | 419 | 51% (46–56) n=419 | 419 → 419 | 0% | 217 / 139 / 63 | 55% (49–61) n=255 | 47% (37–57) n=92 | 40% (30–52) n=72 |
| Padre: Man of the Cross | called | 407 | 54% (49–59) n=407 | 412 → 407 | 1% | 224 / 117 / 66 | 59% (53–65) n=248 | 54% (44–65) n=83 | 37% (27–48) n=76 |
| Muamar Reyes: El Capitán | called | 406 | 52% (47–57) n=406 | 418 → 406 | 3% | 205 / 122 / 79 | 54% (48–59) n=265 | 52% (41–63) n=73 | 46% (34–57) n=68 |
| Cyberpsychosis | sold | 395 | 52% (47–57) n=332 | 622 → 395 | 36% | 208 / 110 / 77 | 52% (44–60) n=156 | 49% (40–58) n=110 | 55% (45–64) n=95 |

(36 more card uses in the JSON report.)

Legal but never taken: Cyberpsychosis (played, legal in 93 turns).

| Decision type | Decisions | First-listed option taken | Options offered (1 / 2 / 3–5 / 6–10 / 11–20 / 21+) |
|---|---|---|---|
| main | 14106 | 6% | 0 / 1079 / 3775 / 5665 / 3419 / 168 |
| gig/steal | 3378 | 29% | 128 / 445 / 1469 / 1310 / 26 / 0 |
| gig/rollIn | 2240 | 0% | 0 / 560 / 1680 / 0 / 0 / 0 |
| unit/ready | 1104 | 71% | 0 / 469 / 619 / 16 / 0 / 0 |
| gigValue/adjust | 861 | 9% | 0 / 0 / 47 / 96 / 512 / 206 |
| react | 748 | 49% | 0 / 402 / 346 / 0 / 0 / 0 |
| mulligan | 560 | 35% | 0 / 560 / 0 / 0 / 0 / 0 |
| mode/mode | 522 | 61% | 0 / 522 / 0 / 0 / 0 / 0 |
| mode/muamarCall | 512 | 70% | 0 / 512 / 0 / 0 / 0 / 0 |
| gigValue/setGig | 460 | 7% | 0 / 2 / 6 / 32 / 93 / 327 |
| unit/spend | 407 | 80% | 259 / 96 / 52 / 0 / 0 / 0 |
| unit/adrenaline | 381 | 48% | 143 / 154 / 84 / 0 / 0 / 0 |
| unit/defeat | 368 | 63% | 143 / 107 / 113 / 5 / 0 / 0 |
| unit/protect | 345 | 57% | 131 / 120 / 92 / 2 / 0 / 0 |
| unit/blocker | 257 | 58% | 78 / 106 / 72 / 1 / 0 / 0 |
| unit/equip | 222 | 80% | 33 / 51 / 115 / 23 / 0 / 0 |
| card/discard | 127 | 44% | 16 / 26 / 83 / 2 / 0 / 0 |
| unit/sacrifice | 53 | 81% | 30 / 13 / 10 / 0 / 0 / 0 |
| unit/call | 25 | 88% | 0 / 15 / 10 / 0 / 0 / 0 |
| card/playFree | 15 | 87% | 0 / 9 / 6 / 0 / 0 / 0 |
| yesno/draw | 9 | 100% | 0 / 9 / 0 / 0 / 0 / 0 |
| mode/foolOnTheHill | 6 | 50% | 0 / 6 / 0 / 0 / 0 / 0 |
| mode/rivalChoice | 2 | 0% | 0 / 2 / 0 / 0 / 0 / 0 |
| unit/pump | 1 | 100% | 1 / 0 / 0 / 0 / 0 / 0 |

Reaction windows: 678 attacks. Reacted to 341 (deck won 46% (41–52) n=283): fizzled 14, stole 235, stoleNothing 1, attackerGone 16, targetGone 51, bothGone 12, noneGone 12. Let 337 resolve (45% (37–52) n=182): stole 281, stoleNothing 2, attackerGone 1, targetGone 42, bothGone 11. Choices: endReact 363, ability 59, call 296, block 29, play 1.

## S3-02 Mutant (RGY) — 560 games, 44% won, 28172 decisions

| Card | Use | Uses | Win rate in games used (95%) | Legal turns → used | Not chosen | Early / mid / late uses | Ahead | Even | Behind |
|---|---|---|---|---|---|---|---|---|---|
| Jackie Welles: Mama's Favorite | attacked | 844 | 41% (37–46) n=472 | 927 → 844 | 9% | 0 / 343 / 501 | 54% (48–60) n=270 | 46% (36–57) n=80 | 30% (25–36) n=247 |
| 6th Street Recruits | attacked | 817 | 49% (44–54) n=336 | 907 → 734 | 19% | 70 / 255 / 492 | 69% (61–75) n=181 | 56% (47–65) n=112 | 36% (30–43) n=196 |
| Pepe Najarro: Working Doubles | attacked | 788 | 47% (41–52) n=343 | 883 → 731 | 17% | 68 / 275 / 445 | 63% (55–69) n=184 | 51% (42–59) n=132 | 40% (34–48) n=183 |
| Dexter DeShawn: One Last Chance | attacked | 656 | 44% (39–50) n=315 | 723 → 570 | 21% | 28 / 159 / 469 | 63% (55–70) n=152 | 53% (43–63) n=93 | 33% (27–40) n=187 |
| MaxTac Suppression Team | attacked | 634 | 47% (41–52) n=298 | 695 → 583 | 16% | 0 / 185 / 449 | 63% (56–69) n=185 | 63% (50–74) n=59 | 32% (26–39) n=171 |
| Corporate Surveillance | sold | 599 | 45% (40–50) n=414 | 1023 → 599 | 41% | 230 / 201 / 168 | 51% (44–58) n=198 | 45% (37–53) n=142 | 34% (27–41) n=184 |
| Dexter DeShawn: One Last Chance | played | 570 | 44% (39–48) n=395 | 1241 → 517 | 58% | 126 / 235 / 209 | 59% (52–65) n=198 | 33% (26–42) n=132 | 29% (22–37) n=134 |
| Pepe Najarro: Working Doubles | played | 565 | 44% (40–49) n=411 | 1145 → 558 | 51% | 244 / 131 / 190 | 53% (46–60) n=196 | 43% (36–51) n=158 | 31% (24–39) n=135 |
| 6th Street Recruits | played | 558 | 46% (41–51) n=402 | 1175 → 554 | 53% | 230 / 146 / 182 | 57% (50–64) n=196 | 44% (37–52) n=151 | 29% (22–38) n=136 |
| Dexter DeShawn: Off the Grid | ability | 545 | 43% (38–48) n=365 | 1876 → 545 | 71% | 5 / 108 / 432 | 60% (54–66) n=241 | 14% (8–24) n=72 | 14% (9–21) n=136 |
| MaxTac Suppression Team | played | 533 | 44% (39–49) n=388 | 1221 → 533 | 56% | 91 / 209 / 233 | 55% (48–62) n=188 | 47% (37–58) n=87 | 31% (25–38) n=189 |
| Jackie Welles: Mama's Favorite | Go Solo (self-paid 489) | 489 | 41% (36–45) n=489 | 793 → 489 | 38% | 0 / 305 / 184 | 50% (43–57) n=203 | 43% (31–55) n=61 | 32% (26–38) n=225 |
| Dexter DeShawn: Off the Grid | called | 444 | 44% (39–48) n=444 | 444 → 444 | 0% | 175 / 190 / 79 | 52% (46–57) n=294 | 31% (20–43) n=59 | 26% (18–36) n=91 |
| Jackie Welles: Mama's Favorite | called | 432 | 44% (40–49) n=432 | 432 → 432 | 0% | 193 / 175 / 64 | 48% (42–54) n=280 | 35% (25–45) n=81 | 41% (30–52) n=71 |
| Dum Dum: Maelstrom Triggerman | called | 404 | 44% (39–49) n=404 | 404 → 404 | 0% | 173 / 149 / 82 | 51% (45–56) n=282 | 37% (26–49) n=60 | 21% (13–33) n=62 |

(33 more card uses in the JSON report.)

| Decision type | Decisions | First-listed option taken | Options offered (1 / 2 / 3–5 / 6–10 / 11–20 / 21+) |
|---|---|---|---|
| main | 15388 | 7% | 0 / 991 / 3753 / 5407 / 4919 / 318 |
| gig/steal | 3430 | 29% | 229 / 595 / 1384 / 1197 / 25 / 0 |
| gig/rollIn | 2240 | 0% | 0 / 560 / 1680 / 0 / 0 / 0 |
| gigValue/adjust | 2160 | 8% | 0 / 3 / 118 / 195 / 1274 / 570 |
| react | 1021 | 67% | 0 / 599 / 422 / 0 / 0 / 0 |
| unit/ready | 999 | 68% | 0 / 390 / 578 / 31 / 0 / 0 |
| mulligan | 560 | 12% | 0 / 560 / 0 / 0 / 0 / 0 |
| unit/pump | 547 | 47% | 130 / 198 / 213 / 6 / 0 / 0 |
| mode/mode | 541 | 78% | 0 / 541 / 0 / 0 / 0 / 0 |
| unit/equip | 324 | 82% | 38 / 70 / 192 / 24 / 0 / 0 |
| yesno/replaceDefeat | 217 | 11% | 0 / 217 / 0 / 0 / 0 / 0 |
| unit/spend | 216 | 52% | 45 / 80 / 89 / 2 / 0 / 0 |
| unit/defeat | 199 | 47% | 11 / 16 / 87 / 84 / 1 / 0 |
| card/discard | 54 | 48% | 5 / 12 / 32 / 5 / 0 / 0 |
| card/playFree | 54 | 94% | 0 / 34 / 20 / 0 / 0 / 0 |
| card/search | 54 | 81% | 29 / 18 / 7 / 0 / 0 / 0 |
| unit/sacrifice | 50 | 68% | 26 / 18 / 5 / 1 / 0 / 0 |
| yesno/draw | 47 | 100% | 0 / 47 / 0 / 0 / 0 / 0 |
| card/defeatGear | 39 | 95% | 0 / 30 / 9 / 0 / 0 / 0 |
| card/defeat | 23 | 91% | 21 / 2 / 0 / 0 / 0 / 0 |
| mode/rivalChoice | 5 | 20% | 0 / 5 / 0 / 0 / 0 / 0 |
| mode/foolOnTheHill | 4 | 50% | 0 / 4 / 0 / 0 / 0 / 0 |

Reaction windows: 989 attacks. Reacted to 332 (deck won 40% (34–46) n=284): stole 246, attackerGone 11, targetGone 60, bothGone 15. Let 657 resolve (39% (34–45) n=288): stole 501, stoleNothing 1, attackerGone 2, targetGone 137, bothGone 16. Choices: endReact 686, call 325, ability 5, play 5.

## S3-03 Cross (RRR) — 560 games, 52% won, 24595 decisions

| Card | Use | Uses | Win rate in games used (95%) | Legal turns → used | Not chosen | Early / mid / late uses | Ahead | Even | Behind |
|---|---|---|---|---|---|---|---|---|---|
| 6th Street Recruits | attacked | 744 | 54% (48–59) n=338 | 910 → 690 | 24% | 89 / 301 / 354 | 72% (64–78) n=152 | 56% (47–65) n=121 | 52% (45–58) n=224 |
| Animals Wrecker | attacked | 695 | 65% (59–70) n=292 | 669 → 637 | 5% | 0 / 175 / 520 | 89% (82–93) n=123 | 76% (65–84) n=74 | 59% (53–65) n=223 |
| V: Streetkid | attacked | 557 | 42% (37–47) n=342 | 680 → 557 | 18% | 71 / 183 / 303 | 62% (55–69) n=179 | 49% (37–61) n=65 | 24% (18–31) n=169 |
| Dexter DeShawn: Off the Grid | ability | 519 | 46% (40–51) n=338 | 1721 → 519 | 70% | 14 / 86 / 419 | 67% (60–73) n=205 | 33% (23–45) n=64 | 18% (13–25) n=152 |
| 6th Street Recruits | played | 497 | 53% (48–58) n=377 | 882 → 493 | 44% | 289 / 110 / 98 | 63% (56–69) n=202 | 49% (41–57) n=150 | 36% (26–47) n=81 |
| Animals Wrecker | played | 462 | 60% (55–65) n=355 | 606 → 462 | 24% | 0 / 330 / 132 | 74% (66–81) n=127 | 58% (46–69) n=66 | 51% (44–58) n=200 |
| Bonnie and Clyde | sold | 431 | 54% (49–59) n=329 | 1380 → 431 | 69% | 79 / 165 / 187 | 66% (58–73) n=144 | 51% (41–62) n=82 | 44% (37–52) n=154 |
| V: Streetkid | called | 427 | 52% (47–57) n=427 | 427 → 427 | 0% | 225 / 100 / 102 | 62% (55–68) n=238 | 40% (31–49) n=101 | 40% (30–50) n=88 |
| Over the Edge | sold | 426 | 53% (48–59) n=331 | 1368 → 426 | 69% | 86 / 175 / 165 | 68% (60–76) n=120 | 49% (38–60) n=78 | 46% (39–53) n=182 |
| Adam Smasher: Ender of Legends | called | 398 | 52% (47–56) n=398 | 398 → 398 | 0% | 170 / 123 / 105 | 62% (56–68) n=247 | 35% (25–46) n=80 | 34% (24–45) n=71 |
| Dexter DeShawn: Off the Grid | called | 395 | 51% (46–56) n=395 | 398 → 395 | 1% | 188 / 116 / 91 | 62% (56–68) n=234 | 34% (25–45) n=76 | 36% (27–47) n=85 |
| Meredith Stout: Stone Cold Corpo | played | 379 | 51% (45–56) n=308 | 1193 → 371 | 69% | 122 / 106 / 151 | 67% (58–74) n=132 | 40% (31–49) n=103 | 37% (28–46) n=109 |
| V: Streetkid | Go Solo (self-paid 371) | 371 | 43% (38–48) n=371 | 1026 → 371 | 64% | 74 / 113 / 184 | 59% (51–66) n=151 | 43% (30–56) n=54 | 28% (21–35) n=166 |
| Ruthless Lowlife | played | 355 | 45% (39–50) n=297 | 444 → 342 | 23% | 240 / 60 / 55 | 58% (50–66) n=150 | 29% (22–38) n=120 | 33% (21–47) n=46 |
| Detonate | sold | 352 | 52% (46–58) n=291 | 509 → 352 | 31% | 206 / 78 / 68 | 60% (52–68) n=134 | 45% (36–55) n=106 | 40% (30–51) n=85 |

(36 more card uses in the JSON report.)

Legal but never taken: V: Streetkid (Legend play, legal in 1026 turns).

| Decision type | Decisions | First-listed option taken | Options offered (1 / 2 / 3–5 / 6–10 / 11–20 / 21+) |
|---|---|---|---|
| main | 13987 | 9% | 0 / 1193 / 3710 / 5177 / 3771 / 136 |
| gig/steal | 2987 | 26% | 128 / 374 / 1316 / 1158 / 11 / 0 |
| gig/rollIn | 2240 | 0% | 0 / 560 / 1680 / 0 / 0 / 0 |
| react | 1355 | 64% | 0 / 906 / 446 / 3 / 0 / 0 |
| gigValue/adjust | 760 | 8% | 0 / 7 / 45 / 65 / 432 / 211 |
| unit/defeat | 654 | 59% | 186 / 205 / 243 / 20 / 0 / 0 |
| mulligan | 560 | 15% | 0 / 560 / 0 / 0 / 0 / 0 |
| mode/mode | 508 | 76% | 0 / 508 / 0 / 0 / 0 / 0 |
| card/search | 441 | 78% | 239 / 113 / 70 / 19 / 0 / 0 |
| unit/pump | 418 | 55% | 120 / 153 / 135 / 10 / 0 / 0 |
| card/playFree | 294 | 65% | 0 / 71 / 205 / 18 / 0 / 0 |
| unit/equip | 224 | 86% | 79 / 66 / 71 / 8 / 0 / 0 |
| unit/sacrifice | 52 | 79% | 33 / 5 / 14 / 0 / 0 / 0 |
| yesno/draw | 35 | 100% | 0 / 35 / 0 / 0 / 0 / 0 |
| card/discard | 33 | 55% | 9 / 9 / 13 / 2 / 0 / 0 |
| card/defeat | 16 | 88% | 13 / 3 / 0 / 0 / 0 / 0 |
| unit/call | 16 | 100% | 0 / 6 / 10 / 0 / 0 / 0 |
| yesno/call | 10 | 100% | 0 / 10 / 0 / 0 / 0 / 0 |
| mode/rivalChoice | 3 | 0% | 0 / 3 / 0 / 0 / 0 / 0 |
| mode/foolOnTheHill | 2 | 50% | 0 / 2 / 0 / 0 / 0 / 0 |

Reaction windows: 1269 attacks. Reacted to 453 (deck won 46% (41–51) n=353): stole 242, stoleNothing 1, attackerGone 16, targetGone 172, bothGone 22. Let 816 resolve (51% (46–57) n=333): stole 577, stoleNothing 11, attackerGone 9, targetGone 194, bothGone 25. Choices: block 157, call 321, endReact 872, play 5.

## S3-05 Counter (RRG) — 560 games, 51% won, 25751 decisions

| Card | Use | Uses | Win rate in games used (95%) | Legal turns → used | Not chosen | Early / mid / late uses | Ahead | Even | Behind |
|---|---|---|---|---|---|---|---|---|---|
| Pepe Najarro: Working Doubles | attacked | 1003 | 54% (49–59) n=395 | 1131 → 871 | 23% | 103 / 377 / 523 | 77% (71–83) n=195 | 58% (50–66) n=145 | 46% (40–52) n=272 |
| Animals Wrecker | attacked | 764 | 66% (60–71) n=303 | 715 → 694 | 3% | 0 / 160 / 604 | 92% (86–95) n=133 | 87% (78–93) n=71 | 59% (52–65) n=239 |
| V: Streetkid | attacked | 614 | 40% (35–45) n=369 | 740 → 614 | 17% | 97 / 240 / 277 | 58% (51–65) n=191 | 44% (32–58) n=54 | 24% (18–31) n=187 |
| Valentino Street Racer | attacked | 602 | 54% (48–59) n=316 | 787 → 542 | 31% | 33 / 164 / 405 | 80% (73–86) n=144 | 59% (48–70) n=74 | 39% (33–46) n=209 |
| Pepe Najarro: Working Doubles | played | 568 | 53% (48–58) n=397 | 986 → 564 | 43% | 320 / 142 / 106 | 61% (54–68) n=198 | 52% (45–59) n=173 | 37% (28–46) n=104 |
| Hanako Arasaka: Daughter of the Emperor | ability | 541 | 44% (39–49) n=360 | 1981 → 541 | 73% | 33 / 133 / 375 | 65% (58–72) n=191 | 39% (29–51) n=71 | 19% (14–26) n=173 |
| Valentino Street Racer | played | 505 | 52% (47–57) n=372 | 1301 → 467 | 64% | 170 / 196 / 139 | 61% (53–68) n=169 | 47% (39–55) n=139 | 39% (31–48) n=123 |
| Animals Wrecker | played | 470 | 60% (55–65) n=362 | 713 → 470 | 34% | 0 / 336 / 134 | 72% (64–79) n=135 | 62% (51–73) n=69 | 53% (46–59) n=211 |
| Memory Relapse | sold | 463 | 52% (47–57) n=366 | 1305 → 463 | 65% | 100 / 198 / 165 | 64% (55–72) n=133 | 55% (45–65) n=85 | 43% (36–50) n=195 |
| Satori: Sword of Saburo | sold | 463 | 48% (43–53) n=352 | 835 → 463 | 45% | 202 / 125 / 136 | 59% (51–66) n=151 | 41% (33–50) n=117 | 38% (30–46) n=146 |
| Adam Smasher: Ender of Legends | called | 444 | 51% (46–56) n=444 | 444 → 444 | 0% | 216 / 142 / 86 | 60% (54–65) n=299 | 37% (27–48) n=81 | 30% (20–42) n=64 |
| V: Streetkid | called | 430 | 51% (46–56) n=430 | 430 → 430 | 0% | 252 / 123 / 55 | 60% (53–65) n=257 | 39% (29–49) n=93 | 39% (29–50) n=80 |
| Hanako Arasaka: Daughter of the Emperor | called | 418 | 54% (49–59) n=418 | 418 → 418 | 0% | 212 / 140 / 66 | 58% (52–64) n=292 | 42% (32–52) n=88 | 47% (32–63) n=38 |
| V: Streetkid | Go Solo (self-paid 388) | 388 | 40% (35–45) n=388 | 1049 → 388 | 63% | 110 / 148 / 130 | 57% (49–64) n=161 | 31% (21–45) n=54 | 27% (21–34) n=173 |
| Yorinobu Arasaka: Steel Dragon | attacked | 348 | 64% (57–70) n=202 | 346 → 324 | 6% | 0 / 0 / 348 | 95% (89–98) n=99 | 83% (65–92) n=29 | 48% (39–56) n=132 |

(35 more card uses in the JSON report.)

Legal but never taken: V: Streetkid (Legend play, legal in 1049 turns), Adam Smasher: Ender of Legends (Legend play, legal in 317 turns).

| Decision type | Decisions | First-listed option taken | Options offered (1 / 2 / 3–5 / 6–10 / 11–20 / 21+) |
|---|---|---|---|
| main | 14308 | 7% | 0 / 1227 / 3720 / 4730 / 4310 / 321 |
| gig/steal | 3509 | 28% | 187 / 407 / 1414 / 1474 / 27 / 0 |
| gig/rollIn | 2240 | 0% | 0 / 560 / 1680 / 0 / 0 / 0 |
| unit/defeat | 853 | 64% | 264 / 233 / 315 / 40 / 1 / 0 |
| unit/ready | 770 | 76% | 0 / 398 / 354 / 18 / 0 / 0 |
| mulligan | 560 | 33% | 0 / 560 / 0 / 0 / 0 / 0 |
| react | 558 | 46% | 0 / 315 / 243 / 0 / 0 / 0 |
| gig/swapGive | 541 | 40% | 24 / 78 / 245 / 187 / 7 / 0 |
| gig/swapTake | 541 | 31% | 38 / 62 / 254 / 180 / 7 / 0 |
| card/search | 454 | 70% | 202 / 165 / 86 / 1 / 0 / 0 |
| unit/adrenaline | 380 | 77% | 215 / 124 / 41 / 0 / 0 / 0 |
| card/playFree | 315 | 77% | 0 / 121 / 185 / 9 / 0 / 0 |
| gigValue/adjust | 209 | 4% | 0 / 2 / 63 / 13 / 30 / 101 |
| unit/spend | 135 | 65% | 56 / 43 / 36 / 0 / 0 / 0 |
| unit/equip | 120 | 83% | 11 / 37 / 57 / 15 / 0 / 0 |
| gigValue/setGig | 65 | 5% | 0 / 0 / 4 / 9 / 11 / 41 |
| unit/pump | 60 | 78% | 38 / 10 / 11 / 1 / 0 / 0 |
| unit/sacrifice | 56 | 80% | 29 / 12 / 15 / 0 / 0 / 0 |
| card/discard | 39 | 38% | 4 / 7 / 27 / 1 / 0 / 0 |
| yesno/draw | 27 | 100% | 0 / 27 / 0 / 0 / 0 / 0 |
| card/defeat | 6 | 100% | 6 / 0 / 0 / 0 / 0 / 0 |
| mode/foolOnTheHill | 5 | 100% | 0 / 5 / 0 / 0 / 0 / 0 |

Reaction windows: 556 attacks. Reacted to 300 (deck won 41% (35–47) n=265): stole 254, stoleNothing 1, targetGone 39, bothGone 6. Let 256 resolve (45% (38–53) n=161): stole 198, stoleNothing 1, targetGone 52, bothGone 5. Choices: call 300, endReact 257, play 1.

## S3-06 Counter (RBG) — 560 games, 46% won, 24890 decisions

| Card | Use | Uses | Win rate in games used (95%) | Legal turns → used | Not chosen | Early / mid / late uses | Ahead | Even | Behind |
|---|---|---|---|---|---|---|---|---|---|
| MaxTac AV | attacked | 860 | 57% (52–62) n=330 | 863 → 760 | 12% | 0 / 391 / 469 | 78% (72–84) n=180 | 57% (45–68) n=70 | 46% (40–53) n=198 |
| Psycho Squad | attacked | 826 | 52% (47–57) n=351 | 922 → 728 | 21% | 83 / 326 / 417 | 77% (70–83) n=168 | 45% (36–55) n=106 | 43% (37–50) n=217 |
| Psycho Squad | played | 596 | 47% (43–52) n=430 | 1014 → 589 | 42% | 256 / 235 / 105 | 66% (59–72) n=190 | 31% (25–39) n=164 | 43% (35–50) n=160 |
| Valentino Street Racer | played | 572 | 45% (41–50) n=411 | 1127 → 521 | 54% | 167 / 309 / 96 | 64% (56–71) n=171 | 22% (16–30) n=141 | 42% (35–50) n=160 |
| MaxTac AV | played | 505 | 54% (49–59) n=368 | 749 → 505 | 33% | 242 / 174 / 89 | 73% (66–79) n=183 | 43% (35–52) n=136 | 36% (28–45) n=128 |
| Valentino Street Racer | attacked | 488 | 50% (44–56) n=293 | 702 → 436 | 38% | 35 / 157 / 296 | 81% (73–87) n=118 | 40% (29–53) n=62 | 36% (29–43) n=170 |
| Placide: Voodoo Sentinel | played | 481 | 52% (47–57) n=391 | 586 → 481 | 18% | 0 / 0 / 481 | 86% (78–91) n=113 | 66% (53–77) n=53 | 36% (30–42) n=258 |
| Hanako Arasaka: Daughter of the Emperor | ability | 474 | 36% (31–41) n=336 | 1860 → 474 | 75% | 15 / 203 / 256 | 62% (54–69) n=154 | 16% (9–26) n=75 | 16% (11–22) n=180 |
| Jackie Welles: Pour One Out For Me | called | 430 | 47% (42–52) n=430 | 430 → 430 | 0% | 214 / 179 / 37 | 56% (50–62) n=259 | 27% (19–37) n=88 | 39% (29–49) n=83 |
| Adam Smasher: Ender of Legends | called | 429 | 48% (44–53) n=429 | 429 → 429 | 0% | 210 / 171 / 48 | 57% (51–63) n=292 | 28% (18–40) n=65 | 32% (22–43) n=72 |
| Hanako Arasaka: Daughter of the Emperor | called | 411 | 45% (41–50) n=411 | 411 → 411 | 0% | 197 / 171 / 43 | 56% (50–62) n=259 | 23% (15–34) n=77 | 29% (20–40) n=75 |
| Nocturne OP55 N1 | sold | 403 | 47% (42–53) n=328 | 1007 → 403 | 60% | 109 / 173 / 121 | 59% (51–66) n=150 | 46% (35–58) n=67 | 38% (30–46) n=145 |
| Adam Smasher: Ender of Legends | attacked | 383 | 53% (47–58) n=296 | 406 → 383 | 6% | 0 / 0 / 383 | 89% (82–93) n=132 | 81% (67–90) n=42 | 20% (14–27) n=158 |
| Industrial Assembly | sold | 359 | 47% (42–53) n=303 | 596 → 359 | 40% | 177 / 91 / 91 | 64% (55–71) n=135 | 27% (19–37) n=88 | 43% (34–52) n=105 |
| We Gotta Live Together | sold | 326 | 45% (39–51) n=283 | 655 → 326 | 50% | 152 / 81 / 93 | 66% (57–74) n=112 | 34% (25–44) n=92 | 27% (20–37) n=106 |

(32 more card uses in the JSON report.)

Legal but never taken: Adam Smasher: Ender of Legends (Legend play, legal in 379 turns).

| Decision type | Decisions | First-listed option taken | Options offered (1 / 2 / 3–5 / 6–10 / 11–20 / 21+) |
|---|---|---|---|
| main | 13102 | 7% | 0 / 1143 / 3597 / 5028 / 3245 / 89 |
| gig/steal | 2729 | 28% | 125 / 426 / 1119 / 1049 / 10 / 0 |
| gig/rollIn | 2240 | 100% | 0 / 560 / 1680 / 0 / 0 / 0 |
| gig/swapGive | 979 | 43% | 28 / 108 / 638 / 200 / 5 / 0 |
| gig/swapTake | 896 | 40% | 123 / 196 / 349 / 223 / 5 / 0 |
| gigValue/adjust | 818 | 27% | 0 / 45 / 307 / 290 / 156 / 20 |
| react | 646 | 48% | 0 / 395 / 251 / 0 / 0 / 0 |
| unit/bottomdeck | 622 | 45% | 126 / 175 / 312 / 9 / 0 / 0 |
| card/discard | 568 | 60% | 8 / 230 / 311 / 19 / 0 / 0 |
| mulligan | 560 | 29% | 0 / 560 / 0 / 0 / 0 / 0 |
| unit/adrenaline | 405 | 61% | 202 / 137 / 66 / 0 / 0 / 0 |
| unit/defeat | 324 | 35% | 31 / 88 / 189 / 16 / 0 / 0 |
| unit/spend | 224 | 54% | 75 / 102 / 47 / 0 / 0 / 0 |
| unit/equip | 130 | 89% | 3 / 27 / 90 / 10 / 0 / 0 |
| unit/ready | 122 | 83% | 0 / 83 / 39 / 0 / 0 / 0 |
| mode/mode | 118 | 100% | 0 / 0 / 118 / 0 / 0 / 0 |
| unit/bottomdeckOwn | 97 | 73% | 53 / 31 / 13 / 0 / 0 / 0 |
| yesno/draw | 63 | 100% | 0 / 63 / 0 / 0 / 0 / 0 |
| unit/sacrifice | 62 | 89% | 43 / 12 / 6 / 1 / 0 / 0 |
| unit/weaken | 48 | 63% | 6 / 25 / 16 / 1 / 0 / 0 |
| unit/cantAttack | 46 | 50% | 16 / 19 / 11 / 0 / 0 / 0 |
| card/playFree | 26 | 100% | 0 / 22 / 4 / 0 / 0 / 0 |
| gigValue/setGig | 23 | 4% | 0 / 0 / 1 / 4 / 8 / 10 |
| unit/call | 21 | 100% | 0 / 8 / 13 / 0 / 0 / 0 |
| card/discardForNothing | 17 | 0% | 0 / 9 / 8 / 0 / 0 / 0 |
| mode/foolOnTheHill | 4 | 100% | 0 / 4 / 0 / 0 / 0 / 0 |

Reaction windows: 627 attacks. Reacted to 320 (deck won 40% (34–45) n=283): stole 253, stoleNothing 1, attackerGone 5, targetGone 48, bothGone 13. Let 307 resolve (45% (38–52) n=194): stole 239, targetGone 60, bothGone 8. Choices: call 294, play 39, endReact 313.

## S3-07 Explorer (RRG) — 560 games, 50% won, 26521 decisions

| Card | Use | Uses | Win rate in games used (95%) | Legal turns → used | Not chosen | Early / mid / late uses | Ahead | Even | Behind |
|---|---|---|---|---|---|---|---|---|---|
| Pepe Najarro: Working Doubles | attacked | 849 | 55% (50–60) n=369 | 1033 → 766 | 26% | 61 / 272 / 516 | 80% (73–85) n=187 | 61% (52–70) n=108 | 44% (38–50) n=246 |
| 6th Street Recruits | attacked | 798 | 53% (47–58) n=355 | 982 → 723 | 26% | 61 / 303 / 434 | 73% (66–79) n=177 | 54% (44–63) n=110 | 46% (40–53) n=229 |
| Animals Wrecker | attacked | 723 | 62% (56–67) n=310 | 686 → 647 | 6% | 0 / 191 / 532 | 84% (77–89) n=141 | 85% (74–91) n=71 | 56% (50–63) n=231 |
| V: Streetkid | attacked | 607 | 42% (37–47) n=380 | 748 → 607 | 19% | 76 / 145 / 386 | 57% (50–63) n=219 | 48% (36–60) n=67 | 27% (21–34) n=164 |
| Hanako Arasaka: Daughter of the Emperor | ability | 553 | 40% (35–46) n=364 | 1990 → 553 | 72% | 22 / 93 / 438 | 64% (57–71) n=193 | 22% (14–33) n=73 | 14% (10–20) n=180 |
| Valentino Street Racer | attacked | 547 | 55% (49–60) n=297 | 732 → 493 | 33% | 19 / 136 / 392 | 76% (69–82) n=152 | 66% (55–76) n=80 | 35% (28–43) n=155 |
| Animals Wrecker | played | 535 | 56% (51–61) n=386 | 714 → 535 | 25% | 0 / 321 / 214 | 71% (62–78) n=126 | 68% (57–78) n=79 | 50% (43–56) n=250 |
| Valentino Street Racer | played | 519 | 50% (45–55) n=381 | 1346 → 484 | 64% | 136 / 169 / 214 | 64% (56–71) n=165 | 38% (30–47) n=128 | 42% (34–50) n=147 |
| Pepe Najarro: Working Doubles | played | 505 | 55% (50–60) n=374 | 946 → 498 | 47% | 239 / 106 / 160 | 61% (54–67) n=186 | 59% (51–67) n=135 | 35% (27–45) n=113 |
| 6th Street Recruits | played | 501 | 52% (47–57) n=375 | 967 → 495 | 49% | 240 / 113 / 148 | 61% (54–68) n=167 | 53% (45–60) n=154 | 34% (26–43) n=114 |
| V: Streetkid | called | 449 | 49% (45–54) n=449 | 449 → 449 | 0% | 224 / 111 / 114 | 55% (49–61) n=291 | 39% (29–50) n=82 | 38% (28–49) n=76 |
| Hanako Arasaka: Daughter of the Emperor | called | 441 | 50% (45–55) n=441 | 441 → 441 | 0% | 229 / 125 / 87 | 55% (49–61) n=288 | 48% (38–58) n=94 | 31% (20–43) n=59 |
| Bonnie and Clyde | sold | 441 | 47% (42–53) n=343 | 1522 → 441 | 71% | 86 / 165 / 190 | 55% (46–63) n=131 | 54% (43–64) n=80 | 36% (30–43) n=185 |
| Johnny Silverhand: Rocking Renegade | called | 431 | 49% (44–54) n=431 | 440 → 431 | 2% | 231 / 111 / 89 | 55% (49–61) n=286 | 44% (34–55) n=79 | 30% (21–42) n=66 |
| V: Streetkid | Go Solo (self-paid 409) | 409 | 41% (36–46) n=409 | 1050 → 409 | 61% | 86 / 84 / 239 | 54% (47–61) n=185 | 37% (26–49) n=60 | 27% (21–35) n=164 |

(32 more card uses in the JSON report.)

Legal but never taken: V: Streetkid (Legend play, legal in 1050 turns).

| Decision type | Decisions | First-listed option taken | Options offered (1 / 2 / 3–5 / 6–10 / 11–20 / 21+) |
|---|---|---|---|
| main | 15295 | 8% | 0 / 1179 / 3973 / 5042 / 4739 / 362 |
| gig/steal | 3589 | 28% | 170 / 424 / 1611 / 1350 / 34 / 0 |
| gig/rollIn | 2240 | 0% | 0 / 560 / 1680 / 0 / 0 / 0 |
| unit/defeat | 601 | 68% | 211 / 169 / 173 / 48 / 0 / 0 |
| mulligan | 560 | 19% | 0 / 560 / 0 / 0 / 0 / 0 |
| gig/swapGive | 553 | 41% | 25 / 74 / 224 / 222 / 8 / 0 |
| gig/swapTake | 553 | 26% | 42 / 63 / 208 / 232 / 8 / 0 |
| react | 541 | 48% | 0 / 309 / 232 / 0 / 0 / 0 |
| unit/adrenaline | 443 | 66% | 202 / 162 / 79 / 0 / 0 / 0 |
| card/search | 429 | 76% | 225 / 145 / 59 / 0 / 0 / 0 |
| card/playFree | 409 | 67% | 0 / 109 / 268 / 32 / 0 / 0 |
| gigValue/adjust | 331 | 5% | 0 / 9 / 57 / 5 / 36 / 224 |
| unit/lagAttack | 287 | 76% | 37 / 61 / 176 / 13 / 0 / 0 |
| unit/ready | 255 | 86% | 0 / 205 / 50 / 0 / 0 / 0 |
| unit/equip | 117 | 75% | 8 / 32 / 53 / 24 / 0 / 0 |
| unit/spend | 101 | 60% | 35 / 33 / 33 / 0 / 0 / 0 |
| unit/sacrifice | 69 | 86% | 46 / 12 / 10 / 1 / 0 / 0 |
| unit/pump | 57 | 81% | 30 / 12 / 15 / 0 / 0 / 0 |
| card/discard | 42 | 52% | 8 / 14 / 17 / 3 / 0 / 0 |
| yesno/draw | 20 | 100% | 0 / 20 / 0 / 0 / 0 / 0 |
| unit/call | 16 | 100% | 0 / 5 / 11 / 0 / 0 / 0 |
| yesno/call | 8 | 100% | 0 / 8 / 0 / 0 / 0 / 0 |
| mode/foolOnTheHill | 3 | 100% | 0 / 3 / 0 / 0 / 0 / 0 |
| mode/rivalChoice | 2 | 0% | 0 / 2 / 0 / 0 / 0 / 0 |

Reaction windows: 541 attacks. Reacted to 281 (deck won 45% (39–51) n=255): stole 235, targetGone 44, bothGone 2. Let 260 resolve (42% (34–50) n=146): stole 175, targetGone 81, bothGone 4. Choices: endReact 260, call 281.

## S3-08 Explorer (RRB) — 560 games, 55% won, 24520 decisions

| Card | Use | Uses | Win rate in games used (95%) | Legal turns → used | Not chosen | Early / mid / late uses | Ahead | Even | Behind |
|---|---|---|---|---|---|---|---|---|---|
| Psycho Squad | attacked | 796 | 58% (52–63) n=341 | 970 → 725 | 25% | 78 / 298 / 420 | 73% (65–79) n=155 | 61% (52–69) n=128 | 50% (44–57) n=217 |
| 6th Street Recruits | attacked | 781 | 56% (51–61) n=348 | 960 → 715 | 26% | 60 / 295 / 426 | 82% (75–87) n=154 | 60% (50–69) n=107 | 50% (43–56) n=240 |
| Animals Wrecker | attacked | 779 | 69% (63–74) n=311 | 731 → 699 | 4% | 0 / 212 / 567 | 84% (77–89) n=144 | 79% (70–86) n=96 | 65% (59–71) n=225 |
| Dexter DeShawn: Off the Grid | ability | 581 | 53% (48–58) n=393 | 2033 → 581 | 71% | 5 / 94 / 482 | 78% (72–83) n=235 | 31% (21–43) n=68 | 25% (19–31) n=175 |
| Yorinobu Arasaka: Steel Dragon | attacked | 574 | 62% (56–67) n=290 | 556 → 513 | 8% | 0 / 0 / 574 | 88% (82–92) n=154 | 79% (65–89) n=43 | 45% (38–53) n=177 |
| Animals Wrecker | played | 524 | 62% (57–67) n=380 | 684 → 524 | 23% | 0 / 351 / 173 | 72% (64–79) n=123 | 61% (50–71) n=87 | 58% (51–64) n=234 |
| Yorinobu Arasaka: Steel Dragon | played | 490 | 57% (52–62) n=365 | 589 → 490 | 17% | 0 / 231 / 259 | 79% (70–86) n=97 | 72% (59–82) n=54 | 48% (42–54) n=257 |
| Bonnie and Clyde | sold | 484 | 54% (49–59) n=365 | 1100 → 484 | 56% | 143 / 185 / 156 | 65% (57–73) n=138 | 55% (45–65) n=96 | 44% (37–52) n=185 |
| 6th Street Recruits | played | 475 | 55% (50–60) n=368 | 913 → 471 | 48% | 267 / 102 / 106 | 67% (60–74) n=166 | 52% (44–60) n=147 | 35% (27–44) n=112 |
| Psycho Squad | played | 471 | 55% (50–60) n=370 | 874 → 468 | 46% | 259 / 102 / 110 | 65% (57–72) n=155 | 53% (45–60) n=159 | 37% (29–46) n=113 |
| Dexter DeShawn: Off the Grid | called | 452 | 57% (52–61) n=452 | 452 → 452 | 0% | 244 / 124 / 84 | 64% (58–69) n=282 | 45% (33–57) n=67 | 46% (36–55) n=103 |
| Swordwise Huscle | played | 445 | 51% (46–56) n=336 | 1332 → 411 | 69% | 119 / 150 / 176 | 69% (60–76) n=140 | 36% (28–45) n=123 | 43% (35–52) n=120 |
| Swordwise Huscle | attacked | 438 | 52% (46–58) n=260 | 634 → 394 | 38% | 10 / 118 / 310 | 80% (71–87) n=101 | 65% (52–77) n=55 | 40% (33–48) n=164 |
| Adam Smasher: Ender of Legends | called | 422 | 55% (50–60) n=422 | 422 → 422 | 0% | 230 / 92 / 100 | 64% (58–69) n=287 | 40% (29–52) n=67 | 32% (22–44) n=68 |
| Sasha Yakovleva: Won't Let You Down | called | 413 | 58% (53–63) n=413 | 413 → 413 | 0% | 240 / 94 / 79 | 68% (62–73) n=278 | 37% (27–49) n=75 | 38% (27–51) n=60 |

(35 more card uses in the JSON report.)

Legal but never taken: Adam Smasher: Ender of Legends (Legend play, legal in 255 turns), Sasha Yakovleva: Won't Let You Down (Legend play, legal in 1704 turns).

| Decision type | Decisions | First-listed option taken | Options offered (1 / 2 / 3–5 / 6–10 / 11–20 / 21+) |
|---|---|---|---|
| main | 14398 | 7% | 0 / 1141 / 3865 / 5135 / 4013 / 244 |
| gig/steal | 3559 | 24% | 108 / 390 / 1549 / 1496 / 16 / 0 |
| gig/rollIn | 2240 | 0% | 0 / 560 / 1680 / 0 / 0 / 0 |
| gigValue/adjust | 855 | 10% | 0 / 7 / 54 / 49 / 497 / 248 |
| unit/defeat | 609 | 64% | 238 / 150 / 205 / 16 / 0 / 0 |
| mode/mode | 576 | 76% | 0 / 542 / 34 / 0 / 0 / 0 |
| react | 562 | 48% | 0 / 350 / 212 / 0 / 0 / 0 |
| mulligan | 560 | 15% | 0 / 560 / 0 / 0 / 0 / 0 |
| unit/pump | 446 | 58% | 150 / 162 / 125 / 9 / 0 / 0 |
| card/playFree | 445 | 69% | 0 / 165 / 272 / 8 / 0 / 0 |
| unit/equip | 55 | 80% | 8 / 13 / 27 / 7 / 0 / 0 |
| unit/bottomdeck | 49 | 80% | 30 / 10 / 9 / 0 / 0 / 0 |
| unit/bottomdeckOwn | 49 | 55% | 17 / 16 / 16 / 0 / 0 / 0 |
| unit/sacrifice | 49 | 67% | 25 / 9 / 15 / 0 / 0 / 0 |
| card/discard | 40 | 48% | 13 / 10 / 17 / 0 / 0 / 0 |
| yesno/draw | 18 | 100% | 0 / 18 / 0 / 0 / 0 / 0 |
| unit/call | 4 | 100% | 0 / 1 / 3 / 0 / 0 / 0 |
| yesno/call | 3 | 100% | 0 / 3 / 0 / 0 / 0 / 0 |
| mode/foolOnTheHill | 2 | 100% | 0 / 2 / 0 / 0 / 0 / 0 |
| mode/rivalChoice | 1 | 0% | 0 / 1 / 0 / 0 / 0 / 0 |

Reaction windows: 562 attacks. Reacted to 290 (deck won 42% (36–48) n=256): stole 236, attackerGone 3, targetGone 39, bothGone 12. Let 272 resolve (46% (38–54) n=146): stole 197, attackerGone 1, targetGone 65, bothGone 9. Choices: call 290, endReact 272.

## Samurai — 560 games, 41% won, 25754 decisions

| Card | Use | Uses | Win rate in games used (95%) | Legal turns → used | Not chosen | Early / mid / late uses | Ahead | Even | Behind |
|---|---|---|---|---|---|---|---|---|---|
| Rockn' Rockerboy | attacked | 997 | 48% (43–53) n=361 | 978 → 877 | 10% | 0 / 425 / 572 | 66% (59–72) n=209 | 48% (38–59) n=81 | 40% (34–47) n=234 |
| Johnny Silverhand: Never Stop Fighting | attacked | 863 | 55% (49–61) n=287 | 581 → 544 | 6% | 0 / 154 / 709 | 77% (71–83) n=177 | 72% (60–82) n=65 | 40% (33–48) n=161 |
| Rockn' Rockerboy | played | 549 | 46% (41–51) n=402 | 680 → 548 | 19% | 246 / 171 / 132 | 60% (53–67) n=206 | 35% (27–43) n=138 | 34% (26–42) n=133 |
| Kerry Eurodyne: The Last Rockerboy | attacked | 499 | 39% (33–45) n=269 | 718 → 475 | 34% | 52 / 194 / 253 | 57% (48–66) n=119 | 36% (27–47) n=85 | 30% (23–38) n=157 |
| Johnny Silverhand: Never Stop Fighting | played | 466 | 47% (42–52) n=366 | 850 → 466 | 45% | 0 / 290 / 176 | 64% (57–71) n=162 | 37% (25–51) n=49 | 37% (30–44) n=188 |
| Kerry Eurodyne: The Last Rockerboy | played | 461 | 41% (36–46) n=353 | 797 → 459 | 42% | 201 / 140 / 120 | 49% (42–57) n=174 | 30% (23–38) n=139 | 34% (25–45) n=90 |
| Johnny Silverhand: Rocking Renegade | ability | 442 | 42% (37–47) n=310 | 1432 → 442 | 69% | 1 / 83 / 358 | 65% (57–72) n=165 | 28% (19–41) n=60 | 18% (12–25) n=136 |
| Kerry Eurodyne: Axe, Attitude, Audience | called | 415 | 40% (35–44) n=415 | 427 → 415 | 3% | 154 / 162 / 99 | 51% (45–57) n=257 | 22% (15–32) n=81 | 21% (13–31) n=77 |
| Alt Cunningham: Soulkiller Architect | called | 412 | 40% (36–45) n=412 | 428 → 412 | 4% | 148 / 152 / 112 | 51% (45–57) n=243 | 29% (20–40) n=79 | 21% (14–31) n=90 |
| Johnny Silverhand: Rocking Renegade | called | 409 | 41% (36–46) n=409 | 419 → 409 | 2% | 163 / 158 / 88 | 50% (44–56) n=256 | 21% (13–31) n=73 | 30% (21–41) n=80 |
| Alt Cunningham: Soulkiller Architect | ability | 388 | 37% (32–43) n=273 | 1602 → 388 | 76% | 10 / 84 / 294 | 60% (52–68) n=151 | 13% (6–24) n=55 | 14% (9–21) n=122 |
| Modded Kusanagi | played | 372 | 30% (24–36) n=232 | 1006 → 372 | 63% | 0 / 119 / 253 | 51% (40–62) n=80 | 50% (35–65) n=38 | 16% (11–23) n=166 |
| Japantown Jonin | played | 361 | 38% (33–44) n=311 | 565 → 356 | 37% | 198 / 92 / 71 | 45% (38–53) n=155 | 25% (18–34) n=103 | 40% (30–51) n=75 |
| Modded Kusanagi | attacked | 355 | 31% (25–37) n=224 | 366 → 355 | 3% | 0 / 116 / 239 | 50% (40–60) n=86 | 49% (33–64) n=37 | 16% (11–22) n=147 |
| Rita Wheeler: No Stupid Questions | played | 344 | 42% (37–48) n=290 | 833 → 340 | 59% | 109 / 114 / 121 | 63% (54–71) n=114 | 31% (23–41) n=97 | 33% (25–42) n=106 |

(41 more card uses in the JSON report.)

Legal but never taken: Reboot Optics (played, legal in 499 turns).

| Decision type | Decisions | First-listed option taken | Options offered (1 / 2 / 3–5 / 6–10 / 11–20 / 21+) |
|---|---|---|---|
| main | 14268 | 10% | 0 / 1064 / 3457 / 6095 / 3548 / 104 |
| gig/steal | 2508 | 31% | 179 / 442 / 1018 / 861 / 8 / 0 |
| gig/rollIn | 2240 | 0% | 0 / 560 / 1680 / 0 / 0 / 0 |
| react | 1664 | 62% | 0 / 1050 / 600 / 14 / 0 / 0 |
| yesno/kerryReroll | 1326 | 56% | 0 / 1326 / 0 / 0 / 0 / 0 |
| mulligan | 560 | 27% | 0 / 560 / 0 / 0 / 0 / 0 |
| card/discard | 525 | 45% | 30 / 182 / 278 / 35 / 0 / 0 |
| gigValue/adjust | 465 | 16% | 0 / 9 / 46 / 79 / 213 / 118 |
| unit/lagAttack | 442 | 83% | 95 / 154 / 189 / 4 / 0 / 0 |
| unit/equip | 398 | 82% | 99 / 104 / 166 / 29 / 0 / 0 |
| unit/pump | 361 | 78% | 174 / 74 / 112 / 1 / 0 / 0 |
| unit/bottomdeck | 207 | 46% | 50 / 44 / 109 / 4 / 0 / 0 |
| unit/cantAttack | 181 | 57% | 51 / 58 / 70 / 2 / 0 / 0 |
| card/playFromTrash | 156 | 86% | 100 / 45 / 11 / 0 / 0 / 0 |
| card/freePlay | 148 | 86% | 0 / 94 / 54 / 0 / 0 / 0 |
| unit/weaken | 74 | 66% | 16 / 30 / 28 / 0 / 0 / 0 |
| unit/bottomdeckOwn | 62 | 76% | 29 / 23 / 10 / 0 / 0 / 0 |
| unit/call | 56 | 100% | 0 / 20 / 36 / 0 / 0 / 0 |
| card/look | 52 | 100% | 29 / 18 / 5 / 0 / 0 / 0 |
| unit/sacrifice | 44 | 91% | 33 / 8 / 3 / 0 / 0 / 0 |
| yesno/draw | 11 | 100% | 0 / 11 / 0 / 0 / 0 / 0 |
| mode/foolOnTheHill | 3 | 67% | 0 / 3 / 0 / 0 / 0 / 0 |
| card/discardForNothing | 2 | 0% | 0 / 0 / 2 / 0 / 0 / 0 |
| mode/rivalChoice | 1 | 0% | 0 / 1 / 0 / 0 / 0 / 0 |

Reaction windows: 1467 attacks. Reacted to 538 (deck won 36% (31–41) n=376): stole 154, attackerGone 9, targetGone 337, bothGone 21, noneGone 17. Let 929 resolve (41% (36–46) n=379): stole 698, stoleNothing 3, attackerGone 6, targetGone 189, bothGone 33. Choices: block 334, endReact 1028, call 258, play 44.

## Smash the Curve — 560 games, 66% won, 24409 decisions

| Card | Use | Uses | Win rate in games used (95%) | Legal turns → used | Not chosen | Early / mid / late uses | Ahead | Even | Behind |
|---|---|---|---|---|---|---|---|---|---|
| Pepe Najarro: Working Doubles | attacked | 805 | 66% (61–71) n=332 | 930 → 736 | 21% | 79 / 327 / 399 | 89% (83–93) n=170 | 68% (60–76) n=129 | 58% (51–64) n=194 |
| 6th Street Recruits | attacked | 771 | 66% (61–71) n=340 | 893 → 696 | 22% | 70 / 301 / 400 | 85% (79–90) n=165 | 67% (58–75) n=119 | 60% (53–67) n=203 |
| Animals Wrecker | attacked | 706 | 76% (71–81) n=315 | 694 → 651 | 6% | 0 / 192 / 514 | 89% (83–93) n=162 | 87% (77–93) n=69 | 73% (67–78) n=214 |
| V: Streetkid | attacked | 527 | 50% (44–56) n=285 | 612 → 527 | 14% | 63 / 166 / 298 | 63% (56–70) n=171 | 58% (46–69) n=64 | 38% (30–46) n=127 |
| Synapse Burnout | sold | 512 | 66% (61–71) n=368 | 779 → 512 | 34% | 274 / 123 / 115 | 72% (66–78) n=188 | 60% (52–68) n=141 | 58% (48–66) n=113 |
| Animals Wrecker | played | 507 | 71% (66–75) n=391 | 676 → 507 | 25% | 0 / 346 / 161 | 81% (73–86) n=149 | 71% (61–80) n=83 | 64% (57–70) n=217 |
| 6th Street Recruits | played | 493 | 64% (59–69) n=365 | 989 → 481 | 51% | 255 / 122 / 116 | 73% (66–79) n=183 | 62% (54–69) n=156 | 45% (35–55) n=87 |
| Yorinobu Arasaka: Steel Dragon | played | 491 | 71% (66–75) n=370 | 605 → 491 | 19% | 0 / 201 / 290 | 86% (79–91) n=121 | 85% (72–92) n=52 | 61% (55–67) n=237 |
| Pepe Najarro: Working Doubles | played | 483 | 64% (59–69) n=365 | 969 → 478 | 51% | 272 / 102 / 109 | 70% (62–76) n=165 | 64% (57–71) n=160 | 46% (36–56) n=89 |
| Peace Offering | sold | 463 | 66% (61–71) n=360 | 960 → 463 | 52% | 178 / 183 / 102 | 69% (62–76) n=166 | 66% (57–75) n=107 | 61% (52–68) n=137 |
| Yorinobu Arasaka: Steel Dragon | attacked | 462 | 77% (72–81) n=281 | 453 → 427 | 6% | 0 / 0 / 462 | 96% (91–98) n=141 | 90% (80–95) n=59 | 64% (56–71) n=165 |
| Bonnie and Clyde | sold | 449 | 67% (62–72) n=345 | 1429 → 449 | 69% | 61 / 189 / 199 | 73% (65–80) n=126 | 73% (63–81) n=90 | 57% (50–64) n=179 |
| Adam Smasher: Ender of Legends | called | 429 | 65% (60–69) n=429 | 429 → 429 | 0% | 198 / 123 / 108 | 73% (68–78) n=310 | 52% (39–65) n=54 | 37% (26–49) n=65 |
| V: Streetkid | called | 420 | 65% (60–69) n=420 | 420 → 420 | 0% | 189 / 141 / 90 | 67% (61–72) n=309 | 55% (42–68) n=56 | 62% (49–73) n=55 |
| Mantis Blades | sold | 417 | 66% (60–71) n=338 | 618 → 417 | 33% | 233 / 66 / 118 | 73% (65–80) n=145 | 61% (53–69) n=138 | 58% (48–67) n=106 |

(32 more card uses in the JSON report.)

Legal but never taken: V: Streetkid (Legend play, legal in 1090 turns).

| Decision type | Decisions | First-listed option taken | Options offered (1 / 2 / 3–5 / 6–10 / 11–20 / 21+) |
|---|---|---|---|
| main | 13689 | 9% | 0 / 1222 / 3725 / 5110 / 3483 / 149 |
| gig/steal | 3744 | 29% | 210 / 507 / 1693 / 1323 / 11 / 0 |
| gig/rollIn | 2240 | 0% | 0 / 560 / 1680 / 0 / 0 / 0 |
| react | 1465 | 66% | 0 / 1022 / 439 / 4 / 0 / 0 |
| unit/defeat | 608 | 61% | 205 / 158 / 231 / 14 / 0 / 0 |
| mulligan | 560 | 20% | 0 / 560 / 0 / 0 / 0 / 0 |
| card/search | 478 | 68% | 203 / 149 / 89 / 37 / 0 / 0 |
| card/playFree | 457 | 75% | 0 / 145 / 287 / 25 / 0 / 0 |
| unit/equip | 316 | 84% | 43 / 83 / 163 / 27 / 0 / 0 |
| gigValue/adjust | 297 | 6% | 0 / 14 / 46 / 19 / 26 / 192 |
| unit/ready | 178 | 96% | 0 / 150 / 28 / 0 / 0 / 0 |
| gigValue/setGig | 128 | 9% | 0 / 0 / 3 / 16 / 31 / 78 |
| unit/pump | 94 | 73% | 40 / 27 / 27 / 0 / 0 / 0 |
| unit/sacrifice | 52 | 85% | 33 / 11 / 8 / 0 / 0 / 0 |
| card/discard | 50 | 58% | 13 / 14 / 22 / 1 / 0 / 0 |
| yesno/draw | 22 | 100% | 0 / 22 / 0 / 0 / 0 / 0 |
| card/defeat | 19 | 95% | 16 / 3 / 0 / 0 / 0 / 0 |
| mode/rivalChoice | 8 | 0% | 0 / 8 / 0 / 0 / 0 / 0 |
| mode/foolOnTheHill | 4 | 50% | 0 / 4 / 0 / 0 / 0 / 0 |

Reaction windows: 1346 attacks. Reacted to 448 (deck won 63% (57–68) n=320): stole 207, stoleNothing 1, attackerGone 37, targetGone 170, bothGone 32, noneGone 1. Let 898 resolve (66% (61–71) n=356): stole 631, stoleNothing 4, attackerGone 6, targetGone 209, bothGone 48. Choices: endReact 972, play 49, call 276, block 168.

## The Red Chrome - Aggro — 560 games, 38% won, 21412 decisions

| Card | Use | Uses | Win rate in games used (95%) | Legal turns → used | Not chosen | Early / mid / late uses | Ahead | Even | Behind |
|---|---|---|---|---|---|---|---|---|---|
| 6th Street Recruits | attacked | 720 | 38% (33–43) n=324 | 904 → 654 | 28% | 83 / 290 / 347 | 59% (50–67) n=126 | 35% (27–44) n=116 | 36% (30–42) n=221 |
| Animals Wrecker | attacked | 681 | 49% (43–54) n=272 | 626 → 603 | 4% | 0 / 161 / 520 | 81% (72–87) n=105 | 67% (55–77) n=69 | 41% (34–47) n=207 |
| Detonate | sold | 544 | 37% (32–42) n=399 | 703 → 544 | 23% | 336 / 94 / 114 | 48% (41–55) n=186 | 33% (27–41) n=162 | 29% (22–38) n=117 |
| Over the Edge | sold | 512 | 39% (34–44) n=392 | 1107 → 512 | 54% | 125 / 243 / 144 | 48% (40–56) n=155 | 37% (28–47) n=95 | 34% (27–41) n=193 |
| Carnage at the Colosseum | sold | 501 | 38% (33–43) n=368 | 1449 → 501 | 65% | 42 / 206 / 253 | 53% (45–61) n=136 | 48% (36–61) n=58 | 29% (23–35) n=238 |
| 6th Street Recruits | played | 487 | 37% (32–42) n=362 | 816 → 484 | 41% | 294 / 91 / 102 | 42% (35–50) n=171 | 33% (26–41) n=157 | 23% (15–32) n=97 |
| Animals Wrecker | played | 464 | 42% (37–47) n=354 | 590 → 464 | 21% | 0 / 301 / 163 | 59% (49–68) n=97 | 50% (38–62) n=62 | 33% (28–40) n=237 |
| V: Streetkid | attacked | 445 | 26% (21–31) n=285 | 548 → 445 | 19% | 59 / 126 / 260 | 45% (37–54) n=135 | 33% (20–50) n=33 | 15% (10–21) n=171 |
| Valentino Guerrera | attacked | 437 | 34% (28–40) n=246 | 629 → 397 | 37% | 36 / 146 / 255 | 56% (45–66) n=86 | 42% (32–54) n=73 | 25% (19–32) n=163 |
| V: Streetkid | called | 429 | 36% (32–41) n=429 | 429 → 429 | 0% | 184 / 115 / 130 | 44% (39–50) n=272 | 19% (11–29) n=70 | 25% (17–35) n=87 |
| Mantis Blades | sold | 428 | 40% (35–45) n=348 | 593 → 428 | 28% | 242 / 69 / 117 | 48% (40–56) n=149 | 33% (26–42) n=126 | 30% (23–39) n=112 |
| Valentino Guerrera | played | 411 | 34% (29–39) n=322 | 1266 → 387 | 69% | 186 / 91 / 134 | 50% (41–59) n=116 | 25% (19–33) n=150 | 21% (14–31) n=90 |
| Adam Smasher: Ender of Legends | called | 411 | 38% (34–43) n=411 | 411 → 411 | 0% | 196 / 77 / 138 | 47% (41–53) n=267 | 29% (19–40) n=70 | 18% (11–28) n=74 |
| Royce: Psycho on the Edge | called | 410 | 38% (33–42) n=410 | 410 → 410 | 0% | 178 / 109 / 123 | 45% (39–51) n=260 | 33% (23–44) n=76 | 15% (9–25) n=74 |
| Appetite for Destruction | sold | 382 | 42% (37–47) n=325 | 578 → 382 | 34% | 176 / 115 / 91 | 51% (42–60) n=117 | 43% (34–52) n=116 | 35% (27–44) n=121 |

(34 more card uses in the JSON report.)

Legal but never taken: V: Streetkid (Legend play, legal in 978 turns), Royce: Psycho on the Edge (Legend play, legal in 1194 turns), Adam Smasher: Ender of Legends (Legend play, legal in 117 turns), Appetite for Destruction (played, legal in 484 turns).

| Decision type | Decisions | First-listed option taken | Options offered (1 / 2 / 3–5 / 6–10 / 11–20 / 21+) |
|---|---|---|---|
| main | 12903 | 8% | 0 / 1018 / 3516 / 5024 / 3168 / 177 |
| gig/steal | 3333 | 26% | 126 / 361 / 1326 / 1492 / 28 / 0 |
| gig/rollIn | 2240 | 0% | 0 / 560 / 1680 / 0 / 0 / 0 |
| react | 1121 | 70% | 0 / 761 / 359 / 1 / 0 / 0 |
| mulligan | 560 | 33% | 0 / 560 / 0 / 0 / 0 / 0 |
| unit/defeat | 287 | 59% | 80 / 77 / 119 / 11 / 0 / 0 |
| card/playFree | 246 | 70% | 0 / 100 / 140 / 6 / 0 / 0 |
| gigValue/adjust | 217 | 7% | 0 / 13 / 39 / 33 / 5 / 127 |
| unit/equip | 192 | 90% | 59 / 72 / 56 / 5 / 0 / 0 |
| card/search | 158 | 87% | 117 / 12 / 14 / 15 / 0 / 0 |
| card/discard | 56 | 48% | 11 / 14 / 29 / 2 / 0 / 0 |
| unit/sacrifice | 50 | 80% | 27 / 14 / 9 / 0 / 0 / 0 |
| unit/pump | 16 | 63% | 10 / 2 / 4 / 0 / 0 / 0 |
| card/defeat | 15 | 80% | 11 / 4 / 0 / 0 / 0 / 0 |
| yesno/draw | 10 | 100% | 0 / 10 / 0 / 0 / 0 / 0 |
| mode/foolOnTheHill | 6 | 67% | 0 / 6 / 0 / 0 / 0 / 0 |
| mode/rivalChoice | 2 | 0% | 0 / 2 / 0 / 0 / 0 / 0 |

Reaction windows: 1067 attacks. Reacted to 322 (deck won 33% (27–38) n=264): stole 195, attackerGone 2, targetGone 115, bothGone 10. Let 745 resolve (36% (31–42) n=301): stole 540, stoleNothing 7, targetGone 171, bothGone 27. Choices: endReact 785, call 244, block 88, play 4.

## YYB Rogue Gear — 560 games, 50% won, 26693 decisions

| Card | Use | Uses | Win rate in games used (95%) | Legal turns → used | Not chosen | Early / mid / late uses | Ahead | Even | Behind |
|---|---|---|---|---|---|---|---|---|---|
| V: Corporate Exile | attacked | 1045 | 48% (44–53) n=494 | 1196 → 1045 | 13% | 106 / 380 / 559 | 58% (53–63) n=347 | 52% (43–61) n=112 | 34% (27–41) n=179 |
| Psycho Squad | attacked | 860 | 53% (48–59) n=337 | 931 → 786 | 16% | 106 / 314 / 440 | 61% (55–67) n=227 | 50% (42–58) n=143 | 41% (33–49) n=142 |
| The Heist | sold | 539 | 50% (45–55) n=378 | 975 → 539 | 45% | 194 / 206 / 139 | 55% (49–62) n=222 | 48% (40–57) n=129 | 38% (28–47) n=96 |
| Psycho Squad | played | 521 | 53% (48–58) n=395 | 946 → 517 | 45% | 242 / 154 / 125 | 59% (53–65) n=233 | 49% (41–57) n=157 | 29% (18–42) n=52 |
| V: Corporate Exile | Go Solo (self-paid 517) | 517 | 48% (44–52) n=517 | 590 → 517 | 12% | 117 / 208 / 192 | 57% (51–62) n=315 | 38% (28–48) n=93 | 32% (24–41) n=109 |
| Dying Night: V's Pistol | sold | 511 | 44% (39–49) n=370 | 1094 → 511 | 53% | 198 / 153 / 160 | 49% (42–56) n=201 | 47% (39–55) n=141 | 26% (18–35) n=98 |
| Zetatech Faceplate | sold | 505 | 50% (44–55) n=365 | 1516 → 505 | 67% | 73 / 210 / 222 | 59% (52–65) n=217 | 41% (30–52) n=74 | 35% (27–44) n=131 |
| River Ward: Detective on the Hunt | ability | 497 | 46% (41–52) n=321 | 1949 → 497 | 74% | 46 / 108 / 343 | 58% (52–64) n=231 | 29% (19–42) n=58 | 18% (12–27) n=100 |
| V: Corporate Exile | called | 481 | 48% (44–53) n=481 | 481 → 481 | 0% | 238 / 151 / 92 | 53% (48–58) n=330 | 37% (28–46) n=106 | 40% (27–55) n=45 |
| Trauma Team Operatives | played | 462 | 51% (46–56) n=346 | 1051 → 441 | 58% | 12 / 155 / 295 | 62% (55–68) n=214 | 43% (31–56) n=56 | 26% (19–34) n=117 |
| Dexter DeShawn: One Last Chance | attacked | 462 | 53% (47–60) n=231 | 585 → 433 | 26% | 42 / 175 / 245 | 62% (54–70) n=151 | 56% (44–67) n=68 | 34% (25–44) n=94 |
| River Ward: Detective on the Hunt | called | 460 | 48% (44–53) n=460 | 460 → 460 | 0% | 226 / 141 / 93 | 53% (47–58) n=330 | 39% (29–49) n=90 | 33% (20–48) n=40 |
| Viktor Vektor: Sit Down and Relax | called | 459 | 48% (44–53) n=459 | 459 → 459 | 0% | 207 / 153 / 99 | 55% (50–61) n=334 | 36% (26–47) n=81 | 18% (10–32) n=44 |
| Trauma Team Operatives | attacked | 439 | 55% (48–61) n=245 | 446 → 408 | 9% | 0 / 58 / 381 | 76% (69–83) n=140 | 65% (52–76) n=60 | 27% (20–36) n=111 |
| Modded Kusanagi | played | 392 | 38% (32–44) n=256 | 1135 → 392 | 65% | 0 / 60 / 332 | 64% (55–72) n=118 | 36% (23–50) n=45 | 12% (7–18) n=156 |

(35 more card uses in the JSON report.)

Legal but never taken: Reboot Optics (played, legal in 658 turns).

| Decision type | Decisions | First-listed option taken | Options offered (1 / 2 / 3–5 / 6–10 / 11–20 / 21+) |
|---|---|---|---|
| main | 14511 | 8% | 0 / 1244 / 3617 / 6079 / 3407 / 164 |
| gig/steal | 3255 | 41% | 478 / 643 / 1235 / 891 / 8 / 0 |
| gig/rollIn | 2240 | 100% | 0 / 560 / 1680 / 0 / 0 / 0 |
| react | 2109 | 69% | 0 / 1350 / 742 / 17 / 0 / 0 |
| gigValue/adjust | 1528 | 10% | 0 / 1 / 87 / 350 / 889 / 201 |
| unit/equip | 967 | 75% | 128 / 242 / 533 / 64 / 0 / 0 |
| card/search | 660 | 83% | 15 / 380 / 265 / 0 / 0 / 0 |
| mulligan | 560 | 16% | 0 / 560 / 0 / 0 / 0 / 0 |
| card/playFree | 314 | 93% | 235 / 69 / 10 / 0 / 0 / 0 |
| card/trash | 241 | 53% | 0 / 241 / 0 / 0 / 0 / 0 |
| unit/sacrifice | 190 | 54% | 76 / 62 / 52 / 0 / 0 / 0 |
| card/discard | 49 | 45% | 6 / 16 / 23 / 4 / 0 / 0 |
| unit/protect | 30 | 53% | 7 / 12 / 11 / 0 / 0 / 0 |
| yesno/playFree | 22 | 100% | 0 / 22 / 0 / 0 / 0 / 0 |
| yesno/draw | 7 | 100% | 0 / 7 / 0 / 0 / 0 / 0 |
| mode/rivalChoice | 6 | 0% | 0 / 6 / 0 / 0 / 0 / 0 |
| mode/foolOnTheHill | 4 | 50% | 0 / 4 / 0 / 0 / 0 / 0 |

Reaction windows: 1897 attacks. Reacted to 537 (deck won 45% (40–50) n=361): stole 183, attackerGone 9, targetGone 292, bothGone 34, noneGone 19. Let 1360 resolve (46% (42–51) n=433): stole 1023, stoleNothing 10, attackerGone 5, targetGone 269, bothGone 53. Choices: call 203, block 298, endReact 1460, ability 95, play 53.

## YYY Adam v1 - Ready for Brawl — 560 games, 47% won, 27544 decisions

| Card | Use | Uses | Win rate in games used (95%) | Legal turns → used | Not chosen | Early / mid / late uses | Ahead | Even | Behind |
|---|---|---|---|---|---|---|---|---|---|
| MaxTac Suppression Team | attacked | 699 | 49% (44–55) n=322 | 801 → 646 | 19% | 0 / 299 / 400 | 66% (59–73) n=170 | 56% (45–66) n=77 | 39% (33–46) n=194 |
| Dexter DeShawn: One Last Chance | attacked | 694 | 52% (47–57) n=328 | 888 → 637 | 28% | 89 / 281 / 324 | 66% (58–72) n=172 | 53% (44–62) n=119 | 43% (36–51) n=168 |
| Augmented Negotiators | played | 632 | 49% (44–54) n=423 | 1361 → 598 | 56% | 100 / 279 / 253 | 65% (58–71) n=190 | 40% (32–48) n=126 | 43% (36–50) n=182 |
| Muamar Reyes: El Capitán | ability | 620 | 45% (40–50) n=389 | 2214 → 620 | 72% | 40 / 156 / 424 | 62% (56–68) n=233 | 25% (17–35) n=91 | 21% (15–28) n=164 |
| Dexter DeShawn: One Last Chance | played | 619 | 47% (42–51) n=422 | 845 → 594 | 30% | 249 / 228 / 142 | 57% (50–63) n=214 | 42% (35–49) n=172 | 34% (26–42) n=127 |
| Maelstrom Goons | played | 609 | 48% (43–53) n=417 | 1163 → 566 | 51% | 155 / 244 / 210 | 58% (52–65) n=202 | 40% (33–48) n=150 | 37% (29–45) n=130 |
| The Heist | sold | 604 | 47% (42–52) n=415 | 1010 → 604 | 40% | 219 / 197 / 188 | 57% (49–63) n=189 | 42% (34–50) n=158 | 32% (25–39) n=170 |
| Safety Override | sold | 602 | 45% (41–50) n=426 | 1024 → 602 | 41% | 247 / 188 / 167 | 56% (50–63) n=209 | 37% (30–46) n=142 | 34% (27–42) n=160 |
| MaxTac Suppression Team | played | 571 | 48% (43–53) n=409 | 975 → 567 | 42% | 179 / 165 / 227 | 60% (53–66) n=220 | 36% (28–44) n=136 | 35% (27–43) n=142 |
| Maelstrom Goons | attacked | 566 | 50% (44–55) n=303 | 771 → 511 | 34% | 47 / 192 / 327 | 72% (65–79) n=145 | 51% (41–61) n=88 | 39% (32–46) n=173 |
| Zetatech Faceplate | sold | 507 | 48% (43–53) n=378 | 1345 → 507 | 62% | 75 / 238 / 194 | 64% (57–71) n=165 | 48% (38–58) n=98 | 31% (25–39) n=178 |
| Kerry Eurodyne: Axe, Attitude, Audience | called | 455 | 49% (44–53) n=455 | 455 → 455 | 0% | 256 / 156 / 43 | 56% (51–62) n=280 | 38% (30–47) n=123 | 33% (22–46) n=52 |
| River Ward: Detective on the Hunt | called | 452 | 48% (44–53) n=452 | 452 → 452 | 0% | 246 / 154 / 52 | 57% (51–63) n=279 | 38% (30–47) n=123 | 22% (13–35) n=50 |
| The Relic: Experimental Biochip | sold | 446 | 48% (42–53) n=353 | 966 → 446 | 54% | 236 / 83 / 127 | 56% (48–63) n=165 | 49% (41–57) n=140 | 30% (22–39) n=105 |
| Muamar Reyes: El Capitán | called | 442 | 47% (42–51) n=442 | 442 → 442 | 0% | 290 / 106 / 46 | 51% (45–57) n=259 | 41% (33–49) n=141 | 36% (23–51) n=42 |

(23 more card uses in the JSON report.)

Legal but never taken: Safety Override (played, legal in 1041 turns).

| Decision type | Decisions | First-listed option taken | Options offered (1 / 2 / 3–5 / 6–10 / 11–20 / 21+) |
|---|---|---|---|
| main | 13771 | 8% | 0 / 1054 / 3345 / 5634 / 3609 / 129 |
| gig/steal | 2586 | 32% | 177 / 444 / 1115 / 846 / 4 / 0 |
| gig/rollIn | 2240 | 0% | 0 / 560 / 1680 / 0 / 0 / 0 |
| gigValue/adjust | 2140 | 26% | 0 / 0 / 170 / 377 / 1292 / 301 |
| react | 1940 | 61% | 0 / 1221 / 713 / 6 / 0 / 0 |
| yesno/kerryReroll | 1801 | 63% | 0 / 1801 / 0 / 0 / 0 / 0 |
| unit/equip | 726 | 74% | 2 / 177 / 442 / 105 / 0 / 0 |
| mulligan | 560 | 29% | 0 / 560 / 0 / 0 / 0 / 0 |
| mode/muamarCall | 547 | 54% | 0 / 547 / 0 / 0 / 0 / 0 |
| unit/protect | 332 | 53% | 124 / 121 / 87 / 0 / 0 / 0 |
| card/trash | 302 | 50% | 0 / 302 / 0 / 0 / 0 / 0 |
| card/playFree | 247 | 85% | 168 / 32 / 43 / 4 / 0 / 0 |
| unit/sacrifice | 227 | 67% | 100 / 77 / 49 / 1 / 0 / 0 |
| card/discard | 50 | 42% | 9 / 6 / 32 / 3 / 0 / 0 |
| card/search | 38 | 74% | 18 / 18 / 2 / 0 / 0 / 0 |
| yesno/playFree | 21 | 100% | 0 / 21 / 0 / 0 / 0 / 0 |
| yesno/draw | 10 | 100% | 0 / 10 / 0 / 0 / 0 / 0 |
| mode/foolOnTheHill | 6 | 33% | 0 / 6 / 0 / 0 / 0 / 0 |

Reaction windows: 1700 attacks. Reacted to 640 (deck won 44% (40–49) n=414): stole 236, attackerGone 7, targetGone 304, bothGone 65, noneGone 28. Let 1060 resolve (44% (39–49) n=407): stole 794, stoleNothing 8, targetGone 231, bothGone 27. Choices: call 290, endReact 1181, play 59, block 338, ability 72.

## The bot’s own scores against outcomes (calibration check)

> Association only, like the rest of this report: the deciding side's win rate over its decisions, by the margin the bot claimed for its choice (its value minus the best other option's, in Gigs), and by whether the deep rollouts kept the 1-ply screen's top pick. A big claimed margin often comes in positions that are already won or lost, so a rising win rate is not proof the margins are right; a flat one says they carry little. Intervals use the game count (decisions in one game are not independent); under 20 games a cell shows only its counts.

| Bot | Scores | Scored | <0 Gigs | 0–0.05 Gigs | 0.05–0.15 Gigs | 0.15–0.5 Gigs | 0.5–1 Gigs | 1+ Gigs |
|---|---|---|---|---|---|---|---|---|
| hard | main deep | 771742 | — | 50% (50–51) 303193 in 39681 games | 53% (52–53) 148414 in 38637 games | 53% (52–53) 110513 in 37808 games | 49% (49–50) 44558 in 26676 games | 54% (54–55) 165064 in 38877 games |
| hard | sell deep | 181207 | — | 51% (50–51) 153703 in 38954 games | 48% (46–49) 4448 in 4169 games | 50% (49–52) 6247 in 5831 games | 50% (49–52) 3428 in 3287 games | 54% (53–55) 13381 in 11650 games |
| hard | react deep | 93268 | 38% (37–39) 16410 in 9221 games | 39% (38–39) 37363 in 19345 games | 36% (34–37) 4096 in 3687 games | 40% (39–41) 8136 in 7059 games | 39% (37–40) 5339 in 4617 games | 45% (44–46) 21924 in 12699 games |

| Bot | Scores | Deep decisions | Rollouts kept the 1-ply pick | Rollouts overturned it | Overturned |
|---|---|---|---|---|---|
| hard | main deep | 771742 | 52% (52–53) 633527 in 39760 games | 51% (51–52) 138215 in 38464 games | 18% |
