import { virutaEmit } from '../lib/donViruta.js';
import React, { useEffect, useState } from 'react';
import { api, setToken, fmtDate } from '../lib/account.js';
import { ask } from '../lib/ui.js';

const PRIVACY = [
  'Al crear una cuenta, MOBILABs guarda tu correo, tu nombre (si lo escribes), tu contraseña cifrada (nadie puede leerla) y los diseños que guardes.',
  'Se usan para que puedas abrir tus diseños desde cualquier equipo. El desarrollador de MOBILABs puede ver la lista de usuarios y los diseños guardados para mantener y mejorar la aplicación.',
  'No se venden ni se comparten con terceros. Puedes borrar tu cuenta y todos tus diseños cuando quieras desde el menú de tu cuenta.',
];

function Dialog({ title, onClose, children, wide }) {
  useEffect(() => {
    const k = (e) => { if (e.key === 'Escape') { e.stopPropagation(); onClose(); } };
    window.addEventListener('keydown', k, true);
    return () => window.removeEventListener('keydown', k, true);
  }, [onClose]);
  return (
    <div className="dlg-back" onPointerDown={(e) => e.target === e.currentTarget && onClose()}>
      <div className={`dlg acc-dlg ${wide ? 'wide' : ''}`} role="dialog" aria-modal="true" aria-label={title}>
        <div className="dlg-head"><b>{title}</b><button className="sel-x" onClick={onClose} aria-label="Cerrar">✕</button></div>
        <div className="acc-body">{children}</div>
      </div>
    </div>
  );
}

/* ---------------------------------------------------------------- entrar / crear cuenta */
export function AuthDialog({ onClose, onDone, initial = 'login' }) {
  const [mode, setMode] = useState(initial);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [name, setName] = useState('');
  const [accept, setAccept] = useState(false);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');
  const [showPrivacy, setShowPrivacy] = useState(false);
  const [info, setInfo] = useState('');
  const submit = async (e) => {
    e.preventDefault();
    setErr('');
    setInfo('');
    setBusy(true);
    if (mode === 'forgot') {
      try { const r = await api('/forgot', { method: 'POST', body: { email } }); setInfo(r.message); } catch (ex) { setErr(ex.message); } finally { setBusy(false); }
      return;
    }
    try {
      const r = await api(mode === 'login' ? '/login' : '/register', { method: 'POST', body: mode === 'login' ? { email, password } : { email, password, name, accept } });
      setToken(r.token);
      onDone(r.user);
    } catch (ex) { setErr(ex.message); } finally { setBusy(false); }
  };
  return (
    <Dialog title={mode === 'login' ? 'Iniciar sesión' : mode === 'forgot' ? 'Recuperar contraseña' : 'Crear cuenta'} onClose={onClose}>
      <div className="acc-tabs">
        <button className={mode === 'login' ? 'on' : ''} onClick={() => { setMode('login'); setErr(''); }}>Entrar</button>
        <button className={mode === 'register' ? 'on' : ''} onClick={() => { setMode('register'); setErr(''); }}>Crear cuenta</button>
      </div>
      <p className="muted small">{mode === 'login' ? 'Entra para ver y guardar tus diseños en la nube.' : mode === 'forgot' ? 'Escribe el correo de tu cuenta y te enviaremos un enlace para crear una contraseña nueva.' : 'Con una cuenta, tus diseños quedan guardados y los abres desde cualquier equipo.'}</p>
      <form onSubmit={submit} className="acc-form">
        {mode === 'register' && (
          <label><span>Nombre (opcional)</span><input value={name} onChange={(e) => setName(e.target.value)} autoComplete="name" maxLength={80} /></label>
        )}
        <label><span>Correo</span><input type="email" required value={email} onChange={(e) => setEmail(e.target.value)} autoComplete="email" autoFocus /></label>
        {mode !== 'forgot' && (
          <label><span>Contraseña{mode === 'register' ? ' (mínimo 8 caracteres)' : ''}</span>
            <input type="password" required minLength={mode === 'register' ? 8 : 1} value={password} onChange={(e) => setPassword(e.target.value)} autoComplete={mode === 'login' ? 'current-password' : 'new-password'} />
          </label>
        )}
        {mode === 'register' && (
          <>
            <label className="acc-check">
              <input type="checkbox" checked={accept} onChange={(e) => setAccept(e.target.checked)} />
              <span>Acepto el <button type="button" className="linkish" onClick={() => setShowPrivacy((s) => !s)}>aviso de privacidad</button></span>
            </label>
            {showPrivacy && <div className="acc-privacy">{PRIVACY.map((t) => <p key={t}>{t}</p>)}</div>}
          </>
        )}
        {err && <p className="acc-err">{err}</p>}
        {info && <p className="acc-ok">{info}</p>}
        <button className="btn primary acc-go" disabled={busy || (mode === 'register' && !accept)}>{busy ? 'Un momento…' : mode === 'login' ? 'Entrar' : mode === 'forgot' ? 'Enviar enlace' : 'Crear cuenta'}</button>
        {mode === 'login' && <button type="button" className="linkish acc-forgot" onClick={() => { setMode('forgot'); setErr(''); }}>¿Olvidaste tu contraseña?</button>}
        {mode === 'forgot' && <button type="button" className="linkish acc-forgot" onClick={() => { setMode('login'); setErr(''); setInfo(''); }}>← Volver a iniciar sesión</button>}
      </form>
    </Dialog>
  );
}

/* ---------------------------------------------------------------- mi cuenta (editar nombre) */
export function ProfileDialog({ user, onClose, onSaved }) {
  const [name, setName] = useState(user.name || '');
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');
  const submit = async (e) => {
    e.preventDefault();
    setBusy(true); setErr('');
    try { const r = await api('/me', { method: 'PUT', body: { name } }); onSaved(r.user); } catch (ex) { setErr(ex.message); } finally { setBusy(false); }
  };
  return (
    <Dialog title="Mi cuenta" onClose={onClose}>
      <form onSubmit={submit} className="acc-form">
        <label><span>Nombre</span><input value={name} onChange={(e) => setName(e.target.value)} maxLength={80} autoFocus placeholder="Cómo quieres que te salude MOBILABs" /></label>
        <label><span>Correo</span><input value={user.email} disabled /></label>
        {err && <p className="acc-err">{err}</p>}
        <button className="btn primary acc-go" disabled={busy}>{busy ? 'Guardando…' : 'Guardar'}</button>
      </form>
    </Dialog>
  );
}

/* ---------------------------------------------------------------- guardar diseño (nombre) */
export function SaveDialog({ suggested, onClose, onSave }) {
  const [name, setName] = useState(suggested || '');
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');
  const submit = async (e) => {
    e.preventDefault();
    setBusy(true); setErr('');
    try { await onSave(name.trim() || suggested || 'Mi diseño'); } catch (ex) { setErr(ex.message); setBusy(false); }
  };
  return (
    <Dialog title="Guardar diseño" onClose={onClose}>
      <form onSubmit={submit} className="acc-form">
        <label><span>Nombre del diseño</span><input value={name} onChange={(e) => setName(e.target.value)} maxLength={120} autoFocus onFocus={(e) => e.target.select()} /></label>
        <p className="muted small">Queda guardado en tu cuenta. Desde ahora, los cambios se guardan solos mientras trabajas.</p>
        {err && <p className="acc-err">{err}</p>}
        <button className="btn primary acc-go" disabled={busy}>{busy ? 'Guardando…' : 'Guardar'}</button>
      </form>
    </Dialog>
  );
}

/* ---------------------------------------------------------------- nueva contraseña (desde el enlace del correo) */
export function ResetDialog({ token, onClose, onDone }) {
  const [p1, setP1] = useState('');
  const [p2, setP2] = useState('');
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');
  const submit = async (e) => {
    e.preventDefault();
    if (p1 !== p2) { setErr('Las contraseñas no coinciden.'); return; }
    setBusy(true); setErr('');
    try { const r = await api('/reset', { method: 'POST', body: { token, password: p1 } }); setToken(r.token); onDone(r.user); }
    catch (ex) { setErr(ex.message); } finally { setBusy(false); }
  };
  return (
    <Dialog title="Crear contraseña nueva" onClose={onClose}>
      <form onSubmit={submit} className="acc-form">
        <label><span>Contraseña nueva (mínimo 8 caracteres)</span><input type="password" required minLength={8} value={p1} onChange={(e) => setP1(e.target.value)} autoComplete="new-password" autoFocus /></label>
        <label><span>Repite la contraseña</span><input type="password" required minLength={8} value={p2} onChange={(e) => setP2(e.target.value)} autoComplete="new-password" /></label>
        {err && <p className="acc-err">{err}</p>}
        <button className="btn primary acc-go" disabled={busy}>{busy ? 'Un momento…' : 'Guardar y entrar'}</button>
      </form>
    </Dialog>
  );
}

/* ---------------------------------------------------------------- mis diseños */
export function DesignsDialog({ onClose, onOpen, onSaveNew, currentId, typeNames }) {
  const [list, setList] = useState(null);
  const [err, setErr] = useState('');
  const [name, setName] = useState('');
  const load = () => api('/designs').then((r) => setList(r.designs)).catch((e) => setErr(e.message));
  useEffect(() => { load(); }, []);
  const rename = async (d) => {
    const n = await ask({ title: 'Renombrar diseño', message: 'Escribe el nuevo nombre:', input: d.name, ok: 'Guardar' });
    if (!n) return;
    try { await api(`/designs/${d.id}`, { method: 'PUT', body: { name: n } }); load(); } catch (e) { setErr(e.message); }
  };
  const remove = async (d) => {
    if (!(await ask({ title: 'Borrar diseño', message: `¿Borrar «${d.name}»? No se puede deshacer.`, ok: 'Borrar', danger: true }))) return;
    try { await api(`/designs/${d.id}`, { method: 'DELETE' }); virutaEmit('project_deleted', { name: d.name }); load(); } catch (e) { setErr(e.message); }
  };
  return (
    <Dialog title="Mis diseños" onClose={onClose} wide>
      <form className="acc-save" onSubmit={async (e) => { e.preventDefault(); try { await onSaveNew(name || 'Mi diseño'); setName(''); load(); } catch (ex) { setErr(ex.message); } }}>
        <input placeholder="Nombre para guardar el diseño actual" value={name} onChange={(e) => setName(e.target.value)} maxLength={120} />
        <button className="btn primary">Guardar como nuevo</button>
      </form>
      {err && <p className="acc-err">{err}</p>}
      {!list ? <p className="muted">Cargando…</p> : list.length === 0 ? <p className="muted">Todavía no tienes diseños guardados.</p> : (
        <table className="acc-table">
          <thead><tr><th>Nombre</th><th>Mueble</th><th>Última edición</th><th /></tr></thead>
          <tbody>
            {list.map((d) => (
              <tr key={d.id} className={d.id === currentId ? 'cur' : ''}>
                <td><b>{d.name}</b>{d.id === currentId && <span className="tag">abierto</span>}</td>
                <td>{typeNames[d.typeId] || d.typeId}</td>
                <td className="muted">{fmtDate(d.updatedAt)}</td>
                <td className="acts">
                  <button className="btn small primary" onClick={() => onOpen(d.id)}>Abrir</button>
                  <button className="btn small" onClick={() => rename(d)}>Renombrar</button>
                  <button className="btn small" onClick={() => remove(d)}>Borrar</button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
      <p className="hint">Al abrir un diseño, los cambios se guardan solos en la nube mientras trabajas.</p>
    </Dialog>
  );
}

/* ---------------------------------------------------------------- panel del desarrollador */
export function AdminDialog({ onClose, onOpenDesign, typeNames }) {
  const [stats, setStats] = useState(null);
  const [users, setUsers] = useState([]);
  const [designs, setDesigns] = useState([]);
  const [filter, setFilter] = useState(null);
  const [err, setErr] = useState('');
  useEffect(() => {
    Promise.all([api('/admin/stats'), api('/admin/users')]).then(([s, u]) => { setStats(s); setUsers(u.users); }).catch((e) => setErr(e.message));
  }, []);
  useEffect(() => {
    api(`/admin/designs${filter ? `?user=${filter.id}` : ''}`).then((r) => setDesigns(r.designs)).catch((e) => setErr(e.message));
  }, [filter]);
  return (
    <Dialog title="Panel del desarrollador" onClose={onClose} wide>
      {err && <p className="acc-err">{err}</p>}
      {stats && (
        <div className="acc-stats">
          <div><b>{stats.users}</b><span>usuarios</span></div>
          <div><b>{stats.usersLast7}</b><span>nuevos en 7 días</span></div>
          <div><b>{stats.designs}</b><span>diseños guardados</span></div>
          <div className="wide"><span>Más diseñados</span>{stats.byType.slice(0, 5).map((t) => <em key={t.typeId}>{typeNames[t.typeId] || t.typeId} · {t.n}</em>)}</div>
        </div>
      )}
      <h4 className="acc-h">Usuarios</h4>
      <div className="acc-scroll">
        <table className="acc-table">
          <thead><tr><th>Correo</th><th>Nombre</th><th>Registro</th><th>Último ingreso</th><th>Diseños</th></tr></thead>
          <tbody>
            {users.map((u) => (
              <tr key={u.id} className={filter?.id === u.id ? 'cur' : ''} onClick={() => setFilter(filter?.id === u.id ? null : u)} style={{ cursor: 'pointer' }}>
                <td>{u.email}</td><td>{u.name}</td><td className="muted">{fmtDate(u.createdAt)}</td><td className="muted">{fmtDate(u.lastLogin)}</td><td>{u.designs}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <h4 className="acc-h">Diseños {filter ? `de ${filter.email}` : 'recientes'} {filter && <button className="linkish" onClick={() => setFilter(null)}>(ver todos)</button>}</h4>
      <div className="acc-scroll">
        <table className="acc-table">
          <thead><tr><th>Nombre</th><th>Mueble</th><th>Usuario</th><th>Última edición</th><th /></tr></thead>
          <tbody>
            {designs.map((d) => (
              <tr key={d.id}>
                <td><b>{d.name}</b></td><td>{typeNames[d.typeId] || d.typeId}</td><td className="muted">{d.email}</td><td className="muted">{fmtDate(d.updatedAt)}</td>
                <td className="acts"><button className="btn small" onClick={() => onOpenDesign(d.id)}>Ver</button></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <p className="hint">Toca un usuario para ver solo sus diseños. “Ver” abre una copia del diseño en tu pantalla: no modifica el del usuario.</p>
    </Dialog>
  );
}

/* ---------------------------------------------------------------- botón y menú de la cuenta */
export function AccountButton({ user, status, onLogin, onRegister, onDesigns, onAdmin, onLogout, onDeleteAccount, onTutorial, onHome, onProfile }) {
  const [open, setOpen] = useState(false);
  const close = () => setOpen(false);
  const initial = user ? (user.name || user.email).trim()[0]?.toUpperCase() || '?' : '?';
  return (
    <details className="acc-menu" open={open} onToggle={(e) => setOpen(e.currentTarget.open)}>
      <summary className={`btn acc-chip ${user ? '' : 'guest'}`} title={user ? user.email : 'Sin cuenta'}>
        <span className="acc-av">{user ? initial : '◌'}</span>
        <span className="long">{user ? user.name || user.email.split('@')[0] : 'Invitado'}</span>
        {status && <em className="acc-status">{status}</em>}
        <span className="acc-caret">▾</span>
      </summary>
      <div className="bim-pop acc-pop">
        {user ? (
          <>
            <div className="acc-who"><b>{user.name || 'Mi cuenta'}</b><span>{user.email}</span></div>
            <button onClick={() => { close(); onDesigns(); }}><b>Mis diseños</b><span>Guardar, abrir y ordenar tus diseños en la nube</span></button>
            <button onClick={() => { close(); onProfile(); }}><b>Mi cuenta</b><span>Cambiar tu nombre</span></button>
            {user.isAdmin && <button onClick={() => { close(); onAdmin(); }}><b>Panel del desarrollador</b><span>Usuarios registrados y diseños guardados</span></button>}
          </>
        ) : (
          <>
            <div className="acc-who"><b>Estás sin cuenta</b><span>Tus diseños quedan solo en este navegador</span></div>
            <button onClick={() => { close(); onLogin(); }}><b>Entrar</b><span>Accede a tus diseños guardados en la nube</span></button>
            <button onClick={() => { close(); onRegister(); }}><b>Crear cuenta</b><span>Gratis: guarda tus diseños y ábrelos desde cualquier equipo</span></button>
          </>
        )}
        <button onClick={() => { close(); onHome(); }}><b>Inicio</b><span>Volver a la pantalla de inicio</span></button>
        <button onClick={() => { close(); onTutorial(); }}><b>Tutorial</b><span>Recorrido guiado por la aplicación</span></button>
        {user && (
          <>
            <button onClick={() => { close(); onLogout(); }}><b>Cerrar sesión</b></button>
            <button className="danger" onClick={() => { close(); onDeleteAccount(); }}><b>Borrar mi cuenta</b><span>Elimina tu cuenta y todos tus diseños guardados</span></button>
          </>
        )}
      </div>
    </details>
  );
}
