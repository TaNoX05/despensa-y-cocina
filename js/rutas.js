// Navegación por "#/…" y reparto de toques a las acciones de cada pantalla.

const vistas = {};
const acciones = {};
const scrolls = new Map();
let alPintarFn = null, actual = null;

export function vista(nombre, def) { vistas[nombre] = def; }
export function accion(obj) { Object.assign(acciones, obj); }
export function alPintar(fn) { alPintarFn = fn; }

export function ruta() {
  const p = location.hash.replace(/^#\/?/, '').split('/').map(decodeURIComponent);
  switch (p[0]) {
    case 'despensa': return { vista: 'despensa' };
    case 'recetas': return { vista: 'recetas', categoria: p[1] || null };
    case 'receta': return p[1] ? { vista: 'receta', id: p[1] } : { vista: 'recetas' };
    case 'cocinar': return p[1] ? { vista: 'cocinar', id: p[1], n: Number(p[2] || 0) } : { vista: 'recetas' };
    case 'ajustes': return { vista: 'ajustes' };
    default: return { vista: null };
  }
}

let navegaciones = 0;
export function ir(hash, { reemplazar = false, animar = true } = {}) {
  if (location.hash === hash) { repintar(); return; }
  if (reemplazar) { history.replaceState(null, '', hash); pintar({ animar }); }
  else { navegaciones++; location.hash = hash; }
}
/** Atrás dentro de la app; si se entró directamente a esta pantalla, va a `defecto`. */
export function volver(defecto) {
  if (navegaciones > 0) { navegaciones--; history.back(); }
  else ir(defecto, { reemplazar: true });
}

export function pintar({ animar = true, conservarScroll = false } = {}) {
  const r = ruta();
  const def = vistas[r.vista];
  if (!def) return;
  const app = document.getElementById('app');
  const anterior = actual;
  if (anterior?.def.desmontar) anterior.def.desmontar();
  const hacer = () => {
    app.innerHTML = def.render(r);
    def.montar?.(app, r);
    actual = { def, r, hash: location.hash };
    alPintarFn?.(r);
  };
  const y = conservarScroll ? window.scrollY : (scrolls.get(location.hash) || 0);
  if (animar && document.startViewTransition && !conservarScroll && anterior) document.startViewTransition(hacer);
  else hacer();
  requestAnimationFrame(() => window.scrollTo(0, y));
}

/** Vuelve a dibujar la pantalla actual sin moverse de sitio. */
export function repintar() { pintar({ animar: false, conservarScroll: true }); }
export const rutaActual = () => actual?.r || ruta();

window.addEventListener('scroll', () => { if (actual) scrolls.set(actual.hash, window.scrollY); }, { passive: true });
window.addEventListener('hashchange', () => pintar());

document.addEventListener('click', (e) => {
  const el = e.target.closest('[data-a]');
  if (!el || el.disabled) return;
  const fn = acciones[el.dataset.a];
  if (!fn) return;
  e.preventDefault();
  fn(el.dataset, el, e);
});
document.addEventListener('input', (e) => {
  const el = e.target.closest('[data-entrada]');
  if (el) acciones[el.dataset.entrada]?.(el.value, el, e);
});
