"""Tests for tools/import_outside_meta.py, on small made-up pages shaped like the sim site's meta reports (never real page
text). No test touches the network: the fetch function and the clock are handed in, as in test_import_decks.py.

Run from the repository root:
  python -m unittest discover -s tools -p "test_*.py"
"""

import io
import json
import os
import sys
import tempfile
import unittest

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import import_outside_meta as om  # noqa: E402
from test_import_decks import fetcher_for  # noqa: E402

SEASON_URL = "https://cyberpunk-tcg-sim.online/meta/made-up-season"
CUP_URL = "https://cyberpunk-tcg-sim.online/meta/made-up-cup"


def metric(label, value, detail=""):
    return (
        '<article class="metric"><span class="metric__label">' + label + '</span><strong class="metric__value">' + value + "</strong>"
        + ('<span class="metric__detail">' + detail + "</span>" if detail else "")
        + "</article>"
    )


def art(title):
    return '<span class="deck-legend-art" title="' + title + '"><img src="/media/x.webp" alt=""></span>'


def ranked(n, trio, tier, line):
    return (
        '<article class="report-rank panel"><div class="report-rank__head"><span class="report-rank__number">' + str(n) + "</span>"
        '<span class="deck-legend-artwork">' + art("Alpha: One") + "</span>"
        '<div class="report-rank__title"><h3>' + trio + ' <span class="report-tier report-tier--' + str(tier) + '" title="Tier ' + str(tier) + '">Tier ' + str(tier) + "</span></h3>"
        "<p>" + line + "</p></div></div><p>Some words about the deck.</p></article>"
    )


SEASON = (
    '<html><head><title>Made-up Season Report</title><link rel="canonical" href="' + SEASON_URL + '">'
    '<meta property="article:published_time" content="2026-11-15T10:00:00.000Z"></head><body><main>'
    '<p class="eyebrow">Ranked season report · Dec 5 – Feb 1, 2027</p><h1 id="report-title">Made-up <span>meta report</span></h1>'
    '<p class="hero__lede">Tier list from 1,500 high-rank Ranked games.</p>'
    + metric("Ranked series", "2,345", "5,000 games") + metric("Players", "400", "70 qualified for the ladder") + metric("Legend trios played", "99", "Top 10 = 40% of high-rank decks")
    + "<p>Deck rankings use the 700 high-rank series.</p>"
    '<svg><g><title>Alpha: 40.0% of high-rank decks · 51.0% win rate</title></g>'
    "<g><title>Alpha + Beta: 30.0% of high-rank decks · 50.0% win rate</title></g>"
    "<g><title>Alpha + Beta + Gamma: Gee: 20.5% of high-rank decks · 52.5% win rate</title></g>"
    "<g><title>Alpha + Beta + Other: 9.5% of high-rank decks · 47.0% win rate</title></g>"
    "<g><title>Delta + Epsilon &amp; Co + Zeta: 4.0% of high-rank decks · 49.0% win rate</title></g>"
    "<g><title>Other: 20.0% of high-rank decks · 48.0% win rate</title></g></svg>"
    '<div><strong>3,000</strong><span>high-rank decks</span></div>'
    + ranked(1, "Alpha / Beta / Gamma: Gee", 1, "52.5% win rate · 1,050–950 · 20.5% of decks · 99 players · 9.8 min per game")
    + ranked(2, "Delta / Eta / Theta", 2, "51.9% win rate · 140–130 · 1.2% of decks · 20 players · 9.0 min per game")
    + ranked(3, "Broken / Row", 2, "50% win rate")
    + '<table><tbody><tr><th scope="row">Alpha / Beta / Gamma: Gee</th>'
    '<td><div class="matrix-cell matrix-cell--even matrix-cell--diagonal"><strong>50%</strong><small>Mirror</small></div></td>'
    '<td><div class="matrix-cell matrix-cell--up" tabindex="0" title="Alpha / Beta / Gamma: Gee against Delta / Eta / Theta: 60.0%, 30–20 over 50 games"><strong>60.0%</strong></div></td>'
    '<td><div class="matrix-cell matrix-cell--none" title="Alpha / Beta / Gamma: Gee against Iota / Kappa / Lambda: fewer than 20 games"><strong>—</strong></div></td>'
    "</tr></tbody></table>"
    "<p>Final leaderboard: #1 SomePlayer Alpha / Beta / Gamma: Gee · 10–2</p>"
    "</main></body></html>"
)


def field_row(trio, players, pct, wr, rec, top, best):
    return (
        '<tr><th scope="row"><span class="tour-field__deck"><span class="deck-legend-artwork">' + art("Alpha: One") + "</span><span>" + trio + "</span></span></th>"
        '<td><span class="tour-field__share"><span class="report-legend__bar" aria-hidden="true"><i style="width:50%"></i></span><span>' + str(players) + " <small>(" + pct + ")</small></span></span></td>"
        '<td class="wr">' + wr + "</td><td>" + rec + "</td><td>" + top + "</td><td>" + best + "</td></tr>"
    )


def standing(place, player, trio):
    return '<tr class="is-top"><td class="tour-table__place">' + str(place) + '</td><th scope="row">' + player + "</th><td>" + trio + "</td><td>5–1</td><td>100</td></tr>"


CUP = (
    '<html><head><title>Made-up Cup</title><meta property="og:url" content="' + CUP_URL + '"></head><body>'
    '<p class="eyebrow">Tournament report · Nov 7, 2026</p><h1 id="report-title">Made-up Cup <span>meta report</span></h1>'
    + metric("Players", "20", "50 registered") + metric("Rounds", "5 + top 4", "Swiss rounds best-of-one, top cut best-of-three") + metric("Games played", "60", "50 Swiss matches") + metric("Legend trios", "9", "Different trios registered")
    + '<table class="tour-table"><thead><tr><th scope="col">Legend trio</th></tr></thead><tbody>'
    + field_row("Alpha / Beta / Gamma: Gee", 8, "40%", "55.0%", "11–9", '<b class="tour-field__top">2</b>', "1st")
    + field_row("Delta / Eta / Theta", 3, "15%", "40.0%", "4–6", "—", "12th")
    + "</tbody></table>"
    '<table class="tour-table tour-table--standings"><thead><tr><th scope="col">#</th></tr></thead><tbody>'
    + standing(1, "PlayerOne", "Alpha / Beta / Gamma: Gee") + standing(2, "PlayerTwo", "Delta / Eta / Theta") + standing(3, "PlayerThree", "Alpha / Beta / Gamma: Gee") + standing(4, "PlayerFour", "Alpha / Beta / Gamma: Gee")
    + standing(5, "PlayerFive", "Delta / Eta / Theta")
    + "</tbody></table></body></html>"
)


def load(path):
    with open(path, encoding="utf-8") as f:
        return json.load(f)


class Readers(unittest.TestCase):
    def test_numbers_and_dates(self):
        self.assertEqual(om.number("35,662"), 35662)
        self.assertEqual(om.number("4.3"), 4.3)
        self.assertIsNone(om.number("lots"))
        self.assertEqual(om.record("1,063–903"), (1063, 903))
        self.assertIsNone(om.record("1063 to 903"))
        self.assertEqual(om.read_period("Ranked season report · Sep 5 – Nov 15, 2026"), ("2026-09-05", "2026-11-15"))
        self.assertEqual(om.read_period("Dec 5 – Feb 1, 2027"), ("2026-12-05", "2027-02-01"))
        self.assertEqual(om.read_period("Tournament report · Nov 7, 2026"), ("2026-11-07", "2026-11-07"))
        self.assertEqual(om.read_period("someday"), ("", ""))

    def test_trio_names(self):
        self.assertEqual(om.trio_names("A / B: Sub / C"), ["A", "B: Sub", "C"])
        self.assertIsNone(om.trio_names("A / B"))
        self.assertIsNone(om.trio_names("A / B / Other"))


class Season(unittest.TestCase):
    def setUp(self):
        self.page = om.read_report(SEASON, SEASON_URL)

    def test_kind_dates_totals(self):
        p = self.page
        self.assertEqual(p["kind"], "season")
        self.assertEqual(p["period"], {"from": "2026-12-05", "to": "2027-02-01"})
        self.assertEqual(p["published"], "2026-11-15T10:00:00.000Z")
        self.assertEqual(p["title"], "Made-up meta report")
        self.assertEqual(p["totals"], {"series": 2345, "games": 5000, "players": 400, "qualified": 70, "trios": 99, "highRankSeries": 700, "highRankGames": 1500, "highRankDecks": 3000})

    def test_legend_map_keeps_whole_trios_only(self):
        self.assertEqual(
            self.page["field"],
            [
                {"trio": ["Alpha", "Beta", "Gamma: Gee"], "share": 20.5, "winRate": 52.5},
                {"trio": ["Delta", "Epsilon & Co", "Zeta"], "share": 4.0, "winRate": 49.0},
            ],
        )

    def test_power_rankings(self):
        tiers = self.page["tiers"]
        self.assertEqual([t["rank"] for t in tiers], [1, 2])
        self.assertEqual(tiers[0], {"rank": 1, "trio": ["Alpha", "Beta", "Gamma: Gee"], "tier": 1, "winRate": 52.5, "wins": 1050, "losses": 950, "share": 20.5, "players": 99})
        self.assertTrue(any("ranked deck 3" in n for n in self.page["notes"]))

    def test_matchups_with_a_win_rate_only(self):
        self.assertEqual(self.page["matchups"], [{"trio": ["Alpha", "Beta", "Gamma: Gee"], "vs": ["Delta", "Eta", "Theta"], "winRate": 60.0, "wins": 30, "losses": 20}])

    def test_no_player_names(self):
        self.assertNotIn("SomePlayer", json.dumps(self.page))


class Tournament(unittest.TestCase):
    def setUp(self):
        self.page = om.read_report(CUP, CUP_URL)

    def test_totals(self):
        self.assertEqual(self.page["kind"], "tournament")
        self.assertEqual(self.page["date"], "2026-11-07")
        self.assertEqual(self.page["totals"], {"players": 20, "registered": 50, "rounds": 5, "topCut": 4, "swissBestOf": 1, "topCutBestOf": 3, "games": 60, "trios": 9})

    def test_field(self):
        self.assertEqual(
            self.page["field"],
            [
                {"trio": ["Alpha", "Beta", "Gamma: Gee"], "players": 8, "winRate": 55.0, "wins": 11, "losses": 9, "top8": 2, "best": 1},
                {"trio": ["Delta", "Eta", "Theta"], "players": 3, "winRate": 40.0, "wins": 4, "losses": 6, "top8": 0, "best": 12},
            ],
        )

    def test_top_cut_by_place_without_players(self):
        self.assertEqual([r["place"] for r in self.page["topCut"]], [1, 2, 3, 4])
        self.assertEqual(self.page["topCut"][1]["trio"], ["Delta", "Eta", "Theta"])
        self.assertNotIn("PlayerOne", json.dumps(self.page))

    def test_not_a_report(self):
        with self.assertRaises(om.FetchFailed):
            om.read_report("<html><p class=\"eyebrow\">Something else</p></html>", CUP_URL)


class Links(unittest.TestCase):
    def test_only_sim_reports(self):
        om.check_link(SEASON_URL)
        for link, words in [
            ("https://choom.gg/meta", "meta reports only"),
            ("https://cyberpunk-tcg-sim.online/deck-builder/?d=x", "not a meta report"),
            ("https://cyberpunk-tcg-sim.online/meta/a/b", "not a meta report"),
            ("https://cyberpunk-tcg-sim.online/api/meta", "stay out of /api/"),
            ("https://example.com/meta/x", "reads only choom.gg"),
        ]:
            with self.assertRaises(om.Refused, msg=link) as e:
                om.check_link(link)
            self.assertIn(words, str(e.exception))


class Run(unittest.TestCase):
    def run_main(self, argv, pages=None, errors=None):
        fetcher, web, clock = fetcher_for(pages or {}, errors=errors, max_pages=om.MAX_PAGES)
        out = io.StringIO()
        code = om.main(argv, fetcher=fetcher, out=out, now="2026-11-18T09:00:00Z")
        return code, out.getvalue(), web, clock

    def test_reads_the_reports_politely_and_writes_one_file(self):
        with tempfile.TemporaryDirectory() as tmp:
            target = os.path.join(tmp, "out.json")
            code, text, web, clock = self.run_main([SEASON_URL, CUP_URL, "--out", target], {SEASON_URL: SEASON, CUP_URL: CUP})
            self.assertEqual(code, 0)
            self.assertEqual([u for u, _ in web.requests], [SEASON_URL, CUP_URL])
            self.assertGreaterEqual(web.requests[1][1] - web.requests[0][1], 2)
            doc = load(target)
            self.assertEqual(doc["kind"], "nct-outside-meta-import")
            self.assertEqual([p["kind"] for p in doc["pages"]], ["season", "tournament"])
            self.assertEqual({p["collected"] for p in doc["pages"]}, {"2026-11-18"})
            self.assertIn("Next: npx tsx scripts/import-outside-meta.ts", text)
            # never over the file without --force
            old, sys.stderr = sys.stderr, io.StringIO()
            try:
                code, _, _, _ = self.run_main([SEASON_URL, "--out", target], {SEASON_URL: SEASON})
            finally:
                sys.stderr = old
            self.assertEqual(code, 2)

    def test_stops_at_once_on_429(self):
        with tempfile.TemporaryDirectory() as tmp:
            target = os.path.join(tmp, "out.json")
            code, text, web, _ = self.run_main([SEASON_URL, CUP_URL, "--out", target], {CUP_URL: CUP}, errors={SEASON_URL: 429})
            self.assertEqual(code, 1)
            self.assertEqual(len(web.requests), 1)
            doc = load(target)
            self.assertEqual([l["status"] for l in doc["links"]], ["stopped", "not read"])

    def test_refuses_without_a_request(self):
        with tempfile.TemporaryDirectory() as tmp:
            code, _, web, _ = self.run_main(["https://choom.gg/api/x", "--out", os.path.join(tmp, "o.json")])
            self.assertEqual(code, 1)
            self.assertEqual(web.requests, [])

    def test_saved_pages_need_no_request(self):
        with tempfile.TemporaryDirectory() as tmp:
            saved = os.path.join(tmp, "cup.html")
            with open(saved, "w", encoding="utf-8") as f:
                f.write(CUP)
            target = os.path.join(tmp, "out.json")
            code, _, web, _ = self.run_main(["--saved", saved, "--collected", "2026-11-16", "--out", target])
            self.assertEqual(code, 0)
            self.assertEqual(web.requests, [])
            doc = load(target)
            self.assertEqual(doc["pages"][0]["link"], CUP_URL)
            self.assertEqual(doc["pages"][0]["collected"], "2026-11-16")

    def test_arguments(self):
        for argv in (["--saved", "x.html"], ["--delay", "0.5"], ["--saved", "x.html", "--collected", "16 Nov"], [SEASON_URL, "--saved", "x.html", "--collected", "2026-11-16"], [SEASON_URL] * 13):
            with self.assertRaises(SystemExit, msg=str(argv)):
                with open(os.devnull, "w") as devnull:
                    old, sys.stderr = sys.stderr, devnull
                    try:
                        om.parse_args(argv)
                    finally:
                        sys.stderr = old

    def test_default_links_are_the_two_reports(self):
        _, links = om.parse_args([])
        self.assertEqual(links, om.DEFAULT_LINKS)


if __name__ == "__main__":
    unittest.main()
