import { useMemo, useState } from 'react';
import { CARDS, CARD_BY_ID, cardLabel } from '../../engine/cards';
import { counts, deckColors, exportChoom, exportOfficial, exportSimJson, parseDeck, ramLimits, validateDeck } from '../../engine/deck';
import type { CardDef, Color, DeckList } from '../../engine/types';
import { allDecks, deleteCustom, upsertCustom } from '../../lib/browserLibrary';
import { CardText, CardView, costLabel } from '../components/CardView';
import { findDeck } from '../components/DeckPicker';
import { ROLES } from '../../ai/knowledge';
import { ProvenanceBlock } from '../components/Provenance';
import { shortCredit, type LibraryDeck } from '../../lib/library';
import { DeckTile, originKind } from '../components/DeckIdentity';
import { TcgCard } from '../components/TcgCard';
import { deckStats } from '../../lib/deckStats';
import { classify } from '../../ai/archetype';
import { CurveAndTypes, profileHref } from './DeckProfile';
import '../deckprofile.css';

const COLORS: Color[] = ['Red', 'Blue', 'Green', 'Yellow'];

function copy(text: string) {
  navigator.clipboard?.writeText(text).catch(() => {});
}
function download(name: string, text: string) {
  const a = document.createElement('a');
  a.href = URL.createObjectURL(new Blob([text], { type: 'text/plain' }));
  a.download = name;
  a.click();
}

function loadPref(key: string, fallback: string) {
  try {
    return localStorage.getItem(key) ?? fallback;
  } catch {
    return fallback;
  }
}
function savePref(key: string, v: string) {
  try {
    localStorage.setItem(key, v);
  } catch {
    /* storage unavailable */
  }
}

export function DecksPage({ initial }: { initial?: string }) {
  // Gallery is the default; a deck in the URL (#/decks?d=file) opens the editor.
  const [mode, setMode] = useState<'gallery' | 'editor'>(initial ? 'editor' : 'gallery');
  if (mode === 'gallery') return <DeckGallery onNew={() => setMode('editor')} />;
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

function DeckWorkbench({ initial, onGallery }: { initial?: string; onGallery: () => void }) {
  const [version, setVersion] = useState(0);
  const decks = useMemo(() => allDecks(), [version]);
  const start = findDeck(initial) ?? decks[0];
  const [view, setView] = useState<'list' | 'visual'>(() => (loadPref('nct.deckEditorView', 'list') === 'visual' ? 'visual' : 'list'));
  const changeView = (v: 'list' | 'visual') => {
    setView(v);
    savePref('nct.deckEditorView', v);
  };
  const [sel, setSel] = useState<string>(initial && start ? start.file : '');
  const [draft, setDraft] = useState<DeckList>(() => (initial && start ? structuredClone(start.deck) : { name: 'New deck', legends: [], main: [], sideboard: [] }));
  const [importText, setImportText] = useState('');
  const [importMsg, setImportMsg] = useState('');
  const [showImport, setShowImport] = useState(false);
  const [exportFmt, setExportFmt] = useState<'official' | 'choom' | 'sim'>('official');

  const selected = decks.find((d) => d.file === sel);
  const open = (file: string) => {
    const d = decks.find((x) => x.file === file);
    if (!d) return;
    setSel(file);
    setDraft(structuredClone(d.deck));
  };

  const doImport = () => {
    const { deck, errors } = parseDeck(importText, 'Imported deck');
    setDraft(deck);
    setSel('');
    setImportMsg(errors.length ? `Imported with ${errors.length} unrecognized line(s): ${errors.slice(0, 5).join(' | ')}` : `Imported "${deck.name}".`);
    setShowImport(false);
  };

  const save = () => {
    upsertCustom(draft);
    setVersion((v) => v + 1);
    setSel(`custom:${draft.name}`);
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
        <button style={{ marginTop: 8, width: '100%' }} onClick={onGallery}>
          ▦ Back to gallery
        </button>
        <button
          style={{ marginTop: 8, width: '100%' }}
          onClick={() => {
            setSel('');
            setDraft({ name: 'New deck', legends: [], main: [], sideboard: [] });
          }}
        >
          + New empty deck
        </button>
        {(['meta', 'ladder', 'original', 'guide', 'custom'] as const).map((k) => (
          <div key={k}>
            <div className="zone-label" style={{ marginTop: 12 }}>
              {k === 'meta' ? 'Meta archetypes' : k === 'ladder' ? 'Sim ladder (Master)' : k === 'original' ? 'Trainer originals (NC)' : k === 'guide' ? 'Guide lists' : 'Custom & tournament builds'}
            </div>
            {decks
              .filter((d) => d.kind === k)
              .map((d) => (
                <div
                  key={d.file}
                  onClick={() => open(d.file)}
                  style={{ cursor: 'pointer', padding: '4px 6px', borderRadius: 6, background: d.file === sel ? 'var(--panel-2)' : undefined }}
                >
                  <span className="tag">{deckColors(d.deck)}</span> {d.deck.name.slice(0, 40)} {d.tier && <span className={`tier tier-${d.tier}`}>{d.tier}</span>}
                  <div className="muted" style={{ fontSize: 11 }}>{shortCredit(d)}</div>
                </div>
              ))}
          </div>
        ))}
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
            <textarea rows={12} value={importText} onChange={(e) => setImportText(e.target.value)} placeholder={'# My deck\n// Legends (3)\n1 Dexter DeShawn: Off the Grid\n...'} />
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
            <input value={draft.name} onChange={(e) => setDraft({ ...draft, name: e.target.value })} style={{ fontSize: '1.2rem', fontWeight: 600, flex: 1, minWidth: 200 }} />
            <div className="row">
              <button className="primary" onClick={save}>
                Save to My decks
              </button>
              {selected?.kind === 'custom' && (
                <button
                  onClick={() => {
                    deleteCustom(selected.deck.name);
                    setVersion((v) => v + 1);
                  }}
                >
                  Delete
                </button>
              )}
              <a href={`#/play?d=${encodeURIComponent(sel || '')}`}>
                <button disabled={!sel}>Play it</button>
              </a>
              <a href="#/arena">
                <button>Test in Lab</button>
              </a>
              {sel && selected && (
                <a href={profileHref(sel)}>
                  <button>View profile</button>
                </a>
              )}
            </div>
          </div>
          {selected && <ProvenanceBlock prov={selected.prov} />}
          {selected?.idea && <div className="small" style={{ margin: '4px 0' }}>💡 {selected.idea}</div>}
          <div className="row" style={{ marginTop: 8 }}>
            <span className="small muted">View:</span>
            <button className={`chip-btn ${view === 'list' ? 'on' : ''}`} onClick={() => changeView('list')}>
              ☰ List
            </button>
            <button className={`chip-btn ${view === 'visual' ? 'on' : ''}`} onClick={() => changeView('visual')}>
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
              <select value={exportFmt} onChange={(e) => setExportFmt(e.target.value as any)}>
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
    </div>
  );
}

function DeckEditor({ deck, setDeck }: { deck: DeckList; setDeck: (d: DeckList) => void }) {
  const lim = ramLimits(deck);
  const mainCounts = counts(deck.main);
  const sideCounts = counts(deck.sideboard);
  const add = (id: string, d = 1, where: 'main' | 'sideboard' = 'main') => {
    const list = [...deck[where]];
    if (d > 0) list.push(id);
    else {
      const i = list.indexOf(id);
      if (i >= 0) list.splice(i, 1);
    }
    setDeck({ ...deck, [where]: list });
  };
  const byType = (t: CardDef['type']) => [...mainCounts.entries()].filter(([id]) => CARD_BY_ID[id].type === t).sort((a, b) => (CARD_BY_ID[a[0]].cost ?? 0) - (CARD_BY_ID[b[0]].cost ?? 0));
  const curve: number[] = Array(10).fill(0);
  for (const id of deck.main) curve[Math.min(9, CARD_BY_ID[id].cost ?? 0)]++;
  const maxC = Math.max(1, ...curve);
  const sellable = deck.main.filter((id) => CARD_BY_ID[id].sellable).length;
  const units = deck.main.filter((id) => CARD_BY_ID[id].type === 'Unit').length;

  return (
    <div className="grid cols-2" style={{ marginTop: 10 }}>
      <div>
        <div className="zone-label">Legends ({deck.legends.length}/3)</div>
        {deck.legends.map((id) => (
          <div className="deckrow" key={id}>
            <span>
              <span className={`dot ${CARD_BY_ID[id].color}`} /> {cardLabel(CARD_BY_ID[id])} <span className="muted small">{CARD_BY_ID[id].cost !== null ? `Go Solo ${CARD_BY_ID[id].cost}` : ''}</span>
            </span>
            <button className="ghost" onClick={() => setDeck({ ...deck, legends: deck.legends.filter((x) => x !== id) })}>
              ✕
            </button>
          </div>
        ))}
        <div className="small muted" style={{ margin: '4px 0 10px' }}>
          RAM limits: {COLORS.map((c) => `${c} ${lim[c]}`).join(' · ')}
        </div>
        {(['Unit', 'Gear', 'Program'] as const).map((t) => (
          <div key={t}>
            <div className="zone-label">
              {t}s ({byType(t).reduce((a, [, n]) => a + n, 0)})
            </div>
            {byType(t).map(([id, n]) => (
              <div className="deckrow" key={id} title={CARD_BY_ID[id].text}>
                <span>
                  <span className="qty">{n}×</span> <span className={`dot ${CARD_BY_ID[id].color}`} /> {cardLabel(CARD_BY_ID[id])}{' '}
                  <span className="muted small">{costLabel(CARD_BY_ID[id])}€$</span>
                </span>
                <span className="row">
                  <button className="ghost" onClick={() => add(id, -1)}>
                    −
                  </button>
                  <button className="ghost" onClick={() => add(id, 1)} disabled={n >= 3}>
                    +
                  </button>
                  <button className="ghost" title="Move one copy to sideboard" onClick={() => setDeck({ ...deck, main: removeOne(deck.main, id), sideboard: [...deck.sideboard, id] })}>
                    ↘SB
                  </button>
                </span>
              </div>
            ))}
          </div>
        ))}
        <div className="zone-label">Sideboard ({deck.sideboard.length}/7)</div>
        {[...sideCounts.entries()].map(([id, n]) => (
          <div className="deckrow" key={id}>
            <span>
              <span className="qty">{n}×</span> {cardLabel(CARD_BY_ID[id])}
            </span>
            <span className="row">
              <button className="ghost" onClick={() => setDeck({ ...deck, sideboard: removeOne(deck.sideboard, id), main: [...deck.main, id] })}>
                ↖main
              </button>
              <button className="ghost" onClick={() => add(id, -1, 'sideboard')}>
                −
              </button>
            </span>
          </div>
        ))}
      </div>
      <div>
        <div className="zone-label">Stats</div>
        <div className="kv small">
          <span className="muted">Main deck</span>
          <span>{deck.main.length} cards</span>
          <span className="muted">Units</span>
          <span>{units}</span>
          <span className="muted">Sellable (Eddie ratio)</span>
          <span>
            {sellable} ({Math.round((100 * sellable) / Math.max(1, deck.main.length))}%)
          </span>
          <span className="muted">Avg cost</span>
          <span>{(deck.main.reduce((a, id) => a + (CARD_BY_ID[id].cost ?? 0), 0) / Math.max(1, deck.main.length)).toFixed(2)}</span>
        </div>
        <div className="zone-label" style={{ marginTop: 10 }}>
          Cost curve
        </div>
        <div className="row" style={{ alignItems: 'flex-end', height: 90, gap: 4 }}>
          {curve.map((n, c) => (
            <div key={c} style={{ textAlign: 'center', fontSize: 11 }}>
              <div style={{ height: (70 * n) / maxC, width: 22, background: 'var(--accent)', borderRadius: 3 }} title={`${n} cards`} />
              {c}
              {c === 9 ? '+' : ''}
            </div>
          ))}
        </div>
        <div className="zone-label" style={{ marginTop: 10 }}>
          Roles
        </div>
        <div className="row small">
          {Object.entries(
            deck.main.reduce<Record<string, number>>((acc, id) => {
              for (const r of ROLES[id] ?? []) acc[r] = (acc[r] ?? 0) + 1;
              return acc;
            }, {}),
          )
            .sort((a, b) => b[1] - a[1])
            .map(([r, n]) => (
              <span key={r} className="tag">
                {r} {n}
              </span>
            ))}
        </div>
      </div>
    </div>
  );
}

function removeOne(list: string[], id: string) {
  const l = [...list];
  const i = l.indexOf(id);
  if (i >= 0) l.splice(i, 1);
  return l;
}

function CardBrowser({ deck, setDeck }: { deck: DeckList; setDeck: (d: DeckList) => void }) {
  const [q, setQ] = useState('');
  const [color, setColor] = useState<string>('');
  const [type, setType] = useState<string>('');
  const [legalOnly, setLegalOnly] = useState(true);
  const lim = ramLimits(deck);
  const list = CARDS.filter(
    (c) =>
      (!color || c.color === color) &&
      (!type || c.type === type) &&
      (!q || (c.displayName + ' ' + c.text + ' ' + c.tags.join(' ')).toLowerCase().includes(q.toLowerCase())) &&
      (!legalOnly || c.type === 'Legend' || deck.legends.length < 3 || c.ram <= lim[c.color]),
  );
  const addCard = (c: CardDef) => {
    if (c.type === 'Legend') {
      if (deck.legends.length >= 3 || deck.legends.some((id) => CARD_BY_ID[id].name === c.name)) return;
      setDeck({ ...deck, legends: [...deck.legends, c.id] });
    } else setDeck({ ...deck, main: [...deck.main, c.id] });
  };
  return (
    <div className="panel">
      <div className="spread">
        <h3 style={{ margin: 0 }}>Add cards</h3>
        <div className="row">
          <input placeholder="Search name, text, tag…" value={q} onChange={(e) => setQ(e.target.value)} />
          <select value={color} onChange={(e) => setColor(e.target.value)}>
            <option value="">All colors</option>
            {COLORS.map((c) => (
              <option key={c}>{c}</option>
            ))}
          </select>
          <select value={type} onChange={(e) => setType(e.target.value)}>
            <option value="">All types</option>
            {['Legend', 'Unit', 'Gear', 'Program'].map((c) => (
              <option key={c}>{c}</option>
            ))}
          </select>
          <label className="row small">
            <input type="checkbox" checked={legalOnly} onChange={(e) => setLegalOnly(e.target.checked)} /> fits RAM
          </label>
        </div>
      </div>
      <div className="zone" style={{ gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))', maxHeight: 640, overflowY: 'auto' }}>
        {list.map((c) => {
          const n = c.type === 'Legend' ? (deck.legends.includes(c.id) ? 1 : 0) : deck.main.filter((x) => x === c.id).length;
          return (
            <CardView
              key={c.id}
              def={c}
              power={c.power}
              extra={
                <div className="spread" style={{ marginTop: 6 }}>
                  <span className="small muted">in deck: {n}</span>
                  <button onClick={() => addCard(c)} disabled={c.type === 'Legend' ? n > 0 || deck.legends.length >= 3 : n >= 3}>
                    + Add
                  </button>
                </div>
              }
            />
          );
        })}
      </div>
      <p className="small muted">
        <CardText text="Keywords like {Blocker}, {Quick} and {Go Solo} are explained in the Glossary." />
      </p>
    </div>
  );
}

// ---------- visual editor: card stacks with +/- controls ----------

function VisualEditor({ deck, setDeck }: { deck: DeckList; setDeck: (d: DeckList) => void }) {
  const mainCounts = counts(deck.main);
  const sideCounts = counts(deck.sideboard);
  const add = (id: string, d: number, where: 'main' | 'sideboard' = 'main') => {
    const list = d > 0 ? [...deck[where], id] : removeOne(deck[where], id);
    setDeck({ ...deck, [where]: list });
  };
  const byCost = (m: Map<string, number>, t?: CardDef['type']) =>
    [...m.entries()].filter(([id]) => CARD_BY_ID[id] && (!t || CARD_BY_ID[id].type === t)).sort((a, b) => (CARD_BY_ID[a[0]].cost ?? 0) - (CARD_BY_ID[b[0]].cost ?? 0));
  return (
    <div className="vis-editor" style={{ marginTop: 10 }}>
      <div className="zone-label">Legends ({deck.legends.length}/3)</div>
      <div className="dp-cards">
        {deck.legends
          .filter((id) => CARD_BY_ID[id])
          .map((id) => (
            <div className="vis-card" key={id}>
              <TcgCard def={CARD_BY_ID[id]} size="sm" />
              <button className="ghost" onClick={() => setDeck({ ...deck, legends: deck.legends.filter((x) => x !== id) })}>
                ✕ remove
              </button>
            </div>
          ))}
      </div>
      {(['Unit', 'Gear', 'Program'] as const).map((t) => {
        const list = byCost(mainCounts, t);
        if (!list.length) return null;
        return (
          <div key={t} style={{ marginTop: 10 }}>
            <div className="zone-label">
              {t}s ({list.reduce((a, [, n]) => a + n, 0)})
            </div>
            <div className="dp-cards">
              {list.map(([id, n]) => (
                <div className="vis-card" key={id}>
                  <TcgCard def={CARD_BY_ID[id]} size="sm" count={n} />
                  <div className="row">
                    <button onClick={() => add(id, -1)} title="Remove one copy">
                      −
                    </button>
                    <button onClick={() => add(id, 1)} disabled={n >= 3} title="Add one copy">
                      +
                    </button>
                    <button title="Move one copy to sideboard" onClick={() => setDeck({ ...deck, main: removeOne(deck.main, id), sideboard: [...deck.sideboard, id] })}>
                      SB
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        );
      })}
      {sideCounts.size > 0 && (
        <div style={{ marginTop: 10 }}>
          <div className="zone-label">Sideboard ({deck.sideboard.length}/7)</div>
          <div className="dp-cards">
            {byCost(sideCounts).map(([id, n]) => (
              <div className="vis-card" key={id}>
                <TcgCard def={CARD_BY_ID[id]} size="sm" count={n} />
                <div className="row">
                  <button onClick={() => add(id, -1, 'sideboard')} title="Remove from sideboard">
                    −
                  </button>
                  <button title="Move one copy to the main deck" onClick={() => setDeck({ ...deck, sideboard: removeOne(deck.sideboard, id), main: [...deck.main, id] })}>
                    Main
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
      <div style={{ marginTop: 14 }}>
        <CurveAndTypes deck={deck} />
      </div>
    </div>
  );
}

// ---------- gallery ----------

interface Group {
  key: string;
  label: string;
  order: number;
}
function groupOf(d: LibraryDeck): Group {
  const k = originKind(d.prov, d.kind);
  switch (k) {
    case 'choom-meta':
      return { key: 'meta', label: '◆ choom.gg meta archetypes', order: 0 };
    case 'sim-ladder':
      return { key: 'ladder', label: '▲ Sim ladder (Master-rank Legend trios)', order: 0.5 };
    case 'choom-guide':
      return { key: 'guide', label: '✎ choom.gg community guides', order: 1 };
    case 'nc-original':
      return { key: 'nc', label: '⚙ Night City Trainer originals', order: 2 };
    case 'nc-bred': {
      const s = d.prov.origin?.match(/season (\d+)/)?.[1] ?? '0';
      return { key: `bred-${s}`, label: `🧬 Bred · Season ${s}`, order: 3 + Number(s) / 100 };
    }
    case 'nc-build':
    case 'nc-variant':
      return { key: 'builds', label: '🏆 Tournament builds & variants', order: 4 };
    case 'mine':
      return { key: 'mine', label: '★ My decks', order: 5 };
    default:
      return d.kind === 'custom' ? { key: 'mine', label: '★ My decks', order: 5 } : { key: 'other', label: '• Other', order: 6 };
  }
}
const GROUP_HELP: Record<string, string> = {
  meta: 'The archetypes choom.gg tracks as the current meta, with their tier.',
  ladder: 'Legend trios seen at Master rank on cyberpunk-tcg-sim.online. Only the Legends are public, so the main decks are theorized by this trainer from our data, then forged.',
  guide: 'Lists from community strategy guides, credited to their authors.',
  nc: 'Hand-built by this trainer around a single plan.',
  builds: 'Ready-to-register lists with a data-chosen sideboard, and optimizer-tuned variants.',
  mine: 'Saved in this browser only.',
};

function DeckGallery({ onNew }: { onNew: () => void }) {
  const decks = useMemo(() => allDecks(), []);
  const info = useMemo(
    () =>
      new Map(
        decks.map((d) => {
          const st = deckStats(d.file);
          const score = st.leader?.rating ?? st.review?.winRate ?? null;
          return [d.file, { group: groupOf(d), arch: st.leader?.arch ?? classify(d.deck.main).arch, score: typeof score === 'number' && Number.isFinite(score) ? score : null }];
        }),
      ),
    [decks],
  );
  const [origin, setOrigin] = useState(() => loadPref('nct.gallery.origin', ''));
  const [color, setColor] = useState('');
  const [arch, setArch] = useState('');
  const [q, setQ] = useState('');
  const [sort, setSort] = useState<'rating' | 'name' | 'newest'>('rating');
  const groups = [...new Map([...info.values()].map((i) => [i.group.key, i.group])).values()].sort((a, b) => a.order - b.order);
  const archs = [...new Set([...info.values()].map((i) => i.arch))].sort();
  const activeOrigin = groups.some((g) => g.key === origin) ? origin : '';
  const pick = (k: string) => {
    setOrigin(k);
    savePref('nct.gallery.origin', k);
  };
  const shown = decks.filter((d) => {
    const i = info.get(d.file)!;
    return (
      (!activeOrigin || i.group.key === activeOrigin) &&
      (!color || d.deck.legends.some((id) => CARD_BY_ID[id]?.color === color)) &&
      (!arch || i.arch === arch) &&
      (!q || (d.deck.name + ' ' + (d.prov.author ?? '') + ' ' + d.deck.legends.map((id) => CARD_BY_ID[id]?.displayName ?? '').join(' ')).toLowerCase().includes(q.toLowerCase()))
    );
  });
  const cmp = (a: LibraryDeck, b: LibraryDeck) => {
    if (sort === 'name') return a.deck.name.localeCompare(b.deck.name);
    if (sort === 'newest') return (b.prov.added ?? '').localeCompare(a.prov.added ?? '') || a.deck.name.localeCompare(b.deck.name);
    return (info.get(b.file)!.score ?? -1) - (info.get(a.file)!.score ?? -1) || a.deck.name.localeCompare(b.deck.name);
  };
  return (
    <div className="grid">
      <div className="panel">
        <div className="spread" style={{ padding: 0, flexWrap: 'wrap', gap: 8 }}>
          <div style={{ minWidth: 0, flex: '1 1 260px' }}>
            <h2 style={{ margin: 0 }}>Deck library</h2>
            <div className="small muted">
              {decks.length} decks. Each tile shows its Legends, where it comes from and its measured rating vs the meta. Click a tile to edit or export it; “Profile” opens every stat and its lineage.
            </div>
          </div>
          <button className="primary" onClick={onNew}>
            + New / import deck
          </button>
        </div>
        <div className="gal-filters" style={{ marginTop: 10 }}>
          <span className="small muted">Origin</span>
          <button className={`chip-btn ${!activeOrigin ? 'on' : ''}`} onClick={() => pick('')}>
            All
          </button>
          {groups.map((g) => (
            <button key={g.key} className={`chip-btn ${activeOrigin === g.key ? 'on' : ''}`} onClick={() => pick(g.key)}>
              {g.label}
            </button>
          ))}
        </div>
        <div className="gal-filters" style={{ marginTop: 6 }}>
          <span className="small muted">Colour</span>
          <button className={`chip-btn ${!color ? 'on' : ''}`} onClick={() => setColor('')}>
            Any
          </button>
          {COLORS.map((c) => (
            <button key={c} className={`chip-btn ${color === c ? 'on' : ''}`} onClick={() => setColor(color === c ? '' : c)}>
              <span className={`dot ${c}`} /> {c}
            </button>
          ))}
        </div>
        <div className="gal-filters" style={{ marginTop: 6 }}>
          <span className="small muted">Archetype</span>
          <button className={`chip-btn ${!arch ? 'on' : ''}`} onClick={() => setArch('')}>
            Any
          </button>
          {archs.map((a) => (
            <button key={a} className={`chip-btn ${arch === a ? 'on' : ''}`} onClick={() => setArch(arch === a ? '' : a)}>
              {a}
            </button>
          ))}
        </div>
        <div className="gal-filters" style={{ marginTop: 6 }}>
          <input placeholder="Search name, author, Legend…" value={q} onChange={(e) => setQ(e.target.value)} style={{ flex: '1 1 180px', minWidth: 0 }} />
          <select value={sort} onChange={(e) => setSort(e.target.value as typeof sort)}>
            <option value="rating">Sort: rating vs meta</option>
            <option value="name">Sort: name</option>
            <option value="newest">Sort: newest</option>
          </select>
        </div>
      </div>
      {shown.length === 0 && <div className="panel muted">No decks match these filters.</div>}
      {groups
        .filter((g) => shown.some((d) => info.get(d.file)!.group.key === g.key))
        .map((g) => {
          const list = shown.filter((d) => info.get(d.file)!.group.key === g.key).sort(cmp);
          return (
            <div key={g.key}>
              <div className="gal-group-title">
                {g.label} <span className="small muted">({list.length})</span>
                {GROUP_HELP[g.key] && (
                  <span className="small muted" style={{ fontFamily: 'var(--font)', fontWeight: 400 }}>
                    {GROUP_HELP[g.key]}
                  </span>
                )}
                {g.key.startsWith('bred-') && (
                  <a className="small" href="#/seasons" style={{ fontFamily: 'var(--font)', fontWeight: 400 }}>
                    how breeding works →
                  </a>
                )}
              </div>
              <div className="deck-grid">
                {list.map((d) => (
                  <div className="gal-tile-wrap" key={d.file}>
                    <DeckTile d={d} href={`#/decks?d=${encodeURIComponent(d.file)}`} />
                    <a className="gal-profile" href={profileHref(d.file)} title="Every stat, lineage and the visual decklist">
                      📊 Profile
                    </a>
                  </div>
                ))}
              </div>
            </div>
          );
        })}
    </div>
  );
}
