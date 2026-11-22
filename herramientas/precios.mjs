// Calcula lo que cuesta cada receta, cada estilo y versión, y cada extra.
//   node herramientas/precios.mjs
//
// Precios de MERCADONA y de MASYMAS (Elche, vía Glovo), del catálogo del proyecto «Despensa Mercadona»
// (solo lectura). Su carpeta va en .env como MERCADONA_DIR=… (no se sube a GitHub). Para tener precios
// al día, primero se sincronizan los catálogos en ese proyecto y luego se ejecuta esto.
//
// Cada ingrediente lleva "compra":
//   { "mercadona": "6250", "usa": 400, "unidad": "g", "merma": 0.1, "opcional": false, "equivale": "…" }
//   { "masymas": "45582", "usa": 270, "unidad": "g" }        → producto de Masymas
//   { "despensa": true }                                     → sal, agua…: no suma
//   { "receta": "risotto-pollo-champinones", "raciones": 2 } → sobras de otra receta (su versión por defecto)
// Se cuenta lo que se USA, no el envase entero:  coste = usa / (1 - merma) × precio_envase / contenido
// Rellena compra.producto y compra.euros, el "coste" de cada versión y de cada extra, y el "coste"
// de la receta (el de su versión por defecto, para la tarjeta).

import fs from 'node:fs';
import path from 'node:path';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';
import { estilosDe, versionesDe, eleccionPorDefecto, costeDe } from '../js/variantes.js';

const RAIZ = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const env = fs.existsSync(path.join(RAIZ, '.env')) ? fs.readFileSync(path.join(RAIZ, '.env'), 'utf8') : '';
const DIR = (process.env.MERCADONA_DIR || env.match(/^MERCADONA_DIR=(.+)$/m)?.[1] || '').trim();
if (!DIR || !fs.existsSync(path.join(DIR, 'data/despensa.db'))) {
  console.error('No encuentro los catálogos. Pon MERCADONA_DIR=<carpeta del proyecto Despensa Mercadona> en .env');
  process.exit(1);
}
const require = createRequire(path.join(DIR, 'package.json'));
const Database = require('better-sqlite3');
const bd = new Database(path.join(DIR, 'data/despensa.db'), { readonly: true, fileMustExist: true });
const TIENDAS = {
  mercadona: {
    nombre: 'Mercadona',
    consulta: bd.prepare(`SELECT pr.id, pr.nombre, pr.formato, pr.cantidad_base, pr.unidad_base, pr.activo, pa.precio_envase, pa.fecha
      FROM producto pr LEFT JOIN precio_actual pa ON pa.producto_id = pr.id WHERE pr.id = ?`),
  },
  masymas: {
    nombre: 'Masymas',
    consulta: bd.prepare(`SELECT p.id, p.nombre, p.formato, p.cantidad_base, p.unidad_base, p.activo, p.agotado, a.precio_envase, a.fecha
      FROM tienda_producto p LEFT JOIN tienda_precio_actual a ON a.tienda_id = p.tienda_id AND a.producto_id = p.id
      WHERE p.tienda_id = 'masymas-elche' AND p.id = ?`),
  },
};

const fichero = path.join(RAIZ, 'datos/recetas.json');
const datos = JSON.parse(fs.readFileSync(fichero, 'utf8'));
const hoy = new Date().toISOString().slice(0, 10);
const redondear = (e, d = 2) => Math.round(e * 10 ** d) / 10 ** d;

/** Coste de una lista de ingredientes (rellena compra.producto y compra.euros). */
function costeIngredientes(ingredientes, pila) {
  let total = 0, fecha = '';
  const faltan = [], porTienda = {};
  for (const ing of ingredientes || []) {
    const c = ing.compra;
    if (!c) { faltan.push(ing.nombre); continue; }
    if (c.despensa) { c.euros = 0; continue; }
    if (c.receta) {
      const otra = datos.recetas.find((x) => x.id === c.receta);
      if (!otra) { faltan.push(`${ing.nombre} (no existe la receta ${c.receta})`); continue; }
      const co = costeRecetaPorDefecto(otra, pila);
      c.euros = redondear(co.por_racion * (c.raciones || 1));
      c.producto = { nombre: `${c.raciones || 1} ${c.raciones === 1 ? 'ración' : 'raciones'} de «${otra.titulo}»` };
      if (!co.completo) faltan.push(...co.faltan.map((f) => `${f} (de ${otra.titulo})`));
      for (const [t, e] of Object.entries(co.tiendas || {})) porTienda[t] = (porTienda[t] || 0) + (e / co.raciones) * (c.raciones || 1);
      total += c.euros;
      continue;
    }
    const clave = c.mercadona ? 'mercadona' : c.masymas ? 'masymas' : null;
    if (!clave) { faltan.push(`${ing.nombre} (sin tienda)`); continue; }
    const tienda = TIENDAS[clave];
    const p = tienda.consulta.get(String(c[clave]));
    if (!p) { faltan.push(`${ing.nombre} (el producto ${c[clave]} ya no está en ${tienda.nombre})`); continue; }
    if (p.precio_envase == null || !p.cantidad_base) { faltan.push(`${ing.nombre} (sin precio en ${tienda.nombre})`); continue; }
    if (p.unidad_base !== c.unidad) { faltan.push(`${ing.nombre} (la receta pide ${c.unidad} y en ${tienda.nombre} se vende en ${p.unidad_base})`); continue; }
    const euros = ((c.usa / (1 - (c.merma || 0))) * p.precio_envase) / p.cantidad_base;
    c.euros = redondear(euros, 3);
    c.producto = { tienda: tienda.nombre, nombre: p.nombre, formato: p.formato, precio: p.precio_envase, contenido: p.cantidad_base, unidad: p.unidad_base, activo: !!p.activo };
    if (!p.activo) faltan.push(`${ing.nombre} (${p.nombre} ya no se vende en ${tienda.nombre})`);
    if (p.fecha > fecha) fecha = p.fecha;
    if (!c.opcional) { total += euros; porTienda[tienda.nombre] = (porTienda[tienda.nombre] || 0) + euros; }
  }
  return { total, faltan, fecha, porTienda };
}

const hechas = new Map();
function costeRecetaPorDefecto(rc, pila = []) {
  if (pila.includes(rc.id)) throw new Error(`Bucle de recetas: ${[...pila, rc.id].join(' → ')}`);
  if (!hechas.has(rc.id)) calcularReceta(rc, [...pila, rc.id]);
  return costeDe(rc, eleccionPorDefecto(rc));
}

function calcularReceta(rc, pila = [rc.id]) {
  hechas.set(rc.id, true);
  const conEstilos = !!rc.estilos;
  for (const { version: v } of (conEstilos ? versionesDe(rc) : [{ version: rc }])) {
    const r = costeIngredientes(v.ingredientes, pila);
    const raciones = v.porciones || Number(String(v.raciones).match(/\d+/)?.[0]) || 4;
    v.coste = {
      calculado: hoy, precios_hasta: r.fecha.slice(0, 10) || null,
      total: redondear(r.total), raciones, por_racion: redondear(r.total / raciones),
      tiendas: Object.fromEntries(Object.entries(r.porTienda).map(([t, e]) => [t, redondear(e)])),
      completo: r.faltan.length === 0, faltan: r.faltan,
    };
  }
  for (const x of rc.extras || []) {
    const r = costeIngredientes(x.ingredientes, pila);
    x.coste = { total: redondear(r.total), tiendas: Object.fromEntries(Object.entries(r.porTienda).map(([t, e]) => [t, redondear(e)])), completo: r.faltan.length === 0, faltan: r.faltan };
  }
  if (conEstilos) rc.coste = costeDe(rc, eleccionPorDefecto(rc));
}

for (const rc of datos.recetas) if (!hechas.has(rc.id)) calcularReceta(rc);

// Resumen
for (const rc of datos.recetas) {
  console.log(`\n${rc.titulo}`);
  for (const e of estilosDe(rc)) for (const v of e.versiones) {
    const c = v.coste;
    const tiendas = Object.entries(c.tiendas || {}).map(([t, x]) => `${t} ${x.toFixed(2)}`).join(' + ');
    console.log(`  ${(e.nombre + (e.versiones.length > 1 ? ' · ' + v.nombre : '')).padEnd(44)} ${String(v.tiempo_min).padStart(3)} min  ${c.total.toFixed(2).padStart(6)} €  ${c.por_racion.toFixed(2)} €/ración (${c.raciones})${tiendas ? '  [' + tiendas + ']' : ''}${c.completo ? '' : '  ⚠ falta: ' + c.faltan.join('; ')}`);
  }
  for (const x of rc.extras || []) {
    console.log(`    + extra «${x.nombre}»${x.para ? ' (' + x.para.join(', ') + ')' : ''}: ${x.coste.total.toFixed(2)} € la receta${x.coste.completo ? '' : '  ⚠ falta: ' + x.coste.faltan.join('; ')}`);
  }
}
fs.writeFileSync(fichero, JSON.stringify(datos, null, 2) + '\n');
console.log('\nGuardado en datos/recetas.json');
