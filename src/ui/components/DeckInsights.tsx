import type { DeckReport } from '../../analysis/analyze';
import { Signed, Wr } from './Num';
import { Markdown } from './Markdown';
import { classify, PLAN_TEXT, type ProfileKey } from '../../ai/archetype';
import { allDecks } from '../../lib/browserLibrary';

// JSON turns NaN into null, so treat anything non-finite as "no data"
const ok = (x: unknown): x is number => typeof x === 'number' && Number.isFinite(x);
const pct = (x: number | null) => (!ok(x) ? '—' : `${Math.round(x * 100)}%`);
const signed = (x: number | null) => (!ok(x) ? '—' : `${x >= 0 ? '+' : ''}${Math.round(x * 100)}`);
const fix1 = (x: number | null | undefined) => (ok(x) ? x.toFixed(1) : '—');

function archOf(name: string) {
  const d = allDecks().find((x) => x.deck.name === name);
  return d ? classify(d.deck.main).arch : null;
}

export function DeckInsights({ r, compact }: { r: DeckReport; compact?: boolean }) {
  const myArch = archOf(r.deck);
  const best = r.cards.filter((c) => ok(c.iwd)).slice(0, compact ? 6 : 12);
  const worst = [...r.cards].filter((c) => ok(c.iwd)).sort((a, b) => a.iwd - b.iwd).slice(0, compact ? 4 : 8);
  return (
    <div className="grid">
      <div className="row">
        <span className="stat" title="Telemetry win rate: bot-vs-bot games against the analysed field"><Wr v={r.wr} n={r.games} /></span>
        <span className="muted small">
          telemetry win rate in {r.games} bot games vs the analysed field · <Wr v={r.wrFirst} /> on the play / <Wr v={r.wrSecond} /> on the draw · {fix1(r.avgTurns)} turns avg · overtime {pct(r.overtimeRate)}
          {myArch && <> · plays as <b>{myArch}</b></>}
        </span>
      </div>
      <div>
        <h3>What the data says</h3>
        <Markdown text={r.insights.map((s) => `- ${s}`).join('\n')} />
      </div>
      <div className="grid cols-2">
        <div className="scroll-x">
          <h3>Highest-impact cards</h3>
          <table className="small">
            <thead>
              <tr>
                <th>Card</th>
                <th title="Win rate when drawn minus win rate when not drawn">Δ when drawn</th>
                <th>Avg turn</th>
                <th>Sold</th>
              </tr>
            </thead>
            <tbody>
              {best.map((c) => (
                <tr key={c.id}>
                  <td>{c.name}</td>
                  <td><Signed v={c.iwd} /></td>
                  <td>{fix1(c.avgPlayTurn)}</td>
                  <td>{pct(c.soldRate)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <div className="scroll-x">
          <h3>Lowest-impact cards</h3>
          <table className="small">
            <thead>
              <tr>
                <th>Card</th>
                <th>Δ when drawn</th>
                <th>Avg turn</th>
                <th>Sold</th>
              </tr>
            </thead>
            <tbody>
              {worst.map((c) => (
                <tr key={c.id}>
                  <td>{c.name}</td>
                  <td><Signed v={c.iwd} /></td>
                  <td>{fix1(c.avgPlayTurn)}</td>
                  <td>{pct(c.soldRate)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
      {!compact && (
        <div className="scroll-x">
          <h3>Tempo: win rate by Gig position after your Nth turn</h3>
          <table className="small">
            <thead>
              <tr>
                <th>After turn</th>
                <th>Ahead</th>
                <th>Even</th>
                <th>Behind</th>
                <th>Avg Gig diff in wins</th>
                <th>in losses</th>
              </tr>
            </thead>
            <tbody>
              {r.tempo.map((t, i) => (
                <tr key={t.turn}>
                  <td>{t.turn}</td>
                  <td>
                    <Wr v={t.leadWr} n={t.leadN} /> <span className="muted">({t.leadN})</span>
                  </td>
                  <td>
                    <Wr v={t.evenWr} n={t.evenN} /> <span className="muted">({t.evenN})</span>
                  </td>
                  <td>
                    <Wr v={t.behindWr} n={t.behindN} /> <span className="muted">({t.behindN})</span>
                  </td>
                  <td>{fix1(r.diffCurve[i].wins)}</td>
                  <td>{fix1(r.diffCurve[i].losses)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      <div className="scroll-x">
        <h3>Matchups &amp; assumed game plan</h3>
        <table className="small">
          <thead>
            <tr>
              <th>Opponent</th>
              <th>Win %</th>
              <th>Play / Draw</th>
              <th>Turns</th>
              <th>Plan</th>
              <th>Key cards here</th>
            </tr>
          </thead>
          <tbody>
            {r.matchups.map((m) => {
              const oa = archOf(m.opp);
              const plan = myArch && oa ? PLAN_TEXT[`${myArch}>${oa}` as ProfileKey] : '';
              return (
                <tr key={m.opp}>
                  <td>
                    {m.opp}
                    {oa && <div className="muted">{oa}</div>}
                  </td>
                  <td>
                    <Wr v={m.wr} n={m.games} strong />
                  </td>
                  <td>
                    <Wr v={m.wrFirst} /> / <Wr v={m.wrSecond} />
                  </td>
                  <td>{fix1(m.avgTurns)}</td>
                  <td style={{ minWidth: 220 }}>{plan}</td>
                  <td>{m.topCards.map((c) => `${c.name} ${signed(c.iwd)}`).join(', ')}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
