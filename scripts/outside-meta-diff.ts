// The scheduled refresh's last step (.github/workflows/outside-meta.yml): did src/data/outsideMeta.json change after
// every check passed, and did nothing else change?
//
//   npx tsx scripts/outside-meta-diff.ts [--github-output FILE] [--summary FILE]
//
// Reads `git status --porcelain --untracked-files=all` in the current folder. Prints "changed" or "unchanged"; with
// --github-output FILE also appends changed=true or changed=false to FILE (GitHub's $GITHUB_OUTPUT), and with
// --summary FILE a line for the job summary. The environment variable DRY_RUN=true only changes the summary's words
// (the commit job reads the dry-run input itself).
//
// Exits 0; 1 when another path changed as well (a refresh may change the data file alone, so nothing is committed);
// 2 on a bad command line.
import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import { cli, str } from './lib-node';
import { diffVerdict } from './outside-meta-diff-run';

const { values: V } = cli(import.meta.url, { 'github-output': str(), summary: str() });
const status = execFileSync('git', ['status', '--porcelain', '--untracked-files=all'], { encoding: 'utf8' });
const verdict = diffVerdict(status, process.env.DRY_RUN === 'true');
console.log(verdict.changed ? 'changed' : 'unchanged');
for (const p of verdict.others) console.error(`error: ${p} changed too; a refresh may change the data file alone.`);
if (V['github-output']) fs.appendFileSync(V['github-output'], `changed=${verdict.changed}\n`);
if (V.summary) fs.appendFileSync(V.summary, `${verdict.summary.join('\n')}\n\n`);
process.exit(verdict.others.length ? 1 : 0);
