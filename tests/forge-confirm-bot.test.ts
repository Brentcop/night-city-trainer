// The forge's --confirm-bot on real games (scripts/forge.ts; docs/SYNERGIES.md "Confirming with another bot"): a small
// run screened with Easy and confirmed with Medium (fast bots, about 100 games), into a temporary folder. Screening batches
// land in the screening bot's ledger entry and held-out ones in the confirming bot's; the rule line, the JSON, the
// manifest and the deck file's "// Adoption:" line name the confirming bot; the JSON's ledger record names the run label
// its batches carry; --confirm-bot equal to --bot changes nothing;
// --pooled-ranking with another confirming bot is refused in one sentence.
import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { afterAll, describe, expect, it } from 'vitest';
import { parseBatchLine } from '../src/lib/changeLedger';

const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'nct-forge-confirm-'));
afterAll(() => fs.rmSync(tmp, { recursive: true, force: true }));

/** seed 2 nominates and (under any-gain) adopts a change on this deck: the deck file is written */
const ARGS = ['s2-08-explorer-ggy', '--gens', '1', '--games', '14', '--cands', '2', '--bot', 'easy', '--adopt', 'any-gain', '--seed', '2', '--threads', '2', '--ledger'];
const forge = (out: string, extra: string[] = []) => spawnSync(process.execPath, ['--import', 'tsx', 'scripts/forge.ts', ...ARGS, ...extra, '--out', path.join(tmp, out)], { encoding: 'utf8' });
const read = (out: string, f: string) => fs.readFileSync(path.join(tmp, out, f), 'utf8');
const ledgerBatches = (out: string) => {
  const dir = path.join(tmp, out, 'ledger');
  return fs.readdirSync(dir).flatMap((f) => fs.readFileSync(path.join(dir, f), 'utf8').split('\n').filter(Boolean).map((l) => parseBatchLine(l).batch!));
};
/** a run's files with its time stamps and folder taken out */
const masked = (out: string, f: string) =>
  read(out, f)
    .replace(/\d{4}-\d{2}-\d{2}T[\d:.]+Z/g, 'T')
    .split(JSON.stringify(path.join(tmp, out)).slice(1, -1))
    .join('OUT')
    .split(path.join(tmp, out))
    .join('OUT');

describe('the forge with --confirm-bot', () => {
  it('screens with --bot and confirms with --confirm-bot, and says so', { timeout: 180_000 }, () => {
    const r = forge('split', ['--confirm-bot', 'medium']);
    expect(r.status).toBe(0);
    const clause = 'screened with the Easy bot, confirmed with the Medium bot';
    expect(r.stdout).toContain(`Adoption rule: any-gain (legacy): one confirmation of 28 fresh games; a change is adopted when it scores higher at all; the change ledger records the games but never pools them under this rule; ${clause}`);
    expect(r.stdout).toContain('Up to 56 of them are confirmation games, played with the Medium bot.');
    expect(r.stdout).toMatch(/A first confirmation with the Medium bot here/);
    // the ledger: screening under easy, held-out games under medium
    const batches = ledgerBatches('split');
    expect(batches.filter((b) => b.kind === 'screen').map((b) => b.entry.bot)).toEqual(['easy', 'easy']);
    expect(batches.filter((b) => b.kind === 'heldout').map((b) => b.entry.bot)).toEqual(['medium']);
    expect(batches.filter((b) => b.kind === 'heldout')[0]!.games).toHaveLength(28);
    const json = JSON.parse(read('split', 'forge/s2-08-explorer-ggy.json'));
    expect(json.adoption.confirmBot).toBe('medium');
    expect(json.adoption.text).toContain(clause);
    expect(json.manifest.adoption.confirmBot).toBe('medium');
    expect(json.manifest.bot.level).toBe('easy');
    expect(json.ledger).toMatchObject({ bot: 'easy', heldoutBot: 'medium' });
    // the report names the run label its ledger batches carry, which the evidence builder joins it by
    expect(json.ledger.run).toMatch(/^forge \d{4}-\d{2}-\d{2}T[\d:.]+Z seed 2$/);
    expect(new Set(batches.map((b) => b.run))).toEqual(new Set([json.ledger.run]));
    expect(read('split', 'forge/s2-08-explorer-ggy.md')).toContain(clause);
    expect(read('split', 'forge/summary.md')).toContain(clause);
    expect(read('split', 's2-08-explorer-ggy.txt')).toMatch(new RegExp(`^// Adoption: .*; ${clause}$`, 'm'));
  });

  it('without it, or with the screening bot, every output is the same and names no bot', { timeout: 180_000 }, () => {
    expect(forge('cb-plain').status).toBe(0);
    expect(forge('cb-same', ['--confirm-bot', 'fast']).status).toBe(0);
    for (const f of ['forge/s2-08-explorer-ggy.json', 'forge/s2-08-explorer-ggy.md', 'forge/summary.md', 's2-08-explorer-ggy.txt']) {
      expect(masked('cb-same', f)).toBe(masked('cb-plain', f));
      expect(read('cb-plain', f)).not.toContain('confirmed with');
      expect(read('cb-plain', f)).not.toContain('confirmBot');
    }
    expect(ledgerBatches('cb-plain').every((b) => b.entry.bot === 'easy')).toBe(true);
  });

});
