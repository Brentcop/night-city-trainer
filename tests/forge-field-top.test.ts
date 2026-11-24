// The forge's --field-top N (scripts/forge.ts; src/lib/tuningField.ts; docs/SYNERGIES.md "Reference and field"): the
// field is the 7 meta decks and the library's top N lists by rating, one entry per list, which the season passes on with
// its own --field-top. A tiny Easy run into a temporary folder: the field the report names, the manifest's field mode and
// deck ids, and the ledger's field key (a new field starts new ledger entries). --field-top with --field all is refused.
import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { afterAll, describe, expect, it } from 'vitest';
import { loadLibrary } from '../scripts/lib-node';
import { RATINGS } from '../src/data/index';
import { parentStrength, rankParents } from '../src/lib/parentStrength';
import { tuningField } from '../src/lib/tuningField';
import { parseBatchLine } from '../src/lib/changeLedger';

const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'nct-forge-field-'));
afterAll(() => fs.rmSync(tmp, { recursive: true, force: true }));
const forge = (args: string[]) => spawnSync(process.execPath, ['--import', 'tsx', 'scripts/forge.ts', 's2-08-explorer-ggy', ...args], { encoding: 'utf8' });

describe('the forge with --field-top', () => {
  it('plays the meta decks and the top lists by rating, and names that field in its report, manifest and ledger', { timeout: 180_000 }, () => {
    const lib = loadLibrary();
    const want = tuningField(lib, rankParents(parentStrength(RATINGS.decks), lib), 2).field.map((d) => d.deck.name);
    expect(want).toHaveLength(9);
    const out = path.join(tmp, 'top');
    const r = forge(['--gens', '1', '--games', '9', '--cands', '1', '--bot', 'easy', '--adopt', 'any-gain', '--seed', '2', '--threads', '2', '--field-top', '2', '--ledger', '--out', out]);
    expect(r.status, r.stderr).toBe(0);
    const json = JSON.parse(fs.readFileSync(path.join(out, 'forge', 's2-08-explorer-ggy.json'), 'utf8'));
    expect(json.field).toBe(`${want.join(', ')} · bot easy · 9 games per test`);
    expect(json.manifest.field.mode).toBe('meta+top2');
    expect(json.manifest.field.deckIds).toHaveLength(9);
    // the ledger's entries carry the field (a fingerprint of its lists): the meta-only field's are another key
    const lines = fs.readdirSync(path.join(out, 'ledger')).flatMap((f) => fs.readFileSync(path.join(out, 'ledger', f), 'utf8').split('\n').filter(Boolean));
    const fields = new Set(lines.map((l) => parseBatchLine(l).batch!.entry.field));
    expect(fields.size).toBe(1);
    expect(json.ledger.field).toBe([...fields][0]);
  });

  it('is refused with --field all (exit 2) before anything is played', () => {
    const r = forge(['--field', 'all', '--field-top', '2', '--bot', 'easy']);
    expect(r.status).toBe(2);
    expect(r.stderr).toMatch(/--field-top adds the library's top lists to the meta field; it does not go with --field all/);
  });
});
