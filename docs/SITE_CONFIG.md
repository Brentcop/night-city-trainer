# Site config

`public/site-config.json` decides what visitors see: the title, the nav, which features are on, a banner, the Home
page, Play defaults, deck hiding and maintenance mode. Only the owner changes it, by committing a new file. There is no
login and no server: visitors cannot change it.

## Changing it

1. Open `#/admin` on the site (it is not in the nav). Press **Load current** to start from the published file.
2. Edit. Problems show under the field and in the list at the top. **Preview this draft in this browser only** shows the
   whole site with the draft in your browser only; the yellow bar's **Exit preview** ends it.
3. Press **Download site-config.json** (or **Copy JSON**).
4. Replace `public/site-config.json` in the repository with it and run `npm run check:data` (CI runs it too and fails
   on any problem).
5. Commit and push to `main`. The Pages workflow deploys it.

You can also edit the file by hand. `#/admin` is not a security boundary: anyone can open it, and all it does is build a
file.

## How the site reads it

- The build puts the file into `index.html` (the Vite plugin in `vite.config.ts`), so the first paint already has the
  right nav, title, banner and default accent. The site then fetches `site-config.json` once, bypassing the cache, and
  uses it if it differs.
- If the file is missing or is not a site config (`kind`, `schema`), the built-in defaults are used. A field that is
  wrong falls back to its own default; the rest of the file still applies. Unknown keys are ignored.
- Every text is plain text (never HTML) and has a length cap. Links must be a page of this site (`#/…`) or an `https://`
  address. Dates are `YYYY-MM-DD` (a start date counts from the start of that day, an end date to the end of that day,
  in the visitor's time) or an ISO date-time such as `2026-12-11T09:00:00-06:00`.
- The committed file equals the defaults (the site as it was before the config existed, plus online play, chat and multi-day games, which are on).

## Keys

| Key | Default | What it does |
| --- | --- | --- |
| `kind` | `"nct-site-config"` | Marks the file. Required. |
| `schema` | `1` | The file's version. Required; this site reads 1. |
| `site.title` | `"Night City Trainer"` | Header (in capitals) and browser tab. Max 60. |
| `site.tagline` | the site description | The page description. Max 200. |
| `site.footer` | the fan-made notice with a Credits link | Footer text. Max 400. Links as `[label](#/page)` or `[label](https://…)`. |
| `nav.sections` | Home, Decks, Play, Tournaments, Learn, Profile | The top tabs in order. Each is `{ id, label, hidden, pages }`. Ids: `home`, `decks`, `play`, `tournaments`, `learn`, `profile`. Labels max 30. Tabs missing from the list come back at the end. |
| `nav.sections[].pages` | each tab's pages | The tab's pages in order (the sub-menu for Decks, Tournaments and Learn): `{ path, label, hidden }`. Decks: `decks`, `tuned`, `lab`. Tournaments: `tournaments`, `run`, `ratings`, `seasons`, `meta`, `arena`. Learn: `guides`, `cards`, `glossary`, `insights`, `credits`. Home, Play and Profile have one page each. A tab's first shown page is where its tab link goes. |
| (rule) | | A hidden tab or page shows "This page is turned off" at its address. A deck's profile (`#/deck`) follows the Decks tab, a shared profile (`#/u`) the Profile tab. Home and Play cannot both be hidden. With Home hidden, `#/` opens the first tab shown. |
| `features.coach` | `true` | The coach in Play (switch, advice, move grades). |
| `features.gameReview` | `true` | Game review buttons in Play and Profile. |
| `features.savedGames` | `true` | Resume game, named saves and save files in Play. |
| `features.profile` | `true` | The Profile tab and its pages. |
| `features.profileSharing` | `true` | The Sharing & privacy tab and shared profiles (`#/u`). |
| `features.deckLab` | `true` | The Deck Lab (`#/lab`) and links to it. |
| `features.tournamentRunner` | `true` | Running a tournament in the browser (`#/run`) and links to it. |
| `features.tunedDecks` | `true` | The Tuned decks page (`#/tuned`) and links to it. |
| `features.cardArtToggle` | `true` | The Art / Text button in the header (a visitor's saved choice stays). |
| `features.multiplayer` | `true` | Play online against another person (Play → Host a game / Join a game, `#/play/online`, invite links `#/play/join/<code>`). Off: the choice is hidden and those addresses show the ordinary Play page. |
| `features.multiDayGames` | `true` | Multi-day games: a "Multi-day game" choice on the Play setup (a bot game kept until finished, with a deadline), games against a person by turn packets (`#/play/corr`, packet links `#/play/turn/<code>`), the Ongoing games panel and the count on the Play tab. Off: all of it is hidden and those addresses show the ordinary Play page; games already kept stay in the browser. |
| `features.chat` | `true` | The text chat between the two players of an online game (a Chat tab in the side panel). |
| `banner.text` | `""` | The announcement under the header. Empty: no banner. Max 300. |
| `banner.link` | `""` | Optional link after the text (`#/…` or `https://…`). |
| `banner.linkText` | `""` | The link's text; empty reads "Read more". Max 60. |
| `banner.level` | `"info"` | `info` or `warning` (red edge). |
| `banner.start` | `""` | Show from this date; empty: no start. |
| `banner.end` | `""` | Show until this date; empty: no end. |
| `banner.dismissible` | `true` | Visitors can close it. A closed banner stays closed in that browser until its text changes. |
| `home.sections` | `nextEvent`, `featuredDeck`, `quickActions`, `featuredEvent`, `topDecks`, all shown | Home's sections in order, each `{ id, hidden }`. |
| `home.featuredDeck` | `""` | A library deck file (e.g. `meta-rrg-dexter-midrange.txt`) to feature; empty: the generated recommendation. |
| `home.featuredEvent` | `""` | A recorded event id to feature on Home; empty: none. |
| `home.nextEvent.name` | `"Edgerunner Open Regional — Chicago"` | The next event bar. Max 100. |
| `home.nextEvent.start` | `"2026-12-11T09:00:00-06:00"` | When the countdown ends. The Strategy page's plan keeps its own date (`src/content/event.ts`). |
| `home.nextEvent.detail` | `"Dec 11–13 · Bo3 Swiss"` | The text after the name. Max 80. |
| `play.tiers` | `["easy", "medium", "hard"]` | Bot tiers offered in Play setup. At least one. |
| `play.defaultTier` | `"hard"` | The tier picked at first. Must be offered. |
| `play.board.accent` | `"yellow"` | Accent colours for visitors with no saved board settings: `yellow`, `cyan`, `magenta`, `green`, `amber`, `cb`. |
| `play.board.boardBg` | `"grid"` | Board background: `grid`, `plain`, `circuit`, `dots`, `scanlines`, `neon`. |
| `play.board.gigBg` | `"panel"` | Gig area background: `panel`, `plain`, `stripes`, `dots`, `grid`, `glow`. |
| `play.board.payMode` | `"auto"` | Paying costs: `auto`, `before`, `after`. |
| `play.board.endTurn` | `"click"` | End of turn: `click` (the player clicks End turn every turn) or `auto` (the turn ends by itself when nothing is left to do). Also used for a visitor whose saved settings predate this choice. A game keeps the mode it started with. |
| `play.board.panelPosition` | `"right"` | Side panel: `right`, `left`, `bottom`, `hidden`. |
| (rule) | | A visitor's own saved board settings always win over `play.board`. |
| `decks.hidden` | `[]` | Built-in deck files hidden for everyone by default. A visitor can still show them ("Show hidden") and unhide one for themselves; that choice is kept in their browser. Hidden decks stay reachable by link and in events. |
| `decks.sources` | all eight | The deck sources the gallery shows: `meta`, `guide`, `nc`, `ladder`, `bred`, `mine`, `tuned`, `lab`. At least one. |
| `decks.defaultSort` | `"rating"` | The gallery's sort on a first visit: `rating`, `name`, `newest`, `games`, `choom`, `meta`, `cost`. |
| `maintenance.on` | `false` | Every page shows only the maintenance notice (`#/admin` stays open). |
| `maintenance.message` | "The site is down for maintenance. Please check back soon." | The notice. Line breaks are kept. Max 1000. |
| `maintenance.allowPlay` | `true` | Play against the bot stays open during maintenance. |
| `multiplayer.iceServers` | `["stun:stun.l.google.com:19302"]` | STUN servers for online games' direct connections: they tell each browser its public internet address when a player makes a code, so players on different networks can connect. Each is `stun:` or `stuns:` with a host name and an optional port (TURN relays go in `multiplayer.turnServers`); at most 5. A private connection asks no STUN server. A direct connection shares each player's internet address with the other player and with these servers, and the invite and reply codes carry it too (only a locked code hides it from people who see the code without the phrase); the lobby says all of this before a code is made and, under each code, what that code shows. An empty list `[]` means same-network play only (the codes then carry the local network address, and no STUN server is asked). There is no signalling server: the players pass the codes themselves. Multi-day games against a person share no network address at all. |
| `multiplayer.turnTimer` | `0` | The turn timer a host's lobby starts on, in seconds per decision: `0` (off), `30`, `60`, `90`, `120` or `300`. The host can change it per game. |
| `multiplayer.lockCodes` | `true` | Invite and reply codes start locked with a phrase: online play (the live link) and multi-day games against a person. The host gets four generated words (editable; a phrase needs at least four words and 16 characters, three of them different) to send by another route; the guest types it once and its reply is locked with the same key. Without the phrase a locked code shows nothing (PBKDF2-SHA-256, 600,000 rounds, then AES-256-GCM). The other player still learns your address on a direct connection. `false`: codes start unlocked; either way the host can switch per game. |
| `multiplayer.turnServers` | `[]` | TURN relays for **Private connection** in the Play online lobby: both players' browsers are told to use only the relay (`iceTransportPolicy: 'relay'`), both codes carry only the relay's address and are marked private (an older copy of the site refuses them rather than connecting directly), and the host refuses a reply that names any other address. The other player then sees only the relay's address; **the relay's operator sees both players' addresses** (not the game: the link is encrypted). Each entry is `{ "urls": ["turns:turn.example.com:5349"], "username": "…", "credential": "…" }`: `turn:` or `turns:` addresses only (a host name or IPv4, optional port, optional `?transport=udp` or `tcp`; at most 4 per relay, 200 characters each), username at most 256 and credential at most 512 characters; at most 3 relays. **Credentials written here are public**: `site-config.json` is a public file, so anyone can read them and use the relay, at your cost. Use `turnCredentialsUrl` for short-lived credentials when you can (the list is then only a fallback, and can be left without credentials). Empty (and no `turnCredentialsUrl`): the lobby shows Private connection as unavailable, says why and points to multi-day games, and never connects directly in its place. When a relay is set, Private connection is the host's first choice and Direct is an explicit choice that says what it shares; a guest on such a site must tick "Connect directly" to answer a direct invite. |
| `multiplayer.turnCredentialsUrl` | `""` | An endpoint you run (`https://`; `http://` only on `localhost`) that hands out short-lived TURN credentials. It is asked only when a player makes a private code: `GET`, no cookies, no referrer, no redirects, 5 s at most; the answer must be JSON of at most 20,000 characters: `{ "iceServers": [ { "urls": ["turns:turn.example.com:5349"], "username": "1767225600:nct", "credential": "…" } ], "ttl": 3600 }` (`iceServers` may be one object; `stun:` addresses in it are skipped; every server needs a username and credential; `ttl` in seconds is optional). With a TURN server that supports the "TURN REST API" scheme, the username is `<expiry unix time>:<anything>` and the credential base64(HMAC-SHA-1(shared secret, username)); the shared secret stays on the endpoint. A wrong or failed answer falls back to `turnServers` (the player is told) or, without them, makes no code at all. This needs a server (a small serverless function is enough). |
| `multiplayer.relayUrl` | `""` | A relay server that follows docs/RELAY_PROTOCOL.md (`wss://`; `ws://` only on `localhost`). Set: **Through the relay server** appears first in the lobby and is the host's first choice; the invite is a room on the relay plus its key (no address, nothing to send back), the game is encrypted end to end, neither player sees the other's address, and the relay's operator sees both addresses and the size and timing of frames, not the game. Empty: nothing about it is shown. |
| `multiDay.minDays` | `3` | The shortest multi-day game offered, in whole days (1–60). |
| `multiDay.maxDays` | `20` | The longest, in whole days (1–60). Shorter than `minDays`: both fall back to the defaults. |
| `multiDay.defaultDays` | `7` | The length picked at first. Outside `minDays`–`maxDays`: the nearest allowed value. |
| `multiDay.maxOngoing` | `8` | How many ongoing multi-day games (bot and person together) one browser keeps (1–20). A new one is refused at the cap. |

`npm run check:data` also fails when `home.featuredDeck` or a `decks.hidden` entry is not a library deck, or
`home.featuredEvent` is not a recorded event.
