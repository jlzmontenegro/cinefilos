# Cinefilos — notas para trabajar en este proyecto

Catálogo de [ok.ru/cinefiliamalversa](https://ok.ru/cinefiliamalversa) en un **único
archivo HTML autónomo**: sin servidor, sin dependencias, sin build de JS. Se abre con
doble clic desde el disco y también está publicado en GitHub Pages.

`LEEME.md` es la documentación para quien *usa* el catálogo. Este archivo es para
quien lo *toca por dentro*.

---

## ⚠️ Lo primero: no edites `Cinefilos.html`

`Cinefilos.html` es un **archivo generado**. Se produce así:

```
raw.jsonl ──normalize.mjs──▶ movies.json ──build.mjs──▶ ../Cinefilos.html
                                              ▲
                          scraper/template.html ┘   (+ clasificar.mjs incrustado)
```

`build.mjs` coge `template.html` y sustituye dos marcadores:

| Marcador | Se rellena con |
|---|---|
| `__CLASIFICADOR__` | `clasificar.mjs` sin los `export`, incrustado tal cual |
| `__DATA__` | `movies.json` compactado por columnas |

**Todo cambio de HTML, CSS o JS de la interfaz va en `scraper/template.html`.**
Si lo escribes en `Cinefilos.html`, el siguiente `Actualizar catálogo.cmd` lo borra
sin avisar. (Ya pasó una vez: había ocho cambios sólo en el generado.)

Para comprobar que la plantilla y el generado no se han desincronizado:

```bash
cd scraper && node build.mjs
```

y verifica que `Cinefilos.html` no cambia de hash. Si cambia, alguien editó el
generado a mano y hay que portar el cambio a la plantilla.

---

## Regla del catálogo: sin dónde verla, no entra

Sólo forman parte del catálogo las publicaciones con **reproducción directa**
(`videoId`, reproductor de ok.ru incrustado) o, como mínimo, **fuente alternativa**
(`embed`, enlace externo). Una ficha sin ninguna de las dos no aparece: ni en las
cifras, ni en los filtros, ni en el buscador.

Está aplicado en dos sitios a propósito:

1. **`normalize.mjs`** — no llegan siquiera a `movies.json` (el archivo pesa menos).
2. **La página** (`const reproducible`) — red de seguridad que además cubre las
   novedades que el propio navegador descarga con el botón ⟳, que no pasan por Node.

Cifras de referencia: ~6.190 publicaciones en `raw.jsonl` → **~5.490 en el catálogo**
(~5.050 con reproducción directa + ~430 sólo con fuente alternativa). Unas 700 se
quedan fuera por no tener dónde verlas.

---

## Los pósters caducan (no es un bug tuyo)

ok.ru sirve las imágenes con un **enlace firmado que caduca al cabo de un año**.
Pasado ese plazo devuelve `HTTP 410 Gone` y la ficha se queda sin póster. No es
bloqueo por *hotlinking*: da 410 con cualquier *referer*, incluido el de ok.ru.

La imagen **no se ha perdido**: sólo el enlace. Volver a leer la publicación hace que
ok.ru genere uno nuevo.

### El plazo cuenta desde que se leyó, no desde que se publicó

Esto es lo que importa y lo que costó entender. El año no se cuenta desde la fecha de
la publicación, sino desde **el momento en que el scraper pidió la página**. Como el
recorrido inicial se hizo de una sentada, todos sus enlaces caducan casi a la vez, y
después van muriendo por tandas: cada día se apaga lo que se leyó ese mismo día del
año anterior.

Consecuencia práctica: **renovar sólo las caídas no sirve**. Se comprobó en vivo —
seis pósters que respondían `200` durante la comprobación daban `410` una hora
después, y un barrido posterior encontró 1.025 caídos nuevos, todos de publicaciones
de una misma quincena de un año antes. Por eso el script renueva **todas** por
defecto: así quedan alineadas y con un año entero por delante.

### `imageAt`: renovar antes de que se rompa

Cada vez que se renueva un enlace se anota en el registro `imageAt` con la fecha en
que se pidió. Con eso, el mantenimiento renueva **por adelantado** lo que pasa de
`DIAS` (330 por defecto, un mes de margen sobre el año) en lugar de esperar a que dé
410, y de paso comprueba cuáles están ya caídas.

Eso importa más de lo que parece: `raw.jsonl` son 11 MB y se versiona. Renovar todo
a diario metería 11 MB nuevos en el historial de Git cada vez. Renovando sólo lo que
toca, el diff es pequeño y comprime bien.

> **`imageAt` sólo se pone cuando se renueva de verdad. No lo selles a mano.**
> Al montarlo se sellaron los 6.247 registros con la fecha del día dando por hecho
> que todos se habían renovado, y **515 no lo estaban**: en aquella pasada fallaron
> por la carga y conservaron su enlace viejo. Marcados como frescos, el
> mantenimiento por edad dejó de mirarlos y fueron cayendo durante días. Si una
> renovación deja peticiones fallidas, esos registros tienen que quedarse **sin**
> sellar para que el sistema vuelva a por ellos.

```bash
cd scraper && node refrescar-posters.mjs          # el martillo: renueva todas
MANTENIMIENTO=1 node refrescar-posters.mjs        # caídas + a punto de caducar
DIAS=200 MANTENIMIENTO=1 node refrescar-posters.mjs   # con otro margen
SOLO_CAIDOS=1 node refrescar-posters.mjs          # sólo las que ya fallan
SOLO_COMPROBAR=1 node refrescar-posters.mjs       # sólo informa, no escribe
```

O doble clic en **`Refrescar imágenes.cmd`**. Sólo toca el campo `image` de
`raw.jsonl`; no re-clasifica nada. Escribe a un temporal y renombra, así un corte a
mitad no deja el archivo a medias. Al terminar lanza `normalize.mjs` + `build.mjs`.

El martillo (renovarlas todas) tarda ~25 min y algunas peticiones se pierden por la
carga: en una pasada fallaron 515, y ésas se quedan con el enlace viejo. **Si lo
usas, remata con `SOLO_CAIDOS=1`**, que es rápido y recoge lo que quedó. La última
pasada dejó 5.847 renovadas y 4 sin imagen ya en el origen (99,93% correctos).

En el día a día no hace falta: lo lleva el mantenimiento, que corre **a diario**
junto con la búsqueda de novedades. Era semanal y se cambió porque los enlaces mueren
por tandas —cada día cae la del mismo día del año anterior— y con el repaso los
domingos podían verse portadas rotas hasta seis días.

Como red de seguridad, la página detecta el fallo de carga (`posterCaido`) y pinta un
fondo degradado con un 🎞 en lugar del hueco roto del navegador.

> **No empujes a `main` mientras corre una renovación completa.** Dura media hora, y
> al terminar el robot intenta guardar `raw.jsonl`. Si el repositorio se movió
> mientras tanto, el empujón se rechaza. Pasó de verdad: 5.929 enlaces renovados
> tirados a la basura y el despliegue sin hacer. El flujo ahora **se pone al día y
> reintenta hasta tres veces**, pero aun así es mejor esperar.

---

## El catálogo se mantiene solo

Repositorio: **`jlzmontenegro/cinefilos`** · sitio: <https://jlzmontenegro.github.io/cinefilos>

`.github/workflows/catalogo.yml` hace todo el trabajo en los servidores de GitHub,
con el PC apagado. Un solo flujo con tres modos:

| Cuándo | Modo | Qué hace |
|---|---|---|
| Cada día 06:17 UTC | `novedades` | Busca lo nuevo + repasa portadas → reconstruye → publica |
| Viernes 12:11 UTC | `resumen` | Lo mismo + correo con las novedades de la semana |
| Push a `scraper/**` | `publicar` | Sólo reconstruye y publica |
| A mano | `posters` | Sólo el repaso de portadas |
| A mano | `posters-todas` | El martillo: renueva las 6.000 imágenes, dos pasadas |
| A mano | el que elijas | `gh workflow run "Catálogo" -f modo=…` |

**El repositorio es ahora la fuente de verdad de `raw.jsonl`.** El flujo lo actualiza
y lo devuelve con un commit `[skip ci]` (sin esa marca se mordería la cola). Si
trabajas en local, haz `git pull` antes de tocar los datos, o te quedarás con una
copia vieja.

> **Un trabajo en verde en la lista no significa que fuera bien.** `gh run watch`
> imprime el registro aunque el trabajo acabe fallando. Hay que mirar la
> conclusión: `gh run view <id> --json status,conclusion`. Se dio por buena una
> renovación de media hora leyendo sólo sus cifras; había fallado al guardar y todo
> el trabajo se perdió sin que nadie se enterara.

**El HTML ya no se versiona.** Se genera en cada ejecución desde `raw.jsonl` +
`template.html` y se sube como artefacto de Pages. Por eso el flujo exporta
`DEST=_build`: en la raíz del repositorio `Cinefilos.html` es la página de
redirección de 658 bytes, y construir ahí la aplastaría. `build.mjs` y
`verificar.mjs` respetan `DEST`; si añades otro script que escriba el generado,
hazlo también.

El sitio se monta así: `_site/index.html` ← el catálogo (para que la URL quede
limpia) y `_site/Cinefilos.html` ← la redirección, para no romper enlaces antiguos.

Comprueba siempre el resultado con una petición real: la caché del navegador engaña
mucho, y GitHub Pages sirve con `max-age=600`.

### Avisos (el enganche para n8n)

Si defines el secreto **`WEBHOOK_NOVEDADES`** en el repositorio, cada vez que entren
títulos nuevos el flujo manda un POST con este JSON:

```json
{ "modo": "novedades", "nuevas": 53, "total": 5539,
  "sitio": "https://jlzmontenegro.github.io/cinefilos",
  "titulos": ["Título original (Traducción) - Año - Director", "…"] }
```

Vale para n8n, Discord, Slack o lo que sea. Si el webhook falla no se rompe el
despliegue: el catálogo importa más que el aviso.

### Ojo con el `prevId` guardado

`actualizar.mjs` **no puede** partir del `prevId` que hay en `raw.jsonl`. ok.ru
coloca los mensajes fijados al principio de la cadena, así que ese valor puede
apuntar a una publicación antigua y el recorrido se corta en el primer salto sin
encontrar nada — en silencio, diciendo «0 novedades». Pasó de verdad: estuvo once
días sin detectar 53 publicaciones. Hay que **releer el ancla** para saber cuál es
ahora la siguiente. La versión del navegador siempre lo hizo bien; fue la de Node la
que se quedó atrás. Si tocas una de las dos, mira la otra.

---

## Tocar el clasificador: compara siempre antes y después

`clasificar.mjs` corre sobre 6.200 cabeceras escritas a mano por gente distinta. Un
patrón que parece inofensivo arrastra fichas que no esperas, y el daño no se ve
mirando dos ejemplos. **Antes de dar por bueno un cambio, genera `movies.json` con
el clasificador viejo y con el nuevo y compara campo por campo.** Cuesta un minuto
y ha evitado dos destrozos:

| Intento | Arreglaba | Rompía |
|---|---|---|
| `subs\|parte\|temporada` como nota de versión | 3 | **21** — «El guardia del sub**suelo**», «La **temporada** del diablo», «Un lugar en ninguna **parte**» |
| Añadir `parte N` y `vol N` | 5 | **15** — «Viernes 13 **parte 7**», «Black Angel **vol. 2**» son títulos de verdad |

La lección: los patrones se calibran **con los datos delante**, no de memoria. Las
notas de versión que existen de verdad son ocho y todas hablan de subtítulos; por eso
`NOTA_VERSION` es tan estrecha. Y `temporada` exige número detrás.

### Un género por ficha: gana el que se nombra primero

`generos()` devolvía **todos** los que aparecieran, y 1.666 fichas —el 42 % de las
que tienen género— salían en dos sitios a la vez: la misma película en Terror y en
Thriller, Top Gun en Acción y en Romance. Ahora se queda con uno solo.

El desempate no es arbitrario. Los géneros no se buscan en toda la sinopsis, sino en
la **cláusula definitoria** (`clausulaDefinitoria()`: el «es una película X de Y»
cortado antes de «dirigida por»), y ahí el principal va delante: «de **acción**,
drama y romance» (Top Gun), «***thriller*** policial de cine negro», «**comedia**
dramática y misterio». En español el núcleo va primero y lo de detrás lo matiza. Se
revisaron 45 fichas repartidas por el catálogo y las 45 eligen bien.

Que la búsqueda se limite a esa cláusula es también lo que hace inofensivo el
`includes` sin límites de palabra: en la sinopsis entera `accion` engancharía
«atr**acción**», «re**acción**», y `gore` al director Gre**gore**tti; dentro de la
cláusula esos falsos positivos son **cero**.

Consecuencias medidas, por si extrañan:

- **Psicológico pasa de 197 a 0** y desaparece del filtro. Nunca es el núcleo:
  siempre «thriller psicológico», «terror psicológico». Igual Familiar (5→0) y
  Neorrealismo (1→0). El panel baja de 38 opciones de género a 35.
- Los adjetivos encogen —Romance 212→42, Policíaca 312→92, Histórica 139→44— y los
  núcleos se quedan casi enteros: Drama 1.346→1.053, Documental 445→438.
- Las filas de género de la portada bajan de 31 a 23 en Películas y de 14 a 11 en
  Series. La plaza «Familiar» del héroe sigue teniendo 35 candidatas.
- Lo que se pierde es alcance del filtro: buscar «Terror» ya no saca los 85 títulos
  descritos como «thriller de terror». El buscador sí los encuentra, porque el
  índice `_s` incluye la sinopsis entera.

### Qué trae la serie: `tramo`

Para saber si una serie está completa **no hace falta Internet, y de hecho Internet
no lo resolvería**. El dato difícil no es cuántos episodios tiene la obra: es qué
contiene el vídeo que se subió. Un vídeo de tres horas puede ser cuatro episodios o
un montaje, y eso no se deduce de la duración.

Lo dice el propio origen. ok.ru guarda en `videoName` el tramo subido:

```
2026 Lucky e1-4          2019 Undone s1 e1-8      Unbelievable S01E01
53v3r.s01e01.m720p.Vose  th3-4ct-s1-e1-8-2019     2026 Abandonados e1
```

`tramoVideo()` lo lee (268 de 405 series) y `episodiosTotales()` saca de la sinopsis
cuántos tiene la obra entera —«constó de siete episodios», «una serie de tres
partes»— (264 de 405). Juntos dan el campo **`tramo` = `[temporada, desde, hasta,
total]`**, con `null` en lo que no se sepa. 341 series llevan algo; de **188** se
puede afirmar si están completas, y **180 no lo están**.

Tres cosas que costaron y conviene no deshacer:

- **Sólo se calcula para series.** En una película «partes» habla de otra cosa y
  colaba 77 fichas: «narra tres historias sobre parejas de diferentes **partes** de
  Italia», «la segunda entrega de la serie de películas de dos **partes**».
- **Si `hasta > total`, el total no vale y se tira.** «Cien años de soledad» se
  estrenó en 2 partes y el vídeo trae `e1-4`: enseñar «E1-4 de 2» era peor que
  callarse.
- **Nunca se afirma «incompleta» sin las dos cifras.** Sin total sólo se enseña el
  tramo, que ya habla solo: «E1 de 3» se entiende sin adjetivos.
- Dentro de Series el chip «Serie» se ocultaba por redundante
  (`body.en-series … .chip.serie{display:none}`). Ahora lleva el tramo, que ahí es
  justo lo que interesa: la regla exige `:not(.eps)`.

### Erratas del origen: `correcciones.json`

Cuando la publicación de ok.ru viene mal escrita no hay parseo que la salve — el post
de Spider-Man dice «a través de**ñ** multiverso». Para eso está
`scraper/correcciones.json`: id del post → campos a sustituir, aplicado en
`normalize.mjs` después de clasificar. Si algún día se corrige en origen, se borra la
entrada.

---

## Películas y Series son dos mitades separadas

`esSerie()` parte el catálogo en `PELIS` y `SERIES`, y **no se mezclan en ningún
sitio**: cada una tiene su portada, su héroe, sus filas y sus cifras. El buscador y
los filtros trabajan sólo dentro de la mitad en la que estés (`baseActual()`).

`soloSeries` **no cuenta como filtro** en `hayFiltros()`: es una sección, no un
recorte. Lo que decide entre portada y rejilla es el resto de filtros.

El botón de la barra enseña **a dónde te lleva, no dónde estás**: en Películas dice
«Series» con el televisor, y dentro de Series dice «Películas» con la claqueta. Los
dos iconos van en el HTML y el CSS enseña uno u otro según `.on`.

`construirFilas(base)` y `construirHero(base)` reciben la mitad sobre la que trabajar.
Los umbrales de las filas bajan cuando la base es pequeña: con los del catálogo entero
(8 por género, 25 por década) las 400 series se quedaban casi sin secciones.

### Qué sale en el héroe

Seis plazas, sorteadas **en el navegador de cada visitante** en cada carga — dos
personas ven cosas distintas. Todas exigen portada y sinopsis.

| Plazas | Cajón | De dónde |
|---|---|---|
| 3 | Recién añadidas | De las 40 más recientes con nota ≥ 7 |
| 2 | Joyas | De las 60 mejor valoradas con nota ≥ 8 |
| 1 | Familiar | Infantil, familiar o animación con nota ≥ 6,5 |

El rótulo dice **por qué** está ahí (`heroMotivo`). «Novedad» habla de la película
—estrenada hace dos años o menos—; «Recién añadida» habla del catálogo. Son cosas
distintas y conviene no volver a mezclarlas.

---

## Cómo está montada la página

Un solo archivo, tres `<script>`: el clasificador incrustado, los datos en
`<script id="data" type="application/json">` y la aplicación.

- **Datos compactados por columnas.** `movies.json` no va tal cual: se guardan filas
  de valores con un diccionario para país/género/tipo/idioma y sin lo recalculable
  (url, década, banderas, título). La página lo rehidrata al abrir. Ojo: el centinela
  de «ausente» es `null`, **no `0`** — el índice 0 del diccionario es un valor real.
- **Estado** en el objeto `S`; `App.aplicar()` decide entre portada (héroe + filas) y
  rejilla de resultados. `hayFiltros()` es lo que distingue las dos vistas.
- **Buscador** (`filtrar()` + `relevancia()`): tres índices por película — `_tits`
  (títulos), `_t` (+ dirección) y `_s` (ficha entera). Las palabras de ≤3 letras y las
  de la lista `VACIAS` sólo cuentan en título/dirección; si se buscaran en la sinopsis,
  «pelicula que no existe» devolvía 121 resultados. Al buscar manda la relevancia,
  salvo que se elija un orden concreto en el desplegable.
- **Persistencia**: `localStorage` con prefijo `cm.` (`favs`, `seen`, `delta`,
  `ultimaSync`).
- **Novedades**: se calculan comparando con `cm.seen`, así cada visitante ve las suyas.
- **Seguir viendo** (`cm.viendo`): los últimos 20 títulos que se han puesto a
  reproducir, lo más reciente primero, y su fila va la primera bajo el héroe.
  **No es progreso de reproducción**: el reproductor de ok.ru va en un iframe de otro
  dominio y no deja preguntarle por dónde va, así que no hay minuto guardado ni barra.
  Es «lo que abriste». Se apunta en los tres sitios donde se empieza a ver: el botón
  Reproducir, el autoplay del héroe y el enlace de fuente alternativa.
  Cambiarlo rehace **sólo las filas**, no `App.aplicar()` entero: aplicar() repinta la
  rejilla desde arriba y el usuario pierde el sitio donde iba. Y no rehace el héroe,
  que resortearía las seis destacadas cada vez que le das a reproducir.

### La cita del pie

Donde había una frase fija hay ahora una cita sorteada de `CITAS`, 19 en total y de
dos clases: réplicas de película —atribuidas al título y su año, en cursiva— y frases
de cineastas sobre el oficio, atribuidas a la persona. El tercer elemento de cada
entrada (`peli`) es lo que las distingue.

Se sortea en cada carga, como el héroe, y al pinchar sale otra; nunca repite la que
estaba, que pinchar y que no cambie nada parece que falla. **Sin temporizador a
propósito**: una frase que se mueve sola mientras la lees es exactamente lo que se
quitó de la franja de cifras.

Si se añaden más: cortas y **bien atribuidas**. Cuidado con las que "todo el mundo
sabe" y son falsas — en *Casablanca* nadie dice «tócala otra vez, Sam», y en *El
imperio contraataca* la réplica es «no, yo soy tu padre». Las comillas se dibujan con
`::before`/`::after` para que el texto siga siendo copiable sin ellas.

### La portada se pinta a medida que se baja

Las carátulas de cada fila **no** se construyen al armar la portada: se guardan en
`filaPendiente` y se pintan cuando la fila se acerca (`railObs`, con 700 px de
margen). Las dos primeras se pintan a mano, que esperar al observador deja un
parpadeo.

Medido: 31 filas × 32 carátulas eran **980 tarjetas y 13.721 nodos** de golpe, y
sólo se veían dos filas. Ahora arranca con **52 tarjetas y 3.477 nodos**, y el
`domInteractive` baja de **1.649 ms a 360**.

Ojo con dos cosas: `filaPendiente.clear()` va al **principio** de `construirFilas()`
—al final borraría lo que las llamadas a `fila()` acaban de meter— y `.rail:empty`
necesita `min-height`, que si no el contenido de abajo sube y baja según se pinta y
el scroll da saltos.

### El panel de filtros

Nueve grupos: Género (35 opciones), Década (12), País (75), Años, Valoración, Director
(1.046), Tipo, Idioma y Otros. Con todos desplegados a la vez el panel medía **1.926 px
de alto contra 555 visibles** —tres pantallas y media— y sólo los géneros llenaban lo
que se veía: para llegar a «Década» había que pasar 38 géneros y 75 países.

Ahora cada grupo es un `<details class="fgroup">`. Lo que hay que respetar si se toca:

- **La cabecera plegada dice qué llevas puesto** (`resumenGrupo()` → `[data-resumen]`).
  Sin eso, plegar esconde los filtros activos y no hay forma de saber qué está
  recortando el catálogo sin abrirlos uno a uno. `actualizarContadoresGrupo()` se llama
  desde `App.aplicar()`, así que el resumen se refresca solo.
- **`construirFiltros()` se llama muchas veces** (al quitar un chip, al entrar por un
  enlace de género…). Cierra el panel entero si no se recuerda qué estaba abierto: por
  eso `grupo()` consulta el DOM viejo, que todavía está en pie mientras se arma la
  plantilla. Y un grupo con filtros puestos se abre solo.
- **Sólo Género se abre por defecto**, y además lleva `scroll:true`: plegar no bastaba
  porque abierto seguía tapando el resto. Con tope propio y los demás grupos plegados
  el panel pasó de 1.926 px a 794.
- **En el móvil es hoja inferior**, no cajón lateral: entra desde abajo
  (`translateY`), hasta `88vh`, con tirador y el botón «Ver N títulos» al alcance del
  pulgar. Y `overscroll-behavior:contain` en `.body` y en `.scrolly`, que si no el
  gesto sigue arrastrando la página de detrás al llegar al final de la lista.
- **Abrir el panel congela el fondo** (`body{overflow:hidden}`, igual que la ficha) y
  le pone a `body` la clase `panel-abierto`. Sin lo primero, en el móvil la hoja tapa
  casi toda la pantalla y el dedo seguía arrastrando el catálogo de detrás. Lo segundo
  aparta el aviso de novedades: `#toast` va a `z-index:120` y aterrizaba justo encima
  del botón «Ver N títulos», tapándolo entero en el móvil y a medias en escritorio.
  `closeFilters()` sólo suelta el `overflow` si no hay una ficha abierta.

### Probar otra interfaz sin arriesgar la buena

Si existe `scraper/template-nuevo.html`, `build.mjs` genera además `nuevo.html` y el
flujo lo publica en `…/cinefilos/nuevo.html`, al lado del catálogo. Así se comparan
las dos abiertas en dos pestañas y la que está en uso no se toca hasta decidir.
Cuando la nueva gana, se renombra sobre `template.html` y se borra la variante.

Antes de empezar conviene etiquetar lo que funciona: `git tag interfaz-vN`. Volver
es entonces un `git checkout interfaz-vN`. Etiquetas puestas hasta ahora:

| Etiqueta | Qué era |
|---|---|
| `interfaz-v1` | Franja amarilla de cifras, héroe cada 9 s, marca con punto y contador |
| `interfaz-v2` | Cifras al pie, cartel del héroe, transición al abrir ficha, marca en versales |

### Verlo mientras se trabaja

El panel de vista previa no abre archivos con `file://`. La forma que funciona es
levantar un servidor mínimo sobre una carpeta con el HTML generado y abrir
`http://localhost:…`. Sin eso se diseña a ciegas, y varios de los fallos de esta
página (el margen de las filas, el aviso partido en columna, el recorte del cartel)
sólo aparecieron al medirlos en pantalla.

### Trampas de CSS que ya han mordido

- **`[hidden]` pierde contra los selectores de id.** `#hero` es `display:flex`, así que
  la regla del navegador no lo ocultaba y el héroe seguía viéndose al buscar. Por eso
  existe `[hidden]{display:none!important}`.
- **`overflow-x:hidden` rompe `position:sticky`.** Convierte al elemento en contenedor
  de scroll y la barra superior deja de quedarse fija. Tiene que ser `overflow-x:clip`
  en `html` **y** en `body`; basta con que uno sea `hidden` para romperlo.
- **`scroll-snap` se come el `padding`.** Sin `scroll-padding-inline`, el imán alinea
  la primera carátula con el borde del contenedor y anula el margen: las tarjetas
  quedaban pegadas al canto mientras el título de la fila sí guardaba distancia.
- **`position:fixed` con `left:50%` y sin ancho sólo ocupa media pantalla.** El aviso
  inferior se partía en una columna de seis líneas en el móvil. Necesita
  `width:max-content` y un `max-width`.
- **Acortar animaciones no desactiva las infinitas.** El `*{animation-duration:.01ms}`
  de `prefers-reduced-motion` dejaba la franja de cifras dando vueltas cien mil veces
  por segundo. Hay que añadir `animation-iteration-count:1`.
- **El orden importa cuando la especificidad empata.** `#hero .inner` fija su margen
  con la forma abreviada `padding`; una regla posterior con `padding-right` sólo gana
  si se escribe **después**. Por eso las reglas del cartel viven al final de la hoja.
- **Una rejilla `1fr` no encoge por debajo de su contenido.** La fila de recomendadas
  ensanchaba la ficha y la arrastraba de lado. Hay que usar `minmax(0,1fr)` y
  `min-width:0`.
- **`aspect-ratio` no gana al ancho nativo de una imagen.** Con `width:auto`, el cartel
  del héroe tomaba los 209 px del archivo y `object-fit:cover` recortaba los lados. El
  ancho se calcula desde la altura.
- **`<summary>` es `display:list-item`, no un bloque cualquiera.** Para maquetarlo como
  fila hay que ponerle `display:flex` **y** `list-style:none` (Firefox) **y**
  `::-webkit-details-marker{display:none}` (Safari); con uno solo queda el triangulito.
- **Dos hermanos con `margin-left:auto` se reparten el hueco.** En la cabecera del
  grupo, el resumen y el galón lo llevaban los dos y el galón quedaba a media fila. El
  `auto` va sólo en el primero; el segundo, margen fijo.
- **Al comprobar en el navegador, un clic por llamada.** Encadenar clics en un
  `browser_batch` justo después de abrir el panel los perdía: la animación de entrada
  dura .46 s y los primeros caían en el vacío. Parecía un fallo del código y no lo era.
- **Dentro de `preserve-3d` manda la profundidad, no el `z-index`.** Las láminas del
  vitral están giradas, así que sus planos cruzaban por delante de la principal y,
  siendo translúcidas, la velaban: parecía que la de delante tenía transparencia
  aunque midiera opacidad 1. Se arregla separándolas con `translateZ`, no tocando
  opacidades.
- **Un `height` en porcentaje no resuelve si el padre usa `min-height`.** El vitral se
  quedaba con altura cero y las láminas se amontonaban arriba. Se usa
  `align-self:stretch`.

## Cuando algo «se ve mal» pero mide bien

Varias veces la medición decía que todo estaba correcto y en pantalla se veía mal. En
todos los casos el problema estaba **fuera del elemento que se estaba midiendo**: algo
encima, un ancestro que lo recortaba, o el orden de pintado. Antes de dudar del ojo
del que reporta, mira qué hay alrededor:

```js
document.elementFromPoint(x, y)   // ¿qué se toca de verdad ahí?
getComputedStyle(el)              // opacidad, filtro, mezcla
el.getBoundingClientRect()        // ¿se sale del padre?
```

---

## Convenciones

- Todo en **español**: nombres de funciones, variables, comentarios y textos.
- Los comentarios explican **por qué**, no qué hace la línea. Varios documentan
  trampas concretas ya sufridas; no los borres al refactorizar.
- Sin dependencias externas, sin frameworks, sin paso de compilación. Si algo necesita
  `npm install`, no encaja aquí.
- La página tiene que seguir funcionando abierta con `file://`. Nada que dependa de un
  servidor, y todo fallo de red debe degradar en silencio sin romper el catálogo. Por
  eso el icono va incrustado como data URI y no como archivo suelto.
- **Comprobar antes de cantar victoria.** Lo que más ha costado en este proyecto no
  han sido los cambios, sino los que se dieron por buenos sin mirar: un trabajo que
  falló al guardar, un patrón que rompía quince títulos, unos sellos de fecha que
  mentían. Medir es barato; deshacer no.

## Mapa de archivos

| Archivo | Qué es |
|---|---|
| `Cinefilos.html` | **Generado.** El catálogo. No editar. |
| `scraper/template.html` | **La fuente de la interfaz.** Aquí van los cambios. |
| `scraper/clasificar.mjs` | Parseo y clasificación. Compartido: lo usa Node y se incrusta en la página. |
| `scraper/crawl.mjs` | Recorrido completo del grupo → `raw.jsonl`. Reanudable. |
| `scraper/actualizar.mjs` | Incremental: sólo lo nuevo, y reconstruye. Lo lanza el `.cmd`. |
| `scraper/normalize.mjs` | `raw.jsonl` → `movies.json`. Aquí se aplica el filtro de reproducibles. |
| `scraper/build.mjs` | `template.html` + `movies.json` → `Cinefilos.html`. |
| `scraper/refrescar-posters.mjs` | Renueva los enlaces de imagen caducados. |
| `scraper/resumen.mjs` | Arma el correo de los viernes (`correo.eml` + `resumen.md`). |
| `scraper/correcciones.json` | Erratas del origen corregidas a mano, por id de post. |
| `scraper/verificar.mjs` | Comprobaciones sobre los datos. |
| `raw.jsonl` / `movies.json` | Datos crudos y procesados. No se versionan en el repo publicado. |
