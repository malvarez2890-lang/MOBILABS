import React, { useEffect, useLayoutEffect, useRef, useState } from 'react';

const STEPS = [
  { t: 'Bienvenido a MOBILABs', d: 'En un minuto te muestro cómo diseñar un mueble, verlo en 3D, sacar los cortes y armarlo. Puedes repetir este tutorial cuando quieras con el botón “Tutorial”.' },
  { sel: '.types', t: '1 · Elige el mueble', d: 'Estante, mesa, escritorio, credenza… Cada uno trae sus propias medidas y opciones.' },
  { sel: '.presets-box', t: 'Modelos listos', d: 'Abre este listado para partir de un diseño ya armado y luego ajustarlo a tu gusto.' },
  { sel: '.params', t: '2 · Ajusta las medidas', d: 'Mueve las barras o escribe el valor. Todo se recalcula solo: si algo no cabe o queda débil, la app lo corrige y te lo avisa.' },
  { sel: '.viewer', t: '3 · Míralo en 3D', d: 'Rueda: acercar y alejar. Rueda apretada + arrastrar: desplazar (con Mayús o Ctrl, girar). Clic izquierdo: seleccionar piezas (Ctrl suma). Clic derecho: colores y texturas. El botón ? resume los controles.' },
  { sel: '.vtabs', t: 'Vistas de plano', d: 'Abre Planta y Elevaciones como pestañas o ventanas flotantes, y usa “Mosaico” para ver varias a la vez, junto al 3D.' },
  { sel: '.right .tabs', t: '4 · Piezas, cortes y compras', d: 'El despiece trae letras para cada pieza; el plan de corte permite elegir la medida de plancha; y la lista de compras suma el costo aproximado con precios editables y enlaces a tiendas.' },
  { sel: '.right .tabs', t: 'Planos y manual', d: 'Planimetría con vistas y cotas, especificación técnica y un manual de armado paso a paso con imágenes. Cada sección se guarda como PDF desde su botón al final.' },
  { t: '¡Listo para diseñar!', d: 'Tus cambios se guardan solos en este navegador. Prueba con un modelo listo y ajusta las medidas.' },
];

const visible = (el) => !!el && el.getClientRects().length > 0;

export default function Tour({ onClose }) {
  const [steps] = useState(() => STEPS.filter((s) => !s.sel || visible(document.querySelector(s.sel))));
  const [i, setI] = useState(0);
  const [box, setBox] = useState(null);
  const tipRef = useRef(null);
  const [tipPos, setTipPos] = useState({ left: 0, top: 0 });
  const step = steps[i];
  const last = i === steps.length - 1;

  const next = () => (last ? onClose() : setI((x) => x + 1));
  const prev = () => setI((x) => Math.max(0, x - 1));

  useEffect(() => {
    const k = (e) => {
      if (e.key === 'Escape') { e.stopPropagation(); onClose(); }
      else if (e.key === 'ArrowRight' || e.key === 'Enter') next();
      else if (e.key === 'ArrowLeft') prev();
    };
    window.addEventListener('keydown', k, true);
    return () => window.removeEventListener('keydown', k, true);
  });

  // sigue al elemento destacado (cambios de tamaño, desplazamientos y animaciones)
  useEffect(() => {
    let raf = 0;
    let first = true;
    const el = step.sel ? document.querySelector(step.sel) : null;
    if (el) el.scrollIntoView({ block: 'nearest', inline: 'nearest' });
    const tick = () => {
      const r = el && visible(el) ? el.getBoundingClientRect() : null;
      const nb = r ? [r.left, r.top, r.width, r.height].map(Math.round) : null;
      setBox((b) => (JSON.stringify(b) === JSON.stringify(nb) ? b : nb));
      if (first) first = false;
      raf = requestAnimationFrame(tick);
    };
    tick();
    return () => cancelAnimationFrame(raf);
  }, [i]);

  // coloca el globo: a la derecha, a la izquierda, debajo, encima o dentro del elemento
  useLayoutEffect(() => {
    const tip = tipRef.current;
    if (!tip) return;
    const w = tip.offsetWidth;
    const h = tip.offsetHeight;
    const W = window.innerWidth;
    const H = window.innerHeight;
    const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v));
    if (!box) { setTipPos({ left: (W - w) / 2, top: (H - h) / 2 }); return; }
    const [x, y, bw, bh] = box;
    const g = 14;
    const cy = clamp(y + bh / 2 - h / 2, 10, H - h - 10);
    const cx = clamp(x + bw / 2 - w / 2, 10, W - w - 10);
    const options = [
      [x + bw + g, cy, x + bw + g + w <= W - 8],
      [x - g - w, cy, x - g - w >= 8],
      [cx, y + bh + g, y + bh + g + h <= H - 8],
      [cx, y - g - h, y - g - h >= 8],
    ];
    const ok = options.find((o) => o[2]);
    setTipPos(ok ? { left: ok[0], top: ok[1] } : { left: cx, top: clamp(y + bh - h - 16, 10, H - h - 10) });
  }, [box, i]);

  const pad = 6;
  return (
    <div className="tour-layer" role="dialog" aria-modal="true" aria-label="Tutorial">
      {box ? (
        <div className="tour-spot" style={{ left: box[0] - pad, top: box[1] - pad, width: box[2] + pad * 2, height: box[3] + pad * 2 }} />
      ) : (
        <div className="tour-dim" />
      )}
      <div className="tour-tip" ref={tipRef} style={{ left: tipPos.left, top: tipPos.top }}>
        <div className="tour-count">{i + 1} / {steps.length}</div>
        <b>{step.t}</b>
        <p>{step.d}</p>
        <div className="tour-dots">{steps.map((_, k) => <i key={k} className={k === i ? 'on' : ''} />)}</div>
        <div className="tour-nav">
          <button className="tour-skip" onClick={onClose}>{last ? 'Cerrar' : 'Saltar'}</button>
          <span />
          {i > 0 && <button onClick={prev}>← Atrás</button>}
          <button className="primary" onClick={next}>{last ? '¡A diseñar!' : 'Siguiente →'}</button>
        </div>
      </div>
    </div>
  );
}
