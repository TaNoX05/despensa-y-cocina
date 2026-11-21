// Grabación del micrófono con detección de silencio (para cortar solo cuando terminas de hablar).

import { contexto } from './sonido.js';

export function vozDisponible() { return !!(navigator.mediaDevices?.getUserMedia && window.MediaRecorder); }

/**
 * Empieza a grabar. Devuelve { fin (Promise<Blob|null>), parar(), cancelar() }.
 * alNivel(0..1) se llama en cada fotograma para animar; corta solo tras `silencioMs` callado.
 */
export async function empezarGrabacion({ alNivel, silencioMs = 1600, maxMs = 45000 } = {}) {
  try { if (navigator.audioSession) navigator.audioSession.type = 'play-and-record'; } catch { /* nada */ }
  let stream;
  try {
    stream = await navigator.mediaDevices.getUserMedia({ audio: { echoCancellation: true, noiseSuppression: true, autoGainControl: true } });
  } catch (e) {
    restaurarSesion();
    const err = new Error(e?.name === 'NotAllowedError'
      ? 'No tengo permiso para usar el micrófono. Actívalo en Ajustes del iPad › Safari › Micrófono.'
      : 'No puedo usar el micrófono.');
    err.permiso = e?.name === 'NotAllowedError';
    throw err;
  }
  const tipos = ['audio/mp4', 'audio/webm;codecs=opus', 'audio/webm', 'audio/ogg;codecs=opus'];
  const mimeType = tipos.find((t) => window.MediaRecorder.isTypeSupported?.(t)) || '';
  const rec = new MediaRecorder(stream, mimeType ? { mimeType, audioBitsPerSecond: 64000 } : undefined);
  const trozos = [];
  rec.ondataavailable = (e) => { if (e.data && e.data.size) trozos.push(e.data); };

  const ctx = contexto();
  if (ctx.state !== 'running') await ctx.resume().catch(() => {});
  const fuente = ctx.createMediaStreamSource(stream);
  const analizador = ctx.createAnalyser();
  analizador.fftSize = 1024;
  fuente.connect(analizador);
  const buf = new Float32Array(analizador.fftSize);

  const t0 = performance.now();
  let habla = false, ultimoSonido = t0, suelo = 0, muestras = 0, raf = 0, cancelado = false;

  const fin = new Promise((resolver, rechazar) => {
    rec.onstop = () => { limpiar(); resolver(cancelado || !trozos.length ? null : new Blob(trozos, { type: rec.mimeType || mimeType || 'audio/mp4' })); };
    rec.onerror = (e) => { limpiar(); rechazar(e.error || new Error('Error al grabar')); };
  });

  function vuelta() {
    analizador.getFloatTimeDomainData(buf);
    let s = 0;
    for (let i = 0; i < buf.length; i++) s += buf[i] * buf[i];
    const rms = Math.sqrt(s / buf.length);
    const ahora = performance.now(), t = ahora - t0;
    if (t < 350) { muestras++; suelo += (rms - suelo) / muestras; }      // ruido de fondo de la cocina
    const umbral = Math.max(0.012, suelo * 2.6);
    if (rms > umbral) { if (t > 250) habla = true; ultimoSonido = ahora; }
    alNivel?.(Math.min(1, rms / 0.1), t);
    if ((habla && ahora - ultimoSonido > silencioMs && t > 1200) || t > maxMs) { parar(); return; }
    raf = requestAnimationFrame(vuelta);
  }
  function limpiar() {
    cancelAnimationFrame(raf);
    stream.getTracks().forEach((tr) => tr.stop());
    try { fuente.disconnect(); } catch { /* nada */ }
    restaurarSesion();
  }
  function parar() { if (rec.state !== 'inactive') rec.stop(); }
  function cancelar() { cancelado = true; parar(); }

  rec.start(250);
  raf = requestAnimationFrame(vuelta);
  return { fin, parar, cancelar, inicio: t0 };
}

function restaurarSesion() { try { if (navigator.audioSession) navigator.audioSession.type = 'playback'; } catch { /* nada */ } }
