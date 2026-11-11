import { useState } from 'react';
import analysis from '../../data/analysis.json';
import type { DeckReport } from '../../analysis/analyze';
import { DeckInsights } from '../components/DeckInsights';
import { allDecks } from '../../lib/browserLibrary';
import { LegendStrip, OriginBadge } from '../components/DeckIdentity';
import { CURRENT_SIM_VERSION, isHistorical } from '../../lib/playedRecord';

export function InsightsPage({ initial }: { initial?: string }) {
  const A = analysis as unknown as { date: string; games: number; bot: string; decks: DeckReport[] };
  const [sel, setSel] = useState(A.decks.find((d) => d.deck === initial)?.deck ?? A.decks[0]?.deck);
  const r = A.decks.find((d) => d.deck === sel);
  if (!A.decks.length)
    return (
      <div className="empty-state">
        <h1>Card stats</h1>
        <p>
          No telemetry yet. Run <code>npm run sim -- analyze --field all</code>, or use the Matchup Lab with "collect telemetry".
        </p>
      </div>
    );
  return (
    <div className="sidebar-layout">
      <div className="panel">
        <h3 style={{ marginTop: 0 }}>Decks</h3>
        <div className="small muted">
          {A.decks.reduce((a, d) => a + d.games, 0) / 2} bot games · {A.bot} bot · {A.date.slice(0, 10)}
        </div>
        {isHistorical((analysis as { manifest?: { simVersion?: number } }).manifest?.simVersion) && (
          <div className="small muted">Recorded before the current simulator (v{CURRENT_SIM_VERSION}): historical.</div>
        )}
        {A.decks.map((d) => (
          <button key={d.deck} type="button" className="side-item" aria-current={d.deck === sel ? 'true' : undefined} onClick={() => setSel(d.deck)}>
            <span className="spread">
              <span>{d.deck.slice(0, 34)}</span>
              <b>{Math.round(d.wr * 100)}%</b>
            </span>
          </button>
        ))}
      </div>
      <div className="panel flair">
        {(() => {
          const d = allDecks().find((x) => x.deck.name === r?.deck);
          return d ? (
            <div style={{ margin: '-14px -16px 10px' }}>
              <LegendStrip legends={d.deck.legends} height={120} />
            </div>
          ) : null;
        })()}
        <div className="spread">
          <h1 style={{ margin: 0 }}>{r?.deck}</h1>
          {(() => {
            const d = allDecks().find((x) => x.deck.name === r?.deck);
            return d ? (
              <div className="row">
                <OriginBadge deck={d} full />
                <a className="btn primary" href={`#/deck?d=${encodeURIComponent(d.file)}`}>
                  Full deck profile →
                </a>
              </div>
            ) : null;
          })()}
        </div>
        <p className="muted small">
          Statistics from bot-vs-bot telemetry. "Δ when drawn" compares the win rate in games where the card was drawn with games where it was
          not (like 17lands' IWD). It shows how much a card matters, not just how good it looks. Small samples are noisy, so trust numbers with
          100+ games behind them.
        </p>
        {r && <DeckInsights r={r} />}
      </div>
    </div>
  );
}
