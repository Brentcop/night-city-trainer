import { useState } from 'react';
import analysis from '../../data/analysis.json';
import type { DeckReport } from '../../analysis/analyze';
import { DeckInsights } from '../components/DeckInsights';

export function InsightsPage({ initial }: { initial?: string }) {
  const A = analysis as unknown as { date: string; games: number; bot: string; decks: DeckReport[] };
  const [sel, setSel] = useState(A.decks.find((d) => d.deck === initial)?.deck ?? A.decks[0]?.deck);
  const r = A.decks.find((d) => d.deck === sel);
  if (!A.decks.length)
    return (
      <div className="panel">
        <h1>Insights</h1>
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
        {A.decks.map((d) => (
          <div
            key={d.deck}
            onClick={() => setSel(d.deck)}
            style={{ cursor: 'pointer', padding: '5px 6px', borderRadius: 6, background: d.deck === sel ? 'var(--panel-2)' : undefined }}
          >
            <span className="spread">
              <span>{d.deck.slice(0, 34)}</span>
              <b>{Math.round(d.wr * 100)}%</b>
            </span>
          </div>
        ))}
      </div>
      <div className="panel">
        <h1 style={{ marginTop: 0 }}>{r?.deck}</h1>
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
