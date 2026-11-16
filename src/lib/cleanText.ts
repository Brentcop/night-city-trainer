// Cleaning text that came from someone else (a shared profile, a deck name or author read from another site): control,
// zero-width and direction-changing characters removed, spaces collapsed, trimmed, capped. Pure and tiny, so both the
// browser and the scripts use it (src/lib/profile.ts re-exports it).

/** Text a player typed or a payload carried: control characters removed, spaces collapsed, trimmed, capped. */
export function cleanText(v: unknown, max: number): string {
  if (typeof v !== 'string') return '';
  const s = v.replace(/[\u0000-\u001f\u007f-\u009f​-‏‪-‮⁦-⁩]/g, ' ').replace(/\s+/g, ' ').trim();
  return [...s].slice(0, max).join('');
}
