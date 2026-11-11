// APP-14 / APP-15: the pick-one lists on the Guides, Card stats and deck editor pages are real buttons (so Tab reaches
// them and Enter/Space activate them natively), the shown item is marked aria-current, and no link wraps a button.
// Rendered to static HTML: there is no DOM here, so key presses themselves aren't simulated.
import { describe, expect, it } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import { GuidesPage } from '../src/ui/pages/Guides';
import { InsightsPage } from '../src/ui/pages/Insights';
import { DecksPage } from '../src/ui/pages/Decks';
import { GUIDES } from '../src/content/guides';
import { BUILTIN } from '../src/lib/browserLibrary';

const sideItems = (html: string) => [...html.matchAll(/<(\w+)[^>]*class="side-item"[^>]*>/g)].map((m) => m[0]);
const decode = (s: string) => s.replace(/&amp;/g, '&').replace(/&quot;/g, '"').replace(/&#x27;/g, "'").replace(/&lt;/g, '<').replace(/&gt;/g, '>');

function expectButtonList(html: string, count: number) {
  const items = sideItems(html);
  expect(items.length).toBe(count);
  for (const tag of items) expect(tag.startsWith('<button type="button"')).toBe(true);
  expect(items.filter((t) => t.includes('aria-current="true"')).length).toBe(1);
  expect(html).not.toMatch(/<a\b[^>]*>\s*<button/);
  expect(html).not.toMatch(/<div[^>]*onclick/i);
}

describe('pick-one lists are keyboard-operable buttons', () => {
  it('Guides: one button per guide, the open one current', () => {
    const g = GUIDES[1] ?? GUIDES[0];
    const html = renderToStaticMarkup(<GuidesPage initial={g.slug} />);
    expectButtonList(html, GUIDES.length);
    const current = sideItems(html).find((t) => t.includes('aria-current'))!;
    const after = decode(html.slice(html.indexOf(current) + current.length));
    expect(after.slice(0, after.indexOf('</button>'))).toContain(g.title);
  });

  it('Card stats: one button per analysed deck', () => {
    const html = renderToStaticMarkup(<InsightsPage />);
    const n = sideItems(html).length;
    if (n === 0) {
      // no telemetry bundled: the page says so instead of listing decks
      expect(html).toContain('No telemetry yet');
      return;
    }
    expectButtonList(html, n);
  });

  it('Deck editor library: one button per deck, the open deck current', () => {
    const d = BUILTIN[0];
    const html = renderToStaticMarkup(<DecksPage initial={d.file} />);
    expectButtonList(html, BUILTIN.length);
    // links styled as buttons, not buttons inside links
    expect(html).toMatch(/<a class="btn"[^>]*href="#\/play\?d=/);
  });
});
