export interface PairedSummary {
  games: number;
  mean: number;
  lower95: number;
  upper95: number;
}

export function summarizePaired(candidate: number[], baseline: number[]): PairedSummary {
  if (candidate.length !== baseline.length || candidate.length === 0) {
    throw new Error(`paired results must have the same non-zero length (got ${candidate.length} and ${baseline.length})`);
  }
  if (candidate.length < 2) throw new Error(`paired results need at least 2 pairs to estimate variance (got ${candidate.length})`);
  const differences = candidate.map((score, i) => score - baseline[i]);
  const mean = differences.reduce((sum, d) => sum + d, 0) / differences.length;
  const variance = differences.reduce((sum, d) => sum + (d - mean) ** 2, 0) / (differences.length - 1);
  const margin = 1.96 * Math.sqrt(variance / differences.length);
  return { games: differences.length, mean, lower95: mean - margin, upper95: mean + margin };
}
