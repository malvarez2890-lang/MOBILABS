import React, { useMemo, useState, useEffect, useCallback } from 'react';
import { FURNITURE, getType, defaultsFor, buildFurniture } from './lib/types.js';
import { packAll } from './lib/packing.js';
import { buildShopping, shoppingText } from './lib/shopping.js';
import { materialOf } from './lib/materials.js';
import { cm, fmt } from './lib/util.js';
import { Icon } from './components/Icons.jsx';
import ParamsForm from './components/ParamsForm.jsx';
import Viewer3D from './components/Viewer3D.jsx';
import { CutList, SheetPlans, Shopping } from './components/Lists.jsx';

const STORE = 'mueblelab-v1';
// En la página publicada no funcionan las descargas ni window.print(): se reemplazan por copiar al portapapeles.
const PUBLISHED = Boolean(import.meta.env.VITE_ARTIFACT);
const load = () => {
  try { return JSON.parse(localStorage.getItem(STORE)) || {}; } catch { return {}; }
};

function download(name, text, mime = 'text/csv;charset=utf-8') {
  const url = URL.createObjectURL(new Blob(['﻿' + text], { type: mime }));
  const a = Object.assign(document.createElement('a'), { href: url, download: name });
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

export default function App() {
  const saved = useMemo(load, []);
  const [typeId, setTypeId] = useState(saved.typeId || 'librero');
  const [store, setStore] = useState(saved.values || {});
  const [settings, setSettings] = useState({ kerf: 3, rotate: false, ...(saved.settings || {}) });
  const [tab, setTab] = useState('piezas');
  const [explode, setExplode] = useState(0);
  const [hover, setHover] = useState(null);
  const [viewCmd, setViewCmd] = useState(null);
  const [copied, setCopied] = useState(false);

  const type = getType(typeId);
  const values = useMemo(() => ({ ...defaultsFor(type), ...store[type.id] }), [type, store]);

  useEffect(() => {
    try { localStorage.setItem(STORE, JSON.stringify({ typeId, values: store, settings })); } catch { /* sin almacenamiento */ }
  }, [typeId, store, settings]);

  const setValue = (key, val) => setStore((s) => ({ ...s, [type.id]: { ...defaultsFor(type), ...s[type.id], [key]: val } }));
  const applyPreset = (pr) => setStore((s) => ({ ...s, [type.id]: { ...defaultsFor(type), ...pr.values } }));
  const reset = () => setStore((s) => ({ ...s, [type.id]: defaultsFor(type) }));

  const model = useMemo(() => buildFurniture(type.id, values), [type, values]);
  const plans = useMemo(() => packAll(model.parts, settings), [model, settings]);
  const shop = useMemo(() => buildShopping(model, plans), [model, plans]);
  const [bw, bh, bd] = model.bbox.dims;

  const copy = useCallback(async () => {
    const text = shoppingText(type.name, model.bbox.dims, shop);
    try { await navigator.clipboard.writeText(text); } catch {
      const ta = Object.assign(document.createElement('textarea'), { value: text });
      document.body.appendChild(ta); ta.select(); document.execCommand('copy'); ta.remove();
    }
    setCopied(true);
    setTimeout(() => setCopied(false), 1800);
  }, [type, model, shop]);

  const buildRows = () => {
    const rows = [['Letra', 'Pieza', 'Material', 'Largo mm', 'Ancho mm', 'Espesor mm', 'Cantidad', 'Tapacanto total m']];
    plans.groups.forEach((g) => rows.push([
      g.label, g.name, materialOf(g.mat).name, g.l, g.w ?? '', g.t ?? '', g.qty, g.edgeMm ? (g.edgeMm / 1000).toFixed(2) : '',
    ]));
    rows.push([]);
    rows.push(['Compras']);
    shop.sheets.forEach((s) => rows.push([s.count, `${s.name} (plancha ${s.size})`]));
    shop.bars.forEach((b) => rows.push([b.count, `${b.name} (largo ${b.stock})`]));
    shop.edging.forEach((e) => rows.push([e.buy, `m de tapacanto de ${e.width} mm`]));
    shop.hardware.forEach((h) => rows.push([h.qty, h.name]));
    return rows;
  };

  const exportCsv = () => {
    const csv = buildRows().map((r) => r.map((c) => `"${String(c).replace(/"/g, '""')}"`).join(';')).join('\n');
    download(`${type.id}-despiece.csv`, csv);
  };

  const [copiedCuts, setCopiedCuts] = useState(false);
  const copyCuts = async () => {
    const text = buildRows().map((r) => r.join('\t')).join('\n'); // pega directo en Excel / Sheets
    try { await navigator.clipboard.writeText(text); } catch {
      const ta = Object.assign(document.createElement('textarea'), { value: text });
      document.body.appendChild(ta); ta.select(); document.execCommand('copy'); ta.remove();
    }
    setCopiedCuts(true);
    setTimeout(() => setCopiedCuts(false), 1800);
  };

  const notes = [
    ...(model.error ? [{ level: 'warn', text: `Error al generar el mueble: ${model.error}` }] : []),
    ...model.notes,
  ];
  const warns = notes.filter((n) => n.level === 'warn');
  const tips = notes.filter((n) => n.level === 'info');

  return (
    <div className="app">
      <header className="top">
        <div className="brand"><span className="logo" aria-hidden="true">▤</span> MuebleLab <small>diseña · cubica · compra</small></div>
        <div className="top-actions">
          {PUBLISHED ? (
            <button className="btn primary" onClick={copyCuts} title="Copia el despiece y las compras para pegar en Excel, Sheets o un mensaje">
              {copiedCuts ? '¡Copiado!' : 'Copiar despiece'}
            </button>
          ) : (
            <>
              <button className="btn" onClick={exportCsv}>Descargar CSV</button>
              <button className="btn primary" onClick={() => window.print()}>Imprimir / PDF</button>
            </>
          )}
        </div>
      </header>

      {/* ---------------- panel izquierdo ---------------- */}
      <aside className="left">
        <h2 className="pane-title">¿Qué mueble quieres armar?</h2>
        <div className="types" role="tablist">
          {FURNITURE.map((f) => (
            <button key={f.id} role="tab" aria-selected={f.id === typeId} className={`type ${f.id === typeId ? 'on' : ''}`} onClick={() => { setTypeId(f.id); setHover(null); }} title={f.desc}>
              <Icon id={f.id} />
              <span>{f.name}</span>
            </button>
          ))}
        </div>
        <p className="muted small type-desc">{type.desc}</p>

        <div className="presets">
          {type.presets.map((pr) => (
            <button key={pr.name} className="pill" onClick={() => applyPreset(pr)}>{pr.name}</button>
          ))}
        </div>

        <ParamsForm type={type} values={values} onChange={setValue} />

        <details className="settings">
          <summary>Ajustes de corte</summary>
          <label className="field">
            <span className="field-label">Grosor del disco de sierra</span>
            <span className="numbox"><input type="number" min="0" max="6" step="0.5" value={settings.kerf} onChange={(e) => setSettings({ ...settings, kerf: Math.max(0, Number(e.target.value) || 0) })} /><em>mm</em></span>
          </label>
          <label className="field">
            <span className="field-label">Permitir girar piezas (ignora la veta)</span>
            <input type="checkbox" checked={settings.rotate} onChange={(e) => setSettings({ ...settings, rotate: e.target.checked })} />
          </label>
        </details>
        <button className="btn ghost small reset" onClick={reset}>Restablecer valores</button>
      </aside>

      {/* ---------------- visor ---------------- */}
      <main className="center">
        <div className="viewer">
          <Viewer3D parts={model.parts} bbox={model.bbox} explode={explode} highlight={hover} viewKey={typeId} viewCmd={viewCmd} />
          <div className="dims">
            <b>{type.name}</b>
            <span>{cm(bw)} <small>ancho</small> × {cm(bh)} <small>alto</small> × {cm(bd)} <small>fondo</small> cm</span>
          </div>
          <div className="viewbar">
            <div className="seg" role="group" aria-label="Vista">
              {[['iso', 'Isométrica'], ['front', 'Frente'], ['side', 'Lado'], ['top', 'Arriba']].map(([n, l]) => (
                <button key={n} onClick={() => setViewCmd({ name: n, t: Date.now() })}>{l}</button>
              ))}
            </div>
            <label className="explode" title="Separa las piezas para ver cómo se arma">
              <span>Vista explosionada</span>
              <input type="range" min="0" max="1" step="0.01" value={explode} onChange={(e) => setExplode(Number(e.target.value))} />
            </label>
          </div>
        </div>

        <div className="notices">
          {warns.map((n, i) => <div key={`w${i}`} className="notice warn">⚠ {n.text}</div>)}
          {tips.map((n, i) => <div key={`t${i}`} className="notice info">ℹ {n.text}</div>)}
        </div>
      </main>

      {/* ---------------- panel derecho ---------------- */}
      <aside className="right">
        <div className="tabs" role="tablist">
          {[['piezas', 'Piezas'], ['cortes', 'Cortes'], ['compras', 'Compras']].map(([id, label]) => (
            <button key={id} role="tab" aria-selected={tab === id} className={tab === id ? 'on' : ''} onClick={() => setTab(id)}>{label}</button>
          ))}
        </div>

        <div className="print-head">
          <h1>{type.name} · {cm(bw)} × {cm(bh)} × {cm(bd)} cm</h1>
          <p>
            {type.params.filter((p) => !p.visibleIf || p.visibleIf(values)).map((p) => {
              const v = values[p.key];
              const shown = p.type === 'sel' ? p.options.find((o) => o[0] === v)?.[1] : p.type === 'bool' ? (v ? 'sí' : 'no') : `${fmt(v)} ${p.unit}`;
              return `${p.label}: ${shown}`;
            }).join(' · ')}
          </p>
        </div>

        <div className={`tab-body ${tab === 'piezas' ? 'show' : ''}`}><CutList plans={plans} onHover={setHover} /></div>
        <div className={`tab-body ${tab === 'cortes' ? 'show' : ''}`}><SheetPlans plans={plans} /></div>
        <div className={`tab-body ${tab === 'compras' ? 'show' : ''}`}><Shopping shop={shop} onCopy={copy} copied={copied} /></div>
      </aside>
    </div>
  );
}
