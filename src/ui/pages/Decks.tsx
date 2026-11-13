// #/decks: the deck library gallery, or (with a deck in the URL or "New") the editor workbench.
import { useEffect, useState } from 'react';
import { deckColors, exportChoom, exportOfficial, exportSimJson, parseDeck, validateDeck } from '../../engine/deck';
import type { DeckList } from '../../engine/types';
import { allDecks, upsertCustom } from '../../lib/browserLibrary';
import { shortCredit } from '../../lib/library';
import { download } from '../../lib/download';
import { findDeck } from '../components/DeckPicker';
import { customSaveName, isBuiltin } from '../deckLookup';
import { ProvenanceBlock } from '../components/Provenance';
import { profileHref } from '../components/DeckStats';
import { DeckEditor, VisualEditor } from '../components/DeckEditors';
import { TierPair } from '../components/DeckIdentity';
import { CardBrowser } from '../components/CardBrowser';
import { DeckGallery } from '../components/DeckGallery';
import { useDeckActions } from '../components/DeckActions';
import { useLibraryVersion } from '../useLibrary';
import { loadPref, savePref } from '../prefs';
import '../deckprofile.css';

function copy(text: string) {
  navigator.clipboard?.writeText(text).catch(() => {});
}

export function DecksPage({ initial, query }: { initial?: string; query?: string }) {
  // Gallery is the default; a deck in the URL (#/decks?d=file) opens the editor. The rest of the query is the
  // gallery's view (filters, sort, grouping: src/lib/galleryView.ts).
  const [mode, setMode] = useState<'gallery' | 'editor'>(initial ? 'editor' : 'gallery');
  if (mode === 'gallery') return <DeckGallery onNew={() => setMode('editor')} query={query} />;
  return (
    <DeckWorkbench
      initial={initial}
      onGallery={() => {
        setMode('gallery');
        if (window.location.hash !== '#/decks') window.location.hash = '#/decks';
      }}
    />
  );
}

const EMPTY_DECK = (): DeckList => ({ name: 'New deck', legends: [], main: [], sideboard: [] });
const deckSig = (d: DeckList) => JSON.stringify([d.name, d.legends, d.main, d.sideboard]);

/** Put the open deck in the URL (#/decks?d=file) without a hashchange, so reload and Back reopen it. */
function syncUrl(file: string) {
  try {
    const hash = file ? `#/decks?d=${encodeURIComponent(file)}` : '#/decks';
    if (window.location.hash !== hash) history.replaceState(history.state, '', hash);
  } catch {
    /* history unavailable (sandboxed frame): the URL just doesn't follow */
  }
}

function DeckWorkbench({ initial, onGallery }: { initial?: string; onGallery: () => void }) {
  // allDecks() is cached against the stored decks, so calling it each render is cheap; bumping `version` after a
  // save or delete re-renders this component so it picks the change up.
  const [, setVersion] = useState(0);
  useLibraryVersion(); // a delete or save in another tab shows here too
  const decks = allDecks();
  // exact file match only: a link to a deleted or renamed deck must not open a different deck
  const start = findDeck(initial);
  const [view, setView] = useState<'list' | 'visual'>(() => (loadPref('nct.deckEditorView', 'list') === 'visual' ? 'visual' : 'list'));
  const changeView = (v: 'list' | 'visual') => {
    setView(v);
    savePref('nct.deckEditorView', v);
  };
  const [sel, setSel] = useState<string>(start ? start.file : '');
  const [draft, setDraft] = useState<DeckList>(() => (start ? structuredClone(start.deck) : EMPTY_DECK()));
  // what the draft is compared with to decide "unsaved changes": the deck as opened or last saved
  const [baseline, setBaseline] = useState<string>(() => deckSig(start ? start.deck : EMPTY_DECK()));
  const [importText, setImportText] = useState('');
  const [importMsg, setImportMsg] = useState(initial && !start ? `No deck matches the link “${initial}” — it may have been deleted or renamed. Started a new empty deck instead.` : '');
  const [showImport, setShowImport] = useState(false);
  const [listQ, setListQ] = useState('');
  const [exportFmt, setExportFmt] = useState<'official' | 'choom' | 'sim'>('official');
  const dirty = deckSig(draft) !== baseline;

  // Unsaved edits: warn before the tab closes, and before any in-app link (top nav, Play it, View profile…) leaves the editor.
  useEffect(() => {
    if (!dirty) return;
    const beforeUnload = (e: BeforeUnloadEvent) => {
      e.preventDefault();
      e.returnValue = '';
    };
    const onClick = (e: MouseEvent) => {
      if (e.defaultPrevented || e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
      const a = (e.target as Element | null)?.closest?.('a[href^="#"]') as HTMLAnchorElement | null;
      if (!a || a.target === '_blank') return;
      if (!window.confirm('You have unsaved changes to this deck. Leave and discard them?')) {
        e.preventDefault();
        e.stopPropagation();
      }
    };
    window.addEventListener('beforeunload', beforeUnload);
    document.addEventListener('click', onClick, true);
    return () => {
      window.removeEventListener('beforeunload', beforeUnload);
      document.removeEventListener('click', onClick, true);
    };
  }, [dirty]);
  useEffect(() => syncUrl(sel), [sel]);

  const discardOk = () => !dirty || window.confirm('You have unsaved changes to this deck. Discard them?');
  // the draft came from an import (recorded with the saved deck, for the profile's "My decks")
  const [imported, setImported] = useState(false);
  const load = (file: string, deck: DeckList) => {
    setImported(false);
    setSel(file);
    setDraft(structuredClone(deck));
    setBaseline(deckSig(deck));
  };

  const selected = decks.find((d) => d.file === sel);
  const open = (file: string) => {
    const d = decks.find((x) => x.file === file);
    if (!d || file === sel || !discardOk()) return;
    load(file, d.deck);
    setImportMsg('');
  };

  const doImport = () => {
    if (!discardOk()) return;
    const { deck, errors } = parseDeck(importText, 'Imported deck');
    setDraft(deck);
    setImported(true);
    setSel('');
    setBaseline(deckSig(EMPTY_DECK())); // an import is unsaved work until it is saved
    setImportMsg(errors.length ? `Imported with ${errors.length} unrecognized line(s): ${errors.slice(0, 5).join(' | ')}` : `Imported "${deck.name}".`);
    setShowImport(false);
  };

  const save = () => {
    // A built-in deck's name is reserved: saving under it would shadow the built-in in standings, ratings and links.
    const name = customSaveName(draft.name, decks);
    if (!name) {
      setImportMsg('Give the deck a name before saving.');
      return;
    }
    const deck = { ...draft, name };
    // a deck saved again keeps how it began (upsertCustom); a new one is an import or built here
    const known = decks.some((d) => d.file === `custom:${name}`);
    if (!upsertCustom(imported ? { ...deck, origin: 'imported' } : known ? deck : { ...deck, origin: 'created' })) {
      setImportMsg('Not saved: this browser’s storage is full or blocked. Export the list to keep it.');
      return;
    }
    setDraft(deck);
    setBaseline(deckSig(deck));
    setVersion((v) => v + 1);
    setSel(`custom:${name}`);
    setImportMsg(name !== draft.name.trim() ? `“${draft.name.trim()}” is the name of a built-in deck, so this was saved as “${name}”.` : `Saved “${name}” to My decks.`);
  };
  // Delete asks first (the shared confirm dialog) and offers Undo; the draft stays open as unsaved work, so Save also brings it back.
  const actions = useDeckActions({
    onDeleted: ([name]) => {
      setVersion((v) => v + 1);
      setSel('');
      setBaseline(deckSig(EMPTY_DECK()));
      setImportMsg(`Deleted “${name}”. The list is still open here — Save brings it back.`);
    },
    onRestored: ([name]) => {
      if (!name) return;
      setVersion((v) => v + 1);
      setSel(`custom:${name}`);
      setImportMsg(`Restored “${name}”.`);
    },
  });
  const remove = () => {
    if (!selected || selected.kind !== 'custom' || isBuiltin(selected)) return;
    actions.askDelete([selected]);
  };

  const errs = validateDeck(draft);
  const exportText = exportFmt === 'official' ? exportOfficial(draft) : exportFmt === 'choom' ? exportChoom(draft) : JSON.stringify(exportSimJson(draft), null, 2);

  return (
    <div className="sidebar-layout">
      <div className="panel">
        <div className="spread">
          <h3 style={{ margin: 0 }}>Deck library</h3>
          <button onClick={() => setShowImport((x) => !x)}>Import</button>
        </div>
        <button style={{ marginTop: 8, width: '100%' }} onClick={() => discardOk() && onGallery()}>
          ▦ Back to gallery
        </button>
        <button
          style={{ marginTop: 8, width: '100%' }}
          onClick={() => {
            if (!discardOk()) return;
            load('', EMPTY_DECK());
            setImportMsg('');
          }}
        >
          + New empty deck
        </button>
        <input aria-label="Filter decks" placeholder="Filter decks…" value={listQ} onChange={(e) => setListQ(e.target.value)} style={{ marginTop: 8, width: '100%' }} />
        {(['meta', 'ladder', 'original', 'guide', 'custom'] as const).map((k) => {
          const inKind = decks.filter((d) => d.kind === k && (!listQ || `${d.deck.name} ${deckColors(d.deck)} ${shortCredit(d)}`.toLowerCase().includes(listQ.toLowerCase())));
          if (!inKind.length) return null;
          return (
          <details key={k} open={!!listQ || k === 'meta' || inKind.some((d) => d.file === sel) || undefined}>
            <summary className="zone-label" style={{ marginTop: 12 }}>
              {k === 'meta' ? 'Meta archetypes' : k === 'ladder' ? 'Sim ladder (Master)' : k === 'original' ? 'Trainer originals (NC)' : k === 'guide' ? 'Guide lists' : 'Custom & tournament builds'} ({inKind.length})
            </summary>
            {inKind
              .map((d) => (
                <button key={d.file} type="button" className="side-item" aria-current={d.file === sel ? 'true' : undefined} onClick={() => open(d.file)} style={{ padding: '4px 6px' }}>
                  <span className="tag">{deckColors(d.deck)}</span> {d.deck.name.slice(0, 40)} <TierPair d={d} showUnrated={false} />
                  <span className="muted side-item-sub">{shortCredit(d)}</span>
                </button>
              ))}
          </details>
          );
        })}
      </div>

      <div className="grid">
        {showImport && (
          <div className="panel">
            <h3>Import a deck list</h3>
            <p className="small muted">
              Paste from choom.gg (Export &amp; Share → Copy list, either "choom.gg" or "Official" format), the official deck builder, ChoomBattler,
              cyberpunk-tcg-sim.online (text or deck JSON), or a plain list like <code>3 Psycho Squad</code> / <code>3x Towerfall</code>. Legends are
              detected automatically.
            </p>
            <textarea aria-label="Deck list to import" rows={12} value={importText} onChange={(e) => setImportText(e.target.value)} placeholder={'# My deck\n// Legends (3)\n1 Dexter DeShawn: Off the Grid\n...'} />
            <div className="row" style={{ marginTop: 8 }}>
              <button className="primary" onClick={doImport} disabled={!importText.trim()}>
                Parse deck
              </button>
            </div>
          </div>
        )}
        {importMsg && <div className="panel small">{importMsg}</div>}

        <div className="panel">
          <div className="spread">
            <input aria-label="Deck name" value={draft.name} onChange={(e) => setDraft({ ...draft, name: e.target.value })} style={{ fontSize: '1.2rem', fontWeight: 600, flex: 1, minWidth: 200 }} />
            <div className="row">
              <button className="primary" onClick={save} title={dirty ? 'You have unsaved changes' : undefined}>
                {dirty ? 'Save to My decks •' : 'Save to My decks'}
              </button>
              {selected && !isBuiltin(selected) && <button onClick={remove}>Delete</button>}
              {/* Play/Profile/Lab use the saved deck: while the draft has unsaved edits they say so. */}
              {sel && selected ? (
                <a className="btn" href={`#/play?d=${encodeURIComponent(sel)}`} title={dirty ? 'Plays the saved version — your unsaved edits are not included' : undefined}>
                  {dirty ? 'Play saved version' : 'Play it'}
                </a>
              ) : (
                <button disabled title="Save the deck first">
                  Play it
                </button>
              )}
              <a className="btn" href="#/arena">
                Test in Lab
              </a>
              {sel && selected && (
                <a className="btn" href={profileHref(sel)} title={dirty ? 'Shows the saved version — your unsaved edits are not included' : undefined}>
                  {dirty ? 'Profile (saved version)' : 'View profile'}
                </a>
              )}
            </div>
          </div>
          {selected && <ProvenanceBlock prov={selected.prov} />}
          {selected?.idea && <div className="small" style={{ margin: '4px 0' }}>💡 {selected.idea}</div>}
          <div className="row" style={{ marginTop: 8 }}>
            <span className="small muted">View:</span>
            <button className={`chip-btn ${view === 'list' ? 'on' : ''}`} aria-pressed={view === 'list'} onClick={() => changeView('list')}>
              ☰ List
            </button>
            <button className={`chip-btn ${view === 'visual' ? 'on' : ''}`} aria-pressed={view === 'visual'} onClick={() => changeView('visual')}>
              ▦ Cards
            </button>
          </div>
          {view === 'list' ? <DeckEditor deck={draft} setDeck={setDraft} /> : <VisualEditor deck={draft} setDeck={setDraft} />}
          {errs.length > 0 ? (
            <div className="small" style={{ color: 'var(--red)', marginTop: 8 }}>
              {errs.map((e) => (
                <div key={e}>⚠ {e}</div>
              ))}
            </div>
          ) : (
            <div className="small" style={{ color: 'var(--green)', marginTop: 8 }}>
              ✓ Tournament legal (3 Legends, 40–50 cards, ≤3 copies, within RAM limits)
            </div>
          )}
        </div>

        <div className="panel">
          <div className="spread">
            <h3 style={{ margin: 0 }}>Export</h3>
            <div className="row">
              <select aria-label="Export format" value={exportFmt} onChange={(e) => setExportFmt(e.target.value as any)}>
                <option value="official">Official (cyberpunktcg.com / Sim / ChoomBattler)</option>
                <option value="choom">choom.gg text (with sideboard)</option>
                <option value="sim">cyberpunk-tcg-sim.online JSON</option>
              </select>
              <button onClick={() => copy(exportText)}>Copy</button>
              <button onClick={() => download(`${draft.name.replace(/[^\w-]+/g, '_')}.${exportFmt === 'sim' ? 'json' : 'txt'}`, exportText)}>Download</button>
            </div>
          </div>
          <pre style={{ maxHeight: 260 }}>{exportText}</pre>
        </div>

        <CardBrowser deck={draft} setDeck={setDraft} />
      </div>
      {actions.ui}
    </div>
  );
}

