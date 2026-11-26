import { LINEARS } from './materials.js';
import { tiltedBox } from './util.js';

// Las ruedas no son un estilo de pata: se eligen en "Base" (Ruedas giratorias).
export const LEG_STYLES_ALL = [
  ['cuadrada', 'Cuadrada'],
  ['afinada', 'Cuadrada afinada'],
  ['redonda', 'Redonda'],
  ['redondaAfinada', 'Redonda afinada'],
  ['inclinada', 'Inclinada (diagonal, madera)'],
  ['metalica', 'Metálica (tubo cuadrado)'],
  ['aceroDiagonal', 'Acero en diagonal'],
];
// mesas: además, marco de acero en U (solo tapa rectangular)
export const LEG_STYLES_TABLE = [
  ...LEG_STYLES_ALL.filter(([id]) => id !== 'metalica'),
  ['aceroU', 'Marco de acero en U'],
];
export const LEG_STYLES_WOOD = LEG_STYLES_TABLE;
export const LEG_STYLES_CHAIR = LEG_STYLES_ALL.slice(0, 2);

/** Compatibilidad: antes el tamaño se guardaba como 'pino41' / 'pino70'. */
export const normSize = (v) => (v === 'pino41' || v === 'fino' ? 'fino' : 'grueso');

/**
 * Describe un tipo de pata. `s` = lado (o diámetro) de su huella en mm.
 * kind: 'wood' (se corta, va al despiece) | 'metal' | 'caster' (se compran, solo se dibujan).
 */
// Patas "de torno" (cónicas, redondas): no se cortan, se compran como producto listo y de altura fija.
export const PRODUCT_STYLES = ['afinada', 'redonda', 'redondaAfinada'];
export const isProductStyle = (style) => PRODUCT_STYLES.includes(style);
export const LEG_HEIGHTS_CABINET = [8, 10, 12, 15, 20, 25, 30]; // cm, alturas típicas de venta
export const LEG_HEIGHTS_TABLE = [40, 45, 71]; // cm: mesa de centro/banco/comedor
const PRODUCT_NAME = { afinada: 'cónica', redonda: 'redonda', redondaAfinada: 'cónica redonda' };

/** `opts.cut` = pata cortada a medida en pino (solo sillas); `opts.h` = alto en mm de la pata comprada. */
export function legSpec(style = 'cuadrada', size = 'fino', opts = {}) {
  const sz = normSize(size);
  const thick = sz === 'grueso';
  const wood = (mat, shape, taper, suffix) => ({
    style, size: sz, kind: 'wood', mat, s: LINEARS[mat].section[0], shape, taper, suffix,
  });
  if (isProductStyle(style) && !opts.cut) {
    const h = opts.h || 150;
    const s = thick ? 55 : 40;
    const shape = style === 'redonda' ? 'round' : style === 'afinada' ? 'taperBox' : 'taperRound';
    const name = style === 'redonda' ? 'Pata de madera redonda' : `Pata de madera ${PRODUCT_NAME[style]}`;
    return { style, size: sz, kind: 'product', s, h, shape, taper: style === 'redonda' ? 1 : 0.55, suffix: '', label: `${name} ${h / 10} cm`.replace('.', ',') };
  }
  switch (style) {
    case 'afinada': return wood(thick ? 'pino70' : 'pino41', 'taperBox', 0.55, ' afinada');
    case 'inclinada': return { ...wood(thick ? 'pino70' : 'pino41', 'box', 1, ' inclinada'), splay: 8 };
    case 'aceroDiagonal': {
      const s = thick ? 40 : 30;
      return { style, size: sz, kind: 'metal', s, splay: 8, suffix: ' de acero en diagonal', label: `Pata de acero en diagonal ${s}×${s} mm` };
    }
    case 'aceroU': {
      const s = thick ? 40 : 30;
      return { style, size: sz, kind: 'metalFrame', s, suffix: ' (marco de acero)', label: `Tubo de acero cuadrado ${s}×${s} mm` };
    }
    case 'metalica': {
      const s = thick ? 40 : 30;
      return { style, size: sz, kind: 'metal', s, suffix: ' metálica', label: `Pata metálica tubular ${s}×${s} mm` };
    }
    case 'ruedas': {
      const wheelD = thick ? 75 : 50;
      return { style, size: sz, kind: 'caster', s: thick ? 60 : 50, h: thick ? 100 : 70, wheelD, label: `Rueda giratoria Ø${wheelD} mm con placa` };
    }
    default: return wood(thick ? 'pino70' : 'pino41', 'box', 1, '');
  }
}

/** Coloca una pata (pieza de madera o elemento comprado). `o.head` = tramo cuadrado arriba para unir faldones. */
export function placeLeg(p, spec, x, y, z, len, o = {}) {
  const label = o.label || 'Pata';
  if (spec.splay) { // pata en diagonal: nace en (x, z) bajo la tapa y se abre hacia afuera (o.out = [±1, ±1]) al bajar
    const [sx, sz] = o.out || [0, 0];
    let a = (spec.splay * Math.PI) / 180;
    if (o.maxOut) a = Math.min(a, Math.atan(o.maxOut / len)); // el pie no debe sobresalir de la tapa
    const top = [x + spec.s / 2, y + len, z + spec.s / 2];
    const tilt = [-a * sz, a * sx];
    if (spec.kind === 'wood') return p.T(label + spec.suffix, spec.mat, top, len, tilt);
    const b = tiltedBox(top, len, tilt, spec.s);
    return p.fixture({ kind: 'metalLeg', min: b.min, size: b.size, rot: b.rot });
  }
  if (spec.kind === 'wood') {
    return p.L(label + spec.suffix, spec.mat, 'y', len, x, y, z, undefined, { shape: spec.shape, taper: spec.taper, head: o.head || 0, blocks: o.blocks });
  }
  if (spec.kind === 'metal') return p.fixture({ kind: 'metalLeg', min: [x, y, z], size: [spec.s, len, spec.s] });
  if (spec.kind === 'product') return p.fixture({ kind: 'productLeg', min: [x, y, z], size: [spec.s, len, spec.s], shape: spec.shape, taper: spec.taper });
  return p.fixture({ kind: 'caster', min: [x, y, z], size: [spec.s, len, spec.s], wheelD: spec.wheelD });
}

/** Herrajes asociados a las patas compradas (las de madera no llevan). */
export function legHardware(p, spec, n, len) {
  if (spec.kind === 'metal') {
    p.hardware(`${spec.label}, alto ${Math.round(len / 10)} cm`, n, spec.splay ? 'Con la inclinación incluida (placa en ángulo)' : 'Se piden de ese alto');
    p.hardware('Placa de montaje para pata metálica', n, 'Con tornillos');
  } else if (spec.kind === 'product') {
    p.hardware(`${spec.label} (pata lista)`, n, 'Producto listo, alto fijo; se compra por unidad o en pack de 4');
    p.hardware('Placa de montaje para pata de madera', n, 'Si la pata no trae inserto; con tornillos');
  } else if (spec.kind === 'caster') {
    p.hardware(`${spec.label}`, n - 2, 'Sin freno');
    p.hardware(`${spec.label} con freno`, 2, 'Las dos delanteras');
    p.hardware('Tornillo 5×30 mm (placas)', n * 4, 'Fijación de las placas');
  } else {
    p.hardware('Tornillo 5×50 mm', n * 2, 'Fijación de patas');
    p.hardware('Escuadra metálica de refuerzo 40 mm', n * 2, 'Unión patas–base');
  }
}
