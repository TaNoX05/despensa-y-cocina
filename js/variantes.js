// Estilos, versiones y extras de cada receta.
//
// Una receta puede tener varios ESTILOS (rápida, normal, gourmet, de la abuela). Cada estilo
// tiene una o varias VERSIONES completas (sus ingredientes, pasos, tiempo, nota y precio). Los
// EXTRAS son añadidos que se eligen en el cuestionario: suman ingredientes y meten pasos en su
// sitio (antes o después de un paso, o sustituyéndolo).
//
// resolver() junta todo y devuelve una receta "plana", como las de siempre: el resto de la app
// (ficha, modo cocina, despensa, IA…) trabaja con ella sin saber de estilos.
// Las recetas antiguas, sin "estilos", se tratan como una sola versión «Normal».
//
// Este módulo sirve también en Node (precios y validador): solo usa E en las funciones del iPad.

import { E, guardar } from './almacen.js';
import { receta as recetaCruda } from './recetas.js';

export const ESTILOS = {
  rapida: { nombre: 'Rápida y sencilla', emoji: '⚡', orden: 1 },
  normal: { nombre: 'Normal', emoji: '🍽️', orden: 2 },
  gourmet: { nombre: 'Gourmet', emoji: '✨', orden: 3 },
  abuela: { nombre: 'De la abuela', emoji: '👵', orden: 4 },
};

const CAMPOS_RECETA = ['id', 'titulo', 'subtitulo', 'categoria', 'emoji', 'foto', 'foto_prompt', 'estilo_por_defecto', 'estilos', 'extras', 'trucos', 'coste'];

/** Estilos de la receta, ordenados (rápida, normal, gourmet, abuela). */
export function estilosDe(rc) {
  if (!rc) return [];
  if (rc.estilos?.length) {
    return [...rc.estilos].sort((a, b) => (ESTILOS[a.id]?.orden ?? 9) - (ESTILOS[b.id]?.orden ?? 9))
      .map((e) => ({ ...e, nombre: e.nombre || ESTILOS[e.id]?.nombre || e.id, emoji: e.emoji || ESTILOS[e.id]?.emoji || '🍽️' }));
  }
  const version = { id: 'normal', nombre: 'Normal' };
  for (const [k, v] of Object.entries(rc)) if (!CAMPOS_RECETA.includes(k) || k === 'coste') version[k] = v;
  return [{ id: 'normal', nombre: ESTILOS.normal.nombre, emoji: ESTILOS.normal.emoji, versiones: [version] }];
}
export function versionesDe(rc) { return estilosDe(rc).flatMap((e) => e.versiones.map((v) => ({ estilo: e, version: v }))); }
export function extrasDe(rc, idVersion) { return (rc?.extras || []).filter((x) => !x.para || x.para.includes(idVersion)); }
export function tieneOpciones(rc) {
  const est = estilosDe(rc);
  return est.length > 1 || est.some((e) => e.versiones.length > 1) || (rc?.extras || []).length > 0;
}

export function eleccionPorDefecto(rc) {
  const est = estilosDe(rc);
  const e = est.find((x) => x.id === rc.estilo_por_defecto) || est[0];
  const v = e.versiones[0];
  return { estilo: e.id, version: v.id, extras: extrasDe(rc, v.id).filter((x) => x.por_defecto).map((x) => x.id) };
}
/** Corrige una elección que ya no encaja (receta cambiada, extras de otra versión…). */
export function eleccionValida(rc, el) {
  if (!el) return eleccionPorDefecto(rc);
  const e = estilosDe(rc).find((x) => x.id === el.estilo);
  const v = e?.versiones.find((x) => x.id === el.version);
  if (!v) return eleccionPorDefecto(rc);
  const posibles = new Set(extrasDe(rc, v.id).map((x) => x.id));
  return { estilo: e.id, version: v.id, extras: (el.extras || []).filter((x) => posibles.has(x)) };
}
export const mismaEleccion = (a, b) => !!a && !!b && a.estilo === b.estilo && a.version === b.version
  && [...(a.extras || [])].sort().join('+') === [...(b.extras || [])].sort().join('+');

/** Lo que cuesta una elección: la versión más los extras (por ración, con las raciones de la versión). */
export function costeDe(rc, el) {
  el = eleccionValida(rc, el);
  const v = estilosDe(rc).find((e) => e.id === el.estilo).versiones.find((x) => x.id === el.version);
  const c = v.coste;
  if (!c) return null;
  const extras = extrasDe(rc, v.id).filter((x) => el.extras.includes(x.id));
  let total = c.total, completo = c.completo;
  const faltan = [...(c.faltan || [])];
  const tiendas = { ...(c.tiendas || {}) };
  for (const x of extras) {
    if (!x.coste) continue;
    total += x.coste.total;
    for (const [t, e] of Object.entries(x.coste.tiendas || {})) tiendas[t] = Math.round(((tiendas[t] || 0) + e) * 100) / 100;
    if (!x.coste.completo) { completo = false; faltan.push(...(x.coste.faltan || [])); }
  }
  const raciones = c.raciones || v.porciones || 4;
  // sin extras con coste, el precio por ración es el calculado (sin volver a redondear)
  const porRacion = total === c.total && c.por_racion != null ? c.por_racion : Math.round((total / raciones) * 100) / 100;
  return { ...c, total: Math.round(total * 100) / 100, por_racion: porRacion, raciones, tiendas, completo, faltan };
}
export const minutosDe = (rc, el) => {
  el = eleccionValida(rc, el);
  const v = estilosDe(rc).find((e) => e.id === el.estilo).versiones.find((x) => x.id === el.version);
  return (v.tiempo_min || 0) + extrasDe(rc, v.id).filter((x) => el.extras.includes(x.id)).reduce((s, x) => s + (x.minutos || 0), 0);
};

const memo = new Map();
/** La receta tal y como se va a cocinar con esa elección. */
export function resolver(rc, el) {
  if (!rc) return null;
  el = eleccionValida(rc, el);
  const clave = `${rc.id}|${el.estilo}|${el.version}|${[...el.extras].sort().join('+')}`;
  if (memo.has(clave) && memo.get(clave).base === rc) return memo.get(clave).r;

  const est = estilosDe(rc).find((e) => e.id === el.estilo);
  const v = est.versiones.find((x) => x.id === el.version);
  const extras = extrasDe(rc, v.id).filter((x) => el.extras.includes(x.id));

  const ingredientes = [
    ...(v.ingredientes || []).map((i) => ({ ...i })),
    ...extras.flatMap((x) => (x.ingredientes || []).map((i) => ({ ...i, extra: x.nombre }))),
  ];
  const posicion = new Map(ingredientes.map((ing, i) => [ing.id ?? String(i), i]));

  let pasos = (v.pasos || []).map((p) => ({ ...p }));
  for (const x of extras) {
    for (const op of x.pasos || []) {
      const { despues_de: tras, antes_de: antes, sustituye, ...paso } = op;
      paso.extra = x.nombre;
      if (sustituye) {
        const k = pasos.findIndex((p) => p.id === sustituye);
        if (k >= 0) { pasos[k] = { ...paso, id: paso.id || sustituye }; continue; }
      }
      const k = pasos.findIndex((p) => p.id === (tras || antes));
      if (k < 0) pasos.push(paso); else pasos.splice(tras ? k + 1 : k, 0, paso);
    }
  }
  // "usa" puede nombrar ingredientes por id ("chorizo") o, en recetas antiguas, por posición.
  pasos = pasos.map((p) => ({ ...p, usa: (p.usa || []).map((u) => (typeof u === 'number' ? u : posicion.get(u))).filter((n) => n != null) }));

  let nota = v.nota ?? null;
  for (const x of extras) if (x.nota != null && nota != null) nota = Math.max(nota, x.nota);
  const notaMejor = v.nota_mejor && nota != null && v.nota_mejor.valor > nota ? v.nota_mejor : null;
  const nombreEstilo = est.nombre;
  const variosEstilos = estilosDe(rc).length > 1;
  const etiqueta = [variosEstilos || est.versiones.length > 1 || est.id !== 'normal' ? nombreEstilo : null,
    est.versiones.length > 1 ? v.nombre : null, ...extras.map((x) => x.nombre)].filter(Boolean).join(' · ');

  const r = {
    ...v,
    id: rc.id, titulo: rc.titulo, categoria: rc.categoria, emoji: rc.emoji, foto: rc.foto, foto_prompt: rc.foto_prompt,
    subtitulo: v.subtitulo || rc.subtitulo || '',
    ingredientes, pasos, nota, nota_mejor: notaMejor,
    // un extra con robot (un alioli, una salsa) hace que la receta ya no sea «sin robot»
    sin_robot: !!v.sin_robot && !pasos.some((p) => p.tipo === 'robot'),
    robot: v.robot || (pasos.some((p) => p.tipo === 'robot') ? 'monsieur-cuisine-plus' : undefined),
    tiempo_min: minutosDe(rc, el),
    trucos: [...(v.trucos || []), ...(rc.estilos ? rc.trucos || [] : [])],
    coste: costeDe(rc, el),
    eleccion: el,
    estilo: { id: est.id, nombre: nombreEstilo, emoji: est.emoji },
    version: { id: v.id, nombre: v.nombre, descripcion: v.descripcion || '' },
    extrasElegidos: extras.map((x) => ({ id: x.id, nombre: x.nombre })),
    etiquetaVersion: etiqueta,
    conOpciones: tieneOpciones(rc),
  };
  delete r.estilos; delete r.extras; delete r.estilo_por_defecto; delete r.descripcion;
  memo.set(clave, { base: rc, r });
  return r;
}

// ---------------- en el iPad: qué ha elegido Diego para cada receta ----------------
/** Lo que se cocina ahora: si la receta está a medias, su versión; si no, la última elegida. */
export function eleccionActual(id) {
  const rc = recetaCruda(id);
  if (!rc) return null;
  return eleccionValida(rc, E.cocina.cocinando?.[id]?.eleccion || E.cocina.eleccion?.[id]);
}
export function guardarEleccion(id, el) {
  (E.cocina.eleccion ||= {})[id] = el;
  guardar('cocina');
}
/** La receta con la versión elegida (la que enseñan la ficha, las tarjetas y el modo cocina). */
export function resuelta(id, el) {
  const rc = recetaCruda(id);
  return rc ? resolver(rc, el || eleccionActual(id)) : null;
}
