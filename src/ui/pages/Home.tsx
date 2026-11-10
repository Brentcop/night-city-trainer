import { useEffect, useState } from 'react';
import review from '../../data/review.json';
import { RECOMMENDATION } from '../../content/recommendation';
import { Markdown } from '../components/Markdown';

const EVENT = { name: 'Edgerunner Open Regional — Chicago', start: new Date('2026-12-11T09:00:00-06:00'), url: 'https://cyberpunktcg.com/eor' };

function Countdown() {
  const [now, setNow] = useState(Date.now());
  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 60_000);
    return () => clearInterval(t);
  }, []);
  const ms = EVENT.start.getTime() - now;
  if (ms <= 0) return <span className="countdown">Event underway</span>;
  const d = Math.floor(ms / 86_400_000);
  const h = Math.floor((ms % 86_400_000) / 3_600_000);
  return (
    <span className="countdown">
      {d}d {h}h
    </span>
  );
}

export function Home() {
  const top = (review as any).decks.slice(0, 5) as { name: string; file: string; winRate: number }[];
  return (
    <div className="grid">
      <div className="hero">
        <div className="spread">
          <div>
            <div className="muted small">NEXT MAJOR EVENT</div>
            <h1 style={{ margin: '4px 0' }}>{EVENT.name}</h1>
            <div className="muted">
              Dec 11–13, 2026 · Bo3 Swiss with a 7-card sideboard ·{' '}
              <a href={EVENT.url} target="_blank" rel="noreferrer">
                event info
              </a>
            </div>
          </div>
          <Countdown />
        </div>
      </div>

      <div className="grid cols-2">
        <div className="panel">
          <Markdown text={RECOMMENDATION} />
          <div className="row">
            <a href="#/guides">
              <button className="primary">Read the strategy guides</button>
            </a>
            <a href="#/play">
              <button>Practice vs bot</button>
            </a>
          </div>
        </div>
        <div className="panel">
          <h2 style={{ marginTop: 0 }}>Bot round-robin leaders</h2>
          {top.map((d, i) => (
            <div key={d.name} style={{ margin: '6px 0' }}>
              <div className="spread">
                <span>
                  {i + 1}. <a href={`#/decks?d=${d.file}`}>{d.name}</a>
                </span>
                <b>{(d.winRate * 100).toFixed(1)}%</b>
              </div>
              <div className="bar">
                <div style={{ width: `${d.winRate * 100}%` }} />
              </div>
            </div>
          ))}
          <p className="small muted">
            Full matrix on the <a href="#/meta">Meta</a> page.
          </p>
        </div>
      </div>

      <div className="grid cols-3">
        {[
          ['Decks', '#/decks', 'Browse meta and guide lists, build your own, import from choom.gg or the Sim, export back.'],
          ['Play vs Bot', '#/play', 'Full rules engine with a coach that shows what the lookahead bot would do.'],
          ['Matchup Lab', '#/arena', 'Run hundreds of bot-vs-bot games for any pairing in your browser.'],
          ['Meta', '#/meta', 'choom.gg tier list + this trainer’s measured matchup matrix.'],
          ['Glossary', '#/glossary', 'Every game term with rule references and how the bots reason about it.'],
          ['Cards', '#/cards', 'All 150 Welcome to Night City cards with roles and ratings.'],
        ].map(([t, href, d]) => (
          <a key={t} href={href} className="panel" style={{ textDecoration: 'none', color: 'inherit' }}>
            <h3 style={{ marginTop: 0 }}>{t} →</h3>
            <div className="muted small">{d}</div>
          </a>
        ))}
      </div>
    </div>
  );
}
