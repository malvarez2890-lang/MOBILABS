import React from 'react';
import { materialOf, SHEETS } from '../lib/materials.js';
import { fmt, cm } from '../lib/util.js';

const hue = (label) => {
  let h = 0;
  for (const c of label) h = (h * 31 + c.charCodeAt(0)) % 997;
  return (h * 47) % 360;
};
export const labelColor = (label) => `hsl(${hue(label)} 55% 82%)`;
const labelStroke = (label) => `hsl(${hue(label)} 35% 45%)`;

/* ------------------------------------------------------------------ DESPIECE */
export function CutList({ plans, onHover }) {
  const { groups } = plans;
  const totalPieces = groups.reduce((a, g) => a + g.qty, 0);
  return (
    <section>
      <div className="sec-head">
        <h3>Despiece</h3>
        <span className="muted">{totalPieces} piezas · {groups.length} medidas distintas · cotas en mm</span>
      </div>
      <div className="table-wrap">
        <table className="cut">
          <thead>
            <tr><th></th><th>Pieza</th><th className="r">Largo</th><th className="r">Ancho</th><th className="r">Cant.</th><th>Material</th><th className="r">Canto</th></tr>
          </thead>
          <tbody>
            {groups.map((g) => (
              <tr
                key={g.key}
                onMouseEnter={() => onHover(new Set(g.ids))}
                onMouseLeave={() => onHover(null)}
                onFocus={() => onHover(new Set(g.ids))}
                onBlur={() => onHover(null)}
                tabIndex={0}
              >
                <td><span className="chip" style={{ background: labelColor(g.label), borderColor: labelStroke(g.label) }}>{g.label}</span></td>
                <td>{g.name}</td>
                <td className="r num">{fmt(g.l)}</td>
                <td className="r num">{g.kind === 'sheet' ? fmt(g.w) : <span className="muted">{materialOf(g.mat).section.join('×')}</span>}</td>
                <td className="r num"><b>{g.qty}</b></td>
                <td className="mat" title={materialOf(g.mat).name}>{materialOf(g.mat).short}</td>
                <td className="r num">{g.edgeMm ? `${(g.edgeMm / 1000).toFixed(2).replace('.', ',')} m` : '—'}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <p className="hint">Pasa el mouse sobre una fila para ver esa pieza en el 3D. “Canto” es el tapacanto total de esa fila (solo melamina).</p>
    </section>
  );
}

/* ------------------------------------------------------------------ PLANOS DE CORTE */
function SheetSvg({ plan, sheet, index }) {
  const { W, H } = plan;
  const fs = Math.max(26, Math.min(W, H) / 26);
  return (
    <figure className="sheet-fig">
      <figcaption>Plancha {index + 1} · {sheet.placements.length} piezas</figcaption>
      <svg viewBox={`-4 -4 ${W + 8} ${H + 8}`} role="img" aria-label={`Plano de corte de la plancha ${index + 1}`}>
        <rect x="0" y="0" width={W} height={H} className="sheet-bg" />
        {sheet.placements.map((p, i) => (
          <g key={i}>
            <rect x={p.x} y={p.y} width={p.w} height={p.h} fill={labelColor(p.label)} stroke={labelStroke(p.label)} strokeWidth="3" />
            {p.w > fs * 1.2 && p.h > fs * 1.15 && (
              <>
                <text x={p.x + p.w / 2} y={p.y + p.h / 2 - (p.h > fs * 3.2 ? fs * 0.1 : 0)} textAnchor="middle" dominantBaseline="middle" fontSize={fs} fontWeight="700" fill="#2b2118">{p.label}</text>
                {p.h > fs * 3.2 && p.w > fs * 5 && (
                  <text x={p.x + p.w / 2} y={p.y + p.h / 2 + fs * 0.95} textAnchor="middle" dominantBaseline="middle" fontSize={fs * 0.62} fill="#4b3d30">
                    {fmt(p.w)} × {fmt(p.h)}
                  </text>
                )}
              </>
            )}
          </g>
        ))}
      </svg>
    </figure>
  );
}

export function SheetPlans({ plans }) {
  const { sheetPlans, barPlans } = plans;
  return (
    <section>
      <div className="sec-head">
        <h3>Planos de corte</h3>
        <span className="muted">Disco de {plans.kerf} mm{plans.rotate ? ' · piezas giradas permitidas' : ' · respetando la veta'}</span>
      </div>
      {sheetPlans.map((sp) => (
        <div key={sp.mat} className="plan-block">
          <h4>
            {sp.sheet.name} <span className="muted">· plancha {sp.W} × {sp.H} mm</span>
            <span className="badge">{sp.sheets.length} {sp.sheets.length === 1 ? 'plancha' : 'planchas'}</span>
          </h4>
          <p className="muted small">Aprovechamiento {sp.usedPct.toFixed(0)} % · mínimo teórico {sp.minSheets}</p>
          {sp.unplaced.length > 0 && (
            <p className="alert">No caben: {sp.unplaced.map((u) => `${u.name} ${fmt(u.l)}×${fmt(u.w)}`).join(', ')}</p>
          )}
          <div className="sheet-grid">
            {sp.sheets.map((s, i) => <SheetSvg key={i} plan={sp} sheet={s} index={i} />)}
          </div>
        </div>
      ))}
      {barPlans.map((bp) => (
        <div key={bp.mat} className="plan-block">
          <h4>
            {bp.lin.name} <span className="muted">· largo comercial {bp.stock} mm</span>
            <span className="badge">{bp.bars.length} {bp.bars.length === 1 ? 'listón' : 'listones'}</span>
          </h4>
          <div className="bars">
            {bp.bars.map((b, i) => (
              <div className="bar" key={i}>
                <span className="bar-n">{i + 1}</span>
                <div className="bar-track">
                  {b.pieces.map((p, j) => (
                    <div key={j} className="bar-piece" style={{ width: `${(p.l / bp.stock) * 100}%`, background: labelColor(p.label), borderColor: labelStroke(p.label) }} title={`${p.name} ${fmt(p.l)} mm`}>
                      {(p.l / bp.stock) > 0.07 && <b>{p.label}</b>}
                      {(p.l / bp.stock) > 0.16 && <i>{fmt(p.l)}</i>}
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </div>
      ))}
      <p className="hint">Las letras corresponden al despiece. Es un plan de referencia: el taller de corte puede reordenar las piezas según su sierra.</p>
    </section>
  );
}

/* ------------------------------------------------------------------ COMPRAS */
export function Shopping({ shop, onCopy, copied }) {
  return (
    <section>
      <div className="sec-head">
        <h3>Qué comprar</h3>
        <button className="btn small" onClick={onCopy}>{copied ? '¡Copiado!' : 'Copiar lista'}</button>
      </div>
      {shop.issues.length > 0 && (
        <div className="notice warn">
          <b>Revisa antes de comprar</b>
          <ul>{shop.issues.map((t, i) => <li key={i}>{t}</li>)}</ul>
        </div>
      )}

      <h4>Tableros</h4>
      <ul className="buy">
        {shop.sheets.map((s) => (
          <li key={s.id}>
            <b className="q">{s.count}</b>
            <div><b>{s.name}</b><span className="muted"> · plancha {s.size}</span>
              <div className="small muted">Aprovechamiento {s.usedPct.toFixed(0)} %</div></div>
          </li>
        ))}
      </ul>

      {shop.bars.length > 0 && (
        <>
          <h4>Madera en listón</h4>
          <ul className="buy">
            {shop.bars.map((b) => (
              <li key={b.id}><b className="q">{b.count}</b>
                <div><b>{b.name}</b><span className="muted"> · largo {b.stock}</span>
                  <div className="small muted">Aprovechamiento {b.usedPct.toFixed(0)} %</div></div></li>
            ))}
          </ul>
        </>
      )}

      {shop.edging.length > 0 && (
        <>
          <h4>Tapacanto</h4>
          <ul className="buy">
            {shop.edging.map((e) => (
              <li key={e.thickness}><b className="q">{e.buy}<small> m</small></b>
                <div><b>Tapacanto de {e.width} mm</b><span className="muted"> · para melamina de {e.thickness} mm</span>
                  <div className="small muted">{e.meters.toFixed(1).replace('.', ',')} m medidos + 10 % de margen</div></div></li>
            ))}
          </ul>
        </>
      )}

      <h4>Herrajes e insumos</h4>
      <ul className="buy">
        {shop.hardware.map((h) => (
          <li key={h.name}><b className="q">{h.qty}</b>
            <div><b>{h.name}</b>{h.note && <div className="small muted">{h.note}</div>}</div></li>
        ))}
      </ul>
      <p className="hint">Sin precios por ahora. Las escuadrías y planchas son medidas comerciales típicas de Chile (referenciales): confirma en tu tienda. Las cantidades de herrajes son estimadas.</p>
    </section>
  );
}

export { cm, SHEETS };
