// Importing decks from shared links (src/lib/deckImport.ts, docs/DECK_IMPORT.md): the card resolver (every reference
// form, the six accented cards, unknown and ambiguous references), both deck-builder link forms (the owner's compact
// example), the untrusted import-file reader, the same-list report, the link sorter, the command, and the library file
// with its placeholder note. Made-up decks only; no saved page from either site.
import { describe, expect, it } from 'vitest';
import { CARDS, CARD_BY_ID } from '../src/engine/cards';
import { listFingerprint } from '../src/engine/deck';
import { libraryDeck } from '../src/lib/library';
import { isOwnerImport, SIGNAL_TERMS } from '../src/content/deckObjectives';
import {
  buildDeck,
  deckFileName,
  deckFileProblem,
  deckFileText,
  decodeDeckBuilder,
  holderWords,
  IMPORT_KIND,
  IMPORT_LIMITS,
  importDocument,
  legendsName,
  nameKey,
  placeholderNote,
  readImport,
  readImportValue,
  resolveRef,
  sameListHolders,
  scriptCommand,
  sortLink,
  sortLinks,
  splitDeckName,
  type RawDeck,
} from '../src/lib/deckImport';
import { byIdLink, fromLink, OWNER_COMPACT } from './deckImportFixtures';

const ok = (r: ReturnType<typeof resolveRef>) => (r.ok ? r.card.id : `no: ${r.why}`);

describe('the card resolver', () => {
  it('reads "cb-" ids: the project id with dashes first', () => {
    expect(ok(resolveRef({ ref: 'cb-6th-street-recruits', by: 'id' }))).toBe('6th_street_recruits');
    expect(ok(resolveRef({ ref: 'cb-muamar-reyes-el-capitan', by: 'id' }))).toBe('muamar_reyes_el_capitan');
    expect(ok(resolveRef({ ref: 'cb-royce-don-t-call-me-simon' }))).toBe('royce_don_t_call_me_simon');
    expect(ok(resolveRef({ ref: 'adam_smasher_ender_of_legends' }))).toBe('adam_smasher_ender_of_legends');
  });

  it('reads the card database ids too, including the older spelling of the six accented cards', () => {
    const accented = CARDS.filter((c) => c.eid && c.eid !== `cb-${c.id.replace(/_/g, '-')}`);
    expect(accented.map((c) => c.id).sort()).toEqual(
      ['el_sombreron_la_venganza_lenta', 'gilded_maton', 'judy_alvarez_braindance_maestro', 'judy_alvarez_nothing_to_doubt', 'les_elemens', 'muamar_reyes_el_capitan'].sort(),
    );
    for (const c of accented) {
      expect(ok(resolveRef({ ref: c.eid!, by: 'id' })), c.eid!).toBe(c.id);
      expect(ok(resolveRef({ ref: `cb-${c.id.replace(/_/g, '-')}`, by: 'id' }))).toBe(c.id);
      expect(ok(resolveRef({ ref: c.displayName, by: 'name' }))).toBe(c.id);
    }
    // every card resolves by its own id form, its database id and its name
    for (const c of CARDS) {
      expect(ok(resolveRef({ ref: `cb-${c.id.replace(/_/g, '-')}` }))).toBe(c.id);
      if (c.eid) expect(ok(resolveRef({ ref: c.eid }))).toBe(c.id);
      expect(ok(resolveRef({ ref: c.displayName, by: 'name' }))).toBe(c.id);
    }
  });

  it('reads compact codes: set letter, print number in base 36, the number’s letter', () => {
    expect(ok(resolveRef({ ref: 'w1', by: 'code' }))).toBe('adam_smasher_ender_of_legends');
    expect(ok(resolveRef({ ref: 'w22', by: 'code' }))).toBe('padre_man_of_the_cross'); // 2·36 + 2 = 074
    expect(ok(resolveRef({ ref: 'w2s', by: 'code' }))).toBe('memory_relapse'); // 2·36 + 28 = 100
    expect(ok(resolveRef({ ref: 'w5-a', by: 'code' }))).toBe('v_streetkid'); // 005a
    expect(ok(resolveRef({ ref: 't1', by: 'code' }))).toBe('viktor_vektor_sit_down_and_relax');
    expect(ok(resolveRef({ ref: 'e1', by: 'code' }))).toBe('yorinobu_arasaka_embracing_destruction');
    // 005 without its letter is no card: reported, never taken for 005a
    expect(ok(resolveRef({ ref: 'w5', by: 'code' }))).toMatch(/^no: Code w5 is not a card/);
    expect(ok(resolveRef({ ref: 'wzz', by: 'code' }))).toMatch(/^no: /);
    // one code per card
    const codes = new Set(CARDS.map((c) => `${c.set[0]}${parseInt(c.number, 10).toString(36)}${c.number.replace(/^\d+/, '') ? `-${c.number.replace(/^\d+/, '')}` : ''}`));
    expect(codes.size).toBe(CARDS.length);
    for (const code of codes) expect(ok(resolveRef({ ref: code, by: 'code' }))).not.toMatch(/^no:/);
  });

  it('reads names whatever the dash, colon, case, accents and apostrophes', () => {
    for (const n of ['Johnny Silverhand — Rocking Renegade', 'Johnny Silverhand: Rocking Renegade', 'johnny silverhand - rocking renegade', 'JOHNNY SILVERHAND – ROCKING RENEGADE'])
      expect(ok(resolveRef({ ref: n, by: 'name' })), n).toBe('johnny_silverhand_rocking_renegade');
    expect(ok(resolveRef({ ref: 'Muamar Reyes — El Capitan', by: 'name' }))).toBe('muamar_reyes_el_capitan');
    expect(ok(resolveRef({ ref: 'Muamar Reyes: El Capitán', by: 'name' }))).toBe('muamar_reyes_el_capitan');
    expect(ok(resolveRef({ ref: 'Rockn’ Rockerboy', by: 'name' }))).toBe('rockn_rockerboy');
    expect(ok(resolveRef({ ref: "Rockn' Rockerboy", by: 'name' }))).toBe('rockn_rockerboy');
    expect(ok(resolveRef({ ref: 'Kerry Eurodyne — Axe, Attitude, Audience' }))).toBe('kerry_eurodyne_axe_attitude_audience');
    expect(ok(resolveRef({ ref: 'Padre', by: 'name' }))).toBe('padre_man_of_the_cross'); // only one card is named Padre
    expect(nameKey('Judy Álvarez — Braindance Maestro')).toBe(nameKey('judy alvarez: braindance maestro'));
  });

  it('reports an ambiguous or unknown name, never guesses', () => {
    const r = resolveRef({ ref: 'Johnny Silverhand', by: 'name' });
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.why).toMatch(/could be Johnny Silverhand: .* or Johnny Silverhand: .*: the subname is needed\./);
    expect(ok(resolveRef({ ref: 'Johnny Silverhand — Rocking Renega', by: 'name' }))).toMatch(/^no: .* is not a card this trainer knows/);
    expect(ok(resolveRef({ ref: 'Not A Card', by: 'name' }))).toMatch(/^no: /);
    expect(ok(resolveRef({ ref: 'cb-not-a-card', by: 'id' }))).toMatch(/^no: cb-not-a-card is not a card/);
  });

  it('takes no property every object has for a card', () => {
    // the card table is a plain object: "constructor" and "__proto__" are in it without being cards
    for (const ref of ['constructor', '__proto__', 'toString', 'hasOwnProperty', 'valueOf', 'cb-constructor', 'cb---proto--', 'cb-toString'])
      for (const by of ['id', 'code', 'name', undefined] as const) expect(ok(resolveRef({ ref, ...(by ? { by } : {}) })), `${ref} by ${by}`).toMatch(/^no: /);
    const link = 'https://cyberpunk-tcg-sim.online/deck-builder/?deck=cb-constructor:1,cb-adam-smasher-ender-of-legends:1,cb-muamar-reyes-el-capitan:1,cb-constructor:3,cb-mantis-blades:3&type=cyberpunk';
    const built = buildDeck(fromLink(link));
    expect(built.unmatched).toEqual(['cb-constructor is not a card this trainer knows.', 'cb-constructor is not a card this trainer knows.']);
    expect(built.deck.legends).toEqual(['adam_smasher_ender_of_legends', 'muamar_reyes_el_capitan']);
    expect(built.deck.main).toEqual(['mantis_blades', 'mantis_blades', 'mantis_blades']);
    expect(built.ready).toBe(false);
  });

  it('takes the name the site shows beside an id: a second way in, and a check', () => {
    expect(ok(resolveRef({ ref: 'cb-renamed-card', by: 'id', name: 'Mantis Blades' }))).toBe('mantis_blades');
    expect(ok(resolveRef({ ref: 'cb-detonate', by: 'id', name: 'Mantis Blades' }))).toMatch(/^no: cb-detonate is Detonate, but the site names it “Mantis Blades”/);
    expect(ok(resolveRef({ ref: 'cb-detonate', by: 'id', name: 'Detonate' }))).toBe('detonate');
  });
});

describe('deck-builder links', () => {
  it('decodes the owner’s compact example: Adam Smasher / Padre / V: Streetkid, 40 main cards, 7 sideboard cards', () => {
    const raw = fromLink(OWNER_COMPACT);
    expect(raw.legends.map((r) => r.ref)).toEqual(['w1', 'w22', 'w5-a']);
    expect(raw.notes).toEqual([]);
    expect(raw.name).toBe('');
    const d = buildDeck(raw);
    expect(d.deck.legends).toEqual(['adam_smasher_ender_of_legends', 'padre_man_of_the_cross', 'v_streetkid']);
    expect(d.deck.main.length).toBe(40);
    expect(d.deck.sideboard.length).toBe(7);
    expect(d.unmatched).toEqual([]);
    expect(d.illegal).toEqual([]);
    expect(d.ready).toBe(true);
    expect(d.deck.name).toBe('Adam Smasher / Padre / V: Streetkid');
    expect(d.deck.source).toBe(OWNER_COMPACT);
  });

  it('decodes a link by card id to the same deck, with its name, author and placement', () => {
    const raw = fromLink(byIdLink());
    expect(raw.name).toBe('Player One - Made Up Cup (1st)');
    expect(raw.author).toBe('Player One');
    expect(raw.source.placement).toBe('1st');
    expect(raw.source.site).toBe('cyberpunk-tcg-sim.online');
    const d = buildDeck(raw);
    const c = buildDeck(fromLink(OWNER_COMPACT));
    expect(d.listId).toBe(c.listId);
    expect([...d.deck.sideboard].sort()).toEqual([...c.deck.sideboard].sort());
    expect(d.ready).toBe(true);
  });

  it('carries the parts it does not understand as notes, and refuses a link without a list', () => {
    const raw = fromLink('https://cyberpunk-tcg-sim.online/deck-builder/?d=x.l.w1.w22.w5-a.d.3_w6.zz_9.q.1_w7');
    expect(raw.legends.length).toBe(3);
    expect(raw.main.map((r) => [r.ref, r.count])).toEqual([['w6', 3]]);
    expect(raw.notes).toEqual(['section not understood: x', 'part not understood: zz_9', 'section not understood: q', 'part not understood: 1_w7']);
    expect(decodeDeckBuilder(new URL('https://cyberpunk-tcg-sim.online/deck-builder/?deck=saved-abc'))).toEqual({ why: expect.stringMatching(/carries no list/) });
    expect(decodeDeckBuilder(new URL('https://cyberpunk-tcg-sim.online/deck-builder/?deck=cb-a:x'))).toEqual({ why: 'This deck-builder link has no cards in it.' });
  });

  it('splits a name into its author and placement only in the shapes the sites write', () => {
    expect(splitDeckName('TrueDuelist - Discord 5k Celebration Tournament (1st)')).toEqual({ author: 'TrueDuelist', placement: '1st' });
    expect(splitDeckName('Adam Smasher / Padre / V: Streetkid (Season-1 #1)')).toEqual({ author: '', placement: 'Season-1 #1' });
    expect(splitDeckName('Smash - and grab')).toEqual({ author: '', placement: '' });
  });
});

describe('sorting pasted links', () => {
  it('reads here, needs the script, or refuses, each with a reason', () => {
    const kinds = (t: string) => sortLinks(t).map((s) => [s.kind, s.link]);
    expect(kinds(`${OWNER_COMPACT}\n${byIdLink()}`).map(([k]) => k)).toEqual(['decoded', 'decoded']);
    expect(kinds('https://choom.gg/decks/d9688e23-eb69-4bc0-b52e-bc9e728d9d15 https://choom.gg/decks https://cyberpunk-tcg-sim.online/meta/discord-5k-celebration-tournament')).toEqual([
      ['script', 'https://choom.gg/decks/d9688e23-eb69-4bc0-b52e-bc9e728d9d15'],
      ['script', 'https://choom.gg/decks'],
      ['script', 'https://cyberpunk-tcg-sim.online/meta/discord-5k-celebration-tournament'],
    ]);
    expect(sortLink('choom.gg/decks')).toMatchObject({ kind: 'script', link: 'https://choom.gg/decks' });
    expect(sortLink('https://www.choom.gg/decks/d9688e23-eb69-4bc0-b52e-bc9e728d9d15').why).toMatch(/choom.gg deck page/);
    for (const [link, why] of [
      ['https://example.com/decks', /reads only choom.gg and cyberpunk-tcg-sim.online/],
      ['https://choom.gg.example.com/decks', /reads only/],
      ['https://choom.gg/api/decks', /stay out of \/api\/ and \/admin/],
      ['https://choom.gg/admin', /stay out of/],
      // the same paths written another way (the script's site_of refuses the same ones)
      ['https://choom.gg/%61pi/decks', /stay out of/],
      ['https://choom.gg//api/decks', /stay out of/],
      ['https://choom.gg/API/decks', /stay out of/],
      ['https://choom.gg/decks/../admin', /stay out of/],
      ['https://choom.gg/decks/%2e%2e/api/decks', /stay out of/],
      ['ftp://choom.gg/decks', /not a web link/],
      ['javascript:alert(1)', /not a web link/],
      ['https://cyberpunk-tcg-sim.online/deck-builder/?deck=saved-1', /carries no list/],
      ['http://[bad', /not a link/],
    ] as const)
      expect(sortLink(link), link).toMatchObject({ kind: 'refused', why: expect.stringMatching(why) });
  });

  it('lists each link once', () => {
    expect(sortLinks('https://choom.gg/decks\nhttps://choom.gg/decks  https://choom.gg/decks/').length).toBe(2);
  });

  it('writes the command with every link quoted, nothing a shell would read', () => {
    expect(scriptCommand(['https://choom.gg/decks', 'https://cyberpunk-tcg-sim.online/meta/season-1'])).toBe('python tools/import_decks.py "https://choom.gg/decks" "https://cyberpunk-tcg-sim.online/meta/season-1"');
    expect(scriptCommand(['https://choom.gg/a$b`c!d"e'], 'x.json')).toBe('python tools/import_decks.py "https://choom.gg/a%24b%60c%21d%22e" --out x.json');
  });
});

/** A made-up import file around these decks. */
const doc = (decks: unknown[], extra: Record<string, unknown> = {}) => ({ kind: IMPORT_KIND, schema: 1, ran: '2026-11-16T10:00:00Z', links: [], decks, ...extra });
const rawJson = (over: Partial<RawDeck> = {}): RawDeck => ({ ...fromLink(byIdLink()), ...over });

describe('reading an import file (untrusted)', () => {
  it('reads a good file', () => {
    const r = readImport(JSON.stringify(doc([rawJson()], { links: [{ link: 'https://choom.gg/decks', status: 'fetched', decks: 1, note: 'ok' }] })));
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.doc.decks.length).toBe(1);
    expect(r.doc.links).toEqual([{ link: 'https://choom.gg/decks', status: 'fetched', decks: 1, note: 'ok' }]);
    expect(buildDeck(r.doc.decks[0]!).ready).toBe(true);
    // what the admin page downloads reads back the same
    const again = readImport(JSON.stringify(importDocument(r.doc.decks, r.doc.ran)));
    expect(again.ok && again.doc.decks).toEqual(r.doc.decks);
  });

  it('refuses the wrong kind, a newer schema, a file that is not JSON or is too large, each in a sentence', () => {
    const why = (s: string) => {
      const r = readImport(s);
      return r.ok ? 'read' : r.why;
    };
    expect(why(JSON.stringify({ kind: 'nct-profile', schema: 1 }))).toMatch(/^This is not a deck-import file from tools\/import_decks.py \(its kind is “nct-profile”\)\.$/);
    expect(why(JSON.stringify(doc([], { schema: 2 })))).toMatch(/newer version of the script \(schema 2; this page reads 1\)/);
    expect(why(JSON.stringify(doc([], { schema: 'one' })))).toMatch(/no readable schema/);
    expect(why('{not json')).toMatch(/not JSON/);
    expect(why('[1,2]')).toMatch(/holds no JSON object/);
    expect(why(' '.repeat(IMPORT_LIMITS.chars + 1))).toMatch(/too large/);
  });

  it('cleans and caps every string, drops what it cannot read, and says so', () => {
    const evil = rawJson({
      name: `Bad‮Name\u0000 ${'x'.repeat(500)}`,
      author: 'A\nB​C',
      source: { site: 'choom.gg', link: 'javascript:alert(1)', page: 'P'.repeat(1000), pageLink: 'https://evil.example/x', placement: '1st', date: 'not a date' },
    });
    const bad = { ...evil, main: [...evil.main, { ref: 'cb-detonate', count: 0 }, { ref: 'cb-detonate', count: 2.5 }, { ref: 'cb-detonate', count: '3' }, { ref: '', count: 1 }, 'x', null] };
    const r = readImportValue(doc([bad, 'not a deck', { legends: [], main: [] }]));
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    const d = r.doc.decks[0]!;
    expect([...d.name].length).toBe(IMPORT_LIMITS.name);
    expect(d.name).not.toMatch(/[\u0000-\u001f‮]/);
    expect(d.author).toBe('A B C');
    expect(d.source.link).toBe('');
    expect(d.source.pageLink).toBe('');
    expect(d.source.site).toBe('');
    expect(d.source.page.length).toBe(IMPORT_LIMITS.title);
    expect(d.source.date).toBe('');
    expect(d.main.length).toBe(evil.main.length);
    expect(d.notes.filter((n) => /count is not a whole number/.test(n)).length).toBe(3);
    expect(r.warnings).toEqual(['2 entries were left out: not a deck this page can read.']);
  });

  it('caps the number of decks and of entries per section', () => {
    const many = Array.from({ length: IMPORT_LIMITS.decks + 5 }, () => rawJson());
    const r = readImportValue(doc(many));
    expect(r.ok && r.doc.decks.length).toBe(IMPORT_LIMITS.decks);
    expect(r.ok && r.warnings[0]).toMatch(/only the first 200 were read/);
    const long = rawJson({ main: Array.from({ length: 100 }, () => ({ ref: 'cb-detonate', by: 'id' as const, count: 1 })) });
    const r2 = readImportValue(doc([long]));
    expect(r2.ok && r2.doc.decks[0]!.main.length).toBe(IMPORT_LIMITS.refs);
    expect(r2.ok && r2.doc.decks[0]!.notes.join(' ')).toMatch(/main deck had 100 entries/);
  });
});

describe('the same-list report', () => {
  const owner = buildDeck(fromLink(OWNER_COMPACT));
  const other = buildDeck(rawJson({ name: 'Other', main: rawJson().main.map((r, i) => (i === 0 ? { ...r, count: r.count - 1 } : r)) }));
  it('names the library deck, then the deck saved here, then an earlier deck of the import', () => {
    const lib = [
      { file: 'meta-x.txt', deck: { name: 'Library twin', legends: owner.deck.legends, main: owner.deck.main } },
      { file: 'custom:Mine', deck: { name: 'Mine', legends: other.deck.legends, main: other.deck.main } },
    ];
    const byId = buildDeck(rawJson());
    const holders = sameListHolders([owner, other, byId, buildDeck(rawJson({ name: 'Other again', main: other.raw.main }))], lib);
    expect(holders[0]).toEqual({ where: 'library', file: 'meta-x.txt', name: 'Library twin' });
    expect(holders[1]).toEqual({ where: 'saved', name: 'Mine' });
    expect(holders[2]).toEqual({ where: 'library', file: 'meta-x.txt', name: 'Library twin' });
    expect(holders[3]).toEqual({ where: 'saved', name: 'Mine' });
    expect(sameListHolders([owner, byId], [])).toEqual([null, { where: 'import', index: 0, name: owner.deck.name }]);
    expect(holderWords(holders[0]!)).toBe('The library already has this list: Library twin (meta-x.txt).');
    expect(holderWords(holders[1]!)).toBe('This browser already has this list in My decks, as Mine.');
    expect(holderWords({ where: 'import', index: 0, name: 'A' }, ['A'])).toBe('Same list as deck 1 of this import (A).');
  });
  it('compares no deck with unmatched cards', () => {
    const broken = buildDeck(rawJson({ main: [...rawJson().main, { ref: 'cb-nope', count: 1 }] }));
    expect(broken.unmatched.length).toBe(1);
    expect(broken.ready).toBe(false);
    expect(sameListHolders([owner, broken], [])).toEqual([null, null]);
  });
});

describe('library deck files', () => {
  const d = buildDeck(rawJson());
  it('writes the provenance header and reads back as the same deck', () => {
    const file = deckFileName(d.deck.name);
    expect(file).toBe('import-player-one-made-up-cup-1st.txt');
    expect(deckFileName('Ünïcode / Name!', 'x-')).toBe('x-unicode-name.txt');
    const text = deckFileText(d, '2026-11-16');
    expect(text.split('\n').slice(0, 7)).toEqual([
      '// Player One - Made Up Cup (1st)',
      '// Origin: Imported from cyberpunk-tcg-sim.online (placed 1st)',
      '// Author: Player One',
      `// Source: ${d.raw.source.link}`,
      '// Via: cyberpunk-tcg-sim.online (collected 2026-11-16)',
      '// Added: 2026-11-16',
      '// Format: Constructed',
    ]);
    expect(deckFileProblem(file, text, d)).toBe('');
    const back = libraryDeck(file, text)!;
    expect(back.deck.name).toBe(d.deck.name);
    expect(listFingerprint(back.deck)).toBe(d.listId);
    expect(back.deck.sideboard.length).toBe(7);
    expect(back.prov.author).toBe('Player One');
    expect(back.prov.source).toBe(d.raw.source.link);
    expect(isOwnerImport(back.prov)).toBe(true);
  });
  it('says when a name does not survive the file format', () => {
    const odd = buildDeck(rawJson({ name: 'Origin: somewhere' }));
    expect(deckFileProblem('import-x.txt', deckFileText(odd, '2026-11-16'), odd)).toMatch(/does not survive the file format/);
  });
  it('writes a placeholder note that passes the deck-note rules', () => {
    const src = placeholderNote('import-x.txt', d);
    const note = new Function(`return ({${src}})`)()['import-x.txt'];
    expect(note.listId).toBe(d.listId);
    expect(note.objective).toMatch(/^Placeholder/);
    expect(note.status).toBe('needs-owner');
    expect(note.placeholder).toBe(true);
    expect(note.source).toBe('list');
    expect(note.plan.length).toBe(2);
    expect(note.keyCards.map((k: { id: string }) => k.id)).toEqual(d.deck.legends);
    for (const k of note.keyCards) expect(CARD_BY_ID[k.id]).toBeDefined();
    for (const s of note.signals) for (const t of s.terms) expect(SIGNAL_TERMS).toContain(t);
  });
  it('names a deck with no name after its Legends', () => {
    expect(legendsName(['adam_smasher_ender_of_legends', 'padre_man_of_the_cross', 'v_streetkid'])).toBe('Adam Smasher / Padre / V: Streetkid');
  });
});
