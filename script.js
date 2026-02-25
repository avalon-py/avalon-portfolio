document.addEventListener('DOMContentLoaded', () => {
    // Initialize Lucide Icons
    if (window.lucide) {
        window.lucide.createIcons();
    }

    // Custom Cursor
    const cursor = document.querySelector('.cursor');
    const follower = document.querySelector('.cursor-follower');
    
    let mouseX = 0, mouseY = 0;
    let posX = 0, posY = 0;

    document.addEventListener('mousemove', (e) => {
        mouseX = e.clientX;
        mouseY = e.clientY;

        // Immediate update for dot
        if (cursor) {
            cursor.style.left = `${mouseX}px`;
            cursor.style.top = `${mouseY}px`;
        }
    });

    // Smooth update for follower
    function animateCursor() {
        posX += (mouseX - posX) / 9;
        posY += (mouseY - posY) / 9;
        
        if (follower) {
            follower.style.left = `${posX}px`;
            follower.style.top = `${posY}px`;
        }
        
        requestAnimationFrame(animateCursor);
    }
    animateCursor();

    // Hover effects
    const hoverElements = document.querySelectorAll('a, button, .project-item, .nav-link');
    hoverElements.forEach(el => {
        el.addEventListener('mouseenter', () => {
            cursor?.classList.add('active');
            follower?.classList.add('active');
        });
        el.addEventListener('mouseleave', () => {
            cursor?.classList.remove('active');
            follower?.classList.remove('active');
        });
    });

    // Liquid Canvas Effect
    const canvas = document.getElementById('liquid-canvas');
    if (canvas) {
        const ctx = canvas.getContext('2d');
        let width, height;
        let points = [];
        // History of mouse positions
        let mouseHistory = [];
        
        function resize() {
            width = canvas.width = window.innerWidth;
            height = canvas.height = window.innerHeight;
        }
        
        window.addEventListener('resize', resize);
        resize();

        // Track mouse
        let mouseX = 0, mouseY = 0;
        document.addEventListener('mousemove', (e) => {
            mouseX = e.clientX;
            mouseY = e.clientY;
            // Add point on move
            mouseHistory.push({ x: mouseX, y: mouseY, age: 0 });
        });

        function animateLiquid() {
            // Clear with fade for trails
            // Using a very low opacity black to create trails
            ctx.fillStyle = 'rgba(0, 0, 0, 0.1)';
            ctx.fillRect(0, 0, width, height);

            // Draw fluid lines
            if (mouseHistory.length > 1) {
                ctx.lineCap = 'round';
                ctx.lineJoin = 'round';
                
                // Draw connecting lines
                for (let i = 0; i < mouseHistory.length - 1; i++) {
                    const p1 = mouseHistory[i];
                    const p2 = mouseHistory[i+1];
                    
                    // Age points
                    p1.age++;
                    
                    // Calculate life (0 to 1)
                    const maxAge = 50;
                    const life = 1 - (p1.age / maxAge);
                    
                    if (life > 0) {
                        ctx.beginPath();
                        ctx.moveTo(p1.x, p1.y);
                        // Quadratic curve for smoothness? Linear for now is fine with high sampling
                        ctx.lineTo(p2.x, p2.y);
                        
                        // Dynamic width based on life
                        ctx.lineWidth = 40 * life; 
                        
                        // White color for the "liquid" base (contrast filter handles the rest)
                        // The filter blur(10px) contrast(30) needs bright input to work
                        ctx.strokeStyle = `rgba(255, 255, 255, ${life})`;
                        ctx.stroke();
                    }
                }
                
                // Remove dead points
                mouseHistory = mouseHistory.filter(p => p.age < 50);
            }
            
            requestAnimationFrame(animateLiquid);
        }
        animateLiquid();
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
                // Done — blink cursor a few times then fade it out
                setTimeout(() => {
                    cursor.style.transition = 'opacity 0.5s ease';
                    cursor.style.opacity = '0';
                }, 1500);
            }
        }
    }

    initQuoteTypewriter();

    // Stagger hover effect for social links
    function initStaggerLinks() {
        const links = document.querySelectorAll('.social-link');

        links.forEach(link => {
            const text = link.textContent.trim();
            link.textContent = '';

            // Default layer (visible, animates up on hover)
            const defaultSpan = document.createElement('span');
            defaultSpan.classList.add('stagger-default');

            // Hover layer (hidden below, animates in on hover)
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
        });
    }

    initStaggerLinks();

    function initHyperText() {
        const el = document.querySelector('.email-link');
        if (!el) return;

        const originalText = el.textContent.trim();
        const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789@._-';
        const duration = 250;

        // Build char spans
        el.textContent = '';
        const spans = [...originalText].map(char => {
            const span = document.createElement('span');
            span.classList.add('hyper-char');
            span.textContent = char;
            el.appendChild(span);
            return span;
        });

        let animating = false;

        el.addEventListener('mouseenter', () => {
            if (animating) return;
            animating = true;

            let iterations = 0;
            const totalSteps = originalText.length * 10;
            const interval = duration / totalSteps;

            const tick = setInterval(() => {
            spans.forEach((span, i) => {
                if (originalText[i] === ' ' || originalText[i] === '.' || originalText[i] === '@') {
                span.textContent = originalText[i]; // keep special chars stable
                return;
                }

                if (i <= iterations) {
                // Resolved — show real character
                span.textContent = originalText[i];
                } else {
                // Still scrambling
                span.textContent = chars[Math.floor(Math.random() * chars.length)];
                }
            });

            iterations += 0.45;

            if (iterations >= originalText.length) {
                // Ensure final state is clean
                spans.forEach((span, i) => span.textContent = originalText[i]);
                clearInterval(tick);
                animating = false;
            }
            }, interval);
        });
    }

    initHyperText();

    // Skills strip scroll direction
    function initSkillsStrip() {
        const topTrack = document.querySelector('.skills-row:not(.reverse) .skills-track');
        const bottomTrack = document.querySelector('.skills-row.reverse .skills-track');
        if (!topTrack || !bottomTrack) return;

        const trackWidth = topTrack.scrollWidth / 2; // half because content is duplicated

        let topOffset = 0;
        let bottomOffset = 0;

        // Velocity: positive = left, negative = right
        let velocity = 1; // default drift speed (px per frame)
        let targetVelocity = 1;

        let lastScrollY = window.scrollY;
        let scrollTimeout;

        window.addEventListener('scroll', () => {
            const currentScrollY = window.scrollY;
            const delta = currentScrollY - lastScrollY;
            lastScrollY = currentScrollY;

            if (delta > 0) {
                targetVelocity = 1.5;  // scrolling down — top goes left
            } else if (delta < 0) {
                targetVelocity = -1.5; // scrolling up — top goes right
            }

            // After scrolling stops, ease back to default drift
            clearTimeout(scrollTimeout);
            scrollTimeout = setTimeout(() => {
                targetVelocity = 1;
            }, 800);
        });

        function animate() {
            // Smoothly interpolate velocity toward target
            velocity += (targetVelocity - velocity) * 0.05;

            // Top track moves in velocity direction
            topOffset += velocity;
            // Bottom track moves in opposite direction
            bottomOffset -= velocity;

            // Wrap around seamlessly
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
        const animationForce = 80;

        let particles = [];
        let pointer = { x: undefined, y: undefined };
        let hasPointer = false;
        let animId = null;
        let interactionRadius = 100;

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
                        const force = Math.min(this.f, (interactionRadius - dist) / dist * 2);
                        this.cx += (dx / dist) * force;
                        this.cy += (dy / dist) * force;
                    }
                }

                const odx = this.ox - this.cx;
                const ody = this.oy - this.cy;
                const od = Math.hypot(odx, ody);
                if (od > 1) {
                    const restore = Math.min(od * 0.1, 3);
                    this.cx += (odx / od) * restore;
                    this.cy += (ody / od) * restore;
                }

                this.draw();
            }
        }

        function write() {
            const w = canvas.width;
            const h = canvas.height;

            const fontSize = Math.floor(h * 0.39); // sized relative to canvas height
            interactionRadius = Math.max(60, fontSize * 0.8);

            ctx.clearRect(0, 0, w, h);
            ctx.font = `900 ${fontSize}px 'Space Grotesk', Verdana, sans-serif`;
            ctx.textAlign = 'center';
            ctx.textBaseline = 'middle';

            const measured = ctx.measureText(text);
            const tx = (w - measured.width) / 2;
            const ty = (h - fontSize) / 2;
            const gradient = ctx.createLinearGradient(tx, ty, tx + measured.width, ty + fontSize);
            colors.forEach((c, i) => gradient.addColorStop(i / (colors.length - 1), `#${c}`));
            ctx.fillStyle = gradient;
            ctx.fillText(text, w / 2, h / 2);

            const tw = Math.round(measured.width);
            const th = fontSize;
            const sx = Math.max(0, Math.round(tx));
            const sy = Math.max(0, Math.round(ty));
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
