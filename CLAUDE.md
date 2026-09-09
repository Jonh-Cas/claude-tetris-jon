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

All game logic lives in `game.js` as module-level functions over shared mutable globals (`board`, `current`, `next`, `score`, `lines`, `level`, `state`, `startLevel`, `dropAccum`, `dropInterval`, `animId`). There are no classes and no modules — the script is loaded with a plain `<script src>` and runs `init()` at the bottom.

Key coupling points to keep in mind when editing:

- **Board model**: `ROWS × COLS` array of ints. `0` is empty; `1`–`7` are simultaneously the piece type, the index into `COLORS`, and the value stored in every filled cell of `PIECES[type]`. Changing a piece's index means changing its color and its shape matrix cells together.
- **Rotation**: shapes are square matrices rotated by `rotateCW` (transpose + reverse). Wall kicks in `tryRotate` are a simple `[0,-1,1,-2,2]` column-offset scan, not SRS.
- **State machine**: `state` is one of `'start' | 'playing' | 'paused' | 'controls' | 'gameover'`; it replaces the old `paused`/`gameOver` booleans. Only `'playing'` reschedules the loop, and the keydown handler drops every game key unless `state === 'playing'` — that is what keeps an open menu from eating accidental moves (`KeyP` and `Escape` are the only exceptions: both call `togglePause`, which toggles only between `'playing'` and `'paused'`/`'controls'`). `showPanel(name)` swaps between the four children of `#overlay` (`#panel-start`, `#panel-pause`, `#panel-controls`, `#panel-gameover`) by toggling a shared `.hidden` class; `hideOverlay()` hides the whole overlay and returns to the board. `openControls()`/`backToPause()` move between the `'paused'` and `'controls'` states without touching the running game.
- **Starting and restarting a run**: `init()` sets up the board once and leaves `state = 'start'` showing `#panel-start`; nothing runs until `startGame()` (bound to the "Jugar" button) is clicked. `startGame()` and `restartGame()` both delegate to `beginRun()`, which resets `board`/`score`/`lines`/`level`, derives `dropInterval` from `startLevel`, spawns the first pieces, sets `state = 'playing'`, resets `lastTime`, and reschedules the loop. `resumeGame()` (used by the Reanudar button and by `togglePause` when unpausing) MUST also reset `lastTime = performance.now()` before calling `requestAnimationFrame` again, or the first frame after resuming sees a huge `dt` and the piece drops several rows at once.
- **Start level**: `startLevel` is read from the pause panel's `<select id="start-level-select">` and persisted to `localStorage` (key `tetris-start-level`) through `storageGet`/`storageSet`, small helpers that swallow exceptions so a blocked or full storage never breaks the game. It is a floor, not an offset that gets discarded on the first clear: `clearLines()` computes `level = Math.floor(lines / 10) + startLevel`, and `beginRun()` derives the initial `dropInterval` from it too.
- **Loop**: `loop(ts)` is the single `requestAnimationFrame` driver. It accumulates `dt` into `dropAccum` and drops one row per `dropInterval`, then only reschedules itself when `state === 'playing'`.
- **Lock cycle**: `lockPiece()` → `merge()` → `clearLines()` → `spawn()`. `spawn()` promotes `next` to `current` and calls `endGame()` (which sets `state = 'gameover'` and shows `#panel-gameover`) if the fresh piece already collides.
- **Rendering**: everything draws every frame in `draw()` — grid, board, ghost (via `ghostY()`, alpha `0.2`), then the current piece. `drawNext()` is called only from `spawn()`, not per frame.
- **HUD**: `updateHUD()` writes to the DOM. It is called from `clearLines`, `softDrop`, `beginRun`, `init`, and the end of the keydown handler — score changes made elsewhere (e.g. `hardDrop`) rely on that keydown call to become visible.

### Canvas size is duplicated

`COLS`, `ROWS`, and `BLOCK` in `game.js` must match `<canvas id="board" width height>` in `index.html` (`COLS*BLOCK` × `ROWS*BLOCK`, currently 300×600). Nothing enforces this — change both. Same for `#next-canvas` (120×120) and the `NB = 30` constant inside `drawNext()`.

## Language

UI strings, README, and comments are in Spanish. Keep new user-facing text in Spanish; identifiers stay in English.
