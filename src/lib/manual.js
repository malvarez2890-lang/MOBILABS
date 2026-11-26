import { cm } from './util.js';

/**
 * Manual de armado generado a partir de las piezas reales del mueble.
 * Las piezas se nombran con su letra del despiece (A, B, C…) para ubicarlas en la lista de cortes.
 */
export function buildManual(model, plans, shop) {
  const groups = plans.groups;
  const names = new Set(model.parts.map((p) => p.name));
  const has = (...ns) => ns.some((n) => names.has(n));
  const hasRe = (re) => [...names].some((n) => re.test(n));
  const fx = (kind) => model.fixtures.filter((f) => f.kind === kind).length;
  const hw = (re) => shop.hardware.find((h) => re.test(h.name));
  const qty = (n) => groups.filter((g) => g.name === n).reduce((a, g) => a + g.qty, 0);
  /** "Lateral (A)" o "Repisa (D, E)" */
  const ref = (...ns) => {
    const gs = groups.filter((g) => ns.includes(g.name) || ns.some((n) => n instanceof RegExp && n.test(g.name)));
    if (!gs.length) return ns.filter((n) => typeof n === 'string').join(' / ').toLowerCase() || 'pieza';
    const first = gs[0].name;
    return `${first.toLowerCase()} (${gs.map((g) => g.label).join(', ')})`;
  };
  const refAll = (re) => {
    const gs = groups.filter((g) => re.test(g.name));
    return gs.length ? `(${gs.map((g) => g.label).join(', ')})` : '';
  };

  const carcass = has('Lateral') && has('Base inferior', 'Tapa superior');
  const deskPanels = !carcass && has('Lateral') && has('Tapa');
  const frameTable = has('Faldón largo', 'Faldón corto');
  const chair = has('Asiento');
  const productLegs = fx('productLeg') > 0;
  const steel = model.fixtures.some((f) => f.kind === 'metalLeg' && f.tube);
  const metalLegs = model.fixtures.some((f) => f.kind === 'metalLeg' && !f.tube);
  const casters = fx('caster') > 0;
  const woodLegs = hasRe(/^Pata/);
  const doors = has('Puerta');
  const drawers = has('Frente de cajón');
  const back = has('Trasera');
  const rails = has('Travesaño trasero');
  const panelBack = has('Panel trasero');
  const shelves = has('Repisa');
  const dividers = has('Divisor', 'Divisor central');
  const zocalo = has('Zócalo');
  const hasTop = hasRe(/^Tapa/);
  const handles = fx('handle') > 0;
  const platform = has('Plataforma del tocadiscos');
  const antiTip = !!hw(/anti-vuelco/i);

  // ---- imágenes de cada paso: se arma el mueble por etapas (las piezas nuevas se resaltan) ----
  const idsByName = new Map();
  model.parts.forEach((q) => { if (!idsByName.has(q.name)) idsByName.set(q.name, []); idsByName.get(q.name).push(q.id); });
  const labelOfId = new Map();
  groups.forEach((g) => g.ids.forEach((id) => labelOfId.set(id, g.label)));
  const used = new Set();
  let fxMode = 'none';
  const nameTest = (sel) => (sel instanceof RegExp ? (nm) => sel.test(nm) : (nm) => nm === sel);
  /** Paso con imagen: specs = [nombre|regex, cantidad?]; fx = 'legs' | 'all' (elementos comprados visibles desde este paso). */
  const st = (text, specs = [], fx) => {
    const hl = [];
    for (const spec of specs) {
      const [sel, n = Infinity] = Array.isArray(spec) ? spec : [spec];
      const ok = nameTest(sel);
      for (const [nm, ids] of idsByName) if (ok(nm)) ids.filter((id) => !used.has(id)).slice(0, n).forEach((id) => { used.add(id); hl.push(id); });
    }
    if (fx) fxMode = fx;
    if (!hl.length && !fx) return { t: text };
    return { t: text, stage: { show: [...used], hl, fx: fxMode, labels: hl.map((id) => [id, labelOfId.get(id)]).filter((x) => x[1]) } };
  };
  const S = []; // secciones
  const add = (title, steps) => {
    const list = steps.filter(Boolean).map((x) => (typeof x === 'string' ? { t: x } : x));
    if (list.length) S.push({ title, steps: list });
  };

  // ---- 1. antes de empezar ----
  const tools = ['taladro/atornillador con brocas de 5, 7 y 8 mm', 'escuadra y huincha de medir', 'lápiz', 'martillo de goma', 'paño y cola fría para madera'];
  if (doors) tools.push('broca sierra copa de 35 mm (bisagras)');
  if (drawers) tools.push('nivel de burbuja');
  else tools.push('nivel de burbuja');
  if (shop.edging.length) tools.push('plancha doméstica (tapacanto termoadhesivo) y cuchillo');
  add('Antes de empezar', [
    `Despeja un espacio de unos 2 × 2 m y protege el piso con cartón o una manta. Trabaja sobre una superficie plana.`,
    `Herramientas: ${tools.join(', ')}.`,
    `Revisa las piezas contra el Despiece (${model.parts.length} piezas, ${groups.length} medidas distintas) y marca cada una con su letra con un lápiz suave por el lado que quedará oculto.`,
    `Revisa la lista de compras: confirmat, tarugos y herrajes deben estar completos antes de partir. Mide el espesor real del tablero: puede variar ±0,5 mm.`,
    model.notes.some((n) => n.level === 'warn') ? `Lee las advertencias del diseño en la pestaña Piezas antes de armar: ${model.notes.filter((n) => n.level === 'warn').map((n) => n.text).join(' ')}` : null,
  ]);

  // ---- 2. preparar piezas ----
  const prep = [];
  if (shop.edging.length) {
    prep.push(`Pega el tapacanto en los cantos marcados del Despiece (columna “Canto”): apoya la tira, pásale la plancha tibia, presiona con un taco y recorta el sobrante con cuchillo; lija suave el borde. Hazlo antes de armar: después no se puede.`);
  }
  if (woodLegs || frameTable || has('Listón del marco de repisa')) {
    prep.push(`Lija la madera de pino con grano 120 y luego 180, sigue la dirección de la veta, y redondea las aristas. Aplica sellador y barniz antes de armar las partes que quedarán ocultas (después es más difícil).`);
  }
  prep.push(`Marca y taladra los agujeros de confirmat: 5 mm en el canto de la pieza (a 50 mm del borde y luego cada ~250 mm) y 7 mm pasante en la cara de la pieza que se une. Haz primero una prueba en un retazo.`);
  if (doors) {
    const nh = hw(/^bisagra/i)?.qty;
    prep.push(`Puertas: abre el taladro de cazoleta de 35 mm a 12 mm del borde de la puerta (profundidad 12 mm; ¡no la atraviese!), con ${nh ? `${nh} bisagras en total` : '2–3 bisagras por puerta'}: a 10 cm de cada extremo${doors ? ' y centrada si lleva tres' : ''}.`);
  }
  if (handles) prep.push(`Taladra los tiradores en las puertas/frentes siguiendo las medidas del modelo 3D (distancia al borde y altura indicadas en Propiedades). Marca con huincha y confirma con un trozo de cinta de enmascarar antes de taladrar.`);
  add('Preparación de las piezas', prep);

  // ---- 3. armado ----
  const asm = [];
  if (model.parts.length >= 4) {
    asm.push({
      t: 'Antes de armar, ubica todas las piezas con la vista explosionada: cada letra es una pieza del despiece y “×n” indica cuántas hay iguales. Así sabes dónde va cada una.',
      stage: { show: model.parts.map((q) => q.id), hl: [], fx: 'none', labels: model.parts.map((q) => [q.id, labelOfId.get(q.id)]).filter((x) => x[1]), explode: 1.5 },
    });
  }
  if (carcass) {
    const lat = ref('Lateral');
    asm.push(st(`Pon un ${lat.split(' (')[0].toLowerCase()} ${lat.slice(lat.indexOf('('))} acostado sobre el cartón, con la cara bonita hacia abajo.`, [['Lateral', 1]]));
    asm.push(st(`Une la ${ref('Base inferior')} al lateral: encola los tarugos, encaja y atornilla los confirmat. Escuadra con la escuadra antes de apretar del todo.`, ['Base inferior']));
    if (shelves || dividers) {
      asm.push(st(`Monta ${[shelves ? `las ${ref('Repisa')} (${qty('Repisa')})` : null, dividers ? `los ${ref('Divisor', 'Divisor central')}` : null].filter(Boolean).join(' y ')} respetando las alturas del modelo 3D: marca la posición con una huincha en ambos laterales y comprueba cada nivel con la escuadra.`, ['Repisa', 'Divisor', 'Divisor central']));
    }
    if (platform) asm.push(st(`Coloca la ${ref('Plataforma del tocadiscos')}: debe quedar nivelada y apoyada en el divisor y el lateral.`, ['Plataforma del tocadiscos']));
    asm.push(st(`Pon el segundo lateral encima, encaja todas las uniones y aprieta los confirmat en cruz, sin forzar el aglomerado. Limpia la cola que salga con un paño húmedo.`, [['Lateral']]));
    if (hasTop) asm.push(st(`Fija la ${ref('Tapa superior', 'Tapa')} por arriba con tarugos y confirmat. Que sobresalga parejo en todos los lados.`, ['Tapa superior', 'Tapa']));
    if (back) {
      asm.push(st(`Antes de fijar la trasera, mide las dos diagonales del mueble: deben ser iguales (±1 mm). Si no, empuja en diagonal hasta que coincidan. Luego clava o atornilla la ${ref('Trasera')} cada ~15 cm: así el mueble queda escuadrado y rígido.`, ['Trasera']));
    } else if (rails) {
      asm.push(st(`Atornilla los ${ref('Travesaño trasero')} arriba y abajo. Mide las diagonales: deben ser iguales para que el mueble quede escuadrado.`, ['Travesaño trasero']));
    }
    if (zocalo) asm.push(st(`Fija el ${ref('Zócalo')} retranqueado en el frente y atrás, con tornillos 4×40 mm y escuadras si es necesario. Instala los niveladores.`, ['Zócalo'], 'legs'));
  } else if (chair) {
    asm.push(st(`Arma los dos costados: une cada ${ref('Pata delantera')} con su ${ref('Pata trasera')} mediante los ${ref('Travesaño lateral')} y el ${ref('Faldón lateral')}, con tarugos encolados. Verifica la escuadra con la escuadra de carpintero.`, [/^Pata/, 'Travesaño lateral', 'Faldón lateral']));
    asm.push(st(`Une los dos costados con el ${ref('Faldón')} y el ${ref('Travesaño inferior')}. Mide las diagonales: deben ser iguales.`, ['Faldón', 'Travesaño inferior']));
    asm.push(st(`Atornilla el ${ref('Asiento')} sobre los faldones desde abajo, centrado, y fija la ${ref('Tabla de respaldo')} a las patas traseras a la altura del plano.`, ['Asiento', 'Tabla de respaldo']));
    asm.push(`Comprueba que no cojea: las cuatro patas deben apoyar a la vez; si no, rebaja la más larga con lija.`);
  } else if (deskPanels) {
    asm.push(st(`Si el escritorio lleva cajonera: arma primero su caja (${ref('Lateral')}, ${ref('Base de cajonera')} y ${ref('Trasera de cajonera')}) con confirmat y verifica la escuadra con las diagonales.`, ['Lateral', 'Base de cajonera', 'Trasera de cajonera']));
    asm.push(st(`Coloca los ${ref('Lateral')} de pie, a la separación del plano, y une el ${ref('Panel trasero')} entre ellos si el diseño lo lleva.`, ['Lateral', 'Panel trasero']));
    asm.push(st(`Pon la ${ref('Tapa')} con la cara bonita hacia abajo, apoya encima el conjunto de laterales y fíjalo con confirmat/escuadras desde adentro; la tapa debe sobresalir parejo por los costados.`, [/^Tapa/]));
    asm.push(`Da vuelta el escritorio entre dos personas (o apoyado en un lateral) y verifica que quede a plomo.`);
  } else if (frameTable) {
    asm.push(st(`Arma los dos marcos laterales: une cada ${ref(/^Faldón (corto|lateral)$/)} a dos patas con tarugos encolados y tornillo 4×50 mm; verifica que queden en escuadra.`, [/^Pata/, /^Faldón (corto|lateral)$/]));
    asm.push(st(`Une los marcos con los ${ref(/^Faldón (largo)$/)} formando la estructura; si hay ${ref('Travesaño central')}, agrégalos ahora. Mide las diagonales para comprobar que está en escuadra.`, [/^Faldón largo$/, 'Travesaño central']));
    if (has('Listón del marco de repisa')) asm.push(st(`Fija el marco de la repisa inferior (${ref('Listón del marco de repisa')}) en los topes cuadrados de las patas y atornilla la ${ref('Repisa inferior')} desde abajo al marco.`, [/^Listón del marco/, 'Repisa inferior']));
    if (has('Panel trasero')) asm.push(st(`Atornilla el ${ref('Panel trasero')} a los faldones traseros por dentro.`, ['Panel trasero']));
    asm.push(st(`Da vuelta la tapa (${ref('Tapa').replace(/^Tapa/, 'tapa')}) con la cara bonita hacia abajo sobre el cartón, apoya la estructura encima centrada y fíjala con las escuadras metálicas y tornillos 4×16 mm.`, [/^Tapa/]));
  } else if (productLegs) {
    asm.push(st(`Pon la ${ref('Tapa')} con la cara bonita hacia abajo sobre una manta.`, [/^Tapa/]));
    asm.push(st(`Marca la posición de las patas: respeta el retranqueo del plano (cota en la planta). Atornilla las ${hw(/^placa de montaje/i)?.qty || 4} placas de montaje bajo la tapa, con tornillos 4×16 mm sin atravesarla.`, [/^Tapa/]));
    asm.push(st(`Enrosca cada pata cónica en su placa (traen un tornillo o inserto roscado). Apriétalas a mano y gira hasta que no hagan juego; si se sueltan, agrega un poco de cola o fijador.`, [], 'legs'));
  } else if (steel) {
    asm.push(st(`Suelda o atornilla el marco de acero según el plano (lo normal es mandarlo a hacer a un taller con las cotas indicadas). Revisa que quede plano y en escuadra y pásale una mano de pintura negro mate.`, [], 'legs'));
    asm.push(st(`Da vuelta la tapa con la cara bonita hacia abajo, apoya el marco encima y fíjalo con las placas y tornillos 4×16 mm desde los rieles superiores.`, [/^Tapa/]));
  } else if (metalLegs || woodLegs) {
    asm.push(`Une las partes principales según el modelo 3D (revisa cada letra del Despiece) con tarugos, cola y tornillos.`);
  } else {
    asm.push(`Une las piezas según el modelo 3D con tarugos, cola y tornillos; verifica la escuadra con las diagonales.`);
  }
    add('Armado de la estructura', asm);

  // ---- 4. base / patas ----
  const baseSteps = [];
  if (carcass && !zocalo) {
    if (productLegs) baseSteps.push(st(`Atornilla las ${hw(/^placa de montaje/i)?.qty || 4} placas de montaje bajo la base inferior (a ~25 mm de los bordes) y enrosca las patas cónicas. Son un producto listo de altura fija: no se cortan ni se ajustan.`, [], 'legs'));
    else if (woodLegs || metalLegs) baseSteps.push(st(`Ubica las patas a ~25 mm de los bordes de la base y atornilla con 2 tornillos 5×50 mm cada una, más una escuadra de refuerzo.${model.fixtures.some((f) => f.rot) ? ' En patas inclinadas, respeta el ángulo del plano.' : ''}`, [], 'legs'));
    if (casters) baseSteps.push(`Atornilla las placas de las ruedas con tornillos 5×30 mm. Pon las dos ruedas con freno delante.`);
  }
  add('Base y patas', baseSteps);

  // ---- 5. cajones ----
  if (drawers) {
    const nSl = hw(/^corredera/i)?.qty || 0;
    // detalle ampliado de UN cajón, con sus piezas separadas y rotuladas
    const f0 = model.parts.find((q) => q.name === 'Frente de cajón');
    const unit = f0 ? model.parts.filter((q) => /de cajón$/.test(q.name) && q.center[1] >= f0.min[1] - 5 && q.center[1] <= f0.min[1] + f0.size[1] + 5 && Math.abs(q.center[0] - (f0.min[0] + f0.size[0] / 2)) <= f0.size[0] / 2 + 40).map((q) => q.id) : [];
    const unitStage = unit.length ? { show: unit, hl: [], fx: 'none', labels: unit.map((id) => [id, labelOfId.get(id)]).filter((x) => x[1]), explode: 1.8, frame: 'subset' } : undefined;
    add('Cajones', [
      { t: `Arma cada cajón: une los costados de cajón ${refAll(/^Costado de cajón/)}, el trasero ${refAll(/^Trasero de cajón/)} y el frente ${refAll(/^Frente de cajón/)} con confirmat, y desliza el fondo ${refAll(/^Fondo de cajón/)} en la caja antes de cerrar (o fíjalo por debajo). Verifica la escuadra.`, stage: unitStage },
      st(`Coloca los cajones armados en el mueble: cada letra con “×n” indica cuántos hay iguales. Más abajo se fijan las correderas.`, [/^Costado de cajón/, /^Trasero de cajón/, /^Frente de cajón/, /^Fondo de cajón/], 'all'),
      `Atornilla las correderas telescópicas (${nSl ? `${nSl} pares` : 'una por lado'}) al costado de cada cajón y al interior del mueble, a la misma altura en ambos lados, usando un tope o plantilla del mismo alto.`,
      `Instala el frente: apóyalo con cinta doble faz, comprueba holguras de 2–3 mm, y atornilla desde dentro con tornillos 4×30 mm.`,
    ]);
  }

  // ---- 6. puertas ----
  if (doors) {
    add('Puertas y tiradores', [
      st(`Fija las placas de bisagra al lateral/divisor a ~37 mm del borde frontal, alineadas con las cazoletas. Enclava la puerta, ajusta profundidad, altura y holgura con los tornillos de las bisagras (holgura pareja de ~3 mm).`, ['Puerta']),
      handles ? st(`Atornilla los tiradores en los agujeros marcados. Usa tornillos de largo adecuado al espesor de la puerta (tiradores de barra: 2 por puerta).`, [], 'all') : null,
    ]);
  } else if (handles) {
    add('Tiradores', [`Atornilla los tiradores en los agujeros marcados en los frentes.`]);
  }

  // ---- 7. cierre ----
  const fin = [
    { t: `Pon el mueble en su lugar, nivela con un nivel de burbuja y ajusta los niveladores o calza la pata más corta. Revisa que ninguna puerta o cajón roce.`, stage: { show: model.parts.map((q) => q.id), hl: [], fx: 'all', labels: [] } },
    antiTip ? `Fija el mueble a la muralla con el kit anti-vuelco (escuadra + tarugo): es alto y angosto, y es obligatorio si hay niños en casa.` : null,
    productLegs && has('Tapa') && !carcass ? `Prueba la estabilidad empujando suavemente por un costado: si oscila, aprieta las placas o refuerza con otra pata/placa intermedia.` : null,
    `Limpia el polvo y los restos de cola con un paño húmedo. Las superficies de melamina se limpian con paño suave; evita solventes en los cantos.`,
    `Comprueba una vez más los tornillos tras la primera semana de uso y reapriétalos si hace falta.`,
  ];
  add('Terminación e instalación', fin);

  let n = 1;
  S.forEach((s) => { s.start = n; s.steps.forEach((q, i) => { q.id = `${s.title}#${i}`; }); n += s.steps.length; });
  return { sections: S, stepCount: n - 1 };
}
