// Arranque de Despensa y cocina.

import { E, cargar, guardar, alCambiar } from './almacen.js';
import { cargarRecetas, receta } from './recetas.js';
import { iniciarSincro } from './sincro.js';
import { iniciarReloj, procesoPrincipal, proceso, timerMasUrgente, restante, corriendo, alCambiarRelojes } from './cocina.js';
import { mantenerEncendida } from './pantalla.js';
import { desbloquear } from './sonido.js';
import { pintar, alPintar, ir, ruta, rutaActual, repintar } from './rutas.js';
import { hayHoja } from './ui.js';
import { esc, mmss } from './util.js';
import { ico } from './iconos.js';
import { aplicarTema } from './vistas/ajustes.js';
import './vistas/despensa.js';
import './vistas/recetas.js';
import './vistas/receta.js';
import './vistas/cocinar.js';
import './vistas/valorar.js';

// ---------------------------------------------------------------- marco: pestañas y mini reproductor
const PESTANAS = [
  ['despensa', 'Despensa', 'despensa'],
  ['recetas', 'Recetas', 'recetas'],
  ['ajustes', 'Ajustes', 'ajustes'],
];
function pintarMarco(r = rutaActual()) {
  const marco = document.getElementById('marco');
  const enCocina = r.vista === 'cocinar' || r.vista === 'receta';   // pantallas de detalle: sin pestañas
  const activa = r.vista === 'receta' ? 'recetas' : r.vista;
  const id = !enCocina && procesoPrincipal();
  let mini = '';
  if (id && r.vista !== 'recetas') {
    const rc = receta(id), p = proceso(id), x = timerMasUrgente(id);
    const paso = rc.pasos[Math.min(p.paso, rc.pasos.length - 1)];
    mini = `<div class="mini" data-a="irPaso" data-id="${id}" data-n="${p.paso}" role="button">
      ${rc.foto ? `<img src="${esc(rc.foto)}" alt="">` : ''}
      <div class="info"><b>${esc(rc.titulo)}</b><span>Paso ${p.paso + 1} de ${rc.pasos.length} · ${esc(paso.titulo)}</span></div>
      ${x ? `<span class="reloj-mini ${corriendo(x.t) && restante(x.t) <= 0 ? 'fin' : ''}" data-t="${x.clave}">${mmss(Math.max(0, restante(x.t)))}</span>` : ''}
      <button class="ir" data-a="irPaso" data-id="${id}" data-n="${p.paso}">Volver</button>
    </div>`;
  }
  marco.innerHTML = `${mini}
    <nav class="pestanas ${enCocina ? 'escondida' : ''}">
      ${PESTANAS.map(([v, t, i]) => `<button class="pestana ${activa === v ? 'activa' : ''}" data-a="pestana" data-v="${v}">${ico(i)}<span>${t}</span></button>`).join('')}
    </nav>`;
  document.body.classList.toggle('con-mini', !!mini);
}

import { accion } from './rutas.js';
accion({
  pestana: ({ v }) => {
    if (v !== 'ajustes') { E.ajustes.ultimaPestana = v; guardar('ajustes', { silencioso: true }); }
    ir(`#/${v}`);
  },
});

// ---------------------------------------------------------------- arranque
async function arrancar() {
  cargar();
  aplicarTema();
  matchMedia('(prefers-color-scheme: dark)').addEventListener?.('change', aplicarTema);
  try {
    await cargarRecetas();
  } catch {
    document.getElementById('app').innerHTML = '<main class="pantalla"><div class="vacio"><div class="grande">📡</div><p>No se han podido cargar las recetas. Comprueba la conexión y vuelve a abrir la app.</p></div></main>';
    return;
  }
  // limpiar progreso de recetas que ya no existen
  for (const id of Object.keys(E.cocina.cocinando)) if (!receta(id)) delete E.cocina.cocinando[id];

  alPintar(pintarMarco);
  const inicio = ['despensa', 'recetas'].includes(E.ajustes.ultimaPestana) ? E.ajustes.ultimaPestana : 'despensa';
  if (!ruta().vista || ruta().vista === 'ajustes') history.replaceState(null, '', `#/${inicio}`);
  pintar({ animar: false });

  iniciarReloj();
  iniciarSincro();
  mantenerEncendida(E.ajustes.pantallaEncendida);

  // En iPad el sonido y la pantalla encendida necesitan un primer toque.
  document.addEventListener('pointerdown', () => desbloquear(), { once: true, passive: true });

  // Si la copia de GitHub trae cambios, se redibuja (sin molestar si estás escribiendo o con una ventana abierta).
  alCambiar((parte) => {
    if (parte !== 'despensa' && parte !== 'diario') return;
    const r = rutaActual();
    if (r.vista === 'cocinar' || hayHoja() || document.querySelector('.voz') || document.activeElement?.matches?.('input, textarea')) return;
    if (['despensa', 'recetas', 'receta', 'ajustes'].includes(r.vista)) repintar();
  });
  alCambiarRelojes(() => pintarMarco());

  if ('serviceWorker' in navigator && (location.protocol === 'https:' || location.search.includes('sw'))) {
    navigator.serviceWorker.register('sw.js').catch(() => {});
  }
}

arrancar();
