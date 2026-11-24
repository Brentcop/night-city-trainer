// The slices of the telemetry reports the site loads (src/lib/telemetrySlices.ts, 2026-11-24): each is cut from the
// stored report, gives the same numbers as the report it is cut from, and the stored files are that cut (check:data).
import fs from 'node:fs';
import { describe, expect, it } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import type { DecisionReport } from '../src/analysis/decisions';
import { CARD_BY_ID } from '../src/engine/cards';
import { DECISION_TELEMETRY_SCHEMA } from '../src/engine/telemetry';
import { sellShares } from '../src/lib/sellShare';
import { analysisSummary, decisionIndex, isDeckStub, readSellSlice, sellReportOf, sellSlice, telemetrySliceFiles, type AnalysisSite } from '../src/lib/telemetrySlices';
import { labSellLookup } from '../src/ui/components/LabSells';
import { DecisionReportView, readReport } from '../src/ui/components/DecisionStats';
import { sliceProblems } from '../scripts/build-telemetry-slices';

const DEC = JSON.parse(fs.readFileSync('reports/decisions-latest.json', 'utf8')) as DecisionReport;
const ANA = JSON.parse(fs.readFileSync('src/data/analysis.json', 'utf8')) as AnalysisSite;
const program = (id: string) => CARD_BY_ID[id]?.type === 'Program';
const plain = (xs: ReturnType<typeof sellShares>) => xs.map((s) => [s.cardId, s.sold, s.uses, s.sells]).sort((a, b) => String(a[0]).localeCompare(String(b[0])));

describe('the stored slices', () => {
  it('are the cut of reports/decisions-latest.json and src/data/analysis.json (rebuild with npx tsx scripts/build-telemetry-slices.ts)', () => {
    expect(sliceProblems('.')).toMatchObject({ failures: [] });
    const files = telemetrySliceFiles({ decisions: DEC, analysis: ANA });
    expect(files.size).toBe(2 + DEC.decks.length + 1 + ANA.decks.filter((d) => d.id).length);
  });
});

describe('the sells slice', () => {
  const slice = readSellSlice(JSON.parse(JSON.stringify(sellSlice(DEC))), DECISION_TELEMETRY_SCHEMA)!;
  it('gives the sell shares the whole report gives, pooled and on every list', () => {
    expect(slice).not.toBeNull();
    const back = sellReportOf(slice);
    expect(plain(sellShares(back, { reactFromHand: program }))).toEqual(plain(sellShares(DEC, { reactFromHand: program })));
    for (const d of DEC.decks) expect(plain(sellShares(back, { listId: d.listId, reactFromHand: program })), d.name).toEqual(plain(sellShares(DEC, { listId: d.listId, reactFromHand: program })));
  });
  it('gives the Deck Lab the same tags, naming the same run', () => {
    const back = sellReportOf(slice);
    const ids = Object.keys(CARD_BY_ID);
    for (const listId of [DEC.decks[0]!.listId, null]) {
      const a = labSellLookup(DEC, listId);
      const b = labSellLookup(back, listId);
      for (const id of ids) {
        const x = a(id);
        const y = b(id);
        expect(y?.share.share ?? null, id).toBe(x?.share.share ?? null);
        expect(y && { ...y.basis, scope: y.scope, decks: y.decks }).toEqual(x && { ...x.basis, scope: x.scope, decks: x.decks });
      }
    }
  });
  it('is refused when it is not a slice of the telemetry schema the site reads', () => {
    expect(readSellSlice({ ...slice, telemetrySchema: -1 }, DECISION_TELEMETRY_SCHEMA)).toBeNull();
    expect(readSellSlice({ kind: 'other' }, DECISION_TELEMETRY_SCHEMA)).toBeNull();
    expect(readSellSlice(null, DECISION_TELEMETRY_SCHEMA)).toBeNull();
  });
});

describe('the decision index and its deck parts', () => {
  const index = decisionIndex(DEC);
  it('is the report without its decks’ bodies and calibration; a part is a deck as stored', () => {
    expect(Object.keys(index)).toEqual(Object.keys(DEC).filter((k) => k !== 'calibration'));
    expect(index.decks.every(isDeckStub)).toBe(true);
    expect(index.decks.map((d) => d.listId)).toEqual(DEC.decks.map((d) => d.listId));
    expect(index.pooled).toBe(DEC.pooled);
    expect(JSON.stringify(index).length).toBeLessThan(JSON.stringify(DEC).length / 5);
    expect(readReport(JSON.parse(JSON.stringify(index))).state).toBe('ready');
  });
  it('the view shows a stub deck as loading until its part comes, and the pooled rows at once', () => {
    const loaded = readReport(JSON.parse(JSON.stringify(index)));
    const html = renderToStaticMarkup(<DecisionReportView loaded={loaded} listId={DEC.decks[0]!.listId} loadDeck={async () => null} />);
    expect(html).toMatch(/<p class="muted">Loading [^<]+…<\/p>/);
    expect(html).toContain('<select');
  });
});

describe('the analysis summary', () => {
  it('carries each deck’s win rates, the tempo row after turn 4 and the matchups, as the whole report has them', () => {
    const s = analysisSummary(ANA);
    expect(s.decks.map((d) => d.deck)).toEqual(ANA.decks.map((d) => d.deck));
    for (const [i, d] of s.decks.entries()) {
      const r = ANA.decks[i]!;
      expect([d.id, d.games, d.wr, d.wrFirst, d.wrSecond]).toEqual([r.id, r.games, r.wr, r.wrFirst, r.wrSecond]);
      expect(d.tempo4).toEqual(r.tempo[3] ?? null);
      expect(d.matchups.map((m) => m.opp)).toEqual(r.matchups.map((m) => m.opp));
    }
    expect([s.bot, s.manifest?.simVersion, s.manifest?.bot?.level]).toEqual([ANA.bot, ANA.manifest?.simVersion, ANA.manifest?.bot?.level]);
    expect(JSON.stringify(s).length).toBeLessThan(40_000);
  });
});
