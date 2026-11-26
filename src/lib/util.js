export const r1 = (v) => Math.round(v * 10) / 10;

/** Número legible: 1764 -> "1764", 18.5 -> "18,5" */
export const fmt = (v) => {
  const x = Math.round(v * 10) / 10;
  return Number.isInteger(x) ? String(x) : x.toFixed(1).replace('.', ',');
};

/** mm -> cm legible */
export const cm = (mm) => fmt(mm / 10);

/** 0 -> A, 25 -> Z, 26 -> AA */
export const labelFor = (i) => {
  let s = '';
  let n = i;
  do {
    s = String.fromCharCode(65 + (n % 26)) + s;
    n = Math.floor(n / 26) - 1;
  } while (n >= 0);
  return s;
};

const mul = (A, B) => A.map((r, i) => B[0].map((_, j) => r.reduce((s, _v, k) => s + A[i][k] * B[k][j], 0)));
const Rx = (a) => [[1, 0, 0], [0, Math.cos(a), -Math.sin(a)], [0, Math.sin(a), Math.cos(a)]];
const Ry = (a) => [[Math.cos(a), 0, Math.sin(a)], [0, 1, 0], [-Math.sin(a), 0, Math.cos(a)]];
const Rz = (a) => [[Math.cos(a), -Math.sin(a), 0], [Math.sin(a), Math.cos(a), 0], [0, 0, 1]];

/** Caja envolvente (alineada a los ejes) de una caja girada alrededor de su centro. rot = [rx, ry, rz], orden XYZ como three.js. */
export function rotatedBox(min, size, rot) {
  const R = mul(mul(Rx(rot[0]), Ry(rot[1])), Rz(rot[2]));
  const c = min.map((m, i) => m + size[i] / 2);
  const lo = [Infinity, Infinity, Infinity];
  const hi = [-Infinity, -Infinity, -Infinity];
  for (const sx of [-1, 1]) for (const sy of [-1, 1]) for (const sz of [-1, 1]) {
    const v = [sx * size[0] / 2, sy * size[1] / 2, sz * size[2] / 2];
    for (let i = 0; i < 3; i++) {
      const w = c[i] + R[i][0] * v[0] + R[i][1] * v[1] + R[i][2] * v[2];
      lo[i] = Math.min(lo[i], w);
      hi[i] = Math.max(hi[i], w);
    }
  }
  return { min: lo, size: hi.map((h, i) => h - lo[i]) };
}

/**
 * Pata inclinada: desde el punto `top` (centro de su cara superior) baja `drop` mm en vertical,
 * inclinada `tilt = [rotX, rotZ]` (rad). Devuelve caja sin girar centrada + giro + largo real.
 */
export function tiltedBox(top, drop, tilt, width, thick = width) {
  const [ph, th] = tilt;
  const L = drop / (Math.cos(th) * Math.cos(ph));
  const d = [Math.sin(th), -Math.cos(th) * Math.cos(ph), -Math.cos(th) * Math.sin(ph)]; // hacia abajo
  const c = [top[0] + (d[0] * L) / 2, top[1] + (d[1] * L) / 2, top[2] + (d[2] * L) / 2];
  const size = [width, L, thick];
  return { min: [c[0] - size[0] / 2, c[1] - size[1] / 2, c[2] - size[2] / 2], size, rot: [ph, 0, th], L };
}
