import meta from '../../data/meta.json';
import { REVIEW } from '../../data/index';
import { Markdown } from '../components/Markdown';
import { CHOOM_TABLE } from '../../content/choomTable';
import { allDecks } from '../../lib/browserLibrary';
import { DeckTile, LegendStrip } from '../components/DeckIdentity';
import { PageHead } from '../components/PageHead';

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

function heat(v: number | undefined) {
  if (v === undefined) return undefined;
  const a = Math.abs(v - 0.5) * 2;
  return v >= 0.5 ? `color-mix(in srgb, var(--green) ${Math.round(a * 70)}%, transparent)` : `color-mix(in srgb, var(--red) ${Math.round(a * 70)}%, transparent)`;
}

export function MetaPage() {
  const M = meta as MetaEntry[];
  const R = REVIEW;
  const sorted = [...M].sort((a, b) => b.power - a.power);
  const short = (s: string) => (s.length > 16 ? s.slice(0, 15) + '…' : s);
  return (
    <div className="grid">
      <PageHead kicker="Tournaments" title="Night City meta">
        Two views of the format: choom.gg's hand-rated archetype tiers (expert opinion, Oct–Nov 2026), and this trainer's own bot-vs-bot
        round robin (measured, but only as good as the bots). Use the disagreements to decide what to test by hand.
      </PageHead>

      <div className="panel flair">
        <h2 style={{ marginTop: 0 }}>Archetype tiers (choom.gg editorial)</h2>
        {(['S', 'A', 'B', 'C'] as const).map((tier) => {
          const rows = sorted.filter((m) => m.tier === tier);
          if (!rows.length) return null;
          return (
            <div key={tier} className="tier-row">
              <div className={`tier-label tier tier-${tier}`}>{tier}</div>
              <div className="deck-grid" style={{ flex: 1 }}>
                {rows.map((m) => {
                  const d = allDecks().find((x) => x.file === m.deckFile);
                  return (
                    <div key={m.slug} className="tier-card">
                      {d && <DeckTile d={d} href={`#/deck?d=${encodeURIComponent(d.file)}`} />}
                      <div className="small" style={{ padding: '6px 2px' }}>
                        <span className="stat" style={{ fontSize: '1.1rem' }}>{m.power}</span>
                        <span className="muted"> /100 · {m.complexity}</span>
                        <div>{m.tagline}</div>
                        <div className="row" style={{ marginTop: 4 }}>
                          <a href={`#/guides?g=${m.slug}`}>Strategy</a>
                          <a href={m.source.split(' ')[0]} target="_blank" rel="noreferrer">
                            choom.gg analysis ↗
                          </a>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          );
        })}
      </div>

      <div className="panel scroll-x">
        <h2>Bot round robin</h2>
        <p className="small muted">
          {R.decks.length} decks, {R.games} games per pairing (alternating who goes first), run {R.date.slice(0, 10)}. Going first won{' '}
          <span title="For the site owner: npm run sim -- review --field all">{Math.round(R.firstPlayerWinRate * 100)}% of these games.</span>
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
                  <div className="row" style={{ flexWrap: 'nowrap' }}>
                    <div style={{ width: 96, flex: 'none' }}>
                      <LegendStrip legends={allDecks().find((x) => x.file === d.file)?.deck.legends ?? []} height={30} />
                    </div>
                    <a href={`#/deck?d=${encodeURIComponent(d.file)}`}>{d.name}</a>
                  </div>
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
