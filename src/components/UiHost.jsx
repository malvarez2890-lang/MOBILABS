import React, { useEffect, useRef, useState } from 'react';
import { setUiHost } from '../lib/ui.js';

/** Muestra las ventanas pedidas con ask() / notify(): mismo estilo que el resto de la app. */
export default function UiHost() {
  const [d, setD] = useState(null);
  const [val, setVal] = useState('');
  const inputRef = useRef(null);
  const okRef = useRef(null);
  useEffect(() => {
    setUiHost((o) => { setVal(o.input ?? ''); setD(o); });
    return () => setUiHost(null);
  }, []);
  useEffect(() => {
    if (!d) return undefined;
    setTimeout(() => (inputRef.current || okRef.current)?.focus(), 30);
    const k = (e) => { if (e.key === 'Escape') { e.stopPropagation(); close(false); } };
    window.addEventListener('keydown', k, true);
    return () => window.removeEventListener('keydown', k, true);
  }, [d]); // eslint-disable-line react-hooks/exhaustive-deps
  if (!d) return null;
  const isInput = d.input !== undefined;
  const close = (ok) => {
    d.resolve(isInput ? (ok ? val.trim() || null : null) : !!ok);
    setD(null);
  };
  return (
    <div className="dlg-back ui-back" onPointerDown={(e) => e.target === e.currentTarget && d.cancel !== false && close(false)}>
      <div className="dlg ui-dlg" role="alertdialog" aria-modal="true" aria-label={d.title}>
        <div className="dlg-head"><b>{d.title}</b></div>
        <form className="ui-body" onSubmit={(e) => { e.preventDefault(); close(true); }}>
          {d.message && <p>{d.message}</p>}
          {isInput && <input ref={inputRef} value={val} onChange={(e) => setVal(e.target.value)} maxLength={d.maxLength || 120} />}
          <div className="ui-acts">
            {d.cancel !== false && <button type="button" className="btn" onClick={() => close(false)}>{d.cancel || 'Cancelar'}</button>}
            <button ref={okRef} className={`btn ${d.danger ? 'danger-btn' : 'primary'}`}>{d.ok || 'Aceptar'}</button>
          </div>
        </form>
      </div>
    </div>
  );
}
