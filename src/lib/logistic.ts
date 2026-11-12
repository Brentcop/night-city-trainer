// Logistic regression with an L2 (ridge) penalty, fitted by Newton's method; pure, no dependencies (INFO-4,
// scripts/eval-calibrate.ts). Rows are plain number arrays; targets are in [0, 1] (a tie is ½).
//
// The penalty is on standardized coefficients (each column scaled to unit SD over the rows), so one λ treats every
// column alike whatever its units; the intercept is never penalized. Coefficients come back on the original scale.
// Objective: mean log-loss + λ/2 × Σ β_std².

export interface LogisticFit {
  /** coefficients on the original columns (0 for a constant column) */
  beta: number[];
  intercept: number;
  lambda: number;
  /** standard errors of beta from the inverse of the penalized Hessian at the solution (approximate under a penalty) */
  se: number[];
  iterations: number;
  converged: boolean;
  /** mean log-loss on the fitting rows (without the penalty) */
  logLoss: number;
}

export interface LogisticOptions {
  /** ridge λ on standardized coefficients (default 0) */
  lambda?: number;
  /** fit an intercept (default true) */
  intercept?: boolean;
  maxIter?: number;
  tol?: number;
}

const sigmoid = (z: number) => (z >= 0 ? 1 / (1 + Math.exp(-z)) : Math.exp(z) / (1 + Math.exp(z)));
const EPS = 1e-12;

/** Mean log-loss of probabilities p against targets y (clamped away from 0 and 1). */
export function logLoss(p: readonly number[], y: readonly number[]): number {
  let s = 0;
  for (let i = 0; i < p.length; i++) {
    const q = Math.min(1 - EPS, Math.max(EPS, p[i]!));
    const t = y[i]!;
    s -= t * Math.log(q) + (1 - t) * Math.log(1 - q);
  }
  return p.length ? s / p.length : 0;
}

/** Mean squared error of probabilities p against targets y. */
export function brier(p: readonly number[], y: readonly number[]): number {
  let s = 0;
  for (let i = 0; i < p.length; i++) s += (p[i]! - y[i]!) ** 2;
  return p.length ? s / p.length : 0;
}

export function predict(fit: Pick<LogisticFit, 'beta' | 'intercept'>, X: readonly (readonly number[])[]): number[] {
  return X.map((x) => {
    let z = fit.intercept;
    for (let j = 0; j < fit.beta.length; j++) z += fit.beta[j]! * x[j]!;
    return sigmoid(z);
  });
}

/** Solve A x = b for a symmetric positive-definite A (Cholesky); throws if A is not positive definite. */
export function solveSpd(A: readonly (readonly number[])[], b: readonly number[]): number[] {
  const n = b.length;
  const L: number[][] = Array.from({ length: n }, () => new Array<number>(n).fill(0));
  for (let i = 0; i < n; i++)
    for (let j = 0; j <= i; j++) {
      let s = A[i]![j]!;
      for (let k = 0; k < j; k++) s -= L[i]![k]! * L[j]![k]!;
      if (i === j) {
        if (!(s > 0)) throw new Error('matrix is not positive definite');
        L[i]![i] = Math.sqrt(s);
      } else L[i]![j] = s / L[j]![j]!;
    }
  const z = new Array<number>(n).fill(0);
  for (let i = 0; i < n; i++) {
    let s = b[i]!;
    for (let k = 0; k < i; k++) s -= L[i]![k]! * z[k]!;
    z[i] = s / L[i]![i]!;
  }
  const x = new Array<number>(n).fill(0);
  for (let i = n - 1; i >= 0; i--) {
    let s = z[i]!;
    for (let k = i + 1; k < n; k++) s -= L[k]![i]! * x[k]!;
    x[i] = s / L[i]![i]!;
  }
  return x;
}

/** Fit a ridge logistic regression of y on the columns of X. */
export function fitLogistic(X: readonly (readonly number[])[], y: readonly number[], o: LogisticOptions = {}): LogisticFit {
  const n = X.length;
  if (n === 0 || n !== y.length) throw new Error(`fitLogistic needs matching non-empty rows and targets (got ${n} and ${y.length})`);
  const d = X[0]!.length;
  const lambda = o.lambda ?? 0;
  const useB0 = o.intercept ?? true;
  const maxIter = o.maxIter ?? 60;
  const tol = o.tol ?? 1e-9;
  // standardize: centre only when there is an intercept to absorb it
  const mean = new Array<number>(d).fill(0);
  const sd = new Array<number>(d).fill(0);
  for (const x of X) for (let j = 0; j < d; j++) mean[j]! += x[j]! / n;
  if (!useB0) mean.fill(0);
  for (const x of X) for (let j = 0; j < d; j++) sd[j]! += (x[j]! - mean[j]!) ** 2 / n;
  const cols: number[] = [];
  for (let j = 0; j < d; j++) {
    sd[j] = Math.sqrt(sd[j]!);
    if (sd[j]! > 1e-12) cols.push(j);
  }
  const k = cols.length + (useB0 ? 1 : 0); // parameter vector: [b0?, β_std for each kept column]
  const Z: Float64Array[] = X.map((x) => {
    const z = new Float64Array(k);
    let t = 0;
    if (useB0) z[t++] = 1;
    for (const j of cols) z[t++] = (x[j]! - mean[j]!) / sd[j]!;
    return z;
  });
  const pen = (t: number) => (useB0 && t === 0 ? 0 : lambda);
  let theta = new Array<number>(k).fill(0);
  const objective = (th: readonly number[]) => {
    let s = 0;
    for (let i = 0; i < n; i++) {
      let z = 0;
      for (let t = 0; t < k; t++) z += th[t]! * Z[i]![t]!;
      const q = Math.min(1 - EPS, Math.max(EPS, sigmoid(z)));
      s -= y[i]! * Math.log(q) + (1 - y[i]!) * Math.log(1 - q);
    }
    let r = 0;
    for (let t = 0; t < k; t++) r += pen(t) * th[t]! ** 2;
    return s / n + r / 2;
  };
  let H: number[][] = [];
  let iterations = 0;
  let converged = false;
  let obj = objective(theta);
  for (; iterations < maxIter; iterations++) {
    const grad = new Array<number>(k).fill(0);
    H = Array.from({ length: k }, () => new Array<number>(k).fill(0));
    for (let i = 0; i < n; i++) {
      const zi = Z[i]!;
      let z = 0;
      for (let t = 0; t < k; t++) z += theta[t]! * zi[t]!;
      const q = sigmoid(z);
      const r = (q - y[i]!) / n;
      const wgt = Math.max(q * (1 - q), 1e-10) / n;
      for (let a = 0; a < k; a++) {
        grad[a]! += r * zi[a]!;
        const wa = wgt * zi[a]!;
        for (let b = 0; b <= a; b++) H[a]![b]! += wa * zi[b]!;
      }
    }
    for (let a = 0; a < k; a++) {
      grad[a]! += pen(a) * theta[a]!;
      H[a]![a]! += pen(a) + 1e-12;
      for (let b = 0; b < a; b++) H[b]![a] = H[a]![b]!;
    }
    const step = solveSpd(H, grad);
    let scale = 1;
    let next = theta.map((t, i) => t - step[i]!);
    let nextObj = objective(next);
    while (nextObj > obj + 1e-15 && scale > 1e-6) {
      scale /= 2;
      next = theta.map((t, i) => t - scale * step[i]!);
      nextObj = objective(next);
    }
    const moved = Math.max(...step.map((s) => Math.abs(s * scale)));
    theta = next;
    obj = nextObj;
    if (moved < tol) {
      converged = true;
      iterations++;
      break;
    }
  }
  // covariance of theta: H⁻¹ / n (H is the Hessian of the mean objective)
  const varOf = (t: number) => {
    const e = new Array<number>(k).fill(0);
    e[t] = 1;
    return solveSpd(H, e)[t]! / n;
  };
  const beta = new Array<number>(d).fill(0);
  const se = new Array<number>(d).fill(0);
  let intercept = useB0 ? theta[0]! : 0;
  cols.forEach((j, idx) => {
    const t = idx + (useB0 ? 1 : 0);
    beta[j] = theta[t]! / sd[j]!;
    se[j] = Math.sqrt(Math.max(0, varOf(t))) / sd[j]!;
    intercept -= beta[j]! * mean[j]!;
  });
  const fit = { beta, intercept, lambda, se, iterations, converged, logLoss: 0 };
  fit.logLoss = logLoss(predict(fit, X), y);
  return fit;
}

/** Fit at each λ on the training rows and keep the one with the lowest validation log-loss. */
export function chooseRidge(
  train: { X: readonly (readonly number[])[]; y: readonly number[] },
  valid: { X: readonly (readonly number[])[]; y: readonly number[] },
  lambdas: readonly number[],
  o: Omit<LogisticOptions, 'lambda'> = {},
): { lambda: number; path: { lambda: number; validLogLoss: number }[] } {
  const path = lambdas.map((lambda) => {
    const fit = fitLogistic(train.X, train.y, { ...o, lambda });
    return { lambda, validLogLoss: logLoss(predict(fit, valid.X), valid.y) };
  });
  const best = path.reduce((a, b) => (b.validLogLoss < a.validLogLoss ? b : a));
  return { lambda: best.lambda, path };
}
