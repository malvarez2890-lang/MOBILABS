// Medidas estándar de referencia para Chile (mm). Varían según proveedor: revísalas en tu tienda.

/** Tableros en plancha. size = [largo, ancho] */
export const SHEETS = {
  mel18: { id: 'mel18', short: 'Melamina 18', name: 'Melamina 18 mm', t: 18, size: [2440, 1830], color: '#d9bd8f', edge: true, maxSpan: 800 },
  mel15: { id: 'mel15', short: 'Melamina 15', name: 'Melamina 15 mm', t: 15, size: [2440, 1830], color: '#d9bd8f', edge: true, maxSpan: 650 },
  mdf18: { id: 'mdf18', short: 'MDF 18', name: 'MDF 18 mm', t: 18, size: [2440, 1830], color: '#c8a571', edge: false, maxSpan: 750 },
  ter18: { id: 'ter18', short: 'Terciado 18', name: 'Terciado 18 mm', t: 18, size: [2440, 1220], color: '#dcb67c', edge: false, maxSpan: 900 },
  ter15: { id: 'ter15', short: 'Terciado 15', name: 'Terciado 15 mm', t: 15, size: [2440, 1220], color: '#dcb67c', edge: false, maxSpan: 750 },
  hdf3: { id: 'hdf3', short: 'HDF 3 mm', name: 'HDF / fibrofácil 3 mm (trasera)', t: 3, size: [2440, 1220], color: '#9c7b58', edge: false, maxSpan: 0 },
};

/** Tableros que el usuario puede elegir como material principal */
export const MAIN_SHEETS = ['mel18', 'mel15', 'mdf18', 'ter18', 'ter15'];

/** Maderas en listón. section = [delgado, ancho] ; stock = largo comercial */
export const LINEARS = {
  pino41: { id: 'pino41', short: 'Pino 2×2"', name: 'Pino cepillado 2×2" (41×41 mm)', section: [41, 41], stock: 3200, color: '#e2c08b' },
  pino70: { id: 'pino70', short: 'Pino 3×3"', name: 'Pino cepillado 3×3" (≈70×70 mm)', section: [70, 70], stock: 3200, color: '#e2c08b' },
  pino19x90: { id: 'pino19x90', short: 'Pino 1×4"', name: 'Pino cepillado 1×4" (19×90 mm)', section: [19, 90], stock: 3200, color: '#ecd0a0' },
  pino19x42: { id: 'pino19x42', short: 'Pino 1×2"', name: 'Pino cepillado 1×2" (19×42 mm)', section: [19, 42], stock: 3200, color: '#ecd0a0' },
};

export const materialOf = (id) => SHEETS[id] || LINEARS[id];
export const isSheet = (id) => id in SHEETS;
