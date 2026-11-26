import React, { useEffect, useState } from 'react';

function NumField({ p, value, onChange }) {
  const [text, setText] = useState(String(value));
  const [focus, setFocus] = useState(false);
  useEffect(() => { if (!focus) setText(String(value)); }, [value, focus]);
  const clamp = (x) => Math.min(p.max, Math.max(p.min, x));
  const commit = () => {
    const x = parseFloat(String(text).replace(',', '.'));
    if (Number.isFinite(x)) onChange(clamp(Math.round(x / p.step) * p.step));
    setFocus(false);
  };
  return (
    <div className="num-row">
      <input
        type="range" min={p.min} max={p.max} step={p.step} value={value}
        onChange={(e) => onChange(Number(e.target.value))} aria-label={p.label}
      />
      <span className="numbox">
        <input
          type="text" inputMode="decimal" value={text}
          onFocus={() => setFocus(true)} onBlur={commit}
          onChange={(e) => setText(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && e.currentTarget.blur()}
        />
        <em>{p.unit}</em>
      </span>
    </div>
  );
}

export default function ParamsForm({ type, values, onChange }) {
  let lastSection = null;
  return (
    <div className="params">
      {type.params.filter((p) => !p.visibleIf || p.visibleIf(values)).map((p) => {
        const head = p.section && p.section !== lastSection ? <h4 key={`h-${p.key}`}>{p.section}</h4> : null;
        if (p.section) lastSection = p.section;
        return (
          <React.Fragment key={p.key}>
            {head}
            <label className={`field field-${p.type}`}>
              <span className="field-label">{p.label}</span>
              {p.type === 'num' && <NumField p={p} value={values[p.key]} onChange={(v) => onChange(p.key, v)} />}
              {p.type === 'sel' && (
                <select value={values[p.key]} onChange={(e) => onChange(p.key, e.target.value)}>
                  {p.options.map(([val, lab]) => <option key={val} value={val}>{lab}</option>)}
                </select>
              )}
              {p.type === 'bool' && (
                <input type="checkbox" checked={!!values[p.key]} onChange={(e) => onChange(p.key, e.target.checked)} />
              )}
            </label>
          </React.Fragment>
        );
      })}
    </div>
  );
}
