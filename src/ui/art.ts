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
const listeners = new Set<() => void>();

async function fetchAll(): Promise<void> {
  const next = new Map<string, string>();
  let offset = 0;
  let total = Infinity;
  while (offset < total) {
    const r = await fetch(`${API}?offset=${offset}&limit=60`);
    if (!r.ok) throw new Error(`art catalog ${r.status}`);
    const d = await r.json();
    total = d.total ?? 0;
    for (const c of d.items ?? []) if (c.external_id && c.image_url) next.set(c.external_id, c.image_url);
    offset += 60;
    if (!d.items?.length) break;
  }
  urls = next;
  fetchedAt = Date.now();
}

export function refreshArt(force = false): Promise<void> {
  if (inflight) return inflight;
  if (!force && Date.now() - fetchedAt < STALE_MS && urls.size) return Promise.resolve();
  inflight = fetchAll()
    .then(() => {
      failed = false;
    })
    .catch(() => {
      failed = true;
    })
    .finally(() => {
      inflight = null;
      listeners.forEach((l) => l());
    });
  return inflight;
}

export function artUrl(cardId: string): string | undefined {
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
export function artEnabled(): boolean {
  try {
    return localStorage.getItem(PREF) !== 'off';
  } catch {
    return true;
  }
}
export function setArtEnabled(on: boolean) {
  try {
    localStorage.setItem(PREF, on ? 'on' : 'off');
  } catch {
    /* ignore */
  }
  listeners.forEach((l) => l());
}
