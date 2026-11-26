import React from 'react';
import { createRoot } from 'react-dom/client';
import App from './App.jsx';
import './styles.css';

createRoot(document.getElementById('root')).render(<App />);

// Evita "volver a la página anterior" por accidente (gestos del mouse con botón derecho, deslizar con dos dedos):
// se deja una entrada propia en el historial y se vuelve a poner cada vez que el navegador intenta retroceder.
try {
  history.pushState({ mobilabs: true }, '', location.href);
  window.addEventListener('popstate', () => history.pushState({ mobilabs: true }, '', location.href));
} catch { /* sin historial */ }
// Deslizar en horizontal sobre el visor no debe navegar.
window.addEventListener('wheel', (e) => { if (Math.abs(e.deltaX) > Math.abs(e.deltaY) && e.target.closest?.('.center')) e.preventDefault(); }, { passive: false });
