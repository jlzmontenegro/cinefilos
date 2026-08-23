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
const LLAVE = '@cinefilos';   // llave de Bre-B

// Sólo salen las mejor valoradas: en una semana entran decenas y lo que interesa
// de un vistazo es lo bueno. Además, Gmail recorta los mensajes que pasan de
// 102 KB, y con carátulas se llega antes de lo que parece.
const TOPE = 10;

const { movies } = JSON.parse(fs.readFileSync('movies.json', 'utf8'));
const corte = Date.now() - DIAS * 864e5;
const nuevas = movies
  .filter((m) => m.fecha && Date.parse(m.fecha) > corte)
  .sort((a, b) => String(b.fecha).localeCompare(String(a.fecha)));

// Las que no tienen nota van al final: «sin nota» no es lo mismo que «mala».
const mostradas = [...nuevas].sort((a, b) => (b.imdb || -1) - (a.imdb || -1)).slice(0, TOPE);
const restantes = nuevas.length - mostradas.length;

const esc = (s) => String(s ?? '').replace(/[&<>"]/g, (c) =>
  ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));

// Corta por palabra entera, que no quede a media sílaba
const recortar = (s, n) => {
  const t = String(s || '').trim();
  if (t.length <= n) return t;
  const trozo = t.slice(0, n);
  return trozo.slice(0, trozo.lastIndexOf(' ')) + '…';
};

const fechaLarga = (d) => d.toLocaleDateString('es', { day: 'numeric', month: 'long' });
const desde = fechaLarga(new Date(corte));
const hasta = fechaLarga(new Date());

const asunto = nuevas.length
  ? `Cinefilos · ${nuevas.length} título${nuevas.length === 1 ? '' : 's'} nuevo${nuevas.length === 1 ? '' : 's'} esta semana`
  : 'Cinefilos · esta semana no ha entrado nada';

const enlace = (m) => `${SITIO}/#p${m.id}`;
// Red de seguridad: alguna cabecera de ok.ru viene sin el formato esperado y deja
// un título larguísimo. En el correo se recorta para que la maqueta no se rompa.
const titulo = (m) => recortar(m.titulo || m.tituloOriginal || '', 80);

/* ---------- Markdown (incidencia de GitHub) ---------- */
const md = [
  nuevas.length
    ? `**${nuevas.length}** título${nuevas.length === 1 ? '' : 's'} nuevo${nuevas.length === 1 ? '' : 's'} entre el ${desde} y el ${hasta}.`
    : `Esta semana no ha entrado ningún título nuevo.`,
  `El catálogo tiene ahora **${movies.length.toLocaleString('es')}** títulos.`,
  '',
  ...mostradas.map((m) => {
    const meta = [m.anio, (m.directores || [])[0], m.imdb ? `★ ${m.imdb.toFixed(1)}` : null]
      .filter(Boolean).join(' · ');
    return `- [${titulo(m)}](${enlace(m)})${meta ? ` — ${meta}` : ''}`;
  }),
  restantes > 0 ? `\ny ${restantes} título${restantes === 1 ? '' : 's'} más.` : '',
  '',
  `[Ver el catálogo](${SITIO}) · ¿Un café? Llave Bre-B \`${LLAVE}\``,
].join('\n');
fs.writeFileSync('resumen.md', md);

/* ---------- Correo ----------
   Maquetado con tablas y estilos en línea: es lo único que respetan todos los
   clientes de correo. Nada de flexbox, grid ni hojas de estilo aparte. */
const filaPeli = (m) => {
  const meta = [m.anio, (m.directores || [])[0]].filter(Boolean).join(' · ');
  const url = enlace(m);
  const nota = m.imdb
    ? `<span style="display:inline-block;background:#fff5cc;color:#7a5c00;font-size:11px;
         font-weight:700;padding:2px 7px;border-radius:20px;white-space:nowrap">★ ${m.imdb.toFixed(1)}</span>`
    : '';
  return `
  <tr><td style="padding:0 0 6px">
    <table width="100%" cellpadding="0" cellspacing="0" role="presentation"
           style="background:#ffffff;border:1px solid #ececf1;border-radius:12px">
      <tr>
        <td width="76" valign="top" style="padding:12px 0 12px 12px">
          <a href="${esc(url)}" style="text-decoration:none">
            <img src="${esc(m.poster || '')}" width="64" height="96" alt=""
                 style="display:block;width:64px;height:96px;border-radius:8px;
                        background:#e9e9ef;border:0;outline:none;text-decoration:none">
          </a>
        </td>
        <td valign="top" style="padding:12px 14px 12px 10px">
          <a href="${esc(url)}" style="color:#15161a;text-decoration:none;font-weight:700;
             font-size:15px;line-height:1.25">${esc(titulo(m))}</a>
          <div style="margin:4px 0 0">
            <span style="color:#75757f;font-size:12.5px">${esc(meta)}</span>
            ${nota ? ' &nbsp;' + nota : ''}
          </div>
          ${m.sinopsis ? `<div style="color:#5c5c66;font-size:12.5px;line-height:1.5;margin-top:6px">
             ${esc(recortar(m.sinopsis, 165))}</div>` : ''}
        </td>
      </tr>
    </table>
  </td></tr>`;
};

const cuerpo = `<!doctype html>
<html lang="es"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<meta name="color-scheme" content="light only"><meta name="supported-color-schemes" content="light only">
<title>Cinefilos · novedades</title></head>
<body style="margin:0;padding:0;background:#f2f2f6;
  font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif">
<div style="display:none;max-height:0;overflow:hidden;opacity:0">
  ${nuevas.length} título${nuevas.length === 1 ? '' : 's'} nuevo${nuevas.length === 1 ? '' : 's'} esta semana en Cinefilos.
</div>
<table width="100%" cellpadding="0" cellspacing="0" role="presentation">
<tr><td align="center" style="padding:26px 12px 34px">
  <table width="100%" cellpadding="0" cellspacing="0" role="presentation" style="max-width:600px">

    <tr><td style="background:#ffc400;border-radius:16px 16px 0 0;padding:22px 24px">
      <table width="100%" cellpadding="0" cellspacing="0" role="presentation"><tr>
        <td>
          <div style="font-size:19px;font-weight:800;color:#0a0a0a;letter-spacing:-.02em">Cinefilos</div>
          <div style="font-size:12.5px;color:#0a0a0a;opacity:.72;margin-top:2px">
            Novedades del ${desde} al ${hasta}</div>
        </td>
        <td align="right" style="font-size:34px;line-height:1">🎬</td>
      </tr></table>
    </td></tr>

    <tr><td style="background:#ffffff;padding:22px 24px 6px">
      ${nuevas.length ? `
        <div style="font-size:26px;font-weight:800;color:#15161a;letter-spacing:-.03em">
          ${nuevas.length} título${nuevas.length === 1 ? '' : 's'} nuevo${nuevas.length === 1 ? '' : 's'}</div>
        <div style="font-size:13px;color:#75757f;margin-top:4px">
          El catálogo ya tiene ${movies.length.toLocaleString('es')} películas para ver.</div>`
      : `
        <div style="font-size:20px;font-weight:800;color:#15161a;letter-spacing:-.03em">
          Esta semana no entró nada nuevo</div>
        <div style="font-size:13px;color:#75757f;margin-top:4px">
          Pero el catálogo sigue ahí, con ${movies.length.toLocaleString('es')} películas.</div>`}
    </td></tr>

    ${mostradas.length ? `
    <tr><td style="background:#ffffff;padding:18px 24px 2px">
      <div style="font-size:11.5px;font-weight:700;letter-spacing:.1em;
                  text-transform:uppercase;color:#9a9aa4">
        ${nuevas.length > TOPE ? 'Las mejor valoradas' : 'Lo que ha entrado'}</div>
    </td></tr>
    <tr><td style="background:#ffffff;padding:12px 12px 4px">
      <table width="100%" cellpadding="0" cellspacing="0" role="presentation">
        ${mostradas.map(filaPeli).join('')}
      </table>
      ${restantes > 0 ? `<div style="text-align:center;font-size:13px;color:#75757f;padding:12px 0 2px">
        y <a href="${SITIO}" style="color:#75757f;font-weight:650">${restantes} título${restantes === 1 ? '' : 's'} más</a>
        en el catálogo</div>` : ''}
    </td></tr>` : ''}

    <tr><td style="background:#ffffff;padding:20px 24px 26px" align="center">
      <a href="${SITIO}" style="display:inline-block;background:#15161a;color:#ffffff;
         text-decoration:none;font-weight:650;font-size:14.5px;padding:13px 30px;border-radius:999px">
        Ver el catálogo completo</a>
    </td></tr>

    <tr><td style="background:#ffffff;padding:0 16px 20px">
      <table width="100%" cellpadding="0" cellspacing="0" role="presentation"
             style="background:#fffaea;border:1px solid #ffe9a3;border-radius:12px">
        <tr>
          <td width="54" align="center" valign="top" style="padding:16px 0 16px 16px;font-size:26px">☕</td>
          <td valign="top" style="padding:16px 16px 16px 10px">
            <div style="font-size:13.5px;font-weight:700;color:#15161a">¿Te sirve el catálogo?</div>
            <div style="font-size:12.5px;color:#75757f;margin:2px 0 12px;line-height:1.45">
              Mantenerlo cuesta ratos y ganas. Un café ayuda.</div>
            <!-- La llave no se puede enlazar: se copia a mano en la app del banco -->
            <span style="display:inline-block;background:#ffffff;border:1px solid #ffe9a3;
              border-radius:999px;padding:9px 16px;font-size:13px;color:#15161a">
              Llave Bre-B
              <b style="font-family:ui-monospace,SFMono-Regular,Menlo,monospace;
                 letter-spacing:.02em">${LLAVE}</b></span>
          </td>
        </tr>
      </table>
    </td></tr>

    <tr><td style="background:#ffffff;border-radius:0 0 16px 16px;
        border-top:1px solid #f0f0f4;padding:16px 24px 20px">
      <div style="font-size:11.5px;color:#9a9aa4;line-height:1.6">
        Resumen automático de <a href="${SITIO}" style="color:#9a9aa4">Cinefilos</a>, cada viernes.
      </div>
    </td></tr>

  </table>
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

console.log(`nuevas en ${DIAS} días: ${nuevas.length} · mostradas: ${mostradas.length} · catálogo: ${movies.length}`);
console.log(`asunto: ${asunto}`);
console.log(`peso del correo: ${(cuerpo.length / 1024).toFixed(1)} KB` +
  (cuerpo.length > 102000 ? '  ¡OJO! Gmail recorta a partir de 102 KB' : ''));
if (process.env.GITHUB_OUTPUT) {
  fs.appendFileSync(process.env.GITHUB_OUTPUT, `nuevas=${nuevas.length}\nasunto=${asunto}\n`);
}
