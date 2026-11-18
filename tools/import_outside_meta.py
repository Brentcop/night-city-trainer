#!/usr/bin/env python3
"""Collect the figures of cyberpunk-tcg-sim.online's meta reports (a ranked season report, a tournament report) into
one JSON file, for Night City Trainer's outside picture (docs/DECK_IMPORT.md, "The outside meta").

Usage:
  python tools/import_outside_meta.py [--previous FILE] [--no-discover] [--out FILE] [--summary FILE] [--delay S] [--force]
  python tools/import_outside_meta.py LINK [LINK ...] [--discover] [--out FILE] ...
  python tools/import_outside_meta.py --saved PAGE.html [--saved PAGE.html ...] --collected YYYY-MM-DD [--out FILE]

With no link it reads the two reports the trainer has always shown,
  https://cyberpunk-tcg-sim.online/meta/season-1
  https://cyberpunk-tcg-sim.online/meta/discord-5k-celebration-tournament
then the reports the tracked file already holds (--previous, default src/data/outsideMeta.json when it exists), then
the reports found by following links on the pages read: /meta/<report> links on the site, and the "Meta reports" page
(/meta) every report's breadcrumb links to, read for its report links. At most 6 new reports a run; a page that is not
a report this script understands is recorded as "not a report" and never fails the run. With links, it reads those
(add --discover to follow links from them too). --saved reads pages saved earlier instead, with no request at all (each
page's own address is taken from inside it, and --collected says the day it was saved).

It shares the deck import's fetcher and its rules (tools/import_decks.py): the two sites only, the site's robots file
read at the start of every run (tools/robots.py) and kept to, one request at a time at least --delay seconds apart (2 by
default, never under 1, never faster than the site's Crawl-delay), no redirect off the two sites, a plain User-Agent that
says nothing about who runs it, and it stops at once on a 403, a 429 or a bot check. It reads at most 12 pages a run
(the robots file is not counted). cyberpunk-tcg-sim.online's robots file is checked against the content signals a
person accepted (tools/robots.py, ACCEPTED): anything else, or a file that cannot be read, stops the run before any page
is read and exits 3 (the output then records what was seen of the robots file, and no page). The scheduled workflow
.github/workflows/outside-meta.yml runs it unattended; an AI assistant never runs it against that site nor fetches its
pages (its robots file keeps the fetchers AI assistants use on a person's behalf out by name). It keeps facts only:
Legend names as the site wrote them and the numbers beside them; no player names, no page text, no decklists (the deck
import reads those).

The output (outside-meta-import.json by default; replaced only with --force) records each page read and what was seen
of the robots file (status, the content signals, the rules that apply, a hash of the text, the day), and is read by
  npx tsx scripts/import-outside-meta.ts outside-meta-import.json
which matches the Legend names to the trainer's cards and writes src/data/outsideMeta.json. --summary FILE appends a
Markdown account of the run to FILE (the workflow's job summary).

Exit codes: 0 read, 1 stopped by a 403, 429 or bot check, or no report read, 2 a bad command line, an unreadable
--previous file or an existing output file, 3 stopped by the site's robots rules before any page was read.
Python 3.9 or later, standard library only.
"""

import argparse
import html
import json
import os
import re
import sys
import urllib.parse
from datetime import date, datetime, timezone

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import import_decks as deck_import  # noqa: E402
from import_decks import SIM, FetchFailed, Fetcher, Refused, Stop, page_date, site_of  # noqa: E402

KIND = "nct-outside-meta-import"
SCHEMA = 1
DEFAULT_OUT = "outside-meta-import.json"
MAX_PAGES = 12
# reports found by following links, at most this many a run (the page cap still holds)
MAX_NEW = 6
# reports named by the previous tracked file and read again, at most this many (the converter keeps 8 sources)
MAX_KNOWN = 8
DEFAULT_LINKS = [
    "https://cyberpunk-tcg-sim.online/meta/season-1",
    "https://cyberpunk-tcg-sim.online/meta/discord-5k-celebration-tournament",
]
REPORT_PATH = re.compile(r"^/meta/[a-z0-9][a-z0-9-]{0,80}/?$")
# the "Meta reports" page every report's breadcrumb links to (read only when a page read links to it, never guessed)
INDEX_PATH = re.compile(r"^/meta/?$")


class NotAReport(FetchFailed):
    """A page read that is not a season or tournament report this script understands."""
MONTHS = {m: i + 1 for i, m in enumerate(["jan", "feb", "mar", "apr", "may", "jun", "jul", "aug", "sep", "oct", "nov", "dec"])}
DASHES = "–—-"


# ---------------------------------------------------------------- small readers


def text_of(fragment):
    """The text of an HTML fragment: tags dropped, entities read, spaces collapsed."""
    return re.sub(r"\s+", " ", html.unescape(re.sub(r"<[^>]+>", " ", fragment))).strip()


def number(s):
    """'35,662' or '4.3' as a number (an int when it has no decimals), or None."""
    s = (s or "").strip().replace(",", "").replace(" ", "").replace("\xa0", "")
    if not re.fullmatch(r"\d{1,9}(?:\.\d{1,3})?", s):
        return None
    return float(s) if "." in s else int(s)


def record(s):
    """'931–787' as (931, 787), or None."""
    m = re.fullmatch(r"\s*([\d,]{1,9})\s*[" + DASHES + r"]\s*([\d,]{1,9})\s*", s or "")
    if not m:
        return None
    return number(m.group(1)), number(m.group(2))


def iso_day(month, day, year):
    try:
        return date(int(year), MONTHS[month[:3].lower()], int(day)).isoformat()
    except (KeyError, ValueError):
        return ""


def read_period(s):
    """'Sep 5 – Nov 15, 2026' as ('2026-09-05', '2026-11-15'); a single day 'Nov 7, 2026' as (day, day)."""
    m = re.search(r"([A-Za-z]{3,9})\.? (\d{1,2})(?:, (\d{4}))?\s*[" + DASHES + r"]\s*([A-Za-z]{3,9})\.? (\d{1,2}), (\d{4})", s)
    if m:
        end = iso_day(m.group(4), m.group(5), m.group(6))
        year = int(m.group(3) or m.group(6))
        if not m.group(3) and MONTHS.get(m.group(1)[:3].lower(), 0) > MONTHS.get(m.group(4)[:3].lower(), 0):
            year -= 1  # "Dec 5 – Feb 1, 2027" began the year before
        return iso_day(m.group(1), m.group(2), year), end
    m = re.search(r"([A-Za-z]{3,9})\.? (\d{1,2}), (\d{4})", s)
    if m:
        d = iso_day(m.group(1), m.group(2), m.group(3))
        return d, d
    return "", ""


def trio_names(s):
    """'A / B / C' as three names, or None (a trio is three Legends; 'Other' is no Legend)."""
    names = [n.strip() for n in text_of(s).split(" / ")]
    if len(names) != 3 or any(not n or n == "Other" or len(n) > 80 for n in names):
        return None
    return names


def canonical(page):
    m = re.search(r'<link[^>]+rel="canonical"[^>]+href="([^"]+)"', page) or re.search(r'<meta[^>]+property="og:url"[^>]+content="([^"]+)"', page)
    return html.unescape(m.group(1)).strip() if m else ""


def eyebrow(page):
    m = re.search(r'<p class="eyebrow">(.*?)</p>', page, re.S)
    return text_of(m.group(1)) if m else ""


def heading(page):
    m = re.search(r"<h1[^>]*>(.*?)</h1>", page, re.S)
    return text_of(m.group(1)) if m else ""


def metrics(page):
    """The page's metric tiles: label -> (value, detail)."""
    out = {}
    for m in re.finditer(r'<span class="metric__label">(.*?)</span>\s*<strong class="metric__value">(.*?)</strong>(?:\s*<span class="metric__detail">(.*?)</span>)?', page, re.S):
        out[text_of(m.group(1))] = (text_of(m.group(2)), text_of(m.group(3) or ""))
    return out


def first_number(s):
    m = re.search(r"[\d,]+(?:\.\d+)?", s or "")
    return number(m.group(0)) if m else None


def legend_map(page, notes):
    """The legend map's full-trio slices: [{trio, share, winRate}] (the map's partial groups and 'Other' are not trios)."""
    out, seen = [], set()
    for m in re.finditer(r"<title>(.*?)</title>", page, re.S):
        t = text_of(m.group(1))
        mm = re.fullmatch(r"(.+): ([\d.]+)% of (?:high-rank decks|players) · ([\d.]+)% win rate", t)
        if not mm:
            continue
        names = [n.strip() for n in mm.group(1).split(" + ")]
        if len(names) != 3 or "Other" in names:
            continue
        key = tuple(sorted(names))
        if key in seen:
            continue
        seen.add(key)
        share, wr = number(mm.group(2)), number(mm.group(3))
        if share is None or wr is None:
            notes.append("a legend map slice was not understood: " + t[:80])
            continue
        out.append({"trio": names, "share": share, "winRate": wr})
    return out


def matchups(page, notes):
    """The matchup table's cells that give a win rate: [{trio, vs, winRate, wins, losses}]."""
    out = []
    for m in re.finditer(r'<div class="matrix-cell[^"]*"[^>]*\stitle="([^"]+)"', page):
        t = html.unescape(m.group(1))
        mm = re.fullmatch(r"(.+?) against (.+): ([\d.]+)%, ([\d,]+)[" + DASHES + r"]([\d,]+) over [\d,]+ games", t)
        if not mm:
            continue
        a, b = trio_names(mm.group(1)), trio_names(mm.group(2))
        wr, w, l = number(mm.group(3)), number(mm.group(4)), number(mm.group(5))
        if not a or not b or wr is None or w is None or l is None:
            notes.append("a matchup cell was not understood: " + t[:80])
            continue
        out.append({"trio": a, "vs": b, "winRate": wr, "wins": w, "losses": l})
    return out


# ---------------------------------------------------------------- the two kinds of report


def tier_list(page, notes):
    """A season report's power rankings: [{rank, trio, tier, winRate, wins, losses, share, players}]."""
    out = []
    for block in re.split(r'<article class="report-rank[ "]', page)[1:]:
        block = block[: block.find("</article>")] if "</article>" in block else block
        n = re.search(r'class="report-rank__number">\s*(\d{1,3})\s*<', block)
        h = re.search(r"<h3>(.*?)<span class=\"report-tier[^\"]*\"[^>]*>(.*?)</span>\s*</h3>", block, re.S)
        p = re.search(r'class="report-rank__title">.*?<p>(.*?)</p>', block, re.S)
        if not (n and h and p):
            notes.append("a ranked deck was not understood (rank " + (n.group(1) if n else "?") + ")")
            continue
        trio = trio_names(h.group(1))
        tier = re.fullmatch(r"Tier (\d)", text_of(h.group(2)))
        line = text_of(p.group(1))
        wr = re.search(r"([\d.]+)% win rate", line)
        rec = re.search(r"([\d,]+[" + DASHES + r"][\d,]+)", line)
        share = re.search(r"([\d.]+)% of decks", line)
        players = re.search(r"([\d,]+) players", line)
        if not (trio and tier and wr and rec and share):
            notes.append("ranked deck " + n.group(1) + " was not understood")
            continue
        w, l = record(rec.group(1))
        row = {"rank": int(n.group(1)), "trio": trio, "tier": int(tier.group(1)), "winRate": number(wr.group(1)), "wins": w, "losses": l, "share": number(share.group(1))}
        if players:
            row["players"] = number(players.group(1))
        out.append(row)
    return out


def read_season(page, notes):
    tiles = metrics(page)
    totals = {}
    for label, key, detail_key in [("Ranked series", "series", "games"), ("Players", "players", "qualified"), ("Legend trios played", "trios", None)]:
        if label in tiles:
            totals[key] = first_number(tiles[label][0])
            if detail_key:
                totals[detail_key] = first_number(tiles[label][1])
    for pattern, key in [(r"([\d,]+) high-rank series", "highRankSeries"), (r"([\d,]+) high-rank Ranked games", "highRankGames")]:
        m = re.search(pattern, text_of(page))
        if m:
            totals[key] = number(m.group(1))
    m = re.search(r">\s*([\d,]+)\s*</[a-z]+>\s*<[a-z]+[^>]*>\s*high-rank decks\s*<", page)
    if m:
        totals["highRankDecks"] = number(m.group(1))
    totals = {k: v for k, v in totals.items() if v is not None}
    return {"totals": totals, "tiers": tier_list(page, notes), "field": legend_map(page, notes), "matchups": matchups(page, notes)}


def finish(s):
    m = re.fullmatch(r"(\d{1,3})(?:st|nd|rd|th)", text_of(s))
    return int(m.group(1)) if m else None


def tour_field(page, notes):
    """A tournament report's field table: [{trio, players, winRate, wins, losses, top8, best}]."""
    m = re.search(r'<table class="tour-table">(.*?)</table>', page, re.S)
    if not m:
        return []
    out = []
    for row in re.findall(r"<tr>(.*?)</tr>", m.group(1), re.S):
        th = re.search(r'<th scope="row">(.*?)</th>', row, re.S)
        if not th:
            continue
        names = re.findall(r"<span>([^<]*)</span>\s*</span>\s*$", th.group(1).strip())
        trio = trio_names(names[-1]) if names else None
        cells = re.findall(r"<td[^>]*>(.*?)</td>", row, re.S)
        if not trio or len(cells) < 5:
            notes.append("a row of the field table was not understood")
            continue
        players = re.match(r"\s*(\d{1,4})\b", text_of(cells[0]))
        rec = record(text_of(cells[2]))
        wr = re.fullmatch(r"([\d.]+)%", text_of(cells[1]))
        if not players or not rec or not wr:
            notes.append("a row of the field table was not understood")
            continue
        top = text_of(cells[3])
        out.append({"trio": trio, "players": int(players.group(1)), "winRate": number(wr.group(1)), "wins": rec[0], "losses": rec[1], "top8": int(top) if top.isdigit() else 0, "best": finish(cells[4])})
    return out


def top_cut(page, size, notes):
    """The final standings' top cut, place by place: [{place, trio}] (no player names)."""
    m = re.search(r'<table class="tour-table tour-table--standings">(.*?)</table>', page, re.S)
    if not m:
        return []
    out = []
    for row in re.findall(r"<tr[^>]*>(.*?)</tr>", m.group(1), re.S):
        place = re.search(r'<td class="tour-table__place">\s*(\d{1,3})\s*</td>', row)
        cells = re.findall(r"<td>(.*?)</td>", row, re.S)
        if not place or int(place.group(1)) > size:
            continue
        trio = trio_names(cells[0]) if cells else None
        if not trio:
            notes.append("place " + place.group(1) + " of the standings was not understood")
            continue
        out.append({"place": int(place.group(1)), "trio": trio})
    return out


def read_tournament(page, notes):
    tiles = metrics(page)
    totals = {}
    if "Players" in tiles:
        totals["players"] = first_number(tiles["Players"][0])
        totals["registered"] = first_number(tiles["Players"][1])
    if "Rounds" in tiles:
        m = re.fullmatch(r"(\d{1,2})(?: \+ top (\d{1,3}))?", tiles["Rounds"][0])
        if m:
            totals["rounds"] = int(m.group(1))
            if m.group(2):
                totals["topCut"] = int(m.group(2))
        detail = tiles["Rounds"][1].lower()
        for words, key in [("swiss rounds best-of-", "swissBestOf"), ("top cut best-of-", "topCutBestOf")]:
            mm = re.search(re.escape(words) + r"(one|two|three|five|\d)", detail)
            if mm:
                totals[key] = {"one": 1, "two": 2, "three": 3, "five": 5}.get(mm.group(1)) or int(mm.group(1))
    if "Games played" in tiles:
        totals["games"] = first_number(tiles["Games played"][0])
    if "Legend trios" in tiles:
        totals["trios"] = first_number(tiles["Legend trios"][0])
    totals = {k: v for k, v in totals.items() if v is not None}
    return {"totals": totals, "field": tour_field(page, notes), "topCut": top_cut(page, totals.get("topCut", 8), notes)}


def read_report(page, link):
    """One report page: its kind, address, dates and figures (raises FetchFailed when it is no report this reads)."""
    notes = []
    eb = eyebrow(page)
    out = {"link": link, "title": heading(page), "eyebrow": eb[:120], "published": page_date(page)[:40], "notes": notes}
    period = read_period(eb)
    if eb.startswith("Ranked season report"):
        out["kind"] = "season"
        out["period"] = {"from": period[0], "to": period[1]}
        out.update(read_season(page, notes))
        if not out["tiers"] and not out["field"]:
            raise FetchFailed("no power rankings or legend map found on this season report")
    elif eb.startswith("Tournament report"):
        out["kind"] = "tournament"
        out["date"] = period[0]
        out.update(read_tournament(page, notes))
        if not out["field"]:
            raise FetchFailed("no field table found on this tournament report")
    else:
        raise NotAReport("this page is not a season or tournament report this script reads")
    return out


# ---------------------------------------------------------------- the run


def check_link(link):
    """A report link this script may request, or raise Refused."""
    if site_of(link) != SIM:
        raise Refused("This script reads cyberpunk-tcg-sim.online's meta reports only; choom.gg's meta ratings come with the deck library (scripts/import-meta.ts).")
    if not REPORT_PATH.match(urllib.parse.urlsplit(link).path):
        raise Refused("This is not a meta report (its address should be https://cyberpunk-tcg-sim.online/meta/<report>).")


def page_key(link):
    """The same page however its link is written: the sim site's address of its path, without a final slash, query or
    fragment (None for a link that is neither a report nor the reports' index)."""
    try:
        parts = urllib.parse.urlsplit(link)
        if site_of(link) != SIM:
            return None
    except (Refused, ValueError):
        return None
    path = parts.path.rstrip("/") or "/"
    if REPORT_PATH.match(path) or INDEX_PATH.match(path):
        return "https://" + SIM + path
    return None


def found_links(page, base):
    """The report links and the index link on a page, in page order, each once, as page keys."""
    seen, out = set(), []
    for url in deck_import.links_in(page, base):
        key = page_key(url)
        if key and key not in seen:
            seen.add(key)
            out.append(key)
    return out


def known_links(path):
    """The report links of the previous tracked file (src/data/outsideMeta.json), at most MAX_KNOWN; [] when there is
    no such file. Raises ValueError when the file is there but not readable."""
    if not path or not os.path.exists(path):
        return []
    with open(path, encoding="utf-8") as f:
        doc = json.load(f)
    if not isinstance(doc, dict) or doc.get("kind") != "nct-outside-meta" or not isinstance(doc.get("sources"), list):
        raise ValueError(path + " is not an outside-meta file")
    out = []
    for s in doc["sources"]:
        link = s.get("link") if isinstance(s, dict) else None
        key = page_key(link) if isinstance(link, str) else None
        if key and REPORT_PATH.match(urllib.parse.urlsplit(key).path) and key not in out:
            out.append(key)
    return out[:MAX_KNOWN]


def read_pages(links, fetcher, collected, say=lambda line: None, saved=None, discover=False, found=None):
    """Read every link (or every saved page): the import document, without writing it.

    With `discover`, the report links (/meta/<report>) found on the pages read are read too, up to MAX_NEW new reports
    and the page cap, and so is the reports' index page when a page read links to it. A page that turns out not to be a
    report is recorded as "not a report" and never fails the run. `found` says where each given link came from."""
    doc = {"kind": KIND, "schema": SCHEMA, "ran": collected["ran"], "tool": "tools/import_outside_meta.py", "links": [], "pages": [], "discovery": {"on": bool(discover and saved is None), "new": 0, "leftOut": []}}
    stopped = None
    found = found or {}
    if saved is not None:
        queue = [(path, None, "saved") for path in saved]
    else:
        queue = [(None, link, found.get(link, "given")) for link in links]
    keys = {page_key(link) for _, link, _ in queue if link}
    new = 0
    i = 0
    while i < len(queue):
        path, link, origin = queue[i]
        i += 1
        report = {"link": (link or path or "")[:2000], "status": "", "note": "", "found": origin}
        doc["links"].append(report)
        if stopped:
            report.update(status="not read", note=stopped)
            continue
        page = None
        try:
            if path is not None:
                with open(path, encoding="utf-8") as f:
                    page = f.read(deck_import.MAX_BYTES + 1)
                if len(page) > deck_import.MAX_BYTES:
                    raise FetchFailed("the saved page is larger than 5 MB")
                link = canonical(page)
                report["link"] = link
                check_link(link)
                report.update(status="saved", note="read from a saved copy, no request")
            else:
                index = INDEX_PATH.match(urllib.parse.urlsplit(link).path or "/")
                if not index:
                    check_link(link)
                elif site_of(link) != SIM:
                    raise Refused("Only cyberpunk-tcg-sim.online's own reports index is read.")
                page = fetcher.get(link)
                report.update(status="fetched")
                own = canonical(page)
                if own and not index:
                    check_link(own)
                    link = own
                    keys.add(page_key(own))
                if index:
                    raise NotAReport("the reports' index page, read for its report links")
            parsed = read_report(page, link)
            parsed["collected"] = collected["day"]
            doc["pages"].append(parsed)
            report["note"] = (report["note"] + "; " if report["note"] else "") + "a " + parsed["kind"] + " report"
        except Refused as e:
            report.update(status="refused", note=str(e))
        except NotAReport as e:
            report.update(status="not a report", note=str(e))
        except FetchFailed as e:
            report.update(status="failed", note=str(e))
        except OSError as e:
            report.update(status="failed", note="the saved page could not be read (" + str(e)[:80] + ")")
        except Stop as e:
            stopped = str(e)
            report.update(status="stopped", note=stopped)
        if discover and saved is None and page is not None and not stopped:
            for key in found_links(page, link):
                if key in keys:
                    continue
                keys.add(key)
                is_index = bool(INDEX_PATH.match(urllib.parse.urlsplit(key).path))
                if not is_index and new >= MAX_NEW:
                    doc["discovery"]["leftOut"].append({"link": key, "why": "more than " + str(MAX_NEW) + " new reports in one run"})
                    continue
                if len(queue) >= MAX_PAGES:
                    doc["discovery"]["leftOut"].append({"link": key, "why": "the run's " + str(MAX_PAGES) + "-page cap"})
                    continue
                parts = urllib.parse.urlsplit(key)
                try:
                    allowed = fetcher.robots_for(key).allowed(parts.path, parts.query)
                except Stop:
                    allowed = False
                if not allowed:
                    doc["discovery"]["leftOut"].append({"link": key, "why": "the robots rules keep this script out of it"})
                    continue
                if not is_index:
                    new += 1
                queue.append((None, key, "index" if is_index else "found"))
        say("  " + report["status"].ljust(12) + " " + deck_import.shorten(report["link"]) + ("  (" + report["note"] + ")" if report["note"] else ""))
    doc["discovery"]["new"] = new
    return doc, stopped


# ---------------------------------------------------------------- the job summary


def md(s, size=160):
    """Text for a Markdown summary: no markup, no control characters, capped."""
    s = re.sub(r"[\x00-\x1f\x7f]", " ", str(s))
    s = re.sub(r"[<>`|*_\[\]\\#!]", " ", s)
    s = re.sub(r"\s+", " ", s).strip()
    return s if len(s) <= size else s[: size - 1] + "…"


def summary_lines(doc, stopped, rules_stop):
    out = ["### Outside meta: reading cyberpunk-tcg-sim.online", ""]
    for r in doc.get("robots", []):
        sig = lambda d: ", ".join(md(k, 30) + "=" + md(v, 30) for k, v in sorted(d.items())) or "none"
        line = "- Robots file " + md(r.get("url"), 100) + ": status " + md(r.get("status")) + ", " + md(r.get("kind"))
        if r.get("kind") == "rules":
            line += (
                "; sha256 " + md(r.get("sha256"), 64) + "; the group that applies to us: " + md(r.get("group"), 40)
                + "; content signals of every reader's group: " + sig(r.get("genericSignals", {}))
                + "; rules that apply to us: " + (md("; ".join(r.get("rules", [])), 400) or "none")
                + "; Crawl-delay: " + md(r.get("crawlDelay") if r.get("crawlDelay") is not None else "none")
            )
        else:
            line += " (" + md(r.get("reason"), 200) + ")"
        if r.get("accepted"):
            line += "; accepted on " + md(r["accepted"].get("on")) + ": " + sig(r["accepted"].get("signals", {}))
        line += ". Checked " + md(r.get("checked")) + ". Verdict: " + md(r.get("verdict", ""), 300) + "."
        out.append(line)
    if rules_stop:
        out += ["", "**Stopped by the site's robots rules (exit 3), before any page was read:** " + md(rules_stop, 400), "", "Nothing was changed. If the site's rules changed on purpose, a person reads the new robots file and, if it still allows this job, edits the accepted values in tools/robots.py (docs/DECK_IMPORT.md, Running by itself)."]
        return out
    out += ["", "| Page | Found | Status | Note |", "| --- | --- | --- | --- |"]
    for l in doc["links"]:
        path = urllib.parse.urlsplit(l["link"]).path if l["link"].startswith("http") else l["link"]
        out.append("| " + md(path, 90) + " | " + md(l.get("found", "")) + " | " + md(l["status"]) + " | " + md(l["note"], 160) + " |")
    d = doc.get("discovery", {})
    if d.get("on"):
        out += ["", "New reports found by following links: " + str(d.get("new", 0)) + "." + (" Left out: " + "; ".join(md(urllib.parse.urlsplit(x["link"]).path, 90) + " (" + md(x["why"]) + ")" for x in d.get("leftOut", [])) + "." if d.get("leftOut") else "")]
    if stopped:
        out += ["", "**Stopped:** " + md(stopped, 300) + ". Nothing was changed."]
    return out


def write_summary(path, doc, stopped, rules_stop):
    if not path:
        return
    with open(path, "a", encoding="utf-8", newline="\n") as f:
        f.write("\n".join(summary_lines(doc, stopped, rules_stop)) + "\n\n")


# ---------------------------------------------------------------- the command line


def parse_args(argv):
    parser = argparse.ArgumentParser(
        prog="import_outside_meta.py",
        description="Collect the figures of cyberpunk-tcg-sim.online's meta reports into one JSON file for Night City Trainer (scripts/import-outside-meta.ts). Exit codes: 0 read, 1 stopped (403, 429, a bot check) or no report read, 2 a bad command line, 3 stopped by the site's robots rules.",
    )
    parser.add_argument("links", nargs="*", metavar="LINK", help="a meta report's link (default: the season-1 and Discord 5k reports, the reports of --previous, and the reports found by following links)")
    parser.add_argument("--saved", action="append", metavar="FILE", help="read a page saved earlier instead (no request); repeat for more")
    parser.add_argument("--collected", metavar="YYYY-MM-DD", help="the day the saved pages were saved (needed with --saved)")
    parser.add_argument("--out", metavar="FILE", default=DEFAULT_OUT, help="where to write the result (default: " + DEFAULT_OUT + ")")
    parser.add_argument("--previous", metavar="FILE", help="the tracked file whose reports are read again (default with no LINK: src/data/outsideMeta.json when it exists)")
    parser.add_argument("--discover", dest="discover", action="store_true", default=None, help="also read the reports linked from the pages read (on by default with no LINK)")
    parser.add_argument("--no-discover", dest="discover", action="store_false", help="read only the links given")
    parser.add_argument("--summary", metavar="FILE", help="append a Markdown summary of the run to FILE (GitHub's job summary)")
    parser.add_argument("--delay", type=float, default=deck_import.DEFAULT_DELAY, help="seconds between requests (default 2, at least 1)")
    parser.add_argument("--force", action="store_true", help="replace the output file if it exists")
    args = parser.parse_args(argv)
    if not args.delay >= deck_import.MIN_DELAY:
        parser.error("--delay must be at least 1 second")
    if args.saved and args.links:
        parser.error("give links or --saved pages, not both")
    if args.saved and not args.collected:
        parser.error("--saved needs --collected YYYY-MM-DD (the day the pages were saved)")
    if args.saved and args.discover:
        parser.error("--discover reads pages; --saved reads none")
    if args.collected:
        try:
            datetime.strptime(args.collected, "%Y-%m-%d")
        except ValueError:
            parser.error("--collected must be a date written YYYY-MM-DD")
    found = {}
    links = list(args.links)
    if not links and not args.saved:
        previous = args.previous if args.previous is not None else "src/data/outsideMeta.json"
        try:
            known = known_links(previous)
        except (OSError, ValueError) as e:
            parser.error("cannot read --previous: " + str(e)[:200])
        for link in DEFAULT_LINKS:
            found[link] = "default"
        for link in known:
            found.setdefault(link, "known")
        links = list(found)
        if args.discover is None:
            args.discover = True
    elif args.previous is not None:
        parser.error("--previous goes with the default run (no LINK, no --saved)")
    args.discover = bool(args.discover) and not args.saved
    if len(links) > MAX_PAGES or len(args.saved or []) > MAX_PAGES:
        parser.error("at most " + str(MAX_PAGES) + " pages a run")
    args.found = found
    return args, links


def main(argv=None, fetcher=None, out=sys.stdout, now=None):
    for stream in (out, sys.stderr):
        if hasattr(stream, "reconfigure"):
            stream.reconfigure(errors="replace")
    args, links = parse_args(sys.argv[1:] if argv is None else argv)
    if os.path.exists(args.out) and not args.force:
        print("error: " + args.out + " already exists; pass --force to replace it, or --out another file.", file=sys.stderr)
        return 2
    stamp = now or datetime.now(timezone.utc).replace(microsecond=0).isoformat().replace("+00:00", "Z")
    collected = {"ran": stamp, "day": args.collected or stamp[:10]}
    say = lambda line: print(line, file=out, flush=True)
    fetcher = fetcher or Fetcher(delay=args.delay, max_pages=MAX_PAGES, day=stamp[:10])
    if args.saved:
        say("Reading " + str(len(args.saved)) + " saved page" + ("" if len(args.saved) == 1 else "s") + " (no request):")
    else:
        say("Reading " + str(len(links)) + " report" + ("" if len(links) == 1 else "s") + (" and the reports linked from them" if args.discover else "") + " (the site's robots file first, then one request every " + str(fetcher.delay) + " s at most):")
    doc, stopped = read_pages(links, fetcher, collected, say, saved=args.saved, discover=args.discover, found=args.found)
    doc["robots"] = fetcher.robots_facts
    rules_stop = fetcher.rules_stop
    if rules_stop or stopped:
        doc["stopped"] = rules_stop or stopped
    write_summary(args.summary, doc, stopped, rules_stop)
    # the output records what the run saw, a stopped run too (its pages are then empty or partial; the converter carries
    # the previous file forward for every report not read, and the workflow does not run it after a stop)
    with open(args.out, "w", encoding="utf-8", newline="\n") as f:
        json.dump(doc, f, ensure_ascii=False, indent=2)
        f.write("\n")
    if rules_stop:
        say("Stopped by the site's robots rules before any page was read (exit 3): " + rules_stop)
        return 3
    for page in doc["pages"]:
        rows = len(page.get("tiers", [])) if page["kind"] == "season" else len(page.get("topCut", []))
        say("  - " + (page["title"] or page["link"])[:70] + ": " + str(len(page["field"])) + " trios in the field, " + str(rows) + (" ranked decks" if page["kind"] == "season" else " top-cut places") + (", " + str(len(page["notes"])) + " notes" if page["notes"] else ""))
    say("Wrote " + str(len(doc["pages"])) + " report" + ("" if len(doc["pages"]) == 1 else "s") + " to " + args.out + " (" + str(fetcher.pages) + " page" + ("" if fetcher.pages == 1 else "s") + " requested).")
    if stopped:
        say("Stopped early: " + stopped + ". Try again later.")
    say("Next: npx tsx scripts/import-outside-meta.ts " + args.out)
    return 1 if stopped or not doc["pages"] else 0


if __name__ == "__main__":
    sys.exit(main())


