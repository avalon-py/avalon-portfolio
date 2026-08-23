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

function buildPrompt({ portfolio, params, results }) {
  const holdings = portfolio
    .map(p => `- ${p.symbol}: ${p.weight}% weight, ${(p.cagr * 100).toFixed(1)}% CAGR, ${(p.volatility * 100).toFixed(1)}% volatility`)
    .join("\n");

  return `You are a portfolio analyst reviewing the output of a Monte Carlo retirement simulation. This is informational commentary on simulated numbers, NOT personalized financial advice - do not tell the user what to buy or sell, and do not claim certainty about future returns.

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

Give a short analysis (4-6 sentences):
1. One observation about the risk/return tradeoff this portfolio shows.
2. One observation about concentration or diversification, based on the weights above.
3. One thing worth considering (e.g. sequence-of-returns risk given the risk of ruin figure, or what the Sharpe/Sortino gap implies).

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
            maxOutputTokens: 400, // cap cost per call
            temperature: 0.4,
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
    const analysis = data.candidates?.[0]?.content?.parts?.[0]?.text;

    if (!analysis) {
      return res.status(502).json({ error: "No analysis returned." });
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
