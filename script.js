import * as THREE from 'three';

// --- Initialization ---
document.addEventListener('DOMContentLoaded', () => {
    // Initialize Lucide Icons
    lucide.createIcons();

    // Init Logic
    initThreeScene();
    initCursorGlow();
    initHeaderScroll();
    initMobileMenu();
});

// --- Three.js Scene ---
function initThreeScene() {
    const container = document.getElementById('canvas-container');
    if (!container) return;

    const scene = new THREE.Scene();
    // Add Fog to blend edges
    scene.fog = new THREE.Fog('#131a26', 2, 8); // Matches card bg color roughly

    const camera = new THREE.PerspectiveCamera(60, container.clientWidth / container.clientHeight, 0.1, 100);
    camera.position.z = 5;

    const renderer = new THREE.WebGLRenderer({ alpha: true, antialias: true });
    renderer.setSize(container.clientWidth, container.clientHeight);
    renderer.setPixelRatio(window.devicePixelRatio);
    container.appendChild(renderer.domElement);

    // Particles
    const particleGeometry = new THREE.BufferGeometry();
    const count = 300;
    const positions = new Float32Array(count * 3);
    const radius = 2.2;

    for (let i = 0; i < count; i++) {
        const theta = THREE.MathUtils.randFloatSpread(360);
        const phi = THREE.MathUtils.randFloatSpread(360);

        const x = radius * Math.sin(theta) * Math.cos(phi);
        const y = radius * Math.sin(theta) * Math.sin(phi);
        const z = radius * Math.cos(theta);

        positions[i * 3] = x;
        positions[i * 3 + 1] = y;
        positions[i * 3 + 2] = z;
    }

    particleGeometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));

    const particleMaterial = new THREE.PointsMaterial({
        color: 0x135bec,
        size: 0.05,
        transparent: true,
        sizeAttenuation: true,
        depthWrite: false,
        blending: THREE.AdditiveBlending
    });

    const particles = new THREE.Points(particleGeometry, particleMaterial);
    
    // Wireframe Sphere (Icosahedron)
    const geometry = new THREE.IcosahedronGeometry(1, 2);
    const material = new THREE.MeshBasicMaterial({ 
        color: 0x135bec, 
        wireframe: true, 
        transparent: true, 
        opacity: 0.05 
    });
    const wireframeSphere = new THREE.Mesh(geometry, material);
    wireframeSphere.scale.set(1.8, 1.8, 1.8);

    const group = new THREE.Group();
    group.add(particles);
    group.add(wireframeSphere);
    group.rotation.z = Math.PI / 4;
    scene.add(group);

    // Ambient Light
    const ambientLight = new THREE.AmbientLight(0xffffff, 0.5);
    scene.add(ambientLight);

    // Animation Loop
    const clock = new THREE.Clock();

    function animate() {
        requestAnimationFrame(animate);

        const delta = clock.getDelta();
        const time = clock.getElapsedTime();

        // Rotation
        group.rotation.x -= delta / 50;
        group.rotation.y -= delta / 15;

        // Breathing effect
        const scale = 1 + Math.sin(time * 0.5) * 0.05;
        group.scale.set(scale, scale, scale);

        renderer.render(scene, camera);
    }

    animate();

    // Resize Handler
    window.addEventListener('resize', () => {
        if (!container) return;
        camera.aspect = container.clientWidth / container.clientHeight;
        camera.updateProjectionMatrix();
        renderer.setSize(container.clientWidth, container.clientHeight);
    });
}

// --- Cursor Glow Effect ---
function initCursorGlow() {
    const glowEl = document.getElementById('cursor-glow');
    
    window.addEventListener('mousemove', (e) => {
        // Reduced opacity from 0.06 to 0.025 and size from 600px to 500px for subtler effect
        glowEl.style.background = `radial-gradient(500px circle at ${e.clientX}px ${e.clientY}px, rgba(19, 91, 236, 0.025), transparent 50%)`;
    });
}

// --- Header Scroll Effect ---
function initHeaderScroll() {
    const header = document.getElementById('main-header');
    
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