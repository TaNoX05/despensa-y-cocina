// Comprueba datos/recetas.json antes de publicar:  node herramientas/validar-recetas.mjs
// Revisa cada estilo y versión, cada extra (que encaje en las versiones para las que es), que cada
// ajuste del robot se pueda poner en la Monsieur Cuisine Plus (SKMK 1200 A1) y los campos de la app.

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { estilosDe, extrasDe, resolver, ESTILOS } from '../js/variantes.js';

const RAIZ = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const fichero = process.argv[2] || path.join(RAIZ, 'datos/recetas.json');
const d = JSON.parse(fs.readFileSync(fichero, 'utf8'));

const TEMPERATURAS = new Set([37, 45, 50, 55, 60, 65, 70, 75, 80, 85, 90, 95, 100, 105, 110, 115, 120, 125, 130]);
const DONDE = new Set(['olla', 'sarten', 'horno', 'freidora', 'microondas', 'nevera', 'congelador', 'encimera', 'mesa']);
const FUEGOS = new Set(['apagado', 'suave', 'medio-suave', 'medio', 'medio-fuerte', 'fuerte']);
const ACCESORIOS = new Set(['cuchillas', 'mariposa', 'cestillo', 'vaporera', 'espatula']);
const PROHIBIDAS = /thermomix|varoma|velocidad cuchara|velocidad espiga|velocidad progresiva/i;

const errores = [], avisos = [];
const mal = (donde, msg) => errores.push(`${donde}: ${msg}`);
const ojo = (donde, msg) => avisos.push(`${donde}: ${msg}`);

function compra(donde, ing) {
  const c = ing.compra;
  if (!c) { ojo(donde, `«${ing.nombre}» sin "compra": no tendrá precio`); return; }
  if (c.despensa || c.receta) return;
  if (!((c.mercadona || c.masymas) && c.usa > 0 && ['g', 'ml', 'ud'].includes(c.unidad))) {
    mal(donde, 'compra: { mercadona | masymas, usa, unidad: g|ml|ud } o { despensa: true } o { receta, raciones }');
  }
}

function paso(P, p, idsIng) {
  if (!p.titulo || !p.texto) mal(P, 'necesita "titulo" y "texto"');
  if (/\*\*|__|^#/m.test(p.texto || '')) mal(P, 'nada de markdown en los textos');
  for (const u of p.usa || []) {
    if (typeof u === 'number') { if (u < 0 || u >= idsIng.length) mal(P, `"usa" apunta a un ingrediente que no existe (${u})`); }
    else if (!idsIng.includes(u)) mal(P, `"usa" nombra un ingrediente que no está: «${u}»`);
  }
  if (p.recordatorio && !(p.recordatorio.quedan_s > 0 && p.recordatorio.texto)) mal(P, 'recordatorio: { quedan_s, texto }');
  if (p.tipo === 'robot') {
    const b = p.robot;
    if (!b) { mal(P, 'paso de robot sin "robot"'); return; }
    const v = b.velocidad === 'turbo' ? 10 : Number(b.velocidad);
    if (b.velocidad != null && typeof b.velocidad !== 'string') mal(P, 'velocidad siempre como texto: "1"…"10" o "turbo"');
    if (b.velocidad != null && !(b.velocidad === 'turbo' || (v >= 0 && v <= 10))) mal(P, 'velocidad imposible');
    if (b.temperatura && !TEMPERATURAS.has(b.temperatura)) mal(P, `temperatura imposible (${b.temperatura} °C): 37 o de 45 a 130 de 5 en 5`);
    if (b.temperatura && v > 3) mal(P, 'con temperatura la velocidad no pasa de 3');
    if (b.temperatura && !(b.tiempo_s && b.velocidad)) mal(P, 'para calentar hacen falta tiempo, temperatura y velocidad');
    if (!b.tiempo_s && b.programa !== 'vapor') ojo(P, 'sin tiempo');
    if (b.tiempo_s > 5400) mal(P, 'más de 90 minutos');
    if (v >= 7 && b.tiempo_s > 900) mal(P, 'de velocidad 7 a 10, 15 minutos como mucho');
    if (b.velocidad === 'turbo' && (b.temperatura || b.inverso || b.accesorio === 'mariposa')) mal(P, 'turbo solo en frío, sin giro inverso y sin mariposa');
    if (b.programa && !['sofreir', 'vapor', 'amasar'].includes(b.programa)) mal(P, `programa desconocido "${b.programa}"`);
    if (b.programa === 'sofreir' && b.tiempo_s > 840) mal(P, 'Sofreír: 14 minutos como mucho');
    if (b.programa === 'amasar' && b.tiempo_s > 180) mal(P, 'Amasar: 3 minutos por tanda');
    if (b.accesorio && !ACCESORIOS.has(b.accesorio)) mal(P, `accesorio desconocido "${b.accesorio}"`);
    if (b.accesorio === 'mariposa' && (v < 1 || v > 4)) mal(P, 'mariposa: velocidad de 1 a 4');
    if (b.medidor && !['puesto', 'quitado', 'cestillo'].includes(b.medidor)) mal(P, 'medidor: puesto, quitado o cestillo');
  } else if (p.tipo === 'fuera') {
    if (p.robot) mal(P, 'paso de fuera con ajustes de robot');
    if (!p.donde) ojo(P, 'sin "donde" (olla, sarten, horno, freidora, nevera, encimera, mesa…)');
    else if (!DONDE.has(p.donde)) mal(P, `"donde" desconocido: ${p.donde}`);
    if (p.fuego && !FUEGOS.has(p.fuego)) mal(P, `"fuego" desconocido: ${p.fuego}`);
    if (p.fuego && !['olla', 'sarten'].includes(p.donde)) ojo(P, '"fuego" es para olla o sartén');
    if (p.temporizador_s != null && !(p.temporizador_s > 0)) mal(P, 'temporizador_s debe ser positivo');
  } else mal(P, 'tipo debe ser "robot" o "fuera"');
}

if (!/^\d{4}-\d{2}-\d{2}$/.test(d.actualizado || '')) mal('raíz', '"actualizado" debe ser AAAA-MM-DD');
const cats = new Set((d.categorias || []).map((c) => c.id));
for (const c of d.categorias || []) if (!c.id || !c.nombre || !c.emoji) mal('categorías', `categoría incompleta: ${JSON.stringify(c)}`);
const ids = new Set();

for (const r of d.recetas || []) {
  const R = r.id || '(sin id)';
  if (!/^[a-z0-9]+(-[a-z0-9]+)*$/.test(r.id || '')) mal(R, 'id: minúsculas, números y guiones');
  if (ids.has(r.id)) mal(R, 'id repetido'); ids.add(r.id);
  for (const k of ['titulo', 'categoria', 'emoji']) if (r[k] == null) mal(R, `falta "${k}"`);
  if (!cats.has(r.categoria)) mal(R, `la categoría "${r.categoria}" no está en "categorias"`);
  if (r.foto) { if (!fs.existsSync(path.join(RAIZ, r.foto))) ojo(R, `no existe la foto ${r.foto}`); } else ojo(R, 'sin foto');
  if (r.foto && !r.foto_prompt) ojo(R, 'sin "foto_prompt"');
  if (PROHIBIDAS.test(JSON.stringify(r))) mal(R, 'usa vocabulario de otra máquina (Thermomix, Varoma, velocidad cuchara/espiga/progresiva)');
  if (!r.estilos) ojo(R, 'formato antiguo (sin "estilos"): la app la trata como una sola versión «Normal»');

  const estilos = estilosDe(r);
  if (r.estilos && r.estilo_por_defecto && !estilos.some((e) => e.id === r.estilo_por_defecto)) mal(R, `estilo_por_defecto «${r.estilo_por_defecto}» no existe`);
  const idsVersion = new Set();
  for (const e of estilos) {
    if (!ESTILOS[e.id]) ojo(`${R} › ${e.id}`, 'estilo fuera de los cuatro de siempre (rapida, normal, gourmet, abuela)');
    if (!e.versiones?.length) { mal(`${R} › ${e.id}`, 'estilo sin versiones'); continue; }
    for (const v of e.versiones) {
      const V = `${R} › ${e.id}${e.versiones.length > 1 ? ' › ' + v.id : ''}`;
      if (idsVersion.has(v.id)) mal(V, `id de versión repetido «${v.id}» (tienen que ser únicos en la receta)`); idsVersion.add(v.id);
      if (e.versiones.length > 1 && !v.nombre) mal(V, 'las versiones de un estilo con varias necesitan "nombre"');
      for (const k of ['tiempo_min', 'raciones', 'ingredientes', 'pasos']) if (v[k] == null) mal(V, `falta "${k}"`);
      if (!v.porciones) ojo(V, 'sin "porciones" (número de raciones para el precio por ración)');
      if (v.nota != null && !(Number.isInteger(v.nota) && v.nota >= 1 && v.nota <= 10)) mal(V, 'nota: entero de 1 a 10, o null');
      if (v.nota_mejor && !(v.nota_mejor.valor > (v.nota ?? 0) && v.nota_mejor.si)) mal(V, 'nota_mejor: valor mayor que la nota y "si"');
      for (const a of v.accesorios || []) if (!ACCESORIOS.has(a)) mal(V, `accesorio desconocido "${a}"`);
      const robot = (v.pasos || []).some((p) => p.tipo === 'robot');
      if (v.sin_robot && robot) mal(V, 'sin_robot: true pero tiene pasos de robot');
      if (v.sin_robot && v.nota != null) ojo(V, 'versión sin robot con nota: la nota mide el robot, debería ser null');
      const idsIng = (v.ingredientes || []).map((i, k) => i.id ?? k);
      if (r.estilos && (v.ingredientes || []).some((i) => !i.id)) mal(V, 'en el formato de estilos cada ingrediente lleva "id"');
      if (new Set(idsIng).size !== idsIng.length) mal(V, 'ids de ingredientes repetidos');
      for (const [k, ing] of (v.ingredientes || []).entries()) {
        if (!ing.cantidad || !ing.nombre) mal(`${V} ingrediente ${k + 1}`, 'necesita "cantidad" y "nombre"');
        compra(`${V} ingrediente ${k + 1}`, ing);
      }
      const idsPaso = (v.pasos || []).map((p) => p.id).filter(Boolean);
      if (r.estilos && (v.pasos || []).some((p) => !p.id)) mal(V, 'en el formato de estilos cada paso lleva "id"');
      if (new Set(idsPaso).size !== idsPaso.length) mal(V, 'ids de pasos repetidos');
      (v.pasos || []).forEach((p, k) => paso(`${V} paso ${k + 1}${p.id ? ' (' + p.id + ')' : ''}`, p, idsIng));
      if (!v.coste) ojo(V, 'sin coste calculado: ejecuta node herramientas/precios.mjs');
      else if (!v.coste.completo) ojo(V, `coste incompleto: ${v.coste.faltan.join('; ')}`);

      // cada extra de esta versión, por separado
      for (const x of extrasDe(r, v.id)) {
        const X = `${V} + extra ${x.id}`;
        const idsIngX = [...idsIng, ...(x.ingredientes || []).map((i) => i.id)];
        for (const op of x.pasos || []) {
          const ancla = op.sustituye || op.despues_de || op.antes_de;
          const anclas = [...idsPaso, ...(x.pasos || []).map((q) => q.id)];
          if (ancla && !anclas.includes(ancla)) mal(X, `el paso «${op.id}» se engancha a «${ancla}», que no existe en esta versión`);
          paso(`${X} paso ${op.id}`, op, idsIngX);
        }
        const res = resolver(r, { estilo: e.id, version: v.id, extras: [x.id] });
        if (res.pasos.length < (v.pasos || []).length) mal(X, 'al aplicarlo se pierden pasos');
      }
    }
  }
  for (const x of r.extras || []) {
    const X = `${R} + extra ${x.id || '(sin id)'}`;
    if (!x.id || !x.nombre) mal(X, 'un extra necesita "id" y "nombre"');
    for (const vid of x.para || []) if (!idsVersion.has(vid)) mal(X, `"para" nombra una versión que no existe: «${vid}»`);
    for (const [k, ing] of (x.ingredientes || []).entries()) { if (!ing.id) mal(X, 'cada ingrediente del extra lleva "id"'); compra(`${X} ingrediente ${k + 1}`, ing); }
    if (!x.coste) ojo(X, 'sin coste calculado');
    else if (!x.coste.completo) ojo(X, `coste incompleto: ${x.coste.faltan.join('; ')}`);
  }
}

for (const a of avisos) console.log('  aviso ·', a);
for (const e of errores) console.log('  ERROR ·', e);
console.log(errores.length ? `\nHAY ${errores.length} PROBLEMAS` : `\nok · ${d.recetas.length} recetas${avisos.length ? ` (${avisos.length} avisos)` : ''}`);
process.exit(errores.length ? 1 : 0);
