import { PartList } from './parts.js';
import { SHEETS, LINEARS, MAIN_SHEETS } from './materials.js';
import { carcass } from './carcass.js';
import { tableFrame, stackTop } from './table.js';
import { cm } from './util.js';
import { LEG_STYLES_ALL, LEG_STYLES_WOOD, LEG_STYLES_CHAIR, legSpec, placeLeg, normSize } from './legs.js';
import { HANDLE_TYPES, HANDLE_C2C, HINGE_MODES, handleFromValues } from './handles.js';

// ---------- helpers para declarar parámetros (valores en cm salvo que se indique) ----------
const num = (key, label, def, min, max, step = 1, unit = 'cm', extra = {}) => ({ type: 'num', key, label, def, min, max, step, unit, ...extra });
const sel = (key, label, def, options, extra = {}) => ({ type: 'sel', key, label, def, options, ...extra });
const bool = (key, label, def, extra = {}) => ({ type: 'bool', key, label, def, ...extra });

const MAT = sel('mat', 'Tablero principal', 'mel18', MAIN_SHEETS.map((id) => [id, SHEETS[id].name]), { section: 'Materiales' });
/** Estilo y tamaño de patas (dos parámetros). styles: 'all' | 'wood' | 'chair' */
const LEGS = (size = 'grueso', extra = {}, styles = 'all') => [
  sel('pataEstilo', 'Estilo de patas', 'cuadrada', styles === 'all' ? LEG_STYLES_ALL : styles === 'chair' ? LEG_STYLES_CHAIR : LEG_STYLES_WOOD, extra),
  sel('pata', 'Tamaño de las patas', size, [['fino', 'Delgadas'], ['grueso', 'Gruesas']], extra),
];

/** Tiradores de las puertas (solo se muestran si el mueble tiene puertas). */
const HANDLES = (hasDoors) => {
  const on = (f) => (v) => hasDoors(v) && f(v);
  return [
    sel('tirador', 'Tipo de tirador', 'barra', HANDLE_TYPES, { section: 'Tiradores', visibleIf: on(() => true) }),
    sel('tiradorLargo', 'Largo de la jaladera (entre ejes)', 128, HANDLE_C2C, { visibleIf: on((v) => v.tirador === 'barra') }),
    sel('tiradorOrient', 'Orientación', 'vertical', [['vertical', 'Vertical'], ['horizontal', 'Horizontal']], { visibleIf: on((v) => v.tirador === 'barra') }),
    num('tiradorX', 'Distancia al borde libre', 4, 1.5, 15, 0.5, 'cm', { visibleIf: on((v) => v.tirador === 'barra' || v.tirador === 'perilla') }),
    num('tiradorY', 'Altura en la puerta', 75, 10, 95, 5, '%', { visibleIf: on((v) => v.tirador === 'barra' || v.tirador === 'perilla') }),
    sel('bisagra', 'Lado de las bisagras', 'auto', HINGE_MODES, { visibleIf: on(() => true) }),
  ];
};
const showBaseH = (v) => v.base !== 'none' && !(v.base === 'patas' && v.pataEstilo === 'ruedas');
const legOf = (v) => legSpec(v.pataEstilo, v.pata);

const BASE_OPTS = [['none', 'Sin base'], ['zocalo', 'Zócalo'], ['patas', 'Patas / ruedas']];
const BACK_OPTS = [['hdf', 'Panel HDF 3 mm'], ['rails', 'Travesaños (abierta)'], ['none', 'Sin trasera']];
const TOP_OPTS = [['simple', 'Un tablero'], ['doble', 'Doble (más gruesa)']];
const notNone = (v) => v.base !== 'none';
const isLegs = (v) => v.base === 'patas';

const buildLevels = (p, rows, label = 'Nivel') =>
  rows.forEach((r, i) => p.tip(`${label} ${i + 1}: ${cm(r.h)} cm de alto libre × ${cm(r.cw)} cm de ancho libre.`));

// ======================================================================================
export const FURNITURE = [
  // ---------------------------------------------------------------- ESTANTE
  {
    id: 'estante', name: 'Estante', desc: 'Estantería abierta de piso',
    params: [
      num('ancho', 'Ancho', 70, 30, 200, 1, 'cm', { section: 'Medidas' }),
      num('alto', 'Alto', 180, 40, 240),
      num('fondo', 'Fondo', 28, 15, 60),
      num('niveles', 'Niveles (espacios)', 5, 1, 12, 1, 'u', { section: 'Estructura' }),
      sel('base', 'Base', 'zocalo', BASE_OPTS),
      num('altoBase', 'Alto de la base', 6, 3, 20, 1, 'cm', { visibleIf: showBaseH }),
      sel('trasera', 'Parte trasera', 'rails', BACK_OPTS),
      MAT,
      ...LEGS('fino', { visibleIf: isLegs }),
    ],
    presets: [
      { name: 'Clásico 5 niveles', values: {} },
      { name: 'Bajo para zapatos', values: { ancho: 70, alto: 60, fondo: 30, niveles: 3 } },
      { name: 'Alto y angosto', values: { ancho: 50, alto: 220, fondo: 25, niveles: 7, trasera: 'hdf' } },
    ],
    build(v) {
      const p = new PartList();
      const r = carcass(p, {
        mat: v.mat, W: v.ancho * 10, D: v.fondo * 10, H: v.alto * 10,
        rows: Array.from({ length: v.niveles }, () => ({ cols: 1 })),
        base: v.base, baseH: v.altoBase * 10, back: v.trasera, leg: legOf(v), loadFactor: 0.9,
      });
      p.tip(`Cada nivel queda con ~${cm(r.rows[0].h)} cm de alto libre.`);
      return p.result();
    },
  },

  // ---------------------------------------------------------------- LIBRERO
  {
    id: 'librero', name: 'Librero', desc: 'Con columnas, trasera y puertas opcionales',
    params: [
      num('ancho', 'Ancho', 100, 40, 240, 1, 'cm', { section: 'Medidas' }),
      num('alto', 'Alto', 200, 60, 240),
      num('fondo', 'Fondo', 30, 18, 60),
      num('niveles', 'Niveles (filas)', 5, 1, 10, 1, 'u', { section: 'Estructura' }),
      num('columnas', 'Columnas', 2, 1, 5, 1, 'u'),
      bool('puertas', 'Puertas en el nivel inferior', false),
      ...HANDLES((v) => v.puertas),
      sel('base', 'Base', 'zocalo', BASE_OPTS),
      num('altoBase', 'Alto de la base', 8, 3, 20, 1, 'cm', { visibleIf: showBaseH }),
      sel('trasera', 'Parte trasera', 'hdf', BACK_OPTS),
      MAT,
      ...LEGS('fino', { visibleIf: isLegs }),
    ],
    presets: [
      { name: '100 × 200, 2 columnas', values: {} },
      { name: 'Angosto, 1 columna', values: { ancho: 70, columnas: 1 } },
      { name: 'Ancho con 3 columnas', values: { ancho: 150, columnas: 3, alto: 180 } },
      { name: 'Bajo con puertas', values: { ancho: 90, alto: 110, niveles: 3, puertas: true, columnas: 2 } },
    ],
    build(v) {
      const p = new PartList();
      const rows = Array.from({ length: v.niveles }, (_, i) => ({ cols: v.columnas, door: v.puertas && i === 0 }));
      const r = carcass(p, {
        mat: v.mat, W: v.ancho * 10, D: v.fondo * 10, H: v.alto * 10, rows,
        base: v.base, baseH: v.altoBase * 10, back: v.trasera, leg: legOf(v), loadFactor: 0.85, handle: handleFromValues(v),
      });
      p.tip(`Alto libre por nivel: ~${cm(r.rows[r.rows.length - 1].h)} cm; ancho libre por columna: ~${cm(r.rows[0].cw)} cm. Una fila de libros típica pide 25–30 cm de alto.`);
      return p.result();
    },
  },

  // ---------------------------------------------------------------- MESA
  {
    id: 'mesa', name: 'Mesa', desc: 'Comedor o mesa de trabajo grande',
    params: [
      num('ancho', 'Largo', 160, 80, 240, 1, 'cm', { section: 'Medidas' }),
      num('fondo', 'Ancho', 80, 50, 120),
      num('alto', 'Alto', 75, 60, 80),
      sel('tapa', 'Tapa', 'simple', TOP_OPTS, { section: 'Estructura' }),
      num('voladizo', 'Retranqueo de patas', 6, 0, 15, 1, 'cm'),
      ...LEGS('grueso', {}, 'wood'),
      MAT,
    ],
    presets: [
      { name: '4 personas', values: { ancho: 120, fondo: 75 } },
      { name: '6 personas', values: { ancho: 160, fondo: 80 } },
      { name: '8 personas', values: { ancho: 220, fondo: 90, tapa: 'doble' } },
    ],
    build(v) {
      const p = new PartList();
      const W = v.ancho * 10;
      tableFrame(p, {
        W, D: v.fondo * 10, H: v.alto * 10, mat: v.mat, layers: v.tapa === 'doble' ? 2 : 1,
        leg: legOf(v), oh: v.voladizo * 10,
      });
      const seats = Math.max(2, Math.floor(v.ancho / 60) * 2 + (v.ancho >= 140 && v.fondo >= 70 ? 2 : 0));
      p.tip(`Alcanza para ~${seats} personas (60 cm por comensal).`);
      if (v.tapa === 'simple' && v.ancho > 180) p.tip('Con más de 180 cm de largo conviene la tapa doble para que no se sienta flexible.');
      return p.result();
    },
  },

  // ---------------------------------------------------------------- MESA DE ARRIMO
  {
    id: 'arrimo', name: 'Mesa de arrimo', desc: 'Angosta, para pasillo o entrada',
    params: [
      num('ancho', 'Largo', 110, 60, 200, 1, 'cm', { section: 'Medidas' }),
      num('fondo', 'Fondo', 30, 20, 45),
      num('alto', 'Alto', 80, 60, 100),
      bool('estante', 'Repisa inferior', true, { section: 'Estructura' }),
      num('altoEstante', 'Altura de la repisa', 20, 10, 50, 1, 'cm', { visibleIf: (v) => v.estante }),
      num('voladizo', 'Retranqueo de patas', 3, 0, 8, 1, 'cm'),
      ...LEGS('fino', {}, 'wood'),
      MAT,
    ],
    presets: [
      { name: 'Entrada', values: {} },
      { name: 'Pasillo angosto', values: { ancho: 90, fondo: 22, alto: 85 } },
    ],
    build(v) {
      const p = new PartList();
      tableFrame(p, {
        W: v.ancho * 10, D: v.fondo * 10, H: v.alto * 10, mat: v.mat, layers: 1, leg: legOf(v), oh: v.voladizo * 10,
        shelf: v.estante ? { y: v.altoEstante * 10 } : null,
      });
      return p.result();
    },
  },

  // ---------------------------------------------------------------- ESCRITORIO
  {
    id: 'escritorio', name: 'Escritorio', desc: 'Con laterales de tablero o patas de pino',
    params: [
      num('ancho', 'Largo', 120, 80, 200, 1, 'cm', { section: 'Medidas' }),
      num('fondo', 'Fondo', 60, 45, 90),
      num('alto', 'Alto', 75, 65, 80),
      sel('estilo', 'Estilo', 'paneles', [['paneles', 'Laterales de tablero'], ['patas', 'Patas de pino']], { section: 'Estructura' }),
      sel('tapa', 'Tapa', 'simple', TOP_OPTS),
      bool('panelFrontal', 'Panel trasero (esconde cables)', true),
      bool('repisaInferior', 'Repisa inferior', false),
      ...LEGS('fino', { visibleIf: (v) => v.estilo === 'patas' }, 'wood'),
      MAT,
    ],
    presets: [
      { name: 'Compacto', values: { ancho: 100, fondo: 55 } },
      { name: 'Doble monitor', values: { ancho: 160, fondo: 70, tapa: 'doble' } },
    ],
    build(v) {
      const p = new PartList();
      const { mat } = v;
      const t = SHEETS[mat].t;
      const W = v.ancho * 10;
      const D = v.fondo * 10;
      const H = v.alto * 10;
      const layers = v.tapa === 'doble' ? 2 : 1;
      const topT = t * layers;
      if (v.estilo === 'patas') {
        const o = tableFrame(p, {
          W, D, H, mat, layers, leg: legOf(v), oh: 30,
          shelf: v.repisaInferior ? { y: 150 } : null,
        });
        if (v.panelFrontal) {
          p.B('Panel trasero', mat, o.oh + o.s, H - topT - 90 - 250, o.oh, W - 2 * o.oh - 2 * o.s, 250, 'u');
          p.joint(250, 2);
        }
      } else {
        const ox = 20; // la tapa sobresale de los laterales
        const oz = 30;
        stackTop(p, mat, layers, 0, H, 0, W, D, 'frbl');
        p.V('Lateral', mat, ox, 0, oz, H - topT, D - 2 * oz, 'f');
        p.V('Lateral', mat, W - ox - t, 0, oz, H - topT, D - 2 * oz, 'f');
        p.joint(D - 2 * oz, 4);
        const iw = W - 2 * ox - 2 * t;
        if (v.panelFrontal) {
          p.B('Panel trasero', mat, ox + t, H - topT - 350, oz, iw, 350, 'u');
          p.joint(350, 2);
        }
        if (v.repisaInferior) {
          p.H('Repisa inferior', mat, ox + t, 150, oz, iw, D - 2 * oz, 'f');
          p.joint(D - 2 * oz, 2);
        }
        if (layers > 1) p.hardware('Tornillo 4×30 mm (unir capas de la tapa)', Math.ceil((W * D) / 40000), 'Además de cola');
        if (iw > 1200 && layers === 1) p.warn('Entre laterales hay más de 120 cm con tapa de un tablero: puede flectar. Usa tapa doble.');
        p.hardware('Nivelador de patas regulable', 4, 'Bajo los laterales');
      }
      return p.result();
    },
  },

  // ---------------------------------------------------------------- SILLA
  {
    id: 'silla', name: 'Silla', desc: 'Patas de pino, asiento de tablero y respaldo de tablas',
    params: [
      num('ancho', 'Ancho', 42, 35, 55, 1, 'cm', { section: 'Medidas' }),
      num('fondoAsiento', 'Fondo del asiento', 42, 35, 55),
      num('altoAsiento', 'Alto del asiento', 45, 38, 52),
      num('altoTotal', 'Alto total', 88, 70, 110),
      num('tablas', 'Tablas del respaldo', 3, 1, 5, 1, 'u', { section: 'Estructura' }),
      ...LEGS('fino', {}, 'chair'),
      MAT,
    ],
    presets: [
      { name: 'Silla de comedor', values: {} },
      { name: 'Banqueta baja', values: { altoTotal: 70, altoAsiento: 40, tablas: 1 } },
    ],
    build(v) {
      const p = new PartList();
      const t = SHEETS[v.mat].t;
      const front = legSpec(v.pataEstilo === 'afinada' ? 'afinada' : 'cuadrada', v.pata); // patas delanteras
      const back = legSpec('cuadrada', v.pata); // las traseras suben hasta el respaldo: van rectas
      const s = front.s;
      const W = v.ancho * 10;
      const Hs = v.altoAsiento * 10; // cara superior del asiento
      const Ht = v.altoTotal * 10;
      const Dt = v.fondoAsiento * 10 + s; // fondo total (incluye las patas traseras)
      const aH = 90;
      const aT = 19;
      const yA = Hs - t - aH;

      p.H('Asiento', v.mat, 0, Hs - t, s, W, Dt - s, 'frbl');
      for (const x of [0, W - s]) {
        placeLeg(p, back, x, 0, 0, Ht, { label: 'Pata trasera' });
        placeLeg(p, front, x, 0, Dt - s, Hs - t, { label: 'Pata delantera', head: aH + 10 });
      }
      p.L('Faldón', 'pino19x90', 'x', W - 2 * s, s, yA, 0);
      p.L('Faldón', 'pino19x90', 'x', W - 2 * s, s, yA, Dt - aT);
      p.L('Faldón lateral', 'pino19x90', 'z', Dt - 2 * s, 0, yA, s);
      p.L('Faldón lateral', 'pino19x90', 'z', Dt - 2 * s, W - aT, yA, s);
      // travesaños inferiores
      p.L('Travesaño inferior', 'pino19x42', 'x', W - 2 * s, s, 150, 0);
      p.L('Travesaño inferior', 'pino19x42', 'x', W - 2 * s, s, 150, Dt - aT);
      p.L('Travesaño lateral', 'pino19x42', 'z', Dt - 2 * s, 0, 150, s);
      p.L('Travesaño lateral', 'pino19x42', 'z', Dt - 2 * s, W - aT, 150, s);

      // tablas del respaldo
      const yStart = Hs + 80;
      const yEnd = Ht - 15;
      const zone = yEnd - yStart;
      const maxN = Math.max(1, Math.floor((zone + 15) / (aH + 15)));
      const n = Math.min(v.tablas, maxN);
      if (n < v.tablas) p.warn(`Solo caben ${n} tabla(s) en el respaldo con ese alto; sube el alto total para agregar más.`);
      const gap = n > 1 ? (zone - n * aH) / (n - 1) : 0;
      for (let k = 0; k < n; k++) {
        p.L('Tabla de respaldo', 'pino19x90', 'x', W - 2 * s, s, yStart + k * (aH + gap), (s - aT) / 2);
      }

      const J = 2 * (4 + 4 + n);
      p.hardware('Tarugo de madera 8×30 mm', J * 2, 'Uniones de listones');
      p.hardware('Tornillo 4×50 mm', J, 'Uniones de listones (con cola)');
      p.hardware('Escuadra metálica 40 mm', 4, 'Fijación del asiento');
      p.hardware('Tornillo 4×16 mm', 8, 'Fijación del asiento');
      if (Ht - Hs < 300) p.tip('El respaldo queda bajo (menos de 30 cm sobre el asiento).');
      p.tip('En sillas conviene unir con tarugos y cola: aguantan mejor el balanceo que solo tornillos.');
      return p.result();
    },
  },

  // ---------------------------------------------------------------- RACK TV
  {
    id: 'rackTv', name: 'Rack para TV', desc: 'Mueble bajo con compartimentos y patas',
    params: [
      num('ancho', 'Largo', 150, 80, 240, 1, 'cm', { section: 'Medidas' }),
      num('alto', 'Alto total', 50, 30, 70),
      num('fondo', 'Fondo', 40, 28, 50),
      num('compartimentos', 'Compartimentos', 3, 1, 5, 1, 'u', { section: 'Estructura' }),
      bool('puertas', 'Puertas', true),
      ...HANDLES((v) => v.puertas),
      sel('base', 'Base', 'patas', BASE_OPTS),
      num('altoBase', 'Alto de la base', 12, 3, 25, 1, 'cm', { visibleIf: showBaseH }),
      sel('trasera', 'Parte trasera', 'rails', BACK_OPTS),
      MAT,
      ...LEGS('fino', { visibleIf: isLegs }),
    ],
    presets: [
      { name: 'Para TV de 55"', values: {} },
      { name: 'Para TV de 65"', values: { ancho: 180, compartimentos: 4 } },
      { name: 'Abierto, sin puertas', values: { puertas: false, compartimentos: 2 } },
    ],
    build(v) {
      const p = new PartList();
      const W = v.ancho * 10;
      carcass(p, {
        mat: v.mat, W, D: v.fondo * 10, H: v.alto * 10,
        rows: [{ cols: v.compartimentos, door: v.puertas }],
        base: v.base, baseH: v.altoBase * 10, back: v.trasera, leg: legOf(v), handle: handleFromValues(v),
      });
      const maxIn = Math.floor(((v.ancho - 12) / 2.215));
      p.tip(`Ancho útil para una TV de hasta ~${maxIn}" (con ~6 cm libres a cada lado).`);
      if (v.trasera === 'hdf') p.tip('Con trasera cerrada, deja una abertura para cables y ventilación de equipos.');
      return p.result();
    },
  },

  // ---------------------------------------------------------------- DECK TOCADISCOS
  {
    id: 'tocadiscos', name: 'Deck para tocadiscos', desc: 'Tapa para el tocadiscos, equipo y vinilos abajo',
    params: [
      num('ancho', 'Largo', 80, 50, 140, 1, 'cm', { section: 'Medidas' }),
      num('fondo', 'Fondo', 42, 34, 55),
      bool('equipo', 'Compartimento para equipo', true, { section: 'Estructura' }),
      num('alturaEquipo', 'Alto del compartimento de equipo', 20, 12, 35, 1, 'cm', { visibleIf: (v) => v.equipo }),
      num('filas', 'Filas de vinilos', 2, 0, 3, 1, 'u'),
      num('columnas', 'Columnas de vinilos', 2, 1, 4, 1, 'u', { visibleIf: (v) => v.filas > 0 || !v.equipo }),
      num('alturaCelda', 'Alto de cada fila de vinilos', 34, 32, 38),
      sel('base', 'Base', 'patas', BASE_OPTS),
      num('altoBase', 'Alto de la base', 15, 3, 30, 1, 'cm', { visibleIf: showBaseH }),
      sel('trasera', 'Parte trasera', 'rails', BACK_OPTS),
      MAT,
      ...LEGS('fino', { visibleIf: isLegs }),
    ],
    presets: [
      { name: 'Deck con equipo y 2 filas', values: {} },
      { name: 'Solo vinilos (3 filas)', values: { equipo: false, filas: 3, columnas: 3, ancho: 110 } },
      { name: 'Mínimo', values: { filas: 0, ancho: 70 } },
    ],
    build(v) {
      const p = new PartList();
      const filas = !v.equipo && v.filas === 0 ? 1 : v.filas;
      const rows = Array.from({ length: filas }, () => ({ h: v.alturaCelda * 10, cols: v.columnas }));
      if (v.equipo) rows.push({ h: v.alturaEquipo * 10, cols: 1, load: 1 });
      const r = carcass(p, {
        mat: v.mat, W: v.ancho * 10, D: v.fondo * 10, rows,
        base: v.base, baseH: v.altoBase * 10, back: v.trasera, leg: legOf(v), loadFactor: 0.8,
      });
      p.tip(`Superficie superior: ${v.ancho} × ${v.fondo} cm. Un tocadiscos típico mide ~43 × 36 cm.`);
      if (v.fondo < 40 || v.ancho < 45) p.warn('La tapa queda justa para un tocadiscos de tamaño estándar (≈ 43 × 36 cm).');
      if (filas > 0) {
        const cw = r.rows[0].cw;
        const D = v.fondo * 10 - r.z0;
        if (cw < 325) p.warn(`Las celdas de vinilos quedan de ${cm(cw)} cm de ancho; un LP de 12" mide 31,5 cm: queda muy justo.`);
        if (D < 325) p.warn(`El fondo útil es de ${cm(D)} cm; un LP mide 31,5 cm: sube el fondo para que entren.`);
        const lps = filas * v.columnas * Math.round((cw / 10) * 2);
        p.tip(`Capacidad aproximada: ${lps} vinilos (2 por cm de ancho libre).`);
      }
      p.tip('Apoya el tocadiscos sobre una base antivibración y evita ponerlo junto al parlante.');
      return p.result();
    },
  },

  // ---------------------------------------------------------------- MUEBLE VINILOS
  {
    id: 'vinilos', name: 'Mueble para vinilos', desc: 'Grilla de celdas para LPs de 12"',
    params: [
      num('columnas', 'Columnas', 4, 1, 6, 1, 'u', { section: 'Medidas' }),
      num('filas', 'Filas', 4, 1, 6, 1, 'u'),
      num('anchoCelda', 'Ancho libre de cada celda', 34, 31, 40),
      num('alturaCelda', 'Alto libre de cada celda', 34, 32, 40),
      num('fondo', 'Fondo', 36, 33, 45),
      sel('base', 'Base', 'patas', BASE_OPTS, { section: 'Estructura' }),
      num('altoBase', 'Alto de la base', 8, 3, 20, 1, 'cm', { visibleIf: showBaseH }),
      sel('trasera', 'Parte trasera', 'hdf', BACK_OPTS),
      MAT,
      ...LEGS('grueso', { visibleIf: isLegs }),
    ],
    presets: [
      { name: '4 × 4 (≈1.000 LPs)', values: {} },
      { name: '2 × 4 chico', values: { columnas: 2, filas: 4 } },
      { name: 'Largo bajo 6 × 2', values: { columnas: 6, filas: 2 } },
    ],
    build(v) {
      const p = new PartList();
      const t = SHEETS[v.mat].t;
      const cw = v.anchoCelda * 10;
      const W = v.columnas * cw + (v.columnas + 1) * t;
      const rows = Array.from({ length: v.filas }, () => ({ h: v.alturaCelda * 10, cols: v.columnas }));
      const r = carcass(p, {
        mat: v.mat, W, D: v.fondo * 10, rows,
        base: v.base, baseH: v.altoBase * 10, back: v.trasera, leg: legOf(v), loadFactor: 1,
      });
      const perCell = Math.round(v.anchoCelda * 2);
      const total = perCell * v.columnas * v.filas;
      const kg = Math.round(total * 0.25);
      p.tip(`Capacidad aproximada: ${perCell} LPs por celda, ${total} en total (2 por cm de ancho libre).`);
      p.tip(`Peso estimado con todos los discos: ~${kg} kg (≈ 250 g por LP con funda).`);
      if (kg > 250) {
        p.warn(`Cargado pesa ~${kg} kg: apóyalo en piso firme, fíjalo a la muralla y prefiere zócalo o patas de 3×3" para repartir el peso.`);
      } else if (kg > 120) {
        p.tip('Con todos los discos es un mueble pesado: apóyalo en piso firme y fíjalo a la muralla.');
      }
      if (v.fondo * 10 - r.z0 < 325) p.warn('El fondo útil es menor a 32,5 cm: un LP de 12" no entra completo.');
      if (v.anchoCelda < 32) p.tip('Celdas muy angostas: los discos quedan ajustados y cuesta sacarlos.');
      return p.result();
    },
  },
];

export const getType = (id) => FURNITURE.find((f) => f.id === id) || FURNITURE[0];

export const defaultsFor = (type) =>
  Object.fromEntries(type.params.map((p) => [p.key, p.def]));

/** Construye el mueble a partir de valores (completados con los valores por defecto). */
export function buildFurniture(typeId, values) {
  const type = getType(typeId);
  const v = { ...defaultsFor(type), ...values };
  if (v.pata) v.pata = normSize(v.pata);
  try {
    return { fixtures: [], ...type.build(v), error: null };
  } catch (e) {
    return { parts: [], fixtures: [], hardware: [], notes: [], bbox: { min: [0, 0, 0], max: [0, 0, 0], dims: [0, 0, 0] }, error: String(e) };
  }
}
