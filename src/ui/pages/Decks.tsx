import { useMemo, useState } from 'react';
import { CARDS, CARD_BY_ID, cardLabel } from '../../engine/cards';
import { counts, deckColors, exportChoom, exportOfficial, exportSimJson, parseDeck, ramLimits, validateDeck } from '../../engine/deck';
import type { CardDef, Color, DeckList } from '../../engine/types';
import { allDecks, deleteCustom, upsertCustom } from '../../lib/browserLibrary';
import { CardText, CardView, costLabel } from '../components/CardView';
import { findDeck } from '../components/DeckPicker';
import { ROLES } from '../../ai/knowledge';
import { ProvenanceBlock } from '../components/Provenance';
import { shortCredit } from '../../lib/library';

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

export function DecksPage({ initial }: { initial?: string }) {
  const [version, setVersion] = useState(0);
  const decks = useMemo(() => allDecks(), [version]);
  const start = findDeck(initial) ?? decks[0];
  const [sel, setSel] = useState<string>(start?.file);
  const [draft, setDraft] = useState<DeckList>(() => structuredClone(start.deck));
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
        <button
          style={{ marginTop: 8, width: '100%' }}
          onClick={() => {
            setSel('');
            setDraft({ name: 'New deck', legends: [], main: [], sideboard: [] });
          }}
        >
          + New empty deck
        </button>
        {(['meta', 'original', 'guide', 'custom'] as const).map((k) => (
          <div key={k}>
            <div className="zone-label" style={{ marginTop: 12 }}>
              {k === 'meta' ? 'Meta archetypes' : k === 'original' ? 'Trainer originals (NC)' : k === 'guide' ? 'Guide lists' : 'Custom & tournament builds'}
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
            </div>
          </div>
          {selected && <ProvenanceBlock prov={selected.prov} />}
          {selected?.idea && <div className="small" style={{ margin: '4px 0' }}>💡 {selected.idea}</div>}
          <DeckEditor deck={draft} setDeck={setDraft} />
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
