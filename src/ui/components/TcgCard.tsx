// Visual TCG card: real card art when available, otherwise a styled frame with the card's data.
// Sizes: xs (≈64px wide), sm (≈96), md (≈140), lg (≈220), xl (≈300).
import { useCallback, useState } from 'react';
import type { CardDef } from '../../engine/types';
import { artEnabled, useArt } from '../art';
import { CardText } from './CardView';

export type CardSize = 'xs' | 'sm' | 'md' | 'lg' | 'xl';
const WIDTH: Record<CardSize, number> = { xs: 64, sm: 96, md: 140, lg: 220, xl: 300 };

export interface TcgCardProps {
  def: CardDef;
  size?: CardSize;
  power?: number | null; // current power (overrides printed)
  spent?: boolean;
  selected?: boolean;
  targetable?: boolean;
  dim?: boolean;
  badges?: React.ReactNode; // overlay chips (lag, gear…)
  count?: number; // stack count in deck views
  onClick?: () => void;
  noZoom?: boolean;
  title?: string;
}

export function TcgCard({ def, size = 'md', power, spent, selected, targetable, dim, badges, count, onClick, noZoom, title }: TcgCardProps) {
  const { url, onError } = useArt(def.id);
  const [broken, setBroken] = useState(false);
  // Track which URL finished loading (a cached image can finish before React's onLoad is attached,
  // so we also check `complete` when the element mounts).
  const [loadedUrl, setLoadedUrl] = useState<string | undefined>();
  const loaded = !!url && loadedUrl === url;
  const imgRef = useCallback((el: HTMLImageElement | null) => {
    if (el && el.complete && el.naturalWidth > 0) setLoadedUrl(el.getAttribute('src') ?? undefined);
  }, []);
  const [zoom, setZoom] = useState(false);
  const showArt = artEnabled() && url && !broken;
  const w = WIDTH[size];
  const pw = power ?? def.power;
  const boosted = power !== undefined && power !== null && def.power !== null && power !== def.power;
  return (
    <div
      className={['tcg', `tcg-${size}`, def.color, spent ? 'is-spent' : '', selected ? 'is-selected' : '', targetable ? 'is-target' : '', dim ? 'is-dim' : '', onClick ? 'is-click' : ''].join(' ')}
      style={{ width: w }}
      onClick={onClick}
      onPointerEnter={(e) => e.pointerType === 'mouse' && !noZoom && size !== 'xl' && setZoom(true)}
      onPointerLeave={() => setZoom(false)}
      title={title ?? (showArt ? undefined : def.text)}
      role={onClick ? 'button' : undefined}
      tabIndex={onClick ? 0 : undefined}
      onKeyDown={(e) => onClick && (e.key === 'Enter' || e.key === ' ') && (e.preventDefault(), onClick())}
    >
      <div className="tcg-inner">
        {(!showArt || !loaded) && <TextFrame def={def} size={size} />}
        {showArt && (
          <img
            ref={imgRef}
            src={url}
            alt={def.displayName}
            loading="lazy"
            draggable={false}
            className={loaded ? 'is-loaded' : ''}
            onLoad={() => setLoadedUrl(url)}
            onError={() => {
              setBroken(true);
              setLoadedUrl(undefined);
              onError();
              setTimeout(() => setBroken(false), 4000);
            }}
          />
        )}
        {(boosted || (showArt && size === 'xs')) && pw !== null && def.type !== 'Program' && (
          <span className={`tcg-pw ${boosted ? (power! > (def.power ?? 0) ? 'up' : 'down') : ''}`}>{pw}</span>
        )}
        {count !== undefined && <span className="tcg-count">×{count}</span>}
        {badges && <div className="tcg-badges">{badges}</div>}
      </div>
      {zoom && !noZoom && (
        <div className="tcg-zoom">
          <TcgCard def={def} size="xl" noZoom power={power} />
          <div className="tcg-zoom-text">
            <b>{def.displayName}</b>
            <div className="muted small">
              {def.type} · {def.cost ?? '–'} €$ · {def.color} RAM {def.ram} · {def.tags.join(', ')}
            </div>
            <div className="small" style={{ marginTop: 4, whiteSpace: 'pre-wrap' }}>
              <CardText text={def.text} />
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function TextFrame({ def, size }: { def: CardDef; size: CardSize }) {
  const tiny = size === 'xs' || size === 'sm';
  return (
    <div className={`tcg-frame ${def.color}`}>
      <div className="tcg-frame-top">
        <span className="tcg-cost">{def.cost ?? '–'}</span>
        <span className="tcg-ram">{def.ram}</span>
      </div>
      <div className="tcg-frame-art">
        <span>{def.type === 'Legend' ? '★' : def.type === 'Gear' ? '⚙' : def.type === 'Program' ? '⌁' : '◆'}</span>
      </div>
      <div className="tcg-frame-name">{def.displayName}</div>
      {!tiny && (
        <div className="tcg-frame-text">
          <CardText text={def.text} />
        </div>
      )}
      {def.power !== null && def.type !== 'Program' && <span className="tcg-frame-pw">{def.power}</span>}
    </div>
  );
}

/** Face-down card back (Legends, hidden cards, deck piles). */
export function CardBack({ size = 'md', label, spent, onClick, targetable, count }: { size?: CardSize; label?: string; spent?: boolean; onClick?: () => void; targetable?: boolean; count?: number }) {
  return (
    <div
      className={['tcg', `tcg-${size}`, 'tcg-back', spent ? 'is-spent' : '', targetable ? 'is-target' : '', onClick ? 'is-click' : ''].join(' ')}
      style={{ width: WIDTH[size] }}
      onClick={onClick}
    >
      <div className="tcg-inner">
        <div className="tcg-back-face">
          <span className="tcg-back-logo">NC</span>
          {label && <span className="tcg-back-label">{label}</span>}
        </div>
        {count !== undefined && <span className="tcg-count">{count}</span>}
      </div>
    </div>
  );
}
