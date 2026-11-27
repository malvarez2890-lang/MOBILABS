// Medidas estándar de referencia para Chile (mm). Varían según proveedor: revísalas en tu tienda.

/** Tableros en plancha. size = [largo, ancho] */
export const SHEETS = {
  mel18: { id: 'mel18', short: 'Melamina 18', name: 'Melamina 18 mm', t: 18, size: [2500, 1830], color: '#d9bd8f', edge: true, maxSpan: 800 },
  mel15: { id: 'mel15', short: 'Melamina 15', name: 'Melamina 15 mm', t: 15, size: [2500, 1830], color: '#d9bd8f', edge: true, maxSpan: 650 },
  mdf18: { id: 'mdf18', short: 'MDF 18', name: 'MDF 18 mm', t: 18, size: [2440, 1520], color: '#c8a571', edge: false, maxSpan: 750 },
  mdf15: { id: 'mdf15', short: 'MDF 15', name: 'MDF 15 mm', t: 15, size: [2440, 1520], color: '#c8a571', edge: false, maxSpan: 620 },
  ter18: { id: 'ter18', short: 'Terciado 18', name: 'Terciado 18 mm', t: 18, size: [2440, 1220], color: '#dcb67c', edge: false, maxSpan: 900 },
  ter15: { id: 'ter15', short: 'Terciado 15', name: 'Terciado 15 mm', t: 15, size: [2440, 1220], color: '#dcb67c', edge: false, maxSpan: 750 },
  hdf3: { id: 'hdf3', short: 'MDF 3 mm', name: 'MDF 3 mm (trasera)', t: 3, size: [2440, 1220], color: '#9c7b58', edge: false, maxSpan: 0 },
};

/** Tableros que el usuario puede elegir como material principal */
export const MAIN_SHEETS = ['mel18', 'mel15', 'mdf18', 'mdf15', 'ter18', 'ter15'];

/**
 * Medidas de plancha que se venden en Chile: la primera (std) es la más usada y viene por defecto.
 * Melamina: 183 × 250 cm (mueblería) o 122 × 244 cm. MDF: 152 × 244 cm o 122 × 244 cm.
 */
const ALT = [2440, 1220];
export const SHEET_SIZES = {
  mel18: ['std', 'alt'], mel15: ['std', 'alt'], mdf18: ['std', 'alt'], mdf15: ['std', 'alt'],
};
/** [largo, ancho] de la plancha de `id` según la elección ('std' | 'alt'). */
export const sheetSize = (id, choice, custom) => {
  if (choice === 'custom' && custom && custom.w > 0 && custom.l > 0 && SHEETS[id].t > 3) {
    return [Math.max(custom.l, custom.w) * 10, Math.min(custom.l, custom.w) * 10]; // cm → mm; [largo, ancho]
  }
  return choice === 'alt' && SHEET_SIZES[id] ? ALT : SHEETS[id].size;
};
export const sizeLabel = (size) => `${Math.round(size[1] / 10)} × ${Math.round(size[0] / 10)} cm`;
/** Opciones de medida de plancha para el material `id` (la última permite escribir una medida propia). */
export const sizeOptions = (id) => {
  if (!MAIN_SHEETS.includes(id)) return [];
  const base = (SHEET_SIZES[id] || ['std']).map((c) => [c, `${sizeLabel(sheetSize(id, c))}${c === 'std' ? ' (la más usada)' : ''}`]);
  return [...base, ['custom', 'Personalizada…']];
};

/** Maderas en listón. section = [delgado, ancho] ; stock = largo comercial */
export const LINEARS = {
  pino41: { id: 'pino41', short: 'Pino 2×2"', name: 'Pino cepillado 2×2" (41×41 mm)', section: [41, 41], stock: 3200, color: '#e2c08b' },
  pino70: { id: 'pino70', short: 'Pino 3×3"', name: 'Pino cepillado 3×3" (≈70×70 mm)', section: [70, 70], stock: 3200, color: '#e2c08b' },
  pino19x90: { id: 'pino19x90', short: 'Pino 1×4"', name: 'Pino cepillado 1×4" (19×90 mm)', section: [19, 90], stock: 3200, color: '#ecd0a0' },
  pino19x42: { id: 'pino19x42', short: 'Pino 1×2"', name: 'Pino cepillado 1×2" (19×42 mm)', section: [19, 42], stock: 3200, color: '#ecd0a0' },
  pino45x95: { id: 'pino45x95', short: 'Pino 2×4"', name: 'Pino cepillado 2×4" (45×95 mm)', section: [45, 95], stock: 3200, color: '#e2c08b' },
  pino90x90: { id: 'pino90x90', short: 'Pino 4×4"', name: 'Pino cepillado 4×4" (90×90 mm)', section: [90, 90], stock: 3200, color: '#e2c08b' },
  redonda45: { id: 'redonda45', short: 'Pilar Ø45', name: 'Pilar redondo de pino Ø45 mm', section: [45, 45], stock: 2400, color: '#e2c08b', round: true },
  redonda70: { id: 'redonda70', short: 'Pilar Ø70', name: 'Pilar redondo de pino Ø70 mm', section: [70, 70], stock: 2400, color: '#e2c08b', round: true },
};

/** "41×41" para escuadrías, "Ø45" para pilares redondos */
export const sectionLabel = (id) => {
  const m = LINEARS[id];
  return m.round ? `Ø${m.section[0]}` : m.section.join('×');
};

export const materialOf = (id) => SHEETS[id] || LINEARS[id];
export const isSheet = (id) => id in SHEETS;
