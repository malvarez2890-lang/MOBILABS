import React, { useEffect, useRef, useState } from 'react';
import { materialOf, SHEETS, sectionLabel, sizeOptions } from '../lib/materials.js';
import { fmt, cm } from '../lib/util.js';
import { fmtCLP, searchTerm, storeLinks, PRICE_NOTE } from '../lib/pricing.js';

const hue = (label) => {
  let h = 0;
  for (const c of label) h = (h * 31 + c.charCodeAt(0)) % 997;
  return (h * 47) % 360;
};
export const labelColor = (label) => `hsl(${hue(label)} 55% 82%)`;
export const labelStroke = (label) => `hsl(${hue(label)} 35% 45%)`;

/* ------------------------------------------------------------------ DESPIECE */
export function CutList({ plans, onHover, selectedKeys, partialKeys, onSelect, scrollTo }) {
  const { groups } = plans;
  const rowRefs = useRef({});
  useEffect(() => {
    if (scrollTo) rowRefs.current[scrollTo.key]?.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
  }, [scrollTo]);
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
                ref={(el) => { rowRefs.current[g.key] = el; }}
                className={selectedKeys.has(g.key) ? 'sel' : partialKeys.has(g.key) ? 'part' : ''}
                aria-selected={selectedKeys.has(g.key)}
                onClick={(e) => onSelect(g, e.ctrlKey || e.metaKey || e.shiftKey)}
                onKeyDown={(e) => (e.key === 'Enter' || e.key === ' ') && (e.preventDefault(), onSelect(g, e.ctrlKey || e.metaKey || e.shiftKey))}
                onMouseEnter={() => onHover(new Set(g.ids))}
                onMouseLeave={() => onHover(null)}
                onFocus={() => onHover(new Set(g.ids))}
                onBlur={() => onHover(null)}
                tabIndex={0}
              >
                <td><span className="chip" style={{ background: labelColor(g.label), borderColor: labelStroke(g.label) }}>{g.label}</span></td>
                <td>{g.name}</td>
                <td className="r num">{fmt(g.l)}</td>
                <td className="r num">{g.kind === 'sheet' ? fmt(g.w) : <span className="muted">{sectionLabel(g.mat)}</span>}</td>
                <td className="r num"><b>{g.qty}</b></td>
                <td className="mat" title={materialOf(g.mat).name}>{materialOf(g.mat).short}</td>
                <td className="r num">{g.edgeMm ? `${(g.edgeMm / 1000).toFixed(2).replace('.', ',')} m` : '—'}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <p className="hint">Toca una fila (o una pieza en el 3D) para seleccionarla; con Ctrl o Mayús sumas varias. Pasa el mouse para verla en el modelo. “Canto” es el tapacanto total de esa fila (solo melamina).</p>
    </section>
  );
}

/* ------------------------------------------------------------------ PLANOS DE CORTE */
function SheetSvg({ plan, sheet, index }) {
  const { W, H } = plan;
  const fs = Math.max(30, Math.min(W, H) / 22);
  return (
    <figure className="sheet-fig">
      <figcaption>Plancha {index + 1} · {sheet.placements.length} piezas</figcaption>
      <div className="sheet-scroll">
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
      </div>
    </figure>
  );
}

export function SheetPlans({ plans, choice = {}, onChoice, custom = {}, onCustom }) {
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
          {sizeOptions(sp.mat).length > 0 && (
            <label className="size-pick">
              <span>Medida de la plancha</span>
              <select value={sp.choice} onChange={(e) => onChoice(sp.mat, e.target.value)}>
                {sizeOptions(sp.mat).map(([c, l]) => <option key={c} value={c}>{l}</option>)}
              </select>
            </label>
          )}
          {sp.choice === 'custom' && (
            <div className="size-pick custom">
              <span>Ancho × largo (cm)</span>
              <input type="number" min="30" max="400" step="1" value={custom[sp.mat]?.w ?? 122} onChange={(e) => onCustom(sp.mat, { l: custom[sp.mat]?.l ?? 244, w: Number(e.target.value) || 0 })} />
              <em>×</em>
              <input type="number" min="30" max="400" step="1" value={custom[sp.mat]?.l ?? 244} onChange={(e) => onCustom(sp.mat, { w: custom[sp.mat]?.w ?? 122, l: Number(e.target.value) || 0 })} />
            </div>
          )}
          {sp.fellBack && <p className="tip-line">Algunas piezas no caben en la plancha de 122 × 244 cm: se usó la medida más usada.</p>}
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
function PriceField({ row, onPrice }) {
  const raw = row.unit == null ? '' : String(Math.round(row.unit));
  const [text, setText] = useState(raw);
  const [focus, setFocus] = useState(false);
  useEffect(() => { if (!focus) setText(raw); }, [raw, focus]);
  const commit = () => {
    setFocus(false);
    const digits = text.replace(/\D/g, '');
    onPrice(row.key, digits === '' ? null : parseInt(digits, 10)); // vacío = vuelve al precio de ejemplo
  };
  return (
    <label className={`price-in ${row.missing ? 'miss' : row.edited ? 'edited' : ''}`}>
      <span>$</span>
      <input
        inputMode="numeric" aria-label={`Precio de ${row.label} por ${row.unitLabel}`} placeholder="precio"
        value={focus ? text : (row.unit == null ? '' : Math.round(row.unit).toLocaleString('es-CL'))}
        onFocus={(e) => { setFocus(true); setText(raw); e.target.select(); }}
        onChange={(e) => setText(e.target.value)}
        onBlur={commit}
        onKeyDown={(e) => e.key === 'Enter' && e.currentTarget.blur()}
      />
      <em>/ {row.unitLabel}</em>
    </label>
  );
}

export function Shopping({ shop, priced, onCopy, copied, onPrice, onResetPrices, onExportPrices, onImportPrices }) {
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

      <div className="cost-box">
        <div className="cost-main">
          <span className="muted small">Costo aproximado</span>
          <b className="cost-total">{fmtCLP(priced.total)}</b>
          <span className="muted small">CLP, IVA incluido si tus precios lo incluyen</span>
        </div>
        <div className="cost-stats small muted">
          {priced.missing > 0 && <b className="cost-miss">{priced.missing} sin precio · </b>}
          {priced.estimated} con precio de ejemplo · {priced.edited} editados por ti
        </div>
        <div className="cost-actions">
          <button className="btn small" onClick={onResetPrices} disabled={!priced.edited}>Restablecer precios</button>
          {onExportPrices && <button className="btn small" onClick={onExportPrices}>Exportar precios (CSV)</button>}
          <label className="btn small file-btn">Importar precios (CSV)
            <input type="file" accept=".csv,text/csv" onChange={(e) => { const f = e.target.files?.[0]; if (f) onImportPrices(f); e.target.value = ''; }} />
          </label>
        </div>
        <p className="hint">{PRICE_NOTE}</p>
      </div>

      {priced.groups.map((g) => (
        <React.Fragment key={g.id}>
          <h4 className="grp-head"><span>{g.title}</span><span className="grp-sub">{fmtCLP(g.subtotal)}</span></h4>
          <ul className="buy priced">
            {g.rows.map((r) => (
              <li key={r.key} className={r.missing ? 'miss' : ''}>
                <b className="q">{r.qty}{g.id === 'tapacanto' && <small> m</small>}</b>
                <div className="buy-txt">
                  <b>{r.label}</b>{r.detail && <span className="muted"> · {r.detail}</span>}
                  {r.extra && <div className="small muted">{r.extra}</div>}
                </div>
                <div className="buy-price">
                  <PriceField row={r} onPrice={onPrice} />
                  <b className="sub">{r.missing ? '—' : fmtCLP(r.subtotal)}</b>
                  <span className="finds" title={`Buscar «${searchTerm(r.key, r.label, r.detail)}»`}>
                    {storeLinks(searchTerm(r.key, r.label, r.detail)).map((s) => (
                      <a key={s.name} className="find" href={s.url} target="_blank" rel="noopener noreferrer">{s.name} ↗</a>
                    ))}
                  </span>
                </div>
              </li>
            ))}
          </ul>
        </React.Fragment>
      ))}
      <p className="hint">Las escuadrías y planchas son medidas comerciales típicas de Chile (referenciales): confirma en tu tienda. Las cantidades de herrajes son estimadas y los precios, de ejemplo hasta que los edites.</p>
    </section>
  );
}

export { cm, SHEETS };
