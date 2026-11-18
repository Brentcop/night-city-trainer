// The logic of scripts/outside-meta-diff.ts (the scheduled refresh's last step, .github/workflows/outside-meta.yml): from
// `git status --porcelain`, whether the data file changed and whether anything else did. Pure, so the tests hand it text.
import { OUTSIDE_FILE } from '../src/lib/outsideMeta';

export interface DiffVerdict {
  /** the data file is new or modified */
  changed: boolean;
  /** every other path git reports (none may change in a refresh) */
  others: string[];
  /** the job summary's lines */
  summary: string[];
}

/** The paths of `git status --porcelain` output (a rename gives its new path). */
export function porcelainPaths(text: string): string[] {
  return text
    .split('\n')
    .map((l) => l.replace(/\r$/, ''))
    .filter((l) => l.length > 3)
    .map((l) => {
      const p = l.slice(3);
      const arrow = p.indexOf(' -> ');
      return (arrow >= 0 ? p.slice(arrow + 4) : p).replace(/^"(.*)"$/, '$1');
    });
}

export function diffVerdict(porcelain: string, dryRun: boolean, target: string = OUTSIDE_FILE): DiffVerdict {
  const paths = porcelainPaths(porcelain);
  const changed = paths.includes(target);
  const others = paths.filter((p) => p !== target);
  const summary: string[] = [];
  if (others.length) summary.push('### Outside meta: stopped', '', `Only ${target} may change in a refresh, but these changed too: ${others.slice(0, 20).join(', ')}. Nothing is committed.`);
  else if (!changed) summary.push('### Outside meta: no change', '', `${target} is as it was; nothing to commit.`);
  else if (dryRun) summary.push('### Outside meta: dry run', '', `${target} changed (see what changed above) and every check passed; as a dry run, nothing is committed.`);
  else summary.push('### Outside meta: ready to commit', '', `${target} changed (see what changed above) and every check passed; the commit job commits it to main and deploys the site.`);
  return { changed: changed && !others.length, others, summary };
}
