import React, { useEffect, useLayoutEffect, useRef, useState } from 'react';

import { POSES } from '../lib/viruta.js';

// pose: la de Don Viruta en cada paso; 'apunta' = mira hacia el elemento destacado (izquierda o derecha, según donde quede el globo)
const STEPS = [
  { pose: 'saluda', t: '¡Hola! Soy Don Viruta', d: 'Maestro carpintero y tu guía en MOBILABs. En un minuto te muestro cómo diseñar un mueble, sacar los cortes y armarlo sin perder ni un dedo. ¿Vamos?' },
  { sel: '.types', pose: 'apunta', t: '1 · Elige el mueble', d: 'Aquí partes: estante, mesa, escritorio, credenza… Cada uno trae sus medidas y sus mañas.' },
  { sel: '.presets-box', pose: 'piensa', t: 'Modelos listos', d: '¿Flojera de partir de cero? Abre este listado y elige uno ya armado. Después lo ajustas a tu pinta.' },
  { sel: '.params', pose: 'mide', t: '2 · Ajusta las medidas', d: 'Mueve las barras o escribe el número. Si algo no cumple, yo lo arreglo solo: pongo divisores, tapa doble o achico la cajonera.' },
  { sel: '.viewer', pose: 'apunta', t: '3 · Míralo en 3D', d: 'Rueda: acercar. Rueda apretada + arrastrar: mover (con Mayús o Ctrl, girar). Clic: elegir piezas. Clic derecho: colores y texturas. El botón ? tiene el resumen.' },
  { sel: '.vtabs', pose: 'planos', t: 'Vistas de plano', d: 'Abre la planta y las elevaciones en pestañas o ventanas sueltas, y con "Mosaico" las ves todas juntas, como en Revit.' },
  { sel: '.right .tabs', pose: 'lista', t: '4 · Piezas, cortes y compras', d: 'El despiece con letras, el plano de corte por plancha y la lista de compras con precios y links a la ferretería. Revísala dos veces, ¡el tornillo que falta siempre es el clave!' },
  { sel: '.right .tabs', pose: 'taladro', t: 'Planos, manual y Exportar', d: 'Planos con cotas, manual de armado con fotos paso a paso, y el botón Exportar para sacar PDF, planillas o llevar tu mueble a Revit.' },
  { pose: 'pulgar', t: '¡Listo, maestro!', d: 'Tus cambios se guardan solos. Si te creas una cuenta, tus diseños te siguen a cualquier computador. Ahora, ¡a cortar madera!' },
];

const visible = (el) => !!el && el.getClientRects().length > 0;

export default function Tour({ onClose }) {
  const [steps] = useState(() => STEPS.filter((s) => !s.sel || visible(document.querySelector(s.sel))));
  const [i, setI] = useState(0);
  const [box, setBox] = useState(null);
  const tipRef = useRef(null);
  const [tipPos, setTipPos] = useState({ left: 0, top: 0 });
  const [side, setSide] = useState(null); // 'right' = globo a la derecha del elemento (Don Viruta apunta a la izquierda)
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
    if (!box) { setTipPos({ left: (W - w) / 2, top: (H - h) / 2 }); setSide(null); return; }
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
    const k = options.findIndex((o) => o[2]);
    const ok = options[k];
    setSide(k === 0 ? 'right' : k === 1 ? 'left' : x + bw / 2 < W / 2 ? 'right' : 'left');
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
        <img className="tour-viruta" key={i} alt="Don Viruta" src={POSES[step.pose === 'apunta' ? (side === 'left' ? 'derecha' : 'izquierda') : step.pose] || POSES.saluda} />
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
