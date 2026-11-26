import React, { useEffect, useRef } from 'react';
import { materialOf, sectionLabel } from '../lib/materials.js';
import { weightKg, summarize } from '../lib/looks.js';
import { fmt, cm } from '../lib/util.js';

const Row = ({ k, children }) => (<tr><th scope="row">{k}</th><td>{children}</td></tr>);

/** Propiedades de la selección (o de todo el mueble si no hay selección). */
export default function PropsDialog({ parts, groups, scopeAll, look, textureName, onClose }) {
  const closeRef = useRef(onClose);
  closeRef.current = onClose;
  useEffect(() => {
    // en fase de captura: Escape cierra solo el diálogo y no llega a quitar la selección
    const key = (e) => { if (e.key === 'Escape') { e.stopPropagation(); closeRef.current(); } };
    window.addEventListener('keydown', key, true);
    return () => window.removeEventListener('keydown', key, true);
  }, []);

  const sum = summarize(parts);
  const only = groups.length === 1 && groups[0].qty === parts.length ? groups[0] : null; // todas las piezas son idénticas
  const first = parts[0];

  return (
    <div className="dlg-back" onPointerDown={(e) => e.target === e.currentTarget && onClose()}>
      <div className="dlg" role="dialog" aria-modal="true" aria-label="Propiedades">
        <div className="dlg-head">
          <b>Propiedades</b>
          <span className="muted">{scopeAll ? 'Todo el mueble' : `${sum.count} ${sum.count === 1 ? 'pieza' : 'piezas'} seleccionadas`}</span>
          <button className="sel-x" onClick={onClose} aria-label="Cerrar">✕</button>
        </div>
        <table className="dlg-table">
          <tbody>
            {only ? (
              <>
                <Row k="Pieza">{only.label} · {only.name}</Row>
                <Row k="Cantidad">{only.qty}</Row>
                <Row k="Material">{materialOf(only.mat).name}</Row>
                <Row k="Medidas de corte">
                  {only.kind === 'sheet'
                    ? `${fmt(only.l)} × ${fmt(only.w)} × ${only.t} mm`
                    : `${fmt(only.l)} mm · escuadría ${sectionLabel(only.mat)}`}
                </Row>
                {first && <Row k="Posición (esquina)">{cm(first.min[0])} · {cm(first.min[1])} · {cm(first.min[2])} cm <span className="muted">(ancho · alto · fondo)</span></Row>}
                <Row k="Tapacanto">{only.edgeMm ? `${(only.edgeMm / 1000).toFixed(2).replace('.', ',')} m en total` : 'No lleva'}</Row>
                <Row k="Peso">{weightKg(first).toFixed(1).replace('.', ',')} kg c/u · {sum.kg.toFixed(1).replace('.', ',')} kg en total</Row>
              </>
            ) : (
              <>
                <Row k="Piezas">{sum.names.map((n) => `${n.name} ×${n.qty}`).join(' · ') || '—'}</Row>
                <Row k="Materiales">{sum.materials.join(' · ') || '—'}</Row>
                <Row k="Superficie de tablero">{sum.areaM2.toFixed(2).replace('.', ',')} m²</Row>
                <Row k="Tapacanto">{sum.edgeM.toFixed(2).replace('.', ',')} m</Row>
                <Row k="Peso aproximado">{sum.kg.toFixed(1).replace('.', ',')} kg</Row>
              </>
            )}
            <Row k="Aspecto">
              <span className="ctx-dot" style={{ background: look.color || 'transparent' }} /> {look.color || 'color del material'} · textura: {textureName}
            </Row>
          </tbody>
        </table>
        <p className="hint">El peso es una estimación a partir del volumen y la densidad típica del material.</p>
      </div>
    </div>
  );
}
