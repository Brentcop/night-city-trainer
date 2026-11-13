// Nothing a visitor's browser loads by itself may come from another host: every such request shows the visitor's
// address to that host. The typefaces are served from the site (src/ui/fonts.css, files from the @fontsource packages).
// Card art is the one known exception: it is requested from the card database's host at runtime (src/ui/art.ts) and
// can be turned off.
import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

const ROOT = path.resolve(__dirname, '..');
const read = (rel: string) => fs.readFileSync(path.join(ROOT, rel), 'utf8');

/** Every .css file under dir. */
function cssFiles(dir: string): string[] {
  const out: string[] = [];
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, e.name);
    if (e.isDirectory()) out.push(...cssFiles(p));
    else if (e.name.endsWith('.css')) out.push(p);
  }
  return out;
}

describe('no third-party requests on page load', () => {
  it('index.html loads no stylesheet, script, font or preconnect from another host', () => {
    const html = read('index.html');
    const tags = html.match(/<(link|script|img|iframe)\b[^>]*>/g) ?? [];
    expect(tags.length).toBeGreaterThan(0);
    for (const tag of tags) {
      const url = tag.match(/\b(?:href|src)="([^"]*)"/)?.[1] ?? '';
      expect(/^(https?:)?\/\//.test(url), tag.slice(0, 120)).toBe(false);
    }
    expect(html).not.toMatch(/fonts\.googleapis|fonts\.gstatic/);
  });

  it('no stylesheet imports or fetches from another host', () => {
    const files = cssFiles(path.join(ROOT, 'src'));
    expect(files.length).toBeGreaterThan(3);
    for (const f of files) {
      const css = fs.readFileSync(f, 'utf8');
      const rel = path.relative(ROOT, f);
      expect(css, rel).not.toMatch(/@import\s+(url\()?\s*['"]?(https?:)?\/\//);
      expect(css, rel).not.toMatch(/url\(\s*['"]?(https?:)?\/\//);
    }
  });

  it('the font stylesheet covers the weights the styles ask for, from files that exist', () => {
    const css = read('src/ui/fonts.css');
    const faces = [...css.matchAll(/@font-face\s*\{([^}]*)\}/g)].map((m) => m[1]!);
    const seen = new Set<string>();
    for (const face of faces) {
      const family = face.match(/font-family:\s*'([^']+)'/)?.[1];
      const weight = face.match(/font-weight:\s*(\d+)/)?.[1];
      const file = face.match(/url\('([^']+)'\)/)?.[1];
      expect(family && weight && file, face).toBeTruthy();
      expect(face).toMatch(/font-display:\s*swap/);
      expect(face).toMatch(/unicode-range:/);
      // a bare package path, resolved by the build: the file must be in the installed package
      expect(file!.startsWith('@fontsource/')).toBe(true);
      expect(fs.existsSync(path.join(ROOT, 'node_modules', file!)), file).toBe(true);
      seen.add(`${family} ${weight} ${file!.includes('latin-ext') ? 'latin-ext' : 'latin'}`);
    }
    const want: string[] = [];
    for (const [family, weights] of [
      ['Inter', [400, 500, 600]],
      ['Rajdhani', [500, 600, 700]],
    ] as const)
      for (const w of weights) for (const sub of ['latin', 'latin-ext']) want.push(`${family} ${w} ${sub}`);
    expect([...seen].sort()).toEqual(want.sort());
    // the families the styles name are the ones served
    const styles = read('src/ui/styles.css');
    expect(styles).toMatch(/--font:\s*'Inter'/);
    expect(styles).toMatch(/--display:\s*'Rajdhani'/);
    expect(read('src/main.tsx')).toMatch(/import '\.\/ui\/fonts\.css';/);
  });
});
