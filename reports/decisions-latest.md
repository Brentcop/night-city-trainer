# Decision telemetry

4200 games, 397028 decisions (telemetry schema 1). Sim v6, deep bot, seed 1.

> Descriptive association only: win rates in games where a card was used a given way, with 95% Wilson intervals. They are not the value of the card or of the choice (no counterfactual comparison yet; ROADMAP §5 steps 3 and 5). A slice from fewer than 20 games shows only its count ("thin").

Stages: early turns 1–4, middle turns 5–8, late turn 9+. Ahead / even / behind: the acting player's Gig count against the rival's when the decision was made. "Not chosen": share of the turns (attacks, for reactions) in which the use was legal but not taken.

Measured: games 4200, recordsPerGame 94.5, rawBytesPerGame 62483.0, aggregateBytesPerGame 13243.1, mergedBytes 148063, seconds 426.5.

## BBG Cunningham Econ — 1200 games, 51% won, 59817 decisions

| Card | Use | Uses | Win rate in games used (95%) | Legal turns → used | Not chosen | Early / mid / late uses | Ahead | Even | Behind |
|---|---|---|---|---|---|---|---|---|---|
| Jacked-In Voodoo Boy | attacked | 1707 | 53% (49–56) n=760 | 1564 → 1419 | 9% | 185 / 517 / 1005 | 67% (63–71) n=495 | 53% (47–59) n=250 | 30% (25–35) n=334 |
| Jacked-In Voodoo Boy | played | 1603 | 52% (49–55) n=1016 | 2311 → 1470 | 36% | 633 / 487 / 483 | 62% (58–66) n=693 | 38% (32–43) n=299 | 25% (20–32) n=190 |
| Psycho Squad | attacked | 1564 | 55% (51–59) n=631 | 1694 → 1460 | 14% | 155 / 618 / 791 | 70% (65–74) n=395 | 55% (48–61) n=234 | 44% (38–49) n=296 |
| Pepe Najarro: Working Doubles | attacked | 1505 | 53% (49–57) n=637 | 1657 → 1426 | 14% | 147 / 613 / 745 | 69% (64–73) n=388 | 53% (46–59) n=247 | 38% (32–44) n=283 |
| Alt Cunningham: Soulkiller Architect | ability | 1426 | 45% (42–48) n=889 | 3862 → 1402 | 64% | 14 / 311 / 1101 | 64% (60–68) n=513 | 43% (36–51) n=176 | 16% (13–20) n=451 |
| Peace Offering | sold | 1230 | 50% (47–53) n=867 | 1787 → 1230 | 31% | 548 / 322 / 360 | 58% (53–62) n=478 | 46% (41–51) n=339 | 32% (26–39) n=218 |
| Chrome Reverie | sold | 1175 | 49% (46–53) n=833 | 2000 → 1175 | 41% | 480 / 352 / 343 | 57% (52–61) n=503 | 46% (40–52) n=266 | 31% (26–38) n=235 |
| Floor It | sold | 1092 | 50% (47–54) n=822 | 1676 → 1092 | 35% | 497 / 268 / 327 | 60% (56–65) n=446 | 46% (40–51) n=325 | 30% (24–37) n=178 |
| Trust No One | sold | 1073 | 50% (46–53) n=806 | 1568 → 1073 | 32% | 425 / 292 / 356 | 60% (55–65) n=409 | 46% (41–52) n=303 | 30% (25–37) n=225 |
| Hanako Arasaka: Daughter of the Emperor | ability | 1054 | 39% (35–43) n=714 | 3675 → 1054 | 71% | 15 / 250 / 789 | 57% (52–62) n=414 | 23% (17–32) n=124 | 13% (10–17) n=330 |
| Pepe Najarro: Working Doubles | played | 989 | 52% (48–55) n=775 | 1525 → 980 | 36% | 383 / 303 / 303 | 62% (58–67) n=453 | 42% (36–47) n=281 | 32% (25–40) n=151 |
| Psycho Squad | played | 984 | 53% (50–57) n=773 | 1451 → 979 | 33% | 379 / 318 / 287 | 62% (58–67) n=459 | 47% (41–53) n=256 | 35% (28–43) n=151 |
| Mox Inciters | played | 946 | 51% (47–54) n=758 | 2123 → 908 | 57% | 151 / 394 / 401 | 64% (59–68) n=432 | 42% (35–48) n=200 | 31% (25–37) n=216 |
| Maman Brigitte: Spirit of Death | attacked | 931 | 56% (52–60) n=527 | 1164 → 873 | 25% | 0 / 356 / 575 | 72% (67–77) n=313 | 64% (56–72) n=121 | 35% (29–42) n=216 |
| Jackie Welles: Pour One Out For Me | called | 926 | 53% (50–57) n=926 | 926 → 926 | 0% | 295 / 494 / 137 | 59% (55–62) n=704 | 42% (34–50) n=142 | 26% (18–37) n=80 |

(28 more card uses in the JSON report.)

| Decision type | Decisions | First-listed option taken | Options offered (1 / 2 / 3–5 / 6–10 / 11–20 / 21+) |
|---|---|---|---|
| main | 29964 | 6% | 0 / 2582 / 7390 / 12482 / 7239 / 271 |
| gig/steal | 5405 | 35% | 426 / 1304 / 2335 / 1328 / 12 / 0 |
| gig/rollIn | 4800 | 100% | 0 / 1200 / 3600 / 0 / 0 / 0 |
| gigValue/adjust | 2699 | 23% | 0 / 78 / 641 / 1145 / 734 / 101 |
| react | 2369 | 29% | 0 / 1643 / 721 / 5 / 0 / 0 |
| card/search | 2244 | 56% | 0 / 481 / 1763 / 0 / 0 / 0 |
| unit/bottomdeck | 2239 | 78% | 1459 / 422 / 354 / 4 / 0 / 0 |
| card/discard | 1695 | 51% | 258 / 648 / 727 / 62 / 0 / 0 |
| mulligan | 1200 | 22% | 0 / 1200 / 0 / 0 / 0 / 0 |
| card/playFromTrash | 1070 | 62% | 444 / 333 / 273 / 20 / 0 / 0 |
| gig/swapGive | 1054 | 41% | 32 / 75 / 511 / 434 / 2 / 0 |
| gig/swapTake | 1054 | 24% | 59 / 113 / 472 / 396 / 14 / 0 |
| unit/weaken | 802 | 61% | 280 / 274 / 244 / 4 / 0 / 0 |
| unit/mustAttack | 781 | 63% | 334 / 255 / 190 / 2 / 0 / 0 |
| unit/ready | 643 | 100% | 0 / 436 / 207 / 0 / 0 / 0 |
| card/freePlay | 556 | 64% | 0 / 186 / 320 / 49 / 1 / 0 |
| yesno/discardFor | 554 | 100% | 0 / 554 / 0 / 0 / 0 / 0 |
| mode/mode | 230 | 90% | 0 / 24 / 206 / 0 / 0 / 0 |
| gigValue/setGig | 193 | 16% | 0 / 4 / 11 / 9 / 25 / 144 |
| unit/sacrifice | 94 | 93% | 66 / 19 / 9 / 0 / 0 / 0 |
| unit/cantAttack | 89 | 69% | 28 / 37 / 24 / 0 / 0 / 0 |
| unit/call | 42 | 100% | 0 / 20 / 22 / 0 / 0 / 0 |
| card/discardForNothing | 25 | 0% | 0 / 10 / 10 / 5 / 0 / 0 |
| yesno/draw | 13 | 100% | 0 / 13 / 0 / 0 / 0 / 0 |
| mode/rivalChoice | 2 | 0% | 0 / 2 / 0 / 0 / 0 / 0 |

Reaction windows: 2037 attacks. Reacted to 1505 (deck won 46% (42–49) n=917): stole 559, stoleNothing 1, targetGone 908, bothGone 37. Let 532 resolve (52% (46–57) n=317): stole 490, stoleNothing 2, targetGone 29, bothGone 11. Choices: call 767, block 785, endReact 694, play 123.

## GRY Trauma Team — 1200 games, 43% won, 60391 decisions

| Card | Use | Uses | Win rate in games used (95%) | Legal turns → used | Not chosen | Early / mid / late uses | Ahead | Even | Behind |
|---|---|---|---|---|---|---|---|---|---|
| Pepe Najarro: Working Doubles | attacked | 1885 | 45% (42–49) n=734 | 2102 → 1711 | 19% | 169 / 674 / 1042 | 63% (58–68) n=398 | 49% (43–55) n=289 | 33% (29–38) n=452 |
| 6th Street Recruits | attacked | 1858 | 47% (43–51) n=709 | 2049 → 1685 | 18% | 140 / 635 / 1083 | 64% (59–68) n=386 | 49% (43–55) n=260 | 38% (34–43) n=452 |
| Johnny Silverhand: Never Stop Fighting | attacked | 1460 | 63% (58–67) n=477 | 1034 → 935 | 10% | 0 / 365 / 1095 | 80% (75–84) n=309 | 77% (69–84) n=111 | 49% (43–55) n=246 |
| Muamar Reyes: El Capitán | ability | 1409 | 37% (33–40) n=870 | 4306 → 1409 | 67% | 19 / 306 / 1084 | 56% (52–61) n=495 | 21% (16–28) n=183 | 11% (8–14) n=442 |
| Padre: Man of the Cross | ability | 1313 | 32% (29–36) n=812 | 4304 → 1313 | 69% | 9 / 240 / 1064 | 54% (49–58) n=422 | 15% (10–21) n=175 | 10% (8–13) n=438 |
| Pepe Najarro: Working Doubles | played | 1264 | 44% (41–47) n=895 | 1951 → 1249 | 36% | 579 / 268 / 417 | 54% (50–59) n=421 | 41% (36–46) n=353 | 27% (22–32) n=307 |
| Trauma Team Operatives | attacked | 1247 | 45% (41–49) n=623 | 1259 → 1113 | 12% | 0 / 250 / 997 | 68% (62–73) n=300 | 61% (52–69) n=127 | 29% (24–34) n=365 |
| Meredith Stout: Stone Cold Corpo | played | 1238 | 43% (39–46) n=872 | 2760 → 1197 | 57% | 257 / 355 / 626 | 56% (51–61) n=330 | 38% (32–44) n=274 | 32% (28–37) n=420 |
| Augmented Negotiators | played | 1235 | 42% (38–45) n=876 | 2760 → 1177 | 57% | 200 / 520 / 515 | 57% (52–62) n=359 | 35% (30–41) n=269 | 31% (27–36) n=414 |
| Trauma Team Operatives | played | 1230 | 42% (39–45) n=881 | 1952 → 1182 | 39% | 74 / 529 / 627 | 57% (52–61) n=433 | 41% (33–49) n=142 | 26% (22–31) n=441 |
| 6th Street Recruits | played | 1216 | 45% (42–48) n=847 | 1921 → 1199 | 38% | 525 / 275 / 416 | 55% (50–60) n=416 | 40% (34–45) n=316 | 31% (27–37) n=319 |
| Detonate | sold | 1132 | 41% (37–44) n=823 | 1612 → 1132 | 30% | 552 / 328 / 252 | 49% (44–54) n=400 | 38% (33–44) n=309 | 28% (23–33) n=267 |
| The Heist | sold | 1100 | 43% (40–47) n=809 | 2224 → 1100 | 51% | 332 / 440 / 328 | 52% (47–57) n=388 | 41% (35–47) n=246 | 32% (28–38) n=321 |
| All is Lost | sold | 1057 | 41% (38–45) n=792 | 1539 → 1057 | 31% | 507 / 298 / 252 | 48% (43–54) n=324 | 41% (36–47) n=317 | 32% (27–38) n=274 |
| Peace Offering | sold | 1018 | 40% (37–44) n=775 | 2923 → 1018 | 65% | 187 / 438 / 393 | 54% (48–59) n=325 | 44% (36–51) n=177 | 28% (24–33) n=405 |

(29 more card uses in the JSON report.)

| Decision type | Decisions | First-listed option taken | Options offered (1 / 2 / 3–5 / 6–10 / 11–20 / 21+) |
|---|---|---|---|
| main | 33806 | 9% | 0 / 1941 / 7504 / 11524 / 11986 / 851 |
| gig/steal | 6226 | 28% | 222 / 1053 / 2720 / 2200 / 31 / 0 |
| gig/rollIn | 4800 | 0% | 0 / 1200 / 3600 / 0 / 0 / 0 |
| react | 3728 | 39% | 0 / 2417 / 1294 / 17 / 0 / 0 |
| gigValue/adjust | 2381 | 13% | 0 / 0 / 12 / 179 / 1340 / 850 |
| gigValue/setGig | 1557 | 6% | 0 / 1 / 14 / 128 / 398 / 1016 |
| unit/spend | 1484 | 61% | 535 / 406 / 532 / 11 / 0 / 0 |
| mulligan | 1200 | 11% | 0 / 1200 / 0 / 0 / 0 / 0 |
| mode/mode | 1165 | 68% | 0 / 1165 / 0 / 0 / 0 / 0 |
| mode/muamarCall | 1164 | 79% | 0 / 1164 / 0 / 0 / 0 / 0 |
| card/search | 1098 | 79% | 584 / 284 / 153 / 74 / 3 / 0 |
| unit/protect | 890 | 59% | 301 / 338 / 245 / 6 / 0 / 0 |
| unit/equip | 367 | 85% | 89 / 126 / 132 / 20 / 0 / 0 |
| unit/ready | 230 | 100% | 0 / 230 / 0 / 0 / 0 / 0 |
| unit/sacrifice | 114 | 81% | 63 / 23 / 27 / 1 / 0 / 0 |
| yesno/draw | 92 | 100% | 0 / 92 / 0 / 0 / 0 / 0 |
| card/defeat | 47 | 91% | 35 / 9 / 3 / 0 / 0 / 0 |
| card/discard | 36 | 53% | 5 / 10 / 16 / 5 / 0 / 0 |
| yesno/playFree | 5 | 100% | 0 / 5 / 0 / 0 / 0 / 0 |
| mode/rivalChoice | 1 | 0% | 0 / 1 / 0 / 0 / 0 / 0 |

Reaction windows: 2996 attacks. Reacted to 2017 (deck won 39% (36–42) n=1003): stole 687, attackerGone 37, targetGone 1107, bothGone 74, noneGone 112. Let 979 resolve (47% (43–51) n=498): stole 880, attackerGone 4, targetGone 53, bothGone 42. Choices: endReact 1452, block 1215, call 1045, play 16.

## Rainbow Fixer Stuff — 1200 games, 41% won, 61028 decisions

| Card | Use | Uses | Win rate in games used (95%) | Legal turns → used | Not chosen | Early / mid / late uses | Ahead | Even | Behind |
|---|---|---|---|---|---|---|---|---|---|
| 6th Street Recruits | attacked | 1947 | 46% (42–49) n=799 | 2078 → 1735 | 17% | 127 / 702 / 1118 | 66% (62–71) n=413 | 41% (35–46) n=285 | 42% (38–47) n=483 |
| Pepe Najarro: Working Doubles | attacked | 1903 | 45% (42–49) n=777 | 2024 → 1694 | 16% | 110 / 638 / 1155 | 63% (58–68) n=408 | 45% (39–51) n=257 | 40% (35–44) n=473 |
| 6th Street Recruits | played | 1423 | 43% (40–46) n=961 | 2208 → 1405 | 36% | 521 / 438 / 464 | 53% (49–58) n=431 | 35% (30–40) n=356 | 36% (32–41) n=406 |
| Detonate | sold | 1378 | 41% (38–45) n=923 | 1951 → 1378 | 29% | 618 / 392 / 368 | 51% (47–56) n=443 | 36% (31–41) n=347 | 37% (33–42) n=361 |
| Pepe Najarro: Working Doubles | played | 1345 | 42% (39–45) n=929 | 2240 → 1328 | 41% | 462 / 445 / 438 | 54% (49–59) n=397 | 34% (29–39) n=335 | 36% (31–41) n=413 |
| Valentino Street Racer | played | 1316 | 42% (39–45) n=905 | 2326 → 1221 | 48% | 239 / 746 / 331 | 50% (45–55) n=405 | 32% (27–38) n=256 | 40% (35–45) n=413 |
| Psycho Squad | attacked | 1313 | 48% (44–52) n=606 | 1492 → 1239 | 17% | 81 / 451 / 781 | 68% (63–73) n=306 | 44% (37–52) n=178 | 43% (38–48) n=359 |
| Synapse Burnout | sold | 1295 | 42% (39–45) n=894 | 1862 → 1295 | 30% | 522 / 425 / 348 | 52% (47–57) n=391 | 33% (28–38) n=306 | 38% (33–43) n=385 |
| Valentino Street Racer | attacked | 1285 | 45% (41–49) n=674 | 1705 → 1123 | 34% | 18 / 391 / 876 | 62% (57–67) n=341 | 55% (47–63) n=151 | 34% (30–39) n=387 |
| Field Operator | attacked | 1244 | 46% (42–50) n=651 | 1605 → 1073 | 33% | 13 / 318 / 913 | 68% (63–73) n=288 | 64% (56–71) n=155 | 36% (32–41) n=425 |
| Field Operator | played | 1232 | 41% (38–45) n=862 | 2620 → 1149 | 56% | 125 / 702 / 405 | 50% (45–55) n=404 | 33% (27–40) n=207 | 37% (32–42) n=390 |
| Wakako Okada: Peace and Harmony | ability | 1129 | 39% (36–43) n=787 | 4557 → 1129 | 75% | 10 / 295 / 824 | 58% (53–62) n=472 | 20% (14–27) n=146 | 15% (12–20) n=336 |
| Padre: Man of the Cross | ability | 1092 | 36% (33–39) n=759 | 4514 → 1092 | 76% | 6 / 251 / 835 | 55% (50–59) n=417 | 18% (13–26) n=137 | 16% (13–20) n=375 |
| Mantis Blades | sold | 991 | 42% (38–45) n=768 | 1464 → 991 | 32% | 529 / 194 / 268 | 50% (45–55) n=314 | 37% (32–43) n=324 | 34% (29–40) n=252 |
| Psycho Squad | played | 918 | 45% (42–49) n=766 | 1537 → 913 | 41% | 349 / 281 / 288 | 61% (56–67) n=294 | 34% (29–40) n=258 | 38% (33–44) n=291 |

(30 more card uses in the JSON report.)

| Decision type | Decisions | First-listed option taken | Options offered (1 / 2 / 3–5 / 6–10 / 11–20 / 21+) |
|---|---|---|---|
| main | 33542 | 8% | 0 / 1862 / 8111 / 12210 / 10798 / 561 |
| gig/steal | 6523 | 29% | 210 / 956 / 2971 / 2338 / 48 / 0 |
| gig/rollIn | 4800 | 0% | 0 / 1200 / 3600 / 0 / 0 / 0 |
| mode/mode | 2945 | 76% | 0 / 2360 / 585 / 0 / 0 / 0 |
| react | 2117 | 20% | 0 / 1256 / 837 / 24 / 0 / 0 |
| gigValue/adjust | 1609 | 11% | 0 / 0 / 0 / 97 / 910 / 602 |
| unit/weaken | 1409 | 50% | 396 / 469 / 520 / 24 / 0 / 0 |
| unit/spend | 1251 | 61% | 491 / 351 / 403 / 6 / 0 / 0 |
| unit/adrenaline | 1217 | 54% | 478 / 370 / 364 / 5 / 0 / 0 |
| mulligan | 1200 | 6% | 0 / 1200 / 0 / 0 / 0 / 0 |
| gigValue/setGig | 1068 | 10% | 1 / 3 / 13 / 81 / 343 / 627 |
| unit/equip | 997 | 88% | 38 / 247 / 537 / 175 / 0 / 0 |
| unit/defeat | 829 | 33% | 30 / 100 / 601 / 98 / 0 / 0 |
| card/freePlay | 462 | 88% | 0 / 253 / 203 / 6 / 0 / 0 |
| card/playFree | 301 | 93% | 0 / 194 / 107 / 0 / 0 / 0 |
| unit/ready | 188 | 100% | 0 / 188 / 0 / 0 / 0 / 0 |
| card/discard | 166 | 57% | 42 / 46 / 78 / 0 / 0 / 0 |
| unit/cantAttack | 110 | 51% | 31 / 33 / 45 / 1 / 0 / 0 |
| unit/sacrifice | 85 | 84% | 48 / 17 / 19 / 1 / 0 / 0 |
| unit/pump | 72 | 53% | 4 / 25 / 42 / 1 / 0 / 0 |
| unit/call | 64 | 100% | 0 / 32 / 32 / 0 / 0 / 0 |
| card/defeat | 51 | 100% | 49 / 1 / 1 / 0 / 0 / 0 |
| yesno/draw | 18 | 100% | 0 / 18 / 0 / 0 / 0 / 0 |
| mode/rivalChoice | 4 | 0% | 0 / 4 / 0 / 0 / 0 / 0 |

Reaction windows: 1841 attacks. Reacted to 1528 (deck won 37% (34–40) n=958): stole 820, stoleNothing 2, attackerGone 35, targetGone 615, bothGone 54, noneGone 2. Let 313 resolve (32% (25–40) n=158): stole 273, targetGone 32, bothGone 8. Choices: call 1097, endReact 417, block 398, play 205.

## RRB Wakako Midrange — 1200 games, 39% won, 56521 decisions

| Card | Use | Uses | Win rate in games used (95%) | Legal turns → used | Not chosen | Early / mid / late uses | Ahead | Even | Behind |
|---|---|---|---|---|---|---|---|---|---|
| 6th Street Recruits | attacked | 2176 | 41% (38–45) n=767 | 2399 → 1901 | 21% | 146 / 848 / 1182 | 64% (59–69) n=340 | 42% (36–48) n=268 | 36% (32–40) n=562 |
| Psycho Squad | attacked | 1449 | 43% (39–47) n=577 | 1725 → 1360 | 21% | 93 / 556 / 800 | 65% (59–70) n=263 | 45% (38–52) n=169 | 39% (35–44) n=423 |
| Yorinobu Arasaka: Steel Dragon | attacked | 1286 | 53% (49–56) n=626 | 1240 → 1159 | 7% | 0 / 0 / 1286 | 80% (75–85) n=260 | 80% (72–86) n=119 | 42% (37–46) n=446 |
| Jacked-In Voodoo Boy | played | 1209 | 34% (31–37) n=855 | 2073 → 1123 | 46% | 609 / 306 / 294 | 45% (40–49) n=469 | 20% (16–25) n=292 | 21% (17–27) n=233 |
| Wakako Okada: Peace and Harmony | ability | 1194 | 34% (31–38) n=791 | 4248 → 1194 | 72% | 43 / 299 / 852 | 54% (49–58) n=427 | 20% (14–27) n=150 | 13% (10–17) n=400 |
| Detonate | sold | 1165 | 40% (36–43) n=838 | 1449 → 1165 | 20% | 676 / 247 / 242 | 52% (47–57) n=389 | 31% (26–36) n=343 | 31% (25–37) n=253 |
| 6th Street Recruits | played | 1145 | 39% (36–42) n=829 | 1761 → 1137 | 35% | 593 / 347 / 205 | 50% (45–55) n=387 | 29% (25–34) n=355 | 33% (27–39) n=241 |
| Dexter DeShawn: Off the Grid | ability | 1136 | 37% (34–41) n=778 | 4301 → 1136 | 74% | 35 / 273 / 828 | 59% (54–63) n=430 | 21% (15–28) n=151 | 14% (11–18) n=363 |
| Yorinobu Arasaka: Steel Dragon | played | 1133 | 43% (40–47) n=847 | 1382 → 1133 | 18% | 0 / 617 / 516 | 56% (50–61) n=277 | 53% (44–62) n=122 | 38% (34–42) n=560 |
| Mantis Blades | sold | 1125 | 40% (36–43) n=812 | 1312 → 1125 | 14% | 635 / 230 / 260 | 50% (45–55) n=392 | 30% (25–35) n=295 | 35% (30–41) n=287 |
| Adam Smasher: Ender of Legends | called | 853 | 42% (38–45) n=853 | 853 → 853 | 0% | 401 / 294 / 158 | 51% (47–55) n=527 | 27% (21–33) n=181 | 27% (20–35) n=145 |
| Dexter DeShawn: Off the Grid | called | 835 | 42% (39–46) n=835 | 835 → 835 | 0% | 365 / 353 / 117 | 49% (45–54) n=470 | 25% (19–32) n=170 | 41% (34–48) n=195 |
| Floor It | sold | 833 | 42% (38–46) n=673 | 1660 → 833 | 50% | 320 / 286 / 227 | 55% (49–61) n=256 | 32% (26–38) n=247 | 39% (33–45) n=255 |
| Satori: Sword of Saburo | sold | 823 | 41% (37–45) n=658 | 2208 → 823 | 63% | 245 / 340 / 238 | 54% (48–60) n=245 | 32% (25–39) n=174 | 34% (29–40) n=319 |
| Wakako Okada: Peace and Harmony | called | 789 | 43% (40–47) n=789 | 789 → 789 | 0% | 361 / 305 / 123 | 51% (46–55) n=431 | 32% (25–39) n=184 | 39% (32–46) n=174 |

(32 more card uses in the JSON report.)

| Decision type | Decisions | First-listed option taken | Options offered (1 / 2 / 3–5 / 6–10 / 11–20 / 21+) |
|---|---|---|---|
| main | 30033 | 8% | 0 / 2595 / 8140 / 12567 / 6594 / 137 |
| gig/steal | 5465 | 27% | 259 / 744 / 2126 / 2316 / 20 / 0 |
| gig/rollIn | 4800 | 0% | 0 / 1200 / 3600 / 0 / 0 / 0 |
| gigValue/adjust | 2894 | 10% | 0 / 8 / 98 / 276 / 1789 / 723 |
| react | 2804 | 34% | 0 / 1889 / 896 / 19 / 0 / 0 |
| mode/mode | 2707 | 85% | 0 / 2329 / 378 / 0 / 0 / 0 |
| unit/defeat | 1451 | 68% | 606 / 345 / 473 / 27 / 0 / 0 |
| unit/weaken | 1280 | 61% | 492 / 468 / 314 / 6 / 0 / 0 |
| mulligan | 1200 | 17% | 0 / 1200 / 0 / 0 / 0 / 0 |
| card/playFree | 939 | 75% | 0 / 443 / 490 / 6 / 0 / 0 |
| unit/pump | 919 | 60% | 284 / 372 / 257 / 6 / 0 / 0 |
| unit/equip | 654 | 82% | 79 / 165 / 316 / 93 / 1 / 0 |
| card/freePlay | 475 | 80% | 0 / 198 / 265 / 12 / 0 / 0 |
| card/discard | 319 | 80% | 46 / 191 / 82 / 0 / 0 / 0 |
| unit/bottomdeck | 211 | 48% | 31 / 66 / 113 / 1 / 0 / 0 |
| card/search | 118 | 57% | 0 / 44 / 66 / 8 / 0 / 0 |
| unit/cantAttack | 85 | 75% | 47 / 30 / 8 / 0 / 0 / 0 |
| unit/sacrifice | 79 | 85% | 50 / 13 / 16 / 0 / 0 / 0 |
| unit/call | 46 | 100% | 0 / 11 / 35 / 0 / 0 / 0 |
| card/defeat | 16 | 94% | 14 / 2 / 0 / 0 / 0 / 0 |
| card/discardForNothing | 10 | 0% | 0 / 8 / 2 / 0 / 0 / 0 |
| yesno/draw | 10 | 100% | 0 / 10 / 0 / 0 / 0 / 0 |
| mode/rivalChoice | 6 | 17% | 0 / 6 / 0 / 0 / 0 / 0 |

Reaction windows: 2415 attacks. Reacted to 1675 (deck won 32% (29–35) n=970): stole 754, stoleNothing 2, attackerGone 42, targetGone 823, bothGone 54. Let 740 resolve (41% (36–46) n=399): stole 697, attackerGone 1, targetGone 34, bothGone 8. Choices: endReact 956, call 980, block 740, play 128.

## RRG Dexter Midrange — 1200 games, 73% won, 54476 decisions

| Card | Use | Uses | Win rate in games used (95%) | Legal turns → used | Not chosen | Early / mid / late uses | Ahead | Even | Behind |
|---|---|---|---|---|---|---|---|---|---|
| 6th Street Recruits | attacked | 1944 | 76% (73–79) n=696 | 2157 → 1736 | 20% | 164 / 770 / 1010 | 89% (86–92) n=434 | 71% (66–77) n=256 | 73% (68–77) n=411 |
| Pepe Najarro: Working Doubles | attacked | 1854 | 77% (74–80) n=694 | 2091 → 1655 | 21% | 137 / 685 / 1032 | 91% (88–94) n=421 | 77% (71–82) n=244 | 72% (68–76) n=417 |
| Animals Wrecker | attacked | 1790 | 80% (76–82) n=691 | 1658 → 1595 | 4% | 0 / 483 / 1307 | 95% (92–97) n=405 | 86% (80–90) n=169 | 76% (72–80) n=488 |
| Yorinobu Arasaka: Steel Dragon | attacked | 1285 | 86% (83–88) n=664 | 1206 → 1153 | 4% | 0 / 0 / 1285 | 97% (95–99) n=387 | 94% (89–97) n=160 | 79% (74–83) n=387 |
| Dexter DeShawn: Off the Grid | ability | 1266 | 69% (66–72) n=821 | 4326 → 1266 | 71% | 25 / 252 / 989 | 85% (82–88) n=560 | 37% (29–46) n=123 | 48% (42–53) n=322 |
| Detonate | sold | 1196 | 73% (70–76) n=860 | 1640 → 1196 | 27% | 592 / 322 / 282 | 84% (80–87) n=386 | 67% (62–72) n=331 | 67% (62–72) n=305 |
| Synapse Burnout | sold | 1181 | 72% (69–75) n=830 | 1621 → 1181 | 27% | 596 / 347 / 238 | 82% (77–85) n=379 | 64% (58–69) n=324 | 69% (63–74) n=314 |
| 6th Street Recruits | played | 1085 | 74% (71–77) n=793 | 1909 → 1076 | 44% | 643 / 204 / 238 | 87% (84–90) n=387 | 65% (60–70) n=358 | 62% (55–68) n=196 |
| Animals Wrecker | played | 1085 | 76% (73–79) n=810 | 1502 → 1085 | 28% | 0 / 759 / 326 | 84% (79–88) n=283 | 76% (69–82) n=165 | 71% (67–75) n=468 |
| Yorinobu Arasaka: Steel Dragon | played | 1082 | 79% (76–82) n=811 | 1390 → 1082 | 22% | 0 / 576 / 506 | 93% (89–96) n=256 | 88% (81–93) n=119 | 72% (68–75) n=520 |
| Mantis Blades | sold | 991 | 75% (72–78) n=763 | 1258 → 991 | 21% | 545 / 206 / 240 | 85% (81–89) n=343 | 66% (61–72) n=286 | 69% (63–75) n=249 |
| Pepe Najarro: Working Doubles | played | 990 | 74% (71–77) n=766 | 1879 → 978 | 48% | 565 / 187 / 238 | 85% (81–88) n=381 | 66% (60–71) n=316 | 66% (58–73) n=170 |
| Peace Offering | sold | 956 | 75% (72–78) n=732 | 2141 → 956 | 55% | 294 / 409 / 253 | 84% (80–88) n=269 | 68% (62–74) n=230 | 71% (66–76) n=350 |
| Adam Smasher: Ender of Legends | called | 904 | 77% (74–79) n=904 | 904 → 904 | 0% | 495 / 213 / 196 | 83% (80–86) n=630 | 59% (51–67) n=150 | 65% (57–73) n=124 |
| Dexter DeShawn: Off the Grid | called | 900 | 76% (73–79) n=900 | 900 → 900 | 0% | 525 / 258 / 117 | 83% (80–86) n=581 | 61% (54–69) n=158 | 63% (56–70) n=161 |

(28 more card uses in the JSON report.)

Legal but never taken: Synapse Burnout (played, legal in 1685 turns).

| Decision type | Decisions | First-listed option taken | Options offered (1 / 2 / 3–5 / 6–10 / 11–20 / 21+) |
|---|---|---|---|
| main | 30033 | 8% | 0 / 2501 / 8217 / 11887 / 7159 / 269 |
| gig/steal | 7954 | 27% | 331 / 1002 / 3837 / 2776 / 8 / 0 |
| gig/rollIn | 4800 | 0% | 0 / 1200 / 3600 / 0 / 0 / 0 |
| react | 2409 | 47% | 0 / 1783 / 614 / 12 / 0 / 0 |
| gigValue/adjust | 1939 | 10% | 0 / 7 / 76 / 128 / 1053 / 675 |
| unit/defeat | 1535 | 57% | 426 / 447 / 636 / 26 / 0 / 0 |
| mulligan | 1200 | 14% | 0 / 1200 / 0 / 0 / 0 / 0 |
| mode/mode | 1158 | 66% | 0 / 1158 / 0 / 0 / 0 / 0 |
| card/playFree | 958 | 78% | 0 / 375 / 565 / 18 / 0 / 0 |
| unit/pump | 944 | 63% | 381 / 304 / 248 / 11 / 0 / 0 |
| unit/equip | 573 | 86% | 69 / 166 / 258 / 80 / 0 / 0 |
| unit/ready | 233 | 100% | 0 / 233 / 0 / 0 / 0 / 0 |
| card/discard | 220 | 60% | 71 / 71 / 78 / 0 / 0 / 0 |
| gigValue/setGig | 178 | 9% | 0 / 0 / 9 / 37 / 46 / 86 |
| card/search | 167 | 60% | 0 / 64 / 92 / 11 / 0 / 0 |
| unit/sacrifice | 133 | 80% | 81 / 29 / 22 / 1 / 0 / 0 |
| card/defeat | 19 | 89% | 13 / 5 / 1 / 0 / 0 / 0 |
| yesno/draw | 18 | 100% | 0 / 18 / 0 / 0 / 0 / 0 |
| mode/rivalChoice | 5 | 0% | 0 / 5 / 0 / 0 / 0 / 0 |

Reaction windows: 2161 attacks. Reacted to 1212 (deck won 68% (65–72) n=810): stole 595, attackerGone 69, targetGone 495, bothGone 53. Let 949 resolve (76% (72–80) n=459): stole 878, attackerGone 1, targetGone 49, bothGone 21. Choices: call 782, endReact 1136, block 458, play 33.

## RRY Smasher Aggro — 1200 games, 61% won, 49861 decisions

| Card | Use | Uses | Win rate in games used (95%) | Legal turns → used | Not chosen | Early / mid / late uses | Ahead | Even | Behind |
|---|---|---|---|---|---|---|---|---|---|
| Animals Wrecker | attacked | 1642 | 73% (70–76) n=649 | 1519 → 1474 | 3% | 0 / 426 / 1216 | 87% (83–90) n=330 | 82% (76–86) n=196 | 68% (63–72) n=439 |
| Rockn' Rockerboy | attacked | 1630 | 69% (65–72) n=609 | 1675 → 1496 | 11% | 0 / 748 / 882 | 77% (73–81) n=426 | 71% (63–77) n=157 | 63% (57–68) n=329 |
| 6th Street Recruits | attacked | 1341 | 63% (59–67) n=582 | 1496 → 1246 | 17% | 176 / 481 / 684 | 80% (75–84) n=300 | 63% (56–69) n=234 | 53% (47–58) n=314 |
| Detonate | sold | 1003 | 60% (57–64) n=763 | 1254 → 1003 | 20% | 566 / 200 / 237 | 72% (67–76) n=392 | 56% (50–62) n=279 | 48% (41–54) n=206 |
| Animals Wrecker | played | 990 | 67% (63–70) n=758 | 1257 → 990 | 21% | 0 / 714 / 276 | 73% (68–78) n=311 | 70% (62–77) n=140 | 61% (56–66) n=412 |
| Rockn' Rockerboy | played | 949 | 62% (59–66) n=726 | 1600 → 949 | 41% | 473 / 221 / 255 | 74% (69–78) n=372 | 57% (52–63) n=280 | 47% (41–54) n=205 |
| 6th Street Recruits | played | 935 | 63% (59–66) n=716 | 1835 → 924 | 50% | 484 / 218 / 233 | 70% (65–75) n=358 | 59% (53–64) n=301 | 47% (40–55) n=165 |
| Zetatech Faceplate | sold | 924 | 58% (55–62) n=708 | 1750 → 924 | 47% | 297 / 353 / 274 | 63% (57–68) n=305 | 57% (51–64) n=209 | 51% (45–56) n=307 |
| Screw: Lovelorn Fool | attacked | 915 | 61% (57–66) n=455 | 1036 → 873 | 16% | 0 / 270 / 645 | 79% (74–84) n=267 | 72% (63–80) n=94 | 46% (39–52) n=224 |
| Mantis Blades | sold | 911 | 61% (57–64) n=717 | 1036 → 911 | 12% | 536 / 160 / 215 | 70% (65–74) n=364 | 54% (49–60) n=294 | 56% (49–64) n=163 |
| La Llorona: Ghost of the Past | played | 907 | 58% (54–61) n=706 | 2608 → 861 | 67% | 164 / 351 / 392 | 76% (71–81) n=292 | 51% (44–58) n=214 | 45% (39–51) n=288 |
| Meredith Stout: Stone Cold Corpo | played | 889 | 55% (52–59) n=675 | 2798 → 843 | 70% | 193 / 241 / 455 | 71% (65–76) n=258 | 47% (41–54) n=226 | 44% (39–50) n=281 |
| Bonnie and Clyde | sold | 850 | 62% (58–65) n=660 | 2649 → 850 | 68% | 128 / 371 / 351 | 70% (64–75) n=270 | 60% (52–68) n=141 | 53% (48–58) n=342 |
| Dum Dum: Maelstrom Triggerman | called | 837 | 60% (57–64) n=837 | 837 → 837 | 0% | 319 / 340 / 178 | 67% (63–71) n=550 | 50% (41–58) n=133 | 47% (40–55) n=154 |
| V: Streetkid | called | 835 | 60% (57–64) n=835 | 835 → 835 | 0% | 336 / 310 / 189 | 68% (64–72) n=576 | 40% (32–49) n=123 | 47% (39–55) n=136 |

(37 more card uses in the JSON report.)

| Decision type | Decisions | First-listed option taken | Options offered (1 / 2 / 3–5 / 6–10 / 11–20 / 21+) |
|---|---|---|---|
| main | 28585 | 8% | 0 / 2433 / 7146 / 9685 / 8963 / 358 |
| gig/steal | 6664 | 28% | 263 / 1069 / 3074 / 2241 / 17 / 0 |
| gig/rollIn | 4800 | 0% | 0 / 1200 / 3600 / 0 / 0 / 0 |
| react | 3480 | 53% | 0 / 2190 / 1283 / 7 / 0 / 0 |
| unit/defeat | 1859 | 67% | 707 / 508 / 619 / 25 / 0 / 0 |
| mulligan | 1200 | 27% | 0 / 1200 / 0 / 0 / 0 / 0 |
| card/search | 1088 | 70% | 524 / 252 / 240 / 72 / 0 / 0 |
| gigValue/adjust | 1019 | 9% | 0 / 15 / 103 / 44 / 320 / 537 |
| unit/pump | 406 | 43% | 109 / 123 / 171 / 3 / 0 / 0 |
| unit/equip | 241 | 83% | 40 / 73 / 113 / 15 / 0 / 0 |
| card/discard | 173 | 49% | 23 / 45 / 103 / 2 / 0 / 0 |
| unit/spend | 149 | 90% | 87 / 46 / 16 / 0 / 0 / 0 |
| unit/sacrifice | 123 | 79% | 78 / 24 / 21 / 0 / 0 / 0 |
| card/defeatGear | 41 | 98% | 0 / 37 / 4 / 0 / 0 / 0 |
| yesno/draw | 17 | 100% | 0 / 17 / 0 / 0 / 0 / 0 |
| card/defeat | 12 | 75% | 7 / 4 / 1 / 0 / 0 / 0 |
| mode/rivalChoice | 4 | 0% | 0 / 4 / 0 / 0 / 0 / 0 |

Reaction windows: 2966 attacks. Reacted to 1516 (deck won 55% (52–59) n=906): stole 550, attackerGone 30, targetGone 875, bothGone 61. Let 1450 resolve (59% (55–63) n=638): stole 1215, attackerGone 5, targetGone 179, bothGone 51. Choices: call 872, endReact 1830, block 767, ability 3, play 8.

## YYB Rogue Gear — 1200 games, 42% won, 54934 decisions

| Card | Use | Uses | Win rate in games used (95%) | Legal turns → used | Not chosen | Early / mid / late uses | Ahead | Even | Behind |
|---|---|---|---|---|---|---|---|---|---|
| Psycho Squad | attacked | 2017 | 48% (44–52) n=703 | 2067 → 1827 | 12% | 244 / 709 / 1064 | 62% (58–67) n=441 | 50% (45–55) n=320 | 37% (32–42) n=369 |
| V: Corporate Exile | attacked | 1810 | 43% (40–46) n=886 | 1959 → 1810 | 8% | 43 / 546 / 1221 | 63% (58–67) n=487 | 48% (42–55) n=205 | 30% (26–34) n=483 |
| Dying Night: V's Pistol | sold | 1252 | 41% (38–45) n=871 | 2406 → 1252 | 48% | 427 / 415 / 410 | 50% (46–55) n=443 | 37% (32–43) n=307 | 30% (25–35) n=303 |
| Zetatech Faceplate | sold | 1129 | 41% (37–44) n=822 | 3640 → 1129 | 69% | 144 / 392 / 593 | 54% (49–59) n=380 | 38% (32–45) n=194 | 27% (23–32) n=393 |
| Psycho Squad | played | 1109 | 46% (42–49) n=806 | 2008 → 1103 | 45% | 526 / 314 / 269 | 54% (49–58) n=418 | 43% (38–48) n=341 | 29% (23–36) n=181 |
| The Heist | sold | 1070 | 40% (37–44) n=796 | 1841 → 1070 | 42% | 431 / 346 / 293 | 48% (44–53) n=411 | 39% (33–45) n=256 | 27% (22–33) n=270 |
| V: Corporate Exile | called | 1001 | 42% (39–45) n=1001 | 1001 → 1001 | 0% | 549 / 325 / 127 | 47% (44–51) n=701 | 27% (21–33) n=201 | 36% (28–46) n=99 |
| Trauma Team Operatives | played | 973 | 41% (37–45) n=731 | 2206 → 935 | 58% | 10 / 330 / 633 | 60% (55–65) n=382 | 30% (22–39) n=113 | 23% (19–28) n=333 |
| Modded Kusanagi | played | 971 | 33% (29–36) n=581 | 2383 → 971 | 59% | 0 / 152 / 819 | 62% (56–68) n=222 | 42% (34–51) n=118 | 13% (10–16) n=392 |
| Trauma Team Operatives | attacked | 963 | 44% (40–49) n=500 | 939 → 875 | 7% | 0 / 108 / 855 | 71% (65–76) n=232 | 63% (54–71) n=124 | 27% (22–32) n=290 |
| Modded Kusanagi | attacked | 958 | 33% (29–37) n=576 | 971 → 958 | 1% | 0 / 149 / 809 | 63% (56–69) n=236 | 39% (31–48) n=117 | 10% (7–13) n=366 |
| River Ward: Detective on the Hunt | called | 940 | 41% (38–45) n=940 | 940 → 940 | 0% | 481 / 249 / 210 | 50% (46–53) n=645 | 23% (18–30) n=182 | 25% (18–33) n=113 |
| Viktor Vektor: Sit Down and Relax | called | 914 | 42% (39–45) n=914 | 914 → 914 | 0% | 484 / 250 / 180 | 47% (43–51) n=616 | 32% (26–39) n=197 | 26% (18–35) n=101 |
| Dexter DeShawn: One Last Chance | attacked | 906 | 45% (41–50) n=447 | 1145 → 856 | 25% | 81 / 320 / 505 | 59% (52–65) n=247 | 53% (45–61) n=157 | 35% (29–41) n=214 |
| Adrenaline Converter | sold | 858 | 41% (38–45) n=688 | 2311 → 858 | 63% | 313 / 260 / 285 | 49% (43–54) n=314 | 44% (37–50) n=232 | 28% (22–34) n=223 |

(35 more card uses in the JSON report.)

| Decision type | Decisions | First-listed option taken | Options offered (1 / 2 / 3–5 / 6–10 / 11–20 / 21+) |
|---|---|---|---|
| main | 30940 | 9% | 0 / 2537 / 7455 / 12713 / 7875 / 360 |
| gig/steal | 6333 | 37% | 594 / 1229 / 2232 / 2247 / 31 / 0 |
| gig/rollIn | 4800 | 100% | 0 / 1200 / 3600 / 0 / 0 / 0 |
| react | 4398 | 64% | 0 / 3393 / 1001 / 4 / 0 / 0 |
| gigValue/adjust | 2735 | 8% | 0 / 0 / 165 / 586 / 1613 / 371 |
| unit/equip | 1766 | 78% | 236 / 467 / 957 / 106 / 0 / 0 |
| card/search | 1408 | 85% | 22 / 851 / 535 / 0 / 0 / 0 |
| mulligan | 1200 | 18% | 0 / 1200 / 0 / 0 / 0 / 0 |
| card/trash | 452 | 54% | 0 / 452 / 0 / 0 / 0 / 0 |
| card/playFree | 379 | 91% | 266 / 105 / 8 / 0 / 0 / 0 |
| unit/sacrifice | 302 | 34% | 66 / 107 / 129 / 0 / 0 / 0 |
| card/discard | 143 | 50% | 29 / 27 / 81 / 6 / 0 / 0 |
| yesno/playFree | 28 | 100% | 0 / 28 / 0 / 0 / 0 / 0 |
| unit/protect | 25 | 40% | 5 / 12 / 8 / 0 / 0 / 0 |
| yesno/draw | 16 | 100% | 0 / 16 / 0 / 0 / 0 / 0 |
| mode/rivalChoice | 9 | 11% | 0 / 9 / 0 / 0 / 0 / 0 |

Reaction windows: 3875 attacks. Reacted to 1417 (deck won 39% (36–42) n=886): stole 427, attackerGone 10, targetGone 913, bothGone 59, noneGone 8. Let 2458 resolve (37% (33–40) n=764): stole 2081, attackerGone 1, targetGone 336, bothGone 40. Choices: block 812, call 634, endReact 2811, ability 108, play 33.

## The bot’s own scores against outcomes (calibration check)

> Association only, like the rest of this report: the deciding side's win rate over its decisions, by the margin the bot claimed for its choice (its value minus the best other option's, in Gigs), and by whether the deep rollouts kept the 1-ply screen's top pick. A big claimed margin often comes in positions that are already won or lost, so a rising win rate is not proof the margins are right; a flat one says they carry little. Intervals use the game count (decisions in one game are not independent); under 20 games a cell shows only its counts.

| Bot | Scores | Scored | <0 Gigs | 0–0.05 Gigs | 0.05–0.15 Gigs | 0.15–0.5 Gigs | 0.5–1 Gigs | 1+ Gigs |
|---|---|---|---|---|---|---|---|---|
| deep | main deep | 166759 | — | 50% (49–52) 66916 in 8388 games | 52% (51–53) 32355 in 8229 games | 54% (52–55) 21788 in 7833 games | 50% (48–51) 8989 in 5423 games | 55% (54–56) 36711 in 8290 games |
| deep | react 1ply | 21305 | 52% (38–66) 50 in 43 games | 37% (35–38) 6326 in 3846 games | 36% (34–39) 2192 in 1194 games | 45% (43–47) 4181 in 3241 games | 49% (46–51) 1820 in 1323 games | 46% (44–47) 6736 in 4143 games |

| Bot | Scores | Deep decisions | Rollouts kept the 1-ply pick | Rollouts overturned it | Overturned |
|---|---|---|---|---|---|
| deep | main deep | 166759 | 52% (51–53) 132365 in 8400 games | 51% (50–52) 34394 in 8287 games | 21% |
