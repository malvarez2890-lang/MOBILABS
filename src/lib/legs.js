import { LINEARS } from './materials.js';

export const LEG_STYLES_ALL = [
  ['cuadrada', 'Cuadrada'],
  ['afinada', 'Cuadrada afinada'],
  ['redonda', 'Redonda'],
  ['redondaAfinada', 'Redonda afinada'],
  ['metalica', 'Metálica (tubo cuadrado)'],
  ['ruedas', 'Ruedas giratorias'],
];
export const LEG_STYLES_WOOD = LEG_STYLES_ALL.slice(0, 4);
export const LEG_STYLES_CHAIR = LEG_STYLES_ALL.slice(0, 2);

/** Compatibilidad: antes el tamaño se guardaba como 'pino41' / 'pino70'. */
export const normSize = (v) => (v === 'pino41' || v === 'fino' ? 'fino' : 'grueso');

/**
 * Describe un tipo de pata. `s` = lado (o diámetro) de su huella en mm.
 * kind: 'wood' (se corta, va al despiece) | 'metal' | 'caster' (se compran, solo se dibujan).
 */
export function legSpec(style = 'cuadrada', size = 'fino') {
  const sz = normSize(size);
  const thick = sz === 'grueso';
  const wood = (mat, shape, taper, suffix) => ({
    style, size: sz, kind: 'wood', mat, s: LINEARS[mat].section[0], shape, taper, suffix,
  });
  switch (style) {
    case 'afinada': return wood(thick ? 'pino70' : 'pino41', 'taperBox', 0.55, ' afinada');
    case 'redonda': return wood(thick ? 'redonda70' : 'redonda45', 'round', 1, ' redonda');
    case 'redondaAfinada': return wood(thick ? 'redonda70' : 'redonda45', 'taperRound', 0.55, ' redonda afinada');
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
  if (spec.kind === 'wood') {
    return p.L(label + spec.suffix, spec.mat, 'y', len, x, y, z, undefined, { shape: spec.shape, taper: spec.taper, head: o.head || 0 });
  }
  if (spec.kind === 'metal') return p.fixture({ kind: 'metalLeg', min: [x, y, z], size: [spec.s, len, spec.s] });
  return p.fixture({ kind: 'caster', min: [x, y, z], size: [spec.s, len, spec.s], wheelD: spec.wheelD });
}

/** Herrajes asociados a las patas compradas (las de madera no llevan). */
export function legHardware(p, spec, n, len) {
  if (spec.kind === 'metal') {
    p.hardware(`${spec.label}, alto ${Math.round(len / 10)} cm`, n, 'Se piden de ese alto');
    p.hardware('Placa de montaje para pata metálica', n, 'Con tornillos');
  } else if (spec.kind === 'caster') {
    p.hardware(`${spec.label}`, n - 2, 'Sin freno');
    p.hardware(`${spec.label} con freno`, 2, 'Las dos delanteras');
    p.hardware('Tornillo 5×30 mm (placas)', n * 4, 'Fijación de las placas');
  } else {
    p.hardware('Tornillo 5×50 mm', n * 2, 'Fijación de patas');
    p.hardware('Escuadra metálica de refuerzo 40 mm', n * 2, 'Unión patas–base');
  }
}
