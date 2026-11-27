import React, { useEffect, useRef, useState } from 'react';

const I = {
  ifc: <><path d="M4 7l8-4 8 4-8 4-8-4z" /><path d="M4 7v10l8 4 8-4V7" /><path d="M12 11v10" /></>,
  revit: <><rect x="4" y="3" width="16" height="18" rx="2" /><path d="M9 16V8h4a2.5 2.5 0 010 5H9M12.5 13l2.5 3" /></>,
  csv: <><rect x="4" y="3" width="16" height="18" rx="2" /><path d="M4 9h16M4 15h16M10 3v18" /></>,
  pdf: <><path d="M6 3h9l4 4v14H6z" /><path d="M15 3v4h4M9 13h6M9 17h4" /></>,
};
const Ico = ({ id }) => <svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">{I[id]}</svg>;

/** Botón "Exportar" con un panel de opciones agrupadas (BIM, planillas, documentos). */
export default function ExportMenu({ className = '', onIfc, onRevit, onCsv, onPricesCsv, onGoTab }) {
  const [open, setOpen] = useState(false);
  const [pos, setPos] = useState(null);
  const ref = useRef(null);
  const btnRef = useRef(null);
  // el panel se ubica fijo bajo el botón, para que no lo recorte el panel lateral
  const toggle = () => {
    if (!open && btnRef.current) {
      const r = btnRef.current.getBoundingClientRect();
      const right = Math.max(8, window.innerWidth - r.right);
      setPos({ top: r.bottom + 6, right, maxHeight: Math.max(240, window.innerHeight - r.bottom - 16) });
    }
    setOpen((o) => !o);
  };
  useEffect(() => {
    if (!open) return undefined;
    const close = (e) => { if (ref.current && !ref.current.contains(e.target)) setOpen(false); };
    const esc = (e) => { if (e.key === 'Escape') setOpen(false); };
    document.addEventListener('pointerdown', close);
    document.addEventListener('keydown', esc);
    return () => { document.removeEventListener('pointerdown', close); document.removeEventListener('keydown', esc); };
  }, [open]);
  const act = (fn) => () => { setOpen(false); fn(); };
  const Item = ({ ico, title, desc, ext, onClick }) => (
    <button className="exp-item" onClick={act(onClick)}>
      <span className={`exp-ico ${ico}`}><Ico id={ico} /></span>
      <span className="exp-txt"><b>{title}</b><small>{desc}</small></span>
      {ext && <span className="exp-ext">{ext}</span>}
    </button>
  );
  return (
    <div className={`exp ${className}`} ref={ref}>
      <button ref={btnRef} className={`exp-btn ${open ? 'on' : ''}`} aria-haspopup="menu" aria-expanded={open} onClick={toggle}>
        <svg viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M12 3v12M7 10l5 5 5-5M5 21h14" /></svg>
        Exportar
      </button>
      {open && (
        <div className="exp-pop" role="menu" style={pos ? { position: 'fixed', top: pos.top, right: pos.right, maxHeight: pos.maxHeight } : undefined}>
          <div className="exp-head">Exportar el diseño</div>
          <div className="exp-group">Revit / BIM</div>
          <Item ico="ifc" title="Modelo IFC" desc="Abrir o vincular en Revit, ArchiCAD, Navisworks…" ext=".ifc" onClick={onIfc} />
          <Item ico="revit" title="Familia de Revit" desc="Script para pyRevit o Dynamo: crea la familia con materiales y subcategorías" ext=".rfa" onClick={onRevit} />
          <div className="exp-group">Planillas</div>
          <Item ico="csv" title="Despiece" desc="Piezas, medidas, material y tapacanto para Excel o Sheets" ext=".csv" onClick={onCsv} />
          {onPricesCsv && <Item ico="csv" title="Precios" desc="Lista de compras con tus precios" ext=".csv" onClick={onPricesCsv} />}
          <div className="exp-group">Documentos PDF</div>
          <Item ico="pdf" title="Planos y especificación" desc="Vistas con cotas y ficha técnica" onClick={() => onGoTab('planos')} />
          <Item ico="pdf" title="Manual de armado" desc="Pasos con imágenes y letras de cada pieza" onClick={() => onGoTab('manual')} />
          <Item ico="pdf" title="Lista de compras" desc="Materiales, herrajes y costo aproximado" onClick={() => onGoTab('compras')} />
        </div>
      )}
    </div>
  );
}
