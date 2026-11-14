// Knowledge pack on the site: the search the page runs, in the browser. It fetches nothing until the first search;
// then the shards that load from the start (site.ts SITE_SHARDS), builds the index, and answers. A question that asks
// for statistics also fetches that kind's shard, and the caller searches again once it is in (`missing`, `load`).
// The fetch is passed in (the page gives one that prefixes the site's base URL), so this module stays pure (rule M7)
// and Vitest runs it against the real shards. Questions never leave the browser: only the fixed shard files are fetched.
import { buildIndex, search, type KbIndex, type SearchResult } from './search';
import { lateShardsFor, parseShard, type SiteManifest } from './site';
import type { KbRecord } from './types';

/** Results shown for a question. */
export const SITE_RESULTS = 8;

export class SiteSearch {
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

  /** Fetch (once) the named shards; a failed fetch can be tried again. */
  load(names: readonly string[]): Promise<void> {
    return Promise.all(
      names.map((name) => {
        if (this.loaded.has(name)) return Promise.resolve();
        const shard = this.manifest.shards.find((s) => s.name === name);
        if (!shard) return Promise.reject(new Error(`no shard ${name}`));
        let p = this.pending.get(name);
        if (!p) {
          p = this.fetchText(shard.url).then(
            (text) => {
              this.loaded.set(name, parseShard(text, { name }));
              this.pending.delete(name);
            },
            (e: unknown) => {
              this.pending.delete(name);
              throw e;
            },
          );
          this.pending.set(name, p);
        }
        return p;
      }),
    ).then(() => undefined);
  }

  /** Load the shards every search needs. */
  ready(): Promise<void> {
    return this.load(this.manifest.shards.filter((s) => !s.late).map((s) => s.name));
  }

  /** Whether the shards every search needs are in. */
  get isReady(): boolean {
    return this.manifest.shards.every((s) => s.late || this.loaded.has(s.name));
  }

  /** The names of the shards loaded so far, in manifest order. */
  get loadedShards(): string[] {
    return this.manifest.shards.filter((s) => this.loaded.has(s.name)).map((s) => s.name);
  }

  /** The index over every shard loaded so far (rebuilt when a shard has arrived since the last one). */
  index(): KbIndex {
    const names = this.loadedShards;
    const key = names.join(' ');
    if (!this.ix || key !== this.ixKey) {
      const t0 = this.now();
      this.ix = buildIndex(names.flatMap((n) => this.loaded.get(n)!));
      this.lastBuildMs = this.now() - t0;
      this.ixKey = key;
    }
    return this.ix;
  }

  /** The late shards this question asks for that are not loaded yet (call after `ready`). */
  missing(query: string): string[] {
    return lateShardsFor(this.index(), query).filter((n) => !this.loaded.has(n));
  }

  /** Search what is loaded (call after `ready`). */
  run(query: string, k = SITE_RESULTS): SearchResult {
    return search(this.index(), query, { k });
  }
}
