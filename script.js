document.addEventListener('DOMContentLoaded', () => {
    // Initialize Lucide Icons
    if (window.lucide) {
        window.lucide.createIcons();
    }

    // Blob Cursor — organic shape via canvas
    const hasFinePointer = window.matchMedia('(pointer: fine)').matches;

    const blobCanvas = document.getElementById('cursor-blob-canvas');
    const blobCtx = blobCanvas ? blobCanvas.getContext('2d') : null;
    const dotCursor = document.querySelector('.cursor');

    let mouseX = -500, mouseY = -500;
    let blobX = -500, blobY = -500;
    let phase = 0;

    function resizeBlobCanvas() {
        if (!blobCanvas) return;
        blobCanvas.width = window.innerWidth;
        blobCanvas.height = window.innerHeight;
    }
    if (hasFinePointer) {        
        resizeBlobCanvas();
        window.addEventListener('resize', resizeBlobCanvas);

        document.addEventListener('mousemove', (e) => {
            mouseX = e.clientX;
            mouseY = e.clientY;
            if (dotCursor) {
                dotCursor.style.left = `${mouseX}px`;
                dotCursor.style.top = `${mouseY}px`;
            }
        });

        // Each point on the blob has its own phase offset for independent movement
        const NUM_POINTS = 8;
        const blobPoints = Array.from({ length: NUM_POINTS }, (_, i) => ({
            angleOffset: (i / NUM_POINTS) * Math.PI * 2,
            // Each point has 3 sine waves with different frequencies/amplitudes
            waves: [
                { freq: 0.6 + Math.random() * 0.4, amp: 10 + Math.random() * 18, phase: Math.random() * Math.PI * 2 },
                { freq: 1.2 + Math.random() * 0.8, amp: 5  + Math.random() * 10, phase: Math.random() * Math.PI * 2 },
                { freq: 2.0 + Math.random() * 1.0, amp: 3  + Math.random() * 6,  phase: Math.random() * Math.PI * 2 },
            ]
        }));

        let targetR = 100;
        let currentR = 100;

        function getBlobRadius(point, t) {
            let r = currentR;
            for (const w of point.waves) {
                r += Math.sin(t * w.freq + w.phase) * w.amp;
            }
            return r;
        }

        // Trail history
        const trail = [];
        const TRAIL_LENGTH = 40;

        function drawBlob(cx, cy, t, alpha) {
            if (!blobCtx) return;

            const points = blobPoints.map(p => {
                const r = getBlobRadius(p, t);
                return {
                    x: cx + Math.cos(p.angleOffset) * r,
                    y: cy + Math.sin(p.angleOffset) * r,
                };
            });

            blobCtx.beginPath();
            for (let i = 0; i < points.length; i++) {
                const curr = points[i];
                const next = points[(i + 1) % points.length];
                if (i === 0) {
                    blobCtx.moveTo((curr.x + next.x) / 2, (curr.y + next.y) / 2);
                }
                const mx = (curr.x + next.x) / 2;
                const my = (curr.y + next.y) / 2;
                blobCtx.quadraticCurveTo(curr.x, curr.y, mx, my);
            }
            blobCtx.closePath();
            blobCtx.fillStyle = `rgba(255, 255, 255)`;
            blobCtx.fill();
        }

        function animateBlobCursor(t) {
            blobX += (mouseX - blobX) * 0.1;
            blobY += (mouseY - blobY) * 0.1;
            currentR += (targetR - currentR) * 0.1;

            phase = t * 0.006;

            // Push current position to trail
            trail.push({ x: blobX, y: blobY, t: phase, r: currentR });
            if (trail.length > TRAIL_LENGTH) trail.shift();

            // Clear canvas each frame
            blobCtx.clearRect(0, 0, blobCanvas.width, blobCanvas.height);

            // Draw trail — older = smaller + more transparent
            trail.forEach((pos, i) => {
                const progress = i / trail.length;
                const scaleDown = 0.1 + progress * 0.8;
                const savedR = currentR;
                currentR = pos.r * scaleDown;
                drawBlob(pos.x, pos.y, pos.t, 1.0);
                currentR = savedR;
            });

            // Draw main blob at full opacity
            drawBlob(blobX, blobY, phase, 1.0);

            requestAnimationFrame(animateBlobCursor);
        }
        requestAnimationFrame(animateBlobCursor);
    }

    // Immersive About Section Scroll Logic
    const aboutSection = document.querySelector('.about-expand-section');
    const stickyContainer = document.querySelector('.expand-sticky');
    const expandMediaWrapper = document.querySelector('.expand-media-wrapper');
    const expandBg = document.querySelector('.expand-bg');
    const titleLeft = document.querySelector('.title-left');
    const titleRight = document.querySelector('.title-right');
    const finalContent = document.querySelector('.expand-final-content');
    const cardInnerText = document.querySelector('.card-inner-text');

    if (aboutSection && stickyContainer && expandMediaWrapper) {
        let ticking = false;

        function updateAboutSection() {
            const rect = aboutSection.getBoundingClientRect();
            const viewportHeight = window.innerHeight;
            const sectionHeight = rect.height;
            
            // Calculate progress (0 to 1) based on scroll position within the section
            let progress = -rect.top / (sectionHeight - viewportHeight);
            
            // Clamp progress
            progress = Math.max(0, Math.min(progress, 1));
            
            // 1. Background Opacity (Fades out as we scroll)
            if (expandBg) {
                expandBg.style.opacity = Math.max(0, 1 - progress * 1.5);
            }

            // 2. Media Expansion
            const isMobile = window.innerWidth < 768;
            const startWidth = 300;
            const endWidth = window.innerWidth; // Full width
            const startHeight = 400;
            const endHeight = window.innerHeight; // Full height
            
            const currentWidth = startWidth + (endWidth - startWidth) * progress;
            const currentHeight = startHeight + (endHeight - startHeight) * progress;
            const currentRadius = 20 * (1 - progress);

            expandMediaWrapper.style.width = `${currentWidth}px`;
            expandMediaWrapper.style.height = `${currentHeight}px`;
            expandMediaWrapper.style.borderRadius = `${currentRadius}px`;

            // 3. Title Separation & Fade Out
            const separation = progress * (isMobile ? 200 : 400); // px
            const titleOpacity = Math.max(0, 1 - progress * 2); // Fade out faster (by 50% scroll)
            
            if (titleLeft) {
                titleLeft.style.transform = `translateX(-${separation}px)`;
                titleLeft.style.opacity = titleOpacity;
            }
            if (titleRight) {
                titleRight.style.transform = `translateX(${separation}px)`;
                titleRight.style.opacity = titleOpacity;
            }
            
            // 4. Inner Text Fade Out
            if (cardInnerText) {
                cardInnerText.style.opacity = Math.max(0, 1 - progress * 3);
            }
        }

        window.addEventListener('scroll', () => {
            if (!ticking) {
                window.requestAnimationFrame(() => {
                    updateAboutSection();
                    ticking = false;
                });
                ticking = true;
            }
        });
        
        // Initial call to set state
        updateAboutSection();
    }

    // Background Paths for About Content Section
    const aboutContentSection = document.querySelector('.about-content-section');
    if (aboutContentSection) {
        const svgContainer = document.createElement('div');
        svgContainer.style.position = 'absolute';
        svgContainer.style.inset = '0';
        svgContainer.style.pointerEvents = 'none';
        svgContainer.style.zIndex = '0';

        const svgNS = "http://www.w3.org/2000/svg";
        const svg = document.createElementNS(svgNS, "svg");
        svg.setAttribute("viewBox", "0 0 696 316");
        svg.setAttribute("fill", "none");
        svg.style.width = '100%';
        svg.style.height = '100%';
        svg.style.opacity = '0.8';

        const createPaths = (position) => {
            for (let i = 0; i < 36; i++) {
                const path = document.createElementNS(svgNS, "path");
                const d = `M-${380 - i * 5 * position} -${189 + i * 6}C-${
                    380 - i * 5 * position
                } -${189 + i * 6} -${312 - i * 5 * position} ${216 - i * 6} ${
                    152 - i * 5 * position
                } ${343 - i * 6}C${616 - i * 5 * position} ${470 - i * 6} ${
                    684 - i * 5 * position
                } ${875 - i * 6} ${684 - i * 5 * position} ${875 - i * 6}`;
                
                path.setAttribute("d", d);
                path.setAttribute("stroke", "white");
                path.setAttribute("stroke-width", 0.5 + i * 0.03);
                path.setAttribute("stroke-opacity", 0.1 + i * 0.03);
                
                // Animation setup
                const length = 2000; // Approximate path length
                path.style.strokeDasharray = length;
                path.style.strokeDashoffset = length;
                path.style.animation = `dashAnim ${20 + Math.random() * 10}s linear infinite`;
                
                svg.appendChild(path);
            }
        };

        createPaths(1);
        createPaths(-1);

        svgContainer.appendChild(svg);
        aboutContentSection.insertBefore(svgContainer, aboutContentSection.firstChild);

        // Add keyframes
        if (!document.getElementById('bg-paths-style')) {
            const style = document.createElement('style');
            style.id = 'bg-paths-style';
            style.innerHTML =
                "@keyframes dashAnim {" +
                "0% { stroke-dashoffset: 2000; opacity: 0.3; }" +
                "50% { opacity: 0.8; }" +
                "100% { stroke-dashoffset: 0; opacity: 0.3; }" +
                "}";
        }
        
        // Ensure content is above background
        const details = aboutContentSection.querySelector('.about-details');
        if (details) {
            details.style.position = 'relative';
            details.style.zIndex = '10';
        }
    }

    // Hero Reveal Animation
    const heroWords = document.querySelectorAll('.hero-word');
    const subtitleContainer = document.querySelector('.hero-subtitle-container');
    
    // Initial Reveal
    setTimeout(() => {
        heroWords.forEach((word, index) => {
            setTimeout(() => {
                word.classList.add('visible');
            }, index * 200);
        });
        
        if (subtitleContainer) {
            setTimeout(() => {
                subtitleContainer.classList.add('visible');
                initTypewriter();
            }, 1000);
        }
    }, 300);

    // Typewriter Effect
    function initTypewriter() {
        const textElement = document.getElementById('typewriter-text');
        if (!textElement) return;

        const roles = [
            "Data Scientist",
            "Creative Developer",
            "Problem Solver",
            "Tech Enthusiast"
        ];
        
        let roleIndex = 0;
        let charIndex = 0;
        let isDeleting = false;
        let typeSpeed = 50; // Faster typing

        function type() {
            const currentRole = roles[roleIndex];
            
            if (isDeleting) {
                textElement.textContent = currentRole.substring(0, charIndex - 1);
                charIndex--;
                typeSpeed = 30; // Faster deleting
            } else {
                textElement.textContent = currentRole.substring(0, charIndex + 1);
                charIndex++;
                typeSpeed = 50; // Faster typing
            }

            if (!isDeleting && charIndex === currentRole.length) {
                isDeleting = true;
                typeSpeed = 1000; // Shorter pause at end
            } else if (isDeleting && charIndex === 0) {
                isDeleting = false;
                roleIndex = (roleIndex + 1) % roles.length;
                typeSpeed = 200; // Shorter pause before new word
            }

            setTimeout(type, typeSpeed);
        }

        type();
    }

    // Smooth Scroll
    document.querySelectorAll('a[href^="#"]').forEach(anchor => {
        anchor.addEventListener('click', function (e) {
            e.preventDefault();
            const target = document.querySelector(this.getAttribute('href'));
            if (target) {
                target.scrollIntoView({
                    behavior: 'smooth'
                });
            }
        });
    });

    // Project Hover Image Follow (Optional enhancement)
    const projectItems = document.querySelectorAll('.project-item');
    projectItems.forEach(item => {
        item.addEventListener('mousemove', (e) => {
            const media = item.querySelector('.project-media');
            if (media) {
                // Calculate position relative to the item
                const rect = item.getBoundingClientRect();
                const x = e.clientX - rect.left;
                const y = e.clientY - rect.top;
                
                // Slight parallax effect
                // media.style.transform = `translate(${x * 0.05}px, ${y * 0.05}px) scale(1) rotate(0deg)`;
            }
        });
    });

    function initGooeyText() {
        const wrapper = document.querySelector('.gooey-text-wrapper');
        if (!wrapper) return;

        const wordEls = [...wrapper.querySelectorAll('.gooey-word')];
        const total = wordEls.length;
        const morphTime = 1.5;
        const holdTime = 0.8;

        let current = 0;
        let next = 1;
        let morphing = false;
        let startTime = null;

        function easeInOut(t) {
            return t < 0.5 ? 2 * t * t : -1 + (4 - 2 * t) * t;
        }

        // Show first word cleanly with no filter manipulation
        wordEls[current].style.opacity = '1';
        wordEls[current].style.filter = 'blur(0px)';

        function doMorph(timestamp) {
            if (!startTime) startTime = timestamp;
            const elapsed = (timestamp - startTime) / 1000;
            const p = Math.min(elapsed / morphTime, 1);
            const e = easeInOut(p);

            // outgoing
            wordEls[current].style.opacity = String(1 - e);
            wordEls[current].style.filter = `blur(${e * 20}px)`;

            // incoming
            wordEls[next].style.opacity = String(e);
            wordEls[next].style.filter = `blur(${(1 - e) * 20}px)`;

            if (p < 1) {
                requestAnimationFrame(doMorph);
            } else {
                // Lock final state
                wordEls[current].style.opacity = '0';
                wordEls[current].style.filter = 'blur(20px)';
                wordEls[next].style.opacity = '1';
                wordEls[next].style.filter = 'blur(0px)';

                current = next;
                next = (next + 1) % total;
                morphing = false;
                startTime = null;

                setTimeout(() => {
                    morphing = true;
                    requestAnimationFrame(doMorph);
                }, holdTime * 1000);
            }
        }

        // Kick off after initial hold
        setTimeout(() => {
            morphing = true;
            requestAnimationFrame(doMorph);
        }, holdTime * 600);
    }

    initGooeyText();

    function initQuoteTypewriter() {
        const quote = document.querySelector('.about-quote');
        if (!quote) return;

        const text = '"there\'s always one more thing to learn"';
        quote.textContent = '';

        // Add a blinking cursor element
        const cursor = document.createElement('span');
        cursor.classList.add('quote-cursor');
        cursor.textContent = '|';
        quote.appendChild(cursor);

        let i = 0;
        let started = false;

        const observer = new IntersectionObserver((entries) => {
            entries.forEach(entry => {
                if (entry.isIntersecting && !started) {
                    started = true;
                    setTimeout(type, 600); // slight delay before starting
                }
            });
        }, { threshold: 0.5 });

        observer.observe(quote);

        function type() {
            if (i < text.length) {
                // Insert text before the cursor
                quote.insertBefore(document.createTextNode(text[i]), cursor);
                i++;
                setTimeout(type, 45);
            } else {
                setTimeout(() => {
                    // Measure actual rendered text width
                    const range = document.createRange();
                    range.selectNodeContents(quote);
                    const rects = Array.from(range.getClientRects());
                    const lastRect = rects[rects.length - 1];
                    const firstRect = rects[0];
                    // Last line width (where the quote ends)
                    const lineWidth = lastRect.right - firstRect.left; // subtract padding-left

                    const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
                    svg.setAttribute('viewBox', `0 0 ${lineWidth} 12`);
                    svg.setAttribute('preserveAspectRatio', 'none');
                    svg.style.cssText = `
                        position: absolute;
                        bottom: -6px;
                        left: 1.5rem;
                        width: ${lineWidth}px;
                        height: 12px;
                        overflow: visible;
                        pointer-events: none;
                    `;

                    // Wavy handwritten path
                    const segments = Math.floor(lineWidth / 30);
                    let d = `M 0 6`;
                    for (let s = 1; s <= segments; s++) {
                        const x = (s / segments) * lineWidth;
                        const cpx = x - lineWidth / segments / 2;
                        const cpy = s % 2 === 0 ? 3 : 9;
                        d += ` Q ${cpx} ${cpy} ${x} 6`;
                    }

                    const path = document.createElementNS('http://www.w3.org/2000/svg', 'path');
                    path.setAttribute('d', d);
                    path.setAttribute('fill', 'none');
                    path.setAttribute('stroke', 'var(--accent)');
                    path.setAttribute('stroke-width', '2');
                    path.setAttribute('stroke-linecap', 'round');
                    path.setAttribute('stroke-linejoin', 'round');

                    svg.appendChild(path);
                    svg.style.opacity = '0';
                    quote.appendChild(svg);

                    const length = path.getTotalLength();
                    path.style.strokeDasharray = length;
                    path.style.strokeDashoffset = length;

                    requestAnimationFrame(() => {
                        requestAnimationFrame(() => {
                            svg.style.opacity = '1';
                            path.style.transition = `stroke-dashoffset 1.2s cubic-bezier(0.4, 0, 0.2, 1)`;
                            path.style.strokeDashoffset = '0';
                        });
                    });
                }, 200);
            }
        }
    }

    initQuoteTypewriter();

    // Stagger hover effect for social links
    function initStaggerLinks() {
        const links = document.querySelectorAll('.social-link');
        if (!links.length) return;

        const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
        const duration = 2000;

        // Phase 1: build scramble spans from plain text
        const linkData = [...links].map(link => {
            const text = link.textContent.trim();
            link.textContent = '';
            const spans = [...text].map(char => {
                const span = document.createElement('span');
                span.classList.add('hyper-char');
                span.textContent = char;
                link.appendChild(span);
                return span;
            });
            return { link, text, spans };
        });

        function scrambleLink({ text, spans }, onComplete) {
            let iterations = 0;
            const totalSteps = text.length * 10;
            const interval = duration / totalSteps;
            const tick = setInterval(() => {
                spans.forEach((span, i) => {
                    span.textContent = i <= iterations
                        ? text[i]
                        : chars[Math.floor(Math.random() * chars.length)];
                });
                iterations += 0.07;
                if (iterations >= text.length) {
                    spans.forEach((span, i) => span.textContent = text[i]);
                    clearInterval(tick);
                    if (onComplete) onComplete();
                }
            }, interval);
        }

        // Phase 2: after ALL scrambles done, rebuild as stagger hover
        function setupStagger({ link, text }) {
            link.textContent = '';

            const defaultSpan = document.createElement('span');
            defaultSpan.classList.add('stagger-default');
            const hoverSpan = document.createElement('span');
            hoverSpan.classList.add('stagger-hover');

            [...text].forEach((char, i) => {
                const delay = `${i * 0.03}s`;

                const c1 = document.createElement('span');
                c1.classList.add('char');
                c1.textContent = char === ' ' ? '\u00A0' : char;
                c1.style.transitionDelay = delay;
                defaultSpan.appendChild(c1);

                const c2 = document.createElement('span');
                c2.classList.add('char');
                c2.textContent = char === ' ' ? '\u00A0' : char;
                c2.style.transitionDelay = delay;
                hoverSpan.appendChild(c2);
            });

            link.appendChild(defaultSpan);
            link.appendChild(hoverSpan);
        }

        let triggered = false;
        const container = document.querySelector('.social-links');
        const observer = new IntersectionObserver((entries) => {
            if (entries[0].isIntersecting && !triggered) {
                triggered = true;
                observer.disconnect();

                let done = 0;
                // All 3 start simultaneously
                linkData.forEach(data => {
                    scrambleLink(data, () => {
                        done++;
                        // Only after every link finishes, wire up hover
                        if (done === linkData.length) {
                            linkData.forEach(d => setupStagger(d));
                        }
                    });
                });
            }
        }, { threshold: 0.5 });

        if (container) observer.observe(container);
    }
    initStaggerLinks();

    function initHyperText() {
        const el = document.querySelector('.email-link');
        if (!el) return;

        const originalText = el.textContent.trim();
        const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789@._-';
        const duration = 600;

        el.textContent = '';
        const spans = [...originalText].map(char => {
            const span = document.createElement('span');
            span.classList.add('hyper-char');
            span.textContent = char;
            el.appendChild(span);
            return span;
        });

        function runScramble(onDone) {
            let iterations = 0;
            const totalSteps = originalText.length * 10;
            const interval = duration / totalSteps;
            const tick = setInterval(() => {
                spans.forEach((span, i) => {
                    if (['.',  '@', '_', '-'].includes(originalText[i])) {
                        span.textContent = originalText[i];
                        return;
                    }
                    span.textContent = i <= iterations
                        ? originalText[i]
                        : chars[Math.floor(Math.random() * chars.length)];
                });
                iterations += 0.1;
                if (iterations >= originalText.length) {
                    spans.forEach((span, i) => span.textContent = originalText[i]);
                    clearInterval(tick);
                    if (onDone) onDone();
                }
            }, interval);
        }

        function setupStaggerHover() {
            el.textContent = '';
            el.style.position = 'relative';
            el.style.overflow = 'hidden';
            el.style.display = 'inline-block'; // needed for absolute child to size correctly

            const defaultSpan = document.createElement('span');
            defaultSpan.classList.add('stagger-default');
            defaultSpan.style.cssText = 'display:inline-block;';

            const hoverSpan = document.createElement('span');
            hoverSpan.classList.add('stagger-hover');
            hoverSpan.style.cssText = 'position:absolute; left:0; top:0; display:inline-block;';

            [...originalText].forEach((char, i) => {
                const delay = `${i * 0.018}s`;

                const c1 = document.createElement('span');
                c1.classList.add('char');
                c1.textContent = char === ' ' ? '\u00A0' : char;
                c1.style.transitionDelay = delay;
                defaultSpan.appendChild(c1);

                const c2 = document.createElement('span');
                c2.classList.add('char');
                c2.textContent = char === ' ' ? '\u00A0' : char;
                c2.style.transitionDelay = delay;
                hoverSpan.appendChild(c2);
            });

            el.appendChild(defaultSpan);
            el.appendChild(hoverSpan);
        }
        // Fire scramble once on scroll, then swap to stagger hover
        const observer = new IntersectionObserver((entries) => {
            if (entries[0].isIntersecting) {
                setTimeout(() => runScramble(() => {
                    // Small pause so user sees the resolved text, then wire up hover
                    setTimeout(setupStaggerHover, 400);
                }), 150);
                observer.disconnect();
            }
        }, { threshold: 0.6 });
        observer.observe(el);
    }
    initHyperText();

    // Skills strip scroll direction
    function initSkillsStrip() {
        const topTrack = document.querySelector('.skills-row:not(.reverse) .skills-track');
        const bottomTrack = document.querySelector('.skills-row.reverse .skills-track');
        if (!topTrack || !bottomTrack) return;

        const trackWidth = topTrack.scrollWidth / 2;

        let topOffset = 0;
        let bottomOffset = 0;

        let velocity = 1;
        let targetVelocity = 1;
        let lastDirection = 1; // +1 = down, -1 = up — persists after scroll stops

        let lastScrollY = window.scrollY;
        let lastScrollTime = performance.now();
        let scrollTimeout;

        window.addEventListener('scroll', () => {
            const currentScrollY = window.scrollY;
            const delta = currentScrollY - lastScrollY;
            const now = performance.now();
            const elapsed = Math.max(1, now - lastScrollTime);

            const scrollSpeed = Math.abs(delta) / elapsed; // px/ms
            const boost = Math.min(scrollSpeed * 15, 10);   // scale to px/frame, cap at 8

            if (delta > 0) {
                lastDirection = 1;
                targetVelocity = 1 + boost;
            } else if (delta < 0) {
                lastDirection = -1;
                targetVelocity = -(1 + boost);
            }

            lastScrollY = currentScrollY;
            lastScrollTime = now;

            // After scrolling stops, drift slowly in the same last direction
            clearTimeout(scrollTimeout);
            scrollTimeout = setTimeout(() => {
                targetVelocity = lastDirection * 1;
            }, 800);
        });

        function animate() {
            velocity += (targetVelocity - velocity) * 0.05;

            topOffset += velocity;
            bottomOffset -= velocity;

            if (topOffset >= trackWidth) topOffset -= trackWidth;
            if (topOffset < 0) topOffset += trackWidth;
            if (bottomOffset >= trackWidth) bottomOffset -= trackWidth;
            if (bottomOffset < 0) bottomOffset += trackWidth;

            topTrack.style.transform = `translateX(-${topOffset}px)`;
            bottomTrack.style.transform = `translateX(-${bottomOffset}px)`;

            requestAnimationFrame(animate);
        }

        animate();
    }
    initSkillsStrip();

    function initContactLiquid() {
        const section = document.querySelector('.contact-section');
        const canvas = document.querySelector('.contact-liquid-canvas');
        if (!canvas || !section) return;

        const ctx = canvas.getContext('2d');

        function resize() {
            canvas.width = section.offsetWidth;
            canvas.height = section.offsetHeight;
        }
        resize();
        window.addEventListener('resize', resize);

        // Mouse
        let mouseX = canvas.width / 2;
        let mouseY = canvas.height / 2;
        let isInside = false;

        section.addEventListener('mousemove', (e) => {
            const rect = section.getBoundingClientRect();
            mouseX = e.clientX - rect.left;
            mouseY = e.clientY - rect.top;
            isInside = true;
        });
        section.addEventListener('mouseleave', () => { isInside = false; });

        // Particles — white solid circles, the blur+contrast filter does all the liquid magic
        class Particle {
            constructor(x, y, isAccent = false) {
                this.x = x + (Math.random() - 0.5) * 20;
                this.y = y + (Math.random() - 0.5) * 20;
                this.targetX = x;
                this.targetY = y;
                this.r = Math.random() * 100 + 10;
                this.maxLife = 80 + Math.random() * 30;
                this.life = this.maxLife;
                this.isAccent = isAccent;
                this.vx = (Math.random() - 0.5) * 1.5;
                this.vy = (Math.random() - 0.5) * 1.5;
            }

            update() {
                // Drift slightly
                this.x += this.vx;
                this.y += this.vy;
                this.vx *= 0.97;
                this.vy *= 0.97;
                this.life--;
                // Slowly shrink as life ends
                if (this.life < 30) this.r *= 0.97;
            }

            draw() {
                const opacity = Math.min(1, this.life / 20);
                // Must be WHITE for mix-blend-mode:difference to invert properly
                // Grey won't invert — it needs full white
                ctx.fillStyle = `rgba(255, 255, 255, ${opacity})`;
                ctx.beginPath();
                ctx.arc(this.x, this.y, Math.max(0, this.r), 0, Math.PI * 2);
                ctx.fill();
            }
            get dead() { return this.life <= 0 || this.r < 0.5; }
        }

        let particles = [];
        let lastX = mouseX, lastY = mouseY;
        let spawnTimer = 0;

        function animate() {
            // Fade background slightly — this creates the temporal stain trail
            ctx.fillStyle = 'rgba(0, 0, 0, 0.12)'; // slightly slower fade = stains linger longer
            ctx.fillRect(0, 0, canvas.width, canvas.height);
            // Spawn particles on mouse move
            const dist = Math.hypot(mouseX - lastX, mouseY - lastY);
            if (isInside && dist > 5) {
                // Main accent blob at cursor
                particles.push(new Particle(mouseX, mouseY, true));
                // White satellite
                particles.push(new Particle(mouseX, mouseY, false));
                // Extra small accent blobs for trail
                if (dist > 15) {
                    particles.push(new Particle(
                        (mouseX + lastX) / 2,
                        (mouseY + lastY) / 2,
                        true
                    ));
                }
                lastX = mouseX;
                lastY = mouseY;
            }

            // Ambient idle blobs so section isn't dead
            spawnTimer++;
            if (spawnTimer % 40 === 0) {
                const cx = canvas.width / 2 + (Math.random() - 0.5) * canvas.width * 0.6;
                const cy = canvas.height / 2 + (Math.random() - 0.5) * canvas.height * 0.4;
                const p = new Particle(cx, cy, Math.random() > 0.5);
                p.r = Math.random() * 20 + 10; 
                p.maxLife = 60;
                p.life = 60;
                particles.push(p);
            }

            // Update + draw
            particles = particles.filter(p => !p.dead);
            particles.forEach(p => { p.update(); p.draw(); });

            requestAnimationFrame(animate);
        }

        animate();
    }
    if (hasFinePointer) {
        initContactLiquid();
    }

    function initParticleText() {
        const canvas = document.querySelector('.blog-cta-canvas');
        if (!canvas) return;

        const ctx = canvas.getContext('2d');
        const text = 'QUANTFLOW';
        const colors = [
            'd4ff00', 'a8cc00', 'd4ff00', 'ffffff',
            'a0a0a0', 'd4ff00', 'a8cc00', 'd4ff00'
        ];
        const particleDensity = 4;
        const animationForce = 20;

        let particles = [];
        let pointer = { x: undefined, y: undefined };
        let hasPointer = false;
        let animId = null;
        let interactionRadius = 5000;

        function rand(max = 1, min = 0) {
            return min + Math.random() * (max - min);
        }

        function hexToRgb(hex) {
            const r = parseInt(hex.slice(0, 2), 16);
            const g = parseInt(hex.slice(2, 4), 16);
            const b = parseInt(hex.slice(4, 6), 16);
            return [r, g, b];
        }

        class Particle {
            constructor(x, y, rgb) {
                this.ox = x; this.oy = y;
                this.cx = x; this.cy = y;
                this.or = rand(5, 1);
                this.cr = this.or;
                this.f = rand(animationForce + 15, animationForce - 15);
                this.rgb = rgb.map(c => Math.max(0, Math.min(255, c + rand(13, -13))));
            }

            draw() {
                ctx.fillStyle = `rgb(${this.rgb.map(Math.round).join(',')})`;
                ctx.beginPath();
                ctx.arc(this.cx, this.cy, this.cr, 0, Math.PI * 2);
                ctx.fill();
            }

            move() {
                if (hasPointer && pointer.x !== undefined) {
                    const dx = this.cx - pointer.x;
                    const dy = this.cy - pointer.y;
                    const dist = Math.hypot(dx, dy);
                    if (dist < interactionRadius && dist > 0) {
                        const force = Math.min(this.f * 1.5, (interactionRadius - dist) / dist * 2);
                        this.cx += (dx / dist) * force;
                        this.cy += (dy / dist) * force;
                    }
                }

                const odx = this.ox - this.cx;
                const ody = this.oy - this.cy;
                const od = Math.hypot(odx, ody);
                if (od > 1) {
                    const restore = Math.min(od * 0.04, 1.7);
                    this.cx += (odx / od) * restore;
                    this.cy += (ody / od) * restore;
                }

                this.draw();
            }
        }

        function write() {
            const w = canvas.width;
            const h = canvas.height;

            // Size based on width so text always fits horizontally
            const fontSize = Math.floor(w / text.length * 1.4);
            interactionRadius = Math.max(150, fontSize * 1.8);

            ctx.clearRect(0, 0, w, h);
            ctx.font = `900 ${fontSize}px 'Space Grotesk', Verdana, sans-serif`;
            ctx.textAlign = 'center';
            ctx.textBaseline = 'middle';

            const measured = ctx.measureText(text);

            // If text still overflows width, scale down further
            const scale = Math.min(1, (w * 0.95) / measured.width);
            const finalSize = Math.floor(fontSize * scale);

            ctx.font = `900 ${finalSize}px 'Space Grotesk', Verdana, sans-serif`;
            interactionRadius = Math.max(120, finalSize * 1.8);

            const measured2 = ctx.measureText(text);
            const tx = (w - measured2.width) / 2;
            const ty = (h - finalSize) / 2;

            const gradient = ctx.createLinearGradient(tx, ty, tx + measured2.width, ty + finalSize);
            colors.forEach((c, i) => gradient.addColorStop(i / (colors.length - 1), `#${c}`));
            ctx.fillStyle = gradient;
            ctx.fillText(text, w / 2, h / 2);

            const tw = Math.round(measured2.width);
            const th = finalSize;
            const sx = Math.max(0, Math.round(tx));
            const sy = Math.max(0, Math.round(ty));

            if (tw <= 0 || th <= 0) return;

            const data = ctx.getImageData(sx, sy, tw, th).data;
            ctx.clearRect(0, 0, w, h);
            particles = [];

            for (let i = 0; i < data.length; i += 4) {
                if (data[i + 3] < 128) continue;
                const px = (i / 4) % tw;
                const py = Math.floor((i / 4) / tw);
                if (px % particleDensity !== 0 || py % particleDensity !== 0) continue;
                const rgb = [data[i], data[i + 1], data[i + 2]];
                particles.push(new Particle(sx + px, sy + py, rgb));
            }
        }

        function animate() {
            ctx.clearRect(0, 0, canvas.width, canvas.height);
            particles.forEach(p => p.move());
            animId = requestAnimationFrame(animate);
        }

        function resize() {
            const rect = canvas.parentElement.getBoundingClientRect();
            canvas.width = rect.width;
            canvas.height = rect.height;
            write();
        }

        // Pointer events
        canvas.addEventListener('pointermove', (e) => {
            const rect = canvas.getBoundingClientRect();
            const scaleX = canvas.width / rect.width;
            const scaleY = canvas.height / rect.height;
            pointer.x = (e.clientX - rect.left) * scaleX;
            pointer.y = (e.clientY - rect.top) * scaleY;
            hasPointer = true;
        });

        canvas.addEventListener('pointerleave', () => {
            hasPointer = false;
            pointer.x = undefined;
            pointer.y = undefined;
        });

        window.addEventListener('resize', resize);

        // Fix: wait for layout to settle before first render
        setTimeout(resize, 100);
        animate();

        // Also re-render when section scrolls into view for the first time
        const observer = new IntersectionObserver((entries) => {
            entries.forEach(entry => {
                if (entry.isIntersecting) {
                    resize();
                    observer.disconnect();
                }
            });
        }, { threshold: 0.1 });

        observer.observe(canvas);
    }
    initParticleText();

    function initExperienceSlide() {
        const section = document.querySelector('.experience-section');
        if (!section) return;

        const cols = section.querySelectorAll('.split-col');
        if (cols.length < 2) return;

        const leftCol = cols[0];
        const rightCol = cols[1];

        // Mobile: skip (stacked layout, no horizontal slide)
        if (window.innerWidth < 768) return;

        function update() {
            const rect = section.getBoundingClientRect();
            const vh = window.innerHeight;

            const sectionCenter = rect.top + rect.height / 2;

            // Once section center has passed the viewport center, lock at 0
            if (sectionCenter <= vh / 2) {
                leftCol.style.transform = `translateX(0px)`;
                rightCol.style.transform = `translateX(0px)`;
                return;
            }

            // Section is still below center — slide in as it approaches
            const maxDist = vh * 0.75;
            let t = 1 - Math.min((sectionCenter - vh / 2) / maxDist, 1);
            t = t * t * (3 - 2 * t);

            const maxOffset = window.innerWidth * 0.65;
            const offset = (1 - t) * maxOffset;

            leftCol.style.transform = `translateX(-${offset}px)`;
            rightCol.style.transform = `translateX(${offset}px)`;
        }

        window.addEventListener('scroll', update, { passive: true });
        window.addEventListener('resize', update);
        update(); // set initial state
    }

    initExperienceSlide();

    function initWipeReveal(selector, coverBg = '#000') {
        const elements = document.querySelectorAll(selector);

        elements.forEach(el => {
            el.style.opacity = '0';
            el.style.position = 'relative';

            const observer = new IntersectionObserver((entries) => {
                entries.forEach(entry => {
                    if (!entry.isIntersecting || entry.target.dataset.wiped) return;

                    const el = entry.target;
                    el.dataset.wiped = 'true';
                    observer.unobserve(el);

                    const range = document.createRange();
                    range.selectNodeContents(el);
                    const rawRects = Array.from(range.getClientRects());
                    const elRect = el.getBoundingClientRect();

                    const lines = [];
                    rawRects.forEach(r => {
                        if (r.width < 2) return;
                        const existing = lines.find(l => Math.abs(l.top - r.top) < 4);
                        if (existing) {
                            existing.right = Math.max(existing.right, r.right);
                            existing.width = existing.right - existing.left;
                        } else {
                            lines.push({ top: r.top, left: r.left, right: r.right, width: r.width, height: r.height });
                        }
                    });

                    el.style.opacity = '1';

                    lines.forEach((line, i) => {
                        const top      = line.top  - elRect.top  - 1;
                        const left     = line.left - elRect.left;
                        const width    = line.width;
                        const height   = line.height + 2;
                        const stagger  = i * 110;
                        const duration = 600 + (line.width / window.innerWidth) * 100;
                        const easing   = 'cubic-bezier(0.77, 0, 0.175, 1)';

                        const baseCSS = `
                            position: absolute;
                            top: ${top}px; left: ${left}px;
                            width: ${width}px; height: ${height}px;
                            pointer-events: none; display: block;
                        `;

                        const cover = document.createElement('span');
                        cover.style.cssText = baseCSS + `
                            background: ${coverBg};
                            transform: scaleX(1);
                            transform-origin: right center;
                            z-index: 2;
                        `;
                        el.appendChild(cover);

                        const accent = document.createElement('span');
                        accent.style.cssText = baseCSS + `
                            background: var(--accent);
                            transform: scaleX(0);
                            transform-origin: left center;
                            z-index: 3;
                        `;
                        el.appendChild(accent);

                        setTimeout(() => {
                            accent.style.transition = `transform ${duration}ms ${easing}`;
                            cover.style.transition  = `transform ${duration}ms ${easing}`;
                            accent.getBoundingClientRect();
                            accent.style.transform = 'scaleX(1)';
                            cover.style.transform  = 'scaleX(0)';

                            setTimeout(() => {
                                cover.remove();
                                accent.style.transformOrigin = 'right center';
                                accent.style.transition = `transform ${duration * 0.75}ms ${easing}`;
                                accent.style.transform  = 'scaleX(0)';
                                setTimeout(() => accent.remove(), duration * 0.75);
                            }, duration);
                        }, stagger);
                    });
                });
            }, { threshold: 0.15 });

            observer.observe(el);
        });
    }

    // Calls
    initWipeReveal('.about-text-small, .about-quote', '#000');
    initWipeReveal('#main-project-title', 'var(--bg)');
    initWipeReveal('#side-project-title', '#0d0d0d');
    initWipeReveal('.blog-cta-label, .blog-cta-desc', 'var(--bg)');
    
    function initHorizontalWork() {
        const section = document.querySelector('.work-section');
        const track = document.querySelector('.work-track');
        const fill = document.querySelector('.work-progress-fill');
        const counterCurrent = document.querySelector('.work-counter-current');
        const prevBtn = document.querySelector('.work-arrow-prev');
        const nextBtn = document.querySelector('.work-arrow-next');

        if (!section || !track) return;
        if (window.innerWidth < 768) return;

        const cards = track.querySelectorAll('.work-card');
        const count = cards.length;
        let currentIndex = 0;

        function setIndex(i) {
            currentIndex = Math.max(0, Math.min(count - 1, i));
            const pct = currentIndex / (count - 1);

            track.style.transition = 'transform 0.9s cubic-bezier(0.77, 0, 0.175, 1)';
            track.style.transform = `translateX(-${currentIndex * 100}vw)`;

            if (fill) fill.style.width = `${pct * 100}%`;
            if (counterCurrent) counterCurrent.textContent = String(currentIndex + 1).padStart(2, '0');
            if (prevBtn) prevBtn.disabled = currentIndex === 0;
            if (nextBtn) nextBtn.disabled = currentIndex === count - 1;
        }

        // Scroll → horizontal
        function onScroll() {
            const rect = section.getBoundingClientRect();
            const sectionHeight = section.offsetHeight - window.innerHeight;
            const scrolled = -rect.top;
            const raw = scrolled / sectionHeight;
            const progress = Math.max(0, Math.min(1, raw));

            const idx = Math.round(progress * (count - 1));

            if (idx !== currentIndex) {
                track.style.transition = 'transform 0.6s cubic-bezier(0.77, 0, 0.175, 1)';
                currentIndex = idx;
                track.style.transform = `translateX(-${currentIndex * 100}vw)`;
                if (fill) fill.style.width = `${progress * 100}%`;
                if (counterCurrent) counterCurrent.textContent = String(currentIndex + 1).padStart(2, '0');
                if (prevBtn) prevBtn.disabled = currentIndex === 0;
                if (nextBtn) nextBtn.disabled = currentIndex === count - 1;
            } else {
                // smooth fill within a card
                if (fill) fill.style.width = `${progress * 100}%`;
            }
        }

        // Arrow clicks scroll to position
        if (prevBtn) prevBtn.addEventListener('click', () => {
            const targetProgress = Math.max(0, currentIndex - 1) / (count - 1);
            const sectionTop = section.offsetTop;
            const sectionHeight = section.offsetHeight - window.innerHeight;
            window.scrollTo({ top: sectionTop + targetProgress * sectionHeight, behavior: 'smooth' });
        });

        if (nextBtn) nextBtn.addEventListener('click', () => {
            const targetProgress = Math.min(count - 1, currentIndex + 1) / (count - 1);
            const sectionTop = section.offsetTop;
            const sectionHeight = section.offsetHeight - window.innerHeight;
            window.scrollTo({ top: sectionTop + targetProgress * sectionHeight, behavior: 'smooth' });
        });

        window.addEventListener('scroll', onScroll, { passive: true });
        setIndex(0);
    }

    initHorizontalWork();

    function initBentoReveal() {
        const cards = document.querySelectorAll('.bento-card');
        if (!cards.length) return;

        const observer = new IntersectionObserver((entries) => {
            entries.forEach(entry => {
                if (entry.isIntersecting) {
                    entry.target.style.animationPlayState = 'running';
                    observer.unobserve(entry.target);
                }
            });
        }, { threshold: 0.15 });

        cards.forEach((card, i) => {
            card.style.opacity = '0';
            card.style.transform = 'translateY(32px)';
            card.style.transition = `opacity 0.7s ease ${i * 0.12}s, transform 0.7s cubic-bezier(0.16,1,0.3,1) ${i * 0.12}s`;
            observer.observe(card);
        });

        // Re-use IntersectionObserver to trigger transition
        const trigger = new IntersectionObserver((entries) => {
            entries.forEach(entry => {
                if (entry.isIntersecting) {
                    const card = entry.target;
                    requestAnimationFrame(() => {
                        card.style.opacity = '1';
                        card.style.transform = 'translateY(0)';
                    });
                    trigger.unobserve(card);
                }
            });
        }, { threshold: 0.1 });

        cards.forEach(card => trigger.observe(card));
    }

    initBentoReveal();

    function initStockChartReveal() {
        const card = document.querySelector('.bento-card--wide');
        if (!card) return;

        const observer = new IntersectionObserver((entries) => {
            entries.forEach(entry => {
                if (entry.isIntersecting) {
                    card.querySelectorAll('.schart-green, .schart-red, .schart-label').forEach(el => {
                        el.style.animationPlayState = 'running';
                    });
                    observer.unobserve(card);
                }
            });
        }, { threshold: 0.3 });

        observer.observe(card);
    }

    initStockChartReveal();

    function initExperience() {
        // ── Stat counters ──
        const stats = document.querySelectorAll('.exp-stat-num');
        let countersStarted = false;

        function startCounters() {
            if (countersStarted) return;
            countersStarted = true;

            stats.forEach(el => {
                const target   = parseFloat(el.dataset.target);
                const decimals = parseInt(el.dataset.decimals) || 0;
                const duration = 2800;
                const start    = performance.now();

                function tick(now) {
                    const elapsed  = now - start;
                    const progress = Math.min(elapsed / duration, 1);
                    // Ease out cubic
                    const eased = 1 - Math.pow(1 - progress, 3);
                    el.textContent = (eased * target).toFixed(decimals);
                    if (progress < 1) requestAnimationFrame(tick);
                    else el.textContent = target.toFixed(decimals);
                }
                requestAnimationFrame(tick);
            });
        }

        const statsObserver = new IntersectionObserver(entries => {
            if (entries[0].isIntersecting) {
                startCounters();
                statsObserver.disconnect();
            }
        }, { threshold: 0.4 });

        const statsEl = document.querySelector('.exp-stats');
        if (statsEl) statsObserver.observe(statsEl);

        // ── Timeline fill + item activation ──
        document.querySelectorAll('[data-timeline]').forEach(timeline => {
            const progressBar = timeline.querySelector('.timeline-progress');
            const items       = timeline.querySelectorAll('[data-tl-item]');
            let activated     = false;

            const observer = new IntersectionObserver(entries => {
                if (entries[0].isIntersecting && !activated) {
                    activated = true;

                    // Fill the line
                    requestAnimationFrame(() => {
                        progressBar.classList.add('filled');
                    });

                    // Activate each item with stagger
                    items.forEach((item, i) => {
                        setTimeout(() => {
                            item.classList.add('tl-active');
                        }, 200 + i * 280);
                    });

                    observer.disconnect();
                }
            }, { threshold: 0.2 });

            observer.observe(timeline);
        });
    }

    initExperience();
});

// Vertical Scroller
function initScroller() {
  const container = document.querySelector('.scroller-container');
  const scroller = document.querySelector('.vertical-scroller');
  if (!container || !scroller) return;

  const items = [...scroller.querySelectorAll('.scroller-item')];
  const GAP = 32; // px between items
  let current = 0;
  let animating = false;

  // Clone first item for seamless loop
  const clone = items[0].cloneNode(true);
  scroller.appendChild(clone);

  // Apply gap via JS
  scroller.style.gap = `${GAP}px`;

  function getItemHeight() {
    return items[0].getBoundingClientRect().height;
  }

  function setContainerHeight() {
    container.style.height = `${getItemHeight()}px`;
  }

  function getOffset(index) {
    return index * (getItemHeight() + GAP);
  }

  function jumpTo(index) {
    scroller.style.transition = 'none';
    scroller.style.transform = `translateY(-${getOffset(index)}px)`;
  }

  function slideTo(index) {
    scroller.style.transition = 'transform 0.75s cubic-bezier(0.87, 0, 0.13, 1)';
    scroller.style.transform = `translateY(-${getOffset(index)}px)`;
  }

  function next() {
    if (animating) return;
    animating = true;

    const nextIndex = current + 1;
    slideTo(nextIndex);

    setTimeout(() => {
      if (nextIndex >= items.length) {
        // We're on the clone — instantly jump back to real first
        jumpTo(0);
        current = 0;
      } else {
        current = nextIndex;
      }
      animating = false;
    }, 800); // slightly longer than transition
  }

  // Init
  setContainerHeight();
  jumpTo(0);
  window.addEventListener('resize', () => {
    setContainerHeight();
    jumpTo(current);
  });

  setInterval(next, 2800); // hold time between slides
}

initScroller();
