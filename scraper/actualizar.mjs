// Actualización incremental: sube por la cadena rel="prev" desde el post más
// reciente que ya tenemos y recoge sólo lo publicado después. Luego reconstruye
// el HTML. Pensado para ejecutarse cada vez que el grupo publique novedades.
import fs from 'node:fs';
import { execFileSync } from 'node:child_process';
import { fetchHead, parseTopic, sleep, GROUP } from './lib.mjs';

const OUT = 'raw.jsonl';
if (!fs.existsSync(OUT)) { console.error('Falta raw.jsonl: ejecuta primero crawl.mjs'); process.exit(1); }

const lineas = fs.readFileSync(OUT, 'utf8').split('\n').filter(Boolean);
const registros = lineas.map((l) => JSON.parse(l));
const conocidos = new Set(registros.map((r) => r.id));

// el más reciente que ya tenemos
const ancla = registros.reduce((a, b) =>
  String(b.published || '') > String(a.published || '') ? b : a);
console.log(`Catálogo actual: ${conocidos.size} posts. Más reciente: ${ancla.published}`);

// subimos por prev (= más nuevo) recogiendo lo que falte
const nuevos = [];
const visitados = new Set();
const desde = String(ancla.published || '');
let cursor = ancla.prevId;
let saltos = 0;

while (cursor && saltos < 3000) {
  saltos++;
  if (visitados.has(cursor)) break;      // la cadena se ha cerrado sobre sí misma
  visitados.add(cursor);
  let rec;
  try {
    const { html } = await fetchHead(`https://ok.ru/${GROUP}/topic/${cursor}`);
    rec = parseTopic(html);
  } catch (e) {
    console.log('  error en', cursor, e.message);
    break;
  }
  if (!rec || !rec.id) break;

  // ok.ru pone los mensajes fijados al principio de la cadena, así que subir por
  // prev puede desembocar en un post antiguo. Si la publicación no es posterior
  // al ancla, ya estamos en terreno conocido y no hay nada más que recoger.
  if (rec.published && String(rec.published) <= desde) break;

  if (!conocidos.has(rec.id)) {
    conocidos.add(rec.id);
    nuevos.push(rec);
    process.stdout.write(`  + ${(rec.body || '').split('\n')[0].slice(0, 70)}\n`);
  }
  if (!rec.prevId || rec.prevId === rec.id) break;
  cursor = rec.prevId;
  await sleep(90);
}

if (nuevos.length) {
  fs.appendFileSync(OUT, nuevos.map((r) => JSON.stringify(r)).join('\n') + '\n');
}
console.log(`\n${nuevos.length} publicación(es) nueva(s).`);

// reconstruir siempre: así la fecha de "actualizado" del HTML queda al día
execFileSync(process.execPath, ['normalize.mjs'], { stdio: 'inherit' });
execFileSync(process.execPath, ['build.mjs'], { stdio: 'inherit' });

if (nuevos.length) {
  console.log('\nLos títulos nuevos aparecerán marcados como NUEVO al abrir el catálogo.');
}
