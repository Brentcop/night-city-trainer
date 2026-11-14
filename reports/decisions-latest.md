# Decision telemetry

4200 games, 399542 decisions (telemetry schema 1). Sim v9, deep bot, seed 1.

> Descriptive association only: win rates in games where a card was used a given way, with 95% Wilson intervals. They are not the value of the card or of the choice (no counterfactual comparison yet; ROADMAP §5 steps 3 and 5). A slice from fewer than 20 games shows only its count ("thin").

Stages: early turns 1–4, middle turns 5–8, late turn 9+. Ahead / even / behind: the acting player's Gig count against the rival's when the decision was made. "Not chosen": share of the turns (attacks, for reactions) in which the use was legal but not taken.

Measured: games 4200, recordsPerGame 95.1, rawBytesPerGame 62749.8, aggregateBytesPerGame 13335.7, mergedBytes 146466, seconds 740.9.

## BBG Cunningham Econ — 1200 games, 52% won, 60898 decisions

| Card | Use | Uses | Win rate in games used (95%) | Legal turns → used | Not chosen | Early / mid / late uses | Ahead | Even | Behind |
|---|---|---|---|---|---|---|---|---|---|
| Jacked-In Voodoo Boy | attacked | 1675 | 55% (51–59) n=747 | 1584 → 1391 | 12% | 184 / 514 / 977 | 67% (63–71) n=508 | 59% (52–65) n=220 | 36% (31–42) n=335 |
| Jacked-In Voodoo Boy | played | 1627 | 53% (50–56) n=1014 | 2351 → 1484 | 37% | 645 / 484 / 498 | 63% (60–67) n=680 | 41% (36–46) n=308 | 29% (24–36) n=214 |
| Psycho Squad | attacked | 1574 | 56% (52–60) n=650 | 1703 → 1479 | 13% | 149 / 616 / 809 | 70% (66–75) n=385 | 57% (51–63) n=235 | 47% (42–52) n=348 |
| Pepe Najarro: Working Doubles | attacked | 1553 | 55% (52–59) n=643 | 1707 → 1469 | 14% | 149 / 609 / 795 | 74% (69–78) n=383 | 57% (50–63) n=240 | 43% (38–49) n=323 |
| Alt Cunningham: Soulkiller Architect | ability | 1500 | 47% (43–50) n=906 | 3893 → 1470 | 62% | 18 / 366 / 1116 | 64% (60–68) n=574 | 39% (32–47) n=157 | 19% (16–23) n=444 |
| Peace Offering | sold | 1211 | 51% (48–54) n=862 | 1761 → 1211 | 31% | 547 / 312 / 352 | 58% (53–62) n=473 | 46% (41–52) n=314 | 37% (31–43) n=229 |
| Floor It | sold | 1149 | 52% (49–55) n=856 | 1743 → 1149 | 34% | 498 / 290 / 361 | 61% (57–66) n=459 | 49% (44–55) n=313 | 37% (31–44) n=215 |
| Hanako Arasaka: Daughter of the Emperor | ability | 1102 | 40% (37–44) n=731 | 3735 → 1102 | 70% | 16 / 292 / 794 | 58% (53–63) n=425 | 25% (18–33) n=118 | 13% (10–17) n=372 |
| Chrome Reverie | sold | 1098 | 52% (48–55) n=813 | 1856 → 1098 | 41% | 481 / 317 / 300 | 57% (53–62) n=462 | 55% (48–61) n=244 | 37% (31–43) n=250 |
| Trust No One | sold | 1063 | 54% (51–58) n=790 | 1553 → 1063 | 32% | 426 / 288 / 349 | 65% (60–70) n=395 | 52% (47–58) n=311 | 37% (31–44) n=224 |
| Pepe Najarro: Working Doubles | played | 1006 | 54% (50–57) n=795 | 1557 → 997 | 36% | 379 / 306 / 321 | 64% (59–68) n=455 | 49% (43–55) n=283 | 28% (22–35) n=175 |
| Psycho Squad | played | 1003 | 54% (50–57) n=796 | 1487 → 996 | 33% | 375 / 323 / 305 | 64% (59–68) n=444 | 52% (45–58) n=258 | 31% (25–39) n=181 |
| Mox Inciters | played | 959 | 52% (48–55) n=772 | 2089 → 915 | 56% | 145 / 420 / 394 | 64% (59–68) n=428 | 46% (39–53) n=193 | 31% (26–37) n=234 |
| Hanako Arasaka: Daughter of the Emperor | called | 906 | 54% (50–57) n=906 | 906 → 906 | 0% | 325 / 441 / 140 | 60% (56–64) n=649 | 40% (33–48) n=152 | 34% (26–44) n=105 |
| Jackie Welles: Pour One Out For Me | called | 892 | 55% (52–58) n=892 | 892 → 892 | 0% | 301 / 472 / 119 | 60% (56–64) n=663 | 48% (40–56) n=146 | 28% (19–38) n=83 |

(28 more card uses in the JSON report.)

| Decision type | Decisions | First-listed option taken | Options offered (1 / 2 / 3–5 / 6–10 / 11–20 / 21+) |
|---|---|---|---|
| main | 30341 | 6% | 0 / 2575 / 7552 / 12678 / 7295 / 241 |
| gig/steal | 5438 | 34% | 388 / 1171 / 2524 / 1344 / 11 / 0 |
| gig/rollIn | 4800 | 100% | 0 / 1200 / 3600 / 0 / 0 / 0 |
| gigValue/adjust | 2819 | 21% | 0 / 85 / 696 / 1189 / 761 / 88 |
| react | 2502 | 34% | 0 / 1781 / 719 / 2 / 0 / 0 |
| card/search | 2354 | 57% | 0 / 501 / 1853 / 0 / 0 / 0 |
| unit/bottomdeck | 2274 | 79% | 1532 / 383 / 354 / 5 / 0 / 0 |
| card/discard | 1685 | 51% | 251 / 642 / 736 / 56 / 0 / 0 |
| mulligan | 1200 | 22% | 0 / 1200 / 0 / 0 / 0 / 0 |
| gig/swapGive | 1102 | 42% | 46 / 86 / 542 / 428 / 0 / 0 |
| gig/swapTake | 1102 | 25% | 69 / 116 / 496 / 400 / 21 / 0 |
| card/playFromTrash | 1019 | 64% | 445 / 320 / 228 / 26 / 0 / 0 |
| unit/mustAttack | 790 | 64% | 332 / 285 / 172 / 1 / 0 / 0 |
| unit/ready | 717 | 100% | 0 / 484 / 233 / 0 / 0 / 0 |
| card/freePlay | 604 | 64% | 0 / 200 / 342 / 62 / 0 / 0 |
| unit/weaken | 567 | 69% | 218 / 177 / 167 / 5 / 0 / 0 |
| yesno/discardFor | 566 | 100% | 0 / 566 / 0 / 0 / 0 / 0 |
| mode/mode | 280 | 91% | 0 / 27 / 253 / 0 / 0 / 0 |
| unit/cantAttack | 279 | 62% | 89 / 102 / 87 / 1 / 0 / 0 |
| gigValue/setGig | 243 | 18% | 0 / 5 / 11 / 13 / 32 / 182 |
| unit/sacrifice | 94 | 94% | 68 / 16 / 10 / 0 / 0 / 0 |
| unit/call | 79 | 100% | 0 / 36 / 43 / 0 / 0 / 0 |
| card/discardForNothing | 30 | 0% | 0 / 8 / 17 / 5 / 0 / 0 |
| yesno/draw | 13 | 100% | 0 / 13 / 0 / 0 / 0 / 0 |

Reaction windows: 2173 attacks. Reacted to 1514 (deck won 48% (45–51) n=918): stole 566, attackerGone 5, targetGone 909, bothGone 34. Let 659 resolve (53% (48–58) n=369): stole 601, stoleNothing 3, attackerGone 1, targetGone 43, bothGone 11. Choices: endReact 857, call 745, block 786, play 114.

## GRY Trauma Team — 1200 games, 37% won, 59620 decisions

| Card | Use | Uses | Win rate in games used (95%) | Legal turns → used | Not chosen | Early / mid / late uses | Ahead | Even | Behind |
|---|---|---|---|---|---|---|---|---|---|
| Pepe Najarro: Working Doubles | attacked | 1714 | 39% (36–43) n=697 | 1980 → 1562 | 21% | 166 / 591 / 957 | 59% (54–65) n=343 | 46% (40–52) n=272 | 30% (26–34) n=465 |
| 6th Street Recruits | attacked | 1639 | 41% (38–45) n=686 | 1888 → 1506 | 20% | 141 / 563 / 935 | 64% (58–69) n=322 | 43% (37–50) n=245 | 30% (26–34) n=441 |
| V: Streetkid | attacked | 1582 | 33% (31–36) n=975 | 1964 → 1582 | 19% | 150 / 382 / 1050 | 48% (43–52) n=452 | 53% (46–60) n=173 | 21% (18–24) n=567 |
| Padre: Man of the Cross | ability | 1330 | 32% (29–35) n=844 | 4229 → 1330 | 69% | 9 / 226 / 1095 | 53% (48–57) n=443 | 18% (13–24) n=177 | 10% (8–13) n=451 |
| Johnny Silverhand: Never Stop Fighting | attacked | 1271 | 56% (52–61) n=436 | 897 → 814 | 9% | 0 / 261 / 1010 | 75% (69–80) n=251 | 73% (63–80) n=106 | 43% (37–50) n=247 |
| Muamar Reyes: El Capitán | ability | 1247 | 32% (29–35) n=829 | 4212 → 1247 | 70% | 18 / 222 / 1007 | 54% (49–58) n=434 | 14% (9–20) n=161 | 9% (7–12) n=434 |
| Pepe Najarro: Working Doubles | played | 1230 | 38% (35–41) n=879 | 2214 → 1216 | 45% | 528 / 244 / 458 | 49% (44–54) n=363 | 39% (34–44) n=360 | 21% (17–26) n=341 |
| Augmented Negotiators | played | 1228 | 36% (33–39) n=872 | 2898 → 1170 | 60% | 191 / 453 / 584 | 53% (47–58) n=356 | 32% (27–38) n=248 | 25% (22–30) n=437 |
| Meredith Stout: Stone Cold Corpo | played | 1215 | 39% (36–42) n=874 | 2931 → 1188 | 59% | 254 / 315 / 646 | 55% (49–60) n=326 | 39% (33–44) n=283 | 26% (22–31) n=427 |
| 6th Street Recruits | played | 1182 | 39% (35–42) n=834 | 2066 → 1168 | 43% | 479 / 271 / 432 | 50% (45–55) n=392 | 37% (31–42) n=309 | 27% (22–32) n=332 |
| Trauma Team Operatives | played | 1174 | 35% (32–39) n=851 | 2150 → 1116 | 48% | 47 / 463 / 664 | 48% (43–53) n=377 | 39% (31–47) n=137 | 24% (20–28) n=463 |
| Detonate | sold | 1152 | 36% (33–39) n=823 | 1645 → 1152 | 30% | 552 / 327 / 273 | 41% (36–45) n=413 | 35% (29–40) n=289 | 27% (23–33) n=295 |
| Trauma Team Operatives | attacked | 1095 | 39% (35–43) n=572 | 1123 → 981 | 13% | 0 / 186 / 909 | 63% (56–69) n=244 | 55% (46–64) n=116 | 27% (23–32) n=364 |
| The Heist | sold | 1090 | 36% (33–40) n=805 | 2225 → 1090 | 51% | 332 / 440 / 318 | 43% (38–47) n=388 | 40% (34–47) n=234 | 25% (21–30) n=336 |
| All is Lost | sold | 1059 | 38% (35–41) n=787 | 1535 → 1059 | 31% | 507 / 302 / 250 | 41% (36–47) n=326 | 40% (34–45) n=304 | 30% (25–35) n=292 |

(29 more card uses in the JSON report.)

Legal but never taken: V: Streetkid (Legend play, legal in 2215 turns).

| Decision type | Decisions | First-listed option taken | Options offered (1 / 2 / 3–5 / 6–10 / 11–20 / 21+) |
|---|---|---|---|
| main | 33358 | 9% | 0 / 2022 / 7241 / 11610 / 11781 / 704 |
| gig/steal | 6065 | 29% | 325 / 903 / 2555 / 2237 / 45 / 0 |
| gig/rollIn | 4800 | 0% | 0 / 1200 / 3600 / 0 / 0 / 0 |
| react | 3860 | 39% | 0 / 2449 / 1396 / 15 / 0 / 0 |
| gigValue/adjust | 2178 | 14% | 0 / 0 / 10 / 153 / 1231 / 784 |
| gigValue/setGig | 1640 | 7% | 0 / 1 / 10 / 112 / 433 / 1084 |
| unit/spend | 1419 | 60% | 497 / 388 / 519 / 15 / 0 / 0 |
| mulligan | 1200 | 11% | 0 / 1200 / 0 / 0 / 0 / 0 |
| mode/mode | 1173 | 66% | 0 / 1173 / 0 / 0 / 0 / 0 |
| mode/muamarCall | 1168 | 79% | 0 / 1168 / 0 / 0 / 0 / 0 |
| card/search | 1093 | 79% | 585 / 281 / 162 / 58 / 7 / 0 |
| unit/protect | 895 | 64% | 282 / 369 / 240 / 4 / 0 / 0 |
| unit/equip | 353 | 89% | 97 / 117 / 121 / 18 / 0 / 0 |
| unit/ready | 115 | 100% | 0 / 115 / 0 / 0 / 0 / 0 |
| unit/sacrifice | 106 | 80% | 52 / 27 / 27 / 0 / 0 / 0 |
| yesno/draw | 91 | 100% | 0 / 91 / 0 / 0 / 0 / 0 |
| card/discard | 48 | 38% | 4 / 8 / 32 / 4 / 0 / 0 |
| card/defeat | 46 | 91% | 30 / 13 / 3 / 0 / 0 / 0 |
| yesno/playFree | 8 | 100% | 0 / 8 / 0 / 0 / 0 / 0 |
| mode/rivalChoice | 4 | 25% | 0 / 4 / 0 / 0 / 0 / 0 |

Reaction windows: 3115 attacks. Reacted to 2091 (deck won 33% (30–36) n=1018): stole 762, attackerGone 34, targetGone 1113, bothGone 67, noneGone 115. Let 1024 resolve (41% (37–45) n=475): stole 933, attackerGone 5, targetGone 46, bothGone 40. Choices: block 1220, call 1127, endReact 1499, play 14.

## Rainbow Fixer Stuff — 1200 games, 43% won, 61795 decisions

| Card | Use | Uses | Win rate in games used (95%) | Legal turns → used | Not chosen | Early / mid / late uses | Ahead | Even | Behind |
|---|---|---|---|---|---|---|---|---|---|
| 6th Street Recruits | attacked | 2011 | 47% (44–51) n=813 | 2155 → 1808 | 16% | 138 / 719 / 1154 | 66% (61–70) n=412 | 43% (37–49) n=272 | 43% (39–48) n=512 |
| Pepe Najarro: Working Doubles | attacked | 1997 | 47% (43–50) n=789 | 2080 → 1785 | 14% | 120 / 685 / 1192 | 65% (61–70) n=404 | 47% (41–53) n=260 | 42% (37–46) n=505 |
| 6th Street Recruits | played | 1404 | 44% (41–47) n=959 | 2162 → 1389 | 36% | 516 / 447 / 441 | 54% (49–59) n=412 | 35% (30–40) n=336 | 41% (37–46) n=447 |
| Detonate | sold | 1373 | 45% (42–48) n=911 | 1952 → 1373 | 30% | 618 / 389 / 366 | 55% (50–60) n=426 | 38% (33–43) n=322 | 42% (37–46) n=395 |
| Psycho Squad | attacked | 1360 | 47% (43–51) n=612 | 1552 → 1286 | 17% | 91 / 457 / 812 | 66% (60–71) n=316 | 39% (33–46) n=186 | 41% (36–46) n=373 |
| Pepe Najarro: Working Doubles | played | 1336 | 44% (40–47) n=933 | 2201 → 1317 | 40% | 466 / 434 / 436 | 54% (49–59) n=392 | 38% (33–44) n=315 | 37% (32–42) n=415 |
| Valentino Street Racer | played | 1328 | 43% (40–47) n=913 | 2324 → 1233 | 47% | 241 / 715 / 372 | 51% (46–56) n=365 | 35% (30–41) n=265 | 41% (37–46) n=451 |
| Synapse Burnout | sold | 1305 | 43% (40–46) n=904 | 1879 → 1305 | 31% | 521 / 423 / 361 | 52% (47–57) n=422 | 36% (31–42) n=292 | 37% (33–42) n=391 |
| Valentino Street Racer | attacked | 1298 | 48% (44–52) n=685 | 1727 → 1131 | 35% | 18 / 382 / 898 | 65% (60–70) n=345 | 57% (50–65) n=164 | 37% (32–42) n=388 |
| Field Operator | played | 1237 | 43% (39–46) n=869 | 2619 → 1165 | 56% | 137 / 686 / 414 | 52% (47–57) n=391 | 30% (24–37) n=216 | 40% (35–44) n=419 |
| Field Operator | attacked | 1205 | 46% (42–50) n=644 | 1565 → 1037 | 34% | 10 / 301 / 894 | 70% (64–75) n=258 | 65% (57–72) n=161 | 36% (32–41) n=426 |
| Padre: Man of the Cross | ability | 1122 | 36% (32–39) n=773 | 4592 → 1122 | 76% | 8 / 270 / 844 | 52% (48–57) n=426 | 16% (11–23) n=137 | 16% (13–20) n=393 |
| Wakako Okada: Peace and Harmony | ability | 1114 | 38% (35–42) n=777 | 4530 → 1114 | 75% | 9 / 255 / 850 | 58% (53–62) n=440 | 16% (11–24) n=134 | 17% (13–21) n=373 |
| Adam Smasher: Ender of Legends | attacked | 1063 | 45% (42–49) n=807 | 1100 → 1063 | 3% | 0 / 0 / 1063 | 82% (76–86) n=260 | 75% (68–82) n=155 | 25% (21–29) n=510 |
| Mantis Blades | sold | 977 | 44% (40–47) n=752 | 1440 → 977 | 32% | 529 / 186 / 262 | 51% (46–57) n=321 | 43% (37–48) n=310 | 34% (29–40) n=242 |

(30 more card uses in the JSON report.)

Legal but never taken: Adam Smasher: Ender of Legends (Legend play, legal in 844 turns).

| Decision type | Decisions | First-listed option taken | Options offered (1 / 2 / 3–5 / 6–10 / 11–20 / 21+) |
|---|---|---|---|
| main | 34146 | 8% | 0 / 1924 / 8453 / 12449 / 10693 / 627 |
| gig/steal | 6756 | 29% | 202 / 954 / 3043 / 2513 / 44 / 0 |
| gig/rollIn | 4800 | 0% | 0 / 1200 / 3600 / 0 / 0 / 0 |
| mode/mode | 2941 | 76% | 0 / 2348 / 593 / 0 / 0 / 0 |
| react | 2001 | 23% | 0 / 1221 / 757 / 23 / 0 / 0 |
| gigValue/adjust | 1618 | 11% | 0 / 0 / 3 / 91 / 859 / 665 |
| unit/spend | 1227 | 63% | 490 / 373 / 358 / 6 / 0 / 0 |
| unit/adrenaline | 1219 | 56% | 492 / 373 / 348 / 6 / 0 / 0 |
| unit/weaken | 1212 | 60% | 364 / 379 / 448 / 21 / 0 / 0 |
| mulligan | 1200 | 6% | 0 / 1200 / 0 / 0 / 0 / 0 |
| gigValue/setGig | 1099 | 9% | 1 / 3 / 17 / 104 / 341 / 633 |
| unit/equip | 1024 | 88% | 31 / 264 / 556 / 173 / 0 / 0 |
| unit/defeat | 808 | 33% | 35 / 108 / 586 / 79 / 0 / 0 |
| card/freePlay | 471 | 86% | 0 / 257 / 211 / 3 / 0 / 0 |
| unit/cantAttack | 342 | 49% | 67 / 143 / 129 / 3 / 0 / 0 |
| card/playFree | 281 | 92% | 0 / 181 / 99 / 1 / 0 / 0 |
| unit/ready | 175 | 100% | 0 / 175 / 0 / 0 / 0 / 0 |
| card/discard | 163 | 60% | 37 / 54 / 71 / 1 / 0 / 0 |
| unit/sacrifice | 94 | 77% | 50 / 20 / 24 / 0 / 0 / 0 |
| unit/call | 91 | 100% | 0 / 47 / 44 / 0 / 0 / 0 |
| unit/pump | 61 | 48% | 6 / 15 / 36 / 4 / 0 / 0 |
| card/defeat | 45 | 98% | 43 / 2 / 0 / 0 / 0 / 0 |
| yesno/draw | 20 | 100% | 0 / 20 / 0 / 0 / 0 / 0 |
| mode/rivalChoice | 1 | 0% | 0 / 1 / 0 / 0 / 0 / 0 |

Reaction windows: 1771 attacks. Reacted to 1462 (deck won 37% (34–41) n=947): stole 761, stoleNothing 10, attackerGone 58, targetGone 588, bothGone 43, noneGone 2. Let 309 resolve (39% (32–47) n=169): stole 266, targetGone 42, bothGone 1. Choices: call 1041, endReact 462, block 379, play 119.

## RRB Wakako Midrange — 1200 games, 37% won, 56701 decisions

| Card | Use | Uses | Win rate in games used (95%) | Legal turns → used | Not chosen | Early / mid / late uses | Ahead | Even | Behind |
|---|---|---|---|---|---|---|---|---|---|
| 6th Street Recruits | attacked | 2133 | 40% (36–43) n=760 | 2355 → 1886 | 20% | 167 / 805 / 1161 | 61% (56–66) n=330 | 41% (35–47) n=276 | 36% (32–40) n=557 |
| Psycho Squad | attacked | 1406 | 44% (40–48) n=568 | 1649 → 1320 | 20% | 103 / 532 / 771 | 63% (57–69) n=251 | 46% (39–53) n=180 | 41% (37–46) n=422 |
| Yorinobu Arasaka: Steel Dragon | attacked | 1273 | 48% (44–52) n=619 | 1218 → 1146 | 6% | 0 / 0 / 1273 | 80% (75–84) n=249 | 75% (67–81) n=131 | 38% (33–42) n=454 |
| Wakako Okada: Peace and Harmony | ability | 1247 | 32% (29–35) n=841 | 4230 → 1247 | 71% | 46 / 315 / 886 | 54% (50–59) n=435 | 16% (12–23) n=171 | 12% (9–15) n=435 |
| Jacked-In Voodoo Boy | played | 1199 | 32% (29–35) n=847 | 2007 → 1122 | 44% | 610 / 315 / 274 | 41% (37–46) n=454 | 19% (14–24) n=270 | 26% (21–31) n=257 |
| Dexter DeShawn: Off the Grid | ability | 1176 | 34% (31–37) n=813 | 4293 → 1176 | 73% | 34 / 289 / 853 | 56% (51–61) n=414 | 22% (17–29) n=179 | 14% (11–18) n=416 |
| 6th Street Recruits | played | 1153 | 37% (34–41) n=834 | 1752 → 1142 | 35% | 586 / 350 / 217 | 48% (43–53) n=379 | 28% (23–32) n=349 | 30% (25–35) n=279 |
| Detonate | sold | 1149 | 38% (35–42) n=836 | 1445 → 1149 | 20% | 678 / 258 / 213 | 48% (43–53) n=381 | 29% (24–34) n=331 | 35% (30–41) n=267 |
| Mantis Blades | sold | 1133 | 39% (35–42) n=836 | 1313 → 1133 | 14% | 635 / 233 / 265 | 50% (45–54) n=404 | 32% (27–37) n=298 | 33% (28–39) n=280 |
| Yorinobu Arasaka: Steel Dragon | played | 1110 | 41% (38–44) n=845 | 1374 → 1110 | 19% | 0 / 598 / 512 | 54% (48–59) n=289 | 40% (31–50) n=99 | 36% (32–40) n=552 |
| Floor It | sold | 880 | 38% (34–42) n=701 | 1727 → 880 | 49% | 321 / 318 / 241 | 48% (42–54) n=273 | 27% (22–33) n=243 | 38% (32–44) n=283 |
| Adam Smasher: Ender of Legends | called | 872 | 39% (36–42) n=872 | 872 → 872 | 0% | 417 / 287 / 168 | 48% (44–52) n=555 | 24% (18–31) n=165 | 22% (16–29) n=152 |
| Dexter DeShawn: Off the Grid | called | 866 | 41% (38–44) n=866 | 866 → 866 | 0% | 393 / 353 / 120 | 46% (42–51) n=512 | 25% (19–32) n=152 | 38% (32–45) n=202 |
| Wakako Okada: Peace and Harmony | called | 824 | 40% (37–44) n=824 | 824 → 824 | 0% | 382 / 330 / 112 | 45% (40–50) n=437 | 28% (22–34) n=191 | 42% (35–49) n=196 |
| Jacked-In Voodoo Boy | attacked | 823 | 39% (34–43) n=495 | 782 → 707 | 10% | 153 / 316 / 354 | 45% (39–52) n=255 | 38% (29–47) n=109 | 34% (28–39) n=271 |

(32 more card uses in the JSON report.)

Legal but never taken: Adam Smasher: Ender of Legends (Legend play, legal in 626 turns).

| Decision type | Decisions | First-listed option taken | Options offered (1 / 2 / 3–5 / 6–10 / 11–20 / 21+) |
|---|---|---|---|
| main | 30190 | 8% | 0 / 2527 / 8478 / 12721 / 6320 / 144 |
| gig/steal | 5459 | 28% | 271 / 696 / 2108 / 2361 / 23 / 0 |
| gig/rollIn | 4800 | 0% | 0 / 1200 / 3600 / 0 / 0 / 0 |
| gigValue/adjust | 3004 | 10% | 0 / 8 / 99 / 295 / 1826 / 776 |
| react | 2782 | 37% | 0 / 1962 / 807 / 13 / 0 / 0 |
| mode/mode | 2671 | 84% | 0 / 2336 / 335 / 0 / 0 / 0 |
| unit/defeat | 1403 | 69% | 597 / 328 / 453 / 25 / 0 / 0 |
| unit/weaken | 1217 | 73% | 510 / 409 / 288 / 10 / 0 / 0 |
| mulligan | 1200 | 17% | 0 / 1200 / 0 / 0 / 0 / 0 |
| unit/pump | 918 | 57% | 287 / 369 / 247 / 15 / 0 / 0 |
| card/playFree | 899 | 79% | 0 / 445 / 441 / 13 / 0 / 0 |
| unit/equip | 658 | 82% | 87 / 165 / 320 / 86 / 0 / 0 |
| card/freePlay | 475 | 80% | 0 / 202 / 259 / 14 / 0 / 0 |
| card/discard | 336 | 80% | 54 / 201 / 81 / 0 / 0 / 0 |
| unit/cantAttack | 221 | 68% | 118 / 63 / 40 / 0 / 0 / 0 |
| unit/bottomdeck | 210 | 47% | 39 / 59 / 109 / 3 / 0 / 0 |
| card/search | 95 | 52% | 0 / 35 / 51 / 9 / 0 / 0 |
| unit/sacrifice | 65 | 88% | 47 / 12 / 6 / 0 / 0 / 0 |
| unit/call | 52 | 100% | 0 / 14 / 38 / 0 / 0 / 0 |
| card/defeat | 21 | 90% | 16 / 4 / 1 / 0 / 0 / 0 |
| card/discardForNothing | 12 | 0% | 0 / 10 / 2 / 0 / 0 / 0 |
| yesno/draw | 10 | 100% | 0 / 10 / 0 / 0 / 0 / 0 |
| mode/rivalChoice | 3 | 0% | 0 / 3 / 0 / 0 / 0 / 0 |

Reaction windows: 2395 attacks. Reacted to 1606 (deck won 30% (27–33) n=946): stole 728, stoleNothing 9, attackerGone 69, targetGone 746, bothGone 54. Let 789 resolve (38% (33–42) n=428): stole 731, attackerGone 1, targetGone 41, bothGone 16. Choices: block 735, play 134, call 897, endReact 1016.

## RRG Dexter Midrange — 1200 games, 74% won, 54298 decisions

| Card | Use | Uses | Win rate in games used (95%) | Legal turns → used | Not chosen | Early / mid / late uses | Ahead | Even | Behind |
|---|---|---|---|---|---|---|---|---|---|
| 6th Street Recruits | attacked | 1937 | 78% (75–81) n=697 | 2187 → 1711 | 22% | 173 / 753 / 1011 | 91% (87–93) n=405 | 74% (69–80) n=243 | 75% (71–79) n=462 |
| Animals Wrecker | attacked | 1806 | 83% (80–85) n=692 | 1660 → 1590 | 4% | 0 / 462 / 1344 | 95% (93–97) n=409 | 90% (85–94) n=165 | 79% (75–82) n=484 |
| Pepe Najarro: Working Doubles | attacked | 1728 | 78% (74–81) n=683 | 2019 → 1555 | 23% | 143 / 645 / 940 | 92% (89–95) n=381 | 78% (72–83) n=214 | 73% (69–77) n=467 |
| Dexter DeShawn: Off the Grid | ability | 1254 | 71% (68–74) n=840 | 4224 → 1254 | 70% | 29 / 246 / 979 | 88% (85–90) n=561 | 44% (36–53) n=129 | 45% (39–50) n=316 |
| Yorinobu Arasaka: Steel Dragon | attacked | 1244 | 87% (84–89) n=668 | 1200 → 1122 | 6% | 0 / 0 / 1244 | 98% (96–99) n=383 | 94% (89–97) n=133 | 80% (76–84) n=397 |
| Detonate | sold | 1182 | 74% (71–77) n=850 | 1624 → 1182 | 27% | 592 / 319 / 271 | 81% (77–85) n=370 | 70% (65–75) n=308 | 70% (65–75) n=334 |
| Synapse Burnout | sold | 1172 | 73% (70–76) n=835 | 1617 → 1172 | 28% | 597 / 342 / 233 | 81% (77–85) n=362 | 64% (59–69) n=307 | 70% (65–74) n=334 |
| Animals Wrecker | played | 1092 | 78% (75–80) n=820 | 1469 → 1092 | 26% | 0 / 773 / 319 | 86% (81–90) n=251 | 80% (73–85) n=167 | 74% (70–77) n=508 |
| Yorinobu Arasaka: Steel Dragon | played | 1081 | 80% (77–82) n=815 | 1395 → 1081 | 23% | 0 / 569 / 512 | 93% (89–96) n=235 | 81% (73–88) n=108 | 75% (71–78) n=561 |
| 6th Street Recruits | played | 1060 | 76% (72–78) n=786 | 1938 → 1052 | 46% | 628 / 199 / 233 | 86% (82–89) n=375 | 70% (65–75) n=339 | 66% (60–72) n=208 |
| Mantis Blades | sold | 994 | 76% (73–79) n=761 | 1254 → 994 | 21% | 544 / 208 / 242 | 82% (78–86) n=329 | 70% (65–75) n=275 | 74% (69–79) n=285 |
| Pepe Najarro: Working Doubles | played | 976 | 74% (71–77) n=754 | 1882 → 965 | 49% | 557 / 198 / 221 | 84% (80–87) n=368 | 66% (60–71) n=308 | 67% (60–73) n=199 |
| Peace Offering | sold | 949 | 76% (73–79) n=729 | 2119 → 949 | 55% | 294 / 405 / 250 | 88% (84–92) n=254 | 72% (66–78) n=205 | 73% (68–77) n=388 |
| Dexter DeShawn: Off the Grid | called | 926 | 76% (73–79) n=926 | 926 → 926 | 0% | 539 / 259 / 128 | 83% (80–86) n=570 | 64% (57–71) n=157 | 66% (60–73) n=199 |
| Saburo Arasaka: Stubborn Patriarch | called | 924 | 76% (73–79) n=924 | 924 → 924 | 0% | 517 / 232 / 175 | 83% (80–86) n=605 | 63% (55–70) n=145 | 63% (56–70) n=174 |

(28 more card uses in the JSON report.)

Legal but never taken: Adam Smasher: Ender of Legends (Legend play, legal in 758 turns), Synapse Burnout (played, legal in 1688 turns).

| Decision type | Decisions | First-listed option taken | Options offered (1 / 2 / 3–5 / 6–10 / 11–20 / 21+) |
|---|---|---|---|
| main | 29944 | 8% | 0 / 2457 / 8273 / 11859 / 7069 / 286 |
| gig/steal | 8081 | 28% | 362 / 984 / 3823 / 2899 / 13 / 0 |
| gig/rollIn | 4800 | 0% | 0 / 1200 / 3600 / 0 / 0 / 0 |
| react | 2361 | 50% | 0 / 1752 / 594 / 15 / 0 / 0 |
| gigValue/adjust | 1924 | 11% | 0 / 7 / 72 / 135 / 1035 / 675 |
| unit/defeat | 1490 | 58% | 442 / 432 / 587 / 29 / 0 / 0 |
| mulligan | 1200 | 14% | 0 / 1200 / 0 / 0 / 0 / 0 |
| mode/mode | 1149 | 66% | 0 / 1149 / 0 / 0 / 0 / 0 |
| card/playFree | 960 | 78% | 0 / 357 / 583 / 20 / 0 / 0 |
| unit/pump | 870 | 63% | 356 / 259 / 239 / 16 / 0 / 0 |
| unit/equip | 571 | 86% | 61 / 177 / 264 / 69 / 0 / 0 |
| card/discard | 223 | 62% | 68 / 79 / 75 / 1 / 0 / 0 |
| unit/ready | 200 | 100% | 0 / 200 / 0 / 0 / 0 / 0 |
| gigValue/setGig | 199 | 8% | 0 / 0 / 9 / 37 / 49 / 104 |
| card/search | 164 | 57% | 0 / 59 / 94 / 11 / 0 / 0 |
| unit/sacrifice | 121 | 83% | 78 / 24 / 18 / 1 / 0 / 0 |
| card/defeat | 23 | 100% | 22 / 1 / 0 / 0 / 0 / 0 |
| yesno/draw | 14 | 100% | 0 / 14 / 0 / 0 / 0 / 0 |
| mode/rivalChoice | 4 | 0% | 0 / 4 / 0 / 0 / 0 / 0 |

Reaction windows: 2108 attacks. Reacted to 1132 (deck won 69% (65–72) n=763): stole 546, attackerGone 81, targetGone 442, bothGone 62, noneGone 1. Let 976 resolve (77% (73–80) n=486): stole 891, attackerGone 2, targetGone 65, bothGone 18. Choices: call 721, endReact 1176, block 423, play 41.

## RRY Smasher Aggro — 1200 games, 57% won, 50402 decisions

| Card | Use | Uses | Win rate in games used (95%) | Legal turns → used | Not chosen | Early / mid / late uses | Ahead | Even | Behind |
|---|---|---|---|---|---|---|---|---|---|
| Rockn' Rockerboy | attacked | 1591 | 65% (61–68) n=605 | 1654 → 1464 | 11% | 0 / 697 / 894 | 78% (73–81) n=396 | 71% (64–78) n=159 | 60% (55–65) n=353 |
| Animals Wrecker | attacked | 1482 | 70% (66–73) n=613 | 1369 → 1326 | 3% | 0 / 371 / 1111 | 88% (84–92) n=301 | 80% (73–85) n=158 | 63% (58–67) n=419 |
| 6th Street Recruits | attacked | 1283 | 61% (57–64) n=578 | 1444 → 1187 | 18% | 175 / 427 / 681 | 80% (74–84) n=274 | 55% (49–62) n=221 | 54% (48–59) n=327 |
| Detonate | sold | 989 | 58% (54–61) n=757 | 1239 → 989 | 20% | 566 / 194 / 229 | 69% (65–74) n=394 | 51% (45–57) n=267 | 48% (42–55) n=211 |
| Animals Wrecker | played | 974 | 62% (59–66) n=746 | 1256 → 974 | 22% | 0 / 689 / 285 | 69% (63–74) n=273 | 61% (53–69) n=134 | 57% (53–62) n=438 |
| La Llorona: Ghost of the Past | played | 947 | 57% (53–60) n=733 | 2693 → 904 | 66% | 163 / 318 / 466 | 75% (70–80) n=297 | 48% (42–55) n=216 | 46% (41–52) n=306 |
| Zetatech Faceplate | sold | 940 | 54% (51–58) n=718 | 1752 → 940 | 46% | 298 / 364 / 278 | 61% (56–66) n=313 | 55% (48–61) n=221 | 48% (43–54) n=312 |
| Mantis Blades | sold | 933 | 57% (53–61) n=730 | 1055 → 933 | 12% | 534 / 169 / 230 | 63% (58–68) n=359 | 53% (47–59) n=284 | 49% (42–56) n=201 |
| V: Streetkid | attacked | 931 | 46% (43–50) n=614 | 1071 → 931 | 13% | 122 / 188 / 621 | 60% (55–65) n=345 | 51% (42–60) n=119 | 33% (28–39) n=264 |
| Rockn' Rockerboy | played | 929 | 60% (56–63) n=718 | 1686 → 929 | 45% | 444 / 233 / 252 | 72% (67–76) n=359 | 55% (49–61) n=256 | 41% (35–48) n=221 |
| 6th Street Recruits | played | 902 | 59% (56–63) n=697 | 1974 → 893 | 55% | 445 / 226 / 231 | 67% (61–71) n=336 | 54% (49–60) n=299 | 51% (44–59) n=169 |
| Bonnie and Clyde | sold | 861 | 57% (53–61) n=675 | 2658 → 861 | 68% | 128 / 365 / 368 | 63% (57–69) n=273 | 60% (51–67) n=141 | 51% (46–56) n=338 |
| Meredith Stout: Stone Cold Corpo | played | 847 | 55% (51–59) n=647 | 2899 → 806 | 72% | 185 / 221 / 441 | 70% (64–76) n=233 | 54% (47–61) n=207 | 42% (37–48) n=284 |
| V: Streetkid | called | 836 | 55% (52–59) n=836 | 836 → 836 | 0% | 335 / 309 / 192 | 60% (56–64) n=555 | 40% (32–48) n=133 | 50% (42–58) n=148 |
| Dum Dum: Maelstrom Triggerman | called | 836 | 58% (55–61) n=836 | 836 → 836 | 0% | 310 / 328 / 198 | 66% (62–70) n=548 | 44% (35–53) n=119 | 43% (35–50) n=169 |

(37 more card uses in the JSON report.)

Legal but never taken: V: Streetkid (Legend play, legal in 2318 turns), Adam Smasher: Ender of Legends (Legend play, legal in 587 turns).

| Decision type | Decisions | First-listed option taken | Options offered (1 / 2 / 3–5 / 6–10 / 11–20 / 21+) |
|---|---|---|---|
| main | 28997 | 7% | 0 / 2489 / 7405 / 10082 / 8692 / 329 |
| gig/steal | 6795 | 28% | 368 / 1003 / 3036 / 2360 / 28 / 0 |
| gig/rollIn | 4800 | 0% | 0 / 1200 / 3600 / 0 / 0 / 0 |
| react | 3470 | 52% | 0 / 2195 / 1263 / 12 / 0 / 0 |
| unit/defeat | 1738 | 67% | 690 / 473 / 545 / 30 / 0 / 0 |
| mulligan | 1200 | 27% | 0 / 1200 / 0 / 0 / 0 / 0 |
| card/search | 1068 | 72% | 531 / 246 / 243 / 45 / 3 / 0 |
| gigValue/adjust | 1054 | 8% | 0 / 14 / 104 / 41 / 314 / 581 |
| unit/pump | 516 | 46% | 155 / 134 / 216 / 11 / 0 / 0 |
| unit/equip | 237 | 84% | 46 / 65 / 114 / 12 / 0 / 0 |
| card/discard | 190 | 47% | 37 / 40 / 110 / 3 / 0 / 0 |
| unit/spend | 146 | 84% | 81 / 45 / 20 / 0 / 0 / 0 |
| unit/sacrifice | 117 | 78% | 68 / 25 / 24 / 0 / 0 / 0 |
| card/defeatGear | 42 | 95% | 0 / 36 / 6 / 0 / 0 / 0 |
| yesno/draw | 20 | 100% | 0 / 20 / 0 / 0 / 0 / 0 |
| card/defeat | 9 | 89% | 5 / 4 / 0 / 0 / 0 / 0 |
| mode/rivalChoice | 3 | 0% | 0 / 3 / 0 / 0 / 0 / 0 |

Reaction windows: 2958 attacks. Reacted to 1540 (deck won 53% (50–56) n=920): stole 544, attackerGone 37, targetGone 892, bothGone 67. Let 1418 resolve (55% (51–59) n=620): stole 1168, attackerGone 4, targetGone 194, bothGone 52. Choices: call 879, endReact 1794, block 791, play 2, ability 4.

## YYB Rogue Gear — 1200 games, 50% won, 55828 decisions

| Card | Use | Uses | Win rate in games used (95%) | Legal turns → used | Not chosen | Early / mid / late uses | Ahead | Even | Behind |
|---|---|---|---|---|---|---|---|---|---|
| V: Corporate Exile | attacked | 2473 | 49% (46–52) n=1099 | 2771 → 2473 | 11% | 261 / 847 / 1365 | 58% (55–61) n=805 | 49% (43–55) n=264 | 37% (33–42) n=411 |
| Psycho Squad | attacked | 2013 | 57% (53–60) n=701 | 2130 → 1842 | 14% | 244 / 645 / 1124 | 65% (61–69) n=488 | 60% (55–65) n=333 | 49% (44–55) n=311 |
| Dying Night: V's Pistol | sold | 1235 | 49% (46–52) n=865 | 2391 → 1235 | 48% | 427 / 405 / 403 | 55% (51–60) n=502 | 47% (42–53) n=314 | 35% (29–41) n=237 |
| V: Corporate Exile | Go Solo (self-paid 1129) | 1129 | 49% (46–52) n=1129 | 1342 → 1129 | 16% | 279 / 460 / 390 | 55% (52–59) n=722 | 38% (31–45) n=164 | 36% (30–42) n=243 |
| Psycho Squad | played | 1123 | 54% (51–58) n=816 | 2062 → 1118 | 46% | 487 / 349 / 287 | 60% (56–65) n=469 | 55% (49–60) n=339 | 35% (28–43) n=143 |
| Zetatech Faceplate | sold | 1121 | 48% (44–51) n=816 | 3620 → 1121 | 69% | 145 / 382 / 594 | 57% (53–62) n=437 | 47% (41–54) n=196 | 32% (27–37) n=314 |
| The Heist | sold | 1091 | 49% (45–52) n=789 | 1853 → 1091 | 41% | 431 / 350 / 310 | 52% (47–57) n=452 | 47% (41–53) n=253 | 37% (31–43) n=231 |
| V: Corporate Exile | called | 1022 | 49% (46–52) n=1022 | 1022 → 1022 | 0% | 549 / 322 / 151 | 53% (49–57) n=720 | 34% (28–41) n=196 | 53% (43–62) n=106 |
| Trauma Team Operatives | attacked | 972 | 49% (44–53) n=513 | 939 → 879 | 6% | 0 / 102 / 870 | 69% (63–74) n=268 | 59% (51–68) n=123 | 30% (25–36) n=268 |
| Trauma Team Operatives | played | 956 | 47% (43–50) n=720 | 2152 → 923 | 57% | 9 / 336 / 611 | 58% (54–63) n=461 | 39% (29–50) n=87 | 23% (19–29) n=252 |
| River Ward: Detective on the Hunt | called | 951 | 50% (47–53) n=951 | 951 → 951 | 0% | 456 / 310 / 185 | 56% (52–59) n=709 | 34% (27–41) n=174 | 31% (21–43) n=68 |
| Viktor Vektor: Sit Down and Relax | called | 928 | 50% (47–53) n=928 | 928 → 928 | 0% | 447 / 305 / 176 | 53% (50–57) n=666 | 41% (34–48) n=187 | 44% (33–55) n=75 |
| Dexter DeShawn: One Last Chance | attacked | 912 | 52% (47–57) n=444 | 1159 → 873 | 25% | 79 / 323 / 510 | 62% (56–67) n=273 | 58% (50–66) n=150 | 39% (32–46) n=193 |
| River Ward: Detective on the Hunt | ability | 906 | 47% (43–51) n=609 | 4154 → 906 | 78% | 83 / 146 / 677 | 62% (57–66) n=412 | 21% (15–29) n=135 | 16% (12–22) n=194 |
| Modded Kusanagi | played | 890 | 41% (37–45) n=548 | 2334 → 890 | 62% | 0 / 105 / 785 | 59% (53–65) n=263 | 50% (41–60) n=109 | 18% (14–23) n=328 |

(35 more card uses in the JSON report.)

Legal but never taken: V: Corporate Exile (Legend play, legal in 1342 turns).

| Decision type | Decisions | First-listed option taken | Options offered (1 / 2 / 3–5 / 6–10 / 11–20 / 21+) |
|---|---|---|---|
| main | 31648 | 8% | 0 / 2789 / 7806 / 12981 / 7677 / 395 |
| gig/steal | 6806 | 41% | 1005 / 1468 / 2407 / 1896 / 30 / 0 |
| gig/rollIn | 4800 | 100% | 0 / 1200 / 3600 / 0 / 0 / 0 |
| react | 3974 | 61% | 0 / 3058 / 913 / 3 / 0 / 0 |
| gigValue/adjust | 2754 | 9% | 0 / 0 / 167 / 565 / 1668 / 354 |
| unit/equip | 1807 | 78% | 240 / 477 / 992 / 98 / 0 / 0 |
| card/search | 1435 | 84% | 27 / 876 / 532 / 0 / 0 / 0 |
| mulligan | 1200 | 18% | 0 / 1200 / 0 / 0 / 0 / 0 |
| card/trash | 437 | 55% | 0 / 437 / 0 / 0 / 0 / 0 |
| card/playFree | 399 | 93% | 287 / 101 / 11 / 0 / 0 / 0 |
| unit/sacrifice | 326 | 38% | 72 / 118 / 134 / 2 / 0 / 0 |
| card/discard | 149 | 46% | 32 / 29 / 81 / 7 / 0 / 0 |
| yesno/playFree | 34 | 100% | 0 / 34 / 0 / 0 / 0 / 0 |
| unit/protect | 28 | 50% | 8 / 8 / 11 / 1 / 0 / 0 |
| mode/rivalChoice | 17 | 0% | 0 / 17 / 0 / 0 / 0 / 0 |
| yesno/draw | 14 | 100% | 0 / 14 / 0 / 0 / 0 / 0 |

Reaction windows: 3493 attacks. Reacted to 1418 (deck won 47% (44–50) n=904): stole 389, attackerGone 16, targetGone 938, bothGone 63, noneGone 12. Let 2075 resolve (42% (38–46) n=683): stole 1790, targetGone 257, bothGone 28. Choices: call 591, endReact 2414, block 845, play 43, ability 81.

## The bot’s own scores against outcomes (calibration check)

> Association only, like the rest of this report: the deciding side's win rate over its decisions, by the margin the bot claimed for its choice (its value minus the best other option's, in Gigs), and by whether the deep rollouts kept the 1-ply screen's top pick. A big claimed margin often comes in positions that are already won or lost, so a rising win rate is not proof the margins are right; a flat one says they carry little. Intervals use the game count (decisions in one game are not independent); under 20 games a cell shows only its counts.

| Bot | Scores | Scored | <0 Gigs | 0–0.05 Gigs | 0.05–0.15 Gigs | 0.15–0.5 Gigs | 0.5–1 Gigs | 1+ Gigs |
|---|---|---|---|---|---|---|---|---|
| deep | main deep | 168456 | — | 50% (49–52) 68507 in 8384 games | 52% (51–53) 32131 in 8211 games | 54% (53–55) 22449 in 7892 games | 48% (46–49) 9064 in 5513 games | 54% (53–55) 36305 in 8277 games |
| deep | react 1ply | 20950 | 39% (26–53) 54 in 47 games | 38% (36–40) 5970 in 3730 games | 39% (36–42) 2123 in 1119 games | 44% (42–46) 4552 in 3527 games | 48% (45–51) 1706 in 1166 games | 47% (45–49) 6545 in 4027 games |

| Bot | Scores | Deep decisions | Rollouts kept the 1-ply pick | Rollouts overturned it | Overturned |
|---|---|---|---|---|---|
| deep | main deep | 168456 | 52% (51–54) 136293 in 8400 games | 50% (49–51) 32163 in 8251 games | 19% |
