// The setup screen's Resume game and saved-games list, and the in-game Save dialog (src/ui/components/SavedGames.tsx).
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import { PlaySetup } from '../src/ui/components/PlaySetup';
import { SaveGameDialog, type SavesProps } from '../src/ui/components/SavedGames';
import { BUILTIN } from '../src/lib/browserLibrary';
import { setArtEnabled } from '../src/ui/art';
import { MAX_SLOTS, type SavedGame } from '../src/lib/savedGames';
import { SIM_VERSION } from '../src/lib/tournament';

beforeEach(() => {
  const m = new Map<string, string>();
  vi.stubGlobal('localStorage', { getItem: (k: string) => m.get(k) ?? null, setItem: (k: string, v: string) => void m.set(k, String(v)), removeItem: (k: string) => void m.delete(k) });
  setArtEnabled(false);
});
afterEach(() => vi.unstubAllGlobals());

const [a, b] = BUILTIN;
const save = (o: Partial<SavedGame> = {}): SavedGame => ({
  kind: 'nct-saved-game',
  schema: 1,
  id: 'auto',
  name: 'My game',
  saved: '2026-11-12T10:00:00Z',
  simVersion: SIM_VERSION,
  replayId: 'p1',
  started: '2026-11-12T09:00:00Z',
  decks: [a.deck, b.deck],
  seed: 1,
  botLevel: 'hard',
  botSeed: 2,
  choices: [],
  coach: true,
  grades: [],
  check: { at: 0, turn: 7, hash: 'x', decision: { kind: 'action', prompt: 'Choose an action', options: [] } },
  turn: 7,
  gigs: [3, 2],
  log: [],
  ...o,
});
const set = () => undefined;
const props = (o: Partial<SavesProps> = {}): SavesProps => ({
  storage: true,
  autosave: save(),
  slots: [save({ id: 's1', name: 'Before the big attack' }), save({ id: 's2', name: 'Old one', simVersion: SIM_VERSION - 1, turn: 4, gigs: [1, 1] })],
  restoring: false,
  onResume: set,
  onRename: set,
  onDelete: set,
  onExport: set,
  onImport: () => null,
  ...o,
});
const setup = (saves?: SavesProps) =>
  renderToStaticMarkup(<PlaySetup mine={a.file} setMine={set} opp={b.file} setOpp={set} seat="random" setSeat={set} coach setCoach={set} level="hard" setLevel={set} dA={a} dB={b} onStart={set} saves={saves} />);

describe('setup screen: saved games', () => {
  it('shows Resume game beside Start game, with the decks, turn, Gig score and save time', () => {
    const html = setup(props());
    expect(html).toContain('Resume game');
    expect(html.indexOf('Resume game')).toBeLessThan(html.indexOf('Start game'));
    expect(html).toContain(`Unfinished game: ${a.deck.name} vs ${b.deck.name} · Hard · turn 7 · Gigs 3–2 · saved `);
  });

  it('lists the named saves with Resume, Rename, Export and Delete, oldest first, and marks one from another version', () => {
    const html = setup(props());
    expect(html).toContain('Saved games');
    expect(html).toContain(`(2 of ${MAX_SLOTS})`);
    expect(html.indexOf('Before the big attack')).toBeLessThan(html.indexOf('Old one'));
    for (const t of ['Resume', 'Rename', 'Export', 'Delete', 'Import a save']) expect(html).toContain(t);
    // a save from an older version: said plainly, read rather than resumed (its button opens the log)
    expect(html).toContain(`saved with version ${SIM_VERSION - 1}: can&#x27;t be resumed on this version (${SIM_VERSION}); you can read its log, export it or delete it`);
    expect(html).toContain('Read the log');
  });

  it('says Restoring while a save is being restored, and Start waits', () => {
    const html = setup(props({ restoring: true }));
    expect(html).toContain('Restoring…');
    expect(html).toMatch(/<button[^>]*disabled=""[^>]*>Start game/);
  });

  it('without a save there is no Resume game, and Start is the main button', () => {
    const html = setup(props({ autosave: null, slots: [] }));
    expect(html).not.toContain('Resume game');
    expect(html).toContain('No saved games yet');
    expect(html).toMatch(/class="primary"[^>]*>Start game/);
  });

  it('with storage blocked the feature is hidden behind a short note', () => {
    const html = setup(props({ storage: false }));
    expect(html).not.toContain('Resume game');
    expect(html).not.toContain('Import a save');
    expect(html).toContain('This browser blocks site storage, so games can&#x27;t be saved or resumed here.');
  });

  it('the Save dialog lists every slot, oldest first, for deletion when all are in use, and offers no Save until one is free', () => {
    const slots = Array.from({ length: MAX_SLOTS }, (_, i) => save({ id: `s${i}`, name: `Slot ${i}` }));
    const html = renderToStaticMarkup(<SaveGameDialog defaultName="A vs B, turn 5" slots={slots} onSave={() => null} onDelete={set} onClose={set} />);
    expect(html).toContain('value="A vs B, turn 5"');
    expect(html).toContain(`All ${MAX_SLOTS} save slots are in use`);
    expect(html.indexOf('Slot 0')).toBeLessThan(html.indexOf('Slot 4'));
    expect(html).toMatch(/<button type="submit" class="primary" disabled="">Save<\/button>/);
    const free = renderToStaticMarkup(<SaveGameDialog defaultName="x" slots={[]} onSave={() => null} onDelete={set} onClose={set} />);
    expect(free).not.toContain('in use');
  });
});
