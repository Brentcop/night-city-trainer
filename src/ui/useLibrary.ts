// Re-render when the deck library changes: a save, delete, hide or unhide in this tab (LIBRARY_CHANGED) or in another
// tab (the `storage` event). allDecks() is cached against the stored text, so re-reading it after a bump is cheap.
import { useEffect, useState } from 'react';
import { CUSTOM_KEY, LIBRARY_CHANGED } from '../lib/browserLibrary';
import { HIDDEN_KEY } from '../lib/hiddenDecks';

/** A counter that goes up whenever the library changes; use it as a memo dependency. */
export function useLibraryVersion(): number {
  const [v, setV] = useState(0);
  useEffect(() => {
    const bump = () => setV((x) => x + 1);
    const onStorage = (e: StorageEvent) => {
      if (!e.key || e.key === CUSTOM_KEY || e.key === HIDDEN_KEY) bump();
    };
    window.addEventListener(LIBRARY_CHANGED, bump);
    window.addEventListener('storage', onStorage);
    return () => {
      window.removeEventListener(LIBRARY_CHANGED, bump);
      window.removeEventListener('storage', onStorage);
    };
  }, []);
  return v;
}
