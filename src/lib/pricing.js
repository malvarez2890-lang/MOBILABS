/**
 * Costo aproximado de la lista de compras.
 * Los precios por defecto son VALORES DE EJEMPLO en pesos chilenos (CLP), solo para tener un orden de magnitud:
 * no vienen de ninguna tienda. El usuario los reemplaza con los de su proveedor y quedan guardados en su navegador.
 */
export const PRICE_NOTE =
  'Precios de ejemplo en pesos chilenos (CLP), solo para tener un orden de magnitud: no vienen de ninguna tienda. Edita cada precio con el de tu proveedor; se guardan en este navegador.';

const SHEET_DEFAULT = { mel18: 42000, mel15: 33000, mdf18: 36000, ter18: 52000, ter15: 42000, hdf3: 11000 }; // por plancha
const BAR_DEFAULT = { pino41: 6500, pino70: 15000, pino19x90: 7000, pino19x42: 3800, redonda45: 9500, redonda70: 17000 }; // por listón
const EDGE_PER_M = 450; // tapacanto, por metro

// reglas por nombre del herraje, de lo más específico a lo más general
const HW_RULES = [
  // los tornillos primero: sus nombres mencionan lo que fijan ("… (correderas)", "… (placas)")
  [/^tornillo o clavo/i, 12], [/^tornillo/i, 30], [/^clavo/i, 12],
  [/confirmat/i, 70], [/^tarugo/i, 25], [/^tapa cubre/i, 15], [/^cola fr[ií]a/i, 3500],
  [/^bisagra/i, 1500], [/^jaladera de barra/i, 3500], [/^perilla/i, 1800], [/^perfil tirador de canto/i, 7500], [/^pist[oó]n/i, 2500],
  [/^nivelador/i, 900], [/^corredera/i, 6500],
  [/^rueda giratoria.*freno/i, 6500], [/^rueda giratoria/i, 4500],
  [/^pata met[aá]lica tubular/i, 8500], [/^pata de acero en diagonal/i, 10500], [/^tubo de acero/i, 4500],
  [/^placa de montaje|^placa o escuadra/i, 1800], [/^escuadra met[aá]lica/i, 700], [/^kit anti-vuelco/i, 1500],
  [/^barniz|^sellador/i, 9000], [/^lija/i, 1500],
];

export const keyOfSheet = (id) => `sheet:${id}`;
export const keyOfBar = (id) => `bar:${id}`;
export const keyOfEdge = (width) => `edge:${width}`;
export const keyOfHardware = (name) => `hw:${name.trim().toLowerCase()}`;

const hwDefault = (name) => {
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
      rows: shop.sheets.map((s) => row(keyOfSheet(s.id), s.name, `plancha ${s.size}`, s.count, 'plancha', SHEET_DEFAULT[s.id] ?? null, `Aprovechamiento ${s.usedPct.toFixed(0)} %`)),
    },
    {
      id: 'madera', title: 'Madera en listón',
      rows: shop.bars.map((b) => row(keyOfBar(b.id), b.name, `largo ${b.stock}`, b.count, 'listón', BAR_DEFAULT[b.id] ?? null, `Aprovechamiento ${b.usedPct.toFixed(0)} %`)),
    },
    {
      id: 'tapacanto', title: 'Tapacanto',
      rows: shop.edging.map((e) => row(keyOfEdge(e.width), `Tapacanto de ${e.width} mm`, `para melamina de ${e.thickness} mm`, e.buy, 'metro', EDGE_PER_M, `${e.meters.toFixed(1).replace('.', ',')} m medidos + 10 % de margen`)),
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

/** Búsqueda de referencia en la web (abre en otra pestaña). */
export const searchUrl = (text) => `https://www.google.com/search?q=${encodeURIComponent(`${text} precio Chile`)}`;

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
