#!/usr/bin/env python3
"""Test support for the unattended refresh's rehearsal (tests/outside-meta-refresh.test.ts): runs
tools/import_outside_meta.py exactly as the workflow does, but every request is answered from a JSON file of invented
pages, the clock is fake (no waiting) and nothing goes to the network.

Usage:
  python tools/rehearse_outside_meta.py PAGES.json REQUESTS.json NOW [import_outside_meta.py arguments...]

PAGES.json maps an address to [status, text]; an address it does not name answers 404, and a status of 400 or more is
answered as an HTTP error, as urllib raises it. "timeout" in place of a status is a timeout. REQUESTS.json is written with
every address asked, in order. NOW is the run's time (YYYY-MM-DDTHH:MM:SSZ). The exit code is the script's.
"""

import json
import os
import sys
import urllib.error

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import import_decks  # noqa: E402
import import_outside_meta  # noqa: E402


def main(argv):
    pages_file, requests_file, now = argv[0], argv[1], argv[2]
    with open(pages_file, encoding="utf-8") as f:
        pages = json.load(f)
    asked = []
    clock = [1000.0]

    def opener(url):
        asked.append(url)
        clock[0] += 0.1
        answer = pages.get(url)
        if answer is None:
            raise urllib.error.HTTPError(url, 404, "not found", {}, None)
        status, text = answer
        if status == "timeout":
            raise urllib.error.URLError("timed out")
        if status >= 400:
            raise urllib.error.HTTPError(url, status, "error", {}, None)
        return status, text

    def sleep(seconds):
        clock[0] += seconds

    fetcher = import_decks.Fetcher(delay=import_decks.DEFAULT_DELAY, opener=opener, clock=lambda: clock[0], sleep=sleep, max_pages=import_outside_meta.MAX_PAGES, day=now[:10])
    try:
        return import_outside_meta.main(argv[3:], fetcher=fetcher, now=now)
    finally:
        with open(requests_file, "w", encoding="utf-8") as f:
            json.dump(asked, f)


if __name__ == "__main__":
    sys.exit(main(sys.argv[1:]))
