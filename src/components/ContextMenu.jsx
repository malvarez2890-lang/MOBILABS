import React, { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { SWATCHES, TEXTURES } from '../lib/looks.js';
import { textureThumb } from './textures.js';

/**
 * Menú de clic derecho (o toque largo). Actúa sobre la selección; si no hay selección, sobre todo el mueble.
 * Color y textura no cierran el menú, para poder probar varias combinaciones seguidas.
 */
export default function ContextMenu({ x, y, count, current, hiddenCount, onClose, actions }) {
  const ref = useRef(null);
  const [open, setOpen] = useState(null); // 'color' | 'tex' | 'vista'

  // dentro de la pantalla, también cuando se despliega una sección
  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;
    const r = el.getBoundingClientRect();
    el.style.left = `${Math.max(6, Math.min(x, window.innerWidth - r.width - 6))}px`;
    el.style.top = `${Math.max(6, Math.min(y, window.innerHeight - r.height - 6))}px`;
  }, [x, y, open, count]);

  const closeRef = useRef(onClose);
  closeRef.current = onClose;
  useEffect(() => {
    const close = () => closeRef.current();
    const away = (e) => { if (ref.current && !ref.current.contains(e.target)) close(); };
    const key = (e) => { if (e.key === 'Escape') { e.stopPropagation(); close(); } }; // solo cierra el menú
    document.addEventListener('pointerdown', away, true);
    window.addEventListener('keydown', key, true);
    window.addEventListener('resize', close);
    window.addEventListener('blur', close);
    return () => {
      document.removeEventListener('pointerdown', away, true);
      window.removeEventListener('keydown', key, true);
      window.removeEventListener('resize', close);
      window.removeEventListener('blur', close);
    };
  }, []);

  const run = (fn, close = true) => () => { fn(); if (close) onClose(); };
  const toggle = (name) => () => setOpen((o) => (o === name ? null : name));
  const target = count ? `${count} ${count === 1 ? 'pieza seleccionada' : 'piezas seleccionadas'}` : 'Todo el mueble';

  return (
    <div className="ctx" role="menu" ref={ref} style={{ left: x, top: y }} onContextMenu={(e) => e.preventDefault()}>
      <div className="ctx-head"><b>{target}</b><small>{count ? 'Los cambios de aspecto aplican a la selección' : 'Sin selección: los cambios aplican a todo'}</small></div>

      <button role="menuitem" onClick={run(actions.properties)}>Propiedades…</button>
      <hr />

      <button role="menuitem" aria-expanded={open === 'color'} onClick={toggle('color')}>
        <span className="ctx-lab">Color <i className="ctx-dot" style={{ background: current.color || 'transparent' }} /></span><span className="ctx-arrow">{open === 'color' ? '▾' : '▸'}</span>
      </button>
      {open === 'color' && (
        <div className="ctx-sub">
          <div className="sw-grid">
            {SWATCHES.map(([hex, name]) => (
              <button key={hex} className={`sw ${current.color === hex ? 'on' : ''}`} style={{ background: hex }} title={name} aria-label={name} onClick={() => actions.setLook({ color: hex })} />
            ))}
          </div>
          <label className="ctx-custom">
            <span>Otro color</span>
            <input type="color" value={current.color || '#c9a26b'} onChange={(e) => actions.setLook({ color: e.target.value })} aria-label="Elegir otro color" />
          </label>
          <button className="ctx-mini" onClick={() => actions.setLook({ color: null })}>Quitar color</button>
        </div>
      )}

      <button role="menuitem" aria-expanded={open === 'tex'} onClick={toggle('tex')}>
        <span className="ctx-lab">Textura <em>{current.textureName}</em></span><span className="ctx-arrow">{open === 'tex' ? '▾' : '▸'}</span>
      </button>
      {open === 'tex' && (
        <div className="ctx-sub">
          <div className="tx-grid">
            {TEXTURES.map((t) => (
              <button key={t.id} className={`tx ${(current.texture || 'liso') === t.id ? 'on' : ''}`} onClick={() => actions.setLook({ texture: t.id === 'liso' ? null : t.id })} title={t.name}>
                {t.id === 'liso'
                  ? <span className="tx-img tx-plain" style={{ background: current.color || '#c9a26b' }} />
                  : <img className="tx-img" src={textureThumb(t.id)} alt="" width="52" height="52" />}
                <span>{t.name}</span>
              </button>
            ))}
          </div>
          <small className="ctx-note">Con una textura, “Color” la tiñe (ej.: roble + gris = roble grisáceo).</small>
        </div>
      )}
      <button role="menuitem" onClick={run(actions.resetLook, false)}>Restablecer aspecto</button>
      <hr />

      <button role="menuitem" onClick={run(actions.selectIdentical)} disabled={!count}>Seleccionar idénticas</button>
      <button role="menuitem" onClick={run(actions.invert)}>Invertir selección</button>
      <button role="menuitem" onClick={run(actions.selectAll)}>Seleccionar todo</button>
      <button role="menuitem" onClick={run(actions.clearSel)} disabled={!count}>Quitar selección</button>
      <hr />

      <button role="menuitem" onClick={run(actions.isolate)} disabled={!count}>Aislar selección</button>
      <button role="menuitem" onClick={run(actions.hide)} disabled={!count}>Ocultar selección</button>
      <button role="menuitem" onClick={run(actions.showAll)} disabled={!hiddenCount}>Mostrar todo{hiddenCount ? ` (${hiddenCount} ocultas)` : ''}</button>
      <hr />

      <button role="menuitem" aria-expanded={open === 'vista'} onClick={toggle('vista')}>
        <span className="ctx-lab">Vista</span><span className="ctx-arrow">{open === 'vista' ? '▾' : '▸'}</span>
      </button>
      {open === 'vista' && (
        <div className="ctx-sub ctx-row">
          {[['iso', 'Isométrica'], ['front', 'Frente'], ['side', 'Lado'], ['top', 'Arriba']].map(([n, l]) => (
            <button key={n} className="ctx-mini" onClick={run(() => actions.view(n))}>{l}</button>
          ))}
        </div>
      )}
      <button role="menuitem" onClick={run(actions.copyDims)}>Copiar medidas</button>
    </div>
  );
}
