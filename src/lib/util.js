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
