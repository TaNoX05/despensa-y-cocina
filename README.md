# Despensa y cocina

App web para el iPad con dos partes:

- **Despensa por voz.** Pulsas el botón grande, dices «he comprado dos bricks de leche y se ha acabado el chorizo» y lo apunta. Separa nevera, congelador y despensa, avisa de lo que caduca y lo que se acaba pasa a «Para comprar».
- **Recetas paso a paso.** Por categorías, con una ilustración en gouache de cada plato, la nota de cómo queda en el robot, ingredientes que se marcan, y un modo cocina a pantalla completa: el paso actual en grande, el panel con los ajustes de la **Monsieur Cuisine Plus (SilverCrest SKMK 1200 A1)** o, si el paso es fuera del robot, dónde se hace (olla, sartén, horno…), el fuego y cómo saber que está. Temporizadores con alarma, notas por paso y, al terminar, tu valoración y lo que cambiarías, que se guarda en tu historial.

- **Precio por ración** de cada receta, con precios de Mercadona (lo que usas, no el envase entero).
- **Tus fotos y tu nota.** Haz fotos de tus platos con la cámara del iPad: quedan en la galería de cada receta, junto a tu opinión y tu valoración de 0 a 5 estrellas, y se copian en tu GitHub privado.

Funciona sin conexión (menos la voz), la pantalla no se apaga mientras está abierta y se instala en la pantalla de inicio como una app más.

---

## 1. Probarla en el PC

Hace falta Node.js (ya lo tienes). En PowerShell, dentro de esta carpeta:

```powershell
node herramientas/servidor.mjs
```

y abre <http://localhost:5180>. En el PC la voz funciona sin poner ninguna clave en la página: el servidor de pruebas usa la que hay en el fichero `.env` (ese fichero no se sube nunca a GitHub).

---

## 2. Publicarla en GitHub Pages

La app es solo una carpeta de ficheros, así que GitHub la sirve gratis tal cual. Se hace una vez:

1. **Crea el repositorio de la app.** En <https://github.com/new>: nombre `despensa-y-cocina`, **Public** (GitHub Pages gratis solo funciona con repositorios públicos), sin marcar nada más → *Create repository*.
2. **Sube los ficheros.** Lo más cómodo es decírmelo: «publica la app en GitHub». Yo subo la carpeta respetando la lista de lo que no se sube (`.gitignore`). La primera vez se abrirá una ventana para que inicies sesión en GitHub.
   - Si lo haces a mano desde la web (*Add file › Upload files*), **no subas nunca el fichero `.env`** (tiene la clave de OpenRouter) ni la carpeta `herramientas/salida`.
3. **Activa Pages.** En el repositorio: *Settings › Pages › Build and deployment › Source: Deploy from a branch*, rama `main`, carpeta `/ (root)` → *Save*.
4. En uno o dos minutos estará en `https://TU-USUARIO.github.io/despensa-y-cocina/`.

Cada vez que guardes una receta nueva conmigo, la subo y aparece en el iPad sola (la app siempre busca la última versión cuando hay conexión).

---

## 3. Instalarla en el iPad

1. Abre la dirección del paso anterior en **Safari**.
2. Toca **Compartir** (el cuadrado con la flecha hacia arriba) › **Añadir a pantalla de inicio** › *Añadir*.
3. Ábrela desde el icono: se ve a pantalla completa, sin barras, en horizontal y en vertical.

La primera vez que uses la voz, el iPad te pedirá permiso para el micrófono: dile que sí.

---

## 4. Configurarla en el iPad (Ajustes de la app)

### La voz: clave de OpenRouter

La voz usa dos modelos de OpenRouter: **GPT Transcribe** (el sucesor de Whisper) para pasar tu voz a texto y **DeepSeek V4.1 Flash** para entender qué quieres cambiar.

1. Entra en <https://openrouter.ai/keys> y crea una clave nueva solo para el iPad. Ponle un **límite de gasto** (por ejemplo 5 $): así, pase lo que pase, nunca gastará más.
2. En la app: **Ajustes › Inteligencia artificial**, pega la clave y pulsa *Guardar*. Con *Probar y ver gasto* ves cuánto llevas.

La clave se guarda solo en el iPad: no va a GitHub ni a ningún otro sitio.

**Lo que cuesta:** cada frase que dices cuesta menos de una décima de céntimo (unos 0,0008 $ de voz y 0,0002 $ de texto). Cada foto de receta, algo más de 1 céntimo.

### La copia de seguridad: GitHub privado

La despensa y tu historial (veces que has hecho cada receta, valoraciones, notas) se guardan al momento en el iPad y además en un repositorio **privado** de tu GitHub. Así no se pierden y yo puedo leer tus opiniones para mejorar las recetas.

1. Crea el repositorio de datos en <https://github.com/new>: nombre `despensa-datos`, **Private**, y marca *Add a README file* → *Create repository*.
2. Crea un token (una llave solo para ese repositorio) en <https://github.com/settings/personal-access-tokens/new>:
   - *Token name*: `iPad despensa`
   - *Expiration*: 1 año (cuando caduque, se crea otro igual).
   - *Repository access*: **Only select repositories** › `despensa-datos`.
   - *Permissions › Repository permissions › Contents*: **Read and write**.
   - *Generate token* y cópialo (empieza por `github_pat_`).
3. En la app: **Ajustes › Copia en GitHub**: repositorio `TU-USUARIO/despensa-datos`, pega el token y pulsa *Conectar y probar*.

A partir de ahí se sincroniza sola: a los pocos segundos de cada cambio, al abrir la app y cada pocos minutos. Si no hay conexión, lo sube cuando vuelva.

---

## 5. Recetas nuevas

Pídemelas como siempre («guárdala», «añádela a la app»). La skill `monsieur-cuisine-plus` (recetas de robot) y la skill `recetario-app` (cualquier receta) hacen esto:

1. Escriben la receta en `datos/recetas.json` con el formato de la app. Las de robot también se guardan en la pestaña «Recetas robot» de Home Assistant, como hasta ahora.
2. Generan su ilustración con IA: estilo gouache pintado a mano, vista desde arriba sobre papel crema (`openai/gpt-image-2.5-sunburst`, calidad media, ~1,2 céntimos).
3. Comprueban la receta con `node herramientas/validar-recetas.mjs` (que todo ajuste se pueda poner en tu robot).
4. La suben a GitHub, y en el iPad aparece sola.

Para mejorar una receta: «mejora los macarrones con lo que apunté». Leo tu historial del repositorio privado y corrijo lo que falló.

---

## 6. Qué es público y qué no

| Dónde | Qué hay | Quién lo ve |
| --- | --- | --- |
| Repositorio `despensa-y-cocina` (público) | La app, las recetas y sus fotos | Cualquiera con el enlace |
| Repositorio `despensa-datos` (privado) | Tu despensa, historial, valoraciones, notas y tus fotos de los platos (carpeta `fotos/`) | Solo tú (y yo cuando me lo pidas) |
| El iPad | Todo lo anterior, el progreso de lo que estás cocinando y las claves | Solo el iPad |

---

## 7. Si algo no va

- **No suena la alarma.** Sube el volumen del iPad y toca la pantalla una vez al abrir la app (el iPad no deja sonar nada hasta el primer toque). En *Ajustes › Pantalla y sonido › Probar* lo compruebas.
- **La pantalla se apaga.** Hace falta iPadOS 16.4 o posterior; mira en *Ajustes* que «Pantalla siempre encendida» esté activa.
- **El micrófono no funciona.** *Ajustes del iPad › Apps › Safari › Micrófono › Permitir*.
- **Una receta no se actualiza.** Cierra la app del todo y ábrela con conexión.
- **Alarma con la app cerrada.** Los temporizadores siguen contando aunque cierres la app (al volver, suenan si ya ha pasado el tiempo), pero el iPad no deja que una web suene con la app cerrada o la pantalla bloqueada. Por eso la app mantiene la pantalla encendida.

---

## Para programadores (o para Claude)

Página estática, sin dependencias ni compilación: HTML, CSS y JavaScript en módulos.

```
index.html, manifest.webmanifest, sw.js   arranque, app instalable y modo sin conexión
css/app.css                               todo el diseño (claro y oscuro)
js/app.js                                 arranque, pestañas y mini reproductor
js/rutas.js                               navegación por #/… y acciones de los botones
js/almacen.js, js/sincro.js               datos en el iPad y copia en GitHub (API de contenidos)
js/fotos.js, js/vistas/galeria.js         fotos propias: cámara, IndexedDB, galería y visor
js/ia.js, js/conexion.js, js/voz.js       OpenRouter: voz a texto, interpretar la despensa, descontar recetas
js/despensa.js                            lógica de la despensa (aplicar y deshacer cambios, cruzar con recetas)
js/recetas.js, js/cocina.js               datos de recetas, progreso, temporizadores y alarma
js/vistas/*.js                            cada pantalla
datos/recetas.json                        las recetas (formato en la skill recetario-app)
img/recetas/                              fotos generadas
herramientas/                             servidor de pruebas, fotos, iconos, validador y pruebas de la IA
```

Herramientas (todas con Node):

```powershell
node herramientas/servidor.mjs                 # app en http://localhost:5180 con puente a OpenRouter y GitHub falso
node herramientas/validar-recetas.mjs          # comprueba datos/recetas.json
node herramientas/precios.mjs                  # recalcula el precio de las recetas con el catálogo de Mercadona (MERCADONA_DIR en .env)
node herramientas/generar-fotos.mjs <id>       # foto de una receta (sin id: las que no tienen)
node herramientas/probar-ia.mjs "frase"        # prueba cómo entiende la IA una frase de la despensa
node herramientas/generar-iconos.mjs           # iconos desde herramientas/icono.svg
```
