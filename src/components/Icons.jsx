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

export function Icon({ id, size = 26 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      {P[id] || P.estante}
    </svg>
  );
}
