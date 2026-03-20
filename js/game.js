// ============================================================
//  BAR MASTER — Mobile Bartender Simulation (Anime Style)
// ============================================================

const canvas = document.getElementById('gameCanvas');
const ctx = canvas.getContext('2d');
const mixCanvas = document.getElementById('mixingCanvas');
const mixCtx = mixCanvas.getContext('2d');

function resizeCanvas() {
    const dpr = window.devicePixelRatio || 1;
    canvas.width = window.innerWidth * dpr;
    canvas.height = window.innerHeight * dpr;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
}
resizeCanvas();
window.addEventListener('resize', resizeCanvas);

const W = () => window.innerWidth;
const H = () => window.innerHeight;

// ============================================================
//  MOTION SENSOR SYSTEM
// ============================================================
const motion = {
    enabled: false,
    ax: 0, ay: 0, az: 0,
    alpha: 0, beta: 0, gamma: 0,
    shakeIntensity: 0,
    tiltAngle: 0,
    rotationRate: 0,
    smoothShake: 0,
    smoothTilt: 0,
    smoothRotation: 0,
    lastMagnitude: 0,
};

function handleMotion(e) {
    const acc = e.accelerationIncludingGravity || e.acceleration;
    if (!acc) return;
    motion.ax = acc.x || 0;
    motion.ay = acc.y || 0;
    motion.az = acc.z || 0;
    const mag = Math.sqrt(motion.ax ** 2 + motion.ay ** 2 + motion.az ** 2);
    motion.shakeIntensity = Math.abs(mag - motion.lastMagnitude);
    motion.lastMagnitude = mag;
    if (e.rotationRate) {
        const rr = e.rotationRate;
        motion.rotationRate = Math.sqrt((rr.alpha||0)**2 + (rr.beta||0)**2 + (rr.gamma||0)**2);
    }
}

function handleOrientation(e) {
    motion.alpha = e.alpha || 0;
    motion.beta = e.beta || 0;
    motion.gamma = e.gamma || 0;
    motion.tiltAngle = Math.abs(motion.gamma);
}

async function requestMotionPermission() {
    if (typeof DeviceMotionEvent !== 'undefined' && typeof DeviceMotionEvent.requestPermission === 'function') {
        try {
            const perm = await DeviceMotionEvent.requestPermission();
            if (perm === 'granted') { enableMotion(); return true; }
        } catch (e) { console.warn('Motion denied:', e); }
        return false;
    } else if (typeof DeviceMotionEvent !== 'undefined') {
        enableMotion(); return true;
    }
    return false;
}

function enableMotion() {
    motion.enabled = true;
    window.addEventListener('devicemotion', handleMotion, true);
    window.addEventListener('deviceorientation', handleOrientation, true);
}

// Touch fallback
let lastTouchY = 0;
let lastTouchX = 0;
let touchShakeAccum = 0;

document.addEventListener('touchstart', (e) => {
    if (game.state !== 'mixing') return;
    lastTouchY = e.touches[0].clientY;
    lastTouchX = e.touches[0].clientX;
}, { passive: true });

document.addEventListener('touchmove', (e) => {
    if (game.state !== 'mixing') return;
    const y = e.touches[0].clientY;
    const x = e.touches[0].clientX;
    const dy = Math.abs(y - lastTouchY);
    const dx = Math.abs(x - lastTouchX);
    if (game.mixingType === 'shake') {
        touchShakeAccum += dy * 0.15;
    } else if (game.mixingType === 'stir') {
        touchShakeAccum += (dy + dx) * 0.08;
    } else if (game.mixingType === 'layer') {
        motion.tiltAngle = (y / H()) * 45;
        touchShakeAccum += dy * 0.03;
    }
    lastTouchY = y;
    lastTouchX = x;
}, { passive: true });

// ============================================================
//  INGREDIENTS DATABASE
// ============================================================
const INGREDIENTS = {
    // Spirits
    vodka:      { name: 'Vodka',       cat: 'spirits',  icon: '🍸', color: '#e0e0e0', bg: 'rgba(200,200,220,0.15)', border: 'rgba(200,200,220,0.3)' },
    tequila:    { name: 'Tequila',     cat: 'spirits',  icon: '🌵', color: '#f5f0c0', bg: 'rgba(245,240,192,0.15)', border: 'rgba(245,240,192,0.3)' },
    rum:        { name: 'Rum',         cat: 'spirits',  icon: '🏴‍☠️', color: '#c8721a', bg: 'rgba(200,114,26,0.15)',  border: 'rgba(200,114,26,0.3)' },
    gin:        { name: 'Gin',         cat: 'spirits',  icon: '🫒', color: '#d4edda', bg: 'rgba(212,237,218,0.15)', border: 'rgba(212,237,218,0.3)' },
    whiskey:    { name: 'Whiskey',     cat: 'spirits',  icon: '🥃', color: '#c8721a', bg: 'rgba(200,114,26,0.15)',  border: 'rgba(200,114,26,0.3)' },
    brandy:     { name: 'Brandy',      cat: 'spirits',  icon: '🍷', color: '#d4882a', bg: 'rgba(212,136,42,0.15)', border: 'rgba(212,136,42,0.3)' },
    // Liqueurs
    triple_sec: { name: 'Triple Sec',  cat: 'liqueurs', icon: '🍊', color: '#ffa500', bg: 'rgba(255,165,0,0.15)',  border: 'rgba(255,165,0,0.3)' },
    kahlua:     { name: 'Kahlua',      cat: 'liqueurs', icon: '☕', color: '#3e1f0d', bg: 'rgba(62,31,13,0.3)',    border: 'rgba(62,31,13,0.5)' },
    baileys:    { name: 'Baileys',     cat: 'liqueurs', icon: '🥛', color: '#d4a76a', bg: 'rgba(212,167,106,0.15)', border: 'rgba(212,167,106,0.3)' },
    grand_m:    { name: 'Grand Marnier', cat: 'liqueurs', icon: '🟠', color: '#e8851a', bg: 'rgba(232,133,26,0.15)', border: 'rgba(232,133,26,0.3)' },
    creme_m:    { name: 'Cr. de Menthe', cat: 'liqueurs', icon: '🟢', color: '#44cc88', bg: 'rgba(68,204,136,0.15)', border: 'rgba(68,204,136,0.3)' },
    // Mixers
    lime_j:     { name: 'Lime Juice',  cat: 'mixers',   icon: '🍋', color: '#a8e06c', bg: 'rgba(168,224,108,0.15)', border: 'rgba(168,224,108,0.3)' },
    orange_j:   { name: 'Orange Juice', cat: 'mixers',  icon: '🍊', color: '#ffa500', bg: 'rgba(255,165,0,0.15)',  border: 'rgba(255,165,0,0.3)' },
    tomato_j:   { name: 'Tomato Juice', cat: 'mixers',  icon: '🍅', color: '#cc3333', bg: 'rgba(204,51,51,0.15)',  border: 'rgba(204,51,51,0.3)' },
    cranberry_j:{ name: 'Cranberry',   cat: 'mixers',   icon: '🫐', color: '#cc3366', bg: 'rgba(204,51,102,0.15)', border: 'rgba(204,51,102,0.3)' },
    soda:       { name: 'Soda Water',  cat: 'mixers',   icon: '💧', color: '#c0e8ff', bg: 'rgba(192,232,255,0.15)', border: 'rgba(192,232,255,0.3)' },
    tonic:      { name: 'Tonic Water', cat: 'mixers',   icon: '🫧', color: '#d0f0ff', bg: 'rgba(208,240,255,0.15)', border: 'rgba(208,240,255,0.3)' },
    // Extras
    grenadine:  { name: 'Grenadine',   cat: 'extras',   icon: '🔴', color: '#cc1100', bg: 'rgba(204,17,0,0.15)',   border: 'rgba(204,17,0,0.3)' },
    bitters:    { name: 'Bitters',     cat: 'extras',   icon: '💛', color: '#c8721a', bg: 'rgba(200,114,26,0.15)', border: 'rgba(200,114,26,0.3)' },
    sugar:      { name: 'Sugar',       cat: 'extras',   icon: '🍬', color: '#fff5e6', bg: 'rgba(255,245,230,0.15)', border: 'rgba(255,245,230,0.3)' },
    ice:        { name: 'Ice',         cat: 'extras',   icon: '🧊', color: '#aadcff', bg: 'rgba(170,220,255,0.15)', border: 'rgba(170,220,255,0.3)' },
};

// ============================================================
//  DRINK RECIPES
// ============================================================
const DRINKS = [
    {
        id: 'margarita', name: 'Margarita', price: 12, method: 'shake',
        ingredients: ['tequila', 'triple_sec', 'lime_j'],
        color: '#a8e06c', difficulty: 1, targetShakes: 60,
    },
    {
        id: 'bloody_mary', name: 'Bloody Mary', price: 10, method: 'shake',
        ingredients: ['vodka', 'tomato_j', 'bitters'],
        color: '#cc3333', difficulty: 1, targetShakes: 50,
    },
    {
        id: 'cosmopolitan', name: 'Cosmopolitan', price: 13, method: 'shake',
        ingredients: ['vodka', 'triple_sec', 'cranberry_j', 'lime_j'],
        color: '#ff6b9d', difficulty: 2, targetShakes: 70,
    },
    {
        id: 'daiquiri', name: 'Daiquiri', price: 11, method: 'shake',
        ingredients: ['rum', 'lime_j', 'sugar'],
        color: '#f0e68c', difficulty: 2, targetShakes: 55,
    },
    {
        id: 'b52', name: 'B-52', price: 14, method: 'layer',
        ingredients: ['kahlua', 'baileys', 'grand_m'],
        layers: [
            { name: 'Kahlua', color: '#3e1f0d' },
            { name: 'Baileys', color: '#d4a76a' },
            { name: 'Grand Marnier', color: '#e8851a' },
        ],
        color: '#d4a76a', difficulty: 3,
    },
    {
        id: 'tequila_sunrise', name: 'Tequila Sunrise', price: 11, method: 'layer',
        ingredients: ['tequila', 'orange_j', 'grenadine'],
        layers: [
            { name: 'Grenadine', color: '#cc1100' },
            { name: 'Orange Juice', color: '#ffa500' },
            { name: 'Tequila', color: '#f5f0d0' },
        ],
        color: '#ffa500', difficulty: 2,
    },
    {
        id: 'pousse_cafe', name: 'Pousse Cafe', price: 16, method: 'layer',
        ingredients: ['grenadine', 'creme_m', 'brandy'],
        layers: [
            { name: 'Grenadine', color: '#cc1100' },
            { name: 'Creme de Menthe', color: '#44cc88' },
            { name: 'Brandy', color: '#d4882a' },
        ],
        color: '#44cc88', difficulty: 3,
    },
    {
        id: 'highball', name: 'Highball', price: 8, method: 'stir',
        ingredients: ['whiskey', 'soda', 'ice'],
        color: '#daa520', difficulty: 1, targetStirs: 40,
    },
    {
        id: 'gin_tonic', name: 'Gin & Tonic', price: 9, method: 'stir',
        ingredients: ['gin', 'tonic', 'lime_j'],
        color: '#d4edda', difficulty: 1, targetStirs: 35,
    },
    {
        id: 'old_fashioned', name: 'Old Fashioned', price: 13, method: 'stir',
        ingredients: ['whiskey', 'bitters', 'sugar', 'ice'],
        color: '#c8721a', difficulty: 2, targetStirs: 55,
    },
];

// ============================================================
//  ANIME CHARACTER SYSTEM
// ============================================================
const HAIR_COLORS = ['#2c1810', '#8b4513', '#d4a76a', '#1a1a2e', '#cc3344', '#4488cc', '#cc88dd', '#44bb88', '#ff8844', '#eeeecc'];
const EYE_COLORS = ['#3366cc', '#44aa55', '#8b4513', '#6633aa', '#cc3344', '#e8851a'];
const SKIN_TONES = ['#ffe0c0', '#f5cba7', '#deb887', '#c68642', '#8d5524', '#f0d5b8'];
const SHIRT_COLORS = ['#3498db', '#e74c3c', '#9b59b6', '#27ae60', '#f39c12', '#1abc9c', '#e67e22', '#2c3e50', '#e84393', '#6c5ce7'];
const HAIR_STYLES = ['short', 'long', 'spiky', 'bob', 'ponytail', 'twintails'];

function generateCharacter() {
    return {
        skin: SKIN_TONES[Math.floor(Math.random() * SKIN_TONES.length)],
        hair: HAIR_COLORS[Math.floor(Math.random() * HAIR_COLORS.length)],
        eyes: EYE_COLORS[Math.floor(Math.random() * EYE_COLORS.length)],
        shirt: SHIRT_COLORS[Math.floor(Math.random() * SHIRT_COLORS.length)],
        hairStyle: HAIR_STYLES[Math.floor(Math.random() * HAIR_STYLES.length)],
        blush: Math.random() > 0.4,
        accessories: Math.random() > 0.6 ? 'glasses' : null,
    };
}

function drawAnimeCharacter(x, y, char, scale, happiness, frame) {
    const s = scale;
    const bob = Math.sin(frame * 0.035) * 2 * s;
    const cy = y + bob;

    ctx.save();
    ctx.translate(x, cy);

    // ---- Body / Shirt ----
    ctx.fillStyle = char.shirt;
    roundRect(-20*s, 32*s, 40*s, 36*s, 6*s);
    // Collar
    ctx.fillStyle = darkenColor(char.shirt, 0.8);
    ctx.beginPath();
    ctx.moveTo(-8*s, 32*s);
    ctx.lineTo(0, 40*s);
    ctx.lineTo(8*s, 32*s);
    ctx.fill();
    // Shoulders
    ctx.fillStyle = char.shirt;
    roundRect(-28*s, 36*s, 12*s, 20*s, 4*s);
    roundRect(16*s, 36*s, 12*s, 20*s, 4*s);

    // ---- Neck ----
    ctx.fillStyle = char.skin;
    roundRect(-5*s, 26*s, 10*s, 10*s, 2*s);

    // ---- Head (smooth oval) ----
    ctx.fillStyle = char.skin;
    ctx.beginPath();
    ctx.ellipse(0, 4*s, 24*s, 28*s, 0, 0, Math.PI * 2);
    ctx.fill();

    // ---- Hair ----
    drawHair(char, s);

    // ---- Eyes (big anime style) ----
    drawAnimeEyes(-9*s, -2*s, s, char.eyes, happiness, frame);
    drawAnimeEyes(9*s, -2*s, s, char.eyes, happiness, frame);

    // ---- Blush ----
    if (char.blush) {
        ctx.fillStyle = 'rgba(255, 130, 130, 0.25)';
        ctx.beginPath();
        ctx.ellipse(-14*s, 8*s, 6*s, 3*s, 0, 0, Math.PI * 2);
        ctx.fill();
        ctx.beginPath();
        ctx.ellipse(14*s, 8*s, 6*s, 3*s, 0, 0, Math.PI * 2);
        ctx.fill();
    }

    // ---- Nose ----
    ctx.fillStyle = darkenColor(char.skin, 0.9);
    ctx.beginPath();
    ctx.ellipse(0, 6*s, 2*s, 1.5*s, 0, 0, Math.PI * 2);
    ctx.fill();

    // ---- Mouth ----
    drawMouth(0, 13*s, s, happiness);

    // ---- Glasses ----
    if (char.accessories === 'glasses') {
        ctx.strokeStyle = '#555';
        ctx.lineWidth = 1.5 * s;
        ctx.beginPath();
        ctx.arc(-9*s, -1*s, 7*s, 0, Math.PI * 2);
        ctx.stroke();
        ctx.beginPath();
        ctx.arc(9*s, -1*s, 7*s, 0, Math.PI * 2);
        ctx.stroke();
        ctx.beginPath();
        ctx.moveTo(-2*s, -1*s);
        ctx.lineTo(2*s, -1*s);
        ctx.stroke();
    }

    ctx.restore();
}

function drawHair(char, s) {
    ctx.fillStyle = char.hair;
    const style = char.hairStyle;

    if (style === 'short') {
        ctx.beginPath();
        ctx.ellipse(0, -10*s, 26*s, 22*s, 0, Math.PI, Math.PI * 2);
        ctx.fill();
        // Side hair
        roundRect(-26*s, -12*s, 8*s, 18*s, 4*s);
        roundRect(18*s, -12*s, 8*s, 18*s, 4*s);
    } else if (style === 'long') {
        ctx.beginPath();
        ctx.ellipse(0, -10*s, 27*s, 22*s, 0, Math.PI, Math.PI * 2);
        ctx.fill();
        // Long sides flowing down
        roundRect(-27*s, -12*s, 10*s, 48*s, 5*s);
        roundRect(17*s, -12*s, 10*s, 48*s, 5*s);
        // Bangs
        ctx.fillStyle = darkenColor(char.hair, 0.85);
        ctx.beginPath();
        ctx.ellipse(0, -18*s, 20*s, 10*s, 0, 0, Math.PI);
        ctx.fill();
    } else if (style === 'spiky') {
        ctx.beginPath();
        ctx.ellipse(0, -10*s, 26*s, 22*s, 0, Math.PI, Math.PI * 2);
        ctx.fill();
        // Spikes
        const spikes = [[-18,-30],[-8,-36],[4,-34],[14,-30],[22,-24],[-24,-20]];
        spikes.forEach(([sx, sy]) => {
            ctx.beginPath();
            ctx.moveTo(sx*s-4*s, -10*s);
            ctx.lineTo(sx*s, sy*s);
            ctx.lineTo(sx*s+4*s, -10*s);
            ctx.fill();
        });
    } else if (style === 'bob') {
        ctx.beginPath();
        ctx.ellipse(0, -8*s, 28*s, 24*s, 0, Math.PI * 0.85, Math.PI * 2.15);
        ctx.fill();
        roundRect(-28*s, -10*s, 8*s, 28*s, 4*s);
        roundRect(20*s, -10*s, 8*s, 28*s, 4*s);
        // Bangs
        ctx.fillStyle = darkenColor(char.hair, 0.9);
        roundRect(-16*s, -22*s, 32*s, 12*s, 4*s);
    } else if (style === 'ponytail') {
        ctx.beginPath();
        ctx.ellipse(0, -10*s, 26*s, 22*s, 0, Math.PI, Math.PI * 2);
        ctx.fill();
        // Ponytail behind
        roundRect(10*s, -20*s, 14*s, 8*s, 3*s);
        roundRect(18*s, -16*s, 10*s, 40*s, 5*s);
        // Band
        ctx.fillStyle = '#e74c3c';
        roundRect(20*s, -14*s, 6*s, 4*s, 2*s);
    } else if (style === 'twintails') {
        ctx.beginPath();
        ctx.ellipse(0, -10*s, 26*s, 22*s, 0, Math.PI, Math.PI * 2);
        ctx.fill();
        // Twin tails
        roundRect(-30*s, -8*s, 10*s, 40*s, 5*s);
        roundRect(20*s, -8*s, 10*s, 40*s, 5*s);
        // Bands
        ctx.fillStyle = '#ff6b9d';
        roundRect(-28*s, -6*s, 6*s, 4*s, 2*s);
        roundRect(22*s, -6*s, 6*s, 4*s, 2*s);
        // Bangs
        ctx.fillStyle = char.hair;
        roundRect(-14*s, -22*s, 28*s, 10*s, 3*s);
    }
}

function drawAnimeEyes(ex, ey, s, eyeColor, happiness, frame) {
    // Blink every ~4 seconds
    const blinkCycle = (frame % 240);
    const isBlinking = blinkCycle > 235;

    if (isBlinking) {
        // Closed eye - line
        ctx.strokeStyle = '#333';
        ctx.lineWidth = 1.5 * s;
        ctx.beginPath();
        ctx.moveTo(ex - 5*s, ey);
        ctx.quadraticCurveTo(ex, ey + 2*s, ex + 5*s, ey);
        ctx.stroke();
        return;
    }

    const eyeH = happiness > 0.5 ? 8 : happiness > 0.25 ? 7 : 6;

    // White
    ctx.fillStyle = '#fff';
    ctx.beginPath();
    ctx.ellipse(ex, ey, 6*s, eyeH*s * 0.5, 0, 0, Math.PI * 2);
    ctx.fill();

    // Iris
    ctx.fillStyle = eyeColor;
    ctx.beginPath();
    ctx.ellipse(ex, ey + 0.5*s, 4.5*s, (eyeH-2)*s * 0.5, 0, 0, Math.PI * 2);
    ctx.fill();

    // Pupil
    ctx.fillStyle = '#1a1a2e';
    ctx.beginPath();
    ctx.ellipse(ex, ey + 1*s, 2.5*s, 3*s * 0.5, 0, 0, Math.PI * 2);
    ctx.fill();

    // Highlight (anime sparkle)
    ctx.fillStyle = '#fff';
    ctx.beginPath();
    ctx.ellipse(ex - 2*s, ey - 1.5*s, 1.8*s, 1.8*s, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.beginPath();
    ctx.ellipse(ex + 1.5*s, ey + 1*s, 0.8*s, 0.8*s, 0, 0, Math.PI * 2);
    ctx.fill();

    // Upper eyelid line
    ctx.strokeStyle = '#333';
    ctx.lineWidth = 1.8 * s;
    ctx.beginPath();
    ctx.ellipse(ex, ey - 1*s, 6.5*s, 4*s, 0, Math.PI + 0.3, -0.3);
    ctx.stroke();

    // Eyelash
    ctx.lineWidth = 1.2 * s;
    ctx.beginPath();
    ctx.moveTo(ex + 5.5*s, ey - 2.5*s);
    ctx.lineTo(ex + 7*s, ey - 4.5*s);
    ctx.stroke();
}

function drawMouth(mx, my, s, happiness) {
    ctx.strokeStyle = '#a0522d';
    ctx.lineWidth = 1.5 * s;
    ctx.lineCap = 'round';

    if (happiness > 0.7) {
        // Big smile
        ctx.beginPath();
        ctx.arc(mx, my - 2*s, 6*s, 0.2, Math.PI - 0.2);
        ctx.stroke();
        // Open smile - show a little "mouth"
        ctx.fillStyle = '#c0392b';
        ctx.beginPath();
        ctx.arc(mx, my - 1*s, 4*s, 0.1, Math.PI - 0.1);
        ctx.fill();
    } else if (happiness > 0.4) {
        // Small smile
        ctx.beginPath();
        ctx.arc(mx, my - 2*s, 4*s, 0.3, Math.PI - 0.3);
        ctx.stroke();
    } else if (happiness > 0.2) {
        // Neutral
        ctx.beginPath();
        ctx.moveTo(mx - 4*s, my);
        ctx.lineTo(mx + 4*s, my);
        ctx.stroke();
    } else {
        // Frown
        ctx.beginPath();
        ctx.arc(mx, my + 5*s, 5*s, Math.PI + 0.4, -0.4);
        ctx.stroke();
    }
    ctx.lineCap = 'butt';
}

// ============================================================
//  DRAWING HELPERS
// ============================================================
function roundRect(x, y, w, h, r) {
    ctx.beginPath();
    ctx.moveTo(x + r, y);
    ctx.lineTo(x + w - r, y);
    ctx.quadraticCurveTo(x + w, y, x + w, y + r);
    ctx.lineTo(x + w, y + h - r);
    ctx.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
    ctx.lineTo(x + r, y + h);
    ctx.quadraticCurveTo(x, y + h, x, y + h - r);
    ctx.lineTo(x, y + r);
    ctx.quadraticCurveTo(x, y, x + r, y);
    ctx.fill();
}

function darkenColor(hex, factor) {
    const r = parseInt(hex.slice(1,3),16);
    const g = parseInt(hex.slice(3,5),16);
    const b = parseInt(hex.slice(5,7),16);
    return `rgb(${Math.floor(r*factor)},${Math.floor(g*factor)},${Math.floor(b*factor)})`;
}

function lightenColor(hex, factor) {
    const r = parseInt(hex.slice(1,3),16);
    const g = parseInt(hex.slice(3,5),16);
    const b = parseInt(hex.slice(5,7),16);
    return `rgb(${Math.min(255,Math.floor(r*factor))},${Math.min(255,Math.floor(g*factor))},${Math.min(255,Math.floor(b*factor))})`;
}

// ============================================================
//  CUSTOMER CLASS
// ============================================================
class Customer {
    constructor(slot) {
        this.slot = slot;
        this.char = generateCharacter();
        this.drink = null;
        this.patience = 1.0;
        this.maxPatience = 900 + Math.random() * 400;
        this.patienceTimer = 0;
        this.state = 'entering';
        this.enterProgress = 0;
        this.servedTimer = 0;
        this.frame = Math.floor(Math.random() * 1000);
        this.selected = false;
    }

    assignDrink(available) {
        this.drink = available[Math.floor(Math.random() * available.length)];
    }

    update() {
        this.frame++;
        if (this.state === 'entering') {
            this.enterProgress += 0.04;
            if (this.enterProgress >= 1) { this.enterProgress = 1; this.state = 'waiting'; }
        }
        if (this.state === 'waiting') {
            this.patienceTimer++;
            this.patience = Math.max(0, 1 - this.patienceTimer / this.maxPatience);
            if (this.patience <= 0) this.state = 'leaving';
        }
        if (this.state === 'served') this.servedTimer++;
        if (this.state === 'leaving') this.enterProgress -= 0.03;
    }

    isGone() {
        return (this.state === 'leaving' && this.enterProgress < -0.5) ||
               (this.state === 'served' && this.servedTimer > 80);
    }

    getX() {
        const w = W();
        const slotW = w / game.maxCustomers;
        return slotW * this.slot + slotW / 2;
    }

    getY() {
        const barY = H() * 0.38;
        return (barY - 110) + (1 - this.enterProgress) * (H() * 0.18);
    }
}

// ============================================================
//  GAME STATE
// ============================================================
const game = {
    state: 'menu',
    money: 0, totalServed: 0, shift: 1,
    shiftMoney: 0, shiftServed: 0, shiftTarget: 6,
    customers: [], maxCustomers: 3,
    spawnTimer: 0, spawnInterval: 260, customersSpawned: 0,
    activeCustomer: null, activeDrink: null,
    // Ingredient selection
    selectedIngredients: [],
    activeCategory: 'spirits',
    // Mixing
    mixingType: null, mixingProgress: 0, mixingTimer: 0,
    mixingMaxTime: 600, mixingComplete: false,
    currentLayer: 0, layerProgress: [], layerSteadiness: [],
    _perfectTimer: undefined,
    // Animation
    frame: 0, floatingTexts: [],
    availableDrinks: [],
};

// ============================================================
//  FLOATING TEXT
// ============================================================
class FloatingText {
    constructor(x, y, text, color, size = 16) {
        this.x = x; this.y = y; this.text = text;
        this.color = color; this.size = size; this.life = 60;
    }
    update() { this.y -= 1.2; this.life--; }
    draw() {
        ctx.globalAlpha = Math.max(0, this.life / 60);
        ctx.font = `800 ${this.size}px Nunito, sans-serif`;
        ctx.fillStyle = this.color;
        ctx.textAlign = 'center';
        ctx.fillText(this.text, this.x, this.y);
        ctx.globalAlpha = 1;
        ctx.textAlign = 'left';
    }
}

// ============================================================
//  DRAW BAR SCENE (anime/modern style)
// ============================================================
function drawBarScene() {
    const w = W(), h = H();

    // ---- Background gradient (warm bar atmosphere) ----
    const bgGrad = ctx.createLinearGradient(0, 0, 0, h * 0.45);
    bgGrad.addColorStop(0, '#1a0f28');
    bgGrad.addColorStop(0.5, '#2a1840');
    bgGrad.addColorStop(1, '#1e1230');
    ctx.fillStyle = bgGrad;
    ctx.fillRect(0, 0, w, h * 0.45);

    // ---- Warm hanging lights ----
    for (let i = 0; i < 5; i++) {
        const lx = w * 0.1 + i * (w * 0.2);
        const ly = h * 0.04;
        const flicker = 0.75 + Math.sin(game.frame * 0.04 + i * 1.7) * 0.25;
        // Wire
        ctx.strokeStyle = '#444';
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.moveTo(lx, 0);
        ctx.lineTo(lx, ly + 8);
        ctx.stroke();
        // Glow
        const glowGrad = ctx.createRadialGradient(lx, ly + 12, 0, lx, ly + 12, 70 * flicker);
        glowGrad.addColorStop(0, `rgba(255, 180, 80, ${0.12 * flicker})`);
        glowGrad.addColorStop(1, 'rgba(255, 180, 80, 0)');
        ctx.fillStyle = glowGrad;
        ctx.beginPath();
        ctx.arc(lx, ly + 12, 70 * flicker, 0, Math.PI * 2);
        ctx.fill();
        // Bulb
        ctx.fillStyle = `rgba(255, 210, 120, ${0.9 * flicker})`;
        ctx.beginPath();
        ctx.arc(lx, ly + 10, 4, 0, Math.PI * 2);
        ctx.fill();
    }

    // ---- Back wall with subtle pattern ----
    ctx.fillStyle = '#221838';
    ctx.fillRect(0, h * 0.12, w, h * 0.28);

    // Decorative shelf
    const shelfY = h * 0.2;
    ctx.fillStyle = '#3d2b55';
    ctx.fillRect(0, shelfY, w, 3);
    ctx.fillRect(0, shelfY + 45, w, 3);

    // Bottles on shelf
    const bottleColors = ['#cc3333','#33aa55','#3366cc','#cc9933','#aa33aa','#33cccc','#e85d04','#6c5ce7','#ff6b9d'];
    for (let i = 0; i < 8; i++) {
        const bx = w * 0.06 + i * (w * 0.12);
        drawBottle(bx, shelfY + 8, bottleColors[i % bottleColors.length], 14, 34);
    }

    // ---- Bar counter ----
    const barY = h * 0.40;
    const barH = h * 0.06;

    // Counter surface with wood grain
    const counterGrad = ctx.createLinearGradient(0, barY, 0, barY + barH);
    counterGrad.addColorStop(0, '#8d6e55');
    counterGrad.addColorStop(0.15, '#a08070');
    counterGrad.addColorStop(0.5, '#8d6e55');
    counterGrad.addColorStop(1, '#6d4e3d');
    ctx.fillStyle = counterGrad;
    ctx.fillRect(0, barY, w, barH);

    // Highlight edge
    ctx.fillStyle = 'rgba(255,255,255,0.12)';
    ctx.fillRect(0, barY, w, 2);

    // ---- Floor ----
    const floorGrad = ctx.createLinearGradient(0, barY + barH, 0, h);
    floorGrad.addColorStop(0, '#161224');
    floorGrad.addColorStop(1, '#0d0a14');
    ctx.fillStyle = floorGrad;
    ctx.fillRect(0, barY + barH, w, h - barY - barH);
}

function drawBottle(x, y, color, bw, bh) {
    // Shadow
    ctx.fillStyle = 'rgba(0,0,0,0.2)';
    ctx.beginPath();
    ctx.ellipse(x + bw/2, y + bh + 2, bw * 0.6, 3, 0, 0, Math.PI * 2);
    ctx.fill();
    // Body
    ctx.fillStyle = color;
    roundRect(x, y + bh * 0.3, bw, bh * 0.7, 3);
    // Neck
    ctx.fillStyle = color;
    roundRect(x + bw*0.2, y, bw*0.6, bh*0.35, 2);
    // Label
    ctx.fillStyle = 'rgba(255,255,255,0.2)';
    roundRect(x + 2, y + bh*0.45, bw - 4, bh*0.25, 2);
    // Highlight
    ctx.fillStyle = 'rgba(255,255,255,0.15)';
    ctx.fillRect(x + 2, y + bh*0.3, 3, bh*0.55);
}

// ============================================================
//  DRAW CUSTOMERS & ORDER BUBBLES
// ============================================================
function drawCustomer(customer) {
    const cx = customer.getX();
    const cy = customer.getY();
    const w = W();
    const scale = Math.min(1, (w / game.maxCustomers) / 140);

    ctx.save();
    ctx.globalAlpha = customer.state === 'served' ? Math.max(0, 1 - customer.servedTimer / 60) : 1;

    drawAnimeCharacter(cx, cy, customer.char, scale, customer.patience, customer.frame);

    // Selection ring
    if (customer.selected && customer.state === 'waiting') {
        ctx.strokeStyle = '#ffd166';
        ctx.lineWidth = 2;
        ctx.setLineDash([4, 4]);
        ctx.beginPath();
        ctx.ellipse(cx, cy + 20 * scale, 35 * scale, 50 * scale, 0, 0, Math.PI * 2);
        ctx.stroke();
        ctx.setLineDash([]);
    }

    ctx.globalAlpha = 1;
    ctx.restore();

    // Order bubble
    if ((customer.state === 'waiting' || customer.state === 'entering') && customer.drink) {
        drawOrderBubble(cx, cy - 35 * scale, customer);
    }

    // Patience bar
    if (customer.state === 'waiting') {
        const bw = 40 * scale;
        const bx = cx - bw / 2;
        const by = cy + 42 * scale;
        // Background
        ctx.fillStyle = 'rgba(0,0,0,0.4)';
        roundRectSimple(bx, by, bw, 5, 2.5);
        // Fill
        const pColor = customer.patience > 0.5 ? '#06d6a0' : customer.patience > 0.25 ? '#ffd166' : '#e85d04';
        ctx.fillStyle = pColor;
        roundRectSimple(bx, by, bw * customer.patience, 5, 2.5);
    }

    // Served animation
    if (customer.state === 'served') {
        ctx.globalAlpha = Math.max(0, 1 - customer.servedTimer / 50);
        ctx.font = '800 16px Nunito, sans-serif';
        ctx.fillStyle = '#06d6a0';
        ctx.textAlign = 'center';
        ctx.fillText('Thank you!', cx, cy - 50 * scale - customer.servedTimer * 0.5);
        ctx.globalAlpha = 1;
        ctx.textAlign = 'left';
    }
}

function roundRectSimple(x, y, w, h, r) {
    if (w <= 0) return;
    ctx.beginPath();
    ctx.moveTo(x + r, y);
    ctx.lineTo(x + w - r, y);
    ctx.quadraticCurveTo(x + w, y, x + w, y + r);
    ctx.lineTo(x + w, y + h - r);
    ctx.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
    ctx.lineTo(x + r, y + h);
    ctx.quadraticCurveTo(x, y + h, x, y + h - r);
    ctx.lineTo(x, y + r);
    ctx.quadraticCurveTo(x, y, x + r, y);
    ctx.fill();
}

function drawOrderBubble(x, y, customer) {
    const drink = customer.drink;
    const w = W();
    const maxBW = (w / game.maxCustomers) * 0.95;

    // Measure content to size the bubble dynamically
    const padding = 10;
    const nameFont = '700 12px Nunito, sans-serif';
    const ingFont = '600 10px Nunito, sans-serif';
    const lineH = 16; // line height for each ingredient row
    const headerH = 26; // space for drink name + method badge

    ctx.font = nameFont;
    const nameW = ctx.measureText(drink.name).width;

    // Measure widest ingredient line
    ctx.font = ingFont;
    let maxIngW = 0;
    drink.ingredients.forEach(id => {
        const ing = INGREDIENTS[id];
        if (ing) {
            const tw = ctx.measureText(`${ing.icon} ${ing.name}`).width;
            if (tw > maxIngW) maxIngW = tw;
        }
    });

    const contentW = Math.max(nameW + 20, maxIngW + 24);
    const bw = Math.min(Math.max(contentW + padding * 2, 90), maxBW);
    const bh = headerH + drink.ingredients.length * lineH + padding + 4;
    const bx = Math.max(4, Math.min(x - bw / 2, w - bw - 4)); // clamp to screen edges
    const by = Math.max(4, y - bh - 12); // clamp so bubble doesn't go off top of screen

    // ---- Bubble background (frosted dark glass) ----
    ctx.fillStyle = 'rgba(22, 18, 40, 0.94)';
    ctx.beginPath();
    ctx.moveTo(bx + 10, by);
    ctx.lineTo(bx + bw - 10, by);
    ctx.quadraticCurveTo(bx + bw, by, bx + bw, by + 10);
    ctx.lineTo(bx + bw, by + bh - 10);
    ctx.quadraticCurveTo(bx + bw, by + bh, bx + bw - 10, by + bh);
    ctx.lineTo(bx + 10, by + bh);
    ctx.quadraticCurveTo(bx, by + bh, bx, by + bh - 10);
    ctx.lineTo(bx, by + 10);
    ctx.quadraticCurveTo(bx, by, bx + 10, by);
    ctx.fill();

    // Border
    ctx.strokeStyle = customer.selected ? 'rgba(255,209,102,0.6)' : 'rgba(255,255,255,0.1)';
    ctx.lineWidth = customer.selected ? 1.5 : 1;
    ctx.stroke();

    // ---- Pointer triangle ----
    const ptrX = Math.max(bx + 12, Math.min(x, bx + bw - 12));
    ctx.fillStyle = 'rgba(22, 18, 40, 0.94)';
    ctx.beginPath();
    ctx.moveTo(ptrX - 7, by + bh);
    ctx.lineTo(ptrX, by + bh + 8);
    ctx.lineTo(ptrX + 7, by + bh);
    ctx.fill();

    // ---- Header: color dot + drink name + method badge ----
    // Color dot
    ctx.fillStyle = drink.color || '#888';
    ctx.beginPath();
    ctx.arc(bx + padding + 6, by + 14, 5, 0, Math.PI * 2);
    ctx.fill();

    // Drink name
    ctx.font = nameFont;
    ctx.fillStyle = '#ffd166';
    ctx.textAlign = 'left';
    ctx.fillText(drink.name, bx + padding + 16, by + 18);

    // Method badge (SHAKE / LAYER / STIR)
    const methodLabel = drink.method.toUpperCase();
    ctx.font = '700 7px Nunito, sans-serif';
    const badgeW = ctx.measureText(methodLabel).width + 8;
    const badgeX = bx + bw - padding - badgeW;
    const badgeY = by + 7;
    const methodColors = { shake: '#e85d04', layer: '#3b82f6', stir: '#06d6a0' };
    ctx.fillStyle = methodColors[drink.method] || '#888';
    ctx.globalAlpha = 0.25;
    roundRectSimple(badgeX, badgeY, badgeW, 14, 4);
    ctx.globalAlpha = 1;
    ctx.fillStyle = methodColors[drink.method] || '#aaa';
    ctx.fillText(methodLabel, badgeX + 4, badgeY + 10);

    // ---- Divider line ----
    ctx.strokeStyle = 'rgba(255,255,255,0.08)';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(bx + padding, by + headerH - 2);
    ctx.lineTo(bx + bw - padding, by + headerH - 2);
    ctx.stroke();

    // ---- Ingredient list (one per line with icon + colored dot + name) ----
    ctx.font = ingFont;
    drink.ingredients.forEach((id, i) => {
        const ing = INGREDIENTS[id];
        if (!ing) return;

        const rowY = by + headerH + i * lineH + 12;

        // Small colored dot
        ctx.fillStyle = ing.color;
        ctx.beginPath();
        ctx.arc(bx + padding + 4, rowY - 3, 3, 0, Math.PI * 2);
        ctx.fill();

        // Icon + name
        ctx.fillStyle = '#ddd';
        ctx.textAlign = 'left';
        ctx.fillText(`${ing.icon} ${ing.name}`, bx + padding + 12, rowY);
    });

    ctx.textAlign = 'left';
}

// ============================================================
//  INGREDIENT PANEL LOGIC
// ============================================================
function setupIngredientPanel() {
    renderIngredientGrid('spirits');

    // Category tabs
    document.querySelectorAll('.cat-tab').forEach(tab => {
        tab.addEventListener('click', () => {
            document.querySelectorAll('.cat-tab').forEach(t => t.classList.remove('active'));
            tab.classList.add('active');
            game.activeCategory = tab.dataset.cat;
            renderIngredientGrid(tab.dataset.cat);
        });
    });

    document.getElementById('clear-btn').addEventListener('click', () => {
        game.selectedIngredients = [];
        updateSelectedDisplay();
        updateMixButton();
    });

    document.getElementById('mix-btn').addEventListener('click', () => {
        attemptMix();
    });
}

function renderIngredientGrid(category) {
    const grid = document.getElementById('ingredient-grid');
    grid.innerHTML = '';

    Object.entries(INGREDIENTS).forEach(([id, ing]) => {
        if (ing.cat !== category) return;

        const btn = document.createElement('button');
        btn.className = 'ing-btn';
        btn.style.background = ing.bg;
        btn.style.borderColor = ing.border;

        btn.innerHTML = `<span class="ing-icon">${ing.icon}</span>${ing.name}`;

        btn.addEventListener('click', () => {
            game.selectedIngredients.push(id);
            updateSelectedDisplay();
            updateMixButton();
        });

        grid.appendChild(btn);
    });
}

function updateSelectedDisplay() {
    const container = document.getElementById('selected-ingredients');
    container.innerHTML = '';

    game.selectedIngredients.forEach((id, idx) => {
        const ing = INGREDIENTS[id];
        if (!ing) return;
        const tag = document.createElement('span');
        tag.className = 'selected-tag';
        tag.style.background = ing.bg;
        tag.style.border = `1px solid ${ing.border}`;
        tag.innerHTML = `${ing.icon} ${ing.name} <span class="remove-ing" data-idx="${idx}">&times;</span>`;
        container.appendChild(tag);
    });

    // Remove ingredient on tap
    container.querySelectorAll('.remove-ing').forEach(el => {
        el.addEventListener('click', (e) => {
            const idx = parseInt(e.target.dataset.idx);
            game.selectedIngredients.splice(idx, 1);
            updateSelectedDisplay();
            updateMixButton();
        });
    });
}

function updateMixButton() {
    const mixBtn = document.getElementById('mix-btn');
    const match = findMatchingDrink(game.selectedIngredients);
    const hint = document.getElementById('recipe-hint');

    if (match) {
        mixBtn.disabled = false;
        hint.textContent = `Recipe match: ${match.name}!`;
        hint.style.color = '#06d6a0';
    } else if (game.selectedIngredients.length > 0) {
        // Check partial matches
        const partial = findPartialMatch(game.selectedIngredients);
        if (partial) {
            hint.textContent = `Could be: ${partial.name}...`;
            hint.style.color = '#ffd166';
        } else {
            hint.textContent = 'No matching recipe...';
            hint.style.color = '#e85d04';
        }
        mixBtn.disabled = false; // Allow mixing even imperfect drinks
    } else {
        mixBtn.disabled = true;
        // Show order hint if customer is selected
        const sel = game.customers.find(c => c.selected && c.state === 'waiting');
        if (sel) {
            hint.textContent = `Order: ${sel.drink.ingredients.map(id => INGREDIENTS[id]?.name).join(' + ')}`;
            hint.style.color = '#ffd166';
        } else {
            hint.textContent = 'Tap a customer, then add ingredients';
            hint.style.color = '#888';
        }
    }
}

function findMatchingDrink(selected) {
    const sorted = [...selected].sort();
    return game.availableDrinks.find(d => {
        const recipeSorted = [...d.ingredients].sort();
        return sorted.length === recipeSorted.length &&
               sorted.every((v, i) => v === recipeSorted[i]);
    });
}

function findPartialMatch(selected) {
    const selSet = new Set(selected);
    let bestMatch = null;
    let bestScore = 0;

    game.availableDrinks.forEach(d => {
        let matches = 0;
        d.ingredients.forEach(id => { if (selSet.has(id)) matches++; });
        const score = matches / Math.max(d.ingredients.length, selected.length);
        if (score > bestScore) { bestScore = score; bestMatch = d; }
    });

    return bestScore > 0.3 ? bestMatch : null;
}

function attemptMix() {
    if (game.selectedIngredients.length === 0) return;

    // Find which customer this matches
    const exactMatch = findMatchingDrink(game.selectedIngredients);

    // Find the target customer
    let customer = game.customers.find(c => c.selected && c.state === 'waiting');
    if (!customer) {
        // Auto-find customer whose order matches
        if (exactMatch) {
            customer = game.customers.find(c => c.state === 'waiting' && c.drink.id === exactMatch.id);
        }
        if (!customer) {
            customer = game.customers.find(c => c.state === 'waiting');
        }
    }
    if (!customer) return;

    // Calculate ingredient accuracy
    const order = customer.drink;
    const orderSorted = [...order.ingredients].sort();
    const selSorted = [...game.selectedIngredients].sort();
    const isExact = orderSorted.length === selSorted.length &&
                    orderSorted.every((v, i) => v === selSorted[i]);

    game.activeCustomer = customer;
    game.activeDrink = order;
    game._ingredientAccuracy = isExact ? 1.0 : calculateIngredientAccuracy(order.ingredients, game.selectedIngredients);

    // Start mixing with the drink's method
    startMixing(customer);
}

function calculateIngredientAccuracy(recipe, selected) {
    const recipeSet = {};
    recipe.forEach(id => { recipeSet[id] = (recipeSet[id] || 0) + 1; });
    const selSet = {};
    selected.forEach(id => { selSet[id] = (selSet[id] || 0) + 1; });

    let matches = 0;
    let total = Math.max(recipe.length, selected.length);

    Object.keys(recipeSet).forEach(id => {
        matches += Math.min(recipeSet[id] || 0, selSet[id] || 0);
    });

    return matches / total;
}

// ============================================================
//  MIXING MINI-GAMES
// ============================================================
function startMixing(customer) {
    game.mixingType = customer.drink.method;
    game.mixingProgress = 0;
    game.mixingTimer = 0;
    game.mixingMaxTime = 600;
    game.mixingComplete = false;
    game._perfectTimer = undefined;
    game.state = 'mixing';

    if (game.mixingType === 'layer') {
        game.currentLayer = 0;
        game.layerProgress = customer.drink.layers.map(() => 0);
        game.layerSteadiness = customer.drink.layers.map(() => []);
    }

    touchShakeAccum = 0;

    document.getElementById('mixing-overlay').style.display = 'flex';
    document.getElementById('ingredient-panel').style.display = 'none';

    const instrMap = {
        shake: '📱 Shake your phone!',
        layer: '📐 Tilt slowly to pour!',
        stir: '🔄 Stir gently!',
    };

    document.getElementById('mixing-drink-name').textContent = customer.drink.name;
    document.getElementById('mixing-instruction').textContent = instrMap[game.mixingType];
}

function updateMixing() {
    game.mixingTimer++;

    if (game.mixingType === 'shake') updateShakeMixing();
    else if (game.mixingType === 'layer') updateLayerMixing();
    else updateStirMixing();

    // Meter
    const fill = document.getElementById('mixing-meter-fill');
    fill.style.width = `${Math.min(110, game.mixingProgress)}%`;

    if (game.mixingProgress >= 80 && game.mixingProgress <= 100) {
        fill.style.background = 'linear-gradient(90deg, #06d6a0, #00e6b0)';
    } else if (game.mixingProgress > 100) {
        fill.style.background = 'linear-gradient(90deg, #e85d04, #dc2f02)';
    } else {
        fill.style.background = 'linear-gradient(90deg, #e85d04, #ffd166)';
    }

    // Status text
    const status = document.getElementById('mixing-status');
    if (game.mixingType === 'layer') {
        const drink = game.activeDrink;
        if (game.currentLayer < drink.layers.length) {
            status.textContent = `Layer ${game.currentLayer + 1}/${drink.layers.length}: ${drink.layers[game.currentLayer].name}`;
            document.getElementById('mixing-instruction').textContent = `📐 Tilt to pour: ${drink.layers[game.currentLayer].name}`;
        }
    } else {
        const pct = Math.floor(game.mixingProgress);
        status.textContent = pct < 70 ? 'Keep going...' : pct <= 100 ? 'Sweet spot!' : 'Too much!';
    }

    drawMixingAnimation();

    // Time limit
    if (game.mixingTimer >= game.mixingMaxTime && !game.mixingComplete) {
        completeMixing();
    }

    // Auto-complete in sweet spot
    if (game.mixingType !== 'layer' && game.mixingProgress >= 90 && game.mixingProgress <= 105) {
        if (game._perfectTimer === undefined) game._perfectTimer = 0;
        game._perfectTimer++;
        if (game._perfectTimer > 30) completeMixing();
    } else {
        game._perfectTimer = undefined;
    }

    if (game.mixingType === 'layer' && game.layerProgress.every(p => p >= 100)) {
        completeMixing();
    }
}

function updateShakeMixing() {
    const target = game.activeDrink.targetShakes || 60;
    let input = 0;
    if (motion.enabled) {
        motion.smoothShake = motion.smoothShake * 0.7 + motion.shakeIntensity * 0.3;
        if (motion.smoothShake > 5) input = motion.smoothShake * 0.4;
    }
    input += touchShakeAccum;
    touchShakeAccum *= 0.8;
    game.mixingProgress += input * (100 / target);
}

function updateLayerMixing() {
    if (game.currentLayer >= game.activeDrink.layers.length) return;
    let pourRate = 0;
    if (motion.enabled) {
        if (motion.tiltAngle > 10) pourRate = Math.min(2.5, (motion.tiltAngle - 10) * 0.08);
        if (motion.tiltAngle > 37) game.layerSteadiness[game.currentLayer].push(0);
        else if (motion.tiltAngle >= 10) game.layerSteadiness[game.currentLayer].push(1);
    }
    pourRate += touchShakeAccum * 0.05;
    touchShakeAccum *= 0.5;
    game.layerProgress[game.currentLayer] += pourRate;
    game.mixingProgress = game.layerProgress.reduce((a, b) => a + b, 0) / game.activeDrink.layers.length;
    if (game.layerProgress[game.currentLayer] >= 100) {
        game.layerProgress[game.currentLayer] = 100;
        if (game.currentLayer < game.activeDrink.layers.length - 1) game.currentLayer++;
    }
}

function updateStirMixing() {
    const target = game.activeDrink.targetStirs || 40;
    let input = 0;
    if (motion.enabled) {
        motion.smoothRotation = motion.smoothRotation * 0.7 + motion.rotationRate * 0.3;
        if (motion.smoothRotation > 20) input = motion.smoothRotation * 0.02;
    }
    input += touchShakeAccum * 0.5;
    touchShakeAccum *= 0.8;
    game.mixingProgress += input * (100 / target);
}

function completeMixing() {
    if (game.mixingComplete) return;
    game.mixingComplete = true;

    // Mixing quality
    let mixQuality = 0;
    if (game.mixingType === 'shake' || game.mixingType === 'stir') {
        const p = game.mixingProgress;
        if (p >= 85 && p <= 110) mixQuality = 1;
        else if (p >= 60 && p <= 130) mixQuality = 0.7;
        else if (p >= 30) mixQuality = 0.4;
        else mixQuality = 0.15;
    } else {
        let totalSteady = 0, totalSamples = 0;
        game.layerSteadiness.forEach(arr => {
            totalSteady += arr.filter(v => v === 1).length;
            totalSamples += Math.max(1, arr.length);
        });
        const steadyRatio = totalSamples > 0 ? totalSteady / totalSamples : 0.5;
        const completeRatio = game.layerProgress.filter(p => p >= 80).length / game.activeDrink.layers.length;
        mixQuality = (steadyRatio * 0.6 + completeRatio * 0.4);
    }

    // Combined quality: ingredient accuracy * mixing quality
    const ingAccuracy = game._ingredientAccuracy || 0;
    const totalQuality = ingAccuracy * 0.6 + mixQuality * 0.4;

    // Rating
    let rating, ratingEmoji, ratingColor;
    if (totalQuality >= 0.85) { rating = 'PERFECT'; ratingEmoji = '🌟'; ratingColor = '#ffd166'; }
    else if (totalQuality >= 0.65) { rating = 'Great!'; ratingEmoji = '😊'; ratingColor = '#06d6a0'; }
    else if (totalQuality >= 0.4) { rating = 'Not Bad'; ratingEmoji = '😐'; ratingColor = '#ffa500'; }
    else { rating = 'Yikes...'; ratingEmoji = '😰'; ratingColor = '#e85d04'; }

    // Earnings
    const basePrice = game.activeDrink.price;
    const earnings = Math.max(1, Math.ceil(basePrice * totalQuality));
    const tip = Math.ceil(basePrice * Math.max(0, totalQuality - 0.5) * game.activeCustomer.patience);
    const total = earnings + tip;

    game.money += total;
    game.shiftMoney += total;
    game.totalServed++;
    game.shiftServed++;
    game.activeCustomer.state = 'served';

    game.floatingTexts.push(new FloatingText(game.activeCustomer.getX(), game.activeCustomer.getY() - 40, `+$${total}`, '#06d6a0'));

    showResult(rating, ratingEmoji, ratingColor, earnings, tip, total, ingAccuracy, mixQuality);
}

function showResult(rating, emoji, color, earnings, tip, total, ingAcc, mixQ) {
    document.getElementById('mixing-overlay').style.display = 'none';
    const overlay = document.getElementById('result-overlay');
    overlay.style.display = 'flex';

    document.getElementById('result-rating').textContent = emoji;
    document.getElementById('result-drink-name').textContent = game.activeDrink.name;
    document.getElementById('result-drink-name').style.color = color;
    document.getElementById('result-earnings').textContent = `+$${earnings}`;
    document.getElementById('result-tip').textContent = tip > 0 ? `Tip: +$${tip}` : '';
    document.getElementById('result-detail').textContent =
        `Ingredients: ${Math.round(ingAcc * 100)}% · Mixing: ${Math.round(mixQ * 100)}%`;

    document.getElementById('result-ok-btn').onclick = () => {
        overlay.style.display = 'none';
        game.state = 'playing';
        game.activeCustomer = null;
        game.activeDrink = null;
        game.selectedIngredients = [];
        updateSelectedDisplay();
        updateMixButton();
        document.getElementById('ingredient-panel').style.display = 'block';
        checkShiftEnd();
    };
}

// ============================================================
//  MIXING ANIMATION (Canvas)
// ============================================================
function drawMixingAnimation() {
    mixCtx.clearRect(0, 0, 240, 240);

    if (game.mixingType === 'shake') drawShakerAnim();
    else if (game.mixingType === 'layer') drawLayerAnim();
    else drawStirAnim();
}

function drawShakerAnim() {
    const shake = Math.min(1, game.mixingProgress / 100);
    const sx = Math.sin(game.mixingTimer * 0.5) * shake * 14;
    const sy = Math.cos(game.mixingTimer * 0.7) * shake * 10;
    const cx = 120 + sx, cy = 100 + sy;

    // Shadow
    mixCtx.fillStyle = 'rgba(0,0,0,0.2)';
    mixCtx.beginPath();
    mixCtx.ellipse(120, 190, 30, 8, 0, 0, Math.PI * 2);
    mixCtx.fill();

    // Shaker body
    const bodyGrad = mixCtx.createLinearGradient(cx - 22, 0, cx + 22, 0);
    bodyGrad.addColorStop(0, '#999');
    bodyGrad.addColorStop(0.3, '#ddd');
    bodyGrad.addColorStop(0.6, '#bbb');
    bodyGrad.addColorStop(1, '#888');
    mixCtx.fillStyle = bodyGrad;
    mixCtx.beginPath();
    mixCtx.moveTo(cx - 18, cy);
    mixCtx.lineTo(cx - 22, cy + 65);
    mixCtx.lineTo(cx + 22, cy + 65);
    mixCtx.lineTo(cx + 18, cy);
    mixCtx.closePath();
    mixCtx.fill();

    // Top
    mixCtx.fillStyle = '#aaa';
    mixCtx.beginPath();
    mixCtx.moveTo(cx - 18, cy);
    mixCtx.lineTo(cx - 12, cy - 20);
    mixCtx.lineTo(cx + 12, cy - 20);
    mixCtx.lineTo(cx + 18, cy);
    mixCtx.closePath();
    mixCtx.fill();

    // Cap
    mixCtx.fillStyle = '#888';
    mixCtx.beginPath();
    mixCtx.ellipse(cx, cy - 20, 10, 4, 0, 0, Math.PI * 2);
    mixCtx.fill();

    // Liquid visible
    const liquidH = 50 * shake;
    mixCtx.fillStyle = game.activeDrink.color || '#e67e22';
    mixCtx.globalAlpha = 0.35;
    mixCtx.fillRect(cx - 20, cy + 65 - liquidH, 40, liquidH);
    mixCtx.globalAlpha = 1;

    // Droplets
    if (shake > 0.3) {
        for (let i = 0; i < 4; i++) {
            mixCtx.fillStyle = game.activeDrink.color || '#e67e22';
            mixCtx.globalAlpha = 0.3 + Math.random() * 0.3;
            const dx = cx + (Math.random() - 0.5) * 50;
            const dy = cy + Math.random() * 30 - 15;
            mixCtx.beginPath();
            mixCtx.arc(dx, dy, 2 + Math.random() * 3, 0, Math.PI * 2);
            mixCtx.fill();
        }
        mixCtx.globalAlpha = 1;
    }
}

function drawLayerAnim() {
    const drink = game.activeDrink;
    const gx = 85, gw = 70, gh = 140, gy = 50;

    // Glass
    mixCtx.strokeStyle = 'rgba(200,230,255,0.5)';
    mixCtx.lineWidth = 2;
    mixCtx.beginPath();
    mixCtx.moveTo(gx - 2, gy);
    mixCtx.lineTo(gx - 6, gy + gh);
    mixCtx.lineTo(gx + gw + 6, gy + gh);
    mixCtx.lineTo(gx + gw + 2, gy);
    mixCtx.stroke();

    // Filled layers
    let layerY = gy + gh;
    const layerH = (gh - 6) / drink.layers.length;

    for (let i = 0; i < drink.layers.length; i++) {
        const fill = Math.min(100, game.layerProgress[i]) / 100;
        const h = layerH * fill;
        layerY -= h;
        if (fill > 0) {
            mixCtx.fillStyle = drink.layers[i].color;
            mixCtx.fillRect(gx, layerY, gw, h);
            if (fill > 0.4) {
                mixCtx.font = '600 9px Nunito, sans-serif';
                mixCtx.fillStyle = '#fff';
                mixCtx.textAlign = 'center';
                mixCtx.fillText(drink.layers[i].name, gx + gw / 2, layerY + h / 2 + 3);
            }
        }
    }
    mixCtx.textAlign = 'left';

    // Pour stream
    if (game.currentLayer < drink.layers.length && game.layerProgress[game.currentLayer] < 100) {
        const active = touchShakeAccum > 0.3 || (motion.enabled && motion.tiltAngle > 10);
        if (active) {
            mixCtx.fillStyle = drink.layers[game.currentLayer].color;
            mixCtx.globalAlpha = 0.7;
            mixCtx.fillRect(gx + gw / 2 - 3, gy - 25, 6, 30);
            mixCtx.globalAlpha = 1;
        }
    }

    // Tilt gauge
    mixCtx.fillStyle = '#222';
    mixCtx.fillRect(40, 210, 160, 10);
    mixCtx.fillStyle = 'rgba(6,214,160,0.2)';
    mixCtx.fillRect(40 + 48, 210, 64, 10);
    const tiltNorm = Math.min(1, (motion.enabled ? motion.tiltAngle : touchShakeAccum * 3) / 50);
    mixCtx.fillStyle = '#ffd166';
    mixCtx.fillRect(40 + tiltNorm * 155, 208, 5, 14);
}

function drawStirAnim() {
    const progress = Math.min(1, game.mixingProgress / 100);
    const cx = 120, cy = 120;

    // Glass
    mixCtx.strokeStyle = 'rgba(200,230,255,0.4)';
    mixCtx.lineWidth = 2;
    mixCtx.beginPath();
    mixCtx.ellipse(cx, cy, 50, 50, 0, 0, Math.PI * 2);
    mixCtx.stroke();

    // Liquid
    mixCtx.fillStyle = game.activeDrink.color || '#daa520';
    mixCtx.globalAlpha = 0.3 + progress * 0.3;
    mixCtx.beginPath();
    mixCtx.arc(cx, cy, 47, 0, Math.PI * 2);
    mixCtx.fill();
    mixCtx.globalAlpha = 1;

    // Swirl
    const angle = game.mixingTimer * 0.06;
    mixCtx.strokeStyle = `rgba(255,255,255,${0.1 + progress * 0.15})`;
    mixCtx.lineWidth = 2;
    for (let i = 0; i < 3; i++) {
        const a = angle + i * 2.1;
        mixCtx.beginPath();
        mixCtx.arc(cx, cy, 15 + i * 10, a, a + 1.5);
        mixCtx.stroke();
    }

    // Stirrer
    const stX = cx + Math.cos(angle) * 22;
    const stY = cy + Math.sin(angle) * 22;
    mixCtx.strokeStyle = '#8b4513';
    mixCtx.lineWidth = 4;
    mixCtx.lineCap = 'round';
    mixCtx.beginPath();
    mixCtx.moveTo(stX, stY - 60);
    mixCtx.lineTo(stX, stY);
    mixCtx.stroke();
    mixCtx.lineCap = 'butt';

    // Ice
    mixCtx.fillStyle = 'rgba(200,230,255,0.35)';
    for (let i = 0; i < 3; i++) {
        const a = angle * 0.3 + i * 2.1;
        const ix = cx + Math.cos(a) * 20;
        const iy = cy + Math.sin(a) * 20;
        mixCtx.beginPath();
        mixCtx.moveTo(ix, iy - 7);
        mixCtx.lineTo(ix + 7, iy);
        mixCtx.lineTo(ix, iy + 7);
        mixCtx.lineTo(ix - 7, iy);
        mixCtx.fill();
    }
}

// ============================================================
//  SHIFT MANAGEMENT
// ============================================================
function checkShiftEnd() {
    if (game.customersSpawned >= game.shiftTarget &&
        game.customers.filter(c => c.state === 'waiting' || c.state === 'entering').length === 0 &&
        game.customers.every(c => c.isGone() || c.state === 'served')) {
        setTimeout(() => endShift(), 800);
    }
}

function endShift() {
    game.state = 'shiftEnd';
    document.getElementById('ingredient-panel').style.display = 'none';
    const overlay = document.getElementById('shift-end-overlay');
    overlay.style.display = 'flex';

    document.getElementById('shift-end-title').textContent = `Shift ${game.shift} Complete`;

    const unlockMsg = game.shift < 3
        ? 'New drinks unlock next shift!'
        : 'Full menu unlocked!';

    document.getElementById('shift-end-stats').innerHTML = `
        <div class="stat-row highlight"><span>Earned</span><span class="stat-val">$${game.shiftMoney}</span></div>
        <div class="stat-row"><span>Drinks served</span><span class="stat-val">${game.shiftServed}</span></div>
        <div class="stat-row"><span>Total bank</span><span class="stat-val">$${game.money}</span></div>
        <div class="stat-row unlock">${unlockMsg}</div>
    `;

    document.getElementById('next-shift-btn').onclick = () => {
        overlay.style.display = 'none';
        startNextShift();
    };
}

function startNextShift() {
    game.shift++;
    game.shiftMoney = 0;
    game.shiftServed = 0;
    game.shiftTarget = 6 + game.shift * 2;
    game.customersSpawned = 0;
    game.spawnInterval = Math.max(120, 260 - game.shift * 20);
    game.spawnTimer = 0;
    game.customers = [];
    game.selectedIngredients = [];
    game.maxCustomers = Math.min(5, 3 + Math.floor(game.shift / 2));
    updateAvailableDrinks();
    game.state = 'playing';
    document.getElementById('ingredient-panel').style.display = 'block';
    document.getElementById('shift-display').textContent = `Shift ${game.shift}`;
    document.getElementById('served-display').textContent = `0 / ${game.shiftTarget}`;
    updateSelectedDisplay();
    updateMixButton();
}

function updateAvailableDrinks() {
    if (game.shift === 1) game.availableDrinks = DRINKS.filter(d => d.difficulty <= 1);
    else if (game.shift === 2) game.availableDrinks = DRINKS.filter(d => d.difficulty <= 2);
    else game.availableDrinks = [...DRINKS];
}

// ============================================================
//  CUSTOMER SPAWNING & TAP SELECTION
// ============================================================
function spawnCustomer() {
    const usedSlots = game.customers.filter(c => c.state !== 'leaving' && c.state !== 'served').map(c => c.slot);
    const open = [];
    for (let i = 0; i < game.maxCustomers; i++) { if (!usedSlots.includes(i)) open.push(i); }
    if (open.length === 0) return;

    const slot = open[Math.floor(Math.random() * open.length)];
    const c = new Customer(slot);
    c.assignDrink(game.availableDrinks);
    game.customers.push(c);
    game.customersSpawned++;
}

canvas.addEventListener('click', (e) => {
    if (game.state !== 'playing') return;
    const rect = canvas.getBoundingClientRect();
    const tapX = e.clientX - rect.left;
    const tapY = e.clientY - rect.top;

    game.customers.forEach(c => c.selected = false);

    let closest = null, closestDist = Infinity;
    for (const c of game.customers) {
        if (c.state !== 'waiting') continue;
        const dist = Math.sqrt((tapX - c.getX()) ** 2 + (tapY - c.getY()) ** 2);
        if (dist < 80 && dist < closestDist) { closest = c; closestDist = dist; }
    }

    if (closest) {
        closest.selected = true;
        game.activeCustomer = closest;
        updateMixButton();
    }
});

// ============================================================
//  MAIN LOOP
// ============================================================
function update() {
    if (game.state === 'playing') {
        game.frame++;
        game.spawnTimer++;
        if (game.spawnTimer >= game.spawnInterval && game.customersSpawned < game.shiftTarget) {
            spawnCustomer();
            game.spawnTimer = 0;
        }
        game.customers.forEach(c => c.update());
        game.customers = game.customers.filter(c => !c.isGone());
        game.floatingTexts.forEach(f => f.update());
        game.floatingTexts = game.floatingTexts.filter(f => f.life > 0);
        document.getElementById('money-display').textContent = `$${game.money}`;
        document.getElementById('served-display').textContent = `${game.shiftServed} / ${game.shiftTarget}`;

        // Auto check shift end
        if (game.customersSpawned >= game.shiftTarget &&
            game.customers.filter(c => c.state === 'waiting' || c.state === 'entering').length === 0 &&
            game.customers.length === 0) {
            endShift();
        }
    }
    if (game.state === 'mixing') {
        game.frame++;
        updateMixing();
    }
}

function draw() {
    ctx.clearRect(0, 0, W(), H());

    if (game.state === 'menu') {
        drawBarScene();
        game.frame++;
        return;
    }

    drawBarScene();
    game.customers.forEach(c => drawCustomer(c));
    game.floatingTexts.forEach(f => f.draw());
}

function gameLoop() {
    update();
    draw();
    requestAnimationFrame(gameLoop);
}

// ============================================================
//  INITIALIZATION
// ============================================================
function init() {
    document.getElementById('permission-btn').addEventListener('click', async () => {
        await requestMotionPermission();
        document.getElementById('permission-overlay').style.display = 'none';
    });

    document.getElementById('skip-perm-btn').addEventListener('click', () => {
        document.getElementById('permission-overlay').style.display = 'none';
    });

    document.getElementById('start-btn').addEventListener('click', () => {
        document.getElementById('start-screen').style.display = 'none';

        if (typeof DeviceMotionEvent !== 'undefined' && typeof DeviceMotionEvent.requestPermission === 'function') {
            document.getElementById('permission-overlay').style.display = 'flex';
            const obs = new MutationObserver(() => {
                if (document.getElementById('permission-overlay').style.display === 'none') {
                    obs.disconnect();
                    startGame();
                }
            });
            obs.observe(document.getElementById('permission-overlay'), { attributes: true });
        } else {
            if (typeof DeviceMotionEvent !== 'undefined') enableMotion();
            startGame();
        }
    });
}

function startGame() {
    game.state = 'playing';
    game.money = 0;
    game.shift = 1;
    game.shiftMoney = 0;
    game.shiftServed = 0;
    game.totalServed = 0;
    game.shiftTarget = 6;
    game.customersSpawned = 0;
    game.spawnTimer = 0;
    game.customers = [];
    game.selectedIngredients = [];

    updateAvailableDrinks();
    setupIngredientPanel();

    document.getElementById('hud').style.display = 'block';
    document.getElementById('ingredient-panel').style.display = 'block';
    document.getElementById('shift-display').textContent = 'Shift 1';
    document.getElementById('served-display').textContent = `0 / ${game.shiftTarget}`;
    updateMixButton();
}

init();
gameLoop();
