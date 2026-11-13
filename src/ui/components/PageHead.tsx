// A page's header band in the Play board's look (the playmat, its frame bar and the signature line): an optional
// kicker naming the section, the page's one <h1>, a line of context, and the page's main actions.
import { useLayoutEffect, useRef, useState } from 'react';

export function PageHead({ kicker, title, actions, children }: { kicker?: string; title: React.ReactNode; actions?: React.ReactNode; children?: React.ReactNode }) {
  // phones: the context is cut to three lines (styles.css) with "More" to read the rest, so the page's content starts
  // on the first screen (UX-12); the button shows only when the text is actually cut
  const sub = useRef<HTMLDivElement>(null);
  const [cut, setCut] = useState(false);
  const [open, setOpen] = useState(false);
  useLayoutEffect(() => {
    const el = sub.current;
    if (!el || open) return;
    const check = () => setCut(el.scrollHeight > el.clientHeight + 1);
    check();
    const ro = typeof ResizeObserver !== 'undefined' ? new ResizeObserver(check) : null;
    ro?.observe(el);
    return () => ro?.disconnect();
  }, [open, children]);
  return (
    <header className="page-head">
      <div className="page-head-main">
        {kicker && <span className="page-kicker">{kicker}</span>}
        <h1>{title}</h1>
        {children && (
          <div ref={sub} className={`page-head-sub ${open ? 'is-open' : ''}`}>
            {children}
          </div>
        )}
        {children && (cut || open) && (
          <button type="button" className="ghost small page-head-more" aria-expanded={open} onClick={() => setOpen(!open)}>
            {open ? 'Less' : 'More…'}
          </button>
        )}
      </div>
      {actions && <div className="page-head-actions">{actions}</div>}
    </header>
  );
}
