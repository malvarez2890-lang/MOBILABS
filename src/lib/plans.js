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

const C30 = Math.cos(Math.PI / 6);
const PROJ = {
  front: { u: (x, y, z) => x, v: (x, y, z) => -y, d: (c) => c[2], dir: 1 },
  back: { u: (x, y, z) => -x, v: (x, y, z) => -y, d: (c) => c[2], dir: -1 },
  right: { u: (x, y, z) => -z, v: (x, y, z) => -y, d: (c) => c[0], dir: 1 },
  left: { u: (x, y, z) => z, v: (x, y, z) => -y, d: (c) => c[0], dir: -1 },
  plan: { u: (x, y, z) => x, v: (x, y, z) => z, d: (c) => c[1], dir: 1 },
  iso: { u: (x, y, z) => (x - z) * C30, v: (x, y, z) => (x + z) * 0.5 - y, d: (c) => c[0] + c[1] + c[2], dir: 1 },
};
const TITLES = {
  front: 'VISTA FRONTAL', back: 'VISTA POSTERIOR', left: 'VISTA LATERAL IZQUIERDA', right: 'VISTA LATERAL DERECHA',
  plan: 'PLANTA', iso: 'VISTA ISOMÉTRICA',
};

const mulM = (A, B) => A.map((r, i) => [0, 1, 2].map((j) => r[0] * B[0][j] + r[1] * B[1][j] + r[2] * B[2][j]));
const rotM = (rot) => {
  const [a, b, c] = rot;
  const Rx = [[1, 0, 0], [0, Math.cos(a), -Math.sin(a)], [0, Math.sin(a), Math.cos(a)]];
  const Ry = [[Math.cos(b), 0, Math.sin(b)], [0, 1, 0], [-Math.sin(b), 0, Math.cos(b)]];
  const Rz = [[Math.cos(c), -Math.sin(c), 0], [Math.sin(c), Math.cos(c), 0], [0, 0, 1]];
  return mulM(mulM(Rx, Ry), Rz);
};
/** 8 esquinas 3D de una pieza (giradas alrededor de su centro si lleva `rot`). */
function corners(o) {
  const c = o.min.map((m, i) => m + o.size[i] / 2);
  const R = o.rot ? rotM(o.rot) : null;
  const out = [];
  for (const sx of [-1, 1]) for (const sy of [-1, 1]) for (const sz of [-1, 1]) {
    const v = [sx * o.size[0] / 2, sy * o.size[1] / 2, sz * o.size[2] / 2];
    out.push(R ? [0, 1, 2].map((i) => c[i] + R[i][0] * v[0] + R[i][1] * v[1] + R[i][2] * v[2]) : [c[0] + v[0], c[1] + v[1], c[2] + v[2]]);
  }
  return out;
}
/** Envolvente convexa (cadena monótona). */
function hull(pts) {
  const P = [...pts].sort((a, b) => a[0] - b[0] || a[1] - b[1]);
  const cross = (o, a, b) => (a[0] - o[0]) * (b[1] - o[1]) - (a[1] - o[1]) * (b[0] - o[0]);
  const lo = [];
  for (const q of P) { while (lo.length >= 2 && cross(lo[lo.length - 2], lo[lo.length - 1], q) <= 0) lo.pop(); lo.push(q); }
  const up = [];
  for (const q of [...P].reverse()) { while (up.length >= 2 && cross(up[up.length - 2], up[up.length - 1], q) <= 0) up.pop(); up.push(q); }
  return [...lo.slice(0, -1), ...up.slice(0, -1)];
}

/** Dibuja un elemento en una vista: devuelve polígonos [{pts, cls}] en mm de la vista (u, v). */
function shapes(o, view, kind) {
  const P = PROJ[view];
  const pr = (c) => [P.u(...c), P.v(...c)];
  if (view !== 'iso') return [{ pts: hull(corners(o).map(pr)), cls: `${kind}-front` }];
  const [x0, y0, z0] = o.min;
  const [x1, y1, z1] = [x0 + o.size[0], y0 + o.size[1], z0 + o.size[2]];
  if (o.shape === 'disc') {
    const cx = (x0 + x1) / 2, cz = (z0 + z1) / 2, r = o.size[0] / 2;
    const ring = (y) => Array.from({ length: 48 }, (_, i) => pr([cx + r * Math.cos((i / 48) * 2 * Math.PI), y, cz + r * Math.sin((i / 48) * 2 * Math.PI)]));
    return [{ pts: hull([...ring(y0), ...ring(y1)]), cls: `${kind}-side` }, { pts: ring(y1), cls: `${kind}-top` }];
  }
  if (o.rot) return [{ pts: hull(corners(o).map(pr)), cls: `${kind}-front` }];
  return [
    { pts: [[x1, y0, z0], [x1, y0, z1], [x1, y1, z1], [x1, y1, z0]].map(pr), cls: `${kind}-side` },
    { pts: [[x0, y0, z1], [x1, y0, z1], [x1, y1, z1], [x0, y1, z1]].map(pr), cls: `${kind}-front` },
    { pts: [[x0, y1, z0], [x1, y1, z0], [x1, y1, z1], [x0, y1, z1]].map(pr), cls: `${kind}-top` },
  ];
}

function buildView(model, view) {
  const P = PROJ[view];
  const items = [];
  const add = (o, kind) => {
    const c = o.min.map((m, i) => m + o.size[i] / 2);
    items.push({ depth: P.d(c) * P.dir, polys: shapes(o, view, kind) });
  };
  model.parts.forEach((p) => add(p, p.kind === 'linear' ? 'leg' : 'sheet'));
  model.fixtures.forEach((f) => { if (!f.noBbox) add(f, f.kind === 'handle' ? 'handle' : 'fix'); });
  items.sort((a, b) => a.depth - b.depth);
  const polys = items.flatMap((i) => i.polys);
  let u0 = Infinity, u1 = -Infinity, v0 = Infinity, v1 = -Infinity;
  polys.forEach((q) => q.pts.forEach(([u, v]) => { u0 = Math.min(u0, u); u1 = Math.max(u1, u); v0 = Math.min(v0, v); v1 = Math.max(v1, v); }));
  return { key: view, title: TITLES[view], polys, u0, u1, v0, v1, w: u1 - u0, h: v1 - v0 };
}

export function buildDrawing(model) {
  const { min, max } = model.bbox;
  const W = max[0] - min[0], H = max[1] - min[1], D = max[2] - min[2];
  const V = Object.fromEntries(Object.keys(PROJ).map((k) => [k, buildView(model, k)]));
  const padR = 100, padB = 190, padT = 50, sheetW = 2000;
  const isoAspect = Math.min(1.6, Math.max(0.75, V.iso.w / V.iso.h)); // proporción de la imagen render isométrica
  const grid = [['front', 'left', 'right'], ['back', 'plan', 'iso']];
  const colMm = [0, 1, 2].map((c) => Math.max(...grid.map((r) => V[r[c]].w)));
  const rowMm = grid.map((r) => Math.max(...r.map((k) => V[k].h)));
  const s = Math.min((sheetW - 3 * padR) / colMm.reduce((a, b) => a + b, 0), 1500 / (rowMm[0] + rowMm[1]));
  const colW = colMm.map((c) => Math.max(c * s, 440)); // cada columna debe alojar el título de su vista
  const isoH = colW[2] / isoAspect; // la imagen isométrica ocupa todo el ancho de su columna
  rowMm[1] = Math.max(rowMm[1], isoH / s);
  const colX = [60, 60 + colW[0] + padR, 60 + colW[0] + colW[1] + 2 * padR];
  const rowY = [40 + padT, 40 + padT + rowMm[0] * s + padB + padT];
  const total = { w: Math.max(sheetW, colX[2] + colW[2] + padR), h: rowY[1] + rowMm[1] * s + padB + 150 };
  // escala aproximada al imprimir en A4 apaisado (277 mm útiles de ancho)
  const NICE = [1, 2, 2.5, 5, 10, 15, 20, 25, 30, 40, 50, 75, 100, 150, 200];
  const raw = 1 / ((s * 277) / total.w);
  const scaleN = NICE.reduce((a, b) => (Math.abs(Math.log(b / raw)) < Math.abs(Math.log(a / raw)) ? b : a));
  const views = grid.flatMap((r, ri) => r.map((k, ci) => {
    const v = V[k];
    // cada vista se alinea arriba-izquierda de su celda
    const ox = colX[ci] - v.u0 * s;
    const oy = rowY[ri] - v.v0 * s;
    const polys = v.polys.map((q) => ({ cls: q.cls, pts: q.pts.map(([u, w]) => [ox + u * s, oy + w * s]) }));
    const x = colX[ci], y = rowY[ri];
    const isIso = k === 'iso';
    const dims = [];
    const sx = (u) => ox + u * s;
    const sy = (w) => oy + w * s;
    const hd = (a, b, lvl, label) => dims.push({ t: 'h', x1: sx(a), x2: sx(b), at: y + v.h * s + 8, off: lvl, label });
    const vd = (a, b, lvl, label) => dims.push({ t: 'v', y1: sy(a), y2: sy(b), at: x + v.w * s + 8, off: lvl, label });
    const seg = (st) => st.slice(1).map((q, i) => [st[i], q]);
    if (k === 'front') {
      hd(min[0], max[0], 50, cm(W));
      const cx = chainStops(model, 0);
      if (cx.length > 2) seg(cx).forEach(([a, b]) => hd(a, b, 22, b - a < 25 ? '' : cm(b - a)));
      vd(-max[1], -min[1], 30 + (chainStops(model, 1).length > 2 ? 30 : 0), cm(H));
      const cy = chainStops(model, 1);
      if (cy.length > 2) seg(cy).forEach(([a, b]) => vd(-b, -a, 26, b - a < 25 ? '' : cm(b - a)));
    } else if (k === 'back') {
      hd(-max[0], -min[0], 30, cm(W)); vd(-max[1], -min[1], 30, cm(H));
    } else if (k === 'left') {
      hd(min[2], max[2], 30, cm(D)); vd(-max[1], -min[1], 30, cm(H));
    } else if (k === 'right') {
      hd(-max[2], -min[2], 30, cm(D)); vd(-max[1], -min[1], 30, cm(H));
    } else if (k === 'plan') {
      hd(min[0], max[0], 50, cm(W));
      const cx = chainStops(model, 0);
      if (cx.length > 2) seg(cx).forEach(([a, b]) => hd(a, b, 22, b - a < 25 ? '' : cm(b - a)));
      vd(min[2], max[2], 30 + (chainStops(model, 2).length > 2 ? 30 : 0), cm(D));
      const cz = chainStops(model, 2);
      if (cz.length > 2) seg(cz).forEach(([a, b]) => vd(a, b, 26, b - a < 25 ? '' : cm(b - a)));
    }
    const vw = isIso ? colW[2] : v.w * s;
    const vh = isIso ? isoH : v.h * s;
    const maxOff = dims.reduce((a, d) => Math.max(a, d.off), isIso ? 0 : 20);
    return { key: k, title: v.title, x, y, w: vw, h: vh, titleY: y + vh + maxOff + 70, rowBottom: rowY[ri] + rowMm[ri] * s, polys, dims };
  }));
  return { s, W, H, D, min, max, total, views, scaleN, isoAspect };
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
