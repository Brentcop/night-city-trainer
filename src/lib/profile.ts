// The player's profile choices, kept in this browser (localStorage) only: a display name, a picture (a card id: the art
// itself is never stored), a favourite deck, and which sections are public (included when the profile is shared). The
// stats are never stored here: src/lib/profileStats.ts derives them from the recorded practice games at read time.
// The stored value is one plain, versioned JSON document, so a server could later keep the same document unchanged.
// Pure apart from loadProfile / saveProfile / deleteProfile.

export const PROFILE_KEY = 'nct.profile.v1';
export const PROFILE_SCHEMA = 1;

/** The profile's sections, each public or private on its own (all private by default). */
export const PROFILE_SECTIONS = ['identity', 'favourite', 'headline', 'history', 'deckStats', 'decks'] as const;
export type ProfileSection = (typeof PROFILE_SECTIONS)[number];

export const SECTION_LABEL: Record<ProfileSection, string> = {
  identity: 'Name and picture',
  favourite: 'Favourite deck',
  headline: 'Headline numbers',
  history: 'Game history',
  deckStats: 'Deck stats',
  decks: 'Deck lists',
};

export const SECTION_HELP: Record<ProfileSection, string> = {
  identity: 'The display name you typed and the card you picked as your picture.',
  favourite: 'The name and Legends of your favourite deck (no game counts).',
  headline: 'Games played, win rate, record by bot tier, streaks and the average coach grade.',
  history: 'Your most recent practice games: decks, bot tier, result, turns, Gigs, coach grade and date.',
  deckStats: 'Per deck you played: record, first and second player split, record by rival deck and bot tier.',
  decks: 'The decks saved in this browser (imported, created, tuned, bred) with their card lists.',
};

/** Caps on what a player can type (the share payload applies the same caps to what it reads). */
export const NAME_MAX = 40;
export const FILE_MAX = 200;

export interface ProfileDoc {
  kind: 'nct-profile-settings';
  schema: 1;
  /** display name, optional ('' = none) */
  name: string;
  /** the card whose art is the picture (a card id from the catalogue), or null for none */
  picture: string | null;
  /** the favourite deck by library file (`custom:<name>` for a deck saved here), or null for "most played" */
  favourite: string | null;
  /** which sections are public; anything missing is private */
  public: Record<ProfileSection, boolean>;
  /** when the choices were last changed (ISO), '' if never */
  updatedAt: string;
}

export const DEFAULT_PUBLIC: Readonly<Record<ProfileSection, boolean>> = Object.freeze({
  identity: false,
  favourite: false,
  headline: false,
  history: false,
  deckStats: false,
  decks: false,
});

export const emptyProfile = (): ProfileDoc => ({ kind: 'nct-profile-settings', schema: 1, name: '', picture: null, favourite: null, public: { ...DEFAULT_PUBLIC }, updatedAt: '' });

/** Card ids are lower-case words joined by underscores (src/data/cards.json). */
export const CARD_ID = /^[a-z0-9_]{1,80}$/;

/** Text a player typed or a payload carried: control characters removed, spaces collapsed, trimmed, capped. */
export function cleanText(v: unknown, max: number): string {
  if (typeof v !== 'string') return '';
  const s = v.replace(/[\u0000-\u001f\u007f-\u009f​-‏‪-‮⁦-⁩]/g, ' ').replace(/\s+/g, ' ').trim();
  return [...s].slice(0, max).join('');
}

/**
 * A stored or imported settings document, validated: unknown fields are dropped, bad ones fall back to their default,
 * and every section not explicitly public is private. A document from a newer schema is refused (null).
 */
export function parseProfile(raw: string | null): ProfileDoc | null {
  if (!raw) return emptyProfile();
  let v: unknown;
  try {
    v = JSON.parse(raw);
  } catch {
    return emptyProfile();
  }
  return toProfile(v);
}

export function toProfile(v: unknown): ProfileDoc | null {
  if (!v || typeof v !== 'object' || Array.isArray(v)) return emptyProfile();
  const o = v as Record<string, unknown>;
  if (o.kind !== 'nct-profile-settings') return emptyProfile();
  if (typeof o.schema === 'number' && o.schema > PROFILE_SCHEMA) return null;
  const pub = (o.public && typeof o.public === 'object' ? o.public : {}) as Record<string, unknown>;
  return {
    kind: 'nct-profile-settings',
    schema: 1,
    name: cleanText(o.name, NAME_MAX),
    picture: typeof o.picture === 'string' && CARD_ID.test(o.picture) ? o.picture : null,
    favourite: typeof o.favourite === 'string' && o.favourite && o.favourite.length <= FILE_MAX ? o.favourite : null,
    public: Object.fromEntries(PROFILE_SECTIONS.map((k) => [k, pub[k] === true])) as Record<ProfileSection, boolean>,
    updatedAt: typeof o.updatedAt === 'string' && !Number.isNaN(Date.parse(o.updatedAt)) ? o.updatedAt : '',
  };
}

/** The profile in this browser (the defaults when nothing is saved, storage is blocked, or it was saved by a newer version). */
export function loadProfile(): ProfileDoc {
  try {
    return parseProfile(localStorage.getItem(PROFILE_KEY)) ?? emptyProfile();
  } catch {
    return emptyProfile();
  }
}

/** True when this browser holds a profile saved by a newer version of the site (it is left alone, not overwritten). */
export function profileFromNewerVersion(): boolean {
  try {
    return parseProfile(localStorage.getItem(PROFILE_KEY)) === null;
  } catch {
    return false;
  }
}

export const PROFILE_CHANGED = 'nct:profile-changed';

/** Save the choices (cleaned and stamped). Returns the saved document, or null if storage refused it. */
export function saveProfile(p: ProfileDoc, now = new Date().toISOString()): ProfileDoc | null {
  const doc = toProfile({ ...p, updatedAt: now }) ?? emptyProfile();
  try {
    localStorage.setItem(PROFILE_KEY, JSON.stringify(doc));
  } catch {
    return null;
  }
  try {
    if (typeof window !== 'undefined' && typeof window.dispatchEvent === 'function') window.dispatchEvent(new Event(PROFILE_CHANGED));
  } catch {
    /* no window */
  }
  return doc;
}

/** Remove the profile's choices (name, picture, favourite, privacy) from this browser. The game history is separate. */
export function deleteProfile(): boolean {
  try {
    localStorage.removeItem(PROFILE_KEY);
  } catch {
    return false;
  }
  try {
    if (typeof window !== 'undefined' && typeof window.dispatchEvent === 'function') window.dispatchEvent(new Event(PROFILE_CHANGED));
  } catch {
    /* no window */
  }
  return true;
}
