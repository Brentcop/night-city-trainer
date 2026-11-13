# Decision telemetry

4200 games, 400507 decisions (telemetry schema 1). Sim v8, deep bot, seed 1.

> Descriptive association only: win rates in games where a card was used a given way, with 95% Wilson intervals. They are not the value of the card or of the choice (no counterfactual comparison yet; ROADMAP §5 steps 3 and 5). A slice from fewer than 20 games shows only its count ("thin").

Stages: early turns 1–4, middle turns 5–8, late turn 9+. Ahead / even / behind: the acting player's Gig count against the rival's when the decision was made. "Not chosen": share of the turns (attacks, for reactions) in which the use was legal but not taken.

Measured: games 4200, recordsPerGame 95.4, rawBytesPerGame 62917.0, aggregateBytesPerGame 13336.6, mergedBytes 146108, seconds 441.9.

## BBG Cunningham Econ — 1200 games, 53% won, 61052 decisions

| Card | Use | Uses | Win rate in games used (95%) | Legal turns → used | Not chosen | Early / mid / late uses | Ahead | Even | Behind |
|---|---|---|---|---|---|---|---|---|---|
| Jacked-In Voodoo Boy | attacked | 1701 | 55% (52–59) n=747 | 1593 → 1409 | 12% | 184 / 514 / 1003 | 67% (63–71) n=514 | 56% (50–63) n=231 | 37% (32–42) n=326 |
| Jacked-In Voodoo Boy | played | 1631 | 53% (50–56) n=1015 | 2359 → 1490 | 37% | 644 / 484 / 503 | 63% (59–66) n=684 | 42% (36–47) n=306 | 30% (24–36) n=220 |
| Psycho Squad | attacked | 1567 | 56% (52–60) n=647 | 1693 → 1468 | 13% | 150 / 621 / 796 | 70% (66–75) n=387 | 57% (51–63) n=243 | 47% (42–52) n=342 |
| Pepe Najarro: Working Doubles | attacked | 1534 | 57% (53–61) n=646 | 1702 → 1456 | 14% | 150 / 609 / 775 | 73% (69–78) n=380 | 59% (53–65) n=241 | 44% (39–49) n=323 |
| Alt Cunningham: Soulkiller Architect | ability | 1457 | 48% (45–52) n=902 | 3925 → 1432 | 64% | 19 / 353 / 1085 | 65% (61–69) n=559 | 46% (38–53) n=156 | 19% (16–23) n=431 |
| Peace Offering | sold | 1249 | 51% (48–55) n=876 | 1805 → 1249 | 31% | 548 / 311 / 390 | 58% (53–62) n=478 | 48% (42–53) n=325 | 36% (30–42) n=242 |
| Floor It | sold | 1144 | 53% (49–56) n=855 | 1733 → 1144 | 34% | 496 / 289 / 359 | 63% (58–67) n=459 | 49% (44–55) n=305 | 38% (32–45) n=220 |
| Hanako Arasaka: Daughter of the Emperor | ability | 1133 | 43% (39–47) n=750 | 3764 → 1133 | 70% | 18 / 296 / 819 | 60% (55–64) n=443 | 28% (21–37) n=127 | 15% (12–19) n=363 |
| Chrome Reverie | sold | 1111 | 53% (49–56) n=817 | 1894 → 1111 | 41% | 481 / 316 / 314 | 59% (54–63) n=467 | 53% (47–59) n=252 | 39% (33–45) n=254 |
| Trust No One | sold | 1039 | 54% (51–58) n=781 | 1540 → 1039 | 33% | 427 / 292 / 320 | 66% (61–70) n=387 | 51% (45–57) n=304 | 38% (32–45) n=211 |
| Psycho Squad | played | 1003 | 54% (51–58) n=794 | 1465 → 999 | 32% | 381 / 318 / 304 | 63% (58–67) n=447 | 53% (47–59) n=258 | 35% (28–42) n=179 |
| Pepe Najarro: Working Doubles | played | 998 | 56% (52–59) n=792 | 1548 → 987 | 36% | 378 / 310 / 310 | 65% (61–70) n=455 | 49% (44–55) n=279 | 33% (26–41) n=169 |
| Mox Inciters | played | 958 | 52% (48–55) n=778 | 2085 → 914 | 56% | 145 / 415 / 398 | 62% (58–67) n=425 | 46% (39–53) n=195 | 33% (27–39) n=239 |
| Jackie Welles: Pour One Out For Me | called | 907 | 55% (52–59) n=907 | 907 → 907 | 0% | 303 / 478 / 126 | 60% (56–64) n=684 | 49% (41–57) n=143 | 28% (19–38) n=80 |
| Hanako Arasaka: Daughter of the Emperor | called | 903 | 53% (50–57) n=903 | 903 → 903 | 0% | 326 / 444 / 133 | 60% (56–63) n=652 | 39% (31–47) n=149 | 36% (28–46) n=102 |

(28 more card uses in the JSON report.)

| Decision type | Decisions | First-listed option taken | Options offered (1 / 2 / 3–5 / 6–10 / 11–20 / 21+) |
|---|---|---|---|
| main | 30385 | 6% | 0 / 2536 / 7599 / 12716 / 7289 / 245 |
| gig/steal | 5423 | 34% | 396 / 1171 / 2483 / 1361 / 12 / 0 |
| gig/rollIn | 4800 | 100% | 0 / 1200 / 3600 / 0 / 0 / 0 |
| gigValue/adjust | 2830 | 21% | 0 / 84 / 697 / 1194 / 757 / 98 |
| react | 2492 | 34% | 0 / 1761 / 729 / 2 / 0 / 0 |
| card/search | 2396 | 58% | 0 / 517 / 1879 / 0 / 0 / 0 |
| unit/bottomdeck | 2317 | 79% | 1558 / 388 / 365 / 6 / 0 / 0 |
| card/discard | 1717 | 52% | 270 / 650 / 741 / 56 / 0 / 0 |
| mulligan | 1200 | 22% | 0 / 1200 / 0 / 0 / 0 / 0 |
| gig/swapGive | 1133 | 42% | 47 / 79 / 553 / 454 / 0 / 0 |
| gig/swapTake | 1133 | 24% | 73 / 119 / 514 / 404 / 23 / 0 |
| card/playFromTrash | 1025 | 63% | 443 / 320 / 236 / 26 / 0 / 0 |
| unit/mustAttack | 790 | 64% | 333 / 282 / 173 / 2 / 0 / 0 |
| unit/ready | 706 | 100% | 0 / 473 / 233 / 0 / 0 / 0 |
| card/freePlay | 591 | 65% | 0 / 193 / 332 / 66 / 0 / 0 |
| yesno/discardFor | 584 | 99% | 0 / 584 / 0 / 0 / 0 / 0 |
| unit/weaken | 581 | 71% | 231 / 185 / 159 / 6 / 0 / 0 |
| unit/cantAttack | 275 | 63% | 93 / 100 / 81 / 1 / 0 / 0 |
| mode/mode | 262 | 91% | 0 / 26 / 236 / 0 / 0 / 0 |
| gigValue/setGig | 197 | 21% | 0 / 4 / 13 / 10 / 24 / 146 |
| unit/sacrifice | 90 | 96% | 66 / 15 / 8 / 1 / 0 / 0 |
| unit/call | 78 | 100% | 0 / 36 / 42 / 0 / 0 / 0 |
| card/discardForNothing | 35 | 0% | 0 / 9 / 21 / 5 / 0 / 0 |
| yesno/draw | 11 | 100% | 0 / 11 / 0 / 0 / 0 / 0 |
| mode/rivalChoice | 1 | 0% | 0 / 1 / 0 / 0 / 0 / 0 |

Reaction windows: 2157 attacks. Reacted to 1523 (deck won 48% (45–52) n=921): stole 576, attackerGone 7, targetGone 911, bothGone 29. Let 634 resolve (54% (49–59) n=363): stole 575, stoleNothing 3, attackerGone 1, targetGone 42, bothGone 13. Choices: endReact 838, call 744, block 791, play 119.

## GRY Trauma Team — 1200 games, 38% won, 59878 decisions

| Card | Use | Uses | Win rate in games used (95%) | Legal turns → used | Not chosen | Early / mid / late uses | Ahead | Even | Behind |
|---|---|---|---|---|---|---|---|---|---|
| Pepe Najarro: Working Doubles | attacked | 1746 | 40% (37–44) n=694 | 1998 → 1584 | 21% | 169 / 593 / 984 | 60% (55–65) n=345 | 47% (41–53) n=276 | 31% (27–35) n=456 |
| 6th Street Recruits | attacked | 1651 | 44% (40–47) n=677 | 1881 → 1511 | 20% | 142 / 573 / 936 | 65% (60–70) n=326 | 48% (42–54) n=244 | 32% (28–36) n=426 |
| V: Streetkid | attacked | 1619 | 34% (32–37) n=991 | 1985 → 1619 | 18% | 148 / 385 / 1086 | 49% (44–53) n=477 | 53% (46–60) n=182 | 20% (17–24) n=558 |
| Padre: Man of the Cross | ability | 1368 | 34% (31–37) n=887 | 4261 → 1368 | 68% | 9 / 255 / 1104 | 56% (52–61) n=465 | 17% (12–24) n=163 | 11% (9–14) n=478 |
| Muamar Reyes: El Capitán | ability | 1338 | 34% (31–37) n=863 | 4249 → 1338 | 69% | 23 / 269 / 1046 | 54% (50–59) n=487 | 19% (14–26) n=168 | 9% (7–12) n=437 |
| Johnny Silverhand: Never Stop Fighting | attacked | 1260 | 59% (54–63) n=430 | 880 → 800 | 9% | 0 / 248 / 1012 | 78% (72–83) n=253 | 78% (70–85) n=106 | 43% (37–50) n=240 |
| Pepe Najarro: Working Doubles | played | 1241 | 39% (36–43) n=876 | 2177 → 1225 | 44% | 526 / 255 / 460 | 52% (47–57) n=380 | 37% (32–42) n=359 | 25% (20–30) n=328 |
| Augmented Negotiators | played | 1223 | 37% (34–40) n=871 | 2868 → 1168 | 59% | 194 / 459 / 570 | 53% (48–58) n=360 | 33% (28–39) n=251 | 27% (23–31) n=424 |
| Meredith Stout: Stone Cold Corpo | played | 1212 | 40% (36–43) n=873 | 2936 → 1183 | 60% | 254 / 302 / 656 | 56% (50–61) n=318 | 38% (32–44) n=275 | 27% (23–32) n=435 |
| 6th Street Recruits | played | 1185 | 40% (37–44) n=837 | 2085 → 1171 | 44% | 482 / 266 / 437 | 51% (46–56) n=392 | 42% (37–47) n=308 | 26% (22–31) n=332 |
| Trauma Team Operatives | played | 1172 | 37% (34–41) n=850 | 2119 → 1118 | 47% | 45 / 482 / 645 | 51% (46–56) n=387 | 40% (32–48) n=141 | 25% (21–29) n=443 |
| Detonate | sold | 1146 | 36% (33–40) n=827 | 1628 → 1146 | 30% | 552 / 332 / 262 | 42% (37–47) n=412 | 35% (30–41) n=288 | 27% (23–33) n=288 |
| Trauma Team Operatives | attacked | 1109 | 41% (37–45) n=580 | 1129 → 995 | 12% | 0 / 194 / 915 | 65% (59–71) n=251 | 61% (52–69) n=125 | 27% (23–32) n=357 |
| The Heist | sold | 1101 | 38% (34–41) n=807 | 2228 → 1101 | 51% | 332 / 439 / 330 | 43% (38–48) n=394 | 41% (35–48) n=240 | 28% (23–33) n=334 |
| All is Lost | sold | 1051 | 39% (36–43) n=779 | 1528 → 1051 | 31% | 507 / 298 / 246 | 43% (38–49) n=325 | 41% (36–47) n=304 | 32% (27–38) n=269 |

(29 more card uses in the JSON report.)

Legal but never taken: V: Streetkid (Legend play, legal in 2224 turns).

| Decision type | Decisions | First-listed option taken | Options offered (1 / 2 / 3–5 / 6–10 / 11–20 / 21+) |
|---|---|---|---|
| main | 33574 | 9% | 0 / 2029 / 7352 / 11647 / 11773 / 773 |
| gig/steal | 6134 | 29% | 336 / 940 / 2589 / 2227 / 42 / 0 |
| gig/rollIn | 4800 | 0% | 0 / 1200 / 3600 / 0 / 0 / 0 |
| react | 3778 | 39% | 0 / 2416 / 1351 / 11 / 0 / 0 |
| gigValue/adjust | 2233 | 12% | 0 / 0 / 12 / 161 / 1271 / 789 |
| gigValue/setGig | 1625 | 8% | 0 / 1 / 9 / 114 / 417 / 1084 |
| unit/spend | 1427 | 60% | 498 / 380 / 531 / 18 / 0 / 0 |
| mulligan | 1200 | 11% | 0 / 1200 / 0 / 0 / 0 / 0 |
| mode/mode | 1172 | 65% | 0 / 1172 / 0 / 0 / 0 / 0 |
| mode/muamarCall | 1164 | 79% | 0 / 1164 / 0 / 0 / 0 / 0 |
| card/search | 1112 | 80% | 592 / 281 / 157 / 75 / 7 / 0 |
| unit/protect | 886 | 63% | 278 / 364 / 241 / 3 / 0 / 0 |
| unit/equip | 359 | 87% | 98 / 119 / 123 / 19 / 0 / 0 |
| unit/ready | 135 | 100% | 0 / 135 / 0 / 0 / 0 / 0 |
| unit/sacrifice | 103 | 80% | 45 / 28 / 30 / 0 / 0 / 0 |
| yesno/draw | 82 | 100% | 0 / 82 / 0 / 0 / 0 / 0 |
| card/defeat | 42 | 86% | 29 / 10 / 3 / 0 / 0 / 0 |
| card/discard | 40 | 38% | 4 / 5 / 26 / 5 / 0 / 0 |
| yesno/playFree | 8 | 100% | 0 / 8 / 0 / 0 / 0 / 0 |
| mode/rivalChoice | 4 | 0% | 0 / 4 / 0 / 0 / 0 / 0 |

Reaction windows: 3059 attacks. Reacted to 2050 (deck won 34% (31–37) n=1011): stole 766, attackerGone 34, targetGone 1085, bothGone 59, noneGone 106. Let 1009 resolve (43% (39–48) n=482): stole 915, attackerGone 4, targetGone 44, bothGone 46. Choices: call 1106, endReact 1478, block 1181, play 13.

## Rainbow Fixer Stuff — 1200 games, 41% won, 61608 decisions

| Card | Use | Uses | Win rate in games used (95%) | Legal turns → used | Not chosen | Early / mid / late uses | Ahead | Even | Behind |
|---|---|---|---|---|---|---|---|---|---|
| 6th Street Recruits | attacked | 2024 | 46% (43–50) n=813 | 2154 → 1806 | 16% | 134 / 719 / 1171 | 65% (60–69) n=414 | 42% (36–48) n=263 | 42% (37–46) n=508 |
| Pepe Najarro: Working Doubles | attacked | 1960 | 46% (42–49) n=773 | 2059 → 1762 | 14% | 120 / 680 / 1160 | 64% (59–68) n=402 | 48% (42–54) n=259 | 41% (37–45) n=489 |
| 6th Street Recruits | played | 1416 | 42% (39–46) n=961 | 2175 → 1398 | 36% | 515 / 452 / 449 | 52% (47–57) n=422 | 35% (30–41) n=333 | 38% (34–43) n=447 |
| Detonate | sold | 1366 | 42% (39–46) n=913 | 1932 → 1366 | 29% | 618 / 391 / 357 | 53% (48–58) n=431 | 35% (30–41) n=319 | 38% (33–43) n=391 |
| Pepe Najarro: Working Doubles | played | 1346 | 42% (39–45) n=934 | 2227 → 1327 | 40% | 465 / 438 / 443 | 51% (46–56) n=388 | 37% (31–42) n=317 | 36% (31–40) n=419 |
| Psycho Squad | attacked | 1320 | 46% (42–50) n=606 | 1518 → 1244 | 18% | 89 / 453 / 778 | 64% (58–69) n=318 | 40% (33–48) n=179 | 41% (36–46) n=364 |
| Valentino Street Racer | played | 1314 | 41% (37–44) n=904 | 2310 → 1219 | 47% | 246 / 715 / 353 | 47% (42–52) n=369 | 32% (27–38) n=254 | 39% (35–44) n=446 |
| Synapse Burnout | sold | 1303 | 41% (38–44) n=899 | 1876 → 1303 | 31% | 521 / 427 / 355 | 50% (45–55) n=412 | 35% (30–41) n=296 | 37% (32–42) n=389 |
| Valentino Street Racer | attacked | 1252 | 45% (41–48) n=669 | 1714 → 1098 | 36% | 19 / 368 / 865 | 63% (57–68) n=331 | 55% (47–63) n=143 | 33% (29–38) n=385 |
| Field Operator | played | 1237 | 41% (38–44) n=866 | 2634 → 1164 | 56% | 138 / 681 / 418 | 52% (47–57) n=386 | 28% (23–35) n=209 | 37% (33–42) n=419 |
| Field Operator | attacked | 1212 | 44% (40–47) n=650 | 1572 → 1040 | 34% | 10 / 297 / 905 | 68% (63–74) n=266 | 61% (53–69) n=152 | 34% (30–39) n=435 |
| Wakako Okada: Peace and Harmony | ability | 1139 | 35% (31–38) n=784 | 4505 → 1139 | 75% | 8 / 248 / 883 | 53% (49–58) n=444 | 17% (11–23) n=145 | 14% (11–18) n=380 |
| Padre: Man of the Cross | ability | 1138 | 34% (30–37) n=784 | 4561 → 1138 | 75% | 8 / 257 / 873 | 51% (46–55) n=428 | 15% (10–21) n=149 | 15% (12–19) n=392 |
| Adam Smasher: Ender of Legends | attacked | 1062 | 44% (41–48) n=801 | 1104 → 1062 | 4% | 0 / 0 / 1062 | 80% (75–85) n=261 | 72% (65–79) n=162 | 23% (19–27) n=493 |
| Mantis Blades | sold | 983 | 42% (38–45) n=750 | 1442 → 983 | 32% | 529 / 189 / 265 | 48% (43–54) n=321 | 42% (37–47) n=310 | 32% (27–38) n=246 |

(30 more card uses in the JSON report.)

Legal but never taken: Adam Smasher: Ender of Legends (Legend play, legal in 838 turns).

| Decision type | Decisions | First-listed option taken | Options offered (1 / 2 / 3–5 / 6–10 / 11–20 / 21+) |
|---|---|---|---|
| main | 33975 | 8% | 0 / 1875 / 8397 / 12378 / 10703 / 622 |
| gig/steal | 6701 | 28% | 202 / 955 / 3042 / 2450 / 52 / 0 |
| gig/rollIn | 4800 | 0% | 0 / 1200 / 3600 / 0 / 0 / 0 |
| mode/mode | 2926 | 76% | 0 / 2343 / 583 / 0 / 0 / 0 |
| react | 2022 | 23% | 0 / 1217 / 778 / 27 / 0 / 0 |
| gigValue/adjust | 1666 | 11% | 0 / 0 / 4 / 84 / 876 / 702 |
| unit/spend | 1229 | 61% | 476 / 377 / 370 / 6 / 0 / 0 |
| unit/weaken | 1217 | 60% | 376 / 391 / 434 / 16 / 0 / 0 |
| unit/adrenaline | 1209 | 56% | 497 / 361 / 343 / 8 / 0 / 0 |
| mulligan | 1200 | 6% | 0 / 1200 / 0 / 0 / 0 / 0 |
| gigValue/setGig | 1104 | 9% | 1 / 3 / 17 / 91 / 333 / 659 |
| unit/equip | 1019 | 88% | 34 / 261 / 551 / 173 / 0 / 0 |
| unit/defeat | 805 | 33% | 34 / 105 / 587 / 79 / 0 / 0 |
| card/freePlay | 462 | 86% | 0 / 251 / 208 / 3 / 0 / 0 |
| unit/cantAttack | 338 | 48% | 66 / 145 / 124 / 3 / 0 / 0 |
| card/playFree | 289 | 91% | 0 / 186 / 102 / 1 / 0 / 0 |
| card/discard | 169 | 60% | 40 / 52 / 76 / 1 / 0 / 0 |
| unit/ready | 165 | 100% | 0 / 165 / 0 / 0 / 0 / 0 |
| unit/sacrifice | 95 | 73% | 52 / 22 / 21 / 0 / 0 / 0 |
| unit/call | 92 | 100% | 0 / 46 / 46 / 0 / 0 / 0 |
| unit/pump | 60 | 53% | 7 / 15 / 34 / 4 / 0 / 0 |
| card/defeat | 44 | 98% | 41 / 3 / 0 / 0 / 0 / 0 |
| yesno/draw | 19 | 100% | 0 / 19 / 0 / 0 / 0 / 0 |
| mode/rivalChoice | 2 | 0% | 0 / 2 / 0 / 0 / 0 / 0 |

Reaction windows: 1778 attacks. Reacted to 1486 (deck won 36% (33–39) n=941): stole 781, stoleNothing 9, attackerGone 53, targetGone 596, bothGone 45, noneGone 2. Let 292 resolve (36% (29–43) n=166): stole 257, targetGone 31, bothGone 4. Choices: call 1066, endReact 460, block 386, play 110.

## RRB Wakako Midrange — 1200 games, 38% won, 56695 decisions

| Card | Use | Uses | Win rate in games used (95%) | Legal turns → used | Not chosen | Early / mid / late uses | Ahead | Even | Behind |
|---|---|---|---|---|---|---|---|---|---|
| 6th Street Recruits | attacked | 2152 | 41% (38–45) n=754 | 2360 → 1904 | 19% | 166 / 821 / 1165 | 62% (56–67) n=347 | 43% (37–48) n=282 | 38% (34–42) n=547 |
| Psycho Squad | attacked | 1421 | 45% (41–50) n=568 | 1647 → 1330 | 19% | 103 / 534 / 784 | 65% (59–71) n=257 | 46% (39–54) n=183 | 42% (38–47) n=422 |
| Yorinobu Arasaka: Steel Dragon | attacked | 1258 | 50% (46–54) n=623 | 1216 → 1141 | 6% | 0 / 0 / 1258 | 82% (77–86) n=253 | 74% (66–81) n=123 | 39% (34–43) n=455 |
| Wakako Okada: Peace and Harmony | ability | 1248 | 32% (29–36) n=830 | 4220 → 1248 | 70% | 42 / 312 / 894 | 55% (50–59) n=438 | 16% (11–22) n=164 | 12% (9–16) n=425 |
| Jacked-In Voodoo Boy | played | 1200 | 32% (29–36) n=847 | 2017 → 1123 | 44% | 611 / 313 / 276 | 42% (38–47) n=459 | 18% (14–23) n=272 | 26% (21–32) n=255 |
| Dexter DeShawn: Off the Grid | ability | 1179 | 35% (32–38) n=815 | 4292 → 1179 | 73% | 33 / 287 / 859 | 58% (53–62) n=419 | 21% (16–28) n=176 | 14% (11–18) n=412 |
| Detonate | sold | 1160 | 40% (37–43) n=838 | 1456 → 1160 | 20% | 678 / 257 / 225 | 49% (44–54) n=382 | 30% (25–35) n=334 | 36% (31–42) n=272 |
| 6th Street Recruits | played | 1148 | 38% (35–42) n=829 | 1756 → 1138 | 35% | 587 / 348 / 213 | 49% (44–54) n=379 | 28% (24–33) n=348 | 31% (26–37) n=277 |
| Mantis Blades | sold | 1130 | 39% (36–43) n=836 | 1312 → 1130 | 14% | 635 / 232 / 263 | 52% (47–57) n=402 | 31% (26–36) n=299 | 33% (28–39) n=284 |
| Yorinobu Arasaka: Steel Dragon | played | 1103 | 42% (39–45) n=841 | 1370 → 1103 | 19% | 0 / 595 / 508 | 53% (48–59) n=288 | 39% (31–49) n=109 | 37% (33–41) n=543 |
| Floor It | sold | 870 | 38% (35–42) n=699 | 1722 → 870 | 49% | 321 / 318 / 231 | 49% (43–54) n=272 | 27% (21–33) n=236 | 39% (33–45) n=282 |
| Adam Smasher: Ender of Legends | called | 867 | 40% (37–44) n=867 | 867 → 867 | 0% | 415 / 285 / 167 | 50% (46–54) n=557 | 23% (17–30) n=160 | 25% (19–33) n=150 |
| Dexter DeShawn: Off the Grid | called | 859 | 42% (39–45) n=859 | 859 → 859 | 0% | 392 / 353 / 114 | 48% (43–52) n=513 | 24% (18–32) n=147 | 40% (33–47) n=199 |
| Wakako Okada: Peace and Harmony | called | 831 | 40% (37–44) n=831 | 831 → 831 | 0% | 380 / 336 / 115 | 46% (41–50) n=448 | 28% (22–35) n=189 | 40% (33–47) n=194 |
| Satori: Sword of Saburo | sold | 826 | 37% (34–41) n=669 | 2184 → 826 | 62% | 242 / 347 / 237 | 50% (43–56) n=248 | 31% (24–38) n=177 | 33% (28–38) n=326 |

(32 more card uses in the JSON report.)

Legal but never taken: Adam Smasher: Ender of Legends (Legend play, legal in 622 turns).

| Decision type | Decisions | First-listed option taken | Options offered (1 / 2 / 3–5 / 6–10 / 11–20 / 21+) |
|---|---|---|---|
| main | 30131 | 8% | 0 / 2541 / 8474 / 12676 / 6290 / 150 |
| gig/steal | 5476 | 28% | 278 / 703 / 2134 / 2335 / 26 / 0 |
| gig/rollIn | 4800 | 0% | 0 / 1200 / 3600 / 0 / 0 / 0 |
| gigValue/adjust | 3005 | 10% | 0 / 8 / 97 / 282 / 1851 / 767 |
| react | 2801 | 36% | 0 / 1975 / 812 / 14 / 0 / 0 |
| mode/mode | 2664 | 84% | 0 / 2333 / 331 / 0 / 0 / 0 |
| unit/defeat | 1390 | 69% | 581 / 336 / 448 / 25 / 0 / 0 |
| unit/weaken | 1225 | 73% | 509 / 420 / 287 / 9 / 0 / 0 |
| mulligan | 1200 | 17% | 0 / 1200 / 0 / 0 / 0 / 0 |
| unit/pump | 921 | 57% | 292 / 373 / 244 / 12 / 0 / 0 |
| card/playFree | 895 | 78% | 0 / 440 / 445 / 10 / 0 / 0 |
| unit/equip | 641 | 82% | 88 / 164 / 308 / 81 / 0 / 0 |
| card/freePlay | 475 | 81% | 0 / 202 / 258 / 15 / 0 / 0 |
| card/discard | 341 | 80% | 45 / 209 / 87 / 0 / 0 / 0 |
| unit/cantAttack | 227 | 70% | 127 / 62 / 38 / 0 / 0 / 0 |
| unit/bottomdeck | 222 | 49% | 43 / 63 / 114 / 2 / 0 / 0 |
| card/search | 120 | 52% | 0 / 44 / 64 / 12 / 0 / 0 |
| unit/sacrifice | 63 | 94% | 45 / 9 / 9 / 0 / 0 / 0 |
| unit/call | 53 | 100% | 0 / 13 / 40 / 0 / 0 / 0 |
| card/defeat | 21 | 95% | 18 / 3 / 0 / 0 / 0 / 0 |
| yesno/draw | 11 | 100% | 0 / 11 / 0 / 0 / 0 / 0 |
| card/discardForNothing | 10 | 0% | 0 / 8 / 2 / 0 / 0 / 0 |
| mode/rivalChoice | 3 | 0% | 0 / 3 / 0 / 0 / 0 / 0 |

Reaction windows: 2406 attacks. Reacted to 1617 (deck won 30% (28–33) n=956): stole 729, stoleNothing 9, attackerGone 74, targetGone 749, bothGone 56. Let 789 resolve (38% (33–42) n=427): stole 736, targetGone 36, bothGone 17. Choices: block 743, play 138, call 902, endReact 1018.

## RRG Dexter Midrange — 1200 games, 74% won, 54488 decisions

| Card | Use | Uses | Win rate in games used (95%) | Legal turns → used | Not chosen | Early / mid / late uses | Ahead | Even | Behind |
|---|---|---|---|---|---|---|---|---|---|
| 6th Street Recruits | attacked | 1933 | 78% (75–81) n=699 | 2159 → 1722 | 20% | 177 / 763 / 993 | 91% (87–93) n=395 | 73% (67–78) n=250 | 75% (71–78) n=462 |
| Pepe Najarro: Working Doubles | attacked | 1778 | 77% (74–80) n=687 | 2045 → 1599 | 22% | 147 / 660 / 971 | 93% (90–95) n=383 | 75% (69–80) n=228 | 74% (70–78) n=464 |
| Animals Wrecker | attacked | 1775 | 82% (79–85) n=688 | 1634 → 1561 | 4% | 0 / 463 / 1312 | 95% (92–97) n=389 | 89% (83–93) n=161 | 79% (75–82) n=487 |
| Dexter DeShawn: Off the Grid | ability | 1267 | 70% (67–73) n=829 | 4257 → 1267 | 70% | 29 / 250 / 988 | 87% (84–89) n=569 | 41% (33–50) n=131 | 46% (41–51) n=324 |
| Yorinobu Arasaka: Steel Dragon | attacked | 1263 | 86% (83–88) n=669 | 1198 → 1138 | 5% | 0 / 0 / 1263 | 98% (96–99) n=373 | 93% (87–96) n=138 | 79% (75–83) n=399 |
| Detonate | sold | 1187 | 74% (71–77) n=853 | 1624 → 1187 | 27% | 592 / 323 / 272 | 82% (77–85) n=368 | 70% (65–75) n=310 | 69% (64–74) n=329 |
| Synapse Burnout | sold | 1167 | 72% (69–75) n=833 | 1608 → 1167 | 27% | 597 / 343 / 227 | 80% (76–84) n=358 | 64% (58–69) n=303 | 70% (65–75) n=342 |
| Yorinobu Arasaka: Steel Dragon | played | 1090 | 79% (76–82) n=819 | 1388 → 1090 | 21% | 0 / 574 / 516 | 93% (89–95) n=234 | 79% (71–86) n=115 | 74% (70–77) n=559 |
| Animals Wrecker | played | 1088 | 77% (74–79) n=820 | 1489 → 1088 | 27% | 0 / 761 / 327 | 86% (81–90) n=258 | 79% (72–84) n=168 | 72% (68–76) n=499 |
| 6th Street Recruits | played | 1059 | 75% (72–78) n=789 | 1945 → 1052 | 46% | 629 / 194 / 236 | 85% (81–88) n=373 | 70% (65–74) n=342 | 67% (61–73) n=209 |
| Mantis Blades | sold | 990 | 75% (72–78) n=753 | 1257 → 990 | 21% | 544 / 201 / 245 | 83% (78–86) n=334 | 68% (63–74) n=273 | 73% (68–78) n=275 |
| Pepe Najarro: Working Doubles | played | 973 | 74% (71–77) n=750 | 1872 → 965 | 48% | 557 / 208 / 208 | 85% (81–88) n=372 | 68% (62–73) n=308 | 66% (60–73) n=191 |
| Peace Offering | sold | 945 | 76% (73–79) n=722 | 2126 → 945 | 56% | 294 / 408 / 243 | 87% (82–90) n=259 | 69% (62–75) n=200 | 74% (69–78) n=379 |
| Dexter DeShawn: Off the Grid | called | 937 | 76% (73–78) n=937 | 937 → 937 | 0% | 542 / 269 / 126 | 81% (77–84) n=584 | 64% (56–71) n=161 | 70% (63–76) n=192 |
| Saburo Arasaka: Stubborn Patriarch | called | 932 | 76% (73–79) n=932 | 932 → 932 | 0% | 524 / 234 / 174 | 83% (79–85) n=614 | 62% (54–69) n=152 | 65% (58–72) n=166 |

(28 more card uses in the JSON report.)

Legal but never taken: Adam Smasher: Ender of Legends (Legend play, legal in 742 turns), Synapse Burnout (played, legal in 1678 turns).

| Decision type | Decisions | First-listed option taken | Options offered (1 / 2 / 3–5 / 6–10 / 11–20 / 21+) |
|---|---|---|---|
| main | 30013 | 8% | 0 / 2498 / 8298 / 11905 / 7030 / 282 |
| gig/steal | 8122 | 27% | 364 / 990 / 3849 / 2904 / 15 / 0 |
| gig/rollIn | 4800 | 0% | 0 / 1200 / 3600 / 0 / 0 / 0 |
| react | 2364 | 50% | 0 / 1763 / 590 / 11 / 0 / 0 |
| gigValue/adjust | 1955 | 11% | 0 / 7 / 72 / 141 / 1042 / 693 |
| unit/defeat | 1492 | 59% | 442 / 447 / 578 / 25 / 0 / 0 |
| mulligan | 1200 | 14% | 0 / 1200 / 0 / 0 / 0 / 0 |
| mode/mode | 1152 | 65% | 0 / 1152 / 0 / 0 / 0 / 0 |
| card/playFree | 967 | 78% | 0 / 375 / 573 / 19 / 0 / 0 |
| unit/pump | 882 | 64% | 364 / 267 / 240 / 11 / 0 / 0 |
| unit/equip | 570 | 86% | 61 / 186 / 252 / 71 / 0 / 0 |
| card/discard | 214 | 59% | 61 / 68 / 85 / 0 / 0 / 0 |
| unit/ready | 212 | 100% | 0 / 212 / 0 / 0 / 0 / 0 |
| gigValue/setGig | 202 | 9% | 0 / 0 / 9 / 34 / 45 / 114 |
| card/search | 185 | 58% | 0 / 62 / 109 / 14 / 0 / 0 |
| unit/sacrifice | 118 | 81% | 77 / 19 / 22 / 0 / 0 / 0 |
| card/defeat | 22 | 100% | 20 / 2 / 0 / 0 / 0 / 0 |
| yesno/draw | 13 | 100% | 0 / 13 / 0 / 0 / 0 / 0 |
| mode/rivalChoice | 5 | 0% | 0 / 5 / 0 / 0 / 0 / 0 |

Reaction windows: 2093 attacks. Reacted to 1126 (deck won 69% (65–72) n=761): stole 519, attackerGone 78, targetGone 470, bothGone 58, noneGone 1. Let 967 resolve (77% (73–81) n=469): stole 866, attackerGone 5, targetGone 70, bothGone 26. Choices: call 696, endReact 1178, block 451, play 39.

## RRY Smasher Aggro — 1200 games, 57% won, 50455 decisions

| Card | Use | Uses | Win rate in games used (95%) | Legal turns → used | Not chosen | Early / mid / late uses | Ahead | Even | Behind |
|---|---|---|---|---|---|---|---|---|---|
| Rockn' Rockerboy | attacked | 1580 | 65% (62–69) n=608 | 1636 → 1456 | 11% | 0 / 693 / 887 | 78% (74–82) n=401 | 70% (63–77) n=164 | 60% (55–65) n=353 |
| Animals Wrecker | attacked | 1493 | 69% (66–73) n=618 | 1380 → 1343 | 3% | 0 / 378 / 1115 | 88% (83–91) n=298 | 78% (71–84) n=161 | 63% (59–68) n=431 |
| 6th Street Recruits | attacked | 1307 | 60% (56–64) n=584 | 1466 → 1210 | 17% | 176 / 439 / 692 | 78% (73–83) n=268 | 56% (50–63) n=225 | 54% (49–60) n=340 |
| Detonate | sold | 993 | 58% (54–61) n=756 | 1244 → 993 | 20% | 566 / 195 / 232 | 69% (64–73) n=393 | 52% (46–58) n=270 | 48% (42–55) n=211 |
| Animals Wrecker | played | 973 | 62% (58–65) n=746 | 1260 → 973 | 23% | 0 / 684 / 289 | 68% (62–73) n=273 | 62% (54–70) n=125 | 57% (52–61) n=445 |
| Zetatech Faceplate | sold | 947 | 55% (51–59) n=717 | 1762 → 947 | 46% | 297 / 363 / 287 | 60% (55–66) n=312 | 55% (49–62) n=217 | 50% (45–56) n=314 |
| La Llorona: Ghost of the Past | played | 946 | 57% (53–61) n=733 | 2679 → 899 | 66% | 160 / 328 / 458 | 75% (69–79) n=285 | 50% (43–57) n=216 | 46% (41–52) n=317 |
| V: Streetkid | attacked | 934 | 46% (42–50) n=612 | 1080 → 934 | 14% | 121 / 186 / 627 | 59% (54–64) n=347 | 55% (46–63) n=119 | 34% (28–40) n=272 |
| Mantis Blades | sold | 927 | 56% (53–60) n=725 | 1045 → 927 | 11% | 534 / 167 / 226 | 62% (57–67) n=351 | 52% (46–58) n=284 | 50% (43–56) n=204 |
| Rockn' Rockerboy | played | 924 | 61% (57–64) n=713 | 1678 → 924 | 45% | 447 / 225 / 252 | 72% (67–76) n=362 | 58% (51–64) n=245 | 41% (35–48) n=220 |
| 6th Street Recruits | played | 910 | 59% (55–62) n=706 | 1963 → 901 | 54% | 444 / 237 / 229 | 65% (59–70) n=329 | 55% (49–61) n=303 | 51% (44–59) n=175 |
| Bonnie and Clyde | sold | 875 | 57% (53–61) n=681 | 2666 → 875 | 67% | 128 / 364 / 383 | 64% (58–70) n=274 | 59% (51–67) n=146 | 49% (44–54) n=350 |
| Meredith Stout: Stone Cold Corpo | played | 855 | 54% (51–58) n=657 | 2900 → 813 | 72% | 190 / 220 / 445 | 70% (64–75) n=235 | 50% (43–56) n=217 | 45% (39–50) n=285 |
| V: Streetkid | called | 839 | 56% (53–59) n=839 | 839 → 839 | 0% | 334 / 314 / 191 | 62% (58–66) n=555 | 41% (33–49) n=130 | 49% (42–57) n=154 |
| Screw: Lovelorn Fool | attacked | 835 | 60% (56–65) n=410 | 946 → 799 | 16% | 0 / 243 / 592 | 81% (75–85) n=236 | 77% (67–85) n=88 | 47% (41–53) n=230 |

(37 more card uses in the JSON report.)

Legal but never taken: V: Streetkid (Legend play, legal in 2334 turns), Adam Smasher: Ender of Legends (Legend play, legal in 600 turns).

| Decision type | Decisions | First-listed option taken | Options offered (1 / 2 / 3–5 / 6–10 / 11–20 / 21+) |
|---|---|---|---|
| main | 29031 | 8% | 0 / 2497 / 7414 / 10063 / 8728 / 329 |
| gig/steal | 6823 | 28% | 365 / 978 / 3085 / 2363 / 32 / 0 |
| gig/rollIn | 4800 | 0% | 0 / 1200 / 3600 / 0 / 0 / 0 |
| react | 3611 | 53% | 0 / 2296 / 1303 / 12 / 0 / 0 |
| unit/defeat | 1759 | 68% | 689 / 502 / 539 / 29 / 0 / 0 |
| mulligan | 1200 | 27% | 0 / 1200 / 0 / 0 / 0 / 0 |
| card/search | 1070 | 71% | 532 / 260 / 226 / 51 / 1 / 0 |
| gigValue/adjust | 1048 | 8% | 0 / 14 / 102 / 42 / 302 / 588 |
| unit/pump | 376 | 49% | 123 / 90 / 154 / 9 / 0 / 0 |
| unit/equip | 228 | 82% | 45 / 64 / 103 / 16 / 0 / 0 |
| card/discard | 186 | 52% | 35 / 43 / 106 / 2 / 0 / 0 |
| unit/spend | 143 | 83% | 79 / 46 / 18 / 0 / 0 / 0 |
| unit/sacrifice | 116 | 83% | 69 / 27 / 20 / 0 / 0 / 0 |
| card/defeatGear | 38 | 97% | 0 / 35 / 3 / 0 / 0 / 0 |
| yesno/draw | 15 | 100% | 0 / 15 / 0 / 0 / 0 / 0 |
| card/defeat | 7 | 86% | 3 / 4 / 0 / 0 / 0 / 0 |
| mode/rivalChoice | 4 | 0% | 0 / 4 / 0 / 0 / 0 / 0 |

Reaction windows: 3080 attacks. Reacted to 1557 (deck won 53% (49–56) n=921): stole 555, attackerGone 34, targetGone 905, bothGone 63. Let 1523 resolve (55% (51–59) n=657): stole 1227, attackerGone 4, targetGone 225, bothGone 67. Choices: call 882, endReact 1922, block 802, play 1, ability 4.

## YYB Rogue Gear — 1200 games, 49% won, 56331 decisions

| Card | Use | Uses | Win rate in games used (95%) | Legal turns → used | Not chosen | Early / mid / late uses | Ahead | Even | Behind |
|---|---|---|---|---|---|---|---|---|---|
| V: Corporate Exile | attacked | 2487 | 48% (45–51) n=1104 | 2787 → 2487 | 11% | 260 / 841 / 1386 | 59% (55–62) n=795 | 49% (43–55) n=260 | 36% (32–41) n=429 |
| Psycho Squad | attacked | 2004 | 56% (52–59) n=695 | 2107 → 1830 | 13% | 243 / 639 / 1122 | 65% (60–69) n=481 | 59% (54–64) n=325 | 47% (42–53) n=310 |
| Dying Night: V's Pistol | sold | 1242 | 48% (45–51) n=868 | 2392 → 1242 | 48% | 427 / 414 / 401 | 56% (52–60) n=502 | 45% (40–51) n=310 | 31% (25–37) n=236 |
| V: Corporate Exile | Go Solo (self-paid 1130) | 1130 | 48% (45–51) n=1130 | 1338 → 1130 | 16% | 279 / 454 / 397 | 56% (52–60) n=709 | 36% (29–44) n=159 | 34% (29–40) n=262 |
| Zetatech Faceplate | sold | 1129 | 47% (43–50) n=811 | 3593 → 1129 | 69% | 145 / 379 / 605 | 56% (52–61) n=431 | 47% (40–54) n=196 | 30% (25–35) n=321 |
| Psycho Squad | played | 1117 | 54% (50–57) n=813 | 2083 → 1112 | 47% | 489 / 345 / 283 | 61% (56–65) n=466 | 53% (47–58) n=335 | 36% (29–45) n=140 |
| The Heist | sold | 1084 | 48% (45–52) n=788 | 1850 → 1084 | 41% | 431 / 351 / 302 | 54% (49–58) n=459 | 44% (38–50) n=246 | 35% (29–41) n=231 |
| V: Corporate Exile | called | 1013 | 49% (46–52) n=1013 | 1013 → 1013 | 0% | 546 / 322 / 145 | 53% (49–57) n=711 | 35% (29–42) n=190 | 46% (37–55) n=112 |
| Trauma Team Operatives | attacked | 982 | 48% (44–53) n=522 | 948 → 891 | 6% | 0 / 97 / 885 | 68% (63–74) n=275 | 59% (51–67) n=128 | 28% (23–34) n=269 |
| Trauma Team Operatives | played | 974 | 46% (42–49) n=724 | 2159 → 939 | 57% | 9 / 331 / 634 | 59% (54–63) n=454 | 38% (29–49) n=91 | 22% (18–28) n=262 |
| River Ward: Detective on the Hunt | called | 940 | 50% (46–53) n=940 | 940 → 940 | 0% | 452 / 316 / 172 | 55% (51–59) n=699 | 36% (29–44) n=171 | 29% (19–40) n=70 |
| Viktor Vektor: Sit Down and Relax | called | 920 | 49% (46–52) n=920 | 920 → 920 | 0% | 445 / 302 / 173 | 53% (49–57) n=657 | 38% (31–45) n=186 | 39% (29–50) n=77 |
| Dexter DeShawn: One Last Chance | attacked | 917 | 52% (47–56) n=446 | 1172 → 873 | 26% | 81 / 312 / 524 | 65% (59–71) n=263 | 57% (49–64) n=153 | 39% (32–45) n=205 |
| Modded Kusanagi | played | 884 | 40% (36–44) n=556 | 2337 → 884 | 62% | 0 / 116 / 768 | 60% (54–66) n=260 | 50% (41–60) n=107 | 18% (14–23) n=337 |
| Modded Kusanagi | attacked | 872 | 40% (36–44) n=554 | 884 → 872 | 1% | 0 / 112 / 760 | 61% (55–66) n=279 | 49% (40–58) n=110 | 15% (12–20) n=313 |

(33 more card uses in the JSON report.)

Legal but never taken: V: Corporate Exile (Legend play, legal in 1338 turns).

| Decision type | Decisions | First-listed option taken | Options offered (1 / 2 / 3–5 / 6–10 / 11–20 / 21+) |
|---|---|---|---|
| main | 31585 | 9% | 0 / 2753 / 7747 / 13033 / 7676 / 376 |
| gig/steal | 6843 | 41% | 976 / 1453 / 2412 / 1971 / 31 / 0 |
| gig/rollIn | 4800 | 100% | 0 / 1200 / 3600 / 0 / 0 / 0 |
| react | 4626 | 65% | 0 / 3562 / 1059 / 5 / 0 / 0 |
| gigValue/adjust | 2713 | 9% | 0 / 0 / 165 / 550 / 1629 / 369 |
| unit/equip | 1765 | 78% | 231 / 474 / 967 / 93 / 0 / 0 |
| card/search | 1431 | 84% | 20 / 877 / 534 / 0 / 0 / 0 |
| mulligan | 1200 | 18% | 0 / 1200 / 0 / 0 / 0 / 0 |
| card/trash | 434 | 56% | 0 / 434 / 0 / 0 / 0 / 0 |
| card/playFree | 378 | 92% | 271 / 97 / 10 / 0 / 0 / 0 |
| unit/sacrifice | 314 | 36% | 59 / 119 / 135 / 1 / 0 / 0 |
| card/discard | 151 | 43% | 26 / 30 / 83 / 12 / 0 / 0 |
| yesno/playFree | 34 | 100% | 0 / 34 / 0 / 0 / 0 / 0 |
| unit/protect | 26 | 42% | 7 / 8 / 10 / 1 / 0 / 0 |
| mode/rivalChoice | 18 | 0% | 0 / 18 / 0 / 0 / 0 / 0 |
| yesno/draw | 13 | 100% | 0 / 13 / 0 / 0 / 0 / 0 |

Reaction windows: 4066 attacks. Reacted to 1449 (deck won 46% (43–49) n=901): stole 417, attackerGone 17, targetGone 939, bothGone 63, noneGone 13. Let 2617 resolve (43% (40–47) n=781): stole 2254, targetGone 329, bothGone 34. Choices: call 620, endReact 3024, block 844, ability 97, play 41.

## The bot’s own scores against outcomes (calibration check)

> Association only, like the rest of this report: the deciding side's win rate over its decisions, by the margin the bot claimed for its choice (its value minus the best other option's, in Gigs), and by whether the deep rollouts kept the 1-ply screen's top pick. A big claimed margin often comes in positions that are already won or lost, so a rising win rate is not proof the margins are right; a flat one says they carry little. Intervals use the game count (decisions in one game are not independent); under 20 games a cell shows only its counts.

| Bot | Scores | Scored | <0 Gigs | 0–0.05 Gigs | 0.05–0.15 Gigs | 0.15–0.5 Gigs | 0.5–1 Gigs | 1+ Gigs |
|---|---|---|---|---|---|---|---|---|
| deep | main deep | 168502 | — | 51% (49–52) 68213 in 8386 games | 52% (51–53) 32372 in 8203 games | 54% (53–55) 22486 in 7898 games | 48% (47–49) 9097 in 5550 games | 54% (53–55) 36334 in 8282 games |
| deep | react 1ply | 21694 | 36% (24–50) 59 in 48 games | 38% (36–39) 6668 in 3884 games | 39% (36–42) 2210 in 1155 games | 45% (43–46) 4553 in 3528 games | 47% (44–50) 1680 in 1156 games | 47% (46–49) 6524 in 4013 games |

| Bot | Scores | Deep decisions | Rollouts kept the 1-ply pick | Rollouts overturned it | Overturned |
|---|---|---|---|---|---|
| deep | main deep | 168502 | 52% (51–53) 135978 in 8400 games | 50% (49–51) 32524 in 8262 games | 19% |
