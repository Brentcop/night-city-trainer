// The provenance block (src/ui/components/Provenance.tsx: the deck page, the deck editor, the guides): a long source
// link is shown cut, with the whole address kept in the href and the title. A deck imported from a
// cyberpunk-tcg-sim.online deck-builder link carries its whole list in that address; shown in full it made the deck
// page 649 px wide on a 375 px phone (2026-11-16).
import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import { LINK_TEXT_MAX, linkText, ProvenanceBlock } from '../src/ui/components/Provenance';
import { BUILTIN } from '../src/lib/browserLibrary';

const LONG = `https://cyberpunk-tcg-sim.online/deck-builder/?deck=${Array.from({ length: 30 }, (_, i) => `cb-a-made-up-card-number-${i}:3`).join(',')}&type=cyberpunk`;

describe('a link’s visible text', () => {
  it('drops the scheme and leaves a short address whole', () => {
    expect(linkText('https://choom.gg/decks/d9688e23-eb69-4bc0-b52e-bc9e728d9d15')).toBe('choom.gg/decks/d9688e23-eb69-4bc0-b52e-bc9e728d9d15');
    expect(linkText('http://example.com')).toBe('example.com');
  });

  it('cuts a long address to the cap, ending in …', () => {
    const t = linkText(LONG);
    expect([...t].length).toBe(LINK_TEXT_MAX);
    expect(t.endsWith('…')).toBe(true);
    expect(t.startsWith('cyberpunk-tcg-sim.online/deck-builder/?deck=cb-a-made-up-card-number-0')).toBe(true);
    expect(linkText(LONG, Infinity)).toBe(LONG.replace('https://', ''));
  });
});

describe('the provenance block', () => {
  it('shows a long source link cut, with the whole address in the href and the title', () => {
    const html = renderToStaticMarkup(<ProvenanceBlock prov={{ origin: 'Imported from cyberpunk-tcg-sim.online (placed 1st)', author: 'Player One', source: LONG }} />);
    const a = html.match(/<a [^>]*>([^<]*)<\/a>/)!;
    expect(a[0]).toContain(`href="${LONG.replace(/&/g, '&amp;')}"`);
    expect(a[0]).toContain(`title="${LONG.replace(/&/g, '&amp;')}"`);
    expect([...a[1]!].length).toBe(LINK_TEXT_MAX);
    // the long address is in the two attributes only, never in the text
    expect(html.split('cb-a-made-up-card-number-29').length - 1).toBe(2);
  });

  it('leaves a short source link as it was, with no title', () => {
    const html = renderToStaticMarkup(<ProvenanceBlock prov={{ origin: 'choom.gg community guide', author: 'Someone', source: 'https://choom.gg/decks/abc' }} />);
    expect(html).toContain('<a href="https://choom.gg/decks/abc" target="_blank" rel="noreferrer">choom.gg/decks/abc</a>');
  });

  it('every library deck’s source link fits: the imported lists’ long ones are cut', () => {
    const long = BUILTIN.filter((d) => (d.prov.source ?? '').length > LINK_TEXT_MAX + 8);
    // the lists imported from deck-builder links are the long ones
    expect(long.length).toBeGreaterThanOrEqual(18);
    for (const d of BUILTIN) if (d.prov.source) expect([...linkText(d.prov.source)].length, d.file).toBeLessThanOrEqual(LINK_TEXT_MAX);
  });

  it('no value of the block can widen the page: the grid’s cells break anywhere', () => {
    const css = fs.readFileSync(path.resolve(__dirname, '../src/ui/styles.css'), 'utf8');
    expect(css).toMatch(/\.kv > \* \{[^}]*overflow-wrap: anywhere;[^}]*\}/);
  });
});
