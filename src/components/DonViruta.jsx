import React, { useEffect, useRef, useState } from 'react';
import { AVATAR, poseUrl } from '../lib/viruta.js';
import { EVENTS, STATES, statePose, virutaListen, virutaEmit, oficioTip, loadOpen, saveOpen } from '../lib/donViruta.js';

/** DonVirutaAvatar: el rostro de Don Viruta en un círculo (para el asistente flotante). */
export function DonVirutaAvatar({ size = 60, className = '' }) {
  return <span className={`dv-avatar ${className}`} style={{ width: size, height: size }}><img src={AVATAR} alt="" width={size} height={size} /></span>;
}

/** DonVirutaMessage: pose de cuerpo entero + mensaje; al cambiar de pose se funde suave. */
export function DonVirutaMessage({ pose, text, size = 92, children }) {
  return (
    <div className="dv-msg">
      <img key={pose} className="dv-pose" src={pose} alt="" style={{ height: size }} />
      <div className="dv-msg-t">
        <p key={text} aria-live="polite">{text}</p>
        {children}
      </div>
    </div>
  );
}

/** DonVirutaWelcome: banner de bienvenida del inicio. Personaje a la izquierda; saludo, mensaje y buscador a la derecha. */
export function DonVirutaWelcome({ name, msg, onOther, children }) {
  return (
    <header className="dv-welcome">
      <div className="dv-welcome-fig">{msg && <img key={msg.pose} src={poseUrl(msg.pose)} alt="Don Viruta, maestro carpintero" />}</div>
      <div className="dv-welcome-body">
        <span className="dv-eyebrow">Don Viruta — tu maestro carpintero</span>
        <h1>{name ? `¡Hola, ${name}!` : '¡Hola!'}</h1>
        <p className="dv-welcome-sub">¿Qué vamos a construir hoy?</p>
        {children}
        {msg && (
          <p className="dv-welcome-tip" aria-live="polite">
            <span key={msg.text}>«{msg.text}»</span>
            <button className="linkish" onClick={onOther}>Otro consejo ↻</button>
          </p>
        )}
      </div>
    </header>
  );
}

const QUICK = [
  ['cortes', 'Ver cortes'],
  ['compras', 'Lista de compras'],
  ['planos', 'Planos'],
  ['manual', 'Manual de armado'],
];
const IDLE_MS = 4 * 60 * 1000;

/**
 * DonVirutaAssistant: asistente flotante del editor (esquina inferior derecha; en el teléfono, panel inferior).
 * Escucha los eventos de la app (virutaEmit) y muestra la pose y el mensaje que corresponde.
 * warns / notes: alertas y notas reales del modelo; onGoTab, onShowAlerts, onTour: acciones rápidas.
 */
export function DonVirutaAssistant({ hidden, warns = [], notes = [], onGoTab, onShowAlerts, onTour }) {
  const [open, setOpen] = useState(loadOpen);
  const [cur, setCur] = useState(() => ({ state: 'welcome', text: STATES.welcome.msgs[0], pose: statePose('welcome') }));
  const [unread, setUnread] = useState(false);
  const [peek, setPeek] = useState(null);
  const [react, setReact] = useState(0);
  const lastPop = useRef(0);
  const pending = useRef(null); // mensaje que llegó mientras el asistente estaba oculto (p. ej. durante la transición desde el inicio)
  const rootRef = useRef(null);
  const openRef = useRef(open);
  openRef.current = open;
  const hiddenRef = useRef(hidden);
  hiddenRef.current = hidden;
  const panelRef = useRef(null);
  const btnRef = useRef(null);

  const toggle = (v) => { setOpen(v); saveOpen(v); if (v) { setUnread(false); setPeek(null); } };

  // eventos de la app
  useEffect(() => virutaListen(({ type, data }) => {
    const r = EVENTS[type](data);
    setCur({ state: r.state, text: r.text, pose: statePose(r.state) });
    if (['saved', 'finished', 'working'].includes(r.state)) setReact((n) => n + 1);
    if (hiddenRef.current && r.pop) { pending.current = { text: r.text, at: Date.now() }; return; }
    if (openRef.current || hiddenRef.current || !r.pop) { if (!openRef.current && r.alert) setUnread(true); return; }
    const now = Date.now();
    if (!r.alert && now - lastPop.current < 6000) { setUnread(true); return; }
    lastPop.current = now;
    setUnread(true);
    setPeek({ text: r.text, at: now });
  }), []);
  // al aparecer, muestra el mensaje reciente que quedó pendiente
  useEffect(() => {
    if (hidden) return undefined;
    const p = pending.current; pending.current = null;
    if (!p || Date.now() - p.at > 6000 || openRef.current) return undefined;
    const id = setTimeout(() => { lastPop.current = Date.now(); setUnread(true); setPeek({ text: p.text, at: Date.now() }); }, 700);
    return () => clearTimeout(id);
  }, [hidden]);
  // en el teléfono se ubica sobre la barra de secciones, mida lo que mida
  useEffect(() => {
    if (hidden) return undefined;
    const nav = document.querySelector('.mnav');
    if (!nav || typeof ResizeObserver === 'undefined') return undefined;
    const set = () => rootRef.current?.style.setProperty('--mnav-h', `${nav.offsetHeight}px`);
    const ro = new ResizeObserver(set); ro.observe(nav); set();
    return () => ro.disconnect();
  }, [hidden]);
  // el globo se va solo
  useEffect(() => { if (!peek) return undefined; const id = setTimeout(() => setPeek(null), 5000); return () => clearTimeout(id); }, [peek]);
  // sin actividad: cambia a la pose relajada, sin interrumpir
  useEffect(() => {
    if (hidden) return undefined;
    let id;
    const arm = () => { clearTimeout(id); id = setTimeout(() => virutaEmit('idle'), IDLE_MS); };
    arm();
    window.addEventListener('pointerdown', arm, true);
    window.addEventListener('keydown', arm, true);
    return () => { clearTimeout(id); window.removeEventListener('pointerdown', arm, true); window.removeEventListener('keydown', arm, true); };
  }, [hidden]);
  // teclado: Escape minimiza; al abrir, el foco va al panel
  useEffect(() => {
    if (!open || hidden) return undefined;
    panelRef.current?.querySelector('.dv-close')?.focus({ preventScroll: true });
    const k = (e) => { if (e.key === 'Escape' && !document.querySelector('.dlg-back')) { toggle(false); btnRef.current?.focus(); } };
    window.addEventListener('keydown', k);
    return () => window.removeEventListener('keydown', k);
  }, [open, hidden]); // eslint-disable-line react-hooks/exhaustive-deps

  if (hidden) return null;
  const hasAlert = warns.length > 0;
  const go = (t) => { onGoTab(t); if (window.matchMedia('(max-width: 760px)').matches) toggle(false); };
  return (
    <div ref={rootRef} className={`dv ${open ? 'is-open' : ''}`}>
      {open && (
        <>
          <div className="dv-scrim" onClick={() => toggle(false)} aria-hidden="true" />
          <section className="dv-panel" ref={panelRef} role="dialog" aria-label="Don Viruta, tu maestro carpintero">
            <header className="dv-head">
              <DonVirutaAvatar size={40} />
              <div><b>Don Viruta</b><small>Tu maestro carpintero</small></div>
              <button className="dv-close" onClick={() => { toggle(false); btnRef.current?.focus(); }} aria-label="Minimizar asistente" title="Minimizar">
                <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" aria-hidden="true"><path d="M6 9l6 6 6-6" /></svg>
              </button>
            </header>
            <div className="dv-body">
              <DonVirutaMessage pose={hasAlert && cur.state !== 'tip' ? statePose('error') : cur.pose} text={cur.text} />
              {hasAlert ? (
                <div className="dv-sec warn">
                  <b>Lo que no me cuadra</b>
                  <ul>{warns.slice(0, 3).map((w) => <li key={w}>{w}</li>)}</ul>
                  {warns.length > 3 && <small>y {warns.length - 3} más…</small>}
                  <button className="dv-link" onClick={() => { onShowAlerts(); if (window.matchMedia('(max-width: 760px)').matches) toggle(false); }}>Ver alertas en el modelo →</button>
                </div>
              ) : notes.length > 0 && (
                <div className="dv-sec">
                  <b>Notas de tu mueble</b>
                  <ul>{notes.slice(0, 2).map((w) => <li key={w}>{w}</li>)}</ul>
                </div>
              )}
              <div className="dv-quick" role="group" aria-label="Acciones rápidas">
                {QUICK.map(([t, l]) => <button key={t} onClick={() => go(t)}>{l}</button>)}
                <button onClick={() => { const t = oficioTip(); setCur({ state: 'tip', text: t.text, pose: t.pose }); }}>Otro consejo ↻</button>
                <button onClick={() => { toggle(false); onTour(); }}>Ver tutorial</button>
              </div>
            </div>
          </section>
        </>
      )}
      {!open && peek && (
        <div className="dv-peek" role="status" key={peek.at}>
          <p>{peek.text}</p>
          <button onClick={() => setPeek(null)} aria-label="Cerrar mensaje">×</button>
        </div>
      )}
      {!open && (
        <button ref={btnRef} className={`dv-fab ${react ? 'react' : ''}`} key={react} onClick={() => toggle(true)} aria-label="Abrir a Don Viruta, tu maestro carpintero" aria-expanded={open} data-tip="¿Necesitas una mano, maestro?">
          <DonVirutaAvatar size={60} />
          {(unread || hasAlert) && <i className={`dv-dot ${hasAlert ? 'warn' : ''}`} aria-hidden="true" />}
        </button>
      )}
    </div>
  );
}
