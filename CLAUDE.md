# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project

Vanilla-JS Tetris. No build step, no package manager, no tests, no dependencies. Three source files: `index.html`, `style.css`, `game.js`.

## Running

```bash
open index.html            # macOS; file:// works, no server required
python3 -m http.server 8000  # or any static server
```

There is no lint, build, or test command. Verification is manual: open the page and play.

## Architecture

All game logic lives in `game.js` as module-level functions over shared mutable globals (`board`, `current`, `next`, `score`, `lines`, `level`, `paused`, `gameOver`, `dropAccum`, `dropInterval`, `animId`, `currentSkin`). There are no classes and no modules — the script is loaded with a plain `<script src>` and runs `init()` at the bottom.

Key coupling points to keep in mind when editing:

- **Board model**: `ROWS × COLS` array of ints. `0` is empty; `1`–`7` are simultaneously the piece type, the index into `COLORS`, and the value stored in every filled cell of `PIECES[type]`. Changing a piece's index means changing its color and its shape matrix cells together.
- **Rotation**: shapes are square matrices rotated by `rotateCW` (transpose + reverse). Wall kicks in `tryRotate` are a simple `[0,-1,1,-2,2]` column-offset scan, not SRS.
- **Loop**: `loop(ts)` is the single `requestAnimationFrame` driver. It accumulates `dt` into `dropAccum` and drops one row per `dropInterval`. Pause cancels the frame and `togglePause` must reset `lastTime` before restarting, or the first frame after resume sees a huge `dt`.
- **Lock cycle**: `lockPiece()` → `merge()` → `clearLines()` → `spawn()`. `spawn()` promotes `next` to `current` and calls `endGame()` if the fresh piece already collides.
- **Rendering**: everything draws every frame in `draw()` — grid, board, ghost (via `ghostY()`, alpha `0.2`), then the current piece. `drawNext()` is called only from `spawn()`, not per frame.
- **HUD**: `updateHUD()` writes to the DOM. It is called from `clearLines`, `softDrop`, `init`, and the end of the keydown handler — score changes made elsewhere (e.g. `hardDrop`) rely on that keydown call to become visible.

### Skins

`SKINS` is an object keyed `retro`, `neon`, `pastel`, `pixel`. Each entry has a `colors` palette (9 entries, `null` at index 0 — same indexing rule as `COLORS`/`PIECES`) and a `draw(context, x, y, colorIndex, size, alpha)` function. `drawBlock()` (the shared entry point used by `draw()` and `drawNext()`) no longer paints directly: it wraps `SKINS[currentSkin].draw(...)` in `context.save()`/`context.restore()`. `currentSkin` is a module-level global, changed only through `applySkin(skin)`.

- **Neon** sets `shadowBlur`/`shadowColor` for the glow and resets `shadowBlur = 0` itself right after filling the block — otherwise the glow leaks into `drawGrid()`'s lines and into the NEXT canvas, which share the same 2D context state model.
- **Pastel** clips each block to a rounded rect via `context.roundRect` when available, with a manual `arcTo` fallback (`roundedRectPath()`) for engines that lack it.
- **Pixel** draws the flat color then overlays a small alternating light/dark grid pattern on top to simulate a pixel-art texture.
- **Retro** reproduces the original flat-color rendering and reuses the `COLORS` palette.
- Per-skin backgrounds live in `style.css` as `body.skin-retro`/`skin-neon`/`skin-pastel`/`skin-pixel` rules that redefine `--board-bg`, `--grid-line` and `--block-highlight`; `body.light.skin-*` variants (declared after the base skin rules, so they win on equal specificity) supply lighter values for retro/pastel/pixel under the light theme. Neon has no light variant — it stays black regardless of `body.light`, by design. `updateThemeColors()` re-reads these variables via `getComputedStyle` and is called from `applySkin()` as well as `applyTheme()`, since both classes live on `<body>` and must not clobber each other (they toggle disjoint class names via `classList`, never `body.className`).
- **Change without reloading**: `applySkin(skin)` sets `currentSkin`, swaps the `body.skin-*` class, syncs the `#skin-select` value, and calls `updateThemeColors()`. `changeSkin()` (the `change` handler on `#skin-select`) additionally persists the choice and calls `draw()` + `drawNext()` explicitly — `drawNext()` is otherwise only invoked from `spawn()`, so skipping it here would leave the NEXT preview on the old skin until the next piece spawns.
- The document-level `keydown` handler ignores events whose `target` is a `SELECT`/`INPUT`/`BUTTON` element, so arrow-key navigation inside `#skin-select` doesn't also move/rotate/drop the falling piece.

### localStorage

Two keys, both read and written through `storageGet`/`storageSet`, which swallow exceptions so a blocked or full storage never breaks the game: `tetris-theme` and `tetris-skin` (`SKIN_KEY`). `init()` reads both before building the board (`applyTheme(...)`, then `applySkin(storageGet(SKIN_KEY) || 'retro')`).

### Canvas size is duplicated

`COLS`, `ROWS`, and `BLOCK` in `game.js` must match `<canvas id="board" width height>` in `index.html` (`COLS*BLOCK` × `ROWS*BLOCK`, currently 300×600). Nothing enforces this — change both. Same for `#next-canvas` (120×120) and the `NB = 30` constant inside `drawNext()`.

## Language

UI strings, README, and comments are in Spanish. Keep new user-facing text in Spanish; identifiers stay in English.
