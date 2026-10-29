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
    const glowLayer = document.createElement('canvas'); // brighter copy, revealed around the cursor
    const spot = document.createElement('canvas'); // scratch canvas for the spotlight
    const reduceMotion = matchMedia('(prefers-reduced-motion: reduce)').matches;
    let W, H, dpr, lineColor, cellColor;

    // Cursor position in canvas coordinates; `focus` eases in while hovering the landscape
    const pointer = { x: 0, y: 0, sx: 0, sy: 0, inside: false };
    let focus = 0;

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
        return 0.9 * Math.max(0, 1 - v) ** 1.3 +0.45 * u * u - (0.12 + 0.4 * v) * valley;
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

        const range = (a, b, n) => Array.from({ length: n + 1 }, (_, i) => a + (b - a) * i / n);

        const render = (target, color, width, boost) => {
            const g = target.getContext('2d');
            g.setTransform(dpr, 0, 0, dpr, 0, 0);
            g.clearRect(0, 0, W, H);
            g.strokeStyle = color;
            g.lineWidth = width;

            const line = (points, alpha) => {
                g.globalAlpha = Math.min(1, alpha * boost);
                g.beginPath();
                points.forEach(([u, v], i) => {
                    const [x, y] = project(u, v, height(u, v));
                    i ? g.lineTo(x, y) : g.moveTo(x, y);
                });
                g.stroke();
            };

            range(0, 1, 24).forEach(v => line(range(-1.15, 1.15, 80).map(u => [u, v]), 0.18 + 0.27 * v));
            range(-1.15, 1.15, 14).forEach(u => line(range(0, 1, 50).map(v => [u, v]), 0.14));
        };

        render(layer, lineColor, 1, 1);
        render(glowLayer, cellColor, 1.4, 3);
    }

    // Brighten the wireframe in a soft circle under the cursor
    function drawSpotlight() {
        if (focus < 0.01) return;
        const s = spot.getContext('2d');
        s.setTransform(1, 0, 0, 1, 0, 0);
        s.globalCompositeOperation = 'source-over';
        s.clearRect(0, 0, spot.width, spot.height);
        s.drawImage(glowLayer, 0, 0);
        s.setTransform(dpr, 0, 0, dpr, 0, 0);
        s.globalCompositeOperation = 'destination-in';
        const gradient = s.createRadialGradient(pointer.sx, pointer.sy, 0, pointer.sx, pointer.sy, 90);
        gradient.addColorStop(0, '#000');
        gradient.addColorStop(1, 'transparent');
        s.fillStyle = gradient;
        s.fillRect(0, 0, W, H);
        ctx.globalAlpha = focus;
        ctx.drawImage(spot, 0, 0, W, H);
        ctx.globalAlpha = 1;
    }

    // Each cell commits to one valley (cell fate) and glides along its floor
    // (ox, oy) is a nudge from the cursor that springs back to the valley floor
    const newCell = v => ({
        v, fate: Math.floor(Math.random() * 3), angle: 0,
        x: null, y: null, ox: 0, oy: 0, vx: 0, vy: 0, near: 0
    });
    const cells = Array.from({ length: 5 }, (_, i) => newCell(i / 5));

    const floor = (cell, fate) => {
        const u = valleys(cell.v)[fate];
        return project(u, cell.v, height(u, cell.v));
    };

    function place(cell) {
        const r = 4 + 5 * cell.v;
        const [bx, by] = floor(cell, cell.fate);
        const x = bx + cell.ox;
        const y = by + cell.oy;
        // Roll: turn by the distance travelled divided by the radius
        if (cell.x !== null) cell.angle += Math.hypot(x - cell.x, y - cell.y) / r;
        Object.assign(cell, { x, y, r });
    }

    // A cell pushed far enough before the valleys commit it rolls into a different fate
    function maybeSwitchFate(cell) {
        if (cell.v > 0.6 || Math.abs(cell.ox) < 6) return;
        const centres = valleys(cell.v);
        const scale = W * 0.4 * (0.6 + 0.4 * cell.v);
        const u = centres[cell.fate] + cell.ox / scale;
        let best = cell.fate;
        centres.forEach((c, i) => {
            if (Math.abs(u - c) < Math.abs(u - centres[best]) - 0.05) best = i;
        });
        if (best === cell.fate) return;
        const [ax, ay] = floor(cell, cell.fate);
        const [bx, by] = floor(cell, best);
        cell.fate = best;
        cell.ox += ax - bx; // keep the drawn position continuous
        cell.oy += ay - by;
    }

    function nudge(cell, dt) {
        const cx = cell.x;
        const cy = cell.y - cell.r;
        const dx = cx - pointer.x;
        const dy = cy - pointer.y;
        const d = Math.hypot(dx, dy) || 1;
        const reach = 70;
        cell.near += ((pointer.inside ? Math.max(0, 1 - d / 110) : 0) - cell.near) * Math.min(1, dt * 8);
        if (pointer.inside && d < reach) {
            const force = (1 - d / reach) ** 2 * 2200;
            cell.vx += (dx / d) * force * dt;
            cell.vy += (dy / d) * force * dt;
        }
        // Spring back to the valley floor, with damping
        cell.vx += -40 * cell.ox * dt;
        cell.vy += -40 * cell.oy * dt;
        const damp = Math.exp(-7 * dt);
        cell.vx *= damp;
        cell.vy *= damp;
        cell.ox = Math.max(-45, Math.min(45, cell.ox + cell.vx * dt));
        cell.oy = Math.max(-45, Math.min(45, cell.oy + cell.vy * dt));
        maybeSwitchFate(cell);
    }

    function step(cell, dt) {
        // ~33 seconds from the hilltop to the bottom; a little quicker while hovered
        cell.v += 0.03 * (1 + 0.8 * focus) * dt;
        if (cell.v > 1.02) Object.assign(cell, newCell(0));
        if (cell.x !== null) nudge(cell, dt);
        place(cell);
    }

    function drawCells() {
        ctx.clearRect(0, 0, W, H);
        ctx.drawImage(layer, 0, 0, W, H);
        if (reduceMotion) return; // static landscape only
        drawSpotlight();
        ctx.fillStyle = ctx.strokeStyle = cellColor;
        ctx.lineWidth = 1.5;
        cells.forEach(({ x, y, r, v, angle, near }) => {
            const fade = smooth(0, 0.06, v) * (1 - smooth(0.94, 1.02, v));
            const cy = y - r;
            if (near > 0.01) {
                // Soft halo around cells close to the cursor
                const halo = ctx.createRadialGradient(x, cy, r * 0.5, x, cy, r * 2.6);
                halo.addColorStop(0, cellColor);
                halo.addColorStop(1, 'transparent');
                ctx.globalAlpha = 0.35 * near * fade;
                ctx.fillStyle = halo;
                ctx.beginPath();
                ctx.arc(x, cy, r * 2.6, 0, Math.PI * 2);
                ctx.fill();
                ctx.fillStyle = cellColor;
            }
            ctx.globalAlpha = (0.3 + 0.25 * near) * fade;
            ctx.beginPath();
            ctx.arc(x, cy, r, 0, Math.PI * 2);
            ctx.fill();
            ctx.globalAlpha = (0.75 + 0.25 * near) * fade;
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
        [canvas, layer, glowLayer, spot].forEach(c => { c.width = W * dpr; c.height = H * dpr; });
        ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
        cells.forEach(cell => { cell.x = null; place(cell); });
        drawLandscape();
        drawCells();
    }

    let last = performance.now();
    function frame(now) {
        const dt = Math.min(0.05, (now - last) / 1000);
        last = now;
        focus += ((pointer.inside ? 1 : 0) - focus) * Math.min(1, dt * 4);
        const follow = Math.min(1, dt * 12);
        pointer.sx += (pointer.x - pointer.sx) * follow;
        pointer.sy += (pointer.y - pointer.sy) * follow;
        cells.forEach(cell => step(cell, dt));
        drawCells();
        requestAnimationFrame(frame);
    }

    // The canvas sits behind the page, so track the cursor on the window instead
    window.addEventListener('pointermove', e => {
        const rect = canvas.getBoundingClientRect();
        const x = e.clientX - rect.left;
        const y = e.clientY - rect.top;
        if (!pointer.inside) { pointer.sx = x; pointer.sy = y; }
        Object.assign(pointer, { x, y, inside: x >= 0 && y >= 0 && x <= rect.width && y <= rect.height });
    }, { passive: true });
    document.addEventListener('pointerout', e => { if (!e.relatedTarget) pointer.inside = false; });

    window.addEventListener('resize', resize);
    // Redraw in the new colours when the theme changes
    new MutationObserver(() => { drawLandscape(); drawCells(); })
        .observe(document.documentElement, { attributes: true, attributeFilter: ['data-theme'] });

    resize();
    if (!reduceMotion) requestAnimationFrame(frame);
})();

// Doodles and DNA helices perk up and shy away when the cursor comes close.
// They sit behind the page, so proximity is measured from the window's pointer events.
(() => {
    if (matchMedia('(prefers-reduced-motion: reduce)').matches) return;
    const pokeables = [...document.querySelectorAll('.doodle, .helix')];
    let centres = [];
    let px = 0, py = 0, queued = false;

    function measure() {
        pokeables.forEach(el => { el.style.removeProperty('--dx'); el.style.removeProperty('--dy'); });
        centres = pokeables.map(el => {
            const r = el.getBoundingClientRect();
            return { x: r.left + r.width / 2, y: r.top + r.height / 2, reach: Math.max(r.width, r.height) / 2 + 45, visible: r.width > 0 };
        });
    }

    function poke() {
        queued = false;
        pokeables.forEach((el, i) => {
            const c = centres[i];
            const dx = c.x - px;
            const dy = c.y - py;
            const d = Math.hypot(dx, dy) || 1;
            const near = c.visible && d < c.reach;
            el.classList.toggle('poked', near);
            const push = near ? (1 - d / c.reach) * 24 : 0;
            el.style.setProperty('--dx', `${(dx / d) * push}px`);
            el.style.setProperty('--dy', `${(dy / d) * push}px`);
        });
    }

    window.addEventListener('pointermove', e => {
        px = e.clientX;
        py = e.clientY;
        if (!queued) { queued = true; requestAnimationFrame(poke); }
    }, { passive: true });
    document.addEventListener('pointerout', e => {
        if (!e.relatedTarget) { px = py = -9999; poke(); }
    });
    window.addEventListener('resize', measure);
    measure();
})();
