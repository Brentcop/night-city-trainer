import { Component, useEffect, useState } from 'react';

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

const ROUTES: { path: string; label: string; icon?: string; el: (q: URLSearchParams) => React.ReactNode; hidden?: boolean }[] = [
  { path: 'home', icon: '⌂', label: 'Home', el: () => <Home /> },
  { path: 'meta', icon: '◆', label: 'Meta', el: () => <MetaPage /> },
  { path: 'guides', icon: '♟', label: 'Strategy', el: (q) => <GuidesPage initial={q.get('g') ?? undefined} /> },
  { path: 'decks', icon: '▤', label: 'Decks', el: (q) => <DecksPage initial={q.get('d') ?? undefined} /> },
  { path: 'play', icon: '▶', label: 'Play vs Bot', el: (q) => <PlayPage initialDeck={q.get('d') ?? undefined} initialOpp={q.get('o') ?? undefined} /> },
  { path: 'arena', icon: '⚔', label: 'Matchup Lab', el: () => <ArenaPage /> },
  { path: 'insights', icon: '◔', label: 'Insights', el: (q) => <InsightsPage initial={q.get('d') ?? undefined} /> },
  { path: 'seasons', icon: '🧬', label: 'Seasons', el: () => <SeasonsPage /> },
  { path: 'cards', icon: '🂠', label: 'Cards', el: () => <CardsPage /> },
  { path: 'glossary', icon: '?', label: 'Glossary', el: () => <GlossaryPage /> },
  { path: 'credits', icon: '©', label: 'Credits', el: () => <CreditsPage /> },
  { path: 'deck', label: 'Deck', el: (q) => <DeckProfilePage file={q.get('d') ?? undefined} />, hidden: true },
];

function parseHash(): [string, URLSearchParams] {
  const h = window.location.hash.replace(/^#\/?/, '');
  const [path, qs] = h.split('?');
  return [path || 'home', new URLSearchParams(qs ?? '')];
}

export function App() {
  const [[path, q], setRoute] = useState(parseHash());
  useEffect(() => {
    const on = () => setRoute(parseHash());
    window.addEventListener('hashchange', on);
    return () => window.removeEventListener('hashchange', on);
  }, []);
  const route = ROUTES.find((r) => r.path === path) ?? ROUTES[0];
  useEffect(() => {
    window.scrollTo(0, 0);
  }, [path, q.toString()]);
  return (
    <div className="app">
      <header className="topbar">
        <div className="brand">
          <span className="chip">NC</span> NIGHT CITY TRAINER
        </div>
        <nav className="nav">
          {ROUTES.filter((r) => !r.hidden).map((r) => (
            <a key={r.path} href={`#/${r.path}`} className={r.path === route.path || (route.path === 'deck' && r.path === 'decks') ? 'active' : ''}>
              <span className="nav-icon" aria-hidden>
                {r.icon}
              </span>
              {r.label}
            </a>
          ))}
        </nav>
        <HeaderToggles />
      </header>
      <main className="main" key={route.path + q.toString()}>
        <Boundary>{route.el(q)}</Boundary>
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
