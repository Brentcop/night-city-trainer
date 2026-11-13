// Knowledge pack sources (docs/RAG_PLAN.md step 1.2): reads every input file and hands the data to the pure builders
// in src/lib/kb/build/. The content modules are imported only when a build runs, so `npm run kb -- search` on a fresh
// cache loads none of them. Paths in records and in the manifest use forward slashes, from the repository root.
// data/raw/ is read only when present and only into `local` records (rule M6); nothing here writes a file.
import { createHash } from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { LIBRARY_DIRS, libraryDeck } from '../src/lib/library';
import { buildCards, cardDataVersion, type CardInput } from '../src/lib/kb/build/cards';
import { buildDecks, buildObjectives, deckRecordId, type DeckInput, type ObjectiveDeck } from '../src/lib/kb/build/decks';
import { buildErrata, buildFaq, buildRules, buildTournamentRules, type FaqItemInput } from '../src/lib/kb/build/local';
import { mentionLinker } from '../src/lib/kb/build/mentions';
import { assemblePack } from '../src/lib/kb/build/pack';
import { buildGlossary, buildPackages, buildVocabulary, termId } from '../src/lib/kb/build/packages';
import { buildCodeHeader, buildDocPassages, buildGuides } from '../src/lib/kb/build/prose';
import { buildRulings, rulingId, type RulingInput } from '../src/lib/kb/build/rulings';
import type { KbBuildReport, KbRecord } from '../src/lib/kb/types';

export const RAW_FILES = {
  rules: 'data/raw/official_comprehensive_rules.txt',
  faq: 'data/raw/official_rules_faq.json',
  tournament: 'data/raw/official_tournament_rules.txt',
  errata: 'data/raw/official_errata.txt',
} as const;

const CARDS_FILE = 'src/data/cards.json';
const FAQ_ENTRIES_DIR = 'tests/faq/entries';
const OBJECTIVES_DIR = 'src/content/deckObjectives';
const CODE_DIRS = ['src', 'scripts', 'tools'];
/**
 * Not read: the tutorial content (being written), generated modules, unmaintained one-off scripts. The `insights`
 * arrays of src/data/analysis.json are not read either (plan step 0.3), and neither are archived decks (D9).
 */
const CODE_SKIP = [/^src\/content\/tutorial\//, /^src\/content\/(tournamentPlan|recommendation)\.ts$/, /^scripts\/archive\//];
/** Guides whose text is generated (by scripts/plan.ts), not written. */
const GUIDE_SKIP = new Set(['tournament-plan']);

function walk(root: string, dir: string, keep: (rel: string) => boolean): string[] {
  const abs = path.join(root, dir);
  if (!fs.existsSync(abs)) return [];
  const out: string[] = [];
  for (const e of fs.readdirSync(abs, { withFileTypes: true })) {
    const rel = `${dir}/${e.name}`;
    if (e.isDirectory()) out.push(...walk(root, rel, keep));
    else if (keep(rel)) out.push(rel);
  }
  return out;
}

const listDir = (root: string, dir: string, ext: string) =>
  fs.existsSync(path.join(root, dir)) ? fs.readdirSync(path.join(root, dir)).filter((f) => f.endsWith(ext)).sort().map((f) => `${dir}/${f}`) : [];

export const rawPresent = (root: string): boolean => Object.values(RAW_FILES).some((f) => fs.existsSync(path.join(root, f)));

/** The source files with a header comment record (.ts / .tsx under src/, scripts/, tools/, minus CODE_SKIP), sorted. */
export function codeFiles(root: string): string[] {
  return CODE_DIRS.flatMap((d) => walk(root, d, (rel) => /\.tsx?$/.test(rel) && !CODE_SKIP.some((re) => re.test(rel)))).sort();
}

export function docFiles(root: string): string[] {
  return [...['CLAUDE.md', 'README.md'].filter((f) => fs.existsSync(path.join(root, f))), ...listDir(root, 'docs', '.md')];
}

/** The library deck files (LIBRARY_DIRS: the top level of data/decks and custom/), as paths from the root. */
export function deckFiles(root: string): string[] {
  return LIBRARY_DIRS.flatMap((sub) => listDir(root, sub ? `data/decks/${sub}` : 'data/decks', '.txt'));
}

/** Every file a build reads, sorted: what the manifest hashes to know when the pack is stale. */
export function inputFiles(root: string, o: { raw: boolean }): string[] {
  const files = new Set<string>([CARDS_FILE, 'tests/faq/matrix.ts', ...listDir(root, FAQ_ENTRIES_DIR, '.ts'), ...deckFiles(root), ...docFiles(root), ...codeFiles(root)]);
  if (o.raw) for (const f of Object.values(RAW_FILES)) if (fs.existsSync(path.join(root, f))) files.add(f);
  return [...files].sort();
}

export function hashInputs(root: string, files: readonly string[]): Record<string, string> {
  const out: Record<string, string> = {};
  for (const f of files) out[f] = createHash('sha256').update(fs.readFileSync(path.join(root, f))).digest('hex').slice(0, 16);
  return out;
}

export interface SourceBuild {
  records: KbRecord[];
  report: KbBuildReport;
  local: boolean;
  /** the tracked versions (src/lib/rulesVersions.ts); a local record carries the version its own file shows */
  rulesVersion: string | null;
  faqVersion: string | null;
  cardDataVersion: string;
}

/** 1-based line of the first line of `text` that contains `needle`. */
const lineOf = (text: string, needle: string): number | undefined => {
  const i = text.indexOf(needle);
  return i < 0 ? undefined : text.slice(0, i).split('\n').length;
};

/** Build every record from the files under `root`. With `raw: false` (or no data/raw) only public records are made. */
export async function buildFromSources(root: string, o: { raw?: boolean } = {}): Promise<SourceBuild> {
  const read = (f: string) => fs.readFileSync(path.join(root, f), 'utf8');
  const [{ FAQ_MATRIX }, { FAQ_VERSION, RULES_VERSION }, objectivesModule, synergiesModule, { GLOSSARY }, { GUIDES }, { listFingerprint, deckColors }] = await Promise.all([
    import('../tests/faq/matrix'),
    import('../src/lib/rulesVersions'),
    import('../src/content/deckObjectives/index'),
    import('../src/content/synergies/index'),
    import('../src/content/glossary'),
    import('../src/content/guides'),
    import('../src/engine/deck'),
  ]);
  const skipped: Record<string, number> = {};
  const skip = (why: string) => (skipped[why] = (skipped[why] ?? 0) + 1);

  // cards
  const cards = JSON.parse(read(CARDS_FILE)) as CardInput[];
  const cardById = new Map(cards.map((c) => [c.id, c]));
  const cardName = (id: string) => cardById.get(id)?.displayName;
  const linker = mentionLinker(cards);
  const cdv = cardDataVersion(cards);
  const records: KbRecord[] = buildCards(cards, { file: CARDS_FILE, cardDataVersion: cdv });

  // rulings: our paraphrases, with the file and line each is written on
  const entryTexts = listDir(root, FAQ_ENTRIES_DIR, '.ts').map((f) => ({ f, text: read(f) }));
  const rulings: RulingInput[] = FAQ_MATRIX.map((e) => {
    const at = entryTexts.find((x) => x.text.includes(e.id));
    return { ...e, file: at?.f ?? 'tests/faq/matrix.ts', line: at ? lineOf(at.text, e.id) : undefined };
  });
  records.push(...buildRulings(rulings, { cardName, linker, faqVersion: FAQ_VERSION, rulesVersion: RULES_VERSION }));

  // synergy packages, with their resolved members
  const { SYNERGIES, membersOf, synergiesIn, CATALOGUE_VERSION, CONDITION_TERMS } = synergiesModule;
  const packageName = new Map(SYNERGIES.map((s) => [s.id, s.name]));
  records.push(...buildPackages(SYNERGIES.map((s) => ({ ...s, members: membersOf(s) })), { cardName, linker, file: 'src/content/synergies/catalogue.ts', catalogueVersion: CATALOGUE_VERSION }));

  // library decks
  const decks: DeckInput[] = [];
  for (const rel of deckFiles(root)) {
    const d = libraryDeck(rel.slice('data/decks/'.length), read(rel));
    if (!d) continue;
    decks.push({
      file: d.file,
      path: rel,
      name: d.deck.name,
      kind: d.kind,
      legends: d.deck.legends,
      main: d.deck.main,
      sideboard: d.deck.sideboard,
      prov: d.prov,
      tier: d.tier,
      idea: d.idea,
      listId: listFingerprint(d.deck),
      deckId: d.deckId ?? '',
      colors: deckColors(d.deck),
      packages: synergiesIn(d.deck).filter((x) => x.builtAround).map((x) => x.synergy.id),
    });
  }
  records.push(...buildDecks(decks, { cardName, packageName: (id) => packageName.get(id) }));

  // deck notes, each traced to the table file that holds it
  const objectiveDecks = new Map<string, ObjectiveDeck>(decks.map((d) => [d.file, { name: d.name, listId: d.listId, cards: [...d.legends, ...d.main, ...d.sideboard] }]));
  const objectiveTexts = listDir(root, OBJECTIVES_DIR, '.ts').map((f) => ({ f, text: read(f) }));
  records.push(
    ...buildObjectives(objectivesModule.DECK_OBJECTIVES, {
      decks: objectiveDecks,
      cardName,
      linker,
      skipped,
      file: (deckFile) => objectiveTexts.find((x) => x.text.includes(`'${deckFile}'`))?.f ?? `${OBJECTIVES_DIR}/index.ts`,
    }),
  );

  // vocabularies and glossary
  records.push(...buildVocabulary(objectivesModule.VOCABULARY, { family: 'signal', file: `${OBJECTIVES_DIR}/vocabulary.ts` }));
  records.push(...buildVocabulary(CONDITION_TERMS, { family: 'condition', file: 'src/content/synergies/vocabulary.ts' }));
  records.push(...buildGlossary(GLOSSARY, { linker, file: 'src/content/glossary.ts' }));

  // guides
  const guideFile = (slug: string) => (slug.startsWith('nc-') ? 'src/content/ncGuides.ts' : slug === 'fundamentals' ? 'src/content/fundamentals.ts' : slug === 'deck-forge' ? 'src/content/forgeProcess.ts' : 'src/content/guides.ts');
  const guideDecks = new Map(decks.map((d) => [d.file, { id: deckRecordId(d.file), cards: [...d.legends, ...d.main, ...d.sideboard] }]));
  const guides = GUIDES.filter((g) => !GUIDE_SKIP.has(g.slug)).map((g) => ({ ...g, file: guideFile(g.slug) }));
  records.push(...buildGuides(guides, { decks: guideDecks, linker, skipped }));

  // docs and code headers
  for (const f of docFiles(root)) records.push(...buildDocPassages(f, read(f), { linker, bulletLeads: f === 'CLAUDE.md' }));
  for (const f of codeFiles(root)) {
    const r = buildCodeHeader(f, read(f), { linker });
    if (r) records.push(r);
    else skip('code: no header comment');
  }

  // local only: data/raw
  const has = (f: string) => o.raw !== false && fs.existsSync(path.join(root, f));
  let local = false;
  if (has(RAW_FILES.rules)) {
    const citations = GLOSSARY.filter((t) => t.rule?.startsWith('CR ')).map((t) => ({ id: termId(t.term), cite: t.rule! }));
    records.push(...buildRules(read(RAW_FILES.rules), { file: RAW_FILES.rules, citations }));
    local = true;
  }
  if (has(RAW_FILES.faq)) {
    const faq = JSON.parse(read(RAW_FILES.faq)) as { updated_at?: string; items?: FaqItemInput[] };
    const rulingCard = new Map(FAQ_MATRIX.map((e) => [rulingId(e.id), e.cardId]));
    records.push(...buildFaq(faq.items ?? [], { file: RAW_FILES.faq, version: faq.updated_at ?? null, rulingCard }));
    local = true;
  }
  if (has(RAW_FILES.tournament)) {
    records.push(...buildTournamentRules(read(RAW_FILES.tournament), { file: RAW_FILES.tournament }));
    local = true;
  }
  if (has(RAW_FILES.errata)) {
    records.push(...buildErrata(read(RAW_FILES.errata), { file: RAW_FILES.errata, linker }));
    local = true;
  }

  const { records: out, report } = assemblePack(records, { mentions: linker.report(), skipped });
  return { records: out, report, local, rulesVersion: RULES_VERSION, faqVersion: FAQ_VERSION, cardDataVersion: cdv };
}

