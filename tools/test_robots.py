"""Tests for tools/robots.py (RFC 9309 groups and matching, how a fetch is judged, the tripwire), on invented robots
files with the two sites' shapes. No network.

Run from the repository root:
  python -m unittest discover -s tools -p "test_*.py"
"""

import os
import sys
import unittest

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import robots as r  # noqa: E402
from test_import_decks import CHOOM_ROBOTS, SIM_ROBOTS  # noqa: E402

SIM = "cyberpunk-tcg-sim.online"


def rules(text):
    return r.judge(200, text)


class Groups(unittest.TestCase):
    def test_same_agent_groups_are_merged(self):
        robots = r.Robots(SIM_ROBOTS)
        g = robots.group_for()
        self.assertEqual([x.words() for x in g.rules], ["Allow: /", "Disallow: /api/", "Disallow: /dashboard", "Disallow: /metrics"])
        self.assertEqual(robots.signals(), {"search": "yes", "ai-train": "no", "use": "reference"})
        self.assertEqual(robots.which(), "*")
        self.assertTrue(robots.allowed("/meta/season-1"))
        self.assertFalse(robots.allowed("/api/decks"))
        self.assertFalse(robots.allowed("/dashboard/x"))
        self.assertFalse(robots.allowed("/metrics"))

    def test_named_crawlers_get_their_own_group(self):
        robots = r.Robots(SIM_ROBOTS)
        self.assertFalse(robots.allowed("/meta/season-1", agent="MadeUpTrainingBot"))
        # two User-agent lines in a row name one group; matching ignores case
        self.assertFalse(robots.allowed("/", agent="another-assistant-fetcher"))
        self.assertFalse(robots.allowed("/", agent="MADE-UP-ASSISTANT-USER"))

    def test_a_blank_line_does_not_end_a_group(self):
        robots = r.Robots(CHOOM_ROBOTS)
        self.assertTrue(robots.allowed("/decks"))
        self.assertFalse(robots.allowed("/admin"))
        self.assertFalse(robots.allowed("/api/decks"))
        self.assertTrue(robots.allowed("/apis"))
        # comments and blank lines between User-agent lines and rules change nothing either
        robots = r.Robots("User-agent: a\n\n# note\nUser-agent: deck-import-script\n\n# rules\nDisallow: /x\n")
        self.assertFalse(robots.allowed("/x/y"))
        self.assertEqual(robots.which(), "deck-import-script")

    def test_our_own_group_wins_over_star(self):
        text = "User-agent: *\nDisallow: /\n\nUser-agent: Deck-Import-Script/1.0\nAllow: /meta/\nDisallow: /\n"
        robots = r.Robots(text)
        self.assertTrue(robots.allowed("/meta/x"))
        self.assertFalse(robots.allowed("/decks"))
        self.assertEqual(robots.which(), "deck-import-script")
        # a longer name is another agent, not ours
        robots = r.Robots("User-agent: deck-import-script-two\nDisallow: /\n")
        self.assertTrue(robots.allowed("/anything"))
        self.assertEqual(robots.which(), "none")

    def test_lines_before_any_group_are_ignored(self):
        robots = r.Robots("Disallow: /\nSitemap: https://example.com/s.xml\nUser-agent: *\nDisallow: /p\n")
        self.assertTrue(robots.allowed("/q"))
        self.assertFalse(robots.allowed("/p"))

    def test_a_user_agent_after_a_rule_starts_a_new_group(self):
        robots = r.Robots("User-agent: one\nDisallow: /a\nUser-agent: *\nDisallow: /b\n")
        self.assertTrue(robots.allowed("/a"))
        self.assertFalse(robots.allowed("/b"))


class Matching(unittest.TestCase):
    def test_longest_match_wins_and_ties_go_to_allow(self):
        robots = r.Robots("User-agent: *\nDisallow: /meta\nAllow: /meta/\nDisallow: /meta/secret\nAllow: /tie\nDisallow: /tie\n")
        self.assertFalse(robots.allowed("/meta"))
        self.assertTrue(robots.allowed("/meta/season-1"))
        self.assertFalse(robots.allowed("/meta/secret/x"))
        self.assertTrue(robots.allowed("/tie"))

    def test_wildcards(self):
        robots = r.Robots("User-agent: *\nDisallow: /*.json$\nDisallow: /private*/data\nDisallow: /exact$\n")
        self.assertFalse(robots.allowed("/a/b.json"))
        self.assertTrue(robots.allowed("/a/b.json.html"))
        self.assertFalse(robots.allowed("/private-x/data/1"))
        self.assertFalse(robots.allowed("/exact"))
        self.assertTrue(robots.allowed("/exact/more"))
        # a query is part of the address
        robots = r.Robots("User-agent: *\nDisallow: /*?print=\n")
        self.assertFalse(robots.allowed("/meta/x", "print=1"))
        self.assertTrue(robots.allowed("/meta/x"))

    def test_empty_disallow_allows_everything(self):
        robots = r.Robots("User-agent: *\nDisallow:\n")
        self.assertTrue(robots.allowed("/anything"))

    def test_paths_are_normalized(self):
        robots = r.Robots("User-agent: *\nDisallow: /api/\nDisallow: /caf%c3%a9\nDisallow: /a%2fb\n")
        self.assertFalse(robots.allowed("/%61pi/x"))  # an escaped letter is the letter
        self.assertFalse(robots.allowed("/café/menu"))  # non-ASCII as its UTF-8 escapes, any hex case
        self.assertFalse(robots.allowed("/meta/../api/x"))  # dot steps taken
        self.assertFalse(robots.allowed("//api/x"))  # repeated slashes read either way
        self.assertTrue(robots.allowed("/a/b"))  # an escaped slash is not a slash
        self.assertFalse(robots.allowed("/a%2Fb"))
        self.assertTrue(robots.allowed("/API/x"))  # paths keep their case (site_of refuses this one anyway)

    def test_robots_txt_is_always_allowed(self):
        self.assertTrue(r.Robots("User-agent: *\nDisallow: /\n").allowed("/robots.txt"))

    def test_crawl_delay(self):
        self.assertEqual(r.Robots("User-agent: *\nCrawl-delay: 5\nUser-agent: *\nCrawl-delay: 7.5\n").crawl_delay(), 7.5)
        self.assertIsNone(r.Robots(CHOOM_ROBOTS).crawl_delay())
        self.assertEqual(r.Robots("User-agent: *\nCrawl-delay: soon\n").crawl_delay(), float("inf"))

    def test_signals(self):
        self.assertEqual(r.parse_signals(["Search = YES , ai-train=no,use=Reference,"]), {"search": "yes", "ai-train": "no", "use": "reference"})
        self.assertEqual(r.parse_signals(["search=yes", "search=no"]), {"search": "yes|no"})
        self.assertEqual(r.parse_signals(["odd"]), {"odd": "(no value)"})


class Judging(unittest.TestCase):
    def test_statuses_on_the_safe_side(self):
        self.assertEqual(rules(CHOOM_ROBOTS).kind, "rules")
        self.assertEqual(r.judge(404).kind, "none")
        self.assertEqual(r.judge(410).kind, "none")
        self.assertEqual(r.judge(401).kind, "none")
        for status in (403, 429, 500, 503, 302, None):
            self.assertEqual(r.judge(status).kind, "unreachable", status)
        self.assertEqual(r.judge(problem="timed out").kind, "unreachable")
        self.assertEqual(r.judge(200, "User-agent: *\n" + "#" * (500 * 1024)).kind, "unreachable")
        self.assertEqual(r.judge(200, "<!DOCTYPE html><html><title>Just a moment...</title></html>").kind, "unreachable")

    def test_no_rules_allows_all(self):
        self.assertTrue(r.judge(404).allowed("/anything"))

    def test_facts(self):
        f = r.facts(SIM, "https://" + SIM + "/robots.txt", rules(SIM_ROBOTS), "2026-11-18")
        self.assertEqual(f["status"], 200)
        self.assertEqual(f["group"], "*")
        self.assertEqual(len(f["sha256"]), 64)
        self.assertEqual(f["genericSignals"], {"search": "yes", "ai-train": "no", "use": "reference"})
        self.assertIn("Disallow: /api/", f["rules"])
        self.assertEqual(f["accepted"]["on"], "2026-11-18")


class Tripwire(unittest.TestCase):
    def test_the_accepted_file_passes(self):
        self.assertIsNone(r.tripwire(SIM, rules(SIM_ROBOTS)))
        # the signals in another order, with spaces and capitals, are the same signals
        self.assertIsNone(r.tripwire(SIM, rules(SIM_ROBOTS.replace("search=yes,ai-train=no,use=reference", "Use = reference, SEARCH=yes ,ai-train=No"))))

    def test_sites_without_an_accepted_table_are_not_checked(self):
        self.assertIsNone(r.tripwire("choom.gg", r.judge(404)))

    def test_every_change_stops(self):
        cases = {
            "a changed signal": SIM_ROBOTS.replace("use=reference", "use=none"),
            "a removed signal": SIM_ROBOTS.replace(",use=reference", ""),
            "a new key": SIM_ROBOTS.replace("use=reference", "use=reference,ai-input=no"),
            "no signals": SIM_ROBOTS.replace("Content-Signal: search=yes,ai-train=no,use=reference\n", ""),
            "a second, different signal line": SIM_ROBOTS.replace("Allow: /\n", "Allow: /\nContent-Signal: search=no\n", 1),
            "our agent named": SIM_ROBOTS + "\nUser-agent: deck-import-script\nAllow: /\n",
            "the reports disallowed for every reader": SIM_ROBOTS + "Disallow: /meta/\n",
            "the index disallowed": SIM_ROBOTS + "Disallow: /meta$\n",
            "no group for every reader": "User-agent: SomeBot\nDisallow: /\n",
        }
        for name, text in cases.items():
            reason = r.tripwire(SIM, rules(text))
            self.assertIsNotNone(reason, name)
            self.assertNotIn("\n", reason)
        self.assertIn("not the ai-train=no, search=yes, use=reference accepted on 2026-11-18", r.tripwire(SIM, rules(cases["a changed signal"])))
        self.assertIn("different: use", r.tripwire(SIM, rules(cases["a changed signal"])))

    def test_a_missing_or_unreadable_file_stops(self):
        for outcome in (r.judge(404), r.judge(500), r.judge(problem="timed out"), r.judge(200, "<html></html>")):
            self.assertIn("could not be read", r.tripwire(SIM, outcome))


if __name__ == "__main__":
    unittest.main()
