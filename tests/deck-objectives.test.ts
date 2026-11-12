// Deck objectives (src/content/deckObjectives, docs/ROADMAP.md §5 and §7): every library deck has a strategy note tied
// to its current list, the notes only name real cards and defined signal terms, statuses agree with their sources, and
// no note copies a long run of words from the local choom.gg guide pages (data/raw/, local-only; skipped without it).
import { describe, expect, it } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import { BUILTIN } from '../src/lib/browserLibrary';
import { CARD_BY_ID } from '../src/engine/cards';
import { listFingerprint } from '../src/engine/deck';
import { GUIDES } from '../src/content/guides';
import { DECK_OBJECTIVES, isOwnerImport, objectiveFor, SIGNAL_TERMS, VOCABULARY, type DeckObjective } from '../src/content/deckObjectives';
import { ARCHIVED_DECK_OBJECTIVES, ARCHIVED_DIR } from '../src/content/deckObjectives/archived';
import { parseDeck } from '../src/engine/deck';

const entries = Object.entries(DECK_OBJECTIVES);
const byFile = new Map(BUILTIN.map((d) => [d.file, d]));

/** Every piece of prose in a note. */
const texts = (n: DeckObjective) => [n.objective, ...n.plan.map((p) => p.text), ...n.keyCards.map((k) => k.role), ...n.signals.map((s) => s.text), ...n.risks];

describe('deck objectives', () => {
  it('covers every active library deck, and only active library decks', () => {
    expect(BUILTIN.length).toBeGreaterThan(25);
    expect(BUILTIN.map((d) => d.file).filter((f) => !DECK_OBJECTIVES[f])).toEqual([]);
    expect(entries.map(([f]) => f).filter((f) => !byFile.has(f))).toEqual([]);
  });

  it('keeps the archived decks’ notes apart, each still matching its archived list', () => {
    const archived = fs.readdirSync(ARCHIVED_DIR).filter((f) => f.endsWith('.txt'));
    expect(archived.length).toBeGreaterThan(0);
    // every archived list has its note and every archived note has its list
    expect(archived.filter((f) => !ARCHIVED_DECK_OBJECTIVES[f])).toEqual([]);
    expect(Object.keys(ARCHIVED_DECK_OBJECTIVES).filter((f) => !archived.includes(f))).toEqual([]);
    for (const f of archived) expect(ARCHIVED_DECK_OBJECTIVES[f].listId, f).toBe(listFingerprint(parseDeck(fs.readFileSync(path.join(ARCHIVED_DIR, f), 'utf8'), f).deck));
    // the site bundles only the active folders (data/decks and data/decks/custom), never the archive
    const active = ['data/decks', 'data/decks/custom'].flatMap((dir) => fs.readdirSync(dir).filter((f) => f.endsWith('.txt')));
    expect(BUILTIN.map((d) => d.file).sort()).toEqual(active.sort());
  });

  it('ties each note to the current list (listFingerprint)', () => {
    const stale = entries.filter(([f, n]) => n.listId !== listFingerprint(byFile.get(f)!.deck)).map(([f]) => f);
    expect(stale).toEqual([]);
    const d = BUILTIN[0];
    expect(objectiveFor(d.file, d.deck)?.current).toBe(true);
    expect(objectiveFor(d.file, { legends: d.deck.legends, main: d.deck.main.slice(1) })?.current).toBe(false);
  });

  it.each(entries)('%s: shape, and key cards are real cards in the list', (file, n) => {
    const deck = byFile.get(file)!.deck;
    expect(n.objective.trim()).not.toBe('');
    expect(n.plan.length).toBeGreaterThanOrEqual(2);
    expect(n.plan.length).toBeLessThanOrEqual(4);
    for (const p of n.plan) expect(['early', 'mid', 'closing']).toContain(p.phase);
    expect(n.keyCards.length).toBeGreaterThanOrEqual(3);
    expect(n.keyCards.length).toBeLessThanOrEqual(6);
    for (const k of n.keyCards) {
      expect(CARD_BY_ID[k.id], k.id).toBeDefined();
      expect([...deck.legends, ...deck.main], k.id).toContain(k.id);
      expect(k.role.trim()).not.toBe('');
    }
    expect(n.signals.length).toBeGreaterThanOrEqual(2);
    expect(n.signals.length).toBeLessThanOrEqual(4);
    for (const t of texts(n)) expect(t.trim()).not.toBe('');
  });

  it('uses only defined vocabulary terms, each with a definition', () => {
    for (const t of SIGNAL_TERMS) expect(VOCABULARY[t].length).toBeGreaterThan(10);
    const undefinedTerms = entries.flatMap(([f, n]) => n.signals.flatMap((s) => (s.terms.length ? s.terms : ['(none)']).filter((t) => !(t in VOCABULARY)).map((t) => `${f}: ${t}`)));
    expect(undefinedTerms).toEqual([]);
  });

  it.each(entries)('%s: status and source agree with the deck’s origin', (file, n) => {
    const d = byFile.get(file)!;
    // the decks the owner brought in have a placeholder, a draft read off the list, or the owner's note; nothing else
    // is a placeholder
    if (isOwnerImport(d.prov)) {
      expect(['needs-owner', 'draft', 'owner']).toContain(n.status);
      if (n.status === 'draft') expect(n.source).toBe('list');
    } else expect(n.status).not.toBe('needs-owner');
    if (n.status === 'needs-owner') {
      expect(n.placeholder).toBe(true);
      expect(n.source).toBe('list');
    } else if (n.status === 'draft') expect(n.placeholder).toBeFalsy();
    if (n.placeholder) expect(n.objective).toMatch(/^Placeholder/);

    if (n.source === 'guide') {
      expect(n.guide, 'guide-sourced notes credit the guide').toBeDefined();
      if (n.guide!.site === 'choom.gg') {
        expect(d.prov.origin).toMatch(/^choom\.gg community guide/);
        expect(n.guide!.author).toBe(d.prov.author);
        expect(n.guide!.url).toBe(d.prov.source);
      } else {
        const g = GUIDES.find((x) => x.deckFile === file);
        expect(g, 'a Strategy page guide for this deck').toBeDefined();
        expect(n.guide!.title).toBe(g!.title);
        expect(n.guide!.url).toBe(`#/guides?g=${g!.slug}`);
      }
    }
    if (n.source === 'parent') {
      expect(n.basedOn?.length, 'parent-sourced notes name their parents').toBeGreaterThan(0);
      for (const p of n.basedOn!) expect(byFile.has(p), p).toBe(true);
    } else expect(n.basedOn).toBeUndefined();
  });

  const GUIDE_DIR = 'data/raw/choom_guides';
  const RUN = 10;
  const words = (s: string) =>
    s
      .toLowerCase()
      .replace(/[’']/g, '')
      .split(/[^a-z0-9€$+]+/)
      .filter(Boolean);
  it.skipIf(!fs.existsSync(GUIDE_DIR))(`copies no run of ${RUN}+ words from the local choom.gg guides`, () => {
    const shingles = new Set<string>();
    for (const f of fs.readdirSync(GUIDE_DIR).filter((x) => x.endsWith('.txt'))) {
      const w = words(fs.readFileSync(path.join(GUIDE_DIR, f), 'utf8'));
      for (let i = 0; i + RUN <= w.length; i++) shingles.add(w.slice(i, i + RUN).join(' '));
    }
    expect(shingles.size).toBeGreaterThan(100);
    const copied: string[] = [];
    for (const [file, n] of entries)
      for (const t of texts(n)) {
        const w = words(t);
        for (let i = 0; i + RUN <= w.length; i++) if (shingles.has(w.slice(i, i + RUN).join(' '))) copied.push(`${file}: “${w.slice(i, i + RUN).join(' ')}”`);
      }
    expect(copied).toEqual([]);
  });
});
