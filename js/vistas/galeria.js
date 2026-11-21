// Galería de fotos propias de una receta: miniaturas y visor a pantalla completa.

import { E } from '../almacen.js';
import { fotosDe, urlFoto, borrarFoto } from '../fotos.js';
import { esc, fechaLarga } from '../util.js';
import { ico } from '../iconos.js';
import { confirmar, tostada } from '../ui.js';

/** Miniatura cuadrada. `attr` decide qué acción la abre (data-r dentro de hojas, data-a en pantallas). */
export function miniaturaFoto(f, attr = 'data-r="verFoto"') {
  return `<button class="foto-mini" ${attr} data-id="${esc(f.id)}" aria-label="Ver foto"><img data-foto="${esc(f.id)}" alt="" decoding="async"></button>`;
}

let visor = null;

/** Abre la foto `idFoto` de la receta y deja pasar a las demás deslizando o con las flechas. */
export async function abrirVisor(receta, idFoto, { alCambiar } = {}) {
  let lista = fotosDe(receta);
  let i = Math.max(0, lista.findIndex((f) => f.id === idFoto));
  visor?.remove();
  visor = document.createElement('div');
  visor.className = 'visor';
  document.body.appendChild(visor);
  document.body.classList.add('bloqueado');

  async function pintar() {
    const f = lista[i];
    if (!f) { cerrar(); return; }
    const opinion = f.cocinado && (E.diario.cocinados || []).find((c) => c.id === f.cocinado && !c.borrado);
    visor.innerHTML = `
      <div class="visor-barra">
        <span>${i + 1} / ${lista.length} · ${esc(fechaLarga(f.fecha))}</span>
        <div class="fila">
          <button class="boton-redondo vidrio" data-v="borrar" aria-label="Borrar foto">${ico('basura')}</button>
          <button class="boton-redondo vidrio" data-v="cerrar" aria-label="Cerrar">${ico('cerrar')}</button>
        </div>
      </div>
      <div class="visor-imagen"><img alt="" id="visor-img"></div>
      ${opinion?.comentario ? `<p class="visor-pie">«${esc(opinion.comentario)}»</p>` : ''}
      ${lista.length > 1 ? `<button class="visor-flecha izq" data-v="ant" aria-label="Anterior">${ico('atras')}</button>
        <button class="visor-flecha der" data-v="sig" aria-label="Siguiente">${ico('adelante')}</button>` : ''}`;
    const u = await urlFoto(f.id).catch(() => null);
    const img = visor?.querySelector('#visor-img');
    if (img) { if (u) img.src = u; else img.replaceWith(Object.assign(document.createElement('p'), { className: 'visor-pie', textContent: 'Esta foto aún no ha llegado a este aparato.' })); }
  }
  function cerrar() {
    visor?.remove(); visor = null;
    if (!document.querySelector('.capa-hoja, .voz')) document.body.classList.remove('bloqueado');
    document.removeEventListener('keydown', teclas);
  }
  const mover = (d) => { if (lista.length > 1) { i = (i + d + lista.length) % lista.length; pintar(); } };
  function teclas(e) { if (e.key === 'Escape') cerrar(); if (e.key === 'ArrowRight') mover(1); if (e.key === 'ArrowLeft') mover(-1); }
  document.addEventListener('keydown', teclas);

  visor.addEventListener('click', async (e) => {
    const b = e.target.closest('[data-v]');
    if (!b) { if (e.target === visor) cerrar(); return; }
    if (b.dataset.v === 'cerrar') cerrar();
    if (b.dataset.v === 'sig') mover(1);
    if (b.dataset.v === 'ant') mover(-1);
    if (b.dataset.v === 'borrar') {
      if (!(await confirmar('¿Borrar esta foto?', 'Se borra de este aparato y de tu copia de GitHub. No se puede deshacer.', { ok: 'Borrar', peligro: true }))) return;
      await borrarFoto(lista[i].id);
      tostada('Foto borrada');
      lista = fotosDe(receta);
      i = Math.min(i, lista.length - 1);
      alCambiar?.();
      if (!lista.length) cerrar(); else pintar();
    }
  });
  let x0 = null;
  visor.addEventListener('pointerdown', (e) => { x0 = e.clientX; }, { passive: true });
  visor.addEventListener('pointerup', (e) => { if (x0 != null && Math.abs(e.clientX - x0) > 70) mover(e.clientX < x0 ? 1 : -1); x0 = null; }, { passive: true });
  await pintar();
}
