// Servidor para probar la app en el PC:  node herramientas/servidor.mjs  →  http://localhost:5180
//
// · Sirve los ficheros de la app tal cual (como hará GitHub Pages).
// · /__openrouter/…  hace de puente con OpenRouter usando la clave del fichero .env, para probar
//   la voz sin escribir la clave en la página. Solo responde a la propia app en localhost.
// · /__github/…      imita la API de GitHub (repositorio de datos falso, token "falso") para probar
//   la copia en la nube sin tocar tu cuenta.

import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { fileURLToPath } from 'node:url';

const RAIZ = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const PUERTO = Number(process.env.PUERTO || process.argv[2] || 5180);
const TIPOS = {
  '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.mjs': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8', '.json': 'application/json; charset=utf-8', '.webmanifest': 'application/manifest+json',
  '.svg': 'image/svg+xml', '.png': 'image/png', '.webp': 'image/webp', '.jpg': 'image/jpeg', '.ico': 'image/x-icon', '.md': 'text/plain; charset=utf-8',
};

function claveOpenRouter() {
  if (process.env.OPENROUTER_API_KEY) return process.env.OPENROUTER_API_KEY.trim();
  const f = path.join(RAIZ, '.env');
  const m = fs.existsSync(f) && fs.readFileSync(f, 'utf8').match(/^OPENROUTER_API_KEY=(.+)$/m);
  return m ? m[1].trim() : '';
}
const origenPropio = (req) => {
  const o = req.headers.origin;
  return !o || o === `http://localhost:${PUERTO}` || o === `http://127.0.0.1:${PUERTO}`;
};
const leerCuerpo = (req) => new Promise((ok, mal) => { const t = []; req.on('data', (c) => t.push(c)); req.on('end', () => ok(Buffer.concat(t))); req.on('error', mal); });

// ---------- GitHub falso (en memoria + fichero, para pruebas) ----------
const FALSO = path.join(RAIZ, 'herramientas/salida/github-falso.json');
let repoFalso = fs.existsSync(FALSO) ? JSON.parse(fs.readFileSync(FALSO, 'utf8')) : {};
const guardarFalso = () => { fs.mkdirSync(path.dirname(FALSO), { recursive: true }); fs.writeFileSync(FALSO, JSON.stringify(repoFalso, null, 2)); };
async function githubFalso(req, res, ruta) {
  const json = (codigo, cuerpo) => { res.writeHead(codigo, { 'Content-Type': 'application/json' }); res.end(JSON.stringify(cuerpo)); };
  if (req.headers.authorization !== 'Bearer falso') return json(401, { message: 'Bad credentials' });
  const m = ruta.match(/^\/repos\/([^/]+)\/([^/]+)(?:\/contents\/(.+?))?(?:\?.*)?$/);
  if (!m) return json(404, { message: 'Not Found' });
  const [, dueno, repo, fichero] = m;
  if (!fichero) return json(200, { full_name: `${dueno}/${repo}`, private: true, permissions: { push: true } });
  const clave = `${dueno}/${repo}/${decodeURIComponent(fichero)}`;
  if (req.method === 'GET') {
    const f = repoFalso[clave];
    return f ? json(200, { type: 'file', encoding: 'base64', content: f.content, sha: f.sha, path: fichero }) : json(404, { message: 'Not Found' });
  }
  if (req.method === 'PUT') {
    const b = JSON.parse((await leerCuerpo(req)).toString('utf8'));
    const actual = repoFalso[clave];
    if (actual && b.sha !== actual.sha) return json(409, { message: `${fichero} does not match ${b.sha}` });
    if (!actual && b.sha) return json(422, { message: 'sha wasn\'t supplied correctly' });
    const sha = crypto.createHash('sha1').update(b.content + Date.now()).digest('hex');
    repoFalso[clave] = { content: b.content, sha, mensaje: b.message };
    guardarFalso();
    return json(actual ? 200 : 201, { content: { sha, path: fichero }, commit: { message: b.message } });
  }
  if (req.method === 'DELETE') {
    const b = JSON.parse((await leerCuerpo(req)).toString('utf8'));
    const actual = repoFalso[clave];
    if (!actual) return json(404, { message: 'Not Found' });
    if (b.sha !== actual.sha) return json(409, { message: 'sha does not match' });
    delete repoFalso[clave];
    guardarFalso();
    return json(200, { commit: { message: b.message } });
  }
  json(405, { message: 'Method not allowed' });
}

// ---------- servidor ----------
http.createServer(async (req, res) => {
  try {
    const url = new URL(req.url, `http://localhost:${PUERTO}`);
    if (url.pathname.startsWith('/__openrouter/')) {
      if (!origenPropio(req)) { res.writeHead(403); return res.end('Solo para la app local'); }
      const clave = claveOpenRouter();
      if (!clave) { res.writeHead(500, { 'Content-Type': 'application/json' }); return res.end(JSON.stringify({ error: { message: 'Falta OPENROUTER_API_KEY en .env' } })); }
      const destino = 'https://openrouter.ai/api/v1/' + url.pathname.slice('/__openrouter/'.length) + url.search;
      const cuerpo = req.method === 'GET' ? undefined : await leerCuerpo(req);
      const r = await fetch(destino, {
        method: req.method, body: cuerpo,
        headers: { Authorization: `Bearer ${clave}`, 'Content-Type': req.headers['content-type'] || 'application/json', 'X-Title': 'Despensa y cocina (pruebas)' },
      });
      res.writeHead(r.status, { 'Content-Type': r.headers.get('content-type') || 'application/json' });
      return res.end(Buffer.from(await r.arrayBuffer()));
    }
    if (url.pathname.startsWith('/__github/')) return githubFalso(req, res, url.pathname.slice('/__github'.length) + url.search);

    let rel = decodeURIComponent(url.pathname);
    if (rel.endsWith('/')) rel += 'index.html';
    const fichero = path.join(RAIZ, rel);
    if (!fichero.startsWith(RAIZ) || /[\\/](\.env|\.git|herramientas)([\\/]|$)/.test(fichero.slice(RAIZ.length))) { res.writeHead(403); return res.end(); }
    fs.stat(fichero, (err, st) => {
      if (err || !st.isFile()) { res.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' }); return res.end('No existe'); }
      res.writeHead(200, { 'Content-Type': TIPOS[path.extname(fichero).toLowerCase()] || 'application/octet-stream', 'Cache-Control': 'no-cache' });
      fs.createReadStream(fichero).pipe(res);
    });
  } catch (e) {
    res.writeHead(500, { 'Content-Type': 'text/plain; charset=utf-8' });
    res.end('Error: ' + e.message);
  }
}).listen(PUERTO, '127.0.0.1', () => console.log(`Despensa y cocina en http://localhost:${PUERTO}`));
