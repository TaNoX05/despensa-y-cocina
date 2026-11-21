// Fotos propias de cada receta (hechas con la cámara del iPad o sacadas de la fototeca).
//
// · La imagen se reduce (lado mayor 1600 px, JPEG) antes de guardarla: ocupa unos 200-400 KB y,
//   al redibujarla, pierde los datos de la cámara y la ubicación.
// · Se guarda en el iPad (IndexedDB) y su ficha va en el diario (E.diario.fotos), que se copia en
//   GitHub. La imagen se sube aparte al repositorio privado: fotos/<receta>/<id>.jpg (ver sincro.js).
// · Si la foto se hizo en otro aparato, se descarga de GitHub la primera vez que se ve.

import { E, guardar } from './almacen.js';
import { nuevoId } from './util.js';

const BD = 'dyc-fotos', ALMACEN = 'fotos', LADO = 1600, CALIDAD = 0.82;
let bdPromesa = null;
const urls = new Map();   // id → objectURL ya creado
let descargador = null;   // lo pone sincro.js: (ruta) → Promise<Blob>

function abrir() {
  if (!bdPromesa) {
    bdPromesa = new Promise((ok, mal) => {
      const pet = indexedDB.open(BD, 1);
      pet.onupgradeneeded = () => pet.result.createObjectStore(ALMACEN, { keyPath: 'id' });
      pet.onsuccess = () => ok(pet.result);
      pet.onerror = () => mal(pet.error);
    });
  }
  return bdPromesa;
}
async function op(modo, fn) {
  const bd = await abrir();
  return new Promise((ok, mal) => {
    const tx = bd.transaction(ALMACEN, modo);
    const pet = fn(tx.objectStore(ALMACEN));
    tx.oncomplete = () => ok(pet?.result);
    tx.onerror = () => mal(tx.error);
  });
}
export const leerImagen = async (id) => (await op('readonly', (s) => s.get(id)))?.blob || null;
export const guardarImagen = (id, blob) => op('readwrite', (s) => s.put({ id, blob }));
const borrarImagen = (id) => op('readwrite', (s) => s.delete(id));

export function ponerDescargador(fn) { descargador = fn; }

/** Reduce y recodifica la imagen (también la endereza si el iPad la hizo girado). */
async function reducir(fichero) {
  let fuente;
  try { fuente = await createImageBitmap(fichero, { imageOrientation: 'from-image' }); }
  catch {
    fuente = await new Promise((ok, mal) => {
      const img = new Image();
      img.onload = () => ok(img); img.onerror = () => mal(new Error('No puedo abrir esta imagen'));
      img.src = URL.createObjectURL(fichero);
    });
  }
  const ancho = fuente.width, alto = fuente.height;
  const f = Math.min(1, LADO / Math.max(ancho, alto));
  const lienzo = document.createElement('canvas');
  lienzo.width = Math.round(ancho * f); lienzo.height = Math.round(alto * f);
  lienzo.getContext('2d').drawImage(fuente, 0, 0, lienzo.width, lienzo.height);
  fuente.close?.();
  const blob = await new Promise((ok) => lienzo.toBlob(ok, 'image/jpeg', CALIDAD));
  if (!blob) throw new Error('No se ha podido preparar la foto');
  return { blob, ancho: lienzo.width, alto: lienzo.height };
}

/** Guarda una foto de una receta (y, si se indica, de un día concreto del diario). */
export async function anadirFoto(fichero, { receta, cocinado = null }) {
  const { blob, ancho, alto } = await reducir(fichero);
  const id = nuevoId();
  await guardarImagen(id, blob);
  urls.set(id, URL.createObjectURL(blob));
  const ficha = { id, receta, cocinado, fecha: new Date().toISOString(), ruta: `fotos/${receta}/${id}.jpg`, ancho, alto, actualizado: Date.now() };
  (E.diario.fotos ||= []).push(ficha);
  guardar('diario');
  return ficha;
}

export function fotosDe(receta, { cocinado } = {}) {
  return (E.diario.fotos || []).filter((f) => !f.borrado && f.receta === receta && (cocinado === undefined || f.cocinado === cocinado))
    .sort((a, b) => String(b.fecha).localeCompare(String(a.fecha)));
}

export async function borrarFoto(id) {
  const f = (E.diario.fotos || []).find((x) => x.id === id);
  if (!f) return;
  Object.assign(f, { borrado: true, actualizado: Date.now() });
  guardar('diario');
  await borrarImagen(id).catch(() => {});
  if (urls.has(id)) { URL.revokeObjectURL(urls.get(id)); urls.delete(id); }
}

/** URL para mostrar la foto (del iPad o, si no está, descargada de GitHub). */
export async function urlFoto(id) {
  if (urls.has(id)) return urls.get(id);
  let blob = await leerImagen(id);
  if (!blob && descargador) {
    const f = (E.diario.fotos || []).find((x) => x.id === id);
    if (f?.ruta) { blob = await descargador(f.ruta); if (blob) await guardarImagen(id, blob); }
  }
  if (!blob) return null;
  const u = URL.createObjectURL(blob);
  urls.set(id, u);
  return u;
}

/** Rellena las miniaturas <img data-foto="id"> que haya dentro de `raiz`. */
export function pintarMiniaturas(raiz = document) {
  raiz.querySelectorAll('img[data-foto]:not([src])').forEach(async (img) => {
    const u = await urlFoto(img.dataset.foto).catch(() => null);
    if (u) img.src = u; else img.closest('.foto-mini')?.classList.add('sin-imagen');
  });
}

/** Abre la cámara o la fototeca del iPad y devuelve los ficheros elegidos. */
export function elegirFotos() {
  return new Promise((ok) => {
    const entrada = document.createElement('input');
    entrada.type = 'file'; entrada.accept = 'image/*'; entrada.multiple = true;
    entrada.style.display = 'none';
    entrada.addEventListener('change', () => { ok([...entrada.files]); entrada.remove(); });
    entrada.addEventListener('cancel', () => { ok([]); entrada.remove(); });
    document.body.appendChild(entrada);
    entrada.click();
  });
}
