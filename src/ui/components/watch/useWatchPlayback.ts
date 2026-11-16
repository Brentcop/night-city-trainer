// The spectator's playback ("Watch") on the page: the pure state machine (playback.ts) with its timers, and the games
// played out in the watch worker (watchClient.ts) one at a time, at most one game ahead of the table, so the next game
// is usually ready when the last one ends. A game the running event has not dealt yet is looked for again every second.
import { useEffect, useMemo, useReducer, useRef, useState } from 'react';
import { nextOf, type WatchTarget } from '../../../lib/watchMatch';
import type { WatchComputer } from './watchClient';
import { atEnd, initialPlayback, MIN_STEP_MS, playbackReduce, playedOut, ready, WAIT_POLL_MS, wantsPlan, type PlaybackAction, type PlaybackState } from './playback';

export function useWatchPlayback(target: WatchTarget, computer: WatchComputer | null, o: { startPlaying: boolean }): [PlaybackState, (a: PlaybackAction) => void] {
  const [st, dispatch] = useReducer(playbackReduce, o.startPlaying, initialPlayback);
  const [poll, setPoll] = useState(0);
  const alive = useRef(true);
  useEffect(() => {
    alive.current = true;
    return () => {
      alive.current = false;
    };
  }, []);
  // each look is made once per worker, even when React runs an effect twice (development): keyed by the entry asked for
  // and the poll; a new worker (the old one ended with its effect) asks again
  const lookedFor = useRef<{ key: string; by: WatchComputer | null }>({ key: '', by: null });

  // plan: find the next game and play it out (or look again shortly when the event has not dealt it yet)
  const { entries, shown, end } = st;
  useEffect(() => {
    if (!computer || !wantsPlan(st)) return undefined;
    const at = entries.length;
    const key = `${at}:${poll}`;
    if (lookedFor.current.key === key && lookedFor.current.by === computer) return undefined;
    lookedFor.current = { key, by: computer };
    const n = nextOf(target, playedOut(st));
    dispatch({ type: 'planned', at, next: n });
    if (n.kind === 'game') {
      void computer.compute(n.source).then((result) => {
        if (alive.current) dispatch({ type: 'computed', k: at, result });
      });
    }
    return undefined;
    // the plan depends only on the entries, the game on the table, the end and the poll (st is read for those)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [entries, shown, end, poll, target, computer]);

  // a game the event has not dealt yet: look again shortly
  const waiting = st.waiting;
  useEffect(() => {
    if (waiting === null) return undefined;
    const t = setTimeout(() => setPoll((x) => x + 1), WAIT_POLL_MS);
    return () => clearTimeout(t);
  }, [waiting, poll]);

  // the pace: one move every `speed` ms while playing
  const going = st.playing && ready(st) && !atEnd(st);
  useEffect(() => {
    if (!going) return undefined;
    const t = setTimeout(() => dispatch({ type: 'tick' }), Math.max(MIN_STEP_MS, st.speed));
    return () => clearTimeout(t);
  }, [going, st.fi, st.shown, st.speed]);

  // the pause between games
  useEffect(() => {
    if (st.left === null) return undefined;
    const t = setTimeout(() => dispatch({ type: 'second' }), 1000);
    return () => clearTimeout(t);
  }, [st.left, st.shown]);

  return useMemo(() => [st, dispatch], [st]);
}
