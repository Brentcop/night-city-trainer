#!/usr/bin/env python3
"""Robots rules (RFC 9309) for the import scripts, and the rules a person accepted for cyberpunk-tcg-sim.online.

The import scripts (tools/import_decks.py, tools/import_outside_meta.py) read a host's /robots.txt before their first
request to it, in every run, and keep to it (docs/DECK_IMPORT.md, "The rules the script keeps"). Python's own
urllib.robotparser is not used for any decision: for most of its history it kept only the first "User-agent: *" group
(a Cloudflare-managed file has two, one with the content signals and one with the paths) and ended a group at a blank
line (choom.gg's has a blank line inside its group), recent releases read both differently, and it knows nothing of
content signals, so what it decides would depend on the Python a run happens to use.

What this module reads, as RFC 9309 says:
  - A group starts at its User-agent lines (several in a row name one group) and runs until the next User-agent line
    that follows a rule. Blank lines and comments never end a group. Lines before the first User-agent are ignored.
  - The product token is matched case-insensitively and exactly ("deck-import-script"; a version after "/" is not part
    of it). Every group that names it is merged into one; only when none does, every "*" group is merged and used; with
    neither, nothing is disallowed.
  - Allow and Disallow with "*" (any characters) and a final "$" (the end of the address). Patterns and addresses are
    compared with their percent-escapes normalized (an escaped letter, digit or "-._~" undone, other escapes in capitals,
    other bytes escaped) and the address's "." and ".." steps taken. The longest matching pattern wins; a tie goes to
    Allow. An empty Disallow allows everything. /robots.txt itself is always allowed.
  - Crawl-delay (seconds) and Content-Signal (comma-separated key=value pairs; keys and values in any case, spaces
    ignored) are read per group and merged like the rules.

How a fetch is judged, always on the safe side (`judge`): 200 is read (a body over 500 KiB, or one that is a web page
rather than a robots file, is unreadable); 404, 410 and any other 4xx except 403 and 429 mean the host has no rules;
403, 429, any 5xx, a timeout, a redirect off the site or any other trouble mean the file is unreachable, and the run
stops (fail closed).

The tripwire (`tripwire`): for cyberpunk-tcg-sim.online the content signals a person read and accepted are written
below with the day they were accepted. A run stops before reading any page (exit code 3) when the file is missing or
unreadable, when the "*" group's signals are anything else (a changed or removed signal, a new key), when a group
names this script's agent, or when the rules disallow the report pages (/meta/). The accepted values change only when
a person edits this file after reading the site's new robots file; no script changes them.

Standard library only, Python 3.9 or later.
"""

import hashlib
import re
import string

# The product token of the scripts' User-Agent ("deck-import-script/1.0", tools/import_decks.py).
AGENT = "deck-import-script"
MAX_BYTES = 500 * 1024
MAX_CRAWL_DELAY = 60

# The rules a person read and accepted, by site. Change them only after reading the site's new robots file yourself
# (docs/DECK_IMPORT.md, "Running by itself"): no script edits this table.
ACCEPTED = {
    "cyberpunk-tcg-sim.online": {
        # accepted by the owner on 2026-11-18: the job collects plain figures to show with attribution; it is not an
        # AI system and trains nothing
        "accepted": "2026-11-18",
        "signals": {"search": "yes", "ai-train": "no", "use": "reference"},
        # the pages the outside-meta script reads (the reports under /meta/, and the "Meta reports" page their
        # breadcrumb links to): neither our agent's rules nor the "*" group may disallow them
        "paths": ["/meta", "/meta/"],
    },
}

_UNRESERVED = set(string.ascii_letters + string.digits + "-._~")
_LINE = re.compile(r"^\s*([A-Za-z][A-Za-z_-]*)\s*:\s*(.*?)\s*$")
_TOKEN = re.compile(r"[A-Za-z_-]+")


def normalize(s):
    """A pattern or address with its escapes normalized: %XX of a letter, digit or -._~ undone, other escapes in
    capitals, and every byte outside printable ASCII escaped (a non-ASCII character as its UTF-8 bytes)."""
    data = s.encode("utf-8")
    out = []
    i = 0
    while i < len(data):
        c = data[i]
        if c == 0x25 and i + 2 < len(data) and re.fullmatch(rb"[0-9A-Fa-f]{2}", data[i + 1 : i + 3]):
            ch = chr(int(data[i + 1 : i + 3], 16))
            out.append(ch if ch in _UNRESERVED else "%" + data[i + 1 : i + 3].decode("ascii").upper())
            i += 3
            continue
        out.append(chr(c) if 0x20 < c < 0x7F else "%%%02X" % c)
        i += 1
    return "".join(out)


def remove_dot_segments(path):
    """RFC 3986 5.2.4: the address's "." and ".." steps taken."""
    out = []
    segments = path.split("/")
    for i, seg in enumerate(segments):
        last = i == len(segments) - 1
        if seg == ".":
            if last:
                out.append("")
            continue
        if seg == "..":
            if len(out) > 1:
                out.pop()
            if last:
                out.append("")
            continue
        out.append(seg)
    result = "/".join(out)
    return result if result.startswith("/") else "/" + result


def address_forms(path, query=""):
    """The forms of an address the rules are checked against: as given, and with repeated slashes as one (a server
    may read it either way, so both must be allowed)."""
    base = remove_dot_segments(normalize(path or "/"))
    q = ("?" + normalize(query)) if query else ""
    forms = [base + q]
    collapsed = re.sub(r"/{2,}", "/", base) + q
    if collapsed != forms[0]:
        forms.append(collapsed)
    return forms


class Rule:
    def __init__(self, allow, pattern):
        self.allow = allow
        p = normalize(pattern)
        if not p.startswith("/") and not p.startswith("*"):
            p = "/" + p
        self.pattern = p
        anchored = p.endswith("$")
        body = p[:-1] if anchored else p
        self.regex = re.compile("".join(".*" if ch == "*" else re.escape(ch) for ch in body) + ("$" if anchored else ""), re.S)

    def matches(self, address):
        return self.regex.match(address) is not None

    def words(self):
        return ("Allow: " if self.allow else "Disallow: ") + self.pattern


class Group:
    def __init__(self):
        self.agents = []
        self.rules = []
        self.delays = []
        self.signal_lines = []

    def merged_with(self, other):
        g = Group()
        g.agents = self.agents + other.agents
        g.rules = self.rules + other.rules
        g.delays = self.delays + other.delays
        g.signal_lines = self.signal_lines + other.signal_lines
        return g


def parse_signals(lines):
    """Content-Signal lines as one dict (keys and values lowercased, spaces ignored). A key given twice with two values,
    or a part that is not key=value, gives a value no accepted table holds, so a comparison fails."""
    out = {}
    for line in lines:
        for part in re.sub(r"\s+", "", line).lower().split(","):
            if not part:
                continue
            key, sep, value = part.partition("=")
            if not sep:
                key, value = part, "(no value)"
            if key in out and out[key] != value:
                out[key] = out[key] + "|" + value
            else:
                out[key] = value
    return out


class Robots:
    """A parsed robots file."""

    def __init__(self, text):
        self.text = text
        self.groups = []
        current = None
        in_agents = False
        for raw in text.splitlines():
            line = raw.split("#", 1)[0]
            m = _LINE.match(line)
            if not m:
                continue  # a blank line, a comment or junk: never ends a group
            key, value = m.group(1).lower(), m.group(2)
            if key in ("user-agent", "useragent"):
                if current is None or not in_agents:
                    current = Group()
                    self.groups.append(current)
                    in_agents = True
                current.agents.append(value)
                continue
            if current is None:
                continue  # before the first group
            if key in ("allow", "disallow"):
                in_agents = False
                if value:
                    current.rules.append(Rule(key == "allow", value))
            elif key == "crawl-delay":
                in_agents = False
                try:
                    current.delays.append(float(value))
                except ValueError:
                    current.delays.append(float("inf"))  # unreadable: the safe side is "too slow to run"
            elif key == "content-signal":
                in_agents = False
                current.signal_lines.append(value)
            # other lines (Sitemap, unknown keys) are not group members and change nothing

    @staticmethod
    def _token(value):
        v = value.strip()
        if v == "*":
            return "*"
        m = _TOKEN.match(v)
        return m.group(0).lower() if m else ""

    def named(self, agent=AGENT):
        """Every group that names the agent, merged (None when none does)."""
        merged = None
        for g in self.groups:
            if any(self._token(a) == agent.lower() for a in g.agents):
                merged = g if merged is None else merged.merged_with(g)
        return merged

    def generic(self):
        """Every "*" group, merged (None when there is none)."""
        merged = None
        for g in self.groups:
            if any(self._token(a) == "*" for a in g.agents):
                merged = g if merged is None else merged.merged_with(g)
        return merged

    def group_for(self, agent=AGENT):
        """The group that applies to the agent: its own (merged), else "*" (merged), else an empty one."""
        return self.named(agent) or self.generic() or Group()

    def which(self, agent=AGENT):
        return agent if self.named(agent) else ("*" if self.generic() else "none")

    def decide(self, path, query="", agent=AGENT, group=None):
        """(allowed, the rule that decided or None) for an address's path and query."""
        if remove_dot_segments(normalize(path or "/")) == "/robots.txt":
            return True, None
        g = group if group is not None else self.group_for(agent)
        decider = None
        for address in address_forms(path, query):
            best = None
            for rule in g.rules:
                if rule.matches(address):
                    if best is None or len(rule.pattern) > len(best.pattern) or (len(rule.pattern) == len(best.pattern) and rule.allow and not best.allow):
                        best = rule
            if best is not None and not best.allow:
                return False, best
            if best is not None and decider is None:
                decider = best
        return True, decider

    def allowed(self, path, query="", agent=AGENT):
        return self.decide(path, query, agent)[0]

    def crawl_delay(self, agent=AGENT):
        """The largest Crawl-delay of the group that applies (None when it gives none)."""
        delays = self.group_for(agent).delays
        return max(delays) if delays else None

    def signals(self, agent=AGENT):
        return parse_signals(self.group_for(agent).signal_lines)


def looks_like_a_page(text):
    head = text.lstrip()[:512].lower()
    return head.startswith("<") or "<html" in head or "<!doctype" in head


class Outcome:
    """How a robots fetch was judged: `kind` is "rules" (read), "none" (the host has no rules) or "unreachable"."""

    def __init__(self, kind, status=None, robots=None, reason="", text=""):
        self.kind = kind
        self.status = status
        self.robots = robots
        self.reason = reason
        self.sha256 = hashlib.sha256(text.encode("utf-8")).hexdigest() if kind == "rules" else ""
        self.bytes = len(text.encode("utf-8")) if kind == "rules" else 0

    def allowed(self, path, query=""):
        return True if self.kind == "none" else self.robots.allowed(path, query)


def judge(status=None, text=None, problem=None):
    """A robots fetch judged on the safe side: (status, text) of an answer, or `problem` when there was none."""
    if problem:
        return Outcome("unreachable", status, reason=problem)
    if status == 200:
        text = text or ""
        if len(text.encode("utf-8")) > MAX_BYTES:
            return Outcome("unreachable", status, reason="the robots file is larger than 500 KiB")
        if looks_like_a_page(text):
            return Outcome("unreachable", status, reason="the robots address answered with a web page, not a robots file (a challenge page, perhaps)")
        return Outcome("rules", status, Robots(text), text=text)
    if status in (403, 429):
        return Outcome("unreachable", status, reason="the robots file answered " + str(status))
    if status is not None and 400 <= status < 500:
        return Outcome("none", status, reason="the robots file answered " + str(status) + ", so the host sets no rules")
    return Outcome("unreachable", status, reason="the robots file answered " + (str(status) if status is not None else "nothing"))


def signal_words(signals):
    return ", ".join(k + "=" + signals[k] for k in sorted(signals)) or "none"


def tripwire(site, outcome):
    """None when the robots file is still what a person accepted for `site` (or the site has no accepted table), else
    one sentence saying what is different."""
    accepted = ACCEPTED.get(site)
    if accepted is None:
        return None
    if outcome.kind != "rules":
        return site + "'s robots file could not be read (" + (outcome.reason or "no answer") + "), so the rules accepted on " + accepted["accepted"] + " cannot be checked."
    robots = outcome.robots
    generic = robots.generic()
    if generic is None:
        return site + "'s robots file no longer has a group for every reader (User-agent: *), so its content signals cannot be checked."
    seen = parse_signals(generic.signal_lines)
    want = accepted["signals"]
    if seen != want:
        changed = [k for k in sorted(set(seen) | set(want)) if seen.get(k) != want.get(k)]
        return (
            site + "'s content signals are " + signal_words(seen) + ", not the " + signal_words(want) + " accepted on " + accepted["accepted"]
            + " (different: " + ", ".join(changed) + ")."
        )
    if robots.named() is not None:
        return site + "'s robots file now has a group naming " + AGENT + "; a person should read it before the next run."
    for path in accepted["paths"]:
        for label, group in (("its rules for " + AGENT, robots.group_for()), ("its rules for every reader", generic)):
            ok, rule = robots.decide(path, group=group)
            if not ok:
                return site + "'s robots file now disallows " + path + " in " + label + " (" + rule.words() + ")."
    return None


def facts(site, url, outcome, day):
    """What a run saw of a robots file, for the raw output file and the job summary."""
    out = {"site": site, "url": url, "status": outcome.status, "kind": outcome.kind, "checked": day}
    if outcome.kind == "rules":
        r = outcome.robots
        group = r.group_for()
        out.update(
            sha256=outcome.sha256,
            bytes=outcome.bytes,
            group=r.which(),
            rules=[rule.words() for rule in group.rules][:40],
            crawlDelay=r.crawl_delay(),
            signals=parse_signals(group.signal_lines),
        )
        generic = r.generic()
        if generic is not None:
            out["genericSignals"] = parse_signals(generic.signal_lines)
    else:
        out["reason"] = outcome.reason
    accepted = ACCEPTED.get(site)
    if accepted:
        out["accepted"] = {"on": accepted["accepted"], "signals": dict(accepted["signals"])}
    return out
