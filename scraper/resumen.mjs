// Arma el resumen de lo que ha entrado en el catálogo en los últimos días y deja
// dos archivos listos para enviar:
//
//   correo.eml   mensaje completo con cabeceras, para mandarlo con curl por SMTP
//   resumen.md   el mismo contenido en Markdown, para abrir una incidencia en
//                GitHub (que también llega por correo) cuando no hay credenciales
//
// Variables: DIAS (7), DESTINO, REMITENTE, SITIO.
import fs from 'node:fs';

const DIAS = Number(process.env.DIAS || 7);
const DESTINO = process.env.DESTINO || '';
const REMITENTE = process.env.REMITENTE || DESTINO;
const SITIO = process.env.SITIO || 'https://jlzmontenegro.github.io/cinefilos';

const { movies } = JSON.parse(fs.readFileSync('movies.json', 'utf8'));
const corte = Date.now() - DIAS * 864e5;
const nuevas = movies
  .filter((m) => m.fecha && Date.parse(m.fecha) > corte)
  .sort((a, b) => String(b.fecha).localeCompare(String(a.fecha)));

const esc = (s) => String(s ?? '').replace(/[&<>"]/g, (c) =>
  ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
const ficha = (m) => {
  const trozos = [m.anio, (m.directores || [])[0], m.imdb ? `★ ${m.imdb.toFixed(1)}` : null]
    .filter(Boolean).join(' · ');
  // Al catálogo, no a ok.ru: el enlace directo abre la ficha con su sinopsis,
  // su reproductor y el resto de datos. m.url queda para «ver post».
  return { titulo: m.titulo || m.tituloOriginal, sub: trozos, url: `${SITIO}/#p${m.id}` };
};

const lista = nuevas.map(ficha);
const asunto = nuevas.length
  ? `Cinefilos · ${nuevas.length} título${nuevas.length === 1 ? '' : 's'} nuevo${nuevas.length === 1 ? '' : 's'} esta semana`
  : 'Cinefilos · esta semana no ha entrado nada';

/* ---------- Markdown (incidencia de GitHub) ---------- */
const md = [
  `**${nuevas.length}** título${nuevas.length === 1 ? '' : 's'} nuevo${nuevas.length === 1 ? '' : 's'} en los últimos ${DIAS} días.`,
  `El catálogo tiene ahora **${movies.length.toLocaleString('es')}** títulos.`,
  '',
  ...lista.map((f) => `- [${f.titulo}](${f.url})${f.sub ? ` — ${f.sub}` : ''}`),
  '',
  `[Ver el catálogo](${SITIO})`,
].join('\n');
fs.writeFileSync('resumen.md', md);

/* ---------- Correo ---------- */
const filas = lista.map((f) => `
  <tr><td style="padding:10px 0;border-bottom:1px solid #e6e6ea">
    <a href="${esc(f.url)}" style="color:#111;text-decoration:none;font-weight:600">${esc(f.titulo)}</a>
    ${f.sub ? `<div style="color:#767680;font-size:13px;margin-top:2px">${esc(f.sub)}</div>` : ''}
  </td></tr>`).join('');

const cuerpo = `<!doctype html><html><body style="margin:0;background:#f4f4f7;
  font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Helvetica,Arial,sans-serif">
  <table width="100%" cellpadding="0" cellspacing="0"><tr><td align="center" style="padding:28px 14px">
    <table width="100%" style="max-width:560px;background:#fff;border-radius:14px;
      box-shadow:0 1px 3px rgba(0,0,0,.08)" cellpadding="0" cellspacing="0">
      <tr><td style="background:#ffc400;padding:18px 24px;border-radius:14px 14px 0 0">
        <div style="font-weight:800;font-size:18px;color:#0a0a0a;letter-spacing:-.02em">Cinefilos</div>
        <div style="font-size:12.5px;color:#0a0a0a;opacity:.7">Resumen de la semana</div>
      </td></tr>
      <tr><td style="padding:24px">
        <p style="margin:0 0 4px;font-size:15px;color:#111">
          ${nuevas.length
            ? `Han entrado <b>${nuevas.length}</b> título${nuevas.length === 1 ? '' : 's'} nuevo${nuevas.length === 1 ? '' : 's'}.`
            : 'Esta semana no ha entrado ningún título nuevo.'}
        </p>
        <p style="margin:0 0 18px;font-size:13px;color:#767680">
          El catálogo tiene ahora ${movies.length.toLocaleString('es')} títulos.
        </p>
        <table width="100%" cellpadding="0" cellspacing="0">${filas}</table>
        <p style="margin:24px 0 0">
          <a href="${esc(SITIO)}" style="display:inline-block;background:#ffc400;color:#0a0a0a;
             text-decoration:none;font-weight:650;font-size:14px;padding:11px 20px;border-radius:999px">
            Ver el catálogo</a>
        </p>
      </td></tr>
    </table>
    <div style="color:#9b9ba3;font-size:11.5px;margin-top:14px">Enviado solo, cada viernes.</div>
  </td></tr></table>
</body></html>`;

// El asunto lleva acentos, así que va codificado en base64 según RFC 2047.
const asuntoMime = '=?UTF-8?B?' + Buffer.from(asunto, 'utf8').toString('base64') + '?=';
const eml = [
  `From: Cinefilos <${REMITENTE}>`,
  `To: ${DESTINO}`,
  `Subject: ${asuntoMime}`,
  'MIME-Version: 1.0',
  'Content-Type: text/html; charset=UTF-8',
  'Content-Transfer-Encoding: base64',
  '',
  Buffer.from(cuerpo, 'utf8').toString('base64').replace(/(.{76})/g, '$1\n'),
].join('\r\n');
fs.writeFileSync('correo.eml', eml);

console.log(`nuevas en ${DIAS} días: ${nuevas.length} · catálogo: ${movies.length}`);
console.log(`asunto: ${asunto}`);
if (process.env.GITHUB_OUTPUT) {
  fs.appendFileSync(process.env.GITHUB_OUTPUT, `nuevas=${nuevas.length}\nasunto=${asunto}\n`);
}
