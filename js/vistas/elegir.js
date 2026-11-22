// Cuestionario «¿Cómo la quieres?»: estilo, versión y extras de una receta.
// Sale al tocar una receta que tiene opciones (y desde «Cambiar» en la ficha). Lo elegido se
// recuerda para la próxima vez y la ficha y el modo cocina se adaptan a ello.

import { E, guardar } from '../almacen.js';
import { receta, euros } from '../recetas.js';
import { estilosDe, extrasDe, eleccionActual, guardarEleccion, costeDe, minutosDe, mismaEleccion, resolver } from '../variantes.js';
import { proceso, quitarProceso, fijarPaso } from '../cocina.js';
import { esc } from '../util.js';
import { ico } from '../iconos.js';
import { abrirHoja, confirmar } from '../ui.js';
import { ir, repintar, rutaActual } from '../rutas.js';
import { desbloquear } from '../sonido.js';

const porDefectoDe = (rc, idVersion) => extrasDe(rc, idVersion).filter((x) => x.por_defecto).map((x) => x.id);
const usaRobot = (v) => (v.pasos || []).some((p) => p.tipo === 'robot');
const rango = (a, b, f) => (a === b ? f(a) : `${f(a)}–${f(b)}`);
const precio = (c) => (c ? `${c.completo ? '' : '≈ '}${euros(c.por_racion)}` : '—');

function vecesEstilo(id, estilo) {
  return (E.diario.cocinados || []).filter((c) => c.receta === id && !c.borrado && c.version?.estilo === estilo).length;
}

/** Abre el cuestionario. Al terminar va a la ficha (o al modo cocina, si se pulsa «Empezar»). */
export function abrirEleccion(id) {
  const rc = receta(id);
  if (!rc) return;
  let el = { ...eleccionActual(id), extras: [...eleccionActual(id).extras] };
  const h = abrirHoja('<div id="eleccion"></div>', { clase: 'hoja-eleccion' });

  function pintar() {
    const estilos = estilosDe(rc);
    const est = estilos.find((e) => e.id === el.estilo);
    const v = est.versiones.find((x) => x.id === el.version);
    const extras = extrasDe(rc, v.id);
    const r = resolver(rc, el);
    const tarjetasEstilo = estilos.map((e) => {
      const costes = e.versiones.map((x) => costeDe(rc, { estilo: e.id, version: x.id, extras: porDefectoDe(rc, x.id) })?.por_racion ?? 0);
      const mins = e.versiones.map((x) => minutosDe(rc, { estilo: e.id, version: x.id, extras: porDefectoDe(rc, x.id) }));
      const veces = vecesEstilo(id, e.id);
      return `<button class="opcion-estilo ${e.id === el.estilo ? 'activa' : ''}" data-e="estilo" data-id="${e.id}">
        <span class="emoji-estilo">${e.emoji}</span>
        <b>${esc(e.nombre)}</b>
        <span class="desc">${esc(e.descripcion || '')}</span>
        <span class="datos-opcion">
          <span>${ico('reloj', 'peq')} ${rango(Math.min(...mins), Math.max(...mins), (m) => m)} min</span>
          <span>${costes.length > 1 && Math.min(...costes) !== Math.max(...costes) ? 'desde ' : ''}${euros(Math.min(...costes))}</span>
          ${e.versiones.some(usaRobot) ? `<span class="con-robot">${ico('robot', 'peq')}</span>` : ''}
        </span>
        ${e.versiones.length > 1 ? `<span class="n-versiones">${e.versiones.length} formas de hacerla</span>` : ''}
        ${veces ? `<span class="veces">Hecha ${veces} ${veces === 1 ? 'vez' : 'veces'}</span>` : ''}
      </button>`;
    }).join('');

    const versiones = est.versiones.length > 1 ? `<div class="paso-eleccion"><h3>¿Cuál de ellas?</h3>
      <div class="lista-opciones">${est.versiones.map((x) => {
        const c = costeDe(rc, { estilo: est.id, version: x.id, extras: porDefectoDe(rc, x.id) });
        return `<button class="opcion-version ${x.id === el.version ? 'activa' : ''}" data-e="version" data-id="${x.id}">
          <span class="radio"></span>
          <span class="txt"><b>${esc(x.nombre)}</b><span>${esc(x.descripcion || x.subtitulo || '')}</span></span>
          <span class="datos-opcion col"><span>${ico('reloj', 'peq')} ${minutosDe(rc, { estilo: est.id, version: x.id, extras: porDefectoDe(rc, x.id) })} min</span><span>${precio(c)}</span></span>
        </button>`;
      }).join('')}</div></div>` : '';

    const lista = extras.length ? `<div class="paso-eleccion"><h3>Extras</h3>
      <div class="lista-opciones">${extras.map((x) => {
        const on = el.extras.includes(x.id);
        const porRacion = x.coste ? x.coste.total / (v.porciones || v.coste?.raciones || 4) : null;
        return `<button class="opcion-extra ${on ? 'activa' : ''}" data-e="extra" data-id="${x.id}">
          <span class="interruptor ${on ? 'on' : ''}"></span>
          <span class="txt"><b>${esc(x.nombre)}</b><span>${esc(x.descripcion || '')}</span></span>
          <span class="datos-opcion col">${x.minutos ? `<span>+${x.minutos} min</span>` : ''}${porRacion != null ? `<span>+${euros(porRacion)}</span>` : ''}${x.pasos?.some((p) => p.tipo === 'robot') ? `<span class="con-robot">${ico('robot', 'peq')}</span>` : ''}</span>
        </button>`;
      }).join('')}</div></div>` : '';

    const enCurso = proceso(id);
    h.el.querySelector('#eleccion').innerHTML = `
      <div class="cab-eleccion">
        ${rc.foto ? `<img src="${esc(rc.foto)}" alt="">` : ''}
        <div><h2>¿Cómo la quieres?</h2><p class="tenue">${esc(rc.titulo)}</p></div>
      </div>
      <div class="paso-eleccion"><h3>Estilo</h3><div class="rejilla-estilos n${estilos.length}">${tarjetasEstilo}</div></div>
      ${versiones}${lista}
      <div class="resumen-eleccion">
        <div class="cifras-eleccion">
          <span><b>${r.tiempo_min}</b> min</span>
          <span><b>${precio(r.coste)}</b> por ración</span>
          ${r.nota != null ? `<span><b>${r.nota}/10</b> en el robot</span>` : `<span>${r.sin_robot ? 'Sin robot' : 'Con robot en algún paso'}</span>`}
        </div>
        ${enCurso && !mismaEleccion(enCurso.eleccion, el) ? '<p class="aviso-eleccion">Tienes esta receta a medias con otra versión: si cambias, empezarás de nuevo.</p>' : ''}
        <div class="pie">
          <button class="boton grande" data-e="ver">${ico('recetas')} Ver la receta</button>
          <button class="boton grande principal" data-e="cocinar">${ico('play')} ${enCurso && mismaEleccion(enCurso.eleccion, el) ? 'Continuar' : '<span class="largo">Empezar a cocinar</span><span class="corto">Cocinar</span>'}</button>
        </div>
      </div>`;
  }

  async function confirmarElegido(destino) {
    const enCurso = proceso(id);
    let empezarDeNuevo = false;
    if (enCurso && !mismaEleccion(enCurso.eleccion, el)) {
      if (!(await confirmar('¿Cambiar de versión?', 'Tienes esta receta a medias. Si cambias de versión, empiezas de nuevo (se borran sus temporizadores y lo marcado).', { ok: 'Cambiar y empezar de nuevo', peligro: true }))) return;
      empezarDeNuevo = true;
    }
    // lo marcado (ingredientes, preparación) es de la versión que se estaba enseñando
    if (!mismaEleccion(eleccionActual(id), el)) { delete E.cocina.ingredientes[id]; delete E.cocina.preparacion[id]; }
    if (empezarDeNuevo) quitarProceso(id);
    guardarEleccion(id, el);
    guardar('cocina');
    h.cerrar();
    if (destino === 'cocinar') {
      desbloquear();
      const p = proceso(id);
      if (!p) fijarPaso(id, 0);
      ir(`#/cocinar/${id}/${proceso(id).paso}`);
    } else if (rutaActual().vista === 'receta' && rutaActual().id === id) repintar();
    else ir(`#/receta/${id}`);
  }

  h.el.addEventListener('click', (e) => {
    const b = e.target.closest('[data-e]');
    if (!b) return;
    const tipo = b.dataset.e;
    if (tipo === 'estilo') {
      const est = estilosDe(rc).find((x) => x.id === b.dataset.id);
      const quedar = est.id === el.estilo ? el.version : est.versiones[0].id;
      el = { estilo: est.id, version: quedar, extras: est.id === el.estilo ? el.extras : porDefectoDe(rc, quedar) };
    } else if (tipo === 'version') {
      el = { ...el, version: b.dataset.id, extras: porDefectoDe(rc, b.dataset.id) };
    } else if (tipo === 'extra') {
      const i = el.extras.indexOf(b.dataset.id);
      el = { ...el, extras: i >= 0 ? el.extras.filter((x) => x !== b.dataset.id) : [...el.extras, b.dataset.id] };
    } else { confirmarElegido(tipo); return; }
    pintar();
  });
  pintar();
}
