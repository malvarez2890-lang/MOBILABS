import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';

// Todo en cm (el visor trabaja en cm; el modelo, en mm). Las geometrías quedan centradas en su caja.

/** Geometría de una pieza. Cajas por defecto; patas con forma (afinadas / redondas / con cabeza cuadrada). */
export function partGeometry(p) {
  const [sx, sy, sz] = p.size.map((v) => v / 10);
  if (p.shape === 'disc') return new THREE.CylinderGeometry(sx / 2, sx / 2, sy, 96);
  if (!p.shape || p.shape === 'box') return new THREE.BoxGeometry(sx, sy, sz);

  const h = sy;
  const s = sx;
  const head = Math.min((p.head || 0) / 10, h * 0.6);
  const taper = p.shape === 'taperBox' || p.shape === 'taperRound' ? p.taper || 0.55 : 1;
  const round = p.shape === 'round' || p.shape === 'taperRound';
  const bodyH = h - head;
  const pieces = [];

  let body;
  if (round) {
    body = new THREE.CylinderGeometry(s / 2, (s / 2) * taper, bodyH, 32);
  } else {
    // cilindro de 4 lados girado 45° = tronco de pirámide cuadrado
    body = new THREE.CylinderGeometry(s / Math.SQRT2, (s / Math.SQRT2) * taper, bodyH, 4);
    body.rotateY(Math.PI / 4);
  }
  body.translate(0, -h / 2 + bodyH / 2, 0);
  pieces.push(body);
  if (head > 0) {
    const box = new THREE.BoxGeometry(s, head, s);
    box.translate(0, h / 2 - head / 2, 0);
    pieces.push(box);
  }
  // topes cuadrados intermedios (donde se unen faldones o marcos): [desde, hasta] medidos desde el pie, en mm
  for (const [y0, y1] of p.blocks || []) {
    const bh = (y1 - y0) / 10;
    const box = new THREE.BoxGeometry(s, bh, s);
    box.translate(0, -h / 2 + y0 / 10 + bh / 2, 0);
    pieces.push(box);
  }
  return pieces.length === 1 ? pieces[0] : mergeGeometries(pieces, false);
}

const cyl = (r, len, segs = 16) => new THREE.CylinderGeometry(r, r, len, segs);

/** Geometría y color de un elemento comprado (tirador, rueda, pata metálica). */
export function fixtureGeometry(f) {
  const [sx, sy, sz] = f.size.map((v) => v / 10);
  if (f.kind === 'productLeg') return { geo: partGeometry({ size: f.size, shape: f.shape, taper: f.taper }), color: '#b98a55', metal: 0 };
  if (f.kind === 'metalLeg') return { geo: new THREE.BoxGeometry(sx, sy, sz), color: '#2f3237', metal: 0.6 };

  if (f.kind === 'caster') {
    const plate = new THREE.BoxGeometry(sx, 0.5, sz);
    plate.translate(0, sy / 2 - 0.25, 0);
    const wr = f.wheelD / 20;
    const wheelY = -sy / 2 + wr;
    const wheel = cyl(wr, 2.4, 24);
    wheel.rotateZ(Math.PI / 2);
    wheel.translate(0, wheelY, 0);
    const forkH = sy / 2 - 0.5 - wheelY;
    const mk = (x) => {
      const g = new THREE.BoxGeometry(0.4, forkH, 1.1);
      g.translate(x, wheelY + forkH / 2, 0);
      return g;
    };
    return { geo: mergeGeometries([plate, wheel, mk(1.5), mk(-1.5)], false), color: '#3a3d42', metal: 0.5 };
  }

  // tiradores: el origen es el centro de la caja; la cara de la puerta está en z = -sz/2
  const zFace = -sz / 2;
  if (f.type === 'canto') return { geo: new THREE.BoxGeometry(sx, sy, sz), color: '#b9bec5', metal: 0.7 };

  if (f.type === 'perilla') {
    const stem = cyl(0.4, 1.2);
    stem.rotateX(Math.PI / 2);
    stem.translate(0, 0, zFace + 0.6);
    const knob = cyl(1.5, 1.2, 28);
    knob.rotateX(Math.PI / 2);
    knob.translate(0, 0, zFace + 1.2 + 0.6);
    return { geo: mergeGeometries([stem, knob], false), color: '#aeb3ba', metal: 0.7 };
  }

  // barra: dos soportes hacia la puerta y una barra al frente
  const vertical = f.orient === 'vertical';
  const L = (f.c2c + 24) / 10;
  const barZ = zFace + 1.9;
  const bar = cyl(0.5, L);
  if (!vertical) bar.rotateZ(Math.PI / 2);
  bar.translate(0, 0, barZ);
  const posts = [-1, 1].map((k) => {
    const g = cyl(0.33, 1.9);
    g.rotateX(Math.PI / 2);
    const off = (k * f.c2c) / 20;
    g.translate(vertical ? 0 : off, vertical ? off : 0, zFace + 0.95);
    return g;
  });
  return { geo: mergeGeometries([bar, ...posts], false), color: '#aeb3ba', metal: 0.7 };
}

/**
 * Coordenadas de textura en centímetros reales (la veta no se estira en tableros largos).
 * La veta corre por el lado más largo de cada cara. `seed` desfasa la textura entre piezas.
 */
export function applyWorldUV(geo, sizeMm, tileCm = 60, seed = 0) {
  const pos = geo.attributes.position;
  const nor = geo.attributes.normal;
  if (!pos || !nor) return;
  const sz = sizeMm.map((v) => v / 10);
  const ox = ((seed * 37) % 100) / 100;
  const oy = ((seed * 91) % 100) / 100;
  const uv = new Float32Array(pos.count * 2);
  for (let i = 0; i < pos.count; i++) {
    const n = [Math.abs(nor.getX(i)), Math.abs(nor.getY(i)), Math.abs(nor.getZ(i))];
    const d = n[0] >= n[1] && n[0] >= n[2] ? 0 : n[1] >= n[2] ? 1 : 2;
    const [a, b] = d === 0 ? [1, 2] : d === 1 ? [0, 2] : [0, 1];
    const [ua, va] = sz[a] >= sz[b] ? [a, b] : [b, a];
    const p = [pos.getX(i), pos.getY(i), pos.getZ(i)];
    uv[i * 2] = p[ua] / tileCm + ox;
    uv[i * 2 + 1] = p[va] / tileCm + oy;
  }
  geo.setAttribute('uv', new THREE.BufferAttribute(uv, 2));
}
