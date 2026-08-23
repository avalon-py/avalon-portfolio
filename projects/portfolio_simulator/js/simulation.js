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

// --- CORRELATION LOGIC ---

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
    } = params;

    const n = portfolio.length;

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

    // 3. Build the asset-level covariance matrix and its Cholesky factor.
    //    This matrix is NOT weighted by portfolio allocation - it's the raw
    //    covariance structure between assets themselves. Weights only
    //    determine how many dollars sit in each asset (step 4 below).
    const covMatrix = Array.from({ length: n }, () => new Array(n).fill(0));
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

            covMatrix[i][j] = assetA.volatility * assetB.volatility * rho;
        }
    }
    const L = choleskyWithFallback(covMatrix);

    // 4. Monte Carlo Loop - simulate each asset individually.
    const allPaths = [];
    const finalValues = [];

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

    resolve({
      years,
      medianPath,
      topPath,
      bottomPath,
      riskOfRuin,
      expectedCAGR: portfolioCagr * 100,
      expectedVol: portfolioVol * 100,
      medianFinal,
    });
  });
};
