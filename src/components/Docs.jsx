import React from 'react';
import { cm } from '../lib/util.js';

/* ------------------------------------------------------------------ PLANIMETRÍA */
const INK = '#1b1f24';

function HDim({ x1, x2, y, label, off = 0 }) {
  const yy = y + off;
  return (
    <g className="dim">
      <line x1={x1} y1={y} x2={x1} y2={yy + 8} className="ext" />
      <line x1={x2} y1={y} x2={x2} y2={yy + 8} className="ext" />
      <line x1={x1} y1={yy} x2={x2} y2={yy} />
      <path d={`M${x1 + 11} ${yy - 5} L${x1} ${yy} L${x1 + 11} ${yy + 5} M${x2 - 11} ${yy - 5} L${x2} ${yy} L${x2 - 11} ${yy + 5}`} fill="none" />
      <text x={(x1 + x2) / 2} y={yy - 7} textAnchor="middle">{label}</text>
    </g>
  );
}
function VDim({ y1, y2, x, label, off = 0 }) {
  const xx = x + off;
  const mid = (y1 + y2) / 2;
  return (
    <g className="dim">
      <line x1={x} y1={y1} x2={xx + 8} y2={y1} className="ext" />
      <line x1={x} y1={y2} x2={xx + 8} y2={y2} className="ext" />
      <line x1={xx} y1={y1} x2={xx} y2={y2} />
      <path d={`M${xx - 5} ${y1 + 11} L${xx} ${y1} L${xx + 5} ${y1 + 11} M${xx - 5} ${y2 - 11} L${xx} ${y2} L${xx + 5} ${y2 - 11}`} fill="none" />
      <text x={xx - 7} y={mid} textAnchor="middle" transform={`rotate(-90 ${xx - 7} ${mid})`}>{label}</text>
    </g>
  );
}

function ViewRects({ v }) {
  return (
    <g>
      {v.rects.map((r, i) => {
        const cls = `${r.kind === 'part' ? (r.leg ? 'dr-leg' : 'dr-sheet') : r.kind === 'handle' ? 'dr-handle' : 'dr-fix'}`;
        return r.disc && v.title.startsWith('Planta')
          ? <ellipse key={i} cx={r.x + r.w / 2} cy={r.y + r.h / 2} rx={r.w / 2} ry={r.h / 2} className={cls} />
          : <rect key={i} x={r.x} y={r.y} width={Math.max(r.w, 0.8)} height={Math.max(r.h, 0.8)} className={cls} />;
      })}
    </g>
  );
}

export function Planos({ drawing, spec, title, subtitle }) {
  const [big, setBig] = React.useState(false);
  const { views, chain, s, min, max, total } = drawing;
  const f = views.front;
  const sd = views.side;
  const pl = views.plan;
  const yPos = (val) => f.oy + (max[1] - val) * s; // altura en la elevación frontal
  const xPos = (val) => f.ox + (val - min[0]) * s;
  const zPos = (val) => pl.oy + (val - min[2]) * s;
  const chainY = chain.y.slice(1).map((v, i) => [chain.y[i], v]);
  const chainX = chain.x.slice(1).map((v, i) => [chain.x[i], v]);
  const chainZ = chain.z.slice(1).map((v, i) => [chain.z[i], v]);
  const showY = chain.y.length > 2;
  const showX = chain.x.length > 2;
  const showZ = chain.z.length > 2;
  return (
    <section className="docs">
      <div className="sec-head">
        <h3>Planimetría base</h3>
        <span className="muted">cotas en cm · medidas finales del mueble armado</span>
        <button className="btn mini" onClick={() => setBig((b) => !b)}>{big ? 'Cerrar' : 'Ampliar'}</button>
      </div>
      <div className={`plan-sheet ${big ? 'big' : ''}`}>
        {big && <button className="btn mini plan-close" onClick={() => setBig(false)}>Cerrar ✕</button>}
        <svg viewBox={`0 0 ${total.w} ${total.h}`} role="img" aria-label={`Planos de ${title}`} className="plan-svg">
          <style>{`
            .dr-sheet{fill:#f1ece2;stroke:${INK};stroke-width:1.8}
            .dr-leg{fill:#e2d3b8;stroke:${INK};stroke-width:1.8}
            .dr-fix{fill:#8f979f;stroke:${INK};stroke-width:1.8}
            .dr-handle{fill:#c9ced4;stroke:${INK};stroke-width:1.4}
            .dim line,.dim path{stroke:#0b5d91;stroke-width:1.6;fill:none}
            .dim line.ext{stroke-width:1;stroke-dasharray:5 4}
            .dim text{font:22px system-ui,sans-serif;fill:#0b5d91}
            .vt{font:600 26px system-ui,sans-serif;fill:${INK}}
          `}</style>
          <rect x="1" y="1" width={total.w - 2} height={total.h - 2} fill="#fff" stroke={INK} />

          <text x={f.ox} y={f.oy - 56} className="vt">{f.title}</text>
          <ViewRects v={f} />
          <HDim x1={f.ox} x2={f.ox + f.size.w} y={f.oy + f.size.h + 12} off={76} label={cm(drawing.W)} />
          {showX && chainX.map(([a, b], i) => <HDim key={`fx${i}`} x1={xPos(a)} x2={xPos(b)} y={f.oy + f.size.h + 12} off={34} label={b - a < 25 ? '' : cm(b - a)} />)}
          <VDim y1={f.oy} y2={f.oy + f.size.h} x={f.ox + f.size.w + 12} off={showY ? 92 : 44} label={cm(drawing.H)} />
          {showY && chainY.map(([a, b], i) => <VDim key={`fy${i}`} y1={yPos(b)} y2={yPos(a)} x={f.ox + f.size.w + 12} off={42} label={b - a < 25 ? '' : cm(b - a)} />)}

          <text x={sd.ox} y={sd.oy - 56} className="vt">{sd.title}</text>
          <ViewRects v={sd} />
          <HDim x1={sd.ox} x2={sd.ox + sd.size.w} y={sd.oy + sd.size.h + 12} off={42} label={cm(drawing.D)} />
          <VDim y1={sd.oy} y2={sd.oy + sd.size.h} x={sd.ox + sd.size.w + 12} off={42} label={cm(drawing.H)} />

          <text x={pl.ox} y={pl.oy - 56} className="vt">{pl.title}</text>
          <ViewRects v={pl} />
          <text x={pl.ox + pl.size.w + 130} y={pl.oy + 30} style={{ font: '20px system-ui,sans-serif', fill: '#555' }}>Planta: respaldo arriba, frente abajo</text>
          <HDim x1={pl.ox} x2={pl.ox + pl.size.w} y={pl.oy + pl.size.h + 12} off={showX ? 76 : 44} label={cm(drawing.W)} />
          {showX && chainX.map(([a, b], i) => <HDim key={`px${i}`} x1={xPos(a)} x2={xPos(b)} y={pl.oy + pl.size.h + 12} off={34} label={b - a < 25 ? '' : cm(b - a)} />)}
          <VDim y1={pl.oy} y2={pl.oy + pl.size.h} x={pl.ox + pl.size.w + 12} off={showZ ? 92 : 44} label={cm(drawing.D)} />
          {showZ && chainZ.map(([a, b], i) => <VDim key={`pz${i}`} y1={zPos(a)} y2={zPos(b)} x={pl.ox + pl.size.w + 12} off={42} label={b - a < 25 ? '' : cm(b - a)} />)}

          {/* rótulo */}
          <g transform={`translate(${total.w - 640} ${total.h - 190})`}>
            <rect width="626" height="176" fill="#fff" stroke={INK} strokeWidth="2" />
            <line x1="0" y1="56" x2="626" y2="56" stroke={INK} strokeWidth="2" />
            <text x="14" y="38" className="vt" style={{ fontSize: 30 }}>{title}</text>
            <text x="14" y="92" style={{ font: '22px system-ui,sans-serif', fill: INK }}>{subtitle}</text>
            <text x="14" y="124" style={{ font: '22px system-ui,sans-serif', fill: INK }}>Planimetría base · cotas en cm · sin escala fija</text>
            <text x="14" y="156" style={{ font: '20px system-ui,sans-serif', fill: '#555' }}>MOBILABs · referencia de diseño, verifica en obra</text>
          </g>
        </svg>
      </div>
      <h4 className="doc-h">Especificación técnica</h4>
      <div className="table-wrap">
        <table className="spec">
          <tbody>
            {spec.map(([k, v]) => <tr key={k}><th>{k}</th><td>{v}</td></tr>)}
          </tbody>
        </table>
      </div>
    </section>
  );
}

/* ------------------------------------------------------------------ MANUAL */
export function Manual({ manual, title }) {
  return (
    <section className="docs manual">
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
    </section>
  );
}
