import React, { useEffect, useRef } from 'react';
import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { materialOf } from '../lib/materials.js';
import { partGeometry, fixtureGeometry } from './geometry.js';
import CURSOR_MOVE from '../assets/cursor-move.png';
import CURSOR_ROTATE from '../assets/cursor-rotate.png';

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

export default function Viewer3D({ parts, fixtures = [], bbox, explode, highlight, viewKey, viewCmd, onPick }) {
  const mount = useRef(null);
  const S = useRef({}); // objetos three.js
  const latest = useRef({});
  latest.current = { parts, fixtures, bbox, explode, highlight, onPick };

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

    // --- selección de piezas: clic (sin arrastrar) sobre una pieza, o sobre el vacío para soltar ---
    const ray = new THREE.Raycaster();
    const ndc = new THREE.Vector2();
    const pick = (e) => {
      const r = renderer.domElement.getBoundingClientRect();
      ndc.set(((e.clientX - r.left) / r.width) * 2 - 1, -((e.clientY - r.top) / r.height) * 2 + 1);
      ray.setFromCamera(ndc, camera);
      const hit = ray.intersectObjects(root.children, false)[0];
      if (!hit) return null;
      const u = hit.object.userData;
      return u.pickId !== undefined ? u.pickId : u.id; // un tirador cuenta como su puerta; patas compradas no se seleccionan
    };
    // Cursor: siempre la flecha normal. Solo mientras se arrastra aparece el ícono de girar o de desplazar.
    const canvas = renderer.domElement;
    const setCursor = (mode) => {
      canvas.style.cursor = mode === 'rotate' ? `url("${CURSOR_ROTATE}") 16 16, grabbing`
        : mode === 'pan' ? `url("${CURSOR_MOVE}") 16 16, move` : 'default';
    };
    setCursor(null);
    let down = null;
    const onDown = (e) => {
      // igual que OrbitControls: botón derecho (o Ctrl/Mayús/⌘ + izquierdo) desplaza; izquierdo gira; rueda = zoom
      const pan = e.pointerType === 'mouse' && (e.button === 2 || e.ctrlKey || e.metaKey || e.shiftKey);
      down = { x: e.clientX, y: e.clientY, pan, mouse: e.pointerType === 'mouse', button: e.button, dragging: false };
    };
    const onMove = (e) => {
      if (!down || !down.mouse || down.button === 1 || down.dragging) return;
      if (Math.hypot(e.clientX - down.x, e.clientY - down.y) > 4) {
        down.dragging = true; // ya es un arrastre (no un clic de selección)
        setCursor(down.pan ? 'pan' : 'rotate');
      }
    };
    const onUp = (e) => {
      if (!down) return;
      const moved = Math.hypot(e.clientX - down.x, e.clientY - down.y);
      down = null;
      setCursor(null);
      if (moved < 5) latest.current.onPick?.(pick(e));
    };
    const onCancel = () => { down = null; setCursor(null); };
    canvas.addEventListener('pointerdown', onDown);
    canvas.addEventListener('pointermove', onMove);
    canvas.addEventListener('pointerup', onUp);
    canvas.addEventListener('pointercancel', onCancel);

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

    S.current = { renderer, scene, camera, controls, root, lastSize: 0, invalidate };
    return () => {
      cancelAnimationFrame(raf);
      clearTimeout(S.current.fitT);
      canvas.removeEventListener('pointerdown', onDown);
      canvas.removeEventListener('pointermove', onMove);
      canvas.removeEventListener('pointerup', onUp);
      canvas.removeEventListener('pointercancel', onCancel);
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
      const mat = new THREE.MeshStandardMaterial({ color: tint(materialOf(p.mat).color, i), roughness: 0.78, metalness: 0 });
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
        base: new THREE.Vector3((p.center[0] - bx) / 10, p.center[1] / 10, (p.center[2] - bz) / 10),
      };
      mesh.position.copy(mesh.userData.base);
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
    const { bbox: bb, explode: ex, highlight: hl } = latest.current;
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
      const on = !hl || hl.has(m.userData.fixture ? m.userData.parent : m.userData.id);
      const mat = m.material;
      const transparent = !!hl && !on;
      if (mat.transparent !== transparent) { mat.transparent = transparent; mat.needsUpdate = true; }
      mat.opacity = transparent ? 0.16 : 1;
      mat.depthWrite = !transparent;
      mat.emissive.setHex(hl && on && !m.userData.fixture ? 0x8a3d00 : 0x000000);
      mat.emissiveIntensity = hl && on ? 0.55 : 0;
    });
  };

  useEffect(applyState, [explode, highlight]);

  // ---- cambio de mueble: reencuadre ----
  useEffect(() => { frame('iso'); }, [viewKey]);
  // ---- botones de vista ----
  useEffect(() => { if (viewCmd) frame(viewCmd.name); }, [viewCmd]);

  return <div className="viewer-canvas" ref={mount} />;
}
