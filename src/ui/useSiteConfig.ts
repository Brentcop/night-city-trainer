// The site config at runtime (the schema and rules are src/lib/siteConfig.ts). One copy for the whole app:
//   1. at startup, the config the build inlined into index.html (<script id="nct-site-config">, vite.config.ts), so the
//      first paint already has the owner's nav, title and banner; the bundled defaults when it is missing or unreadable;
//   2. then public/site-config.json fetched once with a cache-busting query, which replaces it if it differs;
//   3. in the owner's own browser only, a draft from the editor (#/admin) when "Preview this draft" is on.
// Applying a config also hands the deck and board defaults to the modules that read them.
import { useSyncExternalStore } from 'react';
import { defaultSiteConfig, featureOn, parseSiteConfig, parseSiteConfigText, SITE_CONFIG_FILE, type FeatureName, type SiteConfig } from '../lib/siteConfig';
import { setSiteHiddenDecks } from '../lib/hiddenDecks';
import { loadBoardSettings, setSiteBoardDefaults } from '../lib/boardSettings';
import { notifyLibraryChanged } from '../lib/browserLibrary';
import { applyLook } from './useBoardSettings';

/** The editor's draft (the file's text) and whether this browser previews it. */
export const DRAFT_KEY = 'nct.siteConfig.draft.v1';
export const PREVIEW_KEY = 'nct.siteConfig.preview.v1';
export const INLINE_ID = 'nct-site-config';

const store = () => {
  try {
    return typeof localStorage !== 'undefined' ? localStorage : null;
  } catch {
    return null;
  }
};

function readInline(): SiteConfig | null {
  if (typeof document === 'undefined') return null;
  const text = document.getElementById(INLINE_ID)?.textContent;
  if (!text) return null;
  return parseSiteConfigText(text).config;
}

function readDraft(): SiteConfig | null {
  const s = store();
  try {
    if (s?.getItem(PREVIEW_KEY) !== '1') return null;
    const text = s.getItem(DRAFT_KEY);
    return text ? parseSiteConfigText(text).config : null;
  } catch {
    return null;
  }
}

let published: SiteConfig = readInline() ?? defaultSiteConfig();
let draft: SiteConfig | null = readDraft();
let current: SiteConfig = draft ?? published;
let snapshot = { config: current, previewing: !!draft, published };
const subs = new Set<() => void>();

function sideEffects(c: SiteConfig, first: boolean) {
  setSiteHiddenDecks(c.decks.hidden);
  setSiteBoardDefaults(c.play.board);
  if (typeof document === 'undefined') return;
  document.title = c.site.title;
  document.querySelector('meta[name="description"]')?.setAttribute('content', c.site.tagline);
  // the look on <html>: a visitor's saved settings, with the owner's defaults for anything they never chose
  applyLook(loadBoardSettings());
  if (!first) notifyLibraryChanged(); // hidden decks may have changed
}
sideEffects(current, true);

function set(nextPublished: SiteConfig, nextDraft: SiteConfig | null) {
  published = nextPublished;
  draft = nextDraft;
  const next = draft ?? published;
  const changed = JSON.stringify(next) !== JSON.stringify(current);
  current = next;
  snapshot = { config: current, previewing: !!draft, published };
  if (changed) sideEffects(current, false);
  for (const f of [...subs]) f();
}

function subscribe(fn: () => void) {
  subs.add(fn);
  return () => void subs.delete(fn);
}
const get = () => snapshot;

/** The config in effect (the draft while previewing). */
export function useSiteConfig(): SiteConfig {
  return useSyncExternalStore(subscribe, get, get).config;
}
/** The config in effect, whether it is a previewed draft, and the published one. */
export function useSiteConfigState(): { config: SiteConfig; previewing: boolean; published: SiteConfig } {
  return useSyncExternalStore(subscribe, get, get);
}
/** The config in effect, outside React. */
export const siteConfig = (): SiteConfig => current;
/** Whether a feature is on (outside React; components use useFeature so they follow a change). */
export const featureEnabled = (name: FeatureName): boolean => featureOn(current, name);
export const useFeature = (name: FeatureName): boolean => featureOn(useSiteConfig(), name);

/** Fetch public/site-config.json (never from cache) and use it if it reads as a site config. */
export async function refreshSiteConfig(): Promise<void> {
  if (typeof fetch === 'undefined') return;
  try {
    const r = await fetch(`${import.meta.env.BASE_URL}${SITE_CONFIG_FILE}?t=${Date.now()}`, { cache: 'no-store' });
    if (!r.ok) return;
    const p = parseSiteConfig(await r.json());
    // a file that is not a site config at all keeps what we have; field errors fall back field by field
    if (p.errors.some((e) => e.path === '' || e.path === 'kind' || e.path === 'schema')) return;
    set(p.config, draft);
  } catch {
    /* offline or not deployed: keep the inlined or bundled config */
  }
}

/** Preview a draft in this browser only (null ends the preview). The draft text is saved for the editor either way. */
export function previewDraft(text: string | null): void {
  const s = store();
  try {
    if (text === null) s?.removeItem(PREVIEW_KEY);
    else {
      s?.setItem(DRAFT_KEY, text);
      s?.setItem(PREVIEW_KEY, '1');
    }
  } catch {
    /* storage blocked: the preview lasts for this visit */
  }
  set(published, text === null ? null : parseSiteConfigText(text).config);
}
