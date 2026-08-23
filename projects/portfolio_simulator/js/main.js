import { PREDEFINED_ASSETS } from './constants.js';
import { runMonteCarlo } from './simulation.js';

// --- FORMATTING HELPERS ---

// Compact currency formatting that scales its own unit (k / M / B) instead
// of always dividing by 1,000 - so a $452,500,323 result reads as "$4.53M"
// (in fact 452.5M, but the point stands) rather than an unreadable "452500.3k".
function formatCompactCurrency(value, decimals = 2) {
    const sign = value < 0 ? '-' : '';
    const abs = Math.abs(value);
    if (abs >= 1e9) return `${sign}$${(abs / 1e9).toFixed(decimals)}B`;
    if (abs >= 1e6) return `${sign}$${(abs / 1e6).toFixed(decimals)}M`;
    if (abs >= 1e3) return `${sign}$${(abs / 1e3).toFixed(1)}k`;
    return `${sign}$${abs.toFixed(0)}`;
}

function formatRatio(value) {
    if (!isFinite(value)) return '—';
    return value.toFixed(2);
}

// --- STATE ---
const state = {
    portfolio: [],
    params: {
        initialEquity: 100000,
        annualWithdrawal: 4000,
        inflationRate: 2.5,
        timeHorizon: 30,
        riskFreeRate: 4.0,
        iterations: 10000,
        enableFatTails: false,
        enableCorrelations: false,
        enableMeanReversion: false,
    },
    isCustomMode: false,
    activeChartTab: 'projection',
    charts: {
        allocation: null,
        results: null,
        histogram: null,
    },
    // Cached results from the most recent successful runMonteCarlo() call.
    // The AI Analytics tab reads from this instead of re-running the sim.
    lastResults: null,
};

// --- DOM ELEMENTS ---
const elems = {
    assetSelect: document.getElementById('asset-select'),
    btnStdAsset: document.getElementById('btn-std-asset'),
    btnCustomAsset: document.getElementById('btn-custom-asset'),
    inputStdContainer: document.getElementById('input-std-container'),
    inputCustomContainer: document.getElementById('input-custom-container'),
    customTicker: document.getElementById('custom-ticker'),
    customCagr: document.getElementById('custom-cagr'),
    customVol: document.getElementById('custom-vol'),
    weightInput: document.getElementById('weight-input'),
    btnAddAsset: document.getElementById('btn-add-asset'),
    portfolioList: document.getElementById('portfolio-list'),
    totalWeightDisplay: document.getElementById('total-weight-display'),
    pieChartContainer: document.getElementById('pie-chart-container'),
    btnRunSim: document.getElementById('btn-run-sim'),

    // Params
    paramInitial: document.getElementById('param-initial'),
    paramWithdrawal: document.getElementById('param-withdrawal'),
    paramInflation: document.getElementById('param-inflation'),
    paramHorizon: document.getElementById('param-horizon'),
    paramRiskFree: document.getElementById('param-riskfree'),
    checkCorrelations: document.getElementById('check-correlations'),
    checkTails: document.getElementById('check-tails'),
    checkMeanReversion: document.getElementById('check-mean-reversion'),

    // Visuals
    loadingOverlay: document.getElementById('loading-overlay'),
    emptyState: document.getElementById('empty-state'),
    resultsContent: document.getElementById('results-content'),
    statusIndicator: document.getElementById('status-indicator'),
    statusText: document.getElementById('status-text'),

    // Metrics
    metricRisk: document.getElementById('metric-risk'),
    riskDot: document.getElementById('risk-dot'),
    metricMedian: document.getElementById('metric-median'),
    metricCagr: document.getElementById('metric-cagr'),
    metricVol: document.getElementById('metric-vol'),
    metricSharpe: document.getElementById('metric-sharpe'),
    metricSortino: document.getElementById('metric-sortino'),

    // Chart tabs / distribution panel
    tabProjection: document.getElementById('tab-projection'),
    tabDistribution: document.getElementById('tab-distribution'),
    projectionView: document.getElementById('projection-view'),
    distributionView: document.getElementById('distribution-view'),
    projectionLegend: document.getElementById('chart-legend-projection'),
    dispersionStats: document.getElementById('dispersion-stats'),

    // AI Analytics tab
    tabAi: document.getElementById('tab-ai'),
    aiView: document.getElementById('ai-view'),
    btnAskAi: document.getElementById('btn-ask-ai'),
    btnAskAiLabel: document.getElementById('btn-ask-ai-label'),
    aiEmpty: document.getElementById('ai-empty'),
    aiCards: document.getElementById('ai-cards'),
    aiCardRiskReturn: document.getElementById('ai-card-risk-return'),
    aiCardDiversification: document.getElementById('ai-card-diversification'),
    aiCardConsideration: document.getElementById('ai-card-consideration'),
    aiCardRebalance: document.getElementById('ai-card-rebalance'),
    aiCardActionable: document.getElementById('ai-card-actionable'),
    aiError: document.getElementById('ai-error'),
};

// --- INITIALIZATION ---
function init() {
    // Populate Select
    PREDEFINED_ASSETS.forEach(asset => {
        const option = document.createElement('option');
        option.value = asset.symbol;
        option.textContent = asset.name;
        elems.assetSelect.appendChild(option);
    });

    // Fixed-income note: we don't hardcode a hold-to-maturity bond ticker
    // since coupon rates move constantly. Point users to the Custom tab
    // instead, where they can enter today's rate themselves.
    addFixedIncomeNote();

    // Icons
    lucide.createIcons();

    // Event Listeners
    setupEventListeners();
}

function addFixedIncomeNote() {
    const note = document.createElement('p');
    note.id = 'fixed-income-note';
    note.className = 'text-xs text-quant-subtext italic mt-2 leading-relaxed';
    note.innerHTML = 'Want other fixed income exposure? Coupon rates change constantly, so head to ' +
        '<button type="button" id="fixed-income-note-link" class="underline hover:text-black font-medium not-italic">Custom</button> ' +
        'and add a near-zero-volatility asset using today\'s rate as the return.';
    elems.assetSelect.insertAdjacentElement('afterend', note);

    document.getElementById('fixed-income-note-link').addEventListener('click', () => setCustomMode(true));
}

function setupEventListeners() {
    // Input Toggles
    elems.btnStdAsset.addEventListener('click', () => setCustomMode(false));
    elems.btnCustomAsset.addEventListener('click', () => setCustomMode(true));

    // Add Asset
    elems.btnAddAsset.addEventListener('click', addAsset);
    elems.weightInput.addEventListener('keypress', (e) => {
        if(e.key === 'Enter') addAsset();
    });

    // Remove Asset (Event Delegation)
    elems.portfolioList.addEventListener('click', (e) => {
        const btn = e.target.closest('.delete-btn');
        if (btn) {
            removeAsset(btn.dataset.id);
        }
    });

    // Parameter Updates
    const updateParams = () => {
        state.params.initialEquity = parseFloat(elems.paramInitial.value) || 0;
        state.params.annualWithdrawal = parseFloat(elems.paramWithdrawal.value) || 0;
        state.params.inflationRate = parseFloat(elems.paramInflation.value) || 0;
        state.params.timeHorizon = parseFloat(elems.paramHorizon.value) || 0;
        state.params.riskFreeRate = parseFloat(elems.paramRiskFree.value) || 0;
        state.params.enableCorrelations = elems.checkCorrelations.checked;
        state.params.enableFatTails = elems.checkTails.checked;
        state.params.enableMeanReversion = elems.checkMeanReversion.checked;
    };

    [elems.paramInitial, elems.paramWithdrawal, elems.paramInflation, elems.paramHorizon, elems.paramRiskFree].forEach(el => {
        if (el) el.addEventListener('input', updateParams);
    });
    [elems.checkCorrelations, elems.checkTails, elems.checkMeanReversion].forEach(el => {
        el.addEventListener('change', updateParams);
    });

    // Run Simulation
    elems.btnRunSim.addEventListener('click', runSimulation);

    // Chart Tabs
    if (elems.tabProjection && elems.tabDistribution) {
        elems.tabProjection.addEventListener('click', () => setActiveChartTab('projection'));
        elems.tabDistribution.addEventListener('click', () => setActiveChartTab('distribution'));
    }
    if (elems.tabAi) {
        elems.tabAi.addEventListener('click', () => setActiveChartTab('ai'));
    }

    // AI Analytics
    if (elems.btnAskAi) {
        elems.btnAskAi.addEventListener('click', askAiToAnalyze);
    }
}

// --- LOGIC ---

function setCustomMode(isCustom) {
    state.isCustomMode = isCustom;
    if (isCustom) {
        elems.btnCustomAsset.classList.replace('text-gray-500', 'bg-white');
        elems.btnCustomAsset.classList.replace('hover:text-black', 'shadow-sm');
        elems.btnCustomAsset.classList.add('text-black');

        elems.btnStdAsset.classList.remove('bg-white', 'shadow-sm', 'text-black');
        elems.btnStdAsset.classList.add('text-gray-500', 'hover:text-black');

        elems.inputStdContainer.classList.add('hidden');
        elems.inputCustomContainer.classList.remove('hidden');
    } else {
        elems.btnStdAsset.classList.replace('text-gray-500', 'bg-white');
        elems.btnStdAsset.classList.replace('hover:text-black', 'shadow-sm');
        elems.btnStdAsset.classList.add('text-black');

        elems.btnCustomAsset.classList.remove('bg-white', 'shadow-sm', 'text-black');
        elems.btnCustomAsset.classList.add('text-gray-500', 'hover:text-black');

        elems.inputCustomContainer.classList.add('hidden');
        elems.inputStdContainer.classList.remove('hidden');
    }
}

function addAsset() {
    const weight = parseFloat(elems.weightInput.value);
    if (isNaN(weight) || weight <= 0) return;

    let newItem;

    if (state.isCustomMode) {
        const ticker = elems.customTicker.value.trim().toUpperCase();
        const cagr = parseFloat(elems.customCagr.value);
        const vol = parseFloat(elems.customVol.value);

        if (!ticker || isNaN(cagr) || isNaN(vol)) return;

        newItem = {
            id: Math.random().toString(36).substr(2, 9),
            symbol: ticker,
            weight: weight,
            cagr: cagr / 100,
            volatility: vol / 100,
            isCustom: true
        };

        // Reset Inputs
        elems.customTicker.value = '';
        elems.customCagr.value = '';
        elems.customVol.value = '';

    } else {
        const symbol = elems.assetSelect.value;
        const asset = PREDEFINED_ASSETS.find(a => a.symbol === symbol);

        const existing = state.portfolio.find(p => p.symbol === symbol && !p.isCustom);

        if (existing) {
            existing.weight += weight;
            updatePortfolioUI();
            elems.weightInput.value = '';
            return;
        }

        newItem = {
            id: Math.random().toString(36).substr(2, 9),
            symbol: asset.symbol,
            weight: weight,
            cagr: asset.cagr,
            volatility: asset.volatility,
            isCustom: false
        };
    }

    state.portfolio.push(newItem);
    elems.weightInput.value = '';
    updatePortfolioUI();
}

function removeAsset(id) {
    state.portfolio = state.portfolio.filter(p => p.id !== id);
    updatePortfolioUI();
}

function updatePortfolioUI() {
    // 1. Update List
    elems.portfolioList.innerHTML = '';

    if (state.portfolio.length === 0) {
        elems.portfolioList.innerHTML = '<li class="text-quant-subtext text-xs italic py-6 text-center">No assets configured.</li>';
        elems.pieChartContainer.classList.add('hidden');
    } else {
        elems.pieChartContainer.classList.remove('hidden');
        state.portfolio.forEach(item => {
            const li = document.createElement('li');
            li.className = 'flex justify-between items-center px-3 py-2 hover:bg-gray-50 group transition-colors';
            li.innerHTML = `
                <div>
                  <span class="font-bold text-xs text-black block">${item.symbol}</span>
                </div>
                <div class="flex items-center gap-3">
                  <span class="font-mono text-xs text-gray-600">${item.weight}%</span>
                  <button class="delete-btn text-gray-300 hover:text-red-600 transition-colors" data-id="${item.id}">
                    <i data-lucide="trash-2" class="w-3 h-3"></i>
                  </button>
                </div>
            `;
            elems.portfolioList.appendChild(li);
        });
        lucide.createIcons();
    }

    // 2. Update Total Weight
    const totalWeight = state.portfolio.reduce((sum, p) => sum + p.weight, 0);
    elems.totalWeightDisplay.textContent = totalWeight.toFixed(1) + '%';

    const isValid = Math.abs(totalWeight - 100) < 0.1;
    if (isValid) {
        elems.totalWeightDisplay.classList.remove('text-red-600');
        elems.totalWeightDisplay.classList.add('text-emerald-600');
        elems.btnRunSim.disabled = false;
    } else {
        elems.totalWeightDisplay.classList.remove('text-emerald-600');
        elems.totalWeightDisplay.classList.add('text-red-600');
        elems.btnRunSim.disabled = true;
    }

    // 3. Update Pie Chart
    updatePieChart();

    // Portfolio changed - any previously fetched AI analysis (and cached
    // results) no longer describes the current setup, so clear both.
    state.lastResults = null;
    resetAiPanel();
}

// --- CHART TABS ---

function setActiveChartTab(tab) {
    state.activeChartTab = tab;
    if (!elems.tabProjection || !elems.tabDistribution) return;

    const activate = (btn) => {
        btn.classList.add('bg-black', 'text-white');
        btn.classList.remove('text-quant-subtext', 'hover:text-black');
    };
    const deactivate = (btn) => {
        btn.classList.remove('bg-black', 'text-white');
        btn.classList.add('text-quant-subtext', 'hover:text-black');
    };

    // Deactivate all tabs, hide all views first, then activate/show the
    // selected one - keeps this correct regardless of how many tabs exist.
    [elems.tabProjection, elems.tabDistribution, elems.tabAi].forEach(btn => {
        if (btn) deactivate(btn);
    });
    if (elems.projectionView) elems.projectionView.classList.add('hidden');
    if (elems.distributionView) elems.distributionView.classList.add('hidden');
    if (elems.aiView) elems.aiView.classList.add('hidden');
    if (elems.projectionLegend) elems.projectionLegend.classList.add('hidden');

    if (tab === 'projection') {
        activate(elems.tabProjection);
        elems.projectionView.classList.remove('hidden');
        if (elems.projectionLegend) elems.projectionLegend.classList.remove('hidden');
        if (state.charts.results) state.charts.results.resize();
    } else if (tab === 'distribution') {
        activate(elems.tabDistribution);
        elems.distributionView.classList.remove('hidden');
        if (state.charts.histogram) state.charts.histogram.resize();
    } else if (tab === 'ai') {
        if (elems.tabAi) activate(elems.tabAi);
        if (elems.aiView) elems.aiView.classList.remove('hidden');
    }
}

// --- CHARTS ---

function updatePieChart() {
    const ctx = document.getElementById('allocationChart').getContext('2d');

    const data = {
        labels: state.portfolio.map(p => p.symbol),
        datasets: [{
            data: state.portfolio.map(p => p.weight),
            backgroundColor: ['#171717', '#404040', '#737373', '#a3a3a3', '#d4d4d4', '#e5e5e5'],
            borderWidth: 0
        }]
    };

    if (state.charts.allocation) {
        state.charts.allocation.data = data;
        state.charts.allocation.update();
    } else {
        state.charts.allocation = new Chart(ctx, {
            type: 'doughnut',
            data: data,
            options: {
                responsive: true,
                maintainAspectRatio: false,
                cutout: '65%',
                plugins: {
                    legend: { display: false },
                    tooltip: {
                        backgroundColor: '#171717',
                        titleFont: { family: 'JetBrains Mono' },
                        bodyFont: { family: 'JetBrains Mono' },
                        displayColors: false,
                        callbacks: {
                            label: (ctx) => ` ${ctx.label}: ${ctx.raw}%`
                        }
                    }
                }
            }
        });
    }
}

function updateResultsChart(results) {
    const ctx = document.getElementById('resultsChart').getContext('2d');

    // Create Gradients
    const gradientTop = ctx.createLinearGradient(0, 0, 0, 400);
    gradientTop.addColorStop(0, 'rgba(16, 185, 129, 0.1)');
    gradientTop.addColorStop(1, 'rgba(16, 185, 129, 0)');

    const data = {
        labels: results.years,
        datasets: [
            {
                label: '95th Percentile',
                data: results.topPath,
                borderColor: '#10b981',
                backgroundColor: gradientTop,
                borderWidth: 1,
                pointRadius: 0,
                fill: true,
                tension: 0.4
            },
            {
                label: 'Median',
                data: results.medianPath,
                borderColor: '#000000',
                borderWidth: 2,
                pointRadius: 0,
                fill: false,
                tension: 0.4
            },
            {
                label: '5th Percentile',
                data: results.bottomPath,
                borderColor: '#ef4444',
                borderWidth: 1,
                pointRadius: 0,
                borderDash: [5, 5],
                fill: false,
                tension: 0.4
            }
        ]
    };

    if (state.charts.results) {
        state.charts.results.data = data;
        state.charts.results.update();
    } else {
        state.charts.results = new Chart(ctx, {
            type: 'line',
            data: data,
            options: {
                responsive: true,
                maintainAspectRatio: false,
                interaction: {
                    mode: 'index',
                    intersect: false,
                },
                scales: {
                    x: {
                        grid: { display: false },
                        ticks: {
                            font: { family: 'JetBrains Mono', size: 10 },
                            color: '#a3a3a3',
                            maxTicksLimit: 10
                        }
                    },
                    y: {
                        grid: { color: '#f5f5f5' },
                        ticks: {
                            font: { family: 'JetBrains Mono', size: 10 },
                            color: '#a3a3a3',
                            callback: (val) => formatCompactCurrency(val, 0)
                        }
                    }
                },
                plugins: {
                    legend: { display: false },
                    tooltip: {
                        backgroundColor: '#171717',
                        titleColor: '#737373',
                        titleFont: { family: 'JetBrains Mono', size: 10 },
                        bodyFont: { family: 'JetBrains Mono', size: 12 },
                        padding: 12,
                        cornerRadius: 0,
                        displayColors: true,
                        callbacks: {
                            title: (ctx) => `Year ${ctx[0].label}`,
                            label: (ctx) => ` ${ctx.dataset.label}: ${formatCompactCurrency(ctx.raw)}`
                        }
                    }
                }
            }
        });
    }
}

// Histogram of terminal (final-year) portfolio values across all 10,000
// simulated paths - shows how spread out the outcomes actually are,
// rather than just the three summary percentile lines on the projection
// chart.
function updateHistogramChart(results) {
    const canvas = document.getElementById('histogramChart');
    if (!canvas) return;
    const ctx = canvas.getContext('2d');

    const bins = results.histogram;
    const labels = bins.map(b => formatCompactCurrency((b.x0 + b.x1) / 2, 1));
    const counts = bins.map(b => b.count);

    // Highlight the bin containing the mean outcome so it's easy to see
    // where the "average" path actually sits relative to the spread.
    const meanIdx = bins.findIndex(b => results.finalMean >= b.x0 && results.finalMean <= b.x1);
    const colors = bins.map((_, i) => i === meanIdx ? '#171717' : '#d4d4d4');

    const data = {
        labels,
        datasets: [{
            label: 'Simulated Paths',
            data: counts,
            backgroundColor: colors,
            borderWidth: 0,
            categoryPercentage: 1.0,
            barPercentage: 0.95,
        }]
    };

    if (state.charts.histogram) {
        state.charts.histogram.data = data;
        state.charts.histogram.update();
    } else {
        state.charts.histogram = new Chart(ctx, {
            type: 'bar',
            data: data,
            options: {
                responsive: true,
                maintainAspectRatio: false,
                scales: {
                    x: {
                        grid: { display: false },
                        ticks: {
                            font: { family: 'JetBrains Mono', size: 9 },
                            color: '#a3a3a3',
                            maxRotation: 60,
                            minRotation: 60,
                            autoSkip: true,
                            maxTicksLimit: 12,
                        }
                    },
                    y: {
                        grid: { color: '#f5f5f5' },
                        ticks: {
                            font: { family: 'JetBrains Mono', size: 10 },
                            color: '#a3a3a3',
                        },
                        title: {
                            display: true,
                            text: '# OF PATHS',
                            font: { family: 'JetBrains Mono', size: 9 },
                            color: '#a3a3a3',
                        }
                    }
                },
                plugins: {
                    legend: { display: false },
                    tooltip: {
                        backgroundColor: '#171717',
                        titleFont: { family: 'JetBrains Mono', size: 10 },
                        bodyFont: { family: 'JetBrains Mono', size: 12 },
                        padding: 12,
                        cornerRadius: 0,
                        displayColors: false,
                        callbacks: {
                            title: (ctx) => `Outcome ≈ ${ctx[0].label}`,
                            label: (ctx) => ` ${ctx.raw.toLocaleString()} paths`
                        }
                    }
                }
            }
        });
    }
}

function updateDispersionStats(results) {
    if (!elems.dispersionStats) return;

    const spread = results.p95Final - results.p5Final;

    elems.dispersionStats.innerHTML = `
        <div class="space-y-4">
            <div>
                <div class="flex justify-between text-[10px] uppercase font-bold text-quant-subtext mb-1">
                    <span>Mean Outcome</span>
                </div>
                <div class="text-lg font-mono text-black">${formatCompactCurrency(results.finalMean)}</div>
            </div>
            <div>
                <div class="flex justify-between text-[10px] uppercase font-bold text-quant-subtext mb-1">
                    <span>Std. Deviation</span>
                </div>
                <div class="text-lg font-mono text-black">${formatCompactCurrency(results.finalStdDev)}</div>
            </div>
            <div class="pt-3 border-t border-quant-border text-[11px] leading-relaxed text-quant-subtext">
                <strong class="text-black">${results.pctWithin1Std.toFixed(1)}%</strong> of the 10,000 simulated paths
                landed within one standard deviation of the mean outcome
                (${formatCompactCurrency(Math.max(0, results.finalMean - results.finalStdDev))} –
                ${formatCompactCurrency(results.finalMean + results.finalStdDev)}).
            </div>
            <div class="text-[11px] leading-relaxed text-quant-subtext">
                The middle 90% of outcomes (5th–95th percentile) ranged from
                <strong class="text-black">${formatCompactCurrency(results.p5Final)}</strong> to
                <strong class="text-black">${formatCompactCurrency(results.p95Final)}</strong>,
                a spread of <strong class="text-black">${formatCompactCurrency(spread)}</strong>.
            </div>
        </div>
    `;
}

// --- AI ANALYTICS ---

function resetAiPanel() {
    if (elems.aiError) elems.aiError.classList.add('hidden');
    if (elems.aiCards) elems.aiCards.classList.add('hidden');
    if (elems.aiEmpty) elems.aiEmpty.classList.remove('hidden');
    if (elems.btnAskAi) {
        elems.btnAskAi.disabled = false;
        if (elems.btnAskAiLabel) elems.btnAskAiLabel.textContent = 'Ask AI to Analyze Portfolio';
    }
}

async function askAiToAnalyze() {
    if (!state.lastResults) {
        if (elems.aiError) {
            elems.aiError.textContent = 'Run a simulation first.';
            elems.aiError.classList.remove('hidden');
        }
        return;
    }

    elems.btnAskAi.disabled = true;
    if (elems.btnAskAiLabel) elems.btnAskAiLabel.textContent = 'Analyzing...';
    elems.aiError.classList.add('hidden');
    elems.aiCards.classList.add('hidden');
    elems.aiEmpty.classList.add('hidden');
    

    try {
        const response = await fetch('/api/portfolio-simulator/analyze-portfolio', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                portfolio: state.portfolio,
                params: state.params,
                results: state.lastResults,
            }),
        });

        const data = await response.json();

        if (!response.ok) {
            elems.aiError.textContent = data.error || 'Something went wrong.';
            elems.aiError.classList.remove('hidden');
            elems.aiEmpty.classList.remove('hidden');
            return;
        }

        elems.aiCardRiskReturn.textContent = data.analysis.riskReturn;
        elems.aiCardDiversification.textContent = data.analysis.diversification;
        elems.aiCardConsideration.textContent = data.analysis.consideration;
        elems.aiCards.classList.remove('hidden');
    } catch (err) {
        console.error(err);
        elems.aiError.textContent = 'Network error - try again.';
        elems.aiError.classList.remove('hidden');
        elems.aiEmpty.classList.remove('hidden');
    } finally {
        elems.btnAskAi.disabled = false;
        if (elems.btnAskAiLabel) elems.btnAskAiLabel.textContent = 'Ask AI to Analyze Portfolio';
    }
}

// --- SIMULATION ---

async function runSimulation() {
    // UI Loading State
    elems.loadingOverlay.classList.remove('hidden');
    elems.statusIndicator.classList.remove('bg-emerald-500');
    elems.statusIndicator.classList.add('bg-yellow-400', 'animate-pulse');
    elems.statusText.textContent = "COMPUTING MODEL...";
    elems.btnRunSim.disabled = true;

    // Small delay to allow UI to paint loading state
    await new Promise(r => setTimeout(r, 100));

    try {
        const results = await runMonteCarlo(state.portfolio, state.params);

        // Cache results for the AI Analytics tab - it reads this instead
        // of re-running the simulation when the button is pressed.
        state.lastResults = results;
        resetAiPanel();

        // Render Results
        elems.emptyState.classList.add('hidden');
        elems.resultsContent.classList.remove('hidden');

        // Update Metrics
        elems.metricRisk.textContent = results.riskOfRuin.toFixed(2) + '%';
        elems.metricRisk.className = `text-3xl font-mono font-medium tracking-tighter ${results.riskOfRuin > 5 ? 'text-red-600' : 'text-emerald-600'}`;
        elems.riskDot.className = `w-1.5 h-1.5 rounded-full ${results.riskOfRuin > 5 ? 'bg-red-600' : 'bg-emerald-500'}`;

        elems.metricMedian.textContent = formatCompactCurrency(results.medianFinal);
        elems.metricCagr.textContent = results.expectedCAGR.toFixed(2) + '%';
        elems.metricVol.textContent = results.expectedVol.toFixed(2) + '%';
        if (elems.metricSharpe) elems.metricSharpe.textContent = formatRatio(results.sharpeRatio);
        if (elems.metricSortino) elems.metricSortino.textContent = formatRatio(results.sortinoRatio);

        // Render Charts
        updateResultsChart(results);
        updateHistogramChart(results);
        updateDispersionStats(results);
        setActiveChartTab(state.activeChartTab || 'projection');

    } catch (e) {
        console.error(e);
        alert("Simulation failed.");
    } finally {
        // Reset UI
        elems.loadingOverlay.classList.add('hidden');
        elems.statusIndicator.classList.remove('bg-yellow-400', 'animate-pulse');
        elems.statusIndicator.classList.add('bg-emerald-500');
        elems.statusText.textContent = "SYSTEM READY";
        elems.btnRunSim.disabled = false;
    }
}

// Start App
document.addEventListener('DOMContentLoaded', init);
