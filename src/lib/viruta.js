/**
 * Don Viruta: el maestro carpintero de MOBILABs. Poses (imágenes) y mensajes según lo que hace cada usuario.
 * Tono chileno, buena onda y con tallas, pero que sabe de carpintería.
 */
// DonVirutaAssets: todas las poses de src/assets/viruta (WebP o PNG transparente). Para sumar una pose nueva basta con
// dejar el archivo en esa carpeta: el nombre del archivo es el nombre de la pose (ej.: brazos-cruzados.webp).
const FILES = import.meta.glob('../assets/viruta/*.{webp,png}', { eager: true, import: 'default' });
export const POSES = Object.fromEntries(Object.entries(FILES).map(([f, url]) => [f.split('/').pop().replace(/\.(webp|png)$/, ''), url]));
export { default as AVATAR } from '../assets/viruta-avatar.webp';
/** URL de la primera pose que exista de la lista (si ninguna existe todavía, la pose original: saludando). */
export const poseUrl = (...names) => POSES[names.flat().find((n) => POSES[n])] || POSES.saluda;

const pick = (arr) => arr[Math.floor(Math.random() * arr.length)];
const ago = (ms) => (Date.now() - ms) / 86400000; // días

// ---------- consejos de carpintería (se muestra uno al azar) ----------
export const OFICIO = [
  ['mide', 'Mide dos veces y corta una. Yo corté una vez sin medir… y ahora tengo una repisa de adorno.'],
  ['taladro', 'Pre-taladra antes de meter el confirmat, que si no el aglomerado se revienta más rápido que mi paciencia.'],
  ['piensa', 'Una repisa de melamina de 18 no aguanta más de 80 cm cargada. Más larga y se te pone guatona.'],
  ['tabla', 'El tapacanto se pega ANTES de armar. Después es puro sufrimiento, palabra de maestro.'],
  ['planos', 'Lija siempre a favor de la veta: primero grano 120 y después 180. A contrapelo queda como gato mojado.'],
  ['pulgar', 'Mide las diagonales del mueble: si dan iguales, quedó a escuadra. Si no, empuja con cariño hasta que cuadren.'],
  ['taladro', 'Tarugo con cola y confirmat: así el mueble dura más que la tele que le vas a poner encima.'],
  ['piensa', 'La trasera de MDF de 3 mm no es adorno: es la que deja el mueble escuadrado y firme.'],
  ['mide', 'Pide los cortes con 1 o 2 mm de margen y deja el disco de la sierra por fuera de la línea, no encima.'],
  ['apuro', 'Mueble alto y angosto, ¡a la muralla con el kit anti-vuelco! Sobre todo si hay cabros chicos en la casa.'],
  ['cafe', 'Cola fría: aprieta, limpia lo que sale con un paño húmedo y déjala secar tranquila, como el café del maestro.'],
  ['tabla', 'El terciado se ve precioso con aceite o barniz. La melamina ya viene lista: ni la pintes, compadre.'],
  ['piensa', 'Las patas inclinadas son bonitas, pero piensa en los pies: que no sobresalgan del mueble o te vas a tropezar.'],
  ['pulgar', 'Las correderas telescópicas van a la misma altura a los dos lados. Usa un taco de guía y te ahorras el garabato.'],
  ['lista', 'Antes de ir a la ferretería revisa la lista dos veces. El tornillo que se te olvida siempre es el más importante.'],
  ['mide', 'Mide el espesor real del tablero: a veces el de 18 mide 18,3. Medio milímetro, pero suma.'],
  ['planos', 'Corta primero las piezas grandes y después las chicas: así aprovechas mejor la plancha.'],
  ['taladro', 'Para las bisagras de cazoleta usa una broca de 35 mm, a 12 mm del borde y sin atravesar la puerta, ¡ojo!'],
];

// ---------- consejos de la app ----------
const APP = [
  ['derecha', '¿Sabías que tu mueble se va derechito a Revit? Botón Exportar: IFC o familia .rfa, al toque.'],
  ['piensa', 'Escríbeme lo que quieres, tipo "mesa redonda para 6" o "rack de TV de 180 con puertas", y te lo armo al tiro.'],
  ['planos', 'En Planos tienes las vistas con cotas y la ficha técnica, listas para imprimir en PDF.'],
  ['taladro', 'El manual de armado trae fotos de cada paso y la letra de cada pieza. Más fácil que armar un mueble sueco.'],
  ['lista', 'La lista de compras trae precios aproximados y links a Sodimac y Mercado Libre. Ojo: los precios son de referencia.'],
  ['mide', 'En Cortes puedes elegir la medida de la plancha: 183×250, 152×244, 122×244 o la que tenga tu proveedor.'],
  ['pulgar', 'Si algo no cumple, la app lo arregla sola: pone divisores, tapa doble o achica la cajonera. Yo le enseñé.'],
];

/**
 * Mensaje del inicio según lo que está haciendo el usuario.
 * ctx = { name, user, guest, hour, local: { typeName, dims, custom }, designs: [{ name, typeId, updatedAt }], typeNames }
 */
export function homeMessage(ctx) {
  const { user, hour = new Date().getHours(), local, designs, typeNames = {} } = ctx;
  const nm = (ctx.name || '').split(' ')[0];
  const ctxs = [];
  const last = designs && designs[0];
  if (last) {
    const tn = (typeNames[last.typeId] || 'mueble').toLowerCase();
    const d = ago(last.updatedAt);
    if (d > 2) ctxs.push(['lista', `¿Y? ¿Ya compraste los materiales para tu ${tn} "${last.name}"? Te dejé la lista con precios en Compras.`]);
    if (d > 7) ctxs.push(['apuro', `Oye${nm ? `, ${nm}` : ''}, "${last.name}" lleva ${Math.round(d)} días esperando. ¡Ese mueble no se va a armar solo!`]);
    if (d <= 2) ctxs.push(['pulgar', `Ahí quedó guardado "${last.name}". ¿Le seguimos dando o partimos con otro mueble?`]);
    if (designs.length >= 5) ctxs.push(['pulgar', `Llevas ${designs.length} muebles diseñados. A este paso te tengo que pasar el delantal de maestro.`]);
  }
  if (!user) {
    ctxs.push(['apuro', 'Ojo, sin cuenta tus diseños viven solo en este computador. Si se borra el navegador, chao mueble. ¿Te creas una cuenta?']);
    if (local?.custom) ctxs.push(['piensa', `Tienes un ${local.typeName.toLowerCase()} de ${local.dims} a medio camino. Créate una cuenta y lo guardamos en la nube.`]);
  }
  if (local?.custom && user) ctxs.push(['planos', `Tu ${local.typeName.toLowerCase()} de ${local.dims} está esperando. ¿Le damos una vuelta más o lo pasamos a planos?`]);
  if (hour < 12) ctxs.push(['cafe', `Buenos días${nm ? `, ${nm}` : ''}. ¿Un cafecito y a cortar madera?`]);
  else if (hour >= 21 || hour < 5) ctxs.push(['cafe', `Ya es tarde${nm ? `, ${nm}` : ''}. Diseñemos tranqui, que los cortes con sueño salen chuecos.`]);
  if (!designs?.length && user) ctxs.push(['saluda', `¡Bienvenido al taller${nm ? `, ${nm}` : ''}! Soy Don Viruta. ¿Qué vamos a hacer hoy?`]);
  if (!user && !local?.custom) ctxs.push(['saluda', '¡Hola! Soy Don Viruta, maestro carpintero. Dime qué mueble tienes en mente y lo armamos juntos.']);

  // 60 % mensaje según el usuario, 25 % de la app, 15 % del oficio
  const r = Math.random();
  const [pose, text] = ctxs.length && r < 0.6 ? pick(ctxs) : r < 0.85 ? pick(APP) : pick(OFICIO);
  return { pose, text };
}

/** Otro mensaje al azar (botón "otro consejo"). */
export const randomTip = () => { const [pose, text] = Math.random() < 0.6 ? pick(OFICIO) : pick(APP); return { pose, text }; };
