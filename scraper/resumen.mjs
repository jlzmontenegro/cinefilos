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
const porNota = [...nuevas].sort((a, b) => (b.imdb || -1) - (a.imdb || -1));
const mostradas = porNota.slice(0, TOPE);
const restantes = nuevas.length - mostradas.length;

/* La mejor valorada de la semana encabeza el correo con ficha grande. Diez filas
   idénticas se leen como una lista de la compra: sin nada que destaque, la vista
   resbala. Necesita carátula y sinopsis para llenar la ficha; si la mejor no las
   tiene, se busca la siguiente que sí. */
const destacada = mostradas.find((m) => m.poster && m.sinopsis) || null;
const resto = mostradas.filter((m) => m !== destacada);

const esSerie = (m) => /serie/i.test(m.tipo || '');
const pelisNuevas = resto.filter((m) => !esSerie(m));
const seriesNuevas = resto.filter(esSerie);

/* El mismo dato que enseña la ficha del catálogo: qué trae la publicación.
   En un correo de novedades importa más que en ningún sitio, porque es donde se
   decide si merece la pena entrar. */
function tramoTexto(m) {
  if (!m.tramo) return null;
  const [temp, desde, hasta, total] = m.tramo;
  const partes = [];
  if (temp != null) partes.push('T' + temp);
  if (desde != null) partes.push(desde === hasta ? 'E' + desde : `E${desde}-${hasta}`);
  if (!partes.length) return total != null ? `${total} episodios` : null;
  return partes.join(' · ') + (total != null ? ` de ${total}` : '');
}

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
/* Etiquetas. Van con `display:inline-block` y bordes redondeados: Outlook de
   escritorio los pinta cuadrados, que es una degradación aceptable. */
const etiqueta = (txt, { color = '#9aa0ae', fondo = '#171b26', borde = '#262b38' } = {}) =>
  `<span style="display:inline-block;background:${fondo};border:1px solid ${borde};
     color:${color};font-size:11px;font-weight:650;padding:3px 8px;border-radius:20px;
     white-space:nowrap;margin:0 5px 5px 0">${esc(txt)}</span>`;

const etiquetaNota = (m) => m.imdb
  ? etiqueta(`★ ${m.imdb.toFixed(1)}`, { color: '#ffc400', fondo: '#241f06', borde: '#3d3413' })
  : '';

/* Las etiquetas de una ficha, en el orden en que se leen: cuánto vale, de qué va,
   y —si es serie— qué trae, que es lo que decide si entras o no. */
const etiquetas = (m) => {
  const t = tramoTexto(m);
  return etiquetaNota(m)
    + (m.generos || []).slice(0, 1).map((g) => etiqueta(g)).join('')
    + (esSerie(m)
      ? etiqueta(t ? `${m.tipo} · ${t}` : m.tipo, { color: '#bcd9ff', fondo: '#141b28', borde: '#28405e' })
      : '');
};

/* La ficha grande de la mejor de la semana. */
const fichaDestacada = (m) => {
  const url = enlace(m);
  const meta = [m.anio, (m.directores || [])[0]].filter(Boolean).join(' · ');
  /* El cartel va a la derecha, al revés que en las filas de abajo. Además de
     romper la monotonía, deja el texto pegado al margen izquierdo, que es por
     donde se empieza a leer. */
  return `
  <table width="100%" cellpadding="0" cellspacing="0" role="presentation"
         style="background:#12151f;border:1px solid #2d3242;border-radius:16px">
    <tr>
      <td valign="top" style="padding:16px 12px 16px 16px">
        <div style="font-size:10.5px;font-weight:700;letter-spacing:.13em;
             text-transform:uppercase;color:#ffc400;margin-bottom:6px">La mejor de la semana</div>
        <a href="${esc(url)}" style="color:#f2f3f7;text-decoration:none;font-weight:800;
           font-size:19px;line-height:1.2;letter-spacing:-.02em">${esc(titulo(m))}</a>
        <div style="color:#8e8e99;font-size:12.5px;margin:6px 0 8px">${esc(meta)}</div>
        <div>${etiquetas(m)}</div>
        <div style="color:#7c7c88;font-size:12.5px;line-height:1.55;margin-top:4px">
          ${esc(recortar(m.sinopsis, 230))}</div>
      </td>
      <td width="126" valign="top" style="padding:16px 16px 16px 0">
        <a href="${esc(url)}" style="text-decoration:none">
          <img src="${esc(m.poster)}" width="110" height="165" alt="${esc(titulo(m))}"
               style="display:block;width:110px;height:165px;border-radius:10px;
                      background:#1b1f2b;border:0;outline:none;text-decoration:none">
        </a>
      </td>
    </tr>
  </table>`;
};

const filaPeli = (m) => {
  const meta = [m.anio, (m.directores || [])[0]].filter(Boolean).join(' · ');
  const url = enlace(m);
  return `
  <tr><td style="padding:0 0 8px">
    <table width="100%" cellpadding="0" cellspacing="0" role="presentation"
           style="background:#12151f;border:1px solid #23262f;border-radius:14px">
      <tr>
        <td width="76" valign="top" style="padding:12px 0 12px 12px">
          <a href="${esc(url)}" style="text-decoration:none">
            <!-- El alt lleva el título: muchos clientes bloquean las imágenes por
                 defecto y sin esto quedaban diez rectángulos vacíos. -->
            <img src="${esc(m.poster || '')}" width="64" height="96" alt="${esc(titulo(m))}"
                 style="display:block;width:64px;height:96px;border-radius:8px;
                        background:#1b1f2b;border:0;outline:none;text-decoration:none">
          </a>
        </td>
        <td valign="top" style="padding:12px 14px 12px 10px">
          <a href="${esc(url)}" style="color:#f2f3f7;text-decoration:none;font-weight:700;
             font-size:15px;line-height:1.25">${esc(titulo(m))}</a>
          <div style="color:#8e8e99;font-size:12.5px;margin:5px 0 7px">${esc(meta)}</div>
          <div>${etiquetas(m)}</div>
          ${m.sinopsis ? `<div style="color:#7c7c88;font-size:12.5px;line-height:1.5;margin-top:2px">
             ${esc(recortar(m.sinopsis, 150))}</div>` : ''}
        </td>
      </tr>
    </table>
  </td></tr>`;
};

/* Encabezado de bloque, para separar películas de series como hace el catálogo. */
const rotulo = (txt, n) => `
  <tr><td style="padding:14px 12px 10px">
    <span style="font-size:11.5px;font-weight:700;letter-spacing:.1em;
          text-transform:uppercase;color:#6f6f7b">${esc(txt)}</span>
    <span style="font-size:11.5px;color:#4e4e59;margin-left:7px">${n}</span>
  </td></tr>`;

/* El resto, sólo como enlaces. Así el correo cuenta la semana entera sin
   convertirse en un catálogo: cada línea ocupa una fracción de una ficha. */
const TOPE_LISTA = 25;
const enLista = porNota.slice(TOPE, TOPE + TOPE_LISTA);
const sinListar = nuevas.length - TOPE - enLista.length;
const listaCompacta = enLista.map((m) => {
  const t = esSerie(m) ? tramoTexto(m) : null;
  return `<div style="padding:5px 0;border-bottom:1px solid #191c25">
    <a href="${esc(enlace(m))}" style="color:#d7d9e0;text-decoration:none;font-size:13px;
       font-weight:600">${esc(titulo(m))}</a>
    <span style="color:#6f6f7b;font-size:12px">${esc([
      m.anio, m.imdb ? `★ ${m.imdb.toFixed(1)}` : null, t,
    ].filter(Boolean).join(' · '))}</span>
  </div>`;
}).join('');

const cuerpo = `<!doctype html>
<html lang="es"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<meta name="color-scheme" content="dark"><meta name="supported-color-schemes" content="dark">
<title>Cinefilos · novedades</title></head>
<body style="margin:0;padding:0;background:#06070c;
  font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif">
<div style="display:none;max-height:0;overflow:hidden;opacity:0">
  ${nuevas.length} título${nuevas.length === 1 ? '' : 's'} nuevo${nuevas.length === 1 ? '' : 's'} esta semana en Cinefilos.
</div>
<table width="100%" cellpadding="0" cellspacing="0" role="presentation">
<tr><td align="center" style="padding:26px 12px 34px">
  <table width="100%" cellpadding="0" cellspacing="0" role="presentation" style="max-width:600px">

    <!-- Cabecera oscura con una raya amarilla arriba, como el catálogo -->
    <tr><td style="background:#ffc400;border-radius:16px 16px 0 0;font-size:0;line-height:0;height:4px">&nbsp;</td></tr>
    <tr><td style="background:#0d1018;padding:24px 24px 20px;border-left:1px solid #23262f;border-right:1px solid #23262f">
      <table width="100%" cellpadding="0" cellspacing="0" role="presentation"><tr>
        <td>
          <!-- en versales y con aire entre letras, como la marca del catálogo -->
          <div style="font-size:17px;font-weight:800;color:#ffc400;
               text-transform:uppercase;letter-spacing:.14em">Cinefilos</div>
          <div style="font-size:12.5px;color:#8e8e99;margin-top:3px">
            Novedades del ${desde} al ${hasta}</div>
        </td>
        <td align="right" style="font-size:32px;line-height:1">🎬</td>
      </tr></table>
    </td></tr>

    <tr><td style="background:#0d1018;padding:4px 24px 6px;border-left:1px solid #23262f;border-right:1px solid #23262f">
      ${nuevas.length ? `
        <div style="font-size:27px;font-weight:800;color:#f2f3f7;letter-spacing:-.03em">
          ${nuevas.length} título${nuevas.length === 1 ? '' : 's'} nuevo${nuevas.length === 1 ? '' : 's'}</div>
        <div style="font-size:13px;color:#8e8e99;margin-top:5px">
          El catálogo ya tiene ${movies.length.toLocaleString('es')} películas para ver.</div>`
      : `
        <div style="font-size:21px;font-weight:800;color:#f2f3f7;letter-spacing:-.03em">
          Esta semana no entró nada nuevo</div>
        <div style="font-size:13px;color:#8e8e99;margin-top:5px">
          Pero el catálogo sigue ahí, con ${movies.length.toLocaleString('es')} películas.</div>`}
    </td></tr>

    ${destacada ? `
    <tr><td style="background:#0d1018;padding:18px 16px 4px;border-left:1px solid #23262f;border-right:1px solid #23262f">
      ${fichaDestacada(destacada)}
    </td></tr>` : ''}

    ${resto.length ? `
    <tr><td style="background:#0d1018;padding:4px 12px 4px;border-left:1px solid #23262f;border-right:1px solid #23262f">
      <table width="100%" cellpadding="0" cellspacing="0" role="presentation">
        ${pelisNuevas.length ? rotulo(seriesNuevas.length ? 'Películas' : 'También ha entrado', pelisNuevas.length) : ''}
        ${pelisNuevas.map(filaPeli).join('')}
        ${seriesNuevas.length ? rotulo('Series', seriesNuevas.length) : ''}
        ${seriesNuevas.map(filaPeli).join('')}
      </table>
    </td></tr>` : ''}

    ${enLista.length ? `
    <tr><td style="background:#0d1018;padding:10px 24px 4px;border-left:1px solid #23262f;border-right:1px solid #23262f">
      <div style="font-size:11.5px;font-weight:700;letter-spacing:.1em;
                  text-transform:uppercase;color:#6f6f7b;padding-bottom:4px">Y también</div>
      ${listaCompacta}
      ${sinListar > 0 ? `<div style="font-size:12.5px;color:#6f6f7b;padding:10px 0 0">
        y <a href="${SITIO}" style="color:#ffc400;font-weight:650;text-decoration:none">${sinListar} más</a>
        en el catálogo</div>` : ''}
    </td></tr>` : ''}

    <tr><td style="background:#0d1018;padding:22px 24px 26px;border-left:1px solid #23262f;border-right:1px solid #23262f" align="center">
      <a href="${SITIO}" style="display:inline-block;background:#ffc400;color:#0a0a0a;
         text-decoration:none;font-weight:700;font-size:14.5px;padding:13px 30px;border-radius:999px">
        Ver el catálogo completo</a>
    </td></tr>

    <tr><td style="background:#0d1018;padding:0 16px 20px;border-left:1px solid #23262f;border-right:1px solid #23262f">
      <table width="100%" cellpadding="0" cellspacing="0" role="presentation"
             style="background:#171408;border:1px solid #3d3413;border-radius:12px">
        <tr>
          <td width="54" align="center" valign="middle" style="padding:16px 0 16px 16px;font-size:26px">☕</td>
          <td valign="middle" style="padding:16px 10px">
            <div style="font-size:13.5px;font-weight:700;color:#f2f3f7">¿Te sirve el catálogo?</div>
            <div style="font-size:12.5px;color:#8e8e99;margin-top:2px;line-height:1.45">
              Mantenerlo cuesta ratos y ganas. Un café ayuda.</div>
          </td>
          <!-- La llave se ve aquí para quien la quiera copiar del propio correo, y
               además lleva al catálogo, donde hay un botón que la copia sola. -->
          <td align="right" valign="middle" style="padding:16px 16px 16px 0">
            <a href="${SITIO}/#cafe" style="display:inline-block;background:#ffc400;color:#0a0a0a;
               text-decoration:none;font-weight:700;font-size:12.5px;padding:9px 16px;
               border-radius:999px;white-space:nowrap">Bre-B
               <span style="font-family:ui-monospace,SFMono-Regular,Menlo,monospace">${LLAVE}</span></a>
          </td>
        </tr>
      </table>
    </td></tr>

    <tr><td style="background:#0d1018;border-radius:0 0 16px 16px;
        border:1px solid #23262f;border-top:1px solid #1c1f28;padding:16px 24px 20px">
      <div style="font-size:11.5px;color:#6f6f7b;line-height:1.6">
        Resumen automático de <a href="${SITIO}" style="color:#6f6f7b">Cinefilos</a>, cada viernes.
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
