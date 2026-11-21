// Copia en la nube: la despensa y el diario se guardan como JSON en un repositorio PRIVADO de GitHub.
// La app trabaja siempre con la copia del iPad (va al instante y sin conexión) y sincroniza detrás:
// al cambiar algo (a los 2,5 s), al abrir la app, al volver la conexión y cada pocos minutos.
// Si dos aparatos cambian lo mismo, gana el cambio más reciente de cada producto o entrada.

import { E, guardar, alGuardarDatos } from './almacen.js';
import { textoABase64, base64ATexto } from './util.js';

const FICHEROS = { despensa: 'despensa.json', diario: 'diario.json' };
const CLAVE = 'dyc:sincro';
const DIAS_BORRADOS = 60;

let S = cargarEstado();
let temporizador = null, enCurso = null;
const oyentes = new Set();

function cargarEstado() {
  try { return { despensa: {}, diario: {}, ...JSON.parse(localStorage.getItem(CLAVE) || '{}') }; }
  catch { return { despensa: {}, diario: {} }; }
}
function guardarEstado() {
  localStorage.setItem(CLAVE, JSON.stringify(S));
  const e = estado();
  for (const fn of [...oyentes]) { try { fn(e); } catch (err) { console.warn(err); } }
}
export function alCambiarSincro(fn) { oyentes.add(fn); return () => oyentes.delete(fn); }

export function configurado() { const g = E.ajustes.github; return !!(g?.repo && g?.token); }
export function estado() {
  return {
    configurado: configurado(), sincronizando: !!enCurso, error: S.error || null, ultimo: S.ultimo || null,
    pendiente: !!(S.despensa.pendiente || S.diario.pendiente),
  };
}

// ---------------- API de GitHub ----------------
function cabeceras() {
  return { Authorization: `Bearer ${E.ajustes.github.token.trim()}`, Accept: 'application/vnd.github+json', 'X-GitHub-Api-Version': '2022-11-28' };
}
function urlRepo(extra = '') {
  const g = E.ajustes.github;
  return `${(g.api || 'https://api.github.com').replace(/\/$/, '')}/repos/${g.repo.trim()}${extra}`;
}
async function pedir(url, opciones = {}) {
  let r;
  try { r = await fetch(url, { cache: 'no-store', ...opciones, headers: { ...cabeceras(), ...(opciones.headers || {}) } }); }
  catch { const e = new Error('Sin conexión con GitHub.'); e.sinRed = true; throw e; }
  if (r.status === 401) throw new Error('GitHub no acepta el token. Revísalo en Ajustes.');
  if (r.status === 403) throw new Error('El token no tiene permiso para escribir en ese repositorio.');
  return r;
}

export async function probarConexion() {
  const r = await pedir(urlRepo());
  if (r.status === 404) throw new Error('No encuentro el repositorio. Escríbelo como usuario/nombre y comprueba que el token tiene acceso.');
  if (!r.ok) throw new Error(`GitHub ha respondido ${r.status}.`);
  const j = await r.json();
  return { nombre: j.full_name, privado: j.private, escribir: j.permissions ? !!j.permissions.push : true };
}

async function leer(fichero) {
  const r = await pedir(urlRepo(`/contents/${fichero}?ref=${encodeURIComponent(E.ajustes.github.rama || 'main')}`));
  if (r.status === 404) return null;
  if (!r.ok) throw new Error(`No se ha podido leer ${fichero} (${r.status}).`);
  const j = await r.json();
  return { datos: JSON.parse(base64ATexto(j.content)), sha: j.sha };
}

async function escribir(fichero, datos, sha) {
  const cuerpo = {
    message: `Actualiza ${fichero} desde la app`,
    content: textoABase64(JSON.stringify(datos, null, 2) + '\n'),
    branch: E.ajustes.github.rama || 'main',
  };
  if (sha) cuerpo.sha = sha;
  const r = await pedir(urlRepo(`/contents/${fichero}`), { method: 'PUT', body: JSON.stringify(cuerpo), headers: { 'Content-Type': 'application/json' } });
  if (r.status === 409 || r.status === 422) { const e = new Error('conflicto'); e.conflicto = true; throw e; }
  if (r.status === 404) throw new Error('No encuentro el repositorio, o el token no tiene permiso para él. Revisa en GitHub a qué repositorio da acceso el token.');
  if (!r.ok) throw new Error(`No se ha podido guardar ${fichero} en GitHub (${r.status}).`);
  return (await r.json()).content.sha;
}

// ---------------- fusión ----------------
function porId(...listas) {
  const m = new Map();
  for (const lista of listas) for (const x of lista || []) {
    if (!x?.id) continue;
    const y = m.get(x.id);
    if (!y || (x.actualizado || 0) > (y.actualizado || 0)) m.set(x.id, x);
  }
  const limite = Date.now() - DIAS_BORRADOS * 86400000;
  return [...m.values()].filter((x) => !(x.borrado && (x.actualizado || 0) < limite));
}
export function fusionar(parte, local, remoto) {
  const a = local || {}, b = remoto || {};
  if (parte === 'despensa') {
    return {
      productos: porId(b.productos, a.productos).sort((x, y) => (x.creado || 0) - (y.creado || 0) || String(x.id).localeCompare(y.id)),
      registro: porId(b.registro, a.registro).sort((x, y) => (y.fecha || 0) - (x.fecha || 0)).slice(0, 100),
    };
  }
  return { cocinados: porId(b.cocinados, a.cocinados).sort((x, y) => String(y.fecha).localeCompare(String(x.fecha)) || String(x.id).localeCompare(y.id)) };
}
const documento = (parte, datos) => ({
  _info: 'Datos de la app Despensa y cocina. Los escribe la app; si los editas a mano, respeta el formato.',
  version: 1, ...datos,
});
const sinCabecera = (d) => { if (!d) return d; const { _info, version, actualizado, ...resto } = d; return resto; };

// ---------------- sincronizar ----------------
async function sincronizarParte(parte) {
  const fichero = FICHEROS[parte];
  for (let intento = 0; intento < 3; intento++) {
    const remoto = await leer(fichero);
    const remotoDatos = sinCabecera(remoto?.datos);
    const fusion = fusionar(parte, E[parte], remotoDatos);
    if (JSON.stringify(fusion) !== JSON.stringify(fusionar(parte, E[parte], null))) {
      E[parte] = { ...E[parte], ...fusion };
      guardar(parte, { sincronizar: false });
    }
    const remotoNormal = remoto ? JSON.stringify(fusionar(parte, remotoDatos, null)) : null;
    if (remotoNormal === JSON.stringify(fusion)) { S[parte] = { sha: remoto.sha, pendiente: false }; return; }
    try {
      const sha = await escribir(fichero, documento(parte, fusion), remoto?.sha);
      S[parte] = { sha, pendiente: false };
      return;
    } catch (e) {
      if (!e.conflicto) throw e; // si otro aparato escribió justo antes, se vuelve a leer y fusionar
    }
  }
  throw new Error('GitHub está ocupado; lo intento más tarde.');
}

export function sincronizar() {
  if (!configurado()) return Promise.resolve(false);
  if (enCurso) return enCurso;
  clearTimeout(temporizador);
  enCurso = (async () => {
    guardarEstado();
    try {
      for (const parte of Object.keys(FICHEROS)) await sincronizarParte(parte);
      S.error = null; S.ultimo = Date.now();
      return true;
    } catch (e) {
      S.error = e.sinRed ? 'Sin conexión: se subirá al volver.' : e.message;
      return false;
    } finally {
      enCurso = null;
      guardarEstado();
    }
  })();
  return enCurso;
}

function programar(ms = 2500) {
  clearTimeout(temporizador);
  if (configurado()) temporizador = setTimeout(sincronizar, ms);
}

export function iniciarSincro() {
  alGuardarDatos((parte) => { S[parte] = { ...S[parte], pendiente: true }; guardarEstado(); programar(); });
  window.addEventListener('online', () => programar(500));
  let ultimaVuelta = 0;
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'visible' && Date.now() - ultimaVuelta > 20000) { ultimaVuelta = Date.now(); programar(300); }
  });
  setInterval(() => { if (document.visibilityState === 'visible') sincronizar(); }, 3 * 60 * 1000);
  programar(800);
}
