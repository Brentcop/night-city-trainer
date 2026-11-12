// The tournament runner's setup parts (#/run): the entrant picker, the pairing editor (pick A, pick B, "Pair"; or drag
// one deck onto another), the top-cut seed order, the bracket slot editor, the match list editor and best-of per
// bracket round. Each is a controlled component over plain data (src/lib/eventDraft.ts, src/lib/eventFormats.ts).
import { useId, useMemo, useState } from 'react';
import type { LibraryDeck } from '../../lib/library';
import { loadHidden } from '../../lib/hiddenDecks';
import { applyView, DEFAULT_VIEW, sourceCounts, type GalleryView } from '../../lib/galleryView';
import { SOURCES, deckSource, sourceInfo } from '../../lib/deckSource';
import { RATINGS } from '../../data/index';
import { addEntrant, duplicateEntrant, entrantName, moveEntrant, quickSets, removeEntrant, type DraftEntrant } from '../../lib/eventDraft';
import { BEST_OF, bracketSize, roundName, seededSlots, type BestOf, type ForcedPair, type MatchSpec } from '../../lib/eventFormats';
import { Chip, deckFacts } from './DeckGallery';
import { ColorPips } from './DeckIdentity';
import { ChoomTierBadge, SimTierBadge, simTierFor } from './TierBadges';

/** A polite live region for what an editor just did. */
function Said({ text }: { text: string }) {
  return (
    <span className="sr-only" role="status" aria-live="polite">
      {text}
    </span>
  );
}

// ---------------------------------------------------------------- entrants

export function EntrantPicker({ pool, entrants, onChange, disabled }: { pool: readonly LibraryDeck[]; entrants: DraftEntrant[]; onChange: (e: DraftEntrant[]) => void; disabled?: boolean }) {
  const hiddenKey = [...loadHidden()].join('|');
  const hidden = useMemo(() => new Set(hiddenKey.split('|').filter(Boolean)), [hiddenKey]);
  const facts = useMemo(() => deckFacts(pool, hidden), [pool, hidden]);
  const byFile = useMemo(() => new Map(pool.map((d) => [d.file, d])), [pool]);
  const sets = useMemo(() => quickSets(pool, RATINGS.decks), [pool]);
  // hidden decks stay pickable (marked); the picker's own filters are the gallery's source chips and search
  const [view, setView] = useState<GalleryView>({ ...DEFAULT_VIEW, hidden: true });
  const [said, setSaid] = useState('');
  const shown = applyView(facts, view);
  const counts = sourceCounts(facts, view);
  const inSet = new Set(entrants.map((e) => e.file));
  const listId = useId();
  const change = (next: DraftEntrant[], msg: string) => {
    onChange(next);
    setSaid(msg);
  };
  const nameOf = (e: DraftEntrant) => entrantName(byFile.get(e.file), e) || `${e.file} (missing)`;
  const toggle = (file: string) => {
    const d = byFile.get(file);
    if (inSet.has(file)) change(entrants.filter((e) => e.file !== file), `Removed ${d?.deck.name ?? file}`);
    else change(addEntrant(entrants, file), `Added ${d?.deck.name ?? file}`);
  };
  return (
    <div className="ev-entrants">
      <Said text={said} />
      <div className="gal-filters" role="group" aria-label="Quick entrant sets">
        <span className="small muted">Quick sets</span>
        {sets.map((s) => (
          <button key={s.key} type="button" className="chip-btn" title={`${s.hint} (replaces the list)`} disabled={disabled} onClick={() => change(s.files.map((file) => ({ file, copy: 1 })), `${s.label}: ${s.files.length} entrants`)}>
            {s.label} <span className="muted">({s.files.length})</span>
          </button>
        ))}
        {entrants.length > 0 && (
          <button type="button" className="ghost small" disabled={disabled} onClick={() => change([], 'Cleared the entrants')}>
            Clear
          </button>
        )}
      </div>

      <div className="ev-entrant-cols">
        <div>
          <div className="pb-label" id={listId}>
            Entrants in seed order ({entrants.length})
          </div>
          {entrants.length === 0 ? (
            <p className="muted small">No entrants yet: pick a quick set or add decks from the list.</p>
          ) : (
            <ol className="ev-entrant-list" aria-labelledby={listId}>
              {entrants.map((e, i) => {
                const d = byFile.get(e.file);
                const name = nameOf(e);
                return (
                  <li key={`${e.file}#${e.copy}`} className={hidden.has(e.file) ? 'is-hidden' : ''}>
                    <span className="ev-seed">{i + 1}</span>
                    {d && <ColorPips legends={d.deck.legends} />}
                    <span className="ev-name" title={name}>
                      {name}
                    </span>
                    {d && <span title={sourceInfo(deckSource(d)).label} aria-hidden="true">{sourceInfo(deckSource(d)).icon}</span>}
                    {d && <SimTierBadge tier={simTierFor(d.deck.name)} />}
                    {hidden.has(e.file) && <span className="tag">hidden</span>}
                    <span className="ev-row-actions">
                      <button type="button" className="ghost small" aria-label={`Move ${name} up`} disabled={disabled || i === 0} onClick={() => change(moveEntrant(entrants, i, -1), `${name} is seed ${i}`)}>
                        ↑
                      </button>
                      <button type="button" className="ghost small" aria-label={`Move ${name} down`} disabled={disabled || i === entrants.length - 1} onClick={() => change(moveEntrant(entrants, i, 1), `${name} is seed ${i + 2}`)}>
                        ↓
                      </button>
                      <button type="button" className="ghost small" aria-label={`Enter ${d?.deck.name ?? name} again`} title="Enter this deck again (as #2, #3…)" disabled={disabled || !d} onClick={() => change(duplicateEntrant(entrants, e.file), `Added another copy of ${d?.deck.name}`)}>
                        ⧉
                      </button>
                      <button type="button" className="ghost small" aria-label={`Remove ${name}`} disabled={disabled} onClick={() => change(removeEntrant(entrants, i), `Removed ${name}`)}>
                        ✕
                      </button>
                    </span>
                  </li>
                );
              })}
            </ol>
          )}
        </div>
        <div>
          <div className="pb-label">Add decks</div>
          <div className="gal-filters">
            <input aria-label="Search decks to add" type="search" placeholder="Search deck, Legend or card…" value={view.q} onChange={(e) => setView({ ...view, q: e.target.value })} style={{ flex: '1 1 160px', minWidth: 0 }} />
          </div>
          <div className="gal-filters" role="group" aria-label="Source">
            {SOURCES.filter((s) => (counts.get(s.key) ?? 0) > 0 || view.sources.includes(s.key)).map((s) => (
              <Chip key={s.key} on={view.sources.includes(s.key)} onClick={() => setView({ ...view, sources: view.sources.includes(s.key) ? view.sources.filter((x) => x !== s.key) : [...view.sources, s.key] })} title={s.help}>
                <span aria-hidden="true">{s.icon}</span> {s.label} <span className="muted">({counts.get(s.key) ?? 0})</span>
              </Chip>
            ))}
          </div>
          <div className="ev-add-list" role="group" aria-label="Decks to add">
            {shown.map((f) => {
              const d = byFile.get(f.file);
              if (!d) return null;
              return (
                <label key={f.file} className={`pick-chip ${inSet.has(f.file) ? 'on' : ''}`}>
                  <input type="checkbox" checked={inSet.has(f.file)} onChange={() => toggle(f.file)} disabled={disabled} />
                  <ColorPips legends={d.deck.legends} />
                  <span title={d.deck.name}>{d.deck.name}</span>
                  <ChoomTierBadge tier={d.tier} />
                  <SimTierBadge tier={simTierFor(d.deck.name)} />
                  {f.hidden && <span className="tag">hidden</span>}
                </label>
              );
            })}
            {!shown.length && <p className="muted small">No deck matches.</p>}
          </div>
        </div>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------- pairings

/**
 * Pairings set by hand for one round. Pick a deck, pick its opponent, then "Pair" (all by keyboard), or drag one deck
 * onto another. A pairing of decks that already met needs "allow rematch" ticked.
 */
export function PairingEditor({ names, pairs, onChange, met, disabled }: { names: string[]; pairs: ForcedPair[]; onChange: (p: ForcedPair[]) => void; met?: (a: string, b: string) => boolean; disabled?: boolean }) {
  const [first, setFirst] = useState<string | null>(null);
  const [second, setSecond] = useState<string | null>(null);
  const [said, setSaid] = useState('');
  const paired = new Set(pairs.flatMap((p) => [p.a, p.b]));
  const free = names.filter((n) => !paired.has(n));
  const pick = (n: string) => {
    if (first === n) return (setFirst(second), setSecond(null), setSaid(`Unselected ${n}`));
    if (second === n) return (setSecond(null), setSaid(`Unselected ${n}`));
    if (!first) return (setFirst(n), setSaid(`Selected ${n}: now pick its opponent`));
    setSecond(n);
    setSaid(`${first} vs ${n}: press Pair to set it`);
  };
  const pair = (a: string, b: string) => {
    if (a === b || paired.has(a) || paired.has(b)) return;
    onChange([...pairs, { a, b }]);
    setFirst(null);
    setSecond(null);
    setSaid(`Paired ${a} vs ${b}`);
  };
  const unpair = (i: number) => {
    const p = pairs[i];
    onChange(pairs.filter((_, k) => k !== i));
    if (p) setSaid(`Unpaired ${p.a} and ${p.b}`);
  };
  return (
    <div className="ev-pairing">
      <Said text={said} />
      <p className="small muted" style={{ margin: 0 }}>
        Pick a deck, pick its opponent, then <b>Pair</b> (or drag one deck onto another). Decks you don't pair are paired by the algorithm among themselves.
      </p>
      <div className="ev-free" role="group" aria-label="Decks not yet paired">
        {free.map((n) => (
          <button
            key={n}
            type="button"
            className={`chip-btn ${first === n || second === n ? 'on' : ''}`}
            aria-pressed={first === n || second === n}
            disabled={disabled}
            draggable={!disabled}
            onDragStart={(e) => e.dataTransfer.setData('text/plain', n)}
            onDragOver={(e) => e.preventDefault()}
            onDrop={(e) => {
              e.preventDefault();
              const from = e.dataTransfer.getData('text/plain');
              if (from && names.includes(from)) pair(from, n);
            }}
            onClick={() => pick(n)}
          >
            {n}
          </button>
        ))}
        {!free.length && <span className="muted small">Every deck is paired by hand.</span>}
      </div>
      <div className="row">
        <button type="button" className="primary small" disabled={disabled || !first || !second} onClick={() => first && second && pair(first, second)}>
          Pair{first && second ? `: ${first} vs ${second}` : ''}
        </button>
        {pairs.length > 0 && (
          <button type="button" className="ghost small" disabled={disabled} onClick={() => (onChange([]), setSaid('Cleared the hand-set pairings'))}>
            Clear pairings
          </button>
        )}
      </div>
      {pairs.length > 0 && (
        <ul className="ev-pairs">
          {pairs.map((p, i) => {
            const re = met?.(p.a, p.b) ?? false;
            return (
              <li key={`${p.a}|${p.b}`}>
                <span>
                  <b>{p.a}</b> vs <b>{p.b}</b> <span className="tag ev-set">set by you</span>
                </span>
                {re && (
                  <label className={`small ${p.rematch ? '' : 'ev-warn'}`}>
                    <input type="checkbox" checked={!!p.rematch} disabled={disabled} onChange={(e) => onChange(pairs.map((x, k) => (k === i ? { ...x, rematch: e.target.checked } : x)))} /> allow rematch
                  </label>
                )}
                <button type="button" className="ghost small" aria-label={`Unpair ${p.a} and ${p.b}`} disabled={disabled} onClick={() => unpair(i)}>
                  ✕
                </button>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}

// ---------------------------------------------------------------- seed order

/** An ordered seed list for a top cut: reorder, remove, add from the candidates; `size` is the cut's seat count. */
export function SeedOrderEditor({ candidates, seeds, size, onChange, disabled }: { candidates: string[]; seeds: string[]; size: number; onChange: (s: string[]) => void; disabled?: boolean }) {
  const [add, setAdd] = useState('');
  const [said, setSaid] = useState('');
  const rest = candidates.filter((c) => !seeds.includes(c));
  return (
    <div className="ev-seeds">
      <Said text={said} />
      <ol className="ev-entrant-list">
        {seeds.map((s, i) => (
          <li key={s}>
            <span className="ev-seed">{i + 1}</span>
            <span className="ev-name">{s}</span>
            <span className="ev-row-actions">
              <button type="button" className="ghost small" aria-label={`Move ${s} up`} disabled={disabled || i === 0} onClick={() => (onChange(moveEntrant(seeds, i, -1)), setSaid(`${s} is seed ${i}`))}>
                ↑
              </button>
              <button type="button" className="ghost small" aria-label={`Move ${s} down`} disabled={disabled || i === seeds.length - 1} onClick={() => (onChange(moveEntrant(seeds, i, 1)), setSaid(`${s} is seed ${i + 2}`))}>
                ↓
              </button>
              <button type="button" className="ghost small" aria-label={`Remove ${s}`} disabled={disabled} onClick={() => (onChange(seeds.filter((x) => x !== s)), setSaid(`Removed ${s}`))}>
                ✕
              </button>
            </span>
          </li>
        ))}
      </ol>
      <div className="row small">
        <span className={seeds.length === size ? 'muted' : 'ev-warn'}>
          {seeds.length} of {size} seats
        </span>
        {seeds.length < size && rest.length > 0 && (
          <>
            <select aria-label="Deck to seed next" value={add} onChange={(e) => setAdd(e.target.value)} disabled={disabled}>
              <option value="">Add a seed…</option>
              {rest.map((c) => (
                <option key={c}>{c}</option>
              ))}
            </select>
            <button type="button" className="small" disabled={disabled || !add} onClick={() => (onChange([...seeds, add]), setSaid(`${add} is seed ${seeds.length + 1}`), setAdd(''))}>
              Add
            </button>
          </>
        )}
        <button type="button" className="ghost small" disabled={disabled} onClick={() => (onChange(candidates.slice(0, size)), setSaid('Seeds reset'))}>
          Reset to {candidates.length > size ? `the top ${size}` : 'the list order'}
        </button>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------- bracket slots

/**
 * A bracket placed slot by slot: each first-round match is two pickers (a deck or a bye). Placing a deck that sits in
 * another slot swaps the two, so the bracket stays a placement of the entrants.
 */
export function BracketSlotsEditor({ names, slots, onChange, disabled }: { names: string[]; slots: (string | null)[]; onChange: (s: (string | null)[]) => void; disabled?: boolean }) {
  const min = bracketSize(names.length);
  const sizes = [min, min * 2].filter((s) => s <= 64);
  const set = (i: number, v: string | null) => {
    const next = [...slots];
    const j = v === null ? -1 : next.indexOf(v);
    if (j >= 0 && j !== i) next[j] = next[i] ?? null;
    next[i] = v;
    onChange(next);
  };
  const resize = (size: number) => onChange(size === min ? seededSlots(names) : Array.from({ length: size }, (_, i) => slots[i] ?? null));
  const placed = new Set(slots.filter((s): s is string => s !== null));
  const missing = names.filter((n) => !placed.has(n));
  return (
    <div className="ev-slots">
      <div className="row small">
        <label className="row muted">
          Bracket size
          <select value={slots.length} onChange={(e) => resize(+e.target.value)} disabled={disabled}>
            {sizes.map((s) => (
              <option key={s} value={s}>
                {s} slots ({roundName(s)})
              </option>
            ))}
          </select>
        </label>
        <button type="button" className="ghost small" disabled={disabled} onClick={() => onChange(seededSlots(names))}>
          Reset to seed order
        </button>
        {missing.length > 0 && <span className="ev-warn">Not placed: {missing.join(', ')}</span>}
      </div>
      <ol className="ev-slot-list">
        {Array.from({ length: slots.length / 2 }, (_, m) => (
          <li key={m}>
            {[2 * m, 2 * m + 1].map((i, k) => (
              <span key={i} className="ev-slot">
                {k === 1 && <span className="muted"> vs </span>}
                <select aria-label={`Match ${m + 1}, ${k ? 'second' : 'first'} slot`} value={slots[i] ?? ''} onChange={(e) => set(i, e.target.value || null)} disabled={disabled}>
                  <option value="">— bye —</option>
                  {names.map((n) => (
                    <option key={n} value={n}>
                      {n}
                    </option>
                  ))}
                </select>
              </span>
            ))}
          </li>
        ))}
      </ol>
    </div>
  );
}

// ---------------------------------------------------------------- best-of per bracket round

export function BracketBoEditor({ slots, values, bestOf, onChange, disabled }: { slots: number; values: BestOf[]; bestOf: BestOf; onChange: (v: BestOf[]) => void; disabled?: boolean }) {
  const rounds: string[] = [];
  for (let alive = slots; alive > 1; alive /= 2) rounds.push(roundName(alive));
  if (!rounds.length) return null;
  return (
    <div className="row small" role="group" aria-label="Best-of per bracket round">
      <span className="muted">Bracket best-of</span>
      {rounds.map((r, i) => (
        <label key={r} className="row muted">
          {r}
          <select value={values[i] ?? bestOf} disabled={disabled} onChange={(e) => onChange(Array.from({ length: rounds.length }, (_, k) => (k === i ? (+e.target.value as BestOf) : (values[k] ?? bestOf))))}>
            {BEST_OF.map((b) => (
              <option key={b} value={b}>
                Bo{b}
              </option>
            ))}
          </select>
        </label>
      ))}
    </div>
  );
}

// ---------------------------------------------------------------- match list

export function MatchListEditor({ names, matches, bestOf, onChange, disabled }: { names: string[]; matches: MatchSpec[]; bestOf: BestOf; onChange: (m: MatchSpec[]) => void; disabled?: boolean }) {
  const [hero, setHero] = useState('');
  const [said, setSaid] = useState('');
  const set = (i: number, patch: Partial<MatchSpec>) => onChange(matches.map((m, k) => (k === i ? { ...m, ...patch } : m)));
  const lastRound = matches[matches.length - 1]?.round ?? 1;
  const deckSelect = (i: number, m: MatchSpec, side: 'a' | 'b') => (
    <select aria-label={`Match ${i + 1} deck ${side.toUpperCase()}`} value={m[side]} disabled={disabled} onChange={(e) => set(i, { [side]: e.target.value })} style={{ maxWidth: 220 }}>
      {!names.includes(m[side]) && <option value={m[side]}>{m[side] || '(pick a deck)'}</option>}
      {names.map((n) => (
        <option key={n} value={n}>
          {n}
        </option>
      ))}
    </select>
  );
  const addRow = () => {
    const a = names[0] ?? '';
    const b = names.find((n) => n !== a) ?? '';
    onChange([...matches, { a, b, round: lastRound }]);
    setSaid(`Added match ${matches.length + 1}`);
  };
  const eachVs = () => {
    if (!hero) return;
    const add = names.filter((n) => n !== hero).map((n) => ({ a: hero, b: n, round: lastRound }));
    onChange([...matches, ...add]);
    setSaid(`Added ${add.length} matches for ${hero}`);
  };
  return (
    <div className="ev-matches">
      <Said text={said} />
      {matches.length > 0 && (
        <div className="scroll-x">
          <table className="small ev-match-table">
            <thead>
              <tr>
                <th>#</th>
                <th>Round</th>
                <th>Deck A</th>
                <th />
                <th>Deck B</th>
                <th>Best of</th>
                <th title="Play this pairing this many times">Times</th>
                <th title="Swap the seats on every other repeat">Mirror</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {matches.map((m, i) => (
                <tr key={i}>
                  <td>{i + 1}</td>
                  <td>
                    <input type="number" min={1} max={99} aria-label={`Match ${i + 1} round`} value={m.round ?? 1} disabled={disabled} onChange={(e) => set(i, { round: Math.max(1, Math.min(99, Math.floor(+e.target.value) || 1)) })} style={{ width: 56 }} />
                  </td>
                  <td>{deckSelect(i, m, 'a')}</td>
                  <td className="muted">vs</td>
                  <td>{deckSelect(i, m, 'b')}</td>
                  <td>
                    <select aria-label={`Match ${i + 1} best of`} value={m.bestOf ?? bestOf} disabled={disabled} onChange={(e) => set(i, { bestOf: +e.target.value as BestOf })}>
                      {BEST_OF.map((b) => (
                        <option key={b} value={b}>
                          Bo{b}
                        </option>
                      ))}
                    </select>
                  </td>
                  <td>
                    <input type="number" min={1} max={100} aria-label={`Match ${i + 1} times`} value={m.times ?? 1} disabled={disabled} onChange={(e) => set(i, { times: Math.max(1, Math.min(100, Math.floor(+e.target.value) || 1)) })} style={{ width: 56 }} />
                  </td>
                  <td>
                    <input type="checkbox" aria-label={`Match ${i + 1} mirror the seats`} checked={!!m.mirror} disabled={disabled || (m.times ?? 1) < 2} onChange={(e) => set(i, { mirror: e.target.checked })} />
                  </td>
                  <td>
                    <button type="button" className="ghost small" aria-label={`Remove match ${i + 1}`} disabled={disabled} onClick={() => (onChange(matches.filter((_, k) => k !== i)), setSaid(`Removed match ${i + 1}`))}>
                      ✕
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      <div className="row small">
        <button type="button" className="small" disabled={disabled || names.length < 2} onClick={addRow}>
          + Add a match
        </button>
        <span className="muted">or</span>
        <select aria-label="Deck to play every other entrant" value={hero} onChange={(e) => setHero(e.target.value)} disabled={disabled}>
          <option value="">one deck…</option>
          {names.map((n) => (
            <option key={n}>{n}</option>
          ))}
        </select>
        <button type="button" className="small" disabled={disabled || !hero} onClick={eachVs}>
          vs every other entrant
        </button>
      </div>
      {names.length < 2 && <p className="muted small">Add at least two entrants to list matches (enter a deck twice for a mirror match).</p>}
    </div>
  );
}
