import { SHEETS, LINEARS } from './materials.js';
import { cm } from './util.js';

/**
 * Cuerpo de mueble tipo cajón: laterales, tapa, base, repisas, divisores,
 * trasera, base (zócalo/patas) y puertas. Las filas se definen de abajo hacia arriba.
 *
 * o = { mat, W, D, H?, rows:[{h?, cols, door}], base:'none'|'zocalo'|'patas', baseH,
 *       back:'none'|'hdf'|'rails', legMat, loadFactor }
 * Si todas las filas traen `h`, el alto total se calcula; si no, se reparte `H`.
 */
export function carcass(p, o) {
  const m = SHEETS[o.mat];
  const t = m.t;
  const { W, D } = o;
  const base = o.base || 'none';
  const baseH = base === 'none' ? 0 : o.baseH;
  const back = o.back || 'none';
  const rows = o.rows.map((r) => ({ cols: 1, ...r }));
  const n = rows.length;

  // --- alturas de fila ---
  const fixed = rows.reduce((a, r) => a + (r.h || 0), 0);
  const autos = rows.filter((r) => !r.h);
  if (autos.length) {
    const free = o.H - baseH - 2 * t - (n - 1) * t - fixed;
    const each = Math.max(60, free / autos.length);
    autos.forEach((r) => { r.h = each; });
  }
  const H = baseH + 2 * t + (n - 1) * t + rows.reduce((a, r) => a + r.h, 0);
  if (o.H && Math.abs(H - o.H) > 5) {
    p.warn(`El alto se ajustó a ${cm(H)} cm para que los niveles tengan al menos 6 cm libres.`);
  }

  const z0 = back === 'hdf' ? SHEETS.hdf3.t : 0; // la trasera HDF va por fuera
  const Db = D - z0;
  const y0 = base === 'zocalo' ? 0 : baseH; // con zócalo los laterales bajan hasta el piso
  const innerW = W - 2 * t;
  const mat = o.mat;

  // --- laterales, tapa y base ---
  p.V('Lateral', mat, 0, y0, z0, H - t - y0, Db, 'f');
  p.V('Lateral', mat, W - t, y0, z0, H - t - y0, Db, 'f');
  p.H('Tapa superior', mat, 0, H - t, z0, W, Db, 'flr');
  p.H('Base inferior', mat, t, baseH, z0, innerW, Db, 'f');
  p.joint(Db, 4);

  // --- filas: repisas, divisores y puertas ---
  let y = baseH + t;
  let dividers = 0;
  let dividerLen = 0;
  let doorCount = 0;
  let hinges = 0;
  rows.forEach((r, i) => {
    r.y = y;
    const c = r.cols;
    const cw = (innerW - (c - 1) * t) / c;
    r.cw = cw;
    if (i < n - 1) {
      p.H('Repisa', mat, t, y + r.h, z0, innerW, Db, 'f');
      p.joint(Db, 2);
    }
    for (let k = 1; k < c; k++) {
      // con travesaños traseros, los divisores de la fila superior/inferior se adelantan para no chocar
      const clearRail = back === 'rails' && (i === 0 || i === n - 1);
      p.V('Divisor', mat, t + k * cw + (k - 1) * t, y, clearRail ? z0 + t : z0, r.h, clearRail ? Db - t : Db, 'f');
      p.joint(Db, 2);
      dividers++;
      dividerLen += r.h;
    }
    if (r.door) {
      const nd = c > 1 ? c : Math.max(1, Math.ceil(cw / 600));
      const dw = (c > 1 ? cw : innerW / nd) - 3;
      for (let d = 0; d < nd; d++) {
        const x = c > 1 ? t + d * (cw + t) + 1.5 : t + d * (innerW / nd) + 1.5;
        p.B('Puerta', mat, x, y + 1.5, D - t, dw, r.h - 3, 'tulr');
      }
      doorCount += nd;
      hinges += nd * (r.h > 900 ? 3 : 2);
    }
    y += r.h + t;
  });

  // --- trasera ---
  if (back === 'hdf') {
    // si la trasera no cabe en una plancha de HDF, se divide en tramos iguales
    const [SL, SW] = SHEETS.hdf3.size;
    const fits = (a, b) => (a <= SW && b <= SL) || (b <= SW && a <= SL);
    const split = (x, y, w, h) => {
      if (fits(w, h)) return [[x, y, w, h]];
      return w >= h
        ? [...split(x, y, w / 2, h), ...split(x + w / 2, y, w / 2, h)]
        : [...split(x, y, w, h / 2), ...split(x, y + h / 2, w, h / 2)];
    };
    const pieces = split(0, baseH, W, H - baseH);
    pieces.forEach(([x, y, w, h]) => p.B('Trasera', 'hdf3', x, y, 0, w, h, ''));
    if (pieces.length > 1) p.tip(`La trasera es muy grande para una plancha de HDF: se divide en ${pieces.length} tramos.`);
    const fix = Math.ceil((2 * (W + H - baseH) + (n - 1) * W + dividerLen) / 150);
    p.hardware('Tornillo o clavo 3×16 mm (trasera)', fix, 'Fijación del panel trasero');
  } else if (back === 'rails') {
    const cap = n === 1 ? rows[0].h / 2 : Infinity; // con una sola fila, los dos travesaños se reparten el alto
    const topH = Math.min(100, rows[n - 1].h, cap);
    const botH = Math.min(100, rows[0].h, cap);
    p.B('Travesaño trasero', mat, t, H - t - topH, 0, innerW, topH, '');
    p.B('Travesaño trasero', mat, t, baseH + t, 0, innerW, botH, '');
    p.joint(innerW, 4);
  }

  // --- base ---
  if (base === 'zocalo') {
    p.B('Zócalo', mat, t, 0, D - 30 - t, innerW, baseH, 't');
    p.B('Zócalo', mat, t, 0, z0, innerW, baseH, '');
    p.hardware('Tornillo 4×40 mm', 8, 'Fijación del zócalo');
    p.hardware('Nivelador de patas regulable', 4, 'Bajo el mueble, para nivelar');
  } else if (base === 'patas') {
    const ins = 25;
    let leg = o.legMat || 'pino41';
    if (Db < 2 * (ins + LINEARS[leg].section[0]) + 20) {
      leg = 'pino41';
      p.tip('El fondo es poco para patas gruesas: se usaron patas de 2×2" (41×41 mm).');
    }
    const s = LINEARS[leg].section[0];
    for (const x of [ins, W - ins - s]) {
      for (const z of [z0 + ins, D - ins - s]) p.L('Pata', leg, 'y', baseH, x, 0, z);
    }
    p.hardware('Tornillo 5×50 mm', 8, 'Fijación de patas');
    p.hardware('Escuadra metálica de refuerzo 40 mm', 8, 'Unión patas–base');
  }

  // --- herrajes de puertas ---
  if (doorCount) {
    p.hardware('Bisagra de cazoleta 35 mm', hinges, 'Con base y tornillos');
    p.hardware('Tirador o jaladera', doorCount, '');
  }

  // --- avisos estructurales ---
  const over = [];
  rows.forEach((r, i) => {
    const limit = m.maxSpan * (r.load ?? o.loadFactor ?? 1);
    if (r.cw > limit) over.push({ i: i + 1, cw: r.cw, limit });
  });
  if (over.length) {
    const lv = over.map((x) => x.i);
    const worst = over.reduce((a, b) => (b.cw - b.limit > a.cw - a.limit ? b : a));
    const where = lv.length === rows.length && rows.length > 1 ? 'Todos los niveles' : lv.length === 1 ? `El nivel ${lv[0]}` : `Los niveles ${lv.join(', ')}`;
    p.warn(
      `${where} ${lv.length === 1 && rows.length > 1 ? 'tiene' : 'tienen'} un vano de hasta ${cm(worst.cw)} cm, sobre los ~${cm(worst.limit)} cm que aguanta ${m.name.toLowerCase()} con carga: la repisa puede combarse. Agrega un divisor/columna, reduce el ancho o usa un tablero más grueso.`,
    );
  }
  if (H / D >= 4 || (H >= 1400 && D <= 350)) {
    p.hardware('Kit anti-vuelco (escuadra + tarugo)', 2, 'Para fijar el mueble a la muralla');
    p.tip('Es un mueble alto y angosto: fíjalo a la muralla con el kit anti-vuelco.');
  }

  return { H, rows, innerW, z0, Db };
}
