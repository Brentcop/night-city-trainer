import { useEffect, useMemo, useRef, useState } from 'react';
import { Game, other } from '../../engine/engine';
import { CARD_BY_ID } from '../../engine/cards';
import type { Agent, CardInst, Decision, Gig, PlayerId } from '../../engine/types';
import { HeuristicAgent } from '../../ai/heuristic';
import { HumanAgent } from '../HumanAgent';
import { CardView } from '../components/CardView';
import { DeckPicker, findDeck } from '../components/DeckPicker';
import { allDecks } from '../../lib/browserLibrary';
import { clearPractice, loadPractice, recordPractice } from '../../lib/practiceLog';
import { classify, BEST_PROFILES, PLAN_TEXT, type ProfileKey } from '../../ai/archetype';

const delay = (ms: number) => new Promise((r) => setTimeout(r, ms));

/** Wraps a bot so its moves are visible to the human. */
class PacedAgent implements Agent {
  name: string;
  constructor(public inner: HeuristicAgent, public ms: () => number) {
    this.name = inner.name;
  }
  async decide(g: Game, d: Decision) {
    const r = await this.inner.decide(g, d);
    if (d.kind === 'action' || d.kind === 'reaction') await delay(this.ms());
    return r;
  }
}

export function PlayPage({ initialDeck, initialOpp }: { initialDeck?: string; initialOpp?: string }) {
  const decks = allDecks();
  const [mine, setMine] = useState(findDeck(initialDeck)?.file ?? decks[0]?.file);
  const [opp, setOpp] = useState(findDeck(initialOpp)?.file ?? decks[1]?.file);
  const [seat, setSeat] = useState<'random' | 'first' | 'second'>('random');
  const [coach, setCoach] = useState(true);
  const [level, setLevel] = useState<'fast' | 'lookahead' | 'deep'>('deep');
  const [speed, setSpeed] = useState(500);
  const speedRef = useRef(speed);
  speedRef.current = speed;
  const [game, setGame] = useState<{ g: Game; human: HumanAgent; bot: HeuristicAgent } | null>(null);
  const [, setTick] = useState(0);

  const start = () => {
    const A = findDeck(mine)!.deck;
    const B = findDeck(opp)!.deck;
    const human = new HumanAgent();
    const bot = new HeuristicAgent({ name: 'Bot', noise: 0.1, seed: Date.now() % 1000, lookahead: level !== 'fast', deep: level === 'deep' ? 3 : 0, profiles: BEST_PROFILES });
    const first: PlayerId | undefined = seat === 'first' ? 0 : seat === 'second' ? 1 : undefined;
    const g = Game.create([A, B], [human, new PacedAgent(bot, () => speedRef.current)], { first });
    const bump = () => setTick((t) => t + 1);
    g.onUpdate = bump;
    human.onChange = bump;
    setGame({ g, human, bot });
    g.run().then((st) => {
      recordPractice({
        date: new Date().toISOString(),
        deck: A.name,
        opp: B.name,
        level,
        result: st.winner === 0 ? 'win' : st.winner === 1 ? 'loss' : 'draw',
        first: st.first === 0,
        turns: st.turn,
        reason: st.winReason,
      });
      bump();
    });
  };

  if (!game) {
    return (
      <div className="grid" style={{ maxWidth: 760 }}>
        <h1>Play vs Bot</h1>
        <div className="panel grid">
          <DeckPicker label="Your deck" value={mine} onChange={setMine} />
          <DeckPicker label="Bot deck" value={opp} onChange={setOpp} />
          <label className="row">
            <span className="muted small">Seat</span>
            <select value={seat} onChange={(e) => setSeat(e.target.value as any)}>
              <option value="random">Random (d20 roll-off)</option>
              <option value="first">I go first</option>
              <option value="second">I go second</option>
            </select>
          </label>
          <label className="row">
            <span className="muted small">Bot strength</span>
            <select value={level} onChange={(e) => setLevel(e.target.value as any)}>
              <option value="deep">Deep — rolls out the rival's reply (strongest)</option>
              <option value="lookahead">Lookahead — one action ahead</option>
              <option value="fast">Fast — simple rules (beginner)</option>
            </select>
          </label>
          <label className="row">
            <input type="checkbox" checked={coach} onChange={(e) => setCoach(e.target.checked)} />
            <span>Coach mode — show what the lookahead bot would do in your spot</span>
          </label>
          <div className="row">
            <button className="primary" onClick={start} disabled={!mine || !opp}>
              Start game
            </button>
            <a href="#/guides">Read the matchup guide first →</a>
          </div>
        </div>
        <MatchupRead mine={mine} opp={opp} />
        <PracticeStats />
        <p className="muted small">
          Rules follow the official Comprehensive Rules (Oct 29, 2026): 3 Legends, 40–50 card decks, sell one card per turn for an Eddie,
          one Legend Call per turn (also during your rival's attack), Units enter with Lag, attack spent Units or the Gig area, 7 Gigs at the
          start of your turn wins, overtime after both players run out of dice.
        </p>
      </div>
    );
  }
  return <Board game={game} coach={coach} speed={speed} setSpeed={setSpeed} onQuit={() => setGame(null)} />;
}

function Board({
  game,
  coach,
  speed,
  setSpeed,
  onQuit,
}: {
  game: { g: Game; human: HumanAgent; bot: HeuristicAgent };
  coach: boolean;
  speed: number;
  setSpeed: (n: number) => void;
  onQuit: () => void;
}) {
  const { g, human, bot } = game;
  const s = g.s;
  const pend = human.pending?.d ?? null;
  const [hint, setHint] = useState<{ i: number; why: string } | null>(null);
  const logRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    setHint(null);
    if (!pend || !coach) return;
    let alive = true;
    const advisor = new HeuristicAgent({ name: 'Coach', profiles: BEST_PROFILES });
    advisor.decide(g, pend).then(([i]) => {
      if (alive) setHint({ i, why: advisor.lastThought });
    });
    return () => {
      alive = false;
    };
  }, [pend, coach, g]);

  useEffect(() => {
    if (logRef.current) logRef.current.scrollTop = logRef.current.scrollHeight;
  });

  const optByUid = useMemo(() => {
    const m = new Map<number, number>();
    pend?.options.forEach((o, i) => {
      if (o.uid !== undefined && pend.kind !== 'action' && pend.kind !== 'reaction') m.set(o.uid, i);
    });
    return m;
  }, [pend]);
  const optByGig = useMemo(() => {
    const m = new Map<number, number>();
    if (pend?.kind === 'gig') pend.options.forEach((o, i) => o.gig !== undefined && m.set(o.gig, i));
    return m;
  }, [pend]);

  const cardEl = (c: CardInst, hidden = false) => {
    const def = CARD_BY_ID[c.defId];
    const pick = optByUid.get(c.uid);
    if (hidden) {
      return (
        <div key={c.uid} className={`card ${pick !== undefined ? 'clickable' : ''} ${c.spent ? 'spent' : ''}`} onClick={() => pick !== undefined && human.answer(pick)}>
          <div className="name">{c.zone === 'legends' ? 'Face-down Legend' : 'Card'}</div>
          <div className="meta">{c.spent ? 'spent' : 'ready'}</div>
        </div>
      );
    }
    const isUnit = c.zone === 'field';
    return (
      <CardView
        key={c.uid}
        def={def}
        power={isUnit || (c.zone === 'legends' && def.power !== null) ? g.power(c) : undefined}
        spent={c.spent}
        clickable={pick !== undefined}
        onClick={() => pick !== undefined && human.answer(pick)}
        extra={
          <div className="row small" style={{ marginTop: 4 }}>
            {c.lag && isUnit && <span className="tag">lag</span>}
            {c.goSolo && <span className="tag">go solo</span>}
            {g.hasKw(c, 'blocker') && isUnit && <span className="tag">blocker</span>}
            {c.gear.map((gu) => (
              <span key={gu} className="tag" title={CARD_BY_ID[g.c(gu).defId].text}>
                ⚙ {g.name(gu)}
              </span>
            ))}
            {s.mods
              .filter((m) => m.target === c.uid && m.kind !== 'power')
              .map((m) => (
                <span key={m.id} className="tag">
                  {m.kind}
                </span>
              ))}
          </div>
        }
      />
    );
  };

  const gigEl = (x: Gig, fixer = false) => {
    const pick = optByGig.get(x.id);
    return (
      <div key={x.id} className={`gig ${fixer ? 'fixer' : ''} ${pick !== undefined ? 'clickable' : ''}`} onClick={() => pick !== undefined && human.answer(pick)}>
        {fixer ? '—' : x.value} <small>d{x.sides}</small>
      </div>
    );
  };

  const side = (p: PlayerId) => {
    const P = g.P(p);
    const me = p === 0;
    const cred = g.streetCred(p);
    return (
      <div className={`side ${s.active === p ? 'active' : ''}`}>
        <div className="spread">
          <b>
            {me ? 'You' : 'Bot'} — {P.name}
          </b>
          <span className="small muted">
            Gigs <b style={{ color: 'var(--text)' }}>{P.gigs.length}</b>/7 · ☆ {cred ?? '–'} · Eddies {P.eddies.filter((u) => !g.c(u).spent).length}/{P.eddies.length} ·
            Hand {P.hand.length} · Deck {P.deck.length} · Trash {P.trash.length}
          </span>
        </div>
        <div className="row" style={{ marginTop: 6 }}>
          <span className="zone-label">Gigs</span>
          <div className="gigs">
            {g.gigsOf(p).map((x) => gigEl(x))}
            {P.fixer.map((id) => gigEl(g.gig(id), true))}
          </div>
        </div>
        <div className="zone-label" style={{ marginTop: 6 }}>
          Legends
        </div>
        <div className="zone">{P.legends.map((u) => cardEl(g.c(u), !g.c(u).faceUp))}</div>
        <div className="zone-label">Field</div>
        <div className="zone">{P.field.length ? P.field.map((u) => cardEl(g.c(u))) : <span className="muted small">empty</span>}</div>
        {me && (
          <>
            <div className="zone-label">Your hand</div>
            <div className="zone">{P.hand.map((u) => cardEl(g.c(u)))}</div>
          </>
        )}
      </div>
    );
  };

  const over = s.winner !== null;
  return (
    <div>
      <div className="spread" style={{ marginBottom: 8 }}>
        <h2 style={{ margin: 0 }}>
          Turn {s.turn} · {s.active === 0 ? 'Your turn' : "Bot's turn"} {s.overtime && <span className="tier tier-S">OVERTIME</span>}
        </h2>
        <div className="row">
          <label className="row small muted">
            Bot speed
            <select value={speed} onChange={(e) => setSpeed(+e.target.value)}>
              <option value={0}>instant</option>
              <option value={250}>fast</option>
              <option value={500}>normal</option>
              <option value={1200}>slow</option>
            </select>
          </label>
          <button onClick={onQuit}>{over ? 'New game' : 'Quit'}</button>
        </div>
      </div>
      <div className="board">
        <div>
          {side(1)}
          {side(0)}
        </div>
        <div>
          {over && (
            <div className="prompt">
              <h3 style={{ marginTop: 0 }}>{s.winner === 0 ? 'You win!' : s.winner === 1 ? 'Bot wins' : 'Draw'}</h3>
              <div className="muted">{s.winReason}</div>
            </div>
          )}
          {pend && !over && (
            <div className="prompt">
              <b>{pend.prompt}</b>
              {pend.source !== undefined && <div className="small muted">from {g.name(pend.source)}</div>}
              {hint && (
                <div className="small" style={{ marginTop: 6, color: 'var(--cyan)' }}>
                  Coach: {pend.options[hint.i]?.label}
                  {hint.why && <div className="muted">{hint.why}</div>}
                </div>
              )}
              <div className="opts">
                {pend.options.map((o, i) => (
                  <button key={i} onClick={() => human.answer(i)} className={hint?.i === i ? 'primary' : ''}>
                    {o.label}
                  </button>
                ))}
              </div>
            </div>
          )}
          {!pend && !over && <div className="prompt muted">Bot is thinking…</div>}
          <div className="zone-label">Game log</div>
          <div className="log" ref={logRef}>
            {s.log.slice(-250).map((l, i) => (
              <div key={i} className={l.player === null ? 'sys' : l.player === 0 ? 'p0' : 'p1'}>
                {l.text}
              </div>
            ))}
          </div>
          <div className="small muted" style={{ marginTop: 6 }}>
            Rival trash: {g.P(1).trash.slice(-8).map((u) => g.name(u)).join(', ') || '—'}
          </div>
          {bot.lastThought && <div className="small muted">Bot's last thought: {bot.lastThought}</div>}
          <div className="small muted">Rival {other(0) === 1 ? '' : ''}hand: {g.P(1).hand.length} cards</div>
        </div>
      </div>
    </div>
  );
}

function PracticeStats() {
  const [games, setGames] = useState(loadPractice());
  if (!games.length) return <p className="small muted">Your practice games are recorded here (in this browser) once you finish one.</p>;
  const rows = new Map<string, { w: number; l: number; d: number }>();
  for (const g of games) {
    const k = `${g.deck} vs ${g.opp}`;
    const r = rows.get(k) ?? { w: 0, l: 0, d: 0 };
    if (g.result === 'win') r.w++;
    else if (g.result === 'loss') r.l++;
    else r.d++;
    rows.set(k, r);
  }
  const w = games.filter((g) => g.result === 'win').length;
  return (
    <div className="panel">
      <div className="spread">
        <h3 style={{ margin: 0 }}>
          Practice log — {w}-{games.length - w} ({Math.round((100 * w) / games.length)}%)
        </h3>
        <button
          className="ghost"
          onClick={() => {
            clearPractice();
            setGames([]);
          }}
        >
          Clear
        </button>
      </div>
      <table className="small">
        <tbody>
          {[...rows.entries()].map(([k, r]) => (
            <tr key={k}>
              <td>{k}</td>
              <td>
                {r.w}-{r.l}
                {r.d ? `-${r.d}` : ''}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function MatchupRead({ mine, opp }: { mine?: string; opp?: string }) {
  const A = findDeck(mine);
  const B = findDeck(opp);
  if (!A || !B) return null;
  const a = classify(A.deck.main).arch;
  const b = classify(B.deck.main).arch;
  return (
    <div className="panel small">
      <b>Matchup read:</b> you are <b>{a}</b>, the bot is <b>{b}</b>. {PLAN_TEXT[`${a}>${b}` as ProfileKey]}{' '}
      <a href={`#/insights?d=${encodeURIComponent(A.deck.name)}`}>Your deck's stats →</a>
    </div>
  );
}
