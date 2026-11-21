// Progreso de cocina (paso actual, pasos hechos, notas) y temporizadores con alarma.
// Se guarda solo en el iPad: si cierras la app, al volver todo sigue donde estaba y las
// cuentas atrás siguen contando (se guardan con su hora de fin).

import { E, guardar } from './almacen.js';
import { receta, segundosPaso } from './recetas.js';
import { empezarAlarma, pararAlarma, campanita } from './sonido.js';
import { esc, mmss } from './util.js';
import { tostada } from './ui.js';

const oyentes = new Set();
export function alCambiarRelojes(fn) { oyentes.add(fn); return () => oyentes.delete(fn); }
const avisar = () => { for (const fn of oyentes) fn(); };

// ---------------- proceso ----------------
export const proceso = (id) => E.cocina.cocinando[id];
export function asegurarProceso(id) {
  if (!E.cocina.cocinando[id]) E.cocina.cocinando[id] = { paso: 0, iniciada: Date.now(), tocado: Date.now(), timers: {}, hechos: [], notas: {} };
  const p = E.cocina.cocinando[id];
  p.timers ||= {}; p.hechos ||= []; p.notas ||= {};
  return p;
}
export function fijarPaso(id, n) {
  const p = asegurarProceso(id);
  // al pasar al siguiente, el paso que dejas queda hecho (saltar desde la lista no marca nada)
  if (n === p.paso + 1 && !p.hechos.includes(p.paso)) p.hechos.push(p.paso);
  p.paso = n; p.tocado = Date.now();
  guardar('cocina');
}
export function quitarProceso(id) {
  delete E.cocina.cocinando[id]; delete E.cocina.ingredientes[id]; delete E.cocina.preparacion[id];
  guardar('cocina'); avisar();
}
export function reiniciarProceso(id) {
  E.cocina.cocinando[id] = { paso: 0, iniciada: Date.now(), tocado: Date.now(), timers: {}, hechos: [], notas: {} };
  delete E.cocina.ingredientes[id]; delete E.cocina.preparacion[id];
  guardar('cocina'); avisar();
}
/** La receta en curso que se tocó por última vez. */
export function procesoPrincipal() {
  const ids = Object.keys(E.cocina.cocinando).filter((id) => receta(id));
  if (!ids.length) return null;
  ids.sort((a, b) => (E.cocina.cocinando[b].tocado || 0) - (E.cocina.cocinando[a].tocado || 0));
  return ids[0];
}
export function porcentaje(id) {
  const rc = receta(id), p = proceso(id);
  if (!rc || !p) return 0;
  let frac = 0;
  const t = p.timers?.[p.paso];
  if (t && t.total) frac = Math.min(1, Math.max(0, (t.total - Math.max(0, restante(t))) / t.total));
  return Math.min(100, Math.round(((p.paso + frac) / rc.pasos.length) * 100));
}

// ---------------- ingredientes y preparación marcados ----------------
export function marcado(tipo, id, i) { return (E.cocina[tipo][id] || []).includes(i); }
export function alternarMarca(tipo, id, i) {
  const m = (E.cocina[tipo][id] ||= []);
  const j = m.indexOf(i);
  if (j >= 0) m.splice(j, 1); else m.push(i);
  guardar('cocina');
  return j < 0;
}

// ---------------- temporizadores ----------------
export const claveT = (id, n) => `${id}:${n}`;
export function partes(c) { const i = c.lastIndexOf(':'); return [c.slice(0, i), Number(c.slice(i + 1))]; }
export function T(c) { const [id, n] = partes(c); return proceso(id)?.timers?.[n]; }
export function restante(t) { return t.finEn ? (t.finEn - Date.now()) / 1000 : t.restante; }
export const corriendo = (t) => !!t?.finEn;
export const vivo = (t) => !!t && (!!t.finEn || (t.restante > 0 && t.restante < t.total));
export const sonando = (t) => !!t?.finEn && restante(t) <= 0;

export function asegurarTimer(id, n) {
  const rc = receta(id); if (!rc) return null;
  const paso = rc.pasos[n]; const seg = paso && segundosPaso(paso);
  if (!seg) return null;
  const p = asegurarProceso(id);
  if (!p.timers[n]) p.timers[n] = { total: seg, restante: seg, finEn: null, tanda: 1 };
  return p.timers[n];
}
function cambio() { guardar('cocina'); avisar(); }
export function arrancar(c) {
  const t = T(c); if (!t) return;
  if (restante(t) <= 0) { t.restante = t.total; t.recordado = false; }
  t.finEn = Date.now() + t.restante * 1000; t.avisado = false;
  const [id] = partes(c); const p = proceso(id); if (p) p.tocado = Date.now();
  cambio();
}
export function pausar(c) { const t = T(c); if (!t) return; t.restante = Math.max(0, restante(t)); t.finEn = null; cambio(); }
export function reiniciarTimer(c) { const t = T(c); if (!t) return; t.finEn = null; t.restante = t.total; t.avisado = false; t.recordado = false; cambio(); }
export function sumar(c, s) {
  const t = T(c); if (!t) return;
  if (t.finEn) {
    t.finEn = Math.max(Date.now() + 1000, t.finEn + s * 1000);
    const r = restante(t); if (r > t.total) t.total = Math.ceil(r);
  } else if (t.restante === t.total) {
    t.total = t.restante = Math.max(30, t.total + s);          // aún sin empezar: cambia el tiempo base
  } else {
    t.restante = Math.max(0, t.restante + s); if (t.restante > t.total) t.total = t.restante;
  }
  if (s > 0) t.avisado = false;
  cambio();
}
export function otraTanda(c) {
  const t = T(c); if (!t) return;
  t.tanda = (t.tanda || 1) + 1; t.restante = t.total; t.finEn = Date.now() + t.total * 1000; t.avisado = false; t.recordado = false;
  cambio();
}
export function todosLosTimers() {
  const out = [];
  for (const [id, p] of Object.entries(E.cocina.cocinando)) {
    if (!receta(id)) continue;
    for (const [n, t] of Object.entries(p.timers || {})) out.push({ clave: `${id}:${n}`, t, id, n: Number(n) });
  }
  return out;
}
/** El temporizador que antes va a sonar (o que ya suena). */
export function timerMasUrgente(id) {
  const lista = todosLosTimers().filter((x) => (!id || x.id === id) && vivo(x.t));
  lista.sort((a, b) => restante(a.t) - restante(b.t) || (corriendo(b.t) - corriendo(a.t)));
  return lista[0] || null;
}

// ---------------- alarma ----------------
let colaAlarmas = [], alarmaVisible = null;

function mostrarAlarma(clave) {
  if (alarmaVisible) { if (!colaAlarmas.includes(clave)) colaAlarmas.push(clave); return; }
  alarmaVisible = clave;
  const [id, n] = partes(clave); const rc = receta(id); const paso = rc?.pasos[n];
  const capa = document.createElement('div');
  capa.className = 'alarma';
  capa.innerHTML = `<div>
      <div class="campana">⏰</div><h2>¡Tiempo!</h2>
      <p><b>${esc(paso?.titulo || '')}</b><br>${esc(rc?.titulo || '')}</p>
      <div class="botones"><button data-al="parar">Parar</button><button class="sec" data-al="mas">+1 min</button></div>
    </div>`;
  capa.addEventListener('click', (e) => {
    const b = e.target.closest('[data-al]'); if (!b) return;
    if (b.dataset.al === 'mas') { const t = T(clave); if (t) { t.finEn = Date.now() + 60000; t.avisado = false; } }
    else { const t = T(clave); if (t) { t.finEn = null; t.restante = 0; t.avisado = true; } }
    cerrarAlarma(); cambio();
  });
  document.body.appendChild(capa);
  empezarAlarma();
  if (navigator.vibrate) navigator.vibrate([500, 250, 500, 250, 500]);
}
function cerrarAlarma() {
  pararAlarma();
  document.querySelector('.alarma')?.remove();
  alarmaVisible = null;
  const sig = colaAlarmas.shift();
  if (sig && sonando(T(sig))) mostrarAlarma(sig);
}

// ---------------- reloj general (4 veces por segundo) ----------------
function vuelta() {
  for (const { clave, t, id, n } of todosLosTimers()) {
    if (!t.finEn) continue;
    const r = restante(t);
    if (r <= 0 && !t.avisado) { t.avisado = true; guardar('cocina'); mostrarAlarma(clave); avisar(); }
    const rec = receta(id)?.pasos[n]?.recordatorio;
    if (rec && !t.recordado && r > 0 && r <= rec.quedan_s) {
      t.recordado = true; guardar('cocina');
      campanita();
      tostada(rec.texto, { tipo: 'ambar', ms: 0, accion: 'Vale', icono: 'campana' });
    }
  }
  // refresco de números y anillos sin redibujar la pantalla
  document.querySelectorAll('[data-t]').forEach((el) => {
    const t = T(el.dataset.t); if (!t) return;
    const r = Math.max(0, restante(t));
    const txt = mmss(r); if (el.textContent !== txt) el.textContent = txt;
    const chip = el.closest('.reloj-chip, .reloj-mini');
    if (chip) chip.classList.toggle('fin', sonando(t) || (t.avisado && r <= 0 && !!t.finEn));
  });
  document.querySelectorAll('[data-arco]').forEach((el) => {
    const t = T(el.dataset.arco); if (!t) return;
    el.style.strokeDashoffset = String(Number(el.dataset.l) * (1 - Math.max(0, restante(t)) / (t.total || 1)));
  });
  document.querySelectorAll('[data-pct]').forEach((el) => { const v = porcentaje(el.dataset.pct) + ' %'; if (el.textContent !== v) el.textContent = v; });
  document.querySelectorAll('[data-barra]').forEach((el) => { el.style.width = porcentaje(el.dataset.barra) + '%'; });
  document.querySelectorAll('[data-anillo-pct]').forEach((el) => {
    el.style.strokeDashoffset = String(Number(el.dataset.l) * (1 - porcentaje(el.dataset.anilloPct) / 100));
  });
}
export function iniciarReloj() { setInterval(vuelta, 250); vuelta(); }
