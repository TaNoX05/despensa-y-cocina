// Lógica de la despensa, sin interfaz: aplicar los cambios que entiende la IA, deshacerlos
// y cruzar los ingredientes de una receta con lo que hay en casa.

import { nuevoId, normalizar, palabras, numeroBonito } from './util.js';

export const LUGARES = {
  nevera: { nombre: 'Nevera', emoji: '🧊' },
  congelador: { nombre: 'Congelador', emoji: '❄️' },
  despensa: { nombre: 'Despensa', emoji: '🥫' },
};
export const UNIDADES = ['ud', 'g', 'kg', 'ml', 'l', 'paquete', 'bote', 'lata', 'botella', 'brick', 'bolsa', 'tarro', 'docena', 'manojo', 'loncha'];

const PLURALES = { ud: 'ud', paquete: 'paquetes', bote: 'botes', lata: 'latas', botella: 'botellas', brick: 'bricks', bolsa: 'bolsas', tarro: 'tarros', docena: 'docenas', manojo: 'manojos', loncha: 'lonchas' };

/** "2 l", "500 g", "3 botes", "Hay" */
export function cantidadTexto(p) {
  if (p.cantidad == null) return 'Hay';
  if (p.cantidad === 0) return 'Se acabó';
  const n = numeroBonito(p.cantidad);
  const u = p.unidad || 'ud';
  if (['g', 'kg', 'ml', 'l'].includes(u)) return `${n} ${u}`;
  if (u === 'ud') return `${n} ud`;
  return `${n} ${p.cantidad === 1 ? u : (PLURALES[u] || u + 's')}`;
}

/** Cuánto suma o resta un toque de los botones + / −. */
export function paso(p) {
  switch (p.unidad) {
    case 'g': return p.cantidad >= 1000 ? 250 : 100;
    case 'ml': return p.cantidad >= 1000 ? 250 : 100;
    case 'kg': case 'l': return 0.5;
    default: return 1;
  }
}

// Conversión entre unidades compatibles.
const BASE = { g: ['g', 1], kg: ['g', 1000], ml: ['ml', 1], l: ['ml', 1000], ud: ['ud', 1], docena: ['ud', 12] };
export function convertir(cantidad, de, a) {
  if (cantidad == null || !de || !a || de === a) return cantidad;
  const x = BASE[de], y = BASE[a];
  if (!x || !y || x[0] !== y[0]) return null;
  return Math.round(((cantidad * x[1]) / y[1]) * 1000) / 1000;
}

export function activos(productos) { return productos.filter((p) => !p.borrado); }

/** Busca un producto por id o, si la IA no lo reconoció, por nombre parecido. */
export function buscarProducto(productos, { id, nombre }) {
  const vivos = activos(productos);
  if (id) { const p = vivos.find((x) => x.id === id); if (p) return p; }
  if (!nombre) return null;
  const n = normalizar(nombre), pal = palabras(nombre).join(' ');
  return vivos.find((x) => normalizar(x.nombre) === n) || vivos.find((x) => palabras(x.nombre).join(' ') === pal) || null;
}

/**
 * Aplica una lista de acciones (las que devuelve la IA) a la despensa.
 * Devuelve { productos, cambios } sin tocar el array original. Cada cambio guarda cómo estaba
 * el producto antes para poder deshacerlo.
 */
export function aplicarAcciones(productosOriginales, acciones, ahora = Date.now()) {
  const productos = productosOriginales.map((p) => ({ ...p }));
  const cambios = [];
  for (const a of acciones || []) {
    const tipo = a.tipo;
    let p = buscarProducto(productos, a);
    const antes = p ? { ...p } : null;
    const cant = typeof a.cantidad === 'number' && isFinite(a.cantidad) ? Math.max(0, a.cantidad) : null;
    const lugar = LUGARES[a.lugar] ? a.lugar : null;
    let detalle = '';

    if (!p && ['gastar', 'eliminar', 'mover'].includes(tipo)) {
      cambios.push({ tipo: 'nada', nombre: a.nombre, emoji: a.emoji || '❔', detalle: 'No estaba en la despensa', antes: null, id: null });
      continue;
    }

    if (!p) {
      // producto nuevo ("se ha acabado X" sin tenerlo apuntado lo deja en la lista de la compra)
      const paraComprar = tipo === 'comprar' || tipo === 'agotar';
      p = {
        id: nuevoId(), nombre: limpiarNombre(a.nombre), emoji: a.emoji || '🛒',
        cantidad: paraComprar ? 0 : (cant ?? (tipo === 'añadir' ? 1 : null)),
        unidad: a.unidad && UNIDADES.includes(a.unidad) ? a.unidad : (cant != null || tipo === 'añadir' ? 'ud' : null),
        lugar: lugar || 'despensa', caduca: a.caduca || null, creado: ahora, actualizado: ahora,
      };
      if (p.unidad === 'docena') { p.cantidad = (p.cantidad ?? 1) * 12; p.unidad = 'ud'; }
      productos.push(p);
      detalle = paraComprar ? 'Apuntado para comprar' : `Nuevo · ${cantidadTexto(p)}`;
      cambios.push({ tipo: paraComprar ? 'cero' : 'mas', id: p.id, nombre: p.nombre, emoji: p.emoji, detalle, antes: null });
      continue;
    }

    const unidadAccion = a.unidad && UNIDADES.includes(a.unidad) ? a.unidad : p.unidad;
    const enSuUnidad = (c) => {
      if (c == null) return null;
      if (!p.unidad || !unidadAccion || p.unidad === unidadAccion) return c;
      return convertir(c, unidadAccion, p.unidad);
    };
    let marca = 'mas';
    const textoAntes = cantidadTexto(p);

    switch (tipo) {
      case 'añadir': {
        const c = enSuUnidad(cant ?? 1);
        if (c == null) { p.cantidad = cant ?? 1; p.unidad = unidadAccion; }
        else if (p.cantidad == null) { p.cantidad = c; p.unidad = p.unidad || unidadAccion || 'ud'; }
        else p.cantidad = redondear(p.cantidad + c);
        if (lugar) p.lugar = lugar;
        if (a.caduca) p.caduca = a.caduca;
        break;
      }
      case 'gastar': {
        marca = 'menos';
        const c = enSuUnidad(cant);
        if (c == null || p.cantidad == null) p.cantidad = cant == null ? 0 : p.cantidad;
        else p.cantidad = redondear(Math.max(0, p.cantidad - c));
        if (p.cantidad === 0) marca = 'cero';
        break;
      }
      case 'fijar': {
        marca = 'menos';
        const c = enSuUnidad(cant);
        if (c == null) { p.cantidad = cant; if (a.unidad) p.unidad = unidadAccion; }
        else p.cantidad = c;
        if (lugar) p.lugar = lugar;
        if (a.caduca) p.caduca = a.caduca;
        break;
      }
      case 'agotar': case 'comprar':
        marca = 'cero'; p.cantidad = 0; break;
      case 'mover':
        marca = 'mover'; if (lugar) p.lugar = lugar; break;
      case 'eliminar':
        marca = 'fuera'; p.borrado = true; break;
      default:
        continue;
    }
    if (a.emoji && !antes?.emoji) p.emoji = a.emoji;
    // si no ha cambiado nada (p. ej. gramos contra paquetes sin poder convertir), no cuenta como cambio
    if (antes && ['añadir', 'gastar', 'fijar'].includes(tipo) && p.cantidad === antes.cantidad && p.unidad === antes.unidad && p.lugar === antes.lugar && p.caduca === antes.caduca) {
      cambios.push({ tipo: 'nada', id: null, nombre: p.nombre, emoji: p.emoji, detalle: 'No sé cuánto cambiar: dímelo en sus unidades', antes: null });
      continue;
    }
    p.actualizado = ahora;
    const textoDespues = cantidadTexto(p);
    detalle = tipo === 'eliminar' ? 'Quitado de la lista'
      : tipo === 'mover' ? `A ${LUGARES[p.lugar].nombre.toLowerCase()}`
        : tipo === 'agotar' || p.cantidad === 0 ? 'Se acabó · a la lista de la compra'
          : `${textoAntes} → ${textoDespues}`;
    cambios.push({ tipo: marca, id: p.id, nombre: p.nombre, emoji: p.emoji, detalle, antes });
  }
  return { productos, cambios };
}

/** Deshace cambios (en orden inverso). */
export function deshacerCambios(productosActuales, cambios, ahora = Date.now()) {
  let productos = productosActuales.map((p) => ({ ...p }));
  for (const c of [...cambios].reverse()) {
    if (!c.id || c.tipo === 'nada') continue;
    if (!c.antes) {
      // era nuevo: se marca como borrado (así se propaga a la copia en la nube)
      productos = productos.map((p) => (p.id === c.id ? { ...p, borrado: true, actualizado: ahora } : p));
    } else {
      productos = productos.map((p) => (p.id === c.id ? { ...c.antes, actualizado: ahora } : p));
    }
  }
  return productos;
}

function redondear(n) { return Math.round(n * 1000) / 1000; }
function limpiarNombre(n) {
  const t = String(n || 'Producto').trim();
  return t.charAt(0).toUpperCase() + t.slice(1);
}

/**
 * ¿Tengo este ingrediente? Compara palabras con sentido: "contramuslo de pollo" ↔ "Pollo".
 * Devuelve el producto de la despensa (puede estar agotado) o null.
 */
export function productoParaIngrediente(productos, ingrediente) {
  const base = String(ingrediente.nombre || '').split(/[,(]/)[0];
  const pi = new Set(palabras(base));
  if (!pi.size) return null;
  let mejor = null, puntos = 0;
  for (const p of activos(productos)) {
    const pp = palabras(p.nombre);
    if (!pp.length) continue;
    const comunes = pp.filter((w) => pi.has(w)).length;
    // todas las palabras del producto tienen que estar en el ingrediente
    if (comunes === pp.length) {
      const pts = comunes * 10 - Math.abs(pi.size - pp.length) + (p.cantidad === 0 ? -5 : 0);
      if (pts > puntos) { puntos = pts; mejor = p; }
    }
  }
  return mejor;
}

/** Resumen "tienes X de Y" de una receta (sin contar sal, agua y similares). */
const OBVIOS = new Set(['sal', 'agua', 'pimienta', 'sal pimienta negra', 'sal pimienta']);
export function coberturaReceta(productos, receta) {
  let total = 0, tengo = 0;
  for (const ing of receta.ingredientes || []) {
    const clave = palabras(String(ing.nombre).split(/[,(]/)[0]).join(' ');
    if (OBVIOS.has(clave)) continue;
    total++;
    const p = productoParaIngrediente(productos, ing);
    if (p && p.cantidad !== 0) tengo++;
  }
  return { total, tengo };
}
