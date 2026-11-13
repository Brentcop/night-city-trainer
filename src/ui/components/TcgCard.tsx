// Visual TCG card: real card art when available, otherwise a styled frame with the card's data.
// Sizes: xs (≈64px wide), sm (≈96), md (≈140), lg (≈220), xl (≈300). A container can resize every card inside it by
// setting the CSS variable --tcg-w (the Play board sizes its cards from the space it has).
import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import type { CardDef } from '../../engine/types';
import { artEnabled, useArt } from '../art';
import { CardText } from './CardView';

export type CardSize = 'xs' | 'sm' | 'md' | 'lg' | 'xl';
const WIDTH: Record<CardSize, number> = { xs: 64, sm: 96, md: 140, lg: 220, xl: 300 };
/** The card's width: the size's default unless a container sets --tcg-w. */
const widthOf = (size: CardSize) => `var(--tcg-w, ${WIDTH[size]}px)`;

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
  /** never show the power badge (a pile's top card, where a number reads like a count) */
  noPower?: boolean;
  title?: string;
  /** accessible name when the card is a button (e.g. "Panam: can attack") */
  ariaLabel?: string;
}

export interface Box {
  left: number;
  top: number;
  right: number;
  bottom: number;
}

/**
 * Where the hover preview goes: beside the card (right, else left), its top level with the card's, kept fully inside
 * the viewport. If it fits on neither side it goes above or below the card instead (clamped).
 */
export function placeZoom(card: Box, size: { w: number; h: number }, vp: { w: number; h: number }, gap = 10, margin = 8): { left: number; top: number } {
  const clamp = (v: number, lo: number, hi: number) => Math.max(lo, Math.min(v, Math.max(lo, hi)));
  const top = clamp(card.top, margin, vp.h - size.h - margin);
  if (card.right + gap + size.w <= vp.w - margin) return { left: card.right + gap, top };
  if (card.left - gap - size.w >= margin) return { left: card.left - gap - size.w, top };
  const left = clamp((card.left + card.right) / 2 - size.w / 2, margin, vp.w - size.w - margin);
  if (card.top - gap - size.h >= margin) return { left, top: card.top - gap - size.h };
  if (card.bottom + gap + size.h <= vp.h - margin) return { left, top: card.bottom + gap };
  return { left, top };
}

export function TcgCard({ def, size = 'md', power, spent, selected, targetable, dim, badges, count, onClick, noZoom, title, ariaLabel, noPower }: TcgCardProps) {
  const { url, onError } = useArt(def.id);
  const [broken, setBroken] = useState(false);
  // Track which URL finished loading (a cached image can finish before React's onLoad is attached,
  // so we also check `complete` when the element mounts).
  const [loadedUrl, setLoadedUrl] = useState<string | undefined>();
  const loaded = !!url && loadedUrl === url;
  const imgRef = useCallback((el: HTMLImageElement | null) => {
    if (el && el.complete && el.naturalWidth > 0) setLoadedUrl(el.getAttribute('src') ?? undefined);
  }, []);
  // the hovered card's box: the preview renders at the document body, so no transformed, clipped or stacked parent
  // (a hand fan, a spent card's rotation, the hand bar above the field) can hide or turn it
  const [zoomAt, setZoomAt] = useState<Box | null>(null);
  const showArt = artEnabled() && url && !broken;
  const pw = power ?? def.power;
  const boosted = power !== undefined && power !== null && def.power !== null && power !== def.power;
  const canZoom = !noZoom && size !== 'xl';
  useEffect(() => {
    if (!zoomAt) return;
    // the card moves away under a still pointer when something scrolls: drop the preview rather than leave it stranded
    const hide = () => setZoomAt(null);
    window.addEventListener('scroll', hide, true);
    window.addEventListener('resize', hide);
    return () => {
      window.removeEventListener('scroll', hide, true);
      window.removeEventListener('resize', hide);
    };
  }, [zoomAt]);
  return (
    <div
      className={['tcg', `tcg-${size}`, def.color, spent ? 'is-spent' : '', selected ? 'is-selected' : '', targetable ? 'is-target' : '', dim ? 'is-dim' : '', onClick ? 'is-click' : ''].join(' ')}
      style={{ width: widthOf(size) }}
      onClick={onClick}
      onPointerEnter={(e) => {
        if (e.pointerType !== 'mouse' || !canZoom) return;
        const r = e.currentTarget.getBoundingClientRect();
        setZoomAt({ left: r.left, top: r.top, right: r.right, bottom: r.bottom });
      }}
      onPointerLeave={() => setZoomAt(null)}
      title={title ?? (showArt ? undefined : def.text)}
      role={onClick ? 'button' : undefined}
      tabIndex={onClick ? 0 : undefined}
      aria-label={onClick ? ariaLabel : undefined}
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
        {!noPower && (boosted || (showArt && size === 'xs')) && pw !== null && def.type !== 'Program' && (
          <span className={`tcg-pw ${boosted ? (power! > (def.power ?? 0) ? 'up' : 'down') : ''}`}>{pw}</span>
        )}
        {count !== undefined && <span className="tcg-count">×{count}</span>}
        {badges && <div className="tcg-badges">{badges}</div>}
      </div>
      {zoomAt && canZoom && typeof document !== 'undefined' && createPortal(<CardZoom def={def} power={power} card={zoomAt} />, document.body)}
    </div>
  );
}

/** The hover preview: the card at full size beside its text, in the document's top layer of stacking. */
export function CardZoom({ def, power, card }: { def: CardDef; power?: number | null; card: Box }) {
  const ref = useRef<HTMLDivElement>(null);
  const [pos, setPos] = useState<{ left: number; top: number } | null>(null);
  // measure once rendered (its size depends on the art and the text), then place it; hidden until placed
  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;
    setPos(placeZoom(card, { w: el.offsetWidth, h: el.offsetHeight }, { w: window.innerWidth, h: window.innerHeight }));
  }, [card]);
  return (
    <div ref={ref} className="tcg-zoom" aria-hidden="true" style={pos ? { left: pos.left, top: pos.top } : { left: 0, top: 0, visibility: 'hidden' }}>
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

/** Keyboard access for a clickable non-button element: focusable, and Enter or Space clicks it. */
export function pressable(onClick: (() => void) | undefined, label?: string) {
  if (!onClick) return {};
  return {
    role: 'button',
    tabIndex: 0,
    'aria-label': label,
    onKeyDown: (e: React.KeyboardEvent) => {
      if (e.key !== 'Enter' && e.key !== ' ') return;
      e.preventDefault();
      onClick();
    },
  };
}

/** Face-down card back (Legends, hidden cards, deck piles). */
export function CardBack({
  size = 'md',
  label,
  spent,
  onClick,
  targetable,
  count,
  ariaLabel,
}: {
  size?: CardSize;
  label?: string;
  spent?: boolean;
  onClick?: () => void;
  targetable?: boolean;
  count?: number;
  ariaLabel?: string;
}) {
  return (
    <div
      className={['tcg', `tcg-${size}`, 'tcg-back', spent ? 'is-spent' : '', targetable ? 'is-target' : '', onClick ? 'is-click' : ''].join(' ')}
      style={{ width: widthOf(size) }}
      onClick={onClick}
      {...pressable(onClick, ariaLabel ?? label ?? 'Face-down card')}
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
