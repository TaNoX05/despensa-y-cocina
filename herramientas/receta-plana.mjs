// Saca una receta "plana" (un estilo, una versión y sus extras, todo junto) en el formato de siempre,
// sin estilos. Sirve para la pestaña «Recetas robot» de Home Assistant, que no entiende de estilos.
//
//   node herramientas/receta-plana.mjs <id>                          → la versión por defecto, con sus extras por defecto
//   node herramientas/receta-plana.mjs <id> <version> [extra,extra]  → otra versión (por su id) y los extras que digas
//
// Escribe el JSON por pantalla: se copia tal cual en recetas[] del fichero de Home Assistant.

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { resolver, eleccionPorDefecto, versionesDe } from '../js/variantes.js';

const RAIZ = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const datos = JSON.parse(fs.readFileSync(path.join(RAIZ, 'datos/recetas.json'), 'utf8'));
const [id, idVersion, extras] = process.argv.slice(2);
const rc = datos.recetas.find((r) => r.id === id);
if (!rc) {
  console.error(`No existe la receta «${id || ''}». Hay: ${datos.recetas.map((r) => r.id).join(', ')}`);
  process.exit(1);
}

let el = eleccionPorDefecto(rc);
if (idVersion) {
  const v = versionesDe(rc).find((x) => x.version.id === idVersion);
  if (!v) {
    console.error(`La receta no tiene la versión «${idVersion}». Tiene: ${versionesDe(rc).map((x) => x.version.id).join(', ')}`);
    process.exit(1);
  }
  el = { estilo: v.estilo.id, version: v.version.id, extras: extras ? extras.split(',') : [] };
}

const r = resolver(rc, el);
const plana = {
  id: r.id, titulo: r.titulo, subtitulo: r.subtitulo || undefined, categoria: r.categoria, emoji: r.emoji,
  raciones: r.raciones, tiempo_min: r.tiempo_min, accesorios: r.accesorios,
  nota: r.nota, nota_mejor: r.nota_mejor || undefined, sin_robot: r.sin_robot || undefined, desglose: r.desglose,
  ingredientes: r.ingredientes.map((i) => ({ cantidad: i.cantidad, nombre: i.nombre })),
  pasos: r.pasos.map(({ extra, id: _id, ...p }) => p),
  trucos: r.trucos?.length ? r.trucos : undefined,
};
console.error(`${r.titulo} · ${r.etiquetaVersion || r.estilo.nombre} · ${r.pasos.length} pasos`);
console.log(JSON.stringify(plana, null, 2));
