// Knowledge pack builders: assembling the pack. Ids must be unique; links to records that are not in the pack are
// dropped and listed (a public pack must have none, and a public record never links to a local one, so the public
// records are the same with or without data/raw). Records are sorted by id and written one JSON object per line.
import { byString, KB_KINDS, type KbBuildReport, type KbManifest, type KbRecord } from '../types';
import type { MentionReport } from './mentions';
import { finishRecord } from './record';

/** Bump when the builders make different records from the same inputs (the manifest records it, so caches rebuild). */
export const KB_BUILDER_VERSION = 1;

export function assemblePack(records: readonly KbRecord[], o: { mentions: MentionReport; skipped: Readonly<Record<string, number>> }): { records: KbRecord[]; report: KbBuildReport } {
  const byId = new Map<string, KbRecord>();
  const dupes: string[] = [];
  for (const r of records) {
    if (byId.has(r.id)) dupes.push(r.id);
    byId.set(r.id, r);
  }
  if (dupes.length) throw new Error(`duplicate record ids: ${[...new Set(dupes)].sort(byString).join(', ')}`);
  const dangling: string[] = [];
  const out = [...byId.values()]
    .map((r) => {
      const bad = r.links.filter((l) => {
        const t = byId.get(l.to);
        return !t || (r.scope === 'public' && t.scope === 'local');
      });
      if (!bad.length) return r;
      for (const l of bad) dangling.push(`${r.id} -${l.rel}-> ${l.to}`);
      const { hash: _hash, ...rest } = r;
      return finishRecord({ ...rest, links: r.links.filter((l) => !bad.includes(l)) });
    })
    .sort((a, b) => byString(a.id, b.id));
  const skipped = Object.fromEntries(Object.entries(o.skipped).sort(([a], [b]) => byString(a, b)));
  return { records: out, report: { ...o.mentions, dangling: dangling.sort(byString), skipped } };
}

/** records.jsonl: one record per line, in id order. */
export const packLines = (records: readonly KbRecord[]): string => records.map((r) => JSON.stringify(r)).join('\n') + (records.length ? '\n' : '');

export function parsePackLines(text: string): KbRecord[] {
  return text
    .split('\n')
    .filter((l) => l.trim())
    .map((l, i) => {
      const r = JSON.parse(l) as KbRecord;
      if (typeof r.id !== 'string' || typeof r.text !== 'string' || !Array.isArray(r.links) || !(KB_KINDS as readonly string[]).includes(r.kind)) throw new Error(`records.jsonl line ${i + 1} is not a record`);
      return r;
    });
}

export function countsByKind(records: readonly KbRecord[]): Record<string, number> {
  const c: Record<string, number> = {};
  for (const k of KB_KINDS) {
    const n = records.filter((r) => r.kind === k).length;
    if (n) c[k] = n;
  }
  return c;
}

export function packManifest(records: readonly KbRecord[], o: { report: KbBuildReport; inputs: Readonly<Record<string, string>>; local: boolean; rulesVersion: string | null; faqVersion: string | null; cardDataVersion: string }): KbManifest {
  return {
    kind: 'nct-kb',
    schema: 1,
    builder: KB_BUILDER_VERSION,
    records: records.length,
    counts: countsByKind(records),
    scopes: { public: records.filter((r) => r.scope === 'public').length, local: records.filter((r) => r.scope === 'local').length },
    local: o.local,
    rulesVersion: o.rulesVersion,
    faqVersion: o.faqVersion,
    cardDataVersion: o.cardDataVersion,
    inputs: Object.fromEntries(Object.keys(o.inputs).sort(byString).map((k) => [k, o.inputs[k]!])),
    report: o.report,
  };
}
