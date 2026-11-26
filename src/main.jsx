import React from 'react';
import { createRoot } from 'react-dom/client';
import App from './App.jsx';
import './styles.css';

createRoot(document.getElementById('root')).render(<App />);

// La pantalla de carga espera a que el usuario entre con el botón (después de ver la animación y cuando la app ya cargó).
const boot = document.getElementById('boot');
if (boot) {
  const go = document.getElementById('bootgo');
  const enter = () => {
    boot.classList.add('out');
    setTimeout(() => boot.remove(), 700);
    window.removeEventListener('keydown', onKey);
    window.dispatchEvent(new Event('mobilabs-enter'));
  };
  const onKey = (e) => { if (e.key === 'Enter' && go.classList.contains('ready')) enter(); };
  // el botón se habilita cuando la barra terminó de llenarse (la animación corre aparte, aunque la carga ocupe el hilo principal)
  const barAnim = boot.querySelector('.bar i')?.getAnimations?.()[0];
  const ready = () => {
    go.disabled = false;
    go.textContent = 'Listo para cortar →';
    go.classList.add('ready');
    go.focus();
  };
  if (barAnim) barAnim.finished.then(ready, ready);
  else setTimeout(ready, 2400);
  go.addEventListener('click', enter);
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
