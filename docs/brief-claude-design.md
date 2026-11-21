# Encargo de diseño: «Despensa y cocina», app para iPad

Hola. Quiero que diseñes **cuatro direcciones visuales distintas** para una app que ya funciona, para elegir la que más me convenza. No hace falta que respetes el diseño actual: úsalo solo para entender qué hay en cada pantalla.

## Qué es

Una app web para el **iPad**, instalada en la pantalla de inicio (a pantalla completa, sin barras de Safari), que uso **en la cocina mientras cocino**. Tiene dos partes:

1. **Despensa por voz.** Pulso un botón grande y digo «he comprado dos bricks de leche y se ha acabado el chorizo». La app lo apunta sola y me enseña qué ha cambiado, con opción de deshacer. Los productos se separan en nevera, congelador y despensa; lo que se acaba pasa a una lista «Para comprar»; avisa de lo que caduca pronto.
2. **Recetas paso a paso.** Recetas por categorías, muchas para mi robot de cocina (una **Monsieur Cuisine Plus** de Lidl) y otras sin robot. Al cocinar, la app enseña el paso actual en grande, con los ajustes exactos que tengo que poner en el robot o, si el paso es fuera del robot, dónde se hace (olla, sartén, horno, freidora de aire, nevera…), con qué fuego y cómo saber que está hecho. Tiene temporizadores con alarma, notas por paso y, al terminar, una valoración de cómo ha salido que se guarda en un historial.

## Cómo se usa (esto manda sobre la estética)

- iPad apoyado en la encimera, a **un metro de distancia**. Tiene que leerse de lejos de un vistazo.
- **Manos mojadas o manchadas**: botones grandes (mínimo 56 px, mejor 64 px o más), separados, nada que exija precisión ni gestos finos. Pasar de paso también deslizando el dedo.
- Se usa en **horizontal (1180 × 820)** y en **vertical (820 × 1180)**. En horizontal, el modo cocina va a dos columnas: lista de pasos e ingredientes a un lado y el paso actual en grande al otro.
- **Modo claro y oscuro** (la cocina de noche).
- La pantalla está siempre encendida mientras se usa: que no canse la vista ni deslumbre.
- Transiciones suaves y sensación muy fluida; nada de animaciones largas que hagan esperar.

## Pantallas, por orden de importancia

### 1. Modo cocina (la más importante)
A pantalla completa, sin barra de pestañas.
- **Barra superior**: salir, nombre de la receta, «Paso 2 de 10 · 10 %», barra de progreso, los temporizadores de otros pasos que siguen corriendo (en chips) y un menú.
- **Lista lateral** (en horizontal) con pestañas *Pasos / Ingredientes / Antes de empezar*: cada paso con su número, título, un resumen de ajustes y marca de hecho; el actual resaltado.
- **El paso actual**, en grande:
  - una etiqueta de dónde se hace («En el robot», «En la sartén · fuego medio-fuerte», «En el horno», «En la nevera»…);
  - el título (corto) y el texto (una o dos frases, muy legible);
  - **Panel del robot** (si es un paso de robot): tiene que recordar a la pantalla de la máquina. Muestra *Tiempo* (10 s, 10:00), *Temperatura* (120 °C o «sin calor»), *Velocidad* (1 a 10 o TURBO, con un indicador de nivel), *Giro* (normal o inverso), el *programa* si lo hay (Sofreír / Vapor / Amasar, con el nombre del botón de la máquina: ROAST / STEAMER / KNEAD), el accesorio (cuchillas, mariposa, cestillo, vaporera) y el vaso medidor (puesto / quitado / cestillo encima, estos dos últimos como aviso);
  - **Panel de fuera del robot** (si no): utensilio con su icono, fuego (apagado, suave, medio, medio-fuerte, fuerte, con un indicador visual tipo llamas), temperatura (del aceite, del horno o de la freidora), modo del horno (por ejemplo «Grill fuerte») y tiempo;
  - **Temporizador**: cuenta atrás muy grande con anillo de progreso, botón grande de empezar/pausa, −30 s, +30 s y reiniciar; en algunos pasos, ±1 min (el tiempo depende del paquete) o «Otra tanda · Tanda 2» (fritos por tandas);
  - **«Necesitas»**: los ingredientes de ese paso como casillas que se marcan;
  - **«Sabrás que está cuando…»** (cómo se ve que está hecho), un **aviso** destacado y **mi nota** del paso si la he escrito;
  - abajo, siempre visibles: **Anterior**, **Nota** y **Siguiente** (o **Terminar** en el último paso).
- **Alarma** cuando acaba un temporizador: a pantalla completa, imposible de no ver, con botón enorme de *Parar* y *+1 min*.
- **Recordatorio suave** a mitad de paso («Pon a hervir el agua de la pasta: 4 litros con sal»), que no tape el paso.

### 2. Despensa
- Título, resumen («9 productos en casa · 2 para comprar · 1 caduca pronto»), buscador y filtros (*Todo, Nevera, Congelador, Despensa, Para comprar*, con contadores).
- Productos en rejilla por secciones: emoji del producto, nombre, cantidad («2 bricks», «500 g», «6 ud»), botones + y −, aviso de caducidad. Los agotados, apagados.
- **Botón de voz grande y protagonista**, siempre a mano abajo, con dos secundarios: escribir y añadir a mano.
- **Ventana de voz** en tres estados: *Te escucho…* (con ondas que reaccionan a la voz y un contador), *Entendiendo…* (con lo que ha entendido escrito) y *Hecho* (la frase de confirmación y la lista de cambios: + añadido, − gastado, 0 se acabó, ✕ quitado, → movido, cada uno con deshacer; botones *Deshacer todo*, *Decir más*, *Listo*).

### 3. Listado de recetas
- Título, buscador y filtros por categoría (*Pasta, Arroces, Aperitivos y picoteo*…).
- Arriba, si estoy cocinando algo: tarjeta **«Cocinando ahora»** con foto, paso actual, porcentaje y temporizador en marcha, y botón *Continuar*.
- Tarjetas con **foto** (formato 3:2), si es de robot o sin robot, la **nota del robot** (1 a 10, de cómo queda frente a hacerlo de forma normal), tiempo, raciones, categoría, cuántas veces la he hecho con mi valoración en estrellas y «Tienes 9 de 14 ingredientes».
- Cuando cocino algo y estoy en otra pantalla: un **mini reproductor** abajo (receta, paso y temporizador) para volver.

### 4. Ficha de una receta
- Foto grande con título, subtítulo y chips (robot, tiempo, raciones, categoría, accesorios).
- **Ingredientes** marcables, con una etiqueta «En casa» o «Se acabó» según mi despensa; **Antes de empezar** (lo que hay que dejar preparado).
- **La nota del robot** en grande, con el desglose en una frase cada uno (textura, sabor, punto, comodidad) y «Sube a 9/10 si…».
- Los **pasos** resumidos, los **trucos** y **mi historial** (fecha, estrellas, etiquetas, cómo salió, qué cambiaría).
- Botón grande fijo abajo: *Empezar a cocinar* o *Continuar · paso 4 · 35 %*.

### 5. Valoración al terminar
Estrellas grandes (1 a 5), etiquetas rápidas (*Perfecta, La repetiría, Sosa, Salada, Seca, Pasada de punto, Mucho trabajo, Ajustaría tiempos…*), «¿Cómo ha salido?» y «¿Qué cambiarías la próxima vez?» con botón de dictado por voz, y las notas que escribí en los pasos.

### 6. Ajustes (secundaria)
Conexión de la IA, copia en la nube, pantalla siempre encendida, tema claro/oscuro, probar la alarma y copias de seguridad.

## Contenido real para los diseños

- **Macarrones con chorizo** (pasta, robot, nota 8/10, 55 min, 3 raciones generosas). Paso 2 «Sofreír»: *Pesa el aceite directamente en el vaso y añade la cayena entera. Sofríe sin el vaso medidor.* Programa Sofreír · 10:00 · 120 °C · velocidad 1 · sin vaso medidor. Paso 6 «Cocer los macarrones»: en la olla, fuego fuerte, 9 min (ajustable), «Sabrás que está cuando al morderlos aún resisten un poco en el centro».
- **Risotto de pollo y champiñones** (arroces, robot, nota 7/10, 40 min). Paso 6 «Cocer con el caldo»: 15:00 · 100 °C · velocidad 1 · giro inverso · vaso medidor puesto.
- **Arancini** (aperitivos, sin robot, 45 min, 20-24 bolitas). Paso 5 «Freír en sartén»: fuego medio-fuerte, aceite a 175 °C, 3 min por tanda.
- **Despensa**: Huevos 6 ud (nevera), Champiñones 500 g (nevera), Pechuga de pollo 2 ud (congelador), Leche 2 bricks, Tomate triturado 2 botes, Arroz arborio 1 kg (despensa), Parmesano (se acabó → para comprar), Yogur natural 6 ud (caduca mañana).

## Lo que te pido

**Cuatro direcciones claramente diferentes entre sí**. Algunas ideas, por si te sirven (puedes proponer otras):
1. Cálida y editorial, como una revista de cocina (fotos protagonistas, tipografía con carácter).
2. Minimalista y nativa de iPad, como una app de Apple.
3. Oscura y técnica, como la pantalla de un electrodoméstico moderno: mucho contraste, números enormes.
4. Fresca y con color, más juguetona, con ilustración o iconografía propia.

Para **cada dirección**:
- **Modo cocina en horizontal** con un paso de robot (el «Sofreír» de arriba) y otro fuera del robot (el «Freír en sartén»), uno de ellos en modo oscuro;
- **Modo cocina en vertical** (820 × 1180);
- **Despensa** con el botón de voz y la **ventana de voz en estado «Hecho»**;
- **Listado de recetas** con la tarjeta «Cocinando ahora»;
- su **paleta** (claro y oscuro), **tipografías** y los componentes clave (botones, tarjetas, panel del robot, temporizador, chips).

Detalles técnicos para que sea fácil de construir luego: se hace en HTML, CSS y JavaScript sin librerías; mejor tipografías del sistema del iPad (SF Pro, SF Pro Rounded, New York) o fuentes que se puedan incluir en la app; iconos de línea sencillos; emojis para los productos; las imágenes de las recetas son ilustraciones en gouache generadas con IA (pintadas a mano, vista desde arriba, sobre papel crema liso), en horizontal 3:2: el diseño tiene que lucirlas.

Gracias. Lo importante: que en la cocina, a un metro y con prisa, se entienda todo a la primera, y que además sea bonita.
