// Pantalla siempre encendida (Screen Wake Lock) y pantalla completa.

let candado = null, deseado = false;
const oyentes = new Set();
const avisar = () => { for (const fn of oyentes) fn(estadoPantalla()); };

async function pedir() {
  if (!deseado || candado || !('wakeLock' in navigator) || document.visibilityState !== 'visible') return;
  try {
    candado = await navigator.wakeLock.request('screen');
    candado.addEventListener('release', () => { candado = null; avisar(); });
  } catch { candado = null; }
  avisar();
}

export function mantenerEncendida(si) {
  deseado = !!si;
  if (deseado) pedir();
  else if (candado) { candado.release().catch(() => {}); candado = null; avisar(); }
}

// Safari suelta el candado al salir de la app o bloquear el iPad: se vuelve a pedir al volver,
// y en cada toque por si el navegador lo exige tras un gesto.
document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'visible') pedir(); });
document.addEventListener('pointerdown', () => { if (deseado && !candado) pedir(); }, { passive: true });

export function estadoPantalla() { return { soportado: 'wakeLock' in navigator, activo: !!candado, deseado }; }
export function alCambiarPantalla(fn) { oyentes.add(fn); return () => oyentes.delete(fn); }

export const esApp = () => window.matchMedia('(display-mode: standalone)').matches || window.matchMedia('(display-mode: fullscreen)').matches || navigator.standalone === true;
export const esIPad = () => /iPad/.test(navigator.userAgent) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);

export function puedePantallaCompleta() {
  const d = document.documentElement;
  return !esApp() && !!(d.requestFullscreen || d.webkitRequestFullscreen);
}
export function enPantallaCompleta() { return !!(document.fullscreenElement || document.webkitFullscreenElement); }
export function alternarPantallaCompleta() {
  const d = document.documentElement;
  if (enPantallaCompleta()) (document.exitFullscreen || document.webkitExitFullscreen).call(document);
  else (d.requestFullscreen || d.webkitRequestFullscreen).call(d)?.catch?.(() => {});
}
