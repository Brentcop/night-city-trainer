// Every code identifier the contributor notes name must exist in the code (docs/REVIEW_2026-11-24.md §7 and §10 A.2:
// ten claims in the notes and the roadmap had drifted from the code, among them functions that never existed).
//
// Checked: each backticked span of CLAUDE.md, and of the lines of docs/ROADMAP2.md that say an item is done ("Done" or
// "built"), that is one code identifier: camelCase, PascalCase or CONSTANT_CASE, optionally followed by `()`. Skipped:
// paths, flags, dotted names (JSON keys, `Game.clone()`), numbers, quoted strings, plain words, snake_case and anything
// with spaces or punctuation. An identifier passes when it appears as a whole word in a source file under src/, scripts/,
// tests/ or tools/ (TypeScript, JavaScript or Python; this file excepted, so a name written here proves nothing).
//
// A name that is not code (a term the notes use, a field of a file the code builds by other means) goes in ALLOWED with
// the reason; a name that no longer exists is fixed in the document instead.
import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

const ROOT = path.resolve(__dirname, '..');
const CODE_DIRS = ['src', 'scripts', 'tests', 'tools'];
const CODE_EXT = /\.(ts|tsx|mts|cts|js|mjs|cjs|py)$/;
const SELF = path.resolve(__filename);

/** Names the documents may use that are not identifiers in the code, each with why. */
const ALLOWED: Readonly<Record<string, string>> = {
  noUnusedLocals: 'a TypeScript compiler option, set in tsconfig.base.json (CLAUDE.md "Before committing")',
};

/** camelCase (a lower-case start and an upper-case letter later), PascalCase or CONSTANT_CASE (capitals with an underscore). */
const CAMEL = /^[a-z][a-z0-9]*[A-Z][A-Za-z0-9]*$/;
const PASCAL = /^[A-Z][a-z0-9]+[A-Za-z0-9]*$/;
const CONSTANT = /^[A-Z][A-Z0-9]*(_[A-Z0-9]+)+$/;

/** The identifier a backticked span names, or null when the span is not one code identifier. */
function identifierOf(span: string): string | null {
  const s = span.endsWith('()') ? span.slice(0, -2) : span;
  if (!/^[A-Za-z_$][A-Za-z0-9_$]*$/.test(s)) return null;
  return CAMEL.test(s) || PASCAL.test(s) || CONSTANT.test(s) ? s : null;
}

/** Every backticked span of a text (inline code; a fenced block's lines are not inline spans). */
function spans(text: string): string[] {
  const out: string[] = [];
  let fenced = false;
  for (const line of text.split('\n')) {
    if (line.trimStart().startsWith('```')) {
      fenced = !fenced;
      continue;
    }
    if (fenced) continue;
    for (const m of line.matchAll(/`([^`]+)`/g)) out.push(m[1]!);
  }
  return out;
}

function walk(dir: string, out: string[]): void {
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    if (e.name === 'node_modules' || e.name.startsWith('.')) continue;
    const p = path.join(dir, e.name);
    if (e.isDirectory()) walk(p, out);
    else if (CODE_EXT.test(e.name) && path.resolve(p) !== SELF) out.push(p);
  }
}

/** Every word-like token of the code, once. */
function codeWords(): Set<string> {
  const files: string[] = [];
  for (const d of CODE_DIRS) walk(path.join(ROOT, d), files);
  const words = new Set<string>();
  for (const f of files) for (const m of fs.readFileSync(f, 'utf8').matchAll(/[A-Za-z_$][A-Za-z0-9_$]*/g)) words.add(m[0]);
  return words;
}

const read = (f: string) => fs.readFileSync(path.join(ROOT, f), 'utf8').replace(/\r\n/g, '\n');

/** The lines of the roadmap that say an item is done or built. */
const doneLines = (text: string): string => text.split('\n').filter((l) => /\bDone\b|\b[Bb]uilt\b/.test(l)).join('\n');

function missing(text: string, words: Set<string>): string[] {
  const names = new Set(spans(text).map(identifierOf).filter((s): s is string => s !== null));
  return [...names].filter((n) => !words.has(n) && !(n in ALLOWED)).sort();
}

describe('identifiers named in the documents exist in the code', () => {
  const words = codeWords();

  it('reads identifiers, not paths, flags, dotted keys, numbers or words', () => {
    expect(identifierOf('planFor')).toBe('planFor');
    expect(identifierOf('useDeckActions()')).toBe('useDeckActions');
    expect(identifierOf('SIM_VERSION')).toBe('SIM_VERSION');
    expect(identifierOf('CardScript')).toBe('CardScript');
    for (const s of ['src/engine/engine.ts', '--breed-count', 'features.outsideMeta', 'Game.clone()', '308', "'hard'", 'deep', 'site_of', 'npm run evidence', 'ACCEPTED']) expect(identifierOf(s)).toBeNull();
  });

  it('CLAUDE.md', () => {
    expect(missing(read('CLAUDE.md'), words)).toEqual([]);
  });

  it("docs/ROADMAP2.md's done lines", () => {
    expect(missing(doneLines(read('docs/ROADMAP2.md')), words)).toEqual([]);
  });

  it('the allowlist holds only names the code does not have', () => {
    expect(Object.keys(ALLOWED).filter((n) => words.has(n))).toEqual([]);
  });
});
