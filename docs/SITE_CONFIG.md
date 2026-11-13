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
- The committed file equals the defaults (the site as it was before the config existed, plus online play and chat, which are on).

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
| `features.multiDayGames` | `false` | Reserved for a later step; nothing reads it yet. |
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
| `play.board.panelPosition` | `"right"` | Side panel: `right`, `left`, `bottom`, `hidden`. |
| (rule) | | A visitor's own saved board settings always win over `play.board`. |
| `decks.hidden` | `[]` | Built-in deck files hidden for everyone by default. A visitor can still show them ("Show hidden") and unhide one for themselves; that choice is kept in their browser. Hidden decks stay reachable by link and in events. |
| `decks.sources` | all eight | The deck sources the gallery shows: `meta`, `guide`, `nc`, `ladder`, `bred`, `mine`, `tuned`, `lab`. At least one. |
| `decks.defaultSort` | `"rating"` | The gallery's sort on a first visit: `rating`, `name`, `newest`, `games`, `choom`, `meta`, `cost`. |
| `maintenance.on` | `false` | Every page shows only the maintenance notice (`#/admin` stays open). |
| `maintenance.message` | "The site is down for maintenance. Please check back soon." | The notice. Line breaks are kept. Max 1000. |
| `maintenance.allowPlay` | `true` | Play against the bot stays open during maintenance. |
| `multiplayer.iceServers` | `["stun:stun.l.google.com:19302"]` | STUN servers for online games: they tell each browser its public network address so players on different networks can connect. Each is `stun:` or `stuns:` with a host name and an optional port (no TURN: its password would be public); at most 5. Connecting shares each player's network address with the other player and with these servers (the lobby says so). An empty list `[]` means same-network play only. There is no signalling server: the players pass the invite and reply codes themselves. |
| `multiplayer.turnTimer` | `0` | The turn timer a host's lobby starts on, in seconds per decision: `0` (off), `30`, `60`, `90`, `120` or `300`. The host can change it per game. |

`npm run check:data` also fails when `home.featuredDeck` or a `decks.hidden` entry is not a library deck, or
`home.featuredEvent` is not a recorded event.
