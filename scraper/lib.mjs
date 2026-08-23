// Utilidades compartidas para el crawler de ok.ru/cinefiliamalversa
import { crearClasificador } from './clasificar.mjs';
const CLAS = crearClasificador();
const UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36';
export const GROUP = 'cinefiliamalversa';

const HEAD_LIMIT = 400 * 1024; // tope de seguridad si no aparece el ld+json

// Descarga sólo la cabecera del documento: corta en cuanto tiene el JSON-LD completo.
export async function fetchHead(url, { retries = 3 } = {}) {
  let lastErr;
  for (let attempt = 0; attempt <= retries; attempt++) {
    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), 25000);
    try {
      const res = await fetch(url, {
        headers: { 'User-Agent': UA, 'Accept-Language': 'es-ES,es;q=0.9', 'Accept': 'text/html' },
        signal: ctrl.signal,
      });
      if (res.status === 404) { clearTimeout(timer); return { status: 404, html: '' }; }
      if (!res.ok) throw new Error('HTTP ' + res.status);
      const reader = res.body.getReader();
      const dec = new TextDecoder();
      let buf = '';
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        buf += dec.decode(value, { stream: true });
        const a = buf.indexOf('application/ld+json');
        if (a > 0 && buf.indexOf('</script>', a) > 0) { try { ctrl.abort(); } catch {} break; }
        if (buf.length > HEAD_LIMIT) { try { ctrl.abort(); } catch {} break; }
      }
      clearTimeout(timer);
      return { status: res.status, html: buf };
    } catch (e) {
      clearTimeout(timer);
      lastErr = e;
      // abort() propio tras conseguir el dato no es un fallo real
      if (String(e.name) === 'AbortError' && attempt === 0) { /* reintenta */ }
      await sleep(600 * (attempt + 1));
    }
  }
  throw lastErr || new Error('fetch failed ' + url);
}

export const sleep = (ms) => new Promise((r) => setTimeout(r, ms));


export function decodeEntities(s) {
  if (!s) return s;
  return s
    .replace(/&quot;/g, '"').replace(/&#39;/g, "'").replace(/&apos;/g, "'")
    .replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&nbsp;/g, ' ')
    .replace(/&#(\d+);/g, (_, d) => String.fromCodePoint(+d))
    .replace(/&amp;/g, '&');
}

// El parseo real vive en clasificar.mjs, compartido con el HTML.
export const parseTopic = (html) => CLAS.parseTopicHTML(html);
