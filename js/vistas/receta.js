// Ficha de una receta: foto, ingredientes (marcables y cruzados con la despensa), nota del robot,
// pasos, trucos y tu historial con opiniones.

import { E } from '../almacen.js';
import { categoria, usaRobot, colorNota, resumenPaso, dondePaso, DONDE, ACCESORIOS, euros, precioRacion } from '../recetas.js';
import { productoParaIngrediente } from '../despensa.js';
import { recetaCocina, proceso, porcentaje, marcado, alternarMarca, reiniciarProceso, fijarPaso } from '../cocina.js';
import { abrirEleccion } from './elegir.js';
import { esc, fechaLarga } from '../util.js';
import { ico } from '../iconos.js';
import { vista, accion, ir, repintar } from '../rutas.js';
import { confirmar, tostada } from '../ui.js';
import { cocinadosDe, estrellasTexto, tarjetaCocinando, mediaValoracion } from './recetas.js';
import { abrirValoracion } from './valorar.js';
import { desbloquear } from '../sonido.js';
import { anadirFoto, fotosDe, elegirFotos, pintarMiniaturas } from '../fotos.js';
import { abrirVisor, miniaturaFoto } from './galeria.js';

export function filaIngrediente(rc, i, { conDespensa = true } = {}) {
  const ing = rc.ingredientes[i];
  const m = marcado('ingredientes', rc.id, i);
  let badge = '';
  if (conDespensa && E.despensa.productos.length) {
    const p = productoParaIngrediente(E.despensa.productos, ing);
    if (p) badge = p.cantidad === 0 ? '<span class="en-despensa no">Se acabó</span>' : '<span class="en-despensa si">En casa</span>';
  }
  return `<button class="ingrediente ${m ? 'marcado' : ''}" data-a="marcarIngrediente" data-id="${rc.id}" data-i="${i}">
    <span class="casilla">${ico('check')}</span>
    <span class="txt"><span class="cant">${esc(ing.cantidad)}</span>${esc(ing.nombre)}${ing.extra ? ` <span class="marca-extra">+ ${esc(ing.extra)}</span>` : ''}</span>${badge}${costeIngrediente(ing, rc)}</button>`;
}
function costeIngrediente(ing, rc) {
  const c = ing.compra;
  if (!c || c.despensa || c.euros == null) return '';
  const e = c.euros < 0.01 ? '< 0,01 €' : euros(c.euros);
  // si la receta se compra en dos tiendas, cada ingrediente dice en cuál
  const tienda = Object.keys(rc?.coste?.tiendas || {}).length > 1 && c.producto?.tienda ? `<small>${esc(c.producto.tienda)}</small>` : '';
  return `<span class="coste-ing ${c.opcional ? 'opcional' : ''}" title="${esc([c.producto?.tienda, c.producto?.nombre].filter(Boolean).join(': '))}">${c.opcional ? 'opcional' : e}${tienda}</span>`;
}
function bloqueCoste(rc) {
  const c = rc.coste;
  if (!c) return '';
  const cambios = rc.ingredientes.filter((i) => i.compra?.equivale).map((i) => `${esc(i.compra.equivale.split(' (')[0])} → ${esc(i.compra.producto?.nombre || '')}`);
  const tiendas = Object.entries(c.tiendas || {}).filter(([, e]) => e > 0).sort(([a], [b]) => (a === 'Mercadona' ? -1 : b === 'Mercadona' ? 1 : 0));
  const deTiendas = tiendas.length > 1 ? `Mercadona y Masymas (${tiendas.map(([t, e]) => `${esc(t)} ${euros(e)}`).join(' + ')})` : esc(tiendas[0]?.[0] || c.tienda || 'Mercadona');
  return `<div class="coste-resumen">
    <div class="cifras"><div><b>${precioRacion(rc)}</b><span>por ración</span></div><div><b>${euros(c.total)}</b><span>la receta (${c.raciones} raciones)</span></div></div>
    ${c.completo ? '' : `<p class="aviso-coste">Falta el precio de: ${esc(c.faltan.join(', '))}.</p>`}
    <p class="muy-tenue">Precios de ${deTiendas}. Se cuenta lo que usas, no el envase entero; sal y agua no suman.${cambios.length ? ` Equivalencias: ${cambios.join(' · ')}.` : ''}</p>
  </div>`;
}
export function filaPreparacion(rc, i) {
  const m = marcado('preparacion', rc.id, i);
  return `<button class="ingrediente tarea ${m ? 'marcado' : ''}" data-a="marcarPreparacion" data-id="${rc.id}" data-i="${i}">
    <span class="casilla">${ico('check')}</span><span class="txt">${esc(rc.preparacion[i])}</span></button>`;
}

function bloqueNota(rc) {
  const d = rc.desglose || {};
  const filas = [['Textura', d.textura], ['Sabor', d.sabor], ['Punto', d.punto], ['Comodidad', d.comodidad]].filter(([, v]) => v);
  return `<section class="bloque">
    <div class="nota-bloque">
      ${rc.nota != null
        ? `<div class="nota-grande" style="background:${colorNota(rc.nota)}"><div>${rc.nota}<small>/10</small></div></div>`
        : `<div class="nota-grande fuera"><div>Fuera<br>del robot</div></div>`}
      <div><h2 class="serif" style="font-size:24px">${rc.nota != null ? 'Cómo queda en el robot' : 'Cómo sale'}</h2>
      <p class="tenue" style="font-size:15.5px;margin-top:4px">${rc.nota != null ? 'Frente a hacerlo en casa de forma normal, con sartén, olla y horno.' : rc.sin_robot ? 'Esta receta se hace sin el robot.' : 'Se cocina fuera del robot; el robot solo echa una mano en alguna salsa o picado.'}</p></div>
    </div>
    <div class="desglose">${filas.map(([k, v]) => `<div><b>${k}</b><span>${esc(v)}</span></div>`).join('')}</div>
    ${rc.nota_mejor ? `<div class="mejora"><span class="sube">↑ ${rc.nota_mejor.valor}</span><span><b>Sube a ${rc.nota_mejor.valor}/10 si…</b> ${esc(rc.nota_mejor.si)}</span></div>` : ''}
  </section>`;
}

/** «Tu versión»: el estilo, la variante y los extras que se van a cocinar, con «Cambiar». */
function barraVersion(rc, p) {
  return `<section class="barra-version">
    <span class="emoji-estilo">${rc.estilo.emoji}</span>
    <div class="txt">
      <span class="etq-txt">${p ? 'Estás cocinando' : 'Tu versión'}</span>
      <b>${esc(rc.estilo.nombre)}${rc.version.nombre && rc.version.nombre !== rc.estilo.nombre ? ` · ${esc(rc.version.nombre)}` : ''}</b>
      ${rc.extrasElegidos.length ? `<span class="extras-elegidos">${rc.extrasElegidos.map((x) => `<span class="chip">+ ${esc(x.nombre)}</span>`).join('')}</span>` : ''}
    </div>
    <button class="boton" data-a="cambiarVersion" data-id="${rc.id}">${ico('ajustes', 'peq')} Cambiar</button>
  </section>`;
}

function bloqueHistorial(rc) {
  const lista = cocinadosDe(rc.id);
  const fotos = fotosDe(rc.id);
  return `<section class="bloque">
    <div class="bloque-cab"><h2>Tus fotos y opiniones</h2>
      <div class="acciones-cab"><button class="boton peq" data-a="apuntarHecha" data-id="${rc.id}">${ico('mas', 'peq')} Apuntar que la he hecho</button></div></div>
    <div class="galeria">
      <button class="foto-anadir" data-a="fotoReceta" data-id="${rc.id}">${ico('mas')}<span>Hacer foto</span></button>
      ${fotos.map((f) => miniaturaFoto(f, `data-a="verFoto" data-receta="${rc.id}"`)).join('')}
    </div>
    ${lista.length ? lista.map((c) => `<div class="historial-item">
        <div class="cab"><span class="fecha">${esc(fechaLarga(c.fecha))}</span>
          ${typeof c.valoracion === 'number' ? `<span class="estrellas-mini" style="font-size:18px">${estrellasTexto(c.valoracion)}</span><b>${c.valoracion}/5</b>` : ''}
          ${rc.conOpciones && c.version?.etiqueta ? `<span class="chip version">${esc(c.version.etiqueta)}</span>` : ''}
          ${(c.etiquetas || []).map((t) => `<span class="chip">${esc(t)}</span>`).join('')}
          <button class="boton fantasma peq" style="margin-left:auto" data-a="editarCocinado" data-id="${rc.id}" data-c="${c.id}">${ico('nota', 'peq')} Editar</button></div>
        ${c.comentario ? `<p>${esc(c.comentario)}</p>` : ''}
        ${c.cambios ? `<div class="etq-txt">La próxima vez</div><p>${esc(c.cambios)}</p>` : ''}
        ${(c.notas_pasos || []).length ? `<div class="etq-txt">Notas de los pasos</div>${c.notas_pasos.map((n) => `<p><b>Paso ${n.paso} · ${esc(n.titulo)}:</b> ${esc(n.texto)}</p>`).join('')}` : ''}
        ${fotosDe(rc.id, { cocinado: c.id }).length ? `<div class="galeria galeria-peq">${fotosDe(rc.id, { cocinado: c.id }).map((f) => miniaturaFoto(f, `data-a="verFoto" data-receta="${rc.id}"`)).join('')}</div>` : ''}
      </div>`).join('')
      : `<p class="tenue">Aún no la has hecho. Cuando la termines te preguntaré qué tal ha salido: tus notas sirven para mejorar la receta la próxima vez.</p>`}
  </section>`;
}

vista('receta', {
  montar: (app) => pintarMiniaturas(app),
  render: ({ id }) => {
    const rc = recetaCocina(id);   // con el estilo, la variante y los extras elegidos
    if (!rc) return `<main class="pantalla"><div class="vacio"><div class="grande">🤷</div><p>Esta receta ya no existe.</p><button class="boton" data-a="volverRecetas">Volver</button></div></main>`;
    const cat = categoria(rc.categoria), p = proceso(id);
    const robot = usaRobot(rc);
    const marcados = (E.cocina.ingredientes[id] || []).length;
    return `<main class="pantalla ficha">
      <div class="heroe">
        ${rc.foto ? `<img src="${esc(rc.foto)}" alt="">` : `<div class="sin-foto">${rc.emoji || '🍽️'}</div>`}
        <button class="boton-vidrio volver" data-a="volverRecetas" aria-label="Volver a las recetas">${ico('atras')}<span>Recetas</span></button>
        <div class="texto-heroe">
          <h1>${esc(rc.titulo)}</h1>
          ${rc.subtitulo ? `<p class="sub">${esc(rc.subtitulo)}</p>` : ''}
          <div class="chips">
            ${robot ? `<span class="chip robot">${ico('robot', 'peq')} Monsieur Cuisine Plus</span>` : `<span class="chip">🍳 Sin robot</span>`}
            ${precioRacion(rc) ? `<span class="chip precio">${precioRacion(rc)} por ración</span>` : ''}
            ${mediaValoracion(id) != null ? `<span class="chip">★ ${String(Math.round(mediaValoracion(id) * 10) / 10).replace('.', ',')} / 5</span>` : ''}
            <span class="chip">${ico('reloj', 'peq')} ${rc.tiempo_min} min</span>
            <span class="chip">🍽 ${esc(rc.raciones)}</span>
            ${cat ? `<span class="chip">${cat.emoji} ${esc(cat.nombre)}</span>` : ''}
            ${(rc.accesorios || []).map((a) => `<span class="chip">${ACCESORIOS[a]?.emoji || ''} ${esc(ACCESORIOS[a]?.nombre || a)}</span>`).join('')}
          </div>
        </div>
      </div>
      ${rc.conOpciones ? barraVersion(rc, p) : ''}
      ${p ? `<div style="margin-top:20px">${tarjetaCocinando(id)}</div>` : ''}
      <div class="ficha-cuerpo">
        <div class="lateral">
          <section class="bloque">
            <div class="bloque-cab"><h2>Ingredientes</h2><span class="tenue" style="font-size:15px">${rc.ingredientes.length}</span>
              <div class="acciones-cab">${marcados ? `<button class="boton fantasma peq" data-a="desmarcarIngredientes" data-id="${id}">Desmarcar</button>` : ''}</div></div>
            <p class="muy-tenue" style="font-size:14.5px;margin:-6px 0 6px">Toca para marcar lo que ya tienes preparado.</p>
            <div id="ingredientes">${rc.ingredientes.map((_, i) => filaIngrediente(rc, i)).join('')}</div>
            ${bloqueCoste(rc)}
          </section>
          ${rc.preparacion?.length ? `<section class="bloque"><div class="bloque-cab"><h2>Antes de empezar</h2></div>
            ${rc.preparacion.map((_, i) => filaPreparacion(rc, i)).join('')}</section>` : ''}
        </div>
        <div class="principal-col">
          ${bloqueNota(rc)}
          <section class="bloque">
            <div class="bloque-cab"><h2>Pasos</h2><span class="tenue" style="font-size:15px">${rc.pasos.length}</span></div>
            <div class="linea-pasos">${rc.pasos.map((ps, i) => {
              const hecho = p && p.hechos?.includes(i), actual = p && p.paso === i;
              const d = DONDE[dondePaso(ps)];
              return `<button class="paso-resumen ${actual ? 'actual' : ''}" data-a="empezarEn" data-id="${id}" data-n="${i}">
                <span class="num ${hecho ? 'hecho' : ps.tipo === 'robot' ? '' : 'fuera'}">${hecho ? ico('check', 'peq') : i + 1}</span>
                <span style="flex:1;min-width:0"><span class="t">${esc(ps.titulo)}${ps.opcional ? ' <span class="chip" style="font-size:12px;padding:2px 8px">Opcional</span>' : ''}${ps.extra ? ` <span class="marca-extra">+ ${esc(ps.extra)}</span>` : ''}</span>
                <div class="s">${d.emoji} ${esc(resumenPaso(ps))}</div></span>
                ${actual ? '<span class="chip acento">Aquí vas</span>' : ''}</button>`;
            }).join('')}</div>
          </section>
          ${rc.trucos?.length ? `<section class="bloque"><div class="bloque-cab"><h2>Trucos</h2></div>
            ${rc.trucos.map((t) => `<p style="display:flex;gap:12px;padding:8px 0;font-size:17px"><span>💡</span><span>${esc(t)}</span></p>`).join('')}</section>` : ''}
          ${bloqueHistorial(rc)}
        </div>
      </div>
      <div class="barra-cta">
        ${p
          ? `<button class="boton grande" style="max-width:220px" data-a="reiniciarReceta" data-id="${id}">${ico('reiniciar')} Empezar de nuevo</button>
             <button class="boton grande principal" data-a="empezarEn" data-id="${id}" data-n="${p.paso}">${ico('play')} Continuar · paso ${p.paso + 1} · <span data-pct="${id}">${porcentaje(id)} %</span></button>`
          : `<button class="boton grande principal" data-a="empezarEn" data-id="${id}" data-n="0">👩‍🍳 Empezar a cocinar</button>`}
      </div>
    </main>`;
  },
});

accion({
  volverRecetas: () => ir('#/recetas', { reemplazar: true }),
  marcarIngrediente: ({ id, i }) => {
    const on = alternarMarca('ingredientes', id, Number(i));
    document.querySelectorAll(`[data-a="marcarIngrediente"][data-id="${CSS.escape(id)}"][data-i="${i}"]`).forEach((x) => x.classList.toggle('marcado', on));
  },
  marcarPreparacion: ({ id, i }, el) => { el.classList.toggle('marcado', alternarMarca('preparacion', id, Number(i))); },
  desmarcarIngredientes: ({ id }) => { delete E.cocina.ingredientes[id]; repintar(); },
  empezarEn: ({ id, n }) => {
    desbloquear();
    fijarPaso(id, Number(n));
    ir(`#/cocinar/${id}/${n}`);
  },
  reiniciarReceta: async ({ id }) => {
    if (await confirmar('¿Empezar de nuevo?', 'Vuelves al paso 1 y se borran los temporizadores y lo marcado.', { ok: 'Empezar de nuevo', peligro: true })) {
      reiniciarProceso(id); repintar();
    }
  },
  apuntarHecha: ({ id }) => abrirValoracion(recetaCocina(id), { alGuardar: repintar }),
  cambiarVersion: ({ id }) => abrirEleccion(id),
  fotoReceta: async ({ id }) => {
    const ficheros = await elegirFotos();
    if (!ficheros.length) return;
    for (const f of ficheros) {
      try { await anadirFoto(f, { receta: id }); } catch (e) { tostada(e.message || 'No se ha podido guardar la foto'); }
    }
    tostada(ficheros.length === 1 ? 'Foto guardada' : `${ficheros.length} fotos guardadas`, { icono: 'check' });
    repintar();
  },
  verFoto: ({ receta: rid, id }) => abrirVisor(rid, id, { alCambiar: repintar }),
  editarCocinado: ({ id, c }) => abrirValoracion(recetaCocina(id), { idCocinado: c, alGuardar: repintar }),
});
