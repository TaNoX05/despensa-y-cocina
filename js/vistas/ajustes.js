// Ajustes: clave de la IA, copia en GitHub, pantalla, sonido y copias de seguridad.

import { E, guardar, exportar, importar, borrarTodo } from '../almacen.js';
import { MODELOS, crearIA } from '../ia.js';
import { esLocal } from '../conexion.js';
import * as sincro from '../sincro.js';
import { estadoPantalla, mantenerEncendida, puedePantallaCompleta, alternarPantallaCompleta, esApp, esIPad } from '../pantalla.js';
import { probarAlarma } from '../sonido.js';
import { datosRecetas } from '../recetas.js';
import { esc, hace, numeroBonito } from '../util.js';
import { ico } from '../iconos.js';
import { vista, accion, repintar } from '../rutas.js';
import { confirmar, tostada } from '../ui.js';

let estadoIA = null;   // { ok, texto }
let mostrarClave = false;

const ocultar = (s) => (s && s.length > 12 ? `${s.slice(0, 8)}…${s.slice(-4)}` : s);

function interruptor(accionNombre, on) { return `<button class="interruptor ${on ? 'on' : ''}" data-a="${accionNombre}" aria-pressed="${on}"></button>`; }

function bloqueIA() {
  const clave = E.ajustes.openrouterClave;
  const est = estadoIA || (clave ? { texto: 'Guardada en este iPad', clase: 'ok' } : esLocal ? { texto: 'Usando el puente del PC (solo pruebas)', clase: 'pend' } : { texto: 'Sin configurar: la voz no funcionará', clase: 'mal' });
  return `<section class="bloque">
    <div class="bloque-cab"><h2>${ico('chispa')} Inteligencia artificial</h2></div>
    <p class="tenue" style="font-size:16px">La voz y las cuentas de la despensa usan <b>OpenRouter</b>. Tu clave se guarda solo en este iPad: nunca va a GitHub.</p>
    <div class="ajuste"><div class="txt"><b>Clave de OpenRouter</b><span class="estado-con ${est.clase}">${esc(est.texto)}</span></div></div>
    <div class="fila">
      <input class="entrada" id="clave-or" type="${mostrarClave ? 'text' : 'password'}" placeholder="sk-or-v1-…" value="${esc(mostrarClave ? clave : ocultar(clave))}" autocomplete="off" autocapitalize="off" spellcheck="false" ${clave && !mostrarClave ? 'readonly' : ''}>
      ${clave && !mostrarClave ? `<button class="boton" data-a="cambiarClave">Cambiar</button>` : `<button class="boton principal" data-a="guardarClave">Guardar</button>`}
    </div>
    <div class="fila" style="margin-top:12px;flex-wrap:wrap">
      <button class="boton peq" data-a="probarIA">${ico('check', 'peq')} Probar y ver gasto</button>
      ${clave ? `<button class="boton peq peligro" data-a="borrarClave">${ico('basura', 'peq')} Quitar clave</button>` : ''}
    </div>
    <p class="muy-tenue" style="font-size:14px;margin-top:12px">Voz: ${esc(MODELOS.voz)} (de respaldo ${esc(MODELOS.vozRespaldo)}) · Texto: ${esc(MODELOS.texto)}. Cada frase cuesta menos de una décima de céntimo.</p>
  </section>`;
}

function bloqueGitHub() {
  const g = E.ajustes.github, s = sincro.estado();
  const texto = !s.configurado ? 'Sin configurar: los datos solo están en este iPad'
    : s.sincronizando ? 'Sincronizando…' : s.error ? s.error : s.ultimo ? `Al día · ${hace(s.ultimo)}` : 'Pendiente de la primera copia';
  const clase = !s.configurado ? 'mal' : s.error ? 'mal' : s.sincronizando || s.pendiente ? 'pend' : 'ok';
  return `<section class="bloque">
    <div class="bloque-cab"><h2>${ico('nube')} Copia en GitHub</h2></div>
    <p class="tenue" style="font-size:16px">Tu despensa y tu historial de recetas se guardan en un repositorio <b>privado</b> de tu GitHub. Así no se pierden y sirven para mejorar las recetas.</p>
    <div class="ajuste"><div class="txt"><b>Estado</b><span class="estado-con ${clase}">${esc(texto)}</span></div>
      ${s.configurado ? `<button class="boton peq" data-a="sincronizarYa">${ico('reiniciar', 'peq')} Sincronizar ahora</button>` : ''}</div>
    <label class="campo"><span>Repositorio (usuario/nombre)</span><input class="entrada" id="gh-repo" placeholder="tu-usuario/despensa-datos" value="${esc(g.repo)}" autocapitalize="off" spellcheck="false"></label>
    <label class="campo"><span>Token de acceso</span><input class="entrada" id="gh-token" type="password" placeholder="github_pat_…" value="${esc(g.token ? ocultar(g.token) : '')}" autocapitalize="off" spellcheck="false" ${g.token ? 'data-guardado="1"' : ''}></label>
    ${esLocal ? `<label class="campo"><span>Servidor de la API (solo pruebas)</span><input class="entrada" id="gh-api" value="${esc(g.api || 'https://api.github.com')}" autocapitalize="off" spellcheck="false"></label>` : ''}
    <div class="fila" style="margin-top:14px;flex-wrap:wrap">
      <button class="boton principal" data-a="conectarGitHub">${ico('nube', 'peq')} Conectar y probar</button>
      ${g.token ? `<button class="boton peq peligro" data-a="desconectarGitHub">Desconectar</button>` : ''}
    </div>
    <p class="muy-tenue" style="font-size:14px;margin-top:12px">El README explica cómo crear el repositorio y el token (permiso «Contents: Read and write» solo para ese repositorio).</p>
  </section>`;
}

function bloquePantalla() {
  const p = estadoPantalla();
  return `<section class="bloque">
    <div class="bloque-cab"><h2>${ico('sol')} Pantalla y sonido</h2></div>
    <div class="ajuste"><div class="txt"><b>Pantalla siempre encendida</b>
      <span>${!p.soportado ? 'Este navegador no lo permite (hace falta iPadOS 16.4 o posterior).' : p.activo ? 'Activa: el iPad no se apagará mientras la app esté abierta.' : E.ajustes.pantallaEncendida ? 'Se activa al tocar la pantalla.' : 'Desactivada'}</span></div>
      ${interruptor('alternarEncendida', E.ajustes.pantallaEncendida)}</div>
    <div class="ajuste"><div class="txt"><b>Tema</b><span>Claro, oscuro o el del iPad</span></div>
      <div class="segmentos" style="width:300px">${[['auto', 'Auto'], ['claro', 'Claro'], ['oscuro', 'Oscuro']].map(([v, t]) => `<button class="${E.ajustes.tema === v ? 'activo' : ''}" data-a="tema" data-v="${v}">${t}</button>`).join('')}</div></div>
    ${puedePantallaCompleta() ? `<div class="ajuste"><div class="txt"><b>Pantalla completa</b><span>Mejor aún: añádela a la pantalla de inicio (abajo te explico cómo).</span></div><button class="boton peq" data-a="pantallaCompleta">${ico('expandir', 'peq')} Activar</button></div>` : ''}
    <div class="ajuste"><div class="txt"><b>Alarma de los temporizadores</b><span>Sube el volumen del iPad. Suena aunque esté en silencio.</span></div><button class="boton peq" data-a="probarSonido">${ico('campana', 'peq')} Probar</button></div>
  </section>`;
}

function bloqueDatos() {
  const n = E.despensa.productos.filter((p) => !p.borrado).length, c = E.diario.cocinados.filter((x) => !x.borrado).length;
  return `<section class="bloque">
    <div class="bloque-cab"><h2>${ico('despensa')} Tus datos</h2></div>
    <p class="tenue" style="font-size:16px">${n} productos en la despensa · ${c} recetas cocinadas en el historial.</p>
    <div class="fila" style="margin-top:12px;flex-wrap:wrap">
      <button class="boton peq" data-a="exportar">${ico('compartir', 'peq')} Descargar copia</button>
      <label class="boton peq">${ico('nube', 'peq')} Cargar copia<input type="file" accept="application/json,.json" id="importar" hidden></label>
      <button class="boton peq peligro" data-a="borrarTodo">${ico('basura', 'peq')} Borrar los datos de este iPad</button>
    </div>
  </section>`;
}

function ayudaInstalar() {
  if (esApp()) return '';
  return `<div class="ayuda-instalar">${ico('compartir', 'gr')}<div><b>Instálala como app${esIPad() ? ' en el iPad' : ''}</b><br>
    <span class="tenue">En Safari, toca <b>Compartir</b> (el cuadrado con la flecha) y luego <b>Añadir a pantalla de inicio</b>. Se abrirá a pantalla completa, sin barras, y funcionará sin conexión.</span></div></div>`;
}

vista('ajustes', {
  render: () => `<main class="pantalla ajustes">
    <header class="cabecera"><div class="titulos"><h1>Ajustes</h1><p class="sub">Recetas actualizadas el ${esc(datosRecetas()?.actualizado || '')}</p></div></header>
    ${ayudaInstalar()}
    ${bloqueIA()}
    ${bloqueGitHub()}
    ${bloquePantalla()}
    ${bloqueDatos()}
    <p class="muy-tenue" style="text-align:center;margin-top:26px;font-size:14px">Despensa y cocina · hecha para la Monsieur Cuisine Plus (SKMK 1200 A1)</p>
  </main>`,
  montar: (app) => {
    app.querySelector('#importar')?.addEventListener('change', async (e) => {
      const f = e.target.files[0]; if (!f) return;
      try { importar(JSON.parse(await f.text())); tostada('Copia cargada', { icono: 'check' }); repintar(); }
      catch (err) { tostada(err.message || 'No se ha podido cargar'); }
    });
    quitar?.(); quitar = sincro.alCambiarSincro(() => { if (location.hash.startsWith('#/ajustes')) repintarSinFoco(); });
  },
  desmontar: () => { quitar?.(); quitar = null; },
});
let quitar = null;
function repintarSinFoco() { if (!document.activeElement?.matches?.('input')) repintar(); }

accion({
  cambiarClave: () => { mostrarClave = true; repintar(); setTimeout(() => document.getElementById('clave-or')?.focus(), 50); },
  guardarClave: async () => {
    const v = document.getElementById('clave-or').value.trim();
    if (!v) { tostada('Pega tu clave de OpenRouter'); return; }
    E.ajustes.openrouterClave = v; guardar('ajustes'); mostrarClave = false;
    estadoIA = { texto: 'Comprobando…', clase: 'pend' }; repintar();
    await probar();
  },
  borrarClave: async () => {
    if (!(await confirmar('¿Quitar la clave de este iPad?', 'La voz dejará de funcionar hasta que pongas otra.', { ok: 'Quitar', peligro: true }))) return;
    E.ajustes.openrouterClave = ''; guardar('ajustes'); estadoIA = null; repintar();
  },
  probarIA: async () => { estadoIA = { texto: 'Comprobando…', clase: 'pend' }; repintar(); await probar(); },

  conectarGitHub: async () => {
    const g = E.ajustes.github;
    const repo = document.getElementById('gh-repo').value.trim().replace(/^https?:\/\/github\.com\//, '').replace(/\.git$/, '').replace(/\/$/, '');
    const tokenEl = document.getElementById('gh-token');
    const token = tokenEl.dataset.guardado && tokenEl.value === ocultar(g.token) ? g.token : tokenEl.value.trim();
    const api = document.getElementById('gh-api')?.value.trim();
    if (!/^[\w.-]+\/[\w.-]+$/.test(repo)) { tostada('Escribe el repositorio como usuario/nombre'); return; }
    if (!token) { tostada('Pega el token de GitHub'); return; }
    Object.assign(g, { repo, token }); if (api) g.api = api;
    guardar('ajustes');
    try {
      const info = await sincro.probarConexion();
      if (!info.privado) tostada('Ojo: el repositorio es público. Hazlo privado para que nadie vea tus datos.', { ms: 8000, tipo: 'ambar' });
      const ok = await sincro.sincronizar();
      tostada(ok ? 'Conectado: copia hecha en GitHub' : `Conectado, pero: ${sincro.estado().error}`, { icono: ok ? 'check' : 'aviso', ms: 5000 });
    } catch (e) { tostada(e.message, { ms: 7000 }); }
    repintar();
  },
  desconectarGitHub: async () => {
    if (!(await confirmar('¿Desconectar GitHub?', 'Los datos se quedan en este iPad y en GitHub, pero dejan de sincronizarse.', { ok: 'Desconectar' }))) return;
    E.ajustes.github = { ...E.ajustes.github, token: '' }; guardar('ajustes'); repintar();
  },
  sincronizarYa: async () => { const ok = await sincro.sincronizar(); tostada(ok ? 'Todo al día' : sincro.estado().error || 'No se ha podido sincronizar'); repintar(); },

  alternarEncendida: () => { E.ajustes.pantallaEncendida = !E.ajustes.pantallaEncendida; guardar('ajustes'); mantenerEncendida(E.ajustes.pantallaEncendida); setTimeout(repintar, 150); },
  tema: ({ v }) => { E.ajustes.tema = v; guardar('ajustes'); aplicarTema(); repintar(); },
  pantallaCompleta: () => alternarPantallaCompleta(),
  probarSonido: () => probarAlarma(),
  exportar: () => {
    const blob = new Blob([JSON.stringify(exportar(), null, 2)], { type: 'application/json' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob); a.download = `despensa-y-cocina-${new Date().toISOString().slice(0, 10)}.json`;
    document.body.appendChild(a); a.click(); a.remove();
    setTimeout(() => URL.revokeObjectURL(a.href), 2000);
  },
  borrarTodo: async () => {
    if (!(await confirmar('¿Borrar los datos de este iPad?', sincro.configurado() ? 'La copia de GitHub no se toca: al sincronizar volverán a bajar.' : 'Se borran la despensa, el historial y el progreso. No se puede deshacer.', { ok: 'Borrar', peligro: true }))) return;
    borrarTodo(); tostada('Datos borrados'); repintar();
  },
});

async function probar() {
  try {
    const clave = E.ajustes.openrouterClave?.trim();
    const cliente = clave ? crearIA({ clave }) : crearIA({ base: '/__openrouter' });
    const d = await cliente.estadoClave();
    const gastado = d.usage != null ? `gastado ${numeroBonito(d.usage)} $` : '';
    const limite = d.limit != null ? ` de ${numeroBonito(d.limit)} $` : '';
    estadoIA = { texto: `Funciona · ${gastado}${limite}`.replace(/ · $/, ''), clase: 'ok' };
  } catch (e) { estadoIA = { texto: e.message, clase: 'mal' }; }
  repintar();
}

export function aplicarTema() {
  const t = E.ajustes.tema;
  if (t === 'auto') document.documentElement.removeAttribute('data-tema');
  else document.documentElement.setAttribute('data-tema', t);
  const oscuro = t === 'oscuro' || (t === 'auto' && matchMedia('(prefers-color-scheme: dark)').matches);
  document.querySelector('meta[name="theme-color"]')?.setAttribute('content', oscuro ? '#12100e' : '#f6f1ea');
}
