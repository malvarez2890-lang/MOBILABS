import React, { useEffect, useRef } from 'react';
import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { materialOf } from '../lib/materials.js';
import { partGeometry, fixtureGeometry, applyWorldUV } from './geometry.js';
import { getTexture } from './textures.js';
import CURSOR_MOVE from '../assets/cursor-move.png';
import CURSOR_MOVE_2X from '../assets/cursor-move@2x.png';
import CURSOR_ROTATE from '../assets/cursor-rotate.png';
import CURSOR_ROTATE_2X from '../assets/cursor-rotate@2x.png';

// Cursor con imagen de 1x y 2x (nítido en pantallas de alta densidad); si el navegador no admite image-set, usa la de 1x.
const imageCursor = (x1, x2, fallback) => {
  const set = `image-set(url("${x1}") 1x, url("${x2}") 2x) 16 16, ${fallback}`;
  if (typeof CSS !== 'undefined' && CSS.supports) {
    if (CSS.supports('cursor', set)) return set;
    if (CSS.supports('cursor', `-webkit-${set}`)) return `-webkit-${set}`;
  }
  return `url("${x1}") 16 16, ${fallback}`;
};
// Estados internos de OrbitControls
const ORBIT_ROTATE = 0;
const ORBIT_PAN = 2;

const VIEWS = {
  iso: [0.62, 0.42, 0.85],
  front: [0, 0.05, 1],
  side: [1, 0.05, 0],
  top: [0, 1, 0.001],
};

function tint(hex, seed) {
  const c = new THREE.Color(hex);
  const hsl = {};
  c.getHSL(hsl);
  const j = ((seed * 9301 + 49297) % 233280) / 233280 - 0.5;
  c.setHSL(hsl.h, hsl.s, Math.min(0.9, Math.max(0.2, hsl.l + j * 0.05)));
  return c;
}

export default function Viewer3D({ parts, fixtures = [], bbox, explode, highlight, viewKey, viewCmd, looks, hiddenIds, multi, onPick, onBox, onContext, apiRef }) {
  const mount = useRef(null);
  const S = useRef({}); // objetos three.js
  const latest = useRef({});
  latest.current = { parts, fixtures, bbox, explode, highlight, looks, hiddenIds, multi, onPick, onBox, onContext };

  // ---- inicialización ----
  useEffect(() => {
    const el = mount.current;
    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    el.appendChild(renderer.domElement);
    // el tamaño CSS lo manda el contenedor; setSize(..., false) solo ajusta los píxeles internos (clave en pantallas HiDPI)
    Object.assign(renderer.domElement.style, { display: 'block', width: '100%', height: '100%' });

    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(32, 1, 1, 6000);
    const controls = new OrbitControls(camera, renderer.domElement);
    controls.enableDamping = true;
    controls.dampingFactor = 0.08;
    controls.maxPolarAngle = Math.PI / 2 - 0.01;
    controls.minDistance = 20;
    // Rueda (clic del medio) = desplazar; Mayús/Ctrl + rueda = girar. Izquierdo = seleccionar; derecho = menú.
    controls.mouseButtons = { LEFT: null, MIDDLE: THREE.MOUSE.PAN, RIGHT: null };

    scene.add(new THREE.HemisphereLight(0xffffff, 0xc9d0d8, 1.0));
    const sun = new THREE.DirectionalLight(0xffffff, 1.5);
    sun.position.set(180, 380, 260);
    sun.castShadow = true;
    const smallScreen = Math.min(window.innerWidth, window.innerHeight) < 700;
    sun.shadow.mapSize.set(smallScreen ? 1024 : 2048, smallScreen ? 1024 : 2048); // más liviano en teléfonos
    Object.assign(sun.shadow.camera, { left: -350, right: 350, top: 350, bottom: -350, near: 10, far: 1200 });
    sun.shadow.bias = -0.0004;
    scene.add(sun);
    const fill = new THREE.DirectionalLight(0xfff1de, 0.35);
    fill.position.set(-200, 120, -150);
    scene.add(fill);

    const ground = new THREE.Mesh(new THREE.PlaneGeometry(6000, 6000), new THREE.ShadowMaterial({ opacity: 0.22 }));
    ground.rotation.x = -Math.PI / 2;
    ground.receiveShadow = true;
    scene.add(ground);
    const grid = new THREE.GridHelper(1000, 100, 0xb4bdc8, 0xd3d9e0);
    grid.position.y = 0.05;
    grid.material.transparent = true;
    grid.material.opacity = 0.7;
    scene.add(grid);

    const root = new THREE.Group();
    scene.add(root);

    const canvas = renderer.domElement;
    const ray = new THREE.Raycaster();
    const ndc = new THREE.Vector2();
    const pick = (e) => {
      const r = canvas.getBoundingClientRect();
      ndc.set(((e.clientX - r.left) / r.width) * 2 - 1, -((e.clientY - r.top) / r.height) * 2 + 1);
      ray.setFromCamera(ndc, camera);
      const hit = ray.intersectObjects(root.children.filter((m) => m.visible), false)[0];
      if (!hit) return null;
      const u = hit.object.userData;
      return u.pickId !== undefined ? u.pickId : u.id; // un tirador cuenta como su puerta; patas compradas no se seleccionan
    };

    // Selección por rectángulo: hacia la derecha = ventana (piezas completas dentro); hacia la izquierda = cruce (que lo toquen)
    const boxSelect = (x0, y0, x1, y1) => {
      const cr = canvas.getBoundingClientRect();
      const crossing = x1 < x0;
      const rx0 = Math.min(x0, x1) - cr.left;
      const rx1 = Math.max(x0, x1) - cr.left;
      const ry0 = Math.min(y0, y1) - cr.top;
      const ry1 = Math.max(y0, y1) - cr.top;
      root.updateMatrixWorld(true);
      const box = new THREE.Box3();
      const v = new THREE.Vector3();
      const ids = [];
      root.children.forEach((m) => {
        if (m.userData.fixture || !m.visible) return;
        box.setFromObject(m);
        let minX = Infinity; let minY = Infinity; let maxX = -Infinity; let maxY = -Infinity;
        for (const x of [box.min.x, box.max.x]) for (const y of [box.min.y, box.max.y]) for (const z of [box.min.z, box.max.z]) {
          v.set(x, y, z).project(camera);
          const sx = (v.x * 0.5 + 0.5) * cr.width;
          const sy = (-v.y * 0.5 + 0.5) * cr.height;
          minX = Math.min(minX, sx); maxX = Math.max(maxX, sx); minY = Math.min(minY, sy); maxY = Math.max(maxY, sy);
        }
        const inside = minX >= rx0 && maxX <= rx1 && minY >= ry0 && maxY <= ry1;
        const touches = maxX >= rx0 && minX <= rx1 && maxY >= ry0 && minY <= ry1;
        if (crossing ? touches : inside) ids.push(m.userData.id);
      });
      return ids;
    };

    // Cursor: siempre la flecha normal. Solo mientras se arrastra con la rueda aparece el ícono de desplazar o de girar.
    const setCursor = (mode) => {
      canvas.style.cursor = mode === 'rotate' ? imageCursor(CURSOR_ROTATE, CURSOR_ROTATE_2X, 'grabbing')
        : mode === 'pan' ? imageCursor(CURSOR_MOVE, CURSOR_MOVE_2X, 'move') : 'default';
    };
    setCursor(null);

    const marquee = document.createElement('div');
    marquee.className = 'marquee';
    marquee.hidden = true;
    el.appendChild(marquee);

    let st = null; // gesto en curso
    const onDown = (e) => {
      if (!e.isPrimary) { // segundo dedo: es un gesto de cámara, no un toque
        if (st) { clearTimeout(st.timer); st.moved = true; }
        return;
      }
      const touch = e.pointerType === 'touch';
      st = { x: e.clientX, y: e.clientY, lastX: e.clientX, lastY: e.clientY, button: e.button, mod: e.shiftKey || e.ctrlKey || e.metaKey, touch, moved: false, marquee: false, long: false, cursorSet: false, timer: 0 };
      if (touch) { // mantener el dedo quieto abre el menú (equivale al clic derecho)
        st.timer = setTimeout(() => {
          if (st && !st.moved) {
            st.long = true;
            latest.current.onContext?.({ x: st.x, y: st.y, id: pick({ clientX: st.x, clientY: st.y }) });
          }
        }, 550);
      }
    };
    const onMove = (e) => {
      if (!st) return;
      const dx = e.clientX - st.x;
      const dy = e.clientY - st.y;
      const d = Math.hypot(dx, dy);
      st.lastX = e.clientX; // para poder cambiar de modo a mitad del arrastre
      st.lastY = e.clientY;
      if (d > (st.touch ? 8 : 4)) { st.moved = true; clearTimeout(st.timer); }
      if (st.touch) return;
      if (st.button === 1 && st.moved && !st.cursorSet) { // rueda: desplaza; con Mayús/Ctrl gira
        st.cursorSet = true;
        setCursor(st.mod ? 'rotate' : 'pan');
      }
      if (st.button === 0 && d > 5) {
        st.marquee = true;
        const cr = canvas.getBoundingClientRect();
        Object.assign(marquee.style, {
          left: `${Math.min(st.x, e.clientX) - cr.left}px`, top: `${Math.min(st.y, e.clientY) - cr.top}px`,
          width: `${Math.abs(dx)}px`, height: `${Math.abs(dy)}px`,
        });
        marquee.classList.toggle('crossing', dx < 0);
        marquee.hidden = false;
      }
    };
    const onUp = (e) => {
      if (!st || !e.isPrimary) return;
      const s = st;
      st = null;
      clearTimeout(s.timer);
      setCursor(null);
      marquee.hidden = true;
      const L = latest.current;
      if (s.touch) {
        if (!s.long && !s.moved) L.onPick?.(pick(e), { add: !!L.multi });
        return;
      }
      if (s.button === 0) {
        if (s.marquee) L.onBox?.(boxSelect(s.x, s.y, e.clientX, e.clientY), { add: s.mod || !!L.multi });
        else L.onPick?.(pick(e), { add: s.mod || !!L.multi });
      } else if (s.button === 2 && Math.hypot(e.clientX - s.x, e.clientY - s.y) < 5) {
        L.onContext?.({ x: e.clientX, y: e.clientY, id: pick(e) });
      }
    };
    // Con la rueda apretada, Mayús/Ctrl puede pulsarse antes o después: desplaza sin tecla y gira con tecla,
    // y se puede cambiar a mitad del arrastre (soltar o pulsar la tecla cambia de modo sin perder el hilo).
    const syncMiddleMode = (e) => {
      if (!st || st.touch || st.button !== 1) return;
      const rotate = e.shiftKey || e.ctrlKey || e.metaKey;
      const want = rotate ? ORBIT_ROTATE : ORBIT_PAN;
      if (controls.state !== ORBIT_ROTATE && controls.state !== ORBIT_PAN) return; // la cámara no está en un arrastre
      if (controls.state === want) return;
      const at = { clientX: st.lastX, clientY: st.lastY };
      if (rotate) controls._handleMouseDownRotate(at); else controls._handleMouseDownPan(at);
      controls.state = want;
      st.mod = rotate;
      if (st.cursorSet) setCursor(rotate ? 'rotate' : 'pan');
    };
    window.addEventListener('keydown', syncMiddleMode);
    window.addEventListener('keyup', syncMiddleMode);
    const onCancel = () => { if (st) clearTimeout(st.timer); st = null; setCursor(null); marquee.hidden = true; };
    const noMiddleScroll = (e) => { if (e.button === 1) e.preventDefault(); }; // evita el "autoscroll" de la rueda
    const noMenu = (e) => e.preventDefault();
    canvas.addEventListener('pointerdown', onDown);
    canvas.addEventListener('pointermove', onMove);
    canvas.addEventListener('pointerup', onUp);
    canvas.addEventListener('pointercancel', onCancel);
    canvas.addEventListener('mousedown', noMiddleScroll);
    canvas.addEventListener('auxclick', noMiddleScroll);
    canvas.addEventListener('contextmenu', noMenu);

    let needRender = true; // se dibuja solo si algo cambió: ahorra batería en el teléfono
    const invalidate = () => { needRender = true; };

    const resize = () => {
      const w = el.clientWidth || 1;
      const h = el.clientHeight || 1;
      renderer.setSize(w, h, false);
      camera.aspect = w / h;
      camera.updateProjectionMatrix();
      needRender = true;
    };
    const ro = new ResizeObserver(resize);
    ro.observe(el);
    resize();

    controls.addEventListener('start', () => { S.current.anim = null; }); // si el usuario toma la cámara, se detiene
    let raf = 0;
    const loop = () => {
      raf = requestAnimationFrame(loop);
      const a = S.current.anim;
      if (a) {
        const t = Math.min(1, (performance.now() - a.t0) / a.dur);
        const e = 1 - (1 - t) ** 3;
        camera.position.copy(controls.target).add(a.from.clone().lerp(a.to, e));
        needRender = true;
        if (t >= 1) {
          S.current.anim = null;
          S.current.fitIfNeeded?.(a.depth + 1); // por si un solo paso no alcanzó
        }
      }
      const moved = controls.update(); // true mientras la cámara se mueve (incluye la inercia)
      if (moved || needRender) {
        needRender = false;
        renderer.render(scene, camera);
      }
    };
    loop();

    // Imagen tipo "render" de la vista isométrica (con las mismas texturas y sombras que el visor), para los planos
    const snapshot = (w, h, opts = {}) => {
      const bb = latest.current.bbox;
      const fov = 22;
      const cam = new THREE.PerspectiveCamera(fov, w / h, 1, 6000);
      const size = renderer.getSize(new THREE.Vector2());
      const pr = renderer.getPixelRatio();
      const prevColor = renderer.getClearColor(new THREE.Color());
      const prevAlpha = renderer.getClearAlpha();
      const gridWas = grid.visible;
      // etapa de armado: solo se ven las piezas indicadas (y los elementos comprados según `fx`); las nuevas se resaltan
      const saved = [];
      if (opts.show) {
        const show = new Set(opts.show);
        const hl = new Set(opts.hl || []);
        root.children.forEach((m) => {
          const u = m.userData;
          saved.push([m, m.visible, m.material.emissive.getHex(), m.material.emissiveIntensity, m.position.clone()]);
          m.visible = u.fixture ? (opts.fx === 'all' || (opts.fx === 'legs' && !u.parent)) && !(u.parent && !show.has(u.parent)) : show.has(u.id);
          const lit = !u.fixture && hl.has(u.id);
          m.material.emissive.setHex(lit ? 0xb85a10 : 0x000000);
          m.material.emissiveIntensity = lit ? 0.6 : 0;
          m.position.copy(u.base); // sin vista explosionada
        });
        if (opts.explode) { // vista explosionada: cada pieza se aleja del centro del conjunto mostrado
          const c = new THREE.Vector3();
          let n = 0;
          root.children.forEach((m) => { if (m.visible) { c.add(m.userData.base); n++; } });
          if (n) {
            c.multiplyScalar(1 / n);
            root.children.forEach((m) => { if (m.visible) m.position.copy(c).add(m.userData.base.clone().sub(c).multiplyScalar(opts.explode)); });
          }
        }
      }
      // encuadre: todo el mueble (fijo entre pasos) o solo lo visible (detalles ampliados)
      const box = new THREE.Box3();
      if (opts.frame === 'subset' || opts.explode) root.children.forEach((m) => { if (m.visible) box.expandByObject(m); });
      else box.set(new THREE.Vector3(-bb.dims[0] / 20, 0, -bb.dims[2] / 20), new THREE.Vector3(bb.dims[0] / 20, bb.dims[1] / 10, bb.dims[2] / 20));
      const target = box.getCenter(new THREE.Vector3());
      const bsz = box.getSize(new THREE.Vector3());
      const R = 0.5 * bsz.length();
      const vf = THREE.MathUtils.degToRad(fov);
      const hf = 2 * Math.atan(Math.tan(vf / 2) * cam.aspect);
      const dist = Math.max(R / Math.sin(vf / 2), R / Math.sin(hf / 2)) * 1.04;
      const dirV = new THREE.Vector3(...VIEWS.iso).normalize();
      cam.position.copy(target).addScaledVector(dirV, dist);
      cam.lookAt(target);
      cam.updateMatrixWorld();
      let m = 0; // acerca la cámara hasta que el conjunto ocupe ~92 % de la imagen
      const pv = new THREE.Vector3();
      for (const x of [box.min.x, box.max.x]) for (const y of [box.min.y, box.max.y]) for (const z of [box.min.z, box.max.z]) {
        pv.set(x, y, z).project(cam);
        m = Math.max(m, Math.abs(pv.x), Math.abs(pv.y));
      }
      if (m > 0) { cam.position.copy(target).addScaledVector(dirV, dist * (m / 0.92)); cam.lookAt(target); cam.updateMatrixWorld(); }
      grid.visible = false;
      renderer.setPixelRatio(1);
      renderer.setSize(w, h, false);
      renderer.setClearColor(0xffffff, 1);
      renderer.render(scene, cam);
      let url;
      const labels = opts.labels || [];
      if (labels.length) {
        // letras del despiece: una por letra (con ×n si hay varias), sin encimarse
        const out = document.createElement('canvas');
        out.width = w; out.height = h;
        const g = out.getContext('2d');
        g.drawImage(renderer.domElement, 0, 0, w, h);
        const byId = new Map(root.children.map((mm) => [mm.userData.id, mm]));
        const byLetter = new Map();
        labels.forEach(([id, letter]) => {
          const mm = byId.get(id);
          if (!mm || !mm.visible) return;
          pv.copy(mm.position).project(cam);
          const e = byLetter.get(letter) || { letter, n: 0, best: null };
          e.n++;
          const d = cam.position.distanceTo(mm.position);
          if (!e.best || d < e.best.d) e.best = { x: (pv.x * 0.5 + 0.5) * w, y: (-pv.y * 0.5 + 0.5) * h, d };
          byLetter.set(letter, e);
        });
        // cada etiqueta es una caja ("D" o "D ×3"); se separan como rectángulos para que nada se encime
        const R = Math.max(15, w * 0.03);
        const fBig = Math.round(R * 1.15);
        const fSmall = Math.round(R * 0.8);
        const items = [...byLetter.values()].map((e) => {
          g.font = `bold ${fBig}px Arial, sans-serif`;
          const lw = g.measureText(e.letter).width;
          g.font = `bold ${fSmall}px Arial, sans-serif`;
          const cw = e.n > 1 ? g.measureText(`×${e.n}`).width + 8 : 0;
          const bw = Math.max(2 * R, lw + 16) + cw;
          return { letter: e.letter, n: e.n, ax: e.best.x, ay: e.best.y, x: e.best.x, y: e.best.y, w: bw, h: 2 * R, lw, cw };
        });
        const pad = 6;
        for (let it = 0; it < 300; it++) {
          let moved = false;
          for (let a = 0; a < items.length; a++) for (let b = a + 1; b < items.length; b++) {
            const A = items[a];
            const Bq = items[b];
            const ox = (A.w + Bq.w) / 2 + pad - Math.abs(Bq.x - A.x);
            const oy = (A.h + Bq.h) / 2 + pad - Math.abs(Bq.y - A.y);
            if (ox > 0 && oy > 0) { // se tocan: se empujan por el eje que menos penetra
              if (ox < oy) { const d = (Bq.x >= A.x ? 1 : -1) * (ox / 2 + 0.5); A.x -= d; Bq.x += d; } else { const d = (Bq.y >= A.y ? 1 : -1) * (oy / 2 + 0.5); A.y -= d; Bq.y += d; }
              moved = true;
            }
          }
          items.forEach((q) => { q.x = Math.min(w - q.w / 2 - 2, Math.max(q.w / 2 + 2, q.x)); q.y = Math.min(h - q.h / 2 - 2, Math.max(q.h / 2 + 2, q.y)); });
          if (!moved) break;
        }
        items.forEach((q) => {
          if (Math.hypot(q.x - q.ax, q.y - q.ay) > R * 0.8) { // línea desde la pieza hasta su etiqueta
            g.strokeStyle = '#1b1f24'; g.lineWidth = 2;
            g.beginPath(); g.moveTo(q.ax, q.ay); g.lineTo(q.x, q.y); g.stroke();
            g.fillStyle = '#1b1f24'; g.fillRect(q.ax - 3.5, q.ay - 3.5, 7, 7);
          }
        });
        items.forEach((q) => {
          const x0 = q.x - q.w / 2;
          const y0 = q.y - q.h / 2;
          g.fillStyle = '#ffffff'; g.strokeStyle = '#1b1f24'; g.lineWidth = 2.5;
          g.fillRect(x0, y0, q.w, q.h); g.strokeRect(x0, y0, q.w, q.h);
          g.fillStyle = '#1b1f24'; g.textAlign = 'center'; g.textBaseline = 'middle';
          g.font = `bold ${fBig}px Arial, sans-serif`;
          const lx = q.n > 1 ? x0 + (q.w - q.cw) / 2 : q.x;
          g.fillText(q.letter, lx, q.y + R * 0.06);
          if (q.n > 1) {
            g.fillRect(x0 + q.w - q.cw, y0, q.cw, q.h);
            g.fillStyle = '#ffffff'; g.font = `bold ${fSmall}px Arial, sans-serif`;
            g.fillText(`×${q.n}`, x0 + q.w - q.cw / 2, q.y + R * 0.05);
          }
        });
        url = out.toDataURL('image/jpeg', 0.9);
      } else {
        url = renderer.domElement.toDataURL('image/jpeg', 0.9);
      }
      renderer.setClearColor(prevColor, prevAlpha);
      renderer.setPixelRatio(pr);
      renderer.setSize(size.x, size.y, false);
      grid.visible = gridWas;
      saved.forEach(([mm, vis, em, ei, pos]) => { mm.visible = vis; mm.material.emissive.setHex(em); mm.material.emissiveIntensity = ei; mm.position.copy(pos); });
      needRender = true;
      return url;
    };
    if (apiRef) apiRef.current = { snapshot };

    S.current = { renderer, scene, camera, controls, root, lastSize: 0, invalidate };
    return () => {
      cancelAnimationFrame(raf);
      clearTimeout(S.current.fitT);
      canvas.removeEventListener('pointerdown', onDown);
      canvas.removeEventListener('pointermove', onMove);
      canvas.removeEventListener('pointerup', onUp);
      canvas.removeEventListener('pointercancel', onCancel);
      canvas.removeEventListener('mousedown', noMiddleScroll);
      canvas.removeEventListener('auxclick', noMiddleScroll);
      canvas.removeEventListener('contextmenu', noMenu);
      window.removeEventListener('keydown', syncMiddleMode);
      window.removeEventListener('keyup', syncMiddleMode);
      clearTimeout(st?.timer);
      marquee.remove();
      ro.disconnect();
      controls.dispose();
      root.children.forEach((m) => { m.geometry.dispose(); m.material.dispose(); });
      renderer.dispose();
      if (renderer.domElement.parentNode === el) el.removeChild(renderer.domElement);
      S.current = {};
    };
  }, []);

  // ---- alejar la cámara solo si hace falta ----
  const fitIfNeeded = (depth = 0) => {
    const { camera, controls } = S.current;
    const bb = latest.current.bbox;
    if (!camera || !bb || depth > 4) return;
    const [w, h, d] = bb.dims.map((n) => n / 10);
    camera.updateMatrixWorld();
    const v = new THREE.Vector3();
    let m = 0; // cuánto se acerca el mueble al borde de la pantalla (1 = justo en el borde)
    for (const x of [-w / 2, w / 2]) for (const y of [0, h]) for (const z of [-d / 2, d / 2]) {
      v.set(x, y, z).project(camera);
      m = Math.max(m, Math.abs(v.x), Math.abs(v.y));
    }
    if (m <= 0.97) return;
    const from = camera.position.clone().sub(controls.target);
    // al alejarse deja holgura (el mueble queda al ~75 % del ancho), para no repetirlo a cada ajuste
    const to = from.clone().multiplyScalar(Math.min(1.7, m / 0.75));
    S.current.anim = { from, to, t0: performance.now(), dur: 280, depth };
  };

  // ---- encuadre de cámara ----
  const frame = (dirName) => {
    const { camera, controls } = S.current;
    const { bbox: bb } = latest.current;
    if (!camera || !bb) return;
    const [w, h, d] = bb.dims.map((v) => v / 10);
    const size = Math.max(w, h, d, 30);
    const target = new THREE.Vector3(0, h / 2, 0);
    const dir = new THREE.Vector3(...(VIEWS[dirName] || VIEWS.iso)).normalize();
    // distancia para que la esfera que envuelve al mueble quepa en pantalla (vertical y horizontal)
    const R = 0.5 * Math.sqrt(w * w + h * h + d * d + 900);
    const vf = THREE.MathUtils.degToRad(camera.fov);
    const hf = 2 * Math.atan(Math.tan(vf / 2) * camera.aspect);
    const dist = Math.max(R / Math.sin(vf / 2), R / Math.sin(hf / 2)) * 1.12; // algo de margen: el mueble puede crecer sin tocar el borde
    camera.position.copy(target).addScaledVector(dir, dist);
    controls.target.copy(target);
    controls.update();
    S.current.lastSize = size;
    S.current.invalidate?.();
  };

  // ---- (re)construcción de piezas ----
  useEffect(() => {
    const { root, camera, controls } = S.current;
    if (!root) return;
    root.children.slice().forEach((m) => { root.remove(m); m.geometry.dispose(); m.material.dispose(); });
    const [bx, , bz] = [0, 1, 2].map((i) => (bbox.min[i] + bbox.max[i]) / 2);
    parts.forEach((p, i) => {
      const geo = partGeometry(p);
      applyWorldUV(geo, p.size, 60, i + 1);
      const baseColor = tint(materialOf(p.mat).color, i);
      const mat = new THREE.MeshStandardMaterial({ color: baseColor.clone(), roughness: 0.78, metalness: 0 });
      const mesh = new THREE.Mesh(geo, mat);
      mesh.castShadow = true;
      mesh.receiveShadow = true;
      const edges = new THREE.LineSegments(
        new THREE.EdgesGeometry(geo),
        new THREE.LineBasicMaterial({ color: 0x4a3826, transparent: true, opacity: 0.5 }),
      );
      mesh.add(edges);
      mesh.userData = {
        id: p.id,
        baseColor,
        base: new THREE.Vector3((p.center[0] - bx) / 10, p.center[1] / 10, (p.center[2] - bz) / 10),
      };
      mesh.position.copy(mesh.userData.base);
      if (p.rot) mesh.rotation.set(p.rot[0], p.rot[1], p.rot[2]); // patas inclinadas
      root.add(mesh);
    });
    // elementos comprados: tiradores, ruedas y patas metálicas
    const baseById = new Map(root.children.map((m) => [m.userData.id, m.userData.base]));
    latest.current.fixtures.forEach((f) => {
      const { geo, color, metal } = fixtureGeometry(f);
      const mat = new THREE.MeshStandardMaterial({ color, roughness: 0.38, metalness: metal });
      const mesh = new THREE.Mesh(geo, mat);
      mesh.castShadow = true;
      const base = new THREE.Vector3(
        (f.min[0] + f.size[0] / 2 - bx) / 10,
        (f.min[1] + f.size[1] / 2) / 10,
        (f.min[2] + f.size[2] / 2 - bz) / 10,
      );
      mesh.userData = { id: f.id, fixture: true, parent: f.parent || null, pickId: f.parent || null, base, anchor: (f.parent && baseById.get(f.parent)) || base };
      mesh.position.copy(base);
      if (f.rot) mesh.rotation.set(f.rot[0], f.rot[1], f.rot[2]);
      root.add(mesh);
    });
    // La cámara NO se mueve al cambiar medidas (sin zoom ni desplazamiento del fondo).
    // Solo se aleja, con suavidad, si el mueble creció y ya no cabe en pantalla.
    S.current.fitIfNeeded = fitIfNeeded;
    clearTimeout(S.current.fitT);
    S.current.fitT = setTimeout(() => fitIfNeeded(), 200);
    applyState();
  }, [parts, fixtures]);

  const applyState = () => {
    const { root } = S.current;
    if (!root) return;
    S.current.invalidate?.();
    const { bbox: bb, explode: ex, highlight: hl, looks, hiddenIds } = latest.current;
    const cx = 0;
    const cy = bb.dims[1] / 20;
    const cz = 0;
    root.children.forEach((m) => {
      const b = m.userData.base;
      const a = m.userData.anchor || b; // los tiradores se mueven junto con su puerta
      m.position.set(
        b.x + (a.x - cx) * ex * 0.42,
        b.y + (a.y - cy) * ex * 0.42,
        b.z + (a.z - cz) * ex * 0.42,
      );
      const ownerId = m.userData.fixture ? m.userData.parent : m.userData.id;
      m.visible = !(ownerId && hiddenIds && hiddenIds.has(ownerId)); // ocultas desde el menú
      const on = !hl || hl.has(ownerId);
      const mat = m.material;
      if (!m.userData.fixture) { // color / textura elegidos por el usuario
        const look = looks && looks.get(m.userData.id);
        const sig = look ? `${look.texture || ''}|${look.color || ''}` : '';
        if (m.userData.lookSig !== sig) {
          m.userData.lookSig = sig;
          const tex = look && look.texture && look.texture !== 'liso' ? getTexture(look.texture) : null;
          mat.map = tex;
          if (look && look.color) mat.color.set(look.color);
          else if (tex) mat.color.set('#ffffff');
          else mat.color.copy(m.userData.baseColor);
          mat.needsUpdate = true;
        }
      }
      const transparent = !!hl && !on;
      if (mat.transparent !== transparent) { mat.transparent = transparent; mat.needsUpdate = true; }
      mat.opacity = transparent ? 0.16 : 1;
      mat.depthWrite = !transparent;
      mat.emissive.setHex(hl && on && !m.userData.fixture ? 0x8a3d00 : 0x000000);
      mat.emissiveIntensity = hl && on ? 0.55 : 0;
    });
  };

  useEffect(applyState, [explode, highlight, looks, hiddenIds]);

  // ---- cambio de mueble: reencuadre ----
  useEffect(() => { frame('iso'); }, [viewKey]);
  // ---- botones de vista ----
  useEffect(() => { if (viewCmd) frame(viewCmd.name); }, [viewCmd]);

  return <div className="viewer-canvas" ref={mount} />;
}
