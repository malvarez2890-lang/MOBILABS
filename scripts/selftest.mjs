// Autotest: geometría sin choques, espesores correctos y cubicación completa.
import { buildDrawing, techSpec } from '../src/lib/plans.js';
import { buildManual } from '../src/lib/manual.js';
import assert from 'node:assert/strict';
import { FURNITURE, buildFurniture, defaultsFor } from '../src/lib/types.js';
import { SHEETS, LINEARS } from '../src/lib/materials.js';
import { packAll } from '../src/lib/packing.js';
import { buildShopping } from '../src/lib/shopping.js';
import { priceShop } from '../src/lib/pricing.js';

let seed = 42;
const rnd = () => ((seed = (seed * 1664525 + 1013904223) % 4294967296) / 4294967296);

function randomValues(type) {
  const v = defaultsFor(type);
  for (const p of type.params) {
    if (p.type === 'num') v[p.key] = Math.round(p.min + rnd() * (p.max - p.min));
    else if (p.type === 'sel') v[p.key] = p.options[Math.floor(rnd() * p.options.length)][0];
    else v[p.key] = rnd() > 0.5;
  }
  return v;
}

function check(label, typeId, values) {
  const m = buildFurniture(typeId, values);
  assert.equal(m.error, null, `${label}: error ${m.error}`);
  assert.ok(m.parts.length > 0, `${label}: sin piezas`);
  for (const p of m.parts) {
    assert.ok(p.size.every((s) => s > 0 && Number.isFinite(s)), `${label}: tamaño inválido ${p.name} ${p.size}`);
    assert.ok(p.min.every(Number.isFinite), `${label}: posición NaN ${p.name}`);
    if (p.kind === 'sheet') {
      const t = SHEETS[p.mat].t;
      assert.ok(p.size.some((s) => Math.abs(s - t) < 0.06), `${label}: ${p.name} sin espesor ${t}: ${p.size}`);
    } else {
      const [a, b] = LINEARS[p.mat].section;
      const rest = [...p.size];
      rest.splice(rest.findIndex((s) => Math.abs(s - p.cut.l) < 0.06), 1);
      assert.ok(
        (Math.abs(rest[0] - a) < 0.06 && Math.abs(rest[1] - b) < 0.06) || (Math.abs(rest[0] - b) < 0.06 && Math.abs(rest[1] - a) < 0.06),
        `${label}: ${p.name} sección incorrecta ${p.size}`,
      );
    }
  }
  // choques entre piezas (se permite tocar)
  const eps = 0.3;
  for (let i = 0; i < m.parts.length; i++) {
    for (let j = i + 1; j < m.parts.length; j++) {
      const a = m.parts[i], b = m.parts[j];
      if (a.rot || b.rot) continue; // piezas inclinadas (patas en diagonal): su caja girada se revisa aparte
      const hit = [0, 1, 2].every((k) => a.min[k] + eps < b.min[k] + b.size[k] && b.min[k] + eps < a.min[k] + a.size[k]);
      assert.ok(!hit, `${label}: choque entre ${a.name} ${a.min}/${a.size} y ${b.name} ${b.min}/${b.size}`);
    }
  }
  // piezas flotantes: cada pieza debe tocar al menos a otra
  for (const a of m.parts.filter((x) => x.name !== 'Puerta' && !x.rot)) { // las puertas llevan 1,5 mm de holgura a propósito
    const near = (b) => [0, 1, 2].every((k) => a.min[k] <= b.min[k] + b.size[k] + eps && b.min[k] <= a.min[k] + a.size[k] + eps);
    const touches = m.parts.some((b) => b !== a && near(b)) || m.fixtures.some((f) => !f.noBbox && near(f.aabb || f)); // también apoya en acero o ruedas
    assert.ok(touches, `${label}: pieza flotante ${a.name} ${a.min}`);
  }
  // fixtures (tiradores, ruedas, patas metálicas): datos válidos y sin choques con las piezas
  for (const f of m.fixtures) {
    assert.ok([...f.min, ...f.size].every(Number.isFinite) && f.size.every((s) => s > 0), `${label}: fixture inválido ${f.kind}`);
    for (const a of m.parts) {
      if (f.parent === a.id || f.rot || a.rot) continue; // el tirador apoya sobre su puerta; lo inclinado se omite
      const hit = [0, 1, 2].every((k) => f.min[k] + eps < a.min[k] + a.size[k] && a.min[k] + eps < f.min[k] + f.size[k]);
      assert.ok(!hit, `${label}: ${f.kind} choca con ${a.name}`);
    }
    if (f.kind === 'handle') {
      const door = m.parts.find((x) => x.id === f.parent);
      assert.ok(door && ['Puerta', 'Frente de cajón'].includes(door.name), `${label}: tirador sin puerta ni frente de cajón`);
      if (f.fits) {
        const inside = [0, 1].every((k) => f.min[k] >= door.min[k] - 0.1 && f.min[k] + f.size[k] <= door.min[k] + door.size[k] + 0.1);
        assert.ok(inside, `${label}: tirador fuera de la puerta`);
      }
    }
  }
  // cubicación
  const plans = packAll(m.parts, { kerf: 3, rotate: false });
  const shop = buildShopping(m, plans);
  // planos, ficha técnica y manual: se generan sin errores y con contenido
  const dr = buildDrawing(m);
  assert.ok(Number.isFinite(dr.s) && dr.s > 0 && dr.views.length === 6 && dr.views.every((v) => v.polys.length > 0), `${label}: planimetría inválida`);
  assert.ok(techSpec(m, plans, shop, FURNITURE.find((f) => f.id === typeId), values).length >= 6, `${label}: ficha técnica incompleta`);
  const man = buildManual(m, plans, shop);
  assert.ok(man.stepCount >= 8 && man.sections.every((x) => x.steps.every((t) => typeof t === 'string' && !/undefined|\[object/.test(t))), `${label}: manual inválido`);
  // costos: toda línea tiene precio de ejemplo y ninguno es absurdo (p. ej. un tornillo valorado como corredera)
  const priced = priceShop(shop, {});
  assert.equal(priced.missing, 0, `${label}: líneas sin precio: ${priced.groups.flatMap((g) => g.rows.filter((r) => r.missing).map((r) => r.label)).join(', ')}`);
  for (const g of priced.groups) for (const r of g.rows) {
    assert.ok(Number.isFinite(r.subtotal) && r.subtotal >= 0, `${label}: subtotal inválido en ${r.label}`);
    if (/^tornillo|^tarugo|^tapa cubre|confirmat/i.test(r.label)) assert.ok(r.unit <= 200, `${label}: precio absurdo para ${r.label}: ${r.unit}`);
  }
  for (const sp of plans.sheetPlans) {
    for (const s of sp.sheets) {
      for (const pl of s.placements) {
        assert.ok(pl.x >= -1e-6 && pl.y >= -1e-6 && pl.x + pl.w <= sp.W + 1e-6 && pl.y + pl.h <= sp.H + 1e-6, `${label}: pieza fuera de plancha`);
      }
      for (let i = 0; i < s.placements.length; i++) {
        for (let j = i + 1; j < s.placements.length; j++) {
          const a = s.placements[i], b = s.placements[j];
          const hit = a.x + 1e-6 < b.x + b.w && b.x + 1e-6 < a.x + a.w && a.y + 1e-6 < b.y + b.h && b.y + 1e-6 < a.y + a.h;
          assert.ok(!hit, `${label}: piezas superpuestas en plancha`);
        }
      }
    }
    const placed = sp.sheets.reduce((a, s) => a + s.placements.length, 0);
    const total = plans.groups.filter((g) => g.mat === sp.mat).reduce((a, g) => a + g.qty, 0);
    assert.equal(placed + sp.unplaced.length, total, `${label}: piezas perdidas en cubicación`);
  }
  if (shop.issues.length) { withIssues++; assert.ok(typeId === 'vinilos' || (typeId === 'mesa' && values.forma === 'redonda'), `${label}: pieza que no cabe en un caso no previsto: ${shop.issues[0]}`);  }
  return { m, plans, shop };
}

let runs = 0;
let withIssues = 0;
for (const type of FURNITURE) {
  const base = check(`${type.name} (defecto)`, type.id, {});
  for (const style of ['afinada', 'redonda', 'redondaAfinada', 'metalica', 'ruedas']) {
    for (const size of ['fino', 'grueso']) { check(`${type.name} patas ${style}/${size}`, type.id, { base: 'patas', pataEstilo: style, pata: size }); runs++; }
  }
  if (type.params.some((p) => p.key === 'ruedaTam')) { // ruedas: como base (muebles de cajón) o bajo las patas (mesas)
    for (const size of ['fino', 'grueso']) {
      const vals = type.params.some((p) => p.key === 'base') ? { base: 'ruedas', ruedaTam: size } : { ruedas: true, ruedaTam: size, estilo: 'patas' };
      const r = check(`${type.name} ruedas ${size}`, type.id, vals); runs++;
      assert.equal(r.m.fixtures.filter((f) => f.kind === 'caster').length, 4, `${type.name}: debe tener 4 ruedas (${size})`);
    }
  }
  if (type.params.some((p) => p.key === 'cajonera')) {
    for (const cajonera of ['izq', 'der', 'ambos']) for (const cajones of [1, 3, 5]) { check(`${type.name} cajonera ${cajonera} x${cajones}`, type.id, { cajonera, cajones, ancho: 160, fondo: 70 }); runs++; }
  }
  if (type.params.some((p) => p.key === 'tirador')) {
    for (const tirador of ['barra', 'perilla', 'canto', 'ninguno']) {
      for (const bisagra of ['auto', 'izq', 'der']) { check(`${type.name} tirador ${tirador}/${bisagra}`, type.id, { puertas: true, tirador, bisagra, tiradorOrient: 'horizontal' }); runs++; }
    }
  }
  runs++;
  for (const pr of type.presets) { check(`${type.name} / ${pr.name}`, type.id, pr.values); runs++; }
  for (let i = 0; i < 60; i++) {
    const v = randomValues(type);
    check(`${type.name} aleatorio ${JSON.stringify(v)}`, type.id, v);
    runs++;
  }
  const { m, plans, shop } = base;
  const dims = m.bbox.dims.map((d) => Math.round(d / 10)).join(' × ');
  const sheets = shop.sheets.map((s) => `${s.count}× ${s.id}`).join(', ');
  const bars = shop.bars.map((s) => `${s.count}× ${s.id}`).join(', ') || '—';
  console.log(`✔ ${type.name.padEnd(22)} ${dims.padEnd(14)} ${String(m.parts.length).padStart(3)} piezas | planchas: ${sheets} | listones: ${bars}`);
}
assert.equal(check('vinilos 6x6', 'vinilos', { columnas: 6, filas: 6, anchoCelda: 34 }).shop.issues.length, 0, 'vinilos grande debe cubicar');
console.log(`\n${withIssues} configuraciones extremas de vinilos superan el tamaño de plancha (la app las avisa en rojo).`);
console.log(`${runs} configuraciones verificadas sin choques ni errores.`);
