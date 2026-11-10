import meta from '../../data/meta.json';
import review from '../../data/review.json';
import { Markdown } from '../components/Markdown';
import { CHOOM_TABLE } from '../../content/choomTable';
import { allDecks } from '../../lib/browserLibrary';

interface MetaEntry {
  slug: string;
  title: string;
  tier: string;
  power: number;
  complexity: string;
  tagline: string;
  summary: string;
  source: string;
  deckFile: string;
}
interface Review {
  date: string;
  games: number;
  bot: string;
  decks: { name: string; file: string; winRate: number; games: number }[];
  matrix: Record<string, Record<string, number>>;
  firstPlayerWinRate: number;
}

function heat(v: number | undefined) {
  if (v === undefined) return undefined;
  const a = Math.abs(v - 0.5) * 2;
  return v >= 0.5 ? `color-mix(in srgb, var(--green) ${Math.round(a * 70)}%, transparent)` : `color-mix(in srgb, var(--red) ${Math.round(a * 70)}%, transparent)`;
}

export function MetaPage() {
  const M = meta as MetaEntry[];
  const R = review as Review;
  const sorted = [...M].sort((a, b) => b.power - a.power);
  const short = (s: string) => (s.length > 16 ? s.slice(0, 15) + '…' : s);
  return (
    <div className="grid">
      <h1>Night City meta</h1>
      <p className="muted">
        Two views of the format: choom.gg's hand-rated archetype tiers (expert opinion, Oct–Nov 2026), and this trainer's own bot-vs-bot
        round robin (measured, but only as good as the bots). Use the disagreements to decide what to test by hand.
      </p>

      <div className="panel">
        <h2>Archetype tiers (choom.gg editorial)</h2>
        <div className="grid cols-2">
          {sorted.map((m) => (
            <div key={m.slug} className="panel" style={{ boxShadow: 'none' }}>
              <div className="spread">
                <h3 style={{ margin: 0 }}>
                  <span className={`tier tier-${m.tier}`}>{m.tier}</span> {m.title}
                </h3>
                <span className="stat" style={{ fontSize: '1.3rem' }}>
                  {m.power}
                </span>
              </div>
              <div className="small muted">
                Complexity: {m.complexity} · <a href={m.source.split(' ')[0]} target="_blank" rel="noreferrer">source</a> ·{' '}
                <a href={`#/decks?d=${m.deckFile}`}>decklist</a> · <a href={`#/guides?g=${m.slug}`}>strategy</a>
              </div>
              <p style={{ marginBottom: 4 }}>{m.tagline}</p>
              <div className="small muted">List by {allDecks().find((d) => d.file === m.deckFile)?.prov.author ?? 'unknown'} · rating by choom.gg editors</div>
              <a className="small" href={m.source.split(' ')[0]} target="_blank" rel="noreferrer">
                Read choom.gg's full analysis →
              </a>
            </div>
          ))}
        </div>
      </div>

      <div className="panel scroll-x">
        <h2>Bot round robin</h2>
        <p className="small muted">
          {R.decks.length} decks, {R.games} games per pairing (alternating who goes first), run {R.date.slice(0, 10)}. Going first won{' '}
          {Math.round(R.firstPlayerWinRate * 100)}% of these games. Rerun anytime with <code>npm run sim -- review --field all</code>.
        </p>
        <table>
          <thead>
            <tr>
              <th>#</th>
              <th>Deck</th>
              <th>Win rate</th>
            </tr>
          </thead>
          <tbody>
            {R.decks.map((d, i) => (
              <tr key={d.name}>
                <td>{i + 1}</td>
                <td>
                  <a href={`#/decks?d=${d.file}`}>{d.name}</a>
                </td>
                <td style={{ minWidth: 160 }}>
                  <b>{(d.winRate * 100).toFixed(1)}%</b>
                  <div className="bar">
                    <div style={{ width: `${d.winRate * 100}%` }} />
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        <h3>Matchup matrix (row's win % against column)</h3>
        <table className="heat small">
          <thead>
            <tr>
              <th />
              {R.decks.map((d) => (
                <th key={d.name} title={d.name} style={{ writingMode: 'vertical-rl', transform: 'rotate(180deg)', height: 120 }}>
                  {short(d.name)}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {R.decks.map((r) => (
              <tr key={r.name}>
                <th title={r.name} style={{ whiteSpace: 'nowrap' }}>
                  {short(r.name)}
                </th>
                {R.decks.map((c) => {
                  const v = R.matrix[r.name]?.[c.name];
                  return (
                    <td key={c.name} style={{ background: r.name === c.name ? undefined : heat(v) }}>
                      {r.name === c.name ? '—' : v === undefined ? '' : Math.round(v * 100)}
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="panel">
        <h2>choom.gg table data (real players)</h2>
        <Markdown text={CHOOM_TABLE} />
      </div>
    </div>
  );
}
