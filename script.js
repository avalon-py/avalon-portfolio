// --- Initialization ---
document.addEventListener('DOMContentLoaded', () => {
    // Initialize Lucide Icons
    lucide.createIcons();

    // Init Logic
    initTitleCycler();
    initCursorGlow();
    initHeaderScroll();
    initMobileMenu();
    initProjectDates();
});

// --- Animated Title Cycler ---
function initTitleCycler() {
    const wrapper = document.getElementById('title-cycler');
    if (!wrapper) return;

    const titles = [
        'Data Science',
        'Machine Learning',
        'Artificial Intelligence',
        'Quantitative Analysis',
        'Finance Banking',
        'Investment',
    ];

    // Build a span per word; first is active, rest start below (ready to slide in)
    const spans = titles.map((title, i) => {
        const span = document.createElement('span');
        span.className = 'title-word ' + (i === 0 ? 'state-active' : 'state-below');
        span.textContent = title;
        wrapper.appendChild(span);
        return span;
    });

    let current = 0;

    function advance() {
        const prev = current;
        current = (current + 1) % titles.length;

        // Outgoing word slides up and fades
        spans[prev].className = 'title-word state-above';

        // Incoming word slides in from below
        spans[current].className = 'title-word state-active';

        // After transition finishes, reset outgoing to below so it can re-enter later
        setTimeout(() => {
            spans[prev].className = 'title-word state-below';
        }, 520);
    }

    setInterval(advance, 1800);
}

// --- Cursor Glow Effect ---
function initCursorGlow() {
    const glowEl = document.getElementById('cursor-glow');
    if (!glowEl) return;

    window.addEventListener('mousemove', (e) => {
        glowEl.style.background = `radial-gradient(500px circle at ${e.clientX}px ${e.clientY}px, rgba(19, 91, 236, 0.025), transparent 50%)`;
    });
}

// --- Header Scroll Effect ---
function initHeaderScroll() {
    const header = document.getElementById('main-header');
    if (!header) return;

    window.addEventListener('scroll', () => {
        if (window.scrollY > 20) {
            header.classList.add('bg-background-dark/90', 'backdrop-blur-md', 'border-b', 'border-gray-800', 'py-3');
            header.classList.remove('bg-transparent', 'py-5');
        } else {
            header.classList.remove('bg-background-dark/90', 'backdrop-blur-md', 'border-b', 'border-gray-800', 'py-3');
            header.classList.add('bg-transparent', 'py-5');
        }
    });
}

// --- Mobile Menu Toggle ---
function initMobileMenu() {
    const btn = document.getElementById('menu-toggle');
    const menu = document.getElementById('mobile-menu');
    const links = document.querySelectorAll('.mobile-link');
    let isOpen = false;

    if (!btn || !menu) return;

    btn.addEventListener('click', () => {
        isOpen = !isOpen;
        if (isOpen) {
            menu.classList.remove('hidden');
            btn.innerHTML = '<i data-lucide="x" class="w-7 h-7"></i>';
        } else {
            menu.classList.add('hidden');
            btn.innerHTML = '<i data-lucide="menu" class="w-7 h-7"></i>';
        }
        lucide.createIcons();
    });

    links.forEach(link => {
        link.addEventListener('click', () => {
            isOpen = false;
            menu.classList.add('hidden');
            btn.innerHTML = '<i data-lucide="menu" class="w-7 h-7"></i>';
            lucide.createIcons();
        });
    });
}

// --- Project Dates ---
function initProjectDates() {
    document.querySelectorAll('[data-updated]').forEach(article => {
        const dateEl = article.querySelector('.updated-date');
        if (!dateEl) return;

        const updated = new Date(article.getAttribute('data-updated'));
        const diffDays = Math.floor((new Date() - updated) / (1000 * 60 * 60 * 24));
        const diffMonths = Math.floor(diffDays / 30);
        const diffYears = Math.floor(diffDays / 365);

        let label;
        if (diffDays === 0)        label = 'Updated today';
        else if (diffDays === 1)   label = 'Updated 1 day ago';
        else if (diffDays < 30)    label = `Updated ${diffDays} days ago`;
        else if (diffMonths < 12)  label = `Updated ${diffMonths} month${diffMonths > 1 ? 's' : ''} ago`;
        else if (diffYears === 1)  label = 'Updated 1 year ago';
        else                       label = `Updated ${diffYears} years ago`;

        dateEl.innerHTML = `<div class="w-1.5 h-1.5 rounded-full bg-green-500/50"></div>${label}`;
    });
}
