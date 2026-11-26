import React from 'react';

const P = {
  estante: <><rect x="5" y="3" width="14" height="18" /><path d="M5 9h14M5 15h14" /></>,
  librero: <><rect x="4" y="3" width="16" height="18" /><path d="M12 3v18M4 9h16M4 15h16" /></>,
  mesa: <><rect x="3" y="7" width="18" height="3" /><path d="M5 10v10M19 10v10M9 10v3M15 10v3" /></>,
  arrimo: <><rect x="3" y="6" width="18" height="2" /><path d="M5 8v12M19 8v12M5 15h14" /></>,
  escritorio: <><rect x="2" y="7" width="20" height="2" /><path d="M4 9v11M20 9v11M9 9v5h6V9" /></>,
  silla: <><path d="M7 3h10M7 3v10M17 3v10M7 7h10M5 13h14M7 13v8M17 13v8" /></>,
  rackTv: <><rect x="2" y="8" width="20" height="8" /><path d="M9 8v8M15 8v8M4 16v4M20 16v4" /></>,
  tocadiscos: <><rect x="3" y="13" width="18" height="7" /><rect x="5" y="5" width="12" height="8" /><circle cx="9.5" cy="9" r="2.2" /><path d="M14 6.5l2 3" /></>,
  vinilos: <><rect x="3" y="3" width="18" height="18" /><path d="M9 3v18M15 3v18M3 9h18M3 15h18" /></>,
};

const NAV = {
  diseno: <><path d="M4 7h10M18 7h2M4 17h2M10 17h10" /><circle cx="16" cy="7" r="2" /><circle cx="8" cy="17" r="2" /></>,
  piezas: <><path d="M9 6h11M9 12h11M9 18h11" /><circle cx="4.5" cy="6" r="1" /><circle cx="4.5" cy="12" r="1" /><circle cx="4.5" cy="18" r="1" /></>,
  cortes: <><rect x="3" y="4" width="18" height="16" /><path d="M3 11h11M14 4v16M14 14h7" /></>,
  planos: <><rect x="3" y="4" width="18" height="16" /><path d="M3 9h18M9 9v11M13 14h5" /></>,
  manual: <><path d="M5 4h10l4 4v12H5z" /><path d="M15 4v4h4M8 12h8M8 16h6" /></>,
  compras: <><path d="M3 4h2.5l2 11h10l2-8H7" /><circle cx="9" cy="19" r="1.4" /><circle cx="17" cy="19" r="1.4" /></>,
};

export function NavIcon({ id, size = 22 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      {NAV[id]}
    </svg>
  );
}

export function Icon({ id, size = 26 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      {P[id] || P.estante}
    </svg>
  );
}
