// Prueba la IA de la despensa con frases de ejemplo (gasta unas décimas de céntimo).
//   node herramientas/probar-ia.mjs                → frases de ejemplo
//   node herramientas/probar-ia.mjs "frase"        → solo esa frase
//   node herramientas/probar-ia.mjs --audio f.wav  → transcribe y aplica un audio

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { crearIA } from '../js/ia.js';
import { aplicarAcciones, cantidadTexto } from '../js/despensa.js';

const RAIZ = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const env = fs.readFileSync(path.join(RAIZ, '.env'), 'utf8');
const clave = process.env.OPENROUTER_API_KEY || env.match(/^OPENROUTER_API_KEY=(.+)$/m)[1].trim();
const ia = crearIA({ clave });

let productos = [
  { id: 'p1', nombre: 'Huevos', emoji: '🥚', cantidad: 4, unidad: 'ud', lugar: 'nevera' },
  { id: 'p2', nombre: 'Chorizo para cocinar', emoji: '🌭', cantidad: 150, unidad: 'g', lugar: 'nevera' },
  { id: 'p3', nombre: 'Arroz arborio', emoji: '🍚', cantidad: 1, unidad: 'kg', lugar: 'despensa' },
  { id: 'p4', nombre: 'Tomate triturado', emoji: '🥫', cantidad: 2, unidad: 'bote', lugar: 'despensa' },
  { id: 'p5', nombre: 'Leche', emoji: '🥛', cantidad: 1, unidad: 'brick', lugar: 'despensa' },
];

const args = process.argv.slice(2);
let frases = [
  'Añade dos litros de leche, una docena de huevos y medio kilo de champiñones. Ah, y quita el chorizo, que se ha acabado.',
  'He gastado 300 gramos de arroz arborio y un bote de tomate triturado. Mete también un paquete de macarrones en la despensa y dos pechugas de pollo en el congelador.',
  'Me quedan solo tres huevos. Apunta que hay que comprar parmesano. El yogur natural caduca el viernes, tengo seis.',
];
let coste = 0;
if (args[0] === '--audio') {
  const data = fs.readFileSync(args[1]).toString('base64');
  const t0 = Date.now();
  const r = await ia.transcribir({ data, format: path.extname(args[1]).slice(1) });
  coste += r.coste;
  console.log(`Transcrito en ${Date.now() - t0} ms (${r.modelo}): ${r.texto}`);
  frases = [r.texto];
} else if (args.length) frases = [args.join(' ')];

for (const f of frases) {
  const t0 = Date.now();
  const r = await ia.interpretarDespensa(f, productos);
  coste += r.coste;
  console.log(`\n«${f}»\n  ${Date.now() - t0} ms · ${r.respuesta}`);
  for (const a of r.acciones) console.log('   ', JSON.stringify(a));
  const res = aplicarAcciones(productos, r.acciones);
  productos = res.productos;
  for (const c of res.cambios) console.log(`    → [${c.tipo}] ${c.emoji} ${c.nombre}: ${c.detalle}`);
}
console.log('\nDESPENSA FINAL:');
for (const p of productos.filter((p) => !p.borrado)) console.log(`  ${p.emoji} ${p.nombre} · ${cantidadTexto(p)} · ${p.lugar}${p.caduca ? ' · caduca ' + p.caduca : ''}`);
console.log(`\nCoste total: ${coste.toFixed(5)} $`);
