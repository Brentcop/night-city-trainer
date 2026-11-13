import { Component, lazy, Suspense, useEffect, useRef, useState } from 'react';

/** A lazily loaded page's code could not be fetched (offline, or an old tab after a deploy replaced the chunk files). */
function isChunkLoadError(err: Error): boolean {
  // Chrome: "Failed to fetch dynamically imported module"; Firefox: "error loading dynamically imported module";
  // Safari: "Importing a module script failed"; Vite's CSS preload: "Unable to preload CSS".
  return /dynamically imported module|Importing a module script failed|Unable to preload CSS/i.test(String(err?.message ?? err));
}

class Boundary extends Component<{ children: React.ReactNode }, { err: Error | null }> {
  state = { err: null as Error | null };
  static getDerivedStateFromError(err: Error) {
    return { err };
  }
  render() {
    if (this.state.err && isChunkLoadError(this.state.err))
      return (
        <div className="panel">
          <h2>This page could not be loaded</h2>
          <p className="muted">
            Its code did not download. You may be offline, or the site was updated since this tab was opened. Reloading usually fixes it.
          </p>
          <button onClick={() => window.location.reload()}>Reload</button>
        </div>
      );
    if (this.state.err)
      return (
        <div className="panel">
          <h2>Something broke on this page</h2>
          <pre>{String(this.state.err.message)}</pre>
          <button onClick={() => this.setState({ err: null })}>Retry</button>
        </div>
      );
    return this.props.children;
  }
}
import { Home } from './ui/pages/Home';
import { artEnabled, setArtEnabled } from './ui/art';

// Every page but Home loads on first visit (its own chunk); a failed load shows the Boundary's Reload message.
const MetaPage = lazy(() => import('./ui/pages/Meta').then((m) => ({ default: m.MetaPage })));
const DecksPage = lazy(() => import('./ui/pages/Decks').then((m) => ({ default: m.DecksPage })));
const PlayPage = lazy(() => import('./ui/pages/Play').then((m) => ({ default: m.PlayPage })));
const ArenaPage = lazy(() => import('./ui/pages/Arena').then((m) => ({ default: m.ArenaPage })));
const GuidesPage = lazy(() => import('./ui/pages/Guides').then((m) => ({ default: m.GuidesPage })));
const GlossaryPage = lazy(() => import('./ui/pages/Glossary').then((m) => ({ default: m.GlossaryPage })));
const CardsPage = lazy(() => import('./ui/pages/Cards').then((m) => ({ default: m.CardsPage })));
const InsightsPage = lazy(() => import('./ui/pages/Insights').then((m) => ({ default: m.InsightsPage })));
const SeasonsPage = lazy(() => import('./ui/pages/Seasons').then((m) => ({ default: m.SeasonsPage })));
const CreditsPage = lazy(() => import('./ui/pages/Credits').then((m) => ({ default: m.CreditsPage })));
const DeckProfilePage = lazy(() => import('./ui/pages/DeckProfile').then((m) => ({ default: m.DeckProfilePage })));
const TournamentsPage = lazy(() => import('./ui/pages/Tournaments').then((m) => ({ default: m.TournamentsPage })));
const RatingsPage = lazy(() => import('./ui/pages/Ratings').then((m) => ({ default: m.RatingsPage })));
const TournamentRunnerPage = lazy(() => import('./ui/pages/TournamentRunner').then((m) => ({ default: m.TournamentRunnerPage })));
const TunedDecksPage = lazy(() => import('./ui/pages/TunedDecks').then((m) => ({ default: m.TunedDecksPage })));
const DeckLabPage = lazy(() => import('./ui/pages/DeckLab').then((m) => ({ default: m.DeckLabPage })));
const ProfilePage = lazy(() => import('./ui/pages/Profile').then((m) => ({ default: m.ProfilePage })));
const ProfileViewPage = lazy(() => import('./ui/pages/Profile').then((m) => ({ default: m.ProfileViewPage })));

/** `sub` is the rest of the path after the route's own (`#/profile/history` → 'history'); most pages ignore it. */
const ROUTES: { path: string; label: string; el: (q: URLSearchParams, sub: string) => React.ReactNode }[] = [
  { path: 'home', label: 'Home', el: () => <Home /> },
  { path: 'decks', label: 'All decks', el: (q) => <DecksPage initial={q.get('d') ?? undefined} query={q.toString()} /> },
  { path: 'tuned', label: 'Tuned decks', el: () => <TunedDecksPage /> },
  { path: 'lab', label: 'Deck Lab', el: (q) => <DeckLabPage q={q} /> },
  { path: 'deck', label: 'Deck', el: (q) => <DeckProfilePage file={q.get('d') ?? undefined} /> },
  { path: 'play', label: 'Play vs Bot', el: (q) => <PlayPage initialDeck={q.get('d') ?? undefined} initialOpp={q.get('o') ?? undefined} /> },
  { path: 'tournaments', label: 'Events', el: (q) => <TournamentsPage initial={q.get('e') ?? undefined} /> },
  { path: 'run', label: 'Run a tournament', el: (q) => <TournamentRunnerPage q={q} /> },
  { path: 'ratings', label: 'Power ratings', el: () => <RatingsPage /> },
  { path: 'seasons', label: 'Breeding seasons', el: () => <SeasonsPage /> },
  { path: 'meta', label: 'choom.gg meta', el: () => <MetaPage /> },
  { path: 'arena', label: 'Matchup Lab', el: (q) => <ArenaPage q={q} /> },
  { path: 'guides', label: 'Strategy', el: (q) => <GuidesPage initial={q.get('g') ?? undefined} /> },
  { path: 'cards', label: 'Cards', el: () => <CardsPage /> },
  { path: 'glossary', label: 'Glossary', el: () => <GlossaryPage /> },
  { path: 'insights', label: 'Card stats', el: (q) => <InsightsPage initial={q.get('d') ?? undefined} /> },
  { path: 'credits', label: 'Credits', el: () => <CreditsPage /> },
  { path: 'profile', label: 'Profile', el: (_q, sub) => <ProfilePage sub={sub} /> },
  { path: 'u', label: 'Shared profile', el: (_q, sub) => <ProfileViewPage payload={sub} /> },
];

/** Routes whose pages take a sub-path (`#/profile/history`, `#/u/<payload>`); every other route matches its path exactly. */
const NESTED = new Set(['profile', 'u']);

/** Top-level sections; each lists its pages (first = landing page). Pages not listed in `sub` don't show in the sub-menu. */
const SECTIONS: { label: string; icon: string; pages: string[]; sub?: string[] }[] = [
  { label: 'Home', icon: '⌂', pages: ['home'] },
  { label: 'Decks', icon: '▤', pages: ['decks', 'deck', 'lab', 'tuned'], sub: ['decks', 'tuned', 'lab'] },
  { label: 'Play', icon: '▶', pages: ['play'] },
  { label: 'Tournaments', icon: '🏆', pages: ['tournaments', 'run', 'ratings', 'seasons', 'meta', 'arena'], sub: ['tournaments', 'run', 'ratings', 'seasons', 'meta', 'arena'] },
  { label: 'Learn', icon: '♟', pages: ['guides', 'cards', 'glossary', 'insights', 'credits'], sub: ['guides', 'cards', 'glossary', 'insights', 'credits'] },
  { label: 'Profile', icon: '◉', pages: ['profile', 'u'] },
];

function parseHash(): [string, URLSearchParams] {
  const h = window.location.hash.replace(/^#\/?/, '');
  const [path, qs] = h.split('?');
  return [path || 'home', new URLSearchParams(qs ?? '')];
}

function NotFound({ path }: { path: string }) {
  return (
    <div className="panel">
      <h2>Page not found</h2>
      <p className="muted">There is no page at <code>#/{path}</code>. The link may be old or mistyped.</p>
      <a href="#/home">Go to the home page →</a>
    </div>
  );
}

export function App() {
  const [[path, q], setRoute] = useState(parseHash());
  // Scroll: a link click opens the new page at the top; Back/Forward restore where you were on that page.
  const viaLink = useRef(false);
  useEffect(() => {
    const on = () => setRoute(parseHash());
    const onClick = (e: MouseEvent) => {
      if (e.defaultPrevented || e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
      const a = (e.target as Element | null)?.closest?.('a[href^="#"]') as HTMLAnchorElement | null;
      if (!a || a.target === '_blank') return;
      try {
        const st = history.state && typeof history.state === 'object' ? history.state : {};
        history.replaceState({ ...st, scrollY: window.scrollY }, '');
      } catch {
        /* history unavailable */
      }
      viaLink.current = true;
    };
    window.addEventListener('hashchange', on);
    document.addEventListener('click', onClick);
    return () => {
      window.removeEventListener('hashchange', on);
      document.removeEventListener('click', onClick);
    };
  }, []);
  const slash = path.indexOf('/');
  const base = slash > 0 && NESTED.has(path.slice(0, slash)) ? path.slice(0, slash) : path;
  const sub = base === path ? '' : path.slice(slash + 1);
  const route = ROUTES.find((r) => r.path === base);
  const section = route && SECTIONS.find((sec) => sec.pages.includes(route.path));
  const qs = q.toString(); // the effect re-runs when the query changes, compared as a string
  useEffect(() => {
    if (viaLink.current) window.scrollTo(0, 0);
    else {
      const y = (history.state as { scrollY?: unknown } | null)?.scrollY;
      if (typeof y === 'number') requestAnimationFrame(() => window.scrollTo(0, y));
    }
    viaLink.current = false;
  }, [path, qs]);
  return (
    <div className="app">
      <header className="topbar">
        <div className="brand">
          <a href="#/home" style={{ color: 'inherit', textDecoration: 'none' }}>
            <span className="chip">NC</span> NIGHT CITY TRAINER
          </a>
        </div>
        <nav className="nav" aria-label="Main">
          {SECTIONS.map((sec) => (
            <a
              key={sec.label}
              href={`#/${sec.pages[0]}`}
              className={section === sec ? 'active' : ''}
              // the section you are in; "page" when its link is exactly this page
              aria-current={section === sec ? (route?.path === sec.pages[0] ? 'page' : 'true') : undefined}
            >
              <span className="nav-icon" aria-hidden>
                {sec.icon}
              </span>
              {sec.label}
            </a>
          ))}
        </nav>
        <HeaderToggles />
      </header>
      {section?.sub && (
        <nav className="subnav" aria-label={section.label}>
          {section.sub.map((p) => (
            <a key={p} href={`#/${p}`} className={p === route?.path ? 'active' : ''} aria-current={p === route?.path ? 'page' : undefined}>
              {ROUTES.find((r) => r.path === p)?.label}
            </a>
          ))}
        </nav>
      )}
      {/* a sub-path change (#/profile → #/profile/history) keeps the page mounted, so its tabs keep focus */}
      <main className="main" key={base + q.toString()}>
        <Boundary>
          <Suspense fallback={<p className="muted" aria-live="polite">Loading…</p>}>{route ? route.el(q, sub) : <NotFound path={path} />}</Suspense>
        </Boundary>
      </main>
      <footer className="footer">
        Unofficial fan-made practice tool — not affiliated with CD PROJEKT RED, WeirdCo, choom.gg or cyberpunk-tcg-sim.online. Every deck is
        tagged with its origin and author — see <a href="#/credits">Credits</a>.
      </footer>
    </div>
  );
}

function HeaderToggles() {
  const [art, setArt] = useState(artEnabled());
  const [theme, setTheme] = useState<string>(() => {
    try {
      return localStorage.getItem('nct.theme') ?? '';
    } catch {
      return '';
    }
  });
  // index.html sets data-theme before first paint (and follows the system while nothing is saved); this applies a new choice.
  useEffect(() => {
    const system = window.matchMedia?.('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
    document.documentElement.setAttribute('data-theme', theme === 'light' || theme === 'dark' ? theme : system);
    try {
      localStorage.setItem('nct.theme', theme);
    } catch {
      /* ignore */
    }
  }, [theme]);
  const dark = theme ? theme === 'dark' : window.matchMedia?.('(prefers-color-scheme: dark)').matches;
  return (
    <div className="header-toggles">
      <button
        className="ghost"
        title={art ? 'Card art on (click for text frames)' : 'Card art off'}
        onClick={() => {
          setArtEnabled(!art);
          setArt(!art);
        }}
      >
        {art ? '🖼 Art' : '▭ Text'}
      </button>
      <button className="ghost" title="Toggle light/dark" aria-label={dark ? 'Switch to the light theme' : 'Switch to the dark theme'} onClick={() => setTheme(dark ? 'light' : 'dark')}>
        {dark ? '☾' : '☀'}
      </button>
    </div>
  );
}
