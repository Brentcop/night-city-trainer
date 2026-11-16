import type { Provenance } from '../../lib/library';
import { safeHref } from './Markdown';

/** The longest link text shown in full; a longer address is cut (the link itself stays whole). */
export const LINK_TEXT_MAX = 72;

/**
 * A link's visible text: the address without its scheme, cut with "…" when it is long. A deck-builder link of
 * cyberpunk-tcg-sim.online carries a whole list in its address (700 characters and more), which no screen should
 * have to show; the link's href and its title keep the full address.
 */
export function linkText(url: string, max = LINK_TEXT_MAX): string {
  const t = url.replace(/^https?:\/\//, '');
  return [...t].length > max ? `${[...t].slice(0, max - 1).join('')}…` : t;
}

/** Full provenance block: origin, author, source link, credits, parents, date. */
export function ProvenanceBlock({ prov }: { prov: Provenance }) {
  if (!prov.origin && !prov.author) return null;
  return (
    <div className="kv small" style={{ margin: '6px 0' }}>
      {prov.origin && (
        <>
          <span className="muted">Origin</span>
          <span>
            <span className="tag" style={{ borderColor: 'var(--accent)' }}>
              {prov.origin}
            </span>
          </span>
        </>
      )}
      {prov.author && (
        <>
          <span className="muted">By</span>
          <span>{prov.author}</span>
        </>
      )}
      {prov.source && (
        <>
          <span className="muted">Source</span>
          <span>
            {safeHref(prov.source) ? (
              // the title gives the whole address only when the text was cut
              <a href={safeHref(prov.source)!} target="_blank" rel="noreferrer" title={linkText(prov.source) === linkText(prov.source, Infinity) ? undefined : prov.source}>
                {linkText(prov.source)}
              </a>
            ) : (
              prov.source
            )}
          </span>
        </>
      )}
      {prov.via && (
        <>
          <span className="muted">Via</span>
          <span>{prov.via}</span>
        </>
      )}
      {prov.credits && (
        <>
          <span className="muted">Credits</span>
          <span>{prov.credits}</span>
        </>
      )}
      {prov.parents && (
        <>
          <span className="muted">Derived from</span>
          <span>{prov.parents}</span>
        </>
      )}
      {prov.added && (
        <>
          <span className="muted">Added</span>
          <span>{prov.added}</span>
        </>
      )}
      {prov.forged && (
        <>
          <span className="muted">Forge changes</span>
          <span>{prov.forged}</span>
        </>
      )}
    </div>
  );
}
