// Comprueba datos/recetas.json antes de publicar:  node herramientas/validar-recetas.mjs
// Revisa el formato, que cada ajuste del robot se pueda poner en la Monsieur Cuisine Plus
// (SKMK 1200 A1) y que los campos de la app (dónde, fuego, ingredientes por paso, foto) estén bien.

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

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

if (!/^\d{4}-\d{2}-\d{2}$/.test(d.actualizado || '')) mal('raíz', '"actualizado" debe ser AAAA-MM-DD');
const cats = new Set((d.categorias || []).map((c) => c.id));
for (const c of d.categorias || []) if (!c.id || !c.nombre || !c.emoji) mal('categorías', `categoría incompleta: ${JSON.stringify(c)}`);
const ids = new Set();

for (const r of d.recetas || []) {
  const R = r.id || '(sin id)';
  if (!/^[a-z0-9]+(-[a-z0-9]+)*$/.test(r.id || '')) mal(R, 'id: minúsculas, números y guiones');
  if (ids.has(r.id)) mal(R, 'id repetido'); ids.add(r.id);
  for (const k of ['titulo', 'categoria', 'emoji', 'raciones', 'tiempo_min', 'ingredientes', 'pasos']) if (r[k] == null) mal(R, `falta "${k}"`);
  if (!cats.has(r.categoria)) mal(R, `la categoría "${r.categoria}" no está en "categorias"`);
  if (r.nota != null && !(Number.isInteger(r.nota) && r.nota >= 1 && r.nota <= 10)) mal(R, 'nota: entero de 1 a 10, o null');
  if (r.nota_mejor && !(r.nota_mejor.valor > (r.nota ?? 0) && r.nota_mejor.si)) mal(R, 'nota_mejor: valor mayor que la nota y "si"');
  for (const a of r.accesorios || []) if (!ACCESORIOS.has(a)) mal(R, `accesorio desconocido "${a}"`);
  if (r.foto) { if (!fs.existsSync(path.join(RAIZ, r.foto))) ojo(R, `no existe la foto ${r.foto} (genérala con herramientas/generar-fotos.mjs)`); }
  else ojo(R, 'sin foto');
  if (r.foto && !r.foto_prompt) ojo(R, 'sin "foto_prompt" (la descripción del plato para generar la foto)');
  const robot = (r.pasos || []).some((p) => p.tipo === 'robot');
  if (r.sin_robot && robot) mal(R, 'sin_robot: true pero tiene pasos de robot');
  if (!r.sin_robot && !robot) ojo(R, 'no tiene pasos de robot: ¿falta "sin_robot": true?');
  if (r.sin_robot && r.nota != null) ojo(R, 'receta sin robot con nota: la nota mide el robot, debería ser null');
  const nIng = (r.ingredientes || []).length;
  for (const [i, ing] of (r.ingredientes || []).entries()) {
    if (!ing.cantidad || !ing.nombre) mal(`${R} ingrediente ${i + 1}`, 'necesita "cantidad" y "nombre"');
    const c = ing.compra;
    if (!c) ojo(`${R} ingrediente ${i + 1}`, `«${ing.nombre}» sin "compra": no tendrá precio`);
    else if (!c.despensa && !c.receta && !(c.mercadona && c.usa > 0 && ['g', 'ml', 'ud'].includes(c.unidad))) mal(`${R} ingrediente ${i + 1}`, 'compra: { mercadona, usa, unidad: g|ml|ud } o { despensa: true } o { receta, raciones }');
  }
  if (!r.coste) ojo(R, 'sin coste calculado: ejecuta node herramientas/precios.mjs');
  else if (!r.coste.completo) ojo(R, `coste incompleto: ${r.coste.faltan.join('; ')}`);
  if (!r.porciones) ojo(R, 'sin "porciones" (número de raciones para el precio por ración)');
  const textoReceta = JSON.stringify(r);
  if (PROHIBIDAS.test(textoReceta)) mal(R, 'usa vocabulario de otra máquina (Thermomix, Varoma, velocidad cuchara/espiga/progresiva)');

  (r.pasos || []).forEach((p, i) => {
    const P = `${R} paso ${i + 1}`;
    if (!p.titulo || !p.texto) mal(P, 'necesita "titulo" y "texto"');
    if (/\*\*|__|^#/m.test(p.texto || '')) mal(P, 'nada de markdown en los textos');
    for (const u of p.usa || []) if (!Number.isInteger(u) || u < 0 || u >= nIng) mal(P, `"usa" apunta a un ingrediente que no existe (${u}); van de 0 a ${nIng - 1}`);
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
      if (p.donde || p.fuego) ojo(P, '"donde" y "fuego" son para pasos de fuera del robot');
    } else if (p.tipo === 'fuera') {
      if (p.robot) mal(P, 'paso de fuera con ajustes de robot');
      if (!p.donde) ojo(P, 'sin "donde" (olla, sarten, horno, freidora, nevera, encimera, mesa…)');
      else if (!DONDE.has(p.donde)) mal(P, `"donde" desconocido: ${p.donde}`);
      if (p.fuego && !FUEGOS.has(p.fuego)) mal(P, `"fuego" desconocido: ${p.fuego}`);
      if (p.fuego && !['olla', 'sarten'].includes(p.donde)) ojo(P, '"fuego" es para olla o sartén');
      if (p.temporizador_s != null && !(p.temporizador_s > 0)) mal(P, 'temporizador_s debe ser positivo');
    } else mal(P, 'tipo debe ser "robot" o "fuera"');
  });
}

for (const a of avisos) console.log('  aviso ·', a);
for (const e of errores) console.log('  ERROR ·', e);
console.log(errores.length ? `\nHAY ${errores.length} PROBLEMAS` : `\nok · ${d.recetas.length} recetas${avisos.length ? ` (${avisos.length} avisos)` : ''}`);
process.exit(errores.length ? 1 : 0);
