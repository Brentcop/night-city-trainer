import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Game } from '../../engine/engine';
import type { Agent, Decision, PlayerId } from '../../engine/types';
import { HeuristicAgent } from '../../ai/heuristic';
import { HumanAgent } from '../HumanAgent';
import { DeckPicker, findDeck } from '../components/DeckPicker';
import { DeckTile } from '../components/DeckIdentity';
import { allDecks } from '../../lib/browserLibrary';
import { clearPractice, loadPractice, recordPractice } from '../../lib/practiceLog';
import { classify, BEST_PROFILES, PLAN_TEXT, type ProfileKey } from '../../ai/archetype';
import { buildInteraction, coachMark } from '../components/board/interaction';
import type { BoardCtx, Targeting } from '../components/board/BoardCard';
import { MyHand, PlayerSide } from '../components/board/Zones';
import { ActionMenu, GameOverOverlay, MulliganScreen, TrashModal, type MenuState } from '../components/board/Overlays';
import { AllOptions, PromptPanel, headline } from '../components/board/PromptPanel';
import { useNarrow } from '../components/board/useNarrow';
import '../board.css';

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

interface Running {
  id: number;
  g: Game;
  human: HumanAgent;
  bot: HeuristicAgent;
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
  const [game, setGame] = useState<Running | null>(null);
  const [, setTick] = useState(0);

  const start = () => {
    const A = findDeck(mine)?.deck;
    const B = findDeck(opp)?.deck;
    if (!A || !B) return;
    const human = new HumanAgent();
    const bot = new HeuristicAgent({ name: 'Bot', noise: 0.1, seed: Date.now() % 1000, lookahead: level !== 'fast', deep: level === 'deep' ? 3 : 0, profiles: BEST_PROFILES });
    const first: PlayerId | undefined = seat === 'first' ? 0 : seat === 'second' ? 1 : undefined;
    const g = Game.create([A, B], [human, new PacedAgent(bot, () => speedRef.current)], { first });
    const bump = () => setTick((t) => t + 1);
    g.onUpdate = bump;
    human.onChange = bump;
    setGame({ id: Date.now(), g, human, bot });
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
    const dA = findDeck(mine);
    const dB = findDeck(opp);
    return (
      <div className="grid" style={{ maxWidth: 860 }}>
        <h1>Play vs Bot</h1>
        {dA && dB && (
          <div className="pb-versus">
            <div className="pb-versus-deck">
              <div className="pb-label">You</div>
              <DeckTile d={dA} />
            </div>
            <div className="pb-versus-vs">VS</div>
            <div className="pb-versus-deck">
              <div className="pb-label">Bot</div>
              <DeckTile d={dB} />
            </div>
          </div>
        )}
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
  return <Board key={game.id} game={game} coach={coach} speed={speed} setSpeed={setSpeed} onQuit={() => setGame(null)} onRematch={start} />;
}

function Board({
  game,
  coach,
  speed,
  setSpeed,
  onQuit,
  onRematch,
}: {
  game: Running;
  coach: boolean;
  speed: number;
  setSpeed: (n: number) => void;
  onQuit: () => void;
  onRematch: () => void;
}) {
  const { g, human, bot } = game;
  const s = g.s;
  const pend = human.pending?.d ?? null;
  const narrow = useNarrow();
  const [hint, setHint] = useState<{ d: Decision; i: number; why: string } | null>(null);
  const [menu, setMenu] = useState<MenuState | null>(null);
  const [targeting, setTargeting] = useState<Targeting | null>(null);
  const [trashOf, setTrashOf] = useState<PlayerId | null>(null);
  const [hideOver, setHideOver] = useState(false);
  const logRef = useRef<HTMLDivElement>(null);

  // coach: ask the advisor bot what it would do in this spot
  useEffect(() => {
    if (!pend || !coach) return;
    let alive = true;
    const advisor = new HeuristicAgent({ name: 'Coach', profiles: BEST_PROFILES });
    advisor
      .decide(g, pend)
      .then(([i]) => {
        if (alive) setHint({ d: pend, i, why: advisor.lastThought });
      })
      .catch(() => undefined);
    return () => {
      alive = false;
    };
  }, [pend, coach, g]);

  // a new decision closes any open menu / target mode
  useEffect(() => {
    setMenu(null);
    setTargeting(null);
  }, [pend]);

  useEffect(() => {
    if (logRef.current) logRef.current.scrollTop = logRef.current.scrollHeight;
  }, [s.log.length]);

  // close the popover on scroll / resize; Escape cancels menus and target mode
  useEffect(() => {
    if (!menu && !targeting) return;
    const close = () => setMenu(null);
    const key = (e: KeyboardEvent) => {
      if (e.key !== 'Escape') return;
      setMenu(null);
      setTargeting(null);
    };
    if (menu) {
      window.addEventListener('scroll', close, true);
      window.addEventListener('resize', close);
    }
    window.addEventListener('keydown', key);
    return () => {
      window.removeEventListener('scroll', close, true);
      window.removeEventListener('resize', close);
      window.removeEventListener('keydown', key);
    };
  }, [menu, targeting]);

  const ix = useMemo(() => buildInteraction(g, pend), [g, pend]);
  const activeHint = hint && hint.d === pend ? hint : null;
  const mark = useMemo(() => coachMark(pend, activeHint?.i), [pend, activeHint]);

  const answer = useCallback(
    (i: number) => {
      setMenu(null);
      setTargeting(null);
      human.answer(i);
    },
    [human],
  );

  const ctx: BoardCtx = {
    g,
    pend,
    ix,
    coach: coach ? mark : null,
    targeting,
    narrow,
    menuUid: menu?.uid ?? null,
    answer,
    openMenu: (uid, el) => {
      const r = el.getBoundingClientRect();
      setMenu({ uid, rect: { top: r.top, bottom: r.bottom, left: r.left, width: r.width } });
    },
    startTargeting: (attacker) => {
      setMenu(null);
      const targets = ix.attacks.get(attacker) ?? [];
      if (targets.length === 1) answer(targets[0].i);
      else if (targets.length) setTargeting({ attacker, targets });
    },
    cancelTargeting: () => setTargeting(null),
    openTrash: (p) => setTrashOf(p),
  };

  const over = s.winner !== null;
  const mulligan = !!pend && pend.kind === 'yesno' && pend.tag === 'mulligan';
  const head = headline(ctx);
  const dock = narrow && !over && !mulligan && !!pend && (pend.kind !== 'action' || !!targeting);

  let handAction: React.ReactNode = null;
  if (targeting) {
    handAction = (
      <button className="pb-endturn ghost" onClick={() => setTargeting(null)}>
        Cancel attack
      </button>
    );
  } else if (pend?.kind === 'action') {
    handAction =
      ix.passIndex !== null ? (
        <button className={`pb-endturn primary ${ctx.coach?.i === ix.passIndex ? 'pb-coach-btn' : ''}`} onClick={() => answer(ix.passIndex!)}>
          End turn
        </button>
      ) : (
        <span className="small" style={{ color: 'var(--red)' }}>
          Must attack
        </span>
      );
  } else if (pend?.kind === 'reaction' && ix.passIndex !== null) {
    handAction = (
      <button className={`pb-endturn primary ${ctx.coach?.i === ix.passIndex ? 'pb-coach-btn' : ''}`} onClick={() => answer(ix.passIndex!)}>
        No reaction
      </button>
    );
  }

  return (
    <div className={`pb ${menu ? 'pb-menu-open' : ''} ${targeting ? 'pb-targeting' : ''} ${dock ? 'pb-has-dock' : ''}`}>
      <div className="pb-topbar">
        <div className="pb-turn">
          <span className="pb-turn-no">TURN {s.turn}</span>
          <span className={`pb-turn-who ${s.active === 0 ? 'me' : 'rival'}`}>{over ? 'GAME OVER' : s.active === 0 ? 'YOUR TURN' : "RIVAL'S TURN"}</span>
          {s.overtime && <span className="pb-overtime">OVERTIME</span>}
        </div>
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
          {over && hideOver && <button onClick={() => setHideOver(false)}>Result</button>}
          <button onClick={onQuit}>{over ? 'New game' : 'Quit'}</button>
        </div>
      </div>
      <div className="pb-layout">
        <div className="pb-mat">
          <PlayerSide p={1} ctx={ctx} />
          <div className={`pb-midline pb-tone-${head.tone}`}>
            <span>{head.text}</span>
          </div>
          <PlayerSide p={0} ctx={ctx} />
          <div className="pb-handbar">
            <MyHand ctx={ctx} />
            <div className="pb-handbar-actions">{handAction}</div>
          </div>
        </div>
        <aside className="pb-sidebar">
          <div className={dock ? 'pb-dock' : undefined}>
            <PromptPanel ctx={ctx} why={activeHint?.why} />
          </div>
          <AllOptions ctx={ctx} />
          <div className="pb-label">Game log</div>
          <div className="log pb-log" ref={logRef}>
            {s.log.slice(-250).map((l, i) => (
              <div key={i} className={l.player === null ? 'sys' : l.player === 0 ? 'p0' : 'p1'}>
                {l.text}
              </div>
            ))}
          </div>
          {bot.lastThought && <div className="small muted">Bot's last thought: {bot.lastThought}</div>}
        </aside>
      </div>
      {menu && <ActionMenu ctx={ctx} menu={menu} onClose={() => setMenu(null)} />}
      {trashOf !== null && <TrashModal g={g} p={trashOf} onClose={() => setTrashOf(null)} />}
      {mulligan && !over && <MulliganScreen ctx={ctx} why={activeHint?.why} />}
      {over && !hideOver && <GameOverOverlay g={g} onRematch={onRematch} onNew={onQuit} onHide={() => setHideOver(true)} />}
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
