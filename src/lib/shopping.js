import { SHEETS } from './materials.js';
import { cm, fmt } from './util.js';

/** Lista de compras (sin precios) a partir del mueble y el plan de corte. */
export function buildShopping(model, plans) {
  const issues = [];

  const sheets = plans.sheetPlans.map((sp) => {
    sp.unplaced.forEach((u) =>
      issues.push(`La pieza "${u.name}" (${fmt(u.l)} × ${fmt(u.w)} mm) no cabe en una plancha de ${sp.W} × ${sp.H} mm de ${sp.sheet.name}. Divídela o elige otro tablero.`));
    return {
      id: sp.mat, finish: sp.finish || null, choice: sp.choice, area: sp.W * sp.H, name: sp.sheet.name, size: `${sp.W} × ${sp.H} mm`, count: sp.sheets.length,
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
    const k = `${t}|${p.finish || ''}`; // el tapacanto va del mismo tono que la melamina
    edge[k] = (edge[k] || 0) + p.edges.reduce((a, b) => a + b, 0);
  }
  const edging = Object.entries(edge).map(([k, mm]) => {
    const [t, finish] = k.split('|');
    return { width: Number(t) >= 18 ? 22 : 19, meters: mm / 1000, buy: Math.ceil((mm / 1000) * 1.1), thickness: Number(t), finish: finish || null };
  });

  // terminaciones: la madera de pino y los tableros crudos (MDF, terciado) no vienen terminados
  const extra = [];
  const mats = new Set(model.parts.map((p) => p.mat));
  const rawBoards = ['mdf18', 'ter18', 'ter15'].filter((m) => mats.has(m));
  const pine = model.parts.some((p) => p.kind === 'linear');
  const veneer = model.veneer;
  const paintBoards = veneer ? rawBoards.filter((m) => !/^mdf/.test(m)) : rawBoards;
  if (paintBoards.length) {
    extra.push({ name: 'Sellador y pintura o barniz para MDF / terciado (1 galón)', qty: 1, note: 'Estos tableros vienen sin terminación; los cantos se pintan o se enchapan' });
  }
  if (veneer) { // MDF enchapado: chapas de 0,64 × 2,50 m por ambas caras, tapacanto de chapa en los cantos y cola fría
    const mdf = model.parts.filter((p) => /^mdf/.test(p.mat) && p.kind === 'sheet');
    const area = mdf.reduce((a, p) => a + 2 * (p.cut.l * p.cut.w) / 1e6, 0);
    const sheetsV = Math.max(1, Math.ceil((area * 1.15) / (0.64 * 2.5)));
    const edgeM = mdf.reduce((a, p) => a + (p.edgeWant || []).reduce((x, y) => x + y, 0), 0) / 1000;
    extra.push({ name: `Chapa de madera natural ${veneer.name} 0,64 × 2,50 m`, qty: sheetsV, note: `Ambas caras de las piezas de MDF (${area.toFixed(1).replace('.', ',')} m² + 15 % de pérdida)` });
    if (edgeM > 0) extra.push({ name: `Tapacanto de chapa natural ${veneer.name} 22 mm (metro)`, qty: Math.ceil(edgeM * 1.1), note: 'Para los cantos vistos; se pega con plancha' });
    extra.push({ name: 'Cola fría para madera 1 kg (enchapado)', qty: Math.max(1, Math.ceil(area / 6)), note: 'Capa fina con esponja o brocha de pelo fino en el MDF y en la chapa' });
    extra.push({ name: 'Barniz o aceite para la chapa (1 litro)', qty: 1, note: 'Protege la chapa una vez lijada' });
  }
  if (pine) {
    extra.push({ name: 'Barniz, aceite o pintura para la madera de pino (1 galón)', qty: 1, note: 'Para patas, faldones y listones' });
  }
  if (pine || rawBoards.length) extra.push({ name: 'Lija grano 120 y 180 (pliegos)', qty: 4, note: veneer ? 'Para la chapa usa grano fino (180–240) y lija suave, a favor de la veta' : 'Antes de aplicar la terminación' });
  const hardware = [...model.hardware, ...extra.filter((e) => !model.hardware.some((h) => h.name === e.name))];
  return { sheets, bars, edging, hardware, issues };
}

/** Texto plano para copiar / enviar por WhatsApp. */
export function shoppingText(title, dims, shop, priced) {
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
  if (priced) {
    L.push('', `COSTO APROXIMADO: $ ${Math.round(priced.total).toLocaleString('es-CL')} CLP`);
    L.push(priced.missing ? `(${priced.missing} ítems sin precio; precios de ejemplo salvo los que editaste)` : '(precios de ejemplo salvo los que editaste)');
  }
  return L.join('\n');
}
