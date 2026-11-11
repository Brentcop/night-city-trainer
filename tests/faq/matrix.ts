// Official Rules FAQ conformance matrix (backlog ENG-16, ROADMAP §5 "Rules-conformance gate").
//
// One entry per FAQ ruling (the `id` of an item in data/raw/official_rules_faq.json, which is local-only and not in
// the repository). The FAQ's own wording stays out of tracked files: an entry holds the ruling id, our card id, a
// one-line paraphrase in our words, and the test that checks it. tests/faq/consistency.test.ts keeps the matrix in
// step with the local FAQ file and checks that every cited test exists.
//
// Status:
//   covered         a test sets up the situation and asserts the engine does what the ruling says
//   fixed           the engine or a card script disagreed; it was fixed, and the test now covers it
//   divergence      the engine does something else; `note` says what, and `test` names a skipped/todo test
//   not-applicable  nothing the engine models (tournament procedure, a definition with no engine behaviour, ...); `note` says why
//   pending         not triaged yet (allowed only while the matrix is being filled)
//
// `test` is either a file whose test titles name the ruling as `faq:<first 8 characters of its id>` (the tests in
// tests/faq/), or `<file> > <title substring>` to cite an existing test elsewhere.
//
// When the FAQ updates: refresh data/raw/official_rules_faq.json, run `npx vitest run tests/faq` (the consistency test
// lists new and removed ruling ids), triage them here, then set FAQ_VERSION in src/lib/rulesVersions.ts to the file's
// `updated_at`.
import { FAQ_VERSION } from '../../src/lib/rulesVersions';
import { GENERAL } from './entries/general';
import { RED } from './entries/red';
import { BLUE } from './entries/blue';
import { GREEN } from './entries/green';
import { YELLOW } from './entries/yellow';

export type FaqStatus = 'covered' | 'fixed' | 'divergence' | 'not-applicable' | 'pending';

export interface FaqEntry {
  /** the FAQ item's `id` */
  id: string;
  /** 'game': a general ruling; 'card': a ruling about one card */
  scope: 'game' | 'card';
  /** our card id (src/data/cards.json) for a card ruling, mapped from the FAQ card's external id / name */
  cardId: string | null;
  /** the ruling in one line, in our own words */
  paraphrase: string;
  status: FaqStatus;
  /** see the header: a test file, or `<file> > <title substring>` */
  test: string | null;
  note?: string;
}

/** The FAQ `updated_at` this matrix was triaged against (also recorded in run manifests as `faqVersion`). */
export const faqVersion = FAQ_VERSION;

export const FAQ_MATRIX: FaqEntry[] = [...GENERAL, ...RED, ...BLUE, ...GREEN, ...YELLOW];

/** The tag test titles use for a ruling: `faq:` and the first 8 characters of its id. */
export const faqTag = (id: string) => `faq:${id.slice(0, 8)}`;
