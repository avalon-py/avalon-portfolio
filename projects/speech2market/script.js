document.addEventListener('DOMContentLoaded', () => {
    // Setup Mobile Menu
    const mobileMenuBtn = document.getElementById('mobile-menu-btn');
    const mobileMenu = document.getElementById('mobile-menu');
    if(mobileMenuBtn && mobileMenu) {
        mobileMenuBtn.addEventListener('click', () => {
            mobileMenu.classList.toggle('hidden');
        });
    }

    // Page Specific Logic
    if (document.getElementById('home-page')) {
        initHome();
    } else if (document.getElementById('technical-page')) {
        initTechnical();
        initOrbitalTimeline();
        initStarfield(); // New function for vibrancy
    }
});

// --- Icons (SVG Strings) ---
const ICONS = {
    speech: `<svg xmlns="http://www.w3.org/2000/svg" width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><path d="M12 2a3 3 0 0 0-3 3v7a3 3 0 0 0 6 0V5a3 3 0 0 0-3-3Z"/><path d="M19 10v2a7 7 0 0 1-14 0v-2"/><line x1="12" x2="12" y1="19" y2="22"/></svg>`,
    chart: `<svg xmlns="http://www.w3.org/2000/svg" width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="22 12 18 12 15 21 9 3 6 12 2 12"/></svg>`,
    database: `<svg xmlns="http://www.w3.org/2000/svg" width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><ellipse cx="12" cy="5" rx="9" ry="3"/><path d="M3 5V19A9 3 0 0 0 21 19V5"/><path d="M3 12A9 3 0 0 0 21 12"/></svg>`,
    brain: `<svg xmlns="http://www.w3.org/2000/svg" width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><path d="M9.5 2A2.5 2.5 0 0 1 12 4.5v15a2.5 2.5 0 0 1-4.96.44 2.5 2.5 0 0 1-2.96-3.08 3 3 0 0 1-.34-5.58 2.5 2.5 0 0 1 1.32-4.24 2.5 2.5 0 0 1 1.98-3A2.5 2.5 0 0 1 9.5 2Z"/><path d="M14.5 2A2.5 2.5 0 0 0 12 4.5v15a2.5 2.5 0 0 0 4.96.44 2.5 2.5 0 0 0 2.96-3.08 3 3 0 0 0 .34-5.58 2.5 2.5 0 0 0-1.32-4.24 2.5 2.5 0 0 0-1.98-3A2.5 2.5 0 0 0 14.5 2Z"/></svg>`,
    cpu: `<svg xmlns="http://www.w3.org/2000/svg" width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><rect width="16" height="16" x="4" y="4" rx="2"/><rect width="6" height="6" x="9" y="9" rx="1"/><path d="M15 2v2"/><path d="M15 20v2"/><path d="M2 15h2"/><path d="M2 9h2"/><path d="M20 15h2"/><path d="M20 9h2"/><path d="M9 2v2"/><path d="M9 20v2"/></svg>`,
    zap: `<svg xmlns="http://www.w3.org/2000/svg" width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"/></svg>`,
    arrow: `<svg xmlns="http://www.w3.org/2000/svg" width="8" height="8" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M5 12h14"/><path d="m12 5 7 7-7 7"/></svg>`
};

// --- Starfield Logic (Creative Parallax & Physics Fix) ---
function initStarfield() {
    const container = document.getElementById('orbital-section');
    if (!container) return;

    const starContainer = document.createElement('div');
    starContainer.className = 'absolute inset-0 z-0 overflow-hidden pointer-events-none';
    
    // 1. Massive Star Population (800 stars) with Layers
    // Layer 1: Distant, small, slow (Background)
    createStarLayer(starContainer, 400, { sizeMin: 0.5, sizeMax: 1.5, opacity: 0.3, duration: 5 });
    // Layer 2: Mid-range, medium (Midground)
    createStarLayer(starContainer, 300, { sizeMin: 1.5, sizeMax: 2.5, opacity: 0.6, duration: 3 });
    // Layer 3: Close, large, bright (Foreground)
    createStarLayer(starContainer, 100, { sizeMin: 2.5, sizeMax: 4.0, opacity: 1.0, duration: 2, colored: true });

    // 2. Fixed Shooting Star Physics
    for(let i=0; i < 5; i++) {
        const shootingStar = document.createElement('div');
        // Comet shape: Head (White) -> Tail (Transparent)
        // Using linear-gradient to right: Transparent -> White
        // We will rotate this so the White is at the "bottom-left" end? 
        // No, let's keep it simple: Gradient Left(Trans) to Right(White). Head is Right.
        shootingStar.className = 'absolute w-[200px] h-[2px] bg-gradient-to-r from-transparent via-indigo-200 to-white opacity-0';
        
        const styleSheet = document.createElement('style');
        const animName = `meteorFix${i}`;
        const delay = Math.random() * 10;
        const duration = Math.random() * 1.5 + 2; // Fast!
        
        // Trajectory: Top-Right (120vw, -20vh) -> Bottom-Left (-20vw, 120vh)
        // This vector is approx (-140, 140). 
        // Visual Rotation:
        // A horizontal line [Tail---Head] points Right (0deg).
        // We want it to point Down-Left.
        // In CSS Rotate: Right=0, Down=90, Down-Left=135.
        // So we rotate 135deg.
        
        styleSheet.innerHTML = `
            @keyframes ${animName} {
                0% { 
                    opacity: 0;
                    transform: translate(100vw, -20vh) rotate(135deg) scale(0.5); 
                }
                10% { opacity: 1; transform: translate(70vw, 15vh) rotate(135deg) scale(1); }
                100% { 
                    opacity: 0;
                    transform: translate(-20vw, 120vh) rotate(135deg) scale(1); 
                }
            }
            .animate-${animName} {
                animation: ${animName} ${duration}s linear infinite;
                animation-delay: ${delay}s;
            }
        `;
        document.head.appendChild(styleSheet);
        shootingStar.classList.add(`animate-${animName}`);
        starContainer.appendChild(shootingStar);
    }
    
    container.insertBefore(starContainer, container.firstChild);
}

function createStarLayer(container, count, config) {
    for (let i = 0; i < count; i++) {
        const star = document.createElement('div');
        const size = Math.random() * (config.sizeMax - config.sizeMin) + config.sizeMin;
        
        star.className = 'absolute rounded-full bg-white animate-pulse';
        star.style.width = `${size}px`;
        star.style.height = `${size}px`;
        star.style.left = `${Math.random() * 100}%`;
        star.style.top = `${Math.random() * 100}%`;
        star.style.opacity = Math.random() * config.opacity;
        star.style.animationDuration = `${Math.random() * config.duration + 2}s`;
        
        if (config.colored && Math.random() > 0.8) {
             const colors = ['bg-indigo-300', 'bg-blue-300', 'bg-purple-300', 'bg-cyan-100'];
             star.classList.add(colors[Math.floor(Math.random() * colors.length)]);
        }

        container.appendChild(star);
    }
}

// --- Home Page Logic ---
function initHome() {
    const text = "SPEECH2MARKET";
    const container = document.getElementById('shutter-container');

    if (!container) return;

    function buildText() {
        container.innerHTML = '';
        const words = text.split(' ');
        
        words.forEach((word) => {
            const wordSpan = document.createElement('div');
            wordSpan.className = 'flex whitespace-nowrap mx-2 md:mx-4';
            
            const chars = word.split('');
            chars.forEach((char, i) => {
                const wrapper = document.createElement('div');
                wrapper.className = 'relative px-[1px] md:px-1 overflow-hidden group inline-block';
                
                const baseSize = 'text-5xl md:text-7xl lg:text-8xl'; 
                const font = 'font-black tracking-tighter leading-none';
                
                const main = document.createElement('span');
                main.className = `${baseSize} ${font} text-zinc-900 dark:text-white block opacity-0`;
                main.textContent = char;
                main.style.animationDelay = `${Math.random() * 0.5}s`;
                
                const top = document.createElement('span');
                top.className = `absolute inset-0 ${baseSize} ${font} text-indigo-500 pointer-events-none opacity-0`;
                top.textContent = char;
                top.style.animationDelay = `${Math.random() * 0.5}s`;

                const mid = document.createElement('span');
                mid.className = `absolute inset-0 ${baseSize} ${font} text-zinc-500 pointer-events-none opacity-0`;
                mid.textContent = char;
                mid.style.animationDelay = `${Math.random() * 0.5}s`;

                const bot = document.createElement('span');
                bot.className = `absolute inset-0 ${baseSize} ${font} text-indigo-500 pointer-events-none opacity-0`;
                bot.textContent = char;
                bot.style.animationDelay = `${Math.random() * 0.5}s`;

                wrapper.appendChild(main);
                wrapper.appendChild(top);
                wrapper.appendChild(mid);
                wrapper.appendChild(bot);
                wordSpan.appendChild(wrapper);
            });
            container.appendChild(wordSpan);
        });
    }

    function triggerAnimation() {
        const wrappers = container.querySelectorAll('.group');
        wrappers.forEach((wrapper, i) => {
            const [main, top, mid, bot] = wrapper.children;
            
            main.classList.remove('anim-main');
            top.classList.remove('anim-top');
            mid.classList.remove('anim-middle');
            bot.classList.remove('anim-bottom');
            
            void main.offsetWidth;

            const delay = i * 0.03; 
            main.style.animationDelay = `${delay + 0.3}s`;
            top.style.animationDelay = `${delay}s`;
            mid.style.animationDelay = `${delay + 0.1}s`;
            bot.style.animationDelay = `${delay + 0.2}s`;

            main.classList.add('anim-main');
            top.classList.add('anim-top');
            mid.classList.add('anim-middle');
            bot.classList.add('anim-bottom');
        });
    }

    buildText();
    setTimeout(triggerAnimation, 100);
}

// --- Technical Page Scroll Animation ---
function initTechnical() {
    const scrollContainer = document.getElementById('scroll-container');
    const scrollCard = document.getElementById('scroll-card');
    const scrollHeader = document.getElementById('scroll-header');

    if (!scrollContainer || !scrollCard) return;

    function onScroll() {
        const rect = scrollContainer.getBoundingClientRect();
        const winHeight = window.innerHeight;
        
        const elementTop = scrollContainer.offsetTop;
        const scrollY = window.scrollY;
        
        const activationStart = elementTop - winHeight + 100;
        const activationEnd = elementTop + rect.height/2;
        
        let progress = (scrollY - activationStart) / (activationEnd - activationStart);
        progress = Math.max(0, Math.min(1, progress));

        const rotateVal = 20 - (20 * progress);
        const isMobile = window.innerWidth <= 768;
        const startScale = isMobile ? 0.7 : 1.05;
        const endScale = isMobile ? 0.9 : 1.0;
        const scaleVal = startScale + ((endScale - startScale) * progress);
        const translateVal = 0 + (-100 * progress);

        scrollCard.style.transform = `perspective(1000px) rotateX(${rotateVal}deg) scale(${scaleVal})`;
        
        if (scrollHeader) {
            scrollHeader.style.transform = `translateY(${translateVal}px)`;
        }
    }

    window.addEventListener('scroll', onScroll);
    window.addEventListener('resize', onScroll);
    onScroll();
}

// --- Orbital Timeline Logic ---
function initOrbitalTimeline() {
    const container = document.getElementById('orbital-container');
    const nodesLayer = document.getElementById('orbital-nodes-layer');
    const infoPanel = document.getElementById('orbital-info-panel');
    
    if (!container || !nodesLayer || !infoPanel) return;

    const timelineData = [
        {
            id: 1,
            title: "Policy Comms",
            subtitle: "Unstructured Data Ingestion",
            tags: ["Scraping", "Unstructured", "NLP"],
            meta: [
                { label: "Source", value: "BoardDocs" },
                { label: "Range", value: "1996 - 2025" },
                { label: "Tools", value: "BS4 / Selenium" }
            ],
            color: "from-blue-500/40 to-indigo-500/20", 
            borderColor: "border-indigo-500/50",
            content: `
                <p class="mb-4">All speeches delivered by members of the Federal Reserve System are programmatically scraped. Speeches prior to 2006-01-18 are located in the boarddocs section, while the rest is located in the newsevents section. Both section contain different templates and html structure, and therefore need manual location. Web scrapping is performed using BeautifulSoup along with Selenium to handle JS dynamics.</p>
                
                <p class="mb-4">Each transcript is timestamped and attributed to the delivering official (Governor, Vice Chair, or Chair), allowing the model to learn speaker-specific policy signaling patterns.</p>
                
                <p>Dataset for the complete FED's speech that is used for this project is also uploaded (by me, the researcher) in Kaggle, titled "The FED's Public Speech Transcript (1996-2025)" under avalonw</p>
            `,
            icon: ICONS.speech,
            relatedIds: [2]
        },
        {
            id: 2,
            title: "Macro Indicators",
            subtitle: "Economic Ground Truth",
            tags: ["API", "Time-Series", "Lag-Adj"],
            meta: [
                { label: "Source", value: "FRED API" },
                { label: "Key Vars", value: "UNRATE, GDP" },
                { label: "Align", value: "Release Date" }
            ],
             color: "from-purple-500/40 to-pink-500/20",
            borderColor: "border-purple-500/50",
            content: `
                <p class="mb-4">Key economic variables retrieved via FRED API: Unemployment Rate, Federal Funds Rate, Real GDP Growth. All indicators are temporally aligned based on release schedules, so the relevant macroeconomic indicator is the one traders know at that period.</p>
                
                <p class="mb-4"><strong class="text-white">Unemployment (UNRATE)</strong> is incorporated because it is one of the most anticipated indicator that can move global assets, such as gold and cryptocurrency (bitcoin).</p>
                
                <p class="mb-4"><strong class="text-white">Federal Funds Rate (FEDFUNDS)</strong> is incorporated because it slightly reflects the rate of ease borrowers borrow money for liquidity.</p>
                
                <p><strong class="text-white">GDP Growth Rate (A191RL1Q225SBEA)</strong> is incorporated because it measures the general productivity of the macroeconomic condition.</p>
            `,
            icon: ICONS.chart,
            relatedIds: [1, 3]
        },
        {
            id: 3,
            title: "Market Data",
            subtitle: "Financial Instrument Targets",
            tags: ["Finance", "Volatility", "OHLCV"],
            meta: [
                { label: "Source", value: "Yahoo Finance" },
                { label: "Assets", value: "SPX, Gold, VIX" },
                { label: "Targets", value: "3d, 7d Returns" }
            ],
             color: "from-emerald-500/40 to-teal-500/20",
            borderColor: "border-emerald-500/50",
            content: `
                <p class="mb-4">Historical data for S&P500 (^GSPC), Gold's Futures (GC=F), 10Y Treasury Yields (^TNX), The US Dollar Strength Index (DX-Y.NYB), and CBOE's Implied 30-day Forward Volatility Index (^VIX). Forward returns are computed for 3, 7, and 30-day horizons.</p>
                
                <ul class="list-disc list-inside space-y-2 marker:text-emerald-500">
                    <li><strong class="text-white">SNP500 index</strong> acts as a reflection of the stock market, consisting of the stocks of the top 500 biggest companies in the United States.</li>
                    <li><strong class="text-white">Gold's Futures</strong> acts as a reflection of the commodity market that is usually affected by the United State's FED speeches.</li>
                    <li><strong class="text-white">DXY</strong> acts as a reflection of the currency's strength, in retrospect to other commodities, indices, or assets</li>
                    <li><strong class="text-white">VIX</strong> acts as the expected 30-day volatility rate of SNP500.</li>
                    <li><strong class="text-white">TNX</strong> acts as the balance between supply & demand of the risk-free-rate asset, which is the 10Y Treasury.</li>
                </ul>
            `,
            icon: ICONS.database,
            relatedIds: [2, 4]
        },
        {
            id: 4,
            title: "Embeddings",
            subtitle: "Transformer Attention Mechanism",
            tags: ["BERT", "Deep Learning", "768-Dim"],
            meta: [
                { label: "Model", value: "FinBERT" },
                { label: "Type", value: "Transformer" },
                { label: "Feature", value: "Hidden State" }
            ],
             color: "from-red-500/40 to-orange-500/20",
            borderColor: "border-red-500/50",
            content: `
                <p class="mb-4">Transcripts embedded using ProsusAI's FinBERT. We extract final hidden-state representations (~768-dim) encoding sentiment polarity, policy tone, forward guidance, and risk framing.</p>
                
                <p>Using the BERT technology developed by Facebook, we can use the attention mechanism to learn bi-directionally and generate a numerical ndim sentiment analysis.</p>
            `,
            icon: ICONS.brain,
            relatedIds: [3, 5]
        },
        {
            id: 5,
            title: "Predictive Model",
            subtitle: "Two Stage Gradient Boosting Regressor",
            tags: ["ML", "Regression", "Tree-Based"],
            meta: [
                { label: "Algo", value: "HistGradientBoosting" },
                { label: "Library", value: "Scikit-Learn" },
                { label: "Feature", value: "NaN Support" }
            ],
            color: "from-cyan-500/40 to-blue-500/20",
            borderColor: "border-cyan-500/50",
            content: `
                <p class="mb-4">Engineered features modeled using HistGradientBoostingRegressor to forecast Forward Returns and Volatility. Learns interactions between central bank tone, economics, and market regime.</p>
                
                <p class="mb-4">Uses a two-staged prediction pipeline, with F1Score-optimized-HGB predicting the direction (+/-) and AUC-optimized HGB predicting the magnitude, with Optuna as the optimizer. The final forecast is [+/-]|magnitude|</p>
                
                <p>As a member of the GradientBoosting tree model, HistGradientBoosting can capture complex relationship between features, even with the presence of NULLs or NaNs in the dataset, treating the absence of data as an information.</p>
            `,
            icon: ICONS.cpu,
            relatedIds: [4]
        }
    ];

    let state = {
        rotationAngle: 0,
        autoRotate: true,
        expandedId: null,
        animationFrame: null,
    };

    function getRadius() {
        return window.innerWidth < 768 ? 160 : 280; // Increased radius for massive orbs
    }

    // Create Nodes
    timelineData.forEach((item, index) => {
        const node = document.createElement('div');
        // MASSIVE SIZE: w-32 h-32 is 128px. Margin half is 64px (approx 4rem or 16 in tailwind).
        // -ml-16 -mt-16
        node.className = 'absolute top-1/2 left-1/2 -ml-16 -mt-16 pointer-events-auto transition-all duration-700 ease-out flex flex-col items-center justify-center'; 
        node.id = `node-${item.id}`;
        
        node.innerHTML = `
            <!-- Pulse Effect (Super Massive) -->
            <div class="absolute rounded-full -z-10 bg-indigo-500/30 opacity-0 transition-opacity duration-500" id="pulse-${item.id}"
                 style="width: 250px; height: 250px; left: 50%; top: 50%; transform: translate(-50%, -50%);">
            </div>

            <!-- Number Badge (Order) -->
            <div class="absolute -top-1 -right-1 w-8 h-8 bg-indigo-600 rounded-full border-2 border-black z-20 flex items-center justify-center text-sm font-bold text-white shadow-xl">
                ${item.id}  
            </div>

            <!-- Icon Circle (Massive: w-20 h-20) -->
            <div class="node-circle w-20 h-20 rounded-full flex items-center justify-center bg-black border-[3px] border-white/40 text-white z-10 relative cursor-pointer hover:scale-105 hover:border-indigo-400 hover:text-indigo-400 transition-transform shadow-[0_0_40px_rgba(0,0,0,0.8)]">
                ${item.icon}
            </div>

            <!-- Label -->
            <div class="node-label absolute top-36 whitespace-nowrap text-sm md:text-base font-bold tracking-wider text-white/80 transition-colors drop-shadow-md">
                ${item.title}
            </div>
        `;

        node.addEventListener('click', (e) => {
            e.stopPropagation();
            toggleNode(item.id);
        });

        nodesLayer.appendChild(node);
    });

    // Update Info Panel
    function updateInfoPanel(id) {
        if (!id) {
             infoPanel.classList.add('opacity-0', 'translate-x-10');
             setTimeout(() => {
                 infoPanel.innerHTML = `
                     <div class="text-center text-zinc-500 flex flex-col items-center justify-center h-full border border-dashed border-zinc-800 rounded-3xl bg-zinc-900/20">
                         <div class="mb-4 text-zinc-700 opacity-50">
                            <svg class="w-24 h-24 mx-auto" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="1" d="M19.428 15.428a2 2 0 00-1.022-.547l-2.384-.477a6 6 0 00-3.86.517l-.318.158a6 6 0 01-3.86.517L6.05 15.21a2 2 0 00-1.806.547M8 4h8l-1 1v5.172a2 2 0 00.586 1.414l5 5c1.26 1.26.367 3.414-1.415 3.414H4.828c-1.782 0-2.674-2.154-1.414-3.414l5-5A2 2 0 009 10.172V5L8 4z"></path></svg>
                         </div>
                         <p class="uppercase tracking-[0.2em] text-sm mb-2 font-semibold">System Idle</p>
                         <p class="text-2xl font-bold text-zinc-600">Initialize Node Analysis</p>
                     </div>
                 `;
                 infoPanel.classList.remove('opacity-0', 'translate-x-10');
             }, 300);
             return;
        }

        const item = timelineData.find(d => d.id === id);
        
        // Fade Out
        infoPanel.classList.add('opacity-0', 'translate-x-10');
        
        setTimeout(() => {
            // Build Meta Stats HTML
            const metaHtml = item.meta.map(m => `
                <div class="flex flex-col bg-black/40 p-3 rounded-lg border border-white/5 backdrop-blur-sm">
                    <span class="text-[10px] uppercase tracking-wider text-zinc-400 mb-1 font-bold">${m.label}</span>
                    <span class="text-sm font-mono text-white font-bold truncate">${m.value}</span>
                </div>
            `).join('');

            const tagsHtml = item.tags.map(t => `
                <span class="px-2.5 py-1 bg-white/10 border border-white/20 rounded text-[10px] text-zinc-100 uppercase tracking-wide font-bold shadow-sm">${t}</span>
            `).join('');

            // Update Content
            infoPanel.innerHTML = `
                <div class="h-full flex flex-col justify-start animate-fade-in relative overflow-hidden rounded-3xl bg-zinc-900 border ${item.borderColor} shadow-2xl">
                    <!-- Dynamic Background Header (Height 220px) -->
                    <div class="absolute top-0 left-0 w-full h-64 bg-gradient-to-b ${item.color} pointer-events-none"></div>
                    
                    <div class="relative z-10 p-6 md:p-8 h-full flex flex-col overflow-hidden">
                        
                        <!-- Header -->
                        <div class="flex justify-between items-start mb-6">
                            <div>
                                <div class="flex items-center gap-2 mb-3">
                                    <span class="flex items-center justify-center w-7 h-7 rounded bg-black/60 border border-white/30 text-sm font-bold font-mono text-white shadow-md">${item.id}</span>
                                    <div class="flex gap-2 flex-wrap">${tagsHtml}</div>
                                </div>
                                <h2 class="text-3xl md:text-4xl font-black text-white leading-tight mb-2 drop-shadow-xl shadow-black">${item.title}</h2>
                                <p class="text-zinc-100 font-semibold text-base drop-shadow-md shadow-black max-w-[90%]">${item.subtitle}</p>
                            </div>
                            <div class="p-4 bg-black/40 rounded-2xl border border-white/10 text-white shadow-xl backdrop-blur-md hidden sm:block">
                                ${item.icon}
                            </div>
                        </div>

                        <!-- Stats Grid -->
                        <div class="grid grid-cols-3 gap-3 mb-6 mt-auto">
                            ${metaHtml}
                        </div>

                        <!-- Divider -->
                        <div class="h-px w-full bg-gradient-to-r from-transparent via-zinc-600 to-transparent mb-5 opacity-50"></div>

                        <!-- Scrollable Content -->
                        <div class="prose prose-invert prose-sm max-w-none overflow-y-auto pr-2 custom-scrollbar flex-grow bg-zinc-950/30 p-4 rounded-xl border border-white/5">
                             <div class="text-zinc-200 leading-relaxed font-light text-sm space-y-4">
                                ${item.content}
                             </div>
                        </div>
                    </div>
                </div>
            `;
            // Fade In
            infoPanel.classList.remove('opacity-0', 'translate-x-10');
        }, 300);
    }

    function toggleNode(id) {
        if (state.expandedId === id) {
            // Close
            state.expandedId = null;
            state.autoRotate = true;
            updateInfoPanel(null);
        } else {
            // Open
            state.expandedId = id;
            state.autoRotate = false;
            
            // Rotate selected node to left side (180 degrees)
            const idx = timelineData.findIndex(d => d.id === id);
            const total = timelineData.length;
            const currentAngle = (idx / total) * 360; 
            
            state.rotationAngle = 180 - currentAngle; 
            
            updateInfoPanel(id);
        }
        render();
    }

    container.addEventListener('click', () => {
        if (state.expandedId !== null) {
            state.expandedId = null;
            state.autoRotate = true;
            updateInfoPanel(null);
            render();
        }
    });

    function loop() {
        if (state.autoRotate) {
            state.rotationAngle = (state.rotationAngle + 0.2) % 360; 
        }
        render();
        state.animationFrame = requestAnimationFrame(loop);
    }

    function render() {
        const radius = getRadius();
        const total = timelineData.length;

        timelineData.forEach((item, index) => {
            const node = document.getElementById(`node-${item.id}`);
            const pulse = document.getElementById(`pulse-${item.id}`);
            const circle = node.querySelector('.node-circle');
            const label = node.querySelector('.node-label');
            
            const angleDeg = ((index / total) * 360 + state.rotationAngle) % 360;
            const angleRad = (angleDeg * Math.PI) / 180;

            const x = Math.cos(angleRad) * radius;
            const y = Math.sin(angleRad) * radius;

            // Adjusted scale base for massive nodes
            const scale = 0.85 + (Math.sin(angleRad + Math.PI/2) + 1) * 0.15; 
            const opacity = 0.6 + (Math.sin(angleRad + Math.PI/2) + 1) * 0.2;

            node.style.transform = `translate(${x}px, ${y}px) scale(${state.expandedId === item.id ? 1.2 : scale})`;
            node.style.zIndex = Math.floor(scale * 100);
            node.style.opacity = state.expandedId !== null && state.expandedId !== item.id ? 0.3 : opacity;

            if (state.expandedId === item.id) {
                pulse.classList.add('animate-pulse-custom');
                pulse.classList.remove('opacity-0');
                
                circle.classList.add('bg-white', 'text-black', 'border-white', 'shadow-[0_0_50px_rgba(255,255,255,0.9)]');
                circle.classList.remove('bg-black', 'text-white', 'border-white/40');
                
                label.classList.add('text-white', 'scale-110', 'font-black', 'text-lg');
                label.classList.remove('text-white/80');
            } else {
                pulse.classList.remove('animate-pulse-custom');
                pulse.classList.add('opacity-0');

                circle.classList.remove('bg-white', 'text-black', 'border-white', 'shadow-[0_0_50px_rgba(255,255,255,0.9)]');
                circle.classList.add('bg-black', 'text-white', 'border-white/40');

                label.classList.remove('text-white', 'scale-110', 'font-black', 'text-lg');
                label.classList.add('text-white/80');
            }
        });
    }

    loop();
}
