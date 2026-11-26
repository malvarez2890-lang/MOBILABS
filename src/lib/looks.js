/** Aspecto de las piezas (color y textura) y utilidades de selección. Solo datos: sin dependencias de 3D. */
import { materialOf } from './materials.js';

export const SWATCHES = [
  ['#ffffff', 'Blanco'], ['#e8e4dc', 'Hueso'], ['#c9a26b', 'Roble claro'], ['#8a5a3b', 'Nogal'],
  ['#4a3426', 'Wengué'], ['#2b2d31', 'Negro'], ['#8d939b', 'Gris'], ['#3d6fa8', 'Azul'],
  ['#2f7d6b', 'Verde'], ['#c26a3a', 'Terracota'], ['#d9a93a', 'Mostaza'], ['#b34a4a', 'Rojo'],
];

export const TEXTURES = [
  { id: 'liso', name: 'Liso' },
  { id: 'roble', name: 'Roble' },
  { id: 'nogal', name: 'Nogal' },
  { id: 'pino', name: 'Pino' },
  { id: 'terciado', name: 'Terciado' },
  { id: 'acanalado', name: 'Acanalado' },
  { id: 'blanco', name: 'Blanco mate' },
  { id: 'negro', name: 'Negro mate' },
  { id: 'cemento', name: 'Cemento' },
  { id: 'marmol', name: 'Mármol' },
];

/** Densidad aproximada (kg/m³) para estimar el peso. */
const DENSITY = {
  mel18: 680, mel15: 680, mdf18: 750, ter18: 600, ter15: 600, hdf3: 850,
  pino41: 500, pino70: 500, pino19x90: 500, pino19x42: 500, redonda45: 500, redonda70: 500,
};

/** kg aproximados de una pieza (caja envolvente; las patas redondas pesan ~80 % de eso). */
export function weightKg(part) {
  const [x, y, z] = part.size;
  const round = part.shape === 'round' || part.shape === 'taperRound';
  const taper = part.shape && part.shape.startsWith('taper') ? 0.78 : 1;
  const vol = x * y * z * (round ? 0.785 : 1) * taper; // mm³
  return vol * 1e-9 * (DENSITY[part.mat] || 600);
}

/**
 * Clave estable de cada pieza: "Puerta#0", "Puerta#1"… (nombre + número de orden).
 * Sobrevive a los cambios de medidas, a diferencia del id interno.
 */
export function partKeys(parts) {
  const count = new Map();
  const keyOf = new Map();
  const idOf = new Map();
  for (const p of parts) {
    const n = count.get(p.name) || 0;
    count.set(p.name, n + 1);
    const key = `${p.name}#${n}`;
    keyOf.set(p.id, key);
    idOf.set(key, p.id);
  }
  return { keyOf, idOf };
}

/** Resumen de un conjunto de piezas (para Propiedades). */
export function summarize(parts) {
  const byName = new Map();
  let area = 0;
  let kg = 0;
  let edge = 0;
  for (const p of parts) {
    byName.set(p.name, (byName.get(p.name) || 0) + 1);
    if (p.kind === 'sheet') area += (p.cut.l * p.cut.w) / 1e6;
    kg += weightKg(p);
    edge += p.edges.reduce((a, b) => a + b, 0) / 1000;
  }
  return {
    count: parts.length,
    names: [...byName].map(([name, qty]) => ({ name, qty })),
    materials: [...new Set(parts.map((p) => materialOf(p.mat).name))],
    areaM2: area, kg, edgeM: edge,
  };
}
