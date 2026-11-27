import { TEXTURES } from './looks.js';

/**
 * Terminación de cada pieza de melamina según el color o textura elegidos en la app ("Roble", "Blanco mate"…),
 * para comprar las planchas y el tapacanto del tono correcto. Las piezas de otro material no cambian.
 */
const NAMED = [
  ['Blanco', '#f2f2f0'], ['Negro', '#1e1e1e'], ['Gris grafito', '#4a4d52'], ['Gris perla', '#b8b8b4'],
  ['Arena', '#d8c8a8'], ['Roble', '#c49a6c'], ['Nogal', '#6b4a32'], ['Cerezo', '#9b4f2e'],
  ['Wengué', '#3e2b22'], ['Azul', '#2f4f7f'], ['Verde', '#4f6b4a'], ['Rojo', '#9b2c2c'], ['Amarillo', '#d9b13b'],
];
const rgb = (h) => [1, 3, 5].map((i) => parseInt(h.slice(i, i + 2), 16));
export function colorName(hex) {
  if (!/^#[0-9a-f]{6}$/i.test(hex || '')) return null;
  const c = rgb(hex);
  return NAMED.reduce((best, [n, h]) => {
    const d = rgb(h).reduce((a, v, i) => a + (v - c[i]) ** 2, 0);
    return d < best[1] ? [n, d] : best;
  }, ['', Infinity])[0];
}
const TEX = Object.fromEntries(TEXTURES.map((t) => [t.id, t.name]));

/** Nombre de la terminación de una pieza (o null si es la estándar). */
export function finishOf(part, look) {
  if (!look || !/^mel/.test(part.mat)) return null;
  if (look.texture && look.texture !== 'liso' && TEX[look.texture]) return TEX[look.texture];
  if (look.color) return colorName(look.color);
  return null;
}

/** Copia de las piezas con su terminación (para el despiece, los cortes y las compras). */
export const withFinish = (parts, looks) => parts.map((p) => {
  const f = finishOf(p, looks && looks.get(p.id));
  return f ? { ...p, finish: f } : p;
});
