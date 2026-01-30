/**
 * QuantFlow Background Animation
 * Simulates market noise / random walk particles
 */

const canvas = document.getElementById('market-noise');
if (canvas) {
    const ctx = canvas.getContext('2d');
    let width, height;
    let particles = [];
    
    // Configuration
    const PARTICLE_COUNT = 40;
    const CONNECTION_DISTANCE = 150;
    const BASE_SPEED = 0.5;

    class Particle {
        constructor() {
            this.x = Math.random() * width;
            this.y = Math.random() * height;
            this.vx = (Math.random() - 0.5) * BASE_SPEED;
            this.vy = (Math.random() - 0.5) * BASE_SPEED;
            this.size = Math.random() * 1.5 + 0.5;
            // Introduce some "trend" bias occasionally
            this.trend = Math.random() > 0.5 ? 1 : -1;
        }

        update() {
            this.x += this.vx;
            this.y += this.vy;

            // Boundary wrap
            if (this.x < 0) this.x = width;
            if (this.x > width) this.x = 0;
            if (this.y < 0) this.y = height;
            if (this.y > height) this.y = 0;
            
            // Random "market volatility" movement
            if (Math.random() < 0.02) {
                this.vx = (Math.random() - 0.5) * BASE_SPEED * 2;
                this.vy = (Math.random() - 0.5) * BASE_SPEED * 2;
            }
        }

        draw() {
            ctx.fillStyle = 'rgba(0, 242, 234, 0.3)'; // Cyan accent
            ctx.beginPath();
            ctx.arc(this.x, this.y, this.size, 0, Math.PI * 2);
            ctx.fill();
        }
    }

    function init() {
        resize();
        for (let i = 0; i < PARTICLE_COUNT; i++) {
            particles.push(new Particle());
        }
        loop();
    }

    function resize() {
        width = window.innerWidth;
        height = window.innerHeight;
        canvas.width = width;
        canvas.height = height;
    }

    function drawConnections() {
        ctx.lineWidth = 0.5;
        for (let i = 0; i < particles.length; i++) {
            for (let j = i + 1; j < particles.length; j++) {
                const dx = particles[i].x - particles[j].x;
                const dy = particles[i].y - particles[j].y;
                const dist = Math.sqrt(dx * dx + dy * dy);

                if (dist < CONNECTION_DISTANCE) {
                    const opacity = 1 - (dist / CONNECTION_DISTANCE);
                    ctx.strokeStyle = `rgba(255, 255, 255, ${opacity * 0.1})`;
                    ctx.beginPath();
                    ctx.moveTo(particles[i].x, particles[i].y);
                    ctx.lineTo(particles[j].x, particles[j].y);
                    ctx.stroke();
                }
            }
        }
    }

    function loop() {
        ctx.clearRect(0, 0, width, height);
        
        particles.forEach(p => {
            p.update();
            p.draw();
        });

        drawConnections();

        requestAnimationFrame(loop);
    }

    window.addEventListener('resize', resize);
    init();
}