// El catálogo promete «reproducción directa» y a veces el vídeo ya no está: el
// grupo lo retiró o lo puso en privado. El reproductor carga igual, pero se queda
// en negro para siempre. Medido sobre 70 títulos repartidos por todo el catálogo:
// 6 sin stream, un 8,6 % — del orden de 480 fichas que no llevan a ninguna parte.
//
// Este script comprueba cuáles siguen dando vídeo y marca las que no con
// `videoMuerto`. No borra nada de `raw.jsonl`: marcar es reversible, y si ok.ru
// repone el vídeo la siguiente pasada le quita la marca sola. Quien decide qué
// hacer con la marca es `normalize.mjs`, que aplica la regla del catálogo:
//
//   - si además tiene fuente alternativa (`embed`), se queda con esa vía
//   - si no tiene nada, sale del catálogo
//
//   node comprobar-videos.mjs                  comprueba todos
//   SOLO_COMPROBAR=1 node comprobar-videos.mjs  informa, no escribe
//   DIAS=30 node comprobar-videos.mjs           sólo los no mirados en 30 días
//   LIMITE=200 node comprobar-videos.mjs        corta a los 200 primeros (pruebas)
import fs from 'node:fs';
import { execFileSync } from 'node:child_process';
import { sleep } from './lib.mjs';
import { crearClasificador } from './clasificar.mjs';

const CLAS = crearClasificador();

const OUT = 'raw.jsonl';
const SOLO_COMPROBAR = !!process.env.SOLO_COMPROBAR;
const DIAS = Number(process.env.DIAS || 0);
const LIMITE = Number(process.env.LIMITE || 0);
/* Despacio y de dos en dos. Con seis en paralelo y 80 ms de pausa, ok.ru empezó a
   devolver la página del reproductor sin datos a partir del registro 600, y el
   repaso dio por muertas más de 2.000 películas que estaban perfectamente vivas. */
const CONCURRENCIA = 2;
const PAUSA = 700;

/* Tope de cordura. Las muestras honestas dieron entre un 8 y un 13 % de vídeos
   retirados; si sale mucho más, no es que el grupo haya borrado medio catálogo,
   es que nos están limitando. En ese caso no se escribe NADA: más vale no hacer
   nada que sacar cientos de películas buenas. */
const TOPE_CORDURA = 25;

const UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/140.0.0.0 Safari/537.36';

if (!fs.existsSync(OUT)) {
  console.error('Falta raw.jsonl: ejecuta primero crawl.mjs');
  process.exit(1);
}

/* Reparte el trabajo sin desbordar a ok.ru, igual que refrescar-posters.mjs. */
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

/* Tres respuestas posibles, y la tercera importa tanto como las otras:
     true  → el reproductor trae manifiesto, hay vídeo
     false → la página cargó bien y NO trae manifiesto: el vídeo ya no está
     null  → no se pudo saber (fallo de red, timeout). Ni vivo ni muerto.
   Lo de `null` no es quisquillosería: marcar un vídeo como muerto por un fallo de
   red lo sacaría del catálogo sin motivo, y es justo el error que ya se cometió
   una vez sellando `imageAt` a ciegas. Ante la duda, no se toca. */
async function tieneVideo(id) {
  const ctrl = new AbortController();
  const reloj = setTimeout(() => ctrl.abort(), 25000);
  try {
    // La página entera, no las primeras páginas: el manifiesto vive pasados los
    // 35 KB y `fetchHead` corta mucho antes.
    const r = await fetch(`https://ok.ru/videoembed/${encodeURIComponent(id)}`, {
      headers: { 'User-Agent': UA, 'Accept-Language': 'es-ES,es;q=0.9' },
      signal: ctrl.signal,
    });
    if (r.status === 404) return false;          // ya no existe
    if (!r.ok) return null;                      // 5xx, límite de peticiones…
    const html = await r.text();
    return html.includes('hlsManifestUrl') || html.includes('dashManifestUrl');
  } catch {
    return null;
  } finally {
    clearTimeout(reloj);
  }
}

/* Nunca se marca un vídeo como muerto a la primera. Comprobando una muestra de 70
   títulos, «Criminal» salió sin manifiesto y al repetirla estaba perfectamente
   viva: ok.ru falla de vez en cuando y devuelve la página del reproductor sin los
   datos. Como marcar de más saca una película del catálogo, el «no» hay que
   confirmarlo; el «sí» no, porque equivocarse ahí no rompe nada. */
async function confirmarMuerto(id) {
  const primera = await tieneVideo(id);
  if (primera !== false) return primera;
  await sleep(1500);
  return tieneVideo(id);
}

const lineas = fs.readFileSync(OUT, 'utf8').split('\n').filter(Boolean);
const registros = lineas.map((l) => JSON.parse(l));
let conVideo = registros.filter((r) => r.videoId);

if (DIAS > 0) {
  const limite = Date.now() - DIAS * 864e5;
  conVideo = conVideo.filter((r) => {
    const t = Date.parse(r.videoChk || '');
    return !Number.isFinite(t) || t < limite;
  });
}
if (LIMITE > 0) conVideo = conVideo.slice(0, LIMITE);

console.log(`${registros.length} publicaciones · ${conVideo.length} con vídeo por comprobar`);
if (!conVideo.length) { console.log('Nada que comprobar.'); process.exit(0); }

let vivos = 0, muertos = 0, dudosos = 0, resucitados = 0, n = 0;
const ahora = new Date().toISOString();
const caidos = [];   // para el informe en seco

await enTandas(conVideo, CONCURRENCIA, async (r) => {
  const hay = await confirmarMuerto(r.videoId);
  if (hay === false) caidos.push(r);
  if (hay === null) { dudosos++; }
  else if (hay) {
    vivos++;
    // Si estaba marcado y ha vuelto, se le quita la marca
    if (r.videoMuerto) { delete r.videoMuerto; resucitados++; }
    r.videoChk = ahora;
  } else {
    muertos++;
    r.videoMuerto = true;
    r.videoChk = ahora;
  }
  if (++n % 200 === 0) process.stdout.write(`  ${n}/${conVideo.length} · ${muertos} sin vídeo\n`);
  await sleep(PAUSA);
});

const pct = conVideo.length ? ((muertos / (vivos + muertos || 1)) * 100).toFixed(1) : '0';
console.log(`\ncon vídeo: ${vivos} · sin vídeo: ${muertos} (${pct}%)` +
  (resucitados ? ` · recuperados: ${resucitados}` : '') +
  (dudosos ? ` · sin respuesta (no se tocan): ${dudosos}` : ''));

/* Si la proporción es disparatada, lo que falla es la medición, no el catálogo.
   Pasó de verdad: una pasada completa dio más de 2.000 películas por muertas y al
   comprobarlas despacio estaban todas vivas. Antes que escribir eso, no se escribe. */
if (!SOLO_COMPROBAR && Number(pct) > TOPE_CORDURA) {
  console.error(`\n✗ ABORTADO: ${pct}% sin vídeo supera el tope de cordura (${TOPE_CORDURA}%).`);
  console.error('  Eso no es el grupo borrando películas, es ok.ru limitando peticiones.');
  console.error('  No se ha escrito nada. Repítelo más despacio o en varias tandas con DIAS.');
  process.exit(1);
}

if (SOLO_COMPROBAR) {
  /* Lo que de verdad hay que decidir no es el porcentaje, sino cuántas fichas
     desaparecerían. Las que tienen fuente alternativa se quedan; las que no, salen.
     Se deja la lista por escrito para poder revisarla antes de tocar nada. */
  // Quien sabe si hay fuente alternativa es el clasificador, el mismo que usa
  // normalize.mjs. Preguntárselo evita inventarse aquí una regla paralela.
  const tieneAlternativa = (r) => {
    try { return !!CLAS.construirPelicula(r)?.embed; } catch { return false; }
  };
  const seQuedan = caidos.filter(tieneAlternativa);
  const seVan = caidos.filter((r) => !tieneAlternativa(r));
  console.log(`\nSi se aplicara:`);
  console.log(`  se quedan con fuente alternativa: ${seQuedan.length}`);
  console.log(`  SALEN del catálogo:               ${seVan.length}`);
  const informe = [
    `Vídeos retirados en ok.ru — ${ahora}`,
    `comprobados: ${conVideo.length} · sin vídeo: ${muertos} · sin respuesta: ${dudosos}`,
    `se quedan con fuente alternativa: ${seQuedan.length}`,
    `salen del catálogo: ${seVan.length}`,
    '',
    '--- SALEN DEL CATÁLOGO ---',
    ...seVan.map((r) => `${r.id}\t${(r.headline || '').slice(0, 90)}`),
    '',
    '--- SE QUEDAN CON FUENTE ALTERNATIVA ---',
    ...seQuedan.map((r) => `${r.id}\t${(r.headline || '').slice(0, 90)}`),
  ].join('\n');
  fs.writeFileSync('videos-retirados.txt', informe);
  console.log(`\n✓ informe en scraper/videos-retirados.txt`);
  console.log('(SOLO_COMPROBAR: no se ha escrito nada en raw.jsonl)');
  process.exit(0);
}

if (muertos || resucitados) {
  // Temporal y renombrado: un corte a mitad no deja raw.jsonl a medias.
  const tmp = OUT + '.tmp';
  fs.writeFileSync(tmp, registros.map((r) => JSON.stringify(r)).join('\n') + '\n');
  fs.renameSync(tmp, OUT);
  console.log(`\n✓ ${OUT} actualizado`);
  execFileSync(process.execPath, ['normalize.mjs'], { stdio: 'inherit' });
  execFileSync(process.execPath, ['build.mjs'], { stdio: 'inherit' });
} else {
  console.log('\nNingún cambio: no se reconstruye.');
}
