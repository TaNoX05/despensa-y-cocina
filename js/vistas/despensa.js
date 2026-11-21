// Pantalla de la despensa: lo que hay en casa, por sitios, con el botón grande de voz.

import { E, guardar } from '../almacen.js';
import { LUGARES, UNIDADES, cantidadTexto, paso as pasoDe, activos } from '../despensa.js';
import { esc, normalizar, diasHasta, nuevoId } from '../util.js';
import { ico } from '../iconos.js';
import { vista, accion } from '../rutas.js';
import { abrirHoja, confirmar, tostada } from '../ui.js';
import { abrirVoz, abrirTexto } from './voz.js';

let filtro = 'todo';
let busqueda = '';

const enCasa = (p) => p.cantidad !== 0;
const ordenar = (a, b) => a.nombre.localeCompare(b.nombre, 'es');

function filtrados() {
  const q = normalizar(busqueda);
  return activos(E.despensa.productos).filter((p) => !q || normalizar(p.nombre).includes(q));
}

function etiquetaCaduca(p) {
  const d = diasHasta(p.caduca);
  if (d == null) return '';
  if (d < 0) return `<div class="caduca ya">Caducado</div>`;
  if (d === 0) return `<div class="caduca ya">Caduca hoy</div>`;
  if (d === 1) return `<div class="caduca">Caduca mañana</div>`;
  if (d <= 4) return `<div class="caduca">Caduca en ${d} días</div>`;
  const [, m, dd] = p.caduca.split('-');
  return `<div class="caduca" style="color:var(--texto-3)">Cad. ${Number(dd)}/${Number(m)}</div>`;
}

export function tarjetaProducto(p) {
  const agotado = p.cantidad === 0;
  return `<div class="producto ${agotado ? 'agotado' : ''}" data-producto="${p.id}">
    <button class="zona" data-a="editarProducto" data-id="${p.id}">
      <span class="emoji">${esc(p.emoji || '🛒')}</span>
      <span class="datos"><span class="nombre">${esc(p.nombre)}</span>
        <span class="cant">${esc(cantidadTexto(p))}</span>${etiquetaCaduca(p)}</span>
    </button>
    <div class="stepper">
      <button data-a="masProducto" data-id="${p.id}" aria-label="Más">${ico('mas', 'peq')}</button>
      ${agotado ? '' : `<button data-a="menosProducto" data-id="${p.id}" aria-label="Menos">${ico('menos', 'peq')}</button>`}
    </div>
  </div>`;
}

function seccion(titulo, emoji, lista, extra = '') {
  if (!lista.length) return '';
  return `<h2 class="seccion-titulo">${emoji} ${esc(titulo)} <span class="cuenta">${lista.length}</span>${extra}</h2>
    <div class="rejilla-productos">${lista.sort(ordenar).map(tarjetaProducto).join('')}</div>`;
}

function cuerpoLista() {
  const todos = filtrados();
  if (!activos(E.despensa.productos).length) {
    return `<div class="vacio"><div class="grande">🧺</div>
      <h2 class="serif" style="font-size:28px;color:var(--texto)">Tu despensa está vacía</h2>
      <p style="margin-top:8px">Pulsa el micrófono y dime lo que tienes, por ejemplo:<br>
      <i>«Tengo seis huevos, dos bricks de leche, un paquete de arroz y medio kilo de champiñones en la nevera»</i></p></div>`;
  }
  if (!todos.length) return `<div class="vacio"><div class="grande">🔍</div><p>No hay nada que se llame «${esc(busqueda)}».</p></div>`;
  const comprar = todos.filter((p) => !enCasa(p));
  let html = '';
  if (filtro === 'comprar') {
    html = seccion('Para comprar', '🛒', comprar) || `<div class="vacio"><div class="grande">✅</div><p>No falta nada. Cuando algo se acabe, aparecerá aquí.</p></div>`;
  } else {
    for (const [id, l] of Object.entries(LUGARES)) {
      if (filtro !== 'todo' && filtro !== id) continue;
      html += seccion(l.nombre, l.emoji, todos.filter((p) => enCasa(p) && p.lugar === id));
    }
    if (filtro === 'todo') html += seccion('Para comprar', '🛒', comprar);
    if (!html) html = `<div class="vacio"><p>Aquí no hay nada todavía.</p></div>`;
  }
  return html;
}

function filtrosHtml() {
  const vivos = activos(E.despensa.productos);
  const n = (f) => vivos.filter(f).length;
  const opciones = [
    ['todo', 'Todo', n(enCasa)],
    ...Object.entries(LUGARES).map(([id, l]) => [id, `${l.emoji} ${l.nombre}`, n((p) => enCasa(p) && p.lugar === id)]),
    ['comprar', '🛒 Para comprar', n((p) => !enCasa(p))],
  ];
  return opciones.map(([id, txt, c]) => `<button class="filtro ${filtro === id ? 'activo' : ''}" data-a="filtroDespensa" data-f="${id}">${txt} <span class="cuenta">${c}</span></button>`).join('');
}

function subtitulo() {
  const vivos = activos(E.despensa.productos);
  const casa = vivos.filter(enCasa).length, faltan = vivos.length - casa;
  const caducan = vivos.filter((p) => enCasa(p) && diasHasta(p.caduca) != null && diasHasta(p.caduca) <= 3).length;
  if (!vivos.length) return 'Dímelo con la voz y lo apunto yo';
  return [`${casa} ${casa === 1 ? 'producto' : 'productos'} en casa`, faltan ? `${faltan} para comprar` : '', caducan ? `${caducan} caducan pronto` : ''].filter(Boolean).join(' · ');
}

vista('despensa', {
  render: () => `<main class="pantalla despensa">
    <header class="cabecera">
      <div class="titulos"><h1>Despensa</h1><p class="sub" id="sub-despensa">${esc(subtitulo())}</p></div>
      <label class="buscador">${ico('buscar', 'peq')}<input type="search" placeholder="Buscar en la despensa" value="${esc(busqueda)}" data-entrada="buscarDespensa" enterkeyhint="search"></label>
    </header>
    <nav class="filtros" id="filtros-despensa">${filtrosHtml()}</nav>
    <section id="lista-despensa">${cuerpoLista()}</section>
    <div class="dock-voz">
      <button class="boton-redondo boton-voz-lateral" data-a="textoDespensa" aria-label="Escribir">${ico('teclado', 'gr')}</button>
      <button class="boton-voz" data-a="vozDespensa" aria-label="Hablar">${ico('mic')}<span class="etiqueta-voz">Toca y habla</span></button>
      <button class="boton-redondo boton-voz-lateral" data-a="nuevoProducto" aria-label="Añadir a mano">${ico('mas', 'gr')}</button>
    </div>
  </main>`,
});

/** Redibuja solo la lista (para no perder el foco del buscador). */
export function refrescarDespensa(destellos = []) {
  const l = document.getElementById('lista-despensa');
  if (!l) return;
  l.innerHTML = cuerpoLista();
  document.getElementById('filtros-despensa').innerHTML = filtrosHtml();
  document.getElementById('sub-despensa').textContent = subtitulo();
  for (const id of destellos) {
    const el = l.querySelector(`[data-producto="${CSS.escape(id)}"]`);
    if (el) { el.classList.add('destello'); if (destellos[0] === id) el.scrollIntoView({ block: 'center', behavior: 'smooth' }); }
  }
}

function cambiarCantidad(id, signo) {
  const p = E.despensa.productos.find((x) => x.id === id);
  if (!p) return;
  const s = pasoDe(p);
  if (p.cantidad == null) p.cantidad = signo > 0 ? 1 : 0;
  else p.cantidad = Math.max(0, Math.round((p.cantidad + signo * s) * 1000) / 1000);
  if (!p.unidad) p.unidad = 'ud';
  p.actualizado = Date.now();
  guardar('despensa', { silencioso: true });
  const el = document.querySelector(`[data-producto="${CSS.escape(id)}"]`);
  // si cambia de sección (se acaba o se repone) se redibuja la lista; si no, solo la tarjeta
  if (el && (p.cantidad === 0 || (signo > 0 && el.classList.contains('agotado')))) refrescarDespensa([id]);
  else if (el) { el.outerHTML = tarjetaProducto(p); document.getElementById('sub-despensa').textContent = subtitulo(); }
}

function formularioProducto(p) {
  const lugar = p.lugar || 'despensa';
  return `
    <div class="fila" style="margin-top:6px">
      <label class="campo" style="width:96px;flex:none"><span>Icono</span><input class="entrada" name="emoji" value="${esc(p.emoji || '🛒')}" style="text-align:center;font-size:28px;padding:6px"></label>
      <label class="campo" style="flex:1"><span>Nombre</span><input class="entrada" name="nombre" value="${esc(p.nombre || '')}" placeholder="Leche, huevos, arroz…" autocomplete="off"></label>
    </div>
    <div class="fila">
      <label class="campo" style="flex:1"><span>Cantidad</span><input class="entrada" name="cantidad" type="number" inputmode="decimal" step="any" min="0" value="${p.cantidad ?? ''}" placeholder="Sin contar"></label>
      <label class="campo" style="flex:1"><span>Unidad</span><select class="entrada" name="unidad">${UNIDADES.map((u) => `<option ${u === (p.unidad || 'ud') ? 'selected' : ''}>${u}</option>`).join('')}</select></label>
    </div>
    <div class="campo"><span>Dónde está</span><div class="segmentos" data-grupo="lugar">
      ${Object.entries(LUGARES).map(([id, l]) => `<button type="button" class="${id === lugar ? 'activo' : ''}" data-valor="${id}">${l.emoji} ${l.nombre}</button>`).join('')}
    </div></div>
    <label class="campo"><span>Caduca (opcional)</span><input class="entrada" name="caduca" type="date" value="${esc(p.caduca || '')}"></label>`;
}
function leerFormulario(h) {
  const v = (n) => h.el.querySelector(`[name="${n}"]`).value;
  const cant = v('cantidad').trim();
  return {
    emoji: v('emoji').trim() || '🛒', nombre: v('nombre').trim(),
    cantidad: cant === '' ? null : Math.max(0, Number(cant.replace(',', '.'))), unidad: v('unidad'),
    lugar: h.el.querySelector('[data-grupo="lugar"] .activo')?.dataset.valor || 'despensa', caduca: v('caduca') || null,
  };
}
function activarSegmentos(h) {
  h.el.addEventListener('click', (e) => {
    const b = e.target.closest('.segmentos button'); if (!b) return;
    b.parentElement.querySelectorAll('button').forEach((x) => x.classList.toggle('activo', x === b));
  });
}

accion({
  filtroDespensa: ({ f }) => { filtro = f; refrescarDespensa(); window.scrollTo({ top: 0, behavior: 'smooth' }); },
  buscarDespensa: (valor) => { busqueda = valor; refrescarDespensa(); },
  masProducto: ({ id }) => cambiarCantidad(id, +1),
  menosProducto: ({ id }) => cambiarCantidad(id, -1),
  vozDespensa: () => abrirVoz({ alCerrar: (ids) => refrescarDespensa(ids) }),
  textoDespensa: () => abrirTexto({ alCerrar: (ids) => refrescarDespensa(ids) }),

  nuevoProducto: () => {
    const h = abrirHoja(`<h2>Añadir a mano</h2>${formularioProducto({ cantidad: 1, unidad: 'ud', lugar: filtro in LUGARES ? filtro : 'despensa' })}
      <div class="pie"><button class="boton grande" data-r="no">Cancelar</button><button class="boton grande principal" data-r="si">Añadir</button></div>`);
    activarSegmentos(h);
    setTimeout(() => h.el.querySelector('[name="nombre"]').focus(), 350);
    h.el.addEventListener('click', (e) => {
      const b = e.target.closest('[data-r]'); if (!b) return;
      if (b.dataset.r === 'si') {
        const d = leerFormulario(h);
        if (!d.nombre) { tostada('Ponle un nombre'); return; }
        const p = { id: nuevoId(), ...d, nombre: d.nombre.charAt(0).toUpperCase() + d.nombre.slice(1), creado: Date.now(), actualizado: Date.now() };
        E.despensa.productos.push(p);
        guardar('despensa', { silencioso: true });
        h.cerrar(); refrescarDespensa([p.id]);
      } else h.cerrar();
    });
  },

  editarProducto: ({ id }) => {
    const p = E.despensa.productos.find((x) => x.id === id);
    if (!p) return;
    const h = abrirHoja(`<h2>${esc(p.emoji || '')} ${esc(p.nombre)}</h2>${formularioProducto(p)}
      <div class="pie">
        ${p.cantidad !== 0 ? `<button class="boton grande" data-r="agotar">${ico('carrito')} Se acabó</button>` : ''}
        <button class="boton grande principal" data-r="guardar">${ico('check')} Guardar</button>
      </div>
      <button class="boton fantasma ancho" style="margin-top:10px;color:var(--rojo)" data-r="borrar">${ico('basura', 'peq')} Quitar de la lista</button>`);
    activarSegmentos(h);
    h.el.addEventListener('click', async (e) => {
      const b = e.target.closest('[data-r]'); if (!b) return;
      if (b.dataset.r === 'guardar') {
        const d = leerFormulario(h);
        if (!d.nombre) { tostada('Ponle un nombre'); return; }
        Object.assign(p, d, { actualizado: Date.now() });
      } else if (b.dataset.r === 'agotar') {
        Object.assign(p, { cantidad: 0, actualizado: Date.now() });
      } else if (b.dataset.r === 'borrar') {
        h.cerrar();
        if (!(await confirmar(`¿Quitar ${p.nombre} de la lista?`, 'Desaparece de la despensa y de la lista de la compra.', { ok: 'Quitar', peligro: true }))) return;
        Object.assign(p, { borrado: true, actualizado: Date.now() });
        guardar('despensa', { silencioso: true }); refrescarDespensa();
        return;
      }
      guardar('despensa', { silencioso: true });
      h.cerrar(); refrescarDespensa([p.id]);
    });
  },
});
