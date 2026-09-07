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

All game logic lives in `game.js` as module-level functions over shared mutable globals (`board`, `current`, `next`, `score`, `lines`, `level`, `paused`, `gameOver`, `dropAccum`, `dropInterval`, `animId`). There are no classes and no modules — the script is loaded with a plain `<script src>` and runs `init()` at the bottom.

Key coupling points to keep in mind when editing:

- **Board model**: `ROWS × COLS` array of ints. `0` is empty; `1`–`7` are simultaneously the piece type, the index into `COLORS`, and the value stored in every filled cell of `PIECES[type]`. Changing a piece's index means changing its color and its shape matrix cells together.
- **Rotation**: shapes are square matrices rotated by `rotateCW` (transpose + reverse). Wall kicks in `tryRotate` are a simple `[0,-1,1,-2,2]` column-offset scan, not SRS.
- **Loop**: `loop(ts)` is the single `requestAnimationFrame` driver. It accumulates `dt` into `dropAccum` and drops one row per `dropInterval`. Pause cancels the frame and `togglePause` must reset `lastTime` before restarting, or the first frame after resume sees a huge `dt`.
- **Lock cycle**: `lockPiece()` → `merge()` → `clearLines()` → `spawn()`. `spawn()` promotes `next` to `current` and calls `endGame()` if the fresh piece already collides.
- **Rendering**: everything draws every frame in `draw()` — grid, board, ghost (via `ghostY()`, alpha `0.2`), then the current piece. `drawNext()` is called only from `spawn()`, not per frame.
- **HUD**: `updateHUD()` writes to the DOM. It is called from `clearLines`, `softDrop`, `init`, and the end of the keydown handler — score changes made elsewhere (e.g. `hardDrop`) rely on that keydown call to become visible.

### Canvas size is duplicated

`COLS`, `ROWS`, and `BLOCK` in `game.js` must match `<canvas id="board" width height>` in `index.html` (`COLS*BLOCK` × `ROWS*BLOCK`, currently 300×600). Nothing enforces this — change both. Same for `#next-canvas` (120×120) and the `NB = 30` constant inside `drawNext()`.

## Language

UI strings, README, and comments are in Spanish. Keep new user-facing text in Spanish; identifiers stay in English.
