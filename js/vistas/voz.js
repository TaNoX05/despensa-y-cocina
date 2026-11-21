// Ventana de voz de la despensa: escuchar → entender → apuntar (con deshacer).
// También el dictado de notas y opiniones (dictarEn).

import { E, guardar } from '../almacen.js';
import { aplicarAcciones, deshacerCambios } from '../despensa.js';
import { esc, nuevoId } from '../util.js';
import { ico } from '../iconos.js';
import { ia, iaConfigurada } from '../conexion.js';
import { empezarGrabacion, vozDisponible } from '../voz.js';
import { desbloquear } from '../sonido.js';
import { abrirHoja, tostada, hayHoja } from '../ui.js';
import { ir } from '../rutas.js';

let capa = null, grabacion = null, cambios = [], deshechos = new Set(), cuenta = null, alCerrarFn = null, ultimo = {};

const EJEMPLOS = [
  '«He comprado dos bricks de leche y una docena de huevos»',
  '«Se ha acabado el tomate triturado»',
  '«Me quedan tres yogures; caducan el viernes»',
  '«He pasado el pollo al congelador»',
];

function comprobar() {
  if (!iaConfigurada()) {
    tostada('Para usar la voz, pon tu clave de OpenRouter en Ajustes', { accion: 'Ir', alAccion: () => ir('#/ajustes'), ms: 6000 });
    return false;
  }
  return true;
}

function abrirCapa() {
  capa = document.createElement('div');
  capa.className = 'voz';
  document.body.appendChild(capa);
  document.body.classList.add('bloqueado');
  capa.addEventListener('click', clic);
  capa.addEventListener('pointerdown', () => pararCuenta(), { passive: true });
}

export function cerrarVoz() {
  if (!capa) return;
  grabacion?.cancelar(); grabacion = null;
  pararCuenta();
  const c = capa; capa = null;
  c.classList.add('cerrando');
  setTimeout(() => c.remove(), 220);
  if (!hayHoja()) document.body.classList.remove('bloqueado');
  const ids = cambios.filter((x, i) => x.id && !deshechos.has(i) && x.tipo !== 'fuera').map((x) => x.id);
  alCerrarFn?.(ids);
}

function pintar(estado, d = {}) {
  if (!capa) return;
  capa.className = `voz ${estado}`;
  const orbe = (icono, accionOrbe = '') => `<div class="orbe-zona">
      <div class="anillo-voz" id="anillo1"></div><div class="anillo-voz dos" id="anillo2"></div>
      <button class="orbe" ${accionOrbe ? `data-v="${accionOrbe}"` : ''}>${ico(icono)}</button></div>`;
  const cerrarBtn = `<button class="boton-redondo cerrar" data-v="cerrar" aria-label="Cerrar">${ico('cerrar')}</button>`;
  if (estado === 'escuchando') {
    capa.innerHTML = `${cerrarBtn}${orbe('parar', 'parar')}
      <div class="estado">Te escucho…</div><div class="crono" id="crono">0:00</div>
      <p class="ayuda">Habla con normalidad; cuando termines, toca el círculo o espera un momento.<br><span class="muy-tenue">${EJEMPLOS[Math.floor(Math.random() * EJEMPLOS.length)]}</span></p>`;
  } else if (estado === 'pensando') {
    capa.innerHTML = `${cerrarBtn}${orbe('chispa')}
      <div class="estado">${esc(d.fase || 'Entendiendo…')}</div>
      ${d.texto ? `<p class="transcripcion">«${esc(d.texto)}»</p>` : ''}`;
  } else if (estado === 'hecho' || estado === 'nada') {
    const lista = cambios.map((c, i) => `<div class="cambio ${deshechos.has(i) ? 'deshecho' : ''}" style="animation-delay:${i * 60}ms">
        <span class="marca ${c.tipo === 'nada' ? 'cero' : c.tipo}">${{ mas: '+', menos: '−', cero: '0', fuera: '✕', mover: '→', nada: '?' }[c.tipo] || '·'}</span>
        <span class="emoji">${esc(c.emoji || '')}</span>
        <span class="txt"><b>${esc(c.nombre)}</b><span>${esc(c.detalle)}</span></span>
        ${c.id && !deshechos.has(i) ? `<button class="boton peq" data-v="deshacer" data-i="${i}">${ico('deshacer', 'peq')}</button>` : ''}
      </div>`).join('');
    capa.innerHTML = `${cerrarBtn}${orbe(estado === 'hecho' ? 'check' : 'chispa')}
      <div class="estado ${(d.respuesta || '').length > 70 ? 'largo' : ''}">${esc(d.respuesta || (estado === 'hecho' ? 'Hecho' : 'No he cambiado nada'))}</div>
      ${d.texto ? `<p class="transcripcion" style="font-size:18px;color:var(--texto-2)">«${esc(d.texto)}»</p>` : ''}
      ${lista ? `<div class="cambios">${lista}</div>` : ''}
      <div class="botones">
        ${cambios.some((c) => c.id) ? `<button class="boton grande" data-v="deshacerTodo">${ico('deshacer')} Deshacer todo</button>` : ''}
        <button class="boton grande" data-v="otraVez">${ico('mic')} Decir más</button>
        <button class="boton grande principal" data-v="cerrar">${ico('check')} Listo</button>
      </div>
      ${estado === 'hecho' ? '<div class="cuenta-atras"><div id="barra-cierre"></div></div>' : ''}`;
    if (estado === 'hecho') empezarCuenta(9);
  } else if (estado === 'error') {
    capa.innerHTML = `${cerrarBtn}${orbe('aviso')}
      <div class="estado">Vaya…</div><p class="ayuda" style="font-size:19px;color:var(--texto)">${esc(d.mensaje)}</p>
      <div class="botones">
        ${ultimo.audio || ultimo.texto ? `<button class="boton grande principal" data-v="reintentar">${ico('reiniciar')} Reintentar</button>` : ''}
        <button class="boton grande" data-v="otraVez">${ico('mic')} Hablar otra vez</button>
        <button class="boton grande" data-v="escribir">${ico('teclado')} Escribirlo</button>
      </div>`;
  }
}

function empezarCuenta(seg) {
  pararCuenta();
  const barra = document.getElementById('barra-cierre');
  if (!barra) return;
  const t0 = Date.now();
  cuenta = setInterval(() => {
    const f = 1 - (Date.now() - t0) / (seg * 1000);
    barra.style.transform = `scaleX(${Math.max(0, f)})`;
    if (f <= 0) cerrarVoz();
  }, 50);
}
function pararCuenta() {
  if (!cuenta) return;
  clearInterval(cuenta); cuenta = null;
  const b = document.getElementById('barra-cierre'); if (b) b.parentElement.style.visibility = 'hidden';
}

async function escuchar() {
  cambios = []; deshechos = new Set(); ultimo = {};
  pintar('escuchando');
  try {
    grabacion = await empezarGrabacion({
      alNivel: (n, t) => {
        const a = document.getElementById('anillo1'), b = document.getElementById('anillo2'), c = document.getElementById('crono');
        if (a) a.style.transform = `scale(${0.72 + n * 0.55})`;
        if (b) b.style.transform = `scale(${0.8 + n * 0.75})`;
        if (c) { const s = Math.floor(t / 1000); c.textContent = `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`; }
      },
    });
    const audio = await grabacion.fin;
    grabacion = null;
    if (!capa) return;
    if (!audio) { cerrarVoz(); return; }
    await procesar({ audio });
  } catch (e) {
    grabacion = null;
    pintar('error', { mensaje: e.message || 'No he podido grabar.' });
  }
}

async function procesar({ audio, texto }) {
  ultimo = { audio, texto };
  try {
    const cliente = ia();
    if (audio && !texto) {
      pintar('pensando', { fase: 'Pasando tu voz a texto…' });
      const r = await cliente.transcribir(audio);
      texto = r.texto;
      ultimo.texto = texto;
      if (!texto || texto.length < 2) throw new Error('No he oído nada claro. Prueba otra vez, un poco más cerca del iPad.');
    }
    if (!capa) return;
    pintar('pensando', { fase: 'Apuntándolo…', texto });
    const r = await cliente.interpretarDespensa(texto, E.despensa.productos);
    if (!capa) return;
    const res = aplicarAcciones(E.despensa.productos, r.acciones);
    cambios = res.cambios;
    if (cambios.some((c) => c.id)) {
      E.despensa.productos = res.productos;
      E.despensa.registro = [{ id: nuevoId(), fecha: Date.now(), actualizado: Date.now(), texto, respuesta: r.respuesta,
        cambios: cambios.map(({ tipo, nombre, detalle }) => ({ tipo, nombre, detalle })) }, ...(E.despensa.registro || [])].slice(0, 100);
      guardar('despensa', { silencioso: true });
    }
    pintar(cambios.some((c) => c.id) ? 'hecho' : 'nada', { respuesta: r.respuesta, texto });
  } catch (e) {
    pintar('error', { mensaje: e.message });
  }
}

function deshacer(indices) {
  const lista = indices.filter((i) => !deshechos.has(i) && cambios[i]?.id);
  if (!lista.length) return;
  E.despensa.productos = deshacerCambios(E.despensa.productos, lista.map((i) => cambios[i]));
  lista.forEach((i) => deshechos.add(i));
  guardar('despensa', { silencioso: true });
  const todo = cambios.every((c, i) => !c.id || deshechos.has(i));
  pintar(todo ? 'nada' : 'hecho', { respuesta: todo ? 'Deshecho: la despensa está como antes' : 'Cambio deshecho' });
  pararCuenta();
}

function clic(e) {
  const b = e.target.closest('[data-v]');
  if (!b) return;
  switch (b.dataset.v) {
    case 'cerrar': cerrarVoz(); break;
    case 'parar': grabacion?.parar(); break;
    case 'otraVez': escuchar(); break;
    case 'reintentar': procesar(ultimo); break;
    case 'escribir': { const f = alCerrarFn; alCerrarFn = null; cerrarVoz(); abrirTexto({ alCerrar: f, texto: ultimo.texto }); break; }
    case 'deshacer': deshacer([Number(b.dataset.i)]); break;
    case 'deshacerTodo': deshacer(cambios.map((_, i) => i)); break;
  }
}

/** Botón grande de la despensa. */
export function abrirVoz({ alCerrar } = {}) {
  desbloquear();
  if (!comprobar()) return;
  if (!vozDisponible()) { tostada('Este navegador no deja usar el micrófono. Prueba a escribirlo.'); abrirTexto({ alCerrar }); return; }
  alCerrarFn = alCerrar;
  abrirCapa();
  escuchar();
}

/** Lo mismo pero escribiendo. */
export function abrirTexto({ alCerrar, texto = '' } = {}) {
  if (!comprobar()) return;
  const h = abrirHoja(`<h2>Escríbelo</h2><p class="tenue">Como si me lo dijeras: «2 latas de atún a la despensa y se acabó el pan».</p>
    <label class="campo"><textarea class="area" id="texto-despensa" placeholder="He comprado…">${esc(texto)}</textarea></label>
    <div class="pie"><button class="boton grande" data-r="no">Cancelar</button><button class="boton grande principal" data-r="si">${ico('enviar')} Apuntar</button></div>`);
  setTimeout(() => h.el.querySelector('textarea').focus(), 350);
  h.el.addEventListener('click', (e) => {
    const b = e.target.closest('[data-r]'); if (!b) return;
    const t = h.el.querySelector('textarea').value.trim();
    h.cerrar();
    if (b.dataset.r !== 'si' || !t) return;
    alCerrarFn = alCerrar; cambios = []; deshechos = new Set();
    abrirCapa();
    procesar({ texto: t });
  });
}

/** Dictado para un cuadro de texto: un toque empieza, otro (o callarse) termina. */
export async function dictarEn(boton, area) {
  desbloquear();
  if (boton._grabacion) { boton._grabacion.parar(); return; }
  if (!iaConfigurada()) { tostada('Para dictar, pon tu clave de OpenRouter en Ajustes'); return; }
  try {
    boton.classList.add('grabando');
    boton.innerHTML = ico('parar');
    boton._grabacion = await empezarGrabacion({ silencioMs: 2500, maxMs: 120000 });
    const audio = await boton._grabacion.fin;
    boton._grabacion = null;
    boton.classList.remove('grabando');
    if (!audio) return;
    boton.classList.add('pensando'); boton.innerHTML = ico('chispa');
    const r = await ia().transcribir(audio, { prompt: 'Opinión sobre una receta de cocina casera española.' });
    if (r.texto) area.value = (area.value.trim() ? area.value.trim() + ' ' : '') + r.texto;
    area.dispatchEvent(new Event('input', { bubbles: true }));
  } catch (e) {
    tostada(e.message || 'No he podido dictar');
  } finally {
    boton._grabacion = null;
    boton.classList.remove('grabando', 'pensando');
    boton.innerHTML = ico('mic');
  }
}
