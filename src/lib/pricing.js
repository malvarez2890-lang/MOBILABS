import { SHEETS } from './materials.js';
/**
 * Costo aproximado de la lista de compras.
 * Los precios por defecto son VALORES DE EJEMPLO en pesos chilenos (CLP), solo para tener un orden de magnitud:
 * no vienen de ninguna tienda. El usuario los reemplaza con los de su proveedor y quedan guardados en su navegador.
 */
export const PRICE_NOTE =
  'Precios de ejemplo en pesos chilenos (CLP), solo para tener un orden de magnitud: no vienen de ninguna tienda. Edita cada precio con el de tu proveedor; se guardan en este navegador.';

const SHEET_DEFAULT = { mel18: 42000, mel15: 33000, mdf18: 36000, mdf15: 30000, ter18: 52000, ter15: 42000, hdf3: 11000 }; // por plancha de la medida más usada
const BAR_DEFAULT = { pino41: 6500, pino70: 15000, pino19x90: 7000, pino19x42: 3800, redonda45: 9500, redonda70: 17000 }; // por listón
const EDGE_PER_M = 450; // tapacanto, por metro

// reglas por nombre del herraje, de lo más específico a lo más general
const HW_RULES = [
  // los tornillos primero: sus nombres mencionan lo que fijan ("… (correderas)", "… (placas)")
  [/^tornillo o clavo/i, 12], [/^tornillo/i, 30], [/^clavo/i, 12],
  [/confirmat/i, 70], [/^tarugo/i, 25], [/^tapa cubre/i, 15], [/^cola fr[ií]a.*1 kg/i, 6500], [/^cola fr[ií]a/i, 3500],
  [/^bisagra/i, 1500], [/^jaladera de barra/i, 3500], [/^perilla/i, 1800], [/^perfil tirador de canto/i, 7500], [/^pist[oó]n/i, 2500],
  [/^nivelador/i, 900], [/^corredera/i, 6500],
  [/^rueda giratoria.*freno/i, 6500], [/^rueda giratoria/i, 4500],
  [/^pata met[aá]lica tubular/i, 8500], [/^pata de acero en diagonal/i, 10500], [/^tubo de acero/i, 4500],
  [/^placa de montaje|^placa o escuadra/i, 1800], [/^escuadra met[aá]lica/i, 700], [/^kit anti-vuelco/i, 1500],
  [/^barniz|^sellador/i, 9000], [/^lija/i, 1500], [/^cera/i, 2500], [/^chapa de madera/i, 12000], [/^tapacanto de chapa/i, 900], [/^tope/i, 1500],
];

export const keyOfSheet = (id, choice, finish) => `sheet:${id}${choice === 'alt' ? ':alt' : choice === 'custom' ? ':custom' : ''}${finish ? `:${finish}` : ''}`;
export const keyOfBar = (id) => `bar:${id}`;
export const keyOfEdge = (width, finish) => `edge:${width}${finish ? `:${finish}` : ''}`;
export const keyOfHardware = (name) => `hw:${name.trim().toLowerCase()}`;

const hwDefault = (name) => {
  const pata = /^pata de madera.*?(\d+(?:[.,]\d+)?) cm/i.exec(name); // pata lista: el precio sube con el alto
  if (pata) { const h = Number(pata[1].replace(',', '.')); return h >= 60 ? 14000 : h >= 35 ? 8000 : h >= 20 ? 4500 : 3000; }
  const r = HW_RULES.find(([re]) => re.test(name));
  return r ? r[1] : null;
};

/**
 * Valoriza la lista de compras. prices = { clave: precio } con lo que el usuario cambió.
 * Devuelve grupos de filas, total y cuántas filas quedaron sin precio.
 */
export function priceShop(shop, prices = {}) {
  const row = (key, label, detail, qty, unitLabel, def, extra = '') => {
    const own = prices[key];
    const edited = own !== undefined && own !== null && own !== '' && Number.isFinite(Number(own));
    const unit = edited ? Number(own) : def;
    return { key, label, detail, extra, qty, unitLabel, unit, edited, missing: unit == null, subtotal: unit == null ? 0 : unit * qty };
  };
  const groups = [
    {
      id: 'tableros', title: 'Tableros',
      rows: shop.sheets.map((s) => row(keyOfSheet(s.id, s.choice, s.finish), s.name, `plancha ${s.size}`, s.count, 'plancha', SHEET_DEFAULT[s.id] != null ? Math.round((SHEET_DEFAULT[s.id] * s.area) / (SHEETS[s.id].size[0] * SHEETS[s.id].size[1]) / 100) * 100 : null, `Aprovechamiento ${s.usedPct.toFixed(0)} %`)),
    },
    {
      id: 'madera', title: 'Madera en listón',
      rows: shop.bars.map((b) => row(keyOfBar(b.id), b.name, `largo ${b.stock}`, b.count, 'listón', BAR_DEFAULT[b.id] ?? null, `Aprovechamiento ${b.usedPct.toFixed(0)} %`)),
    },
    {
      id: 'tapacanto', title: 'Tapacanto',
      rows: shop.edging.map((e) => row(keyOfEdge(e.width, e.finish), `Tapacanto de ${e.width} mm${e.finish ? ` · ${e.finish}` : ''}`, `para melamina de ${e.thickness} mm`, e.buy, 'metro', EDGE_PER_M, `${e.meters.toFixed(1).replace('.', ',')} m medidos + 10 % de margen`)),
    },
    {
      id: 'herrajes', title: 'Herrajes e insumos',
      rows: shop.hardware.map((h) => row(keyOfHardware(h.name), h.name, h.note || '', h.qty, 'unidad', hwDefault(h.name))),
    },
  ].filter((g) => g.rows.length);
  groups.forEach((g) => { g.subtotal = g.rows.reduce((a, r) => a + r.subtotal, 0); });
  const rows = groups.flatMap((g) => g.rows);
  return {
    groups,
    total: groups.reduce((a, g) => a + g.subtotal, 0),
    missing: rows.filter((r) => r.missing).length,
    estimated: rows.filter((r) => !r.edited && !r.missing).length, // con precio de ejemplo (no editado)
    edited: rows.filter((r) => r.edited).length,
  };
}

export const fmtCLP = (n) => `$ ${Math.round(n).toLocaleString('es-CL')}`;

// Nombres como se venden en Chile (para buscar en tiendas); el rótulo de la app es descriptivo y no sirve de búsqueda textual.
const SHEET_TERM = {
  mel18: 'melamina 18 mm', mel15: 'melamina 15 mm', mdf18: 'mdf crudo 18 mm', mdf15: 'mdf crudo 15 mm',
  ter18: 'terciado estructural 18 mm', ter15: 'terciado 15 mm', hdf3: 'mdf 3 mm',
};
const BAR_TERM = {
  pino41: 'pino cepillado 2x2 41x41 mm', pino70: 'pino cepillado 3x3 70x70 mm', pino19x90: 'pino cepillado 1x4 19x90 mm',
  pino19x42: 'pino cepillado 1x2 19x42 mm', redonda45: 'varilla redonda pino 45 mm', redonda70: 'varilla redonda pino 70 mm',
};
const HW_TERMS = [
  [/^tapa cubre/i, 'tapa cubre tornillo confirmat adhesiva'], [/^tornillo confirmat/i, 'tornillo confirmat 7x50'], [/^tornillo o clavo 3/i, 'clavo 3x16 mm para trasera mdf'],
  [/^tornillo 4×40/i, 'tornillo madera 4x40 mm'], [/^tornillo (\d)×(\d+)/i, (m) => `tornillo madera ${m[1]}x${m[2]} mm`],
  [/^tarugo/i, 'tarugo madera 8x30 mm'], [/^cola fr[ií]a.*1 kg/i, 'cola fria 1 kg'], [/^cola fr[ií]a/i, 'cola fria carpintero 250 ml'],
  [/^bisagra/i, 'bisagra cazoleta 35 mm cierre suave'], [/^jaladera de barra.*?(\d+) ?mm/i, (m) => `tirador barra ${m[1]} mm`],
  [/^jaladera/i, 'tirador barra 128 mm'], [/^perilla/i, 'perilla mueble'], [/^perfil tirador/i, 'perfil tirador gola aluminio'],
  [/^pist[oó]n/i, 'piston a gas mueble'], [/^nivelador/i, 'nivelador pata mueble regulable'],
  [/^corredera/i, 'corredera telescopica cajon 45 cm'], [/^rueda giratoria.*freno/i, 'rueda giratoria con freno placa'], [/^rueda giratoria/i, 'rueda giratoria mueble placa'],
  [/^pata de madera.*?(\d+(?:[.,]\d+)?) cm/i, (m) => `pata madera conica ${Number(m[1].replace(',', '.')) * 10} mm`],
  [/^pata met[aá]lica/i, 'pata metalica mueble'], [/^pata de acero en diagonal/i, 'pata metalica mueble inclinada'], [/^tubo de acero/i, 'tubo cuadrado acero 30x30'],
  [/^placa de montaje/i, 'placa montaje pata mueble'], [/^escuadra met[aá]lica/i, 'escuadra metalica refuerzo 40 mm'],
  [/^kit anti-vuelco|^anti-vuelco/i, 'kit antivuelco muebles'], [/^chapa de madera natural (\S+)/i, (m) => `chapa de madera ${m[1].toLowerCase()} 64 x 250`], [/^tapacanto de chapa natural (\S+)/i, (m) => `tapacanto chapa natural ${m[1].toLowerCase()}`], [/^barniz.*chapa/i, 'barniz poliuretano mate interior'], [/^cera/i, 'cera para madera'], [/^barniz/i, 'barniz poliuretano interior'], [/^sellador/i, 'sellador madera'], [/^lija/i, 'lija madera grano 120'],
];
/** Nombre comercial chileno para buscar un ítem de la lista de compras (a partir de la clave de precio y el rótulo). */
export function searchTerm(key = '', label = '', detail = '') {
  if (key.startsWith('sheet:')) {
    const nums = (/(\d+) × (\d+)/.exec(detail) || []).slice(1).map(Number); // "plancha 2500 × 1830 mm"
    const dim = nums.length ? ` ${(nums[1] / 1000).toFixed(2).replace('.', ',')} x ${(nums[0] / 1000).toFixed(2).replace('.', ',')}` : '';
    const finish = key.split(':').slice(2).filter((x) => x !== 'alt' && x !== 'custom')[0];
    return (SHEET_TERM[key.split(':')[1]] || label) + (finish ? ` ${finish.toLowerCase()}` : '') + dim;
  }
  if (key.startsWith('bar:')) return BAR_TERM[key.slice(4)] || label;
  if (key.startsWith('edge:')) { const [, w, f] = key.split(':'); return `tapacanto melamina ${w} mm${f ? ` ${f.toLowerCase()}` : ''}`; }
  for (const [re, t] of HW_TERMS) {
    const m = re.exec(label);
    if (m) return typeof t === 'function' ? t(m) : t;
  }
  return label;
}
const slug = (t) => t.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().replace(/[^a-z0-9,]+/g, '-').replace(/^-|-$/g, '');
/** Enlaces de búsqueda en tiendas chilenas (abren en otra pestaña). */
export const storeLinks = (term) => [
  ...(/chapa/.test(term) ? [{ name: 'Tienda Revs', url: `https://www.tiendarevs.cl/?s=${encodeURIComponent(term)}&post_type=product` }] : []),
  { name: 'Sodimac', url: `https://www.sodimac.cl/sodimac-cl/search?Ntt=${encodeURIComponent(term)}` },
  { name: 'Mercado Libre', url: `https://listado.mercadolibre.cl/${slug(term)}` },
  { name: 'Google', url: `https://www.google.com/search?q=${encodeURIComponent(`${term} precio Chile`)}` },
];
export const searchUrl = (text) => storeLinks(text).find((l) => l.name === 'Google').url;

/** CSV de precios para llevarlos a una planilla: clave;nombre;cantidad;precio unitario */
export function pricesToCsv(priced) {
  const rows = [['clave', 'nombre', 'cantidad', 'precio_unitario_clp']];
  priced.groups.forEach((g) => g.rows.forEach((r) => rows.push([r.key, r.label, r.qty, r.unit ?? ''])));
  return rows.map((r) => r.map((c) => `"${String(c).replace(/"/g, '""')}"`).join(';')).join('\n');
}

/** Lee un CSV exportado (o armado a mano con la columna "clave") y devuelve { clave: precio }. */
export function pricesFromCsv(text) {
  const out = {};
  for (const line of text.replace(/^﻿/, '').split(/\r?\n/).slice(1)) {
    if (!line.trim()) continue;
    const cells = [...line.matchAll(/"((?:[^"]|"")*)"|([^;]+)/g)].map((m) => (m[1] !== undefined ? m[1].replace(/""/g, '"') : m[2]));
    const key = cells[0];
    const price = Number(String(cells[3] ?? '').replace(/[^\d.,-]/g, '').replace(/\./g, '').replace(',', '.'));
    if (key && /^(sheet|bar|edge|hw):/.test(key) && Number.isFinite(price) && cells[3] !== '') out[key] = price;
  }
  return out;
}
