import { Component, useEffect, useRef, useState } from 'react';

class Boundary extends Component<{ children: React.ReactNode }, { err: Error | null }> {
  state = { err: null as Error | null };
  static getDerivedStateFromError(err: Error) {
    return { err };
  }
  render() {
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
import { MetaPage } from './ui/pages/Meta';
import { DecksPage } from './ui/pages/Decks';
import { PlayPage } from './ui/pages/Play';
import { ArenaPage } from './ui/pages/Arena';
import { GuidesPage } from './ui/pages/Guides';
import { GlossaryPage } from './ui/pages/Glossary';
import { CardsPage } from './ui/pages/Cards';
import { InsightsPage } from './ui/pages/Insights';
import { SeasonsPage } from './ui/pages/Seasons';
import { CreditsPage } from './ui/pages/Credits';
import { DeckProfilePage } from './ui/pages/DeckProfile';
import { artEnabled, setArtEnabled } from './ui/art';
import { TournamentsPage } from './ui/pages/Tournaments';
import { RatingsPage } from './ui/pages/Ratings';
import { TournamentRunnerPage } from './ui/pages/TournamentRunner';
import { DeckLabPage } from './ui/pages/DeckLab';

const ROUTES: { path: string; label: string; el: (q: URLSearchParams) => React.ReactNode }[] = [
  { path: 'home', label: 'Home', el: () => <Home /> },
  { path: 'decks', label: 'All decks', el: (q) => <DecksPage initial={q.get('d') ?? undefined} /> },
  { path: 'lab', label: 'Deck Lab', el: (q) => <DeckLabPage q={q} /> },
  { path: 'deck', label: 'Deck', el: (q) => <DeckProfilePage file={q.get('d') ?? undefined} /> },
  { path: 'play', label: 'Play vs Bot', el: (q) => <PlayPage initialDeck={q.get('d') ?? undefined} initialOpp={q.get('o') ?? undefined} /> },
  { path: 'tournaments', label: 'Events', el: (q) => <TournamentsPage initial={q.get('e') ?? undefined} /> },
  { path: 'run', label: 'Run a tournament', el: (q) => <TournamentRunnerPage q={q} /> },
  { path: 'ratings', label: 'Power ratings', el: () => <RatingsPage /> },
  { path: 'seasons', label: 'Breeding seasons', el: () => <SeasonsPage /> },
  { path: 'meta', label: 'choom.gg meta', el: () => <MetaPage /> },
  { path: 'arena', label: 'Matchup Lab', el: () => <ArenaPage /> },
  { path: 'guides', label: 'Strategy', el: (q) => <GuidesPage initial={q.get('g') ?? undefined} /> },
  { path: 'cards', label: 'Cards', el: () => <CardsPage /> },
  { path: 'glossary', label: 'Glossary', el: () => <GlossaryPage /> },
  { path: 'insights', label: 'Card stats', el: (q) => <InsightsPage initial={q.get('d') ?? undefined} /> },
  { path: 'credits', label: 'Credits', el: () => <CreditsPage /> },
];

/** Top-level sections; each lists its pages (first = landing page). Pages not listed in `sub` don't show in the sub-menu. */
const SECTIONS: { label: string; icon: string; pages: string[]; sub?: string[] }[] = [
  { label: 'Home', icon: '⌂', pages: ['home'] },
  { label: 'Decks', icon: '▤', pages: ['decks', 'deck', 'lab'], sub: ['decks', 'lab'] },
  { label: 'Play', icon: '▶', pages: ['play'] },
  { label: 'Tournaments', icon: '🏆', pages: ['tournaments', 'run', 'ratings', 'seasons', 'meta', 'arena'], sub: ['tournaments', 'run', 'ratings', 'seasons', 'meta', 'arena'] },
  { label: 'Learn', icon: '♟', pages: ['guides', 'cards', 'glossary', 'insights', 'credits'], sub: ['guides', 'cards', 'glossary', 'insights', 'credits'] },
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
  const route = ROUTES.find((r) => r.path === path);
  const section = route && SECTIONS.find((sec) => sec.pages.includes(route.path));
  useEffect(() => {
    if (viaLink.current) window.scrollTo(0, 0);
    else {
      const y = (history.state as { scrollY?: unknown } | null)?.scrollY;
      if (typeof y === 'number') requestAnimationFrame(() => window.scrollTo(0, y));
    }
    viaLink.current = false;
  }, [path, q.toString()]);
  return (
    <div className="app">
      <header className="topbar">
        <div className="brand">
          <a href="#/home" style={{ color: 'inherit', textDecoration: 'none' }}>
            <span className="chip">NC</span> NIGHT CITY TRAINER
          </a>
        </div>
        <nav className="nav">
          {SECTIONS.map((sec) => (
            <a key={sec.label} href={`#/${sec.pages[0]}`} className={section === sec ? 'active' : ''}>
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
        <nav className="subnav">
          {section.sub.map((p) => (
            <a key={p} href={`#/${p}`} className={p === route?.path ? 'active' : ''}>
              {ROUTES.find((r) => r.path === p)?.label}
            </a>
          ))}
        </nav>
      )}
      <main className="main" key={path + q.toString()}>
        <Boundary>{route ? route.el(q) : <NotFound path={path} />}</Boundary>
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
  useEffect(() => {
    if (theme) document.documentElement.setAttribute('data-theme', theme);
    else document.documentElement.removeAttribute('data-theme');
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
      <button className="ghost" title="Toggle light/dark" onClick={() => setTheme(dark ? 'light' : 'dark')}>
        {dark ? '☾' : '☀'}
      </button>
    </div>
  );
}
