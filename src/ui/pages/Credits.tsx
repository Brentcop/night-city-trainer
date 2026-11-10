import { allDecks } from '../../lib/browserLibrary';
import { deckColors } from '../../engine/deck';

const SOURCES: [string, string, string][] = [
  ['Card data (all 150 cards)', 'cyberpunk-tcg-sim.online public card catalog (sourced from netdeck.gg / the official card database)', 'https://cyberpunk-tcg-sim.online/'],
  ['Official rules', 'WeirdCo — Comprehensive Rules (Oct 29 2026) and Tournament Rules; this site paraphrases them with rule numbers', 'https://cyberpunktcg.com/comprehensive-rules'],
  ['Meta tiers & archetype lists', 'choom.gg editors (Night City Meta page)', 'https://choom.gg/meta'],
  ['Archetype decklists (4)', 'Troy Yamaguchi (Plus Two) — "The Cyberpunk Primer", via choom.gg', 'https://choom.gg/meta'],
  ['Archetype reference lists (3)', 'UltPotatoe, Armbarred, MMantanza — public decks on choom.gg', 'https://choom.gg/decks'],
  ['Community guide lists (11)', 'choom.gg guide authors, credited on each deck', 'https://choom.gg/guides'],
  ['Choom Table statistics', 'choom.gg simulator data (snapshot 9 Nov 2026)', 'https://choom.gg/meta'],
  ['Community stats & event info', 'gamertagmythras.com, tcgcontender.com (referenced by choom.gg), cyberpunktcg.com/eor', 'https://cyberpunktcg.com/eor'],
];

export function CreditsPage() {
  const decks = allDecks();
  const groups = new Map<string, typeof decks>();
  for (const d of decks) {
    const k = (d.prov.origin ?? d.kind).replace(/ \(season \d+, \w+\)/, '').replace(/ \(.*\)$/, '');
    groups.set(k, [...(groups.get(k) ?? []), d]);
  }
  return (
    <div className="grid">
      <h1 style={{ marginBottom: 0 }}>Credits &amp; deck provenance</h1>
      <p className="muted">
        Every deck on this site is tagged with where it came from and who made it. Lists collected from other sites keep their author and a link
        back. Lists made here say how they were made (hand-designed, bred, optimized) and what they were derived from. This is an unofficial
        fan-made tool, not affiliated with CD PROJEKT RED, WeirdCo, choom.gg or cyberpunk-tcg-sim.online.
      </p>
      <div className="panel scroll-x">
        <h2 style={{ marginTop: 0 }}>Data sources</h2>
        <table className="small">
          <tbody>
            {SOURCES.map(([what, who, url]) => (
              <tr key={what}>
                <td>
                  <b>{what}</b>
                </td>
                <td>{who}</td>
                <td>
                  <a href={url} target="_blank" rel="noreferrer">
                    {url.replace(/^https?:\/\//, '')}
                  </a>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {[...groups.entries()].map(([origin, ds]) => (
        <div className="panel scroll-x" key={origin}>
          <h2 style={{ marginTop: 0 }}>
            {origin} <span className="muted small">({ds.length})</span>
          </h2>
          <table className="small">
            <thead>
              <tr>
                <th>Deck</th>
                <th>By</th>
                <th>Derived from / credits</th>
                <th>Added</th>
                <th>Source</th>
              </tr>
            </thead>
            <tbody>
              {ds.map((d) => (
                <tr key={d.file}>
                  <td>
                    <span className="tag">{deckColors(d.deck)}</span> <a href={`#/decks?d=${encodeURIComponent(d.file)}`}>{d.deck.name}</a>
                    {d.prov.origin && /season/.test(d.prov.origin) && <div className="muted">{d.prov.origin}</div>}
                  </td>
                  <td>{d.prov.author ?? '—'}</td>
                  <td>{[d.prov.parents, d.prov.credits].filter(Boolean).join(' · ') || '—'}</td>
                  <td>{d.prov.added ?? '—'}</td>
                  <td>
                    {d.prov.source ? (
                      <a href={d.prov.source} target="_blank" rel="noreferrer">
                        link
                      </a>
                    ) : (
                      '—'
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ))}
    </div>
  );
}
