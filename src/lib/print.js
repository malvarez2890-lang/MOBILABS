export const SITE_URL = 'https://mobilabs.elbunkerservers.com/';

/** Imprime (o guarda como PDF) un fragmento de la página en una hoja blanca, sin depender del resto de la interfaz. */
export function printHtml(title, html, landscape = false) {
  const f = document.createElement('iframe');
  f.setAttribute('aria-hidden', 'true');
  Object.assign(f.style, { position: 'fixed', right: '0', bottom: '0', width: '0', height: '0', border: '0' });
  document.body.appendChild(f);
  const d = f.contentDocument;
  d.open();
  d.write(`<!doctype html><html lang="es"><head><meta charset="utf-8"><title>${title}</title><style>
    @page { size: A4 ${landscape ? 'landscape' : 'portrait'}; margin: 10mm; }
    * { box-sizing: border-box; }
    body { font: 12px/1.45 system-ui, sans-serif; color: #111; background: #fff; margin: 0; }
    h1 { font-size: 20px; margin: 0 0 2px; } h3 { font-size: 16px; margin: 0 0 6px; } .muted { color: #555; font-size: 11px; }
    .sec-head { display: flex; gap: 12px; align-items: baseline; } .btn, .mini, .plan-close { display: none !important; }
    .plan-svg { width: 100%; height: auto; display: block; border: 1px solid #999; }
    .doc-h { margin: 14px 0 6px; font-size: 13px; color: #075b8d; text-transform: uppercase; letter-spacing: .04em; break-after: avoid; }
    table.spec { width: 100%; border-collapse: collapse; } table.spec th { text-align: left; width: 32%; vertical-align: top; padding: 4px 8px 4px 0; border-bottom: 1px solid #ccc; color: #333; }
    table.spec td { padding: 4px 0; border-bottom: 1px solid #ccc; }
    tr, li { break-inside: avoid; } ol { padding-left: 22px; margin: 0 0 6px; } li { margin: 0 0 6px; }
    .page-break { break-before: page; }
    .buy th.r, .buy td.r { text-align: right; white-space: nowrap; } .buy thead th { border-bottom: 2px solid #333; font-size: 11px; color: #333; } .buy tr.sub td { background: #f1f3f5; border-bottom: 0; }
    .total { margin-top: 14px; font-size: 16px; text-align: right; border-top: 2px solid #333; padding-top: 8px; }
    .chip-l { display: inline-block; min-width: 22px; padding: 1px 5px; text-align: center; border: 1px solid #555; border-radius: 3px; font-weight: 700; }
    .step-img { display: block; width: 62%; max-width: 420px; margin: 6px 0 4px; border: 1px solid #bbb; }
  </style></head><body><h1>${title}</h1>${html}<p class="muted" style="margin-top:14px">Hecho con MOBILABs · ${SITE_URL}</p></body></html>`);
  d.close();
  const go = () => { try { f.contentWindow.focus(); f.contentWindow.print(); } finally { setTimeout(() => f.remove(), 2000); } };
  setTimeout(go, 250);
}

