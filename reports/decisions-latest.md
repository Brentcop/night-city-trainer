# Decision telemetry

4200 games, 374430 decisions (telemetry schema 1). Sim v5, deep bot, seed 1.

> Descriptive association only: win rates in games where a card was used a given way, with 95% Wilson intervals. They are not the value of the card or of the choice (no counterfactual comparison yet; ROADMAP §5 steps 3 and 5). A slice from fewer than 20 games shows only its count ("thin").

Stages: early turns 1–4, middle turns 5–8, late turn 9+. Ahead / even / behind: the acting player's Gig count against the rival's when the decision was made. "Not chosen": share of the turns (attacks, for reactions) in which the use was legal but not taken.

Measured: games 4200, recordsPerGame 89.2, rawBytesPerGame 54813.3, aggregateBytesPerGame 12363.2, mergedBytes 144567, seconds 936.3.

## BBG Cunningham Econ — 1200 games, 49% won, 57707 decisions

| Card | Use | Uses | Win rate in games used (95%) | Legal turns → used | Not chosen | Early / mid / late uses | Ahead | Even | Behind |
|---|---|---|---|---|---|---|---|---|---|
| Hanako Arasaka: Daughter of the Emperor | ability | 1463 | 38% (35–41) n=836 | 3852 → 1463 | 62% | 75 / 568 / 820 | 55% (50–59) n=470 | 31% (25–38) n=191 | 14% (11–18) n=450 |
| Alt Cunningham: Soulkiller Architect | ability | 1382 | 44% (41–48) n=845 | 3860 → 1368 | 65% | 48 / 450 / 884 | 63% (58–67) n=520 | 35% (28–43) n=145 | 16% (13–20) n=412 |
| Psycho Squad | attacked | 1364 | 55% (51–59) n=545 | 1329 → 1285 | 3% | 117 / 527 / 720 | 79% (74–83) n=303 | 70% (63–76) n=189 | 33% (28–38) n=304 |
| Peace Offering | sold | 1197 | 48% (45–51) n=868 | 1726 → 1197 | 31% | 574 / 296 / 327 | 52% (48–57) n=464 | 53% (47–58) n=318 | 27% (22–33) n=227 |
| Jacked-In Voodoo Boy | attacked | 1190 | 53% (48–57) n=545 | 1049 → 1021 | 3% | 113 / 306 / 771 | 74% (69–79) n=329 | 54% (46–61) n=164 | 26% (21–32) n=258 |
| Chrome Reverie | sold | 1190 | 47% (43–50) n=844 | 2066 → 1190 | 42% | 503 / 350 / 337 | 55% (50–59) n=455 | 51% (45–57) n=272 | 21% (16–26) n=275 |
| Floor It | sold | 1165 | 48% (44–51) n=840 | 1742 → 1165 | 33% | 497 / 327 / 341 | 56% (51–61) n=439 | 51% (46–57) n=310 | 29% (24–35) n=242 |
| Pepe Najarro: Working Doubles | attacked | 1149 | 55% (51–60) n=469 | 1123 → 1093 | 3% | 123 / 455 / 571 | 83% (78–87) n=249 | 66% (59–73) n=185 | 32% (27–38) n=245 |
| Jacked-In Voodoo Boy | played | 1106 | 49% (46–53) n=795 | 3982 → 1049 | 74% | 240 / 406 / 460 | 69% (64–73) n=465 | 44% (37–51) n=206 | 15% (11–20) n=240 |
| Jackie Welles: Pour One Out For Me | called | 955 | 50% (47–53) n=955 | 955 → 955 | 0% | 421 / 432 / 102 | 57% (54–61) n=660 | 43% (36–50) n=197 | 13% (8–21) n=98 |
| Alt Cunningham: Soulkiller Architect | called | 944 | 51% (48–54) n=944 | 944 → 944 | 0% | 440 / 424 / 80 | 58% (54–61) n=670 | 40% (34–47) n=205 | 17% (10–28) n=69 |
| Trust No One | sold | 944 | 50% (47–54) n=742 | 1422 → 944 | 34% | 352 / 297 / 295 | 61% (56–66) n=318 | 54% (48–60) n=289 | 33% (27–39) n=240 |
| Hanako Arasaka: Daughter of the Emperor | called | 940 | 49% (46–52) n=940 | 940 → 940 | 0% | 423 / 435 / 82 | 53% (50–57) n=666 | 41% (34–48) n=198 | 30% (21–41) n=76 |
| Mox Inciters | played | 886 | 44% (40–47) n=726 | 1851 → 871 | 53% | 283 / 325 / 278 | 52% (48–57) n=438 | 41% (34–47) n=222 | 16% (11–23) n=139 |
| Psycho Squad | played | 851 | 50% (46–54) n=709 | 2144 → 839 | 61% | 248 / 289 / 314 | 66% (61–71) n=343 | 58% (51–64) n=226 | 12% (8–17) n=204 |

(28 more card uses in the JSON report.)

| Decision type | Decisions | First-listed option taken | Options offered (1 / 2 / 3–5 / 6–10 / 11–20 / 21+) |
|---|---|---|---|
| main | 27473 | 5% | 0 / 2090 / 5865 / 12029 / 7207 / 282 |
| gig/rollIn | 4800 | 100% | 0 / 1200 / 3600 / 0 / 0 / 0 |
| gig/steal | 4591 | 32% | 226 / 1028 / 1955 / 1352 / 30 / 0 |
| gigValue/adjust | 3270 | 25% | 0 / 144 / 1069 / 1204 / 742 / 111 |
| card/search | 2867 | 59% | 0 / 715 / 2152 / 0 / 0 / 0 |
| unit/bottomdeck | 2316 | 81% | 1648 / 378 / 284 / 6 / 0 / 0 |
| react | 1855 | 6% | 0 / 1397 / 458 / 0 / 0 / 0 |
| card/discard | 1771 | 47% | 248 / 599 / 811 / 111 / 2 / 0 |
| gig/swapGive | 1463 | 37% | 51 / 192 / 840 / 379 / 1 / 0 |
| gig/swapTake | 1463 | 28% | 103 / 214 / 670 / 462 / 14 / 0 |
| mulligan | 1200 | 22% | 0 / 1200 / 0 / 0 / 0 / 0 |
| card/playFromTrash | 1058 | 68% | 495 / 292 / 255 / 16 / 0 / 0 |
| card/freePlay | 712 | 61% | 0 / 220 / 388 / 104 / 0 / 0 |
| yesno/discardFor | 637 | 100% | 0 / 637 / 0 / 0 / 0 / 0 |
| unit/mustAttack | 634 | 71% | 336 / 194 / 104 / 0 / 0 / 0 |
| unit/weaken | 477 | 72% | 258 / 141 / 77 / 1 / 0 / 0 |
| gigValue/setGig | 344 | 22% | 0 / 17 / 34 / 36 / 63 / 194 |
| unit/ready | 313 | 100% | 0 / 208 / 105 / 0 / 0 / 0 |
| mode/mode | 235 | 97% | 0 / 8 / 227 / 0 / 0 / 0 |
| unit/sacrifice | 84 | 98% | 64 / 13 / 7 / 0 / 0 / 0 |
| unit/cantAttack | 51 | 69% | 21 / 21 / 9 / 0 / 0 / 0 |
| card/discardForNothing | 45 | 0% | 0 / 6 / 24 / 15 / 0 / 0 |
| unit/call | 30 | 100% | 0 / 15 / 15 / 0 / 0 / 0 |
| yesno/draw | 18 | 100% | 0 / 18 / 0 / 0 / 0 / 0 |

Reaction windows: 1594 attacks. Reacted to 1539 (deck won 41% (38–44) n=910): stole 394, targetGone 1107, bothGone 38. Let 55 resolve (52% (39–65) n=52): stole 18, targetGone 30, bothGone 7. Choices: call 572, block 1119, endReact 115, play 49.

## GRY Trauma Team — 1200 games, 32% won, 54754 decisions

| Card | Use | Uses | Win rate in games used (95%) | Legal turns → used | Not chosen | Early / mid / late uses | Ahead | Even | Behind |
|---|---|---|---|---|---|---|---|---|---|
| V: Streetkid | attacked | 2127 | 32% (29–35) n=1097 | 2295 → 2127 | 7% | 192 / 968 / 967 | 47% (43–51) n=631 | 36% (30–43) n=214 | 18% (15–21) n=525 |
| Padre: Man of the Cross | ability | 1884 | 26% (24–29) n=982 | 4258 → 1884 | 56% | 72 / 614 / 1198 | 40% (36–44) n=563 | 21% (16–27) n=199 | 9% (7–11) n=619 |
| Muamar Reyes: El Capitán | ability | 1733 | 28% (25–31) n=971 | 4132 → 1733 | 58% | 83 / 515 / 1135 | 45% (41–49) n=545 | 27% (21–34) n=180 | 6% (4–8) n=573 |
| Meredith Stout: Stone Cold Corpo | played | 1217 | 32% (29–36) n=872 | 1866 → 1211 | 35% | 591 / 339 / 287 | 35% (31–39) n=520 | 35% (30–40) n=314 | 15% (11–21) n=172 |
| 6th Street Recruits | attacked | 1179 | 43% (39–48) n=458 | 1127 → 1087 | 4% | 49 / 390 / 740 | 66% (59–71) n=232 | 56% (48–64) n=162 | 27% (22–32) n=298 |
| Detonate | sold | 1142 | 31% (28–34) n=830 | 1629 → 1142 | 30% | 562 / 359 / 221 | 29% (25–34) n=398 | 38% (33–43) n=312 | 20% (16–26) n=246 |
| Pepe Najarro: Working Doubles | attacked | 1118 | 36% (31–40) n=461 | 1074 → 1028 | 4% | 44 / 373 / 701 | 61% (54–68) n=196 | 56% (48–64) n=139 | 22% (18–27) n=316 |
| V: Streetkid | Go Solo (self-paid 1111) | 1111 | 32% (29–35) n=1111 | 1677 → 1111 | 34% | 194 / 643 / 274 | 40% (36–44) n=523 | 33% (27–40) n=192 | 21% (17–25) n=396 |
| Trauma Team Operatives | attacked | 1109 | 36% (32–40) n=553 | 1019 → 990 | 3% | 1 / 227 / 881 | 71% (64–76) n=212 | 61% (51–69) n=104 | 21% (18–26) n=384 |
| Trauma Team Operatives | played | 1081 | 32% (28–35) n=786 | 2240 → 1015 | 55% | 54 / 421 / 606 | 46% (41–51) n=401 | 36% (29–45) n=138 | 14% (11–18) n=361 |
| Mantis Blades | sold | 1078 | 31% (28–34) n=793 | 1412 → 1078 | 24% | 568 / 258 / 252 | 31% (27–36) n=394 | 34% (29–40) n=311 | 20% (15–25) n=241 |
| The Heist | sold | 1072 | 32% (29–36) n=782 | 2316 → 1072 | 54% | 326 / 449 / 297 | 36% (31–41) n=360 | 39% (33–45) n=233 | 21% (17–26) n=329 |
| All is Lost | sold | 1042 | 34% (30–37) n=790 | 1540 → 1042 | 32% | 498 / 328 / 216 | 37% (32–43) n=326 | 38% (33–43) n=335 | 20% (15–26) n=223 |
| Augmented Negotiators | played | 1031 | 34% (31–37) n=788 | 2534 → 1015 | 60% | 377 / 210 / 444 | 43% (39–48) n=430 | 35% (30–41) n=295 | 13% (9–19) n=186 |
| V: Streetkid | called | 953 | 34% (31–37) n=953 | 953 → 953 | 0% | 548 / 367 / 38 | 35% (31–39) n=574 | 34% (29–40) n=267 | 33% (25–42) n=112 |

(29 more card uses in the JSON report.)

| Decision type | Decisions | First-listed option taken | Options offered (1 / 2 / 3–5 / 6–10 / 11–20 / 21+) |
|---|---|---|---|
| main | 30953 | 8% | 0 / 2029 / 6792 / 10794 / 10805 / 533 |
| gig/steal | 5399 | 30% | 354 / 802 / 2284 / 1865 / 94 / 0 |
| gig/rollIn | 4800 | 0% | 0 / 1200 / 3600 / 0 / 0 / 0 |
| react | 2406 | 11% | 0 / 1543 / 861 / 2 / 0 / 0 |
| gigValue/setGig | 2384 | 9% | 3 / 13 / 90 / 311 / 864 / 1103 |
| gigValue/adjust | 2333 | 15% | 0 / 0 / 42 / 235 / 1484 / 572 |
| mulligan | 1200 | 11% | 0 / 1200 / 0 / 0 / 0 / 0 |
| mode/mode | 1185 | 48% | 0 / 1185 / 0 / 0 / 0 / 0 |
| mode/muamarCall | 1163 | 65% | 0 / 1163 / 0 / 0 / 0 / 0 |
| card/search | 1089 | 77% | 593 / 281 / 167 / 45 / 3 / 0 |
| unit/protect | 697 | 64% | 316 / 272 / 108 / 1 / 0 / 0 |
| unit/spend | 689 | 77% | 420 / 167 / 102 / 0 / 0 / 0 |
| unit/equip | 155 | 66% | 24 / 27 / 87 / 17 / 0 / 0 |
| unit/sacrifice | 107 | 92% | 79 / 21 / 7 / 0 / 0 / 0 |
| yesno/draw | 106 | 100% | 0 / 106 / 0 / 0 / 0 / 0 |
| card/discard | 58 | 36% | 2 / 7 / 35 / 14 / 0 / 0 |
| unit/ready | 24 | 100% | 0 / 24 / 0 / 0 / 0 / 0 |
| card/defeat | 5 | 100% | 4 / 1 / 0 / 0 / 0 / 0 |
| yesno/playFree | 1 | 100% | 0 / 1 / 0 / 0 / 0 / 0 |

Reaction windows: 1960 attacks. Reacted to 1849 (deck won 27% (25–30) n=1033): stole 568, attackerGone 22, targetGone 1075, bothGone 74, noneGone 110. Let 111 resolve (33% (23–43) n=80): stole 47, targetGone 53, bothGone 11. Choices: call 914, block 1234, endReact 256, play 2.

## Rainbow Fixer Stuff — 1200 games, 50% won, 60133 decisions

| Card | Use | Uses | Win rate in games used (95%) | Legal turns → used | Not chosen | Early / mid / late uses | Ahead | Even | Behind |
|---|---|---|---|---|---|---|---|---|---|
| 6th Street Recruits | attacked | 2108 | 58% (54–61) n=763 | 1898 → 1823 | 4% | 53 / 794 / 1261 | 85% (81–88) n=372 | 74% (67–79) n=223 | 48% (44–52) n=541 |
| Pepe Najarro: Working Doubles | attacked | 1942 | 57% (53–60) n=705 | 1758 → 1697 | 3% | 49 / 711 / 1182 | 85% (81–89) n=344 | 67% (60–73) n=197 | 47% (43–51) n=516 |
| Padre: Man of the Cross | ability | 1714 | 49% (46–52) n=966 | 4687 → 1714 | 63% | 67 / 808 / 839 | 68% (64–72) n=497 | 42% (36–49) n=210 | 34% (30–38) n=562 |
| Wakako Okada: Peace and Harmony | ability | 1511 | 51% (47–54) n=933 | 4543 → 1511 | 67% | 51 / 651 / 809 | 72% (68–76) n=524 | 42% (35–49) n=189 | 29% (25–34) n=470 |
| Valentino Street Racer | attacked | 1452 | 60% (56–63) n=659 | 1397 → 1299 | 7% | 103 / 336 / 1013 | 85% (80–88) n=310 | 68% (61–74) n=217 | 46% (41–51) n=396 |
| Psycho Squad | attacked | 1401 | 61% (57–65) n=550 | 1358 → 1309 | 4% | 29 / 511 / 861 | 88% (83–91) n=279 | 73% (66–80) n=153 | 51% (45–56) n=370 |
| Detonate | sold | 1399 | 50% (47–53) n=924 | 1994 → 1399 | 30% | 626 / 450 / 323 | 55% (50–60) n=370 | 54% (49–60) n=347 | 42% (37–46) n=444 |
| 6th Street Recruits | played | 1316 | 52% (48–55) n=927 | 2794 → 1291 | 54% | 326 / 526 / 464 | 66% (61–70) n=427 | 61% (55–67) n=256 | 33% (29–38) n=411 |
| Synapse Burnout | sold | 1307 | 50% (47–53) n=902 | 1899 → 1307 | 31% | 541 / 462 / 304 | 53% (48–58) n=358 | 53% (48–59) n=318 | 44% (39–48) n=435 |
| Field Operator | attacked | 1301 | 59% (55–63) n=572 | 1271 → 1144 | 10% | 84 / 386 / 831 | 82% (77–86) n=268 | 66% (59–73) n=173 | 49% (44–54) n=359 |
| Pepe Najarro: Working Doubles | played | 1240 | 51% (48–55) n=879 | 2732 → 1225 | 55% | 289 / 527 / 424 | 68% (63–73) n=399 | 58% (51–64) n=234 | 34% (30–39) n=421 |
| Valentino Street Racer | played | 1184 | 56% (53–60) n=835 | 2731 → 1114 | 59% | 235 / 565 / 384 | 75% (70–79) n=355 | 56% (50–62) n=253 | 44% (39–49) n=375 |
| Mantis Blades | sold | 1144 | 50% (46–53) n=836 | 1816 → 1144 | 37% | 534 / 351 / 259 | 50% (44–55) n=306 | 54% (49–59) n=320 | 43% (38–48) n=372 |
| Field Operator | played | 1045 | 52% (49–56) n=771 | 2794 → 1004 | 64% | 274 / 357 / 414 | 69% (64–74) n=327 | 49% (43–55) n=246 | 38% (33–44) n=320 |
| Adam Smasher: Ender of Legends | attacked | 970 | 54% (50–57) n=756 | 987 → 970 | 2% | 0 / 0 / 970 | 84% (80–87) n=384 | 74% (64–81) n=106 | 21% (17–25) n=365 |

(30 more card uses in the JSON report.)

| Decision type | Decisions | First-listed option taken | Options offered (1 / 2 / 3–5 / 6–10 / 11–20 / 21+) |
|---|---|---|---|
| main | 32652 | 5% | 0 / 1703 / 7146 / 11784 / 11355 / 664 |
| gig/steal | 7210 | 26% | 190 / 673 / 3360 / 2909 / 78 / 0 |
| gig/rollIn | 4800 | 0% | 0 / 1200 / 3600 / 0 / 0 / 0 |
| mode/mode | 3157 | 63% | 0 / 2375 / 782 / 0 / 0 / 0 |
| gigValue/adjust | 2053 | 11% | 0 / 1 / 22 / 264 / 1149 / 617 |
| react | 1857 | 16% | 0 / 1215 / 625 / 17 / 0 / 0 |
| gigValue/setGig | 1682 | 14% | 2 / 16 / 68 / 349 / 714 / 533 |
| mulligan | 1200 | 6% | 0 / 1200 / 0 / 0 / 0 / 0 |
| unit/weaken | 1200 | 64% | 578 / 422 / 199 / 1 / 0 / 0 |
| unit/adrenaline | 1025 | 36% | 280 / 372 / 372 / 1 / 0 / 0 |
| unit/defeat | 752 | 34% | 52 / 137 / 529 / 34 / 0 / 0 |
| card/freePlay | 639 | 77% | 0 / 263 / 370 / 6 / 0 / 0 |
| unit/spend | 570 | 74% | 353 / 156 / 61 / 0 / 0 / 0 |
| unit/equip | 466 | 78% | 4 / 16 / 266 / 180 / 0 / 0 |
| card/playFree | 231 | 90% | 0 / 161 / 70 / 0 / 0 / 0 |
| card/discard | 202 | 46% | 30 / 34 / 125 / 13 / 0 / 0 |
| unit/cantAttack | 128 | 79% | 83 / 29 / 16 / 0 / 0 / 0 |
| unit/ready | 113 | 100% | 0 / 113 / 0 / 0 / 0 / 0 |
| unit/sacrifice | 84 | 86% | 54 / 13 / 15 / 2 / 0 / 0 |
| unit/call | 41 | 100% | 0 / 17 / 24 / 0 / 0 / 0 |
| unit/pump | 35 | 54% | 8 / 12 / 15 / 0 / 0 / 0 |
| card/defeat | 17 | 82% | 14 / 3 / 0 / 0 / 0 / 0 |
| yesno/draw | 17 | 100% | 0 / 17 / 0 / 0 / 0 / 0 |
| mode/rivalChoice | 2 | 0% | 0 / 2 / 0 / 0 / 0 / 0 |

Reaction windows: 1593 attacks. Reacted to 1406 (deck won 42% (39–45) n=890): stole 820, stoleNothing 14, attackerGone 9, targetGone 528, bothGone 35. Let 187 resolve (32% (24–41) n=117): stole 142, targetGone 33, bothGone 12. Choices: block 516, call 864, endReact 291, play 186.

## RRB Wakako Midrange — 1200 games, 40% won, 53672 decisions

| Card | Use | Uses | Win rate in games used (95%) | Legal turns → used | Not chosen | Early / mid / late uses | Ahead | Even | Behind |
|---|---|---|---|---|---|---|---|---|---|
| 6th Street Recruits | attacked | 1824 | 49% (45–52) n=650 | 1699 → 1607 | 5% | 99 / 664 / 1061 | 78% (73–83) n=294 | 62% (55–68) n=211 | 36% (31–40) n=469 |
| Wakako Okada: Peace and Harmony | ability | 1463 | 38% (35–41) n=882 | 4438 → 1463 | 67% | 116 / 547 / 800 | 59% (54–63) n=499 | 28% (22–35) n=181 | 16% (13–19) n=457 |
| Dexter DeShawn: Off the Grid | ability | 1400 | 41% (38–44) n=858 | 4568 → 1400 | 69% | 111 / 583 / 706 | 60% (56–65) n=518 | 27% (21–34) n=173 | 14% (11–18) n=395 |
| Mantis Blades | sold | 1238 | 40% (37–43) n=874 | 1437 → 1238 | 14% | 653 / 341 / 244 | 50% (45–54) n=428 | 38% (33–43) n=315 | 25% (20–30) n=296 |
| Detonate | sold | 1234 | 40% (37–43) n=867 | 1503 → 1234 | 18% | 708 / 314 / 212 | 46% (42–51) n=426 | 37% (32–43) n=342 | 35% (29–40) n=280 |
| Psycho Squad | attacked | 1202 | 51% (47–56) n=493 | 1188 → 1109 | 7% | 50 / 462 / 690 | 80% (75–85) n=243 | 63% (55–71) n=123 | 38% (33–44) n=339 |
| Yorinobu Arasaka: Steel Dragon | attacked | 1114 | 53% (49–57) n=564 | 1032 → 1009 | 2% | 0 / 0 / 1114 | 88% (83–92) n=229 | 79% (70–86) n=95 | 38% (34–43) n=391 |
| Yorinobu Arasaka: Steel Dragon | played | 1045 | 45% (42–49) n=815 | 1564 → 1045 | 33% | 0 / 550 / 495 | 69% (64–74) n=355 | 49% (39–59) n=90 | 27% (23–31) n=466 |
| Satori: Sword of Saburo | sold | 1018 | 42% (38–45) n=758 | 2834 → 1018 | 64% | 248 / 451 / 319 | 54% (48–59) n=316 | 44% (37–51) n=199 | 31% (26–35) n=376 |
| Dexter DeShawn: Off the Grid | called | 959 | 43% (40–46) n=959 | 959 → 959 | 0% | 536 / 367 / 56 | 50% (46–54) n=633 | 32% (26–38) n=221 | 27% (19–36) n=105 |
| Adam Smasher: Ender of Legends | called | 940 | 43% (40–46) n=940 | 940 → 940 | 0% | 514 / 348 / 78 | 50% (46–54) n=622 | 31% (25–38) n=207 | 26% (19–35) n=111 |
| 6th Street Recruits | played | 918 | 42% (38–45) n=706 | 2780 → 900 | 68% | 279 / 377 / 262 | 56% (51–62) n=306 | 45% (38–51) n=238 | 17% (13–23) n=247 |
| Wakako Okada: Peace and Harmony | called | 894 | 45% (42–48) n=894 | 894 → 894 | 0% | 518 / 329 / 47 | 50% (46–54) n=564 | 37% (31–43) n=222 | 34% (26–44) n=108 |
| Floor It | sold | 849 | 46% (42–50) n=679 | 1707 → 849 | 50% | 308 / 325 / 216 | 55% (49–61) n=261 | 42% (36–49) n=239 | 39% (33–45) n=260 |
| Jacked-In Voodoo Boy | played | 824 | 35% (32–39) n=635 | 3461 → 760 | 78% | 228 / 285 / 311 | 51% (45–57) n=266 | 29% (23–36) n=210 | 17% (13–22) n=219 |

(32 more card uses in the JSON report.)

| Decision type | Decisions | First-listed option taken | Options offered (1 / 2 / 3–5 / 6–10 / 11–20 / 21+) |
|---|---|---|---|
| main | 28312 | 6% | 0 / 2294 / 6576 / 12696 / 6630 / 116 |
| gig/steal | 5064 | 26% | 107 / 679 / 2144 / 2083 / 51 / 0 |
| gig/rollIn | 4800 | 0% | 0 / 1200 / 3600 / 0 / 0 / 0 |
| gigValue/adjust | 3577 | 11% | 0 / 19 / 228 / 653 / 2086 / 591 |
| mode/mode | 2830 | 63% | 0 / 2345 / 485 / 0 / 0 / 0 |
| react | 2065 | 7% | 0 / 1534 / 525 / 6 / 0 / 0 |
| unit/defeat | 1476 | 71% | 744 / 317 / 409 / 6 / 0 / 0 |
| mulligan | 1200 | 17% | 0 / 1200 / 0 / 0 / 0 / 0 |
| unit/weaken | 1002 | 75% | 600 / 289 / 113 / 0 / 0 / 0 |
| card/playFree | 967 | 51% | 0 / 255 / 676 / 36 / 0 / 0 |
| card/freePlay | 624 | 76% | 0 / 211 / 393 / 20 / 0 / 0 |
| unit/pump | 493 | 68% | 290 / 156 / 47 / 0 / 0 / 0 |
| card/discard | 370 | 72% | 27 / 203 / 139 / 1 / 0 / 0 |
| unit/equip | 277 | 81% | 12 / 58 / 157 / 50 / 0 / 0 |
| unit/bottomdeck | 241 | 58% | 52 / 78 / 111 / 0 / 0 / 0 |
| card/search | 147 | 62% | 0 / 70 / 73 / 4 / 0 / 0 |
| unit/cantAttack | 84 | 87% | 64 / 13 / 7 / 0 / 0 / 0 |
| unit/sacrifice | 76 | 89% | 57 / 14 / 4 / 1 / 0 / 0 |
| unit/call | 35 | 100% | 0 / 12 / 23 / 0 / 0 / 0 |
| yesno/draw | 15 | 100% | 0 / 15 / 0 / 0 / 0 / 0 |
| card/discardForNothing | 11 | 0% | 0 / 8 / 3 / 0 / 0 / 0 |
| card/defeat | 6 | 100% | 4 / 2 / 0 / 0 / 0 / 0 |

Reaction windows: 1805 attacks. Reacted to 1704 (deck won 34% (31–37) n=961): stole 519, stoleNothing 4, attackerGone 31, targetGone 1064, bothGone 84, noneGone 2. Let 101 resolve (46% (36–56) n=87): stole 29, attackerGone 1, targetGone 67, bothGone 4. Choices: block 1161, call 678, play 75, endReact 151.

## RRG Dexter Midrange — 1200 games, 71% won, 50827 decisions

| Card | Use | Uses | Win rate in games used (95%) | Legal turns → used | Not chosen | Early / mid / late uses | Ahead | Even | Behind |
|---|---|---|---|---|---|---|---|---|---|
| Dexter DeShawn: Off the Grid | ability | 1707 | 69% (66–72) n=965 | 4362 → 1707 | 61% | 162 / 583 / 962 | 83% (80–86) n=697 | 49% (41–56) n=158 | 40% (35–45) n=367 |
| 6th Street Recruits | attacked | 1420 | 76% (72–79) n=564 | 1349 → 1265 | 6% | 84 / 605 / 731 | 91% (88–94) n=367 | 78% (71–84) n=174 | 62% (57–67) n=310 |
| Pepe Najarro: Working Doubles | attacked | 1405 | 77% (73–80) n=551 | 1381 → 1269 | 8% | 80 / 597 / 728 | 93% (90–95) n=349 | 81% (74–86) n=181 | 67% (62–72) n=316 |
| Animals Wrecker | attacked | 1293 | 84% (81–87) n=574 | 1195 → 1181 | 1% | 0 / 361 / 932 | 97% (94–98) n=351 | 88% (81–93) n=120 | 79% (75–83) n=371 |
| Detonate | sold | 1194 | 70% (67–73) n=859 | 1634 → 1194 | 27% | 598 / 356 / 240 | 77% (73–81) n=402 | 68% (63–73) n=330 | 60% (54–65) n=287 |
| Synapse Burnout | sold | 1157 | 70% (66–73) n=822 | 1589 → 1157 | 27% | 596 / 372 / 189 | 75% (71–79) n=377 | 68% (62–72) n=320 | 65% (59–71) n=271 |
| Meredith Stout: Stone Cold Corpo | played | 1122 | 67% (63–70) n=849 | 1520 → 1119 | 26% | 707 / 274 / 141 | 71% (67–75) n=501 | 66% (61–71) n=345 | 37% (29–47) n=115 |
| Mantis Blades | sold | 1088 | 69% (66–72) n=803 | 1422 → 1088 | 23% | 544 / 317 / 227 | 75% (70–79) n=376 | 67% (61–72) n=285 | 59% (53–65) n=286 |
| Yorinobu Arasaka: Steel Dragon | attacked | 1037 | 83% (80–86) n=585 | 973 → 951 | 2% | 0 / 0 / 1037 | 98% (96–99) n=344 | 89% (82–94) n=102 | 72% (67–76) n=329 |
| Yorinobu Arasaka: Steel Dragon | played | 1013 | 74% (71–77) n=792 | 1378 → 1013 | 26% | 0 / 551 / 462 | 89% (85–91) n=437 | 67% (56–76) n=79 | 59% (53–64) n=358 |
| Dexter DeShawn: Off the Grid | called | 957 | 72% (69–75) n=957 | 957 → 957 | 0% | 576 / 303 / 78 | 77% (73–80) n=647 | 67% (60–73) n=220 | 57% (46–66) n=90 |
| Animals Wrecker | played | 950 | 73% (70–76) n=748 | 1826 → 950 | 48% | 0 / 605 / 345 | 84% (80–87) n=392 | 69% (60–77) n=120 | 60% (54–65) n=314 |
| Meredith Stout: Stone Cold Corpo | attacked | 949 | 77% (73–80) n=499 | 1500 → 909 | 39% | 155 / 505 / 289 | 89% (85–92) n=310 | 71% (64–77) n=202 | 63% (55–71) n=147 |
| Satori: Sword of Saburo | sold | 936 | 72% (68–75) n=727 | 2522 → 936 | 63% | 209 / 414 / 313 | 82% (77–86) n=301 | 72% (65–78) n=198 | 64% (59–69) n=342 |
| Saburo Arasaka: Stubborn Patriarch | called | 925 | 72% (69–75) n=925 | 925 → 925 | 0% | 519 / 286 / 120 | 76% (72–79) n=644 | 66% (59–73) n=184 | 55% (45–64) n=97 |

(28 more card uses in the JSON report.)

| Decision type | Decisions | First-listed option taken | Options offered (1 / 2 / 3–5 / 6–10 / 11–20 / 21+) |
|---|---|---|---|
| main | 27588 | 7% | 0 / 2335 / 6672 / 12027 / 6407 / 147 |
| gig/steal | 7734 | 31% | 391 / 1135 / 3995 / 2191 / 22 / 0 |
| gig/rollIn | 4800 | 0% | 0 / 1200 / 3600 / 0 / 0 / 0 |
| gigValue/adjust | 2304 | 14% | 0 / 6 / 122 / 410 / 1281 / 485 |
| react | 1831 | 15% | 0 / 1327 / 499 / 5 / 0 / 0 |
| unit/defeat | 1450 | 65% | 601 / 375 / 464 / 10 / 0 / 0 |
| mulligan | 1200 | 14% | 0 / 1200 / 0 / 0 / 0 / 0 |
| mode/mode | 1165 | 43% | 0 / 1165 / 0 / 0 / 0 / 0 |
| card/playFree | 922 | 55% | 0 / 277 / 622 / 23 / 0 / 0 |
| unit/pump | 504 | 60% | 244 / 162 / 97 / 1 / 0 / 0 |
| gigValue/setGig | 406 | 14% | 0 / 0 / 54 / 151 / 109 / 92 |
| unit/equip | 290 | 84% | 25 / 67 / 155 / 43 / 0 / 0 |
| card/search | 204 | 69% | 0 / 111 / 83 / 10 / 0 / 0 |
| card/discard | 161 | 49% | 26 / 36 / 98 / 1 / 0 / 0 |
| unit/ready | 133 | 100% | 0 / 133 / 0 / 0 / 0 / 0 |
| unit/sacrifice | 115 | 90% | 85 / 18 / 11 / 1 / 0 / 0 |
| yesno/draw | 15 | 100% | 0 / 15 / 0 / 0 / 0 / 0 |
| card/defeat | 5 | 100% | 4 / 1 / 0 / 0 / 0 / 0 |

Reaction windows: 1600 attacks. Reacted to 1422 (deck won 64% (61–67) n=857): stole 485, attackerGone 52, targetGone 801, bothGone 84. Let 178 resolve (62% (53–69) n=133): stole 101, targetGone 69, bothGone 8. Choices: call 640, endReact 276, block 894, play 21.

## RRY Smasher Aggro — 1200 games, 50% won, 46261 decisions

| Card | Use | Uses | Win rate in games used (95%) | Legal turns → used | Not chosen | Early / mid / late uses | Ahead | Even | Behind |
|---|---|---|---|---|---|---|---|---|---|
| V: Streetkid | attacked | 1776 | 45% (41–48) n=955 | 1845 → 1776 | 4% | 178 / 835 / 763 | 58% (54–61) n=653 | 36% (30–44) n=170 | 25% (20–30) n=331 |
| Animals Wrecker | attacked | 1051 | 63% (59–67) n=511 | 985 → 969 | 2% | 0 / 209 / 842 | 88% (84–92) n=257 | 79% (70–85) n=112 | 51% (45–56) n=321 |
| 6th Street Recruits | attacked | 991 | 58% (53–63) n=376 | 963 → 933 | 3% | 57 / 432 / 502 | 77% (71–82) n=229 | 67% (59–74) n=156 | 42% (35–49) n=204 |
| Rockn' Rockerboy | attacked | 987 | 57% (52–62) n=425 | 954 → 923 | 3% | 0 / 333 / 654 | 87% (82–90) n=233 | 72% (62–80) n=90 | 38% (33–44) n=268 |
| Detonate | sold | 972 | 50% (46–53) n=746 | 1228 → 972 | 21% | 573 / 220 / 179 | 55% (50–60) n=392 | 48% (43–54) n=286 | 35% (28–42) n=170 |
| Zetatech Faceplate | sold | 966 | 47% (44–51) n=727 | 1848 → 966 | 48% | 303 / 395 / 268 | 55% (49–60) n=354 | 50% (44–57) n=225 | 35% (30–41) n=262 |
| Dum Dum: Maelstrom Triggerman | called | 964 | 50% (46–53) n=964 | 964 → 964 | 0% | 467 / 418 / 79 | 53% (49–56) n=693 | 41% (34–48) n=213 | 47% (34–59) n=58 |
| Adam Smasher: Ender of Legends | called | 963 | 51% (47–54) n=963 | 963 → 963 | 0% | 457 / 426 / 80 | 55% (52–59) n=693 | 40% (34–46) n=221 | 31% (20–45) n=49 |
| V: Streetkid | Go Solo (self-paid 957) | 957 | 45% (41–48) n=957 | 1790 → 957 | 47% | 184 / 525 / 248 | 55% (51–60) n=537 | 32% (25–39) n=158 | 30% (25–36) n=262 |
| V: Streetkid | called | 948 | 51% (48–55) n=948 | 948 → 948 | 0% | 542 / 346 / 60 | 59% (55–62) n=625 | 37% (31–44) n=244 | 39% (29–50) n=79 |
| Meredith Stout: Stone Cold Corpo | played | 944 | 44% (40–47) n=721 | 1897 → 940 | 50% | 496 / 257 / 191 | 47% (42–52) n=425 | 46% (40–52) n=278 | 16% (10–25) n=104 |
| Mantis Blades | sold | 932 | 50% (46–53) n=730 | 1054 → 932 | 12% | 542 / 211 / 179 | 54% (49–59) n=364 | 51% (45–57) n=296 | 34% (28–42) n=172 |
| La Llorona: Ghost of the Past | played | 863 | 48% (44–51) n=692 | 2274 → 838 | 63% | 342 / 172 / 349 | 57% (52–62) n=377 | 44% (39–50) n=286 | 14% (9–22) n=104 |
| Animals Wrecker | played | 855 | 52% (48–55) n=689 | 1605 → 855 | 47% | 0 / 509 / 346 | 69% (64–74) n=368 | 55% (45–64) n=106 | 28% (23–34) n=290 |
| Bonnie and Clyde | sold | 833 | 50% (46–53) n=647 | 2773 → 833 | 70% | 131 / 351 / 351 | 59% (54–65) n=304 | 55% (47–62) n=161 | 32% (26–38) n=268 |

(37 more card uses in the JSON report.)

Legal but never taken: Adam Smasher: Ender of Legends (Legend play, legal in 328 turns), Detonate (reaction, legal in 52 turns).

| Decision type | Decisions | First-listed option taken | Options offered (1 / 2 / 3–5 / 6–10 / 11–20 / 21+) |
|---|---|---|---|
| main | 26294 | 7% | 0 / 2435 / 5859 / 10039 / 7763 / 198 |
| gig/steal | 6394 | 32% | 462 / 1139 / 2974 / 1754 / 65 / 0 |
| gig/rollIn | 4800 | 0% | 0 / 1200 / 3600 / 0 / 0 / 0 |
| react | 3193 | 47% | 0 / 2375 / 814 / 4 / 0 / 0 |
| unit/defeat | 1485 | 73% | 804 / 303 / 347 / 31 / 0 / 0 |
| mulligan | 1200 | 27% | 0 / 1200 / 0 / 0 / 0 / 0 |
| gigValue/adjust | 1032 | 8% | 0 / 16 / 120 / 124 / 288 / 484 |
| card/search | 940 | 75% | 524 / 224 / 166 / 26 / 0 / 0 |
| unit/pump | 459 | 39% | 115 / 188 / 156 / 0 / 0 / 0 |
| card/discard | 115 | 32% | 2 / 6 / 82 / 25 / 0 / 0 |
| unit/sacrifice | 111 | 93% | 92 / 13 / 6 / 0 / 0 / 0 |
| unit/equip | 108 | 81% | 10 / 24 / 69 / 5 / 0 / 0 |
| unit/spend | 83 | 98% | 74 / 9 / 0 / 0 / 0 / 0 |
| yesno/draw | 26 | 100% | 0 / 26 / 0 / 0 / 0 / 0 |
| card/defeatGear | 20 | 95% | 0 / 16 / 4 / 0 / 0 / 0 |
| card/defeat | 1 | 100% | 1 / 0 / 0 / 0 / 0 / 0 |

Reaction windows: 2693 attacks. Reacted to 1445 (deck won 43% (40–46) n=914): stole 377, attackerGone 6, targetGone 1000, bothGone 61, noneGone 1. Let 1248 resolve (43% (39–48) n=457): stole 1040, targetGone 165, bothGone 43. Choices: block 1043, call 642, endReact 1501, ability 7.

## YYB Rogue Gear — 1200 games, 58% won, 51076 decisions

| Card | Use | Uses | Win rate in games used (95%) | Legal turns → used | Not chosen | Early / mid / late uses | Ahead | Even | Behind |
|---|---|---|---|---|---|---|---|---|---|
| V: Corporate Exile | attacked | 3250 | 60% (57–63) n=1116 | 3338 → 3250 | 3% | 320 / 1617 / 1313 | 68% (64–71) n=875 | 60% (55–65) n=358 | 41% (36–46) n=411 |
| Modded Kusanagi | played | 1365 | 45% (41–49) n=566 | 2025 → 1365 | 33% | 0 / 477 / 888 | 53% (48–58) n=440 | 39% (31–47) n=132 | 10% (7–14) n=281 |
| Modded Kusanagi | attacked | 1360 | 45% (41–49) n=566 | 1364 → 1360 | 0% | 0 / 472 / 888 | 53% (48–58) n=447 | 39% (31–47) n=124 | 9% (6–13) n=274 |
| Psycho Squad | attacked | 1354 | 68% (64–72) n=514 | 1317 → 1255 | 5% | 96 / 547 / 711 | 79% (75–83) n=380 | 69% (62–75) n=209 | 45% (38–52) n=200 |
| Dying Night: V's Pistol | sold | 1247 | 56% (52–59) n=871 | 2451 → 1247 | 49% | 424 / 452 / 371 | 63% (59–67) n=464 | 54% (48–59) n=314 | 33% (28–39) n=244 |
| V: Corporate Exile | Go Solo (self-paid 1118) | 1118 | 60% (57–62) n=1118 | 1331 → 1118 | 16% | 321 / 649 / 148 | 64% (60–68) n=638 | 61% (55–66) n=286 | 43% (36–50) n=194 |
| V: Corporate Exile | called | 1064 | 60% (57–63) n=1064 | 1064 → 1064 | 0% | 697 / 316 / 51 | 60% (56–64) n=655 | 64% (59–69) n=362 | 32% (20–46) n=47 |
| The Heist | sold | 1007 | 57% (54–61) n=760 | 1769 → 1007 | 43% | 431 / 356 / 220 | 61% (56–66) n=422 | 60% (54–65) n=280 | 40% (33–47) n=172 |
| River Ward: Detective on the Hunt | called | 1001 | 57% (54–60) n=1001 | 1001 → 1001 | 0% | 558 / 365 / 78 | 60% (56–63) n=693 | 51% (45–57) n=277 | 45% (29–62) n=31 |
| Zetatech Faceplate | sold | 987 | 52% (48–56) n=712 | 3702 → 987 | 73% | 138 / 369 / 480 | 62% (57–67) n=381 | 52% (45–59) n=204 | 27% (22–33) n=253 |
| Viktor Vektor: Sit Down and Relax | called | 966 | 58% (55–61) n=966 | 966 → 966 | 0% | 552 / 340 / 74 | 61% (57–64) n=641 | 56% (50–61) n=293 | 41% (26–58) n=32 |
| Adrenaline Converter | sold | 900 | 55% (52–59) n=703 | 2602 → 900 | 65% | 316 / 323 / 261 | 61% (56–66) n=367 | 59% (53–65) n=243 | 33% (26–40) n=175 |
| Psycho Squad | played | 811 | 66% (62–70) n=645 | 2824 → 796 | 72% | 290 / 243 / 278 | 73% (69–78) n=377 | 62% (56–68) n=236 | 32% (23–43) n=81 |
| Dexter DeShawn: One Last Chance | attacked | 787 | 62% (57–67) n=354 | 830 → 767 | 8% | 137 / 352 / 298 | 74% (68–80) n=219 | 66% (58–72) n=166 | 44% (36–52) n=137 |
| Safety Override | sold | 733 | 56% (52–60) n=609 | 1392 → 733 | 47% | 274 / 269 / 190 | 62% (57–67) n=332 | 56% (49–62) n=200 | 38% (30–46) n=135 |

(35 more card uses in the JSON report.)

Legal but never taken: Safety Override (played, legal in 1389 turns), Reboot Optics (played, legal in 1288 turns).

| Decision type | Decisions | First-listed option taken | Options offered (1 / 2 / 3–5 / 6–10 / 11–20 / 21+) |
|---|---|---|---|
| main | 29142 | 8% | 0 / 2826 / 6742 / 12339 / 7070 / 165 |
| gig/steal | 6632 | 42% | 713 / 1442 / 2963 / 1438 / 76 / 0 |
| gig/rollIn | 4800 | 100% | 0 / 1200 / 3600 / 0 / 0 / 0 |
| react | 3676 | 65% | 0 / 3002 / 668 / 6 / 0 / 0 |
| gigValue/adjust | 2038 | 10% | 0 / 0 / 234 / 451 / 1127 / 226 |
| card/search | 1377 | 84% | 14 / 826 / 537 / 0 / 0 / 0 |
| mulligan | 1200 | 18% | 0 / 1200 / 0 / 0 / 0 / 0 |
| unit/equip | 1153 | 72% | 144 / 211 / 752 / 46 / 0 / 0 |
| unit/sacrifice | 337 | 42% | 72 / 135 / 130 / 0 / 0 / 0 |
| card/trash | 280 | 55% | 0 / 280 / 0 / 0 / 0 / 0 |
| card/playFree | 267 | 90% | 183 / 76 / 8 / 0 / 0 / 0 |
| card/discard | 134 | 28% | 10 / 17 / 72 / 35 / 0 / 0 |
| yesno/draw | 15 | 100% | 0 / 15 / 0 / 0 / 0 / 0 |
| unit/protect | 11 | 73% | 7 / 2 / 2 / 0 / 0 / 0 |
| yesno/playFree | 11 | 100% | 0 / 11 / 0 / 0 / 0 / 0 |
| mode/rivalChoice | 3 | 0% | 0 / 3 / 0 / 0 / 0 / 0 |

Reaction windows: 3249 attacks. Reacted to 1125 (deck won 53% (50–57) n=802): stole 395, attackerGone 3, targetGone 694, bothGone 28, noneGone 5. Let 2124 resolve (44% (40–48) n=673): stole 2015, targetGone 99, bothGone 10. Choices: ability 57, endReact 2406, block 714, call 483, play 16.
