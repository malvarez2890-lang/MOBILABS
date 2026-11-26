import React, { useEffect, useRef } from 'react';
import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { materialOf } from '../lib/materials.js';

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

export default function Viewer3D({ parts, bbox, explode, highlight, viewKey, viewCmd }) {
  const mount = useRef(null);
  const S = useRef({}); // objetos three.js
  const latest = useRef({});
  latest.current = { parts, bbox, explode, highlight };

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

    scene.add(new THREE.HemisphereLight(0xffffff, 0xd6c9b6, 1.0));
    const sun = new THREE.DirectionalLight(0xffffff, 1.5);
    sun.position.set(180, 380, 260);
    sun.castShadow = true;
    sun.shadow.mapSize.set(2048, 2048);
    Object.assign(sun.shadow.camera, { left: -350, right: 350, top: 350, bottom: -350, near: 10, far: 1200 });
    sun.shadow.bias = -0.0004;
    scene.add(sun);
    const fill = new THREE.DirectionalLight(0xfff1de, 0.35);
    fill.position.set(-200, 120, -150);
    scene.add(fill);

    const ground = new THREE.Mesh(new THREE.PlaneGeometry(6000, 6000), new THREE.ShadowMaterial({ opacity: 0.2 }));
    ground.rotation.x = -Math.PI / 2;
    ground.receiveShadow = true;
    scene.add(ground);
    const grid = new THREE.GridHelper(1000, 100, 0xd8cdbd, 0xe7dfd2);
    grid.position.y = 0.05;
    grid.material.transparent = true;
    grid.material.opacity = 0.7;
    scene.add(grid);

    const root = new THREE.Group();
    scene.add(root);

    const resize = () => {
      const w = el.clientWidth || 1;
      const h = el.clientHeight || 1;
      renderer.setSize(w, h, false);
      camera.aspect = w / h;
      camera.updateProjectionMatrix();
    };
    const ro = new ResizeObserver(resize);
    ro.observe(el);
    resize();

    let raf = 0;
    const loop = () => {
      controls.update();
      renderer.render(scene, camera);
      raf = requestAnimationFrame(loop);
    };
    loop();

    S.current = { renderer, scene, camera, controls, root, lastSize: 0 };
    return () => {
      cancelAnimationFrame(raf);
      ro.disconnect();
      controls.dispose();
      root.children.forEach((m) => { m.geometry.dispose(); m.material.dispose(); });
      renderer.dispose();
      if (renderer.domElement.parentNode === el) el.removeChild(renderer.domElement);
      S.current = {};
    };
  }, []);

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
    const dist = Math.max(R / Math.sin(vf / 2), R / Math.sin(hf / 2)) * 1.04;
    camera.position.copy(target).addScaledVector(dir, dist);
    controls.target.copy(target);
    controls.update();
    S.current.lastSize = size;
  };

  // ---- (re)construcción de piezas ----
  useEffect(() => {
    const { root, camera, controls } = S.current;
    if (!root) return;
    root.children.slice().forEach((m) => { root.remove(m); m.geometry.dispose(); m.material.dispose(); });
    const [bx, , bz] = [0, 1, 2].map((i) => (bbox.min[i] + bbox.max[i]) / 2);
    parts.forEach((p, i) => {
      const geo = new THREE.BoxGeometry(p.size[0] / 10, p.size[1] / 10, p.size[2] / 10);
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
    // mantiene el zoom relativo del usuario cuando cambia el tamaño del mueble
    const [w, h, d] = bbox.dims.map((v) => v / 10);
    const size = Math.max(w, h, d, 30);
    const ls = S.current.lastSize;
    const target = new THREE.Vector3(0, h / 2, 0);
    if (ls && camera) {
      const off = camera.position.clone().sub(controls.target).multiplyScalar(size / ls);
      controls.target.copy(target);
      camera.position.copy(target).add(off);
      controls.update();
    }
    S.current.lastSize = size;
    applyState();
  }, [parts]);

  const applyState = () => {
    const { root } = S.current;
    if (!root) return;
    const { bbox: bb, explode: ex, highlight: hl } = latest.current;
    const cx = 0;
    const cy = bb.dims[1] / 20;
    const cz = 0;
    root.children.forEach((m) => {
      const b = m.userData.base;
      m.position.set(
        b.x + (b.x - cx) * ex * 0.42,
        b.y + (b.y - cy) * ex * 0.42,
        b.z + (b.z - cz) * ex * 0.42,
      );
      const on = !hl || hl.has(m.userData.id);
      const mat = m.material;
      const transparent = !!hl && !on;
      if (mat.transparent !== transparent) { mat.transparent = transparent; mat.needsUpdate = true; }
      mat.opacity = transparent ? 0.16 : 1;
      mat.depthWrite = !transparent;
      mat.emissive.setHex(hl && on ? 0x8a3d00 : 0x000000);
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
