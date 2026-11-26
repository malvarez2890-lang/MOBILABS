import React from 'react';
import { cm } from '../lib/util.js';

/* ------------------------------------------------------------------ PLANIMETRÍA */
const INK = '#1b1f24';
export const SITE_URL = 'https://mobilabs.elbunkerservers.com/';

const RED = '#e10000';
const tick = (x, y) => `M${x - 3} ${y} L${x} ${y - 3} L${x + 3} ${y} L${x} ${y + 3} Z`;
function HDim({ x1, x2, y, label, off = 0 }) {
  const yy = y + off;
  return (
    <g className="dim">
      <line x1={x1} y1={y} x2={x1} y2={yy + 7} className="ext" />
      <line x1={x2} y1={y} x2={x2} y2={yy + 7} className="ext" />
      <line x1={x1 - 7} y1={yy} x2={x2 + 7} y2={yy} />
      <path d={`${tick(x1, yy)} ${tick(x2, yy)}`} className="tk" />
      <text x={(x1 + x2) / 2} y={yy - 6} textAnchor="middle">{label}</text>
    </g>
  );
}
function VDim({ y1, y2, x, label, off = 0 }) {
  const xx = x + off;
  const mid = (y1 + y2) / 2;
  return (
    <g className="dim">
      <line x1={x} y1={y1} x2={xx + 7} y2={y1} className="ext" />
      <line x1={x} y1={y2} x2={xx + 7} y2={y2} className="ext" />
      <line x1={xx} y1={y1 - 7} x2={xx} y2={y2 + 7} />
      <path d={`${tick(xx, y1)} ${tick(xx, y2)}`} className="tk" />
      <text x={xx - 6} y={mid} textAnchor="middle" transform={`rotate(-90 ${xx - 6} ${mid})`}>{label}</text>
    </g>
  );
}
/** Título de la vista bajo el dibujo, con subrayado y escala, como en un plano CAD. */
function ViewTitle({ v, scaleN }) {
  const y = v.rowBottom + 150;
  return (
    <g>
      <text x={v.x + 20} y={y} className="vt">{v.title}</text>
      <line x1={v.x} y1={y + 14} x2={v.x + Math.max(260, v.title.length * 12.5 + 40)} y2={y + 14} stroke={INK} strokeWidth="1.6" />
      <text x={v.x + 30} y={y + 38} className="vs">1 : {scaleN}</text>
    </g>
  );
}

const STYLE = `
  .dr-poly{fill:#fff;stroke:${INK};stroke-width:1.3;stroke-linejoin:round}
  .dr-fix-front,.dr-fix-top,.dr-fix-side{fill:#fff}
  .dim line,.dim path{stroke:${RED};stroke-width:1;fill:none}
  .dim path.tk{fill:${RED}}
  .dim line.ext{stroke-width:.7}
  .dim text{font:17px "Arial Narrow","Roboto Condensed","Liberation Sans Narrow",Arial,sans-serif;font-stretch:condensed;letter-spacing:.3px;fill:${RED}}
  .vt{font:28px Arial,"Liberation Sans",sans-serif;fill:${INK}}
  .vs{font:20px Arial,"Liberation Sans",sans-serif;fill:${INK}}
`;

/** Imprime (o guarda como PDF) un fragmento de la página en una hoja blanca, sin depender del resto de la interfaz. */
export function printHtml(title, html, landscape = false) {
  const f = document.createElement('iframe');
  f.setAttribute('aria-hidden', 'true');
  Object.assign(f.style, { position: 'fixed', right: '0', bottom: '0', width: '0', height: '0', border: '0' });
  document.body.appendChild(f);
  const d = f.contentDocument;
  d.open();
  d.write(`<!doctype html><html lang="es"><head><meta charset="utf-8"><title>${title}</title><style>
    @page { size: A4 ${landscape ? 'landscape' : 'portrait'}; margin: 10mm; }
    * { box-sizing: border-box; }
    body { font: 12px/1.45 system-ui, sans-serif; color: #111; background: #fff; margin: 0; }
    h1 { font-size: 20px; margin: 0 0 2px; } h3 { font-size: 16px; margin: 0 0 6px; } .muted { color: #555; font-size: 11px; }
    .sec-head { display: flex; gap: 12px; align-items: baseline; } .btn, .mini, .plan-close { display: none !important; }
    .plan-svg { width: 100%; height: auto; display: block; border: 1px solid #999; }
    .doc-h { margin: 14px 0 6px; font-size: 13px; color: #075b8d; text-transform: uppercase; letter-spacing: .04em; break-after: avoid; }
    table.spec { width: 100%; border-collapse: collapse; } table.spec th { text-align: left; width: 32%; vertical-align: top; padding: 4px 8px 4px 0; border-bottom: 1px solid #ccc; color: #333; }
    table.spec td { padding: 4px 0; border-bottom: 1px solid #ccc; }
    tr, li { break-inside: avoid; } ol { padding-left: 22px; margin: 0 0 6px; } li { margin: 0 0 6px; }
    .page-break { break-before: page; }
  </style></head><body><h1>${title}</h1>${html}<p class="muted" style="margin-top:14px">Hecho con MOBILABs · ${SITE_URL}</p></body></html>`);
  d.close();
  const go = () => { try { f.contentWindow.focus(); f.contentWindow.print(); } finally { setTimeout(() => f.remove(), 2000); } };
  setTimeout(go, 250);
}

/** Una sola vista del plano (para las pestañas y ventanas flotantes del área de dibujo). */
export function ViewSvg({ drawing, vkey }) {
  const v = drawing.views.find((x) => x.key === vkey);
  if (!v) return null;
  const x0 = v.x - 50, y0 = v.y - 40;
  const w = Math.max(v.w + 230, 480), h = v.rowBottom - v.y + 230;
  return (
    <svg viewBox={`${x0} ${y0} ${w} ${h}`} className="view-svg" preserveAspectRatio="xMinYMin meet" role="img" aria-label={v.title} xmlns="http://www.w3.org/2000/svg">
      <style>{STYLE}</style>
      <ViewTitle v={v} scaleN={drawing.scaleN} />
      <Polys v={v} />
      {v.dims.map((d, i) => (d.t === 'h'
        ? <HDim key={i} x1={d.x1} x2={d.x2} y={d.at} off={d.off} label={d.label} />
        : <VDim key={i} y1={d.y1} y2={d.y2} x={d.at} off={d.off} label={d.label} />))}
    </svg>
  );
}

function Polys({ v }) {
  return <g>{v.polys.map((q, i) => <polygon key={i} className={`dr-poly dr-${q.cls}`} points={q.pts.map((p) => `${p[0].toFixed(1)},${p[1].toFixed(1)}`).join(' ')} />)}</g>;
}

export function Planos({ drawing, spec, title, subtitle }) {
  const [big, setBig] = React.useState(false);
  const ref = React.useRef(null);
  const specRef = React.useRef(null);
  const { views, total } = drawing;
  React.useEffect(() => {
    if (!big) return undefined;
    const k = (e) => { if (e.key === 'Escape') { e.stopPropagation(); setBig(false); } };
    window.addEventListener('keydown', k, true);
    return () => window.removeEventListener('keydown', k, true);
  }, [big]);
  const print = (which) => {
    const el = which === 'spec' ? specRef.current : ref.current;
    if (!el) return;
    printHtml(which === 'spec' ? `${title}: especificación técnica` : `${title}: planimetría`, el.innerHTML, which !== 'spec');
  };
  return (
    <section className="docs">
      <div ref={ref}>
        <div className="sec-head">
          <h3>Planimetría base</h3>
          <span className="muted">cotas en cm · medidas finales del mueble armado</span>
        </div>
        <div className={`plan-sheet ${big ? 'big' : ''}`} onClick={() => !big && setBig(true)} title={big ? undefined : 'Clic para ampliar'}>
          {big && <button className="btn mini plan-close" onClick={(e) => { e.stopPropagation(); setBig(false); }}>Cerrar ✕</button>}
          <svg viewBox={`0 0 ${total.w} ${total.h}`} role="img" aria-label={`Planos de ${title}`} className="plan-svg" xmlns="http://www.w3.org/2000/svg">
            <style>{STYLE}</style>
            <rect x="1" y="1" width={total.w - 2} height={total.h - 2} fill="#fff" stroke={INK} strokeWidth="2" />
            {views.map((v) => (
              <g key={v.key}>
                <ViewTitle v={v} scaleN={drawing.scaleN} />
                <Polys v={v} />
                {v.dims.map((d, i) => (d.t === 'h'
                  ? <HDim key={i} x1={d.x1} x2={d.x2} y={d.at} off={d.off} label={d.label} />
                  : <VDim key={i} y1={d.y1} y2={d.y2} x={d.at} off={d.off} label={d.label} />))}
              </g>
            ))}
            <g transform={`translate(${total.w - 660} ${total.h - 170})`}>
              <rect width="640" height="150" fill="#fff" stroke={INK} strokeWidth="2" />
              <line x1="0" y1="52" x2="640" y2="52" stroke={INK} strokeWidth="2" />
              <text x="14" y="36" className="vt" style={{ fontSize: 30 }}>{title}</text>
              <text x="14" y="86" style={{ font: '22px system-ui,sans-serif', fill: INK }}>{subtitle}</text>
              <text x="14" y="116" style={{ font: '22px system-ui,sans-serif', fill: INK }}>Cotas en cm · escala aprox. 1 : {drawing.scaleN} en A4 apaisado</text>
              <text x="14" y="140" style={{ font: '20px system-ui,sans-serif', fill: '#555' }}>MOBILABs · mobilabs.elbunkerservers.com · verifica en obra</text>
            </g>
          </svg>
        </div>
        <div className="doc-foot"><button className="btn" onClick={() => print('planos')}>Imprimir / PDF de los planos</button></div>
      </div>
      <div ref={specRef}>
        <div className="sec-head">
          <h4 className="doc-h" style={{ margin: '22px 0 8px' }}>Especificación técnica</h4>
        </div>
        <div className="table-wrap">
          <table className="spec">
            <tbody>
              {spec.map(([k, v]) => <tr key={k}><th>{k}</th><td>{v}</td></tr>)}
            </tbody>
          </table>
        </div>
        <div className="doc-foot"><button className="btn" onClick={() => print('spec')}>Imprimir / PDF de la especificación</button></div>
      </div>
    </section>
  );
}

/* ------------------------------------------------------------------ MANUAL */
export function Manual({ manual, title }) {
  const ref = React.useRef(null);
  return (
    <section className="docs manual">
      <div ref={ref}>
      <div className="sec-head">
        <h3>Manual de armado</h3>
        <span className="muted">{title} · {manual.stepCount} pasos</span>
      </div>
      {manual.sections.map((sec) => (
        <div key={sec.title} className="man-sec">
          <h4 className="doc-h">{sec.title}</h4>
          <ol start={sec.start}>
            {sec.steps.map((st, i) => <li key={i}>{st}</li>)}
          </ol>
        </div>
      ))}
      </div>
      <div className="doc-foot"><button className="btn" onClick={() => printHtml(`${title}: manual de armado`, ref.current.innerHTML)}>Imprimir / PDF del manual</button></div>
    </section>
  );
}
