// One answer to "which packages does this list have" (src/lib/listPackages.ts; REVIEW_2026-11-24 S3, B.10): the rules
// in order, the same answer as before for every library list in every layer that asks (the bots and coach, the Deck
// Lab's default keep, the forge's and optimizer's objective keep), and a tuned list keeping the packages of the list it
// came from.
import { describe, expect, it } from 'vitest';
import { DECK_OBJECTIVES } from '../src/content/deckObjectives';
import { NOTE_SYNERGIES } from '../src/content/deckObjectives/noteSynergies';
import { SYNERGY_BY_ID, synergiesIn } from '../src/content/synergies';
import { packagesForList } from '../src/ai/packages';
import { listFingerprint } from '../src/engine/deck';
import { defaultKeep } from '../src/lib/deckPackages';
import { listPackages, notePackages } from '../src/lib/listPackages';
import { labDefaultKeep } from '../src/ui/components/LabPackages';
import { objectivePackages } from '../scripts/package-flags';
import { loadLibrary } from '../scripts/lib-node';

const LIB = loadLibrary();
const noted = LIB.find((d) => NOTE_SYNERGIES[listFingerprint(d.deck)])!;
const plain = LIB.find((d) => !NOTE_SYNERGIES[listFingerprint(d.deck)] && synergiesIn(d.deck).some((x) => x.builtAround))!;

describe('the rules, in order', () => {
  it('the note in hand, then the slim table by fingerprint, then the lineage, then built around', () => {
    const fp = listFingerprint(noted.deck);
    expect(listPackages(noted.deck)).toEqual({ ids: NOTE_SYNERGIES[fp], source: 'note', from: fp });
    expect(listPackages(noted.deck, { note: ['arasaka', 'not-a-package'] })).toEqual({ ids: ['arasaka'], source: 'note' });
    const tuned = { ...noted.deck, main: [...noted.deck.main.slice(1), plain.deck.main[0]!] };
    expect(listPackages(tuned).source).toBe('built-around');
    expect(listPackages(tuned, { lineage: ['0000000000000000', fp] })).toEqual({ ids: NOTE_SYNERGIES[fp], source: 'parent-note', from: fp });
    const around = listPackages(plain.deck);
    expect(around.source).toBe('built-around');
    expect(around.ids).toEqual(synergiesIn(plain.deck).filter((x) => x.builtAround).map((x) => x.synergy.id));
    expect(notePackages(plain.deck)).toEqual([]);
  });
});

describe('every layer gives today’s library lists the answer it gave before', () => {
  it.each(LIB.map((d) => [d.file, d] as const))('%s', (file, d) => {
    const fp = listFingerprint(d.deck);
    // the bots and coach: the note's row by fingerprint, else the built-around packages in synergiesIn's order
    const row = NOTE_SYNERGIES[fp];
    const before = row ? row.filter((id) => SYNERGY_BY_ID[id]) : synergiesIn(d.deck).filter((x) => x.builtAround).map((x) => x.synergy.id);
    expect(packagesForList(d.deck, fp).map((p) => p.id)).toEqual(before);
    // the Deck Lab: the note of the file, else built around in catalogue order
    const named = DECK_OBJECTIVES[file]?.synergies;
    expect(labDefaultKeep(d.deck, file)).toEqual({ keep: defaultKeep(d.deck, named), from: named?.length ? 'objective' : 'built-around' });
    // the forge's and optimizer's objective keep: the note's ids as written
    expect(objectivePackages(file, d.deck)).toEqual([...(named ?? [])]);
    expect(objectivePackages(file)).toEqual([...(named ?? [])]);
  });
});

describe('a list derived from a noted one', () => {
  it("the Deck Lab's default keep for a tuned deck is the packages of the list it was tuned from", () => {
    const fp = listFingerprint(noted.deck);
    const tuned = { ...noted.deck, main: [...noted.deck.main.slice(1), plain.deck.main[0]!] };
    expect(labDefaultKeep(tuned).from).toBe('built-around');
    expect(labDefaultKeep(tuned, undefined, [fp])).toEqual({ keep: [...NOTE_SYNERGIES[fp]!], from: 'objective' });
  });

  it("the forge's objective keep for a file whose own note names none reads the list's row", () => {
    // a copy of a noted list under another file name (no note of its own) gets the row of its fingerprint
    expect(objectivePackages('no-such-file.txt', noted.deck)).toEqual([...NOTE_SYNERGIES[listFingerprint(noted.deck)]!]);
    expect(objectivePackages('no-such-file.txt')).toEqual([]);
  });
});
