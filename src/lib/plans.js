import { SHEETS, LINEARS } from './materials.js';
import { cm, fmt } from './util.js';

/**
 * Planimetría base: vistas ortogonales (frente, lateral y planta) con cotas, a partir de las piezas del modelo.
 * Medidas del modelo en mm: x = ancho, y = alto, z = fondo (z = 0 es el respaldo; el frente está en z máximo).
 */
const box = (o) => o.aabb || o;
const isThin = (p, k) => p.size[k] <= 40 && p.kind !== 'linear';

/** Valores únicos (con tolerancia de 1,5 mm) ordenados; descarta los que dejan tramos muy cortos. */
function uniq(vals, minGap = 12) {
  const s = [...vals].sort((a, b) => a - b);
  const out = [];
  for (const v of s) {
    if (!out.length || v - out[out.length - 1] > 1.5) out.push(v);
  }
  // fusiona valores demasiado cercanos conservando el primero
  return out.filter((v, i) => i === 0 || v - out[i - 1] >= minGap || i === out.length - 1);
}

/** Cotas de cadena: bordes de tableros horizontales (en y) o verticales (en x / z). */
function chainStops(model, axis) {
  const { min, max } = model.bbox;
  const vals = [min[axis], max[axis]];
  for (const p of model.parts) {
    const b = box(p);
    if (p.rot) continue;
    const horizontal = axis === 1 && isThin(p, 1) && p.size[0] > 150 && p.size[2] > 150;
    const vertical = axis !== 1 && isThin(p, axis) && p.size[1] > 150 && p.shape !== 'disc';
    if (horizontal || vertical) vals.push(b.min[axis], b.min[axis] + b.size[axis]);
  }
  const u = uniq(vals);
  if (u[0] !== min[axis]) u.unshift(min[axis]);
  if (u[u.length - 1] !== max[axis]) u.push(max[axis]);
  return u.length > 14 ? [min[axis], max[axis]] : u;
}

/** Proyecta las piezas en un plano. Devuelve rectángulos ya ordenados de atrás hacia adelante. */
function project(model, view) {
  const ax = { front: [0, 1, 2, false], side: [2, 1, 0, false], plan: [0, 2, 1, true] }[view]; // [horizontal, vertical, profundidad, invertir vertical]
  const items = [];
  const push = (o, kind, extra = {}) => {
    const b = box(o);
    items.push({
      x: b.min[ax[0]], y: b.min[ax[1]], w: b.size[ax[0]], h: b.size[ax[1]], depth: b.min[ax[2]], kind,
      disc: o.shape === 'disc', leg: !!extra.leg, name: o.name || o.kind,
    });
  };
  model.parts.forEach((p) => push(p, 'part', { leg: p.kind === 'linear' }));
  model.fixtures.forEach((f) => { if (!f.noBbox) push(f, f.kind === 'handle' ? 'handle' : 'fixture', { leg: f.kind !== 'handle' }); });
  items.sort((a, b) => a.depth - b.depth); // lo más lejano del observador se dibuja primero
  return items;
}

export function buildDrawing(model) {
  const { min, max } = model.bbox;
  const W = max[0] - min[0];
  const H = max[1] - min[1];
  const D = max[2] - min[2];
  const margin = 150;
  const gap = 210;
  const sheetW = 1500;
  const s = Math.min((sheetW - 2 * margin - gap) / (W + D), 900 / (H + D));
  const frontX = margin;
  const frontY = margin;
  const sideX = frontX + W * s + gap;
  const planY = frontY + H * s + gap * 0.95;
  const total = { w: sheetW, h: planY + D * s + margin + 140 };
  const views = {
    front: { title: 'Elevación frontal', ox: frontX, oy: frontY, items: project(model, 'front'), a: [0, 1] },
    side: { title: 'Elevación lateral derecha', ox: sideX, oy: frontY, items: project(model, 'side'), a: [2, 1] },
    plan: { title: 'Planta (vista desde arriba)', ox: frontX, oy: planY, items: project(model, 'plan'), a: [0, 2] },
  };
  // convierte a coordenadas de dibujo (y hacia abajo)
  const rect = (v, it) => {
    // lateral derecha: se mira desde +x, así que el frente (z máximo) queda a la izquierda
    const x = v.a[0] === 2 ? v.ox + (max[2] - (it.x + it.w)) * s : v.ox + (it.x - min[0]) * s;
    const vMax = v.a[1] === 1 ? max[1] : max[2];
    // en frente/lateral, y crece hacia arriba; en planta, z crece hacia el frente (hacia abajo en el dibujo)
    const y = v.a[1] === 1 ? v.oy + (vMax - (it.y + it.h)) * s : v.oy + (it.y - min[2]) * s;
    return { x, y, w: it.w * s, h: it.h * s, kind: it.kind, disc: it.disc, leg: it.leg, name: it.name };
  };
  for (const v of Object.values(views)) v.rects = v.items.map((it) => rect(v, it));
  views.front.size = { w: W * s, h: H * s };
  views.side.size = { w: D * s, h: H * s };
  views.plan.size = { w: W * s, h: D * s };
  const chain = {
    y: chainStops(model, 1),
    x: chainStops(model, 0),
    z: chainStops(model, 2),
  };
  return { s, W, H, D, min, max, total, views, chain };
}

// ---------- ficha técnica ----------
const DENSITY = { mel18: 680, mel15: 680, mdf18: 700, hdf3: 800, ter18: 560, ter15: 560 }; // kg/m³ aprox.
const FINISH = {
  mel18: 'Melamina: sin acabado adicional (cantos con tapacanto)', mel15: 'Melamina: sin acabado adicional (cantos con tapacanto)',
  mdf18: 'MDF crudo: sellar y pintar o enchapar', ter18: 'Terciado: lija, sellador y barniz o aceite', ter15: 'Terciado: lija, sellador y barniz o aceite',
};

export function techSpec(model, plans, shop, type, values) {
  const { dims } = model.bbox;
  const rows = [];
  const mats = new Map();
  let volume = 0;
  let weight = 0;
  for (const p of model.parts) {
    if (p.kind === 'linear') {
      const m = LINEARS[p.mat];
      const v = (p.size[0] * p.size[1] * p.size[2]) / 1e9;
      volume += v;
      weight += v * 520;
    } else {
      const v = (p.size[0] * p.size[1] * p.size[2]) / 1e9;
      volume += v;
      weight += v * (DENSITY[p.mat] || 680);
      mats.set(p.mat, (mats.get(p.mat) || 0) + 1);
    }
  }
  const rect = (mm) => cm(mm);
  rows.push(['Mueble', `${type.name}${type.desc ? ` — ${type.desc}` : ''}`]);
  rows.push(['Dimensiones generales (ancho × alto × fondo)', `${rect(dims[0])} × ${rect(dims[1])} × ${rect(dims[2])} cm`]);
  const sheets = shop.sheets.map((s) => `${s.count} × ${s.name} (${s.size})`);
  rows.push(['Tableros', sheets.length ? sheets.join('; ') : '—']);
  const bars = shop.bars.map((b) => `${b.count} × ${b.name} (${b.stock})`);
  if (bars.length) rows.push(['Madera en listón', bars.join('; ')]);
  const mainMat = [...mats.entries()].sort((a, b) => b[1] - a[1])[0]?.[0];
  if (mainMat && FINISH[mainMat]) rows.push(['Acabado', FINISH[mainMat]]);
  if (bars.length) rows.push(['Acabado de la madera', 'Lijar (grano 120 y 180), sellador y 2 manos de barniz o aceite']);
  rows.push(['Piezas', `${model.parts.length} piezas cortadas (${plans.groups.length} medidas distintas) y ${model.fixtures.filter((f) => f.kind !== 'handle').length} elementos comprados listos`]);
  const edge = shop.edging.map((e) => `${e.meters.toFixed(1).replace('.', ',')} m de ${e.width} mm`);
  if (edge.length) rows.push(['Tapacanto', edge.join('; ')]);
  const hw = (re) => shop.hardware.filter((h) => re.test(h.name)).map((h) => `${h.qty} × ${h.name}`);
  const legs = hw(/^pata|^rueda|^nivelador/i);
  if (legs.length) rows.push(['Patas / apoyos', legs.join('; ')]);
  const handles = hw(/^jaladera|^perilla|^perfil tirador|^pist[oó]n/i);
  if (handles.length) rows.push(['Tiradores', handles.join('; ')]);
  const slides = hw(/^corredera|^bisagra/i);
  if (slides.length) rows.push(['Herrajes de movimiento', slides.join('; ')]);
  rows.push(['Peso aproximado (sin herrajes)', `${Math.round(weight)} kg · ${volume.toFixed(2).replace('.', ',')} m³ de material`]);
  rows.push(['Unión de tableros', 'Tornillo confirmat 7×50 mm con tarugos; tapas cubre-confirmat del color del tablero']);
  const notes = model.notes.filter((n) => n.level === 'warn').map((n) => n.text);
  if (notes.length) rows.push(['Observaciones de diseño', notes.join(' ')]);
  return rows;
}
