import React, { useMemo, useState, useEffect, useCallback, useRef } from 'react';
import { FURNITURE, getType, defaultsFor, buildFurniture, normalizeValues } from './lib/types.js';
import { packAll } from './lib/packing.js';
import { buildShopping, shoppingText } from './lib/shopping.js';
import { materialOf, sectionLabel } from './lib/materials.js';
import { cm, fmt } from './lib/util.js';
import { Icon, NavIcon } from './components/Icons.jsx';
import logoUrl from './assets/logo.png';
import ParamsForm from './components/ParamsForm.jsx';
import Viewer3D from './components/Viewer3D.jsx';
import { CutList, SheetPlans, Shopping, labelColor, labelStroke } from './components/Lists.jsx';
import { Planos, Manual } from './components/Docs.jsx';
import { buildDrawing, techSpec } from './lib/plans.js';
import { buildManual } from './lib/manual.js';
import ContextMenu from './components/ContextMenu.jsx';
import PropsDialog from './components/PropsDialog.jsx';
import { partKeys, TEXTURES } from './lib/looks.js';
import { priceShop, pricesToCsv, pricesFromCsv } from './lib/pricing.js';

const STORE = 'mueblelab-v1';
const EMPTY_LOOK = { all: null, parts: {} }; // aspecto por defecto: sin color ni textura elegidos
// Teléfono en vertical, o en horizontal (pantalla baja): se usa navegación inferior por secciones
const PHONE_QUERY = '(max-width: 760px), (max-width: 950px) and (max-height: 520px) and (orientation: landscape)';
function useMedia(query) {
  const [matches, setMatches] = useState(() => (typeof window !== 'undefined' ? window.matchMedia(query).matches : false));
  useEffect(() => {
    const mq = window.matchMedia(query);
    const on = () => setMatches(mq.matches);
    mq.addEventListener('change', on);
    on();
    return () => mq.removeEventListener('change', on);
  }, [query]);
  return matches;
}
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
  const [selKeys, setSelKeys] = useState(() => new Set()); // piezas seleccionadas (claves estables)
  const [hiddenKeys, setHiddenKeys] = useState(() => new Set());
  const [prices, setPrices] = useState(saved.prices || {}); // precios unitarios editados por el usuario
  const [looksStore, setLooksStore] = useState(saved.looks || {}); // aspecto por mueble: { todo, piezas }
  const [menu, setMenu] = useState(null); // menú de clic derecho
  const [propsOpen, setPropsOpen] = useState(false);
  const [helpOpen, setHelpOpen] = useState(false);
  const [multi, setMulti] = useState(false); // selección múltiple con toques (pantallas táctiles)
  const [mview, setMview] = useState('diseno'); // en teléfono: 'diseno' | 'resultados'
  const isPhone = useMedia(PHONE_QUERY);
  const [scrollTo, setScrollTo] = useState(null);

  const type = getType(typeId);
  const values = useMemo(() => ({ ...defaultsFor(type), ...normalizeValues(store[type.id] || {}, type.id) }), [type, store]);

  useEffect(() => {
    try { localStorage.setItem(STORE, JSON.stringify({ typeId, values: store, settings, looks: looksStore, prices })); } catch { /* sin almacenamiento */ }
  }, [typeId, store, settings, looksStore, prices]);

  const setValue = (key, val) => setStore((s) => ({ ...s, [type.id]: { ...defaultsFor(type), ...s[type.id], [key]: val } }));
  const applyPreset = (pr) => setStore((s) => ({ ...s, [type.id]: { ...defaultsFor(type), ...pr.values } }));
  const reset = () => setStore((s) => ({ ...s, [type.id]: defaultsFor(type) }));

  const model = useMemo(() => buildFurniture(type.id, values), [type, values]);
  const plans = useMemo(() => packAll(model.parts, settings), [model, settings]);
  const shop = useMemo(() => buildShopping(model, plans), [model, plans]);
  const priced = useMemo(() => priceShop(shop, prices), [shop, prices]);
  const drawing = useMemo(() => buildDrawing(model), [model]);
  const manual = useMemo(() => buildManual(model, plans, shop), [model, plans, shop]);
  const [bw, bh, bd] = model.bbox.dims;

  // ---- piezas: claves estables, selección múltiple, ocultas y aspecto ----
  const { keyOf, idOf } = useMemo(() => partKeys(model.parts), [model]);
  const allKeys = useMemo(() => model.parts.map((p) => keyOf.get(p.id)), [model, keyOf]);
  const visibleKeys = useMemo(() => allKeys.filter((k) => !hiddenKeys.has(k)), [allKeys, hiddenKeys]);
  const idsOf = (keys) => { const s = new Set(); keys.forEach((k) => { const id = idOf.get(k); if (id) s.add(id); }); return s; };
  const selIds = useMemo(() => idsOf(selKeys), [selKeys, idOf]);
  const hiddenIds = useMemo(() => idsOf(hiddenKeys), [hiddenKeys, idOf]);
  const idToGroup = useMemo(() => {
    const m = new Map();
    plans.groups.forEach((g) => g.ids.forEach((id) => m.set(id, g)));
    return m;
  }, [plans]);
  const selGroups = useMemo(() => plans.groups.filter((g) => g.ids.some((id) => selIds.has(id))), [plans, selIds]);
  const fullKeys = useMemo(() => new Set(selGroups.filter((g) => g.ids.every((id) => selIds.has(id))).map((g) => g.key)), [selGroups, selIds]);
  const partialKeys = useMemo(() => new Set(selGroups.filter((g) => !fullKeys.has(g.key)).map((g) => g.key)), [selGroups, fullKeys]);
  const oneGroup = selGroups.length === 1 && fullKeys.size === 1 ? selGroups[0] : null;
  const keysOfIds = (ids) => ids.map((id) => keyOf.get(id)).filter(Boolean);

  const lookCfg = useMemo(() => looksStore[typeId] || EMPTY_LOOK, [looksStore, typeId]);
  const effectiveLook = (k) => ({ ...(lookCfg.all || {}), ...(lookCfg.parts[k] || {}) });
  const looks = useMemo(() => {
    const m = new Map();
    for (const p of model.parts) {
      const v = effectiveLook(keyOf.get(p.id));
      if (v.color || v.texture) m.set(p.id, v);
    }
    return m;
  }, [model, keyOf, lookCfg]);

  const targetKeys = selKeys.size ? [...selKeys] : null; // null = todo el mueble
  const currentLook = useMemo(() => {
    const ks = targetKeys || allKeys;
    const ls = ks.map(effectiveLook);
    const same = (f) => (ls.length && ls.every((l) => (l[f] || null) === (ls[0][f] || null)) ? ls[0][f] || null : undefined);
    const texture = same('texture');
    return {
      color: same('color') || undefined,
      texture: texture || undefined,
      textureName: texture === undefined ? 'varias' : TEXTURES.find((t) => t.id === (texture || 'liso'))?.name || 'Liso',
    };
  }, [selKeys, allKeys, lookCfg]);

  const applyLook = (patch, keys) => setLooksStore((ls) => {
    const cur = ls[typeId] || EMPTY_LOOK;
    if (!keys) { // todo el mueble: reemplaza también lo que se hubiera puesto pieza por pieza
      const parts = {};
      for (const [k, v] of Object.entries(cur.parts)) {
        const nv = { ...v };
        Object.keys(patch).forEach((f) => delete nv[f]);
        if (Object.keys(nv).length) parts[k] = nv;
      }
      return { ...ls, [typeId]: { all: { ...(cur.all || {}), ...patch }, parts } };
    }
    const parts = { ...cur.parts };
    keys.forEach((k) => { parts[k] = { ...(parts[k] || {}), ...patch }; });
    return { ...ls, [typeId]: { ...cur, parts } };
  });
  const resetLook = (keys) => setLooksStore((ls) => {
    const cur = ls[typeId] || EMPTY_LOOK;
    if (!keys) return { ...ls, [typeId]: EMPTY_LOOK };
    const parts = { ...cur.parts };
    keys.forEach((k) => delete parts[k]);
    return { ...ls, [typeId]: { ...cur, parts } };
  });

  // clic: selecciona la pieza y sus idénticas; Ctrl/Mayús + clic suma o quita; en el vacío, suelta
  const onPick = useCallback((id, { add } = {}) => {
    const g = id ? idToGroup.get(id) : null;
    if (!g) { if (!add) setSelKeys(new Set()); return; }
    const keys = keysOfIds(g.ids);
    setSelKeys((prev) => {
      if (!add) return new Set(keys);
      const n = new Set(prev);
      const all = keys.every((k) => prev.has(k));
      keys.forEach((k) => (all ? n.delete(k) : n.add(k)));
      return n;
    });
    if (!add) {
      if (!isPhone) setTab('piezas'); // en el teléfono no se cambia de sección: la tarjeta del visor ya muestra la pieza
      setScrollTo({ key: g.key, n: Date.now() });
    }
  }, [idToGroup, keyOf, isPhone]);
  const onBox = useCallback((ids, { add } = {}) => {
    const keys = keysOfIds(ids);
    setSelKeys((prev) => (add ? new Set([...prev, ...keys]) : new Set(keys)));
  }, [keyOf]);
  const onContext = useCallback(({ x, y, id }) => {
    const g = id ? idToGroup.get(id) : null;
    if (g) { // clic derecho sobre una pieza fuera de la selección: la selecciona primero
      const keys = keysOfIds(g.ids);
      setSelKeys((prev) => (keys.some((k) => prev.has(k)) ? prev : new Set(keys)));
    }
    setMenu({ x, y });
  }, [idToGroup, keyOf]);
  const closeMenu = useCallback(() => setMenu(null), []);

  useEffect(() => {
    const onKey = (e) => { if (e.key === 'Escape') { setSelKeys(new Set()); setHelpOpen(false); } };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  const copyText = async (text) => {
    try { await navigator.clipboard.writeText(text); } catch {
      const ta = Object.assign(document.createElement('textarea'), { value: text });
      document.body.appendChild(ta); ta.select(); document.execCommand('copy'); ta.remove();
    }
  };
  const menuActions = {
    properties: () => setPropsOpen(true),
    setLook: (patch) => applyLook(patch, targetKeys),
    resetLook: () => resetLook(targetKeys),
    selectIdentical: () => setSelKeys((prev) => { const n = new Set(prev); selGroups.forEach((g) => keysOfIds(g.ids).forEach((k) => n.add(k))); return n; }),
    invert: () => setSelKeys(new Set(visibleKeys.filter((k) => !selKeys.has(k)))),
    selectAll: () => setSelKeys(new Set(visibleKeys)),
    clearSel: () => setSelKeys(new Set()),
    isolate: () => setHiddenKeys(new Set(allKeys.filter((k) => !selKeys.has(k)))),
    hide: () => { setHiddenKeys((prev) => new Set([...prev, ...selKeys])); setSelKeys(new Set()); },
    showAll: () => setHiddenKeys(new Set()),
    view: (n) => setViewCmd({ name: n, t: Date.now() }),
    copyDims: () => copyText((selKeys.size ? selGroups : plans.groups)
      .map((g) => `${g.name} ×${g.qty} — ${g.kind === 'sheet' ? `${fmt(g.l)} × ${fmt(g.w)} × ${g.t} mm` : `${fmt(g.l)} mm`} (${materialOf(g.mat).short})`).join('\n')),
  };
  const propsParts = useMemo(() => (selIds.size ? model.parts.filter((p) => selIds.has(p.id)) : model.parts), [model, selIds]);
  const propsGroups = useMemo(() => (selIds.size ? selGroups : plans.groups), [selIds, selGroups, plans]);

  // ---- historial (Ctrl+Z / Ctrl+Y): medidas, aspecto, piezas ocultas y cambio de mueble ----
  const snapNow = () => ({ typeId, store, looks: looksStore, hidden: hiddenKeys });
  const hist = useRef(null);
  if (!hist.current) hist.current = { past: [], future: [], base: snapNow(), at: 0, restoring: false };
  const [hv, setHv] = useState({ u: 0, r: 0 });
  useEffect(() => {
    const h = hist.current;
    const now = snapNow();
    if (h.restoring) { h.restoring = false; h.base = now; return; } // el cambio vino de deshacer/rehacer
    const b = h.base;
    if (b.typeId === now.typeId && b.store === now.store && b.looks === now.looks && b.hidden === now.hidden) return;
    const t = Date.now();
    if (t - h.at > 600) { // cambio nuevo; los ajustes seguidos (arrastrar un deslizador) cuentan como uno solo
      h.past.push(b);
      if (h.past.length > 100) h.past.shift();
      h.future = [];
    }
    h.base = now;
    h.at = t;
    setHv({ u: h.past.length, r: h.future.length });
  }, [typeId, store, looksStore, hiddenKeys]);

  const restoreSnap = (S) => {
    const h = hist.current;
    if (S.typeId !== typeId || S.store !== store || S.looks !== looksStore || S.hidden !== hiddenKeys) h.restoring = true;
    h.base = S;
    h.at = 0; // lo siguiente que se haga empieza un paso nuevo
    setTypeId(S.typeId);
    setStore(S.store);
    setLooksStore(S.looks);
    setHiddenKeys(S.hidden);
    setHv({ u: h.past.length, r: h.future.length });
  };
  const undo = () => {
    const h = hist.current;
    if (!h.past.length) return;
    const S = h.past.pop();
    h.future.push(h.base);
    restoreSnap(S);
  };
  const redo = () => {
    const h = hist.current;
    if (!h.future.length) return;
    const S = h.future.pop();
    h.past.push(h.base);
    restoreSnap(S);
  };
  const undoRef = useRef(undo);
  const redoRef = useRef(redo);
  undoRef.current = undo;
  redoRef.current = redo;
  useEffect(() => {
    const onKey = (e) => {
      if (!(e.ctrlKey || e.metaKey)) return;
      const k = e.key.toLowerCase();
      const t = e.target;
      const typing = t && (t.tagName === 'TEXTAREA' || t.tagName === 'SELECT'
        || (t.tagName === 'INPUT' && !['range', 'checkbox', 'radio', 'button'].includes(t.type))); // ahí vale el deshacer del propio campo
      if (typing) return;
      if (k === 'z' && !e.shiftKey) { e.preventDefault(); undoRef.current(); }
      else if (k === 'y' || (k === 'z' && e.shiftKey)) { e.preventDefault(); redoRef.current(); }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  const copy = useCallback(async () => {
    const text = shoppingText(type.name, model.bbox.dims, shop, priced);
    try { await navigator.clipboard.writeText(text); } catch {
      const ta = Object.assign(document.createElement('textarea'), { value: text });
      document.body.appendChild(ta); ta.select(); document.execCommand('copy'); ta.remove();
    }
    setCopied(true);
    setTimeout(() => setCopied(false), 1800);
  }, [type, model, shop, priced]);

  const buildRows = () => {
    const rows = [['Letra', 'Pieza', 'Material', 'Largo mm', 'Ancho mm', 'Espesor mm', 'Cantidad', 'Tapacanto total m']];
    plans.groups.forEach((g) => rows.push([
      g.label, g.name, materialOf(g.mat).name, g.l, g.w ?? '', g.t ?? '', g.qty, g.edgeMm ? (g.edgeMm / 1000).toFixed(2) : '',
    ]));
    rows.push([]);
    rows.push(['Compras', 'Detalle', 'Cantidad', 'Precio unitario CLP', 'Subtotal CLP']);
    priced.groups.forEach((g) => g.rows.forEach((r) => rows.push([g.title, `${r.label}${r.detail ? ` (${r.detail})` : ''}`, r.qty, r.unit ?? '', r.missing ? '' : Math.round(r.subtotal)])));
    rows.push(['Costo aproximado total', '', '', '', Math.round(priced.total)]);
    return rows;
  };

  const exportCsv = () => {
    const csv = buildRows().map((r) => r.map((c) => `"${String(c).replace(/"/g, '""')}"`).join(';')).join('\n');
    download(`${type.id}-despiece.csv`, csv);
  };

  const setPrice = (key, val) => setPrices((p) => {
    const n = { ...p };
    if (val == null) delete n[key]; else n[key] = val;
    return n;
  });
  const importPrices = async (file) => {
    const parsed = pricesFromCsv(await file.text());
    setPrices((p) => ({ ...p, ...parsed }));
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
    <div className="app" data-mview={mview}>
      <header className="top">
        <div className="brand"><img className="logo" src={logoUrl} alt="" width="36" height="36" /> MOBILABs <small>diseña · cubica · compra</small></div>
        <div className="top-actions">
          {PUBLISHED ? (
            <button className="btn primary" onClick={copyCuts} title="Copia el despiece y las compras para pegar en Excel, Sheets o un mensaje">
              {copiedCuts ? '¡Copiado!' : <>Copiar<span className="long"> despiece</span></>}
            </button>
          ) : (
            <>
              <button className="btn" onClick={exportCsv}><span className="long">Descargar </span>CSV</button>
              <button className="btn primary" onClick={() => window.print()}>Imprimir<span className="long"> / PDF</span></button>
            </>
          )}
        </div>
      </header>

      {/* ---------------- panel izquierdo ---------------- */}
      <aside className="left">
        <h2 className="pane-title">¿Qué mueble quieres armar?</h2>
        <div className="types" role="tablist">
          {FURNITURE.map((f) => (
            <button key={f.id} role="tab" aria-selected={f.id === typeId} className={`type ${f.id === typeId ? 'on' : ''}`} onClick={() => { setTypeId(f.id); setHover(null); setSelKeys(new Set()); setHiddenKeys(new Set()); setMenu(null); }} title={f.desc}>
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
          <Viewer3D parts={model.parts} fixtures={model.fixtures} bbox={model.bbox} explode={explode} highlight={hover || (selIds.size ? selIds : null)} viewKey={typeId} viewCmd={viewCmd} looks={looks} hiddenIds={hiddenIds} multi={multi} onPick={onPick} onBox={onBox} onContext={onContext} />
          <div className="hud">
            <div className="dims">
              <b>{type.name}</b>
              <span>{cm(bw)} <small>ancho</small> × {cm(bh)} <small>alto</small> × {cm(bd)} <small>fondo</small> cm</span>
            </div>
            {oneGroup && (
              <div className="sel-card" role="status">
                <span className="chip" style={{ background: labelColor(oneGroup.label), borderColor: labelStroke(oneGroup.label) }}>{oneGroup.label}</span>
                <div className="sel-info">
                  <b>{oneGroup.name}</b>
                  <span>
                    {oneGroup.kind === 'sheet'
                      ? `${fmt(oneGroup.l)} × ${fmt(oneGroup.w)} × ${oneGroup.t} mm`
                      : `${fmt(oneGroup.l)} mm · ${sectionLabel(oneGroup.mat)}`}
                    {' · '}{oneGroup.qty} {oneGroup.qty === 1 ? 'pieza' : 'piezas'} · {materialOf(oneGroup.mat).short}
                  </span>
                </div>
                <button className="sel-x" onClick={() => setSelKeys(new Set())} aria-label="Quitar selección" title="Quitar selección (Esc)">✕</button>
              </div>
            )}
            {selIds.size > 0 && !oneGroup && (
              <div className="sel-card" role="status">
                <span className="chip multi-chip">{selIds.size}</span>
                <div className="sel-info">
                  <b>{selIds.size} piezas seleccionadas</b>
                  <span>{selGroups.slice(0, 4).map((g) => `${g.name} ×${g.ids.filter((id) => selIds.has(id)).length}`).join(' · ')}{selGroups.length > 4 ? ' …' : ''}</span>
                </div>
                <button className="sel-x" onClick={() => setSelKeys(new Set())} aria-label="Quitar selección" title="Quitar selección (Esc)">✕</button>
              </div>
            )}
            {hiddenKeys.size > 0 && (
              <button className="hidden-chip" onClick={() => setHiddenKeys(new Set())} title="Volver a mostrar las piezas ocultas">
                {hiddenKeys.size} {hiddenKeys.size === 1 ? 'pieza oculta' : 'piezas ocultas'} · Mostrar todo
              </button>
            )}
          </div>
          <div className="vtools">
            <button className="vbtn" disabled={!hv.u} onClick={undo} aria-label="Deshacer" title="Deshacer (Ctrl+Z)">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="square" aria-hidden="true"><path d="M8 5 3 10l5 5" /><path d="M3 10h11a6 6 0 0 1 0 12h-3" /></svg>
            </button>
            <button className="vbtn" disabled={!hv.r} onClick={redo} aria-label="Rehacer" title="Rehacer (Ctrl+Y)">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="square" aria-hidden="true" style={{ transform: 'scaleX(-1)' }}><path d="M8 5 3 10l5 5" /><path d="M3 10h11a6 6 0 0 1 0 12h-3" /></svg>
            </button>
            <button className={`vbtn multi-btn ${multi ? 'on' : ''}`} aria-pressed={multi} onClick={() => setMulti((m) => !m)} title="Selección múltiple: cada toque suma o quita piezas">Multi</button>
            <button className={`vbtn ${helpOpen ? 'on' : ''}`} aria-expanded={helpOpen} aria-label="Controles del visor" onClick={() => setHelpOpen((h) => !h)} title="Controles del visor">?</button>
            {helpOpen && (
              <div className="vhelp" role="dialog" aria-label="Controles del visor">
                <b>Controles del visor</b>
                <dl>
                  <dt>Clic izquierdo</dt><dd>Seleccionar. Ctrl o Mayús + clic: sumar o quitar</dd>
                  <dt>Arrastrar (izq.)</dt><dd>Rectángulo de selección: → piezas completas · ← las que toque</dd>
                  <dt>Rueda + arrastrar</dt><dd>Desplazar</dd>
                  <dt>Mayús + rueda + arrastrar</dt><dd>Girar el 3D (Mayús puede ir antes o después de la rueda, incluso a mitad del arrastre)</dd>
                  <dt>Girar la rueda</dt><dd>Acercar / alejar</dd>
                  <dt>Clic derecho</dt><dd>Menú: propiedades, color, textura, ocultar…</dd>
                  <dt>Esc</dt><dd>Quitar la selección</dd>
                  <dt>Ctrl + Z / Ctrl + Y</dt><dd>Deshacer / rehacer (medidas, color, textura, piezas ocultas)</dd>
                  <dt>Celular</dt><dd>1 dedo gira · 2 dedos desplazan y acercan · mantener presionado abre el menú · “Multi” suma piezas</dd>
                </dl>
              </div>
            )}
          </div>
          <div className="viewbar">
            <div className="seg" role="group" aria-label="Vista">
              {[['iso', 'Isométrica', 'Iso'], ['front', 'Frente', 'Frente'], ['side', 'Lado', 'Lado'], ['top', 'Arriba', 'Arriba']].map(([n, l, short]) => (
                <button key={n} title={l} onClick={() => setViewCmd({ name: n, t: Date.now() })}>{isPhone ? short : l}</button>
              ))}
            </div>
            <label className="explode" title="Vista explosionada: separa las piezas para ver cómo se arma">
              <svg className="explode-ico" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true"><path d="M12 3v5M12 16v5M3 12h5M16 12h5" /></svg>
              <span>Vista explosionada</span>
              <input type="range" min="0" max="1" step="0.01" value={explode} onChange={(e) => setExplode(Number(e.target.value))} />
            </label>
          </div>
        </div>

        {menu && (
          <ContextMenu x={menu.x} y={menu.y} count={selIds.size} current={currentLook} hiddenCount={hiddenKeys.size} onClose={closeMenu} actions={menuActions} />
        )}
        {propsOpen && (
          <PropsDialog parts={propsParts} groups={propsGroups} scopeAll={!selIds.size} look={currentLook} textureName={currentLook.textureName} onClose={() => setPropsOpen(false)} />
        )}

        <div className="notices">
          {warns.map((n, i) => <div key={`w${i}`} className="notice warn">⚠ {n.text}</div>)}
          {tips.map((n, i) => <div key={`t${i}`} className="notice info">ℹ {n.text}</div>)}
        </div>
      </main>

      {/* ---------------- panel derecho ---------------- */}
      <aside className="right">
        <div className="tabs" role="tablist">
          {[['piezas', 'Piezas'], ['cortes', 'Cortes'], ['compras', 'Compras'], ['planos', 'Planos'], ['manual', 'Manual']].map(([id, label]) => (
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

        <div className={`tab-body ${tab === 'piezas' ? 'show' : ''}`}><CutList plans={plans} onHover={setHover} selectedKeys={fullKeys} partialKeys={partialKeys} onSelect={(g, add) => onPick(g.ids[0], { add })} scrollTo={scrollTo} /></div>
        <div className={`tab-body ${tab === 'cortes' ? 'show' : ''}`}><SheetPlans plans={plans} /></div>
        <div className={`tab-body ${tab === 'planos' ? 'show' : ''}`}>{tab === 'planos' && <Planos drawing={drawing} spec={techSpec(model, plans, shop, type, values)} title={type.name} subtitle={`${cm(bw)} × ${cm(bh)} × ${cm(bd)} cm (ancho × alto × fondo)`} />}</div>
        <div className={`tab-body ${tab === 'manual' ? 'show' : ''}`}>{tab === 'manual' && <Manual manual={manual} title={type.name} />}</div>
        <div className={`tab-body ${tab === 'compras' ? 'show' : ''}`}><Shopping shop={shop} priced={priced} onCopy={copy} copied={copied} onPrice={setPrice} onResetPrices={() => setPrices({})} onImportPrices={importPrices} onExportPrices={PUBLISHED ? null : () => download('precios-mobilabs.csv', pricesToCsv(priced))} /></div>
      </aside>

      <nav className="mnav" aria-label="Secciones">
        {[['diseno', 'Diseño'], ['piezas', 'Piezas'], ['cortes', 'Cortes'], ['compras', 'Compras'], ['planos', 'Planos'], ['manual', 'Manual']].map(([id, label]) => {
          const active = id === 'diseno' ? mview === 'diseno' : mview === 'resultados' && tab === id;
          return (
            <button
              key={id}
              className={active ? 'on' : ''}
              aria-current={active ? 'page' : undefined}
              onClick={() => {
                if (id === 'diseno') setMview('diseno');
                else { setMview('resultados'); setTab(id); }
                window.scrollTo({ top: 0 });
              }}
            >
              <NavIcon id={id} />
              <span>{label}</span>
            </button>
          );
        })}
      </nav>
    </div>
  );
}
