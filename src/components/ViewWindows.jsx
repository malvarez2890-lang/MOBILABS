import React, { useRef, useState } from 'react';
import { ViewSvg } from './Docs.jsx';

export const VIEW_LIST = [
  ['plan', 'Planta'], ['front', 'Elevación frontal'], ['back', 'Elevación trasera'],
  ['left', 'Elevación izquierda'], ['right', 'Elevación derecha'], ['iso', 'Isométrica'],
];
const nameOf = (k) => VIEW_LIST.find((v) => v[0] === k)?.[1] || k;

/** Ventana flotante: se arrastra por el título y se redimensiona desde la esquina inferior derecha. */
function FloatWin({ vkey, drawing, pos, setPos, onClose, onDock, onFocus, z }) {
  const drag = useRef(null);
  const down = (e) => {
    if (e.target.closest('button')) return;
    drag.current = { sx: e.clientX, sy: e.clientY, x: pos.x, y: pos.y };
    e.currentTarget.setPointerCapture(e.pointerId);
    onFocus();
  };
  const move = (e) => {
    const d = drag.current;
    if (d) setPos({ ...pos, x: Math.max(0, d.x + e.clientX - d.sx), y: Math.max(0, d.y + e.clientY - d.sy) });
  };
  return (
    <div className="fwin" style={{ left: pos.x, top: pos.y, width: pos.w, height: pos.h, zIndex: z }} onPointerDown={onFocus}>
      <div className="fwin-bar" onPointerDown={down} onPointerMove={move} onPointerUp={() => { drag.current = null; }}>
        <span>{nameOf(vkey)}</span>
        <button title="Volver a las pestañas" onClick={onDock}>⇱</button>
        <button title="Cerrar" onClick={onClose}>✕</button>
      </div>
      <div className="fwin-body"><ViewSvg drawing={drawing} vkey={vkey} /></div>
    </div>
  );
}

/**
 * Área de vistas estilo Revit: pestañas (Vista 3D, Planta, Elevaciones…), mosaico y ventanas flotantes.
 * `active` = '3d' o la clave de una vista; la vista 3D vive debajo y no se desmonta.
 */
export function ViewManager({ drawing }) {
  const [open, setOpen] = useState([]); // vistas abiertas como pestaña
  const [active, setActive] = useState('3d');
  const [tile, setTile] = useState(false);
  const [floats, setFloats] = useState({}); // clave → {x, y, w, h}
  const [order, setOrder] = useState([]); // orden de apilado de flotantes
  const [menu, setMenu] = useState(false);

  const openView = (k) => {
    setMenu(false);
    if (floats[k]) { setOrder((o) => [...o.filter((x) => x !== k), k]); return; }
    setOpen((o) => (o.includes(k) ? o : [...o, k]));
    setActive(k);
  };
  const closeTab = (k) => {
    setOpen((o) => o.filter((x) => x !== k));
    if (active === k) setActive('3d');
  };
  const undock = (k) => {
    setOpen((o) => o.filter((x) => x !== k));
    if (active === k) setActive('3d');
    setFloats((f) => ({ ...f, [k]: { x: 40 + Object.keys(f).length * 36, y: 40 + Object.keys(f).length * 30, w: 460, h: 340 } }));
    setOrder((o) => [...o.filter((x) => x !== k), k]);
  };
  const dock = (k) => {
    setFloats((f) => { const n = { ...f }; delete n[k]; return n; });
    setOrder((o) => o.filter((x) => x !== k));
    setOpen((o) => (o.includes(k) ? o : [...o, k]));
    setActive(k);
  };
  const closeFloat = (k) => {
    setFloats((f) => { const n = { ...f }; delete n[k]; return n; });
    setOrder((o) => o.filter((x) => x !== k));
  };
  const showTile = tile && open.length > 0;
  const showPane = showTile || active !== '3d';
  const avail = VIEW_LIST.filter(([k]) => !open.includes(k) && !floats[k]);

  return (
    <>
      <div className="vtabs" role="tablist" aria-label="Vistas">
        <button role="tab" aria-selected={active === '3d' && !showTile} className={`vtab ${active === '3d' && !showTile ? 'on' : ''}`} onClick={() => { setActive('3d'); setTile(false); }}>VISTA 3D</button>
        {open.map((k) => (
          <span key={k} className={`vtab ${active === k && !showTile ? 'on' : ''}`} role="tab" aria-selected={active === k && !showTile}>
            <button className="vt-name" onClick={() => { setActive(k); setTile(false); }}>{nameOf(k).toUpperCase()}</button>
            <button className="vt-x" title="Mover a una ventana flotante" onClick={() => undock(k)}>⧉</button>
            <button className="vt-x" title="Cerrar vista" onClick={() => closeTab(k)}>✕</button>
          </span>
        ))}
        <span className="vt-add">
          <button className="vtab plus" title="Abrir otra vista" aria-haspopup="menu" aria-expanded={menu} onClick={() => setMenu((m) => !m)}>＋ Vistas</button>
          {menu && (
            <div className="vt-menu" role="menu">
              {avail.length ? avail.map(([k, l]) => <button key={k} role="menuitem" onClick={() => openView(k)}>{l}</button>) : <em>Todas abiertas</em>}
            </div>
          )}
        </span>
        <button className={`vtab ${showTile ? 'on' : ''}`} title="Ver las pestañas abiertas en mosaico" disabled={!open.length} onClick={() => setTile((t) => !t)}>▦ Mosaico</button>
      </div>

      {showPane && (
        <div className={`vpane ${showTile ? 'tile' : ''}`}>
          {(showTile ? open : [active]).map((k) => (
            <div key={k} className="vpane-cell">
              {showTile && <div className="vpane-title">{nameOf(k)}</div>}
              <ViewSvg drawing={drawing} vkey={k} />
            </div>
          ))}
        </div>
      )}

      {Object.keys(floats).map((k) => (
        <FloatWin
          key={k} vkey={k} drawing={drawing} pos={floats[k]} z={20 + order.indexOf(k)}
          setPos={(p) => setFloats((f) => ({ ...f, [k]: p }))}
          onClose={() => closeFloat(k)} onDock={() => dock(k)}
          onFocus={() => setOrder((o) => (o[o.length - 1] === k ? o : [...o.filter((x) => x !== k), k]))}
        />
      ))}
    </>
  );
}
