/**
 * Ventanas de la app en vez de las del navegador (confirm, prompt, alert).
 *   await ask({ title, message, ok: 'Borrar', danger: true })           → true | false
 *   await ask({ title, message, input: 'texto inicial', ok: 'Guardar' }) → texto | null
 *   await ask({ title, message, ok: 'Entendido', cancel: false })        → aviso simple
 */
let host = null;
export const setUiHost = (fn) => { host = fn; };
export function ask(opts) {
  return new Promise((resolve) => {
    if (!host) { resolve(opts.input !== undefined ? null : false); return; }
    host({ ...opts, resolve });
  });
}
export const notify = (title, message) => ask({ title, message, ok: 'Entendido', cancel: false });
