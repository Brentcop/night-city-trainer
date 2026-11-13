// Knowledge pack builders: one place that turns a builder's draft into a stored record, so every record has the same
// key order, sorted aliases, fields, links and stamps, and its content hash (rule M8: same inputs, same bytes).
import { byString, recordHash, type KbFieldValue, type KbLink, type KbRecord, type KbStamps } from '../types';

export type RecordDraft = Omit<KbRecord, 'hash' | 'aliases' | 'fields' | 'stamps' | 'links'> & {
  aliases?: readonly (string | null | undefined)[];
  fields?: Record<string, KbFieldValue | undefined>;
  links?: readonly KbLink[];
  stamps?: { [K in keyof KbStamps]?: KbStamps[K] | undefined };
};

function sortedObject<T>(o: Record<string, T | undefined> | undefined): Record<string, T> | undefined {
  if (!o) return undefined;
  const keys = Object.keys(o).filter((k) => o[k] !== undefined).sort(byString);
  return keys.length ? Object.fromEntries(keys.map((k) => [k, o[k] as T])) : undefined;
}

/** Normalise a draft (trim, sort, de-duplicate) and hash it. */
export function finishRecord(d: RecordDraft): KbRecord {
  const title = d.title.trim();
  const aliases = [...new Set(d.aliases?.map((a) => a?.trim()).filter((a): a is string => !!a && a !== title))].sort(byString);
  const seen = new Set<string>();
  const links = (d.links ?? [])
    .filter((l) => l.to !== d.id && !seen.has(`${l.rel} ${l.to}`) && seen.add(`${l.rel} ${l.to}`))
    .map((l) => ({ rel: l.rel, to: l.to }))
    .sort((a, b) => byString(a.rel, b.rel) || byString(a.to, b.to));
  const fields = sortedObject(d.fields);
  const stamps = sortedObject(d.stamps as Record<string, KbStamps[keyof KbStamps]>) as KbStamps | undefined;
  const text = d.text.replace(/\r\n?/g, '\n').trim();
  const base = {
    id: d.id,
    kind: d.kind,
    title,
    ...(aliases.length ? { aliases } : {}),
    text,
    ...(fields ? { fields } : {}),
    links,
    source: d.source.at ? { file: d.source.file, at: d.source.at } : { file: d.source.file },
    origin: d.origin,
    scope: d.scope,
    ...(d.status ? { status: d.status } : {}),
    ...(stamps ? { stamps } : {}),
  };
  return { ...base, hash: recordHash(base) };
}

/** Links of one type to each id, in order, without repeats. */
export const linksTo = (rel: KbLink['rel'], ids: Iterable<string>): KbLink[] => [...new Set(ids)].map((to) => ({ rel, to }));
