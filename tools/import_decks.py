#!/usr/bin/env python3
"""Collect Cyberpunk TCG deck lists from shared links into one JSON file.

Usage:
  python tools/import_decks.py LINK [LINK ...] [--out FILE] [--limit N] [--delay SECONDS] [--force]
  python tools/import_decks.py --from-file links.txt [--out FILE] ...

It reads public pages on two sites only, choom.gg and cyberpunk-tcg-sim.online:
  - a deck-builder link of cyberpunk-tcg-sim.online carries its list in the address, so it is read without a request;
  - a choom.gg deck page (https://choom.gg/decks/<id>) is fetched and read;
  - any other page on the two sites is fetched and searched for deck links, which are then read in page order,
    without repeats, up to --limit decks per page.

It is polite on purpose: one request at a time, at least --delay seconds apart (2 by default, never under 1), a
30-second timeout, one retry, at most 60 pages in one run, and it stops at once if a site answers 403 or 429. It never
asks for the paths choom.gg's robots rules keep out (/api/ and /admin), follows no link off the two sites, runs nothing
it downloads, and writes nothing but the output file (deck-import.json by default; an existing file is replaced only
with --force).

Load the output on the site's admin page (#/admin, "Import decks"), or write library deck files from it with
  npx tsx scripts/import-links.ts deck-import.json
The script knows nothing about the trainer's card ids: it records each card as the site wrote it (an id, a short code
or a name) and the trainer matches them. Python 3.9 or later, standard library only.
"""

import argparse
import html
import json
import os
import posixpath
import re
import sys
import time
import urllib.error
import urllib.parse
import urllib.request
from datetime import datetime, timezone

KIND = "nct-deck-import"
SCHEMA = 1

CHOOM = "choom.gg"
SIM = "cyberpunk-tcg-sim.online"
HOSTS = {"choom.gg": CHOOM, "www.choom.gg": CHOOM, "cyberpunk-tcg-sim.online": SIM, "www.cyberpunk-tcg-sim.online": SIM}

# A plain name for the requests: it says what reads the page and nothing about who runs it.
USER_AGENT = "deck-import-script/1.0"
DEFAULT_OUT = "deck-import.json"
DEFAULT_LIMIT = 20
MAX_LIMIT = 60
DEFAULT_DELAY = 2.0
MIN_DELAY = 1.0
MAX_PAGES = 60
TIMEOUT = 30
MAX_BYTES = 5_000_000
MAX_COUNT = 50

DECK_PAGE = re.compile(r"^/decks/([0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})/?$")
# a compact card code: the set's first letter, the print number in base 36, and a letter suffix such as "-a" (005a)
CODE = r"[a-z][0-9a-z]{1,4}(?:-[a-z]{1,2})?"
PLACEMENT = re.compile(r"\(([^()]{1,40})\)\s*$")
PLAYER_EVENT = re.compile(r"^(.{1,60}?) - (.+)$")


class Refused(Exception):
    """A link this script will not read, with the reason as one sentence."""


class Stop(Exception):
    """The site asked us to stop (403 or 429): the run ends here."""


class FetchFailed(Exception):
    """A page could not be read, even after one retry."""


# ---------------------------------------------------------------- links


def site_of(url):
    """The site a link is on, or raise Refused with the reason."""
    try:
        parts = urllib.parse.urlsplit(url.strip())
    except ValueError:
        raise Refused("This is not a link.")
    if parts.scheme not in ("http", "https") or not parts.netloc:
        raise Refused("This is not a web link (it should start with https://).")
    host = (parts.hostname or "").lower()
    site = HOSTS.get(host)
    if site is None:
        raise Refused("This script reads only choom.gg and cyberpunk-tcg-sim.online, not " + (host or "this address") + ".")
    # compared the way a server would read the path: percent-escapes undone, repeated slashes as one, "." and ".."
    # steps taken, any letter case
    path = posixpath.normpath(re.sub(r"/+", "/", "/" + urllib.parse.unquote(parts.path))).lower()
    if site == CHOOM and (path == "/api" or path.startswith("/api/") or path.startswith("/admin")):
        raise Refused("choom.gg asks automated readers to stay out of /api/ and /admin, so this script never reads them.")
    return site


def is_deck_builder(url):
    parts = urllib.parse.urlsplit(url)
    return HOSTS.get((parts.hostname or "").lower()) == SIM and parts.path.rstrip("/") == "/deck-builder" and bool(parts.query)


def split_name(name):
    """(author, placement) read from a deck name such as "PLAYER - EVENT (1st)" or "A / B / C (Season-1 #2)"."""
    placement = ""
    m = PLACEMENT.search(name)
    if m:
        placement = m.group(1).strip()
    author = ""
    m = PLAYER_EVENT.match(name)
    if m and placement:
        author = m.group(1).strip()
    return author, placement


def parse_counts(value, notes):
    """'ref:n,ref:n' as a list of {ref, count}; a part that is not ref:n is noted, not guessed."""
    out = []
    for part in value.split(","):
        part = part.strip()
        if not part:
            continue
        ref, sep, n = part.rpartition(":")
        if not sep or not ref or not n.isdigit() or not 1 <= int(n) <= MAX_COUNT:
            notes.append("part not understood: " + part[:60])
            continue
        out.append({"ref": ref, "by": "id", "count": int(n)})
    return out


def parse_compact(code, notes):
    """The compact form d=l.<code>.<code>.<code>.d.<n>_<code>....s.<n>_<code>...: legends, main deck, sideboard."""
    sections = {"l": "legends", "d": "main", "s": "sideboard"}
    deck = {"legends": [], "main": [], "sideboard": []}
    current = None
    for token in code.split("."):
        if token in sections:
            current = sections[token]
            continue
        if re.fullmatch(r"[a-z]", token):
            current = None  # a section this script does not know: its parts are noted, not read
            notes.append("section not understood: " + token)
            continue
        if current == "legends" and re.fullmatch(CODE, token):
            deck["legends"].append({"ref": token, "by": "code", "count": 1})
            continue
        m = re.fullmatch(r"(\d{1,2})_(" + CODE + ")", token)
        if current in ("main", "sideboard") and m and 1 <= int(m.group(1)) <= MAX_COUNT:
            deck[current].append({"ref": m.group(2), "by": "code", "count": int(m.group(1))})
            continue
        notes.append("part not understood: " + token[:60])
    return deck


def empty_deck(site, link):
    return {
        "name": "",
        "author": "",
        "source": {"site": site, "link": link, "page": "", "pageLink": "", "placement": "", "date": ""},
        "legends": [],
        "main": [],
        "sideboard": [],
        "notes": [],
    }


def decode_deck_builder(url):
    """A cyberpunk-tcg-sim.online deck-builder link read from its address alone (no request)."""
    query = urllib.parse.parse_qs(urllib.parse.urlsplit(url).query)
    deck = empty_deck(SIM, url)
    notes = deck["notes"]
    first = lambda key: (query.get(key) or [""])[0]
    if first("d"):
        deck.update(parse_compact(first("d"), notes))
    elif first("deck").startswith("cb-"):
        refs = parse_counts(first("deck"), notes)
        deck["legends"] = refs[:3]
        deck["main"] = refs[3:]
        if first("sideboard"):
            deck["sideboard"] = parse_counts(first("sideboard"), notes)
    else:
        raise Refused("This deck-builder link carries no list (it names a deck saved in someone's browser); ask for a link with the list in it.")
    name = first("name").strip()
    deck["name"] = name
    deck["author"], deck["source"]["placement"] = split_name(name)
    if not deck["legends"] and not deck["main"]:
        raise Refused("This deck-builder link has no cards in it.")
    return deck


# ---------------------------------------------------------------- pages


def text_of(fragment):
    return html.unescape(re.sub(r"<[^>]+>", "", fragment)).strip()


def page_title(page):
    m = re.search(r"<title[^>]*>(.*?)</title>", page, re.S | re.I)
    return re.sub(r"\s+", " ", text_of(m.group(1))) if m else ""


def page_date(page):
    m = re.search(r'<meta[^>]+property="article:published_time"[^>]+content="([^"]{4,40})"', page)
    return m.group(1) if m else ""


def links_in(page, base):
    """Every href on the page as an absolute address, in page order."""
    for m in re.finditer(r'href="([^"]+)"', page):
        yield urllib.parse.urljoin(base, html.unescape(m.group(1)))


def choom_deck_links(page, base):
    seen, out = set(), []
    for url in links_in(page, base):
        parts = urllib.parse.urlsplit(url)
        m = DECK_PAGE.match(parts.path)
        if HOSTS.get((parts.hostname or "").lower()) == CHOOM and m:
            clean = "https://choom.gg/decks/" + m.group(1)
            if clean not in seen:
                seen.add(clean)
                out.append(clean)
    return out


def sim_deck_links(page, base):
    seen, out = set(), []
    for url in links_in(page, base):
        if is_deck_builder(url) and url not in seen:
            query = urllib.parse.parse_qs(urllib.parse.urlsplit(url).query)
            if (query.get("d") or [""])[0] or (query.get("deck") or [""])[0].startswith("cb-"):
                seen.add(url)
                out.append(url)
    return out


def next_data(page):
    """The text a Next.js page streams in its self.__next_f.push([1, "..."]) scripts, joined."""
    chunks = []
    for m in re.finditer(r"<script[^>]*>\s*self\.__next_f\.push\((.*?)\)\s*;?\s*</script>", page, re.S):
        try:
            item = json.loads(m.group(1))
        except ValueError:
            continue
        if isinstance(item, list) and len(item) > 1 and isinstance(item[1], str):
            chunks.append(item[1])
    return "".join(chunks)


def choom_card_ref(card, count):
    """A choom.gg card record as a reference: its external id, with its name kept as a second way to match it."""
    name = str(card.get("name") or "").strip()
    sub = str(card.get("subname") or "").strip()
    ref = {"ref": str(card.get("external_id") or "").strip(), "by": "id", "name": name + (" — " + sub if sub else ""), "count": count}
    if not ref["ref"]:
        ref["ref"], ref["by"] = ref["name"], "name"
        del ref["name"]
    return ref


def choom_entries(items, notes, what):
    out = []
    for item in items if isinstance(items, list) else []:
        if not isinstance(item, dict):
            continue
        card = item.get("card") if isinstance(item.get("card"), dict) else item
        count = item.get("quantity", item.get("count", 1))
        if not isinstance(count, int) or not 1 <= count <= MAX_COUNT:
            notes.append("a " + what + " entry with an unreadable count was left out")
            continue
        out.append(choom_card_ref(card, count))
    return out


def choom_deck_from_page(page, url):
    """A choom.gg deck page: the deck record in the page's data, else the list shown in the page's markup."""
    deck = empty_deck(CHOOM, url)
    notes = deck["notes"]
    title = page_title(page)
    description = ""
    m = re.search(r'<meta name="description" content="([^"]*)"', page)
    if m:
        description = html.unescape(m.group(1))
    m = re.search(r", by (.{1,80}?)\.\s*$", description)
    deck["author"] = m.group(1).strip() if m else ""
    m = re.match(r"(.{1,120}?): a Cyberpunk TCG", description)
    deck["name"] = m.group(1).strip() if m else title
    deck["source"].update({"page": title, "pageLink": url})

    data = next_data(page)
    at = data.find('{"deckName":')
    record = None
    if at >= 0:
        try:
            record, _ = json.JSONDecoder().raw_decode(data, at)
        except ValueError:
            record = None
    if isinstance(record, dict) and isinstance(record.get("cards"), list):
        if isinstance(record.get("deckName"), str) and record["deckName"].strip():
            deck["name"] = record["deckName"].strip()
        deck["legends"] = [choom_card_ref(c, 1) for c in record.get("legends") or [] if isinstance(c, dict)]
        deck["main"] = choom_entries(record["cards"], notes, "main-deck")
        deck["sideboard"] = choom_entries(record.get("sideboard"), notes, "sideboard")
        return deck

    # no deck record in the page's data: read what the page shows
    notes.append("read from the page's visible list (its data record was not found); a sideboard is not shown there")
    seen = []
    for m in re.finditer(r'aria-label="([^"]{3,120}?), RAM \d+"', page):
        name = html.unescape(m.group(1)).strip()
        if name not in seen:
            seen.append(name)
    deck["legends"] = [{"ref": n, "by": "name", "count": 1} for n in seen[:3]]
    shown = re.sub(r"<!--.*?-->", "", page, flags=re.S)
    for m in re.finditer(r"(\d{1,2})\s*<span[^>]*>\s*cop(?:y|ies) of ([^<]{1,120}?) in deck\s*</span>", shown):
        deck["main"].append({"ref": html.unescape(m.group(2)).strip(), "by": "name", "count": int(m.group(1))})
    if not deck["legends"] and not deck["main"]:
        raise FetchFailed("no deck list found on this page")
    return deck


# ---------------------------------------------------------------- fetching


class SameSiteRedirects(urllib.request.HTTPRedirectHandler):
    """Follow a redirect only to an address this script may read."""

    def redirect_request(self, req, fp, code, msg, headers, newurl):
        try:
            site_of(newurl)
        except Refused as e:
            raise FetchFailed("the site redirected to an address this script does not read (" + str(e) + ")")
        return super().redirect_request(req, fp, code, msg, headers, newurl)


def urllib_open(url):
    """GET a page: (status, text). Raises urllib's errors."""
    opener = urllib.request.build_opener(SameSiteRedirects())
    request = urllib.request.Request(url, headers={"User-Agent": USER_AGENT, "Accept": "text/html"})
    with opener.open(request, timeout=TIMEOUT) as response:
        body = response.read(MAX_BYTES + 1)
        if len(body) > MAX_BYTES:
            raise FetchFailed("the page is larger than " + str(MAX_BYTES // 1_000_000) + " MB")
        charset = response.headers.get_content_charset() or "utf-8"
        return response.status, body.decode(charset, errors="replace")


class Fetcher:
    """One request at a time, at least `delay` seconds apart, at most `max_pages` in a run, one retry."""

    def __init__(self, delay=DEFAULT_DELAY, opener=urllib_open, clock=time.monotonic, sleep=time.sleep, max_pages=MAX_PAGES):
        self.delay = max(MIN_DELAY, float(delay))
        self.opener = opener
        self.clock = clock
        self.sleep = sleep
        self.max_pages = max_pages
        self.pages = 0
        self.last = None

    def _wait(self):
        if self.last is not None:
            gap = self.clock() - self.last
            if gap < self.delay:
                self.sleep(self.delay - gap)
        self.last = self.clock()

    def get(self, url):
        site_of(url)  # never request an address the rules above refuse
        if self.pages >= self.max_pages:
            raise FetchFailed("this run has read " + str(self.max_pages) + " pages, the most one run reads")
        self.pages += 1
        problem = None
        for _attempt in range(2):
            self._wait()
            try:
                status, text = self.opener(url)
            except urllib.error.HTTPError as e:
                if e.code in (403, 429):
                    raise Stop(urllib.parse.urlsplit(url).hostname + " answered " + str(e.code) + (" (too many requests)" if e.code == 429 else " (forbidden)") + ", so the run stopped there")
                problem = "the site answered " + str(e.code)
                if e.code < 500:
                    break
                continue
            except FetchFailed:
                raise
            except (urllib.error.URLError, TimeoutError, OSError) as e:
                problem = "the page could not be reached (" + str(getattr(e, "reason", e))[:80] + ")"
                continue
            if status in (403, 429):
                raise Stop(urllib.parse.urlsplit(url).hostname + " answered " + str(status) + ", so the run stopped there")
            return text
        raise FetchFailed(problem or "the page could not be read")


# ---------------------------------------------------------------- the run


def read_links(links, fetcher, limit, now, say=lambda line: None):
    """Read every link: the import document (without writing it)."""
    doc = {"kind": KIND, "schema": SCHEMA, "ran": now, "tool": "tools/import_decks.py", "links": [], "decks": []}
    seen = set()
    stopped = None

    def add(deck):
        key = deck["source"]["link"]
        if key in seen:
            return False
        seen.add(key)
        doc["decks"].append(deck)
        return True

    def read_one(link, report):
        site = site_of(link)
        if is_deck_builder(link):
            report["decks"] = int(add(decode_deck_builder(link)))
            report.update(status="decoded", note="read from the address, no request")
            return
        path = urllib.parse.urlsplit(link).path
        if site == CHOOM and DECK_PAGE.match(path):
            deck = choom_deck_from_page(fetcher.get(link), link)
            report["decks"] = int(add(deck))
            report.update(status="fetched", note="a choom.gg deck page")
            return
        page = fetcher.get(link)
        title, date = page_title(page), page_date(page)
        found = choom_deck_links(page, link) if site == CHOOM else sim_deck_links(page, link)
        taken = found[:limit]
        report.update(status="fetched", note=str(len(found)) + " deck link" + ("" if len(found) == 1 else "s") + " on the page" + (", read the first " + str(limit) if len(found) > limit else ""))
        for url in taken:
            if url in seen:
                report["note"] += "; one was read already"
                continue
            try:
                if site == CHOOM:
                    deck = choom_deck_from_page(fetcher.get(url), url)
                else:
                    deck = decode_deck_builder(url)
            except (Refused, FetchFailed) as e:
                report["note"] += "; " + url + ": " + str(e)
                continue
            deck["source"].update({"page": title, "pageLink": link})
            if date:
                deck["source"]["date"] = date
            report["decks"] += int(add(deck))

    for link in links:
        report = {"link": link[:2000], "status": "", "decks": 0, "note": ""}
        doc["links"].append(report)
        if stopped:
            report.update(status="not read", note=stopped)
            continue
        try:
            read_one(link, report)
        except Refused as e:
            report.update(status="refused", note=str(e))
        except FetchFailed as e:
            report.update(status="failed", note=str(e))
        except Stop as e:
            stopped = str(e)
            report.update(status="stopped", note=stopped)
        say("  " + report["status"].ljust(9) + " " + shorten(link) + "  " + str(report["decks"]) + " deck" + ("" if report["decks"] == 1 else "s") + ("  (" + report["note"] + ")" if report["note"] else ""))
    return doc, stopped


def shorten(link, size=90):
    return link if len(link) <= size else link[: size - 3] + "..."


def parse_args(argv):
    parser = argparse.ArgumentParser(
        prog="import_decks.py",
        description="Collect Cyberpunk TCG deck lists from choom.gg and cyberpunk-tcg-sim.online links into one JSON file for Night City Trainer's admin page (#/admin, Import decks).",
    )
    parser.add_argument("links", nargs="*", metavar="LINK", help="a deck link or a page with deck links")
    parser.add_argument("--from-file", metavar="FILE", help="read links from FILE, one per line (blank lines and lines starting with # are skipped)")
    parser.add_argument("--out", metavar="FILE", default=DEFAULT_OUT, help="where to write the result (default: " + DEFAULT_OUT + ")")
    parser.add_argument("--limit", type=int, default=DEFAULT_LIMIT, help="most decks read from one page (default " + str(DEFAULT_LIMIT) + ", at most " + str(MAX_LIMIT) + ")")
    parser.add_argument("--delay", type=float, default=DEFAULT_DELAY, help="seconds between requests (default " + str(int(DEFAULT_DELAY)) + ", at least " + str(int(MIN_DELAY)) + ")")
    parser.add_argument("--force", action="store_true", help="replace the output file if it exists")
    args = parser.parse_args(argv)
    if not 1 <= args.limit <= MAX_LIMIT:
        parser.error("--limit must be between 1 and " + str(MAX_LIMIT))
    if not args.delay >= MIN_DELAY:
        parser.error("--delay must be at least " + str(int(MIN_DELAY)) + " second")
    links = list(args.links)
    if args.from_file:
        try:
            with open(args.from_file, encoding="utf-8") as f:
                links += [line.strip() for line in f if line.strip() and not line.strip().startswith("#")]
        except OSError as e:
            parser.error("cannot read --from-file: " + str(e))
    if not links:
        parser.error("give at least one link (or --from-file FILE)")
    return args, links


def main(argv=None, fetcher=None, out=sys.stdout, now=None):
    for stream in (out, sys.stderr):
        # a console that cannot show a character (a deck named with a heart, on a Windows code page) shows "?" instead
        if hasattr(stream, "reconfigure"):
            stream.reconfigure(errors="replace")
    args, links = parse_args(sys.argv[1:] if argv is None else argv)
    if os.path.exists(args.out) and not args.force:
        print("error: " + args.out + " already exists; pass --force to replace it, or --out another file.", file=sys.stderr)
        return 2
    fetcher = fetcher or Fetcher(delay=args.delay)
    say = lambda line: print(line, file=out, flush=True)
    say("Reading " + str(len(links)) + " link" + ("" if len(links) == 1 else "s") + " (one request every " + str(fetcher.delay) + " s at most):")
    stamp = now or datetime.now(timezone.utc).replace(microsecond=0).isoformat().replace("+00:00", "Z")
    doc, stopped = read_links(links, fetcher, args.limit, stamp, say)
    with open(args.out, "w", encoding="utf-8", newline="\n") as f:
        json.dump(doc, f, ensure_ascii=False, indent=2)
        f.write("\n")
    n = len(doc["decks"])
    say("Wrote " + str(n) + " deck" + ("" if n == 1 else "s") + " to " + args.out + " (" + str(fetcher.pages) + " page" + ("" if fetcher.pages == 1 else "s") + " requested).")
    for deck in doc["decks"]:
        cards = sum(r["count"] for r in deck["main"])
        side = sum(r["count"] for r in deck["sideboard"])
        say("  - " + (deck["name"] or "(no name)")[:70] + (" by " + deck["author"] if deck["author"] else "") + ": " + str(cards) + " cards" + (", sideboard " + str(side) if side else ""))
    if stopped:
        say("Stopped early: " + stopped + ". Try again later.")
    say("Next: load it on the admin page (#/admin, Import decks), or run: npx tsx scripts/import-links.ts " + args.out)
    return 1 if stopped or n == 0 else 0


if __name__ == "__main__":
    sys.exit(main())
