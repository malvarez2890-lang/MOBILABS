import { PartList } from './parts.js';
import { SHEETS } from './materials.js';
import { cm } from './util.js';

/**
 * Muebles de terraza y living: bancas, mesa de centro de listones y sofás de vigas (o de tablero/MDF).
 * Medidas en mm: x = ancho, y = alto, z = fondo (z = 0 atrás, el frente en z máximo).
 */
const outdoorResult = (p, outdoor) => { const r = p.result(); r.outdoor = outdoor; return r; };

// ---------------------------------------------------------------- BANCA
export function buildBanca(v) {
  const p = new PartList();
  const W = v.ancho * 10;
  const D = v.fondo * 10;
  const Hs = v.altoAsiento * 10;
  const estilo = v.estilo || 'respaldo';
  if (estilo === 'tablero') {
    const mat = v.mat;
    const t = SHEETS[mat].t;
    const layers = 2;
    const topT = t * layers;
    const sideH = Hs - topT;
    const zi = 20;
    for (const x of [60, W - 60 - t]) {
      const s = p.V('Costado', mat, x, 0, zi, sideH, D - 2 * zi, 'f');
      if (s) { s.shape = 'vnotchV'; s.notchH = Math.round(sideH * 0.3); s.notchW = Math.round((D - 2 * zi) * 0.45); }
    }
    for (let l = 0; l < layers; l++) p.H('Tapa', mat, 0, Hs - t * (l + 1), 0, W, D, 'frbl');
    const ax0 = 60 + t;
    const aw = W - 120 - 2 * t;
    p.B('Faldón', mat, ax0, Hs - topT - 90, zi, aw, 90, 'u');
    p.B('Faldón', mat, ax0, Hs - topT - 90, D - zi - t, aw, 90, 'u');
    p.joint(D, 4);
    p.joint(90, 4);
    p.hardware('Tornillo 4×30 mm (unir capas de la tapa)', Math.ceil((W * D) / 40000), 'Además de cola');
    p.tip('Los costados llevan una muesca en V abajo: márcala con lápiz y córtala con caladora (en el despiece salen como rectángulo).');
    if (W > 1500) p.tip('Banca de más de 1,5 m: pon un tercer costado al centro si va a llevar mucho peso.');
    return outdoorResult(p, false);
  }
  const plank = 'pino45x95';
  const leg = 'pino70';
  const s = 70;
  if (estilo === 'cruzada') {
    // tapa de tablones sobre dos travesaños; en cada extremo, dos patas que se cruzan a ambos lados del travesaño
    // (no se cortan a media madera: van una por fuera y otra por dentro, con un taco al medio) y un travesaño bajo
    // que une las dos X para que la banca no se ladee. Las patas llevan cortes horizontales arriba y abajo.
    const yTop = Hs - 45;
    const n = Math.max(2, Math.floor((D + 10) / (95 + 10)));
    const gap = n > 1 ? (D - n * 95) / (n - 1) : 0;
    for (let k = 0; k < n; k++) p.L('Tablón de asiento', plank, 'x', W, 0, yTop, k * (95 + gap), 'y');
    const cy = yTop - 95;
    const cxs = [110, W - 110 - 45];
    for (const cx of cxs) p.L('Travesaño de tapa', plank, 'z', D - 40, cx, cy, 20);
    const h = yTop; // las patas suben hasta tocar los tablones
    const zLo = 40;
    const zHi = D - 40;
    const dz0 = (zHi - zLo) * 0.62; // abertura de la X (distancia entre el centro de arriba y el de abajo de cada pata)
    const a = Math.atan(dz0 / h);
    const wz = 95 / Math.cos(a); // ancho horizontal del corte
    const span = dz0 + wz;
    const z0 = D / 2 - span / 2;
    const L = h / Math.cos(a) + 95 * Math.tan(a); // largo de la pieza antes de los cortes en ángulo
    const leg = (x, dir) => p._push({ name: 'Pata en X', mat: plank, kind: 'linear', min: [x, 0, z0], size: [45, h, span], cut: { l: Math.round(L * 10) / 10 }, edges: [], skew: { wz, dir } });
    for (const cx of cxs) {
      const outer = cx === cxs[0] ? cx - 45 : cx + 45; // por fuera del travesaño
      const inner = cx === cxs[0] ? cx + 45 : cx - 45; // por dentro
      leg(outer, 1);
      leg(inner, -1);
      p.L('Taco separador', plank, 'x', 45, cx, h / 2 - 47.5, D / 2 - 22.5); // entre las dos patas, en el cruce
    }
    const sx0 = cxs[0] + 90;
    const sx1 = cxs[1] - 45;
    p.L('Travesaño bajo', plank, 'x', sx1 - sx0, sx0, h / 2 - 47.5, D / 2 - 22.5);
    p.hardware('Tornillo para madera 5×80 mm', n * 4 + 4, 'Tablones a los travesaños (con cola)');
    p.hardware('Perno coche 8×140 mm con tuerca', 10, '2 por pata arriba (atraviesa pata y travesaño) y 1 en cada cruce (pata, taco y pata)');
    p.hardware('Tornillo para madera 6×120 mm', 4, 'Travesaño bajo a las patas interiores (2 por lado)');
    p.tip(`Patas en X a ${Math.round((a * 180) / Math.PI)}°: corta los extremos de cada pata en ángulo para que apoyen planos en el piso y bajo los tablones. Una pata va por fuera y otra por dentro del travesaño, unidas con un taco y un perno en el cruce; el travesaño bajo une las dos X y evita que la banca se ladee.`);
    return outdoorResult(p, true);
  }
  // respaldo (por defecto): patas de 3×3", tablones de 2×4", respaldo de dos tablas
  const Hb = Math.max(Hs + 300, (v.altoRespaldo || 85) * 10);
  const seatY = Hs - 45;
  const x0 = 40;
  const x1 = W - 40 - s;
  const zF = D - 40 - s;
  for (const x of [x0, x1]) {
    p.L('Pata delantera', leg, 'y', seatY, x, 0, zF);
    p.L('Pata trasera', leg, 'y', Hb, x, 0, 0);
  }
  p.L('Faldón', plank, 'x', x1 - x0 - s, x0 + s, seatY - 95, D - 40 - 45);
  p.L('Faldón', plank, 'x', x1 - x0 - s, x0 + s, seatY - 95, s - 45);
  for (const x of [x0, x1 + s - 45]) {
    p.L('Faldón lateral', plank, 'z', zF - s, x, seatY - 95, s);
    p.L('Travesaño lateral', plank, 'z', zF - s, x, 120, s);
  }
  const n = Math.max(2, Math.floor((D - s + 10) / (95 + 10)));
  const gap = n > 1 ? (D - s - n * 95) / (n - 1) : 0;
  for (let k = 0; k < n; k++) p.L('Tablón de asiento', plank, 'x', W, 0, seatY, s + k * (95 + gap), 'y');
  const boards = 2;
  for (let k = 0; k < boards; k++) p.L('Tabla de respaldo', 'pino19x90', 'x', x1 + s - x0, x0, Hb - 90 - k * 130, s);
  p.hardware('Tornillo para madera 5×80 mm', 16 + n * 4, 'Estructura y tablones (con cola)');
  p.hardware('Tornillo para madera 4×50 mm', boards * 4, 'Tablas del respaldo');
  p.tip(`Banca de ${cm(W)} cm: caben ~${Math.max(2, Math.floor(W / 450))} personas.`);
  return outdoorResult(p, true);
}

// ---------------------------------------------------------------- MESA DE CENTRO DE LISTONES (tipo pallet)
export function buildMesaCentroListones(v) {
  const p = new PartList();
  const W = v.ancho * 10;
  const D = v.fondo * 10;
  const H = v.alto * 10;
  const s = 70;
  const topY = H - 19;
  for (const x of [0, W - s]) for (const z of [0, D - s]) p.L('Pata', 'pino70', 'y', topY, x, 0, z);
  // faldones bajo la tapa
  p.L('Faldón', 'pino45x95', 'x', W - 2 * s, s, topY - 95, 0);
  p.L('Faldón', 'pino45x95', 'x', W - 2 * s, s, topY - 95, D - 45);
  p.L('Faldón lateral', 'pino45x95', 'z', D - 2 * s, 0, topY - 95, s);
  p.L('Faldón lateral', 'pino45x95', 'z', D - 2 * s, W - 45, topY - 95, s);
  // tapa de listones (1×4" planos, 8 mm entre sí)
  const n = Math.max(3, Math.floor((D + 8) / (90 + 8)));
  const g = (D - n * 90) / (n - 1);
  for (let k = 0; k < n; k++) p.L('Listón de tapa', 'pino19x90', 'x', W, 0, topY, k * (90 + g), 'y');
  let lower = 0;
  if (v.repisa !== false) { // repisa baja de listones sobre dos travesaños
    const ly = 70;
    p.L('Travesaño de repisa', 'pino45x95', 'x', W - 2 * s, s, ly, 0);
    p.L('Travesaño de repisa', 'pino45x95', 'x', W - 2 * s, s, ly, D - 45);
    lower = Math.max(3, Math.floor((W - 2 * s + 10) / (90 + 10)));
    const g2 = (W - 2 * s - lower * 90) / (lower - 1);
    for (let k = 0; k < lower; k++) p.L('Listón de repisa', 'pino19x90', 'z', D, s + k * (90 + g2), ly + 95, 0, 'y');
  }
  p.hardware('Tornillo para madera 5×80 mm', 16, 'Patas y faldones (con cola)');
  p.hardware('Tornillo para madera 4×40 mm', (n + lower) * 2, 'Listones de la tapa y la repisa');
  p.tip('Estilo pallet: lija bien los cantos de los listones y deja 8 mm entre ellos para que escurra el agua si va en terraza.');
  return outdoorResult(p, true);
}

// ---------------------------------------------------------------- SOFÁ / SILLÓN
export function buildSofa(v) {
  const p = new PartList();
  const plazas = Math.max(1, Math.min(3, v.plazas || 2));
  const ap = v.anchoPlaza * 10;
  const D = v.fondo * 10;
  const Hs = v.altoAsiento * 10; // estructura del asiento (sin cojín)
  const armH = Math.max(Hs + 150, v.altoBrazo * 10);
  const Hb = Math.max(armH, v.altoRespaldo * 10, Hs + 300); // el respaldo sube al menos 30 cm sobre el asiento
  const cushions = v.cojines !== false;
  if (v.estructura === 'tablero') {
    const mat = v.mat;
    const t = SHEETS[mat].t;
    const W = plazas * ap + 2 * t;
    for (const x of [0, W - t]) p.V('Costado', mat, x, 0, 0, armH, D, 'ft');
    p.B('Respaldo', mat, t, 0, 0, W - 2 * t, Hb, 't');
    p.H('Base del asiento', mat, t, Hs - t, t, W - 2 * t, D - t, 'f');
    p.B('Frente', mat, t, 60, D - t, W - 2 * t, Hs - t - 60, '');
    if (plazas > 1) for (let k = 1; k < plazas; k++) p.V('Apoyo central', mat, t + k * ap - t / 2, 60, t, Hs - t - 60, D - 2 * t, '');
    p.joint(D, 6);
    p.joint(W, 3);
    addCushions(p, { x0: t, W: W - 2 * t, plazas, seatY: Hs, z0: t, D: D - t, Hb, on: cushions });
    p.tip('Sofá de tablero: en MDF o terciado, sella todos los cantos y píntalo o enchápalo; para exterior usa terciado marino o pino.');
    return outdoorResult(p, false);
  }
  // vigas de pino: postes 3×3", baranda de 2×4", asiento y respaldo de listones
  const s = 70;
  const W = plazas * ap + 2 * s;
  const railTop = armH - 45;
  for (const x of [0, W - s]) {
    p.L('Poste delantero', 'pino70', 'y', railTop, x, 0, D - s);
    p.L('Poste trasero', 'pino70', 'y', Hb, x, 0, 0);
    p.L('Brazo', 'pino45x95', 'z', D - s, x === 0 ? s - 95 : W - s, railTop, s, 'y'); // al ras por dentro: sobresale hacia afuera
  }
  // costados: listones horizontales o tablas macizas apiladas
  const sideZ = D - 2 * s;
  const yLow = 90;
  if (v.brazos === 'macizos') {
    const rows = Math.floor((railTop - yLow) / 95);
    for (const x of [0, W - s]) for (let k = 0; k < rows; k++) p.L('Tabla de costado', 'pino45x95', 'z', sideZ, x + (s - 45) / 2, railTop - 95 * (k + 1), s);
  } else {
    const rows = Math.max(2, Math.floor((railTop - yLow) / 150));
    const step = (railTop - yLow - 90) / Math.max(1, rows - 1);
    for (const x of [0, W - s]) for (let k = 0; k < rows; k++) p.L('Listón de costado', 'pino19x90', 'z', sideZ, x + (s - 19) / 2, yLow + k * step, s);
  }
  // asiento: travesaños adelante y atrás, listones de fondo a frente
  const seatSlatY = Hs - 19;
  const railY = seatSlatY - 95;
  p.L('Travesaño del asiento', 'pino45x95', 'x', W - 2 * s, s, railY, D - s + (s - 45) / 2);
  p.L('Travesaño del asiento', 'pino45x95', 'x', W - 2 * s, s, railY, (s - 45) / 2);
  let mids = 0;
  if (plazas >= 3) { // patas centrales para que el asiento no flecte
    mids = 1;
    const mx = W / 2 - s / 2;
    p.L('Pata central', 'pino70', 'y', railY, mx, 0, D - s);
    p.L('Pata central', 'pino70', 'y', railY, mx, 0, 0);
  }
  const nS = Math.max(4, Math.floor((W - 2 * s + 15) / (90 + 15)));
  const gS = (W - 2 * s - nS * 90) / (nS - 1);
  for (let k = 0; k < nS; k++) p.L('Listón de asiento', 'pino19x90', 'z', D - (s - 45), s + k * (90 + gS), seatSlatY, (s - 45) / 2, 'y');
  // respaldo de listones horizontales entre los postes traseros
  const availB = Hb - 90 - (Hs + 60);
  const nB = Math.max(1, Math.floor(availB / 115) + 1); // listones de 9 cm con al menos 2,5 cm entre ellos
  const stepB = nB > 1 ? availB / (nB - 1) : 0;
  for (let k = 0; k < nB; k++) p.L('Listón de respaldo', 'pino19x90', 'x', W - 2 * s, s, Hs + 60 + k * stepB, (s - 19) / 2);
  addCushions(p, { x0: s, W: W - 2 * s, plazas, seatY: Hs, z0: s, D: D - s, Hb, on: cushions });
  p.hardware('Tornillo para madera 5×80 mm', 24 + mids * 4, 'Postes, brazos y travesaños (con cola)');
  p.hardware('Tornillo para madera 4×40 mm', (nS + nB) * 2 + 24, 'Listones de asiento, respaldo y costados');
  p.tip(`${plazas === 1 ? 'Sillón' : `Sofá de ${plazas} cuerpos`} de vigas: ${cm(W)} cm de largo. Para exterior usa pino impregnado o protégelo con aceite con filtro UV cada año.`);
  return outdoorResult(p, true);
}

/** Cojines de asiento y respaldo por cuerpo (se compran a medida). */
function addCushions(p, { x0, W, plazas, seatY, z0, D, Hb, on }) {
  if (!on) return;
  const cw = W / plazas;
  const backT = 130;
  const seatD = D - backT - 10;
  const backH = Math.max(250, Hb - seatY - 120 + 60);
  for (let k = 0; k < plazas; k++) {
    const x = x0 + k * cw + 5;
    p.fixture({ kind: 'cushion', min: [x, seatY, z0 + backT + 5], size: [cw - 10, 110, seatD] });
    p.fixture({ kind: 'cushion', min: [x, seatY + 110, z0 + 5], size: [cw - 10, backH, backT] });
  }
  const r = (mm) => Math.round(mm / 10);
  p.hardware(`Cojín de asiento a medida ${r(cw - 10)}×${r(seatD)}×11 cm`, plazas, 'Espuma de alta densidad con funda para exterior (desmontable)');
  p.hardware(`Cojín de respaldo a medida ${r(cw - 10)}×${r(backH)}×13 cm`, plazas, 'Funda para exterior');
}
