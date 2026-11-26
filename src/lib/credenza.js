import { SHEETS } from './materials.js';
import { legSpec, placeLeg, legHardware } from './legs.js';
import { placeHandle, handleSummary, hingeSide } from './handles.js';
import { cm } from './util.js';

/**
 * Credenza para vinilos: a un lado, el módulo del tocadiscos (plataforma baja con respaldo y,
 * debajo, el compartimento del receiver con puerta); al otro, celdas verticales para los discos.
 *
 * o = { mat, W, D, H, platformH, Wt, side:'izq'|'der', cols, rows, front:'puerta'|'abierto',
 *       base:'none'|'patas'|'ruedas', baseH, leg, handle }
 * H = altura total (lado de los vinilos); platformH = altura de la plataforma del tocadiscos; Wt = ancho del módulo del tocadiscos.
 */
export function credenza(p, o) {
  const t = SHEETS[o.mat].t;
  const { W, D, Wt } = o;
  let H = o.H;
  const izq = o.side !== 'der';
  const back = SHEETS.hdf3.t;
  const z0 = back;
  const Db = D - z0;
  const hspec = o.handle;

  // ---- base ----
  let base = o.base || 'none';
  let leg = o.leg || legSpec('inclinada', 'fino');
  let ins = 25;
  if (base === 'patas' || base === 'ruedas') {
    const fits = (sp, i) => Db >= 2 * (i + sp.s) + 20;
    ins = fits(leg, 25) ? 25 : 10;
    if (!fits(leg, ins) && leg.size === 'grueso') leg = legSpec(leg.style, 'fino', { h: leg.h });
    if (leg.splay && fits(leg, 45)) ins = 45; // diagonales: más hacia adentro para que al abrirse no sobresalgan
  }
  const baseH = base === 'none' ? 0 : leg.kind === 'caster' || leg.kind === 'product' ? leg.h : o.baseH;
  // el compartimento del receiver necesita ≥ 20 cm libres: si la plataforma está muy baja, se sube (y el alto total, si hace falta)
  const needPlat = baseH + 3 * t + 200 - t;
  let platformH = o.platformH;
  if (platformH < needPlat) { platformH = needPlat; p.tip(`Se subió la plataforma a ${cm(platformH)} cm para que el receiver tenga 20 cm libres de alto.`); }
  if (H < platformH + 250) { H = platformH + 250; p.tip(`Se aumentó el alto total a ${cm(H)} cm para dejar 25 cm de respaldo sobre la plataforma.`); }
  const innerBottom = baseH + t; // piso interior (sobre la base)
  const ttTop = platformH - t; // cara inferior de la plataforma

  // ---- posiciones en x ----
  const divX = izq ? Wt - t : W - Wt; // divisor entre módulos
  const ttOuterX = izq ? 0 : W - t; // lateral exterior del tocadiscos
  const cubOuterX = izq ? W - t : 0; // lateral exterior de los vinilos
  const ttI0 = izq ? t : W - Wt + t; // interior del módulo del tocadiscos
  const ttI1 = izq ? Wt - t : W - t;
  const cubI0 = izq ? Wt : t; // interior del módulo de vinilos
  const cubI1 = izq ? W - t : W - Wt;
  const ttW = ttI1 - ttI0;
  const cubW = cubI1 - cubI0;

  // ---- estructura ----
  p.H('Base inferior', o.mat, t, baseH, z0, W - 2 * t, Db, 'f');
  p.V('Lateral', o.mat, ttOuterX, baseH, z0, ttTop - baseH, Db, 'ft'); // llega bajo la plataforma
  p.V('Lateral', o.mat, cubOuterX, baseH, z0, H - t - baseH, Db, 'f');
  p.V('Divisor central', o.mat, divX, innerBottom, z0, H - t - innerBottom, Db, 'f');
  // plataforma del tocadiscos (cubre su lateral y llega hasta el divisor)
  const platX0 = izq ? 0 : divX + t;
  p.H('Plataforma del tocadiscos', o.mat, platX0, ttTop, z0, izq ? divX : W - platX0, Db, 'flr');
  // tapa del lado de los vinilos (cubre divisor y lateral)
  const topX0 = izq ? divX : 0;
  p.H('Tapa superior', o.mat, topX0, H - t, z0, izq ? W - divX : divX + t, Db, 'flr');
  // respaldo detrás del tocadiscos
  const riserX0 = izq ? 0 : divX + t;
  p.B('Respaldo del tocadiscos', o.mat, riserX0, platformH, 0, izq ? divX : W - riserX0, H - platformH, 'tul');
  p.joint(Db, 8);

  // ---- traseras (MDF 3 mm) ----
  const ttBackX0 = izq ? 0 : divX + t;
  p.B('Trasera', 'hdf3', ttBackX0, baseH, 0, izq ? divX : W - ttBackX0, ttTop - baseH, '');
  p.B('Trasera', 'hdf3', izq ? divX : 0, baseH, 0, izq ? W - divX : divX + t, H - t - baseH, '');
  p.hardware('Tornillo o clavo 3×16 mm (trasera)', Math.ceil((2 * (W + H)) / 150), 'Fijación del panel trasero');

  // ---- módulo de vinilos: celdas ----
  const rows = Math.max(1, o.rows || 1);
  const innerTop = H - t;
  const rowH = (innerTop - innerBottom - (rows - 1) * t) / rows;
  const cols = Math.max(1, o.cols);
  const cw = (cubW - (cols - 1) * t) / cols;
  let y = innerBottom;
  for (let r = 0; r < rows; r++) {
    if (r > 0) p.H('Repisa', o.mat, cubI0, y - t, z0, cubW, Db, 'f');
    for (let k = 1; k < cols; k++) p.V('Divisor', o.mat, cubI0 + k * cw + (k - 1) * t, y, z0, rowH, Db, 'f');
    y += rowH + t;
  }
  p.joint(Db, 2 * (cols - 1) * rows + 2 * (rows - 1));

  // ---- compartimento del receiver: puerta o abierto ----
  const ttH = ttTop - innerBottom; // alto libre del compartimento
  const fronts = [];
  const hfx = [];
  let hinges = 0;
  if (o.front === 'puerta') {
    const nd = Math.max(1, Math.ceil(ttW / 600));
    const dw = ttW / nd - 3;
    for (let d = 0; d < nd; d++) {
      const x = ttI0 + (ttW / nd) * d + 1.5;
      const door = p.B('Puerta', o.mat, x, innerBottom + 1.5, D - t, dw, ttH - 3, 'tulr');
      if (door) {
        const info = { id: door.id, x, y: innerBottom + 1.5, w: dw, h: ttH - 3, front: D, hinge: hingeSide(hspec.hingeMode, d, nd) };
        fronts.push(info);
        const fx = placeHandle(p, info, hspec);
        if (fx) hfx.push(fx);
      }
    }
    hinges = nd * 2;
    p.hardware('Bisagra de cazoleta 35 mm', hinges, 'Con base y tornillos');
    handleSummary(p, hspec, fronts, hfx);
  }

  // ---- patas / ruedas ----
  if (base === 'patas' || base === 'ruedas') {
    const s = leg.s;
    for (const x of [ins, W - ins - s]) {
      for (const z of [z0 + ins, D - ins - s]) {
        placeLeg(p, leg, x, 0, z, baseH, { out: [x === ins ? -1 : 1, z === z0 + ins ? -1 : 1], maxOut: ins + s / 2 - 8 });
      }
    }
    legHardware(p, leg, 4, baseH);
    if (base === 'ruedas') p.tip(`La altura de la base la define la rueda: ${baseH / 10} cm.`);
  }

  // ---- avisos y datos útiles ----
  p.tip(`Plataforma del tocadiscos: ${cm(ttW + t)} × ${cm(D)} cm, con ${cm(H - platformH)} cm de respaldo. Un tocadiscos típico mide ~43 × 36 cm.`);
  p.tip(`Compartimento del receiver: ${cm(ttH)} cm de alto libre × ${cm(ttW)} cm de ancho. Deja la trasera ventilada si el equipo se calienta.`);
  if (rowH < 330) p.tip(`Cada celda de vinilos tiene ${cm(rowH)} cm de alto: los discos tendrán que ir inclinados o de canto.`);
  const lps = cols * rows * Math.round((cw / 10) * 2);
  p.tip(`Capacidad aproximada: ${lps} vinilos (2 por cm de ancho libre).`);
  if (cw > 450) p.tip('Celdas muy anchas: agrega un divisor para que los discos no se tumben.');
  return { ttW, cubW, cw, rowH, ttH };
}
