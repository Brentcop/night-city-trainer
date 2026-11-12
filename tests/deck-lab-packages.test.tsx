// Deck Lab synergy controls (ROADMAP2 §1 step 3): the Tune tab's "Synergies" fieldset keeps the packages a list is built
// around by default (or its game plan's packages) and leaves package moves off, saying so; the Breed tab's picker takes
// up to two packages and says when two pull opposite ways; results show the packages a list holds. Server-rendered to
// HTML (no DOM in this test setup); the state changes are the pure helpers the controls call.
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import { labDefaultKeep, LabSynergies, PackageChips, PackagePicker, pickPackage, toggleId } from '../src/ui/components/LabPackages';
import { DeckLabPage } from '../src/ui/pages/DeckLab';
import { DECK_OBJECTIVES } from '../src/content/deckObjectives';
import { BUILTIN } from '../src/lib/browserLibrary';
import { builtAroundIds, removePackage } from '../src/lib/deckPackages';
import { synergiesIn } from '../src/content/synergies';
import { cardValue } from '../src/ai/knowledge';
import { setArtEnabled } from '../src/ui/art';

function memoryStorage() {
  const m = new Map<string, string>();
  return { getItem: (k: string) => m.get(k) ?? null, setItem: (k: string, v: string) => void m.set(k, String(v)), removeItem: (k: string) => void m.delete(k), clear: () => m.clear() };
}
beforeEach(() => {
  vi.stubGlobal('localStorage', memoryStorage());
  setArtEnabled(false);
});
afterEach(() => vi.unstubAllGlobals());

// a meta deck built around at least one package and holding at least one it is not built around
const lib = BUILTIN.find((d) => d.kind === 'meta' && builtAroundIds(d.deck).length > 0 && synergiesIn(d.deck).some((x) => !x.builtAround))!;
const checkboxFor = (html: string, name: string) => html.match(new RegExp(`<input type="checkbox"[^>]*/> Keep <b>${name.replace(/[()+]/g, (c) => `\\${c}`)}</b>`))?.[0] ?? '';

describe('Deck Lab: Synergies (tune)', () => {
  it('keeps the built-around packages by default, leaves the others and package moves off, and says what the default does', () => {
    const { keep, from } = labDefaultKeep(lib.deck, lib.file);
    expect(from).toBe('built-around');
    expect(keep).toEqual(builtAroundIds(lib.deck));
    const html = renderToStaticMarkup(<LabSynergies deck={lib.deck} keep={keep} from={from} onKeep={() => undefined} moves={false} onMoves={() => undefined} />);
    expect(html).toContain('<legend>Synergies</legend>');
    expect(html).toContain('By default the lab keeps the packages this list is built around');
    expect(html).toContain('Package moves (complete, add, swap or remove a whole package) are off by default');
    for (const x of synergiesIn(lib.deck)) {
      const box = checkboxFor(html, x.synergy.name);
      expect(box, x.synergy.name).not.toBe('');
      expect(box.includes('checked'), x.synergy.name).toBe(x.builtAround);
    }
    expect(html).toMatch(/<input type="checkbox"\/> Try package moves/);
    // turned on: the box is checked
    expect(renderToStaticMarkup(<LabSynergies deck={lib.deck} keep={keep} from={from} onKeep={() => undefined} moves onMoves={() => undefined} />)).toMatch(/<input type="checkbox" checked=""\/> Try package moves/);
    // disabled while a run is going
    expect(renderToStaticMarkup(<LabSynergies deck={lib.deck} keep={keep} from={from} onKeep={() => undefined} moves={false} onMoves={() => undefined} disabled />)).toMatch(/<fieldset[^>]*disabled=""/);
  });

  it("a deck objective's packages are the default keep when it names some", () => {
    const note = DECK_OBJECTIVES[lib.file]!;
    const before = note.synergies;
    try {
      note.synergies = ['arasaka'];
      expect(labDefaultKeep(lib.deck, lib.file)).toEqual({ keep: ['arasaka'], from: 'objective' });
      const html = renderToStaticMarkup(<LabSynergies deck={lib.deck} keep={['arasaka']} from="objective" onKeep={() => undefined} moves={false} onMoves={() => undefined} />);
      expect(html).toContain('keeps the packages this deck&#x27;s game plan names');
      // a named package the list doesn't hold is still listed, so it can be unticked
      expect(html).toMatch(/<input type="checkbox" checked=""\/> Keep <b>Arasaka Units<\/b><\/label> <span class="muted small">named in the game plan/);
    } finally {
      if (before) note.synergies = before;
      else delete note.synergies;
    }
    // a pasted list has no objective
    expect(labDefaultKeep(lib.deck).from).toBe('built-around');
  });

  it('toggles keep one package at a time', () => {
    expect(toggleId(['a', 'b'], 'a')).toEqual(['b']);
    expect(toggleId(['b'], 'a')).toEqual(['b', 'a']);
  });

  it('the Tune tab shows the control for the chosen library deck, with the defaults', () => {
    const html = renderToStaticMarkup(<DeckLabPage q={new URLSearchParams(`d=${lib.file}`)} />);
    expect(html).toContain('<legend>Synergies</legend>');
    expect(html).toContain('whole-package moves, if you turn them on below');
    for (const id of builtAroundIds(lib.deck)) expect(checkboxFor(html, synergiesIn(lib.deck).find((x) => x.synergy.id === id)!.synergy.name)).toContain('checked');
  });
});

describe('Deck Lab: build around synergies (breed)', () => {
  it('picks at most two packages, the oldest pick giving way', () => {
    expect(pickPackage([], 'a')).toEqual(['a']);
    expect(pickPackage(['a'], 'b')).toEqual(['a', 'b']);
    expect(pickPackage(['a', 'b'], 'c')).toEqual(['b', 'c']);
    expect(pickPackage(['a', 'b'], 'a')).toEqual(['b']);
  });

  it('lists every package as a toggle button and reports the pair: trios that hold it, and a plain warning', () => {
    const none = renderToStaticMarkup(<PackagePicker value={[]} onChange={() => undefined} fitAll onFitAll={() => undefined} />);
    expect(none).toContain('<legend>Build around synergies</legend>');
    expect((none.match(/aria-pressed="false"/g) ?? []).length).toBe(21);
    expect(none).not.toContain('role="status"');
    const two = renderToStaticMarkup(<PackagePicker value={['low-cred', 'high-cred']} onChange={() => undefined} fitAll onFitAll={() => undefined} />);
    expect((two.match(/aria-pressed="true"/g) ?? []).length).toBe(2);
    expect(two).toMatch(/Behind on Street Cred \+ Ahead on Street Cred: [\d,]+ legal Legend trios can hold both/);
    expect(two).toContain('will rarely be online at the same time');
    expect(two).toMatch(/<input type="checkbox" checked=""\/> Also build mutants, crossovers and counters around them/);
  });
});

describe('Deck Lab: package chips on results', () => {
  it('marks packages added and removed against the starting list', () => {
    const id = builtAroundIds(lib.deck)[0]!;
    const m = removePackage(lib.deck, id, { score: cardValue });
    expect(m).not.toBeNull();
    const html = renderToStaticMarkup(<PackageChips deck={m!.deck} before={lib.deck} />);
    expect(html).toContain('Built around:');
    expect(html).toMatch(/class="tag is-out">− [^<]+<span class="sr-only"> \(removed\)/);
    expect(renderToStaticMarkup(<PackageChips deck={lib.deck} />)).not.toContain('is-out');
  });
});
