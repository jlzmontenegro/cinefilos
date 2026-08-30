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
//   node refrescar-posters.mjs                    renueva todas (el martillo)
//   MANTENIMIENTO=1 node refrescar-posters.mjs    las caídas + las que van a caer
//   SOLO_CAIDOS=1 node refrescar-posters.mjs      sólo las que ya fallan
//   SOLO_COMPROBAR=1 node refrescar-posters.mjs   sólo informa, no escribe
//
// MANTENIMIENTO es el modo para ejecutar a menudo: como cada renovación deja
// anotado en `imageAt` cuándo se pidió el enlace, se puede renovar por adelantado
// lo que esté cerca del año (DIAS, 330 por defecto) en vez de esperar a que se
// rompa. Así nunca se ve una portada en blanco y se tocan unos cientos de
// registros en vez de los seis mil.
import fs from 'node:fs';
import { execFileSync } from 'node:child_process';
import { fetchHead, parseTopic, sleep, GROUP } from './lib.mjs';

const OUT = 'raw.jsonl';
const SOLO_COMPROBAR = !!process.env.SOLO_COMPROBAR;
const SOLO_CAIDOS = !!process.env.SOLO_CAIDOS;
const MANTENIMIENTO = !!process.env.MANTENIMIENTO;
const DIAS = Number(process.env.DIAS || 330);
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

/* Último recurso. `fetchHead` corta la página en cuanto encuentra el ld+json —unos
   16 KB de 240— y a veces el enlace que hay ahí está caducado mientras la carátula
   sigue viva más abajo, en el cuerpo del post. Cuando el camino normal no da nada,
   se baja la página entera y se busca el cartel entre todas las imágenes: se
   reconoce porque es vertical y pesa (los avatares son cuadraditos de 1-4 KB). */
function tamJpeg(buf) {
  if (buf[0] !== 0xFF || buf[1] !== 0xD8) return null;
  let i = 2;
  while (i < buf.length - 9) {
    if (buf[i] !== 0xFF) { i++; continue; }
    const mk = buf[i + 1];
    if (mk >= 0xC0 && mk <= 0xCF && mk !== 0xC4 && mk !== 0xC8 && mk !== 0xCC)
      return { w: buf.readUInt16BE(i + 7), h: buf.readUInt16BE(i + 5) };
    i += 2 + buf.readUInt16BE(i + 2);
  }
  return null;
}

async function rescatarPortada(id) {
  try {
    const r = await fetch(`https://ok.ru/${GROUP}/topic/${id}`,
      { headers: { 'User-Agent': UA, 'Accept-Language': 'es-ES,es;q=0.9', Accept: 'text/html' } });
    if (!r.ok) return null;
    const html = (await r.text()).replace(/\\u0026/g, '&').replace(/\\\//g, '/').replace(/&amp;/g, '&');
    const urls = [...new Set([...html.matchAll(/https:\/\/i\.okcdn\.ru\/i\?r=[^"'\s\\<>)]+/g)].map(x => x[0]))];
    for (const u of urls) {
      const res = await fetch(u, { headers: { 'User-Agent': UA, Accept: 'image/*,*/*' } });
      if (res.status !== 200) continue;
      const buf = Buffer.from(await res.arrayBuffer());
      const t = tamJpeg(buf);
      if (t && t.h > t.w && buf.length > 10000) return u;
    }
  } catch {}
  return null;
}

const lineas = fs.readFileSync(OUT, 'utf8').split('\n').filter(Boolean);
const registros = lineas.map(l => JSON.parse(l));
const conImagen = registros.filter(r => r.image);
console.log(`${registros.length} publicaciones · ${conImagen.length} con imagen guardada`);

let porRenovar = conImagen;
if (SOLO_COMPROBAR || SOLO_CAIDOS || MANTENIMIENTO) {
  console.log('\nComprobando cuáles siguen vivas…');
  let hechas = 0;
  const estados = await enTandas(conImagen, CONCURRENCIA, async (r) => {
    const viva = await imagenViva(r.image);
    if (++hechas % 250 === 0) process.stdout.write(`  ${hechas}/${conImagen.length}\n`);
    return viva;
  });
  const dudosas = conImagen.filter((_, i) => estados[i] === null).length;
  const caidas = conImagen.filter((_, i) => estados[i] === false);
  console.log(`\nvivas: ${estados.filter(v => v === true).length}` +
    ` · caídas: ${caidas.length}` + (dudosas ? ` · sin respuesta: ${dudosas}` : ''));
  if (SOLO_COMPROBAR) { console.log('\n(SOLO_COMPROBAR: no se ha escrito nada)'); process.exit(0); }

  if (MANTENIMIENTO) {
    // Adelantarse: lo que se pidió hace casi un año está a punto de dar 410.
    const limite = Date.now() - DIAS * 864e5;
    const juntas = new Set(caidas);
    let porEdad = 0;
    for (const r of conImagen) {
      const t = Date.parse(r.imageAt || '');
      if (Number.isFinite(t) && t < limite && !juntas.has(r)) { juntas.add(r); porEdad++; }
    }
    porRenovar = [...juntas];
    console.log(`a punto de caducar (más de ${DIAS} días): ${porEdad}` +
      ` · total a renovar: ${porRenovar.length}`);
  } else {
    porRenovar = caidas;
  }
}

if (!porRenovar.length) { console.log('\nNo hay nada que refrescar.'); process.exit(0); }

console.log(`\nVolviendo a leer ${porRenovar.length} publicaciones para conseguir enlaces nuevos…`);
const porId = new Map(registros.map(r => [r.id, r]));
let arregladas = 0, sinImagen = 0, perdidas = 0, rescatadas = 0, n = 0;

await enTandas(porRenovar, CONCURRENCIA, async (r) => {
  try {
    const { html, status } = await fetchHead(`https://ok.ru/${GROUP}/topic/${r.id}`);
    if (status === 404) { perdidas++; return; }
    const nuevo = parseTopic(html);
    let url = (nuevo?.image && nuevo.image !== r.image) ? nuevo.image : null;
    // Si por ahí no sale nada, se busca en la página entera antes de rendirse
    if (!url) { url = await rescatarPortada(r.id); rescatadas += url ? 1 : 0; }
    if (url && url !== r.image) {
      const reg = porId.get(r.id);
      reg.image = url;
      // Cuándo se pidió este enlace: es lo que permite renovar por adelantado
      // en lugar de esperar a que se rompa.
      reg.imageAt = new Date().toISOString();
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

console.log(`\nrenovadas: ${arregladas} (${rescatadas} rescatadas de la página entera)` +
  ` · sin enlace nuevo: ${sinImagen} · no accesibles: ${perdidas}`);

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
