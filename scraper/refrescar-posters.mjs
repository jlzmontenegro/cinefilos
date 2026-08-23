// Los enlaces de imagen de ok.ru van firmados y caducan: pasado más o menos un
// año devuelven 410 y la ficha se queda sin póster. La imagen sigue estando ahí,
// lo único caducado es el enlace, así que basta con volver a leer la publicación
// para que ok.ru genere uno nuevo.
//
// Este script vuelve a pedir las publicaciones y actualiza el campo `image` en
// raw.jsonl. No toca ningún otro dato: la clasificación, la sinopsis y el vídeo
// se quedan como estaban.
//
// Por defecto renueva TODAS las imágenes, no sólo las que ya están caídas. Es a
// propósito: el plazo se cuenta desde que se leyó la publicación, no desde que
// se publicó, así que todo lo que trajo un mismo recorrido caduca casi a la vez.
// Arreglar sólo las caídas deja a las demás a punto de caer — comprobado: seis
// pósters que respondían 200 durante la comprobación daban 410 una hora después.
// Renovarlas todas las deja alineadas y con un año por delante.
//
//   node refrescar-posters.mjs                    renueva todas (recomendado)
//   SOLO_CAIDOS=1 node refrescar-posters.mjs      sólo las que ya fallan (rápido)
//   SOLO_COMPROBAR=1 node refrescar-posters.mjs   sólo informa, no escribe
import fs from 'node:fs';
import { execFileSync } from 'node:child_process';
import { fetchHead, parseTopic, sleep, GROUP } from './lib.mjs';

const OUT = 'raw.jsonl';
const SOLO_COMPROBAR = !!process.env.SOLO_COMPROBAR;
const SOLO_CAIDOS = !!process.env.SOLO_CAIDOS;
const CONCURRENCIA = 6;

if (!fs.existsSync(OUT)) {
  console.error('Falta raw.jsonl: ejecuta primero crawl.mjs');
  process.exit(1);
}

const UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36';

/* Reparte el trabajo entre varios hilos de peticiones sin desbordar a ok.ru. */
async function enTandas(items, n, fn) {
  const res = new Array(items.length);
  let i = 0;
  await Promise.all(Array.from({ length: n }, async () => {
    for (;;) {
      const k = i++;
      if (k >= items.length) return;
      res[k] = await fn(items[k], k);
    }
  }));
  return res;
}

/* Sólo interesa el código de respuesta: en cuanto llega se corta la descarga
   para no bajarse miles de imágenes enteras. */
async function imagenViva(url) {
  const ctrl = new AbortController();
  const reloj = setTimeout(() => ctrl.abort(), 20000);
  try {
    const r = await fetch(url, {
      headers: { 'User-Agent': UA, Accept: 'image/avif,image/webp,*/*' },
      signal: ctrl.signal,
    });
    try { await r.body?.cancel(); } catch {}
    return r.status === 200;
  } catch {
    return null;                     // ni viva ni muerta: fallo de red
  } finally {
    clearTimeout(reloj);
  }
}

const lineas = fs.readFileSync(OUT, 'utf8').split('\n').filter(Boolean);
const registros = lineas.map(l => JSON.parse(l));
const conImagen = registros.filter(r => r.image);
console.log(`${registros.length} publicaciones · ${conImagen.length} con imagen guardada`);

let porRenovar = conImagen;
if (SOLO_COMPROBAR || SOLO_CAIDOS) {
  console.log('\nComprobando cuáles siguen vivas…');
  let hechas = 0;
  const estados = await enTandas(conImagen, CONCURRENCIA, async (r) => {
    const viva = await imagenViva(r.image);
    if (++hechas % 250 === 0) process.stdout.write(`  ${hechas}/${conImagen.length}\n`);
    return viva;
  });
  const dudosas = conImagen.filter((_, i) => estados[i] === null).length;
  porRenovar = conImagen.filter((_, i) => estados[i] === false);
  console.log(`\nvivas: ${estados.filter(v => v === true).length}` +
    ` · caídas: ${porRenovar.length}` + (dudosas ? ` · sin respuesta: ${dudosas}` : ''));
  if (SOLO_COMPROBAR) { console.log('\n(SOLO_COMPROBAR: no se ha escrito nada)'); process.exit(0); }
}

if (!porRenovar.length) { console.log('\nNo hay nada que refrescar.'); process.exit(0); }

console.log(`\nVolviendo a leer ${porRenovar.length} publicaciones para conseguir enlaces nuevos…`);
const porId = new Map(registros.map(r => [r.id, r]));
let arregladas = 0, sinImagen = 0, perdidas = 0, n = 0;

await enTandas(porRenovar, CONCURRENCIA, async (r) => {
  try {
    const { html, status } = await fetchHead(`https://ok.ru/${GROUP}/topic/${r.id}`);
    if (status === 404) { perdidas++; return; }
    const nuevo = parseTopic(html);
    if (nuevo?.image && nuevo.image !== r.image) {
      porId.get(r.id).image = nuevo.image;
      arregladas++;
    } else {
      sinImagen++;
    }
  } catch {
    perdidas++;
  } finally {
    if (++n % 200 === 0) process.stdout.write(`  ${n}/${porRenovar.length} · ${arregladas} renovadas\n`);
    await sleep(90);
  }
});

console.log(`\nrenovadas: ${arregladas} · sin enlace nuevo: ${sinImagen} · no accesibles: ${perdidas}`);

if (arregladas) {
  // Se escribe a un temporal y se renombra: si algo falla a mitad, raw.jsonl
  // sigue intacto en lugar de quedarse a medias.
  const tmp = OUT + '.tmp';
  fs.writeFileSync(tmp, registros.map(r => JSON.stringify(r)).join('\n') + '\n');
  fs.renameSync(tmp, OUT);
  console.log(`\n✓ ${OUT} actualizado`);
  execFileSync(process.execPath, ['normalize.mjs'], { stdio: 'inherit' });
  execFileSync(process.execPath, ['build.mjs'], { stdio: 'inherit' });
}
