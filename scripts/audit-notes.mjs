// Muestra los avisos (⚠) que dispara cada mueble por defecto y cada preset.
import { FURNITURE, buildFurniture } from '../src/lib/types.js';
for (const t of FURNITURE) {
  for (const pr of [{ name: '(defecto)', values: {} }, ...t.presets]) {
    const m = buildFurniture(t.id, pr.values);
    const w = m.notes.filter((n) => n.level === 'warn').map((n) => n.text);
    console.log(`${w.length ? '⚠' : '✔'} ${t.name} / ${pr.name}${w.length ? '\n    ' + w.join('\n    ') : ''}`);
  }
}
