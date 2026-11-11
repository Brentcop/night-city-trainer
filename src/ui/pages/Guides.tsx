import { useState } from 'react';
import { GUIDES } from '../../content/guides';
import { Markdown } from '../components/Markdown';
import { REVIEW } from '../../data/index';
import { telemetryReport } from '../../data/analysisData';
import { withLiveCountdown } from '../../content/event';
import { DeckInsights } from '../components/DeckInsights';
import { ProvenanceBlock } from '../components/Provenance';
import { LegendStrip } from '../components/DeckIdentity';
import { allDecks } from '../../lib/browserLibrary';

function simTable(name: string): string | null {
  const R = REVIEW;
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
  const libDeck = g.deckFile ? allDecks().find((d) => d.file === g.deckFile) : undefined;
  const insights = g.deckName ? telemetryReport(g.deckName) : undefined;
  return (
    <div className="sidebar-layout">
      <div className="panel">
        <h3 style={{ marginTop: 0 }}>Strategy guides</h3>
        {GUIDES.map((x) => (
          <button key={x.slug} type="button" className="side-item" aria-current={x.slug === sel ? 'true' : undefined} onClick={() => setSel(x.slug)}>
            {x.badge && <span className={`tier tier-${x.badge}`}>{x.badge}</span>} {x.title}
          </button>
        ))}
      </div>
      <div className="panel flair">
        <div className="spread">
          <h1 style={{ margin: 0 }}>{g.title}</h1>
          <div className="row">
            {g.deckFile && (
              <>
                <a className="btn" href={`#/deck?d=${encodeURIComponent(g.deckFile)}`}>
                  Deck profile & stats
                </a>
                <a className="btn primary" href={`#/play?d=${encodeURIComponent(g.deckFile)}`}>
                  Practice with it
                </a>
                <a className="btn" href={`#/play?o=${g.deckFile}`}>
                  Practice against it
                </a>
              </>
            )}
          </div>
        </div>
        {libDeck && (
          <div style={{ margin: '10px 0' }}>
            <LegendStrip legends={libDeck.deck.legends} height={110} />
          </div>
        )}
        {g.summary && <p className="muted">{g.summary}</p>}
        {libDeck && <ProvenanceBlock prov={libDeck.prov} />}
        {/* the tournament plan's "(N days to Chicago)" was frozen when scripts/plan.ts ran; count from today instead */}
        <Markdown text={withLiveCountdown(g.md)} />
        {g.deckName && insights ? (
          <>
            <h2>Data-driven insights</h2>
            <DeckInsights r={insights} compact />
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
