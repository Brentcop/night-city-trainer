// Run a tournament live in the browser. "Set up the event" in one flow: the entrants (any library or saved deck, quick
// sets, explicit copies), the format (Swiss + top cut, a bracket, round robin, or a list of exact matches) with any
// pairings, seeds, bracket or matches set by hand, the series rules and bots; the plan before play; then run it all at
// once or round by round (pause, read the standings, set the next round's pairings). Stopped runs are saved here and can
// be resumed. Same engine, bots and rules as scripts/tournament.ts (src/lib/tournament.ts, src/lib/eventFormats.ts).
import { useEffect, useMemo, useRef, useState } from 'react';
import { RATINGS } from '../../data/index';
import { allDecks } from '../../lib/browserLibrary';
import type { LibraryDeck } from '../../lib/library';
import {
  arrangedNote,
  BEST_OF,
  bracketPlan,
  cutSize,
  EVENT_FORMATS,
  expandMatchList,
  fieldNote,
  forcedPairProblems,
  GAME1_RULES,
  groupName,
  groupSplit,
  isPlainSetup,
  NEXT_RULES,
  resumePlay,
  roundName,
  roundRobinSchedule,
  runTournament,
  seededSlots,
  swissRound1,
  autoRounds,
  type BestOf,
  type BotLevel,
  type EventFormat,
  type EventSetup,
  type ForcedPair,
  type GameRec,
  type RoundInput,
  type RoundStep,
  type TourneyConfig,
  type TourneyEvent,
} from '../../lib/tournament';
import { DEFAULT_DRAFT, draftSetup, entrantName, entrantsFromList, entrantsToList, planText, reachedBefore, type EventDraft } from '../../lib/eventDraft';
import { defaultThreads, errorText, isStopped } from '../../sim/pool';
import { download } from '../../lib/download';
import { usePoolRun } from '../usePoolRun';
import { parseRunParams, parseRuns, toEvent } from '../runParams';
import { TOURNEY_BOTS, tierLabel } from '../../ai/tiers';
import '../deckprofile.css';
import { StatTile } from '../components/DeckStats';
import { PageHead } from '../components/PageHead';
import { RecordedAt } from '../components/RecordedAt';
import { Bracket, Champion, GroupTables, MatchModal, RoundList, StandingsTable, standingsTitle, useLib, type MatchView } from '../components/TourneyViews';
import { BracketBoEditor, BracketSlotsEditor, EntrantPicker, MatchListEditor, PairingEditor, SeedOrderEditor } from '../components/EventSetup';

type FieldKey = 'meta' | 'ladder' | 'top16' | 'original' | 'guide' | 'all' | 'custom';
const BOTS = TOURNEY_BOTS;
const SAVE_KEY = 'nct.runs.v1';
const RATE_KEY = 'nct.runRate.v1';
const MAX_RUNS = 6;

/** Every distinct deck (tournament "-eor" builds share their base deck's main list, so they are skipped). */
function distinct(lib: readonly LibraryDeck[]) {
  const seen = new Set<string>();
  return lib.filter((d) => {
    if (/-eor\.txt$/.test(d.file)) return false;
    const sig = [...d.deck.legends].sort().join(',') + '|' + [...d.deck.main].sort().join(',');
    if (seen.has(sig) || seen.has(`n:${d.deck.name}`)) return false;
    seen.add(sig);
    seen.add(`n:${d.deck.name}`);
    return true;
  });
}
/** The setup link's field presets (f=…), kept so old links still open with their field. */
function presetFiles(key: FieldKey, pool: readonly LibraryDeck[]): string[] {
  if (key === 'all') return pool.map((d) => d.file);
  if (key === 'top16') {
    const byName = new Map(pool.map((d) => [d.deck.name, d.file]));
    const top = RATINGS.decks.map((r) => byName.get(r.name)).filter((f): f is string => !!f);
    return (top.length >= 8 ? top : pool.filter((d) => d.kind === 'meta' || d.kind === 'original').map((d) => d.file)).slice(0, 16);
  }
  if (key === 'custom') return [];
  return pool.filter((d) => d.kind === key).map((d) => d.file);
}

// ---------------------------------------------------------------- saved runs (this browser)
function loadRuns(): TourneyEvent[] {
  try {
    return parseRuns(localStorage.getItem(SAVE_KEY));
  } catch {
    return [];
  }
}
/** A run as it is saved: no live flags (a stopped run's last match is not "now playing"). */
const settled = (ev: TourneyEvent): TourneyEvent => {
  const off = <T extends { matches: { live?: boolean }[] }>(r: T): T => ({ ...r, matches: r.matches.map((m) => ({ ...m, live: false })) });
  return JSON.parse(JSON.stringify({ ...ev, rounds: ev.rounds.map(off), bracket: ev.bracket.map(off) })) as TourneyEvent;
};
function saveRun(ev: TourneyEvent) {
  try {
    const runs = [settled(ev), ...loadRuns().filter((r) => r.id !== ev.id)].slice(0, MAX_RUNS);
    localStorage.setItem(SAVE_KEY, JSON.stringify(runs));
  } catch {
    /* storage full or blocked: the run is still on screen and can be downloaded */
  }
}
function forgetRun(id: TourneyEvent['id']) {
  try {
    const runs = loadRuns().filter((r) => r.id !== id);
    if (runs.length) localStorage.setItem(SAVE_KEY, JSON.stringify(runs));
    else localStorage.removeItem(SAVE_KEY);
  } catch {
    /* blocked storage: nothing was saved either */
  }
}
/** Games per second per worker thread from the last finished run, by bot (the time estimate uses it). */
function loadRate(bot: string): number | null {
  try {
    const v = (JSON.parse(localStorage.getItem(RATE_KEY) ?? '{}') as Record<string, unknown>)[bot];
    return typeof v === 'number' && v > 0 && Number.isFinite(v) ? v : null;
  } catch {
    return null;
  }
}
function saveRate(bot: string, rate: number) {
  try {
    const all = JSON.parse(localStorage.getItem(RATE_KEY) ?? '{}') as Record<string, number>;
    localStorage.setItem(RATE_KEY, JSON.stringify({ ...all, [bot]: rate }));
  } catch {
    /* fine: the estimate falls back to the built-in pace */
  }
}

/** A paused round-by-round run: where it stopped and what the owner is setting for the next step. */
interface Pause {
  step: RoundStep;
  pairs: ForcedPair[];
  seeds: string[];
}

export function TournamentRunnerPage({ q }: { q: URLSearchParams }) {
  const lib = useLib();
  const pool = useMemo(() => distinct(allDecks()), []);
  const byFile = useMemo(() => new Map(pool.map((d) => [d.file, d])), [pool]);
  // setup-link params are validated; anything malformed falls back to the defaults
  const params = useMemo(() => parseRunParams(q, BOTS.map((b) => b.key)), [q]);
  const [draft, setDraft] = useState<EventDraft>(() => ({
    ...DEFAULT_DRAFT,
    entrants: entrantsFromList(params.decks ?? presetFiles(params.field, pool)),
    format: params.format,
    rounds: params.rounds,
    top: params.top,
    bestOf: params.bestOf,
  }));
  const set = <K extends keyof EventDraft>(k: K, v: EventDraft[K]) => setDraft((d) => ({ ...d, [k]: v }));
  const [runMode, setRunMode] = useState<'all' | 'rounds'>('all');
  const [bot, setBot] = useState<BotLevel>((params.bot as BotLevel | null) ?? 'medium');
  const [seed, setSeed] = useState(params.seed ?? Math.floor(Math.random() * 9000) + 1000);
  const [threads, setThreads] = useState(defaultThreads());

  const [ev, setEv] = useState<TourneyEvent | null>(null);
  const [running, setRunning] = useState(false);
  const [t0, setT0] = useState(0);
  const [, tick] = useState(0);
  const [match, setMatch] = useState<(MatchView & { games: GameRec[] }) | null>(null);
  const [runs, setRuns] = useState<TourneyEvent[]>(loadRuns);
  /** why the last run ended early: stopped by you, or a game failed (with its error) */
  const [ended, setEnded] = useState<{ kind: 'stopped' | 'failed'; error?: string } | null>(null);
  const [fileMsg, setFileMsg] = useState('');
  const [linkMsg, setLinkMsg] = useState('');
  const [pause, setPause] = useState<Pause | null>(null);
  const waiter = useRef<((x: RoundInput | void) => void) | null>(null);
  const poolRun = usePoolRun();
  const stopRef = useRef(false);
  const frame = useRef(0);
  useEffect(() => {
    if (!running || pause) return;
    const t = setInterval(() => tick((x) => x + 1), 1000);
    return () => clearInterval(t);
  }, [running, pause]);

  const roundByRound = runMode === 'rounds';
  const plan = draftSetup(draft, byFile, { roundByRound });
  const allNames = draft.entrants.map((e) => entrantName(byFile.get(e.file), e)).filter(Boolean);
  const n = plan.setup.entrants.length;
  const usedNames = plan.setup.entrants.map((e) => e.name);
  const cut = draft.format === 'swiss' ? cutSize(draft.top, n) : 0;
  const bp = bracketPlan(plan.setup, n);
  const canStart = !running && plan.problems.length === 0 && n >= 2;

  /** Play an event: a new one, or a saved one resumed (its finished games are reused, the rest played). */
  const launch = async (o: { decks: (TourneyEvent['decks'][string] & { name: string })[]; cfg: TourneyConfig; setup?: EventSetup; id: TourneyEvent['id']; saved?: TourneyEvent }) => {
    const gp = poolRun.open(threads);
    stopRef.current = false;
    setRunning(true);
    const started = Date.now();
    setT0(started);
    setMatch(null);
    setEnded(null);
    setPause(null);
    const play = resumePlay(gp.play, o.saved);
    let last: TourneyEvent | null = null;
    const show = (e: TourneyEvent) => {
      last = e;
      cancelAnimationFrame(frame.current);
      frame.current = requestAnimationFrame(() => setEv({ ...e }));
    };
    const byRound = roundByRound;
    const beforeRound = (step: RoundStep): Promise<RoundInput | void> | RoundInput | void => {
      // a resumed run goes straight through the points the saved run had passed, with its choices
      if (o.saved && reachedBefore(o.saved, step)) return step.stage === 'cut' && o.saved.seeds ? { seeds: o.saved.seeds } : undefined;
      if (!byRound) return undefined;
      const playedAny = [...step.event.rounds, ...step.event.bracket].some((r) => r.matches.some((m) => m.games.length > 0));
      if (!playedAny && step.stage !== 'cut') return undefined; // the first round: Start was the go
      // progress is saved at every pause, so closing the page here loses nothing
      saveRun({ ...step.event, phase: 'stopped' });
      setRuns(loadRuns());
      cancelAnimationFrame(frame.current);
      setEv({ ...step.event });
      return new Promise((resolve) => {
        waiter.current = resolve;
        setPause({ step, pairs: [], seeds: step.seeds ?? [] });
      });
    };
    try {
      const out = await runTournament(
        o.decks.map((d) => ({ name: d.name, legends: d.legends, main: d.main, sideboard: d.sideboard ?? [], file: d.file })),
        o.cfg,
        play,
        { onUpdate: show, shouldStop: () => stopRef.current, id: o.id, setup: o.setup, beforeRound },
      );
      cancelAnimationFrame(frame.current);
      setEv(out);
      if (out.phase === 'stopped') setEnded({ kind: 'stopped' });
      saveRun(out);
      setRuns(loadRuns());
      const fresh = (out.progress?.games ?? 0) - play.reused();
      const secs = (Date.now() - started) / 1000;
      if (out.phase === 'done' && fresh >= 10 && secs > 1) saveRate(o.cfg.bot, fresh / secs / gp.size);
    } catch (err) {
      cancelAnimationFrame(frame.current);
      // Stop terminates the pool (games reject as stopped); anything else means a game threw — never count it as a tie.
      const stopped = stopRef.current || isStopped(err);
      setEnded(stopped ? { kind: 'stopped' } : { kind: 'failed', error: errorText(err) });
      const snap = last as TourneyEvent | null;
      if (snap) {
        const st = settled({ ...snap, phase: 'stopped' });
        setEv(st);
        saveRun(st);
        setRuns(loadRuns());
      }
    } finally {
      poolRun.close(gp);
      waiter.current = null;
      setPause(null);
      setRunning(false);
    }
  };

  const start = () => {
    if (!canStart) return;
    const s = plan.setup;
    const cfg: TourneyConfig = { name: `${EVENT_FORMATS.find((f) => f.key === s.format)?.label} · ${n} decks`, rounds: s.rounds ?? 0, top: s.top ?? 0, bestOf: s.bestOf, bot, seed };
    void launch({ decks: plan.decks, cfg, setup: isPlainSetup(s) ? undefined : s, id: `run-${Date.now().toString(36)}` });
  };
  const resume = (saved: TourneyEvent) => {
    if (!saved.config) return setFileMsg('This run was saved before runs could be resumed.');
    const order = saved.setup?.entrants.map((e) => e.name) ?? Object.keys(saved.decks);
    const decks = order.flatMap((name) => {
      const d = saved.decks[name];
      return d ? [{ ...d, name }] : [];
    });
    void launch({ decks, cfg: saved.config, setup: saved.setup, id: saved.id, saved });
  };
  const go = () => {
    const p = pause;
    const w = waiter.current;
    if (!p || !w) return;
    waiter.current = null;
    setPause(null);
    setT0(Date.now());
    w(p.step.stage === 'swiss' ? (p.pairs.length ? { pairs: p.pairs } : undefined) : p.step.stage === 'cut' ? { seeds: p.seeds } : undefined);
  };
  const stop = () => {
    stopRef.current = true;
    poolRun.stop();
    const w = waiter.current;
    waiter.current = null;
    setPause(null);
    w?.();
  };

  const shareLink = () => {
    const p = new URLSearchParams({ f: 'custom', d: entrantsToList(draft.entrants).join(','), fmt: draft.format, t: String(draft.top), bo: String(draft.bestOf), bot, s: String(seed) });
    if (draft.rounds !== 'auto') p.set('r', String(draft.rounds));
    const url = `${location.origin}${location.pathname}#/run?${p}`;
    navigator.clipboard?.writeText(url).catch(() => undefined);
    setLinkMsg('Setup link copied. It carries the entrants and options; pairings, brackets and match lists set by hand are saved with the run instead.');
  };
  const downloadEvent = () => ev && download(`tournament-${ev.id}.json`, JSON.stringify(ev), 'application/json');
  const load = (file: File) =>
    file.text().then((t) => {
      let e: TourneyEvent | null = null;
      try {
        e = toEvent(JSON.parse(t));
      } catch {
        /* not JSON */
      }
      if (!e) return setFileMsg(`“${file.name}” isn't a tournament event file this page can read.`);
      setFileMsg('');
      setEnded(null);
      setMatch(null);
      setEv({ ...e, phase: e.phase ?? 'done' });
    });

  const elapsed = running && !pause ? (Date.now() - t0) / 1000 : 0;
  const prog = ev?.progress;
  const frac = prog ? Math.min(1, prog.games / Math.max(1, prog.estimate)) : 0;
  const rate = elapsed > 0 && prog ? prog.games / elapsed : 0;
  const kind = ev?.setup?.format ?? 'swiss';
  const evN = ev ? Object.keys(ev.decks).length : 0;
  const evSlots = ev ? (ev.bracket[0] ? ev.bracket[0].matches.length * 2 : ev.setup ? bracketPlan(ev.setup, evN).slots : cutSize(ev.config?.top ?? 0, evN)) : 0;
  const liveMatches = ev ? [...(ev.bracket[ev.bracket.length - 1]?.matches ?? []), ...(ev.phase === 'swiss' || ev.phase === 'rounds' ? ev.rounds.flatMap((r) => r.matches) : [])].filter((m) => m.live) : [];
  const open = (m: MatchView) => m.games?.length && setMatch(m as MatchView & { games: GameRec[] });
  const stageText = (e: TourneyEvent) => {
    if (e.phase === 'swiss') return `Swiss round ${e.rounds.length} of ${e.config?.rounds}`;
    if (e.phase === 'rounds') return `Round ${Math.min(e.rounds.length, e.rounds.filter((r) => r.matches.some((m) => m.games.length)).length || 1)} of ${e.rounds.length}`;
    return `Bracket: ${e.bracket[e.bracket.length - 1]?.name ?? 'starting'}`;
  };
  const measured = loadRate(bot);

  return (
    <div className="grid">
      <PageHead
        kicker="Tournaments"
        title="Run a tournament"
        actions={
          <a href="#/tournaments" className="btn">
            Recorded events →
          </a>
        }
      >
        Set up an event and watch it play out: Swiss rounds and a top cut, a bracket you arrange, a round robin, or exactly the matches you list. Pair any round by
        hand, run it all at once or round by round. Games run in parallel in your browser with the same engine and bots as the{' '}
        <span title="For the site owner: npm run tournament">recorded events</span>, and
        every finished match can be replayed exactly. Runs stay in this browser; they never feed the recorded ratings.
      </PageHead>

      {!running && (
        <div className="panel grid ev-setup">
          <h2 style={{ margin: 0 }}>Set up the event</h2>
          <fieldset className="ev-step">
            <legend>1 · Entrants</legend>
            <EntrantPicker pool={pool} entrants={draft.entrants} onChange={(e) => set('entrants', e)} />
            <p className="small" role="status" aria-live="polite" style={{ margin: 0 }}>
              {fieldNote(plan.setup)}
              {plan.unused.length > 0 && <span className="muted"> Not in any match (left out): {plan.unused.join(', ')}.</span>}
            </p>
          </fieldset>

          <fieldset className="ev-step">
            <legend>2 · Format</legend>
            <div className="seg" role="group" aria-label="Format">
              {EVENT_FORMATS.map((f) => (
                <button key={f.key} type="button" className={draft.format === f.key ? 'on' : ''} aria-pressed={draft.format === f.key} title={f.hint} onClick={() => set('format', f.key as EventFormat)}>
                  {f.label}
                </button>
              ))}
            </div>
            <p className="muted small" style={{ margin: 0 }}>
              {EVENT_FORMATS.find((f) => f.key === draft.format)?.hint}
            </p>
            <div className="row small">
              <label className="row muted">
                {draft.format === 'matches' ? 'Default best of' : 'Best of'}
                <select value={draft.bestOf} onChange={(e) => set('bestOf', +e.target.value as BestOf)}>
                  {BEST_OF.map((b) => (
                    <option key={b} value={b}>
                      Bo{b}
                    </option>
                  ))}
                </select>
              </label>
              {draft.format === 'swiss' && (
                <>
                  <label className="row muted">
                    Swiss rounds
                    <select value={draft.rounds} onChange={(e) => set('rounds', e.target.value === 'auto' ? 'auto' : +e.target.value)}>
                      <option value="auto">auto ({autoRounds(n)})</option>
                      {Array.from({ length: 12 }, (_, i) => i + 1).map((x) => (
                        <option key={x} value={x}>
                          {x}
                        </option>
                      ))}
                    </select>
                  </label>
                  <label className="row muted">
                    Top cut
                    <select value={draft.top} onChange={(e) => set('top', +e.target.value)}>
                      {[0, 2, 4, 8, 16].map((x) => (
                        <option key={x} value={x}>
                          {x ? `Top ${x}` : 'None'}
                        </option>
                      ))}
                    </select>
                  </label>
                  {cut > 0 && (
                    <label className="row muted">
                      Top-cut seeds
                      <select value={draft.cutSeeding} onChange={(e) => set('cutSeeding', e.target.value as EventDraft['cutSeeding'])}>
                        <option value="standings">by the standings</option>
                        <option value="manual">set by hand</option>
                      </select>
                    </label>
                  )}
                </>
              )}
              {draft.format === 'round-robin' && (
                <>
                  <label className="row muted">
                    Each pairing
                    <select value={draft.times} onChange={(e) => set('times', +e.target.value)}>
                      {[1, 2, 3, 4, 5, 10].map((x) => (
                        <option key={x} value={x}>
                          ×{x}
                        </option>
                      ))}
                    </select>
                  </label>
                  {draft.times > 1 && (
                    <label className="row muted">
                      <input type="checkbox" checked={draft.mirror} onChange={(e) => set('mirror', e.target.checked)} /> mirror the seats on repeats
                    </label>
                  )}
                  <label className="row muted">
                    Groups
                    <select value={draft.groups} onChange={(e) => set('groups', +e.target.value)}>
                      {Array.from({ length: Math.max(1, Math.min(8, Math.floor(n / 2))) }, (_, i) => i + 1).map((x) => (
                        <option key={x} value={x}>
                          {x === 1 ? 'one table' : `${x} groups`}
                        </option>
                      ))}
                    </select>
                  </label>
                  {draft.groups > 1 && (
                    <label className="row muted">
                      To the bracket
                      <select value={draft.advance} onChange={(e) => set('advance', +e.target.value)}>
                        {[0, 1, 2, 3, 4].map((x) => (
                          <option key={x} value={x}>
                            {x ? `top ${x} per group` : 'none (groups only)'}
                          </option>
                        ))}
                      </select>
                    </label>
                  )}
                </>
              )}
              {draft.format === 'single-elim' && (
                <div className="seg" role="group" aria-label="Bracket arrangement">
                  <button type="button" className={draft.slots ? '' : 'on'} aria-pressed={!draft.slots} onClick={() => set('slots', null)} title="Entrants in seed order; byes go to the top seeds">
                    Seed order
                  </button>
                  <button type="button" className={draft.slots ? 'on' : ''} aria-pressed={!!draft.slots} onClick={() => set('slots', draft.slots ?? seededSlots(usedNames))} title="Place every deck (and bye) yourself">
                    Slot by slot
                  </button>
                </div>
              )}
            </div>
            {bp.slots >= 2 && <BracketBoEditor slots={bp.slots} values={draft.bracketBo} bestOf={draft.bestOf} onChange={(v) => set('bracketBo', v)} />}
            {draft.format === 'swiss' && draft.cutSeeding === 'manual' && cut > 0 && (
              <div className="ev-sub">
                {roundByRound ? (
                  <p className="small muted" style={{ margin: 0 }}>
                    Round by round: when the Swiss rounds end, the run pauses so you can order the top-cut seeds (it starts from the standings).
                  </p>
                ) : (
                  <>
                    <div className="pb-label">Top-cut seeds, best first (fixed before play)</div>
                    <SeedOrderEditor candidates={usedNames} seeds={draft.cutSeeds} size={cut} onChange={(s) => set('cutSeeds', s)} />
                  </>
                )}
              </div>
            )}
            {draft.format === 'swiss' && n >= 2 && (
              <details className="ev-sub" open={draft.pairings.length > 0 || undefined}>
                <summary className="small">Set round-1 pairings by hand{draft.pairings.length ? ` (${draft.pairings.length} set)` : ''}</summary>
                <PairingEditor names={usedNames} pairs={draft.pairings} onChange={(p) => set('pairings', p)} />
                {roundByRound ? (
                  <p className="small muted">Later rounds: the run pauses before each one so you can pair it too.</p>
                ) : (
                  <p className="small muted">To pair later rounds as well, run round by round (step 4).</p>
                )}
              </details>
            )}
            {draft.format === 'single-elim' && draft.slots && (
              <div className="ev-sub">
                <BracketSlotsEditor names={usedNames} slots={draft.slots} onChange={(s) => set('slots', s)} />
              </div>
            )}
            {draft.format === 'matches' && (
              <div className="ev-sub">
                <MatchListEditor names={allNames} matches={draft.matches} bestOf={draft.bestOf} onChange={(m) => set('matches', m)} />
              </div>
            )}
          </fieldset>

          <fieldset className="ev-step">
            <legend>3 · Series and bots</legend>
            <div className="row small">
              <label className="row muted" title="Who is on the play in game 1 of every series">
                Game 1 on the play
                <select value={draft.game1} onChange={(e) => set('game1', e.target.value as EventDraft['game1'])}>
                  {GAME1_RULES.map((r) => (
                    <option key={r.key} value={r.key}>
                      {r.label}
                    </option>
                  ))}
                </select>
              </label>
              <label className="row muted" title="Who is on the play in games 2+">
                Later games
                <select value={draft.next} onChange={(e) => set('next', e.target.value as EventDraft['next'])}>
                  {NEXT_RULES.map((r) => (
                    <option key={r.key} value={r.key}>
                      {r.label}
                    </option>
                  ))}
                </select>
              </label>
              <label className="row muted">
                Bots
                <select value={bot} onChange={(e) => setBot(e.target.value as BotLevel)}>
                  {BOTS.map((b) => (
                    <option key={b.key} value={b.key} title={b.blurb}>
                      {b.label}
                    </option>
                  ))}
                </select>
              </label>
              <label className="row muted" title="Same seed + same setup = the same event">
                Seed
                <input type="number" value={seed} onChange={(e) => setSeed(+e.target.value || 1)} style={{ width: 90 }} />
              </label>
              <label className="row muted" title="Parallel game workers">
                Threads
                <select value={threads} onChange={(e) => setThreads(+e.target.value)}>
                  {Array.from({ length: Math.max(8, defaultThreads()) }, (_, i) => i + 1).map((x) => (
                    <option key={x}>{x}</option>
                  ))}
                </select>
              </label>
            </div>
          </fieldset>

          <fieldset className="ev-step">
            <legend>4 · The plan</legend>
            {n >= 2 && plan.problems.length === 0 ? <PlanPreview setup={plan.setup} seed={seed} lib={lib} /> : <p className="muted small">The pairings or bracket show here once the event can run.</p>}
            <div className="row small">
              <span className="muted">Run</span>
              <div className="seg" role="group" aria-label="Run control">
                <button type="button" className={runMode === 'all' ? 'on' : ''} aria-pressed={runMode === 'all'} onClick={() => setRunMode('all')}>
                  All at once
                </button>
                <button type="button" className={runMode === 'rounds' ? 'on' : ''} aria-pressed={runMode === 'rounds'} onClick={() => setRunMode('rounds')} title="Pause after every round to read the standings and set the next pairings">
                  Round by round
                </button>
              </div>
            </div>
            {plan.problems.length > 0 && n > 0 && (
              <ul className="ev-problems small" aria-live="polite">
                {plan.problems.map((p) => (
                  <li key={p}>⚠ {p}</li>
                ))}
              </ul>
            )}
            <p className="small" role="status" aria-live="polite" style={{ margin: 0 }}>
              {n < 2 ? 'Pick at least 2 entrants.' : plan.problems.length ? '' : planText(plan.setup, bot, threads, measured)}
            </p>
            <div className="row">
              <button className="primary" onClick={start} disabled={!canStart}>
                ▶ Start {roundByRound ? 'round 1' : 'the event'}
              </button>
              <button onClick={shareLink}>Copy setup link</button>
              {linkMsg && <span className="muted small">{linkMsg}</span>}
            </div>
          </fieldset>
        </div>
      )}

      {(runs.length > 0 || !running) && (
        <div className="row small">
          {runs.length > 0 && <span className="muted">Your recent runs:</span>}
          {runs.map((r) => (
            <span key={String(r.id)} className="ev-run">
              <button className={`event-chip ${ev?.id === r.id ? 'on' : ''}`} aria-pressed={ev?.id === r.id} onClick={() => !running && (setEnded(null), setMatch(null), setEv(r))} disabled={running}>
                <b>{r.champion ? `🏆 ${r.champion}` : r.phase === 'done' ? 'finished' : '⏸ unfinished'}</b>
                <span>
                  {r.name ?? r.format}
                  {r.custom ? ' · custom' : ''}
                </span>
                <RecordedAt iso={r.date} className="muted" />
              </button>
              {r.phase !== 'done' && r.config && (
                <button className="small" onClick={() => resume(r)} disabled={running} title="Carry on from where it stopped (finished games are kept)">
                  ▶ Resume
                </button>
              )}
              <button
                className="ghost small"
                aria-label={`Forget the run ${r.name ?? r.id}`}
                title="Remove from this browser"
                disabled={running}
                onClick={() => {
                  forgetRun(r.id);
                  setRuns(loadRuns());
                  if (ev?.id === r.id) setEv(null);
                }}
              >
                ✕
              </button>
            </span>
          ))}
          {/* the input is visually hidden but still focusable, so the label works from the keyboard too */}
          <label className="muted file-pick">
            <input type="file" className="sr-only" accept="application/json,.json" onChange={(e) => e.target.files?.[0] && load(e.target.files[0])} />
            📂 Open event file
          </label>
          {fileMsg && <span style={{ color: 'var(--red)' }}>{fileMsg}</span>}
        </div>
      )}

      {ev && (
        <>
          <div className="panel flair">
            <div className="spread">
              <h2 style={{ margin: 0 }}>
                {ev.name ?? `Event ${ev.id}`} {ev.custom && <span className="tag ev-set">custom</span>}
              </h2>
              <span className="muted small">
                {ev.format} · {tierLabel(ev.bot)} bots{ev.config ? ` · seed ${ev.config.seed}` : ''}
                {(ev.phase === 'done' || ev.phase === 'stopped') && <RecordedAt iso={ev.date} prefix=" · recorded " />}
              </span>
            </div>
            {arrangedNote(ev.setup) && <p className="small muted" style={{ margin: '4px 0 0' }}>{arrangedNote(ev.setup)}</p>}
            {running && prog && (
              <div className="run-progress">
                <div className="bar">
                  <div style={{ width: `${Math.round(frac * 100)}%` }} />
                </div>
                <span className="small muted" role="status" aria-live="polite">
                  {pause ? 'Paused' : stageText(ev)} · {prog.games} / ~{prog.estimate} games{pause ? '' : ` · ${rate ? `${rate.toFixed(1)} games/s` : 'starting…'}`}
                </span>
              </div>
            )}
            {running && (
              <div className="row" style={{ marginTop: 6 }}>
                <button onClick={stop}>■ Stop{pause ? ' and save' : ''}</button>
                <span className="muted small">Stopped runs are saved here and can be resumed.</span>
              </div>
            )}
            {pause && <PausePanel pause={pause} ev={ev} onChange={setPause} onGo={go} />}
            {ev.phase === 'stopped' &&
              !running &&
              (ended?.kind === 'failed' ? (
                <p className="small" style={{ color: 'var(--red)' }}>
                  ⚠ The tournament was abandoned because a game failed: {ended.error}. Finished matches can still be watched.
                </p>
              ) : (
                <p className="muted small">{ended?.kind === 'stopped' ? 'Stopped by you.' : 'Stopped early.'} Finished matches can still be watched, and “Resume” carries on from here.</p>
              ))}
            {ev.champion && ev.phase === 'done' && <Champion name={ev.champion} lib={lib} note={championNote(ev, evSlots)} list={ev.decks[ev.champion]} />}
            {liveMatches.length > 0 && (
              <div>
                <div className="pb-label">Now playing</div>
                <div className="round-list">
                  {liveMatches.map((m, k) => (
                    <button key={k} className="match-row live" onClick={() => open(m)} disabled={!m.games.length}>
                      <span>{m.a}</span>
                      <b>
                        {m.score[0]}–{m.score[1]}
                      </b>
                      <span>{m.b}</span>
                    </button>
                  ))}
                </div>
              </div>
            )}
            {evSlots >= 2 && (ev.bracket.length > 0 || ev.phase !== 'done') && (
              <div className="ev-bracket-wrap">
                <Bracket rounds={ev.bracket} size={evSlots} seeds={ev.seeds ?? []} champion={ev.champion} lib={lib} onOpen={open} />
              </div>
            )}
          </div>

          {ev.phase === 'done' && <EventSummary ev={ev} />}

          <div className="grid cols-2">
            <div className="panel scroll-x">
              <div className="spread">
                <h3 style={{ marginTop: 0 }}>{standingsTitle(kind, ev.phase === 'done')}</h3>
                {!running && (
                  <button className="ghost small" onClick={downloadEvent}>
                    ⬇ Download JSON
                  </button>
                )}
              </div>
              {ev.groups ? <GroupTables groups={ev.groups} rows={ev.standings} advance={ev.setup?.advance ?? 0} lib={lib} /> : <StandingsTable rows={ev.standings} cut={kind === 'swiss' ? evSlots : 0} lib={lib} full />}
            </div>
            <div className="panel">
              <h3 style={{ marginTop: 0 }}>Rounds</h3>
              {ev.rounds.length ? <RoundList rounds={ev.rounds} onOpen={open} openLast={running} /> : <p className="muted small">{kind === 'single-elim' ? 'A bracket only: every match is in the bracket above.' : 'No rounds yet.'}</p>}
            </div>
          </div>
        </>
      )}
      {match && ev && <MatchModal m={match} decks={ev.decks} bot={ev.bot} lib={lib} onClose={() => setMatch(null)} />}
    </div>
  );
}

const championNote = (ev: TourneyEvent, slots: number) => {
  const kind = ev.setup?.format ?? 'swiss';
  if (kind === 'round-robin') return ev.bracket.length ? 'won the bracket after the groups' : 'top of the round-robin table';
  if (kind === 'single-elim') return `won a bracket of ${slots}`;
  return slots ? `won the top ${ev.seeds?.length ?? slots}` : 'top of the Swiss standings';
};

/** The pause between rounds: read the standings, set the coming round's pairings (Swiss) or the top-cut seeds. */
function PausePanel({ pause, ev, onChange, onGo }: { pause: Pause; ev: TourneyEvent; onChange: (p: Pause) => void; onGo: () => void }) {
  const { step } = pause;
  const names = Object.keys(ev.decks);
  const opps = new Map(ev.standings.map((s) => [s.deck, new Set(s.opps)]));
  const met = (a: string, b: string) => opps.get(a)?.has(b) ?? false;
  const problems =
    step.stage === 'swiss'
      ? forcedPairProblems(names, pause.pairs, met)
      : step.stage === 'cut'
        ? pause.seeds.length < 2 || (pause.seeds.length & (pause.seeds.length - 1)) !== 0
          ? [`a top cut needs 2, 4, 8 or 16 seeds (you have ${pause.seeds.length})`]
          : []
        : [];
  const what = step.stage === 'swiss' ? `Swiss round ${step.round} of ${step.of}` : step.stage === 'cut' ? 'the top cut' : step.stage === 'bracket' ? `bracket round ${step.round} of ${step.of}` : `round ${step.round} of ${step.of}`;
  return (
    <section className="ev-pause" aria-label="Paused between rounds">
      <h3 style={{ margin: '0 0 4px' }}>Paused: {what} is next</h3>
      <p className="small muted" style={{ margin: 0 }}>
        The standings below are up to date. Progress is saved in this browser.
      </p>
      {step.stage === 'swiss' && (
        <PairingEditor names={names} pairs={pause.pairs} met={met} onChange={(pairs) => onChange({ ...pause, pairs })} />
      )}
      {step.stage === 'cut' && (
        <>
          <div className="pb-label">Top-cut seeds, best first (from the standings; reorder or swap in other decks)</div>
          <SeedOrderEditor candidates={ev.standings.map((s) => s.deck)} seeds={pause.seeds} size={step.seeds?.length ?? pause.seeds.length} onChange={(seeds) => onChange({ ...pause, seeds })} />
        </>
      )}
      {problems.length > 0 && (
        <ul className="ev-problems small">
          {problems.map((p) => (
            <li key={p}>⚠ {p}</li>
          ))}
        </ul>
      )}
      <div className="row" style={{ marginTop: 6 }}>
        <button className="primary" onClick={onGo} disabled={problems.length > 0}>
          ▶ Play {what}
        </button>
      </div>
    </section>
  );
}

/** The event as planned before a game is played: round 1 (Swiss), the bracket, the round-robin schedule or the match list. */
function PlanPreview({ setup, seed, lib }: { setup: EventSetup; seed: number; lib: ReturnType<typeof useLib> }) {
  const names = setup.entrants.map((e) => e.name);
  const none = () => undefined;
  const view = (a: string, b: string | null, extra: Partial<MatchView> = {}): MatchView => ({ a, b, score: [0, 0], winner: b ? '' : a, ...extra });
  if (setup.format === 'swiss') {
    const r1 = swissRound1(names, seed, setup.pairings?.[1] ?? []);
    const c = setup.cutSeeds?.length || cutSize(setup.top ?? 0, names.length);
    return (
      <div className="grid">
        <RoundList rounds={[{ round: 1, matches: r1.map((m) => view(m.a, m.b, m.set ? { set: true } : {})) }]} onOpen={none} openFirst />
        <p className="small muted" style={{ margin: 0 }}>
          Round 1 exactly as it will be paired with seed {seed}. Rounds 2–{setup.rounds} are paired by record as results come in{c ? `, then the top ${c} play a bracket` : ''}.
        </p>
      </div>
    );
  }
  if (setup.format === 'single-elim') {
    const slots = setup.bracket ?? seededSlots(names);
    const first = Array.from({ length: slots.length / 2 }, (_, k) => {
      const a = slots[2 * k] ?? null;
      const b = slots[2 * k + 1] ?? null;
      return a === null ? view(b ?? '', null) : view(a, b);
    });
    return (
      <div className="ev-bracket-wrap">
        <Bracket rounds={[{ name: roundName(slots.length), matches: first }]} size={slots.length} seeds={setup.bracket ? [] : names} champion={null} lib={lib} onOpen={none} />
      </div>
    );
  }
  if (setup.format === 'round-robin') {
    const groups = groupSplit(names, setup.groups ?? 1);
    const scheds = groups.map((g) => roundRobinSchedule(g, setup.times ?? 1, setup.mirror ?? false));
    const len = Math.max(0, ...scheds.map((s) => s.length));
    const rounds = Array.from({ length: len }, (_, ri) => ({ round: ri + 1, matches: scheds.flatMap((s) => s[ri] ?? []).map((x) => view(x.a, x.b)) }));
    return (
      <div className="grid">
        {groups.length > 1 && (
          <ul className="small ev-groups">
            {groups.map((g, i) => (
              <li key={i}>
                <b>{groupName(i)}:</b> {g.join(', ')}
              </li>
            ))}
          </ul>
        )}
        <RoundList rounds={rounds} onOpen={none} openFirst />
      </div>
    );
  }
  const rounds = expandMatchList(setup.matches ?? [], setup.bestOf).map((r) => ({ round: r.round, matches: r.matches.map((m) => view(m.a, m.b, m.bestOf !== setup.bestOf ? { bestOf: m.bestOf } : {})) }));
  return <RoundList rounds={rounds} onOpen={none} openFirst />;
}

/** End-of-event numbers: games, first-player edge, upsets, best and worst records. */
function EventSummary({ ev }: { ev: TourneyEvent }) {
  const all = [...ev.rounds.flatMap((r) => r.matches), ...ev.bracket.flatMap((r) => r.matches)].filter((m) => m.b);
  const games = all.flatMap((m) => m.games);
  const firstWins = games.filter((g) => g.winner !== 'tie' && g.winner === g.first).length;
  const decided = games.filter((g) => g.winner !== 'tie').length;
  const seeds = ev.seeds ?? [];
  const upsets = ev.bracket.flatMap((r) => r.matches).filter((m) => m.b && seeds.indexOf(m.winner) > seeds.indexOf(m.winner === m.a ? m.b : m.a)).length;
  const series = all.filter((m) => (m.bestOf ?? ev.config?.bestOf ?? 3) > 1);
  const sweep = series.filter((m) => m.games.length > 1 && Math.min(...m.score) === 0 && m.games.every((g) => g.winner !== 'tie')).length;
  const avgTurns = games.length ? games.reduce((a, g) => a + g.turns, 0) / games.length : 0;
  const best = [...ev.standings].sort((a, b) => b.playW + b.drawW - (a.playW + a.drawW) || a.games - b.games)[0];
  return (
    <div className="dp-tiles">
      <StatTile value={games.length} label="games played" />
      <StatTile value={decided ? `${Math.round((100 * firstWins) / decided)}%` : '—'} label="won by the player going first" />
      <StatTile value={avgTurns.toFixed(1)} label="average turns per game" />
      {series.length > 0 && <StatTile value={`${Math.round((100 * sweep) / series.length)}%`} label="series won without dropping a game" />}
      {seeds.length > 0 && ev.bracket.length > 0 && <StatTile value={upsets} label="bracket upsets (lower seed won)" />}
      {best && <StatTile value={best.playW + best.drawW} label={`most game wins: ${best.deck}`} />}
    </div>
  );
}
