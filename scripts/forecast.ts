// The regionals forecast on the command line (docs/FORECAST.md; the page is #/forecast): each deck's chance to make a top
// cut of a Swiss tournament of N players drawn from a field, with 90% ranges from the ratings' uncertainty, and the
// opponents that decide it. Reads public/data/h2h.json (the power ratings and head-to-heads of the recorded events) and
// writes nothing. Same code and seed as the page, so the same numbers.
//
//   npx tsx scripts/forecast.ts [--players 128] [--rounds N] [--best-of 3] [--top 8] [--no-cut-play]
//     [--field uniform|outside|outside:<source id>|FILE] [--trials 300] [--draws 100] [--seed 1] [--rows N] [--json]
//
// --rounds        Swiss rounds (default ⌈log₂ players⌉, enough for one undefeated player; the regionals' own count may differ)
// --best-of       1 or 3 (5 also works)
// --top           top cut, rounded down to a power of two that fits (0 = none)
// --no-cut-play   do not play the cut (no title chance)
// --field         uniform (default): every rated library deck equally often, "no information about what people play";
//                 FILE: your field, `deck name: weight` lines, or JSON ({ "weights": { "<deck>": 3 } } or
//                 [{ "deck": "<deck>", "weight": 3 }], with an optional "label" and "source");
//                 outside[:id]: an outside source's shares (src/data/outsideMeta.json, only when that file exists)
// --draws         parameter draws (each a set of ratings drawn from the fit's covariance); --trials tournaments per draw
// --rows          print only the first N decks (default all)
// --json          print the result as JSON (the field included) instead of the table
import fs from 'node:fs';
import path from 'node:path';
import { bool, cli, int, loadLibrary, Refusal, runMain, str } from './lib-node';
import { FORECAST_DEFAULTS, modelFromH2HFile, runForecast, tournamentOf } from '../src/lib/forecast';
import { FieldError, jsonField, outsideField, uniformField, userField, type ForecastFieldInput } from '../src/lib/forecastField';
import { decidesWords, FORECAST_WORDS, forecastVersionNote, pct, rangeText, runWords, sourceWords, tournamentWords, widthWords } from '../src/lib/forecastWords';
import type { OutsideMetaFile } from '../src/lib/outsideMeta';

const { values: V } = cli(import.meta.url, {
  players: int(128, { min: 2, max: 4096 }),
  rounds: int(undefined, { min: 1, max: 20 }),
  'best-of': int(3, { min: 1, max: 5 }),
  top: int(8, { min: 0, max: 4096 }),
  'no-cut-play': bool(),
  field: str('uniform'),
  trials: int(FORECAST_DEFAULTS.trials, { min: 1, max: 100_000 }),
  draws: int(FORECAST_DEFAULTS.draws, { min: 1, max: 10_000 }),
  seed: int(FORECAST_DEFAULTS.seed),
  rows: int(undefined, { min: 1, max: 10_000 }),
  json: bool(),
});

const OUTSIDE = 'src/data/outsideMeta.json';

function fieldOf(names: string[]): ForecastFieldInput {
  const f = V.field;
  if (f === 'uniform') return uniformField(names);
  if (f === 'outside' || f.startsWith('outside:')) {
    if (!fs.existsSync(OUTSIDE)) throw new Refusal(`${OUTSIDE} is not in this checkout, so there is no outside field (docs/FORECAST.md "The field")`);
    const file = JSON.parse(fs.readFileSync(OUTSIDE, 'utf8')) as OutsideMetaFile;
    const id = f.slice('outside:'.length);
    const source = id ? file.sources.find((s) => s.id === id) : file.sources[0];
    if (!source) throw new Refusal(`no outside source ${JSON.stringify(id)}; the file has ${file.sources.map((s) => s.id).join(', ')}`);
    return outsideField(names, loadLibrary(), source);
  }
  if (!fs.existsSync(f)) throw new Refusal(`no field file ${f} (or use --field uniform)`);
  const text = fs.readFileSync(f, 'utf8');
  const label = `Your field (${path.basename(f)})`;
  if (/\.json$/i.test(f)) return jsonField(names, JSON.parse(text), label);
  return userField(names, text, label);
}

runMain(async () => {
  if (![1, 3, 5].includes(V['best-of'])) throw new Refusal('--best-of must be 1, 3 or 5');
  const model = modelFromH2HFile(JSON.parse(fs.readFileSync('public/data/h2h.json', 'utf8')));
  const versionNote = forecastVersionNote(model.source);
  // with --json on stderr, so the output stays one document (the table prints it beside the model)
  if (versionNote && V.json) console.error(`Warning: ${versionNote}`);
  let field: ForecastFieldInput;
  try {
    field = fieldOf(model.names);
  } catch (e) {
    if (e instanceof FieldError) throw new Refusal(`the field: ${e.message}${e.problems.length ? `\n  ${e.problems.join('\n  ')}` : ''}`);
    throw e;
  }
  const t = tournamentOf({ players: V.players, rounds: V.rounds, bestOf: V['best-of'] as 1 | 3 | 5, top: V.top, playCut: !V['no-cut-play'] });
  const started = Date.now();
  const res = runForecast(model, { weights: field.weights }, t, { draws: V.draws, trials: V.trials, seed: V.seed });
  const secs = (Date.now() - started) / 1000;
  if (V.json) {
    console.log(JSON.stringify({ field, result: res }, null, 1));
    return;
  }
  const rows = [...res.decks].sort((a, b) => b.conversion.mean - a.conversion.mean || a.name.localeCompare(b.name)).slice(0, V.rows ?? Infinity);
  const out = [
    `Regionals forecast: ${tournamentWords(res.tournament)}.`,
    FORECAST_WORDS.what,
    `Model: ${sourceWords(res.source)}.${versionNote ? ` Warning: ${versionNote}` : ''}`,
    `Field: ${field.label}. Source: ${field.source}.${field.leftOutShare > 0 ? ` Left out: ${pct(field.leftOutShare)} of it (${field.leftOut.slice(0, 4).map((x) => `${x.name}: ${x.why}`).join('; ')}${field.leftOut.length > 4 ? '; …' : ''}).` : ''}`,
    ...field.problems.map((p) => `  note: ${p}`),
    `Run: ${runWords(res)}; ${secs.toFixed(1)} s.`,
    FORECAST_WORDS.ranges,
    widthWords(res),
    '',
    `${'#'.padStart(3)}  ${'Deck'.padEnd(46)} ${'Share'.padStart(6)} ${'Players'.padStart(7)}  ${'Makes the cut (one player)'.padEnd(26)} ${'At least one'.padEnd(20)} ${'Cut seats'.padEnd(20)} ${res.tournament.playCut && res.tournament.top ? 'Title' : ''}`,
    ...rows.map((d, i) =>
      [
        String(i + 1).padStart(3),
        ' ',
        d.name.slice(0, 46).padEnd(46),
        pct(d.weight).padStart(6),
        d.expectedPlayers.toFixed(1).padStart(7),
        ' ',
        rangeText(d.conversion).padEnd(26),
        rangeText(d.anyInCut).padEnd(20),
        rangeText(d.cutShare).padEnd(20),
        d.title ? rangeText(d.title) : '',
      ].join(' '),
    ),
    '',
    FORECAST_WORDS.decides,
    ...rows.slice(0, Math.min(rows.length, 10)).map((d) => `  ${d.name}: ${decidesWords(d)}`),
  ];
  console.log(out.join('\n'));
});
