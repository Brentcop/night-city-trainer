// The parts of the page frame the site config drives (src/lib/siteConfig.ts): the announcement banner, the "previewing
// a draft" bar, the notice for a page that is turned off, the maintenance page and text with [label](#/link) links.
// All text is rendered as text, never as HTML.
import { useState } from 'react';
import { bannerActive, bannerDismissed, dismissBanner, linkSegments, pageOn, type BannerConfig, type SiteConfig } from '../../lib/siteConfig';
import { localStore } from '../../lib/boardSettings';
import { previewDraft, useSiteConfig } from '../useSiteConfig';

/** Text with its safe [label](link) links as links. */
export function LinkedText({ text }: { text: string }) {
  return (
    <>
      {linkSegments(text).map((s, i) =>
        s.href ? (
          <a key={i} href={s.href} {...(s.href.startsWith('https:') ? { target: '_blank', rel: 'noopener noreferrer' } : {})}>
            {s.text}
          </a>
        ) : (
          <span key={i}>{s.text}</span>
        ),
      )}
    </>
  );
}

/** The announcement banner, or nothing (no text, outside its dates, or dismissed in this browser). `now` is for tests. */
export function SiteBanner({ banner, now, preview }: { banner: BannerConfig; now?: number; preview?: boolean }) {
  const [gone, setGone] = useState(() => !preview && bannerDismissed(banner, localStore()));
  if (!preview && (gone || !bannerActive(banner, now))) return null;
  if (preview && !banner.text.trim()) return null;
  const external = banner.link.startsWith('https:');
  return (
    <div className={`site-banner site-banner-${banner.level}`} role={banner.level === 'warning' ? 'alert' : 'status'}>
      <span className="site-banner-text">
        {banner.text}
        {banner.link && (
          <>
            {' '}
            <a href={banner.link} {...(external ? { target: '_blank', rel: 'noopener noreferrer' } : {})}>
              {banner.linkText || 'Read more'}
            </a>
          </>
        )}
      </span>
      {banner.dismissible && (
        <button
          type="button"
          className="ghost site-banner-close"
          aria-label="Dismiss this notice"
          onClick={() => {
            if (!preview) dismissBanner(banner, localStore());
            setGone(true);
          }}
        >
          ✕
        </button>
      )}
    </div>
  );
}

/** Shown while this browser previews a draft config from the editor. */
export function DraftBar() {
  return (
    <div className="site-draft-bar" role="status">
      <b>Previewing draft config</b>
      <span className="small">Only this browser sees it. Visitors see the published site-config.json.</span>
      <a href="#/admin">Editor</a>
      <button type="button" onClick={() => previewDraft(null)}>
        Exit preview
      </button>
    </div>
  );
}

/** A route the site config turned off. */
export function PageOff({ home }: { home: string }) {
  return (
    <div className="panel">
      <h2>This page is turned off</h2>
      <p className="muted">The site owner has turned this page off for now.</p>
      <a href={`#/${home}`}>Go to the start page →</a>
    </div>
  );
}

/** Maintenance mode: a plain full-page notice. */
export function MaintenancePage({ config }: { config: SiteConfig }) {
  return (
    <div className="maintenance-page">
      <div className="panel">
        <h1>{config.site.title}</h1>
        <p className="maintenance-text">{config.maintenance.message}</p>
        {config.maintenance.allowPlay && (
          <p>
            <a className="btn primary" href="#/play">
              ▶ Play against the bot
            </a>
          </p>
        )}
      </div>
    </div>
  );
}

/** Its children only while the page at `path` is on (site config): for links to pages the owner can turn off. */
export function IfPage({ path, children }: { path: string; children: React.ReactNode }) {
  return pageOn(useSiteConfig(), path) ? <>{children}</> : null;
}
