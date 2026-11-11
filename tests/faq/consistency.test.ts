// Keeps the FAQ conformance matrix (tests/faq/matrix.ts) honest. The structural checks always run; the checks against
// the FAQ itself need the local-only data/raw/official_rules_faq.json and are skipped (not failed) without it.
import fs from 'node:fs';
import { describe, expect, it } from 'vitest';
import { CARDS } from '../../src/engine/cards';
import { FAQ_MATRIX, faqTag, faqVersion, type FaqEntry } from './matrix';

const FAQ_FILE = 'data/raw/official_rules_faq.json';
const STATUSES = ['covered', 'fixed', 'divergence', 'not-applicable', 'pending'];

interface FaqItem {
  id: string;
  scope: 'game' | 'card';
  card: { external_id: string; name: string; slug: string } | null;
}
interface FaqFile {
  updated_at: string;
  items: FaqItem[];
}

const fileCache = new Map<string, string | null>();
const read = (f: string) => {
  if (!fileCache.has(f)) fileCache.set(f, fs.existsSync(f) ? fs.readFileSync(f, 'utf8') : null);
  return fileCache.get(f)!;
};

/** Is the test title on this line (or the call it continues) skipped or a todo? */
function skippedAt(lines: string[], i: number) {
  const around = lines.slice(Math.max(0, i - 2), i + 1).join('\n');
  return /\b(it|test|describe)\.(skip|todo)\b|\bit\.skipIf\b/.test(around);
}

/** Where an entry's test is, and whether it runs: null if it cannot be found. */
function findTest(e: FaqEntry): { file: string; skipped: boolean } | null {
  if (!e.test) return null;
  const [file, title] = e.test.split(' > ');
  const text = read(file);
  if (text === null) return null;
  const needle = title ?? faqTag(e.id);
  const lines = text.split('\n');
  const hits = lines.map((l, i) => (l.includes(needle) ? i : -1)).filter((i) => i >= 0);
  if (!hits.length) return null;
  return { file, skipped: hits.every((i) => skippedAt(lines, i)) };
}

describe('FAQ matrix: structure (no FAQ file needed)', () => {
  it('ids are unique, and so are their 8-character test tags', () => {
    expect(new Set(FAQ_MATRIX.map((e) => e.id)).size).toBe(FAQ_MATRIX.length);
    expect(new Set(FAQ_MATRIX.map((e) => faqTag(e.id))).size).toBe(FAQ_MATRIX.length);
  });

  it('every entry is well formed', () => {
    const cardIds = new Set(CARDS.map((c) => c.id));
    const bad: string[] = [];
    for (const e of FAQ_MATRIX) {
      const why: string[] = [];
      if (!STATUSES.includes(e.status)) why.push(`status ${e.status}`);
      if (e.scope === 'card' && !(e.cardId && cardIds.has(e.cardId))) why.push(`unknown card ${e.cardId}`);
      if (e.scope === 'game' && e.cardId !== null) why.push('a general ruling has no card');
      if (e.status !== 'pending' && !e.paraphrase.trim()) why.push('no paraphrase');
      if (e.paraphrase.includes('\n')) why.push('paraphrase is more than one line');
      if ((e.status === 'divergence' || e.status === 'not-applicable') && !e.note?.trim()) why.push(`${e.status} needs a note`);
      if (why.length) bad.push(`${faqTag(e.id)}: ${why.join(', ')}`);
    }
    expect(bad).toEqual([]);
  });

  it("every 'covered' or 'fixed' entry names a test that exists and runs; a divergence names a skipped or todo test", () => {
    const bad: string[] = [];
    for (const e of FAQ_MATRIX) {
      if (e.status === 'covered' || e.status === 'fixed') {
        const t = findTest(e);
        if (!t) bad.push(`${faqTag(e.id)}: no test found for ${JSON.stringify(e.test)}`);
        else if (t.skipped) bad.push(`${faqTag(e.id)}: its test in ${t.file} is skipped`);
      } else if (e.status === 'divergence') {
        const t = findTest(e);
        if (!t) bad.push(`${faqTag(e.id)}: divergence without a skipped/todo test (${JSON.stringify(e.test)})`);
        else if (!t.skipped) bad.push(`${faqTag(e.id)}: divergence whose test in ${t.file} runs (mark it fixed, or skip it)`);
      }
    }
    expect(bad).toEqual([]);
  });

  it('no ruling is left pending', () => {
    expect(FAQ_MATRIX.filter((e) => e.status === 'pending').map((e) => faqTag(e.id))).toEqual([]);
  });
});

const faq: FaqFile | null = fs.existsSync(FAQ_FILE) ? JSON.parse(fs.readFileSync(FAQ_FILE, 'utf8')) : null;

describe.skipIf(!faq)('FAQ matrix against the local FAQ (data/raw/official_rules_faq.json)', () => {
  const items = faq?.items ?? [];

  it('matches the FAQ version, else lists the rulings that came and went', () => {
    if (faq!.updated_at === faqVersion) return;
    const have = new Set(FAQ_MATRIX.map((e) => e.id));
    const now = new Set(items.map((i) => i.id));
    const added = items.filter((i) => !have.has(i.id)).map((i) => i.id);
    const removed = FAQ_MATRIX.filter((e) => !now.has(e.id)).map((e) => e.id);
    expect.fail(
      `The FAQ was updated (${faqVersion} -> ${faq!.updated_at}). New rulings: ${added.length ? added.join(', ') : 'none'}. ` +
        `Removed rulings: ${removed.length ? removed.join(', ') : 'none'}. Triage them in tests/faq/matrix.ts (re-check rulings whose ` +
        `text may have changed), then set FAQ_VERSION in src/lib/rulesVersions.ts to ${faq!.updated_at}.`,
    );
  });

  it('every FAQ ruling appears in the matrix exactly once, and the matrix names no unknown ruling', () => {
    const count = new Map<string, number>();
    for (const e of FAQ_MATRIX) count.set(e.id, (count.get(e.id) ?? 0) + 1);
    const now = new Set(items.map((i) => i.id));
    expect(items.filter((i) => count.get(i.id) !== 1).map((i) => `${i.id} x${count.get(i.id) ?? 0}`)).toEqual([]);
    expect(FAQ_MATRIX.filter((e) => !now.has(e.id)).map((e) => e.id)).toEqual([]);
  });

  it("each entry's scope and card match the FAQ item (cards mapped by external id, else by name)", () => {
    const byEid = new Map(CARDS.filter((c) => c.eid).map((c) => [c.eid!, c.id]));
    const byName = new Map(CARDS.map((c) => [c.displayName.toLowerCase(), c.id]));
    const entry = new Map(FAQ_MATRIX.map((e) => [e.id, e]));
    const bad: string[] = [];
    for (const i of items) {
      const e = entry.get(i.id);
      if (!e) continue;
      const cardId = i.card ? (byEid.get(i.card.external_id) ?? byName.get(i.card.name.toLowerCase()) ?? `unmapped:${i.card.name}`) : null;
      if (e.scope !== i.scope || e.cardId !== cardId) bad.push(`${faqTag(i.id)}: matrix ${e.scope}/${e.cardId}, FAQ ${i.scope}/${cardId}`);
    }
    expect(bad).toEqual([]);
  });
});
