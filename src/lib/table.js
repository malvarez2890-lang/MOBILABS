import { SHEETS } from './materials.js';
import { legSpec, placeLeg, legHardware } from './legs.js';

/** Apila `layers` tableros formando una tapa más gruesa. yTop = cara superior. */
export function stackTop(p, mat, layers, x, yTop, z, w, d, edge) {
  const t = SHEETS[mat].t;
  for (let l = 0; l < layers; l++) p.H('Tapa', mat, x, yTop - t * (l + 1), z, w, d, edge);
}

/**
 * Mesa con patas de pino, faldones y tapa de tablero.
 * o = { W, D, H, mat, layers, leg (legSpec de madera), casters (legSpec 'ruedas' | null), oh (voladizo), shelf:{y}|null }
 */
export function tableFrame(p, o) {
  const { W, D, H, mat } = o;
  const spec = o.leg && o.leg.kind === 'wood' ? o.leg : legSpec('cuadrada', 'fino');
  const layers = o.layers || 1;
  const t = SHEETS[mat].t;
  const topT = t * layers;
  const s = spec.s;
  const aT = 19; // grosor del faldón
  const aH = 90; // alto del faldón
  const oh = Math.max(0, Math.min(o.oh, (Math.min(W, D) - 2 * s - 120) / 2));

  stackTop(p, mat, layers, 0, H, 0, W, D, 'frbl');
  if (layers > 1) {
    p.hardware('Tornillo 4×30 mm (unir capas de la tapa)', Math.ceil((W * D) / 40000), 'Además de cola');
  }

  // con ruedas, las patas se acortan: cada una apoya sobre una rueda y la altura total no cambia
  const caster = o.casters && o.casters.kind === 'caster' ? o.casters : null;
  const cH = caster ? caster.h : 0;
  const legLen = H - topT - cH;
  const cs = caster ? Math.min(caster.s, s) : 0; // la placa de la rueda no sobresale de la pata
  for (const x of [oh, W - oh - s]) {
    for (const z of [oh, D - oh - s]) {
      placeLeg(p, spec, x, cH, z, legLen, { head: aH + 10 });
      if (caster) p.fixture({ kind: 'caster', min: [x + (s - cs) / 2, 0, z + (s - cs) / 2], size: [cs, cH, cs], wheelD: caster.wheelD });
    }
  }
  if (caster) legHardware(p, caster, 4, cH);

  const yA = H - topT - aH;
  const innerX = W - 2 * oh - 2 * s;
  const innerZ = D - 2 * oh - 2 * s;
  p.L('Faldón largo', 'pino19x90', 'x', innerX, oh + s, yA, oh);
  p.L('Faldón largo', 'pino19x90', 'x', innerX, oh + s, yA, D - oh - aT);
  p.L('Faldón corto', 'pino19x90', 'z', innerZ, oh, yA, oh + s);
  p.L('Faldón corto', 'pino19x90', 'z', innerZ, W - oh - aT, yA, oh + s);

  // travesaños centrales para tapas largas
  const nCross = Math.max(0, Math.floor(innerX / 800));
  for (let k = 1; k <= nCross; k++) {
    const x = oh + s + (innerX * k) / (nCross + 1) - aT / 2;
    p.L('Travesaño central', 'pino19x90', 'z', D - 2 * oh - 2 * aT, x, yA, oh + aT);
  }

  // repisa inferior apoyada en soportes
  if (o.shelf) {
    const maxY = H - topT - aH - t - 60; // la repisa queda por debajo de los faldones
    const y = Math.max(cH + 60, Math.min(o.shelf.y, maxY));
    const sx = oh + s;
    const sz = oh + s;
    p.H('Repisa inferior', mat, sx, y, sz, innerX, innerZ, 'f');
    p.L('Soporte de repisa', 'pino19x42', 'z', innerZ, sx, y - 42, sz);
    p.L('Soporte de repisa', 'pino19x42', 'z', innerZ, W - oh - s - aT, y - 42, sz);
    p.hardware('Tornillo 4×40 mm', 8, 'Soportes de repisa');
  }

  const joints = 2 * (4 + nCross);
  p.hardware('Tarugo de madera 8×30 mm', joints * 2, 'Uniones faldón–pata');
  p.hardware('Tornillo 4×50 mm', joints * 2, 'Uniones faldón–pata (con cola)');
  const esc = 6 + 2 * nCross;
  p.hardware('Escuadra metálica de fijación de tapa', esc, 'Une la tapa a los faldones');
  p.hardware('Tornillo 4×16 mm', esc * 2, 'Fijación de tapa');

  if (layers === 1 && W * D > 1400000) {
    p.warn('La tapa de un solo tablero es muy grande y puede flectar: usa tapa doble o un tablero más grueso.');
  }
  return { oh, s, topT, legLen, yA, nCross };
}
