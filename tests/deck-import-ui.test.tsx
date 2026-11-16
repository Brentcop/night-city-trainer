// #/admin, "Import decks" (src/ui/components/AdminDeckImport.tsx): the section rendered with pasted links and a small
// loaded import (each link sorted with its reason, the command for the script, the preview with its checks), what
// "Add to My decks" stores, and that the admin page loads the section on its own and the entry chunk reaches none of it.
import fs from 'node:fs';
import path from 'node:path';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import { AdminDeckImport, blockedWords, canFile, canSave, previewDecks, storedDecks } from '../src/ui/components/AdminDeckImport';
import { AdminPage } from '../src/ui/pages/Admin';
import { buildDeck, IMPORT_KIND, readImportValue, type RawDeck } from '../src/lib/deckImport';
import { listFingerprint } from '../src/engine/deck';
import { addCustomDecks, allDecks, BUILTIN, loadStored, toDeck } from '../src/lib/browserLibrary';
import { byIdLink, fromLink, OWNER_COMPACT } from './deckImportFixtures';

function memoryStorage() {
  const m = new Map<string, string>();
  return { getItem: (k: string) => m.get(k) ?? null, setItem: (k: string, v: string) => void m.set(k, String(v)), removeItem: (k: string) => void m.delete(k), clear: () => m.clear() };
}
beforeEach(() => {
  vi.stubGlobal('localStorage', memoryStorage());
});
afterEach(() => {
  vi.unstubAllGlobals();
});

const good = fromLink(byIdLink('Mantis Blades <b>Team</b> - Made Up Cup (1st)'));
const loaded = (decks: RawDeck[]) => readImportValue({ kind: IMPORT_KIND, schema: 1, ran: '2026-11-16T10:00:00Z', links: [{ link: 'https://choom.gg/decks', status: 'fetched', decks: 1, note: '40 deck links on the page' }], decks });
/** The library without any deck that has the made-up lists (so these tests hold whatever the library comes to hold). */
const LIB = BUILTIN.filter((d) => listFingerprint(d.deck) !== buildDeck(good).listId);
const unmatched: RawDeck = { ...good, name: 'Broken', main: [...good.main, { ref: 'Johnny Silverhand', by: 'name', count: 1 }] };

describe('the Import decks section', () => {
  it('sorts the pasted links, each with its reason, and gives the command for the ones that need the script', () => {
    const links = [OWNER_COMPACT, 'https://choom.gg/decks', 'https://example.com/x', 'https://choom.gg/api/decks'].join('\n');
    const html = renderToStaticMarkup(<AdminDeckImport initialLinks={links} library={LIB} />);
    expect(html).toContain('runs on your own machine');
    expect(html).toContain('a few at a time');
    for (const chip of ['Read here', 'Needs the script', 'Refused']) expect(html).toContain(chip);
    expect(html).toContain('This tool reads only choom.gg and cyberpunk-tcg-sim.online.');
    expect(html).toContain('stay out of /api/ and /admin');
    expect(html).toContain('python tools/import_decks.py &quot;https://choom.gg/decks&quot;');
    expect(html).toContain('Copy the command');
    expect(html).toContain('deck-import.json');
    // the compact link is read at once: one deck to look over, named after its Legends
    expect(html).toContain('1 deck to look over');
    expect(html).toContain('value="Adam Smasher / Padre / V: Streetkid"');
    expect(html).toContain('Main deck 40, sideboard 7');
    expect(html).toContain('Legal list.');
  });

  it('previews a loaded file: names editable, author and source, legality, unmatched cards, the same-list report', () => {
    const html = renderToStaticMarkup(<AdminDeckImport initialLinks={OWNER_COMPACT} initialFile={{ name: 'deck-import.json', result: loaded([good, unmatched]) }} library={LIB} />);
    expect(html).toContain('<b>deck-import.json</b>: 2 decks');
    expect(html).toContain('40 deck links on the page');
    expect(html).toContain('3 decks to look over');
    // other people's text is plain text: escaped, never markup
    expect(html).toContain('value="Mantis Blades &lt;b&gt;Team&lt;/b&gt; - Made Up Cup (1st)"');
    expect(html).not.toContain('<b>Team</b>');
    expect(html).toContain('By Mantis Blades &lt;b&gt;Team&lt;/b&gt;');
    expect(html).toContain('placed 1st');
    expect(html).toContain('Same list as deck 1 of this import (Adam Smasher / Padre / V: Streetkid).');
    expect(html).toContain('Not matched: “Johnny Silverhand” could be');
    expect(html).toContain('Not addable: some cards could not be matched.');
    expect(html).toContain('Add to My decks (1)');
    expect(html).toContain('Download deck files (1)');
    expect(html).toContain('Download import-adam-smasher-padre-v-streetkid.txt');
  });

  it('shows a refused file in one sentence', () => {
    const html = renderToStaticMarkup(<AdminDeckImport initialFile={{ name: 'x.json', result: readImportValue({ kind: 'nct-profile', schema: 1 }) }} />);
    expect(html).toContain('x.json: This is not a deck-import file from tools/import_decks.py');
  });

  it('says when the library or this browser already has the list, and blocks adding it twice', () => {
    const twin = LIB.find((d) => d.deck.legends.length === 3)!;
    const fromLibrary: RawDeck = { ...good, name: 'Copy of a library deck', legends: twin.deck.legends.map((id) => ({ ref: id, by: 'id', count: 1 })), main: [...new Set(twin.deck.main)].map((id) => ({ ref: id, by: 'id', count: twin.deck.main.filter((x) => x === id).length })), sideboard: [] };
    const p = previewDecks([], [fromLibrary, good], {}, LIB, '2026-11-16');
    expect(p[0]!.holder).toEqual({ where: 'library', file: twin.file, name: twin.deck.name });
    expect(canSave(p[0]!)).toBe(false);
    expect(canFile(p[0]!)).toBe(false);
    expect(blockedWords(p[0]!)).toBe('Not addable: this list is there already.');
    // saved here: not added twice, but still offered for the library
    expect(addCustomDecks(storedDecks([p[1]!], allDecks()))).toBe(true);
    const saved = [...LIB, ...allDecks().filter((d) => d.file.startsWith('custom:'))];
    const again = previewDecks([], [good], {}, saved, '2026-11-16');
    expect(again[0]!.holder?.where).toBe('saved');
    expect(canSave(again[0]!)).toBe(false);
    expect(canFile(again[0]!)).toBe(true);
    expect(renderToStaticMarkup(<AdminDeckImport initialFile={{ name: 'f.json', result: loaded([good]) }} library={saved} />)).toContain('This browser already has this list in My decks, as Mantis Blades &lt;b&gt;Team&lt;/b&gt; - Made Up Cup (1st).');
  });

  it('“Add to My decks” stores the list as imported, with its source link and a credit line, under a free name', () => {
    const p = previewDecks([], [good, { ...fromLink(OWNER_COMPACT), name: good.name }], { 'file:1:x': 'ignored' }, LIB, '2026-11-16');
    const decks = storedDecks(p, [...BUILTIN, { file: `custom:${good.name}`, deck: { name: good.name, legends: [], main: [], sideboard: [] }, kind: 'custom', prov: {} }]);
    expect(decks.map((d) => d.name)).toEqual([`${good.name} (2)`, `${good.name} (3)`]);
    const d = decks[0]!;
    expect(d.origin).toBe('imported');
    expect(d.source).toBe(good.source.link);
    expect(d.notes).toBe('Imported from cyberpunk-tcg-sim.online, by Mantis Blades <b>Team</b>, placed 1st.');
    expect(d.main.length).toBe(40);
    expect(d.sideboard.length).toBe(7);
    // an older reader keeps every field it knows; a deck saved before this change still reads
    expect(toDeck(JSON.parse(JSON.stringify(d)))).toMatchObject({ name: d.name, source: d.source, notes: d.notes, origin: 'imported' });
    expect(addCustomDecks(decks)).toBe(true);
    expect(loadStored().map((s) => s.name)).toEqual(decks.map((x) => x.name));
    expect(loadStored()[0]!.added).toMatch(/^\d{4}-/);
  });

  it('keeps an edited name, and checks the deck under it', () => {
    const p = previewDecks([good], [], { [`link:0:${good.source.link}`]: 'My own name' }, LIB, '2026-11-16');
    expect(p[0]!.built.deck.name).toBe('My own name');
    expect(buildDeck({ ...good, name: 'My own name' }).listId).toBe(p[0]!.built.listId);
    const odd = previewDecks([good], [], { [`link:0:${good.source.link}`]: 'Origin: here' }, LIB, '2026-11-16');
    expect(odd[0]!.fileProblem).toMatch(/does not survive the file format/);
    expect(canSave(odd[0]!)).toBe(true);
    expect(canFile(odd[0]!)).toBe(false);
  });
});

describe('the admin page and the bundle', () => {
  it('shows the section on the admin page, loaded on its own', () => {
    const html = renderToStaticMarkup(<AdminPage />);
    expect(html).toContain('<legend>Import decks</legend>');
  });

  const ROOT = path.resolve(__dirname, '..');
  /** Modules reachable from `entry` through static imports only (dynamic `import()` and `import type` don't count). */
  function staticGraph(entry: string): string[] {
    const seen = new Set<string>();
    const exts = ['', '.ts', '.tsx', '/index.ts'];
    const walk = (file: string) => {
      if (seen.has(file)) return;
      seen.add(file);
      if (!/\.tsx?$/.test(file)) return;
      const src = fs.readFileSync(file, 'utf8');
      const re = /^\s*(?:import|export)\s+(?!type\b)(?:[^'";]*?\sfrom\s+)?['"]([^'"]+)['"]/gm;
      for (const m of src.matchAll(re)) {
        const spec = m[1]!;
        if (!spec.startsWith('.')) continue;
        const base = path.resolve(path.dirname(file), spec.replace(/\?.*$/, ''));
        const hit = exts.map((e) => base + e).find((p) => fs.existsSync(p) && fs.statSync(p).isFile());
        if (hit) walk(hit);
      }
    };
    walk(path.join(ROOT, entry));
    return [...seen].map((f) => path.relative(ROOT, f).replace(/\\/g, '/'));
  }
  const NEW = ['src/lib/deckImport.ts', 'src/ui/components/AdminDeckImport.tsx'];

  it('the entry chunk reaches neither the import code nor its section', () => {
    const entry = staticGraph('src/main.tsx');
    expect(entry).toContain('src/ui/useSiteConfig.ts'); // (control) the walker sees the entry's graph
    for (const f of NEW) expect(entry).not.toContain(f);
  });

  it('the admin page loads the section only on demand, and the import code needs no browser library', () => {
    const admin = staticGraph('src/ui/pages/Admin.tsx');
    for (const f of NEW) expect(admin).not.toContain(f);
    expect(staticGraph('src/ui/components/AdminDeckImport.tsx')).toContain('src/lib/deckImport.ts');
    // the command-line step runs it under Node: no Vite-only module (the bundled library) in its graph
    expect(staticGraph('src/lib/deckImport.ts')).not.toContain('src/lib/browserLibrary.ts');
  });
});
