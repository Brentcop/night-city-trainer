// The knowledge pack command line (scripts/kb.ts, docs/RAG_PLAN.md step 1.3): argument conventions (exit 2 on a bad
// flag or value, --help prints the header), the query commands on an invented index, the fact command on the recorded
// files, and the cache under a temp directory (public sources only: nothing from data/raw is written outside .cache/kb).
import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { ArgError } from '../scripts/lib-node';
import { deckResolver, ensurePack, parseKbArgs, runQuery, statResolver, statsText } from '../scripts/kb';
import { loadCompetitive, loadStats } from '../scripts/kb-sources';
import { CATALOGUE_VERSION } from '../src/content/synergies';
import { runFact } from '../src/lib/kb/facts';
import { finishRecord } from '../src/lib/kb/build/record';
import { buildIndex } from '../src/lib/kb/search';
import { estimateTokens, kindOfId, type KbLink, type KbRecord } from '../src/lib/kb/types';

const ROOT = path.resolve(__dirname, '..');

const rec = (id: string, title: string, text: string, more: { links?: KbLink[]; scope?: 'public' | 'local'; aliases?: string[] } = {}): KbRecord =>
  finishRecord({ id, kind: kindOfId(id)!, title, text, source: { file: 'fixture' }, origin: more.scope === 'local' ? 'official' : 'authored', scope: 'public', ...more });

const IX = buildIndex([
  rec('card:kilo_byte', 'Kilo Byte', 'Kilo Byte is an invented Program that trashes the top card of your deck.'),
  rec('card:nova_a', 'Nova Vex: Glass Saint', 'An invented Legend.', { aliases: ['Nova Vex'] }),
  rec('card:nova_b', 'Nova Vex: Iron Choir', 'An invented Unit.', { aliases: ['Nova Vex'] }),
  rec('ruling:aaaaaaaa', 'Kilo Byte ruling 1', 'Invented ruling on Kilo Byte.', { links: [{ rel: 'card', to: 'card:kilo_byte' }] }),
  rec('faq:aaaaaaaa', 'Invented FAQ item 1', 'Invented official-style text about Kilo Byte.', { scope: 'local', links: [{ rel: 'ruling', to: 'ruling:aaaaaaaa' }] }),
  ...Array.from({ length: 12 }, (_, i) => rec(`doc:d.md#p${i}`, `Kilo notes ${i}`, `Kilo Byte appears here. ${'filler '.repeat(80)}`, { links: [{ rel: 'mentions', to: 'card:kilo_byte' }] })),
]);

describe('parseKbArgs', () => {
  it('reads a command, its words and its flags', () => {
    const a = parseKbArgs(['search', 'which', 'deck', '--k', '3', '--kind', 'card,deck', '--scope', 'public', '--rankers', 'exact,keyword', '--json']);
    expect(a.command).toBe('search');
    expect(a.query).toBe('which deck');
    expect(a.values).toMatchObject({ k: 3, scope: 'public', json: true, 'max-tokens': 2000 });
    expect(a.kinds).toEqual(['card', 'deck']);
    expect(a.rankers).toEqual(['exact', 'keyword']);
    expect(parseKbArgs(['get', 'Kilo Byte']).query).toBe('Kilo Byte');
    expect(parseKbArgs(['stats']).command).toBe('stats');
  });
  it('refuses unknown commands, flags and values with an ArgError', () => {
    const bad: string[][] = [
      [],
      ['find', 'x'],
      ['search', 'x', '--bogus'],
      ['search', 'x', '--scope', 'everything'],
      ['search', 'x', '--kind', 'card,cards'],
      ['search', 'x', '--kind', ''],
      ['search', 'x', '--rankers', 'vector'],
      ['search', 'x', '--k', '0'],
      ['search', 'x', '--k', 'two'],
      ['search', 'x', '--max-tokens', '10'],
      ['search'],
      ['get'],
      ['stats', 'extra'],
      ['stats', '--k', '3'],
      ['get', 'x', '--rankers', 'exact'],
    ];
    for (const argv of bad) expect(() => parseKbArgs(argv), argv.join(' ')).toThrow(ArgError);
    expect(() => parseKbArgs(['stats', '--k', '3'])).toThrow(/--k does not apply to stats/);
    expect(() => parseKbArgs(['find'])).toThrow(/unknown command "find"/);
  });
});

describe('fact', () => {
  it('reads the fact, its flags and its decks', () => {
    expect(parseKbArgs(['fact', 'champion', '--event', '6']).fact).toEqual({ fact: 'champion', event: 6, decks: [], json: false });
    expect(parseKbArgs(['fact', 'standings', '--event', '6', '--round', '5', '--json']).fact).toEqual({ fact: 'standings', event: 6, round: '5', decks: [], json: true });
    expect(parseKbArgs(['fact', 'round', '--event', '3', '--round', 'final']).fact).toMatchObject({ round: 'final' });
    expect(parseKbArgs(['fact', 'rating', 'smash', 'the', 'curve']).fact!.decks).toEqual(['smash the curve']);
    expect(parseKbArgs(['fact', 'matchup', 'S1-01 Mutant (RRY)', 'Samurai']).fact!.decks).toEqual(['S1-01 Mutant (RRY)', 'Samurai']);
    expect(parseKbArgs(['fact', 'matchup', 'smash', 'the', 'curve', 'vs', 'samurai']).fact!.decks).toEqual(['smash the curve', 'samurai']);
    expect(parseKbArgs(['fact', 'ratings']).fact).toEqual({ fact: 'ratings', decks: [], json: false });
    expect(parseKbArgs(['fact', 'ratings', '--top', '10']).fact).toEqual({ fact: 'ratings', top: 10, decks: [], json: false });
    expect(parseKbArgs(['fact', 'card', 'Jacked-In', 'Voodoo', 'Boy']).fact).toEqual({ fact: 'card', decks: [], subject: 'Jacked-In Voodoo Boy', json: false });
    expect(parseKbArgs(['fact', 'card', 'floor_it', '--deck', 'meta-bbg-cunningham-econ', '--json']).fact).toEqual({ fact: 'card', decks: [], subject: 'floor_it', deck: 'meta-bbg-cunningham-econ', json: true });
    expect(parseKbArgs(['fact', 'package', 'rocker', '--deck', 'Samurai']).fact).toEqual({ fact: 'package', decks: [], subject: 'rocker', deck: 'Samurai', json: false });
  });
  it('refuses an unknown fact, a missing or misplaced flag and the wrong number of decks (exit 2)', () => {
    const bad: string[][] = [
      ['fact'],
      ['fact', 'upset', '--event', '6'],
      ['fact', 'upsets'],
      ['fact', 'upsets', '--event', '6', 'samurai'],
      ['fact', 'upsets', '--event', '6', '--top', '3'],
      ['fact', 'champion'],
      ['fact', 'champion', '--event', '0'],
      ['fact', 'champion', '--event', 'six'],
      ['fact', 'champion', '--event', '6', '--round', '2'],
      ['fact', 'round', '--event', '6'],
      ['fact', 'standings', '--event', '6', '--round', 'final'],
      ['fact', 'rating'],
      ['fact', 'rating', 'samurai', '--event', '6'],
      ['fact', 'matchup', 'samurai'],
      ['fact', 'champion', '--event', '6', 'extra'],
      ['fact', 'champion', '--event', '6', '--k', '3'],
      ['search', 'x', '--event', '6'],
      ['fact', 'ratings', '--top', '0'],
      ['fact', 'ratings', '--top', 'ten'],
      ['fact', 'ratings', 'samurai'],
      ['fact', 'ratings', '--event', '6'],
      ['fact', 'rating', 'samurai', '--top', '3'],
      ['search', 'x', '--top', '3'],
      ['fact', 'card'],
      ['fact', 'card', '--deck', 'Samurai'],
      ['fact', 'package'],
      ['fact', 'card', 'x', '--deck', ''],
      ['fact', 'card', 'x', '--event', '6'],
      ['fact', 'rating', 'samurai', '--deck', 'Samurai'],
      ['search', 'x', '--deck', 'Samurai'],
    ];
    for (const argv of bad) expect(() => parseKbArgs(argv), argv.join(' ')).toThrow(ArgError);
  });

  // the real recorded files; deck names resolved through invented deck records (the resolver also reads the files' names)
  const src = loadCompetitive(ROOT);
  const deckIx = buildIndex([
    finishRecord({ id: 'deck:s1-01-mutant-rry', kind: 'deck', title: 'S1-01 Mutant (RRY)', aliases: ['s1-01-mutant-rry.txt', 'LISTFP01'], text: 'An invented deck record.', source: { file: 'fixture' }, origin: 'authored', scope: 'public' }),
    finishRecord({ id: 'deck:RBY-samurai', kind: 'deck', title: 'Samurai', text: 'Another invented deck record.', source: { file: 'fixture' }, origin: 'authored', scope: 'public' }),
  ]);
  const fact = (argv: string[]) => runFact(parseKbArgs(['fact', ...argv]).fact!, src, deckResolver(deckIx, src));
  const ev6 = src.events.find((e) => e.event.id === 6);

  it.skipIf(!ev6)('prints exact numbers with their source, bot and sim version', () => {
    const champ = fact(['champion', '--event', '6']);
    expect(champ.code).toBe(0);
    expect(champ.out).toContain(`Event #6 champion: ${ev6!.event.champion}`);
    expect(champ.out).toMatch(/source: public\/tournaments\/event-6\.json \(the \w+ bot on sim version \d+, recorded 20\d\d-/);
    const st = fact(['standings', '--event', '6', '--round', '5']);
    expect(st.out).toMatch(/^Event #6 standings after round 5 of 9/);
    const json = JSON.parse(fact(['standings', '--event', '6', '--json']).out);
    expect(json.rows.map((r: { deck: string }) => r.deck)).toEqual(ev6!.event.standings.map((s) => s.deck));
    expect(json.source).toBe('public/tournaments/event-6.json');
    expect(fact(['round', '--event', '6', '--round', 'Final']).out).toMatch(/^Event #6, Final: a top-cut round/);
    // movement and upsets inside a Swiss round, in text and in JSON
    const r5 = fact(['round', '--event', '6', '--round', '5']);
    expect(r5.out).toMatch(/\n(Into the top-cut places \(the first 8\) in round 5: |No deck moved into or out of the top-cut places)/);
    expect(r5.out).toMatch(/\nBiggest climb: /);
    expect(r5.out).toMatch(/\nUpsets by the ratings fitted on events 1 to 5 \(\d+ games\), the winner's chance per game 30\.0% or less: \d+ of \d+ judged matches/);
    const r5j = JSON.parse(fact(['round', '--event', '6', '--round', '5', '--json']).out);
    expect(r5j.movement).toMatchObject({ round: 5, cut: 8, hasBefore: true, notApplicable: null });
    expect(r5j.upsets).toMatchObject({ round: 'Round 5', yardstick: { events: [1, 2, 3, 4, 5] } });
    // fact upsets: the whole event, one round, a bracket round
    const up = fact(['upsets', '--event', '6']);
    expect(up.code).toBe(0);
    expect(up.out).toMatch(/^Event #6 upsets: judged by the ratings fitted on events 1 to 5 \(\d+ games\), never by ratings that include this event/);
    expect(up.out).toMatch(/\nPlayed matches: \d+ \(byes left out\); judged: \d+; not judged: \d+/);
    expect(up.out).toContain('source: public/tournaments/event-6.json');
    const upj = JSON.parse(fact(['upsets', '--event', '6', '--round', 'quarterfinals', '--json']).out);
    expect(upj).toMatchObject({ fact: 'upsets', event: 6, round: 'Quarterfinals', played: 4 });
    expect(fact(['upsets', '--event', '1']).out).toMatch(/^Event #1 upsets: not judged, no earlier recorded event on sim version \d+ with the \w+ bot/);
    expect(estimateTokens(up.out)).toBeLessThan(1000);
    // a deck by file, by list fingerprint and by name, any case
    for (const name of ['s1-01-mutant-rry.txt', 'LISTFP01', 's1-01 mutant (rry)']) expect(fact(['rating', name]).out, name).toMatch(/^S1-01 Mutant \(RRY\) rating: /);
    expect(fact(['finishes', 'Samurai']).out).toMatch(/^Samurai finishes in standard events/);
    const m = JSON.parse(fact(['matchup', 'S1-01 Mutant (RRY)', 'Samurai', '--json']).out);
    expect(m).toMatchObject({ fact: 'matchup', a: 'S1-01 Mutant (RRY)', b: 'Samurai', known: true, source: 'public/data/h2h.json' });
    expect(estimateTokens(champ.out)).toBeLessThan(200);
  });

  it.skipIf(!src.ratings)('prints the ratings table in the file\'s order, with ranges, games and the tier now', () => {
    const rows = src.ratings!.data.decks;
    const t = fact(['ratings', '--top', '3']);
    expect(t.code).toBe(0);
    const lines = t.out.trimEnd().split('\n');
    expect(lines[0]).toMatch(/^Power ratings table: .* played by the \w+ bot on sim version \d+.*The first 3 of \d+ rated decks now:$/);
    expect(lines.slice(1, 4).map((l) => l.slice(0, l.indexOf(':')))).toEqual(rows.slice(0, 3).map((r, i) => `${i + 1}. ${r.name}`));
    expect(lines[1]).toMatch(/expected win rate against the whole field [\d.]+% \(90% range [\d.]+%–[\d.]+%\) over \d+ rated games; Sim tier now /);
    expect(lines.at(-1)).toMatch(/^ {2}source: src\/data\/ratings\.json \(the \w+ bot on sim version \d+, recorded /);
    expect(fact(['ratings']).out).toContain(`All ${rows.length} rated decks now:`);
    const json = JSON.parse(fact(['ratings', '--top', '2', '--json']).out);
    expect(json).toMatchObject({ fact: 'ratings', source: 'src/data/ratings.json', of: rows.length });
    expect(json.rows.map((r: { deck: string }) => r.deck)).toEqual(rows.slice(0, 2).map((r) => r.name));
  });

  it('exits 1 on an unknown event, round or deck, saying what exists', () => {
    const noEvent = fact(['champion', '--event', '999']);
    expect([noEvent.code, noEvent.out]).toEqual([1, expect.stringMatching(/^no recorded event 999; recorded: /)]);
    if (ev6) expect(fact(['round', '--event', '6', '--round', '12'])).toMatchObject({ code: 1, out: expect.stringContaining('has rounds 1 to 9') });
    if (ev6) expect(fact(['upsets', '--event', '6', '--round', '12'])).toMatchObject({ code: 1, out: expect.stringContaining('has rounds 1 to 9') });
    if (ev6) expect(fact(['upsets', '--event', '6', '--round', 'round of 16'])).toMatchObject({ code: 1, out: expect.stringContaining('(it has Quarterfinals, Semifinals, Final)') });
    expect(fact(['upsets', '--event', '999'])).toMatchObject({ code: 1, out: expect.stringMatching(/^no recorded event 999; recorded: /) });
    const noDeck = fact(['rating', 'mutant']);
    expect(noDeck.code).toBe(1);
    expect(noDeck.out).toMatch(/^no deck named "mutant"; nearest:\n {2}S1-01 Mutant \(RRY\)/);
  });
});

describe('fact card and fact package (step 2.4)', () => {
  // the real report files; names resolved through invented card, package and deck records with the real ids
  const stats = loadStats(ROOT, CATALOGUE_VERSION);
  const BBG = { file: 'meta-bbg-cunningham-econ.txt', name: 'BBG Cunningham Econ', listId: '0b6272134a22585c' };
  const ix = buildIndex([
    finishRecord({ id: 'card:jacked_in_voodoo_boy', kind: 'card', title: 'Jacked-In Voodoo Boy', text: 'An invented card record.', source: { file: 'fixture' }, origin: 'authored', scope: 'public' }),
    finishRecord({ id: 'card:kilo_byte', kind: 'card', title: 'Kilo Byte', text: 'A card no report has.', source: { file: 'fixture' }, origin: 'authored', scope: 'public' }),
    finishRecord({ id: 'pkg:rocker', kind: 'package', title: 'Rocker Units (Johnny Silverhand)', text: 'An invented package record.', source: { file: 'fixture' }, origin: 'authored', scope: 'public' }),
    finishRecord({ id: 'deck:meta-bbg-cunningham-econ', kind: 'deck', title: BBG.name, aliases: [BBG.file, BBG.listId], text: 'An invented deck record.', fields: { file: BBG.file }, stamps: { listId: BBG.listId }, source: { file: 'fixture' }, origin: 'authored', scope: 'public' }),
  ]);
  const src = loadCompetitive(ROOT);
  const st = { sources: stats, names: statResolver(ix), deckOf: (l: string) => (l === BBG.listId ? { file: BBG.file, name: BBG.name } : undefined) };
  const fact = (argv: string[]) => runFact(parseKbArgs(['fact', ...argv]).fact!, src, deckResolver(ix, src), st);
  const there = !!stats.decisions && !!stats.synergies && !!stats.analysis;

  it.skipIf(!there)('prints a card on one list and pooled, with the source file, bot and sim version', () => {
    const one = fact(['card', 'Jacked-In Voodoo Boy', '--deck', 'meta-bbg-cunningham-econ.txt']);
    expect(one.code).toBe(0);
    expect(one.out).toMatch(/^Jacked-In Voodoo Boy on BBG Cunningham Econ: statistics of how the bot used one card on one library list, measured by the \w+ bot on sim version \d+/);
    expect(one.out).toMatch(/Played from hand in the main phase: \d+ times in \d+ of the list's \d+ games/);
    expect(one.out).toMatch(/source: public\/data\/decisions\.json \(the \w+ bot on sim version \d+, recorded 20\d\d-/);
    expect(one.out).toContain('source: src/data/analysis.json');
    const row = stats.decisions!.data.decks.find((d) => d.listId === BBG.listId)!.cards.find((c) => c.id === 'jacked_in_voodoo_boy')!.modes[0]!;
    expect(one.out).toContain(`${row.all.uses} times in ${row.all.games} of the list's`);
    // the same deck by list fingerprint, the card by its id
    expect(fact(['card', 'jacked_in_voodoo_boy', '--deck', BBG.listId]).out).toBe(one.out);
    const json = JSON.parse(fact(['card', 'Jacked-In Voodoo Boy', '--deck', BBG.name, '--json']).out);
    expect(json).toMatchObject({ fact: 'card', card: 'jacked_in_voodoo_boy', deck: BBG.file, use: { scope: 'list', basis: { file: 'public/data/decisions.json' } } });
    expect(json.use.modes[0].won.games).toBe(row.all.games);
    const pooled = fact(['card', 'Jacked-In Voodoo Boy']);
    expect(pooled.out).toMatch(/^Jacked-In Voodoo Boy: statistics of how the bot used one card, pooled over the \d+ lists of the \d+ in the decision report/);
    expect(pooled.out).toContain('lists with a cell: ');
    expect(estimateTokens(one.out)).toBeLessThan(1500);
  });

  it.skipIf(!there)('prints a package pooled and on a list, with the coach’s gate', () => {
    const p = fact(['package', 'rocker']);
    expect(p.code).toBe(0);
    expect(p.out).toMatch(/^Rocker Units \(Johnny Silverhand\): statistics of one synergy package, pooled over the \d+ lists in the synergy report that hold it, measured by the \w+ bot on sim version \d+/);
    expect(p.out).toMatch(/Lift \(won when online minus won when never\): [+-]\d+\.\d points \(95% interval /);
    expect(p.out).toMatch(/The coach's lift gate \(liftGate in src\/ai\/packageLift\.ts\) would (call it measured|leave it unnamed)/);
    expect(p.out).toMatch(/source: public\/data\/synergies\.json \(the \w+ bot on sim version \d+/);
    expect(JSON.parse(fact(['package', 'Rocker Units (Johnny Silverhand)', '--json']).out)).toMatchObject({ fact: 'package', scope: 'pooled', package: { id: 'rocker' } });
    // a list that does not hold it says which lists do
    const no = fact(['package', 'rocker', '--deck', BBG.file]);
    expect([no.code, no.out]).toEqual([1, expect.stringMatching(/^BBG Cunningham Econ does not hold Rocker Units \(Johnny Silverhand\) in public\/data\/synergies\.json; lists that do: /)]);
  });

  it('exits 1 on an unknown card, package or deck, listing the nearest; and on a card no report has', () => {
    const card = fact(['card', 'Voodoo Boyz']);
    expect([card.code, card.out]).toEqual([1, expect.stringMatching(/^no card named "Voodoo Boyz"; nearest:\n {2}Jacked-In Voodoo Boy \(card:jacked_in_voodoo_boy\)/)]);
    expect(fact(['package', 'rockers']).out).toMatch(/^no package named "rockers"; nearest:\n {2}Rocker Units/);
    expect(fact(['card', 'Jacked-In Voodoo Boy', '--deck', 'cunningham econ deck']).out).toMatch(/^no library deck named "cunningham econ deck"; nearest:\n {2}BBG Cunningham Econ/);
    if (there) expect(fact(['card', 'Kilo Byte'])).toMatchObject({ code: 1, out: expect.stringMatching(/^no statistics for Kilo Byte in public\/data\/decisions\.json or src\/data\/analysis\.json/) });
  });
});

describe('query commands', () => {
  const run = (argv: string[]) => runQuery(parseKbArgs(argv), IX);
  it('search prints ranked records, or "no match" with exit code 1', () => {
    const r = run(['search', 'Kilo Byte']);
    expect(r.code).toBe(0);
    expect(r.out).toMatch(/^1\. card:kilo_byte {2}Kilo Byte/);
    const none = run(['search', 'xyzzy plugh']);
    expect([none.code, none.out.trim()]).toEqual([1, 'no match for "xyzzy plugh"']);
    const json = JSON.parse(run(['search', 'Kilo Byte', '--json', '--k', '2']).out);
    expect(json.hits).toHaveLength(2);
    expect(json.hits[0].id).toBe('card:kilo_byte');
  });
  it('get prints every record with the name, in full; unknown names suggest the nearest', () => {
    const r = run(['get', 'nova vex']);
    expect(r.out).toContain('card:nova_a');
    expect(r.out).toContain('card:nova_b');
    expect(run(['get', 'nova vex', '--kind', 'card', '--scope', 'local']).code).toBe(1);
    const miss = run(['get', 'Kilo']);
    expect(miss.code).toBe(1);
    expect(miss.out).toMatch(/no record named "Kilo"; nearest:\n {2}/);
  });
  it('related groups neighbours by link type and labels local records', () => {
    const r = run(['related', 'Kilo Byte ruling 1']);
    expect(r.out).toMatch(/ {2}card \(1\):\n {4}card:kilo_byte/);
    expect(r.out).toMatch(/ {2}official \(1\):\n {4}faq:aaaaaaaa {2}Invented FAQ item 1 {2}\(local-only\)/);
    const json = JSON.parse(run(['related', 'card:kilo_byte', '--json']).out);
    expect(json[0].groups.map((g: { rel: string }) => g.rel)).toEqual(['ruling', 'mentions']);
  });
  it('labels local records in search output', () => {
    expect(run(['search', 'Kilo Byte', '--scope', 'local']).out).toContain('LOCAL-ONLY');
  });
  it('keeps the output within --max-tokens', () => {
    for (const argv of [
      ['search', 'Kilo Byte appears', '--k', '12', '--max-tokens', '150'],
      ['related', 'card:kilo_byte', '--max-tokens', '80'],
      ['get', 'card:kilo_byte', '--max-tokens', '60'],
    ])
      expect(estimateTokens(run(argv).out), argv.join(' ')).toBeLessThanOrEqual(Number(argv[argv.length - 1]) + 5);
  });
});

describe('the local pack cache', () => {
  it('builds into the cache, reuses it while inputs are unchanged and rebuilds when one changed', async () => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'nct-kb-'));
    try {
      const first = await ensurePack({ root: ROOT, cacheDir: dir, raw: false });
      expect(first.rebuilt).toBe(true);
      expect(first.manifest).toMatchObject({ kind: 'nct-kb', schema: 1, local: false });
      expect(first.manifest.scopes.local).toBe(0);
      const lines = fs.readFileSync(path.join(dir, 'records.jsonl'), 'utf8');
      expect(lines.split('\n').length - 1).toBe(first.records.length);
      const second = await ensurePack({ root: ROOT, cacheDir: dir, raw: false });
      expect(second.rebuilt).toBe(false);
      expect(second.records).toEqual(first.records);
      const mf = path.join(dir, 'manifest.json');
      const m = JSON.parse(fs.readFileSync(mf, 'utf8'));
      m.inputs['src/data/cards.json'] = 'stale';
      fs.writeFileSync(mf, JSON.stringify(m));
      const third = await ensurePack({ root: ROOT, cacheDir: dir, raw: false });
      expect(third.rebuilt).toBe(true);
      expect(fs.readFileSync(path.join(dir, 'records.jsonl'), 'utf8')).toBe(lines);
      expect(statsText(third)).toMatch(/^kb pack: \d+ records \(public \d+, local 0, no data\/raw\), records\.jsonl [\d.]+ KB/);
    } finally {
      fs.rmSync(dir, { recursive: true, force: true });
    }
    // two builds of the whole pack: about 2 s alone, but it passed the default 10 s once while the full suite ran beside it
  }, 30_000);
});

describe('the script', () => {
  const tsx = path.join(ROOT, 'node_modules', 'tsx', 'dist', 'cli.mjs');
  const kb = (...args: string[]) => spawnSync(process.execPath, [tsx, 'scripts/kb.ts', ...args], { cwd: ROOT, encoding: 'utf8' });
  it('prints its header for --help and exits 2 on a bad command line, before reading anything', () => {
    const help = kb('--help');
    expect(help.status).toBe(0);
    expect(help.stdout).toMatch(/^Knowledge pack \(docs\/RAG_PLAN\.md\)/);
    expect(help.stdout).toContain('npm run kb -- search');
    const bad = kb('search', 'x', '--bogus');
    expect(bad.status).toBe(2);
    expect(bad.stderr).toMatch(/error: unknown option --bogus/);
    expect(kb('search').status).toBe(2);
  }, 30_000);
});
