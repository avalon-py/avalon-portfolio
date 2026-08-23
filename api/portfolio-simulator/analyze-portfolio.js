// api/portfolio-simulator/analyze-portfolio.js
//
// Server-side only: holds GEMINI_API_KEY, never sent to the client.
//
// Rate limiting: in-memory, per warm function instance. This is NOT a hard
// guarantee on serverless (a cold start resets the counter), but for a
// personal/hobby-scale project it's a reasonable speed bump without needing
// Redis. If this ever gets real traffic, swap this block for Upstash again.

const requestLog = new Map(); // ip -> array of timestamps (ms)
const WINDOW_MS = 60 * 60 * 1000; // 1 hour
const MAX_REQUESTS = 5;

function isRateLimited(ip) {
  const now = Date.now();
  const timestamps = (requestLog.get(ip) || []).filter(t => now - t < WINDOW_MS);

  if (timestamps.length >= MAX_REQUESTS) {
    requestLog.set(ip, timestamps);
    return true;
  }

  timestamps.push(now);
  requestLog.set(ip, timestamps);

  // Cheap cleanup so the Map doesn't grow forever on a long-lived warm instance.
  if (requestLog.size > 500) {
    for (const [key, times] of requestLog) {
      const fresh = times.filter(t => now - t < WINDOW_MS);
      if (fresh.length === 0) requestLog.delete(key);
      else requestLog.set(key, fresh);
    }
  }

  return false;
}

// --- Input validation -------------------------------------------------
// Don't trust the client. Someone can POST directly to this route without
// ever touching your UI. Cap sizes and check types before building a prompt
// or spending a Gemini call on garbage.

function validatePayload(body) {
  const { portfolio, params, results } = body ?? {};

  if (!Array.isArray(portfolio) || portfolio.length === 0 || portfolio.length > 20) {
    return "Invalid portfolio: expected 1-20 assets.";
  }
  for (const item of portfolio) {
    if (
      typeof item.symbol !== "string" || item.symbol.length > 20 ||
      typeof item.weight !== "number" || item.weight < 0 || item.weight > 100 ||
      typeof item.cagr !== "number" || Math.abs(item.cagr) > 5 ||       // ±500%/yr sanity cap
      typeof item.volatility !== "number" || item.volatility < 0 || item.volatility > 5
    ) {
      return "Invalid portfolio item.";
    }
  }

  if (!params || typeof params !== "object") return "Missing params.";
  const numericParams = ["initialEquity", "annualWithdrawal", "inflationRate", "timeHorizon", "riskFreeRate"];
  for (const key of numericParams) {
    if (typeof params[key] !== "number" || !isFinite(params[key])) {
      return `Invalid params.${key}.`;
    }
  }
  if (params.timeHorizon <= 0 || params.timeHorizon > 100) return "timeHorizon out of range.";

  if (!results || typeof results !== "object") return "Missing results.";
  const numericResults = [
    "riskOfRuin", "expectedCAGR", "expectedVol", "medianFinal",
    "p5Final", "p95Final", "sharpeRatio", "sortinoRatio",
  ];
  for (const key of numericResults) {
    if (typeof results[key] !== "number" || !isFinite(results[key])) {
      return `Invalid results.${key}.`;
    }
  }

  return null; // valid
}

// --- Prompt construction ------------------------------------------------
// Schema has 5 fields to match the 5-point prompt below. If you edit the
// prompt's point list again, keep this schema's properties/required array
// in sync - a mismatch here is exactly what broke the last two deploys.

const ANALYSIS_SCHEMA = {
  type: "object",
  properties: {
    riskReturn: { type: "string", description: "1-2 sentences on the risk/return tradeoff shown." },
    diversification: { type: "string", description: "1-2 sentences on whether the portfolio is over- or under-diversified, based on the weights." },
    consideration: { type: "string", description: "1-2 sentences on one thing worth considering (sequence-of-returns risk, Sharpe/Sortino gap, etc)." },
    rebalanceSuggestion: { type: "string", description: "1-2 sentences naming one asset (only from the provided pool) worth trimming or adding to reduce risk of ruin, phrased as something worth considering rather than an instruction." },
    actionableInsight: { type: "string", description: "1-2 sentences with one concrete, low-effort adjustment (e.g. lowering annual withdrawal)." },
  },
  required: ["riskReturn", "diversification", "consideration", "rebalanceSuggestion", "actionableInsight"],
};

function buildPrompt({ portfolio, params, results }) {
  const holdings = portfolio
    .map(p => `- ${p.symbol}: ${p.weight}% weight, ${(p.cagr * 100).toFixed(1)}% CAGR, ${(p.volatility * 100).toFixed(1)}% volatility`)
    .join("\n");

  return `You are a portfolio analyst reviewing the output of a Monte Carlo retirement simulation. This is informational commentary on simulated numbers, NOT personalized financial advice - phrase everything as observations worth considering, not instructions to buy or sell, and do not claim certainty about future returns.

PORTFOLIO COMPOSITION:
${holdings}

SIMULATION PARAMETERS:
- Initial capital: $${params.initialEquity.toLocaleString()}
- Annual withdrawal: $${params.annualWithdrawal.toLocaleString()} (inflation-indexed)
- Inflation rate: ${params.inflationRate}%
- Time horizon: ${params.timeHorizon} years
- Risk-free rate: ${params.riskFreeRate}%
- Fat tails modeled: ${params.enableFatTails ? "yes" : "no"}
- Correlations modeled: ${params.enableCorrelations ? "yes" : "no"}
- Mean reversion modeled: ${params.enableMeanReversion ? "yes" : "no"}

SIMULATION RESULTS (10,000 iterations):
- Risk of ruin: ${results.riskOfRuin.toFixed(2)}%
- Expected CAGR: ${results.expectedCAGR.toFixed(2)}%
- Expected volatility: ${results.expectedVol.toFixed(2)}%
- Median final value: $${Math.round(results.medianFinal).toLocaleString()}
- 5th percentile final value: $${Math.round(results.p5Final).toLocaleString()}
- 95th percentile final value: $${Math.round(results.p95Final).toLocaleString()}
- Sharpe ratio: ${results.sharpeRatio.toFixed(2)}
- Sortino ratio: ${results.sortinoRatio.toFixed(2)}

Fill in five short fields (1-2 sentences each), grounded only in the numbers above:
1. riskReturn: the risk/return tradeoff this portfolio shows.
2. diversification: whether this portfolio is over- or under-diversified, based on the weights above.
3. consideration: one thing worth considering (e.g. sequence-of-returns risk given the risk of ruin figure, or what the Sharpe/Sortino gap implies).
4. rebalanceSuggestion: if justified by the numbers, name one asset worth trimming and one worth adding to reduce risk of ruin - phrased as "worth considering," not an instruction. Only recommend assets from this pool:
  { symbol: "SPY", name: "SPY (S&P500 ETF)", cagr: 0.1033, volatility: 0.1832, type: 'equity' },
  { symbol: "QQQ", name: "QQQ (NASDAQ ETF)", cagr: 0.0997, volatility: 0.2644, type: 'equity' },
  { symbol: "DIA", name: "DIA (Dow Jones ETF)", cagr: 0.0867, volatility: 0.1826, type: 'equity' },
  { symbol: "IDX", name: "IDX (JKSE ETF)", cagr: 0.0643, volatility: 0.2651, type: 'equity' },
  { symbol: "BTC", name: "Bitcoin", cagr: 0.5062, volatility: 0.6265, type: 'crypto' },
  { symbol: "ETH", name: "Ethereum", cagr: 0.2606, volatility: 0.7760, type: 'crypto' },
  { symbol: "SOL", name: "Solana", cagr: 1.0399, volatility: 1.1124, type: 'crypto' },
  { symbol: "SLV", name: "SLV (Silver ETF)", cagr: 0.0796, volatility: 0.3038, type: 'metal' },
  { symbol: "IAU", name: "IAU (Gold ETF)", cagr: 0.1093, volatility: 0.1725, type: 'metal' },
  { symbol: "VOO", name: "VOO (S&P500)", cagr: 0.1320, volatility: 0.1623, type: 'equity' },
  { symbol: "VTI", name: "VTI (Total Market)", cagr: 0.0900, volatility: 0.1861, type: 'equity' },
  { symbol: "VEA", name: "VEA (Developed Mkts)", cagr: 0.0437, volatility: 0.2070, type: 'equity' },
  { symbol: "VWO", name: "VWO (Emerging Mkts)", cagr: 0.0633, volatility: 0.2552, type: 'equity' },
  { symbol: "AVUV", name: "AVUV (Small Cap Value)", cagr: 0.1103, volatility: 0.2555, type: 'equity' },
  { symbol: "AVDV", name: "AVDV (Intl SCV)", cagr: 0.1116, volatility: 0.1742, type: 'equity' },
  { symbol: "AGG", name: "AGG (US Aggregate Bond)", cagr: 0.0410, volatility: 0.0550, type: 'bond' },
  If nothing is clearly warranted by the numbers, say the current mix looks reasonable instead of forcing a suggestion.
5. actionableInsight: one concrete, low-effort adjustment (e.g. lowering annual withdrawal).

Keep it plain, concrete, and grounded only in the numbers above. Do not invent facts about specific tickers beyond what's given.`;
}

export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  // --- Rate limit by IP (in-memory, best-effort) -------------------------
  const ip =
    req.headers["x-forwarded-for"]?.split(",")[0]?.trim() ||
    req.socket?.remoteAddress ||
    "unknown";

  if (isRateLimited(ip)) {
    return res.status(429).json({ error: "Rate limit exceeded. Try again later." });
  }

  // --- Validate payload ---------------------------------------------------
  const validationError = validatePayload(req.body);
  if (validationError) {
    return res.status(400).json({ error: validationError });
  }

  // --- Call Gemini with a timeout -----------------------------------------
  const prompt = buildPrompt(req.body);
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 15000); // 15s

  try {
    const response = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-3.5-flash-lite:generateContent?key=${process.env.GEMINI_API_KEY}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          contents: [{ parts: [{ text: prompt }] }],
          generationConfig: {
            maxOutputTokens: 600, // slightly higher cap - now 5 fields instead of 3
            temperature: 0.4,
            responseMimeType: "application/json",
            responseSchema: ANALYSIS_SCHEMA,
          },
        }),
        signal: controller.signal,
      }
    );

    if (!response.ok) {
      const errText = await response.text();
      console.error("Gemini error:", errText);
      return res.status(502).json({ error: "AI analysis failed. Try again shortly." });
    }

    const data = await response.json();
    const raw = data.candidates?.[0]?.content?.parts?.[0]?.text;

    if (!raw) {
      return res.status(502).json({ error: "No analysis returned." });
    }

    let analysis;
    try {
      analysis = JSON.parse(raw);
    } catch {
      console.error("Failed to parse Gemini JSON:", raw);
      return res.status(502).json({ error: "AI returned an unexpected format." });
    }

    const requiredFields = ["riskReturn", "diversification", "consideration", "rebalanceSuggestion", "actionableInsight"];
    const missing = requiredFields.filter(f => !analysis[f]);
    if (missing.length > 0) {
      console.error("Missing fields in AI response:", missing);
      return res.status(502).json({ error: "AI response missing expected fields." });
    }

    return res.status(200).json({ analysis });
  } catch (err) {
    if (err.name === "AbortError") {
      return res.status(504).json({ error: "AI analysis timed out." });
    }
    console.error("Unexpected error:", err);
    return res.status(500).json({ error: "Internal error." });
  } finally {
    clearTimeout(timeout);
  }
}
