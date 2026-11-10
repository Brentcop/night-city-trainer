import { useRef, useState } from 'react';
import { Game } from '../../engine/engine';
import { makeTierBot, TIERS, type Tier } from '../../ai/tiers';
import type { DeckList, GameState, PlayerId } from '../../engine/types';
import { DeckPicker, findDeck } from '../components/DeckPicker';
import { allDecks } from '../../lib/browserLibrary';
import { summarize, type PlayerSummary } from '../../analysis/summarize';
import { analyzeDeck, type DeckReport } from '../../analysis/analyze';
import { DeckInsights } from '../components/DeckInsights';
import { DeckTile } from '../components/DeckIdentity';
import { recordReplay, ReplayBoard, type ReplayData } from '../components/ReplayBoard';
import { Wr, Verdict, ToneLegend } from '../components/Num';

interface Row {
  opp: string;
  games: number;
  wins: number;
  ties: number;
  firstGames: number;
  firstWins: number;
  turns: number;
}

type Level = Tier;
async function playOne(a: DeckList, b: DeckList, seed: number, first: PlayerId, level: Level, log = false, trace = false): Promise<GameState> {
  const g = Game.create([a, b], [makeTierBot(level, seed), makeTierBot(level, seed + 999)], { seed, first, log, trace });
  return g.run();
}

export function ArenaPage() {
  const decks = allDecks();
  const [a, setA] = useState(decks.find((d) => d.kind === 'meta')?.file ?? decks[0].file);
  const [b, setB] = useState(decks.filter((d) => d.kind === 'meta')[1]?.file ?? decks[1].file);
  const [n, setN] = useState(40);
  const [fast, setFast] = useState<Level>('medium');
  const [rows, setRows] = useState<Row[]>([]);
  const [progress, setProgress] = useState('');
  const [running, setRunning] = useState(false);
  const stop = useRef(false);
  const [watch, setWatch] = useState<{ data: ReplayData; names: [string, string] } | null>(null);
  const [telemetry, setTelemetry] = useState(true);
  const [report, setReport] = useState<DeckReport | null>(null);

  const run = async (opps: string[]) => {
    setRunning(true);
    stop.current = false;
    const A = findDeck(a)!.deck;
    const out: Row[] = [];
    setRows([]);
    const total = opps.length * n;
    let done = 0;
    const sums: PlayerSummary[] = [];
    setReport(null);
    for (const o of opps) {
      const B = findDeck(o)!.deck;
      const r: Row = { opp: B.name, games: 0, wins: 0, ties: 0, firstGames: 0, firstWins: 0, turns: 0 };
      out.push(r);
      for (let i = 0; i < n && !stop.current; i++) {
        const first = (i % 2) as PlayerId;
        const st = await playOne(A, B, 10_000 + i * 7 + out.length, first, fast, false, telemetry);
        if (telemetry) sums.push(summarize(st)[0]);
        r.games++;
        r.turns += st.turn;
        if (st.winner === 0) r.wins++;
        else if (st.winner === 'tie') r.ties++;
        if (first === 0) {
          r.firstGames++;
          if (st.winner === 0) r.firstWins++;
        }
        done++;
        if (done % 2 === 0) {
          setProgress(`${done}/${total} games`);
          setRows([...out]);
          await new Promise((res) => setTimeout(res, 0));
        }
      }
    }
    setRows([...out]);
    if (telemetry && sums.length) setReport(analyzeDeck(A.name, sums));
    setProgress(stop.current ? 'stopped' : `done — ${done} games`);
    setRunning(false);
  };

  const watchGame = async () => {
    const A = findDeck(a)!.deck;
    const B = findDeck(b)!.deck;
    const seed = Date.now() % 100000;
    const data = await recordReplay([A, B], [makeTierBot(fast, seed), makeTierBot(fast, seed + 999)], seed, (Math.random() < 0.5 ? 0 : 1) as PlayerId);
    setWatch({ data, names: [A.name, B.name] });
  };

  const pct = (x: number, y: number) => (y ? `${Math.round((100 * x) / y)}%` : '—');
  const metaFiles = decks.filter((d) => d.kind === 'meta' && d.file !== a).map((d) => d.file);
  const tot = rows.reduce((acc, r) => ({ g: acc.g + r.games, w: acc.w + r.wins + r.ties / 2 }), { g: 0, w: 0 });

  return (
    <div className="grid">
      <h1>Matchup Lab</h1>
      <p className="muted">
        Run bot-vs-bot games in your browser to test any deck — including ones you build or import. Both seats are played by the same bot, half the
        games on the play and half on the draw. For bigger runs use the CLI: <code>npm run sim -- review</code>.
      </p>
      <div className="panel grid">
        <div className="vs-preview">
          <div>
            <DeckPicker label="Deck A" value={a} onChange={setA} />
            {findDeck(a) && <DeckTile d={findDeck(a)!} href={`#/deck?d=${encodeURIComponent(a)}`} />}
          </div>
          <div className="vs-badge">VS</div>
          <div>
            <DeckPicker label="Deck B" value={b} onChange={setB} />
            {findDeck(b) && <DeckTile d={findDeck(b)!} href={`#/deck?d=${encodeURIComponent(b)}`} />}
          </div>
        </div>
        <div className="row">
          <label className="row small muted">
            Games per matchup
            <select value={n} onChange={(e) => setN(+e.target.value)}>
              {[10, 20, 40, 100, 200].map((x) => (
                <option key={x}>{x}</option>
              ))}
            </select>
          </label>
          <label className="row small muted">
            Bots
            <select value={fast} onChange={(e) => setFast(e.target.value as Level)}>
              {(Object.keys(TIERS) as Tier[]).map((t) => (
                <option key={t} value={t}>
                  {TIERS[t].label} — {TIERS[t].speed}
                </option>
              ))}
            </select>
          </label>
        </div>
        <div className="row">
          <button className="primary" disabled={running} onClick={() => run([b])}>
            A vs B
          </button>
          <button disabled={running} onClick={() => run(metaFiles)}>
            A vs every meta deck
          </button>
          <button disabled={running} onClick={() => run(decks.filter((d) => d.file !== a).map((d) => d.file))}>
            A vs all decks
          </button>
          <button disabled={!running} onClick={() => (stop.current = true)}>
            Stop
          </button>
          <button disabled={running} onClick={watchGame}>
            Watch one A vs B game
          </button>
          <label className="row small">
            <input type="checkbox" checked={telemetry} onChange={(e) => setTelemetry(e.target.checked)} /> collect telemetry &amp; analyze deck A
          </label>
          <span className="muted small">{progress}</span>
        </div>
      </div>
      {rows.length > 0 && (
        <div className="panel scroll-x">
          <div className="spread">
            <h3>{findDeck(a)!.deck.name}</h3>
            <ToneLegend />
            <span className="stat">
              <Wr v={tot.g ? tot.w / tot.g : null} n={tot.g} />
            </span>
          </div>
          <table>
            <thead>
              <tr>
                <th>Opponent</th>
                <th>Win%</th>
                <th>W-L-T</th>
                <th>On the play</th>
                <th>On the draw</th>
                <th>Avg turns</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.opp}>
                  <td>{r.opp}</td>
                  <td>
                    <Wr v={r.games ? (r.wins + r.ties / 2) / r.games : null} n={r.games} strong /> <Verdict v={r.games >= 10 ? (r.wins + r.ties / 2) / r.games : null} n={r.games} />
                    <div className="bar">
                      <div style={{ width: pct(r.wins + r.ties / 2, r.games) }} />
                    </div>
                  </td>
                  <td>
                    {r.wins}-{r.games - r.wins - r.ties}-{r.ties}
                  </td>
                  <td>
                    <Wr v={r.firstGames ? r.firstWins / r.firstGames : null} n={r.firstGames} />
                  </td>
                  <td>
                    <Wr v={r.games - r.firstGames ? (r.wins - r.firstWins) / (r.games - r.firstGames) : null} n={r.games - r.firstGames} />
                  </td>
                  <td>{r.games ? (r.turns / r.games).toFixed(1) : '—'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      {report && (
        <div className="panel">
          <h2 style={{ marginTop: 0 }}>Analysis: {report.deck}</h2>
          <DeckInsights r={report} />
        </div>
      )}
      {watch && (
        <div className="panel">
          <h3 style={{ marginTop: 0 }}>
            {watch.names[0]} vs {watch.names[1]} —{' '}
            {watch.data.final.winner === 'tie' ? 'draw' : `${watch.names[watch.data.final.winner as 0 | 1]} wins`} ({watch.data.final.winReason})
          </h3>
          <ReplayBoard data={watch.data} names={watch.names} />
        </div>
      )}
    </div>
  );
}
