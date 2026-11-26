import { SHEETS } from './materials.js';
import { legSpec, placeLeg, legHardware } from './legs.js';
import { placeHandle, handleSummary, hingeSide } from './handles.js';
import { cm } from './util.js';

/**
 * Cuerpo de mueble tipo cajón: laterales, tapa, base, repisas, divisores,
 * trasera, base (zócalo/patas) y puertas. Las filas se definen de abajo hacia arriba.
 *
 * o = { mat, W, D, H?, rows:[{h?, cols, door}], base:'none'|'zocalo'|'patas', baseH,
 *       back:'none'|'hdf'|'rails', leg (legSpec), handle (handleFromValues), loadFactor }
 * Si todas las filas traen `h`, el alto total se calcula; si no, se reparte `H`.
 */
export function carcass(p, o) {
  const m = SHEETS[o.mat];
  const t = m.t;
  const { W, D } = o;
  const base = o.base === 'ruedas' ? 'patas' : o.base || 'none'; // "ruedas" = patas que son ruedas (las trae o.leg)
  const back = o.back || 'none';
  // patas: si el fondo no alcanza para las gruesas, se usan las delgadas (se decide antes de calcular la altura de la base)
  let legSp = o.leg || legSpec('cuadrada', 'fino');
  let legIns = 25;
  let legShrunk = false;
  if (base === 'patas') {
    const dbEarly = D - (back === 'hdf' ? SHEETS.hdf3.t : 0);
    const fitsAt = (sp, ins) => dbEarly >= 2 * (ins + sp.s) + 20;
    legIns = fitsAt(legSp, 25) ? 25 : 10;
    if (!fitsAt(legSp, legIns) && legSp.size === 'grueso') {
      legSp = legSpec(legSp.style, 'fino', { h: legSp.h });
      legIns = fitsAt(legSp, 25) ? 25 : 10;
      legShrunk = true;
    }
    // patas en diagonal: se instalan un poco más hacia adentro, para que al abrirse no sobresalgan del mueble
    if (legSp.splay && fitsAt(legSp, 45)) legIns = 45;
  }
  const isCaster = base === 'patas' && legSp.kind === 'caster';
  const isProduct = base === 'patas' && legSp.kind === 'product';
  const baseH = base === 'none' ? 0 : isCaster || isProduct ? legSp.h : o.baseH; // con ruedas o patas listas, la altura la define el producto
  const rows = o.rows.map((r) => ({ cols: 1, ...r }));
  const n = rows.length;
  // vanos demasiado anchos para el tablero: se agregan divisores solos hasta que cada vano aguante la carga
  const autoAdded = [];
  rows.forEach((r, i) => {
    if (!(m.maxSpan > 0)) return;
    const limit = m.maxSpan * (r.load ?? o.loadFactor ?? 1) * 0.98;
    const need = Math.ceil((W - 2 * t + t) / (limit + t));
    if (need > r.cols && need <= 12) {
      autoAdded.push({ i: i + 1, from: r.cols, to: need });
      if (r.doorCells) { // las puertas se reubican: cada celda nueva hereda la puerta de la celda vieja que la contiene
        const old = r.cols;
        r.doorCells = Array.from({ length: need }, (_, k) => k).filter((k) => r.doorCells.includes(Math.min(old - 1, Math.floor(((k + 0.5) / need) * old))));
      }
      r.cols = need;
    }
  });

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
    p.tip(`El alto se ajustó a ${cm(H)} cm para que los niveles tengan al menos 6 cm libres.`);
  }

  const z0 = back === 'hdf' ? SHEETS.hdf3.t : 0; // la trasera MDF va por fuera
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
  const doorInfo = [];
  const handleFx = [];
  const hspec = o.handle || { type: 'barra', c2c: 128, orient: 'vertical', offX: 40, pctY: 75, hingeMode: 'auto' };
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
      // r.doorCells = lista de celdas (0, 1, 2…) que llevan puerta; sin lista, todas
      const cells = Array.from({ length: nd }, (_, d) => d).filter((d) => !r.doorCells || r.doorCells.includes(d));
      cells.forEach((d, k) => {
        const x = c > 1 ? t + d * (cw + t) + 1.5 : t + d * (innerW / nd) + 1.5;
        const door = p.B('Puerta', mat, x, y + 1.5, D - t, dw, r.h - 3, 'tulr');
        if (door) {
          const info = { id: door.id, x, y: y + 1.5, w: dw, h: r.h - 3, front: D, hinge: hingeSide(hspec.hingeMode, k, cells.length) };
          doorInfo.push(info);
          const fx = placeHandle(p, info, hspec);
          if (fx) handleFx.push(fx);
        }
      });
      doorCount += cells.length;
      hinges += cells.length * (r.h > 900 ? 3 : 2);
    }
    y += r.h + t;
  });

  // --- trasera ---
  if (back === 'hdf') {
    // si la trasera no cabe en una plancha de MDF de 3 mm, se divide en tramos iguales
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
    if (pieces.length > 1) p.tip(`La trasera es muy grande para una plancha de MDF de 3 mm: se divide en ${pieces.length} tramos.`);
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
    const spec = legSp;
    const ins = legIns;
    if (legShrunk) p.tip('El fondo es poco para patas gruesas: se usaron las delgadas.');
    const s = spec.s;
    for (const x of [ins, W - ins - s]) {
      for (const z of [z0 + ins, D - ins - s]) {
        placeLeg(p, spec, x, 0, z, baseH, { out: [x === ins ? -1 : 1, z === z0 + ins ? -1 : 1], maxOut: ins + s / 2 - 8 });
      }
    }
    legHardware(p, spec, 4, baseH);
    if (isProduct) p.tip(`Las patas son un producto listo de ${baseH / 10} cm de alto fijo (se compran así, no se cortan): la medida "Alto de la base" no aplica.`);
    if (isCaster) p.tip(`La altura de la base la define la rueda: ${baseH / 10} cm (la medida "Alto de la base" no aplica).`);
  }

  // --- herrajes de puertas ---
  if (doorCount) {
    p.hardware('Bisagra de cazoleta 35 mm', hinges, 'Con base y tornillos');
    handleSummary(p, hspec, doorInfo, handleFx);
  }

  if (autoAdded.length) {
    const lv = autoAdded.map((a) => a.i);
    const where = lv.length === rows.length && rows.length > 1 ? 'en todos los niveles' : `en ${lv.length === 1 ? 'el nivel' : 'los niveles'} ${lv.join(', ')}`;
    p.tip(`Se agregaron divisores automáticos ${where} para que las repisas no se combe con ${m.name.toLowerCase()}: los vanos quedan de hasta ${cm(Math.max(...rows.map((r) => r.cw)))} cm.`);
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
