import { PREDEFINED_ASSETS } from './constants.js';
import { runMonteCarlo } from './simulation.js';

// --- STATE ---
const state = {
    portfolio: [],
    params: {
        initialEquity: 100000,
        annualWithdrawal: 4000,
        inflationRate: 2.5,
        timeHorizon: 30,
        iterations: 10000,
        enableFatTails: false,
        enableCorrelations: false,
        enableMeanReversion: false,
    },
    isCustomMode: false,
    charts: {
        allocation: null,
        results: null
    }
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

    // Icons
    lucide.createIcons();

    // Event Listeners
    setupEventListeners();
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
        state.params.enableCorrelations = elems.checkCorrelations.checked;
        state.params.enableFatTails = elems.checkTails.checked;
        state.params.enableMeanReversion = elems.checkMeanReversion.checked;
    };

    [elems.paramInitial, elems.paramWithdrawal, elems.paramInflation, elems.paramHorizon].forEach(el => {
        el.addEventListener('input', updateParams);
    });
    [elems.checkCorrelations, elems.checkTails, elems.checkMeanReversion].forEach(el => {
        el.addEventListener('change', updateParams);
    });

    // Run Simulation
    elems.btnRunSim.addEventListener('click', runSimulation);
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
            // Removed the custom tag logic as requested
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
                            callback: (val) => '$' + (val / 1000).toFixed(0) + 'k'
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
                            label: (ctx) => {
                                const val = Math.round(ctx.raw).toLocaleString();
                                return ` ${ctx.dataset.label}: $${val}`;
                            }
                        }
                    }
                }
            }
        });
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
        
        // Render Results
        elems.emptyState.classList.add('hidden');
        elems.resultsContent.classList.remove('hidden');
        
        // Update Metrics
        elems.metricRisk.textContent = results.riskOfRuin.toFixed(2) + '%';
        elems.metricRisk.className = `text-3xl font-mono font-medium tracking-tighter ${results.riskOfRuin > 5 ? 'text-red-600' : 'text-emerald-600'}`;
        elems.riskDot.className = `w-1.5 h-1.5 rounded-full ${results.riskOfRuin > 5 ? 'bg-red-600' : 'bg-emerald-500'}`;
        
        elems.metricMedian.textContent = '$' + (results.medianFinal / 1000).toFixed(1) + 'k';
        elems.metricCagr.textContent = results.expectedCAGR.toFixed(2) + '%';
        elems.metricVol.textContent = results.expectedVol.toFixed(2) + '%';

        // Render Chart
        updateResultsChart(results);

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
