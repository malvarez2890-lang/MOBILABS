import { connect } from 'cloudflare:sockets';

/**
 * MOBILABs · servidor en Cloudflare Workers.
 * Sirve la app (carpeta dist) y una API pequeña para cuentas y diseños guardados, sobre una base D1 (binding DB).
 *
 *   POST /api/register   { email, password, name, accept }   → { token, user }
 *   POST /api/login      { email, password }                 → { token, user }
 *   POST /api/logout
 *   POST /api/forgot     { email }  → envía un correo con un enlace para crear una contraseña nueva (válido 1 hora)
 *   POST /api/reset      { token, password } → { token, user }
 *   GET  /api/me         · DELETE /api/me (borra la cuenta y sus diseños)
 *   GET  /api/designs    · POST /api/designs { name, typeId, data }
 *   GET|PUT|DELETE /api/designs/:id
 *   GET  /api/admin/stats · /api/admin/users · /api/admin/designs[?user=] · /api/admin/designs/:id   (solo ADMIN_EMAILS)
 *
 * Las contraseñas se guardan con PBKDF2-SHA256 (sal propia por usuario); las sesiones, como hash del token.
 * Correo de recuperación por SMTP (Gmail): variables MAIL_USER y secreto MAIL_APP_PASSWORD en el panel de Cloudflare.
 */
const ORIGINS = ['https://mobilabs.elbunkerservers.com', 'https://malvarez2890-lang.github.io'];
const DAY = 86400000;
const SESSION_DAYS = 60;
const MAX_DESIGN_BYTES = 300000;
const MAX_DESIGNS = 300;

const SCHEMA = [
  `CREATE TABLE IF NOT EXISTS users (id TEXT PRIMARY KEY, email TEXT NOT NULL UNIQUE, name TEXT, pass_hash TEXT NOT NULL, salt TEXT NOT NULL,
     created_at INTEGER NOT NULL, last_login INTEGER, accepted_at INTEGER)`,
  `CREATE TABLE IF NOT EXISTS sessions (token_hash TEXT PRIMARY KEY, user_id TEXT NOT NULL, created_at INTEGER NOT NULL, expires_at INTEGER NOT NULL)`,
  `CREATE TABLE IF NOT EXISTS designs (id TEXT PRIMARY KEY, user_id TEXT NOT NULL, name TEXT NOT NULL, type_id TEXT NOT NULL, data TEXT NOT NULL,
     created_at INTEGER NOT NULL, updated_at INTEGER NOT NULL)`,
  'CREATE INDEX IF NOT EXISTS idx_designs_user ON designs(user_id, updated_at)',
  'CREATE INDEX IF NOT EXISTS idx_sessions_user ON sessions(user_id)',
  `CREATE TABLE IF NOT EXISTS resets (token_hash TEXT PRIMARY KEY, user_id TEXT NOT NULL, created_at INTEGER NOT NULL, expires_at INTEGER NOT NULL, used INTEGER NOT NULL DEFAULT 0)`,
  'CREATE INDEX IF NOT EXISTS idx_resets_user ON resets(user_id, created_at)',
];
let ready = false;
async function ensureSchema(db) {
  if (ready) return;
  await db.batch(SCHEMA.map((q) => db.prepare(q)));
  ready = true;
}

// ---------------------------------------------------------------- utilidades
const enc = new TextEncoder();
const hex = (buf) => [...new Uint8Array(buf)].map((b) => b.toString(16).padStart(2, '0')).join('');
const randHex = (n) => hex(crypto.getRandomValues(new Uint8Array(n)));
const sha256 = async (s) => hex(await crypto.subtle.digest('SHA-256', enc.encode(s)));
async function hashPassword(password, saltHex) {
  const key = await crypto.subtle.importKey('raw', enc.encode(password), 'PBKDF2', false, ['deriveBits']);
  const salt = new Uint8Array(saltHex.match(/../g).map((h) => parseInt(h, 16)));
  return hex(await crypto.subtle.deriveBits({ name: 'PBKDF2', hash: 'SHA-256', salt, iterations: 100000 }, key, 256));
}
const sameText = (a, b) => { // comparación en tiempo constante
  if (a.length !== b.length) return false;
  let r = 0;
  for (let i = 0; i < a.length; i++) r |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return r === 0;
};
const emailOk = (e) => typeof e === 'string' && e.length <= 200 && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(e);
const clean = (s, max) => String(s ?? '').trim().slice(0, max);
const isAdmin = (env, email) => String(env.ADMIN_EMAILS || '').toLowerCase().split(/[,;\s]+/).filter(Boolean).includes(email.toLowerCase());
const publicUser = (env, u) => ({ id: u.id, email: u.email, name: u.name || '', isAdmin: isAdmin(env, u.email), createdAt: u.created_at });

function cors(req) {
  const o = req.headers.get('Origin') || '';
  const allow = ORIGINS.includes(o) || /^http:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/.test(o) || /\.workers\.dev$/.test(o) ? o : ORIGINS[0];
  return {
    'Access-Control-Allow-Origin': allow,
    'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    'Access-Control-Max-Age': '86400',
    Vary: 'Origin',
  };
}
const json = (req, data, status = 200) => new Response(JSON.stringify(data), {
  status, headers: { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store', ...cors(req) },
});
const fail = (req, status, error) => json(req, { error }, status);
async function body(req) {
  try { return await req.json(); } catch { return {}; }
}

async function newSession(db, userId) {
  const token = randHex(32);
  const now = Date.now();
  await db.prepare('INSERT INTO sessions (token_hash, user_id, created_at, expires_at) VALUES (?, ?, ?, ?)')
    .bind(await sha256(token), userId, now, now + SESSION_DAYS * DAY).run();
  return token;
}
async function currentUser(req, db) {
  const m = /^Bearer\s+([a-f0-9]{64})$/i.exec(req.headers.get('Authorization') || '');
  if (!m) return null;
  const row = await db.prepare(`SELECT u.*, s.token_hash AS th FROM sessions s JOIN users u ON u.id = s.user_id
    WHERE s.token_hash = ? AND s.expires_at > ?`).bind(await sha256(m[1]), Date.now()).first();
  return row || null;
}

// ---------------------------------------------------------------- correo (SMTP con TLS, p. ej. Gmail con contraseña de aplicación)
const b64u = (s) => { let bin = ''; for (const b of enc.encode(s)) bin += String.fromCharCode(b); return btoa(bin); };
const wrap76 = (s) => s.replace(/.{1,76}/g, '$&\r\n').trimEnd();
async function sendMail(env, to, subject, text, html) {
  const user = env.MAIL_USER;
  const pass = String(env.MAIL_APP_PASSWORD || '').replace(/\s+/g, '');
  if (!user || !pass) throw new Error('correo no configurado');
  const host = env.MAIL_HOST || 'smtp.gmail.com';
  const port = Number(env.MAIL_PORT || 465);
  const sock = connect({ hostname: host, port }, { secureTransport: env.MAIL_TLS === 'off' ? 'off' : 'on' });
  const w = sock.writable.getWriter();
  const r = sock.readable.getReader();
  const dec = new TextDecoder();
  let buf = '';
  const read = async () => { // una respuesta SMTP completa (las multilínea terminan en "NNN texto")
    for (;;) {
      const lines = buf.split('\r\n');
      for (let i = 0; i < lines.length - 1; i++) {
        if (/^\d{3} /.test(lines[i])) { const resp = lines.slice(0, i + 1).join('\n'); buf = lines.slice(i + 1).join('\r\n'); return resp; }
      }
      const { value, done } = await r.read();
      if (done) throw new Error('SMTP cerró la conexión');
      buf += dec.decode(value, { stream: true });
    }
  };
  const cmd = async (line, code) => {
    if (line != null) await w.write(enc.encode(`${line}\r\n`));
    const resp = await read();
    if (!resp.startsWith(String(code))) throw new Error(`SMTP: ${resp.slice(0, 200)}`);
    return resp;
  };
  try {
    await cmd(null, 220);
    await cmd('EHLO mobilabs.elbunkerservers.com', 250);
    await cmd('AUTH LOGIN', 334);
    await cmd(btoa(user), 334);
    await cmd(btoa(pass), 235);
    await cmd(`MAIL FROM:<${user}>`, 250);
    await cmd(`RCPT TO:<${to}>`, 250);
    await cmd('DATA', 354);
    const bnd = `mobilabs-${randHex(8)}`;
    const msg = [
      `From: =?UTF-8?B?${b64u('MOBILABs')}?= <${user}>`,
      `To: <${to}>`,
      `Subject: =?UTF-8?B?${b64u(subject)}?=`,
      `Date: ${new Date().toUTCString()}`,
      `Message-ID: <${randHex(12)}@mobilabs.elbunkerservers.com>`,
      'MIME-Version: 1.0',
      `Content-Type: multipart/alternative; boundary="${bnd}"`,
      '',
      `--${bnd}`, 'Content-Type: text/plain; charset=UTF-8', 'Content-Transfer-Encoding: base64', '', wrap76(b64u(text)),
      `--${bnd}`, 'Content-Type: text/html; charset=UTF-8', 'Content-Transfer-Encoding: base64', '', wrap76(b64u(html)),
      `--${bnd}--`,
    ].join('\r\n');
    await cmd(`${msg}\r\n.`, 250);
    try { await cmd('QUIT', 221); } catch { /* da igual */ }
  } finally {
    try { await w.close(); } catch { /* ya cerrado */ }
    try { sock.close(); } catch { /* ya cerrado */ }
  }
}
const SITE = 'https://mobilabs.elbunkerservers.com/';
function resetMail(link, name) {
  const hi = name ? `Hola ${name},` : 'Hola,';
  const text = `${hi}\n\nRecibimos una solicitud para cambiar la contraseña de tu cuenta de MOBILABs.\nCrea una nueva aquí (el enlace vale 1 hora):\n\n${link}\n\nSi no fuiste tú, ignora este correo: tu contraseña no cambia.\n\nMOBILABs · ${SITE}`;
  const html = `<div style="font-family:Arial,sans-serif;max-width:520px;margin:auto;color:#1b2532">
    <h2 style="margin:0 0 6px">MOBILABs</h2><p style="color:#667;margin:0 0 18px">diseña · cubica · compra · arma</p>
    <p>${hi.replace(/[<>&]/g, '')}</p><p>Recibimos una solicitud para cambiar la contraseña de tu cuenta.</p>
    <p style="margin:22px 0"><a href="${link}" style="background:#42a9e9;color:#06141f;padding:12px 22px;border-radius:6px;text-decoration:none;font-weight:bold">Crear contraseña nueva</a></p>
    <p style="font-size:13px;color:#667">El enlace vale 1 hora. Si no fuiste tú, ignora este correo: tu contraseña no cambia.</p>
    <p style="font-size:12px;color:#99a">${SITE}</p></div>`;
  return { text, html };
}

// ---------------------------------------------------------------- API
async function api(req, env, url) {
  if (req.method === 'OPTIONS') return new Response(null, { status: 204, headers: cors(req) });
  const db = env.DB;
  if (!db) return fail(req, 503, 'Las cuentas todavía no están activadas en el servidor (falta la base de datos).');
  await ensureSchema(db);
  const path = url.pathname.replace(/\/+$/, '');
  const M = req.method;

  if (path === '/api/health') return json(req, { ok: true });

  if (path === '/api/register' && M === 'POST') {
    const b = await body(req);
    const email = clean(b.email, 200).toLowerCase();
    const password = String(b.password || '');
    if (!emailOk(email)) return fail(req, 400, 'Escribe un correo válido.');
    if (password.length < 8) return fail(req, 400, 'La contraseña debe tener al menos 8 caracteres.');
    if (password.length > 200) return fail(req, 400, 'La contraseña es demasiado larga.');
    if (!b.accept) return fail(req, 400, 'Debes aceptar el aviso de privacidad para crear la cuenta.');
    const exists = await db.prepare('SELECT id FROM users WHERE email = ?').bind(email).first();
    if (exists) return fail(req, 409, 'Ya existe una cuenta con ese correo. Inicia sesión.');
    const salt = randHex(16);
    const id = crypto.randomUUID();
    const now = Date.now();
    await db.prepare('INSERT INTO users (id, email, name, pass_hash, salt, created_at, last_login, accepted_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)')
      .bind(id, email, clean(b.name, 80), await hashPassword(password, salt), salt, now, now, now).run();
    const user = await db.prepare('SELECT * FROM users WHERE id = ?').bind(id).first();
    return json(req, { token: await newSession(db, id), user: publicUser(env, user) }, 201);
  }

  if (path === '/api/login' && M === 'POST') {
    const b = await body(req);
    const email = clean(b.email, 200).toLowerCase();
    const u = emailOk(email) ? await db.prepare('SELECT * FROM users WHERE email = ?').bind(email).first() : null;
    const h = u ? await hashPassword(String(b.password || ''), u.salt) : await hashPassword('x', '00');
    if (!u || !sameText(h, u.pass_hash)) return fail(req, 401, 'Correo o contraseña incorrectos.');
    await db.prepare('UPDATE users SET last_login = ? WHERE id = ?').bind(Date.now(), u.id).run();
    await db.prepare('DELETE FROM sessions WHERE user_id = ? AND expires_at < ?').bind(u.id, Date.now()).run();
    return json(req, { token: await newSession(db, u.id), user: publicUser(env, u) });
  }

  if (path === '/api/forgot' && M === 'POST') {
    const b = await body(req);
    const email = clean(b.email, 200).toLowerCase();
    const ok = json(req, { ok: true, message: 'Si existe una cuenta con ese correo, te enviamos un enlace para crear una contraseña nueva. Revisa también la carpeta de spam.' });
    if (!emailOk(email)) return ok;
    const u = await db.prepare('SELECT * FROM users WHERE email = ?').bind(email).first();
    if (!u) return ok; // no se revela si el correo tiene cuenta
    const recent = await db.prepare('SELECT COUNT(*) AS n FROM resets WHERE user_id = ? AND created_at > ?').bind(u.id, Date.now() - 3600000).first();
    if (recent.n >= 3) return ok; // máximo 3 correos por hora
    const token = randHex(32);
    const now = Date.now();
    await db.prepare('INSERT INTO resets (token_hash, user_id, created_at, expires_at) VALUES (?, ?, ?, ?)').bind(await sha256(token), u.id, now, now + 3600000).run();
    const origin = ORIGINS.includes(req.headers.get('Origin') || '') ? req.headers.get('Origin') : new URL(SITE).origin;
    const base = origin.includes('github.io') ? `${origin}/MOBILABS/` : `${origin}/`;
    const { text, html } = resetMail(`${base}?reset=${token}`, u.name);
    try { await sendMail(env, email, 'Crea tu nueva contraseña de MOBILABs', text, html); }
    catch (e) { console.log('correo de recuperación falló:', e.message); return fail(req, 503, 'No pudimos enviar el correo en este momento. Intenta más tarde.'); }
    return ok;
  }

  if (path === '/api/reset' && M === 'POST') {
    const b = await body(req);
    const password = String(b.password || '');
    if (!/^[a-f0-9]{64}$/i.test(String(b.token || ''))) return fail(req, 400, 'El enlace no es válido.');
    if (password.length < 8) return fail(req, 400, 'La contraseña debe tener al menos 8 caracteres.');
    if (password.length > 200) return fail(req, 400, 'La contraseña es demasiado larga.');
    const th = await sha256(b.token);
    const rs = await db.prepare('SELECT * FROM resets WHERE token_hash = ?').bind(th).first();
    if (!rs || rs.used || rs.expires_at < Date.now()) return fail(req, 400, 'El enlace venció o ya se usó. Pide uno nuevo desde “¿Olvidaste tu contraseña?”.');
    const salt = randHex(16);
    await db.batch([
      db.prepare('UPDATE users SET pass_hash = ?, salt = ?, last_login = ? WHERE id = ?').bind(await hashPassword(password, salt), salt, Date.now(), rs.user_id),
      db.prepare('UPDATE resets SET used = 1 WHERE user_id = ?').bind(rs.user_id),
      db.prepare('DELETE FROM sessions WHERE user_id = ?').bind(rs.user_id), // se cierran las sesiones abiertas en otros equipos
    ]);
    const u = await db.prepare('SELECT * FROM users WHERE id = ?').bind(rs.user_id).first();
    return json(req, { token: await newSession(db, u.id), user: publicUser(env, u) });
  }

  const me = await currentUser(req, db);
  if (!me) return fail(req, 401, 'Tu sesión terminó. Vuelve a iniciar sesión.');

  if (path === '/api/logout' && M === 'POST') {
    await db.prepare('DELETE FROM sessions WHERE token_hash = ?').bind(me.th).run();
    return json(req, { ok: true });
  }
  if (path === '/api/me' && M === 'GET') return json(req, { user: publicUser(env, me) });
  if (path === '/api/me' && M === 'DELETE') {
    await db.batch([
      db.prepare('DELETE FROM designs WHERE user_id = ?').bind(me.id),
      db.prepare('DELETE FROM sessions WHERE user_id = ?').bind(me.id),
      db.prepare('DELETE FROM resets WHERE user_id = ?').bind(me.id),
      db.prepare('DELETE FROM users WHERE id = ?').bind(me.id),
    ]);
    return json(req, { ok: true });
  }

  // ---- diseños del usuario
  if (path === '/api/designs' && M === 'GET') {
    const { results } = await db.prepare('SELECT id, name, type_id, created_at, updated_at FROM designs WHERE user_id = ? ORDER BY updated_at DESC')
      .bind(me.id).all();
    return json(req, { designs: results.map((d) => ({ id: d.id, name: d.name, typeId: d.type_id, createdAt: d.created_at, updatedAt: d.updated_at })) });
  }
  if (path === '/api/designs' && M === 'POST') {
    const b = await body(req);
    const data = JSON.stringify(b.data ?? {});
    if (data.length > MAX_DESIGN_BYTES) return fail(req, 413, 'El diseño es demasiado grande para guardarlo.');
    const n = await db.prepare('SELECT COUNT(*) AS n FROM designs WHERE user_id = ?').bind(me.id).first();
    if (n.n >= MAX_DESIGNS) return fail(req, 400, `Llegaste al máximo de ${MAX_DESIGNS} diseños guardados. Borra alguno.`);
    const id = crypto.randomUUID();
    const now = Date.now();
    await db.prepare('INSERT INTO designs (id, user_id, name, type_id, data, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?)')
      .bind(id, me.id, clean(b.name, 120) || 'Sin nombre', clean(b.typeId, 40), data, now, now).run();
    return json(req, { id, updatedAt: now }, 201);
  }
  const dm = /^\/api\/designs\/([0-9a-f-]{36})$/.exec(path);
  if (dm) {
    const d = await db.prepare('SELECT * FROM designs WHERE id = ? AND user_id = ?').bind(dm[1], me.id).first();
    if (!d) return fail(req, 404, 'No encontré ese diseño.');
    if (M === 'GET') return json(req, { design: { id: d.id, name: d.name, typeId: d.type_id, data: JSON.parse(d.data), updatedAt: d.updated_at } });
    if (M === 'PUT') {
      const b = await body(req);
      const data = b.data !== undefined ? JSON.stringify(b.data) : d.data;
      if (data.length > MAX_DESIGN_BYTES) return fail(req, 413, 'El diseño es demasiado grande para guardarlo.');
      const now = Date.now();
      await db.prepare('UPDATE designs SET name = ?, type_id = ?, data = ?, updated_at = ? WHERE id = ?')
        .bind(b.name !== undefined ? clean(b.name, 120) || d.name : d.name, b.typeId !== undefined ? clean(b.typeId, 40) : d.type_id, data, now, d.id).run();
      return json(req, { id: d.id, updatedAt: now });
    }
    if (M === 'DELETE') {
      await db.prepare('DELETE FROM designs WHERE id = ?').bind(d.id).run();
      return json(req, { ok: true });
    }
  }

  // ---- panel del desarrollador
  if (path.startsWith('/api/admin/')) {
    if (!isAdmin(env, me.email)) return fail(req, 403, 'Solo para el administrador.');
    if (path === '/api/admin/stats') {
      const u = await db.prepare('SELECT COUNT(*) AS n FROM users').first();
      const d = await db.prepare('SELECT COUNT(*) AS n FROM designs').first();
      const week = await db.prepare('SELECT COUNT(*) AS n FROM users WHERE created_at > ?').bind(Date.now() - 7 * DAY).first();
      const { results: byType } = await db.prepare('SELECT type_id, COUNT(*) AS n FROM designs GROUP BY type_id ORDER BY n DESC').all();
      return json(req, { users: u.n, designs: d.n, usersLast7: week.n, byType: byType.map((r) => ({ typeId: r.type_id, n: r.n })) });
    }
    if (path === '/api/admin/users') {
      const { results } = await db.prepare(`SELECT u.id, u.email, u.name, u.created_at, u.last_login, COUNT(d.id) AS designs, MAX(d.updated_at) AS last_design
        FROM users u LEFT JOIN designs d ON d.user_id = u.id GROUP BY u.id ORDER BY u.created_at DESC LIMIT 1000`).all();
      return json(req, { users: results.map((r) => ({ id: r.id, email: r.email, name: r.name || '', createdAt: r.created_at, lastLogin: r.last_login, designs: r.designs, lastDesign: r.last_design })) });
    }
    if (path === '/api/admin/designs') {
      const uid = url.searchParams.get('user');
      const q = `SELECT d.id, d.name, d.type_id, d.created_at, d.updated_at, u.email FROM designs d JOIN users u ON u.id = d.user_id
        ${uid ? 'WHERE d.user_id = ?' : ''} ORDER BY d.updated_at DESC LIMIT 500`;
      const { results } = await (uid ? db.prepare(q).bind(uid) : db.prepare(q)).all();
      return json(req, { designs: results.map((r) => ({ id: r.id, name: r.name, typeId: r.type_id, createdAt: r.created_at, updatedAt: r.updated_at, email: r.email })) });
    }
    const am = /^\/api\/admin\/designs\/([0-9a-f-]{36})$/.exec(path);
    if (am) {
      const d = await db.prepare('SELECT d.*, u.email FROM designs d JOIN users u ON u.id = d.user_id WHERE d.id = ?').bind(am[1]).first();
      if (!d) return fail(req, 404, 'No encontré ese diseño.');
      return json(req, { design: { id: d.id, name: d.name, typeId: d.type_id, data: JSON.parse(d.data), updatedAt: d.updated_at, email: d.email } });
    }
  }
  return fail(req, 404, 'Ruta no encontrada.');
}

export default {
  async fetch(req, env) {
    const url = new URL(req.url);
    if (url.pathname.startsWith('/api/')) {
      try {
        return await api(req, env, url);
      } catch (e) {
        return fail(req, 500, 'Error del servidor. Intenta de nuevo en un momento.');
      }
    }
    return env.ASSETS.fetch(req); // la app (archivos de dist)
  },
};
