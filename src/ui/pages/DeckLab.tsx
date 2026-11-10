// Deck Lab: submit a deck to be tuned for the meta, or breed new decks — all in the browser, using the trainer's own
// methods (forge swaps confirmed on fresh games; data-driven breeding). Results can be saved to "My decks".
import { useEffect, useMemo, useRef, useState } from 'react';
import { allDecks, upsertCustom } from '../../lib/browserLibrary';
import type { LibraryDeck } from '../../lib/library';
import { counts, exportOfficial, parseDeck, validateDeck } from '../../engine/deck';
import { CARD_BY_ID, cardLabel } from '../../engine/cards';
import type { DeckList } from '../../engine/types';
import { breedInBrowser, playSet, tuneDeck, type TuneProgress } from '../../lib/deckLab';
import type { Bred } from '../../ai/breeder';
import { GamePool, defaultThreads } from '../../sim/pool';
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
const EFFORT = {
  quick: { label: 'Quick (~2 min)', games: 28, gens: 1, cands: 4 },
  standard: { label: 'Standard (~6 min)', games: 56, gens: 2, cands: 5 },
  thorough: { label: 'Thorough (~15 min)', games: 84, gens: 3, cands: 6 },
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
  return (
    <div className="grid">
      <div className="spread">
        <h1 style={{ margin: 0 }}>Deck Lab</h1>
        <div className="seg">
          <button className={tab === 'tune' ? 'on' : ''} onClick={() => setTab('tune')}>
            🔧 Tune a deck
          </button>
          <button className={tab === 'breed' ? 'on' : ''} onClick={() => setTab('breed')}>
            🧬 Breed new decks
          </button>
        </div>
      </div>
      {tab === 'tune' ? (
        <TunePanel initialFile={q.get('d') ?? undefined} handoff={handoff} />
      ) : (
        <BreedPanel
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
function TunePanel({ initialFile, handoff }: { initialFile?: string; handoff: DeckList | null }) {
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
  const stopRef = useRef(false);
  const poolRef = useRef<GamePool | null>(null);
  useEffect(() => () => poolRef.current?.terminate(), []);
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
    try {
      await tuneDeck(deck, fieldList, { games: e.games, gens: e.gens, cands: e.cands, bot, minGain: 0.02 }, pool.play, setProg, () => stopRef.current);
    } catch {
      /* stopped */
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
    const name = finalDeck.name.endsWith('(tuned)') ? finalDeck.name : `${finalDeck.name} (tuned)`;
    upsertCustom({ ...finalDeck, name, sideboard: finalDeck.sideboard ?? [] });
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
            <h3 style={{ margin: 0 }}>{running ? 'Tuning…' : prog.phase === 'Stopped' ? 'Stopped' : 'Tuning finished'}</h3>
            <span className="small muted">{prog.phase}</span>
          </div>
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
          {!running && finalDeck && (
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
function BreedPanel({ onTune }: { onTune: (d: DeckList) => void }) {
  const lib = useMemo(() => allDecks(), []);
  const [n, setN] = useState(6);
  const [seed, setSeed] = useState(() => Math.floor(Math.random() * 900) + 100);
  const [parents, setParents] = useState<string[]>([]);
  const [pickFile, setPickFile] = useState(lib[0].file);
  const [bred, setBred] = useState<(Bred & { test?: number | 'running'; saved?: boolean })[]>([]);
  const poolRef = useRef<GamePool | null>(null);
  useEffect(() => () => poolRef.current?.terminate(), []);

  const breed = () => setBred(breedInBrowser(lib, { n, seed, parents }));
  const test = async (k: number) => {
    const b = bred[k];
    setBred((xs) => xs.map((x, i) => (i === k ? { ...x, test: 'running' } : x)));
    poolRef.current ??= new GamePool(defaultThreads());
    const field = lib.filter((d) => d.kind === 'meta').map((d) => d.deck);
    const r = await playSet(b.deck, field, 77_000 + k * 1000, 28, 'medium', poolRef.current.play, false);
    setBred((xs) => xs.map((x, i) => (i === k ? { ...x, test: r.wr } : x)));
  };
  const save = (k: number) => {
    upsertCustom({ ...bred[k].deck, sideboard: [] });
    setBred((xs) => xs.map((x, i) => (i === k ? { ...x, saved: true } : x)));
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
          <span className="small muted">Counter decks (built against the current top decks) need the tournament head-to-heads and are bred by the CLI seasons.</span>
        </div>
      </div>
      {bred.length > 0 && (
        <div className="deck-grid">
          {bred.map((b, k) => (
            <div key={b.deck.name} className="panel grid" style={{ padding: 10 }}>
              <DeckTile d={asLib(b)} />
              <div className="small">
                <span className="tag">{b.method}</span> <span className="muted">{b.idea}</span>
              </div>
              <div className="row small">
                <button onClick={() => test(k)} disabled={b.test === 'running'}>
                  {b.test === 'running' ? 'Testing…' : '▶ Quick test vs meta'}
                </button>
                {typeof b.test === 'number' && (
                  <span>
                    <Wr v={b.test} n={28} strong /> vs meta
                  </span>
                )}
              </div>
              <div className="row small">
                <button onClick={() => save(k)} disabled={b.saved}>
                  {b.saved ? '✓ Saved' : '💾 Save'}
                </button>
                <button onClick={() => onTune(b.deck)}>🔧 Tune it</button>
              </div>
            </div>
          ))}
        </div>
      )}
    </>
  );
}
