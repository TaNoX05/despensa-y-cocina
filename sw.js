// Modo sin conexión. Estrategia: primero la red (así siempre ves la última versión
// publicada) y, si no hay conexión o tarda más de 3 s, lo guardado. Las fotos salen al momento
// de lo guardado y se renuevan por detrás: si cambia una foto, se ve la nueva la siguiente vez.
// Las llamadas a OpenRouter y a GitHub no pasan por aquí.

const CACHE = 'despensa-y-cocina-v3';   // subir el número borra lo guardado de la versión anterior
const BASICOS = [
  './', 'index.html', 'manifest.webmanifest', 'css/app.css',
  'js/app.js', 'js/almacen.js', 'js/cocina.js', 'js/conexion.js', 'js/despensa.js', 'js/ia.js', 'js/iconos.js',
  'js/pantalla.js', 'js/recetas.js', 'js/rutas.js', 'js/sincro.js', 'js/sonido.js', 'js/ui.js', 'js/util.js', 'js/voz.js',
  'js/vistas/ajustes.js', 'js/vistas/cocinar.js', 'js/vistas/despensa.js', 'js/vistas/receta.js', 'js/vistas/recetas.js',
  'js/vistas/valorar.js', 'js/vistas/voz.js',
  'datos/recetas.json', 'img/iconos/icono-192.png', 'img/iconos/apple-touch-icon.png',
];

self.addEventListener('install', (e) => {
  e.waitUntil((async () => {
    const c = await caches.open(CACHE);
    await c.addAll(BASICOS);
    // las fotos de las recetas, para tenerlas sin conexión
    try {
      const datos = await (await fetch('datos/recetas.json', { cache: 'no-cache' })).json();
      await c.addAll(datos.recetas.map((r) => r.foto).filter(Boolean));
    } catch { /* se guardarán al verlas */ }
    self.skipWaiting();
  })());
});

self.addEventListener('activate', (e) => {
  e.waitUntil((async () => {
    for (const k of await caches.keys()) if (k !== CACHE) await caches.delete(k);
    await self.clients.claim();
  })());
});

function conTiempo(promesa, ms) {
  return new Promise((ok, mal) => { const t = setTimeout(() => mal(new Error('lento')), ms); promesa.then((r) => { clearTimeout(t); ok(r); }, (e) => { clearTimeout(t); mal(e); }); });
}

self.addEventListener('fetch', (e) => {
  const url = new URL(e.request.url);
  if (e.request.method !== 'GET' || url.origin !== location.origin) return;
  const esFoto = /\.(webp|png|jpg|jpeg|svg)$/i.test(url.pathname);
  e.respondWith((async () => {
    const c = await caches.open(CACHE);
    if (esFoto) {
      const guardada = await c.match(e.request);
      const nueva = fetch(e.request, { cache: 'no-cache' })
        .then((r) => { if (r.ok) c.put(e.request, r.clone()); return r; })
        .catch(() => null);
      if (guardada) { e.waitUntil(nueva); return guardada; }
      return (await nueva) || Response.error();
    }
    try {
      const r = await conTiempo(fetch(e.request, { cache: 'no-cache' }), 3000);
      if (r.ok) c.put(e.request, r.clone());
      return r;
    } catch {
      return (await c.match(e.request, { ignoreSearch: true })) || (e.request.mode === 'navigate' ? c.match('index.html') : Response.error());
    }
  })());
});
