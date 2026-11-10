import { useState } from 'react';
import { GUIDES } from '../../content/guides';
import { Markdown } from '../components/Markdown';
import review from '../../data/review.json';
import analysis from '../../data/analysis.json';
import type { DeckReport } from '../../analysis/analyze';
import { DeckInsights } from '../components/DeckInsights';
import { ProvenanceBlock } from '../components/Provenance';
import { LegendStrip } from '../components/DeckIdentity';
import { allDecks } from '../../lib/browserLibrary';

function simTable(name: string): string | null {
  const R = review as { decks: { name: string; winRate: number }[]; matrix: Record<string, Record<string, number>>; games: number; date: string };
  const row = R.matrix[name];
  if (!row) return null;
  const me = R.decks.find((d) => d.name === name);
  const rank = R.decks.findIndex((d) => d.name === name) + 1;
  const lines = Object.entries(row)
    .sort((a, b) => b[1] - a[1])
    .map(([opp, v]) => `| ${opp} | ${Math.round(v * 100)}% | ${v >= 0.6 ? 'favoured' : v >= 0.45 ? 'close' : 'unfavoured'} |`);
  return [
    `## Sim matchups`,
    `Bot round robin (${R.date.slice(0, 10)}, ${R.games} games per pairing): **${((me?.winRate ?? 0) * 100).toFixed(1)}% overall, rank ${rank} of ${R.decks.length}.**`,
    '',
    '| Opponent | Win % | Read |',
    '|---|---|---|',
    ...lines,
  ].join('\n');
}

export function GuidesPage({ initial }: { initial?: string }) {
  const [sel, setSel] = useState(GUIDES.find((g) => g.slug === initial)?.slug ?? GUIDES[0].slug);
  const g = GUIDES.find((x) => x.slug === sel)!;
  return (
    <div className="sidebar-layout">
      <div className="panel">
        <h3 style={{ marginTop: 0 }}>Strategy guides</h3>
        {GUIDES.map((x) => (
          <div
            key={x.slug}
            onClick={() => setSel(x.slug)}
            style={{ cursor: 'pointer', padding: '5px 6px', borderRadius: 6, background: x.slug === sel ? 'var(--panel-2)' : undefined }}
          >
            {x.badge && <span className={`tier tier-${x.badge}`}>{x.badge}</span>} {x.title}
          </div>
        ))}
      </div>
      <div className="panel">
        <div className="spread">
          <h1 style={{ margin: 0 }}>{g.title}</h1>
          <div className="row">
            {g.deckFile && (
              <>
                <a href={`#/deck?d=${encodeURIComponent(g.deckFile)}`}>
                  <button>Deck profile & stats</button>
                </a>
                <a href={`#/play?d=${encodeURIComponent(g.deckFile)}`}>
                  <button className="primary">Practice with it</button>
                </a>
                <a href={`#/play?o=${g.deckFile}`}>
                  <button>Practice against it</button>
                </a>
              </>
            )}
          </div>
        </div>
        {g.deckFile && allDecks().find((d) => d.file === g.deckFile) && (
          <div style={{ margin: '10px 0' }}>
            <LegendStrip legends={allDecks().find((d) => d.file === g.deckFile)!.deck.legends} height={110} />
          </div>
        )}
        {g.summary && <p className="muted">{g.summary}</p>}
        {g.deckFile && allDecks().find((d) => d.file === g.deckFile) && <ProvenanceBlock prov={allDecks().find((d) => d.file === g.deckFile)!.prov} />}
        <Markdown text={g.md} />
        {g.deckName && (analysis as any).decks?.find((d: DeckReport) => d.deck === g.deckName) ? (
          <>
            <h2>Data-driven insights</h2>
            <DeckInsights r={(analysis as any).decks.find((d: DeckReport) => d.deck === g.deckName)} compact />
            <p className="small">
              <a href={`#/insights?d=${encodeURIComponent(g.deckName)}`}>Full statistics →</a>
            </p>
          </>
        ) : (
          g.deckName && simTable(g.deckName) && <Markdown text={simTable(g.deckName)!} />
        )}
      </div>
    </div>
  );
}
