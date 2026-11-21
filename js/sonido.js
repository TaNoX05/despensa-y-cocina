// Sonido de alarmas y avisos con Web Audio.
// En iPad el sonido solo arranca después de un toque: desbloquear() se llama en el primer toque.

let ctx = null, salida = null, bucle = null;
export let desbloqueado = false;

export function contexto() {
  if (!ctx) {
    const C = window.AudioContext || window.webkitAudioContext;
    ctx = new C();
    // un compresor para que el pitido se oiga fuerte sin distorsionar
    const comp = ctx.createDynamicsCompressor();
    comp.threshold.value = -18; comp.ratio.value = 6;
    salida = ctx.createGain(); salida.gain.value = 1;
    salida.connect(comp).connect(ctx.destination);
  }
  return ctx;
}

export function desbloquear() {
  try {
    // que suene aunque el iPad esté en silencio (Safari 16.4+)
    if (navigator.audioSession && navigator.audioSession.type !== 'play-and-record') navigator.audioSession.type = 'playback';
    const c = contexto();
    if (c.state !== 'running') c.resume();
    const b = c.createBuffer(1, 1, 22050), s = c.createBufferSource();
    s.buffer = b; s.connect(c.destination); s.start(0);
    desbloqueado = true;
  } catch { /* sin audio */ }
}

function nota(frec, inicio, dur, vol = 0.5, tipo = 'triangle') {
  const c = contexto();
  const o = c.createOscillator(), g = c.createGain();
  o.type = tipo; o.frequency.value = frec;
  g.gain.setValueAtTime(0.0001, inicio);
  g.gain.exponentialRampToValueAtTime(vol, inicio + 0.015);
  g.gain.exponentialRampToValueAtTime(0.0001, inicio + dur);
  o.connect(g).connect(salida);
  o.start(inicio); o.stop(inicio + dur + 0.05);
}

/** Aviso suave (recordatorios a mitad de paso). */
export function campanita() {
  try {
    const c = contexto(); if (c.state !== 'running') c.resume();
    const t = c.currentTime + 0.02;
    nota(1046.5, t, 0.5, 0.35, 'sine'); nota(1318.5, t + 0.16, 0.6, 0.35, 'sine'); nota(1568, t + 0.32, 0.9, 0.3, 'sine');
  } catch { /* sin audio */ }
}

function pitidoAlarma() {
  const c = contexto(); if (c.state !== 'running') c.resume();
  const t = c.currentTime + 0.02;
  [0, 0.2, 0.4].forEach((d) => { nota(1760, t + d, 0.15, 0.6, 'square'); nota(880, t + d, 0.15, 0.25, 'triangle'); });
  nota(2093, t + 0.75, 0.35, 0.5, 'square');
}

export function empezarAlarma() {
  pararAlarma();
  try { pitidoAlarma(); bucle = setInterval(pitidoAlarma, 1500); } catch { /* sin audio */ }
}
export function pararAlarma() { clearInterval(bucle); bucle = null; }
export function probarAlarma() { desbloquear(); empezarAlarma(); setTimeout(pararAlarma, 2600); }
