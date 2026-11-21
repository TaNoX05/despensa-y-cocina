// Listado de recetas por categorías, con "Cocinando ahora" arriba.

import { E } from '../almacen.js';
import { recetas, categorias, categoria, receta, usaRobot, colorNota } from '../recetas.js';
import { coberturaReceta } from '../despensa.js';
import { proceso, porcentaje, timerMasUrgente, restante, corriendo, quitarProceso } from '../cocina.js';
import { esc, normalizar, mmss } from '../util.js';
import { ico } from '../iconos.js';
import { vista, accion, ir, repintar } from '../rutas.js';
import { confirmar } from '../ui.js';

let busqueda = '';

export function cocinadosDe(id) { return (E.diario.cocinados || []).filter((c) => c.receta === id && !c.borrado); }
export function mediaValoracion(id) {
  const v = cocinadosDe(id).map((c) => c.valoracion).filter((x) => x);
  return v.length ? v.reduce((a, b) => a + b, 0) / v.length : null;
}
export const estrellasTexto = (v) => '★'.repeat(Math.round(v)) + '☆'.repeat(5 - Math.round(v));

export function anilloPct(id, tam = 84, grosor = 8, color = 'var(--robot-luz)') {
  const r = (tam - grosor) / 2, L = 2 * Math.PI * r, pct = porcentaje(id);
  return `<div class="anillo-pct" style="width:${tam}px;height:${tam}px">
    <svg width="${tam}" height="${tam}" viewBox="0 0 ${tam} ${tam}"><circle cx="${tam / 2}" cy="${tam / 2}" r="${r}" fill="none" stroke="rgba(255,255,255,.12)" stroke-width="${grosor}"/>
    <circle cx="${tam / 2}" cy="${tam / 2}" r="${r}" fill="none" stroke="${color}" stroke-width="${grosor}" stroke-linecap="round" stroke-dasharray="${L}" style="stroke-dashoffset:${L * (1 - pct / 100)};transition:stroke-dashoffset .4s" data-anillo-pct="${id}" data-l="${L}"/></svg>
    <b data-pct="${id}">${pct} %</b></div>`;
}

export function chipReloj(x, conNombre = false) {
  const rc = receta(x.id); const paso = rc?.pasos[x.n];
  const fin = corriendo(x.t) && restante(x.t) <= 0;
  return `<button class="reloj-chip ${fin ? 'fin' : ''} ${corriendo(x.t) ? '' : 'pausa'}" data-a="irPaso" data-id="${x.id}" data-n="${x.n}">
    ${ico(corriendo(x.t) ? 'reloj' : 'pausa', 'peq')}${conNombre ? esc(paso?.titulo || '') + ' · ' : ''}<span data-t="${x.clave}">${mmss(Math.max(0, restante(x.t)))}</span></button>`;
}

export function tarjetaCocinando(id) {
  const rc = receta(id), p = proceso(id);
  if (!rc || !p) return '';
  const paso = rc.pasos[Math.min(p.paso, rc.pasos.length - 1)];
  const relojes = Object.entries(p.timers || {}).map(([n, t]) => ({ clave: `${id}:${n}`, t, id, n: Number(n) })).filter((x) => corriendo(x.t) || (x.t.restante > 0 && x.t.restante < x.t.total));
  return `<div class="cocinando-ahora">
    ${rc.foto ? `<img src="${esc(rc.foto)}" alt="">` : ''}
    <div class="info">
      <div class="etq">🔥 Cocinando ahora</div>
      <h3>${esc(rc.titulo)}</h3>
      <div class="paso">Paso ${p.paso + 1} de ${rc.pasos.length} · ${esc(paso.titulo)}</div>
      ${relojes.length ? `<div class="relojes">${relojes.map((x) => chipReloj(x, true)).join('')}</div>` : ''}
    </div>
    ${anilloPct(id)}
    <div class="acciones">
      <button class="boton principal" data-a="irPaso" data-id="${id}" data-n="${p.paso}">${ico('play', 'peq')} Continuar</button>
      <button class="boton peq" data-a="descartarCocina" data-id="${id}">Dejarlo</button>
    </div>
  </div>`;
}

export function tarjetaReceta(rc) {
  const cat = categoria(rc.categoria);
  const veces = cocinadosDe(rc.id).length, media = mediaValoracion(rc.id);
  const cob = E.despensa.productos.length ? coberturaReceta(E.despensa.productos, rc) : null;
  const robot = usaRobot(rc);
  return `<button class="tarjeta-receta" data-a="abrirReceta" data-id="${rc.id}">
    <div class="foto">
      ${rc.foto ? `<img src="${esc(rc.foto)}" alt="" loading="lazy" decoding="async">` : `<div class="sin-foto">${rc.emoji || '🍽️'}</div>`}
      <div class="insignias">
        ${robot ? `<span class="insignia robot">${ico('robot', 'peq')} Robot</span>` : `<span class="insignia">🍳 Sin robot</span>`}
        ${proceso(rc.id) ? `<span class="insignia" style="background:var(--acento)">🔥 <span data-pct="${rc.id}">${porcentaje(rc.id)} %</span></span>` : ''}
        ${rc.nota != null ? `<span class="nota-circulo" style="background:${colorNota(rc.nota)}">${rc.nota}<small>/10</small></span>` : ''}
      </div>
    </div>
    <div class="cuerpo">
      <h3>${esc(rc.titulo)}</h3>
      ${rc.subtitulo ? `<p class="sub">${esc(rc.subtitulo)}</p>` : ''}
      <div class="meta">
        <span>${ico('reloj', 'peq')} ${rc.tiempo_min} min</span>
        <span>🍽 ${esc(rc.raciones)}</span>
        ${cat ? `<span>${cat.emoji} ${esc(cat.nombre)}</span>` : ''}
      </div>
      <div class="meta" style="padding-top:0">
        ${veces ? `<span>${media ? `<span class="estrellas-mini">${estrellasTexto(media)}</span>` : ''} Hecha ${veces} ${veces === 1 ? 'vez' : 'veces'}</span>` : '<span class="muy-tenue">Aún no la has hecho</span>'}
        ${cob && cob.total ? `<span style="color:${cob.tengo === cob.total ? 'var(--verde)' : 'var(--texto-2)'}">${ico('despensa', 'peq')} Tienes ${cob.tengo} de ${cob.total}</span>` : ''}
      </div>
    </div>
  </button>`;
}

function filtradas(catId) {
  const q = normalizar(busqueda);
  return recetas().filter((r) => (!catId || r.categoria === catId) &&
    (!q || normalizar(`${r.titulo} ${r.subtitulo} ${r.ingredientes.map((i) => i.nombre).join(' ')}`).includes(q)));
}

function cuerpo(catId) {
  const lista = filtradas(catId);
  if (!lista.length) return `<div class="vacio"><div class="grande">🔍</div><p>No hay recetas con «${esc(busqueda)}».</p></div>`;
  // Con pocas recetas por categoría queda mejor una sola rejilla (ordenada por categoría);
  // cuando haya muchas, se separan por secciones.
  const orden = (r) => categorias().findIndex((c) => c.id === r.categoria);
  const porCat = categorias().map((c) => lista.filter((r) => r.categoria === c.id)).filter((x) => x.length);
  if (catId || busqueda || porCat.every((x) => x.length < 3)) {
    return `<div class="rejilla-recetas">${[...lista].sort((a, b) => orden(a) - orden(b)).map(tarjetaReceta).join('')}</div>`;
  }
  return porCat.map((rs) => {
    const c = categoria(rs[0].categoria);
    return `<h2 class="seccion-titulo">${c.emoji} ${esc(c.nombre)} <span class="cuenta">${rs.length}</span></h2><div class="rejilla-recetas">${rs.map(tarjetaReceta).join('')}</div>`;
  }).join('');
}

vista('recetas', {
  render: ({ categoria: catId }) => {
    const enCurso = Object.keys(E.cocina.cocinando).filter((id) => receta(id));
    const total = recetas().length, robot = recetas().filter(usaRobot).length;
    return `<main class="pantalla recetas">
      <header class="cabecera">
        <div class="titulos"><h1>Recetas</h1><p class="sub">${total} recetas · ${robot} de robot · ${total - robot} sin robot</p></div>
        <label class="buscador">${ico('buscar', 'peq')}<input type="search" placeholder="Buscar receta o ingrediente" value="${esc(busqueda)}" data-entrada="buscarRecetas" enterkeyhint="search"></label>
      </header>
      ${enCurso.map(tarjetaCocinando).join('')}
      <nav class="filtros">
        <button class="filtro ${!catId ? 'activo' : ''}" data-a="filtroRecetas" data-c="">Todas</button>
        ${categorias().map((c) => `<button class="filtro ${catId === c.id ? 'activo' : ''}" data-a="filtroRecetas" data-c="${c.id}">${c.emoji} ${esc(c.nombre)} <span class="cuenta">${recetas().filter((r) => r.categoria === c.id).length}</span></button>`).join('')}
      </nav>
      <section id="lista-recetas">${cuerpo(catId)}</section>
    </main>`;
  },
});

accion({
  filtroRecetas: ({ c }) => ir(c ? `#/recetas/${c}` : '#/recetas', { reemplazar: true }),
  buscarRecetas: (v) => {
    busqueda = v;
    const r = location.hash.split('/')[2] || null;
    const el = document.getElementById('lista-recetas'); if (el) el.innerHTML = cuerpo(r);
  },
  abrirReceta: ({ id }) => ir(`#/receta/${id}`),
  irPaso: ({ id, n }) => {
    const enCocina = location.hash.startsWith('#/cocinar/');
    ir(`#/cocinar/${id}/${n}`, { reemplazar: enCocina, animar: !enCocina });
  },
  descartarCocina: async ({ id }) => {
    const rc = receta(id);
    if (await confirmar(`¿Dejar de cocinar ${rc?.titulo || 'la receta'}?`, 'Se borran el paso en el que ibas y sus temporizadores.', { ok: 'Dejarlo', peligro: true })) {
      quitarProceso(id); repintar();
    }
  },
});
