// Modo cocina: pantalla completa, paso actual en grande, panel del robot o de fuera,
// temporizador con alarma, ingredientes marcables y notas por paso.
// En horizontal: lista de pasos e ingredientes a la izquierda. En vertical: en una hoja.

import { E, guardar } from '../almacen.js';
import {
  segundosPaso, PROGRAMAS, ACCESORIOS, MEDIDOR, DONDE, FUEGOS, NOMBRE_FUEGO, dondePaso, resumenPaso, tiempoRobot,
} from '../recetas.js';
import {
  recetaCocina, proceso, asegurarProceso, fijarPaso, porcentaje, marcado, asegurarTimer, claveT, T, restante, corriendo, vivo,
  arrancar, pausar, reiniciarTimer, sumar, otraTanda, todosLosTimers, alCambiarRelojes, reiniciarProceso, quitarProceso,
} from '../cocina.js';
import { esc, mmss, tiempoLegible } from '../util.js';
import { ico } from '../iconos.js';
import { vista, accion, ir, rutaActual } from '../rutas.js';
import { abrirHoja, confirmar, cerrar as cerrarHoja } from '../ui.js';
import { desbloquear } from '../sonido.js';
import { puedePantallaCompleta, alternarPantallaCompleta } from '../pantalla.js';
import { filaIngrediente, filaPreparacion } from './receta.js';
import { chipReloj } from './recetas.js';
import { abrirValoracion } from './valorar.js';
import { dictarEn } from './voz.js';

let pestana = 'pasos';
let direccion = '';
let quitarOyente = null;

// ---------------------------------------------------------------- piezas
function barra(rc, n) {
  return `<header class="cocina-barra">
    <button class="boton-salir" data-a="salirCocina" data-id="${rc.id}" aria-label="Salir al menú de recetas">${ico('atras')}<span>Recetas</span></button>
    <div class="titulo">
      <b>${esc(rc.titulo)}</b>
      <span>Paso ${n + 1} de ${rc.pasos.length} · <span data-pct="${rc.id}">${porcentaje(rc.id)} %</span>${rc.conOpciones && rc.etiquetaVersion ? `<span class="version-barra"> · ${rc.estilo.emoji} ${esc(rc.etiquetaVersion)}</span>` : ''}</span>
      <div class="progreso"><div data-barra="${rc.id}" style="width:${porcentaje(rc.id)}%"></div></div>
    </div>
    <div class="otros-relojes" id="otros-relojes">${otrosRelojes(rc, n)}</div>
    <button class="boton-redondo solo-vertical" data-a="hojaLado" aria-label="Pasos e ingredientes">${ico('lista')}</button>
    <button class="boton-redondo" data-a="menuCocina" data-id="${rc.id}" aria-label="Más opciones">⋯</button>
  </header>`;
}

function otrosRelojes(rc, n) {
  return todosLosTimers().filter((x) => !(x.id === rc.id && x.n === n) && vivo(x.t)).slice(0, 3).map((x) => chipReloj(x, true)).join('');
}

function listaLado(rc, n) {
  const p = proceso(rc.id);
  if (pestana === 'ingredientes') return rc.ingredientes.map((_, i) => filaIngrediente(rc, i)).join('');
  if (pestana === 'antes') return (rc.preparacion || []).map((_, i) => filaPreparacion(rc, i)).join('') || '<p class="tenue" style="padding:12px">Nada que preparar antes.</p>';
  return rc.pasos.map((ps, i) => {
    const hecho = p?.hechos?.includes(i) && i !== n;
    const t = p?.timers?.[i];
    const d = DONDE[dondePaso(ps)];
    return `<button class="paso-lista ${i === n ? 'actual' : ''} ${hecho ? 'hecho' : ''}" data-a="saltarPaso" data-n="${i}">
      <span class="num ${hecho ? 'hecho' : ps.tipo === 'robot' ? '' : 'fuera'}">${hecho ? ico('check', 'peq') : i + 1}</span>
      <span style="min-width:0;flex:1"><span class="t">${esc(ps.titulo)}${ps.opcional ? ' <span class="muy-tenue">(opcional)</span>' : ''}</span>
        <div class="s">${d.emoji} ${esc(resumenPaso(ps))}</div>
        ${t && vivo(t) && i !== n ? chipReloj({ clave: claveT(rc.id, i), t, id: rc.id, n: i }) : ''}
        ${p?.notas?.[i] ? `<div class="s" style="color:var(--azul)">📝 ${esc(p.notas[i])}</div>` : ''}</span>
    </button>`;
  }).join('');
}

function lado(rc, n) {
  const op = [['pasos', 'Pasos'], ['ingredientes', 'Ingredientes'], ...(rc.preparacion?.length ? [['antes', 'Antes']] : [])];
  return `<div class="segmentos">${op.map(([id, t]) => `<button class="${pestana === id ? 'activo' : ''}" data-a="pestanaLado" data-p="${id}">${t}</button>`).join('')}</div>
    <div class="lista" id="lado-lista">${listaLado(rc, n)}</div>`;
}

function mando(lbl, val, { activo = false, apagado = false, extra = '', med = false } = {}) {
  // m-cab = etiqueta (+ medidor o «Inverso»); val = la cifra grande. El CSS los pone uno encima
  // del otro si hay sitio para los cuatro en fila, o a izquierda y derecha si van en dos filas.
  return `<div class="mando ${activo ? 'activo' : ''} ${apagado ? 'apagado' : ''}">
    <span class="m-cab"><span class="lbl">${lbl}</span>${extra}</span><span class="val ${med ? 'med' : ''}">${val}</span></div>`;
}

export function panelRobot(r) {
  const prog = r.programa && PROGRAMAS[r.programa];
  const vel = r.velocidad == null || r.velocidad === '0' ? null : r.velocidad;
  const velNum = vel === 'turbo' ? 10 : Number(vel || 0);
  const medidorVel = `<span class="medidor-vel">${Array.from({ length: 10 }, (_, i) => `<i class="${i < velNum ? 'on' : ''}" style="height:${4 + i}px"></i>`).join('')}</span>`;
  const acc = ACCESORIOS[r.accesorio || 'cuchillas'];
  const med = r.medidor && MEDIDOR[r.medidor];
  return `<div class="panel-robot">
    <div class="cab"><span>${ico('robot', 'peq')} Pon en el robot</span><span class="marca">Monsieur Cuisine Plus</span></div>
    ${prog ? `<div class="programa"><span>${prog.emoji} Programa <b>${prog.nombre}</b></span><small>botón ${prog.boton}</small></div>` : ''}
    <div class="mandos">
      ${mando('Tiempo', r.tiempo_s ? tiempoRobot(r.tiempo_s) : '—', { activo: !!r.tiempo_s, apagado: !r.tiempo_s })}
      ${r.temperatura ? mando('Temp.', `${r.temperatura}<small>°C</small>`, { activo: true }) : mando('Temp.', 'Sin calor', { apagado: true, med: true })}
      ${vel ? mando('Velocidad', vel === 'turbo' ? 'TURBO' : vel, { activo: true, extra: medidorVel, med: vel === 'turbo' }) : mando('Velocidad', '—', { apagado: true })}
      ${r.inverso ? mando('Giro', '↺', { activo: true, extra: '<span class="sub">Inverso</span>' }) : mando('Giro', '↻', { apagado: true, extra: '<span class="sub">Normal</span>' })}
    </div>
    <div class="extras">
      <span class="extra">${acc.emoji} ${acc.nombre}</span>
      ${med ? `<span class="extra ${med.alerta ? 'alerta' : ''}">${med.emoji} ${med.texto}</span>` : ''}
    </div>
  </div>`;
}

export function panelFuera(p) {
  const clave = dondePaso(p), d = DONDE[clave];
  const datos = [];
  if (p.fuego) {
    const nivel = FUEGOS[p.fuego] ?? 0;
    datos.push(`<div class="dato-fuera"><div class="lbl">Fuego</div><div class="val txt">${esc(NOMBRE_FUEGO[p.fuego] || p.fuego)}</div>
      <div class="llamas">${[1, 2, 3, 4].map((i) => `<i class="${i <= nivel ? 'on' : ''}"></i>`).join('')}</div></div>`);
  }
  if (p.temperatura) {
    const lbl = clave === 'sarten' ? 'Aceite' : clave === 'horno' ? 'Horno' : clave === 'freidora' ? 'Freidora' : 'Temperatura';
    datos.push(`<div class="dato-fuera"><div class="lbl">${lbl}</div><div class="val">${p.temperatura} °C</div></div>`);
  }
  if (p.modo) datos.push(`<div class="dato-fuera"><div class="lbl">Modo</div><div class="val txt">${esc(p.modo)}</div></div>`);
  if (p.temporizador_s) datos.push(`<div class="dato-fuera"><div class="lbl">Tiempo</div><div class="val">${esc(tiempoLegible(p.temporizador_s))}</div></div>`);
  const sub = { nevera: 'Fuera del robot · en frío', congelador: 'Fuera del robot · congelado', mesa: 'Último toque antes de comer', encimera: 'Fuera del robot · preparación' }[clave] || 'Fuera del robot';
  return `<div class="panel-fuera">
    <div class="util"><span class="icono-util">${d.emoji}</span><div><b>${esc(d.util)}</b><span>${sub}</span></div></div>
    ${datos.length ? `<div class="datos-fuera">${datos.join('')}</div>` : ''}
  </div>`;
}

function temporizador(rc, n) {
  const p = rc.pasos[n];
  if (!segundosPaso(p)) return '';
  const clave = claveT(rc.id, n);
  const t = T(clave) || asegurarTimer(rc.id, n);
  const r = Math.max(0, restante(t)), run = corriendo(t);
  const estado = run ? (r <= 0 ? 'terminado' : 'corriendo') : r <= 0 ? 'terminado' : r < t.total ? 'pausa' : 'listo';
  const txtEstado = { corriendo: 'en marcha', pausa: 'en pausa', terminado: '¡terminado!', listo: 'listo para empezar' }[estado];
  const R = 92, L = 2 * Math.PI * R;
  return `<div class="temporizador ${estado}" id="temporizador">
    <div class="anillo"><svg viewBox="0 0 210 210" width="100%" height="100%">
      <defs><linearGradient id="grad-t" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#ffb347"/><stop offset="1" stop-color="var(--acento)"/></linearGradient></defs>
      <circle cx="105" cy="105" r="${R}" fill="none" stroke="var(--fondo-2)" stroke-width="14"/>
      <circle class="arco" data-arco="${clave}" data-l="${L}" cx="105" cy="105" r="${R}" fill="none" stroke="url(#grad-t)" stroke-width="14" stroke-linecap="round"
        stroke-dasharray="${L}" style="stroke-dashoffset:${L * (1 - r / (t.total || 1))}"/></svg>
      <div class="centro"><div><div class="tiempo" data-t="${clave}">${mmss(r)}</div><div class="estado-t">${txtEstado}</div></div></div>
    </div>
    <div class="controles">
      <button class="ctl" data-a="sumarT" data-c="${clave}" data-s="-30">−30</button>
      <button class="ctl play ${run ? 'pausa' : ''}" data-a="${run ? 'pausarT' : 'arrancarT'}" data-c="${clave}" aria-label="${run ? 'Pausar' : 'Empezar'}">${ico(run ? 'pausa' : 'play')}</button>
      <button class="ctl" data-a="sumarT" data-c="${clave}" data-s="30">+30</button>
      <button class="ctl" data-a="reiniciarT" data-c="${clave}" aria-label="Volver a empezar">${ico('reiniciar', 'peq')}</button>
    </div>
    ${p.temporizador_editable ? `<div class="controles"><button class="boton peq" data-a="sumarT" data-c="${clave}" data-s="-60">−1 min</button><span class="muy-tenue ajusta-txt" style="font-size:14px">ajusta los minutos</span><button class="boton peq" data-a="sumarT" data-c="${clave}" data-s="60">+1 min</button></div>` : ''}
    ${p.temporizador_repetible ? `<div class="controles"><span class="tanda">Tanda ${t.tanda || 1}</span><button class="boton peq" data-a="otraTandaT" data-c="${clave}">${ico('repetir', 'peq')} Otra tanda</button></div>` : ''}
    ${p.tipo === 'robot' ? '<p class="pista">El robot lleva su propio reloj: pulsa ▶ a la vez que lo pones en marcha y te aviso aquí.</p>' : ''}
  </div>`;
}

function pasoGrande(rc, n) {
  const p = rc.pasos[n], pr = proceso(rc.id);
  const clave = dondePaso(p), d = DONDE[clave];
  const usa = (p.usa || []).filter((i) => rc.ingredientes[i]);
  const tieneTimer = !!segundosPaso(p);
  const panel = p.tipo === 'robot' && p.robot ? panelRobot(p.robot) : panelFuera(p);
  return `<article class="paso-grande">
    <div class="chips">
      <span class="donde ${d.clase}">${d.emoji} ${esc(d.nombre)}${p.fuego && p.fuego !== 'apagado' ? ` · fuego ${esc((NOMBRE_FUEGO[p.fuego] || p.fuego).toLowerCase())}` : ''}</span>
      ${p.opcional ? '<span class="chip ambar">Opcional</span>' : ''}
    </div>
    <h2>${esc(p.titulo)}</h2>
    <p class="texto">${esc(p.texto)}</p>
    <div class="paneles ${tieneTimer ? '' : 'solo'}">${panel}${temporizador(rc, n)}</div>
    ${usa.length ? `<div class="necesitas"><span class="etq">Necesitas</span>${usa.map((i) => {
      const ing = rc.ingredientes[i];
      return `<button class="ing-chip ${marcado('ingredientes', rc.id, i) ? 'marcado' : ''}" data-a="marcarIngrediente" data-id="${rc.id}" data-i="${i}">
        <span class="casilla">${ico('check')}</span><span><b>${esc(ing.cantidad)}</b> ${esc(ing.nombre.split(/,| \(/)[0])}</span></button>`;
    }).join('')}</div>` : ''}
    ${p.señal ? `<div class="senal">${ico('ojo')}<div><b>Sabrás que está cuando</b>${esc(p.señal)}</div></div>` : ''}
    ${p.aviso ? `<div class="aviso">${ico('aviso')}<span>${esc(p.aviso)}</span></div>` : ''}
    ${pr?.notas?.[n] ? `<button class="nota-paso" data-a="notaPaso" data-id="${rc.id}" data-n="${n}">${ico('nota')}<span><b>Tu nota:</b> ${esc(pr.notas[n])}</span></button>` : ''}
  </article>`;
}

function navegacion(rc, n) {
  const ultimo = n >= rc.pasos.length - 1;
  return `<nav class="cocina-nav">
    <button class="boton grande" data-a="pasoAnterior" ${n === 0 ? 'disabled' : ''}>${ico('atras')} Anterior</button>
    <button class="boton grande boton-nota" data-a="notaPaso" data-id="${rc.id}" data-n="${n}" aria-label="Apuntar una nota">${ico('nota')}</button>
    ${ultimo
      ? `<button class="boton grande principal" data-a="terminarReceta" data-id="${rc.id}">${ico('check')} Terminar</button>`
      : `<button class="boton grande principal" data-a="pasoSiguiente">Siguiente ${ico('adelante')}</button>`}
  </nav>`;
}

// ---------------------------------------------------------------- vista
vista('cocinar', {
  render: ({ id, n }) => {
    const rc = recetaCocina(id);
    if (!rc) return `<main class="pantalla"><div class="vacio"><p>Esta receta ya no existe.</p><button class="boton" data-a="volverRecetas">Volver</button></div></main>`;
    n = Math.max(0, Math.min(Number(n) || 0, rc.pasos.length - 1));
    asegurarProceso(id);
    if (proceso(id).paso !== n) fijarPaso(id, n);
    asegurarTimer(id, n);
    const html = `<div class="cocina">
      ${barra(rc, n)}
      <div class="cocina-cuerpo">
        <aside class="cocina-lado">${lado(rc, n)}</aside>
        <section class="cocina-paso">
          <div class="contenido ${direccion ? 'anim-' + direccion : ''}" id="contenido-paso">${pasoGrande(rc, n)}</div>
          ${navegacion(rc, n)}
        </section>
      </div>
    </div>`;
    direccion = '';
    return html;
  },
  montar: (app, { id }) => {
    document.body.classList.add('modo-cocina');
    quitarOyente?.();
    quitarOyente = alCambiarRelojes(() => refrescar());
    // la lista lateral enseña el paso actual
    requestAnimationFrame(() => app.querySelector('.paso-lista.actual')?.scrollIntoView({ block: 'nearest' }));
    activarDeslizar(app.querySelector('#contenido-paso'), id);
  },
  desmontar: () => {
    document.body.classList.remove('modo-cocina');
    quitarOyente?.(); quitarOyente = null;
  },
});

function actual() { const r = rutaActual(); return r.vista === 'cocinar' ? { rc: recetaCocina(r.id), n: Math.max(0, Math.min(r.n, (recetaCocina(r.id)?.pasos.length || 1) - 1)) } : null; }

/** Redibuja solo lo que cambia con los temporizadores, sin mover el scroll. */
function refrescar() {
  const a = actual(); if (!a?.rc) return;
  const tmp = document.getElementById('temporizador');
  if (tmp) tmp.outerHTML = temporizador(a.rc, a.n);
  const otros = document.getElementById('otros-relojes');
  if (otros) otros.innerHTML = otrosRelojes(a.rc, a.n);
  const lista = document.getElementById('lado-lista');
  if (lista && pestana === 'pasos') { const y = lista.scrollTop; lista.innerHTML = listaLado(a.rc, a.n); lista.scrollTop = y; }
}

function irA(n, dir) {
  const a = actual(); if (!a?.rc) return;
  if (n < 0 || n >= a.rc.pasos.length) return;
  desbloquear();
  direccion = dir;
  fijarPaso(a.rc.id, n);
  ir(`#/cocinar/${a.rc.id}/${n}`, { reemplazar: true, animar: false });
}

function activarDeslizar(el, id) {
  if (!el) return;
  let x0 = null, y0 = 0, t0 = 0;
  el.addEventListener('pointerdown', (e) => { if (e.pointerType === 'mouse' || e.target.closest('button, input, textarea')) { x0 = null; return; } x0 = e.clientX; y0 = e.clientY; t0 = Date.now(); }, { passive: true });
  el.addEventListener('pointerup', (e) => {
    if (x0 == null) return;
    const dx = e.clientX - x0, dy = e.clientY - y0;
    x0 = null;
    if (Math.abs(dx) > 90 && Math.abs(dx) > Math.abs(dy) * 1.6 && Date.now() - t0 < 700) {
      const a = actual(); if (!a) return;
      if (dx < 0) irA(a.n + 1, 'sig'); else irA(a.n - 1, 'ant');
    }
  }, { passive: true });
}

document.addEventListener('keydown', (e) => {
  if (rutaActual().vista !== 'cocinar' || document.querySelector('.capa-hoja, .alarma') || e.target.closest?.('input, textarea')) return;
  const a = actual(); if (!a) return;
  if (e.key === 'ArrowRight') irA(a.n + 1, 'sig');
  if (e.key === 'ArrowLeft') irA(a.n - 1, 'ant');
});

function abrirNota(id, n) {
  const rc = recetaCocina(id), p = asegurarProceso(id);
  const h = abrirHoja(`<h2>Nota del paso ${n + 1}</h2><p class="tenue">${esc(rc.pasos[n].titulo)} · Apunta lo que cambiarías («necesitó 3 minutos más», «picar menos»). Se guarda en tu historial para mejorar la receta.</p>
    <div class="campo area-voz"><textarea class="area" id="nota-texto" placeholder="Escribe o dicta…">${esc(p.notas[n] || '')}</textarea>
      <button class="dictar" data-r="dictar" aria-label="Dictar">${ico('mic')}</button></div>
    <div class="pie">${p.notas[n] ? '<button class="boton grande peligro" data-r="borrar">Borrar</button>' : '<button class="boton grande" data-r="no">Cancelar</button>'}
      <button class="boton grande principal" data-r="si">${ico('check')} Guardar</button></div>`);
  const area = h.el.querySelector('textarea');
  setTimeout(() => area.focus(), 350);
  h.el.addEventListener('click', (e) => {
    const b = e.target.closest('[data-r]'); if (!b) return;
    if (b.dataset.r === 'dictar') { dictarEn(b, area); return; }
    if (b.dataset.r === 'si') { const t = area.value.trim(); if (t) p.notas[n] = t; else delete p.notas[n]; }
    if (b.dataset.r === 'borrar') delete p.notas[n];
    if (b.dataset.r !== 'no') { guardar('cocina'); const c = document.getElementById('contenido-paso'); if (c && actual()?.n === n) c.innerHTML = pasoGrande(rc, n); refrescar(); }
    h.cerrar();
  });
}

accion({
  pestanaLado: ({ p }) => {
    pestana = p;
    const a = actual(); if (!a) return;
    document.querySelectorAll('.cocina-lado .segmentos button, .hoja .segmentos button').forEach((b) => b.classList.toggle('activo', b.dataset.p === p));
    document.querySelectorAll('#lado-lista').forEach((l) => { l.innerHTML = listaLado(a.rc, a.n); l.scrollTop = 0; });
  },
  saltarPaso: ({ n }) => { const a = actual(); if (a) irA(Number(n), Number(n) > a.n ? 'sig' : 'ant'); },
  pasoSiguiente: () => { const a = actual(); if (a) irA(a.n + 1, 'sig'); },
  pasoAnterior: () => { const a = actual(); if (a) irA(a.n - 1, 'ant'); },
  arrancarT: ({ c }) => { desbloquear(); arrancar(c); },
  pausarT: ({ c }) => pausar(c),
  reiniciarT: ({ c }) => reiniciarTimer(c),
  sumarT: ({ c, s }) => sumar(c, Number(s)),
  otraTandaT: ({ c }) => { desbloquear(); otraTanda(c); },
  notaPaso: ({ id, n }) => abrirNota(id, Number(n)),
  salirCocina: () => ir('#/recetas', { reemplazar: true }),   // el progreso sigue en «Cocinando ahora»
  hojaLado: () => {
    const a = actual(); if (!a) return;
    const h = abrirHoja(`<div class="cocina-lado" style="display:flex;border:0;background:none;max-height:70dvh">${lado(a.rc, a.n)}</div>`, { clase: 'hoja-lado' });
    h.el.addEventListener('click', (e) => { if (e.target.closest('[data-a="saltarPaso"]')) h.cerrar(); });
  },
  menuCocina: ({ id }) => {
    const h = abrirHoja(`<h2>Opciones</h2>
      <div style="display:grid;gap:10px;margin-top:12px">
        <button class="boton grande ancho" data-r="receta">${ico('recetas')} Ver la receta completa</button>
        ${puedePantallaCompleta() ? `<button class="boton grande ancho" data-r="completa">${ico('expandir')} Pantalla completa</button>` : ''}
        <button class="boton grande ancho" data-r="reiniciar">${ico('reiniciar')} Empezar de nuevo</button>
        <button class="boton grande ancho peligro" data-r="dejar">${ico('basura')} Dejar de cocinar</button>
      </div>`);
    h.el.addEventListener('click', async (e) => {
      const b = e.target.closest('[data-r]'); if (!b) return;
      h.cerrar();
      if (b.dataset.r === 'receta') ir(`#/receta/${id}`, { reemplazar: true });
      if (b.dataset.r === 'completa') alternarPantallaCompleta();
      if (b.dataset.r === 'reiniciar' && await confirmar('¿Empezar de nuevo?', 'Vuelves al paso 1 y se borran los temporizadores.', { ok: 'Empezar de nuevo', peligro: true })) {
        reiniciarProceso(id); direccion = 'ant'; ir(`#/cocinar/${id}/0`, { reemplazar: true, animar: false });
      }
      if (b.dataset.r === 'dejar' && await confirmar('¿Dejar de cocinar?', 'Se borra el progreso de esta receta.', { ok: 'Dejarlo', peligro: true })) {
        quitarProceso(id); ir(`#/receta/${id}`, { reemplazar: true });
      }
    });
  },
  terminarReceta: ({ id }) => {
    const rc = recetaCocina(id);
    abrirValoracion(rc, {
      desdeCocina: true,
      alGuardar: () => { quitarProceso(id); ir(`#/receta/${id}`, { reemplazar: true }); },
    });
  },
});
