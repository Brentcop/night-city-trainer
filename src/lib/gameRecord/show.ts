// The table as it stands just before a line of a record, in plain text (docs/GAME_RECORD.md "Show"): each side's Legends,
// field, Gigs, fixer dice, Eddies, hand, and deck and trash counts, so a person typing a record can check it against the
// video. The record is replayed, and the state copied when the replay first reaches that line (./replay.ts beforeLine:
// the engine has got to the point where the line happens next). Pure.
import { Game } from '../../engine/engine';
import type { CardInst, GameState, PlayerId } from '../../engine/types';
import { seatName } from './describe';
import { reasonCode } from './exporter';
import { eventText, type GameRecord, type RecordLine } from './notation';
import { replayRecord, type ReplayOptions } from './replay';

export type ShowResult = { ok: true; text: string; state: GameState } | { ok: false; message: string };

const none = (xs: string[]) => (xs.length ? xs.join(', ') : '—');

/** The table of a game's state in plain text. `before`: the line it stands before, for the heading; `players`: the header's names. */
export function tableText(s: GameState, before?: RecordLine | null, players?: readonly (string | null)[]): string {
  const g = new Game(s, [
    { name: 'none', decide: () => Promise.reject(new Error('no agents')) },
    { name: 'none', decide: () => Promise.reject(new Error('no agents')) },
  ]);
  const out: string[] = [];
  const where = s.winner !== null ? `the game is over: ${s.winner === 'tie' ? 'a draw' : `${seatName(s.winner)} wins`} (${reasonCode(s.winReason) ?? s.winReason})` : `turn ${s.turn}${s.turn > 0 ? `, ${seatName(s.active)}'s turn` : ', before the first turn'}`;
  out.push(before ? `Before line ${before.line} (“${eventText(before.ev)}”): ${where}.` : `The end of the record: ${where}.`);
  const a = s.attack;
  if (a && !a.ended) out.push(`Attack in progress: ${seatName(a.attackerPlayer)}'s ${g.name(a.attacker)} attacks ${a.targetUnit !== null ? g.name(a.targetUnit) : `${seatName(a.targetGigs ?? 0)}'s Gigs`} (${a.step}).`);
  const marks = (c: CardInst, extra: string[] = []) => {
    const m = [...extra];
    if (c.spent) m.push('spent');
    if (c.lag) m.push('lag');
    for (const u of c.gear) m.push(`with ${g.name(u)}`);
    return m.length ? ` (${m.join(', ')})` : '';
  };
  for (const p of [0, 1] as PlayerId[]) {
    const P = s.players[p];
    out.push('');
    const who = players?.[p];
    out.push(`${seatName(p)}${who ? ` (${who})` : ''}: ${P.name}`);
    const legends = P.legends.map((u) => {
      const c = g.c(u);
      return `${g.name(c)}${marks(c, [c.faceUp ? 'face up' : 'face down'])}`;
    });
    out.push(`  Legends: ${none(legends)}`);
    const field = P.field
      .map((u) => g.c(u))
      .filter((c) => c.host === null)
      .map((c) => `${g.name(c)}${marks(c, g.isUnit(c) ? [`power ${g.power(c)}`, ...(c.goSolo ? ['gone solo'] : [])] : [])}`);
    out.push(`  Field: ${none(field)}`);
    const gigs = g.gigsOf(p).map((x) => `d${x.sides}=${x.value}${x.owner !== p ? ` (from ${seatName(x.owner)})` : ''}`);
    const cred = g.streetCred(p);
    out.push(`  Gigs: ${none(gigs)}${gigs.length ? ` (${gigs.length} Gig${gigs.length === 1 ? '' : 's'}${cred !== null ? `, Street Cred ${cred}` : ''})` : ''}`);
    out.push(`  Fixer area: ${none(P.fixer.map((id) => `d${g.gig(id).sides}`))}`);
    const spent = P.eddies.filter((u) => g.c(u).spent).length;
    out.push(`  Eddies: ${P.eddies.length}${spent ? ` (${spent} spent)` : ''}`);
    out.push(`  Hand (${P.hand.length}): ${none(P.hand.map((u) => g.name(u)))}`);
    out.push(`  Deck: ${P.deck.length}   Trash: ${P.trash.length}${P.removed.length ? `   Removed: ${P.removed.length}` : ''}`);
  }
  return `${out.join('\n')}\n`;
}

/**
 * The table just before line `line` of the record (the end of the record when it is past the last line). Fails with a
 * sentence when the line is in the header or the setup (the table is laid out once both Legend lines and opening hands
 * are given), or when the replay stops earlier.
 */
export async function showAt(rec: GameRecord, line: number, o: Pick<ReplayOptions, 'seed' | 'resolveDeck'>): Promise<ShowResult> {
  const lines = rec.lines.filter((l) => l.ev.k !== 'note');
  const before = lines.find((l) => l.line >= line) ?? null;
  let setupEnd = 0;
  for (const l of lines) {
    if (l.ev.k !== 'legends' && l.ev.k !== 'hand') break;
    setupEnd = l.line;
  }
  if (before && before.line <= setupEnd)
    return { ok: false, message: `Line ${line} is in the setup: the table is laid out once both players' Legends and opening hands are given (up to line ${setupEnd}); ask for a later line.` };
  // a copy of the state when the replay first reaches the line (hooks off there; the log is not needed)
  const snap: { s: GameState | null } = { s: null };
  const r = await replayRecord(rec, {
    ...o,
    beforeLine: ({ game, line: l }) => {
      if (snap.s || !before || l.line < before.line) return;
      snap.s = structuredClone({ ...game.s, log: [], trace: undefined });
    },
  });
  const players = rec.header.players;
  if (snap.s) return { ok: true, text: tableText(snap.s, before, players), state: snap.s };
  if (r.ok && !before) return { ok: true, text: tableText(r.state!, null, players), state: r.state! };
  return { ok: false, message: `The replay stops before line ${line}${r.stop?.line ? `, at line ${r.stop.line}` : ''}: ${r.stop?.message ?? 'unknown reason'}` };
}
