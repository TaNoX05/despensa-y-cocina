// Utilidades comunes (sirven en el navegador y en Node para las pruebas).

export const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

export function nuevoId() {
  if (globalThis.crypto?.randomUUID) return crypto.randomUUID().slice(0, 13).replace('-', '');
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
}

/** Texto sin tildes, en minúsculas y sin signos, para comparar nombres. */
export function normalizar(s) {
  return String(s ?? '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9ñ ]+/g, ' ').replace(/\s+/g, ' ').trim();
}

const VACIAS = new Set(['de', 'del', 'la', 'el', 'los', 'las', 'para', 'con', 'sin', 'en', 'y', 'o', 'a', 'al', 'un', 'una', 'unos', 'unas', 'opcional', 'gusto', 'fresco', 'fresca', 'frescos', 'frescas']);

/** Palabras con sentido, en singular aproximado. */
export function palabras(s) {
  return normalizar(s).split(' ').filter((p) => p.length > 1 && !VACIAS.has(p) && !/^\d/.test(p)).map(singular);
}
export function singular(p) {
  if (p.length > 4 && p.endsWith('ones')) return p.slice(0, -2);          // champiñones → champiñon
  if (p.length > 4 && /[^aeiou]es$/.test(p) && !p.endsWith('tes')) return p.slice(0, -2); // panes → pan
  if (p.length > 3 && p.endsWith('s')) return p.slice(0, -1);             // huevos → huevo
  return p;
}

export function mmss(seg) {
  seg = Math.max(0, Math.round(seg));
  const h = Math.floor(seg / 3600), m = Math.floor((seg % 3600) / 60), s = seg % 60;
  const dos = (n) => String(n).padStart(2, '0');
  return h ? `${h}:${dos(m)}:${dos(s)}` : `${m}:${dos(s)}`;
}
export function tiempoLegible(seg) {
  seg = Math.round(seg || 0);
  if (seg < 60) return `${seg} s`;
  const m = Math.floor(seg / 60), s = seg % 60;
  if (m >= 60) { const h = Math.floor(m / 60), mm = m % 60; return mm ? `${h} h ${mm} min` : `${h} h`; }
  return s ? `${m} min ${s} s` : `${m} min`;
}

export function hoyISO(d = new Date()) {
  const z = (n) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${z(d.getMonth() + 1)}-${z(d.getDate())}`;
}
const MESES = ['enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio', 'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre'];
const DIAS = ['domingo', 'lunes', 'martes', 'miércoles', 'jueves', 'viernes', 'sábado'];
export function fechaLarga(iso) {
  const d = new Date(iso);
  if (isNaN(d)) return '';
  return `${DIAS[d.getDay()]} ${d.getDate()} de ${MESES[d.getMonth()]}${d.getFullYear() !== new Date().getFullYear() ? ' de ' + d.getFullYear() : ''}`;
}
export function hace(ts) {
  const s = Math.round((Date.now() - ts) / 1000);
  if (s < 45) return 'ahora mismo';
  if (s < 3600) return `hace ${Math.round(s / 60)} min`;
  if (s < 86400) return `hace ${Math.round(s / 3600)} h`;
  const d = Math.round(s / 86400);
  return d === 1 ? 'ayer' : `hace ${d} días`;
}
/** Días que faltan hasta una fecha AAAA-MM-DD (negativo si ya pasó). */
export function diasHasta(iso) {
  if (!iso) return null;
  const [a, m, d] = iso.split('-').map(Number);
  const f = new Date(a, m - 1, d), h = new Date(); h.setHours(0, 0, 0, 0);
  return Math.round((f - h) / 86400000);
}

export function numeroBonito(n) {
  if (n == null || isNaN(n)) return '';
  const r = Math.round(n * 100) / 100;
  return String(r).replace('.', ',');
}

export const esperar = (ms) => new Promise((r) => setTimeout(r, ms));

/** Base64 de un ArrayBuffer sin reventar la pila con ficheros grandes. */
export function bufferABase64(buf) {
  const bytes = new Uint8Array(buf);
  let bin = '';
  for (let i = 0; i < bytes.length; i += 0x8000) bin += String.fromCharCode.apply(null, bytes.subarray(i, i + 0x8000));
  return btoa(bin);
}
export function textoABase64(txt) { return bufferABase64(new TextEncoder().encode(txt)); }
export function base64ATexto(b64) {
  const bin = atob(b64.replace(/\s/g, ''));
  const bytes = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
  return new TextDecoder().decode(bytes);
}
