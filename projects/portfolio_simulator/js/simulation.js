import { PREDEFINED_ASSETS } from './constants.js';

// Box-Muller transform for normal distribution
const randomNormal = (mean = 0, stdDev = 1) => {
  let u1 = 0, u2 = 0;
  while (u1 === 0) u1 = Math.random();
  while (u2 === 0) u2 = Math.random();
  const z0 = Math.sqrt(-2.0 * Math.log(u1)) * Math.cos(2.0 * Math.PI * u2);
  return z0 * stdDev + mean;
};

// Percentile helper
const getPercentile = (arr, p) => {
  const sorted = [...arr].sort((a, b) => a - b);
  const index = (p / 100) * (sorted.length - 1);
  const lower = Math.floor(index);
  const upper = Math.ceil(index);
  const weight = index % 1;
  if (lower === upper) return sorted[lower];
  return sorted[lower] * (1 - weight) + sorted[upper] * weight;
};

// Bins an array of values into `binCount` equal-width buckets for a histogram.
// Returns [{ x0, x1, count }] sorted ascending by x0.
const buildHistogram = (values, binCount = 24) => {
  const min = Math.min(...values);
  const max = Math.max(...values);
  const range = max - min || 1;
  const binWidth = range / binCount;

  const bins = Array.from({ length: binCount }, (_, i) => ({
    x0: min + i * binWidth,
    x1: min + (i + 1) * binWidth,
    count: 0,
  }));

  values.forEach((v) => {
    let idx = Math.floor((v - min) / binWidth);
    if (idx >= binCount) idx = binCount - 1;
    if (idx < 0) idx = 0;
    bins[idx].count++;
  });

  return bins;
};

// --- ASSET TYPE / CORRELATION LOGIC ---

const getAssetType = (symbol) => {
    const asset = PREDEFINED_ASSETS.find(a => a.symbol === symbol);
    return asset ? asset.type : 'equity'; // Default custom assets to equity behavior
};

const getCorrelation = (symbolA, symbolB, typeA, typeB) => {
    // Perfect correlation with self
    if (symbolA === symbolB) return 1.0;
    
    // CRYPTO CORRELATIONS (very high within crypto)
    if (typeA === 'crypto' && typeB === 'crypto') {
        // BTC-ETH, BTC-SOL, ETH-SOL are highly correlated
        return 0.92;
    }
    
    // EQUITY CORRELATIONS (varies by region/index)
    if (typeA === 'equity' && typeB === 'equity') {
        const usEquities = ['SPY', 'QQQ', 'DIA', 'VOO', 'VTI'];
        const intlEquities = ['VEA', 'AVDV'];
        const emergingEquities = ['VWO', 'IDX'];
        const smallCap = ['AVUV'];
        
        const isAUS = usEquities.includes(symbolA);
        const isBUS = usEquities.includes(symbolB);
        const isAIntl = intlEquities.includes(symbolA);
        const isBIntl = intlEquities.includes(symbolB);
        const isAEmerging = emergingEquities.includes(symbolA);
        const isBEmerging = emergingEquities.includes(symbolB);
        const isASmallCap = smallCap.includes(symbolA);
        const isBSmallCap = smallCap.includes(symbolB);
        
        // US equities highly correlated with each other
        if (isAUS && isBUS) return 0.88;
        // US small cap value with broad US equities (still highly correlated, slightly less)
        if ((isAUS && isBSmallCap) || (isASmallCap && isBUS)) return 0.80;
        // US with international developed
        if ((isAUS && isBIntl) || (isAIntl && isBUS)) return 0.65;
        // US with emerging
        if ((isAUS && isBEmerging) || (isAEmerging && isBUS)) return 0.55;
        // International developed with emerging
        if ((isAIntl && isBEmerging) || (isAEmerging && isBIntl)) return 0.68;
        // Emerging markets with each other
        if (isAEmerging && isBEmerging) return 0.75;
        
        // Fallback for equity-equity
        return 0.70;
    }
    
    // METAL CORRELATIONS (gold and silver move together)
    if (typeA === 'metal' && typeB === 'metal') return 0.82;

    // NAV-PRICED BOND FUNDS (e.g. AGG) - correlated with each other via
    // shared exposure to interest rate moves.
    if (typeA === 'bond' && typeB === 'bond') return 0.85;
    
    // CROSS-ASSET CORRELATIONS
    
    // Crypto vs Equity (moderate positive, crypto is "risk-on")
    if ((typeA === 'crypto' && typeB === 'equity') || (typeA === 'equity' && typeB === 'crypto')) {
        return 0.40;
    }
    
    // Crypto vs Metal (NEGATIVE to near-zero - inverse relationship)
    if ((typeA === 'crypto' && typeB === 'metal') || (typeA === 'metal' && typeB === 'crypto')) {
        return -0.10; // Slightly negative correlation
    }
    
    // Metal vs Equity (low correlation, sometimes negative during crashes)
    if ((typeA === 'metal' && typeB === 'equity') || (typeA === 'equity' && typeB === 'metal')) {
        return 0.05; // Near-zero, safe haven behavior
    }

    // Bonds vs Equity (classic diversifier - negative to near-zero,
    // "flight to quality" during equity selloffs)
    if ((typeA === 'bond' && typeB === 'equity') || (typeA === 'equity' && typeB === 'bond')) {
        return -0.15;
    }

    // Bonds vs Crypto (largely unrelated markets)
    if ((typeA === 'bond' && typeB === 'crypto') || (typeA === 'crypto' && typeB === 'bond')) {
        return -0.05;
    }

    // Bonds vs Metal (mild positive - both benefit from falling real rates)
    if ((typeA === 'bond' && typeB === 'metal') || (typeA === 'metal' && typeB === 'bond')) {
        return 0.15;
    }

    // NOTE: Custom assets (e.g. a user-built near-zero-volatility fixed
    // income position via the Custom tab) don't carry a `type` and default
    // to 'equity' here, meaning they'd fall into the equity-equity bucket
    // above if paired with another equity. This sounds wrong but is
    // harmless in practice: since covariance = sigma_i * sigma_j * rho,
    // a near-zero sigma on the custom asset makes its covariance with
    // anything negligible regardless of which correlation bucket it lands in.
    
    return 0.30; // Fallback
};

// --- LINEAR ALGEBRA: CHOLESKY DECOMPOSITION ---

/**
 * Attempts a standard Cholesky decomposition of a symmetric matrix.
 * Returns { success: false } if the matrix isn't positive semi-definite
 * (i.e. a negative value would appear under a sqrt), rather than throwing
 * or silently producing NaNs.
 */
const tryCholesky = (matrix) => {
    const n = matrix.length;
    const L = Array.from({ length: n }, () => new Array(n).fill(0));

    for (let i = 0; i < n; i++) {
        for (let j = 0; j <= i; j++) {
            let sum = 0;
            for (let k = 0; k < j; k++) {
                sum += L[i][k] * L[j][k];
            }

            if (i === j) {
                const diagVal = matrix[i][i] - sum;
                // Small negative values are numerical noise; anything meaningfully
                // negative means the matrix isn't PSD and we should bail out.
                if (diagVal < -1e-9) return { success: false };
                L[i][j] = Math.sqrt(Math.max(diagVal, 0));
            } else {
                L[i][j] = L[j][j] !== 0 ? (matrix[i][j] - sum) / L[j][j] : 0;
            }
        }
    }
    return { success: true, L };
};

/**
 * Cholesky decomposition with a diagonal "jitter" fallback.
 *
 * Hand-assigned pairwise correlations (like the fixed lookup table above)
 * aren't mathematically guaranteed to form a valid positive semi-definite
 * covariance matrix once you have more than 2-3 assets (e.g. A-B and B-C
 * both highly correlated but A-C set independently can be inconsistent).
 * If the raw matrix fails, we add a small amount to the diagonal (a standard
 * "ridge" regularization) and retry with exponentially larger jitter. If it
 * still fails after a few attempts, we fall back to a diagonal-only matrix
 * (equivalent to treating assets as uncorrelated) so the simulation always
 * has *something* valid to run with instead of crashing.
 */
const choleskyWithFallback = (matrix, maxAttempts = 6) => {
    const n = matrix.length;
    let jitter = 0;

    for (let attempt = 0; attempt < maxAttempts; attempt++) {
        const jittered = matrix.map((row, i) =>
            row.map((val, j) => (i === j ? val + jitter : val))
        );
        const result = tryCholesky(jittered);
        if (result.success) return result.L;
        jitter = jitter === 0 ? 1e-10 : jitter * 10;
    }

    // Last resort: independent assets (diagonal Cholesky factor).
    const L = Array.from({ length: n }, () => new Array(n).fill(0));
    for (let i = 0; i < n; i++) {
        L[i][i] = Math.sqrt(Math.max(matrix[i][i], 0));
    }
    return L;
};

// Multiplies lower-triangular L by vector z: returns L * z
const matVecMultiply = (L, z) => {
    const n = L.length;
    const result = new Array(n).fill(0);
    for (let i = 0; i < n; i++) {
        let sum = 0;
        for (let k = 0; k <= i; k++) {
            sum += L[i][k] * z[k];
        }
        result[i] = sum;
    }
    return result;
};

/**
 * Runs Monte Carlo Simulation
 *
 * Each asset is simulated individually as its own Geometric Brownian Motion
 * process. When correlations are enabled, the per-asset random shocks each
 * year are generated by Cholesky-transforming a vector of independent
 * standard normals, so the simulated paths genuinely reflect e.g. equities
 * falling while gold holds up in the same year - not just a single blended
 * volatility number.
 *
 * @param {Array} portfolio 
 * @param {Object} params 
 */
export const runMonteCarlo = (portfolio, params) => {
  return new Promise((resolve) => {
    const {
      initialEquity,
      annualWithdrawal,
      inflationRate,
      timeHorizon,
      iterations,
      enableFatTails,
      enableCorrelations,
      enableMeanReversion,
      riskFreeRate = 4,
    } = params;

    const n = portfolio.length;
    const rf = riskFreeRate / 100;

    // 1. Normalize Weights
    const totalWeight = portfolio.reduce((sum, item) => sum + item.weight, 0);
    const normalizedPortfolio = portfolio.map((item) => ({
      ...item,
      normalizedWeight: item.weight / totalWeight,
      type: getAssetType(item.symbol)
    }));

    // 2. Calculate Portfolio-Level Physics (used for reported summary metrics,
    //    exactly as before - this is the aggregate CAGR/vol shown in the UI).
    let portfolioCagr = 0;
    normalizedPortfolio.forEach((item) => {
      portfolioCagr += item.normalizedWeight * item.cagr;
    });

    let portfolioVariance = 0;
    for (let i = 0; i < n; i++) {
        for (let j = 0; j < n; j++) {
            const assetA = normalizedPortfolio[i];
            const assetB = normalizedPortfolio[j];

            const wA = assetA.normalizedWeight;
            const wB = assetB.normalizedWeight;
            const volA = assetA.volatility;
            const volB = assetB.volatility;

            let rho = 0;
            if (i === j) {
                rho = 1;
            } else if (enableCorrelations) {
                rho = getCorrelation(assetA.symbol, assetB.symbol, assetA.type, assetB.type);
            } else {
                rho = 0; // Independence assumption
            }

            portfolioVariance += wA * wB * volA * volB * rho;
        }
    }
    const portfolioVol = Math.sqrt(portfolioVariance);

    // 3. Build the asset-level CORRELATION matrix (unit diagonal, NOT
    //    covariance) and its Cholesky factor.
    //
    //    L * zUncorr below must produce correlated STANDARD normals (each
    //    with variance 1), because every place that consumes zCorr - the
    //    per-asset return formula a few lines down, and the fat-tail crash
    //    branch - multiplies it by that asset's own `sigma` afterward to get
    //    the actual return shock. If this matrix were the covariance matrix
    //    (volA*volB*rho) instead, volatility would get applied twice: once
    //    baked into L, once again via `sigma *`. That double-application is
    //    especially visible for a single-asset portfolio, where it silently
    //    shrinks the realized volatility from vol down to vol^2 - which in
    //    turn makes Sharpe/Sortino (and the median/mean outcome) look far
    //    better than the stated volatility should produce. Building L from
    //    the pure correlation matrix keeps zCorr unit-scale so the later
    //    `sigma * zCorr[a]` is correct for both the normal-year draw and the
    //    fat-tail crash draw, which was already written to expect that.
    const corrMatrix = Array.from({ length: n }, () => new Array(n).fill(0));
    for (let i = 0; i < n; i++) {
        for (let j = 0; j < n; j++) {
            const assetA = normalizedPortfolio[i];
            const assetB = normalizedPortfolio[j];

            let rho;
            if (i === j) {
                rho = 1;
            } else if (enableCorrelations) {
                rho = getCorrelation(assetA.symbol, assetB.symbol, assetA.type, assetB.type);
            } else {
                rho = 0;
            }

            corrMatrix[i][j] = rho;
        }
    }
    const L = choleskyWithFallback(corrMatrix);

    // 4. Monte Carlo Loop - simulate each asset individually.
    const allPaths = [];
    const finalValues = [];

    // Realized annual portfolio returns, captured BEFORE withdrawal is
    // subtracted each year, pooled across every iteration and every year.
    // This is the sample Sharpe/Sortino are computed from below - it
    // reflects the actual simulated growth (including fat tails, mean
    // reversion, and correlation effects), not the raw input assumptions.
    const annualReturns = [];

    // Pre-calculate inflation factors
    const inflationFactors = Array.from({ length: timeHorizon }, (_, i) =>
      Math.pow(1 + inflationRate / 100, i)
    );

    // Initial dollar allocation per asset
    const initialAssetValues = normalizedPortfolio.map(
        (item) => initialEquity * item.normalizedWeight
    );

    for (let i = 0; i < iterations; i++) {
      let assetValues = [...initialAssetValues];
      let previousReturns = new Array(n).fill(0);
      let totalValue = initialEquity;
      const path = [totalValue];

      for (let year = 0; year < timeHorizon; year++) {
        if (totalValue <= 0) {
          assetValues = new Array(n).fill(0);
          totalValue = 0;
          path.push(0);
          continue;
        }

        // --- SIMULATION PHYSICS ---

        // Draw n independent standard normals, then correlate them via
        // the Cholesky factor: Z_corr = L * Z_uncorr
        const zUncorr = Array.from({ length: n }, () => randomNormal());
        let zCorr = matVecMultiply(L, zUncorr);

        // Fat Tails (Kurtosis): a single systemic jump event per year,
        // applied across all assets simultaneously (this mirrors how real
        // crashes tend to hit correlated assets together, rather than one
        // asset crashing in isolation). Each asset still reacts to the
        // shock through its own volatility below.
        if (enableFatTails && Math.random() < 0.02) {
            const crashZ = -Math.abs(randomNormal(3, 0.8));
            zCorr = new Array(n).fill(crashZ);
        }

        let newTotal = 0;
        const newAssetValues = new Array(n);

        for (let a = 0; a < n; a++) {
            const asset = normalizedPortfolio[a];

            // Mean Reversion (per-asset, reverting toward that asset's own
            // expected CAGR based on its own prior-year realized return)
            let driftAdjustment = 0;
            if (enableMeanReversion) {
                const kappa = 0.25;
                driftAdjustment = kappa * (asset.cagr - previousReturns[a]);
            }

            const mu = asset.cagr + driftAdjustment;
            const sigma = asset.volatility;

            // Log Return = (mu - 0.5 * sigma^2) + sigma * Z
            const logReturn = (mu - 0.5 * Math.pow(sigma, 2)) + (sigma * zCorr[a]);
            const returnFactor = Math.exp(logReturn);

            previousReturns[a] = returnFactor - 1;

            const newVal = Math.max(assetValues[a] * returnFactor, 0);
            newAssetValues[a] = newVal;
            newTotal += newVal;
        }

        // Capture the blended portfolio return for this year, before the
        // withdrawal cash flow below touches it.
        annualReturns.push((newTotal / totalValue) - 1);

        // Apply Withdrawal: sell proportionally across holdings so relative
        // weights are preserved, then clamp at zero.
        const currentWithdrawal = annualWithdrawal * inflationFactors[year];
        if (newTotal > 0) {
            const scale = Math.max(0, (newTotal - currentWithdrawal) / newTotal);
            for (let a = 0; a < n; a++) {
                newAssetValues[a] *= scale;
            }
            newTotal = newTotal * scale;
        }

        assetValues = newAssetValues;
        totalValue = newTotal;
        path.push(totalValue);
      }

      allPaths.push(path);
      finalValues.push(totalValue);
    }

    // 5. Aggregation
    const years = Array.from({ length: timeHorizon + 1 }, (_, i) => i);
    const medianPath = years.map((y) => getPercentile(allPaths.map((p) => p[y]), 50));
    const topPath = years.map((y) => getPercentile(allPaths.map((p) => p[y]), 95));
    const bottomPath = years.map((y) => getPercentile(allPaths.map((p) => p[y]), 5));

    const riskOfRuin = (finalValues.filter((v) => v <= 0.01).length / iterations) * 100;
    const medianFinal = getPercentile(finalValues, 50);
    const p5Final = getPercentile(finalValues, 5);
    const p95Final = getPercentile(finalValues, 95);

    // 6. Dispersion stats on the terminal wealth distribution - how much
    //    the 10,000 individual paths actually differ from one another,
    //    not the input assumptions.
    const finalMean = finalValues.reduce((s, v) => s + v, 0) / finalValues.length;
    const finalVariance = finalValues.reduce((s, v) => s + Math.pow(v - finalMean, 2), 0) / finalValues.length;
    const finalStdDev = Math.sqrt(finalVariance);
    const within1Std = finalValues.filter((v) => Math.abs(v - finalMean) <= finalStdDev).length;
    const pctWithin1Std = (within1Std / finalValues.length) * 100;
    const histogram = buildHistogram(finalValues, 24);

    // 7. Sharpe & Sortino, computed from the pooled realized annual returns
    //    (every path x every year), against the configured risk-free rate.
    const meanAnnualReturn = annualReturns.reduce((s, v) => s + v, 0) / annualReturns.length;
    const returnVariance = annualReturns.reduce((s, v) => s + Math.pow(v - meanAnnualReturn, 2), 0) / annualReturns.length;
    const annualReturnStdDev = Math.sqrt(returnVariance);

    // Sortino's downside deviation: squared shortfalls below the risk-free
    // rate, averaged over ALL observations (not just the shortfalls) -
    // this is the standard definition, so upside variance never counts
    // against the ratio.
    const downsideSquaredSum = annualReturns.reduce((s, v) => {
        const shortfall = v - rf;
        return shortfall < 0 ? s + shortfall * shortfall : s;
    }, 0);
    const downsideDeviation = Math.sqrt(downsideSquaredSum / annualReturns.length);

    const sharpeRatio = annualReturnStdDev > 0 ? (meanAnnualReturn - rf) / annualReturnStdDev : 0;
    const sortinoRatio = downsideDeviation > 0 ? (meanAnnualReturn - rf) / downsideDeviation : 0;

    resolve({
      years,
      medianPath,
      topPath,
      bottomPath,
      riskOfRuin,
      expectedCAGR: portfolioCagr * 100,
      expectedVol: portfolioVol * 100,
      medianFinal,
      p5Final,
      p95Final,
      finalMean,
      finalStdDev,
      pctWithin1Std,
      histogram,
      sharpeRatio,
      sortinoRatio,
      riskFreeRate,
    });
  });
};
