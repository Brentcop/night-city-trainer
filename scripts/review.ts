// Batch match reviews: replay games exactly and score every main-phase decision against the rollout oracle.
//
//   npx tsx scripts/review.ts --from events [--games 60] [--rollouts 4] [--coach] [--name backfill]
//   npx tsx scripts/review.ts --from tiers  [--games 42] [--tiers easy,medium,hard]      fresh games, every tier pairing
//   npx tsx scripts/review.ts --from file --file data/reviews/practice.json              recorded practice games
//
// Outputs: data/reviews/<name>.json (every review) and reports/review-<name>.md (aggregates).
import fs from 'node:fs';
import os from 'node:os';
import { Worker } from 'node:worker_threads';
import { loadLibrary } from './lib-node';
import { gameDeck } from '../src/lib/tournament';
import { BLUNDER, NOISE, type Category, type DecisionReview, type GameReview } from '../src/ai/reviewer';
import { tierLabel } from '../src/ai/tiers';
import type { ReviewJob } from './review-worker';

const args = process.argv.slice(2);
const flag = (n: string, d: string) => {
  const i = args.indexOf(`--${n}`);
  return i >= 0 ? args[i + 1] : d;
};
const FROM = flag('from', 'events');
const GAMES = +flag('games', '60');
const ROLLOUTS = +flag('rollouts', '8');
const COACH = args.includes('--coach');
const NAME = flag('name', FROM);
const THREADS = Math.max(1, Math.min(+flag('threads', String(os.cpus().length - 1)), 16));
const SEED = +flag('seed', '1');

let st = SEED * 2654435761;
const rnd = () => ((st = (st * 1664525 + 1013904223) >>> 0) / 4294967296);

// ---------------------------------------------------------------- jobs
function fromEvents(): ReviewJob[] {
  const dir = 'data/tournaments';
  const all: ReviewJob[] = [];
  for (const f of fs.readdirSync(dir).filter((x) => /^event-\d+\.json$/.test(x))) {
    const e = JSON.parse(fs.readFileSync(`${dir}/${f}`, 'utf8'));
    for (const [pi, part] of [...e.rounds, ...e.bracket].entries())
      for (const m of part.matches) {
        if (!m.b) continue;
        for (const g of m.games)
          all.push({
            id: `e${e.id}-${g.seed}`,
            decks: [gameDeck({ name: m.a, ...e.decks[m.a] }), gameDeck({ name: m.b, ...e.decks[m.b] })],
            seed: g.seed,
            first: g.first,
            bots: [e.bot, e.bot],
            rollouts: ROLLOUTS,
            withCoach: COACH,
            meta: { event: e.id, stage: pi < e.rounds.length ? 'swiss' : 'top', recordedWinner: g.winner },
          });
      }
  }
  // stratified-ish sample: shuffle, take GAMES
  for (let i = all.length - 1; i > 0; i--) {
    const j = Math.floor(rnd() * (i + 1));
    [all[i], all[j]] = [all[j], all[i]];
  }
  return all.slice(0, GAMES);
}
function fromTiers(): ReviewJob[] {
  const tiers = flag('tiers', 'easy,medium,hard').split(',');
  const meta = loadLibrary().filter((d) => d.kind === 'meta');
  const jobs: ReviewJob[] = [];
  let k = 0;
  while (jobs.length < GAMES) {
    for (let x = 0; x < tiers.length && jobs.length < GAMES; x++)
      for (let y = x + 1; y < tiers.length && jobs.length < GAMES; y++) {
        const a = meta[Math.floor(rnd() * meta.length)];
        const b = meta[Math.floor(rnd() * meta.length)];
        const seed = 700_000 + k++;
        const swap = k % 2 === 0;
        jobs.push({
          id: `t${seed}`,
          decks: [gameDeck(a.deck), gameDeck(b.deck)],
          seed,
          first: (k % 3 === 0 ? 1 : 0) as 0 | 1,
          bots: swap ? [tiers[y], tiers[x]] : [tiers[x], tiers[y]],
          rollouts: ROLLOUTS,
          withCoach: COACH,
          meta: { tiers: true },
        });
      }
  }
  return jobs;
}
function fromChaos(): ReviewJob[] {
  const b = flag('chaos-bot', 'medium');
  return fromTiers().map((j) => ({ ...j, id: `c${j.seed}`, bots: [b, b] as [string, string], chaos: +flag('chaos', '0.15'), meta: { chaos: true } }));
}
const jobs = FROM === 'chaos' ? fromChaos() : FROM === 'tiers' ? fromTiers() : FROM === 'file' ? (JSON.parse(fs.readFileSync(flag('file', ''), 'utf8')) as ReviewJob[]) : fromEvents();

// ---------------------------------------------------------------- run
interface Done {
  id: string;
  review?: GameReview;
  error?: string;
  meta?: Record<string, unknown>;
}
async function run(): Promise<Done[]> {
  const out: Done[] = [];
  let next = 0;
  const t0 = Date.now();
  await new Promise<void>((resolve) => {
    let live = Math.min(THREADS, jobs.length);
    if (!live) return resolve();
    for (let k = 0; k < Math.min(THREADS, jobs.length); k++) {
      const w = new Worker(new URL('./review-boot.mjs', import.meta.url));
      const feed = () => {
        if (next < jobs.length) w.postMessage(jobs[next++]);
        else {
          w.terminate();
          if (--live === 0) resolve();
        }
      };
      w.on('message', (r: Done) => {
        out.push(r);
        if (r.error) process.stderr.write(`\n  ${r.id}: ${r.error.slice(0, 200)}\n`);
        process.stderr.write(`\r  ${out.length}/${jobs.length} games reviewed  ${((Date.now() - t0) / 1000).toFixed(0)}s`);
        feed();
      });
      w.on('error', (e) => {
        process.stderr.write(`\nworker error: ${e}\n`);
        feed();
      });
      feed();
    }
  });
  process.stderr.write('\n');
  return out;
}

// ---------------------------------------------------------------- aggregate
const g40 = (x: number) => (x / 40).toFixed(2);
const pc = (x: number) => `${Math.round(x * 100)}%`;
interface Agg {
  n: number;
  regret: number;
  good: number;
  blunders: number;
  losing: number;
}
const add = (a: Agg, d: DecisionReview) => {
  a.n++;
  a.regret += d.regret;
  if (d.regret <= NOISE) a.good++;
  if (d.regret > BLUNDER) a.blunders++;
  if (d.gameLosing) a.losing++;
};
const empty = (): Agg => ({ n: 0, regret: 0, good: 0, blunders: 0, losing: 0 });
const row = (k: string, a: Agg) => `| ${k} | ${a.n} | ${pc(a.good / Math.max(1, a.n))} | ${g40(a.regret / Math.max(1, a.n))} | ${(100 * a.blunders / Math.max(1, a.n)).toFixed(1)} | ${a.losing} |`;
const HEAD = ['| | Decisions | Accuracy | Avg Gigs lost / decision | Blunders / 100 | Game-losing |', '|---|---|---|---|---|---|'];

export function aggregate(done: Done[]) {
  const reviews = done.filter((d) => d.review);
  const byAgent = new Map<string, Agg>();
  const byCat = new Map<string, Agg>();
  const byAgentCat = new Map<string, Agg>();
  const byDeck = new Map<string, Agg>();
  const winLose = { win: empty(), lose: empty() };
  const coach = { n: 0, agree: 0, regret: 0, botAgree: 0, byCat: new Map<string, { n: number; agree: number; regret: number; bot: number }>() };
  const worst: (DecisionReview & { deck: string; agent: string })[] = [];
  let replayMismatch = 0;
  let ms = 0;
  for (const { review: r, meta } of reviews) {
    ms += r!.ms;
    if (meta && 'recordedWinner' in meta) {
      const w = r!.winner === null ? 'tie' : r!.winner;
      if (w !== meta.recordedWinner) replayMismatch++;
    }
    for (const s of r!.seats) {
      const ds = r!.decisions.filter((d) => d.player === s.player);
      const agent = s.agent === 'deep' ? 'Deep (series bot)' : tierLabel(s.agent);
      for (const d of ds) {
        add(byAgent.get(agent) ?? (byAgent.set(agent, empty()), byAgent.get(agent)!), d);
        add(byCat.get(d.category) ?? (byCat.set(d.category, empty()), byCat.get(d.category)!), d);
        const ak = `${agent} · ${d.category}`;
        add(byAgentCat.get(ak) ?? (byAgentCat.set(ak, empty()), byAgentCat.get(ak)!), d);
        add(byDeck.get(s.name) ?? (byDeck.set(s.name, empty()), byDeck.get(s.name)!), d);
        if (r!.winner === s.player) add(winLose.win, d);
        else if (r!.winner === 1 - s.player) add(winLose.lose, d);
        if (d.coachRegret !== undefined) {
          coach.n++;
          if (d.coachRegret <= NOISE) coach.agree++;
          if (d.regret <= NOISE) coach.botAgree++;
          coach.regret += d.coachRegret;
          const c = coach.byCat.get(d.category) ?? { n: 0, agree: 0, regret: 0, bot: 0 };
          c.n++;
          if (d.coachRegret <= NOISE) c.agree++;
          c.regret += d.coachRegret;
          c.bot += d.regret;
          coach.byCat.set(d.category, c);
        }
        if (d.regret > BLUNDER) worst.push({ ...d, deck: s.name, agent });
      }
    }
  }
  const sorted = (m: Map<string, Agg>) => [...m.entries()].sort((a, b) => b[1].regret / b[1].n - a[1].regret / a[1].n);
  const md = [
    `# Match review — ${NAME} (${reviews.length} games, ${ROLLOUTS} play-outs per candidate${COACH ? ', coach checked on every decision' : ''})`,
    '',
    `Accuracy = decision within ${NOISE} eval points (${g40(NOISE)} Gigs) of the oracle's best. Blunder = more than ${BLUNDER} points (${g40(BLUNDER)} Gigs) lost.`,
    `Replays matching their recorded result: ${reviews.length - replayMismatch}/${reviews.length}. Review time ${(ms / Math.max(1, reviews.length) / 1000).toFixed(1)} s per game (single thread).`,
    '',
    '## By bot',
    '',
    ...HEAD,
    ...[...byAgent.entries()].map(([k, a]) => row(k, a)),
    '',
    '## Winners vs losers',
    '',
    ...HEAD,
    row('Winning side', winLose.win),
    row('Losing side', winLose.lose),
    '',
    '## By decision type (costliest first)',
    '',
    ...HEAD,
    ...sorted(byCat).map(([k, a]) => row(k, a)),
    '',
    '## By bot and decision type (costliest 12)',
    '',
    ...HEAD,
    ...sorted(byAgentCat)
      .filter(([, a]) => a.n >= 15)
      .slice(0, 12)
      .map(([k, a]) => row(k, a)),
  ];
  if (coach.n) {
    md.push(
      '',
      '## Coach vs oracle',
      '',
      `The coach agreed with the oracle on **${pc(coach.agree / coach.n)}** of ${coach.n} decisions (the bots that actually played: ${pc(coach.botAgree / coach.n)}). Average Gigs lost if you followed the coach: ${g40(coach.regret / coach.n)}.`,
      '',
      '| Decision type | n | Coach accuracy | Coach Gigs lost | Bots\' Gigs lost |',
      '|---|---|---|---|---|',
      ...[...coach.byCat.entries()]
        .sort((a, b) => b[1].regret / b[1].n - a[1].regret / a[1].n)
        .map(([k, c]) => `| ${k} | ${c.n} | ${pc(c.agree / c.n)} | ${g40(c.regret / c.n)} | ${g40(c.bot / c.n)} |`),
    );
  }
  md.push(
    '',
    '## Decks that misplay most (≥ 60 decisions)',
    '',
    ...HEAD,
    ...sorted(byDeck)
      .filter(([, a]) => a.n >= 60)
      .slice(0, 10)
      .map(([k, a]) => row(k, a)),
    '',
    '## Costliest decisions',
    '',
    '| Turn | Deck (bot) | Type | Played | Oracle preferred | Gigs lost |',
    '|---|---|---|---|---|---|',
    ...worst
      .sort((a, b) => b.regret - a.regret)
      .slice(0, 15)
      .map((d) => `| ${d.turn} | ${d.deck} (${d.agent}) | ${d.category} | ${d.chosen} | ${d.best} | ${g40(d.regret)} |`),
  );
  // calibration vs real results: does the side that lost more Gigs (by the reviewer) actually lose the game?
  // Fit P(seat 0 wins) = σ(a + b·mistakeGap + c·ratingGap) over games where both seats were reviewed:
  //   mistakeGap = Gigs lost by seat 1 − Gigs lost by seat 0 (by the reviewer), ratingGap = power rating of deck 0 − deck 1.
  // The deck-strength term keeps "this deck is just better" from hiding (or faking) the effect of mistakes.
  const R = fs.existsSync('src/data/ratings.json') ? (JSON.parse(fs.readFileSync('src/data/ratings.json', 'utf8')).decks as { name: string; rating: number }[]) : [];
  const rating = new Map(R.map((d) => [d.name, d.rating]));
  const pts: { x: number[]; y: number }[] = [];
  for (const { review: r } of reviews) {
    if (r!.seats.length < 2 || r!.winner === null || r!.winner === 'tie') continue;
    const lost = (p: number) => r!.decisions.filter((d) => d.player === p).reduce((a, d) => a + d.regret, 0) / 40;
    pts.push({ x: [1, lost(1) - lost(0), (rating.get(r!.names[0]) ?? 0) - (rating.get(r!.names[1]) ?? 0)], y: r!.winner === 0 ? 1 : 0 });
  }
  /** Logistic regression by Newton steps (small, dense). */
  const fit = (cols: number[]) => {
    const k = cols.length;
    let w = new Array(k).fill(0);
    for (let it = 0; it < 60; it++) {
      const g = new Array(k).fill(0);
      const H = Array.from({ length: k }, () => new Array(k).fill(0));
      for (const { x, y } of pts) {
        const z = cols.reduce((a, c, i) => a + w[i] * x[c], 0);
        const p = 1 / (1 + Math.exp(-z));
        for (let i = 0; i < k; i++) {
          g[i] += (y - p) * x[cols[i]];
          for (let j = 0; j < k; j++) H[i][j] += p * (1 - p) * x[cols[i]] * x[cols[j]];
        }
      }
      for (let i = 0; i < k; i++) H[i][i] += 1e-6;
      // solve H·step = g (Gaussian elimination)
      const A = H.map((row, i) => [...row, g[i]]);
      for (let i = 0; i < k; i++) {
        let piv = i;
        for (let r = i + 1; r < k; r++) if (Math.abs(A[r][i]) > Math.abs(A[piv][i])) piv = r;
        [A[i], A[piv]] = [A[piv], A[i]];
        for (let r = 0; r < k; r++) {
          if (r === i) continue;
          const f = A[r][i] / A[i][i];
          for (let c = i; c <= k; c++) A[r][c] -= f * A[i][c];
        }
      }
      w = w.map((v, i) => v + A[i][k] / A[i][i]);
    }
    return w;
  };
  if (pts.length >= 20) {
    let concord = 0;
    for (const p of pts) concord += p.x[1] === 0 ? 0.5 : (p.x[1] > 0) === (p.y === 1) ? 1 : 0;
    const only = fit([0, 1]);
    const both = fit([0, 1, 2]);
    const allD = reviews.flatMap(({ review: r }) => r!.decisions);
    const avg = allD.reduce((x, d) => x + d.regret, 0) / Math.max(1, allD.length) / 40;
    const perGig = both[1] / 4; // win-probability slope per Gig of mistakes, at even odds, with deck strength held fixed
    md.push(
      '',
      '## Calibration against real results',
      '',
      `Over ${pts.length} reviewed games, the side the reviewer says lost fewer Gigs to mistakes won **${pc(concord / pts.length)}** of the time.`,
      `Mistakes alone: each Gig of extra mistakes costs about ${((only[1] / 4) * 100).toFixed(1)} points of win chance.`,
      `Holding deck strength fixed (power ratings): each Gig of extra mistakes costs about **${(perGig * 100).toFixed(1)} points of win chance**; one point of rating gap is worth ${((both[2] / 4) * 100).toFixed(1)} points.`,
      `An average decision here (${avg.toFixed(2)} Gigs lost) therefore costs about ${(avg * perGig * 100).toFixed(2)} points of win chance.`,
    );
  }
  // validation: planted random moves vs the bot's own moves
  const planted = { rnd: [] as number[], bot: [] as number[] };
  for (const { review: r, meta } of reviews) {
    const flags = (meta as { chaos?: boolean[][] } | undefined)?.chaos;
    if (!Array.isArray(flags)) continue;
    for (const p of [0, 1] as const) {
      const ds = r!.decisions.filter((d) => d.player === p);
      ds.forEach((d, k) => (flags[p][k] ? planted.rnd : planted.bot).push(d.regret));
    }
  }
  if (planted.rnd.length) {
    const mean = (xs: number[]) => xs.reduce((a, x) => a + x, 0) / Math.max(1, xs.length);
    const share = (xs: number[], f: (x: number) => boolean) => xs.filter(f).length / Math.max(1, xs.length);
    // AUC: chance a planted random move scores worse than one of the bot's own moves
    let auc = 0;
    for (const a of planted.rnd) for (const b of planted.bot) auc += a > b ? 1 : a === b ? 0.5 : 0;
    auc /= planted.rnd.length * planted.bot.length;
    md.push(
      '',
      '## Validation: planted random moves',
      '',
      '| | Moves | Avg Gigs lost | Flagged inaccurate (> noise) | Flagged blunder |',
      '|---|---|---|---|---|',
      `| Random moves (planted) | ${planted.rnd.length} | ${g40(mean(planted.rnd))} | ${pc(share(planted.rnd, (x) => x > NOISE))} | ${pc(share(planted.rnd, (x) => x > BLUNDER))} |`,
      `| The bot's own moves | ${planted.bot.length} | ${g40(mean(planted.bot))} | ${pc(share(planted.bot, (x) => x > NOISE))} | ${pc(share(planted.bot, (x) => x > BLUNDER))} |`,
      '',
      `Separation (AUC): a planted random move scores worse than a bot move **${pc(auc)}** of the time (50% = no better than chance).`,
    );
  }
  return md.join('\n');
}

async function main() {
  console.log(`Reviewing ${jobs.length} games (${FROM}), ${ROLLOUTS} play-outs per candidate, ${THREADS} threads${COACH ? ', with coach' : ''}`);
  const done = await run();
  fs.mkdirSync('data/reviews', { recursive: true });
  fs.writeFileSync(`data/reviews/${NAME}.json`, JSON.stringify(done.map((d) => ({ id: d.id, meta: d.meta, review: d.review, error: d.error }))));
  const md = aggregate(done);
  fs.writeFileSync(`reports/review-${NAME}.md`, md);
  console.log(md);
}
main();
