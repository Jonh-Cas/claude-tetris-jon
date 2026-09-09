# Tetris

Implementación del clásico **Tetris** en JavaScript vanilla, usando HTML5 Canvas y CSS. Sin dependencias externas, sin frameworks, sin proceso de build: solo abrir y jugar.

![Tech](https://img.shields.io/badge/HTML5-Canvas-orange)
![Tech](https://img.shields.io/badge/CSS3-blueviolet)
![Tech](https://img.shields.io/badge/JavaScript-Vanilla-yellow)

---

## Tabla de contenidos

- [Tetris](#tetris)
  - [Tabla de contenidos](#tabla-de-contenidos)
  - [Qué hace el proyecto](#qué-hace-el-proyecto)
  - [Cómo ejecutar el juego](#cómo-ejecutar-el-juego)
    - [Opción 1: abrir el archivo directamente](#opción-1-abrir-el-archivo-directamente)
    - [Opción 2: servidor local (recomendado)](#opción-2-servidor-local-recomendado)
  - [Controles](#controles)
  - [Cómo funciona](#cómo-funciona)
    - [1. `index.html`](#1-indexhtml)
    - [2. `style.css`](#2-stylecss)
    - [3. `game.js`](#3-gamejs)
    - [Flujo del juego](#flujo-del-juego)
  - [Tecnologías](#tecnologías)
  - [Estructura del proyecto](#estructura-del-proyecto)
  - [Personalización](#personalización)
  - [Licencia](#licencia)

---

## Qué hace el proyecto

Es una versión jugable del Tetris clásico con todas las mecánicas que esperarías:

- Tablero de **10 × 20** celdas.
- Las **7 piezas estándar** (I, O, T, S, Z, J, L) con colores diferenciados.
- **Pieza tuerca** (N): una pieza de reto de 3 × 3 con el centro hueco. Al fijarse deja un agujero interior que ninguna pieza puede rellenar cayendo desde arriba, así que la fila permanece incompleta hasta que otra pieza entre lateralmente en ese hueco.
- **Rotación** con _wall kicks_ básicos (pequeños desplazamientos para que la pieza pueda rotar pegada a la pared).
- **Soft drop** (bajada acelerada) y **hard drop** (caída instantánea).
- **Pieza fantasma** (_ghost piece_): muestra dónde aterrizará la pieza actual.
- **Vista previa** de la siguiente pieza.
- **Sistema de puntuación** clásico de Tetris (100 / 300 / 500 / 800 multiplicado por nivel).
- **Niveles** que aumentan cada 10 líneas y aceleran la caída.
- **Pantalla de inicio** con la tabla de records, selector de nivel inicial y botón de juego.
- **Menú de pausa** con opciones reales: reanudar, reiniciar sin recargar, ver los controles y elegir el nivel inicial de la próxima partida. Mientras el menú está abierto las teclas de juego quedan bloqueadas.
- **Nivel inicial configurable** (1–15) que se recuerda entre partidas.
- **Contador de combo**: limpiezas de línea consecutivas, con el mejor combo guardado como record.
- **Tabla de records local** (top 5 con nombre) guardada en `localStorage`, más el mejor combo y el máximo de líneas. Se muestra en la pantalla de inicio y al terminar la partida, resaltando la entrada recién conseguida, y se puede resetear.
- **Cuatro skins visuales** (Retro, Neon, Pastel y Pixel art) que cambian paleta y forma de dibujar los bloques al vuelo, sin recargar.
- **Tema claro / oscuro**.
- **Game Over** con opción de guardar la puntuación y reiniciar.

---

## Cómo ejecutar el juego

No hay nada que instalar ni compilar. Tienes dos opciones:

### Opción 1: abrir el archivo directamente

```bash
open index.html        # macOS
xdg-open index.html    # Linux
start index.html       # Windows
```

### Opción 2: servidor local (recomendado)

Cualquier servidor estático funciona. Algunos ejemplos:

```bash
# Con Python 3
python3 -m http.server 8000

# Con Node.js (npx)
npx serve .

# Con PHP
php -S localhost:8000
```

Después abre `http://localhost:8000` en el navegador.

---

## Controles

| Tecla     | Acción                            |
| --------- | --------------------------------- |
| `←` / `→` | Mover la pieza horizontalmente    |
| `↑` o `X` | Rotar la pieza en sentido horario |
| `↓`       | Soft drop (bajar más rápido)      |
| `Espacio` | Hard drop (caída instantánea)     |
| `P` o `Esc` | Abrir / cerrar el menú de pausa  |

---

## Cómo funciona

El juego se compone de tres archivos que cooperan:

### 1. `index.html`

Define la estructura visual:

- Un `<canvas id="board">` de **300 × 600** píxeles donde se renderiza el tablero.
- Un panel lateral con `SCORE`, `LINES`, `LEVEL`, `COMBO`, vista de la siguiente pieza y la lista de controles.
- Una barra superior con el selector de skin y el interruptor de tema claro/oscuro.
- Un overlay con cuatro paneles intercambiables: inicio, menú de pausa, lista de controles y fin de partida.

### 2. `style.css`

Aporta el aspecto visual con estética _dark / retro arcade_: fondo oscuro, tipografía monoespaciada para los marcadores y _backdrop blur_ en los overlays.

### 3. `game.js`

Contiene toda la lógica del juego. A grandes rasgos:

- **Modelo del tablero**: una matriz `ROWS × COLS` donde cada celda guarda `0` (vacía) o un índice de color (1–8) que identifica la pieza.
- **Piezas**: definidas como matrices cuadradas. Para rotar se calcula la transposición + reverso de filas (`rotateCW`).
- **Detección de colisiones** (`collide`): comprueba que ninguna celda de la pieza salga del tablero ni se solape con bloques ya fijados.
- **Wall kicks** (`tryRotate`): si la rotación choca, intenta desplazar la pieza ±1 y ±2 columnas antes de descartar el giro.
- **Game loop** (`loop`): basado en `requestAnimationFrame`, acumula el tiempo transcurrido y baja la pieza una fila cuando se supera `dropInterval`.
- **Limpieza de líneas** (`clearLines`): recorre el tablero de abajo hacia arriba; cada fila completa se elimina y se inserta una vacía en la cima.
- **Puntuación**: usa la tabla clásica `[0, 100, 300, 500, 800]` multiplicada por el nivel actual; el hard drop suma 2 puntos por celda recorrida y el soft drop 1 punto por fila.
- **Nivel y velocidad**: el nivel sube cada 10 líneas; la velocidad de caída se calcula como `max(100, 1000 − (level − 1) × 90)` milisegundos.
- **Ghost piece** (`ghostY`): proyecta la posición final de la pieza actual hacia abajo y la dibuja con `globalAlpha = 0.2`.
- **Máquina de estados** (`state`): `'start'`, `'playing'`, `'paused'`, `'controls'` o `'gameover'`. El bucle solo se reagenda en `'playing'` y el manejador de teclado ignora las teclas de juego fuera de ese estado, así que ningún panel abierto puede recibir movimientos accidentales. `showPanel()` decide qué panel del overlay se ve.
- **Skins** (`SKINS`): cada skin aporta una paleta de 9 entradas (el índice 0 es `null`) y su propia función `draw`. `drawBlock` delega en la skin activa, de modo que tablero, ghost y vista previa cambian a la vez. La skin neon usa `shadowBlur` y lo restaura a `0` al terminar cada bloque.
- **Records** (`loadRecords` / `saveRecords`): un único objeto JSON en `localStorage` con `scores` (top 5), `bestCombo` y `maxLines`. Todos los accesos van envueltos en `try/catch` para que el juego siga funcionando si el almacenamiento no está disponible.
- **Persistencia**: claves `tetris-theme`, `tetris-skin`, `tetris-start-level` y `tetris-records`.

### Flujo del juego

```
init()
  ├─ carga tema, skin y nivel inicial desde localStorage
  ├─ createBoard()                  → matriz vacía
  └─ goToStart()                    → state = 'start', muestra la pantalla de inicio

startGame()   (botón JUGAR, Reiniciar)
  ├─ resetea board, score, lines, combo y level = startLevel
  ├─ next = randomPiece()
  ├─ spawn()                        → mueve next a current y genera nueva next
  └─ requestAnimationFrame(loop)
        ↓
   loop(timestamp)
     ├─ acumula dt
     ├─ si dt ≥ dropInterval → baja la pieza o llama a lockPiece()
     ├─ draw()  (grid + tablero + ghost + pieza actual)
     └─ requestAnimationFrame(loop)   solo si state === 'playing'

   keydown → mover / rotar / soft-drop / hard-drop   solo en 'playing'
   P o Esc → pauseGame() / resumeGame()
```

Cuando una pieza recién generada ya colisiona al aparecer (`spawn`), se dispara `endGame()`: se actualizan el mejor combo y el máximo de líneas, y se muestra el panel de **Game Over** con el campo de nombre si la puntuación entra en el top 5.

---

## Tecnologías

- **HTML5** — marcado y dos elementos `<canvas>` (tablero y vista previa).
- **CSS3** — _flexbox_, variables de color, `backdrop-filter` y `box-shadow`.
- **JavaScript (ES6+) vanilla** — `const`/`let`, _arrow functions_, _spread operator_, `Array.from`, _template literals_…
- **Canvas 2D API** — para todo el renderizado del juego.
- **`requestAnimationFrame`** — para el bucle de juego sincronizado con el navegador.

**Sin dependencias.** No hay `package.json`, ni bundler, ni transpilador.

---

## Estructura del proyecto

```
03-tetris/
├── index.html      # Estructura del DOM y canvas
├── style.css       # Estilos del juego (temas claro/oscuro y skins)
├── game.js         # Toda la lógica del Tetris (~570 líneas)
└── README.md
```

---

## Personalización

Algunos parámetros fáciles de tunear en `game.js`:

| Constante      | Significado                              | Por defecto           |
| -------------- | ---------------------------------------- | --------------------- |
| `COLS`         | Columnas del tablero                     | `10`                  |
| `ROWS`         | Filas del tablero                        | `20`                  |
| `BLOCK`        | Tamaño en píxeles de cada celda          | `30`                  |
| `SKINS`        | Skins visuales: paleta y función de dibujo | 4 skins             |
| `MAX_LEVEL_OPTION` | Nivel inicial máximo seleccionable   | `15`                  |
| `MAX_RECORDS`  | Entradas guardadas en la tabla de records | `5`                  |
| `LINE_SCORES`  | Puntos por 1, 2, 3 o 4 líneas eliminadas | `[0,100,300,500,800]` |
| `dropInterval` | Velocidad inicial de caída en ms         | `1000`                |

> Si cambias `COLS`, `ROWS` o `BLOCK`, recuerda ajustar también `width` y `height` del `<canvas id="board">` en `index.html` para que coincida (`COLS × BLOCK` × `ROWS × BLOCK`).

---

## Licencia

Proyecto de uso libre con fines educativos y de práctica.
