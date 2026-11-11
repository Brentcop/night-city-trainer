// Visual deck identity: origin badge, Legend art strip, colour pips, and a gallery tile.
import { CARD_BY_ID } from '../../engine/cards';
import { deckColors } from '../../engine/deck';
import type { LibraryDeck, Provenance } from '../../lib/library';
import { shortCredit } from '../../lib/library';
import { deckStats, pct } from '../../lib/deckStats';
import { artEnabled, useArt } from '../art';
import { typeSplit } from '../../lib/deckTypes';
import { SMALL_SAMPLE, tileRecord } from '../../lib/playedRecord';
import { RATINGS } from '../../data/index';
import { TypeSplitBar } from './TypeSplit';

/** Tournament rows by deck name (ratings.json is in the entry chunk anyway, through the Home page). */
const RATED = new Map(RATINGS.decks.map((r) => [r.name, r]));

export type OriginKind = 'choom-meta' | 'sim-ladder' | 'choom-guide' | 'nc-original' | 'nc-bred' | 'nc-variant' | 'nc-build' | 'mine' | 'other';

export function originKind(p: Provenance | undefined, kind?: string): OriginKind {
  const o = p?.origin ?? '';
  if (o.startsWith('choom.gg meta')) return 'choom-meta';
  if (o.startsWith('choom.gg community')) return 'choom-guide';
  if (o.startsWith('cyberpunk-tcg-sim.online')) return 'sim-ladder';
  if (o.startsWith('Night City Trainer original')) return 'nc-original';
  if (o.startsWith('Night City Trainer bred')) return 'nc-bred';
  if (o.startsWith('Night City Trainer optimizer')) return 'nc-variant';
  if (o.startsWith('Night City Trainer tournament')) return 'nc-build';
  if (o.startsWith('My deck') || kind === 'custom') return 'mine';
  return 'other';
}

const ORIGIN_META: Record<OriginKind, { icon: string; label: string }> = {
  'choom-meta': { icon: '◆', label: 'choom.gg meta' },
  'choom-guide': { icon: '✎', label: 'choom.gg guide' },
  'sim-ladder': { icon: '▲', label: 'Sim ladder' },
  'nc-original': { icon: '⚙', label: 'NC original' },
  'nc-bred': { icon: '🧬', label: 'Bred' },
  'nc-variant': { icon: '⟲', label: 'Optimizer variant' },
  'nc-build': { icon: '🏆', label: 'Tournament build' },
  mine: { icon: '★', label: 'My deck' },
  other: { icon: '•', label: 'Other' },
};

export function OriginBadge({ deck, full }: { deck: Pick<LibraryDeck, 'prov' | 'kind'>; full?: boolean }) {
  const k = originKind(deck.prov, deck.kind);
  const m = ORIGIN_META[k];
  const season = deck.prov.origin?.match(/season (\d+), (\w+)/);
  return (
    <span className={`origin-badge origin-${k}${full ? ' is-full' : ''}`} title={[deck.prov.origin, deck.prov.author].filter(Boolean).join(' — ')}>
      <span className="origin-icon">{m.icon}</span>
      {season ? `S${season[1]} ${season[2]}` : m.label}
      {full && deck.prov.author && <span className="origin-by"> · {shortCredit(deck).replace(/^[^·]*· ?/, '') || deck.prov.author}</span>}
    </span>
  );
}

export function ColorPips({ legends }: { legends: string[] }) {
  return (
    <span className="pips">
      {legends.map((id, i) => (
        <span key={i} className={`dot ${CARD_BY_ID[id]?.color}`} title={CARD_BY_ID[id]?.color} />
      ))}
    </span>
  );
}

function LegendArt({ id }: { id: string }) {
  const { url, onError } = useArt(id);
  const def = CARD_BY_ID[id];
  return (
    <div className={`legend-art ${def?.color}`} title={def?.displayName}>
      {artEnabled() && url ? <img src={url} alt={def?.displayName} loading="lazy" onError={onError} draggable={false} /> : <span>{def?.name}</span>}
    </div>
  );
}

/** Three Legend portraits side by side (crops the art). */
export function LegendStrip({ legends, height = 90 }: { legends: string[]; height?: number }) {
  return (
    <div className="legend-strip" style={{ height }}>
      {legends.map((id) => (
        <LegendArt key={id} id={id} />
      ))}
    </div>
  );
}

/** Gallery tile for a deck: legends art, name, origin, key stats. With `href` the whole tile is a link; without, it is static. */
export function DeckTile({ d, selected, href }: { d: LibraryDeck; selected?: boolean; href?: string }) {
  const st = deckStats(d.file);
  const played = tileRecord(RATED.get(d.deck.name));
  const body = (
    <>
      <LegendStrip legends={d.deck.legends} />
      <div className="deck-tile-body">
        <div className="spread">
          <b className="deck-tile-name">{d.deck.name}</b>
          {d.tier && <span className={`tier tier-${d.tier}`}>{d.tier}</span>}
        </div>
        <div className="row small">
          <ColorPips legends={d.deck.legends} />
          <span className="tag">{deckColors(d.deck)}</span>
          <OriginBadge deck={d} />
        </div>
        <div className="small muted deck-tile-by">{shortCredit(d)}</div>
        <div className="deck-tile-stats">
          {played ? (
            <span className="deck-tile-played">
              <b className={`num ${played.n < SMALL_SAMPLE ? 'thin' : ''}`}>{pct(played.wr)}</b> in {played.n.toLocaleString()} Swiss games
              {played.n < SMALL_SAMPLE ? ' (small sample)' : ''}
              {played.titles > 0 ? ` · ${played.titles} title${played.titles === 1 ? '' : 's'}` : played.top8 > 0 ? ` · top 8 ×${played.top8}` : ''}
            </span>
          ) : (
            !st.leader && !st.review && <span>No recorded games</span>
          )}
          {st.leader && (
            <span title="Pooled win rate vs the meta archetypes (shrunk rating)">
              <b>{pct(st.leader.rating)}</b> vs meta · {st.leader.percentile}th pct
            </span>
          )}
          {!st.leader && st.review && (
            <span>
              <b>{pct(st.review.winRate)}</b> round robin
            </span>
          )}
        </div>
        <TypeSplitBar split={typeSplit(d.deck.main)} mini />
      </div>
    </>
  );
  const cls = `deck-tile ${selected ? 'is-selected' : ''}`;
  if (href)
    return (
      <a className={cls} href={href}>
        {body}
      </a>
    );
  return <div className={cls}>{body}</div>;
}
