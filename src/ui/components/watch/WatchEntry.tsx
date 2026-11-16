// The light half of "Watch" (the spectator's view of a match): the switch, the button and the host that loads the
// overlay only when someone presses Watch. The overlay (WatchOverlay.tsx: the board, the engine around a frame, the
// worker client) is a chunk of its own, so the pages that offer Watch (the tournament runner, the events page, the
// Profile's history) do not grow with it. The site config's `watchMatches` switch hides every Watch control.
import { lazy, Suspense } from 'react';
import type { WatchTarget } from '../../../lib/watchMatch';
import { useFeature } from '../../useSiteConfig';
import { Modal } from '../Modal';

const WatchOverlay = lazy(() => import('./WatchOverlay').then((m) => ({ default: m.WatchOverlay })));

/** Whether Watch is offered on this site (the owner's switch, site config `features.watchMatches`). */
export const useWatchOn = () => useFeature('watchMatches');

/** The spectator's view of `target`, loaded on first use; closing it changes nothing in what it shows. */
export function WatchHost({ target, onClose }: { target: WatchTarget; onClose: () => void }) {
  return (
    <Suspense
      fallback={
        <Modal label="Watch" onClose={onClose} className="watch-loading">
          <p className="muted">
            <span className="spinner" /> Setting up the table…
          </p>
        </Modal>
      }
    >
      <WatchOverlay target={target} onClose={onClose} />
    </Suspense>
  );
}

/** A Watch button (nothing when the owner has turned Watch off). */
export function WatchButton({ onWatch, label = '👁 Watch', title, className = 'small', ariaLabel }: { onWatch: () => void; label?: string; title?: string; className?: string; ariaLabel?: string }) {
  const on = useWatchOn();
  if (!on) return null;
  return (
    <button type="button" className={className} onClick={onWatch} title={title ?? 'Watch it play out as a spectator, both hands face up'} aria-label={ariaLabel}>
      {label}
    </button>
  );
}
