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

// Los botones de «atrás» y «salir» de la app van siempre a una pantalla fija (el menú de recetas,
// la ficha…), nunca «a la anterior del historial»: así no hay bucles entre la ficha y el modo cocina.
export function ir(hash, { reemplazar = false, animar = true } = {}) {
  if (location.hash === hash) { repintar(); return; }
  if (reemplazar) { history.replaceState(null, '', hash); pintar({ animar }); }
  else location.hash = hash;
}

let pintando = false;
export function pintar({ animar = true, conservarScroll = false } = {}) {
  if (pintando) return;          // si algo pide redibujar mientras se dibuja, se ignora (evita bucles)
  const r = ruta();
  const def = vistas[r.vista];
  if (!def) return;
  const app = document.getElementById('app');
  const anterior = actual;
  if (anterior?.def.desmontar) anterior.def.desmontar();
  const hacer = () => {
    pintando = true;
    try {
      app.innerHTML = def.render(r);
      def.montar?.(app, r);
      actual = { def, r, hash: location.hash };
      alPintarFn?.(r);
    } finally { pintando = false; }
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
