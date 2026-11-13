// The card-name matcher (src/lib/cardMentions.ts): longest name first, whole names only, the "Name: Subtitle" form and
// unambiguous short forms, capitals where the name has them, accents and curly quotes folded, the engine's labels, skip
// strings, and a long log read quickly.
import { describe, expect, it } from 'vitest';
import { CARDS } from '../src/engine/cards';
import { buildCardIndex, findMentions, MIN_SHORT, namesWithMentions, splitMentions, type MentionCard } from '../src/lib/cardMentions';

const ix = buildCardIndex(CARDS);
/** The names found, as text, in order. */
const names = (s: string, skip?: string[]) => findMentions(ix, s, skip).map((m) => s.slice(m.start, m.end));
const ids = (s: string) => findMentions(ix, s).map((m) => m.id);

describe('card mention matcher', () => {
  it('finds full names, including the "Name: Subtitle" form, and returns positions in the original string', () => {
    const s = 'Play Goro Takemura: Vengeful Bodyguard (3 €$)';
    const [m] = findMentions(ix, s);
    expect(m).toEqual({ start: 5, end: 38, id: 'goro_takemura_vengeful_bodyguard' });
    expect(names('Corpo Security attacks Hacked Corpo')).toEqual(['Corpo Security', 'Hacked Corpo']);
  });

  it('takes the longest name at a position', () => {
    expect(ids('Delamain Cab')).toEqual(['delamain_cab']);
    expect(ids('Delamain: Rideshare AI')).toEqual(['delamain_rideshare_ai']);
    expect(ids('MaxTac Suppression Team')).toEqual(['maxtac_suppression_team']);
    expect(ids('Jackie Welles: Ride or Die Choom')).toEqual(['jackie_welles_ride_or_die_choom']);
  });

  it('matches whole names only, never inside another word', () => {
    expect(names('Padres and Satoris')).toEqual([]);
    expect(names('XMinotaur, Minotaurs, Minotaur.')).toEqual(['Minotaur']);
    expect(names("Padre's ability")).toEqual(['Padre']);
  });

  it('matches a short form only when one card has it and it is long enough', () => {
    // one card each
    expect(ids('Satori')).toEqual(['satori_sword_of_saburo']);
    expect(ids('Dying Night')).toEqual(['dying_night_v_s_pistol']);
    expect(ids('Delamain')).toEqual(['delamain_rideshare_ai']);
    // more than one card: Goro Takemura (three), Panam Palmer (Legend and Unit), V (three)
    expect(names('Goro Takemura and Panam Palmer')).toEqual([]);
    // the Legend "V" never matches the letter V, nor alone
    expect(names('V is up, and V. wins; Play V: Streetkid')).toEqual(['V: Streetkid']);
    // too short: a made-up card whose short form is three letters
    const tiny: MentionCard[] = [{ id: 'x', name: 'Ace', subname: 'High', displayName: 'Ace: High' }];
    expect(MIN_SHORT).toBeGreaterThan(3);
    expect(findMentions(buildCardIndex(tiny), 'Ace')).toEqual([]);
    expect(findMentions(buildCardIndex(tiny), 'Ace: High')).toHaveLength(1);
  });

  it('needs the capitals the name has, so ordinary phrases are not cards', () => {
    expect(names('take control of the board, then Take Control')).toEqual(['Take Control']);
    expect(names('over the edge, detonate, all is lost')).toEqual([]);
    expect(names('All Is Lost')).toEqual(['All Is Lost']);
  });

  it('folds accents and curly quotes, one character for one', () => {
    expect(ids('Judy Alvarez: Braindance Maestro')).toEqual(['judy_alvarez_braindance_maestro']);
    expect(ids('Judy Álvarez: Braindance Maestro')).toEqual(['judy_alvarez_braindance_maestro']);
    const s = 'Tyger’s Whisper blocks';
    expect(names(s)).toEqual(['Tyger’s Whisper']);
    expect(ids("(Don't Fear) The Reaper")).toEqual(['don_t_fear_the_reaper']);
  });

  it('reads the labels the engine writes', () => {
    expect(names('Sell Corpo Security for an Eddie')).toEqual(['Corpo Security']);
    expect(names('Attack with Minotaur (6) → Riot Shield (2)')).toEqual(['Minotaur', 'Riot Shield']);
    expect(names('Modded Muramasa {Play}')).toEqual(['Modded Muramasa']);
    expect(names('"Floor It", then Floor It!')).toEqual(['Floor It', 'Floor It']);
    expect(names('Equip Mantis Blades to?')).toEqual(['Mantis Blades']);
  });

  it('leaves out matches inside skip strings (deck and player names)', () => {
    expect(names('Satori Control wins: Satori was key', ['Satori Control'])).toEqual(['Satori']);
    expect(namesWithMentions(ix, ['Satori Control', 'Aggro', ''])).toEqual(['Satori Control']);
  });

  it('cuts a string into text and mentions', () => {
    expect(splitMentions(ix, 'no cards here')).toEqual(['no cards here']);
    expect(splitMentions(ix, 'Play Minotaur now')).toEqual(['Play ', { text: 'Minotaur', id: 'minotaur' }, ' now']);
  });

  it('reads a 1,000-line log quickly, and a repeated line from its memo', () => {
    const labels = CARDS.map((c, i) => [`plays ${c.displayName}`, `Sell ${c.displayName} for an Eddie`, `${c.displayName} attacks Corpo Security (${i % 9})`][i % 3]!);
    const log = Array.from({ length: 1000 }, (_, i) => `${labels[i % labels.length]} on turn ${i}`);
    const fresh = buildCardIndex(CARDS);
    const t0 = performance.now();
    let n = 0;
    for (const l of log) n += findMentions(fresh, l).length;
    const ms = performance.now() - t0;
    expect(n).toBeGreaterThan(900);
    expect(ms).toBeLessThan(500);
    expect(findMentions(fresh, log[0]!)).toBe(findMentions(fresh, log[0]!));
  });
});
