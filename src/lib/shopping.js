import { SHEETS } from './materials.js';
import { cm, fmt } from './util.js';

/** Lista de compras (sin precios) a partir del mueble y el plan de corte. */
export function buildShopping(model, plans) {
  const issues = [];

  const sheets = plans.sheetPlans.map((sp) => {
    sp.unplaced.forEach((u) =>
      issues.push(`La pieza "${u.name}" (${fmt(u.l)} × ${fmt(u.w)} mm) no cabe en una plancha de ${sp.W} × ${sp.H} mm de ${sp.sheet.name}. Divídela o elige otro tablero.`));
    return {
      id: sp.mat, name: sp.sheet.name, size: `${sp.W} × ${sp.H} mm`, count: sp.sheets.length,
      usedPct: sp.usedPct, minSheets: sp.minSheets,
    };
  });

  const bars = plans.barPlans.map((bp) => {
    bp.unplaced.forEach((u) =>
      issues.push(`El listón "${u.name}" (${fmt(u.l)} mm) es más largo que el largo comercial de ${bp.stock} mm.`));
    return { id: bp.mat, name: bp.lin.name, stock: `${bp.stock} mm`, count: bp.bars.length, usedPct: bp.usedPct };
  });

  // tapacanto por espesor
  const edge = {};
  for (const p of model.parts) {
    if (!p.edges.length) continue;
    const t = SHEETS[p.mat].t;
    edge[t] = (edge[t] || 0) + p.edges.reduce((a, b) => a + b, 0);
  }
  const edging = Object.entries(edge).map(([t, mm]) => ({
    width: Number(t) >= 18 ? 22 : 19,
    meters: mm / 1000,
    buy: Math.ceil((mm / 1000) * 1.1),
    thickness: Number(t),
  }));

  return { sheets, bars, edging, hardware: model.hardware, issues };
}

/** Texto plano para copiar / enviar por WhatsApp. */
export function shoppingText(title, dims, shop) {
  const L = [];
  L.push(`${title} — ${cm(dims[0])} × ${cm(dims[1])} × ${cm(dims[2])} cm (ancho × alto × fondo)`);
  L.push('', 'TABLEROS');
  shop.sheets.forEach((s) => L.push(`• ${s.count} × ${s.name} (plancha ${s.size})`));
  if (shop.bars.length) {
    L.push('', 'MADERA EN LISTÓN');
    shop.bars.forEach((b) => L.push(`• ${b.count} × ${b.name}, largo ${b.stock}`));
  }
  if (shop.edging.length) {
    L.push('', 'TAPACANTO');
    shop.edging.forEach((e) => L.push(`• ~${e.buy} m de tapacanto de ${e.width} mm (melamina ${e.thickness} mm)`));
  }
  L.push('', 'HERRAJES E INSUMOS');
  shop.hardware.forEach((h) => L.push(`• ${h.qty} × ${h.name}`));
  return L.join('\n');
}
