import { SHEETS } from './materials.js';
import { placeHandle } from './handles.js';

const SLIDES = [250, 300, 350, 400, 450, 500, 550]; // largos de corredera telescópica comerciales (mm)

/**
 * Cajonera: dos laterales, base, trasera y `n` cajones (frente, caja y correderas), apoyada en el piso.
 * Ocupa [x, x+w] × [0, H - topT] × [z, z+d]; la tapa del mueble va encima.
 * o = { mat, x, z, w, d, H, topT, n, handle }
 */
export function drawerUnit(p, o) {
  const { mat, x, z, w, d, H, topT, n } = o;
  const t = SHEETS[mat].t;
  const top = H - topT;
  const baseY = 50; // espacio para niveladores
  const back = SHEETS.hdf3.t;
  const boxMat = 'mel15'; // las cajas de los cajones van en melamina de 15 mm (fondo en HDF)
  const tb = SHEETS[boxMat].t;

  p.V('Lateral', mat, x, 0, z, top, d, 'f');
  p.V('Lateral', mat, x + w - t, 0, z, top, d, 'f');
  p.H('Base de cajonera', mat, x + t, baseY, z + back, w - 2 * t, d - back, 'f');
  p.B('Trasera de cajonera', 'hdf3', x + t, baseY, z, w - 2 * t, top - baseY, '');
  p.joint(d, 4);
  p.hardware('Nivelador de patas regulable', 2, 'Bajo la cajonera');
  p.hardware('Tornillo o clavo 3×16 mm (trasera)', Math.ceil((2 * (top - baseY) + 2 * w) / 150), 'Fijación del panel trasero');

  const iw = w - 2 * t; // ancho libre interior
  const y0 = baseY + t; // piso útil de los cajones
  const ih = top - y0; // alto libre interior
  const gap = 3;
  const fh = (ih - gap * (n + 1)) / n; // alto de cada frente
  const zf = z + d; // plano delantero de los laterales
  const avail = d - t - back - 10;
  const sl = [...SLIDES].reverse().find((s) => s <= avail) || SLIDES[0];
  if (fh < 90) p.warn('Los cajones quedan muy bajos (menos de 9 cm): usa menos cajones o un escritorio más alto.');
  if (avail < SLIDES[0]) p.warn('El fondo es poco para las correderas más cortas (25 cm): aumenta el fondo del escritorio.');

  const bw = iw - 26; // la caja deja 13 mm a cada lado para las correderas
  const bx = x + t + 13;
  const bh = Math.max(40, fh - 40);
  const zb = zf - t - sl; // parte trasera de la caja
  const fronts = [];
  for (let i = 0; i < n; i++) {
    const fy = y0 + gap + i * (fh + gap);
    const front = p.B('Frente de cajón', mat, x + t + 1.5, fy, zf - t, iw - 3, fh, 'tulr');
    p.V('Costado de cajón', boxMat, bx, fy + 20, zb, bh, sl, '');
    p.V('Costado de cajón', boxMat, bx + bw - tb, fy + 20, zb, bh, sl, '');
    p.B('Trasero de cajón', boxMat, bx + tb, fy + 20, zb, bw - 2 * tb, bh, '');
    p.H('Fondo de cajón', 'hdf3', bx + tb, fy + 28, zb + tb, bw - 2 * tb, sl - tb, '');
    if (front) fronts.push({ id: front.id, x: x + t + 1.5, y: fy, w: iw - 3, h: fh, front: zf, hinge: 'l', center: true });
  }
  p.hardware(`Corredera telescópica ${sl} mm (par)`, n, 'Un par por cajón');
  p.hardware('Tornillo 3,5×16 mm (correderas)', n * 12, 'Fijación de correderas');
  p.hardware('Tornillo 4×30 mm (frente al cajón)', n * 4, 'Frente de cada cajón');
  const fx = [];
  if (o.handle) for (const f of fronts) { const h = placeHandle(p, f, o.handle); if (h) fx.push(h); }
  return { fronts, fixtures: fx, iw, slide: sl };
}
