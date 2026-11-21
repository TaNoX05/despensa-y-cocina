// Datos de las recetas (datos/recetas.json) y textos para mostrarlas.

import { tiempoLegible, mmss } from './util.js';

const D = { datos: null };

export async function cargarRecetas() {
  const r = await fetch('datos/recetas.json', { cache: 'no-cache' });
  if (!r.ok) throw new Error('No se han podido cargar las recetas');
  D.datos = await r.json();
  return D.datos;
}
export const datosRecetas = () => D.datos;
export const recetas = () => D.datos?.recetas || [];
export const receta = (id) => recetas().find((r) => r.id === id);
export const categorias = () => D.datos?.categorias || [];
export const categoria = (id) => categorias().find((c) => c.id === id);
export const usaRobot = (r) => !r.sin_robot && r.pasos.some((p) => p.tipo === 'robot');
export const segundosPaso = (p) => p.temporizador_s ?? p.robot?.tiempo_s ?? 0;

export const PROGRAMAS = {
  sofreir: { nombre: 'Sofreír', boton: 'ROAST', emoji: '🍳' },
  vapor: { nombre: 'Vapor', boton: 'STEAMER', emoji: '♨️' },
  amasar: { nombre: 'Amasar', boton: 'KNEAD', emoji: '🥖' },
};
export const ACCESORIOS = {
  cuchillas: { nombre: 'Cuchillas', emoji: '🔪' },
  mariposa: { nombre: 'Mariposa', emoji: '🦋' },
  cestillo: { nombre: 'Cestillo', emoji: '🧺' },
  vaporera: { nombre: 'Vaporera', emoji: '♨️' },
  espatula: { nombre: 'Espátula', emoji: '🥄' },
};
export const MEDIDOR = {
  puesto: { texto: 'Vaso medidor puesto', emoji: '🔒' },
  quitado: { texto: 'Sin vaso medidor', emoji: '💨', alerta: true },
  cestillo: { texto: 'Cestillo sobre la tapa, sin medidor', emoji: '🧺', alerta: true },
};
/** Dónde se hace un paso que no es del robot. */
export const DONDE = {
  robot: { nombre: 'En el robot', util: 'Robot', emoji: '🤖', clase: 'robot' },
  olla: { nombre: 'En la olla', util: 'Olla', emoji: '🍲', clase: 'calor' },
  sarten: { nombre: 'En la sartén', util: 'Sartén', emoji: '🍳', clase: 'calor' },
  horno: { nombre: 'En el horno', util: 'Horno', emoji: '🔥', clase: 'calor' },
  freidora: { nombre: 'En la freidora de aire', util: 'Freidora de aire', emoji: '💨', clase: 'calor' },
  microondas: { nombre: 'En el microondas', util: 'Microondas', emoji: '📡', clase: 'calor' },
  nevera: { nombre: 'En la nevera', util: 'Nevera', emoji: '🧊', clase: 'frio' },
  congelador: { nombre: 'En el congelador', util: 'Congelador', emoji: '❄️', clase: 'frio' },
  encimera: { nombre: 'En la encimera', util: 'Encimera', emoji: '🔪', clase: '' },
  mesa: { nombre: 'A la mesa', util: 'Servir', emoji: '🍽️', clase: '' },
};
export const FUEGOS = { apagado: 0, suave: 1, 'medio-suave': 2, medio: 2, 'medio-fuerte': 3, fuerte: 4 };
export const NOMBRE_FUEGO = { apagado: 'Apagado', suave: 'Suave', 'medio-suave': 'Medio-suave', medio: 'Medio', 'medio-fuerte': 'Medio-fuerte', fuerte: 'Fuerte' };

export const dondePaso = (p) => (p.tipo === 'robot' ? 'robot' : (DONDE[p.donde] ? p.donde : 'encimera'));

export function tiempoRobot(s) { return s < 60 ? `${s} s` : mmss(s); }

export function resumenRobot(r) {
  if (!r) return '';
  const t = [];
  if (r.programa) t.push(`Programa ${PROGRAMAS[r.programa]?.nombre || r.programa}`);
  if (r.tiempo_s) t.push(tiempoLegible(r.tiempo_s));
  t.push(r.temperatura ? `${r.temperatura} °C` : 'sin calor');
  if (r.velocidad) t.push(r.velocidad === 'turbo' ? 'turbo' : `vel ${r.velocidad}`);
  if (r.inverso) t.push('giro inverso');
  return t.join(' · ');
}

export function resumenPaso(p) {
  if (p.tipo === 'robot') return resumenRobot(p.robot);
  const d = DONDE[dondePaso(p)];
  const t = [d.util];
  if (p.fuego && p.fuego !== 'apagado') t.push(`fuego ${NOMBRE_FUEGO[p.fuego]?.toLowerCase() || p.fuego}`);
  if (p.temperatura) t.push(`${p.temperatura} °C`);
  if (p.modo) t.push(p.modo.toLowerCase());
  if (p.temporizador_s) t.push(tiempoLegible(p.temporizador_s));
  return t.join(' · ');
}

export const colorNota = (n) => (n >= 9 ? '#2e8b4a' : n >= 7 ? '#d2541b' : n >= 5 ? '#d8930f' : '#d23a2c');
