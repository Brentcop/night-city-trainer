"""Tests for tools/import_decks.py, on small made-up pages shaped like the real ones. No test touches the network: the
fetch function and the clock are handed in.

Run from the repository root:
  python -m unittest discover -s tools -p "test_*.py"
"""

import io
import json
import os
import sys
import tempfile
import unittest
import urllib.error

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import import_decks as imp  # noqa: E402

DECK_ID = "11111111-2222-4333-8444-555555555555"
OTHER_ID = "66666666-7777-4888-8999-aaaaaaaaaaaa"
CHOOM_DECK = "https://choom.gg/decks/" + DECK_ID


def push(text):
    """One Next.js data script, as a choom.gg page streams them."""
    return "<script>self.__next_f.push(" + json.dumps([1, text]) + ")</script>"


def card(ext, name, sub=None):
    return {"id": "X-1", "name": name, "subname": sub, "external_id": ext, "type": "Unit"}


RECORD = {
    "deckName": "Made Up",
    "legends": [card("cb-alpha-one", "Alpha", "One"), card("cb-beta-two", "Beta", "Two"), card("cb-gamma", "Gamma")],
    "cards": [{"card": card("cb-delta", "Delta"), "quantity": 3}, {"card": card("cb-epsilon-e", "Epsilon", "E"), "quantity": 2}],
    "sideboard": [{"card": card("cb-zeta", "Zeta"), "quantity": 1}],
    "pool": [],
    "deckFormat": "constructed",
}

CHOOM_PAGE = (
    '<html><head><title>Made Up</title><meta name="description" content="Made Up: a Cyberpunk TCG Constructed deck with '
    'Alpha — One, Beta — Two, Gamma. 5 cards, by Some_Author."/></head><body>'
    + push('0:["$","div",null,{"children":"x"}]\n')
    + push('1:["$","$L4e",null,' + json.dumps(RECORD) + "]\n")
    + "</body></html>"
)

# the same deck with no data record: only what the page shows
CHOOM_VISIBLE = (
    '<html><head><title>Shown</title><meta name="description" content="Shown: a Cyberpunk TCG Constructed deck with '
    'Alpha — One, Beta — Two, Gamma. 5 cards, by Other_Author."/></head><body>'
    '<img aria-label="Alpha — One, RAM 2"/><img aria-label="Beta — Two, RAM 2"/><img aria-label="Gamma, RAM 1"/>'
    '<span class="chip">3<span class="sr-only"> <!-- -->copies of Delta in deck</span></span>'
    '<span class="chip">2<span class="sr-only"> <!-- -->copies of Rockn&#x27; Epsilon — E in deck</span></span>'
    "</body></html>"
)

CHOOM_LIST = (
    "<html><head><title>Community decks</title></head><body>"
    '<a href="/decks">All</a><a href="/decks/' + DECK_ID + '">A</a><a href="/decks/' + DECK_ID + '">A again</a>'
    '<a href="https://choom.gg/decks/' + OTHER_ID + '">B</a><a href="https://elsewhere.example/decks/' + OTHER_ID + '">off site</a>'
    '<a href="/api/decks/' + OTHER_ID + '">api</a></body></html>'
)

SIM_LINK = (
    "https://cyberpunk-tcg-sim.online/deck-builder/?deck=cb-alpha-one:1,cb-beta-two:1,cb-gamma:1,cb-delta:3,cb-epsilon-e:2"
    "&sideboard=cb-zeta:1&type=cyberpunk&name=Player%20One%20-%20Made%20Up%20Cup%20(1st)"
)
COMPACT = (
    "https://cyberpunk-tcg-sim.online/deck-builder/?deck=saved-00000000-0000-4000-8000-000000000000&d=l.w1.w22.w5-a.d.3_w6.3_w7.3_wt"
    ".3_wu.1_wv.2_wx.1_w27.3_wp.3_w2s.2_we.3_w2t.3_w2e.1_w2m.3_wq.2_w2u.1_w2j.3_wm.s.1_wv.1_ww.1_w2m.3_wg.1_w2u"
)

SIM_PAGE = (
    '<html><head><title>Made Up Cup Results</title><meta property="article:published_time" content="2026-11-15T09:14:32.253Z">'
    "</head><body>"
    '<a href="/deck-builder/">Builder</a>'
    '<a class="details-button" href="' + SIM_LINK.replace("https://cyberpunk-tcg-sim.online", "").replace("&", "&amp;") + '">Open in deck builder</a>'
    '<a class="details-button" href="' + SIM_LINK.replace("&", "&amp;") + '">Open in deck builder</a>'
    '<a href="/deck-builder/?deck=cb-a:1,cb-b:1,cb-c:1,cb-d:3&amp;name=Second%20-%20Made%20Up%20Cup%20(2nd)">Open</a>'
    '<a href="/deck-builder/?deck=cb-a:1,cb-b:1,cb-c:1,cb-e:3&amp;name=Third%20-%20Made%20Up%20Cup%20(3rd)">Open</a>'
    "</body></html>"
)


# Invented robots files with the two sites' shapes (never their text). The sim site's is Cloudflare-managed: a notice,
# the content signals in a first "*" group, groups that keep named crawlers out, then a second "*" group with paths.
SIM_ROBOTS = (
    "# A made-up notice: reading this site means agreeing to the content signals below.\n"
    "# search = may be shown in search results; ai-train = may train models; use = how answers may use it.\n"
    "\n"
    "User-agent: *\n"
    "Content-Signal: search=yes,ai-train=no,use=reference\n"
    "Allow: /\n"
    "\n"
    "User-agent: MadeUpTrainingBot\n"
    "Disallow: /\n"
    "\n"
    "User-agent: Made-Up-Assistant-User\n"
    "User-agent: Another-Assistant-Fetcher\n"
    "Disallow: /\n"
    "\n"
    "# the site's own paths\n"
    "User-agent: *\n"
    "Disallow: /api/\n"
    "Disallow: /dashboard\n"
    "Disallow: /metrics\n"
)
# choom.gg's shape: a blank line inside its one group
CHOOM_ROBOTS = "User-agent: *\nAllow: /\n\nDisallow: /admin\nDisallow: /api/\n"
ROBOTS = {"https://cyberpunk-tcg-sim.online/robots.txt": SIM_ROBOTS, "https://choom.gg/robots.txt": CHOOM_ROBOTS}


class FakeClock:
    def __init__(self):
        self.t = 100.0
        self.slept = []

    def clock(self):
        return self.t

    def sleep(self, s):
        self.slept.append(round(s, 3))
        self.t += s


class FakeWeb:
    """Pages by address; every request is recorded with the clock's time (robots files apart, in `robots_requests`).
    The two sites' invented robots files are served unless `pages` names another answer for them."""

    def __init__(self, pages, clock, errors=None, robots=True):
        self.pages = dict(ROBOTS, **pages) if robots else dict(pages)
        self.clock = clock
        self.errors = errors or {}
        self.requests = []
        self.robots_requests = []
        self.all = []

    def __call__(self, url):
        (self.robots_requests if url.endswith("/robots.txt") else self.requests).append((url, self.clock.t))
        self.all.append((url, self.clock.t))
        self.clock.t += 0.2  # a request takes a little time
        if url in self.errors and self.errors[url] != []:
            # a list of answers is used up one by one, then the page is served
            code = self.errors[url].pop(0) if isinstance(self.errors[url], list) else self.errors[url]
            if code == "timeout":
                raise urllib.error.URLError("timed out")
            raise urllib.error.HTTPError(url, code, "error", {}, None)
        if url not in self.pages:
            raise urllib.error.HTTPError(url, 404, "not found", {}, None)
        page = self.pages[url]
        return page if isinstance(page, tuple) else (200, page)


def fetcher_for(pages, delay=2, errors=None, max_pages=imp.MAX_PAGES, robots=True):
    clock = FakeClock()
    web = FakeWeb(pages, clock, errors, robots=robots)
    return imp.Fetcher(delay=delay, opener=web, clock=clock.clock, sleep=clock.sleep, max_pages=max_pages, day="2026-11-18"), web, clock


def refs(section):
    return [(r["ref"], r["count"]) for r in section]


class Links(unittest.TestCase):
    def test_sites(self):
        self.assertEqual(imp.site_of("https://choom.gg/decks"), "choom.gg")
        self.assertEqual(imp.site_of("https://www.choom.gg/decks"), "choom.gg")
        self.assertEqual(imp.site_of("https://www.cyberpunk-tcg-sim.online/meta/x"), "cyberpunk-tcg-sim.online")

    def test_refusals(self):
        for link, words in [
            ("https://example.com/decks", "reads only choom.gg"),
            ("https://choom.gg.evil.example/decks", "reads only choom.gg"),
            ("ftp://choom.gg/decks", "web link"),
            ("not a link", "web link"),
            ("https://choom.gg/api/decks", "stay out of /api/"),
            ("https://choom.gg/api", "stay out of /api/"),
            ("https://choom.gg/admin/x", "stay out of /api/"),
            # the same paths written another way
            ("https://choom.gg/%61pi/decks", "stay out of /api/"),
            ("https://choom.gg//api/decks", "stay out of /api/"),
            ("https://choom.gg/API/decks", "stay out of /api/"),
            ("https://choom.gg/decks/../admin", "stay out of /api/"),
            ("https://choom.gg/decks/%2e%2e/api/decks", "stay out of /api/"),
            ("https://evil.example\\@choom.gg.evil.example/decks", "reads only choom.gg"),
            ("https://choom.gg@evil.example/decks", "reads only choom.gg"),
            # the sim's own robots rules (read 2026-11-18)
            ("https://cyberpunk-tcg-sim.online/api/decks", "stay out of /api/, /dashboard"),
            ("https://cyberpunk-tcg-sim.online/%41PI", "stay out of /api/, /dashboard"),
            ("https://cyberpunk-tcg-sim.online/dashboard", "stay out of /api/, /dashboard"),
            ("https://cyberpunk-tcg-sim.online/meta/../metrics", "stay out of /api/, /dashboard"),
        ]:
            with self.assertRaises(imp.Refused, msg=link) as e:
                imp.site_of(link)
            self.assertIn(words, str(e.exception))

    def test_by_id_link(self):
        d = imp.decode_deck_builder(SIM_LINK)
        self.assertEqual(refs(d["legends"]), [("cb-alpha-one", 1), ("cb-beta-two", 1), ("cb-gamma", 1)])
        self.assertEqual(refs(d["main"]), [("cb-delta", 3), ("cb-epsilon-e", 2)])
        self.assertEqual(refs(d["sideboard"]), [("cb-zeta", 1)])
        self.assertEqual(d["name"], "Player One - Made Up Cup (1st)")
        self.assertEqual(d["author"], "Player One")
        self.assertEqual(d["source"]["placement"], "1st")
        self.assertEqual(d["source"]["site"], "cyberpunk-tcg-sim.online")
        self.assertEqual(d["notes"], [])

    def test_compact_link(self):
        d = imp.decode_deck_builder(COMPACT)
        self.assertEqual(refs(d["legends"]), [("w1", 1), ("w22", 1), ("w5-a", 1)])
        self.assertEqual(sum(c for _, c in refs(d["main"])), 40)
        self.assertEqual(sum(c for _, c in refs(d["sideboard"])), 7)
        self.assertTrue(all(r["by"] == "code" for r in d["legends"] + d["main"] + d["sideboard"]))
        self.assertEqual(d["name"], "")
        self.assertEqual(d["notes"], [])

    def test_compact_link_keeps_unknown_parts_as_notes(self):
        d = imp.decode_deck_builder("https://cyberpunk-tcg-sim.online/deck-builder/?d=x.l.w1.w2.w3.d.3_w6.zz_9.q.1_w7")
        self.assertEqual(refs(d["legends"]), [("w1", 1), ("w2", 1), ("w3", 1)])
        self.assertEqual(refs(d["main"]), [("w6", 3)])
        self.assertIn("section not understood: x", d["notes"])
        self.assertIn("part not understood: zz_9", d["notes"])
        self.assertIn("section not understood: q", d["notes"])
        self.assertIn("part not understood: 1_w7", d["notes"])

    def test_saved_link_without_a_list_is_refused(self):
        with self.assertRaises(imp.Refused):
            imp.decode_deck_builder("https://cyberpunk-tcg-sim.online/deck-builder/?deck=saved-abc")

    def test_split_name(self):
        self.assertEqual(imp.split_name("TrueDuelist - Discord Cup (1st)"), ("TrueDuelist", "1st"))
        self.assertEqual(imp.split_name("A / B / C (Season-1 #2)"), ("", "Season-1 #2"))
        self.assertEqual(imp.split_name("Just a name"), ("", ""))


class Pages(unittest.TestCase):
    def test_choom_deck_page_data_record(self):
        d = imp.choom_deck_from_page(CHOOM_PAGE, CHOOM_DECK)
        self.assertEqual(d["name"], "Made Up")
        self.assertEqual(d["author"], "Some_Author")
        self.assertEqual(refs(d["legends"]), [("cb-alpha-one", 1), ("cb-beta-two", 1), ("cb-gamma", 1)])
        self.assertEqual(d["legends"][0]["name"], "Alpha — One")
        self.assertEqual(refs(d["main"]), [("cb-delta", 3), ("cb-epsilon-e", 2)])
        self.assertEqual(refs(d["sideboard"]), [("cb-zeta", 1)])
        self.assertEqual(d["source"]["page"], "Made Up")

    def test_choom_deck_page_visible_list(self):
        d = imp.choom_deck_from_page(CHOOM_VISIBLE, CHOOM_DECK)
        self.assertEqual(d["author"], "Other_Author")
        self.assertEqual(refs(d["legends"]), [("Alpha — One", 1), ("Beta — Two", 1), ("Gamma", 1)])
        self.assertEqual(refs(d["main"]), [("Delta", 3), ("Rockn' Epsilon — E", 2)])
        self.assertTrue(all(r["by"] == "name" for r in d["legends"] + d["main"]))
        self.assertEqual(d["sideboard"], [])
        self.assertTrue(any("visible list" in n for n in d["notes"]))

    def test_choom_list_links(self):
        self.assertEqual(imp.choom_deck_links(CHOOM_LIST, "https://choom.gg/decks"), [CHOOM_DECK, "https://choom.gg/decks/" + OTHER_ID])

    def test_sim_page_links(self):
        found = imp.sim_deck_links(SIM_PAGE, "https://cyberpunk-tcg-sim.online/meta/made-up-cup")
        self.assertEqual(len(found), 3)  # the builder's own page is not a deck, the repeated first deck counts once
        self.assertEqual(found[0], SIM_LINK)


class Runs(unittest.TestCase):
    def test_every_kind_of_link(self):
        pages = {
            CHOOM_DECK: CHOOM_PAGE,
            "https://choom.gg/decks": CHOOM_LIST,
            "https://choom.gg/decks/" + OTHER_ID: CHOOM_VISIBLE,
            "https://cyberpunk-tcg-sim.online/meta/made-up-cup": SIM_PAGE,
        }
        f, web, clock = fetcher_for(pages)
        links = [CHOOM_DECK, "https://choom.gg/decks", COMPACT, "https://cyberpunk-tcg-sim.online/meta/made-up-cup", "https://example.com/x"]
        printed = []
        doc, stopped = imp.read_links(links, f, 20, "2026-11-16T00:00:00Z", printed.append)
        self.assertIsNone(stopped)
        # one printed line per link, whatever kind it is
        self.assertEqual([line.split()[0] for line in printed], ["fetched", "fetched", "decoded", "fetched", "refused"])
        self.assertIn("one was read already", doc["links"][1]["note"])
        self.assertEqual(doc["kind"], "nct-deck-import")
        self.assertEqual(doc["schema"], 1)
        status = [(r["status"], r["decks"]) for r in doc["links"]]
        # the list page's first deck is the deck page already read: not repeated
        self.assertEqual(status, [("fetched", 1), ("fetched", 1), ("decoded", 1), ("fetched", 3), ("refused", 0)])
        self.assertEqual(len(doc["decks"]), 6)
        # the compact link needed no request; the refused link none either
        self.assertEqual([u for u, _ in web.requests], [CHOOM_DECK, "https://choom.gg/decks", "https://choom.gg/decks/" + OTHER_ID, "https://cyberpunk-tcg-sim.online/meta/made-up-cup"])
        tournament = doc["decks"][3]
        self.assertEqual(tournament["source"]["page"], "Made Up Cup Results")
        self.assertEqual(tournament["source"]["pageLink"], "https://cyberpunk-tcg-sim.online/meta/made-up-cup")
        self.assertEqual(tournament["source"]["date"], "2026-11-15T09:14:32.253Z")
        self.assertEqual(tournament["source"]["placement"], "1st")
        self.assertEqual(doc["decks"][1]["source"]["page"], "Community decks")

    def test_limit(self):
        f, web, _ = fetcher_for({"https://cyberpunk-tcg-sim.online/meta/made-up-cup": SIM_PAGE})
        doc, _ = imp.read_links(["https://cyberpunk-tcg-sim.online/meta/made-up-cup"], f, 2, "t")
        self.assertEqual(len(doc["decks"]), 2)
        self.assertIn("read the first 2", doc["links"][0]["note"])

    def test_page_cap(self):
        f, web, _ = fetcher_for({"https://choom.gg/decks": CHOOM_LIST, CHOOM_DECK: CHOOM_PAGE}, max_pages=2)
        doc, _ = imp.read_links(["https://choom.gg/decks"], f, 20, "t")
        self.assertEqual(len(web.requests), 2)
        self.assertEqual(len(doc["decks"]), 1)
        self.assertIn("the most one run reads", doc["links"][0]["note"])

    def test_delay_between_requests(self):
        f, web, clock = fetcher_for({CHOOM_DECK: CHOOM_PAGE, "https://choom.gg/decks": CHOOM_LIST, "https://choom.gg/decks/" + OTHER_ID: CHOOM_VISIBLE}, delay=3)
        imp.read_links(["https://choom.gg/decks"], f, 20, "t")
        times = [t for _, t in web.requests]
        self.assertEqual(len(times), 3)
        for a, b in zip(times, times[1:]):
            self.assertGreaterEqual(round(b - a, 6), 3)
        # the robots file is read first, paced like a page
        self.assertEqual([u for u, _ in web.robots_requests], ["https://choom.gg/robots.txt"])
        self.assertGreaterEqual(round(web.requests[0][1] - web.robots_requests[0][1], 6), 3)
        self.assertEqual(clock.slept, [2.8, 2.8, 2.8])

    def test_delay_never_under_one_second(self):
        f, _, _ = fetcher_for({}, delay=0.1)
        self.assertEqual(f.delay, 1.0)

    def test_stops_on_429(self):
        f, web, _ = fetcher_for({}, errors={CHOOM_DECK: 429})
        doc, stopped = imp.read_links([CHOOM_DECK, "https://choom.gg/decks/" + OTHER_ID, SIM_LINK], f, 20, "t")
        self.assertIn("429", stopped)
        self.assertEqual([r["status"] for r in doc["links"]], ["stopped", "not read", "not read"])
        self.assertEqual(len(web.requests), 1)

    def test_retries_once(self):
        f, web, _ = fetcher_for({CHOOM_DECK: CHOOM_PAGE}, errors={CHOOM_DECK: ["timeout"]})
        web_ok = web.pages
        # the first call fails, the retry reads the page
        calls = {"n": 0}

        def flaky(url):
            if url.endswith("/robots.txt"):
                return 200, ROBOTS[url]
            calls["n"] += 1
            if calls["n"] == 1:
                raise urllib.error.URLError("timed out")
            return 200, web_ok[url]

        f.opener = flaky
        doc, _ = imp.read_links([CHOOM_DECK], f, 20, "t")
        self.assertEqual(calls["n"], 2)
        self.assertEqual(doc["links"][0]["status"], "fetched")

        def broken(url):
            if url.endswith("/robots.txt"):
                return 200, ROBOTS[url]
            calls["n"] += 1
            raise urllib.error.URLError("timed out")

        calls["n"] = 0
        f2, _, _ = fetcher_for({})
        f2.opener = broken
        doc, _ = imp.read_links([CHOOM_DECK], f2, 20, "t")
        self.assertEqual(calls["n"], 2)
        self.assertEqual(doc["links"][0]["status"], "failed")

    def test_never_requests_a_disallowed_path(self):
        f, web, _ = fetcher_for({})
        with self.assertRaises(imp.Refused):
            f.get("https://choom.gg/api/decks")
        self.assertEqual(web.requests, [])

    def test_user_agent_names_only_the_script(self):
        self.assertEqual(imp.USER_AGENT, "deck-import-script/1.0")


class RobotsGate(unittest.TestCase):
    """The fetcher reads each host's robots file before its first request there, in every run, and keeps to it."""

    def test_read_once_per_host_before_the_first_page_and_not_counted(self):
        f, web, _ = fetcher_for({CHOOM_DECK: CHOOM_PAGE, "https://choom.gg/decks": CHOOM_LIST}, max_pages=2)
        f.get(CHOOM_DECK)
        f.get("https://choom.gg/decks")
        self.assertEqual([u for u, _ in web.all], ["https://choom.gg/robots.txt", CHOOM_DECK, "https://choom.gg/decks"])
        self.assertEqual(f.pages, 2)
        self.assertEqual(f.robots_facts[0]["verdict"], "kept to")
        self.assertEqual(f.robots_facts[0]["rules"], ["Allow: /", "Disallow: /admin", "Disallow: /api/"])

    def test_a_path_the_rules_disallow_is_refused_without_a_request(self):
        robots = "User-agent: *\nDisallow: /decks/" + DECK_ID[:8] + "\n"
        f, web, _ = fetcher_for({"https://choom.gg/robots.txt": robots, CHOOM_DECK: CHOOM_PAGE})
        with self.assertRaises(imp.Refused) as e:
            f.get(CHOOM_DECK)
        self.assertIn("robots rules keep deck-import-script out of /decks/", str(e.exception))
        self.assertEqual(web.requests, [])
        # through a run it is one refused link, not a stop
        doc, stopped = imp.read_links([CHOOM_DECK], f, 20, "t")
        self.assertIsNone(stopped)
        self.assertEqual(doc["links"][0]["status"], "refused")

    def test_crawl_delay_is_honoured(self):
        robots = "User-agent: *\nCrawl-delay: 5\nAllow: /\n"
        f, web, _ = fetcher_for({"https://choom.gg/robots.txt": robots, CHOOM_DECK: CHOOM_PAGE, "https://choom.gg/decks": CHOOM_LIST, "https://choom.gg/decks/" + OTHER_ID: CHOOM_VISIBLE})
        imp.read_links(["https://choom.gg/decks"], f, 20, "t")
        times = [t for _, t in web.requests]
        self.assertEqual(len(times), 3)
        for a, b in zip(times, times[1:]):
            self.assertGreaterEqual(round(b - a, 6), 5)
        self.assertEqual(f.delay, 5.0)

    def test_a_crawl_delay_over_a_minute_stops_the_run(self):
        with tempfile.TemporaryDirectory() as tmp:
            f, web, _ = fetcher_for({"https://choom.gg/robots.txt": "User-agent: *\nCrawl-delay: 61\n", CHOOM_DECK: CHOOM_PAGE})
            out = io.StringIO()
            self.assertEqual(imp.main([CHOOM_DECK, "--out", os.path.join(tmp, "o.json")], fetcher=f, out=out), 3)
            self.assertEqual(web.requests, [])
            self.assertIn("Crawl-delay", out.getvalue())

    def test_no_rules_on_404_but_a_stop_when_unreachable(self):
        f, web, _ = fetcher_for({CHOOM_DECK: CHOOM_PAGE}, robots=False)
        f.get(CHOOM_DECK)  # choom.gg answers 404 for its robots file here: no rules
        self.assertEqual(f.robots_facts[0]["verdict"], "no rules")
        for answer in ([500, 500], ["timeout", "timeout"], [403], [429]):
            f, web, _ = fetcher_for({CHOOM_DECK: CHOOM_PAGE}, errors={"https://choom.gg/robots.txt": list(answer)})
            with self.assertRaises(imp.RulesStop, msg=str(answer)):
                f.get(CHOOM_DECK)
            self.assertEqual(web.requests, [], answer)
            # the run stays stopped: no other host is asked either
            with self.assertRaises(imp.RulesStop):
                f.get("https://cyberpunk-tcg-sim.online/meta/x")
            self.assertEqual(web.robots_requests[-1][0], "https://choom.gg/robots.txt")
        # one 5xx is retried once
        f, web, _ = fetcher_for({CHOOM_DECK: CHOOM_PAGE}, errors={"https://choom.gg/robots.txt": [503]})
        self.assertEqual(len(web.robots_requests), 0)
        f.get(CHOOM_DECK)
        self.assertEqual(len(web.robots_requests), 2)

    def test_an_oversized_or_html_robots_file_or_a_redirect_off_the_site_stops(self):
        for body in ("User-agent: *\n" + "# filler\n" * 60000, "<!DOCTYPE html><html><head><title>Just a moment...</title></head></html>"):
            f, web, _ = fetcher_for({"https://choom.gg/robots.txt": body, CHOOM_DECK: CHOOM_PAGE})
            with self.assertRaises(imp.RulesStop):
                f.get(CHOOM_DECK)
            self.assertEqual(web.requests, [])

        def redirected(url):
            raise imp.FetchFailed("the site redirected to an address this script does not read")

        f, _, _ = fetcher_for({})
        f.opener = redirected
        with self.assertRaises(imp.RulesStop) as e:
            f.get(CHOOM_DECK)
        self.assertIn("redirected", str(e.exception))

    def test_the_sim_site_tripwire_applies_to_the_deck_import_too(self):
        changed = SIM_ROBOTS.replace("ai-train=no", "ai-train=yes")
        with tempfile.TemporaryDirectory() as tmp:
            target = os.path.join(tmp, "o.json")
            page = "https://cyberpunk-tcg-sim.online/meta/made-up-cup"
            f, web, _ = fetcher_for({"https://cyberpunk-tcg-sim.online/robots.txt": changed, page: SIM_PAGE})
            out = io.StringIO()
            self.assertEqual(imp.main([page, "--out", target], fetcher=f, out=out), 3)
            self.assertEqual(web.requests, [])
            self.assertIn("content signals", out.getvalue())
            # the same run with the accepted file reads the page, and records what it saw
            f, web, _ = fetcher_for({page: SIM_PAGE})
            self.assertEqual(imp.main([page, "--out", target, "--force"], fetcher=f, out=io.StringIO()), 0)
            with open(target, encoding="utf-8") as fh:
                doc = json.load(fh)
            self.assertEqual(doc["robots"][0]["genericSignals"], {"search": "yes", "ai-train": "no", "use": "reference"})
            self.assertEqual(doc["robots"][0]["verdict"], "kept to")

    def test_a_bot_check_stops_the_run(self):
        challenge = '<html><head><title>Just a moment...</title></head><body><script>window._cf_chl_opt={}</script></body></html>'
        f, web, _ = fetcher_for({CHOOM_DECK: challenge, "https://choom.gg/decks/" + OTHER_ID: CHOOM_PAGE})
        doc, stopped = imp.read_links([CHOOM_DECK, "https://choom.gg/decks/" + OTHER_ID], f, 20, "t")
        self.assertIn("bot check", stopped)
        self.assertEqual(len(web.requests), 1)
        self.assertEqual([x["status"] for x in doc["links"]], ["stopped", "not read"])


class CommandLine(unittest.TestCase):
    def test_writes_the_file_and_refuses_to_replace_it(self):
        with tempfile.TemporaryDirectory() as tmp:
            out = os.path.join(tmp, "deck-import.json")
            f, _, _ = fetcher_for({})
            printed = io.StringIO()
            code = imp.main([COMPACT, "--out", out], fetcher=f, out=printed, now="2026-11-16T00:00:00Z")
            self.assertEqual(code, 0)
            with open(out, encoding="utf-8") as fh:
                doc = json.load(fh)
            self.assertEqual(doc["ran"], "2026-11-16T00:00:00Z")
            self.assertEqual(len(doc["decks"]), 1)
            self.assertIn("Wrote 1 deck", printed.getvalue())
            with redirect_stderr():
                self.assertEqual(imp.main([COMPACT, "--out", out], fetcher=f, out=io.StringIO()), 2)
            self.assertEqual(imp.main([COMPACT, "--out", out, "--force"], fetcher=f, out=io.StringIO()), 0)

    def test_from_file(self):
        with tempfile.TemporaryDirectory() as tmp:
            src = os.path.join(tmp, "links.txt")
            with open(src, "w", encoding="utf-8") as fh:
                fh.write("# my links\n\n" + COMPACT + "\n" + SIM_LINK + "\n")
            out = os.path.join(tmp, "o.json")
            code = imp.main(["--from-file", src, "--out", out], fetcher=fetcher_for({})[0], out=io.StringIO())
            self.assertEqual(code, 0)
            with open(out, encoding="utf-8") as fh:
                self.assertEqual(len(json.load(fh)["decks"]), 2)

    def test_bad_arguments_exit_2(self):
        for argv in [[], ["--limit", "0", COMPACT], ["--limit", "61", COMPACT], ["--delay", "0.5", COMPACT], ["--nope", COMPACT], ["--limit", "x", COMPACT]]:
            with self.assertRaises(SystemExit) as e, redirect_stderr():
                imp.main(argv, fetcher=fetcher_for({})[0], out=io.StringIO())
            self.assertEqual(e.exception.code, 2, argv)


class redirect_stderr:
    def __enter__(self):
        self.old = sys.stderr
        sys.stderr = io.StringIO()

    def __exit__(self, *a):
        sys.stderr = self.old


if __name__ == "__main__":
    unittest.main()
