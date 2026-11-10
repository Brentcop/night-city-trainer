import { allDecks } from '../../lib/browserLibrary';
import { deckColors } from '../../engine/deck';
import { shortCredit, type LibraryDeck } from '../../lib/library';

export function DeckPicker({ value, onChange, label }: { value: string; onChange: (key: string) => void; label?: string }) {
  const decks = allDecks();
  const groups: [string, LibraryDeck[]][] = [
    ['Meta archetypes (choom.gg)', decks.filter((d) => d.kind === 'meta')],
    ['Sim ladder (cyberpunk-tcg-sim.online)', decks.filter((d) => d.kind === 'ladder')],
    ['Trainer originals (NC, forged)', decks.filter((d) => d.kind === 'original')],
    ['Guide lists (choom.gg)', decks.filter((d) => d.kind === 'guide')],
    ['Custom & tournament builds', decks.filter((d) => d.kind === 'custom')],
  ];
  return (
    <label className="row">
      {label && <span className="muted small">{label}</span>}
      <select value={value} onChange={(e) => onChange(e.target.value)} style={{ maxWidth: 340 }}>
        {groups.map(([g, ds]) =>
          ds.length ? (
            <optgroup key={g} label={g}>
              {ds.map((d) => (
                <option key={d.file} value={d.file}>
                  {deckColors(d.deck)} · {d.deck.name.slice(0, 44)} — {shortCredit(d)}
                  {d.tier ? ` [${d.tier}]` : ''}
                </option>
              ))}
            </optgroup>
          ) : null,
        )}
      </select>
    </label>
  );
}

export function findDeck(key: string | undefined): LibraryDeck | undefined {
  const decks = allDecks();
  if (!key) return undefined;
  return decks.find((d) => d.file === key) ?? decks.find((d) => d.file.includes(key) || d.deck.name.toLowerCase().includes(key.toLowerCase()));
}
