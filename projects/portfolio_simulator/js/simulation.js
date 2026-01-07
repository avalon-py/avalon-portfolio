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
        
        // US equities highly correlated with each other
        if (isAUS && isBUS) return 0.88;
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

/**
 * Runs Monte Carlo Simulation
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

    // 1. Normalize Weights
    const totalWeight = portfolio.reduce((sum, item) => sum + item.weight, 0);
    const normalizedPortfolio = portfolio.map((item) => ({
      ...item,
      normalizedWeight: item.weight / totalWeight,
      type: getAssetType(item.symbol)
    }));

    // 2. Calculate Portfolio Physics
    // Expected Return (Weighted Average)
    let portfolioCagr = 0;
    normalizedPortfolio.forEach((item) => {
      portfolioCagr += item.normalizedWeight * item.cagr;
    });

    // Portfolio Volatility (Variance-Covariance Matrix)
    // Sigma_p^2 = Sum(w_i * w_j * sigma_i * sigma_j * rho_ij)
    let portfolioVariance = 0;

    for (let i = 0; i < normalizedPortfolio.length; i++) {
        for (let j = 0; j < normalizedPortfolio.length; j++) {
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

    // 3. Monte Carlo Loop
    const allPaths = [];
    const finalValues = [];

    // Pre-calculate inflation factors
    const inflationFactors = Array.from({ length: timeHorizon }, (_, i) =>
      Math.pow(1 + inflationRate / 100, i)
    );

    for (let i = 0; i < iterations; i++) {
      const path = [initialEquity];
      let currentEquity = initialEquity;
      let previousReturn = 0; 

      for (let year = 0; year < timeHorizon; year++) {
        if (currentEquity <= 0) {
          path.push(0);
          continue;
        }

        // --- SIMULATION PHYSICS ---
        
        let zScore = randomNormal();

        // Fat Tails (Kurtosis)
        if (enableFatTails) {
            // Jump Diffusion: 2% chance of a 3-sigma crash
            if (Math.random() < 0.02) {
              const crashMagnitude = Math.abs(randomNormal(3, 0.8));
              zScore = -crashMagnitude; 
            }
        }

        // Mean Reversion
        let driftAdjustment = 0;
        if (enableMeanReversion) {
             const kappa = 0.25;
             driftAdjustment = kappa * (portfolioCagr - previousReturn);
        }

        // Geometric Brownian Motion Step
        const mu = portfolioCagr + driftAdjustment;
        
        // Log Return = (mu - 0.5 * sigma^2) + sigma * Z
        const logReturn = (mu - 0.5 * Math.pow(portfolioVol, 2)) + (portfolioVol * zScore);
        
        const returnFactor = Math.exp(logReturn);
        previousReturn = returnFactor - 1;

        currentEquity = currentEquity * returnFactor;

        // Apply Withdrawal
        const currentWithdrawal = annualWithdrawal * inflationFactors[year];
        currentEquity = currentEquity - currentWithdrawal;

        if (currentEquity < 0) currentEquity = 0;
        path.push(currentEquity);
      }

      allPaths.push(path);
      finalValues.push(currentEquity);
    }

    // 4. Aggregation
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
