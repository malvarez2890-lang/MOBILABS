import React from 'react';
import { createRoot } from 'react-dom/client';
import App from './App.jsx';
import './styles.css';
import { api, getToken } from './lib/account.js';

createRoot(document.getElementById('root')).render(<App />);

// Pantalla de carga: cuando la barra se llena, se entra con la cuenta (o se saluda si ya hay sesión) o sin cuenta.
const boot = document.getElementById('boot');
if (boot) {
  const go = document.getElementById('bootgo');
  const guest = document.getElementById('bootguest');
  const note = document.getElementById('bootnote');
  let mode = 'account';
  const enter = (m) => {
    boot.classList.add('out');
    setTimeout(() => boot.remove(), 700);
    window.removeEventListener('keydown', onKey);
    window.__mobilabsEnter = m;
    window.dispatchEvent(new CustomEvent('mobilabs-enter', { detail: { mode: m } }));
  };
  const onKey = (e) => { if (e.key === 'Enter' && go.classList.contains('ready')) enter(mode); };
  const ready = async () => {
    const bar = boot.querySelector('.bbar i');
    if (bar) bar.style.transform = 'scaleX(1)';
    // con sesión abierta: saludo y entrada directa
    let who = null;
    if (getToken()) {
      try { who = (await Promise.race([api('/me'), new Promise((_, rej) => setTimeout(() => rej(new Error('lento')), 3500))])).user; } catch { who = null; }
    }
    go.disabled = false;
    go.classList.add('ready');
    if (who) {
      mode = 'user';
      go.textContent = `Hola, ${(who.name || who.email.split('@')[0]).split(' ')[0]} · Listo para cortar →`;
    } else {
      mode = 'account';
      go.textContent = 'Entrar con mi cuenta';
      guest.hidden = false;
      note.hidden = false;
    }
    go.focus();
  };
  if (window.__bootDone) ready();
  else window.addEventListener('mobilabs-bar', ready, { once: true });
  go.addEventListener('click', () => enter(mode));
  guest.addEventListener('click', () => enter('guest'));
  window.addEventListener('keydown', onKey);
}

// Evita "volver a la página anterior" por accidente (gestos del mouse con botón derecho, deslizar con dos dedos):
// se deja una entrada propia en el historial y se vuelve a poner cada vez que el navegador intenta retroceder.
try {
  history.pushState({ mobilabs: true }, '', location.href);
  window.addEventListener('popstate', () => history.pushState({ mobilabs: true }, '', location.href));
} catch { /* sin historial */ }
// Deslizar en horizontal sobre el visor no debe navegar.
window.addEventListener('wheel', (e) => { if (Math.abs(e.deltaX) > Math.abs(e.deltaY) && e.target.closest?.('.center')) e.preventDefault(); }, { passive: false });

// La copia de GitHub Pages es un respaldo: si la página de Cloudflare está disponible, se abre esa
// (así los documentos impresos y los enlaces llevan siempre https://mobilabs.elbunkerservers.com).
// Si la red la bloquea, la prueba falla y se queda en GitHub.
try {
  const MAIN = 'mobilabs.elbunkerservers.com';
  if (location.hostname.endsWith('github.io') && !sessionStorage.getItem('mobilabs-no-redirect')) {
    const probe = new Image();
    const timer = setTimeout(() => { probe.onload = probe.onerror = null; }, 4000);
    probe.onload = () => { clearTimeout(timer); location.replace(`https://${MAIN}/${location.search}${location.hash}`); };
    probe.onerror = () => { clearTimeout(timer); try { sessionStorage.setItem('mobilabs-no-redirect', '1'); } catch { /* sin almacenamiento */ } };
    probe.src = `https://${MAIN}/icon-192.png?probe=${Date.now()}`;
  }
} catch { /* sin redirección */ }
