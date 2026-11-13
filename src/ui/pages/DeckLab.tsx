// Deck Lab: submit a deck to be tuned for the meta, or breed new decks — all in the browser, using the trainer's own
// methods (forge swaps confirmed on fresh games; data-driven breeding). Results can be saved to "My decks".
import { useEffect, useMemo, useRef, useState } from 'react';
import { IfPage } from '../components/SiteChrome';
import { allDecks, upsertCustom } from '../../lib/browserLibrary';
import type { LibraryDeck } from '../../lib/library';
import { exportOfficial, listFingerprint, parseDeck, validateDeck } from '../../engine/deck';
import { CARD_BY_ID } from '../../engine/cards';
import type { CardDef, DeckList } from '../../engine/types';
import {
  breedInBrowser,
  finalVsOriginal,
  loadH2H,
  partialTune,
  playSet,
  recordedEventCount,
  tunedName,
  tuneDeck,
  tunePlan,
  tuneSummaryText,
  vsOriginalGames,
  vsOriginalVerdict,
  type H2HInfo,
  type TuneLog,
  type TuneProgress,
} from '../../lib/deckLab';
import { manifestTune, tunedRecord } from '../../lib/tuneRecord';
import { adoptionProvenance, describeRule, formatGain, stoppedWords, type AdoptionRule } from '../../lib/evidence';
import { LAB_GAME_BUDGET } from '../../lib/deckSearch';
import { CutTable, DepthControls, NomineeTable, OutcomeChip, PairedGain, TuneTrajectory } from '../components/LabEvidence';
import { gameRunManifest, manifestDeck, type RunManifest } from '../../lib/runManifest';
import { SIM_VERSION, type PlayGame } from '../../lib/tournament';
import { RunDetails } from '../components/RunDetails';
import type { Bred } from '../../ai/breeder';
import { errorText, isStopped } from '../../sim/pool';
import { usePoolRun } from '../usePoolRun';
import { customSaveName } from '../deckLookup';
import { DeckPicker, findDeck } from '../components/DeckPicker';
import { DeckTile } from '../components/DeckIdentity';
import { Signed, Wr } from '../components/Num';
import { RATINGS } from '../../data/index';
import { Markdown } from '../components/Markdown';
import { PageHead } from '../components/PageHead';
import { CardNameButton, CardThumb, DeckListCompact, useCardDialog } from '../components/DeckCards';
import { MentionText } from '../components/CardMention';
import { deckDiff, parseSwap } from '../../lib/deckCards';
import { describeChanges, describePlan, packageChanges, packageName, packageProvenance, type PackagePlan } from '../../lib/deckPackages';
import { labDefaultKeep, LabSynergies, PackageChips, PackagePicker } from '../components/LabPackages';

type FieldKey = 'meta' | 'meta+ladder' | 'top8';
const FIELDS: { key: FieldKey; label: string; hint: string }[] = [
  { key: 'meta', label: 'choom.gg meta', hint: 'The tiered community archetypes' },
  { key: 'meta+ladder', label: 'Meta + sim ladder', hint: 'Adds the Master-ladder Legend trios' },
  { key: 'top8', label: 'Top 8 rated', hint: 'The 8 strongest decks by tournament power rating' },
];
/** Bred decks' quick test: every deck plays the same games, so the numbers compare. */
const NOT_SAVED = 'Not saved: this browser’s storage is full or blocked.';
const QUICK_TEST_SEED = 77_000;
const QUICK_TEST_GAMES = 56;
/** package moves tried per generation when they are on */
const PACKAGE_CANDS = 3;
const EFFORT = {
  // the game count, with the confirmation stages, is shown under Search depth
  quick: { label: 'Quick (1 generation)', games: 56, gens: 1, cands: 4 },
  standard: { label: 'Standard (2 generations)', games: 112, gens: 2, cands: 5 },
  thorough: { label: 'Thorough (3 generations)', games: 168, gens: 3, cands: 6 },
};

function fieldDecks(key: FieldKey, lib: readonly LibraryDeck[], exclude: string): DeckList[] {
  const not = (d: LibraryDeck) => d.deck.name !== exclude && !/-eor\.txt$/.test(d.file);
  if (key === 'meta') return lib.filter((d) => d.kind === 'meta' && not(d)).map((d) => d.deck);
  if (key === 'meta+ladder') return lib.filter((d) => (d.kind === 'meta' || d.kind === 'ladder') && not(d)).map((d) => d.deck);
  return RATINGS.decks
    .map((r) => lib.find((d) => d.deck.name === r.name))
    .filter((d): d is LibraryDeck => !!d && not(d))
    .slice(0, 8)
    .map((d) => d.deck);
}

export function DeckLabPage({ q }: { q: URLSearchParams }) {
  const [tab, setTab] = useState<'tune' | 'breed'>(q.get('tab') === 'breed' ? 'breed' : 'tune');
  const [handoff, setHandoff] = useState<DeckList | null>(null);
  // switching tabs unmounts the panel and would kill its run, so tabs are locked while games are running
  const [busy, setBusy] = useState(false);
  const lock = busy ? 'Stop the current run first' : undefined;
  return (
    <div className="grid">
      <PageHead
        kicker="Decks"
        title="Deck Lab"
        actions={
        <div className="seg">
          <button className={tab === 'tune' ? 'on' : ''} aria-pressed={tab === 'tune'} onClick={() => setTab('tune')} disabled={busy && tab !== 'tune'} title={lock}>
            🔧 Tune a deck
          </button>
          <button className={tab === 'breed' ? 'on' : ''} aria-pressed={tab === 'breed'} onClick={() => setTab('breed')} disabled={busy && tab !== 'breed'} title={lock}>
            🧬 Breed new decks
          </button>
        </div>
        }
      >
        Tune a deck against the field you choose, or breed new ones from what the recorded results say works. Everything runs in your browser.
      </PageHead>
      {tab === 'tune' ? (
        <TunePanel initialFile={q.get('d') ?? undefined} handoff={handoff} onBusy={setBusy} />
      ) : (
        <BreedPanel
          onBusy={setBusy}
          onTune={(d) => {
            setHandoff(d);
            setTab('tune');
          }}
        />
      )}
    </div>
  );
}

// ---------------------------------------------------------------- tune
function TunePanel({ initialFile, handoff, onBusy }: { initialFile?: string; handoff: DeckList | null; onBusy: (b: boolean) => void }) {
  const lib = useMemo(() => allDecks(), []);
  const [source, setSource] = useState<'library' | 'paste'>(handoff ? 'paste' : 'library');
  const [file, setFile] = useState(findDeck(initialFile)?.file ?? lib.find((d) => d.kind === 'meta')?.file ?? lib[0].file);
  const [text, setText] = useState(handoff ? exportOfficial(handoff) : '');
  const [field, setField] = useState<FieldKey>('meta');
  const [effort, setEffort] = useState<keyof typeof EFFORT>('quick');
  const [bot, setBot] = useState<'medium' | 'hard'>('medium');
  const [prog, setProg] = useState<TuneProgress | null>(null);
  const [running, setRunning] = useState(false);
  const [saved, setSaved] = useState('');
  /** how the last run ended: finished, stopped by you, or failed (with the game's error) */
  const [outcome, setOutcome] = useState<{ kind: 'done' | 'stopped' | 'failed'; error?: string } | null>(null);
  const [manifest, setManifest] = useState<RunManifest | null>(null);
  const stopRef = useRef(false);
  const poolRun = usePoolRun();
  useEffect(() => onBusy(running), [running, onBusy]);
  useEffect(() => {
    if (handoff) {
      setSource('paste');
      setText(exportOfficial(handoff));
    }
  }, [handoff]);

  const parsed = useMemo(() => {
    if (source === 'library') return { deck: findDeck(file)?.deck ?? null, errors: [] as string[] };
    if (!text.trim()) return { deck: null, errors: [] };
    try {
      const { deck } = parseDeck(text, 'My deck');
      return { deck, errors: validateDeck({ ...deck, sideboard: [] }) };
    } catch (e) {
      return { deck: null, errors: [String((e as Error).message ?? e)] };
    }
  }, [source, file, text]);
  // synergy packages: keep defaults to the list's objective packages or the packages it is built around, and resets
  // when the list changes; package moves are off unless turned on
  const listId = parsed.deck ? listFingerprint(parsed.deck) : '';
  const keepDefault = useMemo(() => (parsed.deck ? labDefaultKeep(parsed.deck, source === 'library' ? file : undefined) : { keep: [] as string[], from: 'built-around' as const }), [parsed.deck, source, file]);
  const [keepSel, setKeepSel] = useState<{ listId: string; keep: string[] } | null>(null);
  const keep = keepSel && keepSel.listId === listId ? keepSel.keep : keepDefault.keep;
  const [pkgMoves, setPkgMoves] = useState(false);
  /** the package plan of the last run, for the result panel and the saved notes */
  const [runPlan, setRunPlan] = useState<{ plan: PackagePlan; moves: boolean } | null>(null);
  // search depth: one change per candidate by default (the breadth before depth existed)
  const [cardsPer, setCardsPer] = useState(1);
  const [pkgsPer, setPkgsPer] = useState(1);
  const depth = { cardsPerChange: cardsPer, packagesPerChange: pkgMoves ? pkgsPer : 1 };
  // partner-aware cut ranking (src/lib/cutRanking.ts): on by default in the Lab
  const [partnerAware, setPartnerAware] = useState(true);
  const e0 = EFFORT[effort];
  const planned = tunePlan({ games: e0.games, gens: e0.gens, cands: e0.cands, packageMoves: pkgMoves, packageCands: PACKAGE_CANDS, depth, vsOriginal: vsOriginalGames(e0.games) });
  /** the rule the last run used, for its result panel */
  const [runRule, setRunRule] = useState<{ rule: AdoptionRule; firstStage: number; vsGames: number; gens: number; partnerAware: boolean; field: FieldKey; fieldDeckIds: string[]; bot: string } | null>(null);

  const start = async () => {
    const deck = parsed.deck;
    if (!deck || parsed.errors.length) return;
    if (planned.estimate.max > LAB_GAME_BUDGET && !window.confirm(`This run may play up to ${planned.estimate.max.toLocaleString('en-US')} games, over the lab's budget of ${LAB_GAME_BUDGET.toLocaleString('en-US')}. Run it anyway?`)) return;
    const fieldList = fieldDecks(field, lib, deck.name);
    const e = EFFORT[effort];
    const packagePlan: PackagePlan = keep.length ? { keep: [...keep] } : {};
    const pool = poolRun.open();
    stopRef.current = false;
    const seedBase = 500_000 + Math.floor(Math.random() * 9_000);
    // what this run measures; completedGames follows the games actually played
    const plan = gameRunManifest({
      purpose: 'browser',
      decks: [source === 'library' ? findDeck(file) ?? deck : deck, ...fieldList],
      fieldMode: `deck-lab-tune:${field}`,
      fieldDeckIds: fieldList.map((d) => manifestDeck(d).id),
      bot,
      seedBase,
      seatPolicy: 'alternate',
      plannedGames: planned.estimate.max,
      completedGames: 0,
      gamesPerPair: null,
      trace: true,
      simVersion: SIM_VERSION,
      ...(keep.length || pkgMoves ? { packages: packageProvenance(packagePlan) } : {}),
      adoption: adoptionProvenance(planned.rule, { firstStage: planned.firstStage, nominees: planned.depth.nominees, cardsPerChange: planned.depth.cardsPerChange, packagesPerChange: planned.depth.packagesPerChange }),
    });
    let completed = 0;
    const play: PlayGame = (j) =>
      pool.play(j).then((r) => {
        completed++;
        return r;
      });
    const note = () => setManifest({ ...plan, sample: { ...plan.sample, completedGames: completed } });
    setRunning(true);
    setSaved('');
    setOutcome(null);
    setProg(null);
    setManifest(plan);
    setRunPlan(keep.length || pkgMoves ? { plan: packagePlan, moves: pkgMoves } : null);
    setRunRule({ rule: planned.rule, firstStage: planned.firstStage, vsGames: planned.vsGames, gens: e.gens, partnerAware, field, fieldDeckIds: fieldList.map((d) => manifestDeck(d).id), bot });
    try {
      const onProgress = (p: TuneProgress) => {
        setProg(p);
        note();
      };
      const p = await tuneDeck(
        deck,
        fieldList,
        { games: e.games, gens: e.gens, cands: e.cands, bot, minGain: 0.02, seedBase, plan: packagePlan, packageMoves: pkgMoves, packageCands: PACKAGE_CANDS, depth, partnerAware, vsOriginal: planned.vsGames },
        play,
        onProgress,
        () => stopRef.current,
      );
      setOutcome({ kind: stopRef.current || p.phase === 'Stopped' ? 'stopped' : 'done' });
    } catch (err) {
      // Stop terminates the pool, which rejects the games in flight; anything else is a game that failed.
      const stopped = stopRef.current || isStopped(err);
      setOutcome(stopped ? { kind: 'stopped' } : { kind: 'failed', error: errorText(err) });
      setProg((p) => p && { ...p, phase: stopped ? 'Stopped' : 'Failed' });
    } finally {
      poolRun.close(pool);
      note();
      setRunning(false);
    }
  };
  const stop = () => {
    stopRef.current = true;
    poolRun.stop();
  };
  const finished = outcome?.kind === 'done';
  // A stopped or failed run can still save the swaps it confirmed before it ended, labelled as partial.
  const partial = !running && outcome && !finished ? partialTune(prog) : null;
  const finalDeck = finished ? prog?.deck : partial?.deck;
  const changes = finalDeck && parsed.deck ? deckDiff(parsed.deck, finalDeck).filter((c) => CARD_BY_ID[c.id]) : [];
  const { open: openCard, dialog: cardDialog } = useCardDialog();
  const minGainPp = runRule?.rule.minGainPp ?? planned.rule.minGainPp;
  // the tuned list against the original: only a list shown better is offered as the result
  const verdict = vsOriginalVerdict(finalVsOriginal(prog?.logs ?? []), minGainPp);
  const shownBetter = verdict === 'better';
  const save = () => {
    if (!finalDeck || !parsed.deck) return;
    const want = tunedName(finalDeck.name, !!partial, !shownBetter);
    const name = customSaveName(want, lib) ?? want;
    const done = manifest?.sample.completedGames ?? prog?.played ?? 0;
    const logs = prog?.logs ?? [];
    const pkgNote = runPlan ? `Packages: ${describePlan(runPlan.plan)}${runPlan.moves ? ', package moves on' : ''}; ${describeChanges(packageChanges(parsed.deck, finalDeck))}.` : '';
    const notes = [
      partial ? `Partial Deck Lab tune: stopped after ${done} of ${manifest?.sample.plannedGames ?? prog?.total ?? '?'} planned games. Confirmed swaps: ${partial.adopted.join('; ')}.` : finalDeck.notes,
      tuneSummaryText(logs, { minGainPp, partial: !!partial }),
      evidenceNote(logs),
      pkgNote,
    ]
      .filter(Boolean)
      .join(' ');
    const record = tunedRecord({
      original: { ...parsed.deck, ...(source === 'library' ? { file } : {}) },
      final: finalDeck,
      logs,
      partial: !!partial,
      gens: runRule?.gens ?? logs.length,
      rule: manifest?.adoption ?? adoptionProvenance(planned.rule, { firstStage: planned.firstStage, nominees: planned.depth.nominees, cardsPerChange: planned.depth.cardsPerChange, packagesPerChange: planned.depth.packagesPerChange }),
      manifest,
      bot: runRule?.bot ?? bot,
      fieldMode: `deck-lab-tune:${runRule?.field ?? field}`,
      fieldDeckIds: runRule?.fieldDeckIds ?? [],
      partnerAware: runRule?.partnerAware ?? partnerAware,
      ...(manifest?.packages ? { packages: manifest.packages } : {}),
    });
    const m = manifest ? { ...manifest, tune: manifestTune(record) } : undefined;
    if (!upsertCustom({ ...finalDeck, name, sideboard: finalDeck.sideboard ?? [], ...(notes ? { notes } : {}), ...(m ? { manifest: m } : {}), tuned: record })) {
      window.alert(NOT_SAVED);
      return;
    }
    setSaved(name);
  };

  return (
    <>
      <div className="panel grid">
        <p className="muted small" style={{ margin: 0 }}>
          Submit a deck and the lab fine-tunes it against the meta you choose:
        </p>
        <ol className="muted small" style={{ margin: 0, paddingLeft: 20 }}>
          <li>It plays the deck with telemetry to find its weakest and strongest cards.</li>
          <li>It tests one-card swaps on the same games (and whole-package moves, if you turn them on below).</li>
          <li>
            It confirms the best swap on fresh games paired with your list, in stages, and adopts it only when the gain is clearly above {planned.rule.minGainPp} point; otherwise it rejects it or says it
            could not tell, and keeps the list.
          </li>
          <li>After every generation that adopts a change, it plays the tuned list and your original list on the same held-out games, and the result says whether the tuned list is shown better than yours.</li>
        </ol>
        <label className="row small">
          <input type="checkbox" checked={partnerAware} onChange={(e) => setPartnerAware(e.target.checked)} disabled={running} />
          <span>
            <b>Partner-aware cuts</b> (on by default): a card in one of the list’s synergy packages is judged by its games with a partner piece, a cut that lowers a package’s odds of coming together costs
            in proportion, and a card that completes or deepens a package gets credit. Each generation shows why a card was or was not offered as a cut.
          </span>
        </label>
        <div className="seg">
          <button className={source === 'library' ? 'on' : ''} aria-pressed={source === 'library'} onClick={() => setSource('library')} disabled={running}>
            From the library
          </button>
          <button className={source === 'paste' ? 'on' : ''} aria-pressed={source === 'paste'} onClick={() => setSource('paste')} disabled={running}>
            Paste a list
          </button>
        </div>
        {source === 'library' ? (
          <DeckPicker label="Deck" value={file} onChange={setFile} />
        ) : (
          <textarea aria-label="Deck list to tune" rows={8} placeholder="Paste a deck list (choom.gg, official deck builder, sim JSON, or lines like '3 Psycho Squad')" value={text} onChange={(e) => setText(e.target.value)} disabled={running} />
        )}
        {parsed.errors.length > 0 && (
          <div className="small" style={{ color: 'var(--red)' }}>
            {parsed.errors.slice(0, 4).map((e) => (
              <div key={e}>⚠ {e}</div>
            ))}
          </div>
        )}
        {parsed.deck && !parsed.errors.length && (
          <LabSynergies deck={parsed.deck} keep={keep} from={keepDefault.from} onKeep={(ids) => setKeepSel({ listId, keep: ids })} moves={pkgMoves} onMoves={setPkgMoves} disabled={running} />
        )}
        <DepthControls
          cards={cardsPer}
          onCards={setCardsPer}
          packages={pkgsPer}
          onPackages={setPkgsPer}
          packagesOn={pkgMoves}
          estimate={planned.estimate}
          budget={LAB_GAME_BUDGET}
          rule={planned.rule}
          firstStage={planned.firstStage}
          disabled={running}
          vsOriginal={{ max: planned.vsMax, games: planned.vsGames }}
        />
        <div className="row small">
          <label className="row muted">
            Tune against
            <select value={field} onChange={(e) => setField(e.target.value as FieldKey)} disabled={running}>
              {FIELDS.map((f) => (
                <option key={f.key} value={f.key} title={f.hint}>
                  {f.label}
                </option>
              ))}
            </select>
          </label>
          <label className="row muted">
            Effort
            <select value={effort} onChange={(e) => setEffort(e.target.value as keyof typeof EFFORT)} disabled={running}>
              {Object.entries(EFFORT).map(([k, v]) => (
                <option key={k} value={k}>
                  {v.label}
                </option>
              ))}
            </select>
          </label>
          <label className="row muted">
            Bots
            <select value={bot} onChange={(e) => setBot(e.target.value as 'medium' | 'hard')} disabled={running}>
              <option value="medium">Medium (faster)</option>
              <option value="hard">Hard (most accurate)</option>
            </select>
          </label>
        </div>
        <div className="row">
          {!running ? (
            <button className="primary" onClick={start} disabled={!parsed.deck || parsed.errors.length > 0}>
              ▶ Tune {parsed.deck?.name ?? 'deck'}
            </button>
          ) : (
            <button onClick={stop}>■ Stop</button>
          )}
        </div>
      </div>

      {prog && (
        <div className="panel grid flair">
          <div className="spread">
            <h3 style={{ margin: 0 }}>{running ? 'Tuning…' : outcome?.kind === 'failed' ? 'Tuning failed' : outcome?.kind === 'stopped' ? 'Stopped by you' : 'Tuning finished'}</h3>
            <span className="small muted">{prog.phase}</span>
          </div>
          {!running && outcome?.kind === 'failed' && (
            <div className="small" style={{ color: 'var(--red)' }}>
              ⚠ A game failed, so the run was abandoned: {outcome.error}
            </div>
          )}
          {!running && outcome && !finished && (
            <div className="small muted">
              {outcome.kind === 'stopped' ? 'The run was stopped before it finished' : 'The run ended early'}
              {partial
                ? `. ${partial.adopted.length === 1 ? 'One swap was' : `${partial.adopted.length} swaps were`} confirmed on fresh games before that; you can save the list with only ${partial.adopted.length === 1 ? 'that swap' : 'those swaps'} as a partial result. Later generations were not measured.`
                : ', before any swap was confirmed, so there is nothing to save. Run it again to finish.'}
            </div>
          )}
          {running && (
            <div className="run-progress">
              <div className="bar">
                <div style={{ width: `${Math.round((100 * prog.done) / Math.max(1, prog.total))}%` }} />
              </div>
            </div>
          )}
          {runRule && runRule.vsGames > 0 && <TuneTrajectory logs={prog.logs} minGainPp={minGainPp} games={runRule.vsGames} finished={!running && finished} partial={!running && !!partial} />}
          {runRule?.partnerAware && <div className="small muted">Cuts ranked partner-aware (on by default in the Lab; the ranking and its reasons are under each generation).</div>}
          {prog.logs.map((l) => (
            <details key={l.gen} open={running || l.gen === prog.logs.length}>
              <summary className="small">
                <GenerationSummary log={l} />
              </summary>
              {l.report && l.report.insights.length > 0 && (
                <div className="small muted">
                  <Markdown text={l.report.insights.slice(0, 3).map((s) => `- ${s}`).join(String.fromCharCode(10))} />
                </div>
              )}
              {l.cuts && <CutTable cuts={l.cuts} label={(id, name) => (CARD_BY_ID[id] ? <CardNameButton def={CARD_BY_ID[id]} onOpen={openCard} /> : name)} />}
              {l.swaps.length > 0 && (
                <table className="small lab-screening">
                  <caption className="muted">Screening: each change on this generation’s {l.swaps[0]?.gain?.games ?? ''} games, paired with the list. It only nominates; the best of several is biased high.</caption>
                  <thead>
                    <tr>
                      <th>Change</th>
                      <th title="On this generation's screening games only: not the deck's win rate">Screening win %</th>
                      <th>vs the list, same games</th>
                    </tr>
                  </thead>
                  <tbody>
                    {l.swaps.map((s) => (
                      <tr key={s.label}>
                        <td>
                          {s.pkg && <span className="tag">package · {s.pkg.kind}</span>}
                          {s.combo && <span className="tag">combined</span>} <SwapLabel label={s.label} onOpen={openCard} />
                        </td>
                        <td className="muted num" title={`Screening only, ${s.gain?.games ?? '?'} games: not the deck's win rate`}>
                          {Math.round(s.wr * 100)}%
                        </td>
                        <td>{s.gain ? <PairedGain g={s.gain} /> : <Signed v={s.wr - l.baseline} unit=" pts" />}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
              {l.nominees && l.nominees.length > 0 ? (
                <div className="small">
                  <div className="muted">Confirmation on fresh games, paired with the list (screening only nominates; the held-out gain is the one that counts):</div>
                  <NomineeTable nominees={l.nominees} minGames={runRule?.rule.minGames ?? 0} futilityMaxGainPp={runRule?.rule.futilityMaxGainPp ?? 0} label={(t) => <SwapLabel label={t} onOpen={openCard} />} />
                </div>
              ) : (
                l.confirm && (
                  <div className="small">
                    Confirmation on fresh games: baseline <Wr v={l.confirm.base} /> vs swap <Wr v={l.confirm.swap} /> → <b>{l.adopted ? 'adopted' : 'rejected'}</b>
                  </div>
                )
              )}
            </details>
          ))}
          {runRule && <div className="small muted">Adoption rule: {describeRule(runRule.rule, { firstStage: runRule.firstStage })}.</div>}
          <RunDetails m={manifest} />
          {!running && finalDeck && (finished || partial) && (
            <div className="grid">
              {partial && (
                <div className="zone-label" role="note">
                  Partial result: {partial.adopted.length} confirmed swap{partial.adopted.length === 1 ? '' : 's'}, {manifest?.sample.completedGames ?? prog?.played ?? 0} of {manifest?.sample.plannedGames ?? prog?.total} planned games played
                </div>
              )}
              {runPlan && parsed.deck && (
                <div className="small" role="note">
                  <PackageChips deck={finalDeck} before={parsed.deck} />
                  <div className="muted">
                    Packages: <MentionText text={describePlan(runPlan.plan)} />
                    {runPlan.moves ? '; package moves on' : '; package moves off'}.
                    {(() => {
                      const pk = prog?.logs.flatMap((l) => (l.adopted && l.swaps.find((x) => x.label === l.adopted)?.pkg ? [l.adopted] : [])) ?? [];
                      return pk.length ? ` Package moves adopted: ${pk.join('; ')}.` : '';
                    })()}
                  </div>
                </div>
              )}
              {changes.length ? (
                <div className="lab-changes">
                  <div className="zone-label">{shownBetter ? 'Changes to the list' : 'Changes in the tuned list (not shown to be better than your original)'}</div>
                  <ul>
                    {changes.map(({ id, d }) => (
                      <li key={id} className={`deck-row ${d > 0 ? 'is-in' : 'is-out'}`}>
                        <CardThumb def={CARD_BY_ID[id]} onOpen={openCard} />
                        <span className="qty">
                          {d > 0 ? '+' : '−'}
                          {Math.abs(d)}
                        </span>
                        <CardNameButton def={CARD_BY_ID[id]} onOpen={openCard} />
                        <span className="muted small deck-row-cost">{d > 0 ? 'added' : 'cut'}</span>
                      </li>
                    ))}
                  </ul>
                  <div className="lab-before-after">
                    {parsed.deck && (
                      <details>
                        <summary className="small">Original list</summary>
                        <DeckListCompact deck={parsed.deck} />
                      </details>
                    )}
                    <details>
                      <summary className="small">{partial ? 'Tuned list (partial)' : 'Tuned list'}</summary>
                      <DeckListCompact deck={finalDeck} />
                    </details>
                  </div>
                </div>
              ) : (
                <div className="small muted">
                  No change cleared the bar on fresh games
                  {prog.logs.some((l) => l.nominees?.some((n) => n.outcome === 'inconclusive' && n.stopped !== 'futility'))
                    ? ': for at least one the lab could not tell either way at this sample size, so the list was kept. A longer run (more effort) can settle it.'
                    : prog.logs.some((l) => l.nominees?.some((n) => n.stopped === 'futility'))
                      ? ': the changes it confirmed showed no gain on fresh games, so they were stopped early and the list was kept.'
                      : '. The deck is already well tuned for this field (at this sample size).'}
                </div>
              )}
              <div className="row">
                {changes.length > 0 && !shownBetter && parsed.deck && (
                  <button className="primary" onClick={() => navigator.clipboard?.writeText(exportOfficial(parsed.deck!))}>
                    Keep your original list (copy it)
                  </button>
                )}
                <button className={shownBetter || !changes.length ? 'primary' : ''} onClick={save} disabled={!changes.length}>
                  {shownBetter || !changes.length ? (partial ? '💾 Save partial result to My decks' : '💾 Save to My decks') : '💾 Save the tuned list anyway (not shown to be better)'}
                </button>
                <button onClick={() => navigator.clipboard?.writeText(exportOfficial(finalDeck))}>{changes.length ? 'Copy tuned list' : 'Copy list'}</button>
                {saved && (
                  <a className="btn" href={`#/play?d=${encodeURIComponent(`custom:${saved}`)}`}>
                    ▶ Practice with “{saved}”
                  </a>
                )}
                {saved && (
                  <IfPage path="tuned">
                    <a className="btn" href="#/tuned">
                      🔧 All tuned decks and their results
                    </a>
                  </IfPage>
                )}
              </div>
            </div>
          )}
        </div>
      )}
      {cardDialog}
    </>
  );
}

/**
 * A generation's one-line summary: what was adopted (with its held-out gain), not told, or kept; then, secondary, the
 * list's score on this generation's own screening games. Every generation plays new games, so those scores are not a
 * trend; the headline (TuneTrajectory) compares the list with the original on the same games.
 */
export function GenerationSummary({ log: l }: { log: TuneLog }) {
  const unsure = l.nominees?.find((n) => n.outcome === 'inconclusive');
  const n = l.swaps[0]?.gain?.games;
  return (
    <>
      Generation {l.gen}
      {l.adopted ? (
        <>
          {' '}
          · <OutcomeChip outcome="adopt" />{' '}
          <b>
            {/* shown in a <summary>: hover only */}
            <MentionText text={l.adopted} passive />
          </b>
          {l.adoptedGain && (
            <>
              {' '}
              (held-out <PairedGain g={l.adoptedGain} />)
            </>
          )}
        </>
      ) : unsure ? (
        <>
          {' '}
          · <OutcomeChip outcome="inconclusive" stopped={unsure.stopped} games={unsure.heldOut?.games} /> list kept
        </>
      ) : l.swaps.length ? (
        ' · list kept'
      ) : (
        ''
      )}
      <span className="muted">
        {' '}
        · screening games: the list scored {Math.round(l.baseline * 100)}% on this generation’s {n ? `${n} ` : ''}games (new games each generation, so not a trend)
      </span>
    </>
  );
}

/** The saved list's note on what was adopted, with held-out paired gains (and what the lab could not tell). */
export function evidenceNote(logs: readonly TuneLog[]): string {
  const adopted = logs.flatMap((l) => (l.adopted ? [`${l.adopted} (held-out ${l.adoptedGain ? formatGain(l.adoptedGain) : 'gain not recorded'})`] : []));
  const unsure = logs.flatMap((l) =>
    (l.nominees ?? [])
      .filter((n) => n.outcome === 'inconclusive')
      .map((n) => {
        const why = stoppedWords(n.stopped, n.heldOut?.games ?? 0);
        return `${n.label}${why ? ` (${why})` : ''}`;
      }),
  );
  return [adopted.length ? `Deck Lab adopted: ${adopted.join('; ')}.` : '', unsure.length ? `Could not tell (not adopted): ${unsure.join('; ')}.` : ''].filter(Boolean).join(' ');
}

/** A swap label ("−1 A → +1 B") with the two cards' thumbnails; plain text when a name isn't a known card. */
function SwapLabel({ label, onOpen }: { label: string; onOpen: (d: CardDef) => void }) {
  const sw = parseSwap(label);
  if (!sw.out || !sw.in) return <MentionText text={label} />;
  return (
    <span className="lab-swap">
      <CardThumb def={CARD_BY_ID[sw.out]} onOpen={onOpen} />
      <span>
        −1 <CardNameButton def={CARD_BY_ID[sw.out]} onOpen={onOpen} />
      </span>
      <span aria-hidden="true">→</span>
      <span className="sr-only">replaced by</span>
      <CardThumb def={CARD_BY_ID[sw.in]} onOpen={onOpen} />
      <span>
        +1 <CardNameButton def={CARD_BY_ID[sw.in]} onOpen={onOpen} />
      </span>
    </span>
  );
}

// ---------------------------------------------------------------- breed
function BreedPanel({ onTune, onBusy }: { onTune: (d: DeckList) => void; onBusy: (b: boolean) => void }) {
  const lib = useMemo(() => allDecks(), []);
  const [n, setN] = useState(6);
  const [seed, setSeed] = useState(() => Math.floor(Math.random() * 900) + 100);
  const [parents, setParents] = useState<string[]>([]);
  const [pickFile, setPickFile] = useState(lib[0].file);
  const [bred, setBred] = useState<Bred[]>([]);
  // synergy packages to build around (none by default: breeding as before)
  const [picked, setPicked] = useState<string[]>([]);
  const [fitAll, setFitAll] = useState(true);
  const [bredFor, setBredFor] = useState<string[]>([]);
  // quick-test results and saves are keyed by deck name, so a test that finishes after re-breeding can't land on another deck
  const [tests, setTests] = useState<Record<string, { wr: number; manifest: RunManifest } | 'running' | { error: string }>>({});
  const [savedAs, setSavedAs] = useState<Record<string, string>>({});
  const poolRun = usePoolRun();
  const live = useRef(0); // quick tests in flight; the pool is closed when the last one ends
  const anyRunning = Object.values(tests).includes('running');
  useEffect(() => onBusy(anyRunning), [anyRunning, onBusy]);
  // head-to-heads for counter decks: loaded only when this tab opens
  const [h2h, setH2H] = useState<H2HInfo | null | 'loading'>('loading');
  // the recorded-event count (for the staleness note) loads with them, not with the page (LIB-3)
  const [recorded, setRecorded] = useState<number | null>(null);
  useEffect(() => {
    let live = true;
    Promise.all([loadH2H(), recordedEventCount()]).then(([h, n]) => {
      if (!live) return;
      setRecorded(n);
      setH2H(h);
    });
    return () => {
      live = false;
    };
  }, []);
  const h2hReady = h2h && h2h !== 'loading' ? h2h : null;
  const stale = !!h2hReady && recorded !== null && h2hReady.events + h2hReady.excluded < recorded;

  const breed = () => {
    const packages = picked.length ? { seeds: [picked], ...(fitAll ? { plan: { require: picked } } : {}) } : undefined;
    setBred(breedInBrowser(lib, { n, seed, parents, h2h: h2hReady?.lookup, ...(packages ? { packages } : {}) }));
    setBredFor(picked);
  };
  const test = async (b: Bred) => {
    const key = b.deck.name;
    setTests((t) => ({ ...t, [key]: 'running' }));
    const pool = poolRun.shared();
    live.current++;
    const fieldLib = lib.filter((d) => d.kind === 'meta');
    const field = fieldLib.map((d) => d.deck);
    try {
      // every bred deck plays the same seeds, so their quick-test numbers are comparable
      const r = await playSet(b.deck, field, QUICK_TEST_SEED, QUICK_TEST_GAMES, 'medium', pool.play, false);
      const manifest = gameRunManifest({
        purpose: 'browser',
        decks: [b.deck, ...fieldLib],
        fieldMode: 'deck-lab-quick-test:meta',
        fieldDeckIds: fieldLib.map((d) => manifestDeck(d).id),
        bot: 'medium',
        seedBase: QUICK_TEST_SEED,
        seatPolicy: 'alternate',
        plannedGames: QUICK_TEST_GAMES,
        completedGames: r.games,
        gamesPerPair: null,
        simVersion: SIM_VERSION,
      });
      setTests((t) => ({ ...t, [key]: { wr: r.wr, manifest } }));
    } catch (e) {
      setTests((t) => {
        const { [key]: _, ...rest } = t;
        return isStopped(e) ? rest : { ...rest, [key]: { error: errorText(e) } };
      });
    } finally {
      if (--live.current === 0) poolRun.close(pool);
    }
  };
  const save = (b: Bred) => {
    const name = customSaveName(b.deck.name, lib) ?? b.deck.name;
    const t = tests[b.deck.name];
    // a quick-tested deck keeps the manifest of its test
    const manifest = t && typeof t === 'object' && 'wr' in t ? t.manifest : undefined;
    if (!upsertCustom({ ...b.deck, name, sideboard: [], ...(manifest ? { manifest } : {}) })) {
      window.alert(NOT_SAVED);
      return;
    }
    setSavedAs((s) => ({ ...s, [b.deck.name]: name }));
  };
  const asLib = (b: Bred): LibraryDeck => ({ file: `lab:${b.deck.name}`, deck: b.deck, kind: 'custom', prov: { origin: 'Night City Trainer bred deck (Deck Lab)' } });

  return (
    <>
      <div className="panel grid">
        <p className="muted small" style={{ margin: 0 }}>
          Breed new decks from what the data says works, the same way the breeding seasons do:
        </p>
        <ul className="muted small" style={{ margin: 0, paddingLeft: 20 }}>
          <li>
            <b>Parents</b> are chosen by power rating, with card choices weighted by how each card performed in its deck.
          </li>
          <li>
            <b>Mutants</b> swap one Legend of a top deck.
          </li>
          <li>
            <b>Crossovers</b> merge two strong decks.
          </li>
          <li>
            <b>Explorers</b> try untested Legend trios.
          </li>
        </ul>
        <div className="row small">
          <label className="row muted">
            How many
            <select value={n} onChange={(e) => setN(+e.target.value)}>
              {[4, 6, 8].map((x) => (
                <option key={x}>{x}</option>
              ))}
            </select>
          </label>
          <label className="row muted" title="Same seed + same parents = the same decks">
            Seed
            <input type="number" value={seed} onChange={(e) => setSeed(+e.target.value || 1)} style={{ width: 80 }} />
          </label>
        </div>
        <div className="row small">
          <span className="muted">Parents:</span>
          {parents.length === 0 && <span className="muted">the strongest decks (automatic)</span>}
          {parents.map((p) => (
            <button key={p} className="chip-btn on" onClick={() => setParents(parents.filter((x) => x !== p))} title="Remove">
              {p} ✕
            </button>
          ))}
        </div>
        <div className="row">
          <DeckPicker label="Add a parent" value={pickFile} onChange={setPickFile} />
          <button
            onClick={() => {
              const d = findDeck(pickFile);
              if (d && !parents.includes(d.deck.name)) setParents([...parents, d.deck.name]);
            }}
          >
            + Add
          </button>
        </div>
        <PackagePicker value={picked} onChange={setPicked} fitAll={fitAll} onFitAll={setFitAll} />
        <div className="row">
          <button className="primary" onClick={breed}>
            🧬 Breed {n} decks
          </button>
          <span className="small muted">
            {h2h === 'loading' ? (
              'Loading tournament head-to-heads…'
            ) : h2hReady ? (
              <>
                <b>Counter decks on</b>: built against the current top decks from {h2hReady.games.toLocaleString()} head-to-head games ({h2hReady.events} events)
                {h2hReady.shrunk ? ', each matchup estimated from the power ratings plus its own record, so a 2–1 is not read as a 67% matchup' : ''}.
                {h2hReady.excluded > 0 && ` ${h2hReady.excluded} event(s) from another simulator version or bot are left out.`}
                {stale && (
                  <span style={{ color: 'var(--accent)' }}>
                    {' '}
                    ⚠ {(recorded ?? 0) - h2hReady.events - h2hReady.excluded} newer event(s) aren't included yet;{' '}
                    <span title="For the site owner: npm run build-h2h (runs automatically after every tournament series)">they arrive when the site's data is next rebuilt.</span>
                  </span>
                )}
              </>
            ) : (
              <>
                <b>Counter decks off</b>: <span title="For the site owner: npm run build-h2h (or any tournament series), then publish">the head-to-head data hasn't been built for this site yet.</span>
              </>
            )}
          </span>
        </div>
      </div>
      {bredFor.length > 0 && bred.length < n && (
        <p className="small muted" role="status">
          {bred.length} of {n} decks could be built around {bredFor.map(packageName).join(' + ')} (the others had no Legend trio or room that holds {bredFor.length > 1 ? 'them' : 'it'}).
        </p>
      )}
      {bred.length > 0 && (
        <div className="deck-grid">
          {bred.map((b) => {
            const t = tests[b.deck.name];
            const saved = savedAs[b.deck.name];
            return (
            <div key={b.deck.name} className="panel grid" style={{ padding: 10 }}>
              <DeckTile d={asLib(b)} />
              <div className="small">
                <span className="tag">{b.method}</span>{' '}
                <span className="muted">
                  <MentionText text={b.idea ?? ''} />
                </span>
              </div>
              <PackageChips deck={b.deck} />
              {b.packages && b.packages.changes.length > 0 && (
                <details>
                  <summary className="small">Package changes ({b.packages.changes.length})</summary>
                  <ul className="small muted" style={{ margin: 0, paddingLeft: 18 }}>
                    {b.packages.changes.map((c) => (
                      <li key={c}>
                        <MentionText text={c} />
                      </li>
                    ))}
                  </ul>
                </details>
              )}
              <details>
                <summary className="small">Decklist</summary>
                <DeckListCompact deck={b.deck} />
              </details>
              <div className="row small">
                <button onClick={() => test(b)} disabled={t === 'running'}>
                  {t === 'running' ? 'Testing…' : '▶ Quick test vs meta'}
                </button>
                {t && typeof t === 'object' && 'wr' in t && (
                  <span>
                    <Wr v={t.wr} n={QUICK_TEST_GAMES} strong /> vs meta
                  </span>
                )}
                {t && typeof t === 'object' && 'error' in t && <span style={{ color: 'var(--red)' }}>⚠ Test failed: {t.error}</span>}
              </div>
              {t && typeof t === 'object' && 'wr' in t && <RunDetails m={t.manifest} />}
              <div className="row small">
                <button onClick={() => save(b)} disabled={!!saved} title={saved && saved !== b.deck.name ? `Saved as “${saved}” (the name belongs to a built-in deck)` : undefined}>
                  {saved ? (saved === b.deck.name ? '✓ Saved' : `✓ Saved as “${saved}”`) : '💾 Save'}
                </button>
                <button onClick={() => onTune(b.deck)} disabled={anyRunning} title={anyRunning ? 'Wait for the quick tests to finish' : undefined}>
                  🔧 Tune it
                </button>
              </div>
            </div>
            );
          })}
        </div>
      )}
    </>
  );
}
