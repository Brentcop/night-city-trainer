// #/admin, "Import decks" (docs/DECK_IMPORT.md): paste shared links, read the ones that carry their list in the address
// at once, get the command for the owner's script (tools/import_decks.py) for the rest, load the script's output, and
// preview every deck before adding it to My decks or downloading it for the library. All the import logic is in
// src/lib/deckImport.ts, shared with the command-line step (scripts/import-links.ts). Loaded on its own (lazy) from the
// admin page, because it needs the card data. A deck's name and author are other people's text: shown as plain text,
// never through the card-name matcher.
import { useId, useMemo, useState } from 'react';
import { CARD_BY_ID, cardLabel } from '../../engine/cards';
import {
  buildDeck,
  deckFileName,
  deckFileProblem,
  deckFileText,
  holderWords,
  IMPORT_FILE,
  importDocument,
  readImport,
  sameListHolders,
  scriptCommand,
  SCRIPT,
  sortLinks,
  type Holder,
  type ImportedDeck,
  type RawDeck,
  type ReadResult,
  type SortedLink,
} from '../../lib/deckImport';
import { addCustomDecks, allDecks, type StoredDeck } from '../../lib/browserLibrary';
import type { LibraryDeck } from '../../lib/library';
import { download } from '../../lib/download';
import { customSaveName } from '../deckLookup';
import { useLibraryVersion } from '../useLibrary';
import { CardMention } from './CardMention';

/** The file the "for the command line" download saves (read by scripts/import-links.ts). */
export const CHOSEN_FILE = 'deck-import-chosen.json';
/** The largest file the picker reads (the reader refuses a longer text anyway). */
const FILE_MAX_BYTES = 8_000_000;

const KIND_LABEL: Record<SortedLink['kind'], string> = { decoded: 'Read here', script: 'Needs the script', refused: 'Refused' };

/** One deck of the preview: where it came from and what was built from it. */
export interface PreviewDeck {
  key: string;
  from: 'link' | 'file';
  built: ImportedDeck;
  holder: Holder | null;
  /** why its library file would not read back the same, or '' */
  fileProblem: string;
}

/** What may be done with a deck: added to My decks (no other deck has its list), or written for the library. */
export const canSave = (p: PreviewDeck) => p.built.ready && !p.holder;
export const canFile = (p: PreviewDeck) => p.built.ready && (!p.holder || p.holder.where === 'saved') && !p.fileProblem;

/** Why a deck cannot be added or downloaded, in words ('' when it can be both). */
export function blockedWords(p: PreviewDeck): string {
  if (p.built.unmatched.length) return 'Not addable: some cards could not be matched.';
  if (p.built.illegal.length) return 'Not addable: the list is not legal.';
  if (p.holder?.where === 'saved') return 'Already in My decks; it can still be downloaded for the library.';
  if (p.holder) return 'Not addable: this list is there already.';
  if (p.fileProblem) return `Can be added to My decks, not downloaded: ${p.fileProblem}`;
  return '';
}

/** The decks to preview: the links read here first, then the loaded file's, each with its checks against the library. */
export function previewDecks(pasted: readonly RawDeck[], loaded: readonly RawDeck[], names: Readonly<Record<string, string>>, library: readonly LibraryDeck[], date: string): PreviewDeck[] {
  const entries = [...pasted.map((raw, i) => ({ key: `link:${i}:${raw.source.link}`, from: 'link' as const, raw })), ...loaded.map((raw, i) => ({ key: `file:${i}:${raw.source.link}`, from: 'file' as const, raw }))];
  const built = entries.map((e) => buildDeck(names[e.key] !== undefined ? { ...e.raw, name: names[e.key]! } : e.raw));
  const holders = sameListHolders(built, library);
  return entries.map((e, i) => {
    const b = built[i]!;
    const file = deckFileName(b.deck.name);
    return { key: e.key, from: e.from, built: b, holder: holders[i] ?? null, fileProblem: b.ready ? deckFileProblem(file, deckFileText(b, date), b) : '' };
  });
}

/** One line crediting where a deck saved here came from (kept in the saved deck's notes). */
export function creditLine(raw: RawDeck): string {
  const s = raw.source;
  return [`Imported from ${s.site || 'a shared link'}`, raw.author && `by ${raw.author}`, s.placement && `placed ${s.placement}`, s.page && `on “${s.page}”`].filter(Boolean).join(', ') + '.';
}

/**
 * The decks to save in this browser: each under a free name (not a built-in deck's, not a saved deck's, not another of
 * these), recorded as imported, with its source link and a credit line.
 */
export function storedDecks(chosen: readonly PreviewDeck[], library: readonly LibraryDeck[]): StoredDeck[] {
  const taken = new Set(library.filter((d) => d.file.startsWith('custom:')).map((d) => d.deck.name));
  return chosen.map((p) => {
    const base = customSaveName(p.built.deck.name, library) ?? 'Imported deck';
    let name = base;
    for (let k = 2; taken.has(name); k++) name = `${base} (${k})`;
    taken.add(name);
    const { legends, main, sideboard } = p.built.deck;
    const deck: StoredDeck = { name, legends: [...legends], main: [...main], sideboard: [...sideboard], notes: creditLine(p.built.raw), origin: 'imported' };
    if (p.built.raw.source.link) deck.source = p.built.raw.source.link;
    return deck;
  });
}

const today = () => new Date().toISOString().slice(0, 10);

function Copyable({ text, label }: { text: string; label: string }) {
  const [shown, setShown] = useState(false);
  const [said, setSaid] = useState('');
  return (
    <div className="grid">
      <pre className="deck-import-cmd" aria-label={label}>
        <code>{text}</code>
      </pre>
      <div className="row">
        <button
          type="button"
          onClick={() => {
            navigator.clipboard.writeText(text).then(
              () => setSaid('Copied.'),
              () => setShown(true),
            );
          }}
        >
          Copy the command
        </button>
        <span className="small muted" role="status" aria-live="polite">
          {said}
        </span>
      </div>
      {shown && <textarea readOnly rows={3} value={text} aria-label={`${label}, to copy by hand`} onFocus={(e) => e.currentTarget.select()} />}
    </div>
  );
}

function LinkRow({ s }: { s: SortedLink }) {
  return (
    <li className={`deck-import-link is-${s.kind}`}>
      <span className="deck-import-chip">{KIND_LABEL[s.kind]}</span> <span className="deck-import-url">{s.link}</span>
      <div className="small muted">{s.why}</div>
    </li>
  );
}

function DeckCard({ p, index, chosen, onChoose, name, onName, names }: { p: PreviewDeck; index: number; chosen: boolean; onChoose: (v: boolean) => void; name: string; onName: (v: string) => void; names: readonly string[] }) {
  const id = useId();
  const { built, holder } = p;
  const raw = built.raw;
  const s = raw.source;
  const blocked = blockedWords(p);
  const any = canSave(p) || canFile(p);
  return (
    <li className="deck-import-deck">
      <div className="admin-row">
        <input type="checkbox" aria-label={`Choose deck ${index + 1}`} checked={chosen && any} disabled={!any} onChange={(e) => onChoose(e.target.checked)} />
        <label htmlFor={id} className="small muted">
          Deck {index + 1}
        </label>
        <input id={id} type="text" maxLength={80} value={name} onChange={(e) => onName(e.target.value)} />
      </div>
      <div className="small">
        {raw.author ? <>By {raw.author}. </> : <span className="muted">No author named. </span>}
        {s.site || 'Unknown site'}
        {s.placement && <>, placed {s.placement}</>}
        {s.page && <>, from “{s.page}”</>}
        {s.date && <> ({s.date.slice(0, 10)})</>}
        {s.link && (
          <>
            {' '}
            <a href={s.link} target="_blank" rel="noopener noreferrer nofollow">
              source link
            </a>
          </>
        )}
      </div>
      <div className="small">
        Legends:{' '}
        {built.deck.legends.length
          ? built.deck.legends.map((cid, k) => (
              <span key={k}>
                {k > 0 && ' / '}
                <CardMention id={cid}>{cardLabel(CARD_BY_ID[cid]!)}</CardMention>
              </span>
            ))
          : 'none matched'}
        . Main deck {built.deck.main.length}, sideboard {built.deck.sideboard.length}.
      </div>
      {built.illegal.length === 0 && built.unmatched.length === 0 ? (
        <div className="small">Legal list.</div>
      ) : (
        <ul className="small admin-err">
          {built.unmatched.map((u, k) => (
            <li key={`u${k}`}>Not matched: {u}</li>
          ))}
          {built.illegal.map((u, k) => (
            <li key={`i${k}`}>Not legal: {u}</li>
          ))}
        </ul>
      )}
      {raw.notes.length > 0 && <div className="small muted">Not understood in the link or page: {raw.notes.join('; ')}.</div>}
      {holder && <div className="small">{holderWords(holder, names)}</div>}
      {blocked && <div className="small muted">{blocked}</div>}
      {canFile(p) && (
        <button type="button" className="ghost small" onClick={() => download(deckFileName(built.deck.name), deckFileText(built, today()))}>
          Download {deckFileName(built.deck.name)}
        </button>
      )}
    </li>
  );
}

/** `initialLinks` and `initialFile` start the section with pasted links and a loaded file, `library` replaces the library (tests). */
export function AdminDeckImport({ initialLinks = '', initialFile, library: given }: { initialLinks?: string; initialFile?: { name: string; result: ReadResult }; library?: readonly LibraryDeck[] }) {
  const linksId = useId();
  const fileId = useId();
  useLibraryVersion(); // re-render after a save, delete or hide (here or in another tab)
  const [links, setLinks] = useState(initialLinks);
  const [file, setFile] = useState<{ name: string; result: ReadResult } | null>(initialFile ?? null);
  const [names, setNames] = useState<Record<string, string>>({});
  const [chosen, setChosen] = useState<Record<string, boolean>>({});
  const [status, setStatus] = useState('');

  const sorted = useMemo(() => sortLinks(links), [links]);
  const script = sorted.filter((s) => s.kind === 'script').map((s) => s.link);
  const library = given ?? allDecks(); // the same (cached) list until a deck is saved, deleted or hidden, here or in another tab
  const pasted = useMemo(() => sorted.flatMap((s) => (s.kind === 'decoded' ? [s.deck] : [])), [sorted]);
  const loaded = useMemo(() => (file?.result.ok ? file.result.doc.decks : []), [file]);
  const preview = useMemo(() => previewDecks(pasted, loaded, names, library, today()), [pasted, loaded, names, library]);
  const deckNames = preview.map((p) => p.built.deck.name);
  const picked = preview.filter((p) => chosen[p.key] ?? true);
  const toSave = picked.filter(canSave);
  const toFile = picked.filter(canFile);

  const onFile = async (f: File | undefined) => {
    if (!f) return;
    setStatus('');
    if (f.size > FILE_MAX_BYTES) {
      setFile({ name: f.name, result: { ok: false, why: 'This file is too large to be a deck-import file.' } });
      return;
    }
    setFile({ name: f.name, result: readImport(await f.text()) });
  };
  const addToMyDecks = () => {
    const decks = storedDecks(toSave, library);
    if (!addCustomDecks(decks)) {
      setStatus('Not saved: this browser’s storage is full or blocked.');
      return;
    }
    setStatus(`Added ${decks.length === 1 ? `“${decks[0]!.name}”` : `${decks.length} decks`} to My decks.`);
  };
  const downloadFiles = () => {
    toFile.forEach((p, i) => setTimeout(() => download(deckFileName(p.built.deck.name), deckFileText(p.built, today())), i * 400));
    setStatus(`Downloading ${toFile.length} deck file${toFile.length === 1 ? '' : 's'}. Put them in data/decks/, then follow the steps in docs/DECK_IMPORT.md (each needs a deck note).`);
  };
  const downloadForCli = () => {
    const raws = toFile.map((p) => ({ ...p.built.raw, name: p.built.deck.name }));
    download(CHOSEN_FILE, `${JSON.stringify(importDocument(raws, new Date().toISOString()), null, 2)}\n`, 'application/json');
    setStatus(`Saved ${CHOSEN_FILE} where this browser keeps downloads. Move it to the repository folder (or give its path), and run there: npx tsx scripts/import-links.ts ${CHOSEN_FILE} --write`);
  };

  return (
    <div className="grid deck-import">
      <p className="small">
        Import decks other players shared on choom.gg or cyberpunk-tcg-sim.online. A deck-builder link of cyberpunk-tcg-sim.online carries its whole list, so it is read here at once. Any other page
        (a choom.gg deck page, the choom.gg deck list, a tournament or season report) is read by a small script that runs on your own machine: it reads those public pages on the two sites, a few at a
        time, with a pause between requests, and writes one file you load below. Nothing here changes the site config.
      </p>

      <div className="admin-field">
        <label htmlFor={linksId}>Links (one per line)</label>
        <textarea id={linksId} rows={4} value={links} spellCheck={false} placeholder="https://choom.gg/decks/…" onChange={(e) => setLinks(e.target.value)} />
      </div>
      {sorted.length > 0 && (
        <ul className="deck-import-links">
          {sorted.map((s) => (
            <LinkRow key={s.link} s={s} />
          ))}
        </ul>
      )}
      {script.length > 0 && (
        <div className="grid">
          <p className="small">
            {script.length === 1 ? 'This link needs' : `These ${script.length} links need`} the script. In a terminal in the repository folder (Python 3.9 or later, nothing to install; on Windows <code>py</code>{' '}
            works in place of <code>python</code>), run:
          </p>
          <Copyable text={scriptCommand(script)} label="The command to run" />
          <p className="small muted">
            It writes <code>{IMPORT_FILE}</code> in that folder (it will not replace one that is there: add <code>--force</code>, or <code>--out</code> another name). Then load it below.{' '}
            <code>{SCRIPT}</code> --help says more.
          </p>
        </div>
      )}

      <div className="admin-field">
        <label htmlFor={fileId}>Load the script’s output</label>
        <input id={fileId} type="file" accept=".json,application/json" onChange={(e) => void onFile(e.target.files?.[0])} />
      </div>
      {file && !file.result.ok && (
        <p className="small admin-err" role="alert">
          {file.name}: {file.result.why}
        </p>
      )}
      {file?.result.ok && (
        <div className="small">
          <b>{file.name}</b>: {file.result.doc.decks.length} deck{file.result.doc.decks.length === 1 ? '' : 's'}
          {file.result.doc.ran && <>, collected {file.result.doc.ran.slice(0, 16).replace('T', ' ')}</>}.
          {file.result.warnings.map((w, i) => (
            <div key={i} className="admin-err">
              {w}
            </div>
          ))}
          {file.result.doc.links.length > 0 && (
            <ul className="deck-import-links">
              {file.result.doc.links.map((l, i) => (
                <li key={i}>
                  <span className="deck-import-chip">{l.status || 'unknown'}</span> <span className="deck-import-url">{l.link}</span>: {l.decks} deck{l.decks === 1 ? '' : 's'}
                  {l.note && <span className="muted"> ({l.note})</span>}
                </li>
              ))}
            </ul>
          )}
        </div>
      )}

      {preview.length > 0 && (
        <>
          <h3 className="deck-import-head">
            {preview.length} deck{preview.length === 1 ? '' : 's'} to look over
          </h3>
          <ol className="deck-import-decks">
            {preview.map((p, i) => (
              <DeckCard
                key={p.key}
                p={p}
                index={i}
                names={deckNames}
                chosen={chosen[p.key] ?? true}
                onChoose={(v) => setChosen((c) => ({ ...c, [p.key]: v }))}
                name={names[p.key] ?? p.built.deck.name}
                onName={(v) => setNames((n) => ({ ...n, [p.key]: v }))}
              />
            ))}
          </ol>
          <div className="row">
            <button type="button" className="primary" disabled={!toSave.length} onClick={addToMyDecks}>
              Add to My decks ({toSave.length})
            </button>
            <button type="button" disabled={!toFile.length} onClick={downloadFiles}>
              Download deck files ({toFile.length})
            </button>
            <button type="button" disabled={!toFile.length} onClick={downloadForCli}>
              Download for the command line
            </button>
            <span className="small muted" role="status" aria-live="polite">
              {status}
            </span>
          </div>
          <p className="small muted">
            My decks are kept in this browser only. For the library, either put the downloaded .txt files in <code>data/decks/</code>, or save {CHOSEN_FILE}, move it to the repository folder and run{' '}
            <code>npx tsx scripts/import-links.ts {CHOSEN_FILE} --write</code> there, which also adds the deck note each library deck needs. docs/DECK_IMPORT.md lists the rest.
          </p>
        </>
      )}
    </div>
  );
}
