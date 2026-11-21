// Calcula lo que cuesta cada receta y cada ración con los precios de Mercadona.
//   node herramientas/precios.mjs
//
// Lee el catálogo del proyecto «Despensa Mercadona» (solo lectura). Su carpeta va en el fichero .env
// como MERCADONA_DIR=… (no se sube a GitHub). Para tener precios al día, primero se sincroniza el
// catálogo en ese proyecto y luego se ejecuta esto.
//
// Cada ingrediente de datos/recetas.json lleva "compra":
//   { "mercadona": "6250", "usa": 400, "unidad": "g", "merma": 0.1, "opcional": false, "equivale": "…" }
//   { "despensa": true }                                  → sal, agua…: no suma
//   { "receta": "risotto-pollo-champinones", "raciones": 2 } → sobras de otra receta
// Como en el proyecto de Mercadona, se cuenta lo que se USA, no el envase entero:
//   coste = usa / (1 - merma) × precio_envase / contenido_envase
// El script rellena compra.producto y compra.euros, y el bloque "coste" de cada receta.

import fs from 'node:fs';
import path from 'node:path';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';

const RAIZ = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const env = fs.existsSync(path.join(RAIZ, '.env')) ? fs.readFileSync(path.join(RAIZ, '.env'), 'utf8') : '';
const DIR = (process.env.MERCADONA_DIR || env.match(/^MERCADONA_DIR=(.+)$/m)?.[1] || '').trim();
if (!DIR || !fs.existsSync(path.join(DIR, 'data/despensa.db'))) {
  console.error('No encuentro el catálogo de Mercadona. Pon MERCADONA_DIR=<carpeta del proyecto Despensa Mercadona> en .env');
  process.exit(1);
}
const require = createRequire(path.join(DIR, 'package.json'));
const Database = require('better-sqlite3');
const bd = new Database(path.join(DIR, 'data/despensa.db'), { readonly: true, fileMustExist: true });
const consulta = bd.prepare(`SELECT pr.id, pr.nombre, pr.formato, pr.cantidad_base, pr.unidad_base, pr.activo,
  pa.precio_envase, pa.fecha FROM producto pr LEFT JOIN precio_actual pa ON pa.producto_id = pr.id WHERE pr.id = ?`);

const fichero = path.join(RAIZ, 'datos/recetas.json');
const datos = JSON.parse(fs.readFileSync(fichero, 'utf8'));
const cent = (e) => Math.round(e * 100);
const hoy = new Date().toISOString().slice(0, 10);

function costeReceta(r, pila = []) {
  if (pila.includes(r.id)) throw new Error(`Bucle de recetas: ${[...pila, r.id].join(' → ')}`);
  let total = 0;
  const faltan = [];
  let fechaPrecios = '';
  for (const ing of r.ingredientes) {
    const c = ing.compra;
    if (!c) { faltan.push(ing.nombre); continue; }
    if (c.despensa) { c.euros = 0; continue; }
    if (c.receta) {
      const otra = datos.recetas.find((x) => x.id === c.receta);
      if (!otra) { faltan.push(`${ing.nombre} (no existe la receta ${c.receta})`); continue; }
      const o = costeReceta(otra, [...pila, r.id]);
      c.euros = Math.round(o.por_racion * (c.raciones || 1) * 100) / 100;
      c.producto = { nombre: `${c.raciones || 1} ${c.raciones === 1 ? 'ración' : 'raciones'} de «${otra.titulo}»` };
      if (!o.completo) faltan.push(...o.faltan.map((f) => `${f} (de ${otra.titulo})`));
      total += c.euros;
      continue;
    }
    const p = consulta.get(String(c.mercadona));
    if (!p) { faltan.push(`${ing.nombre} (el producto ${c.mercadona} ya no está en el catálogo)`); continue; }
    if (p.precio_envase == null || !p.cantidad_base) { faltan.push(`${ing.nombre} (sin precio)`); continue; }
    if (p.unidad_base !== c.unidad) { faltan.push(`${ing.nombre} (la receta pide ${c.unidad} y el producto se vende en ${p.unidad_base})`); continue; }
    const usada = c.usa / (1 - (c.merma || 0));
    const euros = (usada * p.precio_envase) / p.cantidad_base;
    c.euros = Math.round(euros * 1000) / 1000;
    c.producto = { nombre: p.nombre, formato: p.formato, precio: p.precio_envase, contenido: p.cantidad_base, unidad: p.unidad_base, activo: !!p.activo };
    if (!p.activo) faltan.push(`${ing.nombre} (${p.nombre} ya no se vende)`);
    if (p.fecha > fechaPrecios) fechaPrecios = p.fecha;
    if (!c.opcional) total += euros;
  }
  const porciones = r.porciones || Number(String(r.raciones).match(/\d+/)?.[0]) || 4;
  return {
    tienda: 'Mercadona', calculado: hoy, precios_hasta: fechaPrecios.slice(0, 10) || null,
    total: cent(total) / 100, raciones: porciones, por_racion: cent(total / porciones) / 100,
    completo: faltan.length === 0, faltan,
  };
}

for (const r of datos.recetas) {
  r.coste = costeReceta(r);
  const c = r.coste;
  console.log(`${r.titulo.padEnd(34)} ${c.total.toFixed(2).padStart(6)} € · ${c.raciones} raciones · ${c.por_racion.toFixed(2)} €/ración${c.completo ? '' : '  ⚠ incompleto: ' + c.faltan.join('; ')}`);
}
fs.writeFileSync(fichero, JSON.stringify(datos, null, 2) + '\n');
console.log('\nGuardado en datos/recetas.json');
