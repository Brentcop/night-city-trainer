// P6 of the tuning plan: do changes measured with the Medium bot hold with the Hard bot? (docs/TUNING_STUDY_2026-11-13.md
// "P6"; docs/EVIDENCE.md "Re-measurements".) Paired games of a list with and without a change on the same seeds, opponents
// and seats (the forge's layout: game k plays meta deck k mod 7, the seat alternates every 7 games, seed 5,000,000 + k),
// the 7 meta decks, SIM_VERSION 9. The plan below was fixed before any Hard game was played:
//
//   stage a  Hard, 560 paired games each, 13 changes, one per card added per deck (changes that add the same card to the
//            same list are nearly one experiment, so each add is measured once, by the change that read highest on Medium):
//              S2-05 Counter (RRG): −Gunpoint Diplomacy +Yorinobu; −We Gotta Live Together +Johnny Silverhand; −Mantis Blades +Nadia
//              S2-08 Explorer (GGY): −T-Bug +Rockn' Rockerboy; −Saul Bright +Fool on the Hill; −Dexter DeShawn +Zetatech Berserk
//              the seven recorded changes of experiment E2 (S2-03, S2-04, S2-06 and the four Ladder lists): the list
//              before the change (data/decks/custom/history/) against the library list
//   stage c  Medium, 2,800 paired games each, the seven E2 changes (their Medium figures on record are SIM_VERSION 8; the
//            six S2-05 and S2-08 changes already have 2,800 Medium games under version 9, p5-truth.ts, on these seeds)
//   stage b  Hard, 2,800 paired games each (the first 560 are stage a's), the change that read highest on Medium for each
//            of the two decks with current tuning evidence: S2-05 −Gunpoint Diplomacy +Yorinobu, S2-08 −T-Bug +Rockn' Rockerboy
//
//   THREADS=12 npx tsx reports/tuning-study-2026-11-13/p6-hard.ts OUT a|b|c      (from the repository root)
//
// Writes OUT/p6-<stage>.json after every deck (rows with the pooled paired difference, its standard error and spread, and
// the same per opponent and per seat) and prints one line per change. Games are kept in the game cache (.cache/games/), so
// a stage that is run again plays nothing twice. p6-rows.ts turns the stages into data/evidence/ rows.
import fs from 'node:fs';
import path from 'node:path';
import { loadLibrary, resolveDeck, runJobs } from '../../scripts/lib-node';
import { cliGameCache } from '../../scripts/game-cache';
import type { MatchJob } from '../../scripts/worker';
import { listFingerprint, parseDeck } from '../../src/engine/deck';
import type { DeckList } from '../../src/engine/types';
import { scoreOf } from '../../src/lib/evidence';
import { CURRENT_SIM_VERSION } from '../../src/lib/playedRecord';

const [OUT, STAGE] = process.argv.slice(2);
if (!OUT || !['a', 'b', 'c'].includes(STAGE ?? '')) {
  console.error('usage: npx tsx reports/tuning-study-2026-11-13/p6-hard.ts OUT a|b|c');
  process.exit(2);
}
const THREADS = Number(process.env.THREADS ?? 12);
const SEED = 5_000_000;
const lib = loadLibrary();
const metaDecks = lib.filter((d) => d.kind === 'meta');
const meta = metaDecks.map((d) => d.deck);
const metaIds = meta.map((d) => listFingerprint(d));
const H = 'data/decks/custom/history/';
const history = (f: string): DeckList => parseDeck(fs.readFileSync(H + f, 'utf8'), H + f).deck;
const swap = (d: DeckList, cut: string, add: string): DeckList => {
  const main = [...d.main];
  const i = main.indexOf(cut);
  if (i < 0) throw new Error(`${d.name} holds no ${cut}`);
  main.splice(i, 1, add);
  return { ...d, main };
};

interface Change {
  id: string;
  /** the library deck file the change belongs to */
  file: string;
  label: string;
  before: DeckList;
  after: DeckList;
  set: 's2' | 'e2';
  deep?: true;
}
const s205 = resolveDeck('s2-05-counter-rrg', lib);
const s208 = resolveDeck('s2-08-explorer-ggy', lib);
const e2 = (id: string, q: string, hist: string, label: string): Change => {
  const d = resolveDeck(q, lib);
  return { id, file: d.file, label, before: history(hist), after: d.deck, set: 'e2' };
};
const CHANGES: Change[] = [
  { id: 's2-05-gunpoint-yorinobu', file: s205.file, label: '-1 Gunpoint Diplomacy → +1 Yorinobu Arasaka: Steel Dragon', before: s205.deck, after: swap(s205.deck, 'gunpoint_diplomacy', 'yorinobu_arasaka_steel_dragon'), set: 's2', deep: true },
  { id: 's2-05-wglt-johnny', file: s205.file, label: '-1 We Gotta Live Together → +1 Johnny Silverhand: Never Stop Fighting', before: s205.deck, after: swap(s205.deck, 'we_gotta_live_together', 'johnny_silverhand_never_stop_fighting'), set: 's2' },
  { id: 's2-05-mantis-nadia', file: s205.file, label: '-1 Mantis Blades → +1 Nadia: Fighting Through Grief', before: s205.deck, after: swap(s205.deck, 'mantis_blades', 'nadia_fighting_through_grief'), set: 's2' },
  { id: 's2-08-tbug-rockerboy', file: s208.file, label: "-1 T-Bug: Amateur Philosopher → +1 Rockn' Rockerboy", before: s208.deck, after: swap(s208.deck, 't_bug_amateur_philosopher', 'rockn_rockerboy'), set: 's2', deep: true },
  { id: 's2-08-saul-fool', file: s208.file, label: '-1 Saul Bright: Stormrider → +1 Fool on the Hill', before: s208.deck, after: swap(s208.deck, 'saul_bright_stormrider', 'fool_on_the_hill'), set: 's2' },
  { id: 's2-08-dexter-zetatech', file: s208.file, label: '-1 Dexter DeShawn: One Last Chance → +1 Zetatech Berserk', before: s208.deck, after: swap(s208.deck, 'dexter_deshawn_one_last_chance', 'zetatech_berserk'), set: 's2' },
  e2('s2-03', 's2-03-cross-rgy', 's2-03-cross-rgy-2026-11-12.txt', 'S2-03 package swap Gear on Units -> Arasaka Units (8 cards)'),
  e2('s2-04', 's2-04-cross-rrg', 's2-04-cross-rrg-2026-11-12.txt', 'S2-04 package swap Ahead -> Even Street Cred (2 cards)'),
  e2('s2-06', 's2-06-counter-rgg', 's2-06-counter-rgg-2026-11-12.txt', 'S2-06 -1 Shattered Memories +1 6th Street Recruits'),
  e2('lad-bbg', 'ladder-bbg-jackie-alt-hanako', 'ladder-bbg-jackie-alt-hanako-2026-11-10.txt', 'Ladder BBG -1 Peace Offering +1 MaxTac AV'),
  e2('lad-rrb', 'ladder-rrb-dexter-v-wakako', 'ladder-rrb-dexter-v-wakako-2026-11-10.txt', 'Ladder RRB -1 Shattered Memories +1 Yorinobu: Steel Dragon'),
  e2('lad-padre', 'ladder-rrg-v-smasher-padre', 'ladder-rrg-v-smasher-padre-2026-11-10.txt', 'Ladder RRG Padre -1 Field Operator +1 MaxTac AV'),
  e2('lad-ryy', 'ladder-ryy-smasher-river-viktor', 'ladder-ryy-smasher-river-viktor-2026-11-10.txt', 'Ladder RYY -1 Alt: Mother of Daemons +1 Gorilla Arms'),
];
const PLAN = {
  a: { bot: 'hard', games: 560, changes: CHANGES },
  b: { bot: 'hard', games: 2800, changes: CHANGES.filter((c) => c.deep) },
  c: { bot: 'medium', games: 2800, changes: CHANGES.filter((c) => c.set === 'e2') },
}[STAGE as 'a' | 'b' | 'c'];

/** cards of `from` that `to` lacks, with repeats */
const minus = (from: readonly string[], to: readonly string[]): string[] => {
  const left = [...to];
  const out: string[] = [];
  for (const c of from) {
    const i = left.indexOf(c);
    if (i < 0) out.push(c);
    else left.splice(i, 1);
  }
  return out.sort();
};
const mean = (xs: readonly number[]) => xs.reduce((a, b) => a + b, 0) / Math.max(1, xs.length);
function paired(cand: readonly number[], base: readonly number[]) {
  const d = cand.map((x, i) => x - base[i]!);
  const m = mean(d);
  const sd = Math.sqrt(d.reduce((s, x) => s + (x - m) ** 2, 0) / Math.max(1, d.length - 1));
  return { games: d.length, mean: m, sd, se: sd / Math.sqrt(d.length), same: d.filter((x) => x === 0).length / d.length };
}
const pp = (x: number) => (x * 100).toFixed(1);

void (async () => {
  const cache = cliGameCache(true);
  fs.mkdirSync(OUT, { recursive: true });
  const outFile = path.join(OUT, `p6-${STAGE}.json`);
  const rows: unknown[] = [];
  // SMOKE=<games> plays a few games to try the script out (write to another OUT: those rows are not the measurement)
  const N = Number(process.env.SMOKE ?? PLAN.games);
  // one base per list: changes of the same list share its games
  const groups = new Map<string, Change[]>();
  for (const c of PLAN.changes) groups.set(listFingerprint(c.before), [...(groups.get(listFingerprint(c.before)) ?? []), c]);
  console.log(`stage ${STAGE}: ${PLAN.bot}, ${N} paired games each, ${PLAN.changes.length} changes on ${groups.size} lists, ${(PLAN.changes.length + groups.size) * N} games in all, ${THREADS} threads, SIM_VERSION ${CURRENT_SIM_VERSION}`);
  for (const cs of groups.values()) {
    const t0 = Date.now();
    const lists = [cs[0]!.before, ...cs.map((c) => c.after)];
    const jobs: MatchJob[] = lists.flatMap((d) => Array.from({ length: N }, (_, k) => ({ a: d, b: meta[k % meta.length]!, seed: SEED + k, first: (Math.floor(k / meta.length) % 2) as 0 | 1, bot: PLAN.bot })));
    const res = await runJobs(jobs, { threads: THREADS, cache });
    const scores = lists.map((_, i) => res.slice(i * N, (i + 1) * N).map((r) => scoreOf(r.winner)));
    const base = scores[0]!;
    cs.forEach((c, ci) => {
      const cand = scores[ci + 1]!;
      const all = paired(cand, base);
      const pick = (f: (k: number) => boolean) => {
        const ks = Array.from({ length: N }, (_, k) => k).filter(f);
        return { ...paired(ks.map((k) => cand[k]!), ks.map((k) => base[k]!)), base: mean(ks.map((k) => base[k]!)) };
      };
      const byOpp = meta.map((o, oi) => {
        const p = pick((k) => k % meta.length === oi);
        return { opp: o.name, oppListId: metaIds[oi]!, games: p.games, mean: p.mean, se: p.se, base: p.base };
      });
      const bySeat = ([0, 1] as const).map((first) => {
        const p = pick((k) => Math.floor(k / meta.length) % 2 === first);
        return { first, games: p.games, mean: p.mean, se: p.se };
      });
      rows.push({
        id: c.id,
        deck: c.file,
        label: c.label,
        baseListId: listFingerprint(c.before),
        candListId: listFingerprint(c.after),
        cuts: minus(c.before.main, c.after.main),
        adds: minus(c.after.main, c.before.main),
        legendCuts: minus(c.before.legends, c.after.legends),
        legendAdds: minus(c.after.legends, c.before.legends),
        bot: PLAN.bot,
        simVersion: CURRENT_SIM_VERSION,
        games: all.games,
        mean: all.mean,
        se: all.se,
        sd: all.sd,
        same: all.same,
        baseWr: mean(base),
        candWr: mean(cand),
        byOpp,
        bySeat,
        opponents: metaIds,
        seed: SEED,
      });
      console.log(`${c.id} [${PLAN.bot}, ${all.games} paired games]: ${pp(all.mean)} pts [${pp(all.mean - 1.96 * all.se)}, ${pp(all.mean + 1.96 * all.se)}], sd ${all.sd.toFixed(3)}, same game ${(all.same * 100).toFixed(0)}%, base ${pp(mean(base))}% -> ${pp(mean(cand))}%`);
    });
    fs.writeFileSync(outFile, JSON.stringify(rows, null, 1) + '\n');
    console.log(`  (${lists.length * N} games in ${Math.round((Date.now() - t0) / 1000)} s; ${outFile} holds ${rows.length} of ${PLAN.changes.length})`);
  }
  process.exit(0);
})();
