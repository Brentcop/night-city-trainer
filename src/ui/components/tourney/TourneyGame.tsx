// Your games of a played event on the game board (#/run, "Play your match"): the Play page's Board, told it is a
// tournament game through its `tourney` prop (no Undo or Save, Concede loses the game for the event, the event's own
// coach setting, the result dialog going on to the match's next game or back to the event), driving a practice session
// set up from the waiting game (src/lib/playedGame.ts). Loaded on demand (React.lazy) with the board itself, never with
// the runner page. The game in progress is saved with the event at each of your decisions, when the page is hidden and
// when you leave, so "Continue" brings it back; a finished game is in your practice history like any other.
import { useCallback, useEffect, useMemo, useRef, useState, useSyncExternalStore } from 'react';
import { Board, TOURNEY_BACK } from '../../pages/Play';
import { loadBotSpeed, normalizeBotSpeed, saveBotSpeed } from '../board/prefs';
import { useBoardSettings } from '../../useBoardSettings';
import { useSiteConfig } from '../../useSiteConfig';
import { saveFor, YourGames } from '../../../lib/playedGame';
import { waitingMatch, type PlayedGames, type WaitingGame } from '../../../lib/playedEvent';
import type { SavedGame } from '../../../lib/savedGames';
import type { TourneyEvent } from '../../../lib/tournament';

export interface TourneyGameProps {
  played: PlayedGames;
  /** the waiting game to open */
  first: WaitingGame;
  /** the run as shown (its id and name for the practice tag, its rounds for the round's name and the score) */
  ev: TourneyEvent;
  /** the event's "Coach during my matches" (the site's coach must be on too) */
  coach: boolean;
  /** your game in progress, as the event keeps it */
  current: { game: string; save: unknown } | null;
  /** a new save of your game, or null once it has ended */
  onSave: (game: string, save: SavedGame | null) => void;
  onClose: () => void;
}

const sameMatch = (x: WaitingGame, w: WaitingGame) => x.kind === 'you' && x.base === w.base && x.job.a.name === w.job.a.name && x.job.b.name === w.job.b.name;

export default function TourneyGame({ played, first, ev, coach, current, onSave, onClose }: TourneyGameProps) {
  const site = useSiteConfig();
  const [settings] = useBoardSettings();
  const [speed, setSpeedRaw] = useState(loadBotSpeed);
  const setSpeed = useCallback((ms: number) => {
    const v = normalizeBotSpeed(ms);
    setSpeedRaw(v);
    saveBotSpeed(v);
  }, []);
  const speedRef = useRef(speed);
  speedRef.current = speed;
  const evRef = useRef(ev);
  evRef.current = ev;
  const saveRef = useRef(onSave);
  saveRef.current = onSave;
  const coachOn = site.features.coach && coach;
  const coachRef = useRef(coachOn);
  coachRef.current = coachOn;
  const [storageNote, setStorageNote] = useState<{ text: string; n: number } | null>(null);
  const ctlRef = useRef<YourGames | null>(null);
  if (!ctlRef.current)
    ctlRef.current = new YourGames(played, {
      event: { id: ev.id, ...(ev.name ? { name: ev.name } : {}) },
      roundOf: (w) => waitingMatch(evRef.current, w)?.round ?? '',
      pace: () => speedRef.current,
      coach: () => coachRef.current,
      onSave: (game, save) => saveRef.current(game, save),
      onRecordRefused: () =>
        setStorageNote((x) => ({ text: 'This browser refused to store the game in your practice history (its storage is full or blocked). The event has its result.', n: (x?.n ?? 0) + 1 })),
    });
  const ctl = ctlRef.current;
  const session = ctl.session;
  const game = useSyncExternalStore(session.subscribeGame, () => session.current);
  // the event's waiting games: the match's next game appears here once this one is over
  useSyncExternalStore(played.subscribe, () => played.version);
  const [problem, setProblem] = useState<{ w: WaitingGame; why: string } | null>(null);
  const endTurnClick = settings.endTurn === 'click';

  const open = useCallback(
    async (w: WaitingGame) => {
      setProblem(null);
      const save = current?.game === w.id ? saveFor(w, current.save) : null;
      if (!save) {
        ctl.start(w, { endTurnClick });
        return;
      }
      const r = await ctl.resume(w, save);
      if (!r.ok) setProblem({ w, why: r.why });
    },
    // the first game opens once; later games start from the result dialog
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [],
  );
  useEffect(() => {
    void open(first);
  }, [open, first]);
  // the game in progress is written when the page is hidden or closed, and when the board goes (leaving the page too)
  useEffect(() => {
    const flush = () => ctl.flush();
    const onVis = () => {
      if (document.visibilityState === 'hidden') flush();
    };
    window.addEventListener('pagehide', flush);
    document.addEventListener('visibilitychange', onVis);
    return () => {
      window.removeEventListener('pagehide', flush);
      document.removeEventListener('visibilitychange', onVis);
      ctl.leave();
    };
  }, [ctl]);

  const w = ctl.waitingOf(game);
  const next = w ? played.waiting.find((x) => x.id !== w.id && sameMatch(x, w)) : undefined;
  const line = w ? waitingMatch(ev, w) : null;
  const banner = useMemo(() => {
    if (!w) return null;
    const you = w.you ?? w.job.a.name;
    const opp = you === w.job.a.name ? w.job.b.name : w.job.a.name;
    const bo = line?.bestOf ?? ev.config?.bestOf ?? 3;
    const score = line ? (you === w.job.a.name ? line.match.score : [line.match.score[1], line.match.score[0]]) : null;
    return (
      <div className="online-status" role="status">
        <span>{ev.name ?? 'Tournament'}</span>
        <span>
          {line?.round ? `${line.round} · ` : ''}
          {bo > 1 ? `game ${w.gi + 1}, best of ${bo}` : 'one game'}
          {score && w.gi > 0 ? ` · ${score[0]}–${score[1]}` : ''}
        </span>
        <span>
          You play {you} against {opp}
        </span>
      </div>
    );
  }, [w, line, ev.name, ev.config?.bestOf]);

  if (problem)
    return (
      <div className="panel ev-game-problem" role="alert">
        <p>
          <b>This game could not be continued.</b> {problem.why}
        </p>
        <div className="row">
          <button
            className="primary"
            onClick={() => {
              onSave(problem.w.id, null);
              setProblem(null);
              ctl.start(problem.w, { endTurnClick });
            }}
          >
            Start this game again
          </button>
          <button onClick={onClose}>{TOURNEY_BACK}</button>
        </div>
      </div>
    );
  if (!game) return <p className="muted">Setting up the game…</p>;
  return (
    <Board
      key={game.match}
      session={session}
      game={game}
      coach={site.features.coach}
      speed={speed}
      setSpeed={setSpeed}
      onQuit={() => {
        // after the game: back to the event; an error stopped the game: it is kept as it was
        ctl.leave();
        onClose();
      }}
      onLeave={() => {
        ctl.leave();
        onClose();
        return true;
      }}
      onConcede={() => void session.concede()}
      onRematch={onClose}
      onUndo={() => undefined}
      canSave={false}
      canReview={site.features.gameReview}
      storageNote={storageNote}
      banner={banner}
      exitNote="You leave this game for now. The event keeps it as it is: Continue in the list of matches brings it back. Nothing is recorded yet."
      tourney={{
        coach: coachOn,
        nextLabel: next ? `Next game (game ${next.gi + 1})` : TOURNEY_BACK,
        onNext: () => {
          if (next) ctl.start(next, { endTurnClick });
          else {
            ctl.leave();
            onClose();
          }
        },
      }}
    />
  );
}
