// Genera los iconos PNG de la app a partir de herramientas/icono.svg usando Edge (o Chrome) sin ventana.
//   node herramientas/generar-iconos.mjs

import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { execFileSync } from 'node:child_process';
import { fileURLToPath, pathToFileURL } from 'node:url';

const RAIZ = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const SVG = fs.readFileSync(path.join(RAIZ, 'herramientas/icono.svg'), 'utf8');
const NAVEGADORES = [
  'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe',
  'C:/Program Files/Microsoft/Edge/Application/msedge.exe',
  'C:/Program Files/Google/Chrome/Application/chrome.exe',
];
const nav = NAVEGADORES.find((p) => fs.existsSync(p));
if (!nav) throw new Error('No encuentro Edge ni Chrome');

const ICONOS = [
  { fichero: 'icono-192.png', tam: 192, escala: 1 },
  { fichero: 'icono-512.png', tam: 512, escala: 1 },
  { fichero: 'apple-touch-icon.png', tam: 180, escala: 1 },
  { fichero: 'icono-maskable-512.png', tam: 512, escala: 0.78 },
];
const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'iconos-'));
const destino = path.join(RAIZ, 'img/iconos');
fs.mkdirSync(destino, { recursive: true });
for (const ic of ICONOS) {
  const svg = SVG.replace('scale(var(--escala, 1))', `scale(${ic.escala})`);
  const html = path.join(tmp, `${ic.tam}-${ic.escala}.html`);
  fs.writeFileSync(html, `<!doctype html><html><body style="margin:0;overflow:hidden"><div style="width:${ic.tam}px;height:${ic.tam}px">${svg.replace('<svg ', `<svg width="${ic.tam}" height="${ic.tam}" `)}</div></body></html>`);
  const salida = path.join(destino, ic.fichero);
  execFileSync(nav, ['--headless=new', '--disable-gpu', '--hide-scrollbars', '--force-device-scale-factor=1',
    `--window-size=${ic.tam},${ic.tam}`, `--screenshot=${salida}`, pathToFileURL(html).href], { stdio: 'ignore' });
  for (let i = 0; i < 30 && !fs.existsSync(salida); i++) execFileSync(process.execPath, ['-e', 'setTimeout(()=>{},100)']);
  console.log('·', ic.fichero, fs.existsSync(salida) ? `${Math.round(fs.statSync(salida).size / 1024)} KB` : 'FALLO');
}
