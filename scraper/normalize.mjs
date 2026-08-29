// Convierte raw.jsonl (crudo de ok.ru) en movies.json listo para la interfaz.
// Toda la clasificación vive en clasificar.mjs, que también se incrusta en el
// HTML: así lo que descarga el navegador se procesa con las mismas reglas.
import fs from 'node:fs';
import { crearClasificador } from './clasificar.mjs';

const C = crearClasificador();

/* Erratas que vienen mal desde ok.ru y que no hay parseo que las salve: se
   corrigen a mano por id. Los campos que empiezan por «_» son comentarios. */
const CORRECCIONES = fs.existsSync('correcciones.json')
  ? JSON.parse(fs.readFileSync('correcciones.json', 'utf8')) : {};
let corregidas = 0;
const corregir = (m) => {
  const arreglo = CORRECCIONES[m.id];
  if (!arreglo) return m;
  for (const [k, v] of Object.entries(arreglo)) if (!k.startsWith('_')) m[k] = v;
  corregidas++;
  return m;
};

const raw = fs.readFileSync('raw.jsonl', 'utf8').split('\n').filter(Boolean).map((l) => JSON.parse(l));
const vistos = new Set();
const movies = [];
let descartados = 0;
let sinFuente = 0;

// Al catálogo sólo entra lo que se puede ver: reproducción directa (videoId) o,
// como mínimo, una fuente alternativa (embed). Una ficha sin ninguna de las dos
// no sirve de nada aquí, así que ni se guarda: no cuenta en las cifras, no sale
// en los filtros y no aparece en el buscador.
const reproducible = (m) => !!(m && (m.videoId || m.embed));

for (const r of raw) {
  if (!r.id || vistos.has(r.id)) continue;
  vistos.add(r.id);
  const m = C.construirPelicula(r);
  if (!m) { descartados++; continue; }
  if (!reproducible(m)) { sinFuente++; continue; }
  movies.push(corregir(m));
}

movies.sort((a, b) => String(b.fecha || '').localeCompare(String(a.fecha || '')));

const meta = {
  grupo: 'Cinefilos',
  fuente: 'https://ok.ru/cinefiliamalversa',
  generado: new Date().toISOString(),
  total: movies.length,
  descartados,
  sinFuente,
};
fs.writeFileSync('movies.json', JSON.stringify({ meta, movies }));
console.log('películas:', movies.length, '| no eran fichas:', descartados,
  '| fuera por no tener dónde verlas:', sinFuente,
  '| corregidas a mano:', corregidas);
console.log('con año:', movies.filter((m) => m.anio).length,
  '| con país:', movies.filter((m) => m.paises.length).length,
  '| con género:', movies.filter((m) => m.generos.length).length,
  '| con imdb:', movies.filter((m) => m.imdb).length,
  '| reproducción directa:', movies.filter((m) => m.videoId).length,
  '| sólo fuente alternativa:', movies.filter((m) => !m.videoId && m.embed).length,
  '| con póster:', movies.filter((m) => m.poster).length);
