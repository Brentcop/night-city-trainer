// Which top tabs fit on the header's one row, and which go under "More". Pure arithmetic over measured widths (the
// header measures its tabs in a hidden copy), so it can be tested; the site config decides which tabs exist and their
// order, this only decides how many of them show.

/**
 * The tabs to show, as indexes in nav order. Every tab shows when they all fit in `avail`; otherwise the longest run
 * from the start that fits beside the More button (`moreW`), and the active tab is always one of them: it takes the
 * place of the last tab that would show (more tabs go under More if it is wider). With no room even for one tab beside
 * More, only the active tab shows (or none). Widths include each tab's share of the gaps between them.
 */
export function fitTabs(widths: readonly number[], moreW: number, avail: number, active: number | null): number[] {
  const all = widths.map((_, i) => i);
  const sum = (ix: number[]) => ix.reduce((a, i) => a + (widths[i] ?? 0), 0);
  if (sum(all) <= avail) return all;
  const act = active !== null && active >= 0 && active < widths.length ? active : null;
  for (let k = widths.length - 1; k >= 1; k--) {
    let shown = all.slice(0, k);
    if (act !== null && act >= k) shown = [...all.slice(0, k - 1), act];
    if (sum(shown) + moreW <= avail) return shown;
  }
  return act !== null && (widths[act] ?? 0) + moreW <= avail ? [act] : [];
}
