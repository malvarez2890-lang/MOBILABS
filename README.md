# MOBILABs

App web para **diseñar muebles de forma paramétrica**, ver el modelo en 3D y obtener automáticamente
el **despiece, el plan de corte por plancha y la lista de qué comprar** (sin precios, por ahora).

## Muebles incluidos
Estante · Librero · Mesa · Mesa de arrimo · Escritorio · Silla · Rack para TV · Deck para tocadiscos · Mueble para vinilos

## Usar
```bash
npm install
npm run dev      # desarrollo
npm run build    # producción (carpeta dist/)
npm test         # verifica geometría y cubicación de ~570 configuraciones
```

## Cómo está armado
| Carpeta | Qué hace |
|---|---|
| `src/lib/materials.js` | Medidas estándar (planchas, listones). **Edita aquí** los tamaños según tu proveedor. |
| `src/lib/parts.js` | Modelo de piezas (cajas con posición/medidas) + herrajes. |
| `src/lib/carcass.js` | Constructor de muebles tipo cajón (laterales, repisas, divisores, puertas, zócalo/patas, trasera). |
| `src/lib/table.js` | Constructor de mesas (tapa, patas, faldones, repisa inferior). |
| `src/lib/types.js` | Definición de cada mueble: parámetros, presets y geometría. **Para agregar un mueble nuevo, agrega un objeto aquí.** |
| `src/lib/packing.js` | Despiece agrupado + optimización de cortes (MaxRects 2D y listones 1D). |
| `src/lib/shopping.js` | Lista de compras. |
| `src/components/` | Visor 3D (three.js), formulario y listas. |

Unidades: parámetros en **cm**, despiece en **mm**. Sistema de coordenadas: x = ancho, y = alto, z = fondo.

## Versión publicada
https://malvarez2890-lang.github.io/ElBunkerLAb/ (se despliega sola con GitHub Actions al subir cambios a `main`).

## Controles del visor 3D
| Acción | Mouse | Celular |
|---|---|---|
| Seleccionar | Clic izquierdo (Ctrl o Mayús + clic suma o quita) | Toque (botón "Multi" para sumar) |
| Selección por rectángulo | Arrastrar con el izquierdo: → piezas completas, ← las que toque | — |
| Desplazar | Rueda (clic del medio) + arrastrar | Dos dedos |
| Girar | Mayús + rueda + arrastrar | Un dedo |
| Acercar / alejar | Girar la rueda | Pellizcar |
| Menú (propiedades, color, textura, ocultar…) | Clic derecho | Mantener presionado |
| Quitar la selección | Esc | ✕ en la tarjeta |
