// Conexión con OpenRouter: voz a texto y texto a cambios de la despensa.
// Funciona igual en el navegador (iPad) y en Node (pruebas).

import { bufferABase64, hoyISO } from './util.js';
import { activos, cantidadTexto, UNIDADES } from './despensa.js';

export const MODELOS = {
  voz: 'openai/gpt-transcribe',              // el sucesor de Whisper: el más fiable con ruido de cocina
  vozRespaldo: 'openai/whisper-large-v3-turbo',
  texto: 'deepseek/deepseek-v4.1-flash-1017',
};

const VOCABULARIO = 'Despensa de cocina en España: nevera, congelador, despensa, brick, bote, lata, paquete, docena, ' +
  'gramos, kilos, litros, tomate triturado, pimentón de la Vera, chorizo, champiñones, arroz arborio, parmesano, mozzarella.';

export class ErrorIA extends Error {
  constructor(mensaje, { estado, sinClave } = {}) { super(mensaje); this.estado = estado; this.sinClave = sinClave; }
}

/**
 * @param {{base?: string, clave?: string, modelos?: object, titulo?: string}} opciones
 *   base: 'https://openrouter.ai/api/v1' (o el puente local '/__openrouter' cuando se prueba en el PC)
 */
export function crearIA({ base = 'https://openrouter.ai/api/v1', clave = '', modelos = {}, titulo = 'Despensa y cocina' } = {}) {
  const M = { ...MODELOS, ...modelos };

  async function llamar(ruta, cuerpo, { segundos = 40 } = {}) {
    const ctl = new AbortController();
    const t = setTimeout(() => ctl.abort(), segundos * 1000);
    const cab = { 'Content-Type': 'application/json', 'X-Title': titulo };
    if (clave) cab.Authorization = `Bearer ${clave}`;
    let r;
    try {
      r = await fetch(base + ruta, { method: 'POST', headers: cab, body: JSON.stringify(cuerpo), signal: ctl.signal });
    } catch (e) {
      throw new ErrorIA(e.name === 'AbortError' ? 'La IA ha tardado demasiado. Prueba otra vez.' : 'Sin conexión con la IA. ¿Hay internet?');
    } finally { clearTimeout(t); }
    const texto = await r.text();
    let j = null;
    try { j = JSON.parse(texto); } catch { /* respuesta no JSON */ }
    if (!r.ok) {
      const msg = j?.error?.message || texto.slice(0, 200) || r.statusText;
      if (r.status === 401) throw new ErrorIA('La clave de OpenRouter no es válida. Revísala en Ajustes.', { estado: 401, sinClave: true });
      if (r.status === 402) throw new ErrorIA('No queda saldo en OpenRouter.', { estado: 402 });
      throw new ErrorIA(`La IA ha fallado (${r.status}): ${msg}`, { estado: r.status });
    }
    return j;
  }

  /** Audio (Blob del micrófono, o {data, format} en base64) → texto. */
  async function transcribir(audio, { prompt = VOCABULARIO } = {}) {
    let data, format;
    if (audio && typeof audio.arrayBuffer === 'function') {
      data = bufferABase64(await audio.arrayBuffer());
      format = formatoDe(audio.type);
    } else ({ data, format } = audio);
    const cuerpo = (model) => ({ model, input_audio: { data, format }, language: 'es', prompt });
    try {
      const j = await llamar('/audio/transcriptions', cuerpo(M.voz), { segundos: 30 });
      return { texto: (j.text || '').trim(), coste: j.usage?.cost || 0, modelo: M.voz };
    } catch (e) {
      if (e.sinClave || e.estado === 402) throw e;
      const j = await llamar('/audio/transcriptions', cuerpo(M.vozRespaldo), { segundos: 30 });
      return { texto: (j.text || '').trim(), coste: j.usage?.cost || 0, modelo: M.vozRespaldo };
    }
  }

  /** Pide una respuesta JSON que cumpla un esquema. */
  async function chatJSON({ sistema, usuario, esquema, nombre }) {
    const j = await llamar('/chat/completions', {
      model: M.texto,
      messages: [{ role: 'system', content: sistema }, { role: 'user', content: usuario }],
      temperature: 0.1,
      max_tokens: 2000,
      reasoning: { enabled: false },
      response_format: { type: 'json_schema', json_schema: { name: nombre, strict: true, schema: esquema } },
      provider: { require_parameters: true, sort: 'latency' },
    }, { segundos: 35 });
    const txt = j.choices?.[0]?.message?.content || '';
    try {
      return { datos: JSON.parse(txt.replace(/^```(?:json)?\s*|\s*```$/g, '')), coste: j.usage?.cost || 0 };
    } catch {
      throw new ErrorIA('La IA ha contestado algo que no entiendo. Prueba a decirlo de otra forma.');
    }
  }

  /** Lo que ha dicho el usuario + la despensa actual → acciones. */
  async function interpretarDespensa(texto, productos) {
    const { datos, coste } = await chatJSON({
      nombre: 'cambios_despensa', esquema: ESQUEMA_ACCIONES,
      sistema: SISTEMA_DESPENSA,
      usuario: `Hoy es ${hoyISO()} (${new Date().toLocaleDateString('es-ES', { weekday: 'long' })}).\n\n` +
        `DESPENSA ACTUAL:\n${listaParaIA(productos)}\n\nHA DICHO:\n«${texto}»`,
    });
    return { ...datos, coste };
  }

  /** Al terminar una receta: qué restar de la despensa. */
  async function descontarReceta(receta, productos) {
    const ings = receta.ingredientes.map((i) => `- ${i.cantidad} ${i.nombre}`).join('\n');
    const { datos, coste } = await chatJSON({
      nombre: 'descontar_receta', esquema: ESQUEMA_ACCIONES,
      sistema: SISTEMA_DESCONTAR,
      usuario: `RECETA: ${receta.titulo} (${receta.raciones})\nINGREDIENTES:\n${ings}\n\nDESPENSA ACTUAL:\n${listaParaIA(productos)}`,
    });
    return { ...datos, coste };
  }

  /** Comprueba la clave y devuelve el gasto (GET /key). */
  async function estadoClave() {
    const cab = clave ? { Authorization: `Bearer ${clave}` } : {};
    const r = await fetch(base + '/key', { headers: cab });
    if (r.status === 401) throw new ErrorIA('La clave no es válida.', { estado: 401, sinClave: true });
    if (!r.ok) throw new ErrorIA(`No se ha podido comprobar (${r.status}).`);
    const j = await r.json();
    return j.data || j;
  }

  return { transcribir, interpretarDespensa, descontarReceta, chatJSON, estadoClave, modelos: M };
}

export function formatoDe(tipo = '') {
  if (tipo.includes('mp4') || tipo.includes('m4a') || tipo.includes('aac')) return 'm4a';
  if (tipo.includes('webm')) return 'webm';
  if (tipo.includes('ogg')) return 'ogg';
  if (tipo.includes('wav')) return 'wav';
  if (tipo.includes('mpeg') || tipo.includes('mp3')) return 'mp3';
  return 'm4a';
}

export function listaParaIA(productos) {
  const vivos = activos(productos);
  if (!vivos.length) return '(vacía)';
  return vivos.map((p) => `${p.id} | ${p.nombre} | ${p.cantidad == null ? 'sin contar' : cantidadTexto(p)}${p.unidad ? ` [unidad: ${p.unidad}]` : ''} | ${p.lugar}`).join('\n');
}

const ESQUEMA_ACCIONES = {
  type: 'object',
  additionalProperties: false,
  required: ['acciones', 'respuesta'],
  properties: {
    acciones: {
      type: 'array',
      items: {
        type: 'object',
        additionalProperties: false,
        required: ['tipo', 'id', 'nombre', 'cantidad', 'unidad', 'lugar', 'emoji', 'caduca'],
        properties: {
          tipo: { type: 'string', enum: ['añadir', 'gastar', 'fijar', 'agotar', 'eliminar', 'mover', 'comprar'] },
          id: { type: ['string', 'null'] },
          nombre: { type: 'string' },
          cantidad: { type: ['number', 'null'] },
          unidad: { type: ['string', 'null'], enum: [...UNIDADES, null] },
          lugar: { type: ['string', 'null'], enum: ['nevera', 'congelador', 'despensa', null] },
          emoji: { type: 'string' },
          caduca: { type: ['string', 'null'] },
        },
      },
    },
    respuesta: { type: 'string' },
  },
};

const SISTEMA_DESPENSA = `Eres el asistente de la despensa de una casa en España. Recibes lo que el usuario ha dicho en voz alta (transcrito automáticamente, puede traer errores de reconocimiento) y la lista actual de productos. Devuelves los cambios que hay que hacer.

TIPOS DE ACCIÓN
- "añadir": ha comprado algo o lo mete. Si el producto ya existe, la cantidad es lo que hay que SUMAR.
- "gastar": ha usado o quita una parte. La cantidad es lo que hay que RESTAR.
- "fijar": dice cuánto queda exactamente ("me quedan 3 huevos", "hay medio litro de leche").
- "agotar": se ha acabado, o lo quita sin decir cantidad ("quita el chorizo, que se ha acabado", "no queda pan"). Se queda en la lista como pendiente de comprar.
- "eliminar": quiere borrarlo de la lista del todo ("borra el kétchup de la lista", "ya no compro eso").
- "mover": lo cambia de sitio ("he pasado el pollo al congelador").
- "comprar": lo apunta para comprar sin tenerlo ("apunta que hay que comprar leche").

REGLAS
- Una acción por producto. Si dice varias cosas, varias acciones, en el orden en que las dice.
- Si el producto ya está en la lista, usa su id (aunque lo diga distinto: "los huevos" = "Huevos", "el tomate" = "Tomate triturado" si es el único tomate) y expresa la cantidad en SU unidad, convirtiendo si hace falta (1 kg = 1000 g; medio litro = 0.5 l o 500 ml; una docena = 12 ud). Si el producto se cuenta por envases (brick, bote, lata, paquete, botella) y el usuario habla en litros o kilos, pásalo a envases con el tamaño normal en España (brick o botella de leche = 1 l; paquete de pasta o de arroz = 500 g o 1 kg según diga; bote de tomate = 400 g). Si es nuevo, id null.
- Nombres cortos, como en la etiqueta de la tienda, con mayúscula inicial y sin cantidades: "Leche", "Huevos", "Tomate triturado", "Pechuga de pollo", "Macarrones".
- Unidades: ud, g, kg, ml, l, paquete, bote, lata, botella, brick, bolsa, tarro, docena, manojo, loncha. Elige la natural: huevos en ud, leche en brick o l, arroz en g o kg, tomate triturado en bote o lata.
- Si añade algo sin decir cantidad, cantidad 1 en la unidad natural ("compré pan" → 1 ud). Para "gastar" sin cantidad usa "agotar" solo si da a entender que se acabó; si no, cantidad null.
- lugar: nevera, congelador o despensa. Si no lo dice, el sitio normal en una casa española (fresco y lácteos abiertos en la nevera, congelados en el congelador, secos, latas y bricks sin abrir en la despensa). En productos que ya existen, null salvo que lo cambie.
- emoji: uno que represente el producto (🥛 🥚 🍅 🧀 🍗 🍝 🍚 🧅 🧄 🫑 🥩 🐟 🍞 🫒 🥫 ...).
- caduca: fecha AAAA-MM-DD si la dice ("caduca el viernes": calcula desde hoy); si no, null.
- Ignora muletillas y frases que no son de la despensa. Si no hay nada que hacer, "acciones" vacío y explícalo en "respuesta".
- "respuesta": una frase corta y natural en español de España confirmando lo hecho, como hablaría una persona ("Hecho: leche y huevos dentro, y el chorizo a la lista de la compra").`;

const SISTEMA_DESCONTAR = `Ayudas a llevar la despensa de una casa en España. El usuario acaba de cocinar una receta. Propón qué restar de la despensa por haberla hecho.

REGLAS
- Solo productos que ya están en la despensa (usa su id). Nada de productos nuevos.
- "gastar" con la cantidad usada, SIEMPRE en la unidad del producto de la despensa (convierte: 1 kg = 1000 g, 1 l = 1000 ml). Si el producto se cuenta en envases (paquete, bote, lata, brick, botella, bolsa) y la receta da gramos o mililitros, pásalo a envases con el tamaño normal en España (paquete de pasta o arroz = 500 g, bote o lata de tomate = 400 g, brick = 1 l) y redondea a envases enteros cuando sea casi uno entero (400 g de un paquete de 500 g = 1 paquete).
- Si la receta usa todo lo que queda o más, "agotar".
- Si no se puede saber cuánto se gastó (sal, especias, aceite en cantidades pequeñas o productos sin contar), no lo incluyas.
- Rellena todos los campos: nombre y emoji como están en la despensa, lugar null y caduca null.
- "respuesta": una frase corta en español de España resumiendo lo que se resta.`;
