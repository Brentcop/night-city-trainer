// The Play page's setup screen (before a game): deck and bot pickers, Resume game and the saved games, the matchup
// read, recent games to review, and the practice log. The page keeps the choices (they also start a rematch); this
// only draws them.
import { useState } from 'react';
import { TIERS, tierLabel, type Tier } from '../../ai/tiers';
import { classify, PLAN_TEXT, type ProfileKey } from '../../ai/archetype';
import { telemetryReport } from '../../data/analysisData';
import type { LibraryDeck } from '../../lib/library';
import { clearPractice, loadPractice } from '../../lib/practiceLog';
import { loadReplays, type PracticeReplay } from '../../lib/practiceReplays';
import { DeckPicker } from './DeckPicker';
import { DeckTile } from './DeckIdentity';
import { formatRecorded } from './RecordedAt';
import { Verdict, Wr } from './Num';
import { GameReviewModal } from './GameReview';
import { ResumeButton, ResumeNote, SavedGamesPanel, type SavesProps } from './SavedGames';

export type Seat = 'random' | 'first' | 'second';

/** The multi-day choice on the setup screen (features.multiDayGames). */
export interface MultiDaySetup {
  on: boolean;
  setOn: (on: boolean) => void;
  days: number;
  setDays: (n: number) => void;
  min: number;
  max: number;
  /** why a new multi-day game can't be started now (the cap), or null */
  blocked: string | null;
  /** the Ongoing games panel */
  panel: React.ReactNode;
}

export function PlaySetup({
  mine,
  setMine,
  opp,
  setOpp,
  seat,
  setSeat,
  coach,
  setCoach,
  level,
  setLevel,
  tiers = Object.keys(TIERS) as Tier[],
  reviews = true,
  dA,
  dB,
  onStart,
  onSettings,
  saves,
  online = false,
  multiDay,
}: {
  mine: string;
  setMine: (file: string) => void;
  opp: string;
  setOpp: (file: string) => void;
  seat: Seat;
  setSeat: (s: Seat) => void;
  coach: boolean;
  /** absent when the coach is turned off (site config): the coach switch is not shown */
  setCoach?: (on: boolean) => void;
  level: Tier;
  setLevel: (t: Tier) => void;
  /** the bot tiers offered (site config), in order */
  tiers?: readonly Tier[];
  /** game review is on (site config): the recent games to review show */
  reviews?: boolean;
  dA: LibraryDeck | undefined;
  dB: LibraryDeck | undefined;
  onStart: () => void;
  /** open the board settings (paying costs, side panel, colours, backgrounds, bot speed) */
  onSettings?: () => void;
  /** saved games: Resume game (the autosave) beside Start, and the list of named saves */
  saves?: SavesProps;
  /** online play is on (site config): the Play online choice shows */
  online?: boolean;
  /** multi-day games are on (site config) and this browser can store them */
  multiDay?: MultiDaySetup;
}) {
  const md = multiDay?.on ? multiDay : null;
  return (
    <div className="grid" style={{ maxWidth: 860 }}>
      <h1>Play vs Bot</h1>
      {online && (
        <div className="panel play-online-entry">
          <div>
            <b>Play online</b>
            <div className="small muted">Play a friend in their own browser: host a game and send them the invite, or join with theirs.</div>
          </div>
          <div className="row">
            <a className="btn primary" href="#/play/online?mode=host">
              Host a game
            </a>
            <a className="btn" href="#/play/online?mode=join">
              Join a game
            </a>
          </div>
        </div>
      )}
      {multiDay && (
        <div className="panel play-online-entry">
          <div>
            <b>Play a person over days</b>
            <div className="small muted">A game by turn packets: make your move whenever you like and send the packet by any messenger; they reply with theirs.</div>
          </div>
          <div className="row">
            <a className="btn" href="#/play/corr">
              Multi-day game vs a person
            </a>
          </div>
        </div>
      )}
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
          <select value={seat} onChange={(e) => setSeat(e.target.value as Seat)}>
            <option value="random">Random (d20 roll-off)</option>
            <option value="first">I go first</option>
            <option value="second">I go second</option>
          </select>
        </label>
        <div>
          <span className="muted small">Bot difficulty</span>
          <div className="tier-pick">
            {tiers.map((t) => (
              <button key={t} className={`tier-btn tier-${t} ${level === t ? 'on' : ''}`} onClick={() => setLevel(t)} aria-pressed={level === t}>
                <b>{TIERS[t].label}</b>
                <span>{TIERS[t].blurb}</span>
              </button>
            ))}
          </div>
        </div>
        {setCoach && (
          <label className="row">
            <input type="checkbox" checked={coach} onChange={(e) => setCoach(e.target.checked)} />
            <span>Coach mode — the deep advisor suggests a move, explains why, and flags threats</span>
          </label>
        )}
        {multiDay && (
          <div className="grid multi-day-pick">
            <label className="row">
              <input type="checkbox" checked={multiDay.on} onChange={(e) => multiDay.setOn(e.target.checked)} />
              <span>Multi-day game — play it whenever you like; it is kept until you finish it</span>
            </label>
            {md && (
              <label className="row">
                <span className="muted small">Finish within</span>
                <select value={md.days} onChange={(e) => md.setDays(+e.target.value)} aria-label="Game length in days">
                  {Array.from({ length: md.max - md.min + 1 }, (_, k) => md.min + k).map((d) => (
                    <option key={d} value={d}>
                      {d} days
                    </option>
                  ))}
                </select>
                <span className="small muted">Then you choose: finish it late, or take a loss on time.</span>
              </label>
            )}
            {md?.blocked && (
              <p className="small online-error" role="status">
                {md.blocked}
              </p>
            )}
          </div>
        )}
        <div className="row">
          {saves && !md && <ResumeButton saves={saves} />}
          <button className={saves?.autosave && saves.storage && !md ? '' : 'primary'} onClick={onStart} disabled={!mine || !opp || !!saves?.restoring || !!md?.blocked}>
            {md ? 'Start multi-day game' : 'Start game'}
          </button>
          {onSettings && (
            <button type="button" onClick={onSettings}>
              ⚙ Settings
            </button>
          )}
          <a href="#/guides">Read the matchup guide first →</a>
        </div>
        {saves && <ResumeNote saves={saves} />}
      </div>
      {multiDay?.panel}
      {saves && <SavedGamesPanel saves={saves} />}
      <MatchupRead A={dA} B={dB} />
      {reviews && <RecentReviews />}
      <PracticeStats />
      <p className="muted small">
        Rules follow the official Comprehensive Rules (Oct 29, 2026): 3 Legends, 40–50 card decks, sell one card per turn for an Eddie,
        one Legend Call per turn (also during your rival's attack), Units enter with Lag, attack spent Units or the Gig area, 7 Gigs at the
        start of your turn wins, overtime after both players run out of dice.
      </p>
    </div>
  );
}

/** Recorded practice games, each reviewable by the match reviewer. */
function RecentReviews() {
  const [list] = useState(() => loadReplays().slice(-6).reverse());
  const [req, setReq] = useState<PracticeReplay | null>(null);
  if (!list.length) return null;
  return (
    <div className="panel">
      <h3 style={{ marginTop: 0 }}>Review a recent game</h3>
      <div className="round-list">
        {list.map((r) => (
          <button key={r.id} className="match-row" onClick={() => setReq(r)}>
            <span className={r.result === 'win' ? 'win' : ''}>{r.decks[0].name}</span>
            <b title={r.conceded ? 'You conceded' : undefined}>{r.result === 'win' ? 'W' : r.result === 'loss' ? (r.conceded ? 'L · conceded' : 'L') : 'D'}</b>
            <span>
              {r.decks[1].name} <span className="muted small">({tierLabel(r.botLevel)})</span>
            </span>
          </button>
        ))}
      </div>
      {req && <GameReviewModal src={{ replay: req, coach: [], persist: true }} title={[`${req.decks[0].name} vs ${req.decks[1].name}`, formatRecorded(req.date)].filter(Boolean).join(' — ')} onClose={() => setReq(null)} />}
    </div>
  );
}

function PracticeStats() {
  const [games, setGames] = useState(loadPractice);
  if (!games.length) return <p className="small muted">Your practice games are recorded here (in this browser) once you finish one.</p>;
  const rows = new Map<string, { w: number; l: number; d: number; c: number }>();
  for (const g of games) {
    const k = `${g.deck} vs ${g.opp}`;
    const r = rows.get(k) ?? { w: 0, l: 0, d: 0, c: 0 };
    if (g.result === 'win') r.w++;
    else if (g.result === 'loss') r.l++;
    else r.d++;
    if (g.conceded) r.c++;
    rows.set(k, r);
  }
  const w = games.filter((g) => g.result === 'win').length;
  const conceded = games.filter((g) => g.conceded).length;
  return (
    <div className="panel">
      <div className="spread">
        <h3 style={{ margin: 0 }}>
          Practice log — {w}-{games.length - w} ({Math.round((100 * w) / games.length)}%)
          {conceded > 0 && <span className="muted small"> · {conceded} conceded</span>}
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
                {r.c ? <span className="muted"> ({r.c} conceded)</span> : null}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function MatchupRead({ A, B }: { A?: LibraryDeck; B?: LibraryDeck }) {
  if (!A || !B) return null;
  const a = classify(A.deck.main).arch;
  const b = classify(B.deck.main).arch;
  const mu = telemetryReport(A.deck.name)?.matchups.find((m) => m.opp === B.deck.name);
  return (
    <div className="panel small">
      {mu && mu.games >= 10 && (
        <div className="mu-verdict">
          <Verdict v={mu.wr} n={mu.games} /> <Wr v={mu.wr} n={mu.games} strong /> in {mu.games} bot games{' '}
          <span className="muted">
            (on the play <Wr v={mu.wrFirst} />, on the draw <Wr v={mu.wrSecond} />)
          </span>
        </div>
      )}
      <b>Matchup read:</b> you are <b>{a}</b>, the bot is <b>{b}</b>. {PLAN_TEXT[`${a}>${b}` as ProfileKey]}{' '}
      <a href={`#/insights?d=${encodeURIComponent(A.deck.name)}`}>Your deck's stats →</a>
    </div>
  );
}

