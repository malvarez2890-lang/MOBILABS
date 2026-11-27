import React, { useEffect, useMemo, useState } from 'react';
import { FURNITURE } from '../lib/types.js';
import { interpret } from '../lib/intent.js';
import { api, fmtDate } from '../lib/account.js';
import { Icon } from './Icons.jsx';
import { POSES, homeMessage, randomTip } from '../lib/viruta.js';

const EXAMPLES = ['mesa redonda para 6', 'rack de TV de 180 con puertas', 'escritorio con cajonera en MDF', 'estante de 1,2 m con ruedas', 'credenza para tocadiscos con patas cónicas'];

/** Pantalla de inicio: "¿Qué tienes en mente hoy?", continuar, empezar uno nuevo o partir de un modelo listo. */
export default function Home({ leaving, user, local, onContinueLocal, onOpenCloud, onNew, onPreset, onIntent, onLogin, onAllDesigns }) {
  const [q, setQ] = useState('');
  const [pick, setPick] = useState(null);
  const pickType = FURNITURE.find((f) => f.id === pick);
  const [designs, setDesigns] = useState(null);
  const sugg = useMemo(() => interpret(q), [q]);
  useEffect(() => {
    if (!user) { setDesigns(null); return; }
    api('/designs').then((r) => setDesigns(r.designs)).catch(() => setDesigns([]));
  }, [user]);
  const typeName = (id) => FURNITURE.find((f) => f.id === id)?.name || id;
  const first = (user?.name || '').split(' ')[0];
  // Don Viruta: un mensaje por visita, según lo que hace el usuario (espera a tener sus diseños, si hay cuenta)
  const [msg, setMsg] = useState(null);
  useEffect(() => {
    if (user && designs === null) return;
    const typeNames = Object.fromEntries(FURNITURE.map((f) => [f.id, f.name]));
    setMsg(homeMessage({ name: user?.name, user, local: local && { typeName: typeName(local.typeId), dims: local.dims, custom: local.custom }, designs: designs || [], typeNames }));
  }, [user, designs]); // eslint-disable-line react-hooks/exhaustive-deps
  return (
    <div className={`home ${leaving ? 'leaving' : ''}`} role="region" aria-label="Inicio">
      <div className="home-in">
        <header className="home-hero">
          <div className="viruta">
            {msg && <img key={msg.pose} src={POSES[msg.pose]} alt="Don Viruta, maestro carpintero" className="viruta-img" />}
            {msg && (
              <div className="viruta-say" aria-live="polite">
                <b>Don Viruta</b>
                <p>{msg.text}</p>
                <button className="linkish" onClick={() => setMsg(randomTip())}>Otro consejo ↻</button>
              </div>
            )}
          </div>
          <h1>{first ? `Hola, ${first}` : 'Hola'}</h1>
          <p>¿Qué tienes en mente hoy?</p>
          <form className="home-search" onSubmit={(e) => { e.preventDefault(); if (sugg[0]) onIntent(sugg[0]); }}>
            <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Ej.: mesa redonda para 6, rack de TV de 180 con puertas…" aria-label="Describe el mueble que quieres hacer" autoFocus />
            <button className="btn primary" disabled={!sugg.length}>Diseñar →</button>
          </form>
          {q && (
            <div className="home-sugg">
              {sugg.length ? sugg.map((s) => (
                <button key={s.typeId} onClick={() => onIntent(s)}><Icon id={s.typeId} size={22} /><b>{s.label}</b><span>{s.detail}</span></button>
              )) : <em>No reconocí el mueble. Prueba con “mesa”, “estante”, “escritorio”, “rack de TV”, “credenza”…</em>}
            </div>
          )}
          {!q && <div className="home-ex">{EXAMPLES.map((e) => <button key={e} onClick={() => setQ(e)}>{e}</button>)}</div>}
        </header>

        {!user && (
          <div className="home-guest">
            <span>Estás <b>sin cuenta</b>: tus diseños quedan solo en este navegador.</span>
            <button className="btn small primary" onClick={onLogin}>Entrar o crear cuenta</button>
          </div>
        )}

        <div className="home-grid">
          <section className="home-col">
            <h3>Continuar donde quedaste</h3>
            {local && (
              <button className="home-card big" onClick={onContinueLocal}>
                <div className="thumb">{local.thumb ? <img src={local.thumb} alt="" /> : <Icon id={local.typeId} size={48} />}</div>
                <div className="txt"><b>{local.cloudName || typeName(local.typeId)}</b><span>{local.dims}</span><small>{local.cloudName ? 'Guardado en tu cuenta' : 'Último diseño en este navegador'}</small></div>
                <span className="go">Continuar →</span>
              </button>
            )}
            {user && (
              <>
                <div className="home-sub-h"><span>Mis diseños en la nube</span>{designs?.length > 0 && <button className="linkish" onClick={onAllDesigns}>Ver todos</button>}</div>
                {!designs ? <p className="muted small">Cargando…</p> : designs.length === 0 ? <p className="muted small">Todavía no guardas diseños. Abre uno y guárdalo desde el menú de tu cuenta → Mis diseños.</p> : (
                  <ul className="home-list">
                    {designs.slice(0, 6).map((d) => (
                      <li key={d.id}>
                        <button onClick={() => onOpenCloud(d.id)}>
                          <span className="mini">{d.thumb ? <img src={d.thumb} alt="" /> : <Icon id={d.typeId} size={24} />}</span>
                          <span className="nm"><b>{d.name}</b><small>{typeName(d.typeId)} · {fmtDate(d.updatedAt)}</small></span>
                          <span className="go">Abrir</span>
                        </button>
                      </li>
                    ))}
                  </ul>
                )}
              </>
            )}
          </section>

          <section className="home-col">
            <h3>Empezar un mueble nuevo</h3>
            <div className="home-types">
              {FURNITURE.map((f) => (
                <button key={f.id} className={pick === f.id ? 'on' : ''} aria-expanded={pick === f.id} onClick={() => setPick(pick === f.id ? null : f.id)} title={f.desc}><Icon id={f.id} size={30} /><span>{f.name}</span></button>
              ))}
            </div>
            {pickType && (
              <div className="home-pick" key={pickType.id} ref={(el) => el && el.scrollIntoView({ behavior: 'smooth', block: 'nearest' })}>
                <div className="home-pick-h"><Icon id={pickType.id} size={20} /><b>{pickType.name}</b><span>{pickType.desc}</span><button className="home-pick-x" onClick={() => setPick(null)} aria-label="Cerrar">×</button></div>
                <div className="home-presets">
                  <button className="def" onClick={() => onNew(pickType.id)}><Icon id={pickType.id} size={16} /><span><b>Por defecto</b><small>Para modificar a tu gusto</small></span></button>
                  {pickType.presets.map((p) => (
                    <button key={p.name} onClick={() => onPreset(pickType.id, p)}><Icon id={pickType.id} size={16} /><span><b>{p.name}</b><small>Modelo listo</small></span></button>
                  ))}
                </div>
              </div>
            )}
          </section>
        </div>
      </div>
    </div>
  );
}
