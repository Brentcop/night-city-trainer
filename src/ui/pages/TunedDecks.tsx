// #/tuned: every deck tuned in the Deck Lab and saved in this browser, newest first, with its end result: the verdict
// against the original in the Lab's words (the paired gain on the same held-out games), each adopted change with its
// held-out figure, the generations run and the run's field, bot and rule. Sort and filter by verdict, original and date;
// Export all / Import move them between browsers (they live in this browser's storage). Tuned decks committed to the
// repository by the CLI forge are library decks; their forge lines are listed read-only at the end.
import { useId, useMemo, useRef, useState } from 'react';
import { CARD_BY_ID } from '../../engine/cards';
import { exportOfficial } from '../../engine/deck';
import type { CardDef } from '../../engine/types';
import { addCustomDecks, allDecks, BUILTIN, forgedBuiltins, loadStored } from '../../lib/browserLibrary';
import { parseSwap } from '../../lib/deckCards';
import { download } from '../../lib/download';
import type { LibraryDeck } from '../../lib/library';
import {
  applyTunedFilter,
  DEFAULT_TUNED_FILTER,
  importReport,
  parseForged,
  planImport,
  ruleLine,
  TUNED_SORT_LABEL,
  tunedEntries,
  tunedExport,
  tunedSummary,
  tunedWithoutRecord,
  VERDICT_WORD,
  VERDICTS,
  verdictLine,
  verdictOf,
  verdictTone,
  type TunedEntry,
  type TunedFilter,
  type TunedSort,
} from '../../lib/tunedDecks';
import { CardNameButton, CardThumb, useCardDialog } from '../components/DeckCards';
import { PageHead } from '../components/PageHead';
import { RecordedAt } from '../components/RecordedAt';
import { RunDetails } from '../components/RunDetails';
import { PairedGain } from '../components/LabEvidence';
import { Signed, Wr } from '../components/Num';
import { profileHref } from '../components/DeckStats';
import { ColorPips } from '../components/DeckIdentity';
import { useDeckActions } from '../components/DeckActions';
import { deckByFile } from '../deckLookup';
import { useLibraryVersion } from '../useLibrary';
import '../deckprofile.css';

const FIELD_WORDS: Record<string, string> = { meta: 'the choom.gg meta', 'meta+ladder': 'the meta and the sim ladder', top8: 'the top 8 rated decks' };
const fieldWords = (mode: string) => {
  const k = mode.replace(/^deck-lab-tune:/, '');
  return FIELD_WORDS[k] ?? k;
};
const fileName = (name: string) => name.replace(/[^\w-]+/g, '_');

/** One adopted change: the cards it swaps (thumbnails and names), its package tag and its held-out gain. */
function ChangeRow({ c, onOpen }: { c: TunedEntry['record']['changes'][number]; onOpen: (d: CardDef) => void }) {
  const parts = c.label.split(/ \+ (?=[−-]1 )/);
  return (
    <li className="tuned-change">
      <span className="muted small">gen {c.gen}</span>
      {c.package && <span className="tag">package · {c.package}</span>}
      <span className="tuned-swaps">
        {parts.map((p) => {
          const sw = parseSwap(p);
          const out = sw.out ? CARD_BY_ID[sw.out] : undefined;
          const inn = sw.in ? CARD_BY_ID[sw.in] : undefined;
          if (!out || !inn) return <span key={p}>{p}</span>;
          return (
            <span key={p} className="lab-swap">
              <CardThumb def={out} onOpen={onOpen} />
              <span>
                −1 <CardNameButton def={out} onOpen={onOpen} />
              </span>
              <span aria-hidden="true">→</span>
              <span className="sr-only">replaced by</span>
              <CardThumb def={inn} onOpen={onOpen} />
              <span>
                +1 <CardNameButton def={inn} onOpen={onOpen} />
              </span>
            </span>
          );
        })}
      </span>
      <span className="small">{c.heldOut ? <>held-out <PairedGain g={c.heldOut} /></> : <span className="muted">held-out gain not recorded</span>}</span>
    </li>
  );
}

/** A tuned deck's card on the page. */
export function TunedDeckCard({ e, lib, onDelete, onOpen }: { e: TunedEntry; lib: readonly LibraryDeck[]; onDelete: () => void; onOpen: (d: CardDef) => void }) {
  const r = e.record;
  const d = e.deck;
  const k = verdictOf(r);
  const orig = r.original.file ? deckByFile(lib, r.original.file) : undefined;
  const enc = encodeURIComponent(d.file);
  const titleId = useId();
  return (
    <article className="panel tuned-card" aria-labelledby={titleId}>
      <div className="spread">
        <h2 id={titleId} className="tuned-name">
          <ColorPips legends={d.deck.legends} /> <a href={profileHref(d.file)}>{d.deck.name}</a>
        </h2>
        <span className={`verdict ${verdictTone(k)}`} title="The tuned list against the original, on the same held-out games">
          {VERDICT_WORD[k]}
        </span>
      </div>
      <div className="small">
        Tuned from{' '}
        {orig ? (
          <a href={profileHref(orig.file)}>{r.original.name}</a>
        ) : (
          <b title={r.original.file ? 'That deck is no longer in the library' : 'Pasted into the Lab, not a library deck'}>{r.original.name}</b>
        )}
        <RecordedAt iso={r.date} prefix=" · " className="muted" />
      </div>
      <p className="tuned-verdict" style={{ margin: 0 }}>
        <b>Against the original:</b> {verdictLine(r)}
        {r.vsOriginal?.origWr !== undefined && r.vsOriginal.finalWr !== undefined && (
          <span className="muted small">
            {' '}
            (original <Wr v={r.vsOriginal.origWr} n={r.vsOriginal.gain?.games} /> → tuned <Wr v={r.vsOriginal.finalWr} n={r.vsOriginal.gain?.games} /> on the same games)
          </span>
        )}
      </p>
      <div className="small muted">
        {r.generations.run} of {r.generations.planned} generation{r.generations.planned === 1 ? '' : 's'} run · {r.changes.length} change{r.changes.length === 1 ? '' : 's'} adopted
        {r.partial && (
          <>
            {' '}
            · <span className="tag">partial: stopped before it finished</span>
          </>
        )}
      </div>
      {r.changes.length > 0 && <ul className="tuned-changes">{r.changes.map((c) => <ChangeRow key={`${c.gen}:${c.label}`} c={c} onOpen={onOpen} />)}</ul>}
      <RunDetails m={d.manifest}>
        <div>
          Field: {fieldWords(r.field.mode)} ({r.field.deckIds.length} deck{r.field.deckIds.length === 1 ? '' : 's'}) · bot {r.bot} · partner-aware cuts {r.partnerAware ? 'on' : 'off'}
          {r.packages ? ' · package plan saved with the run' : ''}
        </div>
        <div>Rule: {ruleLine(r)}</div>
        {r.vsOriginal && <div>Shown better needs the lower bound above {r.vsOriginal.minGainPp} pt{r.vsOriginal.minGainPp === 1 ? '' : 's'}.</div>}
      </RunDetails>
      <div className="row">
        <a className="btn" href={profileHref(d.file)}>
          📊 Profile
        </a>
        <a className="btn" href={`#/lab?d=${enc}`}>
          🔧 Re-tune in the Lab
        </a>
        <button onClick={() => download(`${fileName(d.deck.name)}.txt`, exportOfficial(d.deck))}>⤓ Export list</button>
        <button className="danger-soft" onClick={onDelete}>
          🗑 Delete
        </button>
      </div>
    </article>
  );
}

function Stat({ label, value, children }: { label: string; value: React.ReactNode; children?: React.ReactNode }) {
  return (
    <div className="rec-tile">
      <div className="rec-tile-label">{label}</div>
      <div className="rec-tile-val">{value}</div>
      {children && <div className="rec-tile-cap">{children}</div>}
    </div>
  );
}

export function TunedDecksPage() {
  useLibraryVersion();
  const lib = allDecks();
  const entries = useMemo(() => tunedEntries(lib), [lib]);
  const legacy = useMemo(() => tunedWithoutRecord(lib), [lib]);
  const forged = useMemo(() => forgedBuiltins(), []);
  const [f, setF] = useState<TunedFilter>(DEFAULT_TUNED_FILTER);
  const [msg, setMsg] = useState('');
  const fileRef = useRef<HTMLInputElement>(null);
  const actions = useDeckActions();
  const { open, dialog } = useCardDialog();
  const shown = applyTunedFilter(entries, f);
  const sum = tunedSummary(entries);
  const originals = [...new Set(entries.map((e) => e.record.original.name))].sort();
  const count = (k: (typeof VERDICTS)[number]) => entries.filter((e) => verdictOf(e.record) === k).length;

  const exportAll = () => {
    download(`tuned-decks-${new Date().toISOString().slice(0, 10)}.json`, JSON.stringify(tunedExport(entries), null, 1), 'application/json');
    setMsg(`Exported ${entries.length} tuned deck${entries.length === 1 ? '' : 's'} with their records and run manifests.`);
  };
  const importFile = async (file: File | undefined) => {
    if (!file) return;
    let text: string;
    try {
      text = await file.text();
    } catch {
      setMsg('Nothing imported: the file could not be read.');
      return;
    }
    const plan = planImport(text, loadStored(), new Set(BUILTIN.map((d) => d.deck.name)));
    if (plan.add.length && !addCustomDecks(plan.add)) {
      setMsg('Nothing imported: this browser’s storage is full or blocked.');
      return;
    }
    setMsg(importReport(plan));
  };

  return (
    <div className="grid">
      <PageHead
        kicker="Decks"
        title="Tuned decks"
        actions={
          <>
            <button onClick={exportAll} disabled={!entries.length} title="A JSON file of every tuned deck here, with its record and run manifest">
              ⤓ Export all
            </button>
            <button onClick={() => fileRef.current?.click()}>⤒ Import</button>
            <input
              ref={fileRef}
              type="file"
              accept="application/json,.json"
              hidden
              aria-label="Import tuned decks file"
              onChange={(e) => {
                void importFile(e.target.files?.[0]);
                e.target.value = '';
              }}
            />
            <a className="btn primary" href="#/lab">
              🔧 Tune a deck
            </a>
          </>
        }
      >
        Every deck tuned in the <a href="#/lab">Deck Lab</a> and saved in this browser, newest first, with its end result: whether the tuned list is shown better than the original on the same
        held-out games, and each change it adopted. Tuned decks live in this browser’s storage: <b>Export all</b> keeps them, <b>Import</b> brings them into another browser.
      </PageHead>
      {msg && (
        <div className="panel small" role="status">
          {msg}
        </div>
      )}
      {entries.length > 0 && (
        <div className="rec-tiles tuned-summary">
          <Stat label="Tuned decks" value={sum.total}>
            saved in this browser
          </Stat>
          <Stat label="Shown better" value={sum.better}>
            {sum.total ? `of ${sum.total}: the lower bound of the gain clears the bar` : ''}
          </Stat>
          <Stat label="Median gain (shown better)" value={sum.medianGain === null ? '—' : <Signed v={sum.medianGain} unit=" pts" />}>
            vs the original, same held-out games
          </Stat>
        </div>
      )}
      {legacy.length > 0 && (
        <p className="small muted" role="note">
          {legacy.length} saved deck{legacy.length === 1 ? '' : 's'} named like Lab output ({legacy.slice(0, 3).map((d) => `“${d.deck.name}”`).join(', ')}
          {legacy.length > 3 ? ', …' : ''}) {legacy.length === 1 ? 'was' : 'were'} tuned before the Lab kept a tuning record, so {legacy.length === 1 ? 'it is' : 'they are'} not listed here. {legacy.length === 1 ? 'It is' : 'They are'} in{' '}
          <a href="#/decks?src=tuned">the deck library</a>.
        </p>
      )}
      {entries.length === 0 ? (
        <div className="empty-state">
          <h2>No tuned decks in this browser yet</h2>
          <p>
            Open the <a href="#/lab">Deck Lab</a>, pick a deck and press <b>Tune</b>. When the run finishes, <b>Save to My decks</b> keeps the tuned list with its result, and it shows up here. A tuned deck
            saved in another browser can be brought here with that browser’s <b>Export all</b> and <b>Import</b> on this page.
          </p>
        </div>
      ) : (
        <div className="panel">
          <div className="gal-filters" role="group" aria-label="Verdict">
            <span className="small muted">Verdict</span>
            {VERDICTS.filter((k) => count(k) > 0 || f.verdicts.includes(k)).map((k) => (
              <button
                key={k}
                type="button"
                className={`chip-btn ${f.verdicts.includes(k) ? 'on' : ''}`}
                aria-pressed={f.verdicts.includes(k)}
                onClick={() => setF({ ...f, verdicts: f.verdicts.includes(k) ? f.verdicts.filter((x) => x !== k) : [...f.verdicts, k] })}
              >
                {VERDICT_WORD[k]} <span className="muted">({count(k)})</span>
              </button>
            ))}
          </div>
          <div className="gal-filters" style={{ marginTop: 6 }}>
            <select aria-label="Original deck" value={f.original} onChange={(e) => setF({ ...f, original: e.target.value })} style={{ maxWidth: 280, minWidth: 0 }}>
              <option value="">Any original deck</option>
              {originals.map((n) => (
                <option key={n} value={n}>
                  {n}
                </option>
              ))}
            </select>
            <select aria-label="Sort tuned decks" value={f.sort} onChange={(e) => setF({ ...f, sort: e.target.value as TunedSort })}>
              {(Object.keys(TUNED_SORT_LABEL) as TunedSort[]).map((s) => (
                <option key={s} value={s}>
                  Sort: {TUNED_SORT_LABEL[s]}
                </option>
              ))}
            </select>
            <span className="small muted" role="status" aria-live="polite">
              {shown.length === entries.length ? `${entries.length} tuned` : `${shown.length} of ${entries.length} tuned`}
            </span>
            {(f.verdicts.length > 0 || f.original) && (
              <button type="button" className="ghost small" onClick={() => setF({ ...DEFAULT_TUNED_FILTER, sort: f.sort })}>
                Clear filters
              </button>
            )}
          </div>
        </div>
      )}
      {entries.length > 0 && shown.length === 0 && <div className="empty-state">No tuned deck matches these filters.</div>}
      {shown.map((e) => (
        <TunedDeckCard key={e.deck.file} e={e} lib={lib} onDelete={() => actions.askDelete([e.deck])} onOpen={open} />
      ))}
      {forged.length > 0 && (
        <section className="panel" aria-labelledby="tuned-forged">
          <h2 id="tuned-forged" className="rule-head" style={{ marginTop: 0 }}>
            Forged in the repository
          </h2>
          <p className="small muted">
            Library decks the command-line forge tuned and committed (read-only here). Each line is the deck file’s forge record; newer forge runs also write each change’s held-out paired gain
            and the adoption rule.
          </p>
          <ul className="tuned-forged">
            {forged.map((x) => {
              const d = deckByFile(lib, x.file);
              const p = parseForged(x.forged);
              return (
                <li key={x.file}>
                  <a href={profileHref(x.file)}>{d?.deck.name ?? x.file}</a>
                  {p ? (
                    <>
                      <span className="muted small"> · forged {p.date}</span>
                      <ul className="small">
                        {p.changes.map((c) => (
                          <li key={c.label}>
                            {c.label} {c.heldOut ? <span className="muted">(held-out {c.heldOut})</span> : <span className="muted">(no held-out figure recorded: an older forge run)</span>}
                          </li>
                        ))}
                      </ul>
                    </>
                  ) : (
                    <span className="small muted"> · {x.forged}</span>
                  )}
                  {x.adoption && <div className="small muted">Adoption: {x.adoption}</div>}
                </li>
              );
            })}
          </ul>
        </section>
      )}
      {dialog}
      {actions.ui}
    </div>
  );
}
