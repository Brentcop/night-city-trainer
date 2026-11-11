// Versions of the official rules sources the engine is checked against, recorded in every run manifest
// (src/lib/runManifest.ts). These are tracked constants, so manifests carry them without data/raw/ (which is local-only).
//
// How to update:
// - faqVersion: the `updated_at` of data/raw/official_rules_faq.json. When the FAQ changes, the conformance check
//   (tests/faq/consistency.test.ts) fails and lists new and removed ruling ids; triage them in tests/faq/matrix.ts,
//   then set FAQ_VERSION here to the new `updated_at`.
// - rulesVersion: the "LAST UPDATED" date at the top of data/raw/official_comprehensive_rules.txt, as YYYY-MM-DD.
// - errataVersion: the errata page (data/raw/official_errata.txt) shows no date or version, so it is not recorded (null).
//   Set it when the page carries one.

export const FAQ_VERSION = '2026-11-09T15:28:32.570Z';
export const RULES_VERSION = '2026-10-29';
export const ERRATA_VERSION: string | null = null;

/** The three version fields of a run manifest, ready to spread into createRunManifest / gameRunManifest input. */
export const RULES_VERSIONS: { rulesVersion: string | null; faqVersion: string | null; errataVersion: string | null } = {
  rulesVersion: RULES_VERSION,
  faqVersion: FAQ_VERSION,
  errataVersion: ERRATA_VERSION,
};
