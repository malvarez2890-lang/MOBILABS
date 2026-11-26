import { materialOf } from './materials.js';
import { SITE_URL } from './print.js';

/**
 * Exportación BIM: el mueble como sólidos simples (cajas y cilindros) con su sistema de ejes,
 * para escribir un IFC (Revit, ArchiCAD…) o un script que crea una familia nativa de Revit.
 * Ejes de salida (mm): X = ancho, Y = profundidad (el frente mira hacia −Y), Z = alto. Origen: centro de la planta, en el piso.
 */
const FIX = {
  handle: ['Metal (tirador)', '#aeb3ba'],
  metalLeg: ['Acero negro', '#2f3237'],
  caster: ['Rueda', '#3a3d42'],
  productLeg: ['Madera (pata lista)', '#b98a55'],
};

const rotM = (rot) => {
  const [a, b, c] = rot;
  const Rx = [[1, 0, 0], [0, Math.cos(a), -Math.sin(a)], [0, Math.sin(a), Math.cos(a)]];
  const Ry = [[Math.cos(b), 0, Math.sin(b)], [0, 1, 0], [-Math.sin(b), 0, Math.cos(b)]];
  const Rz = [[Math.cos(c), -Math.sin(c), 0], [Math.sin(c), Math.cos(c), 0], [0, 0, 1]];
  const mul = (A, B) => A.map((r) => [0, 1, 2].map((j) => r[0] * B[0][j] + r[1] * B[1][j] + r[2] * B[2][j]));
  return mul(mul(Rx, Ry), Rz);
};
const r4 = (v) => Math.round(v * 1e4) / 1e4;

/** Lista de sólidos: { name, letter, mat, color, k: 'box'|'cyl', o, x, z, dx, dy, r, h } (o = centro de la base; z = dirección de extrusión). */
export function solidsOf(model, letterOf = new Map()) {
  const { min, max } = model.bbox;
  const cx = (min[0] + max[0]) / 2;
  const cz = (min[2] + max[2]) / 2;
  const P = (v) => [r4(v[0] - cx), r4(cz - v[2]), r4(v[1])]; // punto modelo → salida
  const M = (v) => [r4(v[0]), r4(-v[2]), r4(v[1])]; // dirección modelo → salida
  const out = [];
  const add = (o, name, mat, color, round, letter = '') => {
    const R = o.rot ? rotM(o.rot) : [[1, 0, 0], [0, 1, 0], [0, 0, 1]];
    const col = (j) => [R[0][j], R[1][j], R[2][j]];
    const ex = col(0);
    const ey = col(1);
    const [sx, sy, sz] = o.size;
    const c = o.min.map((m, i) => m + o.size[i] / 2);
    const base = c.map((v, i) => v - (ey[i] * sy) / 2);
    const s = { name, letter, mat, color, o: P(base), x: M(ex), z: M(ey), h: r4(sy) };
    if (round) Object.assign(s, { k: 'cyl', r: r4(sx / 2) });
    else Object.assign(s, { k: 'box', dx: r4(sx), dy: r4(sz) });
    out.push(s);
  };
  model.parts.forEach((p) => {
    const m = materialOf(p.mat);
    add(p, p.name, m.name, m.color, p.shape === 'disc' || p.shape === 'round' || p.shape === 'taperRound', letterOf.get(p.id) || '');
  });
  model.fixtures.forEach((f) => {
    const [name, color] = FIX[f.kind] || ['Herraje', '#8f979f'];
    add(f, f.kind === 'handle' ? 'Tirador' : f.kind === 'caster' ? 'Rueda' : 'Pata', name, color, f.kind === 'productLeg' && f.shape !== 'taperBox');
  });
  return out;
}

// ---------------------------------------------------------------- IFC 2x3 (texto STEP)
const B64 = '0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz_$';
function guid() {
  const b = new Uint8Array(16);
  (globalThis.crypto || { getRandomValues: (a) => a.map(() => Math.floor(Math.random() * 256)) }).getRandomValues(b);
  let n = 0n;
  for (const x of b) n = (n << 8n) | BigInt(x);
  let s = '';
  for (let i = 0; i < 22; i++) { s = B64[Number(n & 63n)] + s; n >>= 6n; }
  return s;
}
const str = (t) => `'${String(t).replace(/'/g, "''").replace(/\\/g, '\\\\').replace(/[^\x20-\x7e]/g, (c) => `\\X2\\${c.charCodeAt(0).toString(16).toUpperCase().padStart(4, '0')}\\X0\\`)}'`;
const num = (v) => { const s = String(r4(v)); return /[.eE]/.test(s) ? s : `${s}.`; };
const hex2rgb = (h) => [1, 3, 5].map((i) => parseInt(h.slice(i, i + 2), 16) / 255);

export function toIfc(model, info) {
  const L = [];
  let id = 0;
  const e = (txt) => { id++; L.push(`#${id}=${txt};`); return `#${id}`; };
  const pt = (p) => e(`IFCCARTESIANPOINT((${p.map(num).join(',')}))`);
  const dir = (d) => e(`IFCDIRECTION((${d.map(num).join(',')}))`);
  const now = Math.floor(Date.now() / 1000);

  const person = e(`IFCPERSON($,$,${str('MOBILABs')},$,$,$,$,$)`);
  const org = e(`IFCORGANIZATION($,${str('MOBILABs')},${str(SITE_URL)},$,$)`);
  const po = e(`IFCPERSONANDORGANIZATION(${person},${org},$)`);
  const appl = e(`IFCAPPLICATION(${org},'1.0',${str('MOBILABs')},'MOBILABS')`);
  const oh = e(`IFCOWNERHISTORY(${po},${appl},$,.ADDED.,$,$,$,${now})`);
  const units = [
    e('IFCSIUNIT(*,.LENGTHUNIT.,.MILLI.,.METRE.)'), e('IFCSIUNIT(*,.AREAUNIT.,$,.SQUARE_METRE.)'),
    e('IFCSIUNIT(*,.VOLUMEUNIT.,$,.CUBIC_METRE.)'), e('IFCSIUNIT(*,.PLANEANGLEUNIT.,$,.RADIAN.)'),
  ];
  const ua = e(`IFCUNITASSIGNMENT((${units.join(',')}))`);
  const origin = pt([0, 0, 0]);
  const dz = dir([0, 0, 1]);
  const dx = dir([1, 0, 0]);
  const wcs = e(`IFCAXIS2PLACEMENT3D(${origin},${dz},${dx})`);
  const ctx = e(`IFCGEOMETRICREPRESENTATIONCONTEXT($,'Model',3,1.E-05,${wcs},$)`);
  const project = e(`IFCPROJECT('${guid()}',${oh},${str('MOBILABs')},${str(info.title)},$,$,$,(${ctx}),${ua})`);
  const lpSite = e(`IFCLOCALPLACEMENT($,${wcs})`);
  const site = e(`IFCSITE('${guid()}',${oh},${str('Sitio')},$,$,${lpSite},$,$,.ELEMENT.,$,$,$,$,$)`);
  const lpB = e(`IFCLOCALPLACEMENT(${lpSite},${wcs})`);
  const bld = e(`IFCBUILDING('${guid()}',${oh},${str('Edificio')},$,$,${lpB},$,$,.ELEMENT.,$,$,$)`);
  const lpS = e(`IFCLOCALPLACEMENT(${lpB},${wcs})`);
  const storey = e(`IFCBUILDINGSTOREY('${guid()}',${oh},${str('Nivel 1')},$,$,${lpS},$,$,.ELEMENT.,0.)`);
  e(`IFCRELAGGREGATES('${guid()}',${oh},$,$,${project},(${site}))`);
  e(`IFCRELAGGREGATES('${guid()}',${oh},$,$,${site},(${bld}))`);
  e(`IFCRELAGGREGATES('${guid()}',${oh},$,$,${bld},(${storey}))`);

  // estilos (un color por material)
  const styles = new Map();
  const styleOf = (mat, color) => {
    if (!styles.has(mat)) {
      const [r, g, b] = hex2rgb(color);
      const c = e(`IFCCOLOURRGB($,${num(r)},${num(g)},${num(b)})`);
      const rend = e(`IFCSURFACESTYLERENDERING(${c},0.,$,$,$,$,$,$,.NOTDEFINED.)`);
      const ss = e(`IFCSURFACESTYLE(${str(mat)},.BOTH.,(${rend}))`);
      styles.set(mat, e(`IFCPRESENTATIONSTYLEASSIGNMENT((${ss}))`));
    }
    return styles.get(mat);
  };
  const p2 = e(`IFCAXIS2PLACEMENT2D(${e('IFCCARTESIANPOINT((0.,0.))')},$)`);
  const solids = info.solids.map((s) => {
    const prof = s.k === 'box'
      ? e(`IFCRECTANGLEPROFILEDEF(.AREA.,${str(s.name)},${p2},${num(Math.max(s.dx, 0.1))},${num(Math.max(s.dy, 0.1))})`)
      : e(`IFCCIRCLEPROFILEDEF(.AREA.,${str(s.name)},${p2},${num(Math.max(s.r, 0.1))})`);
    const pos = e(`IFCAXIS2PLACEMENT3D(${pt(s.o)},${dir(s.z)},${dir(s.x)})`);
    const so = e(`IFCEXTRUDEDAREASOLID(${prof},${pos},${dz},${num(Math.max(s.h, 0.1))})`);
    e(`IFCSTYLEDITEM(${so},(${styleOf(s.mat, s.color)}),$)`);
    return so;
  });
  const rep = e(`IFCSHAPEREPRESENTATION(${ctx},'Body','SweptSolid',(${solids.join(',')}))`);
  const pds = e(`IFCPRODUCTDEFINITIONSHAPE($,$,(${rep}))`);
  const lpE = e(`IFCLOCALPLACEMENT(${lpS},${wcs})`);
  const el = e(`IFCFURNISHINGELEMENT('${guid()}',${oh},${str(info.title)},${str(info.desc)},${str(info.typeName)},${lpE},${pds},$)`);
  e(`IFCRELCONTAINEDINSPATIALSTRUCTURE('${guid()}',${oh},$,$,(${el}),${storey})`);

  // propiedades
  const prop = (n, v) => e(`IFCPROPERTYSINGLEVALUE(${str(n)},$,${v},$)`);
  const props = [
    prop('Tipo de mueble', `IFCLABEL(${str(info.typeName)})`),
    prop('Ancho', `IFCPOSITIVELENGTHMEASURE(${num(info.dims[0])})`),
    prop('Alto', `IFCPOSITIVELENGTHMEASURE(${num(info.dims[1])})`),
    prop('Fondo', `IFCPOSITIVELENGTHMEASURE(${num(info.dims[2])})`),
    prop('Material principal', `IFCLABEL(${str(info.mainMat)})`),
    prop('Piezas cortadas', `IFCINTEGER(${model.parts.length})`),
    prop('Costo aproximado (CLP)', `IFCREAL(${num(info.cost)})`),
    prop('Despiece', `IFCTEXT(${str(info.cutText)})`),
    prop('Generado con', `IFCLABEL(${str(SITE_URL)})`),
  ];
  const pset = e(`IFCPROPERTYSET('${guid()}',${oh},${str('MOBILABs')},$,(${props.join(',')}))`);
  e(`IFCRELDEFINESBYPROPERTIES('${guid()}',${oh},$,$,(${el}),${pset})`);
  const mats = [...new Set(info.solids.map((s) => s.mat))].map((m) => e(`IFCMATERIAL(${str(m)})`));
  const ml = e(`IFCMATERIALLIST((${mats.join(',')}))`);
  e(`IFCRELASSOCIATESMATERIAL('${guid()}',${oh},$,$,(${el}),${ml})`);

  const stamp = new Date().toISOString().slice(0, 19);
  return [
    'ISO-10303-21;',
    'HEADER;',
    "FILE_DESCRIPTION(('ViewDefinition [CoordinationView]'),'2;1');",
    `FILE_NAME(${str(`${info.fileBase}.ifc`)},'${stamp}',(${str('MOBILABs')}),(${str('MOBILABs')}),'MOBILABs','MOBILABs','');`,
    "FILE_SCHEMA(('IFC2X3'));",
    'ENDSEC;',
    'DATA;',
    ...L,
    'ENDSEC;',
    'END-ISO-10303-21;',
    '',
  ].join('\n');
}

// ---------------------------------------------------------------- familia de Revit (script Python para pyRevit / RevitPythonShell / Dynamo)
export function toRevitPy(model, info) {
  const materials = {};
  info.solids.forEach((s) => { materials[s.mat] = s.color; });
  const data = {
    name: info.fileBase, title: info.title, typeName: info.typeName, dims: info.dims, cost: info.cost,
    mainMat: info.mainMat, cutText: info.cutText, site: SITE_URL, materials,
    solids: info.solids.map((s) => ({ n: s.letter ? `${s.letter} ${s.name}` : s.name, m: s.mat, k: s.k, o: s.o, x: s.x, z: s.z, h: s.h, dx: s.dx, dy: s.dy, r: s.r })),
  };
  // JSON solo en ASCII (los acentos van como \\uXXXX) para que funcione igual en IronPython y CPython
  const json = JSON.stringify(data).replace(/[\u007f-\uffff]/g, (c) => `\\u${c.charCodeAt(0).toString(16).padStart(4, '0')}`).replace(/'''/g, "\\u0027\\u0027\\u0027");
  return `# -*- coding: utf-8 -*-
# =====================================================================================
#  MOBILABs -> familia de Revit (.rfa)        ${SITE_URL}
#  Mueble: ${info.title.replace(/[^\x20-\x7e]/g, '?')}
#
#  Cómo usarlo (Revit 2019 o superior):
#   * pyRevit o RevitPythonShell: ejecuta este archivo con un proyecto abierto.
#   * Dynamo: crea un nodo "Python Script", pega TODO este texto y ejecuta.
#  Crea una familia nueva de Mobiliario (plantilla métrica de tu Revit), con cada pieza como
#  extrusión sólida y su material, la guarda en Documentos\\MOBILABs\\<nombre>.rfa
#  y la carga en el proyecto abierto.
# =====================================================================================
import clr, os, glob, json, math
clr.AddReference('RevitAPI')
from Autodesk.Revit.DB import *

DATA = json.loads(r'''${json}''')

try:
    uiapp = __revit__                       # pyRevit / RevitPythonShell
    DYNAMO = False
except NameError:                           # Dynamo
    clr.AddReference('RevitServices')
    from RevitServices.Persistence import DocumentManager
    from RevitServices.Transactions import TransactionManager
    uiapp = DocumentManager.Instance.CurrentUIApplication
    DYNAMO = True
    TransactionManager.Instance.ForceCloseTransaction()
app = uiapp.Application
doc = uiapp.ActiveUIDocument.Document if uiapp.ActiveUIDocument else None
MM = 1.0 / 304.8                            # mm -> pies (unidad interna de Revit)

def find_template():
    roots = []
    try:
        roots.append(app.FamilyTemplatePath)
    except Exception:
        pass
    roots += glob.glob(r'C:\\ProgramData\\Autodesk\\RVT *\\Family Templates\\*')
    files = []
    for r in roots:
        if r and os.path.isdir(r):
            files += glob.glob(os.path.join(r, '*.rft')) + glob.glob(os.path.join(r, '*', '*.rft'))
    low = [(f, os.path.basename(f).lower()) for f in files]
    for keys in (('furniture', 'mobiliario', 'mobilier', 'mobili'), ('generic model', 'modelo gen', 'mod\\xe8le g')):
        hits = [f for f, n in low if any(k in n for k in keys)]
        metric = [f for f in hits if 'metric' in f.lower() or 'm\\xe9tric' in f.lower() or 'metri' in f.lower()]
        if metric or hits:
            return (metric or hits)[0]
    return files[0] if files else None

def v(p):
    return XYZ(p[0] * MM, p[1] * MM, p[2] * MM)

def add_param(fm, name, value, length):
    fp = None
    try:                                     # Revit 2022+
        spec = SpecTypeId.Length if length else SpecTypeId.String.Text
        fp = fm.AddParameter(name, GroupTypeId.Data, spec, False)
    except Exception:
        try:
            fp = fm.AddParameter(name, BuiltInParameterGroup.PG_DATA, ParameterType.Length if length else ParameterType.Text, False)
        except Exception:
            return
    try:
        fm.Set(fp, value * MM if length else value)
    except Exception:
        pass

tpl = find_template()
if not tpl:
    raise Exception('No encontré plantillas de familia (.rft). Revisa Opciones > Ubicaciones de archivo en Revit.')

fam = app.NewFamilyDocument(tpl)
t = Transaction(fam, 'MOBILABs')
t.Start()
mats = {}
for name, col in DATA['materials'].items():
    mid = Material.Create(fam, name)
    m = fam.GetElement(mid)
    h = col.lstrip('#')
    m.Color = Color(int(h[0:2], 16), int(h[2:4], 16), int(h[4:6], 16))
    mats[name] = mid
made = 0
for s in DATA['solids']:
    try:
        o = v(s['o'])
        xd = XYZ(*s['x']).Normalize()
        zd = XYZ(*s['z']).Normalize()
        yd = zd.CrossProduct(xd).Normalize()
        plane = Plane.CreateByOriginAndBasis(o, xd, yd)
        sp = SketchPlane.Create(fam, plane)
        loop = CurveArray()
        if s['k'] == 'box':
            hx = s['dx'] * MM / 2.0
            hy = s['dy'] * MM / 2.0
            pts = [o.Add(xd.Multiply(a)).Add(yd.Multiply(b)) for a, b in ((-hx, -hy), (hx, -hy), (hx, hy), (-hx, hy))]
            for i in range(4):
                loop.Append(Line.CreateBound(pts[i], pts[(i + 1) % 4]))
        else:
            r = s['r'] * MM
            loop.Append(Arc.Create(plane, r, 0.0, math.pi))
            loop.Append(Arc.Create(plane, r, math.pi, 2.0 * math.pi))
        prof = CurveArrArray()
        prof.Append(loop)
        ext = fam.FamilyCreate.NewExtrusion(True, prof, sp, s['h'] * MM)
        p = ext.get_Parameter(BuiltInParameter.MATERIAL_ID_PARAM)
        if p and not p.IsReadOnly:
            p.Set(mats[s['m']])
        made += 1
    except Exception as ex:
        print('No se pudo crear la pieza {0}: {1}'.format(s['n'], ex))
fm = fam.FamilyManager
if fm.CurrentType is None:
    fm.NewType(DATA['typeName'])
add_param(fm, 'MOBILABs Ancho', DATA['dims'][0], True)
add_param(fm, 'MOBILABs Alto', DATA['dims'][1], True)
add_param(fm, 'MOBILABs Fondo', DATA['dims'][2], True)
add_param(fm, 'MOBILABs Material', DATA['mainMat'], False)
add_param(fm, 'MOBILABs Costo aprox CLP', str(int(round(DATA['cost']))), False)
add_param(fm, 'MOBILABs Despiece', DATA['cutText'], False)
add_param(fm, 'MOBILABs Sitio', DATA['site'], False)
t.Commit()

folder = os.path.join(os.environ.get('USERPROFILE', os.path.expanduser('~')), 'Documents', 'MOBILABs')
if not os.path.isdir(folder):
    os.makedirs(folder)
path = os.path.join(folder, DATA['name'] + '.rfa')
opts = SaveAsOptions()
opts.OverwriteExistingFile = True
fam.SaveAs(path, opts)
loaded = False
if doc is not None and not doc.IsFamilyDocument:
    try:
        fam.LoadFamily(doc)
        loaded = True
    except Exception as ex:
        print('La familia quedó guardada, pero no se pudo cargar en el proyecto: {0}'.format(ex))
fam.Close(False)
msg = u'Familia creada con {0} piezas: {1}{2}'.format(made, path, u' (cargada en el proyecto)' if loaded else u'')
print(msg)
if DYNAMO:
    OUT = msg
`;
}
