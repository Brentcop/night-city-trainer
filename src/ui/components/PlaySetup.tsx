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
  dA,
  dB,
  onStart,
  onSettings,
  saves,
}: {
  mine: string;
  setMine: (file: string) => void;
  opp: string;
  setOpp: (file: string) => void;
  seat: Seat;
  setSeat: (s: Seat) => void;
  coach: boolean;
  setCoach: (on: boolean) => void;
  level: Tier;
  setLevel: (t: Tier) => void;
  dA: LibraryDeck | undefined;
  dB: LibraryDeck | undefined;
  onStart: () => void;
  /** open the board settings (paying costs, side panel, colours, backgrounds, bot speed) */
  onSettings?: () => void;
  /** saved games: Resume game (the autosave) beside Start, and the list of named saves */
  saves?: SavesProps;
}) {
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
          <select value={seat} onChange={(e) => setSeat(e.target.value as Seat)}>
            <option value="random">Random (d20 roll-off)</option>
            <option value="first">I go first</option>
            <option value="second">I go second</option>
          </select>
        </label>
        <div>
          <span className="muted small">Bot difficulty</span>
          <div className="tier-pick">
            {(Object.keys(TIERS) as Tier[]).map((t) => (
              <button key={t} className={`tier-btn tier-${t} ${level === t ? 'on' : ''}`} onClick={() => setLevel(t)} aria-pressed={level === t}>
                <b>{TIERS[t].label}</b>
                <span>{TIERS[t].blurb}</span>
              </button>
            ))}
          </div>
        </div>
        <label className="row">
          <input type="checkbox" checked={coach} onChange={(e) => setCoach(e.target.checked)} />
          <span>Coach mode — the deep advisor suggests a move, explains why, and flags threats</span>
        </label>
        <div className="row">
          {saves && <ResumeButton saves={saves} />}
          <button className={saves?.autosave && saves.storage ? '' : 'primary'} onClick={onStart} disabled={!mine || !opp || !!saves?.restoring}>
            Start game
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
      {saves && <SavedGamesPanel saves={saves} />}
      <MatchupRead A={dA} B={dB} />
      <RecentReviews />
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

