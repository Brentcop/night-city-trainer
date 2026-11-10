// Everything the deck breeder learns from past test runs, gathered in one place:
//   strength   — per-deck strength: power rating (tournament series) blended with the season leaderboard, discounted by uncertainty
//   deckImpact — per-deck card impact ("Δ when drawn"), pooled from the review telemetry and every season round robin
//   h2h        — head-to-head game records from every recorded tournament event
//   bosses     — the decks to beat (top of the strength list)
import fs from 'node:fs';
import type { DeckReport } from '../src/analysis/analyze';

const DECK_IMPACT_FILE = 'data/seasons/deck-impact.json';
type Acc = Record<string, Record<string, { s: number; n: number }>>;

/** Add season telemetry to the pooled per-deck card impact. */
export function recordDeckImpact(reps: DeckReport[]) {
  const acc: Acc = fs.existsSync(DECK_IMPACT_FILE) ? JSON.parse(fs.readFileSync(DECK_IMPACT_FILE, 'utf8')) : {};
  for (const r of reps)
    for (const c of r.cards) {
      if (typeof c.iwd !== 'number' || !Number.isFinite(c.iwd) || !c.seenGames) continue;
      const d = (acc[r.deck] ??= {});
      d[c.id] ??= { s: 0, n: 0 };
      d[c.id].s += c.iwd * c.seenGames;
      d[c.id].n += c.seenGames;
    }
  fs.writeFileSync(DECK_IMPACT_FILE, JSON.stringify(acc));
}

/** Per-deck card impact, needing at least `min` games where the card was drawn. */
export function loadDeckImpact(min = 25): Record<string, Record<string, number>> {
  const acc: Acc = fs.existsSync(DECK_IMPACT_FILE) ? JSON.parse(fs.readFileSync(DECK_IMPACT_FILE, 'utf8')) : {};
  // the original review telemetry counts too
  if (fs.existsSync('src/data/analysis.json'))
    for (const r of JSON.parse(fs.readFileSync('src/data/analysis.json', 'utf8')).decks as DeckReport[])
      for (const c of r.cards) {
        if (typeof c.iwd !== 'number' || !Number.isFinite(c.iwd) || !c.seenGames) continue;
        const d = (acc[r.deck] ??= {});
        d[c.id] ??= { s: 0, n: 0 };
        d[c.id].s += c.iwd * c.seenGames;
        d[c.id].n += c.seenGames;
      }
  return Object.fromEntries(Object.entries(acc).map(([deck, cards]) => [deck, Object.fromEntries(Object.entries(cards).filter(([, v]) => v.n >= min).map(([id, v]) => [id, v.s / v.n]))]));
}

export type H2H = (a: string, b: string) => { w: number; g: number };
/** Head-to-head records from every recorded tournament event (ties count half). */
export function loadH2H(): H2H {
  const m = new Map<string, { w: number; g: number }>();
  const dir = 'data/tournaments';
  if (fs.existsSync(dir))
    for (const f of fs.readdirSync(dir).filter((x) => /^event-\d+\.json$/.test(x))) {
      const e = JSON.parse(fs.readFileSync(`${dir}/${f}`, 'utf8'));
      for (const part of [...e.rounds, ...e.bracket])
        for (const mt of part.matches) {
          if (!mt.b) continue;
          for (const g of mt.games) {
            const v = g.winner === 'tie' ? 0.5 : g.winner === 0 ? 1 : 0;
            for (const [x, y, s] of [
              [mt.a, mt.b, v],
              [mt.b, mt.a, 1 - v],
            ] as [string, string, number][]) {
              const k = `${x}|${y}`;
              const r = m.get(k) ?? { w: 0, g: 0 };
              r.w += s;
              r.g++;
              m.set(k, r);
            }
          }
        }
    }
  return (a, b) => m.get(`${a}|${b}`) ?? { w: 0, g: 0 };
}

/**
 * Deck strength for parent selection. Power ratings (every deck vs every deck, Bradley–Terry) are the best signal when
 * a deck has enough tournament games; the season leaderboard (vs the meta) fills in the rest. Uncertain decks are
 * pulled toward 50% so a lucky small sample doesn't breed the next generation.
 */
export function strengthOf(leaderboard: Record<string, number>): Record<string, number> {
  const R = fs.existsSync('src/data/ratings.json') ? JSON.parse(fs.readFileSync('src/data/ratings.json', 'utf8')) : { decks: [] };
  const out: Record<string, number> = { ...leaderboard };
  for (const d of R.decks as { name: string; wrField: number; wrFieldLo: number; wrFieldHi: number; games: number }[]) {
    if (!(d.games >= 20) || !Number.isFinite(d.wrField)) continue;
    const half = Math.max(0, (d.wrFieldHi - d.wrFieldLo) / 2);
    const rated = d.wrField - 0.5 * half; // conservative: half-way to the lower bound
    out[d.name] = d.name in leaderboard ? 0.65 * rated + 0.35 * leaderboard[d.name] : rated;
  }
  return out;
}
