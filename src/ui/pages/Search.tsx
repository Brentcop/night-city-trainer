/// <reference path="../kbSite.d.ts" />
// #/search (feature `search`, off by default; docs/SITE_CONFIG.md): answers a question from the site's knowledge pack,
// entirely in this browser (docs/RAG_PLAN.md step 3; src/lib/kb/site.ts, siteSearch.ts). Nothing is fetched until the
// visitor types: then the two shards every search needs, and a statistics shard only for a question that asks for
// statistics (the results are searched again when it arrives). Results as you type (debounced), up to eight, each with
// what it is, its title linking to where it lives on the site, a short excerpt, and for measured records what they rest
// on, their "association, not value" sentence and a stale mark. No question is sent anywhere or stored.
// This is the one file under src/ui that imports src/lib/kb (tests/kb-guards.test.ts); it is a lazy page of its own.
import { useEffect, useId, useState } from 'react';
import manifest from 'virtual:nct-kb-site';
import type { SearchResult } from '../../lib/kb/search';
import { associationLine, basisLine, isStale, KIND_LABEL, SITE_EXAMPLES, siteExcerpt, siteLink } from '../../lib/kb/site';
import { SiteSearch } from '../../lib/kb/siteSearch';
import type { KbRecord } from '../../lib/kb/types';
import { CardMention, MentionText } from '../components/CardMention';
import { PageHead } from '../components/PageHead';
import '../search.css';

export const SEARCH_DEBOUNCE_MS = 200;

async function fetchShard(url: string): Promise<string> {
  const r = await fetch(`${import.meta.env.BASE_URL}${url}`);
  if (!r.ok) throw new Error(`HTTP ${r.status}`);
  return r.text();
}

// one search per page load: coming back to the page keeps the shards already fetched
let shared: SiteSearch | null = null;
const searcher = () => (shared ??= new SiteSearch(manifest, fetchShard, () => performance.now()));

/** Let the browser paint the "Loading" line before the index is built (a long task of tens of milliseconds). */
const paint = () => new Promise<void>((done) => setTimeout(done, 0));

/** What the page shows: nothing asked yet, the first shards loading, results (maybe with statistics on the way), or a failed load. */
export type SearchView =
  | { status: 'idle' }
  | { status: 'loading'; query: string }
  | { status: 'done'; query: string; result: SearchResult; more: 'loading' | 'failed' | null }
  | { status: 'error'; query: string };

/** The line read out to assistive technology (an aria-live status) and shown under the box. */
export function statusText(view: SearchView): string {
  if (view.status === 'idle') return '';
  if (view.status === 'loading') return 'Loading the search…';
  if (view.status === 'error') return 'The search could not be loaded. Check the connection and try again.';
  const n = view.result.hits.length;
  if (!n) return view.more === 'loading' ? 'Loading the statistics…' : 'Nothing here answers that.';
  const more = view.more === 'loading' ? ', loading the statistics…' : view.more === 'failed' ? '; the statistics could not be loaded.' : '.';
  return `${n} ${n === 1 ? 'result' : 'results'}${more}`;
}

function ResultTitle({ r }: { r: KbRecord }) {
  const link = siteLink(r);
  if (!link) return <>{r.title}</>;
  if (link.to === 'card') return <CardMention id={link.cardId}>{r.title}</CardMention>;
  return <a href={link.href}>{r.title}</a>;
}

/** One result: what it is, its title (a link to its page, or the card), an excerpt, what it rests on and where it lives. */
export function SearchHit({ r, query }: { r: KbRecord; query: string }) {
  const link = siteLink(r);
  const basis = basisLine(r);
  const assoc = associationLine(r);
  return (
    <li className="kb-hit">
      <div className="kb-hit-tags">
        <span className="tag">{KIND_LABEL[r.kind] ?? r.kind}</span>
        {r.status === 'draft' && (
          <span className="tag" title="A draft note: not yet confirmed by the site's owner">
            draft
          </span>
        )}
        {isStale(r) && (
          <span className="tag kb-stale" title="Measured on an older version of the simulator">
            stale
          </span>
        )}
      </div>
      <h2 className="kb-hit-title">
        <ResultTitle r={r} />
      </h2>
      <p className="kb-hit-text">
        <MentionText text={siteExcerpt(r, query)} />
      </p>
      {(basis || assoc) && <p className="small muted kb-hit-basis">{[basis, assoc].filter(Boolean).join(' ')}</p>}
      <p className="small muted kb-hit-where">{!link ? 'Not on a page of its own on this site.' : link.to === 'card' ? 'Opens the card.' : `On the site: ${link.label}.`}</p>
    </li>
  );
}

function Examples({ onPick }: { onPick: (q: string) => void }) {
  return (
    <div className="kb-examples">
      <span className="small muted">Try:</span>
      {SITE_EXAMPLES.map((x) => (
        <button key={x} type="button" className="ghost small" onClick={() => onPick(x)}>
          {x}
        </button>
      ))}
    </div>
  );
}

/** The page for a question and what the search found (SearchPage holds the state; tests render this directly). */
export function SearchScreen({ q, view, onQuery }: { q: string; view: SearchView; onQuery: (q: string) => void }) {
  const id = useId();
  const hits = view.status === 'done' ? view.result.hits : [];
  const noMatch = view.status === 'done' && !hits.length && view.more !== 'loading';
  return (
    <div className="grid">
      <PageHead kicker="Learn" title="Search">
        Ask about a card, a deck and its game plan, a synergy package, a glossary term, a strategy guide, an event, a rating, a matchup
        or the bots’ play statistics. Your questions stay in this browser: the search runs here and sends them nowhere.
      </PageHead>
      <div className="panel kb-search">
        <label htmlFor={`${id}-q`} className="kb-search-label">
          Your question
        </label>
        <input
          id={`${id}-q`}
          type="search"
          className="kb-search-input"
          value={q}
          onChange={(e) => onQuery(e.target.value)}
          placeholder="Which decks play Detonate?"
          autoComplete="off"
          spellCheck={false}
          aria-describedby={`${id}-status`}
        />
        <p id={`${id}-status`} className="small muted kb-search-status" role="status" aria-live="polite">
          {statusText(view)}
        </p>
        {view.status === 'idle' && <Examples onPick={onQuery} />}
      </div>
      {noMatch && (
        <div className="empty-state">
          <p>
            Nothing here answers “{view.query}”. The search knows the cards, the library decks and their game plans, the synergy packages, the glossary,
            the strategy guides, the recorded events and ratings, and the bots’ play statistics.
          </p>
          <Examples onPick={onQuery} />
        </div>
      )}
      {view.status === 'done' && hits.length > 0 && (
        <ol className="panel kb-hits" aria-label={`Results for ${view.query}`}>
          {hits.map((h) => (
            <SearchHit key={h.record.id} r={h.record} query={view.query} />
          ))}
        </ol>
      )}
    </div>
  );
}

export function SearchPage() {
  const [q, setQ] = useState('');
  const [view, setView] = useState<SearchView>({ status: 'idle' });

  useEffect(() => {
    const query = q.trim();
    if (!query) {
      setView({ status: 'idle' });
      return;
    }
    let live = true;
    const t = setTimeout(async () => {
      const s = searcher();
      try {
        if (!s.isReady) {
          setView({ status: 'loading', query });
          await s.ready();
          await paint();
          if (!live) return;
        }
        const missing = s.missing(query);
        setView({ status: 'done', query, result: s.run(query), more: missing.length ? 'loading' : null });
        if (!missing.length) return;
        try {
          await s.load(missing);
        } catch {
          if (live) setView({ status: 'done', query, result: s.run(query), more: 'failed' });
          return;
        }
        await paint();
        // search again with the statistics in
        if (live) setView({ status: 'done', query, result: s.run(query), more: null });
      } catch {
        if (live) setView({ status: 'error', query });
      }
    }, SEARCH_DEBOUNCE_MS);
    return () => {
      live = false;
      clearTimeout(t);
    };
  }, [q]);

  return <SearchScreen q={q} view={view} onQuery={setQ} />;
}
