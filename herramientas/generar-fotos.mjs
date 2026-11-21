// Genera la foto de portada de las recetas con IA (OpenRouter).
//
//   node herramientas/generar-fotos.mjs              → solo las recetas que aún no tienen foto
//   node herramientas/generar-fotos.mjs <id> [<id>]  → esas recetas, aunque ya tengan foto
//   --estilo=gouache | realista                      → estilo (por defecto gouache, el de la app)
//   --prueba                                         → no toca la foto de la app: guarda en herramientas/salida/pruebas/
//
// Lee la clave de OPENROUTER_API_KEY (variable de entorno o fichero .env, que no se sube a GitHub).
// Cada receta describe su plato en "foto_prompt"; aquí se le añade el estilo común para que
// todas las fotos parezcan de la misma sesión. Guarda img/recetas/<id>.webp y apunta el coste.

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const RAIZ = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const MODELO = 'openai/gpt-image-2.5-sunburst';
const CALIDAD = 'medium';

const ESTILOS = {
  realista:
    'Fotografía gastronómica editorial, realista, de cocina casera española. Luz natural cálida de ventana ' +
    'lateral, mesa de madera clara de roble, servilleta de lino beige, vajilla de cerámica artesanal. Ángulo de ' +
    '45 grados, poca profundidad de campo, el plato centrado y con aire alrededor. Colores apetecibles y naturales. ' +
    'Sin texto, sin letras, sin logotipos, sin manos y sin personas.',
  gouache:
    'Ilustración pintada a mano en gouache, al estilo de un libro de cocina ilustrado, nada fotográfica ni en 3D. ' +
    'Vista cenital, desde arriba. El plato descansa sobre un fondo liso de papel color crema cálido, con la textura ' +
    'del papel de acuarela visible; sin mesa, sin mantel y sin escena. Una sombra suave y corta bajo el plato. ' +
    'Alrededor, solo dos o tres ingredientes sueltos de la receta, pintados con el mismo estilo. Pinceladas ' +
    'visibles, bordes ligeramente irregulares, colores cálidos y apetitosos (terracota, ocre, rojo tomate, verde ' +
    'oliva) y brillos pintados en salsas y gratinados para que dé hambre. Composición centrada, con mucho aire ' +
    'alrededor. Sin texto, sin letras, sin logotipos, sin manos y sin personas.',
};
const ESTILO_POR_DEFECTO = 'gouache';   // estilo de la app desde el 2026-11-21
const opcion = (n) => process.argv.find((a) => a.startsWith(`--${n}=`))?.split('=')[1];
const ESTILO_ELEGIDO = opcion('estilo') || ESTILO_POR_DEFECTO;
const PRUEBA = process.argv.includes('--prueba');
if (!ESTILOS[ESTILO_ELEGIDO]) throw new Error(`Estilo desconocido: ${ESTILO_ELEGIDO} (hay: ${Object.keys(ESTILOS).join(', ')})`);
const ESTILO = ESTILOS[ESTILO_ELEGIDO];

function clave() {
  if (process.env.OPENROUTER_API_KEY) return process.env.OPENROUTER_API_KEY.trim();
  const env = path.join(RAIZ, '.env');
  const m = fs.existsSync(env) && fs.readFileSync(env, 'utf8').match(/^OPENROUTER_API_KEY=(.+)$/m);
  if (!m) throw new Error('Falta OPENROUTER_API_KEY (en el entorno o en el fichero .env).');
  return m[1].trim();
}

async function generar(receta, KEY) {
  const prompt = `${receta.foto_prompt || `${receta.titulo}. ${receta.subtitulo || ''}`}\n\n${ESTILO}`;
  const t0 = Date.now();
  const r = await fetch('https://openrouter.ai/api/v1/images', {
    method: 'POST',
    headers: { Authorization: `Bearer ${KEY}`, 'Content-Type': 'application/json', 'X-Title': 'Despensa y cocina' },
    body: JSON.stringify({
      model: MODELO,
      prompt,
      quality: CALIDAD,
      aspect_ratio: '3:2',
      output_format: 'webp',
      output_compression: 82,
      n: 1,
    }),
  });
  const texto = await r.text();
  let j;
  try { j = JSON.parse(texto); } catch { throw new Error(`Respuesta no válida (${r.status}): ${texto.slice(0, 300)}`); }
  if (!r.ok) throw new Error(`OpenRouter ${r.status}: ${JSON.stringify(j.error || j).slice(0, 400)}`);
  const img = j.data?.[0];
  let b64 = img?.b64_json;
  if (!b64 && img?.url?.startsWith('data:')) b64 = img.url.split(',')[1];
  if (!b64 && img?.url) b64 = Buffer.from(await (await fetch(img.url)).arrayBuffer()).toString('base64');
  if (!b64) {
    // Se guarda la respuesta entera para no tener que pagar otra vez la imagen.
    const crudo = path.join(RAIZ, `herramientas/salida/respuesta-${receta.id}.json`);
    fs.mkdirSync(path.dirname(crudo), { recursive: true });
    fs.writeFileSync(crudo, texto);
    throw new Error(`No encuentro la imagen en la respuesta; guardada en ${path.relative(RAIZ, crudo)}`);
  }
  const destino = PRUEBA
    ? path.join(RAIZ, `herramientas/salida/pruebas/${receta.id}-${ESTILO_ELEGIDO}.webp`)
    : path.join(RAIZ, receta.foto || `img/recetas/${receta.id}.webp`);
  fs.mkdirSync(path.dirname(destino), { recursive: true });
  fs.writeFileSync(destino, Buffer.from(b64, 'base64'));
  return { id: receta.id, fichero: path.relative(RAIZ, destino), kb: Math.round(fs.statSync(destino).size / 1024),
    segundos: Math.round((Date.now() - t0) / 1000), coste: j.usage?.cost ?? null, usage: j.usage ?? null, idGeneracion: j.id ?? null };
}

const datos = JSON.parse(fs.readFileSync(path.join(RAIZ, 'datos/recetas.json'), 'utf8'));
const pedidas = process.argv.slice(2).filter((a) => !a.startsWith('--'));
const lista = pedidas.length
  ? datos.recetas.filter((r) => pedidas.includes(r.id))
  : datos.recetas.filter((r) => !fs.existsSync(path.join(RAIZ, r.foto || `img/recetas/${r.id}.webp`)));
if (!lista.length) { console.log('No hay fotos que generar.'); process.exit(0); }

const KEY = clave();
const registro = path.join(RAIZ, 'herramientas/salida/costes-fotos.json');
fs.mkdirSync(path.dirname(registro), { recursive: true });
const historial = fs.existsSync(registro) ? JSON.parse(fs.readFileSync(registro, 'utf8')) : [];
let total = 0;
for (const receta of lista) {
  process.stdout.write(`· ${receta.titulo}… `);
  try {
    const res = await generar(receta, KEY);
    total += res.coste || 0;
    historial.push({ fecha: new Date().toISOString(), modelo: MODELO, calidad: CALIDAD, estilo: ESTILO_ELEGIDO, prueba: PRUEBA, ...res });
    console.log(`ok (${res.kb} KB, ${res.segundos} s, ${res.coste != null ? res.coste.toFixed(4) + ' $' : 'coste desconocido'})`);
  } catch (e) {
    console.log('ERROR\n  ' + e.message);
    process.exitCode = 1;
  }
}
fs.writeFileSync(registro, JSON.stringify(historial, null, 2));
console.log(`Coste de esta tanda: ${total.toFixed(4)} $`);
