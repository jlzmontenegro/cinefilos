// Comprueba que el HTML compactado rehidrata exactamente los mismos datos que
// movies.json, campo por campo y registro por registro.
import fs from 'node:fs';
import { crearClasificador } from './clasificar.mjs';

// Mismo destino que build.mjs: por defecto la carpeta padre, pero en el flujo de
// GitHub Actions el generado va a DEST, porque en la raíz del repositorio
// Cinefilos.html es la página de redirección, no el catálogo.
const DIR = process.env.DEST || '..';
const C = crearClasificador();
const orig = JSON.parse(fs.readFileSync('movies.json', 'utf8')).movies;

const html = fs.readFileSync(DIR + '/Cinefilos.html', 'utf8');
const marca = 'id="data" type="application/json">';
const a = html.indexOf(marca) + marca.length;
const b = html.indexOf('</script>', a);
const texto = html.slice(a, b).split('<\\/').join('</');
const { campos, dic, px, filas } = JSON.parse(texto);

// misma rehidratación que hace la página
const reh = filas.map((f) => {
  const m = {};
  campos.forEach((c, i) => {
    let v = f[i];
    if (v !== null) {
      if (c === 'paises' || c === 'generos') v = v.map((x) => dic[c][x]);
      else if (c === 'tipo' || c === 'idioma') v = dic[c][v];
      else if (c === 'poster' && !/^https?:/.test(v)) v = px + v;
    }
    m[c] = v;
  });
  m.titulo = m.tituloAlt || m.tituloOriginal;
  m.url = `https://ok.ru/cinefiliamalversa/topic/${m.id}`;
  m.decada = m.anio ? Math.floor(m.anio / 10) * 10 : null;
  m.paises = m.paises || [];
  m.generos = m.generos || [];
  m.directores = m.directores || [];
  m.banderas = m.paises.map((p) => C.FLAG[p] || '🏳️');
  return m;
});

console.log('registros: original', orig.length, '| rehidratado', reh.length);

const CLAVES = ['id', 'titulo', 'tituloOriginal', 'tituloAlt', 'anio', 'decada', 'directores',
  'paises', 'generos', 'banderas', 'tipo', 'idioma', 'notas', 'sinopsis', 'imdb',
  'filmaffinity', 'duracion', 'poster', 'videoId', 'embed', 'fecha', 'url'];

let dif = 0;
const ejemplos = [];
for (let i = 0; i < orig.length; i++) {
  for (const c of CLAVES) {
    const A = JSON.stringify(orig[i][c] ?? null);
    const B = JSON.stringify(reh[i][c] ?? null);
    if (A !== B) {
      dif++;
      if (ejemplos.length < 6) ejemplos.push({ i, campo: c, orig: A.slice(0, 70), reh: B.slice(0, 70) });
    }
  }
}
console.log(`comparados ${CLAVES.length} campos x ${orig.length} registros = ${(CLAVES.length * orig.length).toLocaleString('es')} valores`);
console.log('diferencias:', dif);
if (ejemplos.length) console.log(JSON.stringify(ejemplos, null, 1));
else console.log('rehidratación idéntica al original');
