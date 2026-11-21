// "¿Qué tal ha salido?": valoración, cómo ha salido y qué cambiar, guardado en el diario.
// Al terminar desde el modo cocina, propone restar los ingredientes de la despensa.

import { E, guardar } from '../almacen.js';
import { proceso } from '../cocina.js';
import { aplicarAcciones, deshacerCambios, activos } from '../despensa.js';
import { esc, nuevoId, hoyISO } from '../util.js';
import { ico, ESTRELLA } from '../iconos.js';
import { abrirHoja, tostada } from '../ui.js';
import { ia, iaConfigurada } from '../conexion.js';
import { dictarEn } from './voz.js';

const ETIQUETAS = ['Perfecta', 'La repetiría', 'Sosa', 'Salada', 'Seca', 'Muy caldosa', 'Le faltó cocción', 'Pasada de punto', 'Picante', 'Mucho trabajo', 'Tiempos justos', 'Ajustaría tiempos'];
const TEXTOS_ESTRELLAS = ['', 'No me ha gustado', 'Regular', 'Bien', 'Muy buena', '¡Para repetir!'];

export function abrirValoracion(rc, { desdeCocina = false, idCocinado = null, alGuardar } = {}) {
  const existente = idCocinado ? E.diario.cocinados.find((c) => c.id === idCocinado) : null;
  const pr = desdeCocina ? proceso(rc.id) : null;
  const notas = existente?.notas_pasos || Object.entries(pr?.notas || {}).map(([n, texto]) => ({ paso: Number(n) + 1, titulo: rc.pasos[n]?.titulo || '', texto }));
  let valor = existente?.valoracion || 0;
  const etiquetas = new Set(existente?.etiquetas || []);

  const h = abrirHoja(`
    <div style="display:flex;gap:16px;align-items:center">
      ${rc.foto ? `<img src="${esc(rc.foto)}" alt="" style="width:76px;height:76px;border-radius:18px;object-fit:cover">` : ''}
      <div><h2 style="margin:0">${existente ? 'Editar' : desdeCocina ? '¡Terminado! ¿Qué tal ha salido?' : 'Apuntar que la he hecho'}</h2>
      <p class="tenue">${esc(rc.titulo)}</p></div>
    </div>
    <div class="estrellas" id="estrellas">${[1, 2, 3, 4, 5].map((i) => `<button class="estrella ${i <= valor ? 'on' : ''}" data-r="estrella" data-v="${i}" aria-label="${i} estrellas">${ESTRELLA}</button>`).join('')}</div>
    <p class="tenue" style="text-align:center;font-weight:650" id="texto-estrellas">${TEXTOS_ESTRELLAS[valor] || 'Toca las estrellas'}</p>
    <div class="etiquetas-opcion" id="etiquetas">${ETIQUETAS.map((t) => `<button class="${etiquetas.has(t) ? 'activo' : ''}" data-r="etiqueta" data-t="${esc(t)}">${esc(t)}</button>`).join('')}</div>
    <div class="campo area-voz"><span>¿Cómo ha salido?</span>
      <textarea class="area" id="v-comentario" placeholder="Textura, sabor, si ha gustado en casa…">${esc(existente?.comentario || '')}</textarea>
      <button class="dictar" data-r="dictar" data-area="v-comentario" aria-label="Dictar">${ico('mic')}</button></div>
    <div class="campo area-voz"><span>¿Qué cambiarías la próxima vez?</span>
      <textarea class="area" id="v-cambios" placeholder="Más tiempo en el paso 5, menos sal, el doble de salsa…">${esc(existente?.cambios || '')}</textarea>
      <button class="dictar" data-r="dictar" data-area="v-cambios" aria-label="Dictar">${ico('mic')}</button></div>
    ${notas.length ? `<div class="campo"><span>Tus notas de los pasos</span>${notas.map((n) => `<p class="nota-paso" style="margin-top:8px">${ico('nota')}<span><b>Paso ${n.paso} · ${esc(n.titulo)}:</b> ${esc(n.texto)}</span></p>`).join('')}</div>` : ''}
    <label class="campo"><span>Fecha</span><input class="entrada" type="date" id="v-fecha" value="${esc((existente?.fecha || hoyISO()).slice(0, 10))}"></label>
    <div class="pie">
      ${existente ? '<button class="boton grande peligro" data-r="borrar">Borrar</button>' : desdeCocina ? '<button class="boton grande" data-r="sinValorar">Terminar sin valorar</button>' : '<button class="boton grande" data-r="no">Cancelar</button>'}
      <button class="boton grande principal" data-r="guardar">${ico('check')} Guardar</button>
    </div>
    <p class="muy-tenue" style="font-size:14px;margin-top:12px;text-align:center">Se guarda en tu historial${E.ajustes.github.repo ? ' y en tu copia de GitHub' : ''}: así, cuando me pidas mejorar la receta, sé qué falló.</p>`,
  { bloquearFondo: true });

  h.el.addEventListener('click', (e) => {
    const b = e.target.closest('[data-r]'); if (!b) return;
    const r = b.dataset.r;
    if (r === 'estrella') {
      valor = Number(b.dataset.v) === valor ? 0 : Number(b.dataset.v);
      h.el.querySelectorAll('.estrella').forEach((x) => x.classList.toggle('on', Number(x.dataset.v) <= valor));
      h.el.querySelector('#texto-estrellas').textContent = TEXTOS_ESTRELLAS[valor] || 'Toca las estrellas';
      return;
    }
    if (r === 'etiqueta') { const t = b.dataset.t; etiquetas.has(t) ? etiquetas.delete(t) : etiquetas.add(t); b.classList.toggle('activo'); return; }
    if (r === 'dictar') { dictarEn(b, h.el.querySelector('#' + b.dataset.area)); return; }
    if (r === 'no') { h.cerrar(); return; }
    if (r === 'borrar') {
      Object.assign(existente, { borrado: true, actualizado: Date.now() });
      guardar('diario'); h.cerrar(); alGuardar?.(); tostada('Borrado del historial');
      return;
    }
    // guardar o terminar sin valorar
    const sin = r === 'sinValorar';
    const fecha = h.el.querySelector('#v-fecha').value || hoyISO();
    const datos = {
      receta: rc.id, titulo: rc.titulo, fecha,
      valoracion: sin ? null : (valor || null),
      etiquetas: sin ? [] : [...etiquetas],
      comentario: sin ? '' : h.el.querySelector('#v-comentario').value.trim(),
      cambios: sin ? '' : h.el.querySelector('#v-cambios').value.trim(),
      notas_pasos: notas,
      actualizado: Date.now(),
    };
    if (existente) Object.assign(existente, datos);
    else {
      if (pr?.iniciada) datos.duracion_min = Math.round((Date.now() - pr.iniciada) / 60000);
      E.diario.cocinados.unshift({ id: nuevoId(), ...datos });
    }
    guardar('diario');
    h.cerrar();
    tostada(existente ? 'Cambios guardados' : '¡Apuntado en tu historial!', { icono: 'check' });
    alGuardar?.();
    if (desdeCocina && !existente) setTimeout(() => ofrecerDescontar(rc), 450);
  });
}

/** Tras cocinar: propone qué restar de la despensa (lo calcula la IA) y deja elegir. */
export async function ofrecerDescontar(rc) {
  if (!iaConfigurada() || !activos(E.despensa.productos).some((p) => p.cantidad !== 0)) return;
  const h = abrirHoja(`<h2>¿Lo resto de la despensa?</h2>
    <p class="tenue">Estoy mirando qué has gastado de lo que tienes apuntado…</p>
    <div class="voz pensando" style="position:static;background:none;backdrop-filter:none;-webkit-backdrop-filter:none;padding:20px 0;animation:none">
      <div class="orbe" style="width:90px;height:90px">${ico('chispa')}</div></div>`);
  let propuesta;
  try {
    propuesta = await ia().descontarReceta(rc, E.despensa.productos);
  } catch (e) {
    h.el.innerHTML = `<div class="asa"></div><h2>No he podido calcularlo</h2><p class="tenue">${esc(e.message)}</p><div class="pie"><button class="boton grande" data-r="no">Cerrar</button></div>`;
    h.el.addEventListener('click', (ev) => { if (ev.target.closest('[data-r]')) h.cerrar(); });
    return;
  }
  const simulacion = aplicarAcciones(E.despensa.productos, propuesta.acciones);
  const filas = simulacion.cambios.map((c, i) => ({ c, a: propuesta.acciones[i] })).filter((x) => x.c.id);
  if (!filas.length) { h.cerrar(); return; }
  const elegidos = new Set(filas.map((_, i) => i));
  h.el.innerHTML = `<div class="asa"></div><h2>¿Lo resto de la despensa?</h2>
    <p class="tenue">Esto es lo que calculo que has gastado. Quita lo que no quieras restar.</p>
    <div style="margin-top:10px">${filas.map(({ c }, i) => `<button class="ingrediente fila-descontar marcado" data-r="fila" data-i="${i}">
      <span class="casilla">${ico('check')}</span><span class="txt"><span style="font-size:24px;margin-right:8px">${esc(c.emoji)}</span><b>${esc(c.nombre)}</b> <span class="tenue">· ${esc(c.detalle)}</span></span></button>`).join('')}</div>
    <div class="pie"><button class="boton grande" data-r="no">No restar nada</button><button class="boton grande principal" data-r="si">${ico('check')} Restar</button></div>`;
  h.el.addEventListener('click', (e) => {
    const b = e.target.closest('[data-r]'); if (!b) return;
    if (b.dataset.r === 'fila') {
      const i = Number(b.dataset.i);
      elegidos.has(i) ? elegidos.delete(i) : elegidos.add(i);
      b.classList.toggle('marcado', elegidos.has(i));
      return;
    }
    if (b.dataset.r === 'si' && elegidos.size) {
      const acciones = filas.filter((_, i) => elegidos.has(i)).map((x) => x.a);
      const res = aplicarAcciones(E.despensa.productos, acciones);
      E.despensa.productos = res.productos;
      guardar('despensa');
      tostada(`Restados ${res.cambios.filter((c) => c.id).length} productos de la despensa`, {
        accion: 'Deshacer', ms: 7000,
        alAccion: () => { E.despensa.productos = deshacerCambios(E.despensa.productos, res.cambios); guardar('despensa'); },
      });
    }
    h.cerrar();
  });
}
