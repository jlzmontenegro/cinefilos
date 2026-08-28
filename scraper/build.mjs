// Inyecta movies.json dentro de la plantilla y produce el HTML autónomo.
import fs from 'node:fs';
import path from 'node:path';

// Por defecto escribe en la carpeta padre (los scripts viven en /scraper).
const DEST = process.env.DEST || path.resolve('..');
const tpl = fs.readFileSync('template.html', 'utf8');

/* ---------------------------------------------------------------------------
   Compactado. El HTML no lleva el movies.json tal cual: se guarda por columnas
   (sin repetir 6.000 veces el nombre de cada campo), con diccionario para los
   valores que se repiten mucho y sin los datos que se pueden recalcular al
   vuelo (url, d\u00e9cada, banderas, t\u00edtulo, y el thumb que nunca se usa porque
   todas las fichas tienen p\u00f3ster). La p\u00e1gina lo rehidrata al abrir y obtiene
   objetos id\u00e9nticos a los de antes, as\u00ed que ninguna funci\u00f3n cambia.
--------------------------------------------------------------------------- */
const CAMPOS = ['id', 'tituloOriginal', 'tituloAlt', 'anio', 'directores', 'paises', 'generos',
  'tipo', 'idioma', 'notas', 'sinopsis', 'imdb', 'filmaffinity', 'duracion', 'poster',
  'videoId', 'embed', 'fecha'];
const PREFIJO_POSTER = 'https://i.okcdn.ru/i?r=';

function compactar(db) {
  const dic = { paises: [], generos: [], tipo: [], idioma: [] };
  const idx = (k, v) => {
    let i = dic[k].indexOf(v);
    if (i < 0) { dic[k].push(v); i = dic[k].length - 1; }
    return i;
  };
  // Ojo: el centinela de "ausente" tiene que ser null, no 0. El índice 0 del
  // diccionario es un valor legítimo ("Película", "Subt. español") y usar 0 para
  // las dos cosas los convertía en nulos al rehidratar.
  const filas = db.movies.map((m) => CAMPOS.map((c) => {
    const v = m[c];
    if (v === null || v === undefined) return null;   // '' es un valor, no una ausencia
    if (c === 'paises' || c === 'generos') return v.map((x) => idx(c, x));
    if (c === 'tipo' || c === 'idioma') return idx(c, v);
    if (c === 'poster' && v.startsWith(PREFIJO_POSTER)) return v.slice(PREFIJO_POSTER.length);
    return v;
  }));
  return { meta: db.meta, campos: CAMPOS, px: PREFIJO_POSTER, dic, filas };
}

const original = fs.readFileSync('movies.json', 'utf8');
const data = JSON.stringify(compactar(JSON.parse(original)))
  .replace(/<\//g, '<\\/')          // evita cerrar el <script> antes de tiempo
  .replace(/\u2028/g, '\\u2028').replace(/\u2029/g, '\\u2029');

// El clasificador se incrusta tal cual (sin los `export`) para que el navegador
// procese las novedades que descarga con las mismas reglas que normalize.mjs.
// Ojo: el código contiene la cadena '</script>', que cerraría la etiqueta antes de
// tiempo. Escaparla como '<\/script>' es equivalente dentro de un literal de JS.
const clasificador = fs.readFileSync('clasificar.mjs', 'utf8')
  .replace(/^export\s+/gm, '')
  .replace(/<\/script/gi, '<\\/script');

const rellenar = (plantilla) => plantilla
  .replace('__CLASIFICADOR__', () => clasificador)
  .replace('__DATA__', () => data);

fs.mkdirSync(DEST, { recursive: true });
const { meta } = JSON.parse(fs.readFileSync('movies.json', 'utf8'));

const escribir = (plantilla, nombre) => {
  const html = rellenar(plantilla);
  const out = path.join(DEST, nombre);
  fs.writeFileSync(out, html, 'utf8');
  console.log(`✓ ${out}`);
  console.log(`  ${meta.total.toLocaleString('es')} títulos · ${(html.length / 1048576).toFixed(2)} MB`);
};

const html = rellenar(tpl);
escribir(tpl, 'Cinefilos.html');

// Interfaz en pruebas, si existe: se publica al lado de la buena para poder
// compararlas sin tocar la que funciona.
if (fs.existsSync('template-nuevo.html')) {
  escribir(fs.readFileSync('template-nuevo.html', 'utf8'), 'nuevo.html');
}
