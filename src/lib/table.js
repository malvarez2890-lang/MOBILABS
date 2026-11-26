import { SHEETS } from './materials.js';
import { legSpec, placeLeg, legHardware } from './legs.js';

/** Apila `layers` tableros formando una tapa más gruesa. yTop = cara superior. */
export function stackTop(p, mat, layers, x, yTop, z, w, d, edge) {
  const t = SHEETS[mat].t;
  for (let l = 0; l < layers; l++) p.H('Tapa', mat, x, yTop - t * (l + 1), z, w, d, edge);
}

const steelTube = (p, min, size) => p.fixture({ kind: 'metalLeg', min, size, tube: true });

/**
 * Mesa: tapa (rectangular o redonda), patas (madera recta, afinada, redonda, inclinada o de acero) y faldones;
 * o bien marco de acero en U. Con repisa inferior apoyada y atornillada a un marco de listones.
 * o = { W, D, H, mat, layers, leg, casters, oh, shelf:{y}|null, round:boolean }   (round: W es el diámetro)
 */
export function tableFrame(p, o) {
  const { W, D, mat } = o;
  const spec = o.leg || legSpec('cuadrada', 'fino');
  const round = !!o.round;
  const steelFrame = spec.kind === 'metalFrame';
  const splay = !!spec.splay;
  let layers = o.layers || 1;
  const bigTop = W * D > (spec.kind === 'product' ? 1000000 : 1400000); // tapa grande: un solo tablero flecta
  if (layers === 1 && bigTop && !(round && o.plankTop)) { layers = 2; p.tip('La tapa es grande: se usó tapa doble automáticamente (dos tableros pegados) para que no flecte.'); }
  const t = SHEETS[mat].t;
  const plank = round && !!o.plankTop; // tapa redonda hecha con listones de pino encolados y cortada con caladora
  if (plank) layers = 1;
  const topT = plank ? 19 : t * layers;
  const product = spec.kind === 'product'; // patas listas: alto fijo; la altura total = pata + tapa
  const H = product ? spec.h + topT : o.H;
  const s = spec.s;
  const aT = 19; // grosor del faldón
  const aH = 90; // alto del faldón
  // tapa redonda: las patas quedan sobre un cuadrado inscrito (a ~55 % del radio); rectangular: retranqueo elegido
  const oh = round ? Math.max(0, (W - (0.55 * W + s)) / 2) : Math.max(0, Math.min(o.oh, (Math.min(W, D) - 2 * s - 120) / 2));
  // patas en diagonal: el retranqueo crece lo necesario para que se abran ~8° sin sobresalir de la tapa (cada eje con su límite)
  const want = splay ? Math.ceil((H - topT) * Math.tan((spec.splay * Math.PI) / 180) - s / 2 + 12) : 0;
  const ohx = splay && !round ? Math.max(0, Math.min(Math.max(oh, want), (W - 2 * s - 120) / 2)) : oh;
  const ohz = splay && !round ? Math.max(0, Math.min(Math.max(oh, want), (D - 2 * s - 40) / 2)) : oh;

  if (plank) {
    // listones de 1×4" (19×90) canto con canto; cada uno se corta al largo que necesita su posición (cuerda del círculo + margen para la caladora)
    const bw = 90;
    const r = W / 2;
    const n = Math.ceil(W / bw);
    const x0 = (W - n * bw) / 2;
    let count = 0;
    let glue = 0;
    for (let i = 0; i < n; i++) {
      const a = x0 + i * bw;
      const b = a + bw;
      const dmin = a <= r && b >= r ? 0 : Math.min(Math.abs(a - r), Math.abs(b - r));
      if (dmin >= r - 20) continue;
      const len = Math.min(W + 40, 2 * Math.sqrt(r * r - dmin * dmin) + 40);
      p.L('Tapa de listones', 'pino19x90', 'z', len, a, H - 19, D / 2 - len / 2, 'y');
      count++;
      glue += len;
    }
    p.hardware('Tarugo de madera 8×30 mm', Math.ceil(glue / 150), 'Unión canto con canto de los listones de la tapa');
    p.tip(`Tapa redonda de listones: encola ${count} listones de pino canto con canto (con tarugos, 24 h bajo prensa o sargentos), traza el círculo de Ø${Math.round(W / 10)} cm con un compás de varilla (clavo al centro + lápiz a ${Math.round(W / 20)} cm), córtalo con caladora y lija el canto. Cada listón ya viene con el largo justo + 2 cm de margen.`);
  } else if (round) {
    for (let l = 0; l < layers; l++) p.C('Tapa', mat, W / 2, H - t * (l + 1), D / 2, W);
  } else {
    stackTop(p, mat, layers, 0, H, 0, W, D, 'frbl');
  }
  if (layers > 1) {
    p.hardware('Tornillo 4×30 mm (unir capas de la tapa)', Math.ceil((W * D) / 40000), 'Además de cola');
  }

  // ---------------------------------------------------------------- patas listas (producto de alto fijo)
  if (product) {
    for (const x of [oh, W - oh - s]) {
      for (const z of [oh, D - oh - s]) placeLeg(p, spec, x, 0, z, spec.h);
    }
    legHardware(p, spec, 4, spec.h);
    p.hardware('Tornillo 4×16 mm', 16, 'Fijación de las placas bajo la tapa');
    p.tip(`Las patas son un producto listo de ${spec.h / 10} cm: el alto total de la mesa queda en ${Math.round(H) / 10} cm (pata + tapa) y no se puede regular.`);
    if (o.shelf) p.tip('Con patas listas no se agrega repisa inferior: no hay marco donde atornillarla.');
    if (o.casters) p.tip('Las ruedas no se combinan con patas listas.');
    if (W * D > 1000000) p.tip('Una tapa grande sobre 4 patas con placa queda menos rígida que con faldones: prefiere patas gruesas o fija bien las placas.');
    return { oh, ohx: oh, ohz: oh, s, topT, legLen: spec.h, yA: spec.h, nCross: 0 };
  }

  // ruedas: solo con patas rectas de madera (las patas se acortan y la altura total no cambia)
  const caster = !splay && !steelFrame && o.casters && o.casters.kind === 'caster' ? o.casters : null;
  if (o.casters && !caster) p.tip('Las ruedas solo se pueden poner con patas rectas de madera.');
  const cH = caster ? caster.h : 0;
  const legTop = H - topT;
  const legLen = legTop - cH;

  // repisa inferior: no combina con patas abiertas (la altura útil cambia con la inclinación)
  let shelf = o.shelf;
  if (shelf && splay) {
    p.tip('Con patas en diagonal no se agrega la repisa inferior: el espacio entre patas cambia con la altura.');
    shelf = null;
  }
  const maxShelfY = legTop - aH - t - 60; // por debajo de los faldones
  const shelfY = shelf ? Math.max(cH + 60 + 42, Math.min(shelf.y, maxShelfY)) : 0; // cara inferior de la repisa

  // ---------------------------------------------------------------- marco de acero en U
  if (steelFrame) {
    const tt = s;
    const xs = [ohx, W - ohx - tt];
    const zs = [ohz, D - ohz - tt];
    let totalMm = 0;
    const tube = (min, size) => { steelTube(p, min, size); totalMm += Math.max(...size); };
    for (const x of xs) {
      for (const z of zs) tube([x, tt, z], [tt, legTop - 2 * tt, tt]); // postes
      tube([x, legTop - tt, ohz], [tt, tt, D - 2 * ohz]); // riel superior (bajo la tapa)
      tube([x, 0, ohz], [tt, tt, D - 2 * ohz]); // riel inferior (apoya en el piso)
    }
    tube([xs[0] + tt, legTop - tt, zs[0]], [W - 2 * ohx - 2 * tt, tt, tt]); // travesaño que une los dos marcos
    if (shelf) {
      for (const x of xs) tube([x, shelfY - tt, ohz], [tt, tt, D - 2 * ohz]); // rieles donde apoya la repisa
      p.H('Repisa inferior', mat, ohx, shelfY, ohz + tt, W - 2 * ohx, D - 2 * ohz - 2 * tt, 'f');
      p.hardware('Tornillo 4×20 mm (repisa a los rieles)', 8, 'Se atornilla desde abajo');
    }
    p.hardware(`${spec.label} (corte a medida)`, Math.ceil(totalMm / 1000), 'Metros lineales; pedir a un taller de metalmecánica, pintado negro mate');
    p.hardware('Placa o escuadra para fijar la tapa al marco', 6, 'Con tornillos');
    p.hardware('Tornillo 4×16 mm', 12, 'Fijación de tapa');
    p.tip('El marco de acero se manda a hacer a un taller con las medidas indicadas; la tapa se atornilla a los rieles superiores.');
    return { oh: ohx, ohx, ohz, s, topT, legLen: legTop, yA: legTop - tt, nCross: 0 };
  }

  // ---------------------------------------------------------------- patas de madera / acero + faldones
  // tope cuadrado a la altura del marco de la repisa, para que haya una cara plana donde unir listones
  const blocks = shelf ? [[shelfY - 42 - 8 - cH, shelfY - cH + 8]] : undefined;
  for (const x of [ohx, W - ohx - s]) {
    for (const z of [ohz, D - ohz - s]) {
      placeLeg(p, spec, x, cH, z, legLen, {
        head: aH + 10, blocks, out: [x === ohx ? -1 : 1, z === ohz ? -1 : 1], maxOut: Math.min(ohx, ohz) + s / 2 - 10,
      });
      if (caster) p.fixture({ kind: 'caster', min: [x + (s - Math.min(caster.s, s)) / 2, 0, z + (s - Math.min(caster.s, s)) / 2], size: [Math.min(caster.s, s), cH, Math.min(caster.s, s)], wheelD: caster.wheelD });
    }
  }
  if (caster) legHardware(p, caster, 4, cH);
  if (spec.kind === 'metal') legHardware(p, spec, 4, legLen);

  const yA = legTop - aH;
  const innerX = W - 2 * ohx - 2 * s;
  const innerZ = D - 2 * ohz - 2 * s;
  p.L('Faldón largo', 'pino19x90', 'x', innerX, ohx + s, yA, ohz);
  p.L('Faldón largo', 'pino19x90', 'x', innerX, ohx + s, yA, D - ohz - aT);
  p.L('Faldón corto', 'pino19x90', 'z', innerZ, ohx, yA, ohz + s);
  p.L('Faldón corto', 'pino19x90', 'z', innerZ, W - ohx - aT, yA, ohz + s);

  // travesaños centrales para tapas largas
  const nCross = Math.max(0, Math.floor(innerX / 800));
  for (let k = 1; k <= nCross; k++) {
    const x = ohx + s + (innerX * k) / (nCross + 1) - aT / 2;
    p.L('Travesaño central', 'pino19x90', 'z', D - 2 * ohz - 2 * aT, x, yA, ohz + aT);
  }

  // repisa inferior: descansa y se atornilla a un marco de 4 listones que se une a las patas
  if (shelf) {
    const fx0 = ohx + s; // entre las patas, en el ancho
    const fw = W - 2 * ohx - 2 * s;
    const fy = shelfY - 42;
    const long = 'pino19x42';
    p.L('Listón del marco de repisa', long, 'x', fw, fx0, fy, ohz); // atrás: comparte plano con las patas
    p.L('Listón del marco de repisa', long, 'x', fw, fx0, fy, D - ohz - aT); // adelante
    p.L('Listón del marco de repisa', long, 'z', D - 2 * ohz - 2 * aT, fx0, fy, ohz + aT); // lado izquierdo
    p.L('Listón del marco de repisa', long, 'z', D - 2 * ohz - 2 * aT, W - ohx - s - aT, fy, ohz + aT); // lado derecho
    p.H('Repisa inferior', mat, fx0, shelfY, ohz, fw, D - 2 * ohz, 'f');
    p.hardware('Tarugo de madera 8×30 mm', 16, 'Unión listones del marco – patas');
    p.hardware('Tornillo 4×50 mm', 8, 'Unión listones – patas (con cola)');
    p.hardware('Tornillo 4×30 mm', 14, 'Repisa atornillada desde abajo al marco');
  }

  const joints = 2 * (4 + nCross);
  p.hardware('Tarugo de madera 8×30 mm', joints * 2, 'Uniones faldón–pata');
  p.hardware('Tornillo 4×50 mm', joints * 2, 'Uniones faldón–pata (con cola)');
  const esc = 6 + 2 * nCross;
  p.hardware('Escuadra metálica de fijación de tapa', esc, 'Une la tapa a los faldones');
  p.hardware('Tornillo 4×16 mm', esc * 2, 'Fijación de tapa');

  return { oh: ohx, ohx, ohz, s, topT, legLen, yA, nCross };
}
