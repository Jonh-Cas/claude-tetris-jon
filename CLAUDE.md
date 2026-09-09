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

All game logic lives in `game.js` as module-level functions over shared mutable globals (`board`, `current`, `next`, `score`, `lines`, `level`, `combo`, `maxCombo`, `state`, `startLevel`, `currentSkin`, `dropAccum`, `dropInterval`, `animId`). There are no classes and no modules — the script is loaded with a plain `<script src>` and runs `init()` at the bottom.

Key coupling points to keep in mind when editing:

- **Board model**: `ROWS × COLS` array of ints. `0` is empty; `1`–`8` are simultaneously the piece type, the index into the active skin's `colors` array, and the value stored in every filled cell of `PIECES[type]`. Changing a piece's index means changing its color and its shape matrix cells together.
- **Rotation**: shapes are square matrices rotated by `rotateCW` (transpose + reverse). Wall kicks in `tryRotate` are a simple `[0,-1,1,-2,2]` column-offset scan, not SRS.
- **State machine**: `state` is one of `'start' | 'playing' | 'paused' | 'controls' | 'gameover'`; it replaces the old `paused`/`gameOver` booleans. Only `'playing'` reschedules the loop, and the keydown handler drops every game key unless `state === 'playing'` — that is what keeps an open menu from eating accidental moves. `showPanel(name)` swaps between the four children of `#overlay` (`#panel-start`, `#panel-pause`, `#panel-controls`, `#panel-gameover`); `hideOverlay()` returns to the board.
- **Loop**: `loop(ts)` is the single `requestAnimationFrame` driver. It accumulates `dt` into `dropAccum` and drops one row per `dropInterval`. Pausing cancels the frame and `resumeGame()` must reset `lastTime` before restarting, or the first frame after resume sees a huge `dt`.
- **Lock cycle**: `lockPiece()` → `merge()` → `clearLines()` → combo update → `spawn()`. `clearLines()` returns the number of rows cleared, which `lockPiece()` uses to increment or reset `combo`. `spawn()` promotes `next` to `current` and calls `endGame()` if the fresh piece already collides. Level-up uses `Math.floor(lines / 10) + startLevel`, so the configurable start level is a floor, not an offset that gets discarded on the first clear.
- **Rendering**: everything draws every frame in `draw()` — grid, board, ghost (via `ghostY()`, alpha `0.2`), then the current piece. `drawNext()` is called only from `spawn()` and from theme/skin changes, not per frame.
- **Skins**: `drawBlock()` keeps its signature but delegates to `SKINS[currentSkin].draw`. Every skin palette must have 9 entries with `null` at index 0, because the index is still piece type, color index and cell value at once. `drawBlock` wraps the skin call in `save()`/`restore()`; the neon skin also resets `shadowBlur` itself, since a leaked shadow would bleed into the grid and the NEXT canvas. Per-skin backgrounds come from `body.skin-*` classes in `style.css` redefining `--board-bg`, `--grid-line` and `--block-highlight`, read back by `updateThemeColors()`.
- **HUD**: `updateHUD()` writes to the DOM, including the `COMBO` section it hides while `combo < 2`. It is called from `clearLines`, `softDrop`, `lockPiece`, `startGame`, `init`, and the end of the keydown handler — score changes made elsewhere (e.g. `hardDrop`) rely on that keydown call to become visible.

### localStorage

Four keys, all read and written through `storageGet`/`storageSet`, which swallow exceptions so a blocked or full storage never breaks the game: `tetris-theme`, `tetris-skin`, `tetris-start-level`, and `tetris-records`. The records value is one JSON object `{ scores: [{name, score, lines, level, date}], bestCombo, maxLines }`, capped at `MAX_RECORDS` entries; `loadRecords()` validates its shape and falls back to `defaultRecords()`. Record names come from user input, so `renderRecords()` builds DOM nodes and sets `textContent` — never `innerHTML`.

### Canvas size is duplicated

`COLS`, `ROWS`, and `BLOCK` in `game.js` must match `<canvas id="board" width height>` in `index.html` (`COLS*BLOCK` × `ROWS*BLOCK`, currently 300×600). Nothing enforces this — change both. Same for `#next-canvas` (120×120) and the `NB = 30` constant inside `drawNext()`.

## Language

UI strings, README, and comments are in Spanish. Keep new user-facing text in Spanish; identifiers stay in English.
