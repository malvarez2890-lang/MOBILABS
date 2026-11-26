import { SHEETS, LINEARS } from './materials.js';
import { r1, rotatedBox, tiltedBox } from './util.js';

const edgeLengths = (str, map) =>
  [...str].map((c) => map[c]).filter((v) => v > 0).map(r1);

/**
 * Sistema de coordenadas (mm): x = ancho (izq→der), y = alto (suelo→arriba),
 * z = fondo (0 = parte trasera, + = frente). Cada pieza es una caja con
 * esquina mínima `min` y tamaño `size`.
 */
export class PartList {
  constructor() {
    this.parts = [];
    this.fixtures = []; // piezas que se dibujan pero no se cortan: tiradores, ruedas, patas metálicas
    this.hw = new Map();
    this.notes = []; // {level:'warn'|'info', text}
    this.conf = 0;
  }

  _push(part) {
    if (part.size.some((s) => !(s > 0.4))) return null; // pieza degenerada
    part.id = 'p' + this.parts.length;
    part.min = part.min.map(r1);
    part.size = part.size.map(r1);
    part.center = part.min.map((m, i) => m + part.size[i] / 2);
    if (part.rot) part.aabb = rotatedBox(part.min, part.size, part.rot); // pieza inclinada: caja envolvente para medir el mueble
    this.parts.push(part);
    return part;
  }

  /** Panel horizontal (espesor en y). w = largo en x, d = largo en z. */
  H(name, mat, x, y, z, w, d, edge = 'f') {
    const m = SHEETS[mat];
    return this._push({
      name, mat, kind: 'sheet', min: [x, y, z], size: [w, m.t, d],
      cut: { l: r1(Math.max(w, d)), w: r1(Math.min(w, d)), t: m.t },
      edges: m.edge ? edgeLengths(edge, { f: w, b: w, l: d, r: d }) : [],
    });
  }

  /** Panel vertical lateral (espesor en x). h = alto, d = fondo. */
  V(name, mat, x, y, z, h, d, edge = 'f') {
    const m = SHEETS[mat];
    return this._push({
      name, mat, kind: 'sheet', min: [x, y, z], size: [m.t, h, d],
      cut: { l: r1(Math.max(h, d)), w: r1(Math.min(h, d)), t: m.t },
      edges: m.edge ? edgeLengths(edge, { f: h, b: h, t: d, u: d }) : [],
    });
  }

  /** Panel vertical frontal/trasero (espesor en z). w = ancho, h = alto. */
  B(name, mat, x, y, z, w, h, edge = '') {
    const m = SHEETS[mat];
    return this._push({
      name, mat, kind: 'sheet', min: [x, y, z], size: [w, h, m.t],
      cut: { l: r1(Math.max(w, h)), w: r1(Math.min(w, h)), t: m.t },
      edges: m.edge ? edgeLengths(edge, { t: w, u: w, l: h, r: h }) : [],
    });
  }

  /** Tapa redonda (disco). (cx, cz) = centro, y = cara inferior, d = diámetro. */
  C(name, mat, cx, y, cz, d, edge = true) {
    const m = SHEETS[mat];
    return this._push({
      name, mat, kind: 'sheet', shape: 'disc', min: [cx - d / 2, y, cz - d / 2], size: [d, m.t, d],
      cut: { l: r1(d), w: r1(d), t: m.t }, edges: m.edge && edge ? [r1(Math.PI * d)] : [],
    });
  }

  /** Listón de pino inclinado (pata en diagonal). top = centro de su cara superior; drop = altura vertical que salva. */
  T(name, mat, top, drop, tilt, extra = {}) {
    const [tn, wd] = LINEARS[mat].section;
    const b = tiltedBox(top, drop, tilt, wd, tn);
    return this._push({ name, mat, kind: 'linear', min: b.min, size: b.size, cut: { l: r1(b.L) }, edges: [], rot: b.rot, ...extra });
  }

  /** Listón de pino. axis = eje del largo; thin = eje donde va el lado delgado. */
  L(name, mat, axis, len, x, y, z, thin, extra = {}) {
    const [tn, wd] = LINEARS[mat].section;
    let size;
    if (axis === 'y') size = thin === 'x' ? [tn, len, wd] : [wd, len, tn];
    else if (axis === 'x') size = thin === 'y' ? [len, tn, wd] : [len, wd, tn];
    else size = thin === 'y' ? [wd, tn, len] : [tn, wd, len];
    return this._push({
      name, mat, kind: 'linear', min: [x, y, z], size, cut: { l: r1(len) }, edges: [], ...extra,
    });
  }

  /** Elemento visible que no entra al despiece. f = { kind, min, size, parent?, noBbox?, ... } */
  fixture(f) {
    f.id = 'f' + this.fixtures.length;
    f.min = f.min.map(r1);
    f.size = f.size.map(r1);
    if (f.rot) f.aabb = rotatedBox(f.min, f.size, f.rot);
    this.fixtures.push(f);
    return f;
  }

  hardware(name, qty, note = '') {
    if (!(qty > 0)) return;
    const e = this.hw.get(name) || { qty: 0, note };
    e.qty += qty;
    if (note) e.note = note;
    this.hw.set(name, e);
  }

  /** Registra una unión entre tableros con tornillos confirmat (≈ 1 cada 25 cm). */
  joint(len, count = 1) {
    this.conf += Math.max(2, Math.ceil(len / 250)) * count;
  }

  warn(text) { this.notes.push({ level: 'warn', text }); }
  tip(text) { this.notes.push({ level: 'info', text }); }

  result() {
    if (this.conf > 0) {
      this.hardware('Tornillo confirmat 7×50 mm', this.conf, 'Uniones entre tableros');
      this.hardware('Tarugo de madera 8×30 mm', this.conf, 'Alineación de las uniones');
      this.hardware('Tapa cubre-confirmat', this.conf, 'Color a juego con el tablero');
    }
    this.hardware('Cola fría para madera', 1, 'Frasco de 250 ml');
    const min = [Infinity, Infinity, Infinity];
    const max = [-Infinity, -Infinity, -Infinity];
    for (const p of this.parts) {
      const b = p.aabb || p;
      for (let i = 0; i < 3; i++) {
        min[i] = Math.min(min[i], b.min[i]);
        max[i] = Math.max(max[i], b.min[i] + b.size[i]);
      }
    }
    for (const f of this.fixtures) {
      if (f.noBbox) continue;
      const b = f.aabb || f;
      for (let i = 0; i < 3; i++) {
        min[i] = Math.min(min[i], b.min[i]);
        max[i] = Math.max(max[i], b.min[i] + b.size[i]);
      }
    }
    if (min[1] < 0) min[1] = 0; // las patas inclinadas no bajan del piso
    const dims = this.parts.length ? [max[0] - min[0], max[1] - min[1], max[2] - min[2]] : [0, 0, 0];
    return {
      parts: this.parts,
      fixtures: this.fixtures,
      hardware: [...this.hw].map(([name, v]) => ({ name, qty: Math.ceil(v.qty), note: v.note })),
      notes: this.notes,
      bbox: { min, max, dims },
    };
  }
}
