// Piezas de interfaz comunes: hojas (ventanas que suben desde abajo), avisos y confirmaciones.

import { esc } from './util.js';
import { ico } from './iconos.js';

let hojas = [];

export function abrirHoja(html, { clase = '', centrada = true, alCerrar, bloquearFondo = false } = {}) {
  const capa = document.createElement('div');
  capa.className = `capa-hoja ${centrada ? 'centrada' : ''}`;
  capa.innerHTML = `<div class="hoja ${clase}" role="dialog" aria-modal="true"><div class="asa"></div>${html}</div>`;
  document.body.appendChild(capa);
  document.body.classList.add('bloqueado');
  const hoja = { el: capa.querySelector('.hoja'), capa, cerrar: () => cerrar(hoja), alCerrar };
  hojas.push(hoja);
  if (!bloquearFondo) capa.addEventListener('click', (e) => { if (e.target === capa) cerrar(hoja); });
  return hoja;
}

export function cerrar(hoja = hojas[hojas.length - 1]) {
  if (!hoja || !hojas.includes(hoja)) return;
  hojas = hojas.filter((h) => h !== hoja);
  hoja.capa.classList.add('cerrando');
  setTimeout(() => hoja.capa.remove(), 220);
  if (!hojas.length && !document.querySelector('.voz')) document.body.classList.remove('bloqueado');
  hoja.alCerrar?.();
}
export function cerrarTodas() { [...hojas].forEach((h) => cerrar(h)); }
export const hayHoja = () => hojas.length > 0;

document.addEventListener('keydown', (e) => { if (e.key === 'Escape' && hojas.length) cerrar(); });

export function confirmar(titulo, texto = '', { ok = 'Aceptar', cancelar = 'Cancelar', peligro = false } = {}) {
  return new Promise((resolver) => {
    let respuesta = false;
    const h = abrirHoja(`
      <h2>${esc(titulo)}</h2>${texto ? `<p class="tenue" style="font-size:18px">${esc(texto)}</p>` : ''}
      <div class="pie">
        <button class="boton grande" data-r="no">${esc(cancelar)}</button>
        <button class="boton grande ${peligro ? 'peligro' : 'principal'}" data-r="si">${esc(ok)}</button>
      </div>`, { alCerrar: () => resolver(respuesta) });
    h.el.addEventListener('click', (e) => {
      const b = e.target.closest('[data-r]');
      if (!b) return;
      respuesta = b.dataset.r === 'si';
      h.cerrar();
    });
  });
}

const contenedorTostadas = () => {
  let c = document.querySelector('.tostadas');
  if (!c) { c = document.createElement('div'); c.className = 'tostadas'; document.body.appendChild(c); }
  return c;
};

/** Aviso breve arriba. ms = 0 lo deja hasta que se cierre. */
export function tostada(texto, { accion, alAccion, ms = 3200, tipo = '', icono } = {}) {
  const t = document.createElement('div');
  t.className = `tostada ${tipo}`;
  t.innerHTML = `${icono ? ico(icono) : ''}<span>${esc(texto)}</span>${accion ? `<button>${esc(accion)}</button>` : ''}`;
  const quitar = () => { if (!t.isConnected) return; t.classList.add('saliendo'); setTimeout(() => t.remove(), 250); };
  t.querySelector('button')?.addEventListener('click', () => { alAccion?.(); quitar(); });
  t.addEventListener('click', (e) => { if (!e.target.closest('button') && !accion) quitar(); });
  contenedorTostadas().appendChild(t);
  if (ms) setTimeout(quitar, ms);
  return quitar;
}
