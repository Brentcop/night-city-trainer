import { useEffect, useRef, useState } from 'react';
import { TIERS, type Tier } from '../../ai/tiers';
import type { PlayerId } from '../../engine/types';
import { DeckPicker, findDeck } from '../components/DeckPicker';
import { allDecks } from '../../lib/browserLibrary';
import type { PlayerSummary } from '../../analysis/summarize';
import { analyzeDeck, type DeckReport } from '../../analysis/analyze';
import { DeckInsights } from '../components/DeckInsights';
import { DeckTile } from '../components/DeckIdentity';
import { ReplayBoard, type ReplayData } from '../components/ReplayBoard';
import { Wr, Verdict, ToneLegend } from '../components/Num';
import { gameDeck } from '../../lib/tournament';
import { GamePool, defaultThreads, errorText, isStopped } from '../../sim/pool';
import { useReplayWorker } from '../useReplayWorker';

interface Row {
  /** opponent's library file (unique; names can repeat across built-in and custom decks) */
  key: string;
  opp: string;
  games: number;
  wins: number;
  ties: number;
  firstGames: number;
  firstWins: number;
  turns: number;
}

type Level = Tier;

export function ArenaPage() {
  const decks = allDecks();
  const [a, setA] = useState(decks.find((d) => d.kind === 'meta')?.file ?? decks[0].file);
  const [b, setB] = useState(decks.filter((d) => d.kind === 'meta')[1]?.file ?? decks[1].file);
  const [n, setN] = useState(40);
  const [fast, setFast] = useState<Level>('medium');
  const [rows, setRows] = useState<Row[]>([]);
  const [progress, setProgress] = useState('');
  const [running, setRunning] = useState(false);
  const [error, setError] = useState('');
  const poolRef = useRef<GamePool | null>(null);
  // leaving the page stops the run (games live in workers, not in this component)
  useEffect(() => () => poolRef.current?.terminate(), []);
  const replayer = useReplayWorker();
  const [watching, setWatching] = useState(false);
  const [watch, setWatch] = useState<{ data: ReplayData; names: [string, string] } | null>(null);
  const [telemetry, setTelemetry] = useState(true);
  const [report, setReport] = useState<DeckReport | null>(null);

  // Games run on the worker pool (same seeds as the old in-page loop: game i vs the k-th opponent uses
  // seed 10_000 + 7i + k, seat B's bot seed + 999, A on the play in even games), so results stay comparable.
  const run = async (opps: string[]) => {
    const dA = findDeck(a);
    if (!dA) return;
    const A = gameDeck(dA.deck);
    const field = opps.map((o) => findDeck(o)).filter((d): d is NonNullable<typeof d> => !!d);
    poolRef.current?.terminate();
    const pool = new GamePool(defaultThreads());
    poolRef.current = pool;
    const out: Row[] = field.map((d) => ({ key: d.file, opp: d.deck.name, games: 0, wins: 0, ties: 0, firstGames: 0, firstWins: 0, turns: 0 }));
    const total = field.length * n;
    const sums: (PlayerSummary | undefined)[] = [];
    let done = 0;
    let shownAt = 0;
    const show = (force = false) => {
      if (!force && Date.now() - shownAt < 150) return;
      shownAt = Date.now();
      setRows(out.map((r) => ({ ...r })));
      setProgress(`${done}/${total} games`);
    };
    setRunning(true);
    setError('');
    setRows([]);
    setReport(null);
    setProgress(`0/${total} games`);
    try {
      await Promise.all(
        field.flatMap((d, k) => {
          const B = gameDeck(d.deck);
          return Array.from({ length: n }, (_, i) => {
            const first = (i % 2) as PlayerId;
            const seed = 10_000 + i * 7 + (k + 1);
            return pool.run({ a: A, b: B, seed, seedB: seed + 999, first, bot: fast, trace: telemetry }).then(({ rec: g }) => {
              const r = out[k];
              if (telemetry) sums[k * n + i] = g.summary;
              r.games++;
              r.turns += g.turns;
              if (g.winner === 0) r.wins++;
              else if (g.winner === 'tie') r.ties++;
              if (first === 0) {
                r.firstGames++;
                if (g.winner === 0) r.firstWins++;
              }
              done++;
              show();
            });
          });
        }),
      );
      if (telemetry) {
        const got = sums.filter((s): s is PlayerSummary => !!s);
        if (got.length) setReport(analyzeDeck(A.name, got));
      }
      setProgress(`done — ${done} games`);
    } catch (e) {
      // Stop (or leaving the page) terminates the pool; anything else is a game that failed.
      if (isStopped(e)) setProgress(`stopped — ${done} of ${total} games played`);
      else {
        setProgress(`failed after ${done} games`);
        setError(errorText(e));
      }
    } finally {
      pool.terminate();
      if (poolRef.current === pool) poolRef.current = null;
      show(true);
      setRunning(false);
    }
  };
  const stopRun = () => poolRef.current?.terminate();

  const watchGame = async () => {
    const dA = findDeck(a);
    const dB = findDeck(b);
    if (!dA || !dB) return;
    const seed = Date.now() % 100000;
    const first = (Math.random() < 0.5 ? 0 : 1) as PlayerId;
    setWatching(true);
    setError('');
    try {
      const data = await replayer.start({ a: gameDeck(dA.deck), b: gameDeck(dB.deck), seed, seedB: seed + 999, first, bot: fast });
      if (data) setWatch({ data, names: [dA.deck.name, dB.deck.name] });
    } catch (e) {
      setError(errorText(e));
    } finally {
      setWatching(false);
    }
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
          <button disabled={!running} onClick={stopRun}>
            Stop
          </button>
          <button disabled={running || watching} onClick={watchGame}>
            {watching ? 'Simulating…' : 'Watch one A vs B game'}
          </button>
          <label className="row small">
            <input type="checkbox" checked={telemetry} onChange={(e) => setTelemetry(e.target.checked)} disabled={running} /> collect telemetry &amp; analyze deck A
          </label>
          <span className="muted small">{progress}</span>
        </div>
        {error && (
          <div className="small" style={{ color: 'var(--red)' }}>
            ⚠ A game failed: {error}
          </div>
        )}
      </div>
      {rows.length > 0 && (
        <div className="panel scroll-x">
          <div className="spread">
            <h3>{findDeck(a)?.deck.name}</h3>
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
                <tr key={r.key}>
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
