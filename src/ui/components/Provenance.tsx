import type { Provenance } from '../../lib/library';

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
            <a href={prov.source} target="_blank" rel="noreferrer">
              {prov.source.replace(/^https?:\/\//, '')}
            </a>
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
