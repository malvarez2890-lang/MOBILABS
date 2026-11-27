import { FURNITURE } from './types.js';

/**
 * "¿Qué tienes en mente hoy?": interpreta un texto libre ("mesa redonda para 6", "rack de tv de 180",
 * "escritorio 140x75x60 con cajones en mdf") y propone muebles con medidas. Solo palabras clave y números.
 */
const norm = (s) => s.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '');
const TYPES = [
  ['vinilos', /vinilo|(^|\s)discos?\b|\blps?\b|vinyl/],
  ['credenza', /credenza|aparador|buffet|bufe|tocadiscos.*(receiver|equipo|amplificador)|consola de musica/],
  ['tocadiscos', /deck|tocadisco|tornamesa|turntable/],
  ['rackTv', /rack|\btv\b|televis|tele\b|mueble (de )?tv|centro de entretencion/],
  ['escritorio', /escritorio|desk|estudio|home ?office|oficina/],
  ['silla', /silla|piso\b|banqueta|taburete/],
  ['arrimo', /arrimo|consola|recibidor|pasillo|entrada|hall/],
  ['mesa', /\bmesa\b|comedor|redonda/],
  ['librero', /librero|biblioteca|libros/],
  ['estante', /estante|estanteria|repisa|zapatero|zapatos|bodega|despensa/],
];
const clampTo = (p, v) => Math.min(p.max, Math.max(p.min, Math.round(v / (p.step || 1)) * (p.step || 1)));

export function interpret(text) {
  const t = norm(text || '').trim();
  if (!t) return [];
  const matched = TYPES.filter(([, re]) => re.test(t)).map(([id]) => id);
  const ids = matched.length ? [...new Set(matched)] : [];
  const nums = [...t.matchAll(/(\d+(?:[.,]\d+)?)\s*(cm|m|mm)?/g)].map((m) => {
    let v = Number(m[1].replace(',', '.'));
    if (m[2] === 'm' || (!m[2] && v < 4)) v *= 100;
    if (m[2] === 'mm') v /= 10;
    return v;
  });
  const dimsX = /(\d+(?:[.,]\d+)?)\s*[x×*]\s*(\d+(?:[.,]\d+)?)(?:\s*[x×*]\s*(\d+(?:[.,]\d+)?))?/.exec(t);
  const people = /para\s+(\d+)|(\d+)\s*(personas|puestos|comensales)/.exec(t);
  const out = [];
  for (const id of ids.slice(0, 3)) {
    const type = FURNITURE.find((f) => f.id === id);
    const P = Object.fromEntries(type.params.map((p) => [p.key, p]));
    const v = {};
    const set = (k, val) => { if (P[k] && val != null && Number.isFinite(val)) v[k] = clampTo(P[k], val); };
    const opt = (k, val) => { if (P[k] && P[k].options?.some((o) => String(o[0]) === String(val))) v[k] = val; };
    const flag = (k, val) => { if (P[k]) v[k] = val; };
    const tags = [];
    // forma y personas
    const round = /redond|circular/.test(t);
    if (id === 'mesa') {
      if (round) { opt('forma', 'redonda'); tags.push('redonda'); }
      if (people) {
        const n = Number(people[1] || people[2]);
        if (round) set('diametro', n <= 2 ? 80 : n <= 4 ? 100 : n <= 6 ? 140 : 160);
        else set('ancho', n <= 4 ? 120 : n <= 6 ? 160 : n <= 8 ? 220 : 240);
        if (n >= 8) opt('tapa', 'doble');
        tags.push(`${n} personas`);
      }
      if (/listones|pino encolado|madera maciza/.test(t) && round) { opt('tapaHecha', 'listones'); tags.push('tapa de listones'); }
    }
    // medidas: "AxB(xC)" = ancho × alto × fondo (o largo × ancho en mesas); o un número suelto = ancho/diámetro
    if (dimsX) {
      const a = Number(dimsX[1].replace(',', '.'));
      const b = Number(dimsX[2].replace(',', '.'));
      const c = dimsX[3] ? Number(dimsX[3].replace(',', '.')) : null;
      if (id === 'mesa') { set('ancho', a); set('fondo', b); if (c) set('alto', c); } else if (id === 'vinilos') { /* por celdas */ } else { set('ancho', a); if (c) { set('alto', b); set('fondo', c); } else if (P.alto && b > 60) set('alto', b); else set('fondo', b); }
    } else if (nums.length && !people) {
      const n = nums.find((x) => x >= 30) ?? null;
      if (n != null) { if (id === 'mesa' && round) set('diametro', n); else if (id === 'vinilos') { /* nada */ } else set('ancho', n); }
    }
    // material
    if (/\bmdf\b/.test(t)) opt('mat', /15/.test(t) ? 'mdf15' : 'mdf18');
    else if (/terciado|plywood|contrachapado/.test(t)) opt('mat', /15/.test(t) ? 'ter15' : 'ter18');
    else if (/melamina/.test(t)) opt('mat', /15/.test(t) ? 'mel15' : 'mel18');
    if (v.mat) tags.push(v.mat.startsWith('mdf') ? 'MDF' : v.mat.startsWith('ter') ? 'terciado' : 'melamina');
    // patas y base
    const legs = /conic|afinad/.test(t) ? 'afinada' : /diagonal|inclinad|nordic|escandinav/.test(t) ? 'inclinada' : /industrial|acero|metal|fierro/.test(t) ? (P.pataEstilo?.options.some((o) => o[0] === 'aceroU') ? 'aceroU' : 'aceroDiagonal') : /redondas?\s+patas|patas\s+redondas/.test(t) ? 'redonda' : null;
    if (legs) { if (P.estilo && id === 'escritorio') opt('estilo', 'patas'); if (P.base && legs !== 'aceroU') opt('base', 'patas'); opt('pataEstilo', legs); tags.push(`patas ${({ afinada: 'cónicas', inclinada: 'en diagonal', aceroU: 'de acero', aceroDiagonal: 'de acero', redonda: 'redondas' })[legs]}`); }
    if (/ruedas|rueditas/.test(t)) { if (P.base) opt('base', 'ruedas'); else flag('ruedas', true); tags.push('con ruedas'); }
    if (/zocalo/.test(t)) { opt('base', 'zocalo'); tags.push('zócalo'); }
    // extras
    if (id === 'escritorio' && /cajon|cajonera/.test(t)) { opt('estilo', 'paneles'); opt('cajonera', /derecha/.test(t) ? 'der' : /ambos|dos lados/.test(t) ? 'ambos' : 'izq'); tags.push('con cajonera'); }
    if (/puertas?/.test(t) && !/sin puertas/.test(t)) {
      if (P.puertas?.type === 'bool') flag('puertas', true);
      else if (P.puertas?.type === 'sel') opt('puertas', P.puertas.options.some((o) => o[0] === 'todas') ? 'todas' : P.puertas.options[1]?.[0]);
      else if (P.puertasEn) opt('puertasEn', 'todas');
      tags.push('con puertas');
    }
    if (/sin puertas|abiert/.test(t)) { if (P.puertas?.type === 'bool') flag('puertas', false); if (P.puertasEn) opt('puertasEn', 'ninguna'); }
    const dims = [v.ancho && `${v.ancho} cm`, v.diametro && `Ø${v.diametro} cm`].filter(Boolean);
    out.push({ typeId: id, values: v, label: type.name, detail: [...dims, ...tags].join(' · ') || 'medidas estándar' });
  }
  return out;
}
