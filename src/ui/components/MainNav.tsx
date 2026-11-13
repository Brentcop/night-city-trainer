// The site's top tabs on one row (UX-7): the tabs that fit show, the rest go under "More". Which tabs exist and their
// order come from the site config (visibleNav); how many show is measured (fitTabs, src/lib/navFit.ts) from a hidden
// copy of every tab, so it follows the owner's labels, the fonts and the window. On phones the nav has its own row
// under the brand (styles.css sets --nav-own-row there) and the same rule applies to that row.
import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import type { NavSection } from '../../lib/siteConfig';
import { fitTabs } from '../../lib/navFit';
import { useFocusTrap } from './Modal';

function TabBody({ sec, waiting }: { sec: NavSection; waiting: number }) {
  return (
    <>
      <span className="nav-icon" aria-hidden>
        {sec.icon}
      </span>
      {sec.label}
      {waiting > 0 && sec.routes.includes('play') && (
        <span className="nav-count" title={`${waiting} multi-day game${waiting === 1 ? '' : 's'} waiting for your move`}>
          {waiting}
          <span className="sr-only"> multi-day game{waiting === 1 ? '' : 's'} waiting for your move</span>
        </span>
      )}
    </>
  );
}

function MoreMenu({ items, current, routePath, waiting, onClose, opener }: { items: NavSection[]; current: NavSection | undefined; routePath: string | undefined; waiting: number; onClose: () => void; opener: React.RefObject<HTMLElement | null> }) {
  const ref = useRef<HTMLDivElement>(null);
  // focus in, Tab and the arrow keys kept inside, Escape closes and focus goes back to More
  useFocusTrap(ref, onClose, { initial: 'first', arrows: true });
  // a press anywhere else closes it (the header's backdrop-filter would confine a full-screen backdrop to the header)
  const close = useRef(onClose);
  close.current = onClose;
  useEffect(() => {
    const down = (e: PointerEvent) => {
      const t = e.target as Node | null;
      if (t && !ref.current?.contains(t) && !opener.current?.contains(t)) close.current();
    };
    document.addEventListener('pointerdown', down);
    return () => document.removeEventListener('pointerdown', down);
  }, [opener]);
  return (
    <>
      <div ref={ref} className="nav-more-menu" role="menu" aria-label="More pages" tabIndex={-1}>
        {items.map((sec) => (
          <a
            key={sec.id}
            role="menuitem"
            href={`#/${sec.landing}`}
            className={current === sec ? 'active' : ''}
            aria-current={current === sec ? (routePath === sec.landing ? 'page' : 'true') : undefined}
            onClick={onClose}
          >
            <TabBody sec={sec} waiting={waiting} />
          </a>
        ))}
      </div>
    </>
  );
}

export function MainNav({ nav, current, routePath, waiting }: { nav: NavSection[]; current: NavSection | undefined; routePath: string | undefined; waiting: number }) {
  const navRef = useRef<HTMLElement>(null);
  const measureRef = useRef<HTMLDivElement>(null);
  const moreBtn = useRef<HTMLButtonElement>(null);
  // indexes of the tabs on the row; null until measured (every tab, as before)
  const [shown, setShown] = useState<number[] | null>(null);
  const [open, setOpen] = useState(false);
  const active = current ? nav.indexOf(current) : -1;
  const key = nav.map((s) => `${s.id}:${s.label}`).join('|');

  useLayoutEffect(() => {
    const navEl = navRef.current;
    const header = navEl?.parentElement;
    const meas = measureRef.current;
    if (!navEl || !header || !meas || typeof window === 'undefined') return;
    const fit = () => {
      if (!header.clientWidth) return; // hidden (the Play board hides the header until its ☰ opens it)
      const ns = getComputedStyle(navEl);
      const gap = parseFloat(ns.columnGap) || 0;
      const widths = [...meas.querySelectorAll<HTMLElement>('[data-tab]')].map((e) => e.getBoundingClientRect().width + gap);
      const moreW = (meas.querySelector<HTMLElement>('[data-more]')?.getBoundingClientRect().width ?? 90) + gap;
      const hs = getComputedStyle(header);
      const inner = header.clientWidth - parseFloat(hs.paddingLeft) - parseFloat(hs.paddingRight);
      // the nav's own padding and border, and the gap it doesn't need after its last tab
      const chrome = parseFloat(ns.paddingLeft) + parseFloat(ns.paddingRight) + parseFloat(ns.borderLeftWidth) + parseFloat(ns.borderRightWidth) - gap;
      let avail = inner - chrome;
      if (ns.getPropertyValue('--nav-own-row').trim() !== '1') {
        const colGap = parseFloat(hs.columnGap) || 0;
        for (const c of Array.from(header.children) as HTMLElement[]) {
          if (c === navEl) continue;
          const cs = getComputedStyle(c);
          if (cs.display === 'none' || cs.position === 'absolute' || cs.position === 'fixed') continue;
          avail -= c.getBoundingClientRect().width + colGap;
        }
      }
      // a pixel of slack so rounding never wraps the row
      const next = fitTabs(widths, moreW, avail - 1, active >= 0 ? active : null);
      setShown((old) => (old && old.join() === next.join() ? old : next));
    };
    fit();
    const ro = typeof ResizeObserver !== 'undefined' ? new ResizeObserver(fit) : null;
    ro?.observe(header);
    ro?.observe(meas);
    window.addEventListener('resize', fit);
    void document.fonts?.ready.then(fit);
    return () => {
      ro?.disconnect();
      window.removeEventListener('resize', fit);
    };
  }, [key, active, waiting]);

  const visible = shown ?? nav.map((_, i) => i);
  const rest = nav.filter((_, i) => !visible.includes(i));
  // the focus trap puts focus back on More when the menu closes
  const close = () => setOpen(false);
  return (
    <nav ref={navRef} className="nav" aria-label="Main">
      {visible.map((i) => {
        const sec = nav[i]!;
        return (
          <a
            key={sec.id}
            href={`#/${sec.landing}`}
            className={current === sec ? 'active' : ''}
            // the section you are in; "page" when its link is exactly this page
            aria-current={current === sec ? (routePath === sec.landing ? 'page' : 'true') : undefined}
          >
            <TabBody sec={sec} waiting={waiting} />
          </a>
        );
      })}
      {rest.length > 0 && (
        <span className="nav-more">
          <button
            ref={moreBtn}
            type="button"
            className={`nav-more-btn ${rest.includes(current as NavSection) ? 'active' : ''}`}
            aria-haspopup="menu"
            aria-expanded={open}
            onClick={() => setOpen(!open)}
          >
            More<span aria-hidden="true"> ▾</span>
            {waiting > 0 && rest.some((s) => s.routes.includes('play')) && <span className="nav-count">{waiting}</span>}
          </button>
          {open && <MoreMenu items={rest} current={current} routePath={routePath} waiting={waiting} onClose={close} opener={moreBtn} />}
        </span>
      )}
      {/* every tab and the More button, styled like the row but in a 0×0 clipped box: what fitTabs measures */}
      <div ref={measureRef} className="nav-measure" aria-hidden="true">
        {nav.map((sec) => (
          <a key={sec.id} data-tab>
            <TabBody sec={sec} waiting={waiting} />
          </a>
        ))}
        <span className="nav-more-btn" data-more>
          More ▾{waiting > 0 && <span className="nav-count">{waiting}</span>}
        </span>
      </div>
    </nav>
  );
}
