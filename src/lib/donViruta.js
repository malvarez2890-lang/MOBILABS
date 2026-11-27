/**
 * Don Viruta como asistente: estados (pose + mensajes), eventos de la app y un bus para comunicarlos.
 * Cualquier parte de la app avisa con virutaEmit('project_saved', {...}) y el asistente reacciona.
 * Los mensajes solo hablan de lo que la app sabe de verdad (alertas del modelo, guardado, cortes…): nada inventado.
 */
import { OFICIO, poseUrl } from './viruta.js';

const pick = (arr) => arr[Math.floor(Math.random() * arr.length)];

/**
 * DonVirutaState: cada estado tiene una lista de poses en orden de preferencia (la primera que exista se usa; así,
 * cuando llegue p. ej. brazos-cruzados.webp, se ocupa sola) y sus mensajes cortos.
 */
export const STATES = {
  welcome: { poses: ['saluda'], msgs: ['¿Qué vamos a construir hoy?', '¡Bienvenido al taller, maestro!'] },
  working: { poses: ['taladro'], msgs: ['¡Manos a la obra!', '¡Ya, a darle!'] },
  saved: { poses: ['pulgar'], msgs: ['¡Listo, maestro! Quedó guardadito.', '¡Buena! Guardado en tu cuenta.'] },
  error: { poses: ['rasca', 'apuro'], msgs: ['Mmm… esas medidas no me cuadran.', 'Ojo con esa medida, maestro.'] },
  tip: { poses: ['dedo', 'piensa'], msgs: ['Un consejito, maestro:'] },
  cutlist: { poses: ['huincha', 'mide'], msgs: ['Ya tenemos las medidas para cortar.', 'Mide dos veces, corta una.'] },
  shopping: { poses: ['lista'], msgs: ['Revisa la lista dos veces antes de ir a la ferretería.'] },
  plans: { poses: ['planos'], msgs: ['Ahí están los planos con sus cotas.'] },
  processing: { poses: ['cafe'], msgs: ['Dame un poquito, que estoy en eso.'] },
  finished: { poses: ['brazos-cruzados', 'pulgar'], msgs: ['¡Quedó de lujo, maestro!', '¡Quedó impeque!'] },
  idle: { poses: ['relajado', 'cafe'], msgs: ['¿Necesitas una mano?', '¿Le seguimos dando?'] },
  loaded: { poses: ['planos'], msgs: ['Aquí está tu diseño. ¿Le seguimos dando?'] },
  deleted: { poses: ['piensa'], msgs: ['Listo, ese diseño ya no está.'] },
  material: { poses: ['tabla'], msgs: ['Acuérdate de revisar el espesor del tablero.'] },
};
export const statePose = (state) => poseUrl(STATES[state]?.poses || ['saluda']);

/**
 * Eventos que entiende el asistente → estado, mensaje y si merece asomarse (pop) aunque esté minimizado.
 * detail: datos del evento (nombre del diseño, texto de la alerta, material…).
 */
export const EVENTS = {
  project_created: (d) => ({ state: 'working', text: d?.preset ? `¡Manos a la obra! Partimos con «${d.preset}».` : '¡Manos a la obra! Cambia las medidas a la izquierda y yo saco los cortes.', pop: true }),
  project_loaded: (d) => ({ state: 'loaded', text: `Aquí está «${d?.name || 'tu diseño'}». ¿Le seguimos dando?`, pop: true }),
  project_saved: (d) => ({ state: 'saved', text: d?.name ? `¡Listo, maestro! «${d.name}» quedó guardadito.` : pick(STATES.saved.msgs), pop: true }),
  project_deleted: (d) => ({ state: 'deleted', text: d?.name ? `Listo, «${d.name}» ya no está.` : STATES.deleted.msgs[0], pop: false }),
  project_exported: (d) => ({ state: 'finished', text: `${pick(STATES.finished.msgs)} ${d?.what ? `Ya tienes tu ${d.what}.` : ''}`.trim(), pop: true }),
  dimension_error: (d) => ({ state: 'error', text: `${pick(STATES.error.msgs)} ${d?.text || ''}`.trim(), pop: true, alert: true }),
  dimension_ok: () => ({ state: 'finished', text: '¡Buena, maestro! Ya no quedan alertas.', pop: false }),
  generation_started: () => ({ state: 'processing', text: STATES.processing.msgs[0], pop: false }),
  generation_completed: (d) => ({ state: 'working', text: `¡Manos a la obra! Te armé ${d?.label ? `«${d.label}»` : 'el mueble'}. Ajusta lo que quieras.`, pop: true }),
  cutlist_generated: (d) => ({ state: 'cutlist', text: `${STATES.cutlist.msgs[0]}${d?.sheets ? ` Salen ${d.sheets} plancha${d.sheets === 1 ? '' : 's'}.` : ''}`, pop: false }),
  shopping_opened: () => ({ state: 'shopping', text: STATES.shopping.msgs[0], pop: false }),
  plans_opened: () => ({ state: 'plans', text: STATES.plans.msgs[0], pop: false }),
  material_changed: (d) => ({ state: 'material', text: d?.name ? `Cambiamos a ${d.name}. Acuérdate de revisar el espesor del tablero.` : STATES.material.msgs[0], pop: false }),
  idle: () => ({ state: 'idle', text: pick(STATES.idle.msgs), pop: false }),
};

// ---------- bus de eventos ----------
const bus = new EventTarget();
/** Avisa al asistente de algo que pasó en la app. */
export function virutaEmit(type, detail) {
  if (!EVENTS[type]) return;
  bus.dispatchEvent(new CustomEvent('viruta', { detail: { type, data: detail, at: Date.now() } }));
}
/** Escucha los eventos; devuelve la función para dejar de escuchar. */
export function virutaListen(fn) {
  const h = (e) => fn(e.detail);
  bus.addEventListener('viruta', h);
  return () => bus.removeEventListener('viruta', h);
}

/** DonVirutaTips: un consejo del oficio al azar, con su pose. */
export const oficioTip = () => { const [pose, text] = pick(OFICIO); return { pose: poseUrl(pose), text }; };

// preferencia del usuario: asistente abierto o minimizado
const KEY = 'mobilabs.viruta.open';
export const loadOpen = () => { try { return localStorage.getItem(KEY) === '1'; } catch { return false; } };
export const saveOpen = (v) => { try { localStorage.setItem(KEY, v ? '1' : '0'); } catch { /* sin almacenamiento */ } };
