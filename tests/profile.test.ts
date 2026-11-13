// The player profile: the stored choices (src/lib/profile.ts), the stats derived from the practice log
// (src/lib/profileStats.ts) and the share payload (src/lib/profileShare.ts), above all that a private section leaves
// nothing of itself in what is shared.
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { deleteProfile, emptyProfile, loadProfile, parseProfile, PROFILE_KEY, PROFILE_SECTIONS, saveProfile, type ProfileDoc, type ProfileSection } from '../src/lib/profile';
import {
  botTier,
  deckStatRows,
  filterHistory,
  headline,
  mostPlayed,
  myDeckCounts,
  myDecks,
  newestFirst,
  pageOf,
  smallSample,
  sortDeckStats,
  winRate,
} from '../src/lib/profileStats';
import { buildShared, decodeShared, encodeShared, LINK_MAX, parseShared, parseSharedText, shareLink, sharedSections } from '../src/lib/profileShare';
import { annotatePractice, coachSummary, loadPractice, recordPractice, type PracticeGame } from '../src/lib/practiceLog';
import { tierOf } from '../src/ai/tiers';
import { allDecks, BUILTIN, loadStored, upsertCustom } from '../src/lib/browserLibrary';
import type { LibraryDeck } from '../src/lib/library';

function memoryStorage() {
  const m = new Map<string, string>();
  return { getItem: (k: string) => m.get(k) ?? null, setItem: (k: string, v: string) => void m.set(k, String(v)), removeItem: (k: string) => void m.delete(k), clear: () => m.clear(), m };
}
let store: ReturnType<typeof memoryStorage>;
beforeEach(() => {
  store = memoryStorage();
  vi.stubGlobal('localStorage', store);
});
afterEach(() => {
  vi.unstubAllGlobals();
});

const game = (o: Partial<PracticeGame> & Pick<PracticeGame, 'result'>): PracticeGame => ({ date: '2026-11-01T10:00:00Z', deck: 'Alpha', opp: 'Beta', level: 'hard', first: true, turns: 8, reason: '', ...o });

// oldest first, as stored
const GAMES: PracticeGame[] = [
  game({ id: 'a', date: '2026-11-01T10:00:00Z', result: 'loss', level: 'easy', first: false, turns: 6 }),
  game({ id: 'b', date: '2026-11-02T10:00:00Z', result: 'win', turns: 10, gigs: [7, 3], coach: { fine: 8, measured: 10, grade: 'B' } }),
  game({ id: 'c', date: '2026-11-03T10:00:00Z', result: 'win', opp: 'Gamma', level: 'deep', coach: { fine: 10, measured: 10, grade: 'A' } }),
  game({ id: 'd', date: '2026-11-04T10:00:00Z', result: 'win', deck: 'Delta', level: 'medium' }),
  game({ id: 'e', date: '2026-11-05T10:00:00Z', result: 'loss', conceded: true, deck: 'Delta', first: false, turns: 0 }),
  game({ id: 'f', date: '2026-11-06T10:00:00Z', result: 'loss', deck: 'Alpha' }),
];

describe('profile store', () => {
  it('defaults to every section private and drops what it does not know', () => {
    const p = loadProfile();
    expect(p).toEqual(emptyProfile());
    expect(PROFILE_SECTIONS.every((k) => p.public[k] === false)).toBe(true);
    const parsed = parseProfile(
      JSON.stringify({ kind: 'nct-profile-settings', schema: 1, name: '  Vee\u0000‮  the\n merc ' + 'x'.repeat(80), picture: '<img src=x>', favourite: 'meta-a.txt', public: { identity: true, history: 'yes', extra: true }, secret: 1 }),
    )!;
    expect(parsed.name.startsWith('Vee the merc')).toBe(true);
    expect([...parsed.name].length).toBe(40);
    expect(parsed.picture).toBeNull();
    expect(parsed.favourite).toBe('meta-a.txt');
    expect(parsed.public).toEqual({ identity: true, favourite: false, headline: false, history: false, deckStats: false, decks: false });
    expect('secret' in parsed).toBe(false);
  });
  it('refuses a newer schema and survives junk', () => {
    expect(parseProfile(JSON.stringify({ kind: 'nct-profile-settings', schema: 2 }))).toBeNull();
    expect(parseProfile('not json')).toEqual(emptyProfile());
    expect(parseProfile('[1]')).toEqual(emptyProfile());
  });
  it('saves only the choices under its key and deletes them', () => {
    const p: ProfileDoc = { ...emptyProfile(), name: 'Vee', picture: 'alt_cunningham_soulkiller_architect', public: { ...emptyProfile().public, identity: true } };
    expect(saveProfile(p, '2026-11-12T00:00:00.000Z')).not.toBeNull();
    const raw = JSON.parse(store.getItem(PROFILE_KEY)!);
    expect(Object.keys(raw).sort()).toEqual(['favourite', 'kind', 'name', 'picture', 'public', 'schema', 'updatedAt']);
    expect(loadProfile().name).toBe('Vee');
    expect(deleteProfile()).toBe(true);
    expect(store.getItem(PROFILE_KEY)).toBeNull();
    expect(loadProfile()).toEqual(emptyProfile());
  });
});

describe('derived stats', () => {
  it('maps bot levels as src/ai/tiers.ts does', () => {
    for (const l of ['easy', 'medium', 'hard', 'mixed', 'fast', 'lookahead', 'deep', 'hard-v1']) expect(botTier(l)).toBe(tierOf(l));
    expect(botTier('something')).toBe('other');
  });
  it('counts the headline numbers, streaks and coach average', () => {
    const h = headline(GAMES);
    expect(h.record).toEqual({ games: 6, wins: 3, losses: 3, draws: 0 });
    expect(winRate(h.record)).toBe(0.5);
    expect(h.conceded).toBe(1);
    expect(h.streak).toEqual({ result: 'loss', n: 2 });
    expect(h.bestWinStreak).toBe(3);
    expect(h.byTier.map((t) => [t.tier, t.games, t.wins])).toEqual([
      ['easy', 1, 0],
      ['medium', 1, 1],
      ['hard', 4, 2],
    ]);
    expect(h.coach).toEqual({ games: 2, avgPct: 90, grade: 'A' });
    expect(headline([]).streak).toBeNull();
    expect(headline([]).coach).toBeNull();
    expect(smallSample(19)).toBe(true);
    expect(smallSample(20)).toBe(false);
  });
  it('builds per-deck rows with splits and sorts them', () => {
    const rows = deckStatRows(GAMES);
    expect(rows.map((r) => r.deck)).toEqual(['Alpha', 'Delta']);
    const a = rows[0];
    expect(a.first).toEqual({ games: 3, wins: 2, losses: 1, draws: 0 });
    expect(a.second).toEqual({ games: 1, wins: 0, losses: 1, draws: 0 });
    expect(a.avgTurns).toBe(8);
    expect(a.last).toBe('2026-11-06T10:00:00Z');
    expect(a.byOpp.map((o) => [o.opp, o.games])).toEqual([
      ['Beta', 3],
      ['Gamma', 1],
    ]);
    expect(rows[1].avgTurns).toBe(8); // the conceded game without a turn count is left out
    expect(sortDeckStats(rows, 'deck', 'desc').map((r) => r.deck)).toEqual(['Delta', 'Alpha']);
    expect(sortDeckStats(rows, 'winRate', 'asc').map((r) => r.deck)).toEqual(['Alpha', 'Delta']);
    expect(mostPlayed(GAMES)).toBe('Alpha');
    expect(mostPlayed([])).toBeNull();
  });
  it('filters and pages the history newest first', () => {
    expect(newestFirst(GAMES).map((g) => g.id)).toEqual(['f', 'e', 'd', 'c', 'b', 'a']);
    expect(filterHistory(GAMES, { deck: 'Alpha', result: 'win' }).map((g) => g.id)).toEqual(['c', 'b']);
    expect(pageOf([1, 2, 3, 4, 5], 2, 2)).toEqual({ items: [3, 4], page: 2, pages: 3 });
    expect(pageOf([1, 2, 3], 9, 2).page).toBe(2);
    expect(pageOf([], 1, 2)).toEqual({ items: [], page: 1, pages: 1 });
  });
  it('summarises the coach scorecard and keeps it on the logged game', () => {
    expect(coachSummary([{ verdict: 'agree' }, { verdict: 'close' }, { verdict: 'mistake' }, { verdict: 'other' }])).toEqual({ fine: 2, measured: 3, grade: 'C', pct: 67 });
    expect(coachSummary([])).toBeNull();
    recordPractice(game({ id: 'x', result: 'win' }));
    annotatePractice('x', { fine: 9, measured: 10, grade: 'A' });
    annotatePractice('missing', { fine: 1, measured: 1, grade: 'A' });
    expect(loadPractice()).toHaveLength(1);
    expect(loadPractice()[0].coach).toEqual({ fine: 9, measured: 10, grade: 'A' });
  });
});

describe('my decks', () => {
  it('groups saved decks by origin and keeps when they were added', () => {
    expect(upsertCustom({ name: 'Pasted', legends: [], main: [], sideboard: [], origin: 'imported' })).toBe(true);
    const added = loadStored()[0].added!;
    expect(added).toBeTruthy();
    // saved again from the editor (no mark on the draft): keeps when it was added and how it began
    upsertCustom({ name: 'Pasted', legends: [], main: ['x'], sideboard: [] });
    expect(loadStored()[0]).toMatchObject({ added, origin: 'imported' });
    upsertCustom({ name: 'Built', legends: [], main: [], sideboard: [], origin: 'created' });
    upsertCustom({ name: 'Lab-001-02 Something', legends: [], main: [], sideboard: [] });
    upsertCustom({ name: 'Old (tuned)', legends: [], main: [], sideboard: [] });
    store.setItem('nct.customDecks.v1', JSON.stringify([...JSON.parse(store.getItem('nct.customDecks.v1')!), { name: 'Legacy', legends: [], main: [], sideboard: [] }]));
    const mine = myDecks(allDecks());
    expect(Object.fromEntries(mine.map((d) => [d.name, d.group]))).toEqual({ Pasted: 'imported', Built: 'created', 'Lab-001-02 Something': 'bred', 'Old (tuned)': 'tuned', Legacy: 'unrecorded' });
    expect(mine.find((d) => d.name === 'Legacy')!.added).toBeNull();
    expect(myDeckCounts(mine)).toEqual({ imported: 1, created: 1, tuned: 1, bred: 1, unrecorded: 1 });
  });
});

const ALL_PUBLIC = Object.fromEntries(PROFILE_SECTIONS.map((k) => [k, true])) as Record<ProfileSection, boolean>;
const NOW = '2026-11-12T12:00:00.000Z';

function libWith(): LibraryDeck[] {
  const b = BUILTIN[0];
  return [b, { file: 'custom:Alpha', deck: { name: 'Alpha', legends: b.deck.legends, main: b.deck.main, sideboard: [] }, kind: 'custom', prov: { origin: 'My deck' }, saved: 'created', added: '2026-10-01T00:00:00Z' }];
}

describe('share payload', () => {
  const profile: ProfileDoc = { ...emptyProfile(), name: 'Secret Name', picture: 'zz_test_picture', favourite: null, public: { ...ALL_PUBLIC } };

  it('is empty of sections by default', () => {
    const p = buildShared({ profile: emptyProfile(), games: GAMES, lib: libWith(), now: NOW });
    expect(p).toEqual({ kind: 'nct-profile', schema: 1, createdAt: NOW });
  });

  it('carries every public section', () => {
    const p = buildShared({ profile, games: GAMES, lib: libWith(), now: NOW });
    expect(sharedSections(p)).toEqual([...PROFILE_SECTIONS]);
    expect(p.favourite).toMatchObject({ name: 'Alpha', chosen: false });
    expect(p.history).toHaveLength(6);
    expect(p.decks!.map((d) => d.name)).toEqual(['Alpha']);
    expect(p.decks![0].cards.reduce((n, [, c]) => n + c, 0)).toBe(BUILTIN[0].deck.main.length);
  });

  // Each section has a value that appears nowhere else in the payload, so we can check that turning it private
  // removes it from the whole serialized document (not just its own key).
  const MARKERS: Record<ProfileSection, (p: ReturnType<typeof buildShared>) => string[]> = {
    identity: () => ['Secret Name', 'zz_test_picture'],
    favourite: () => ['"chosen"'],
    headline: () => ['"bestWinStreak"', '"conceded":1', '"avgPct"'],
    history: () => ['"turns"', '"gigs":[7,3]', '2026-11-03T10:00:00Z'],
    deckStats: () => ['"avgTurns"', '"byOpp"', '"second"'],
    decks: () => ['"cards"', '2026-10-01T00:00:00Z', '"group"'],
  };
  for (const k of PROFILE_SECTIONS)
    it(`leaves nothing of a private ${k} section in the payload`, () => {
      const full = JSON.stringify(buildShared({ profile, games: GAMES, lib: libWith(), now: NOW }));
      const without = buildShared({ profile: { ...profile, public: { ...ALL_PUBLIC, [k]: false } }, games: GAMES, lib: libWith(), now: NOW });
      const text = JSON.stringify(without);
      expect(k in without).toBe(false);
      for (const m of MARKERS[k](without)) {
        expect(full).toContain(m);
        expect(text).not.toContain(m);
      }
      // and the section alone carries only itself
      const only = buildShared({ profile: { ...profile, public: { ...emptyProfile().public, [k]: true } }, games: GAMES, lib: libWith(), now: NOW });
      expect(sharedSections(only)).toEqual([k]);
      for (const other of PROFILE_SECTIONS.filter((o) => o !== k)) for (const m of MARKERS[other](only)) if (!MARKERS[k](only).includes(m)) expect(JSON.stringify(only)).not.toContain(m);
    });

  it('round-trips through a link payload', async () => {
    const p = buildShared({ profile, games: GAMES, lib: libWith(), now: NOW });
    const enc = await encodeShared(p);
    expect(enc[0]).toBe('z');
    expect(enc).toMatch(/^[A-Za-z0-9_-]+$/);
    expect(enc.length).toBeLessThan(LINK_MAX);
    const back = await decodeShared(enc);
    expect(back).toEqual({ ok: true, profile: JSON.parse(JSON.stringify(p)) });
    expect(shareLink('https://x/', enc)).toBe(`https://x/#/u/${enc}`);
    expect(shareLink('https://x/', 'z' + 'a'.repeat(LINK_MAX))).toBeNull();
  });

  it('refuses bad, foreign and newer payloads with a plain message', async () => {
    expect(await decodeShared('zz!!')).toMatchObject({ ok: false });
    expect(await decodeShared('zAAAA')).toMatchObject({ ok: false });
    expect(await decodeShared('')).toMatchObject({ ok: false });
    expect(parseSharedText('nope')).toMatchObject({ ok: false });
    expect(parseShared({ kind: 'other', schema: 1 })).toMatchObject({ ok: false, why: expect.stringContaining('not a shared') });
    expect(parseShared({ kind: 'nct-profile', schema: 2 })).toMatchObject({ ok: false, why: expect.stringContaining('newer version') });
    expect(parseShared({ kind: 'nct-profile' })).toMatchObject({ ok: false });
  });

  it('cleans every string and drops malformed parts of an untrusted payload', () => {
    const r = parseShared({
      kind: 'nct-profile',
      schema: 1,
      createdAt: 'yesterday-ish',
      identity: { name: '<script>alert(1)</script>' + 'y'.repeat(100), picture: 'javascript:alert(1)' },
      favourite: { name: 'Fav', legends: ['ok_id', '../../etc', 5], chosen: 'yes' },
      headline: { record: { games: 3, wins: 5, losses: 0, draws: 0 } },
      history: [{ deck: 'D', opp: 'O', result: 'win', tier: 'godlike', gigs: [7, -1], turns: 1e9 }, { deck: '', result: 'win' }, 'junk'],
      deckStats: [{ deck: 'D', games: 1, wins: 1, losses: 0, draws: 0, byOpp: [{ opp: 'O', games: 1, wins: 1, losses: 0, draws: 0 }, null] }],
      decks: [{ name: 'L', group: 'evil', cards: [['ok_id', 2], ['bad id', 1], ['x', 'many']], legends: [] }],
      extra: { a: 1 },
    });
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    const p = r.profile;
    expect(p.createdAt).toBe('');
    expect([...p.identity!.name].length).toBe(40);
    expect(p.identity!.picture).toBeNull();
    expect(p.favourite).toEqual({ name: 'Fav', legends: ['ok_id'], chosen: false });
    expect(p.headline).toBeUndefined(); // wins > games
    expect(p.history).toEqual([{ date: '', deck: 'D', opp: 'O', tier: 'other', result: 'win', turns: 0, first: false, gigs: null, conceded: false, grade: null }]);
    expect(p.deckStats![0].byOpp).toHaveLength(1);
    expect(p.decks).toEqual([{ name: 'L', group: 'unrecorded', legends: [], cards: [['ok_id', 2]], added: null }]);
    expect('extra' in p).toBe(false);
  });
});
