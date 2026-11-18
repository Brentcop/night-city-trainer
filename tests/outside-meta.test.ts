// The outside picture's data (src/lib/outsideMeta.ts, scripts/import-outside-meta.ts; ROADMAP2 §13 goal 4), on invented
// reports only: the raw file read as untrusted input, Legend names matched the deck import's way or kept as text, the
// tracked file's check (check:data), what changed, the field shares goal 5 will weight a field by, and the command line
// on a temporary folder. Never writes into the repository; nothing here touches the network.
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { afterAll, describe, expect, it } from 'vitest';
import {
  choomArchetypes,
  choomForLegends,
  collectedOf,
  isoDay,
  legendMatcher,
  outsideChanges,
  outsideFieldShares,
  outsideForLegends,
  outsideLink,
  outsideMetaProblems,
  placeWords,
  RAW_KIND,
  readOutsideImport,
  trioKey,
  winRateWords,
  type LegendCard,
  type OutsideMetaFile,
  type OutsideSeasonSource,
  type OutsideTournamentSource,
} from '../src/lib/outsideMeta';
import { importOutsideCommand } from '../scripts/import-outside-meta-run';
import { CARD_BY_ID, CARDS } from '../src/engine/cards';

// invented Legends: two share a name and differ by subname, one name is also a second Legend's (so it needs its subname)
const LEGENDS: LegendCard[] = [
  { id: 'ana_one', name: 'Ana', subname: 'One' },
  { id: 'bo_two', name: 'Bo', subname: 'Two' },
  { id: 'cy_x', name: 'Cy', subname: 'Ex' },
  { id: 'cy_y', name: 'Cy', subname: 'Why' },
  { id: 'dee_d', name: 'Déé', subname: 'Dee' },
  { id: 'eve_e', name: 'Eve', subname: "Eve's Way" },
];
const isLegend = (id: string) => LEGENDS.some((l) => l.id === id);

const SEASON_LINK = 'https://cyberpunk-tcg-sim.online/meta/made-up-season';
const TOUR_LINK = 'https://cyberpunk-tcg-sim.online/meta/made-up-cup';

function rawDoc(over: Record<string, unknown> = {}) {
  return {
    kind: RAW_KIND,
    schema: 1,
    ran: '2026-11-18T09:00:00Z',
    tool: 'tools/import_outside_meta.py',
    links: [],
    pages: [
      {
        kind: 'season',
        link: SEASON_LINK,
        title: 'Made-up season report',
        published: '2026-11-15T10:00:00Z',
        collected: '2026-11-18',
        period: { from: '2026-09-01', to: '2026-11-15' },
        totals: { series: 1000, games: 2100, players: 300, highRankDecks: 800 },
        tiers: [
          { rank: 1, trio: ['Ana', 'Bo', 'Cy: Ex'], tier: 1, winRate: 55.5, wins: 111, losses: 89, share: 20, players: 40 },
          // a ranked trio the legend map folded into Other: it joins the field with its share
          { rank: 2, trio: ['Ana', 'Cy: Why', 'Eve: Eve’s Way'], tier: 2, winRate: 52, wins: 52, losses: 48, share: 3.5 },
        ],
        field: [
          { trio: ['Ana', 'Cy: Ex', 'Bo'], share: 20, winRate: 55.5 },
          { trio: ['Bo', 'Dex: Dee', 'Eve'], share: 30.2, winRate: 49 },
          { trio: ['Ana', 'Bo', 'Zed'], share: 5, winRate: 40 },
          { trio: ['Ana', 'Bo'], share: 9 },
          { trio: ['Ana', 'Bo', 'Cy'], share: 2 },
        ],
        matchups: [{ trio: ['Ana', 'Bo', 'Cy: Ex'], vs: ['Bo', 'Déé: Dee', 'Eve'], winRate: 60, wins: 30, losses: 20 }],
        notes: [],
      },
      {
        kind: 'tournament',
        link: TOUR_LINK,
        title: 'Made-up Cup <b>report</b>\u0007',
        published: '2026-11-15',
        collected: '2026-11-18',
        date: '2026-11-07',
        totals: { players: 40, registered: 90, rounds: 6, topCut: 8 },
        field: [
          { trio: ['Ana', 'Bo', 'Cy: Ex'], players: 10, winRate: 50, wins: 30, losses: 30, top8: 3, best: 1 },
          { trio: ['Bo', 'Dee: Dee', 'Eve'], players: 4, winRate: 61.1, wins: 11, losses: 7, top8: 0, best: 12 },
          { trio: ['Ana', 'Bo', 'Cy: Ex'], players: 50 },
        ],
        topCut: [
          { place: 2, trio: ['Bo', 'Dee: Dee', 'Eve'] },
          { place: 1, trio: ['Cy: Ex', 'Bo', 'Ana'] },
        ],
        notes: [],
      },
      { kind: 'season', link: 'https://example.com/meta/x', title: 'Off the two sites', collected: '2026-11-18', field: [] },
    ],
    ...over,
  };
}

function readOk(doc: unknown = rawDoc()) {
  const r = readOutsideImport(JSON.stringify(doc), LEGENDS);
  if (!r.ok) throw new Error(r.why);
  return r;
}

describe('matching Legend names', () => {
  const match = legendMatcher(LEGENDS);
  it('takes the full name, or the name alone when one Legend has it, never a guess', () => {
    expect(match('Ana')).toEqual({ ok: true, id: 'ana_one' });
    expect(match('Ana: One')).toEqual({ ok: true, id: 'ana_one' });
    expect(match('ana — one')).toEqual({ ok: true, id: 'ana_one' });
    expect(match('Cy: Ex')).toEqual({ ok: true, id: 'cy_x' });
    expect(match('Dex: Dee')).toEqual({ ok: false, why: '“Dex: Dee” is not a Legend this trainer knows.' });
    expect(match('Dee: Dee')).toEqual({ ok: true, id: 'dee_d' });
    expect(match('Déé: Dee')).toEqual({ ok: true, id: 'dee_d' });
    expect(match('Eve: Eves Way')).toEqual({ ok: true, id: 'eve_e' });
    const cy = match('Cy');
    expect(cy.ok).toBe(false);
    expect(!cy.ok && cy.why).toContain('subname is needed');
  });
  it('matches every Legend of the card data by its own label, and the short names the sim writes', () => {
    const all = legendMatcher(CARDS.filter((c) => c.type === 'Legend'));
    for (const c of CARDS.filter((c) => c.type === 'Legend')) expect(all(`${c.name}: ${c.subname}`)).toEqual({ ok: true, id: c.id });
    expect(all('Adam Smasher')).toEqual({ ok: true, id: 'adam_smasher_ender_of_legends' });
    expect(all('V: Streetkid')).toEqual({ ok: true, id: 'v_streetkid' });
    expect(all("Jackie Welles: Mama's Favorite")).toEqual({ ok: true, id: 'jackie_welles_mama_s_favorite' });
    expect(all('Judy Álvarez')).toEqual({ ok: true, id: 'judy_alvarez_braindance_maestro' });
    expect(all('V').ok).toBe(false);
  });
});

describe('reading the raw file (untrusted)', () => {
  it('refuses what is not a raw outside-meta file, with one sentence', () => {
    expect(readOutsideImport('not json', LEGENDS)).toEqual({ ok: false, why: 'This file is not an outside-meta file (it is not JSON).' });
    expect(readOutsideImport('[]', LEGENDS).ok).toBe(false);
    const wrong = readOutsideImport(JSON.stringify({ ...rawDoc(), kind: 'nct-deck-import' }), LEGENDS);
    expect(!wrong.ok && wrong.why).toContain('“nct-deck-import”');
    const newer = readOutsideImport(JSON.stringify({ ...rawDoc(), schema: 2 }), LEGENDS);
    expect(!newer.ok && newer.why).toContain('newer version');
    expect(readOutsideImport('x'.repeat(1_000_001), LEGENDS).ok).toBe(false);
    expect(readOutsideImport(JSON.stringify(rawDoc({ pages: [] })), LEGENDS).ok).toBe(false);
  });

  it('keeps the reports on the sim site, matches the names, and reports what it left out', () => {
    const { file, warnings } = readOk();
    expect(file.sources.map((s) => s.id)).toEqual(['sim:made-up-season', 'sim:made-up-cup']);
    expect(file.updated).toBe('2026-11-18');
    expect(file.unmatched).toEqual(['Cy', 'Dex: Dee', 'Zed']);
    expect(warnings.some((w) => w.includes('is not on cyberpunk-tcg-sim.online'))).toBe(true);
    expect(warnings.some((w) => w.includes('Not matched, kept as text') && w.includes('Zed'))).toBe(true);
    expect(warnings.some((w) => w.includes('legend map: 1 row was not understood'))).toBe(true);
  });

  it('builds a season: its field is the legend map plus the ranked trios the map left out, largest first', () => {
    const s = readOk().file.sources[0] as OutsideSeasonSource;
    expect(s.kind).toBe('season');
    expect(s.period).toEqual({ from: '2026-09-01', to: '2026-11-15' });
    expect(s.published).toBe('2026-11-15');
    expect(s.field.map((r) => [r.trio.names.join(' / '), r.share])).toEqual([
      ['Bo / Dex: Dee / Eve', 30.2],
      ['Ana / Cy: Ex / Bo', 20],
      ['Ana / Bo / Zed', 5],
      ['Ana / Cy: Why / Eve: Eve’s Way', 3.5],
      ['Ana / Bo / Cy', 2],
    ]);
    // the map's row takes the ranked deck's games
    expect(s.field[1]).toMatchObject({ wins: 111, losses: 89, players: 40, winRate: 55.5 });
    expect(s.field[0]!.trio.ids).toEqual(['bo_two', null, 'eve_e']);
    expect(trioKey(s.field[1]!.trio)).toBe('ana_one+bo_two+cy_x');
    expect(trioKey(s.field[0]!.trio)).toBeNull();
    expect(s.tiers.map((t) => t.rank)).toEqual([1, 2]);
    expect(s.matchups).toHaveLength(1);
  });

  it('builds a tournament: shares are players over the field, a row with more players than the field is left out, the top cut in place order', () => {
    const { file, warnings } = readOk();
    const t = file.sources[1] as OutsideTournamentSource;
    expect(t.title).toBe('Made-up Cup <b>report</b>');
    expect(t.date).toBe('2026-11-07');
    expect(t.field.map((r) => [r.players, r.share])).toEqual([
      [10, 25],
      [4, 10],
    ]);
    expect(warnings.some((w) => w.includes('field: 1 row was not understood'))).toBe(true);
    expect(t.topCut.map((r) => r.place)).toEqual([1, 2]);
    expect(trioKey(t.topCut[0]!.trio)).toBe('ana_one+bo_two+cy_x');
  });

  it('cleans strings, caps them, and keeps links only on the two sites', () => {
    expect(outsideLink('https://cyberpunk-tcg-sim.online/meta/a')).toBe('https://cyberpunk-tcg-sim.online/meta/a');
    expect(outsideLink('javascript:alert(1)')).toBe('');
    expect(outsideLink('https://evil.example/meta')).toBe('');
    expect(outsideLink('https://user:pw@choom.gg/meta')).toBe('');
    const long = rawDoc();
    (long.pages[0] as { tiers: { trio: string[] }[] }).tiers[0]!.trio = ['A'.repeat(500), 'Bo', 'Cy: Ex'];
    const r = readOk(long);
    expect(r.file.unmatched.some((n) => n.length === 80)).toBe(true);
  });

  it('reads days strictly', () => {
    expect(isoDay('2026-11-15T10:23:29.338Z')).toBe('2026-11-15');
    expect(isoDay('2026-02-30')).toBe('');
    expect(isoDay('15 Nov 2026')).toBe('');
    expect(isoDay(20261115)).toBe('');
  });
});

describe('the tracked file (check:data)', () => {
  const file = readOk().file;
  it('a file the reader wrote has no problem', () => {
    expect(outsideMetaProblems(JSON.parse(JSON.stringify(file)), isLegend)).toEqual([]);
  });
  it('names each problem: kind, days, shares, links, ids, unmatched names', () => {
    const broken = JSON.parse(JSON.stringify(file)) as OutsideMetaFile;
    broken.updated = '2026-11-17';
    broken.sources[0]!.field[0]!.share = 140;
    broken.sources[0]!.link = 'https://evil.example/x';
    broken.sources[1]!.collected = 'yesterday';
    broken.sources[1]!.field[0]!.trio.ids[0] = 'not_a_card';
    broken.unmatched = [];
    const p = outsideMetaProblems(broken, isLegend);
    expect(p.some((x) => x.includes('a field share is not between 0 and 100'))).toBe(true);
    expect(p.some((x) => x.includes('link is not a link on the two sites'))).toBe(true);
    expect(p.some((x) => x.includes('collected is not a YYYY-MM-DD day'))).toBe(true);
    expect(p.some((x) => x.includes('not_a_card is not a Legend card'))).toBe(true);
    expect(p.some((x) => x.includes('matched no card but is not listed under unmatched'))).toBe(true);
    expect(outsideMetaProblems({ ...file, kind: 'x' }, isLegend)).toContain('kind is not nct-outside-meta');
    expect(outsideMetaProblems(null, isLegend)).toEqual(['not a JSON object']);
  });
  it('a field over 100% fails', () => {
    const over = JSON.parse(JSON.stringify(file)) as OutsideMetaFile;
    over.sources[0]!.field.forEach((r) => (r.share = 40));
    expect(outsideMetaProblems(over, isLegend).some((x) => x.includes('add up to 200.0%, over 100'))).toBe(true);
  });
});

describe('what changed', () => {
  const file = readOk().file;
  it('lists new reports, and every figure that moved', () => {
    expect(outsideChanges(null, file)).toEqual(['new: Made-up season report (5 trios in the field, collected 2026-11-18)', 'new: Made-up Cup <b>report</b> (2 trios in the field, collected 2026-11-18)']);
    expect(outsideChanges(file, file)).toEqual([]);
    const later = JSON.parse(JSON.stringify(file)) as OutsideMetaFile;
    later.sources[0]!.field[0]!.share = 31;
    later.sources[0]!.collected = '2026-11-20';
    later.sources[0]!.totals.series = 1200;
    later.sources.pop();
    expect(outsideChanges(file, later)).toEqual([
      'Made-up season report: collected 2026-11-18 → 2026-11-20',
      'Made-up season report: series 1000 → 1200',
      'Made-up season report: Bo / Dex: Dee / Eve 30.2% → 31% of the field',
      'removed: Made-up Cup <b>report</b>',
    ]);
  });
});

describe('outsideFieldShares (the field as an input for goal 5)', () => {
  const season = readOk().file.sources[0]!;
  const deck = (file: string, legends: string[]) => ({ file, deck: { name: file, legends } });
  const library = [deck('a1', ['cy_x', 'bo_two', 'ana_one']), deck('a2', ['ana_one', 'bo_two', 'cy_x']), deck('b', ['ana_one', 'cy_y', 'eve_e']), deck('c', ['ana_one', 'bo_two', 'eve_e']), deck('two-legends', ['ana_one', 'bo_two'])];
  const f = outsideFieldShares(library, season);
  it('splits a trio’s share equally among the decks that play it; an unlisted trio weighs 0', () => {
    expect(f.decks.map((d) => [d.file, d.trioShare, d.splitAmong, d.weight])).toEqual([
      ['a1', 20, 2, 10],
      ['a2', 20, 2, 10],
      ['b', 3.5, 1, 3.5],
      ['c', 0, 1, 0],
      ['two-legends', 0, 1, 0],
    ]);
  });
  it('says how much of the field the library covers, what it misses, and what the source does not list', () => {
    expect(f.listed).toBe(60.7);
    expect(f.covered).toBe(23.5);
    expect(f.uncoveredShare).toBe(37.2);
    expect(f.unlisted).toBe(39.3);
    expect(f.uncovered.map((u) => u.share)).toEqual([30.2, 5, 2]);
    expect(f.decks.reduce((s, d) => s + d.weight, 0)).toBeCloseTo(f.covered, 6);
    expect(f.shareOf).toContain('high-rank decks');
  });
  it('an empty library covers nothing', () => {
    const none = outsideFieldShares([], season);
    expect(none.covered).toBe(0);
    expect(none.uncoveredShare).toBe(none.listed);
  });
});

describe('what a deck page shows', () => {
  const file = readOk().file;
  it('finds every source’s rows for the same three Legends in any order, and nothing for another trio', () => {
    const rows = outsideForLegends(['bo_two', 'cy_x', 'ana_one'], file);
    expect(rows.map((r) => r.source.id)).toEqual(['sim:made-up-season', 'sim:made-up-cup']);
    expect(rows[0]!.tier?.rank).toBe(1);
    expect(rows[1]!.places).toEqual([1]);
    expect(outsideForLegends(['ana_one', 'bo_two', 'eve_e'], file)).toEqual([]);
    expect(outsideForLegends(['ana_one', 'bo_two', 'cy_x'], null)).toEqual([]);
  });
  it('labels choom.gg the same way: its archetype, tier, power and the day its list was collected', () => {
    const lib = [{ file: 'meta-x.txt', deck: { name: 'X', legends: ['ana_one', 'bo_two', 'cy_x'] }, prov: { via: 'choom.gg/meta (collected 2026-11-09)' } }];
    const rows = choomArchetypes([{ title: 'X Aggro', tier: 'S', power: 91, complexity: 'Moderate', source: 'https://choom.gg/meta/x (reference list https://choom.gg/decks/1)', deckFile: 'meta-x.txt' }, { title: 'Gone', tier: 'A', deckFile: 'missing.txt' }], lib);
    expect(rows).toEqual([{ title: 'X Aggro', tier: 'S', power: 91, complexity: 'Moderate', link: 'https://choom.gg/meta/x', file: 'meta-x.txt', legends: ['ana_one', 'bo_two', 'cy_x'], collected: '2026-11-09' }]);
    expect(choomForLegends(['cy_x', 'ana_one', 'bo_two'], rows)).toHaveLength(1);
    expect(collectedOf(undefined)).toBe('');
  });
  it('words', () => {
    expect(winRateWords({ winRate: 54.2, wins: 931, losses: 787 })).toBe('54.2% over 1,718 games');
    expect(winRateWords({ winRate: 50 })).toBe('50.0%');
    expect(winRateWords({})).toBe('');
    expect([1, 2, 3, 4, 11, 12, 13, 21, 22, 29, 101].map(placeWords)).toEqual(['1st', '2nd', '3rd', '4th', '11th', '12th', '13th', '21st', '22nd', '29th', '101st']);
  });
});

describe('scripts/import-outside-meta.ts', () => {
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'nct-outside-'));
  afterAll(() => fs.rmSync(tmp, { recursive: true, force: true }));
  const legends = () => CARDS.filter((c) => c.type === 'Legend');
  const cmd = (argv: string[]) => {
    const out: string[] = [];
    const err: string[] = [];
    const code = importOutsideCommand(argv, { out: (l) => out.push(l), err: (l) => err.push(l), legends });
    return { code, out: out.join('\n'), err: err.join('\n') };
  };
  // the same invented reports, with real Legend names so they match the card data
  const real = rawDoc();
  for (const p of real.pages as { tiers?: { trio: string[] }[]; field: { trio: string[] }[]; topCut?: { trio: string[] }[]; matchups?: { trio: string[]; vs: string[] }[] }[]) {
    const rename = (t: string[]) => t.map((n) => ({ Ana: 'Adam Smasher', 'Ana: One': 'Adam Smasher', Bo: 'Padre', 'Cy: Ex': 'V: Streetkid', 'Cy: Why': 'V: Corporate Exile', 'Dee: Dee': 'River Ward', 'Déé: Dee': 'River Ward', Eve: 'Muamar Reyes', 'Eve: Eve’s Way': 'Muamar Reyes', Cy: 'V' })[n] ?? n);
    for (const r of [...(p.tiers ?? []), ...p.field, ...(p.topCut ?? [])]) r.trio = rename(r.trio);
    for (const m of p.matchups ?? []) [m.trio, m.vs] = [rename(m.trio), rename(m.vs)];
  }
  const input = path.join(tmp, 'outside-meta-import.json');
  fs.writeFileSync(input, JSON.stringify(real));
  const out = path.join(tmp, 'data', 'outsideMeta.json');

  it('prints its usage, and refuses a bad command line or file with exit 2', () => {
    expect(cmd(['--help']).out).toContain('npx tsx scripts/import-outside-meta.ts FILE');
    expect(cmd([]).code).toBe(2);
    expect(cmd([input, '--bogus']).code).toBe(2);
    expect(cmd([path.join(tmp, 'missing.json')]).err).toContain('cannot read');
    fs.writeFileSync(path.join(tmp, 'wrong.json'), '{"kind":"nct-deck-import","schema":1}');
    const wrong = cmd([path.join(tmp, 'wrong.json'), '--out', out]);
    expect(wrong.code).toBe(2);
    expect(fs.existsSync(out)).toBe(false);
  });

  it('writes the tracked file, which passes the check; never over it without --force; says when nothing changed', () => {
    const first = cmd([input, '--out', out]);
    expect(first.code).toBe(0);
    expect(first.out).toContain('new: Made-up season report');
    expect(first.out).toContain('Not matched, kept as text: “Zed”');
    const written = JSON.parse(fs.readFileSync(out, 'utf8')) as OutsideMetaFile;
    const legend = (id: string) => Object.prototype.hasOwnProperty.call(CARD_BY_ID, id) && CARD_BY_ID[id]!.type === 'Legend';
    expect(outsideMetaProblems(written, legend)).toEqual([]);
    expect(written.unmatched).toEqual(['Dex: Dee', 'V', 'Zed']);
    expect(cmd([input, '--out', out]).out).toContain('already holds these figures; nothing to write');
    const later = JSON.parse(JSON.stringify(real));
    later.pages[0].collected = '2026-11-20';
    fs.writeFileSync(input, JSON.stringify(later));
    const refused = cmd([input, '--out', out]);
    expect(refused.code).toBe(2);
    expect(refused.out).toContain('collected 2026-11-18 → 2026-11-20');
    expect(refused.err).toContain('pass --force');
    expect(cmd([input, '--out', out, '--force']).code).toBe(0);
    expect((JSON.parse(fs.readFileSync(out, 'utf8')) as OutsideMetaFile).updated).toBe('2026-11-20');
  });
});
