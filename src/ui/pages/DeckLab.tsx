// Deck Lab: submit a deck to be tuned for the meta, or breed new decks — all in the browser, using the trainer's own
// methods (forge swaps confirmed on fresh games; data-driven breeding). Results can be saved to "My decks".
import { useEffect, useMemo, useRef, useState } from 'react';
import { allDecks, upsertCustom } from '../../lib/browserLibrary';
import type { LibraryDeck } from '../../lib/library';
import { counts, exportOfficial, parseDeck, validateDeck } from '../../engine/deck';
import { CARD_BY_ID, cardLabel } from '../../engine/cards';
import type { DeckList } from '../../engine/types';
import { breedInBrowser, loadH2H, playSet, tuneDeck, type H2HInfo, type TuneProgress } from '../../lib/deckLab';
import tournaments from '../../data/tournaments.json';
import type { Bred } from '../../ai/breeder';
import { GamePool, defaultThreads, errorText, isStopped } from '../../sim/pool';
import { customSaveName } from '../deckLookup';
import { DeckPicker, findDeck } from '../components/DeckPicker';
import { DeckTile } from '../components/DeckIdentity';
import { Signed, Wr } from '../components/Num';
import ratings from '../../data/ratings.json';
import { Markdown } from '../components/Markdown';

type FieldKey = 'meta' | 'meta+ladder' | 'top8';
const FIELDS: { key: FieldKey; label: string; hint: string }[] = [
  { key: 'meta', label: 'choom.gg meta', hint: 'The tiered community archetypes' },
  { key: 'meta+ladder', label: 'Meta + sim ladder', hint: 'Adds the Master-ladder Legend trios' },
  { key: 'top8', label: 'Top 8 rated', hint: 'The 8 strongest decks by tournament power rating' },
];
/** Bred decks' quick test: every deck plays the same games, so the numbers compare. */
const QUICK_TEST_SEED = 77_000;
const QUICK_TEST_GAMES = 56;
const EFFORT = {
  quick: { label: 'Quick (~15 s)', games: 56, gens: 1, cands: 4 },
  standard: { label: 'Standard (~1 min)', games: 112, gens: 2, cands: 5 },
  thorough: { label: 'Thorough (~3 min)', games: 168, gens: 3, cands: 6 },
};

function fieldDecks(key: FieldKey, lib: LibraryDeck[], exclude: string): DeckList[] {
  const not = (d: LibraryDeck) => d.deck.name !== exclude && !/-eor\.txt$/.test(d.file);
  if (key === 'meta') return lib.filter((d) => d.kind === 'meta' && not(d)).map((d) => d.deck);
  if (key === 'meta+ladder') return lib.filter((d) => (d.kind === 'meta' || d.kind === 'ladder') && not(d)).map((d) => d.deck);
  const R = ratings as unknown as { decks: { name: string }[] };
  return R.decks
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
      <div className="spread">
        <h1 style={{ margin: 0 }}>Deck Lab</h1>
        <div className="seg">
          <button className={tab === 'tune' ? 'on' : ''} onClick={() => setTab('tune')} disabled={busy && tab !== 'tune'} title={lock}>
            🔧 Tune a deck
          </button>
          <button className={tab === 'breed' ? 'on' : ''} onClick={() => setTab('breed')} disabled={busy && tab !== 'breed'} title={lock}>
            🧬 Breed new decks
          </button>
        </div>
      </div>
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
  const stopRef = useRef(false);
  const poolRef = useRef<GamePool | null>(null);
  useEffect(() => () => poolRef.current?.terminate(), []);
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

  const start = async () => {
    const deck = parsed.deck;
    if (!deck || parsed.errors.length) return;
    const fieldList = fieldDecks(field, lib, deck.name);
    const e = EFFORT[effort];
    poolRef.current?.terminate();
    const pool = new GamePool(defaultThreads());
    poolRef.current = pool;
    stopRef.current = false;
    setRunning(true);
    setSaved('');
    setOutcome(null);
    setProg(null);
    try {
      const p = await tuneDeck(deck, fieldList, { games: e.games, gens: e.gens, cands: e.cands, bot, minGain: 0.02 }, pool.play, setProg, () => stopRef.current);
      setOutcome({ kind: stopRef.current || p.phase === 'Stopped' ? 'stopped' : 'done' });
    } catch (err) {
      // Stop terminates the pool, which rejects the games in flight; anything else is a game that failed.
      const stopped = stopRef.current || isStopped(err);
      setOutcome(stopped ? { kind: 'stopped' } : { kind: 'failed', error: errorText(err) });
      setProg((p) => p && { ...p, phase: stopped ? 'Stopped' : 'Failed' });
    } finally {
      pool.terminate();
      poolRef.current = null;
      setRunning(false);
    }
  };
  const stop = () => {
    stopRef.current = true;
    poolRef.current?.terminate();
  };
  const finalDeck = prog?.deck;
  const changes = finalDeck && parsed.deck ? diff(parsed.deck, finalDeck) : [];
  const save = () => {
    if (!finalDeck) return;
    const want = finalDeck.name.endsWith('(tuned)') ? finalDeck.name : `${finalDeck.name} (tuned)`;
    const name = customSaveName(want, lib) ?? want;
    upsertCustom({ ...finalDeck, name, sideboard: finalDeck.sideboard ?? [] });
    setSaved(name);
  };
  const finished = outcome?.kind === 'done';

  return (
    <>
      <div className="panel grid">
        <p className="muted small" style={{ margin: 0 }}>
          Submit a deck and the lab fine-tunes it against the meta you choose:
        </p>
        <ol className="muted small" style={{ margin: 0, paddingLeft: 20 }}>
          <li>It plays the deck with telemetry to find its weakest and strongest cards.</li>
          <li>It tests one-card swaps on the same games.</li>
          <li>It confirms the best swap on fresh games before adopting it.</li>
        </ol>
        <div className="seg">
          <button className={source === 'library' ? 'on' : ''} onClick={() => setSource('library')} disabled={running}>
            From the library
          </button>
          <button className={source === 'paste' ? 'on' : ''} onClick={() => setSource('paste')} disabled={running}>
            Paste a list
          </button>
        </div>
        {source === 'library' ? (
          <DeckPicker label="Deck" value={file} onChange={setFile} />
        ) : (
          <textarea rows={8} placeholder="Paste a deck list (choom.gg, official deck builder, sim JSON, or lines like '3 Psycho Squad')" value={text} onChange={(e) => setText(e.target.value)} disabled={running} />
        )}
        {parsed.errors.length > 0 && (
          <div className="small" style={{ color: 'var(--red)' }}>
            {parsed.errors.slice(0, 4).map((e) => (
              <div key={e}>⚠ {e}</div>
            ))}
          </div>
        )}
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
        <div className="panel grid">
          <div className="spread">
            <h3 style={{ margin: 0 }}>{running ? 'Tuning…' : outcome?.kind === 'failed' ? 'Tuning failed' : outcome?.kind === 'stopped' ? 'Stopped by you' : 'Tuning finished'}</h3>
            <span className="small muted">{prog.phase}</span>
          </div>
          {!running && outcome?.kind === 'failed' && (
            <div className="small" style={{ color: 'var(--red)' }}>
              ⚠ A game failed, so the run was abandoned: {outcome.error}
            </div>
          )}
          {!running && outcome?.kind === 'stopped' && <div className="small muted">The run was stopped before it finished, so the list below was not fully measured and can't be saved. Run it again to finish.</div>}
          {running && (
            <div className="run-progress">
              <div className="bar">
                <div style={{ width: `${Math.round((100 * prog.done) / Math.max(1, prog.total))}%` }} />
              </div>
            </div>
          )}
          {prog.logs.map((l) => (
            <details key={l.gen} open>
              <summary className="small">
                Generation {l.gen}: baseline <Wr v={l.baseline} /> {l.adopted ? <b> · adopted {l.adopted}</b> : l.swaps.length ? ' · list kept' : ''}
              </summary>
              {l.report && l.report.insights.length > 0 && (
                <div className="small muted">
                  <Markdown text={l.report.insights.slice(0, 3).map((s) => `- ${s}`).join(String.fromCharCode(10))} />
                </div>
              )}
              {l.swaps.length > 0 && (
                <table className="small">
                  <thead>
                    <tr>
                      <th>Swap (same games)</th>
                      <th>Win %</th>
                      <th>vs baseline</th>
                    </tr>
                  </thead>
                  <tbody>
                    {l.swaps.map((s) => (
                      <tr key={s.label}>
                        <td>{s.label}</td>
                        <td>
                          <Wr v={s.wr} />
                        </td>
                        <td>
                          <Signed v={s.wr - l.baseline} unit=" pts" />
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
              {l.confirm && (
                <div className="small">
                  Confirmation on fresh games: baseline <Wr v={l.confirm.base} /> vs swap <Wr v={l.confirm.swap} /> → <b>{l.adopted ? 'adopted' : 'rejected'}</b>
                </div>
              )}
            </details>
          ))}
          {!running && finished && finalDeck && (
            <div className="grid">
              {changes.length ? (
                <div className="small">
                  <b>Changes:</b> {changes.join(' · ')}
                </div>
              ) : (
                <div className="small muted">No swap beat the original list on confirmation. The deck is already well tuned for this field (at this sample size).</div>
              )}
              <div className="row">
                <button className="primary" onClick={save} disabled={!changes.length}>
                  💾 Save to My decks
                </button>
                <button onClick={() => navigator.clipboard?.writeText(exportOfficial(finalDeck))}>Copy list</button>
                {saved && (
                  <a href={`#/play?d=${encodeURIComponent(`custom:${saved}`)}`}>
                    <button>▶ Practice with “{saved}”</button>
                  </a>
                )}
              </div>
            </div>
          )}
        </div>
      )}
    </>
  );
}

function diff(a: DeckList, b: DeckList): string[] {
  const A = counts(a.main);
  const B = counts(b.main);
  const out: string[] = [];
  for (const id of new Set([...A.keys(), ...B.keys()])) {
    const d = (B.get(id) ?? 0) - (A.get(id) ?? 0);
    if (d) out.push(`${d > 0 ? '+' : '−'}${Math.abs(d)} ${cardLabel(CARD_BY_ID[id])}`);
  }
  return out;
}

// ---------------------------------------------------------------- breed
function BreedPanel({ onTune, onBusy }: { onTune: (d: DeckList) => void; onBusy: (b: boolean) => void }) {
  const lib = useMemo(() => allDecks(), []);
  const [n, setN] = useState(6);
  const [seed, setSeed] = useState(() => Math.floor(Math.random() * 900) + 100);
  const [parents, setParents] = useState<string[]>([]);
  const [pickFile, setPickFile] = useState(lib[0].file);
  const [bred, setBred] = useState<Bred[]>([]);
  // quick-test results and saves are keyed by deck name, so a test that finishes after re-breeding can't land on another deck
  const [tests, setTests] = useState<Record<string, number | 'running' | { error: string }>>({});
  const [savedAs, setSavedAs] = useState<Record<string, string>>({});
  const poolRef = useRef<GamePool | null>(null);
  const live = useRef(0); // quick tests in flight; the pool is closed when the last one ends
  useEffect(() => () => poolRef.current?.terminate(), []);
  const anyRunning = Object.values(tests).includes('running');
  useEffect(() => onBusy(anyRunning), [anyRunning, onBusy]);
  // head-to-heads for counter decks: loaded only when this tab opens
  const [h2h, setH2H] = useState<H2HInfo | null | 'loading'>('loading');
  useEffect(() => {
    loadH2H().then(setH2H);
  }, []);
  const recorded = (tournaments as unknown as { events: unknown[] }).events.length;
  const h2hReady = h2h && h2h !== 'loading' ? h2h : null;
  const stale = !!h2hReady && h2hReady.events < recorded;

  const breed = () => setBred(breedInBrowser(lib, { n, seed, parents, h2h: h2hReady?.lookup }));
  const test = async (b: Bred) => {
    const key = b.deck.name;
    setTests((t) => ({ ...t, [key]: 'running' }));
    if (!poolRef.current || poolRef.current.terminated) poolRef.current = new GamePool(defaultThreads());
    const pool = poolRef.current;
    live.current++;
    const field = lib.filter((d) => d.kind === 'meta').map((d) => d.deck);
    try {
      // every bred deck plays the same seeds, so their quick-test numbers are comparable
      const r = await playSet(b.deck, field, QUICK_TEST_SEED, QUICK_TEST_GAMES, 'medium', pool.play, false);
      setTests((t) => ({ ...t, [key]: r.wr }));
    } catch (e) {
      setTests((t) => {
        const { [key]: _, ...rest } = t;
        return isStopped(e) ? rest : { ...rest, [key]: { error: errorText(e) } };
      });
    } finally {
      if (--live.current === 0) {
        pool.terminate();
        if (poolRef.current === pool) poolRef.current = null;
      }
    }
  };
  const save = (b: Bred) => {
    const name = customSaveName(b.deck.name, lib) ?? b.deck.name;
    upsertCustom({ ...b.deck, name, sideboard: [] });
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
        <div className="row">
          <button className="primary" onClick={breed}>
            🧬 Breed {n} decks
          </button>
          <span className="small muted">
            {h2h === 'loading' ? (
              'Loading tournament head-to-heads…'
            ) : h2hReady ? (
              <>
                <b>Counter decks on</b>: built against the current top decks from {h2hReady.games.toLocaleString()} head-to-head games ({h2hReady.events} events).
                {stale && (
                  <span style={{ color: 'var(--accent)' }}>
                    {' '}
                    ⚠ {recorded - h2hReady.events} newer event(s) aren't included yet — rebuild with <code>npm run build-h2h</code> (runs automatically after every tournament series).
                  </span>
                )}
              </>
            ) : (
              <>
                <b>Counter decks off</b>: the head-to-head data hasn't been built. Run <code>npm run build-h2h</code> (or any tournament series) and republish.
              </>
            )}
          </span>
        </div>
      </div>
      {bred.length > 0 && (
        <div className="deck-grid">
          {bred.map((b) => {
            const t = tests[b.deck.name];
            const saved = savedAs[b.deck.name];
            return (
            <div key={b.deck.name} className="panel grid" style={{ padding: 10 }}>
              <DeckTile d={asLib(b)} />
              <div className="small">
                <span className="tag">{b.method}</span> <span className="muted">{b.idea}</span>
              </div>
              <div className="row small">
                <button onClick={() => test(b)} disabled={t === 'running'}>
                  {t === 'running' ? 'Testing…' : '▶ Quick test vs meta'}
                </button>
                {typeof t === 'number' && (
                  <span>
                    <Wr v={t} n={QUICK_TEST_GAMES} strong /> vs meta
                  </span>
                )}
                {t && typeof t === 'object' && <span style={{ color: 'var(--red)' }}>⚠ Test failed: {t.error}</span>}
              </div>
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
