// Knowledge pack on the site: the search the page runs, in the browser. It fetches nothing until the first search;
// then every part file of the groups that load from the start (site.ts SITE_GROUPS), builds the index, and answers. A
// question that asks for statistics also fetches every part of that kind's group, and the caller searches again once
// it is in (`missing`, `load`). A group counts only when all its parts are in, so a search sees whole groups, never
// part of one. The fetch is passed in (the page gives one that prefixes the site's base URL), so this module stays
// pure (rule M7) and Vitest runs it against the real parts. Questions never leave the browser: only the fixed part
// files are fetched.
import { buildIndex, search, type KbIndex, type SearchResult } from './search';
import { lateShardsFor, parseShard, type SiteManifest } from './site';
import type { KbRecord } from './types';

/** Results shown for a question. */
export const SITE_RESULTS = 8;

type ManifestPart = SiteManifest['parts'][number];

export class SiteSearch {
  /** records by part name */
  private readonly loaded = new Map<string, KbRecord[]>();
  private readonly pending = new Map<string, Promise<void>>();
  private ix: KbIndex | null = null;
  private ixKey = '';
  /** milliseconds the last index build took (shown in no UI; for measurement) */
  lastBuildMs = 0;

  constructor(
    readonly manifest: SiteManifest,
    private readonly fetchText: (url: string) => Promise<string>,
    private readonly now: () => number = () => 0,
  ) {}

  private partsOf(group: string): ManifestPart[] {
    return this.manifest.parts.filter((p) => p.group === group);
  }

  private loadPart(part: ManifestPart): Promise<void> {
    if (this.loaded.has(part.name)) return Promise.resolve();
    let p = this.pending.get(part.name);
    if (!p) {
      p = this.fetchText(part.url).then(
        (text) => {
          this.loaded.set(part.name, parseShard(text, { name: part.name }));
          this.pending.delete(part.name);
        },
        (e: unknown) => {
          this.pending.delete(part.name);
          throw e;
        },
      );
      this.pending.set(part.name, p);
    }
    return p;
  }

  /** Fetch (once) every part of the named groups; a failed part can be tried again, and the parts already in are kept. */
  load(groups: readonly string[]): Promise<void> {
    return Promise.all(
      groups.map((g) => {
        const parts = this.partsOf(g);
        if (!parts.length) return Promise.reject(new Error(`no group ${g}`));
        return Promise.all(parts.map((p) => this.loadPart(p)));
      }),
    ).then(() => undefined);
  }

  /** The groups in manifest order. */
  private get groups(): string[] {
    return [...new Set(this.manifest.parts.map((p) => p.group))];
  }

  /** Load every part of the groups every search needs. */
  ready(): Promise<void> {
    return this.load(this.groups.filter((g) => this.partsOf(g).every((p) => !p.late)));
  }

  /** Whether every part of the groups every search needs is in. */
  get isReady(): boolean {
    return this.manifest.parts.every((p) => p.late || this.loaded.has(p.name));
  }

  /** The groups whose every part is loaded, in manifest order. */
  get loadedGroups(): string[] {
    return this.groups.filter((g) => this.partsOf(g).every((p) => this.loaded.has(p.name)));
  }

  /** The index over every group loaded so far (rebuilt when a group has come in whole since the last one). */
  index(): KbIndex {
    const names = this.loadedGroups;
    const key = names.join(' ');
    if (!this.ix || key !== this.ixKey) {
      const t0 = this.now();
      this.ix = buildIndex(names.flatMap((g) => this.partsOf(g).flatMap((p) => this.loaded.get(p.name)!)));
      this.lastBuildMs = this.now() - t0;
      this.ixKey = key;
    }
    return this.ix;
  }

  /** The late groups this question asks for that are not wholly loaded yet (call after `ready`). */
  missing(query: string): string[] {
    const have = new Set(this.loadedGroups);
    return lateShardsFor(this.index(), query).filter((g) => !have.has(g));
  }

  /** Search what is loaded (call after `ready`). */
  run(query: string, k = SITE_RESULTS): SearchResult {
    return search(this.index(), query, { k });
  }
}
