// Clasificador compartido: lo usa normalize.mjs (Node) y también se incrusta en
// el HTML para que las novedades que descarga el navegador se procesen con
// exactamente las mismas reglas. Va envuelto en una función para poder
// inyectarlo sin chocar con el resto del código de la página.
export function crearClasificador() {

  // ---------- normalización de texto ----------
  // Algunos posts usan alfabetos matemáticos Unicode (𝙸 𝚂𝚠𝚎𝚊𝚛). Los pasamos a ASCII.
  function deMath(s) {
    if (!s) return s;
    let out = '';
    for (const ch of s) {
      const c = ch.codePointAt(0);
      let m = null;
      const altas = [0x1d400, 0x1d434, 0x1d468, 0x1d49c, 0x1d4d0, 0x1d504, 0x1d538, 0x1d56c,
        0x1d5a0, 0x1d5d4, 0x1d608, 0x1d63c, 0x1d670, 0x1d6a8];
      for (const a of altas) { if (c >= a && c <= a + 25) { m = String.fromCharCode(65 + (c - a)); break; } }
      if (!m) {
        const bajas = [0x1d41a, 0x1d44e, 0x1d482, 0x1d4b6, 0x1d4ea, 0x1d51e, 0x1d552, 0x1d586,
          0x1d5ba, 0x1d5ee, 0x1d622, 0x1d656, 0x1d68a];
        for (const a of bajas) { if (c >= a && c <= a + 25) { m = String.fromCharCode(97 + (c - a)); break; } }
      }
      if (!m && c >= 0x1d7ce && c <= 0x1d7ff) m = String((c - 0x1d7ce) % 10);
      out += m || ch;
    }
    return out.normalize('NFC');
  }

  const clean = (s) => deMath(String(s || '')).replace(/ /g, ' ').replace(/[ \t]+/g, ' ').trim();
  const fold = (s) => clean(s).toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '');

  // ---------- países ----------
  const GENTILICIOS = [
    ['estadounidense', 'Estados Unidos', '🇺🇸'], ['norteamericana', 'Estados Unidos', '🇺🇸'],
    ['española', 'España', '🇪🇸'], ['gallega', 'España', '🇪🇸'], ['catalana', 'España', '🇪🇸'], ['vasca', 'España', '🇪🇸'],
    ['mexicana', 'México', '🇲🇽'], ['argentina', 'Argentina', '🇦🇷'], ['chilena', 'Chile', '🇨🇱'],
    ['colombiana', 'Colombia', '🇨🇴'], ['peruana', 'Perú', '🇵🇪'], ['uruguaya', 'Uruguay', '🇺🇾'],
    ['venezolana', 'Venezuela', '🇻🇪'], ['cubana', 'Cuba', '🇨🇺'], ['dominicana', 'Rep. Dominicana', '🇩🇴'],
    ['boliviana', 'Bolivia', '🇧🇴'], ['ecuatoriana', 'Ecuador', '🇪🇨'], ['paraguaya', 'Paraguay', '🇵🇾'],
    ['guatemalteca', 'Guatemala', '🇬🇹'], ['costarricense', 'Costa Rica', '🇨🇷'], ['panameña', 'Panamá', '🇵🇦'],
    ['puertorriqueña', 'Puerto Rico', '🇵🇷'], ['hondureña', 'Honduras', '🇭🇳'], ['salvadoreña', 'El Salvador', '🇸🇻'],
    ['nicaragüense', 'Nicaragua', '🇳🇮'], ['brasileña', 'Brasil', '🇧🇷'], ['brasilera', 'Brasil', '🇧🇷'],
    ['francesa', 'Francia', '🇫🇷'], ['italiana', 'Italia', '🇮🇹'], ['británica', 'Reino Unido', '🇬🇧'],
    ['inglesa', 'Reino Unido', '🇬🇧'], ['escocesa', 'Reino Unido', '🇬🇧'], ['galesa', 'Reino Unido', '🇬🇧'],
    ['irlandesa', 'Irlanda', '🇮🇪'], ['alemana', 'Alemania', '🇩🇪'], ['austriaca', 'Austria', '🇦🇹'],
    ['austríaca', 'Austria', '🇦🇹'], ['suiza', 'Suiza', '🇨🇭'], ['belga', 'Bélgica', '🇧🇪'],
    ['neerlandesa', 'Países Bajos', '🇳🇱'], ['holandesa', 'Países Bajos', '🇳🇱'], ['portuguesa', 'Portugal', '🇵🇹'],
    ['sueca', 'Suecia', '🇸🇪'], ['danesa', 'Dinamarca', '🇩🇰'], ['noruega', 'Noruega', '🇳🇴'],
    ['finlandesa', 'Finlandia', '🇫🇮'], ['islandesa', 'Islandia', '🇮🇸'], ['rusa', 'Rusia', '🇷🇺'],
    ['soviética', 'URSS', '🚩'], ['ucraniana', 'Ucrania', '🇺🇦'], ['polaca', 'Polonia', '🇵🇱'],
    ['checa', 'Chequia', '🇨🇿'], ['checoslovaca', 'Checoslovaquia', '🏳️'], ['eslovaca', 'Eslovaquia', '🇸🇰'],
    ['húngara', 'Hungría', '🇭🇺'], ['rumana', 'Rumanía', '🇷🇴'], ['búlgara', 'Bulgaria', '🇧🇬'],
    ['serbia', 'Serbia', '🇷🇸'], ['croata', 'Croacia', '🇭🇷'], ['eslovena', 'Eslovenia', '🇸🇮'],
    ['bosnia', 'Bosnia', '🇧🇦'], ['macedonia', 'Macedonia', '🇲🇰'], ['albanesa', 'Albania', '🇦🇱'],
    ['griega', 'Grecia', '🇬🇷'], ['turca', 'Turquía', '🇹🇷'], ['chipriota', 'Chipre', '🇨🇾'],
    ['israelí', 'Israel', '🇮🇱'], ['iraní', 'Irán', '🇮🇷'], ['iraquí', 'Irak', '🇮🇶'],
    ['libanesa', 'Líbano', '🇱🇧'], ['siria', 'Siria', '🇸🇾'], ['palestina', 'Palestina', '🇵🇸'],
    ['jordana', 'Jordania', '🇯🇴'], ['saudí', 'Arabia Saudí', '🇸🇦'], ['emiratí', 'Emiratos Árabes', '🇦🇪'],
    ['egipcia', 'Egipto', '🇪🇬'], ['marroquí', 'Marruecos', '🇲🇦'], ['argelina', 'Argelia', '🇩🇿'],
    ['tunecina', 'Túnez', '🇹🇳'], ['sudafricana', 'Sudáfrica', '🇿🇦'], ['nigeriana', 'Nigeria', '🇳🇬'],
    ['senegalesa', 'Senegal', '🇸🇳'], ['keniana', 'Kenia', '🇰🇪'], ['etíope', 'Etiopía', '🇪🇹'],
    ['japonesa', 'Japón', '🇯🇵'], ['surcoreana', 'Corea del Sur', '🇰🇷'], ['coreana', 'Corea del Sur', '🇰🇷'],
    ['norcoreana', 'Corea del Norte', '🇰🇵'], ['china', 'China', '🇨🇳'], ['hongkonesa', 'Hong Kong', '🇭🇰'],
    ['taiwanesa', 'Taiwán', '🇹🇼'], ['india', 'India', '🇮🇳'], ['pakistaní', 'Pakistán', '🇵🇰'],
    ['bangladesí', 'Bangladés', '🇧🇩'], ['nepalí', 'Nepal', '🇳🇵'], ['srilanquesa', 'Sri Lanka', '🇱🇰'],
    ['tailandesa', 'Tailandia', '🇹🇭'], ['vietnamita', 'Vietnam', '🇻🇳'], ['camboyana', 'Camboya', '🇰🇭'],
    ['filipina', 'Filipinas', '🇵🇭'], ['indonesia', 'Indonesia', '🇮🇩'], ['malasia', 'Malasia', '🇲🇾'],
    ['singapurense', 'Singapur', '🇸🇬'], ['birmana', 'Myanmar', '🇲🇲'], ['mongola', 'Mongolia', '🇲🇳'],
    ['kazaja', 'Kazajistán', '🇰🇿'], ['georgiana', 'Georgia', '🇬🇪'], ['armenia', 'Armenia', '🇦🇲'],
    ['estonia', 'Estonia', '🇪🇪'], ['letona', 'Letonia', '🇱🇻'], ['lituana', 'Lituania', '🇱🇹'],
    ['australiana', 'Australia', '🇦🇺'], ['neozelandesa', 'Nueva Zelanda', '🇳🇿'], ['canadiense', 'Canadá', '🇨🇦'],
    ['quebequense', 'Canadá', '🇨🇦'], ['luxemburguesa', 'Luxemburgo', '🇱🇺'], ['maltesa', 'Malta', '🇲🇹'],
  ];
  // prefijos de coproducción: hispano-belga, franco-alemana, ítalo-española…
  const PREFIJOS = {
    hispano: 'España', franco: 'Francia', galo: 'Francia', italo: 'Italia', 'ítalo': 'Italia',
    germano: 'Alemania', teuton: 'Alemania', anglo: 'Reino Unido', britano: 'Reino Unido',
    luso: 'Portugal', ruso: 'Rusia', sovietico: 'URSS', greco: 'Grecia', turco: 'Turquía',
    sino: 'China', nipo: 'Japón', japo: 'Japón', indo: 'India', coreano: 'Corea del Sur',
    surcoreano: 'Corea del Sur', mexicano: 'México', argentino: 'Argentina', brasileno: 'Brasil',
    chileno: 'Chile', colombiano: 'Colombia', peruano: 'Perú', uruguayo: 'Uruguay', cubano: 'Cuba',
    venezolano: 'Venezuela', canadiense: 'Canadá', belga: 'Bélgica', neerlandes: 'Países Bajos',
    holandes: 'Países Bajos', sueco: 'Suecia', danes: 'Dinamarca', noruego: 'Noruega',
    finlandes: 'Finlandia', islandes: 'Islandia', polaco: 'Polonia', checo: 'Chequia',
    hungaro: 'Hungría', rumano: 'Rumanía', bulgaro: 'Bulgaria', serbio: 'Serbia', croata: 'Croacia',
    austriaco: 'Austria', suizo: 'Suiza', irlandes: 'Irlanda', israeli: 'Israel', irani: 'Irán',
    egipcio: 'Egipto', marroqui: 'Marruecos', australiano: 'Australia', neozelandes: 'Nueva Zelanda',
    estadounidense: 'Estados Unidos', americano: 'Estados Unidos', norteamericano: 'Estados Unidos',
    espanol: 'España', frances: 'Francia', aleman: 'Alemania', portugues: 'Portugal', tailandes: 'Tailandia',
  };
  const FLAG = Object.fromEntries(GENTILICIOS.map(([, p, f]) => [p, f]));

  function paises(texto) {
    const t = fold(texto);
    const found = new Set();
    // coproducciones con guion: hispano-belga, ítalo-franco-española
    for (const m of t.matchAll(/\b([a-z]+(?:-[a-z]+){1,3})\b/g)) {
      const partes = m[1].split('-');
      if (partes.length < 2) continue;
      const hits = [];
      for (const p of partes) {
        const gent = GENTILICIOS.find(([g]) => fold(g) === p || fold(g).slice(0, -1) === p);
        const pref = Object.keys(PREFIJOS).find((k) => p === k || p === k + 's' ||
          (p.startsWith(k) && p.length - k.length <= 3));
        if (gent) hits.push(gent[1]);
        else if (pref) hits.push(PREFIJOS[pref]);
        else { hits.length = 0; break; }
      }
      if (hits.length >= 2) hits.forEach((h) => found.add(h));
    }
    // gentilicios sueltos
    for (const [g, pais] of GENTILICIOS) {
      if (new RegExp('\\b' + fold(g) + '(s)?\\b').test(t)) found.add(pais);
    }
    return [...found];
  }

  // ---------- géneros ----------
  const GENEROS = [
    ['ciencia ficcion', 'Ciencia ficción'], ['sci-fi', 'Ciencia ficción'],
    ['cine negro', 'Cine negro'], ['film noir', 'Cine negro'],
    ['comedia', 'Comedia'],
    ['dramatic', 'Drama'], ['drama', 'Drama'],
    ['terror', 'Terror'], ['horror', 'Terror'], ['slasher', 'Terror'], ['gore', 'Terror'],
    ['zombi', 'Terror'], ['sobrenatural', 'Terror'], ['vampir', 'Terror'],
    ['thriller', 'Thriller'], ['suspense', 'Thriller'], ['suspenso', 'Thriller'],
    ['policiac', 'Policíaca'], ['policial', 'Policíaca'], ['crimen', 'Policíaca'],
    ['criminal', 'Policíaca'], ['detective', 'Policíaca'], ['gangster', 'Policíaca'],
    ['romantic', 'Romance'], ['romance', 'Romance'],
    ['animacion', 'Animación'], ['anime', 'Animación'],
    ['documental', 'Documental'], ['docuserie', 'Documental'],
    ['western', 'Western'], ['musical', 'Musical'],
    ['belic', 'Bélica'], ['antibelic', 'Bélica'],
    ['aventura', 'Aventuras'], ['accion', 'Acción'],
    ['misterio', 'Misterio'], ['fantasi', 'Fantasía'], ['fantastic', 'Fantasía'],
    ['biografic', 'Biográfica'], ['biopic', 'Biográfica'],
    ['historic', 'Histórica'], ['epic', 'Histórica'], ['peplum', 'Histórica'],
    ['erotic', 'Erótica'], ['deportiv', 'Deporte'], ['familiar', 'Familiar'],
    ['infantil', 'Infantil'], ['catastrof', 'Catástrofe'], ['superheroe', 'Superhéroes'],
    ['espionaje', 'Espionaje'], ['artes marciales', 'Artes marciales'],
    ['psicologic', 'Psicológico'], ['judicial', 'Judicial'], ['carcelari', 'Carcelaria'],
    ['road movie', 'Road movie'], ['experimental', 'Experimental'], ['antologi', 'Antología'],
    ['supervivencia', 'Supervivencia'], ['satir', 'Sátira'], ['parodia', 'Sátira'],
    ['surrealis', 'Surrealismo'], ['neorrealis', 'Neorrealismo'], ['mudo', 'Cine mudo'],
  ];
  function generos(texto) {
    const t = fold(texto);
    const found = new Set();
    for (const [k, g] of GENEROS) if (t.includes(k)) found.add(g);
    return [...found];
  }

  // ---------- tipo de obra ----------
  function tipo(texto) {
    const t = fold(texto);
    if (/\bminiserie\b/.test(t)) return 'Miniserie';
    if (/\bserie documental\b|\bdocuserie\b/.test(t)) return 'Serie documental';
    if (/\bserie (de )?(television|tv|web)?\b|\btemporada\b/.test(t)) return 'Serie';
    if (/\bcortometraje\b/.test(t)) return 'Cortometraje';
    if (/\bmediometraje\b/.test(t)) return 'Mediometraje';
    if (/\bdocumental\b/.test(t)) return 'Documental';
    return 'Película';
  }

  // ---------- idioma / subtítulos ----------
  function idioma(notas, titulo) {
    const t = fold(notas + ' ' + titulo);
    if (/with english subtitles|english subs/.test(t)) return 'Subs. en inglés';
    if (/subtitulad[oa] al espanol|subtitulos en espanol|vose|sub espanol/.test(t)) return 'Subt. español';
    if (/doblad[oa] al espanol|castellano|latino|audio espanol/.test(t)) return 'Español';
    if (/mudo|sin dialogos|intertitulos/.test(t)) return 'Mudo';
    return 'Original';
  }

  // ---------- línea de título ----------
  // Formato dominante: "Título original (Traducción) - AÑO - Director(es) (notas)"
  function parseTitulo(linea) {
    const L = clean(linea);

    // El año no siempre viene solo. Las series suelen listar todas sus temporadas
    // ("- 2020, 2021 y 2022 -") o un rango ("- 1990-1995 -"). Antes nada de eso
    // encajaba y la cabecera entera se quedaba como título, así que salían fichas
    // sin año, sin director y con un título de cuatro líneas.
    // Ojo: la lista NO puede separarse con guion. Hay títulos que llevan dentro un
    // rango de años ("In Search of Darkness 1995-1999", "Wartorn: 1861-2010") y
    // admitir el guion aquí se los comía, dejando el título a medias y el año mal.
    const ANIOS = '(?:19|20)\\d{2}(?:\\s*(?:,|y|&)\\s*(?:19|20)\\d{2})*';

    // El guion que separa título de año tiene que llevar espacio en algún lado.
    // Con espacio a ambos lados se perdían cabeceras escritas ")- 2019"; sin exigir
    // ninguno, "1995-1999" pasaba por separador y partía el título. Pedir al menos
    // uno acepta lo primero y rechaza lo segundo.
    const SEP = '(?:\\s+[-–—]\\s*|\\s*[-–—]\\s+)';

    // Después del año se admiten más separadores que antes: hay cabeceras escritas
    // con punto ("- 1960 . Stanley Kubrick"). Delante del año se sigue exigiendo
    // guion, porque el punto es demasiado común dentro de un título ("Dr. No").
    const SEP2 = '(?:\\s+[-–—.·|]\\s*|\\s*[-–—.·|]\\s+)';

    // Primero el formato bueno, con guion delante del año. Sólo si falla se admite
    // la variante escrita con espacios ("Druk (Una ronda más)  2020 - Vinterberg"),
    // que exige separador *después* del año para no tragarse cualquier cifra suelta.
    const m = new RegExp(`^(.*?)${SEP}(${ANIOS})(?:${SEP2}(.*))?$`).exec(L)
           || new RegExp(`^(.*?)\\s+(${ANIOS})${SEP2}(.*)$`).exec(L);

    let titulo = L, anio = null, resto = '';
    // De una lista de años se guarda el primero: es cuando empezó la obra.
    if (m) {
      titulo = clean(m[1]);
      anio = parseInt(/(?:19|20)\d{2}/.exec(m[2])[0], 10);
      resto = clean(m[3] || '');
    }

    // Lo que va entre paréntesis y habla de la copia, no de la obra. El patrón es
    // deliberadamente estrecho: en las 5.500 fichas sólo hay ocho notas distintas
    // y todas son de subtítulos. Con una lista más amplia («subs», «parte»,
    // «temporada») se colaban títulos legítimos — «El guardia del subSUELO», «La
    // TEMPORADA del diablo», «Un lugar en ninguna PARTE» — que perdían su
    // traducción o acababan mostrándose con la nota como título.
    const NOTA_VERSION = /subtitul|english\s+subtitle/i;

    let director = resto, notas = '';
    const nm = /^(.*?)\s*\(([^()]*)\)\s*$/.exec(resto);
    if (nm && NOTA_VERSION.test(nm[2])) { director = clean(nm[1]); notas = clean(nm[2]); }

    let original = titulo, traducido = null;
    const tm = /^(.+?)\s*\(([^()]+)\)\s*$/.exec(titulo);
    if (tm) {
      original = clean(tm[1]);
      // El paréntesis del título suele ser la traducción, pero si habla de la
      // versión no puede acabar siendo el título. Pasaba con «Spartacus
      // (Espartaco) - 1960 . Stanley Kubrick (subtitulado al español)», que se
      // mostraba en el catálogo como «subtitulado al español».
      if (NOTA_VERSION.test(tm[2])) notas = notas || clean(tm[2]);
      else traducido = clean(tm[2]);
    }

    const directores = director
      ? director.split(/\s*,\s*|\s+y\s+|\s+&\s+|\s+and\s+/i).map(clean).filter((d) => d && d.length < 60)
      : [];

    return { titulo: traducido || original, tituloOriginal: original, tituloAlt: traducido, anio, directores, notas };
  }

  // La nacionalidad y el género sólo son fiables en la cláusula que define la obra
  // ("X es una comedia estadounidense de 2026 dirigida por..."). Más allá de ahí el
  // texto suele mencionar otras películas y contamina la clasificación.
  function clausulaDefinitoria(sinopsis) {
    const ini = /\b(es|fue)\s+(una|un|la|el)\b/i.exec(sinopsis);
    const desde = ini ? ini.index : 0;
    const trozo = sinopsis.slice(desde, desde + 320);
    const corte = /\bdirigid[ao]s?\s+por\b|\bescrit[ao]\s+y\s+dirigid|\brealizad[ao]\s+por\b|\bprotagonizad/i.exec(trozo);
    if (corte) return trozo.slice(0, corte.index);
    const punto = trozo.indexOf('. ');
    return punto > 0 ? trozo.slice(0, punto) : trozo;
  }

  // ---------- registro crudo -> película ----------
  // Devuelve null si la publicación no es una ficha de película.
  function construirPelicula(r) {
    if (!r || !r.id) return null;
    const body = clean(r.body || '');
    const lineas = String(r.body || '').split('\n').map(clean).filter(Boolean);
    if (!lineas.length) return null;

    const cabecera = lineas[0];
    const p = parseTitulo(cabecera);

    const sinopsis = lineas.slice(1)
      .filter((l) => !/^https?:\/\//i.test(l))
      .filter((l) => !/^(filmaffinity|imdb)\b/i.test(l))
      .join(' ')
      .replace(/https?:\/\/\S+/g, '')
      .replace(/\bFilmaffinity\b\s*-?\s*/gi, '')
      .replace(/\bImdb\s*[\d]+[.,]?\d*\s*/gi, '')
      .replace(/\s{2,}/g, ' ')
      .trim();

    const esFicha = p.anio || /es una (pelicula|serie|comedia|miniserie)|dirigid[ao] por|documental/i.test(fold(body));
    if (!esFicha && !r.videoId) return null;

    const imdbM = /\bimdb\s*[:\-]?\s*(\d{1,2})[.,](\d)/i.exec(body);
    const faM = /\bfilmaffinity\s*[:\-]?\s*(\d{1,2})[.,](\d)/i.exec(body);
    const embedM = /(https?:\/\/[^\s)]*\/embed\/[^\s)]+)/i.exec(r.body || '');

    const def = clausulaDefinitoria(sinopsis);
    const pais = paises(def);

    return {
      id: r.id,
      url: `https://ok.ru/cinefiliamalversa/topic/${r.id}`,
      titulo: p.titulo,
      tituloOriginal: p.tituloOriginal,
      tituloAlt: p.tituloAlt,
      anio: p.anio,
      decada: p.anio ? Math.floor(p.anio / 10) * 10 : null,
      directores: p.directores,
      paises: pais,
      banderas: pais.map((x) => FLAG[x] || '🏳️'),
      generos: generos(def + ' ' + (p.notas || '')),
      tipo: tipo(def),
      idioma: idioma(p.notas, cabecera),
      notas: p.notas || null,
      sinopsis,
      imdb: imdbM ? parseFloat(imdbM[1] + '.' + imdbM[2]) : null,
      filmaffinity: faM ? parseFloat(faM[1] + '.' + faM[2]) : null,
      duracion: r.duration || null,
      poster: r.image || r.videoThumb || null,
      thumb: r.videoThumb || null,
      videoId: r.videoId || null,
      embed: embedM ? embedM[1] : null,
      fecha: r.published || null,
      comentarios: r.comments || 0,
    };
  }

  // ---------- página de topic -> registro crudo ----------
  // Sólo manipula cadenas, así que sirve igual en Node y en el navegador.
  function parseTopicHTML(html) {
    const out = {};
    const prev = /<link rel="prev" href="[^"]*topic\/(\d+)"/.exec(html);
    const next = /<link rel="next" href="[^"]*topic\/(\d+)"/.exec(html);
    out.prevId = prev ? prev[1] : null;
    out.nextId = next ? next[1] : null;

    const a = html.indexOf('application/ld+json');
    if (a < 0) return null;
    const start = html.indexOf('>', a) + 1;
    const end = html.indexOf('</script>', start);
    let ld;
    try { ld = JSON.parse(html.slice(start, end)); } catch { return null; }
    const graph = ld['@graph'] || [ld];
    const art = graph.find((x) => x['@type'] === 'Article');
    if (!art) return null;

    out.id = (/topic\/(\d+)/.exec(art.url || '') || [])[1] || null;
    out.url = art.url || null;
    out.body = art.articleBody || '';
    out.headline = art.headline || '';
    out.published = art.datePublished || null;
    out.modified = art.dateModified || null;
    out.comments = art.commentCount ?? 0;

    const img = Array.isArray(art.image) ? art.image[0] : art.image;
    const ogImg = /<meta (?:property|name)="og:image" content="([^"]*)"/.exec(html);
    out.image = img?.contentUrl || (ogImg ? ogImg[1] : null);

    const vid = Array.isArray(art.video) ? art.video[0] : art.video;
    if (vid) {
      out.videoUrl = vid.url || null;
      out.videoId = (/video\/(\d+)/.exec(vid.url || '') || [])[1] || null;
      out.videoName = vid.name || null;
      out.videoThumb = vid.thumbnail?.contentUrl || null;
    }
    const dur = /<meta (?:property|name)="og:video:duration" content="(\d+)"/.exec(html);
    out.duration = dur ? parseInt(dur[1], 10) : null;
    return out;
  }

  return { construirPelicula, parseTopicHTML, fold, clean, FLAG };
}
