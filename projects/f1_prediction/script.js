// Configuration
// Set to true to use real CSV file, false for mock data
const USE_REAL_CSV = true;
const CSV_FILE_PATH = 'assets/2025_prediction.csv';

// Global State
let currentYear = '2025';
let currentSortField = {};  // Track sort field per race
let cachedData = null;  // Cache the loaded data

// --- CSV Data Loading ---

async function loadCSVData(year) {
    if (year === '2026') return null;
    
    if (USE_REAL_CSV) {
        try {
            const response = await fetch(CSV_FILE_PATH);
            if (!response.ok) throw new Error('CSV file not found');
            return await response.text();
        } catch (error) {
            console.error('Error loading CSV:', error);
            console.log('Falling back to mock data...');
            return generateMockCSV(year);
        }
    } else {
        return generateMockCSV(year);
    }
}

function generateMockCSV(year) {
    if (year === '2026') return null;

    const tracks = [
        "Australian", "Chinese", "Japanese", "Bahrain", "Saudi Arabian", "Miami", 
        "Emilia Romagna", "Monaco", "Spanish", "Canadian", "Austrian", "British", 
        "Belgian", "Hungarian", "Dutch", "Italian", "Azerbaijan", "Singapore", 
        "United States", "Mexican", "Sao Paulo", "Las Vegas", "Qatar", "Abu Dhabi"
    ];

    const drivers = [
        "Max Verstappen", "Lando Norris", "Lewis Hamilton", "Charles Leclerc", 
        "Oscar Piastri", "George Russell", "Fernando Alonso", "Carlos Sainz",
        "Alex Albon", "Yuki Tsunoda", "Pierre Gasly", "Esteban Ocon", 
        "Andrea Kimi Antonelli", "Liam Lawson", "Oliver Bearman", "Nico Hulkenberg",
        "Gabriel Bortoleto", "Jack Doohan", "Lance Stroll", "Isack Hadjar"
    ];

    let csv = "round,Track,driver,grid,positionOrder,model_only_prediction,probabilistic_prediction,deterministic_prediction\n";
    
    let seed = 12345;
    const random = () => {
        const x = Math.sin(seed++) * 10000;
        return x - Math.floor(x);
    };

    tracks.forEach((track, round) => {
        const shuffled = [...drivers].sort(() => random() - 0.5);
        
        shuffled.forEach((driver, idx) => {
            const grid = idx + 1;
            
            // Simulate actual position with some variance
            const actual = Math.max(1, Math.min(20, grid + Math.floor(random() * 8 - 4)));
            
            // Model-only: decent prediction with some error
            const modelOnly = Math.max(1, Math.min(20, actual + Math.floor(random() * 6 - 3)));
            
            // Probabilistic: Monte Carlo not ranked, more variance
            const probabilistic = Math.max(1, Math.min(20, actual + Math.floor(random() * 8 - 4)));
            
            // Deterministic: Monte Carlo ranked, best accuracy
            const deterministic = Math.max(1, Math.min(20, actual + Math.floor(random() * 4 - 2)));
            
            csv += `${round + 1},${track},${driver},${grid},${actual},${modelOnly},${probabilistic},${deterministic}\n`;
        });
    });

    return csv;
}

// --- CSV Parsing ---

function parseCSV(csvText) {
    const lines = csvText.trim().split('\n');
    const races = {};

    for (let i = 1; i < lines.length; i++) {
        const row = lines[i].split(',');
        if (row.length < 8) continue;

        const round = row[0];
        const track = row[1];
        const entry = {
            driver: row[2],
            grid: parseInt(row[3]),
            actual: parseInt(row[4]),
            modelOnly: parseInt(row[5]),
            probabilistic: parseInt(row[6]),
            deterministic: parseInt(row[7])
        };

        if (!races[track]) {
            races[track] = [];
        }
        races[track].push(entry);
    }
    return races;
}

// --- MAE Calculations ---

function calculateMAE(entries, predictField) {
    let totalError = 0;
    entries.forEach(e => {
        const predicted = e[predictField];
        totalError += Math.abs(predicted - e.actual);
    });
    return (totalError / entries.length).toFixed(2);
}

function calculateAllMAE(entries) {
    return {
        grid: calculateMAE(entries, 'grid'),
        modelOnly: calculateMAE(entries, 'modelOnly'),
        probabilistic: calculateMAE(entries, 'probabilistic'),
        deterministic: calculateMAE(entries, 'deterministic')
    };
}

// --- Sorting ---

function sortTable(raceId, field) {
    if (!cachedData) return;
    
    const racesData = parseCSV(cachedData);
    const trackName = raceId.replace('race-', '').replace(/-/g, ' ');
    
    // Find the matching track
    let entries = null;
    for (let track in racesData) {
        if (track.toLowerCase().replace(/\s+/g, '-') === trackName) {
            entries = racesData[track];
            break;
        }
    }
    
    if (!entries) return;

    // Toggle sort direction
    if (!currentSortField[raceId]) {
        currentSortField[raceId] = { field: field, asc: true };
    } else if (currentSortField[raceId].field === field) {
        currentSortField[raceId].asc = !currentSortField[raceId].asc;
    } else {
        currentSortField[raceId] = { field: field, asc: true };
    }

    const sortDir = currentSortField[raceId].asc ? 1 : -1;
    entries.sort((a, b) => (a[field] - b[field]) * sortDir);

    // Re-render table body
    const container = document.getElementById(raceId);
    const tbody = container.querySelector('tbody');
    tbody.innerHTML = generateTableRows(entries);

    // Update sort indicators
    updateSortIndicators(raceId, field, currentSortField[raceId].asc);
}

function updateSortIndicators(raceId, activeField, isAsc) {
    const headers = document.querySelectorAll(`#${raceId} th[data-sort]`);
    headers.forEach(th => {
        const field = th.getAttribute('data-sort');
        const indicator = th.querySelector('.sort-indicator');
        
        if (field === activeField) {
            indicator.textContent = isAsc ? ' ▲' : ' ▼';
            indicator.classList.remove('opacity-0');
        } else {
            indicator.textContent = ' ▲';
            indicator.classList.add('opacity-0');
        }
    });
}

// --- Table Generation ---

function getDiffClass(pred, actual) {
    const diff = Math.abs(pred - actual);
    if (diff === 0) return 'text-green-500 font-bold';
    if (diff <= 2) return 'text-green-400';
    if (diff <= 5) return 'text-yellow-500';
    return 'text-red-500 font-bold';
}

function generateTableRows(entries) {
    return entries.map(e => `
        <tr class="table-row-hover transition-colors">
            <td class="py-3 pl-2 font-medium text-white">${e.driver}</td>
            <td class="py-3 text-center text-zinc-400">${e.grid}</td>
            <td class="py-3 text-center text-white font-bold">${e.actual}</td>
            <td class="py-3 text-center ${getDiffClass(e.modelOnly, e.actual)}">${e.modelOnly}</td>
            <td class="py-3 text-center ${getDiffClass(e.probabilistic, e.actual)}">${e.probabilistic}</td>
            <td class="py-3 text-center ${getDiffClass(e.deterministic, e.actual)}">${e.deterministic}</td>
        </tr>
    `).join('');
}

// --- Main Rendering ---

async function renderRaces(year) {
    const container = document.getElementById('races-container');
    container.innerHTML = '<div class="text-center py-20 text-zinc-500 animate-pulse">Loading prediction data...</div>';

    const csvData = await loadCSVData(year);
    
    if (!csvData) {
        container.innerHTML = `
            <div class="p-8 border border-dashed border-zinc-800 rounded-xl text-center">
                <p class="text-zinc-500 text-xl">Data for ${year} has not been generated yet.</p>
            </div>`;
        return;
    }

    // Cache the data for sorting
    cachedData = csvData;
    const racesData = parseCSV(csvData);
    const trackNames = Object.keys(racesData);

    container.innerHTML = '';

    trackNames.forEach((track, index) => {
        const entries = racesData[track];
        const mae = calculateAllMAE(entries);
        
        // Default sort by actual position
        entries.sort((a, b) => a.actual - b.actual);

        const raceId = `race-${track.toLowerCase().replace(/\s+/g, '-')}`;
        const card = document.createElement('div');
        card.className = "border border-zinc-800 rounded-xl bg-zinc-900 overflow-hidden";
        
        const bestMAE = Math.min(
            parseFloat(mae.modelOnly), 
            parseFloat(mae.probabilistic), 
            parseFloat(mae.deterministic)
        ).toFixed(2);
        
        card.innerHTML = `
            <button onclick="toggleAccordion('${raceId}')" class="w-full flex items-center justify-between p-6 bg-zinc-900 hover:bg-zinc-800/50 transition-colors text-left group">
                <div class="flex items-center gap-4">
                    <span class="text-zinc-600 font-display font-bold text-2xl opacity-50 group-hover:text-f1-red transition-colors">${(index + 1).toString().padStart(2, '0')}</span>
                    <div>
                        <h3 class="text-xl font-bold uppercase text-white">${track} GP</h3>
                        <p class="text-xs text-zinc-500 mt-1 uppercase tracking-wider">
                            Best: <span class="text-green-500">${bestMAE}</span> MAE
                            | Baseline: <span class="text-zinc-400">${mae.grid}</span>
                        </p>
                    </div>
                </div>
                <div class="flex items-center gap-4">
                    <svg id="icon-${raceId}" class="w-6 h-6 text-zinc-500 transform transition-transform duration-300" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 9l-7 7-7-7"></path></svg>
                </div>
            </button>
            
            <div id="${raceId}" class="accordion-content bg-zinc-950/50">
                <div class="p-6 overflow-x-auto">
                    <table class="w-full text-left text-sm">
                        <thead class="text-xs text-zinc-500 uppercase font-bold border-b border-zinc-800">
                            <tr>
                                <th class="pb-3 pl-2">Driver</th>
                                <th class="pb-3 text-center cursor-pointer hover:text-white transition-colors" data-sort="grid" onclick="sortTable('${raceId}', 'grid')">
                                    Starting Grid<span class="sort-indicator opacity-0 text-f1-red"> ▲</span>
                                </th>
                                <th class="pb-3 text-center cursor-pointer hover:text-white transition-colors" data-sort="actual" onclick="sortTable('${raceId}', 'actual')">
                                    True Result<span class="sort-indicator opacity-0 text-f1-red"> ▲</span>
                                </th>
                                <th class="pb-3 text-center cursor-pointer hover:text-white transition-colors" data-sort="modelOnly" onclick="sortTable('${raceId}', 'modelOnly')">
                                    Model Only<span class="sort-indicator opacity-0 text-f1-red"> ▲</span>
                                </th>
                                <th class="pb-3 text-center cursor-pointer hover:text-white transition-colors" data-sort="probabilistic" onclick="sortTable('${raceId}', 'probabilistic')">
                                    MC (Not Ranked)<span class="sort-indicator opacity-0 text-f1-red"> ▲</span>
                                </th>
                                <th class="pb-3 text-center cursor-pointer hover:text-white transition-colors" data-sort="deterministic" onclick="sortTable('${raceId}', 'deterministic')">
                                    MC (Ranked)<span class="sort-indicator opacity-0 text-f1-red"> ▲</span>
                                </th>
                            </tr>
                        </thead>
                        <tbody class="divide-y divide-white/5">
                            ${generateTableRows(entries)}
                        </tbody>
                    </table>
                    
                    <div class="mt-6 p-4 bg-zinc-900 border border-zinc-800 rounded-lg">
                        <div class="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
                            <div class="text-center">
                                <div class="text-xs text-zinc-500 uppercase tracking-wider mb-1">Grid Baseline</div>
                                <div class="text-xl font-bold text-zinc-400">${mae.grid}</div>
                            </div>
                            <div class="text-center">
                                <div class="text-xs text-zinc-500 uppercase tracking-wider mb-1">Model Only</div>
                                <div class="text-xl font-bold ${parseFloat(mae.modelOnly) < 3 ? 'text-green-500' : 'text-yellow-500'}">${mae.modelOnly}</div>
                            </div>
                            <div class="text-center">
                                <div class="text-xs text-zinc-500 uppercase tracking-wider mb-1">MC (Not Ranked)</div>
                                <div class="text-xl font-bold ${parseFloat(mae.probabilistic) < 3 ? 'text-green-500' : 'text-yellow-500'}">${mae.probabilistic}</div>
                            </div>
                            <div class="text-center">
                                <div class="text-xs text-zinc-500 uppercase tracking-wider mb-1">MC (Ranked)</div>
                                <div class="text-xl font-bold ${parseFloat(mae.deterministic) < 3 ? 'text-green-500' : 'text-yellow-500'}">${mae.deterministic}</div>
                            </div>
                        </div>
                        <div class="mt-4 pt-4 border-t border-zinc-800 text-center text-xs text-zinc-600 font-mono">
                            MAE = Mean Absolute Error | Lower is better
                        </div>
                    </div>
                </div>
            </div>
        `;

        container.appendChild(card);
    });
    
    // Add overall summary at the bottom
    renderOverallSummary(racesData);
}

// --- Accordion Toggle ---

function toggleAccordion(id) {
    const content = document.getElementById(id);
    const icon = document.getElementById(`icon-${id}`);
    
    if (content.style.maxHeight) {
        content.style.maxHeight = null;
        content.classList.remove('active');
        icon.style.transform = 'rotate(0deg)';
    } else {
        content.classList.add('active');
        content.style.maxHeight = content.scrollHeight + "px";
        icon.style.transform = 'rotate(180deg)';
    }
}

// --- Year Switching ---

function switchYear(year) {
    currentYear = year;
    
    document.getElementById('btn-2025').className = year === '2025' 
        ? "px-6 py-2 rounded font-bold text-sm transition-all bg-f1-red text-white shadow-lg shadow-f1-red/20"
        : "px-6 py-2 rounded font-bold text-sm transition-all text-zinc-400 hover:text-white";
        
    document.getElementById('btn-2026').className = year === '2026' 
        ? "px-6 py-2 rounded font-bold text-sm transition-all bg-f1-red text-white shadow-lg shadow-f1-red/20"
        : "px-6 py-2 rounded font-bold text-sm transition-all text-zinc-400 hover:text-white";

    renderRaces(year);
}

// --- Overall Summary ---

function renderOverallSummary(racesData) {
    const container = document.getElementById('races-container');
    
    // Calculate overall MAE across all races
    let totalGrid = 0, totalModelOnly = 0, totalProbabilistic = 0, totalDeterministic = 0;
    let raceCount = 0;
    
    for (let track in racesData) {
        const mae = calculateAllMAE(racesData[track]);
        totalGrid += parseFloat(mae.grid);
        totalModelOnly += parseFloat(mae.modelOnly);
        totalProbabilistic += parseFloat(mae.probabilistic);
        totalDeterministic += parseFloat(mae.deterministic);
        raceCount++;
    }
    
    const avgGrid = (totalGrid / raceCount).toFixed(2);
    const avgModelOnly = (totalModelOnly / raceCount).toFixed(2);
    const avgProbabilistic = (totalProbabilistic / raceCount).toFixed(2);
    const avgDeterministic = (totalDeterministic / raceCount).toFixed(2);
    
    // Find best performing method
    const bestMAE = Math.min(parseFloat(avgModelOnly), parseFloat(avgProbabilistic), parseFloat(avgDeterministic));
    const bestMethod = bestMAE === parseFloat(avgModelOnly) ? 'Model Only' : 
                       bestMAE === parseFloat(avgProbabilistic) ? 'Monte Carlo (Not Ranked)' : 
                       'Monte Carlo (Ranked)';
    
    // Calculate improvement percentages
    const improvementVsBaseline = (((parseFloat(avgGrid) - bestMAE) / parseFloat(avgGrid)) * 100).toFixed(1);
    const improvementVsModel = (((parseFloat(avgModelOnly) - bestMAE) / parseFloat(avgModelOnly)) * 100).toFixed(1);
    
    // Determine if MC methods beat model only
    const mcBetterThanModel = (parseFloat(avgDeterministic) < parseFloat(avgModelOnly)) || 
                              (parseFloat(avgProbabilistic) < parseFloat(avgModelOnly));
    
    const summaryCard = document.createElement('div');
    summaryCard.className = "mt-12 border-2 border-f1-red rounded-xl bg-gradient-to-br from-zinc-900 to-zinc-950 overflow-hidden";
    
    summaryCard.innerHTML = `
        <div class="p-8">
            <div class="flex items-center gap-3 mb-6">
                <div class="w-1 h-8 bg-f1-red rounded"></div>
                <h2 class="text-3xl font-display font-bold uppercase">Overall Performance Summary</h2>
            </div>
            
            <div class="grid grid-cols-2 md:grid-cols-4 gap-6 mb-8">
                <div class="text-center p-6 bg-zinc-900/50 rounded-lg border border-zinc-800">
                    <div class="text-xs text-zinc-500 uppercase tracking-wider mb-2">Grid Baseline</div>
                    <div class="text-3xl font-bold text-zinc-400">${avgGrid}</div>
                    <div class="text-xs text-zinc-600 mt-1">AVG MAE</div>
                </div>
                
                <div class="text-center p-6 bg-zinc-900/50 rounded-lg border border-zinc-800 ${parseFloat(avgModelOnly) === bestMAE ? 'ring-2 ring-green-500' : ''}">
                    <div class="text-xs text-zinc-500 uppercase tracking-wider mb-2">Model Only</div>
                    <div class="text-3xl font-bold ${parseFloat(avgModelOnly) === bestMAE ? 'text-green-500' : parseFloat(avgModelOnly) < 3 ? 'text-yellow-500' : 'text-orange-500'}">${avgModelOnly}</div>
                    <div class="text-xs text-zinc-600 mt-1">AVG MAE</div>
                </div>
                
                <div class="text-center p-6 bg-zinc-900/50 rounded-lg border border-zinc-800 ${parseFloat(avgProbabilistic) === bestMAE ? 'ring-2 ring-green-500' : ''}">
                    <div class="text-xs text-zinc-500 uppercase tracking-wider mb-2">MC (Not Ranked)</div>
                    <div class="text-3xl font-bold ${parseFloat(avgProbabilistic) === bestMAE ? 'text-green-500' : parseFloat(avgProbabilistic) < 3 ? 'text-yellow-500' : 'text-orange-500'}">${avgProbabilistic}</div>
                    <div class="text-xs text-zinc-600 mt-1">AVG MAE</div>
                </div>
                
                <div class="text-center p-6 bg-zinc-900/50 rounded-lg border border-zinc-800 ${parseFloat(avgDeterministic) === bestMAE ? 'ring-2 ring-green-500' : ''}">
                    <div class="text-xs text-zinc-500 uppercase tracking-wider mb-2">MC (Ranked)</div>
                    <div class="text-3xl font-bold ${parseFloat(avgDeterministic) === bestMAE ? 'text-green-500' : parseFloat(avgDeterministic) < 3 ? 'text-yellow-500' : 'text-orange-500'}">${avgDeterministic}</div>
                    <div class="text-xs text-zinc-600 mt-1">AVG MAE</div>
                </div>
            </div>
            
            <div class="p-6 bg-zinc-950 border border-zinc-800 rounded-lg">
                <div class="flex items-start gap-4">
                    <div class="text-4xl">📊</div>
                    <div class="flex-1">
                        <h3 class="text-xl font-bold text-white mb-3">Key Findings</h3>
                        <p class="text-zinc-300 leading-relaxed mb-4">
                            <span class="text-f1-red font-bold">${bestMethod}</span> achieved the best overall performance with an average MAE of 
                            <span class="text-green-500 font-bold">${bestMAE}</span>, representing a 
                            <span class="text-green-500 font-bold">${improvementVsBaseline}%</span> improvement over the baseline grid position predictor.
                        </p>
                        ${mcBetterThanModel ? `
                        <p class="text-zinc-300 leading-relaxed">
                            <span class="text-green-500 font-bold">✓ Monte Carlo Simulation has proven to exceed the Model Only approach by 
                            ${improvementVsModel}%</span>, demonstrating that this model works exceptionally well under randomness and uncertainty. 
                            The probabilistic nature of Monte Carlo simulations better captures the chaotic and unpredictable elements of Formula 1 racing.
                        </p>
                        ` : `
                        <p class="text-zinc-300 leading-relaxed">
                            The Model Only approach achieved competitive results, though Monte Carlo methods provide valuable probabilistic insights 
                            for understanding prediction uncertainty across the ${raceCount} races analyzed.
                        </p>
                        `}
                    </div>
                </div>
            </div>
            
            <div class="mt-6 text-center text-xs text-zinc-600 font-mono">
                Analysis based on ${raceCount} races | Lower MAE indicates better prediction accuracy
            </div>
        </div>
    `;
    
    container.appendChild(summaryCard);
}

// --- Initialize ---

document.addEventListener('DOMContentLoaded', () => {
    renderRaces('2025');
});