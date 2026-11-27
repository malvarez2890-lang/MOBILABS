/** Cliente de la API de cuentas y diseños (servidor de Cloudflare). */
const MAIN = 'https://mobilabs.elbunkerservers.com';
// desde la copia de GitHub Pages se usa el servidor de Cloudflare; en el propio dominio, la misma dirección
export const API = typeof location !== 'undefined' && location.hostname.endsWith('github.io') ? MAIN : '';
const KEY = 'mobilabs-token';

export const getToken = () => { try { return localStorage.getItem(KEY) || ''; } catch { return ''; } };
export const setToken = (t) => { try { if (t) localStorage.setItem(KEY, t); else localStorage.removeItem(KEY); } catch { /* sin almacenamiento */ } };

export async function api(path, { method = 'GET', body } = {}) {
  const token = getToken();
  let res;
  try {
    res = await fetch(`${API}/api${path}`, {
      method,
      headers: { ...(body !== undefined ? { 'Content-Type': 'application/json' } : {}), ...(token ? { Authorization: `Bearer ${token}` } : {}) },
      body: body !== undefined ? JSON.stringify(body) : undefined,
    });
  } catch {
    throw Object.assign(new Error('No hay conexión con el servidor de cuentas. Revisa tu internet (o si tu red bloquea mobilabs.elbunkerservers.com).'), { status: 0 });
  }
  let data = {};
  try { data = await res.json(); } catch { /* respuesta sin JSON */ }
  if (!res.ok) {
    if (res.status === 401 && token && !/^\/(login|register)$/.test(path)) setToken('');
    const fallback = res.status === 404 ? 'Las cuentas todavía no están disponibles en esta versión.' : 'Algo falló en el servidor.';
    throw Object.assign(new Error(data.error || fallback), { status: res.status });
  }
  return data;
}

export const fmtDate = (ms) => (ms ? new Date(ms).toLocaleString('es-CL', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' }) : '—');
