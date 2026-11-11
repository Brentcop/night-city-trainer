// Card art loader. The official card database (api.netdeck.gg) serves short-lived signed image URLs, so we never
// store art: we fetch the catalog at runtime, keep the URL map in memory, and refresh it when it goes stale or an
// image fails to load. Without network access, components fall back to a styled text frame.
import { useEffect, useState } from 'react';
import { CARD_BY_ID } from '../engine/cards';

const API = 'https://api.netdeck.gg/api/cards/cyberpunk';
const STALE_MS = 4 * 60 * 1000; // signed URLs live ~5 minutes

let urls = new Map<string, string>(); // eid -> signed url
let fetchedAt = 0;
let inflight: Promise<void> | null = null;
let failed = false;
// after a failed fetch, wait before trying again (15 s, doubling to 10 min) instead of refetching on every mount
let failures = 0;
let failedAt = 0;
const backoffMs = () => Math.min(10 * 60_000, 15_000 * 2 ** Math.max(0, failures - 1));
const listeners = new Set<() => void>();

async function fetchAll(): Promise<void> {
  // Fetch the catalog pages in parallel (≈152 cards = 3 pages); fetch more if the set grows.
  const page = async (offset: number) => {
    const r = await fetch(`${API}?offset=${offset}&limit=60`);
    if (!r.ok) throw new Error(`art catalog ${r.status}`);
    return r.json() as Promise<{ total?: number; items?: { external_id?: string; image_url?: string }[] }>;
  };
  const pages = await Promise.all([0, 60, 120].map(page));
  const total = pages[0].total ?? 0;
  for (let offset = 180; offset < total; offset += 60) pages.push(await page(offset));
  const next = new Map<string, string>();
  for (const d of pages) for (const c of d.items ?? []) if (c.external_id && c.image_url) next.set(c.external_id, c.image_url);
  urls = next;
  fetchedAt = Date.now();
}

export function refreshArt(force = false): Promise<void> {
  if (!artEnabled()) return Promise.resolve(); // art off: never contact the third-party catalog
  if (inflight) return inflight;
  if (failures && Date.now() - failedAt < backoffMs()) return Promise.resolve();
  if (!force && Date.now() - fetchedAt < STALE_MS && urls.size) return Promise.resolve();
  inflight = fetchAll()
    .then(() => {
      failed = false;
      failures = 0;
    })
    .catch(() => {
      failed = true;
      failures++;
      failedAt = Date.now();
    })
    .finally(() => {
      inflight = null;
      listeners.forEach((l) => l());
    });
  return inflight;
}

function artUrl(cardId: string): string | undefined {
  const eid = CARD_BY_ID[cardId]?.eid;
  return eid ? urls.get(eid) : undefined;
}

/** React hook: current art URL for a card (undefined while loading / unavailable) + error handler that refreshes. */
export function useArt(cardId: string | undefined): { url?: string; onError: () => void; unavailable: boolean } {
  const [, bump] = useState(0);
  useEffect(() => {
    const l = () => bump((n) => n + 1);
    listeners.add(l);
    refreshArt();
    return () => {
      listeners.delete(l);
    };
  }, []);
  return {
    url: cardId ? artUrl(cardId) : undefined,
    unavailable: failed && !urls.size,
    onError: () => {
      if (Date.now() - fetchedAt > 30_000) refreshArt(true);
    },
  };
}

/** Preference: show card art or text frames (persisted per browser). */
const PREF = 'nct.art.v1';
let enabled: boolean | null = null; // cached: every card reads it on render
export function artEnabled(): boolean {
  if (enabled === null) {
    try {
      enabled = localStorage.getItem(PREF) !== 'off';
    } catch {
      enabled = true;
    }
  }
  return enabled;
}
export function setArtEnabled(on: boolean) {
  enabled = on;
  try {
    localStorage.setItem(PREF, on ? 'on' : 'off');
  } catch {
    /* ignore */
  }
  if (on) {
    failures = 0; // turning art on is an explicit retry
    refreshArt();
  }
  listeners.forEach((l) => l());
}
