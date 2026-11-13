// Tutorial progress in this browser: which lessons are done, and whether the Play page's "new here?" line was
// dismissed. One small versioned key, read defensively (anything unreadable is no progress); Start over removes it.
// Kept apart from the lessons so the Play setup screen can read it without loading the tutorial.
export const TUTORIAL_KEY = 'nct.tutorial.v1';
const KIND = 'nct-tutorial';
const SCHEMA = 1;
/** The lesson ids (src/content/tutorial/lessons.ts LESSONS), repeated here so this module stays tiny. */
export const LESSON_IDS = ['table', 'turn', 'attack', 'defend', 'legends', 'gear', 'gigs', 'together'] as const;

export interface TutorialProgress {
  /** lessons finished, in the order first finished */
  done: string[];
  /** the Play setup screen's pointer to the tutorial was dismissed */
  nudgeHidden: boolean;
}

const EMPTY = (): TutorialProgress => ({ done: [], nudgeHidden: false });

const store = (): Pick<Storage, 'getItem' | 'setItem' | 'removeItem'> | null => {
  try {
    return typeof localStorage !== 'undefined' ? localStorage : null;
  } catch {
    return null;
  }
};

/** Read the stored text: unknown kinds, other versions, unknown or repeated ids and junk are dropped. */
export function parseTutorial(text: string | null): TutorialProgress {
  if (!text) return EMPTY();
  let o: unknown;
  try {
    o = JSON.parse(text);
  } catch {
    return EMPTY();
  }
  if (!o || typeof o !== 'object' || Array.isArray(o)) return EMPTY();
  const r = o as Record<string, unknown>;
  if (r.kind !== KIND || r.schema !== SCHEMA) return EMPTY();
  const ids = new Set<string>(LESSON_IDS);
  const done: string[] = [];
  if (Array.isArray(r.done)) for (const x of r.done) if (typeof x === 'string' && ids.has(x) && !done.includes(x)) done.push(x);
  return { done, nudgeHidden: r.nudgeHidden === true };
}

export function loadTutorial(): TutorialProgress {
  try {
    return parseTutorial(store()?.getItem(TUTORIAL_KEY) ?? null);
  } catch {
    return EMPTY();
  }
}

function save(p: TutorialProgress) {
  try {
    store()?.setItem(TUTORIAL_KEY, JSON.stringify({ kind: KIND, schema: SCHEMA, done: p.done, ...(p.nudgeHidden ? { nudgeHidden: true } : {}) }));
  } catch {
    /* storage blocked or full: progress lasts for this visit only */
  }
}

/** Note a lesson as done (once). */
export function markDone(id: string): TutorialProgress {
  const p = loadTutorial();
  if (!p.done.includes(id) && (LESSON_IDS as readonly string[]).includes(id)) p.done.push(id);
  save(p);
  return p;
}

/** Dismiss the Play setup screen's pointer to the tutorial. */
export function hideNudge(): TutorialProgress {
  const p = loadTutorial();
  p.nudgeHidden = true;
  save(p);
  return p;
}

/** Start over: forget every finished lesson (and the dismissal). */
export function clearTutorial() {
  try {
    store()?.removeItem(TUTORIAL_KEY);
  } catch {
    /* storage blocked */
  }
}
