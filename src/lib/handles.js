/** Tiradores / jaladeras de puertas: tipo, tamaño y posición definidos por el usuario. */

export const HANDLE_TYPES = [
  ['barra', 'Jaladera de barra'],
  ['perilla', 'Perilla / pomo'],
  ['canto', 'Perfil de canto (sin saliente)'],
  ['ninguno', 'Sin tirador (apertura por presión)'],
];
export const HANDLE_C2C = [96, 128, 160, 192, 256, 320].map((n) => [n, `${n} mm`]);
export const HINGE_MODES = [['auto', 'Automática'], ['izq', 'Bisagras a la izquierda'], ['der', 'Bisagras a la derecha']];

/** Lee los parámetros del formulario (cm / %) y los pasa a mm. */
export function handleFromValues(v) {
  return {
    type: v.tirador || 'barra',
    c2c: Number(v.tiradorLargo) || 128,
    orient: v.tiradorOrient || 'vertical',
    offX: (Number(v.tiradorX) || 4) * 10,
    pctY: Number(v.tiradorY) || 75,
    hingeMode: v.bisagra || 'auto',
  };
}

/** Lado de las bisagras de la puerta `i` de `n` en una fila: las puertas se enfrentan de a pares. */
export function hingeSide(mode, i, n) {
  if (mode === 'izq') return 'l';
  if (mode === 'der') return 'r';
  return i < n / 2 ? 'l' : 'r';
}

const BAR_PAD = 24; // la barra sobresale 12 mm a cada lado de los ejes

/**
 * Crea el tirador de una puerta o de un frente de cajón.
 * door = { id, x, y, w, h, front, hinge, center? }  (mm; front = cara delantera en z; center: tirador horizontal centrado, para cajones)
 * Devuelve el fixture o null.
 */
export function placeHandle(p, door, spec) {
  if (spec.type === 'ninguno') return null;
  const { x, y, w, h, front, hinge, id } = door;
  if (door.center) spec = { ...spec, orient: 'horizontal' }; // en un cajón la jaladera va horizontal y centrada
  const freeRight = hinge === 'l'; // bisagra a la izquierda → el borde libre está a la derecha
  if (spec.type === 'canto') {
    return p.fixture({ kind: 'handle', type: 'canto', parent: id, noBbox: true, min: [x, y + h - 22, front], size: [w, 22, 14], length: w });
  }
  let cx = door.center ? x + w / 2 : freeRight ? x + w - spec.offX : x + spec.offX;
  let cy = y + (h * spec.pctY) / 100;
  let size;
  if (spec.type === 'perilla') {
    size = [30, 30, 24];
  } else {
    const L = spec.c2c + BAR_PAD;
    size = spec.orient === 'vertical' ? [14, L, 24] : [L, 14, 24];
  }
  const clampTo = (v, lo, hi) => (hi < lo ? (lo + hi) / 2 : Math.min(hi, Math.max(lo, v)));
  cx = clampTo(cx, x + size[0] / 2 + 8, x + w - size[0] / 2 - 8);
  cy = clampTo(cy, y + size[1] / 2 + 8, y + h - size[1] / 2 - 8);
  const fits = size[0] + 16 <= w && size[1] + 16 <= h;
  return p.fixture({
    kind: 'handle', type: spec.type, orient: spec.orient, c2c: spec.c2c, parent: id, noBbox: true, fits,
    min: [cx - size[0] / 2, cy - size[1] / 2, front], size,
    drill: { fromFree: door.center ? (cx - x) : freeRight ? x + w - cx : cx - x, fromBottom: cy - y, center: !!door.center },
  });
}

/** Herrajes y avisos de los tiradores de todas las puertas. doors = [{w,h,...}] */
export function handleSummary(p, spec, doors, fixtures, noun = 'puerta') {
  const n = doors.length;
  if (!n) return;
  const plural = noun === 'cajón' ? 'cajones' : 'puertas';
  if (spec.type === 'ninguno') {
    p.hardware(`Pistón de apertura por presión (push-to-open)`, n, `Uno por ${noun}`);
    p.tip(noun === 'cajón' ? 'Sin tiradores: los cajones se abren presionándolos (se usan pistones push-to-open).' : 'Sin tiradores: las puertas se abren presionándolas (se usan pistones push-to-open).');
    return;
  }
  if (spec.type === 'canto') {
    p.hardware('Perfil tirador de canto (aluminio)', n, `Largo = ancho de cada ${noun} (${Math.round(doors[0].w)} mm)`);
    p.tip(`Tirador de perfil en el canto superior de cada ${noun}: se agarra por debajo del borde.`);
    return;
  }
  if (spec.type === 'perilla') p.hardware('Perilla / pomo Ø30 mm', n, `Con tornillo; 1 taladro por ${noun}`);
  else p.hardware(`Jaladera de barra ${spec.c2c} mm entre ejes`, n, `2 taladros por ${noun}`);

  const f0 = fixtures[0];
  if (f0) {
    const mm = (v) => Math.round(v);
    p.tip(
      f0.drill.center
        ? `Tiradores: taladros centrados en el frente de cada ${noun} y a ${mm(f0.drill.fromBottom)} mm desde su borde inferior (${spec.type === 'barra' ? `jaladera horizontal, ${spec.c2c} mm entre ejes` : 'perilla'}).`
        : `Tiradores: taladros a ${mm(f0.drill.fromFree)} mm del borde libre de la puerta y a ${mm(f0.drill.fromBottom)} mm desde su borde inferior`
          + `${spec.type === 'barra' ? ` (${spec.orient === 'vertical' ? 'jaladera vertical' : 'jaladera horizontal'}, ${spec.c2c} mm entre ejes)` : ''}.`,
    );
  }
  if (fixtures.some((f) => !f.fits)) {
    p.warn(`El tirador es muy grande para ${plural === 'cajones' ? 'algún cajón' : 'alguna puerta'}: elige un largo menor o cámbialo a perilla o perfil de canto.`);
  }
}
