// Theme toggle (light / dark), remembered across visits
const root = document.documentElement;
const themeToggle = document.querySelector('.theme-toggle');
const themeIcon = themeToggle.querySelector('i');

function applyTheme(theme) {
    root.setAttribute('data-theme', theme);
    themeIcon.className = theme === 'dark' ? 'fas fa-sun' : 'fas fa-moon';
}

// Initial theme is set by the inline script in <head>; just sync the icon
applyTheme(root.getAttribute('data-theme') || 'light');

themeToggle.addEventListener('click', () => {
    const next = root.getAttribute('data-theme') === 'dark' ? 'light' : 'dark';
    applyTheme(next);
    try { localStorage.setItem('theme', next); } catch (e) {}
});

// Footer year
document.getElementById('year').textContent = new Date().getFullYear();

// Tabs: each section is its own page, selected by the URL hash (#news, #teaching, ...)
const sections = document.querySelectorAll('main > section');
const navLinks = document.querySelectorAll('.nav-menu a');

function showTab() {
    const id = location.hash.substring(1);
    const target = document.getElementById(id) || sections[0];

    sections.forEach(section => {
        section.classList.toggle('active-tab', section === target);
    });

    navLinks.forEach(link => {
        link.classList.toggle('active', link.getAttribute('href').substring(1) === target.id);
    });

    document.title = target.id === sections[0].id
        ? 'Samia Islam'
        : `${target.querySelector('h2').textContent} | Samia Islam`;

    window.scrollTo({ top: 0, behavior: 'instant' });
    onScroll();
}

window.addEventListener('hashchange', showTab);

// Scroll-driven UI: header shadow, progress bar, back-to-top
const header = document.querySelector('header');
const progressBar = document.querySelector('.scroll-progress');
const backToTop = document.querySelector('.back-to-top');

function onScroll() {
    const maxScroll = document.documentElement.scrollHeight - innerHeight;
    progressBar.style.width = (maxScroll > 0 ? (scrollY / maxScroll) * 100 : 0) + '%';
    header.classList.toggle('scrolled', scrollY > 10);
    backToTop.classList.toggle('visible', scrollY > 600);
}

window.addEventListener('scroll', onScroll, { passive: true });

backToTop.addEventListener('click', () => {
    window.scrollTo({ top: 0, behavior: 'smooth' });
});

// Hamburger Menu
const hamburger = document.querySelector('.hamburger');
const navMenu = document.querySelector('.nav-menu');

hamburger.addEventListener('click', () => {
    hamburger.classList.toggle('active');
    navMenu.classList.toggle('active');
});

// Close menu when clicking a link
navLinks.forEach(link => {
    link.addEventListener('click', () => {
        hamburger.classList.remove('active');
        navMenu.classList.remove('active');
    });
});

// Reveal-on-scroll animation for cards and sections
const revealTargets = document.querySelectorAll(
    '.publication, .teaching-item, .news-item, .entry, .resume-viewer, .contact-info, .bio, .profile-image'
);

revealTargets.forEach((el, i) => {
    el.classList.add('reveal');
    // Stagger siblings slightly
    el.style.transitionDelay = `${(i % 4) * 80}ms`;
});

const observer = new IntersectionObserver((entries) => {
    entries.forEach(entry => {
        if (entry.isIntersecting) {
            const el = entry.target;
            el.classList.add('in-view');
            observer.unobserve(el);
            // Drop the stagger delay so hover effects stay snappy
            el.addEventListener('transitionend', () => { el.style.transitionDelay = ''; }, { once: true });
        }
    });
}, { threshold: 0.12 });

revealTargets.forEach(el => observer.observe(el));
sections.forEach(section => observer.observe(section));

showTab();

// Background: cells rolling down a Waddington landscape (bottom-right corner)
(() => {
    const canvas = document.querySelector('.landscape');
    const ctx = canvas.getContext('2d');
    const layer = document.createElement('canvas'); // pre-rendered landscape
    const reduceMotion = matchMedia('(prefers-reduced-motion: reduce)').matches;
    let W, H, dpr, lineColor, cellColor;

    const smooth = (a, b, x) => {
        const t = Math.min(1, Math.max(0, (x - a) / (b - a)));
        return t * t * (3 - 2 * t);
    };

    // Valley centres: one valley at the top splits into two, then the left one splits again
    function valleys(v) {
        const s1 = smooth(0.18, 0.55, v);
        const s2 = smooth(0.5, 0.85, v);
        return [-0.45 * s1 - 0.22 * s2, -0.45 * s1 + 0.22 * s2, 0.45 * s1];
    }

    // Surface height at (u: left/right, v: back/front)
    function height(u, v) {
        const w = 0.11 + 0.08 * v;
        let valley = 0;
        valleys(v).forEach(c => { valley = Math.max(valley, Math.exp(-(((u - c) / w) ** 2))); });
        return 0.9 * (1 - v) ** 1.3 + 0.45 * u * u - (0.12 + 0.4 * v) * valley;
    }

    function project(u, v, h) {
        const p = 0.6 + 0.4 * v;
        return [
            W / 2 + u * W * 0.4 * p,
            H * 0.4 + H * 0.52 * v ** 1.1 - h * H * 0.36 * p
        ];
    }

    function drawLandscape() {
        const styles = getComputedStyle(document.documentElement);
        lineColor = styles.getPropertyValue('--doodle').trim();
        cellColor = styles.getPropertyValue('--brand').trim();

        const g = layer.getContext('2d');
        g.setTransform(dpr, 0, 0, dpr, 0, 0);
        g.clearRect(0, 0, W, H);
        g.strokeStyle = lineColor;
        g.lineWidth = 1;

        const line = (points, alpha) => {
            g.globalAlpha = alpha;
            g.beginPath();
            points.forEach(([u, v], i) => {
                const [x, y] = project(u, v, height(u, v));
                i ? g.lineTo(x, y) : g.moveTo(x, y);
            });
            g.stroke();
        };

        const range = (a, b, n) => Array.from({ length: n + 1 }, (_, i) => a + (b - a) * i / n);
        range(0, 1, 24).forEach(v => line(range(-1.15, 1.15, 80).map(u => [u, v]), 0.18 + 0.27 * v));
        range(-1.15, 1.15, 14).forEach(u => line(range(0, 1, 50).map(v => [u, v]), 0.14));
    }

    // Each cell commits to one valley (cell fate) and glides along its floor
    const newCell = v => ({ v, fate: Math.floor(Math.random() * 3), angle: 0, x: null, y: null });
    const cells = Array.from({ length: 5 }, (_, i) => newCell(i / 5));

    function place(cell) {
        const u = valleys(cell.v)[cell.fate];
        const r = 4 + 5 * cell.v;
        const [x, y] = project(u, cell.v, height(u, cell.v));
        // Roll: turn by the distance travelled divided by the radius
        if (cell.x !== null) cell.angle += Math.hypot(x - cell.x, y - cell.y) / r;
        Object.assign(cell, { x, y, r });
    }

    function step(cell, dt) {
        cell.v += 0.03 * dt; // ~33 seconds from the hilltop to the bottom
        if (cell.v > 1.02) Object.assign(cell, newCell(0));
        place(cell);
    }

    function drawCells() {
        ctx.clearRect(0, 0, W, H);
        ctx.drawImage(layer, 0, 0, W, H);
        if (reduceMotion) return; // static landscape only
        ctx.fillStyle = ctx.strokeStyle = cellColor;
        ctx.lineWidth = 1.5;
        cells.forEach(({ x, y, r, v, angle }) => {
            const fade = smooth(0, 0.06, v) * (1 - smooth(0.94, 1.02, v));
            const cy = y - r;
            ctx.globalAlpha = 0.3 * fade;
            ctx.beginPath();
            ctx.arc(x, cy, r, 0, Math.PI * 2);
            ctx.fill();
            ctx.globalAlpha = 0.75 * fade;
            ctx.stroke();
            ctx.beginPath();
            ctx.arc(x + Math.cos(angle) * r * 0.45, cy + Math.sin(angle) * r * 0.45, r * 0.3, 0, Math.PI * 2);
            ctx.fill();
        });
        ctx.globalAlpha = 1;
    }

    function resize() {
        dpr = Math.min(devicePixelRatio || 1, 2);
        W = canvas.clientWidth;
        H = canvas.clientHeight;
        [canvas, layer].forEach(c => { c.width = W * dpr; c.height = H * dpr; });
        ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
        cells.forEach(cell => { cell.x = null; place(cell); });
        drawLandscape();
        drawCells();
    }

    let last = performance.now();
    function frame(now) {
        const dt = Math.min(0.05, (now - last) / 1000);
        last = now;
        cells.forEach(cell => step(cell, dt));
        drawCells();
        requestAnimationFrame(frame);
    }

    window.addEventListener('resize', resize);
    // Redraw in the new colours when the theme changes
    new MutationObserver(() => { drawLandscape(); drawCells(); })
        .observe(document.documentElement, { attributes: true, attributeFilter: ['data-theme'] });

    resize();
    if (!reduceMotion) requestAnimationFrame(frame);
})();
