import { SHEETS, LINEARS, SHEET_SIZES, sheetSize } from './materials.js';
import { labelFor } from './util.js';

/** Agrupa piezas iguales (mismo nombre, material y medidas) y les asigna una letra. */
export function groupParts(parts) {
  const map = new Map();
  for (const p of parts) {
    const key = `${p.kind}|${p.mat}|${p.finish || ''}|${p.name}|${p.cut.l}|${p.cut.w ?? ''}|${p.shape || ''}`;
    let g = map.get(key);
    if (!g) {
      g = { key, finish: p.finish || null, disc: p.shape === 'disc', name: p.name, mat: p.mat, kind: p.kind, l: p.cut.l, w: p.cut.w ?? null, t: p.cut.t ?? null, qty: 0, ids: [], edgeMm: 0 };
      map.set(key, g);
    }
    g.qty++;
    g.ids.push(p.id);
    g.edgeMm += p.edges.reduce((a, b) => a + b, 0);
  }
  const order = Object.keys({ ...SHEETS, ...LINEARS });
  const groups = [...map.values()].sort(
    (a, b) => order.indexOf(a.mat) - order.indexOf(b.mat) || b.l - a.l || (b.w ?? 0) - (a.w ?? 0) || a.name.localeCompare(b.name),
  );
  groups.forEach((g, i) => { g.label = labelFor(i); });
  return groups;
}

// ---------- 2D: MaxRects (mejor ajuste por lado corto) ----------
function newSheet(W, H) {
  return { free: [{ x: 0, y: 0, w: W, h: H }], placements: [] };
}

function tryPlace(sheet, item, kerf, rotate) {
  const cands = [{ w: item.l + kerf, h: item.w + kerf, rot: false }];
  if (rotate && item.l !== item.w) cands.push({ w: item.w + kerf, h: item.l + kerf, rot: true });
  let best = null;
  for (const r of sheet.free) {
    for (const c of cands) {
      if (c.w <= r.w + 1e-6 && c.h <= r.h + 1e-6) {
        const s1 = Math.min(r.w - c.w, r.h - c.h);
        const s2 = Math.max(r.w - c.w, r.h - c.h);
        if (!best || s1 < best.s1 || (s1 === best.s1 && s2 < best.s2)) best = { s1, s2, x: r.x, y: r.y, ...c };
      }
    }
  }
  if (!best) return false;
  const used = { x: best.x, y: best.y, w: best.w, h: best.h };
  const next = [];
  for (const f of sheet.free) {
    if (used.x >= f.x + f.w || used.x + used.w <= f.x || used.y >= f.y + f.h || used.y + used.h <= f.y) {
      next.push(f);
      continue;
    }
    if (used.x > f.x) next.push({ x: f.x, y: f.y, w: used.x - f.x, h: f.h });
    if (used.x + used.w < f.x + f.w) next.push({ x: used.x + used.w, y: f.y, w: f.x + f.w - used.x - used.w, h: f.h });
    if (used.y > f.y) next.push({ x: f.x, y: f.y, w: f.w, h: used.y - f.y });
    if (used.y + used.h < f.y + f.h) next.push({ x: f.x, y: used.y + used.h, w: f.w, h: f.y + f.h - used.y - used.h });
  }
  sheet.free = next.filter((a, i) =>
    !next.some((b, j) => i !== j && a.x >= b.x - 1e-6 && a.y >= b.y - 1e-6 && a.x + a.w <= b.x + b.w + 1e-6 && a.y + a.h <= b.y + b.h + 1e-6 && (i > j || a.w < b.w || a.h < b.h || a.x !== b.x || a.y !== b.y)));
  sheet.placements.push({
    label: item.label, name: item.name, disc: !!item.disc, x: best.x, y: best.y,
    w: best.w - kerf, h: best.h - kerf, rot: best.rot,
  });
  return true;
}

function packRects(items, W, H, kerf, rotate) {
  const sheets = [];
  const unplaced = [];
  for (const it of items) {
    let ok = false;
    for (const s of sheets) {
      if (tryPlace(s, it, kerf, rotate)) { ok = true; break; }
    }
    if (!ok) {
      const s = newSheet(W + kerf, H + kerf);
      if (tryPlace(s, it, kerf, rotate)) sheets.push(s);
      else unplaced.push(it);
    }
  }
  return { sheets, unplaced };
}

// ---------- 1D: listones (first-fit decreasing) ----------
function packBars(items, stock, kerf) {
  const bars = [];
  const unplaced = [];
  for (const it of items) {
    if (it.l > stock) { unplaced.push(it); continue; }
    let bar = bars.find((b) => b.used + it.l + (b.pieces.length ? kerf : 0) <= stock + 1e-6);
    if (!bar) { bar = { used: 0, pieces: [] }; bars.push(bar); }
    bar.used += it.l + (bar.pieces.length ? kerf : 0);
    bar.pieces.push({ label: it.label, name: it.name, l: it.l });
  }
  return { bars, unplaced };
}

/**
 * Cubica todo: planchas por material (2D) y listones por escuadría (1D).
 * opts = { kerf (mm de corte), rotate (permitir girar piezas; ignora la veta) }
 */
export function packAll(parts, opts = {}) {
  const kerf = opts.kerf ?? 3;
  const rotate = !!opts.rotate;
  const groups = groupParts(parts);

  const sheetPlans = [];
  const barPlans = [];
  // una plancha por material y terminación (melamina blanca y melamina roble se compran y cortan aparte)
  const combos = [...new Map(groups.map((g) => [`${g.mat}|${g.finish || ''}`, [g.mat, g.finish || null]])).values()];
  for (const [mat, finish] of combos) {
    const gs = groups.filter((g) => g.mat === mat && (g.finish || null) === finish);
    if (mat in SHEETS) {
      const custom = opts.sheetCustom?.[mat];
      let choice = opts.sheetChoice?.[mat] === 'custom' && custom && custom.w > 0 && custom.l > 0 && SHEETS[mat].t > 3 ? 'custom' : opts.sheetChoice?.[mat] === 'alt' && SHEET_SIZES[mat] ? 'alt' : 'std';
      const items = gs
        .flatMap((g) => Array.from({ length: g.qty }, () => ({ label: g.label, name: g.name, disc: g.disc, l: g.l, w: g.w })))
        .sort((a, b) => b.l * b.w - a.l * a.w || b.l - a.l);
      let size = sheetSize(mat, choice, custom);
      let packed = packRects(items, size[0], size[1], kerf, rotate);
      let fellBack = false;
      if (choice === 'alt' && packed.unplaced.length) { // hay piezas que no caben en la plancha chica: se vuelve a la medida más usada
        choice = 'std'; fellBack = true; size = sheetSize(mat, 'std');
        packed = packRects(items, size[0], size[1], kerf, rotate);
      }
      const m = { ...SHEETS[mat], size, name: finish ? `${SHEETS[mat].name} · ${finish}` : SHEETS[mat].name };
      const { sheets, unplaced } = packed;
      const pieceArea = items.reduce((a, it) => a + it.l * it.w, 0);
      const sheetArea = m.size[0] * m.size[1];
      sheetPlans.push({
        mat, finish, key: `${mat}|${finish || ''}`, choice, fellBack, sheet: m, W: m.size[0], H: m.size[1], sheets, unplaced,
        pieceArea, usedPct: sheets.length ? (pieceArea / (sheets.length * sheetArea)) * 100 : 0,
        minSheets: Math.ceil(pieceArea / sheetArea),
      });
    } else {
      const lin = LINEARS[mat];
      const items = gs
        .flatMap((g) => Array.from({ length: g.qty }, () => ({ label: g.label, name: g.name, l: g.l })))
        .sort((a, b) => b.l - a.l);
      const { bars, unplaced } = packBars(items, lin.stock, kerf);
      const total = items.reduce((a, it) => a + it.l, 0);
      barPlans.push({ mat, lin, stock: lin.stock, bars, unplaced, usedPct: bars.length ? (total / (bars.length * lin.stock)) * 100 : 0 });
    }
  }
  return { groups, sheetPlans, barPlans, kerf, rotate };
}
