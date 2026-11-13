// Knowledge pack: plain-text and JSON output for search, get and related. Every record shows its id, title, kind, scope,
// origin, status, stamps and source; search shows a snippet of at most 300 characters. Output is cut to a token budget
// (characters divided by 4, a rough rule). A `local` record is labelled local-only: its text comes from data/raw and
// must never be pasted into a tracked file (docs/RAG_PLAN.md rule M6).
import { foldText } from '../cardMentions';
import type { Dossier } from './dossier';
import type { SearchResult } from './search';
import { tokenize } from './text';
import { estimateTokens, type KbRecord } from './types';

export const SNIPPET_MAX = 300;
export const LOCAL_LABEL = 'LOCAL-ONLY: from data/raw, never copy into a tracked file';

/** Up to `max` characters of `text` (whitespace collapsed), starting near the first word of the query it contains. */
export function snippet(text: string, query = '', max = SNIPPET_MAX): string {
  const flat = text.replace(/\s+/g, ' ').trim();
  if (flat.length <= max) return flat;
  const folded = foldText(flat);
  let at = -1;
  for (const t of tokenize(query)) {
    for (let i = folded.indexOf(t); i >= 0; i = folded.indexOf(t, i + 1)) {
      if (i > 0 && /[\p{L}\p{N}]/u.test(folded[i - 1]!)) continue;
      if (at < 0 || i < at) at = i;
      break;
    }
  }
  let start = 0;
  if (at > max / 3) {
    const sentence = flat.lastIndexOf('. ', at);
    start = sentence >= 0 && at - sentence < max / 2 ? sentence + 2 : at - Math.floor(max / 4);
  }
  const lead = start > 0 ? '…' : '';
  const room = max - lead.length - 1;
  const body = flat.slice(start, start + room);
  return lead + body + (start + room < flat.length ? '…' : '');
}

function stampLine(r: KbRecord): string | null {
  const s = Object.entries(r.stamps ?? {}).map(([k, v]) => `${k}=${v}`);
  return s.length ? `stamps: ${s.join(' ')}` : null;
}

/** The header lines every view shares. */
export function recordHeader(r: KbRecord): string[] {
  const tags = [r.kind, r.origin, r.scope, r.status].filter(Boolean).join(' · ');
  const lines = [`${r.id}  ${r.title}`, `  [${tags}]${r.scope === 'local' ? `  ${LOCAL_LABEL}` : ''}`];
  const st = stampLine(r);
  if (st) lines.push(`  ${st}`);
  lines.push(`  source: ${r.source.file}${r.source.at ? `#${r.source.at}` : ''}`);
  return lines;
}

/** Keep whole blocks while they fit in `maxTokens`; a first block that alone is too long is cut. */
export function capBlocks(blocks: readonly string[], maxTokens: number, unit = 'results'): string {
  const RESERVE = 16; // the closing "… more cut" line
  const out: string[] = [];
  let used = 0;
  for (const [i, b] of blocks.entries()) {
    const t = estimateTokens(b) + 1;
    const last = i === blocks.length - 1;
    if (used + t + (last ? 0 : RESERVE) <= maxTokens) {
      out.push(b);
      used += t;
      continue;
    }
    let left = blocks.length - i;
    if (i === 0) {
      out.push(b.slice(0, Math.max(0, (maxTokens - RESERVE) * 4 - 30)) + '… (cut by --max-tokens)');
      left--;
    }
    if (left > 0) out.push(`… ${left} more ${unit} cut by --max-tokens`);
    break;
  }
  return out.join('\n');
}

export function renderSearchText(res: SearchResult, maxTokens = Infinity): string {
  if (res.noMatch) return `no match for "${res.query}"`;
  const blocks = res.hits.map((h, i) => {
    const lines = recordHeader(h.record);
    lines[0] = `${i + 1}. ${lines[0]}`;
    lines.push(`  ${snippet(h.record.text, res.query)}`);
    return lines.join('\n') + '\n';
  });
  return capBlocks(blocks, maxTokens);
}

/** A record as JSON output carries (the snippet in place of the full text unless `full`). */
export function recordJson(r: KbRecord, o: { query?: string; full?: boolean } = {}) {
  return {
    id: r.id,
    title: r.title,
    kind: r.kind,
    scope: r.scope,
    origin: r.origin,
    ...(r.status ? { status: r.status } : {}),
    ...(r.stamps ? { stamps: r.stamps } : {}),
    source: r.source,
    ...(r.scope === 'local' ? { localOnly: true } : {}),
    ...(o.full ? { text: r.text, ...(r.fields ? { fields: r.fields } : {}), links: r.links } : { snippet: snippet(r.text, o.query) }),
  };
}

/** Drop items from the end until the JSON fits; `cut` says how many went. */
export function capJson<T>(make: (items: T[], cut: number) => unknown, items: readonly T[], maxTokens: number): string {
  for (let n = items.length; n >= 0; n--) {
    const s = JSON.stringify(make(items.slice(0, n), items.length - n), null, 2);
    if (estimateTokens(s) <= maxTokens || n === 0) return s;
  }
  return '';
}

export function renderSearchJson(res: SearchResult, maxTokens = Infinity): string {
  const hits = res.hits.map((h) => ({ ...recordJson(h.record, { query: res.query }), score: Number(h.score.toFixed(6)), ranks: h.ranks }));
  return capJson((items, cut) => ({ query: res.query, noMatch: res.noMatch, total: res.total, hits: items, ...(cut ? { cut } : {}) }), hits, maxTokens);
}

/** A record in full: header, fields, text and its own links. */
export function renderRecordText(r: KbRecord): string {
  const lines = recordHeader(r);
  const fields = Object.entries(r.fields ?? {});
  if (fields.length) lines.push(`  fields: ${fields.map(([k, v]) => `${k}=${v}`).join('; ')}`);
  lines.push('', r.text, '');
  if (r.links.length) lines.push(`links: ${r.links.map((l) => `${l.rel}→${l.to}`).join(', ')}`);
  return lines.join('\n') + '\n';
}

export function renderRecordsText(rs: readonly KbRecord[], maxTokens = Infinity): string {
  return capBlocks(rs.map(renderRecordText), maxTokens, 'records');
}

export function renderRecordsJson(rs: readonly KbRecord[], maxTokens = Infinity): string {
  return capJson((items, cut) => ({ records: items, ...(cut ? { cut } : {}) }), rs.map((r) => recordJson(r, { full: true })), maxTokens);
}

const neighbourLine = (r: KbRecord) => `    ${r.id}  ${r.title}${r.scope === 'local' ? '  (local-only)' : ''}`;

/** A dossier: the record with a snippet, then its neighbours by link type. Cut it to a budget with dossier(). */
export function renderDossierText(d: Dossier): string {
  const lines = [...recordHeader(d.record), `  ${snippet(d.record.text)}`, ''];
  for (const g of d.groups) {
    if (!g.records.length && !g.omitted) continue;
    lines.push(`  ${g.rel} (${g.records.length + g.omitted}):`);
    for (const r of g.records) lines.push(neighbourLine(r));
    if (g.omitted) lines.push(`    … ${g.omitted} more cut by --max-tokens`);
  }
  if (!d.groups.length) lines.push('  (no linked records)');
  return lines.join('\n') + '\n';
}

export function renderDossierJson(d: Dossier): string {
  return JSON.stringify(
    {
      record: recordJson(d.record),
      groups: d.groups.map((g) => ({ rel: g.rel, records: g.records.map((r) => ({ id: r.id, title: r.title, kind: r.kind, scope: r.scope })), omitted: g.omitted })),
    },
    null,
    2,
  );
}

/** What renderDossierText costs, for dossier(): the record's part, each group's two lines, each neighbour line. */
export const DOSSIER_COST = {
  baseTokens: (r: KbRecord): number => estimateTokens([...recordHeader(r), `  ${snippet(r.text)}`, ''].join('\n')) + 2,
  groupTokens: 14,
  lineCost: (r: KbRecord): number => estimateTokens(neighbourLine(r)) + 1,
};
