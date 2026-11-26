import { PartList } from './parts.js';
import { SHEETS, LINEARS, MAIN_SHEETS } from './materials.js';
import { carcass } from './carcass.js';
import { tableFrame, stackTop } from './table.js';
import { cm } from './util.js';
import { LEG_STYLES_ALL, LEG_STYLES_WOOD, LEG_STYLES_CHAIR, legSpec, placeLeg, normSize, isProductStyle, LEG_HEIGHTS_CABINET, LEG_HEIGHTS_TABLE } from './legs.js';
import { HANDLE_TYPES, HANDLE_C2C, HINGE_MODES, handleFromValues, handleSummary } from './handles.js';
import { drawerUnit } from './drawers.js';
import { credenza } from './credenza.js';

// ---------- helpers para declarar parámetros (valores en cm salvo que se indique) ----------
const num = (key, label, def, min, max, step = 1, unit = 'cm', extra = {}) => ({ type: 'num', key, label, def, min, max, step, unit, ...extra });
const sel = (key, label, def, options, extra = {}) => ({ type: 'sel', key, label, def, options, ...extra });
const bool = (key, label, def, extra = {}) => ({ type: 'bool', key, label, def, ...extra });

const MAT = sel('mat', 'Material estructural', 'mel18', MAIN_SHEETS.map((id) => [id, SHEETS[id].name]), { section: 'Materiales' });
/** Estilo y tamaño de patas (dos parámetros). styles: 'all' | 'wood' | 'chair' */
const productH = (list) => list.map((h) => [String(h), `${h} cm`]);
const LEGS = (size = 'grueso', extra = {}, styles = 'all', table = true) => [
  sel('pataEstilo', 'Estilo de patas', 'cuadrada', styles === 'all' ? LEG_STYLES_ALL : styles === 'chair' ? LEG_STYLES_CHAIR : LEG_STYLES_WOOD, extra),
  sel('pata', 'Tamaño de las patas', size, [['fino', 'Delgadas'], ['grueso', 'Gruesas']], extra),
  ...(styles === 'chair' ? [] : [
    sel('pataAlto', 'Alto de la pata (producto listo)', table ? '71' : '15', productH(table ? LEG_HEIGHTS_TABLE : LEG_HEIGHTS_CABINET), {
      visibleIf: (v) => (!extra.visibleIf || extra.visibleIf(v)) && isProductStyle(v.pataEstilo),
    }),
  ]),
];

/** Tiradores de las puertas (solo se muestran si el mueble tiene puertas). */
const HANDLES = (hasDoors, drawers = false) => {
  const on = (f) => (v) => hasDoors(v) && f(v);
  const list = [
    sel('tirador', drawers ? 'Tipo de tirador de los cajones' : 'Tipo de tirador', 'barra', HANDLE_TYPES, { section: 'Tiradores', visibleIf: on(() => true) }),
    sel('tiradorLargo', 'Largo de la jaladera (entre ejes)', 128, HANDLE_C2C, { visibleIf: on((v) => v.tirador === 'barra') }),
    sel('tiradorOrient', 'Orientación', 'vertical', [['vertical', 'Vertical'], ['horizontal', 'Horizontal']], { visibleIf: on((v) => v.tirador === 'barra') }),
    num('tiradorX', 'Distancia al borde libre', 4, 1.5, 15, 0.5, 'cm', { visibleIf: on((v) => v.tirador === 'barra' || v.tirador === 'perilla') }),
    num('tiradorY', drawers ? 'Altura en el frente del cajón' : 'Altura en la puerta', drawers ? 50 : 75, 10, 95, 5, '%', { visibleIf: on((v) => v.tirador === 'barra' || v.tirador === 'perilla') }),
    sel('bisagra', 'Lado de las bisagras', 'auto', HINGE_MODES, { visibleIf: on(() => true) }),
  ];
  // en los cajones la jaladera va siempre horizontal y centrada, y no hay bisagras
  return drawers ? list.filter((q) => !['tiradorOrient', 'tiradorX', 'bisagra'].includes(q.key)) : list;
};
const WHEEL_SIZES = [['fino', 'Ø50 mm (7 cm de alto)'], ['grueso', 'Ø75 mm (10 cm de alto)']];
const showBaseH = (v) => v.base === 'zocalo' || (v.base === 'patas' && !isProductStyle(v.pataEstilo)); // con ruedas, la altura la define la rueda
const legOf = (v) => (v.base === 'ruedas' ? legSpec('ruedas', v.ruedaTam) : legSpec(v.pataEstilo, v.pata, { h: Number(v.pataAlto || 15) * 10 }));

/** Patas y ruedas de los muebles de cajón: aparecen justo debajo de "Base", según lo elegido. */
const CARCASS_LEGS = (size = 'fino', style = 'cuadrada') => [
  sel('pataEstilo', 'Estilo de patas', style, LEG_STYLES_ALL, { visibleIf: isLegs }),
  sel('pata', 'Tamaño de las patas', size, [['fino', 'Delgadas'], ['grueso', 'Gruesas']], { visibleIf: isLegs }),
  sel('pataAlto', 'Alto de la pata (producto listo)', '15', LEG_HEIGHTS_CABINET.map((h) => [String(h), `${h} cm`]), { visibleIf: (v) => isLegs(v) && isProductStyle(v.pataEstilo) }),
  sel('ruedaTam', 'Tamaño de las ruedas', 'fino', WHEEL_SIZES, { visibleIf: isWheels }),
];
/** "Con ruedas" para mesas: las patas se acortan y cada una apoya en una rueda. */
const STRAIGHT_LEGS = (v) => !['inclinada', 'aceroDiagonal', 'aceroU'].includes(v.pataEstilo) && !isProductStyle(v.pataEstilo); // patas rectas de madera: admiten ruedas
const TABLE_WHEELS = (visibleIf = () => true) => [
  bool('ruedas', 'Con ruedas giratorias', false, { visibleIf: (v) => visibleIf(v) && STRAIGHT_LEGS(v) }),
  sel('ruedaTam', 'Tamaño de las ruedas', 'fino', WHEEL_SIZES, { visibleIf: (v) => visibleIf(v) && STRAIGHT_LEGS(v) && v.ruedas }),
];
const casterOf = (v) => (v.ruedas && STRAIGHT_LEGS(v) ? legSpec('ruedas', v.ruedaTam) : null);

const BASE_OPTS = [['none', 'Sin base'], ['zocalo', 'Zócalo'], ['patas', 'Patas'], ['ruedas', 'Ruedas giratorias']];
const BACK_OPTS = [['hdf', 'Panel MDF 3 mm'], ['rails', 'Travesaños (abierta)'], ['none', 'Sin trasera']];
const TOP_OPTS = [['simple', 'Un tablero'], ['doble', 'Doble (más gruesa)']];
const notNone = (v) => v.base !== 'none';
const isLegs = (v) => v.base === 'patas';
const isWheels = (v) => v.base === 'ruedas';

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
      ...CARCASS_LEGS('fino'),
      sel('trasera', 'Parte trasera', 'rails', BACK_OPTS),
      MAT,
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
      ...CARCASS_LEGS('fino'),
      sel('trasera', 'Parte trasera', 'hdf', BACK_OPTS),
      MAT,
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
      sel('forma', 'Forma de la tapa', 'rect', [['rect', 'Rectangular'], ['redonda', 'Redonda']], { section: 'Medidas' }),
      num('ancho', 'Largo', 160, 80, 240, 1, 'cm', { visibleIf: (v) => v.forma !== 'redonda' }),
      num('fondo', 'Ancho', 80, 50, 120, 1, 'cm', { visibleIf: (v) => v.forma !== 'redonda' }),
      num('diametro', 'Diámetro', 110, 60, 160, 1, 'cm', { visibleIf: (v) => v.forma === 'redonda' }),
      sel('tapaHecha', 'Cómo se hace la tapa redonda', 'tablero', [['tablero', 'Disco de tablero (caladora)'], ['listones', 'Listones de pino encolados (caladora)']], { visibleIf: (v) => v.forma === 'redonda' }),
      num('alto', 'Alto', 75, 60, 80, 1, 'cm', { visibleIf: (v) => !isProductStyle(v.pataEstilo) }),
      sel('tapa', 'Tapa', 'simple', TOP_OPTS, { section: 'Estructura', visibleIf: (v) => !(v.forma === 'redonda' && v.tapaHecha === 'listones') }),
      num('voladizo', 'Retranqueo de patas', 6, 0, 15, 1, 'cm', { visibleIf: (v) => v.forma !== 'redonda' }),
      ...LEGS('grueso', {}, 'wood'),
      ...TABLE_WHEELS(),
      MAT,
    ],
    presets: [
      { name: '4 personas', values: { ancho: 120, fondo: 75 } },
      { name: '6 personas', values: { ancho: 160, fondo: 80 } },
      { name: '8 personas', values: { ancho: 220, fondo: 90, tapa: 'doble' } },
      { name: 'Redonda 4 personas', values: { forma: 'redonda', diametro: 100 } },
      { name: 'Redonda 4 personas (listones de pino)', values: { forma: 'redonda', diametro: 100, tapaHecha: 'listones' } },
      { name: 'Redonda 6 personas', values: { forma: 'redonda', diametro: 140, tapa: 'doble', pata: 'grueso' } },
      { name: 'Patas en diagonal', values: { pataEstilo: 'inclinada', pata: 'fino' } },
      { name: 'Estilo industrial', values: { pataEstilo: 'aceroU', pata: 'fino', ancho: 180, tapa: 'doble' } },
    ],
    build(v) {
      const p = new PartList();
      const round = v.forma === 'redonda';
      const W = (round ? v.diametro : v.ancho) * 10;
      const D = round ? W : v.fondo * 10;
      let leg = legOf(v);
      if (round && leg.kind === 'metalFrame') {
        leg = legSpec('aceroDiagonal', v.pata);
        p.tip('El marco de acero en U no se puede usar con tapa redonda: se pusieron patas de acero en diagonal.');
      }
      const plankTop = round && v.tapaHecha === 'listones';
      let mat = v.mat;
      if (round && !plankTop && W > SHEETS[mat].size[1]) { // el disco no cabe en el ancho de la plancha: se usa un tablero del mismo espesor y más ancho
        const alt = MAIN_SHEETS.find((id) => SHEETS[id].t === SHEETS[mat].t && SHEETS[id].size[1] >= W);
        if (alt) { p.tip(`El disco de ${v.diametro} cm no cabe en ${SHEETS[mat].name.toLowerCase()} (ancho ${SHEETS[mat].size[1] / 10} cm): se usó ${SHEETS[alt].name.toLowerCase()}.`); mat = alt; }
      }
      tableFrame(p, {
        W, D, H: v.alto * 10, mat, layers: v.tapa === 'doble' ? 2 : 1,
        leg, casters: casterOf(v), oh: v.voladizo * 10, round, plankTop,
      });
      if (round) {
        const seats = Math.max(2, Math.floor(v.diametro / 25));
        p.tip(`Alcanza para ~${seats} personas (≈ 25 cm de diámetro por comensal).`);
        if (v.tapa === 'simple' && v.diametro > 120) p.tip('Con más de 120 cm de diámetro conviene la tapa doble.');

      } else {
        const seats = Math.max(2, Math.floor(v.ancho / 60) * 2 + (v.ancho >= 140 && v.fondo >= 70 ? 2 : 0));
        p.tip(`Alcanza para ~${seats} personas (60 cm por comensal).`);
        if (v.tapa === 'simple' && v.ancho > 180) p.tip('Con más de 180 cm de largo conviene la tapa doble para que no se sienta flexible.');
      }
      return p.result();
    },
  },

  // ---------------------------------------------------------------- MESA DE ARRIMO
  {
    id: 'arrimo', name: 'Mesa de arrimo', desc: 'Angosta, para pasillo o entrada',
    params: [
      num('ancho', 'Largo', 110, 60, 200, 1, 'cm', { section: 'Medidas' }),
      num('fondo', 'Fondo', 30, 20, 45),
      num('alto', 'Alto', 80, 60, 100, 1, 'cm', { visibleIf: (v) => !isProductStyle(v.pataEstilo) }),
      bool('estante', 'Repisa inferior', true, { section: 'Estructura', visibleIf: (v) => !['inclinada', 'aceroDiagonal'].includes(v.pataEstilo) && !isProductStyle(v.pataEstilo) }),
      num('altoEstante', 'Altura de la repisa', 20, 10, 50, 1, 'cm', { visibleIf: (v) => v.estante && !['inclinada', 'aceroDiagonal'].includes(v.pataEstilo) && !isProductStyle(v.pataEstilo) }),
      num('voladizo', 'Retranqueo de patas', 3, 0, 8, 1, 'cm'),
      ...LEGS('fino', {}, 'wood'),
      ...TABLE_WHEELS(),
      MAT,
    ],
    presets: [
      { name: 'Entrada', values: {} },
      { name: 'Sin repisa', values: { estante: false } },
      { name: 'Pasillo angosto', values: { ancho: 90, fondo: 22, alto: 85 } },
      { name: 'Patas en diagonal', values: { pataEstilo: 'inclinada', estante: false, fondo: 32 } },
      { name: 'Marco de acero', values: { pataEstilo: 'aceroU', estante: true, altoEstante: 25 } },
    ],
    build(v) {
      const p = new PartList();
      tableFrame(p, {
        W: v.ancho * 10, D: v.fondo * 10, H: v.alto * 10, mat: v.mat, layers: 1, leg: legOf(v), casters: casterOf(v), oh: v.voladizo * 10,
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
      num('alto', 'Alto', 75, 65, 80, 1, 'cm', { visibleIf: (v) => !(v.estilo === 'patas' && isProductStyle(v.pataEstilo)) }),
      sel('estilo', 'Estilo', 'paneles', [['paneles', 'Laterales de tablero'], ['patas', 'Patas de pino']], { section: 'Estructura' }),
      sel('tapa', 'Tapa', 'simple', TOP_OPTS),
      bool('panelFrontal', 'Panel trasero (esconde cables)', true, { visibleIf: (v) => v.estilo !== 'patas' || !['inclinada', 'aceroDiagonal', 'afinada', 'redonda', 'redondaAfinada'].includes(v.pataEstilo) }),
      bool('repisaInferior', 'Repisa inferior', false),
      sel('cajonera', 'Cajonera', 'no', [['no', 'Sin cajonera'], ['izq', 'A la izquierda'], ['der', 'A la derecha'], ['ambos', 'A ambos lados']], { visibleIf: (v) => v.estilo === 'paneles' }),
      num('cajones', 'Cantidad de cajones', 3, 1, 5, 1, 'u', { visibleIf: (v) => v.estilo === 'paneles' && v.cajonera !== 'no' }),
      num('anchoCajonera', 'Ancho de la cajonera', 40, 30, 60, 1, 'cm', { visibleIf: (v) => v.estilo === 'paneles' && v.cajonera !== 'no' }),
      ...HANDLES((v) => v.estilo === 'paneles' && v.cajonera !== 'no', true),
      ...LEGS('fino', { visibleIf: (v) => v.estilo === 'patas' }, 'wood'),
      ...TABLE_WHEELS((v) => v.estilo === 'patas'),
      MAT,
    ],
    presets: [
      { name: 'Compacto', values: { ancho: 100, fondo: 55 } },
      { name: 'Cajonera a la izquierda', values: { ancho: 140, fondo: 60, cajonera: 'izq', cajones: 3 } },
      { name: 'Cajonera a la derecha', values: { ancho: 140, fondo: 60, cajonera: 'der', cajones: 3 } },
      { name: 'Doble monitor', values: { ancho: 160, fondo: 70, tapa: 'doble' } },
      { name: 'Marco de acero (industrial)', values: { estilo: 'patas', pataEstilo: 'aceroU', pata: 'fino', ancho: 140, fondo: 70, panelFrontal: false } },
      { name: 'Patas en diagonal', values: { estilo: 'patas', pataEstilo: 'inclinada', pata: 'fino', repisaInferior: false } },
    ],
    build(v) {
      const p = new PartList();
      const { mat } = v;
      const t = SHEETS[mat].t;
      const W = v.ancho * 10;
      const D = v.fondo * 10;
      const H = v.alto * 10;
      let layers = v.tapa === 'doble' ? 2 : 1;
      let topT = t * layers;
      if (v.estilo === 'patas') {
        const o = tableFrame(p, {
          W, D, H, mat, layers, leg: legOf(v), casters: casterOf(v), oh: 30,
          shelf: v.repisaInferior ? { y: 150 } : null,
        });
        const openLegs = ['inclinada', 'aceroDiagonal', 'afinada', 'redonda', 'redondaAfinada'].includes(v.pataEstilo);
        if (v.panelFrontal && openLegs) {
          p.tip('Con patas en diagonal o patas listas no se agrega el panel trasero: no hay faldón ni estructura donde fijarlo.');
        } else if (v.panelFrontal) {
          p.B('Panel trasero', mat, o.ohx + o.s, o.yA - 250, o.ohz, W - 2 * o.ohx - 2 * o.s, 250, 'u');
          p.joint(250, 2);
        }
      } else {
        const ox = 20; // la tapa sobresale de los laterales
        const oz = 30;
        // espacio mínimo: 40 cm libres para las piernas y 30 cm por cajonera; si no alcanza, se ajusta o se omite
        let mode = v.cajonera;
        const free = W - 2 * ox - 400;
        if (mode === 'ambos' && free < 600) { mode = 'izq'; p.tip('El escritorio es corto para dos cajoneras: se dejó solo la de la izquierda.'); }
        if (mode !== 'no' && mode !== 'ambos' && free < 300) { mode = 'no'; p.tip('El escritorio es muy corto para una cajonera (mínimo ~75 cm de largo): se quitó.'); }
        let wc = Math.max(300, Math.min(v.anchoCajonera * 10, mode === 'ambos' ? free / 2 : free));
        // hacen falta ≥ 50 cm libres para las piernas: se angosta la cajonera, y si aun así no alcanza, se quita una o todas
        const legroom = (m2, w2) => W - 2 * ox - (m2 === 'izq' || m2 === 'ambos' ? w2 : t) - (m2 === 'der' || m2 === 'ambos' ? w2 : t);
        const asked = `${mode}/${wc}`;
        while (mode !== 'no' && legroom(mode, wc) < 500) {
          if (wc > 300) wc = Math.max(300, wc - (500 - legroom(mode, wc)) / (mode === 'ambos' ? 2 : 1));
          else mode = mode === 'ambos' ? 'izq' : 'no';
        }
        if (`${mode}/${wc}` !== asked && v.cajonera !== 'no') p.tip(mode === 'no' ? 'No cabe la cajonera dejando 50 cm libres para las piernas: se quitó. Alarga el escritorio si la quieres.' : `Para dejar 50 cm libres para las piernas, la cajonera se ajustó a ${cm(wc)} cm de ancho${mode !== v.cajonera ? ' y quedó solo una' : ''}.`);
        const leftC = mode === 'izq' || mode === 'ambos';
        const rightC = mode === 'der' || mode === 'ambos';
        // entre laterales de más de 120 cm la tapa de un tablero flecta: se pasa sola a tapa doble
        const ivEst = (W - ox - (rightC ? wc : t)) - (ox + (leftC ? wc : t));
        if (layers === 1 && ivEst > 1200) { layers = 2; topT = t * 2; p.tip(`Entre laterales hay ${cm(ivEst)} cm: se usó tapa doble automáticamente para que no flecte.`); }
        stackTop(p, mat, layers, 0, H, 0, W, D, 'frbl');
        const hspec = handleFromValues(v);
        const fronts = [];
        const fxs = [];
        let leftEdge = ox + t;
        let rightEdge = W - ox - t;
        let plainSides = 0;
        const unit = (x) => {
          const r = drawerUnit(p, { mat, x, z: oz, w: wc, d: D - 2 * oz, H, topT, n: v.cajones, handle: hspec });
          fronts.push(...r.fronts);
          fxs.push(...r.fixtures);
        };
        if (leftC) { unit(ox); leftEdge = ox + wc; } else { p.V('Lateral', mat, ox, 0, oz, H - topT, D - 2 * oz, 'f'); plainSides++; }
        if (rightC) { unit(W - ox - wc); rightEdge = W - ox - wc; } else { p.V('Lateral', mat, W - ox - t, 0, oz, H - topT, D - 2 * oz, 'f'); plainSides++; }
        p.joint(D - 2 * oz, 2 * plainSides);
        const iw = rightEdge - leftEdge; // espacio libre para las piernas
        if (fronts.length) {
          handleSummary(p, hspec, fronts, fxs, 'cajón');
          p.tip(`La cajonera tiene ${v.cajones} cajones con correderas telescópicas; las cajas son de melamina de 15 mm con fondo de MDF de 3 mm.`);
        }
        if (v.panelFrontal) {
          p.B('Panel trasero', mat, leftEdge, H - topT - 350, oz, iw, 350, 'u');
          p.joint(350, 2);
        }
        if (v.repisaInferior) {
          p.H('Repisa inferior', mat, leftEdge, 150, oz, iw, D - 2 * oz, 'f');
          p.joint(D - 2 * oz, 2);
        }
        if (layers > 1) p.hardware('Tornillo 4×30 mm (unir capas de la tapa)', Math.ceil((W * D) / 40000), 'Además de cola');
        if (plainSides) p.hardware('Nivelador de patas regulable', plainSides * 2, 'Bajo los laterales');
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
      const front = legSpec(v.pataEstilo === 'afinada' ? 'afinada' : 'cuadrada', v.pata, { cut: true }); // patas delanteras
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
      if (n < v.tablas) p.tip(`Con ese alto solo caben ${n} tabla(s) en el respaldo: se dejaron ${n}. Sube el alto total si quieres más.`);
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
      num('compartimentos', 'Compartimentos (fila inferior)', 3, 1, 5, 1, 'u', { section: 'Estructura' }),
      sel('puertasEn', 'Puertas', 'todas', [['todas', 'En todos'], ['centro', 'Solo en el centro'], ['extremos', 'Solo en los extremos'], ['ninguna', 'Sin puertas (abierto)']]),
      bool('nivelSuperior', 'Segunda fila abierta arriba', false),
      num('altoSuperior', 'Alto de la fila superior', 16, 10, 25, 1, 'cm', { visibleIf: (v) => v.nivelSuperior }),
      num('colsSuperior', 'Compartimentos de la fila superior', 3, 1, 6, 1, 'u', { visibleIf: (v) => v.nivelSuperior }),
      ...HANDLES((v) => v.puertasEn !== 'ninguna'),
      sel('base', 'Base', 'patas', BASE_OPTS),
      num('altoBase', 'Alto de la base', 12, 3, 25, 1, 'cm', { visibleIf: showBaseH }),
      ...CARCASS_LEGS('fino'),
      sel('trasera', 'Parte trasera', 'rails', BACK_OPTS),
      MAT,
    ],
    presets: [
      { name: 'Para TV de 55"', values: {} },
      { name: 'Para TV de 65"', values: { ancho: 180, compartimentos: 4 } },
      { name: 'Puertas en los extremos', values: { compartimentos: 3, puertasEn: 'extremos', alto: 55 } },
      { name: 'Con fila abierta arriba', values: { nivelSuperior: true, puertasEn: 'centro', compartimentos: 3, alto: 60, ancho: 180 } },
      { name: 'Abierto, sin puertas', values: { puertasEn: 'ninguna', compartimentos: 2 } },
    ],
    build(v) {
      const p = new PartList();
      const W = v.ancho * 10;
      const n = v.compartimentos;
      // celdas con puerta según el patrón elegido
      const doorCells = v.puertasEn === 'centro' ? (n % 2 ? [(n - 1) / 2] : [n / 2 - 1, n / 2])
        : v.puertasEn === 'extremos' ? (n > 1 ? [0, n - 1] : [0]) : undefined;
      const rows = [{ cols: n, door: v.puertasEn !== 'ninguna', doorCells }];
      if (v.nivelSuperior) rows.push({ h: v.altoSuperior * 10, cols: v.colsSuperior });
      carcass(p, {
        mat: v.mat, W, D: v.fondo * 10, H: v.alto * 10, rows,
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
      ...CARCASS_LEGS('fino'),
      sel('trasera', 'Parte trasera', 'rails', BACK_OPTS),
      MAT,
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
      // la tapa debe alojar un tocadiscos estándar (~43 × 36 cm) y los discos (31,5 cm) deben entrar: si se pide menos, se amplía solo
      const z3 = v.trasera === 'hdf' ? SHEETS.hdf3.t : 0;
      const Wd = Math.max(v.ancho * 10, 450);
      const Dd = Math.max(v.fondo * 10, 400, filas > 0 ? 328 + z3 : 0);
      if (Wd > v.ancho * 10 || Dd > v.fondo * 10) p.tip(`Se amplió la tapa a ${cm(Wd)} × ${cm(Dd)} cm para que quepa un tocadiscos estándar (≈ 43 × 36 cm).`);
      const r = carcass(p, {
        mat: v.mat, W: Wd, D: Dd, rows,
        base: v.base, baseH: v.altoBase * 10, back: v.trasera, leg: legOf(v), loadFactor: 0.8,
      });
      p.tip(`Superficie superior: ${v.ancho} × ${v.fondo} cm. Un tocadiscos típico mide ~43 × 36 cm.`);
      if (filas > 0) {
        const cw = r.rows[0].cw;
        const lps = filas * v.columnas * Math.round((cw / 10) * 2);
        p.tip(`Capacidad aproximada: ${lps} vinilos (2 por cm de ancho libre).`);
      }
      p.tip('Apoya el tocadiscos sobre una base antivibración y evita ponerlo junto al parlante.');
      return p.result();
    },
  },

  // ---------------------------------------------------------------- CREDENZA
  {
    id: 'credenza', name: 'Credenza tocadiscos', desc: 'Módulo para tocadiscos y receiver + celdas de vinilos',
    params: [
      num('ancho', 'Largo total', 150, 100, 220, 1, 'cm', { section: 'Medidas' }),
      num('fondo', 'Fondo', 42, 36, 55),
      num('alto', 'Alto total (lado de los vinilos)', 78, 60, 100),
      sel('lado', 'Tocadiscos a la', 'izq', [['izq', 'Izquierda'], ['der', 'Derecha']], { section: 'Módulo del tocadiscos' }),
      num('anchoModulo', 'Ancho del módulo del tocadiscos', 70, 50, 110),
      num('altoPlataforma', 'Altura de la plataforma', 52, 35, 75),
      sel('frente', 'Frente del compartimento del receiver', 'puerta', [['puerta', 'Con puerta'], ['abierto', 'Abierto']]),
      ...HANDLES((v) => v.frente !== 'abierto'),
      num('columnas', 'Columnas de vinilos', 3, 1, 5, 1, 'u', { section: 'Módulo de vinilos' }),
      num('filas', 'Filas de vinilos', 1, 1, 2, 1, 'u'),
      sel('base', 'Base', 'patas', [['none', 'Sin base'], ['patas', 'Patas'], ['ruedas', 'Ruedas giratorias']], { section: 'Estructura' }),
      num('altoBase', 'Alto de la base', 15, 5, 30, 1, 'cm', { visibleIf: isLegs }),
      ...CARCASS_LEGS('fino', 'inclinada'),
      MAT,
    ],
    presets: [
      { name: 'Tocadiscos a la izquierda', values: {} },
      { name: 'Tocadiscos a la derecha', values: { lado: 'der' } },
      { name: 'Compacta 120 cm', values: { ancho: 120, anchoModulo: 55, columnas: 2, alto: 72 } },
      { name: 'Con patas de acero', values: { pataEstilo: 'aceroDiagonal', pata: 'fino' } },
      { name: 'Frente abierto + patas rectas', values: { frente: 'abierto', pataEstilo: 'cuadrada' } },
    ],
    build(v) {
      const p = new PartList();
      const tt = SHEETS[v.mat].t;
      // el tocadiscos pide 44 cm libres de ancho y 38 cm de fondo, y el módulo de vinilos al menos 35 cm: si no alcanza, se amplía solo
      const Wt = Math.max(v.anchoModulo * 10, 440 + 2 * tt);
      const W = Math.max(v.ancho * 10, Wt + 350);
      const Dc = Math.max(v.fondo * 10, 380);
      if (W > v.ancho * 10 || Dc > v.fondo * 10 || Wt > v.anchoModulo * 10) p.tip(`Se ajustaron las medidas para que quepa un tocadiscos estándar y un módulo de vinilos útil: largo ${cm(W)} cm, fondo ${cm(Dc)} cm, módulo del tocadiscos ${cm(Wt)} cm.`);
      credenza(p, {
        mat: v.mat, W, D: Dc, H: v.alto * 10, platformH: v.altoPlataforma * 10,
        Wt, side: v.lado, cols: v.columnas, rows: v.filas, front: v.frente,
        base: v.base, baseH: v.altoBase * 10, leg: legOf(v), handle: handleFromValues(v),
      });
      return p.result();
    },
  },

  // ---------------------------------------------------------------- MUEBLE VINILOS
  {
    id: 'vinilos', name: 'Mueble para vinilos', desc: 'Grilla de celdas para LPs de 12"',
    params: [
      num('columnas', 'Columnas', 4, 1, 6, 1, 'u', { section: 'Medidas' }),
      num('filas', 'Filas', 4, 1, 6, 1, 'u'),
      num('anchoCelda', 'Ancho libre de cada celda', 34, 20, 40),
      num('alturaCelda', 'Alto libre de cada celda', 34, 32, 40),
      num('fondo', 'Fondo', 36, 33, 45),
      sel('base', 'Base', 'patas', BASE_OPTS, { section: 'Estructura' }),
      num('altoBase', 'Alto de la base', 8, 3, 20, 1, 'cm', { visibleIf: showBaseH }),
      ...CARCASS_LEGS('grueso'),
      sel('trasera', 'Parte trasera', 'hdf', BACK_OPTS),
      sel('puertas', 'Puertas', 'no', [['no', 'Sin puertas (abierto)'], ['abajo', 'Solo en la fila inferior'], ['todas', 'En todas las celdas']]),
      ...HANDLES((v) => v.puertas && v.puertas !== 'no'),
      MAT,
    ],
    presets: [
      { name: '4 × 4 (≈1.000 LPs)', values: {} },
      { name: 'Con puertas abajo', values: { columnas: 3, filas: 4, puertas: 'abajo' } },
      { name: '2 × 4 chico', values: { columnas: 2, filas: 4 } },
      { name: 'Largo bajo 6 × 2', values: { columnas: 6, filas: 2 } },
    ],
    build(v) {
      const p = new PartList();
      const t = SHEETS[v.mat].t;
      const cw = v.anchoCelda * 10;
      // ningún tablero puede pasar del largo de la plancha (2,44 m): se limita la cantidad de columnas y filas
      const MAXL = 2430;
      let colsV = v.columnas;
      let filasV = v.filas;
      while (colsV > 1 && colsV * cw + (colsV + 1) * t > MAXL) colsV--;
      while (filasV > 1 && v.altoBase * 10 + filasV * v.alturaCelda * 10 + (filasV + 1) * t > MAXL) filasV--;
      if (colsV < v.columnas || filasV < v.filas) p.tip(`Para que cada tablero quepa en una plancha (2,44 m) se dejaron ${colsV} columnas y ${filasV} filas. Para más capacidad, agrega otro mueble.`);
      const W = colsV * cw + (colsV + 1) * t;
      const rows = Array.from({ length: filasV }, (_, i) => ({ h: v.alturaCelda * 10, cols: colsV, door: v.puertas === 'todas' || (v.puertas === 'abajo' && i === 0) }));
      const Dv = Math.max(v.fondo * 10, 328 + (v.trasera === 'hdf' ? SHEETS.hdf3.t : 0)); // un LP de 12" mide 31,5 cm
      if (Dv > v.fondo * 10) p.tip(`El fondo se amplió a ${cm(Dv)} cm para que los discos entren completos.`);
      const r = carcass(p, {
        mat: v.mat, W, D: Dv, rows,
        base: v.base, baseH: v.altoBase * 10, back: v.trasera, leg: legOf(v), loadFactor: 1, handle: handleFromValues(v),
      });
      const perCell = Math.round(v.anchoCelda * 2);
      const total = perCell * colsV * filasV;
      const kg = Math.round(total * 0.25);
      p.tip(`Capacidad aproximada: ${perCell} LPs por celda, ${total} en total (2 por cm de ancho libre).`);
      p.tip(`Peso estimado con todos los discos: ~${kg} kg (≈ 250 g por LP con funda).`);
      if (kg > 250) {
        p.hardware('Kit anti-vuelco (escuadra + tarugo)', 2, 'Para fijar el mueble a la muralla');
        p.tip(`Cargado pesa ~${kg} kg: apóyalo en piso firme; se incluyó el kit anti-vuelco para fijarlo a la muralla.`);
      } else if (kg > 120) {
        p.tip('Con todos los discos es un mueble pesado: apóyalo en piso firme y fíjalo a la muralla.');
      }
      return p.result();
    },
  },
];

export const getType = (id) => FURNITURE.find((f) => f.id === id) || FURNITURE[0];

export const defaultsFor = (type) =>
  Object.fromEntries(type.params.map((p) => [p.key, p.def]));

/**
 * Ajusta valores guardados por versiones anteriores:
 * tamaño de pata 'pino41'/'pino70' → 'fino'/'grueso', y las ruedas, que antes eran un "estilo de pata",
 * pasan a ser una base propia.
 */
export function normalizeValues(values, typeId) {
  const v = { ...values };
  if (v.pata) v.pata = normSize(v.pata);
  if (typeId === 'rackTv' && typeof v.puertas === 'boolean' && v.puertasEn === undefined) v.puertasEn = v.puertas ? 'todas' : 'ninguna'; // el rack antiguo tenía "Puertas" sí/no
  if (v.base === 'patas' && v.pataEstilo === 'ruedas') {
    v.base = 'ruedas';
    v.ruedaTam = v.pata || 'fino';
    v.pataEstilo = 'cuadrada';
  }
  return v;
}

/** Construye el mueble a partir de valores (completados con los valores por defecto). */
export function buildFurniture(typeId, values) {
  const type = getType(typeId);
  const v = { ...defaultsFor(type), ...normalizeValues(values || {}, type.id) };
  try {
    return { fixtures: [], ...type.build(v), error: null };
  } catch (e) {
    return { parts: [], fixtures: [], hardware: [], notes: [], bbox: { min: [0, 0, 0], max: [0, 0, 0], dims: [0, 0, 0] }, error: String(e) };
  }
}
