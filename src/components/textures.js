import * as THREE from 'three';

// Texturas procedurales (sin imágenes): se dibujan en un canvas de 256 px que representa ~60 cm de tablero.
const S = 256;

function rng(seed) {
  let s = seed >>> 0;
  return () => ((s = (Math.imul(s, 1664525) + 1013904223) >>> 0) / 4294967296);
}

function makeCanvas(base) {
  const c = document.createElement('canvas');
  c.width = S;
  c.height = S;
  const g = c.getContext('2d');
  g.fillStyle = base;
  g.fillRect(0, 0, S, S);
  return [c, g];
}

/** Vetas de madera: líneas onduladas horizontales que repiten bien en el borde izquierdo/derecho. */
function wood({ base, dark, light, seed, streaks = 150, contrast = 1, knots = 0 }) {
  const [c, g] = makeCanvas(base);
  const r = rng(seed);
  for (let i = 0; i < streaks; i++) {
    const y = r() * S;
    const amp = 0.6 + r() * 3.2;
    const ph = r() * 6.28;
    const k = 1 + Math.floor(r() * 3);
    const isLight = r() < 0.28;
    g.strokeStyle = `rgba(${isLight ? light : dark}, ${0.05 + r() * 0.15 * contrast})`;
    g.lineWidth = 0.5 + r() * 1.9;
    for (const off of [-S, 0, S]) {
      g.beginPath();
      for (let x = 0; x <= S; x += 8) {
        const yy = y + off + Math.sin((x / S) * 6.2832 * k + ph) * amp;
        if (x === 0) g.moveTo(x, yy); else g.lineTo(x, yy);
      }
      g.stroke();
    }
  }
  for (let i = 0; i < knots; i++) {
    const x = r() * S;
    const y = r() * S;
    for (let rad = 14; rad > 1; rad -= 3) {
      g.strokeStyle = `rgba(${dark}, ${0.08 + (14 - rad) * 0.012})`;
      g.lineWidth = 1.2;
      g.beginPath();
      g.ellipse(x, y, rad * 1.7, rad * 0.8, 0, 0, 6.2832);
      g.stroke();
    }
  }
  return c;
}

function speckle({ base, seed, amount = 0.07, size = 2, tone = '0,0,0' }) {
  const [c, g] = makeCanvas(base);
  const r = rng(seed);
  for (let i = 0; i < 2600; i++) {
    g.fillStyle = `rgba(${r() < 0.5 ? tone : '255,255,255'}, ${r() * amount})`;
    g.fillRect(r() * S, r() * S, size * (0.5 + r()), size * (0.5 + r()));
  }
  return [c, g, r];
}

const GENERATORS = {
  roble: () => wood({ base: '#c9a26b', dark: '120,80,40', light: '240,215,170', seed: 11, streaks: 170, contrast: 1.1 }),
  nogal: () => wood({ base: '#6a4430', dark: '30,16,8', light: '150,105,75', seed: 23, streaks: 190, contrast: 1.4 }),
  pino: () => wood({ base: '#e2c08b', dark: '150,100,45', light: '250,230,190', seed: 37, streaks: 110, contrast: 1, knots: 3 }),
  terciado: () => {
    const [c, g] = makeCanvas('#d9b67f');
    const r = rng(5);
    let y = 0;
    while (y < S) {
      const h = 6 + r() * 12;
      g.fillStyle = `rgba(${r() < 0.5 ? '120,80,30' : '255,235,200'}, ${0.06 + r() * 0.14})`;
      g.fillRect(0, y, S, h);
      y += h;
    }
    return c;
  },
  blanco: () => speckle({ base: '#f3f3f0', seed: 3, amount: 0.05 })[0],
  negro: () => speckle({ base: '#2a2c30', seed: 4, amount: 0.07, tone: '255,255,255' })[0],
  cemento: () => {
    const [c, g, r] = speckle({ base: '#9b9ea1', seed: 8, amount: 0.12, size: 3 });
    for (let i = 0; i < 22; i++) {
      const x = r() * S;
      const y = r() * S;
      const rad = 18 + r() * 40;
      const gr = g.createRadialGradient(x, y, 0, x, y, rad);
      const dark = r() < 0.5;
      gr.addColorStop(0, `rgba(${dark ? '60,62,66' : '230,232,235'}, 0.16)`);
      gr.addColorStop(1, 'rgba(0,0,0,0)');
      g.fillStyle = gr;
      for (const dx of [-S, 0, S]) for (const dy of [-S, 0, S]) {
        g.save(); g.translate(dx, dy); g.fillRect(x - rad, y - rad, rad * 2, rad * 2); g.restore();
      }
    }
    return c;
  },
  marmol: () => {
    const [c, g] = makeCanvas('#f1f1ef');
    const r = rng(77);
    for (let v = 0; v < 7; v++) {
      let x = r() * S;
      let y = r() * S;
      let a = r() * 6.28;
      g.strokeStyle = `rgba(${70 + r() * 30}, ${76 + r() * 30}, ${88 + r() * 30}, ${0.22 + r() * 0.3})`;
      g.lineWidth = 0.6 + r() * 2.4;
      g.beginPath();
      g.moveTo(x, y);
      for (let i = 0; i < 40; i++) {
        a += (r() - 0.5) * 0.9;
        x += Math.cos(a) * 9;
        y += Math.sin(a) * 9;
        g.lineTo(x, y);
      }
      g.stroke();
    }
    return c;
  },
};

const cache = new Map();
const thumbs = new Map();

/** Textura THREE lista para usar como `map`; `liso` no tiene textura. */
export function getTexture(id) {
  if (!GENERATORS[id]) return null;
  if (!cache.has(id)) {
    const t = new THREE.CanvasTexture(GENERATORS[id]());
    t.wrapS = THREE.RepeatWrapping;
    t.wrapT = THREE.RepeatWrapping;
    t.colorSpace = THREE.SRGBColorSpace;
    t.anisotropy = 4;
    cache.set(id, t);
  }
  return cache.get(id);
}

/** Miniatura (data URL) para el menú. */
export function textureThumb(id, size = 52) {
  if (!GENERATORS[id]) return null;
  const key = `${id}:${size}`;
  if (!thumbs.has(key)) {
    const c = document.createElement('canvas');
    c.width = size;
    c.height = size;
    c.getContext('2d').drawImage(GENERATORS[id](), 0, 0, size, size);
    thumbs.set(key, c.toDataURL('image/png'));
  }
  return thumbs.get(key);
}
