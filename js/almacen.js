// Estado de la app guardado en el propio iPad (localStorage).
// La despensa y el diario se copian además en GitHub (ver sincro.js).

const PREFIJO = 'dyc:';

export const POR_DEFECTO = {
  despensa: { productos: [], registro: [] },
  diario: { cocinados: [] },
  cocina: { cocinando: {}, ingredientes: {}, preparacion: {} },
  ajustes: {
    tema: 'auto',
    pantallaEncendida: true,
    openrouterClave: '',
    github: { repo: '', token: '', rama: 'main', api: 'https://api.github.com' },
    ultimaPestana: 'despensa',
    ayudaInstalarVista: false,
  },
};

export const E = {};
const oyentes = new Set();
let alGuardarSincronizable = null;

function copia(x) { return JSON.parse(JSON.stringify(x)); }
function mezclar(base, guardado) {
  if (!guardado || typeof guardado !== 'object' || Array.isArray(base)) return guardado ?? base;
  const r = { ...base };
  for (const k of Object.keys(guardado)) {
    r[k] = base[k] && typeof base[k] === 'object' && !Array.isArray(base[k]) ? mezclar(base[k], guardado[k]) : guardado[k];
  }
  return r;
}

export function cargar() {
  for (const k of Object.keys(POR_DEFECTO)) {
    let g = null;
    try { g = JSON.parse(localStorage.getItem(PREFIJO + k) || 'null'); } catch { g = null; }
    E[k] = mezclar(copia(POR_DEFECTO[k]), g);
  }
}

/** Guarda una parte del estado y avisa a quien escuche. */
export function guardar(parte, { sincronizar = true, silencioso = false } = {}) {
  try { localStorage.setItem(PREFIJO + parte, JSON.stringify(E[parte])); }
  catch (e) { console.warn('No se ha podido guardar en el iPad', e); }
  if (sincronizar && (parte === 'despensa' || parte === 'diario')) alGuardarSincronizable?.(parte);
  if (!silencioso) for (const fn of [...oyentes]) fn(parte);   // copia: apuntarse durante el aviso no crea bucles
}

export function alCambiar(fn) { oyentes.add(fn); return () => oyentes.delete(fn); }
export function alGuardarDatos(fn) { alGuardarSincronizable = fn; }

export function exportar() {
  return { app: 'despensa-y-cocina', version: 1, fecha: new Date().toISOString(), despensa: E.despensa, diario: E.diario, cocina: E.cocina };
}
export function importar(datos) {
  if (!datos || datos.app !== 'despensa-y-cocina') throw new Error('Este fichero no es una copia de la app.');
  for (const k of ['despensa', 'diario', 'cocina']) if (datos[k]) { E[k] = mezclar(copia(POR_DEFECTO[k]), datos[k]); guardar(k); }
}
export function borrarTodo() {
  for (const k of ['despensa', 'diario', 'cocina']) { E[k] = copia(POR_DEFECTO[k]); guardar(k); }
}
