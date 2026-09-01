# Cinefilos — catálogo

Catálogo navegable de todo lo publicado en [ok.ru/cinefiliamalversa](https://ok.ru/cinefiliamalversa),
en un único archivo HTML que funciona haciendo doble clic, sin servidor ni instalación.

También está publicado en **<https://jlzmontenegro.github.io/cinefilos>**.

## Archivos

| Archivo | Para qué sirve |
|---|---|
| **Cinefilos.html** | El catálogo. Ábrelo con doble clic. |
| **Actualizar catálogo.cmd** | Busca publicaciones nuevas y regenera el HTML. |
| **Refrescar imágenes.cmd** | Renueva los pósters que hayan dejado de verse. Una vez al año basta. |
| `scraper/` | Los scripts que extraen y procesan los datos. |

## Qué entra en el catálogo

Sólo las publicaciones que se pueden ver: con **reproducción directa** o, al menos,
con una **fuente alternativa**. Las fichas sin ninguna de las dos no aparecen, porque
no llevan a ninguna parte. De unas 6.270 publicaciones del grupo, quedan **5.557
títulos**: 5.124 con reproducción directa y 433 sólo con fuente alternativa. Las 703
restantes se quedan fuera por no tener dónde verlas.

## Cómo se actualiza

**El sitio publicado se actualiza solo.** Cada día busca publicaciones nuevas en
ok.ru, repasa las portadas y renueva las que estén a punto de caducar, y se republica
sin que tengas que hacer nada, aunque tengas el ordenador apagado. Los viernes manda
además un correo con las novedades de la semana. Si quieres lanzarlo a mano, está en
la pestaña *Actions* del repositorio, botón **Run workflow**.

Para la copia que tienes en el disco hay dos caminos. Los dos suben por la cadena de
publicaciones del grupo desde la más reciente que ya se tenía y recogen sólo lo nuevo.

**1. Desde el propio catálogo (botón ⟳).** No necesita instalar nada. También lo
intenta solo al abrir, como mucho una vez cada 6 horas y en silencio. Las novedades
se guardan en el navegador y se funden con los datos del archivo.

Con una limitación que conviene conocer: un archivo abierto con `file://` no puede
leer ok.ru directamente — el navegador lo impide por CORS y ok.ru no envía las
cabeceras que lo permitirían. La única forma sin instalar nada es apoyarse en un
servicio público que reenvía la página añadiendo esas cabeceras. Es gratuito y falla
aproximadamente **1 de cada 3 veces**, así que cada descarga se reintenta hasta 4
veces y el recorrido se puede reanudar. Si falla, no pasa nada: el catálogo sigue
completo y se vuelve a intentar más tarde. Si ese servicio desaparece algún día, este
botón dejará de funcionar y quedará el camino 2.

Está limitado a 60 títulos nuevos por pasada; si el grupo ha publicado más desde la
última vez, avisa y conviene usar el `.cmd`.

**2. Con `Actualizar catálogo.cmd`.** Requiere [Node.js](https://nodejs.org), va
directo a ok.ru sin intermediarios y es mucho más rápido y fiable. Es el camino
recomendado si han pasado semanas o si el botón falla.

Los títulos que no estaban la última vez que abriste el catálogo aparecen marcados
con la etiqueta verde **NUEVO**, se agrupan en la fila *Novedades* y se anuncian con
un aviso al abrir. Eso se calcula en tu navegador comparando con lo que ya habías
visto, así que cada persona ve sus propias novedades.

## Lo tuyo se queda en tu navegador

Nada de esto viaja a ningún servidor: vive en el navegador con el que abras el
catálogo, y por eso no se comparte entre tu móvil y tu ordenador.

- **Seguir viendo** — la primera fila de la portada recuerda los últimos 20 títulos
  que pusiste a reproducir, lo más reciente primero, y tiene un botón *Vaciar*.
  Recuerda **qué** empezaste, no por qué minuto ibas: el reproductor es de ok.ru y no
  deja consultar el punto de reproducción.
- **Mi lista** — lo que marques con el corazón.
- **Novedades** — lo que ha entrado desde tu última visita.
- **La cita del pie** — cambia en cada visita, y recuerda las doce últimas para no
  repetirte ninguna. Si te apetece otra, pincha en ella.

## Series: qué trae cada publicación

Casi ninguna serie está entera. Cuando se puede saber, la ficha lo dice sin rodeos:
**T1 · E1-8 de 8 · completa**, o **E1 de 3 · incompleta**. La misma etiqueta aparece
en la esquina de la carátula, en ámbar cuando falta material.

No es una estimación: el tramo sale del nombre del vídeo que subió el grupo
(*«2019 Undone s1 e1-8»*) y el total, de la propia sinopsis (*«constó de siete
episodios»*). Cuando alguno de los dos no consta, se enseña sólo lo que se sabe y no
se afirma nada más. De las 405 series, 341 llevan algún dato y de 188 se puede
afirmar si están completas — y sólo 8 lo están.

## Qué se puede buscar y filtrar

- **Buscador libre**: título (original y traducido), director, país, género, año y texto
  de la sinopsis. Ignora tildes y mayúsculas. Los resultados salen ordenados por
  relevancia: primero las coincidencias de título, luego las de dirección y al final
  las que sólo aparecen en la sinopsis.
- Las palabras de tres letras o menos y las que no distinguen nada (*de, la, que, no,
  con…*) sólo cuentan si están en el título o en la dirección. Si se buscaran también
  en las sinopsis, cualquier frase normal devolvería medio catálogo.
- **Filtros combinables**: género, país, década, rango de años, director, tipo de obra, idioma/subtítulos y valoración IMDb mínima.
- **Interruptores**: sólo novedades, sólo mi lista, sólo con reproducción directa
  (deja fuera las que únicamente tienen fuente alternativa).
- **Orden**: relevancia o recién añadidas, año, valoración, título o duración.
- Todo lo que aparece en la ficha de detalle (director, género, país, año) es clicable y filtra el catálogo.

Atajos: `/` enfoca el buscador, `Esc` cierra la ficha o el panel de filtros.

## De dónde sale cada dato

Cada publicación del grupo trae el título con el formato
`Título original (Traducción) - Año - Director (versión)` y una sinopsis. De ahí sale:

- **Título, año, director, versión** → de la línea del título.
- **Sinopsis, valoración IMDb y FilmAffinity, enlace al vídeo, duración, póster y fecha** → del cuerpo de la publicación y sus metadatos.
- **País y género** → deducidos de la frase que define la obra en la sinopsis
  («*es una película dramática hispano-belga de 2025…*»). No son campos explícitos
  del post, así que hay títulos sin clasificar: los filtros los omiten en lugar de
  adivinar. Ese es el único dato inferido; el resto es literal.
- **Un solo género por título.** Esa misma frase enumera el principal primero («*de
  acción, drama y romance*»), y es el que se guarda. Antes se guardaban todos y la
  misma película salía en dos sitios a la vez. El buscador sí mira la sinopsis
  entera, así que sigue encontrando lo que se describe como «thriller de terror».

## Reproducción

El botón *Reproducir* incrusta el reproductor de ok.ru del propio post. Cuando la
publicación incluye además un enlace externo, aparece como *Fuente alternativa*.

## Si algún póster deja de verse

ok.ru sirve las imágenes con un enlace que **caduca al cabo de un año**: pasado ese
plazo la ficha se queda sin portada. La imagen sigue estando en la publicación, lo
único caducado es el enlace.

**En el sitio publicado esto ya no debería pasar**: el repaso diario renueva las
portadas *antes* de que caduquen, así que no llegan a romperse.

Si te ocurre en tu copia del disco, doble clic en **`Refrescar imágenes.cmd`**:
vuelve a pedir cada publicación y guarda los enlaces nuevos. Tarda unos 25 minutos —
son más de 6.000 publicaciones. Si al terminar aún se ve alguna portada en blanco,
vuelve a pasarlo: algunas peticiones se pierden por la carga y a la segunda entran.

En cualquier caso, las fichas afectadas se ven con un fondo degradado en vez de con
la imagen rota, así que nunca queda un hueco feo.
