// Colour breakdowns (ROADMAP2 §13 goal 2; src/lib/colorSplit.ts, components/ColorBreakdown.tsx): one deck's split by
// Legends and cards, a set of decks by colour and pill, and the event panel (field and top cut side by side, each colour
// a word beside its dot, the tables in a .scroll-x). Server-rendered: there is no DOM here.
import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import { deckColors } from '../src/engine/deck';
import { BUILTIN } from '../src/lib/browserLibrary';
import { colorCountText, colorsPlayed, comboOf, deckColorSplit, fieldColorSplit } from '../src/lib/colorSplit';
import { eventColors, type RecordedEvent } from '../src/lib/eventFacts';
import { DeckColorLine, EventColorsPanel, FieldColors } from '../src/ui/components/ColorBreakdown';

const ROOT = path.resolve(__dirname, '..');
const R = 'dexter_deshawn_off_the_grid';
const B = 'alt_cunningham_soulkiller_architect';
const G = 'goro_takemura_vengeful_bodyguard';

describe('one deck', () => {
  it('the pill is deckColors; Legends and main-deck cards counted by colour, copies included', () => {
    for (const d of BUILTIN) {
      const s = deckColorSplit(d.deck);
      expect(s.combo).toBe(deckColors(d.deck));
      expect(s.legends.reduce((a, [, n]) => a + n, 0)).toBe(d.deck.legends.length);
      expect(s.cardTotal + s.unknown).toBe(d.deck.main.length);
      expect(s.cards.reduce((a, [, n]) => a + n, 0)).toBe(s.cardTotal);
      expect(s.colors).toEqual(colorsPlayed(d.deck.legends));
    }
    const s = deckColorSplit({ legends: [G, R, R], main: ['all_is_lost', 'all_is_lost', 'peace_offering', 'no_such_card'] });
    expect(s).toMatchObject({ combo: 'RRG', colors: ['R', 'G'], cardTotal: 3, unknown: 1 });
    expect(colorCountText(s.legends)).toBe('Red 2, Green 1');
    expect(colorCountText(s.cards)).toBe('Red 2, Green 1');
    expect(colorCountText([])).toBe('none');
  });
});

describe('a set of decks', () => {
  it('a deck counts once under each colour it plays and once under its pill; all four colours listed', () => {
    const f = fieldColorSplit([{ legends: [R, R, B] }, { legends: [B, R, R] }, { legends: [G, G, G] }]);
    expect(f.decks).toBe(3);
    expect(f.byColor).toEqual([
      { color: 'R', decks: 2 },
      { color: 'B', decks: 2 },
      { color: 'G', decks: 1 },
      { color: 'Y', decks: 0 },
    ]);
    expect(f.byCombo).toEqual([
      { combo: 'RRB', decks: 2 },
      { combo: 'GGG', decks: 1 },
    ]);
    expect(comboOf([B, R, R])).toBe('RRB');
  });
});

describe('rendered', () => {
  it('a deck line names each colour in words', () => {
    const html = renderToStaticMarkup(<DeckColorLine split={deckColorSplit({ legends: [G, R, R], main: ['all_is_lost'] })} />);
    expect(html).toContain('Colours: </span>Legends Red 2, Green 1 · Main deck Red 1');
  });

  it('the field: colours as words beside their dots, and the pills with their counts', () => {
    const html = renderToStaticMarkup(<FieldColors split={fieldColorSplit([{ legends: [R, R, B] }, { legends: [G, G, G] }])} />);
    expect(html).toContain('<span class="dot Red" aria-hidden="true"></span> Red</span> 1');
    expect(html).not.toContain('Yellow');
    expect(html).toContain('<span class="tag">RRB</span> 1');
    expect(renderToStaticMarkup(<FieldColors split={fieldColorSplit([])} />)).toBe('');
  });

  it('an event: field and top cut side by side, by colour and by pill, in scrolling tables', () => {
    const ev = JSON.parse(fs.readFileSync(path.join(ROOT, 'public/tournaments/event-19.json'), 'utf8')) as RecordedEvent;
    const facts = eventColors(ev);
    const html = renderToStaticMarkup(<EventColorsPanel facts={facts} />);
    expect(html).toContain('<h3 style="margin-top:0">Colours</h3>');
    expect(html).toContain(`${facts.entrants} entrants, ${facts.topCut} in the top cut`);
    expect(html).toContain(`<th class="num">Top ${facts.topCut}</th>`);
    for (const w of ['Red', 'Blue', 'Green', 'Yellow']) expect(html).toContain(`<span class="dot ${w}" aria-hidden="true"></span> ${w}`);
    for (const r of facts.byCombo) expect(html).toContain(`<span class="tag">${r.combo}</span>`);
    expect(html.match(/<div class="scroll-x"><table class="color-table">/g)).toHaveLength(2);
    const noCut = renderToStaticMarkup(<EventColorsPanel facts={{ ...facts, topCut: 0 }} />);
    expect(noCut).not.toContain('>Top ');
  });
});
