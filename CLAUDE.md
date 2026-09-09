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

All game logic lives in `game.js` as module-level functions over shared mutable globals (`board`, `current`, `next`, `score`, `lines`, `level`, `combo`, `maxCombo`, `paused`, `gameOver`, `dropAccum`, `dropInterval`, `animId`, `recordSaved`). There are no classes and no modules — the script is loaded with a plain `<script src>` and runs `init()` at the bottom.

Key coupling points to keep in mind when editing:

- **Board model**: `ROWS × COLS` array of ints. `0` is empty; `1`–`7` are simultaneously the piece type, the index into `COLORS`, and the value stored in every filled cell of `PIECES[type]`. Changing a piece's index means changing its color and its shape matrix cells together.
- **Rotation**: shapes are square matrices rotated by `rotateCW` (transpose + reverse). Wall kicks in `tryRotate` are a simple `[0,-1,1,-2,2]` column-offset scan, not SRS.
- **Loop**: `loop(ts)` is the single `requestAnimationFrame` driver. It accumulates `dt` into `dropAccum` and drops one row per `dropInterval`. Pause cancels the frame and `togglePause` must reset `lastTime` before restarting, or the first frame after resume sees a huge `dt`. `resetRecords()` hits the same trap via the blocking `confirm()` dialog: it cancels the frame before showing the dialog and reschedules with a fresh `lastTime` afterward.
- **Lock cycle**: `lockPiece()` → `merge()` → `clearLines()` → combo update → `spawn()`. `clearLines()` returns the number of rows cleared (it no longer calls `updateHUD()` itself); `lockPiece()` uses that return value to increment `combo` (tracking `maxCombo` alongside it) and add a combo bonus to `score`, or reset `combo` to `0` when no line cleared, then calls `updateHUD()` once. `spawn()` promotes `next` to `current` and calls `endGame()` if the fresh piece already collides.
- **Rendering**: everything draws every frame in `draw()` — grid, board, ghost (via `ghostY()`, alpha `0.2`), then the current piece. `drawNext()` is called only from `spawn()`, not per frame.
- **HUD**: `updateHUD()` writes to the DOM, including the `COMBO` section (`#combo-section`) which it hides via the generic `.hidden` class while `combo < 2`. It is called from `lockPiece`, `softDrop`, `init`, and the end of the keydown handler — score changes made elsewhere (e.g. `hardDrop`) rely on that keydown call to become visible.

### Records (localStorage)

`storageGet`/`storageSet` wrap `localStorage.getItem`/`setItem` and swallow exceptions, so a blocked or full `localStorage` never breaks the game; `toggleTheme` also routes through `storageSet` now. Records live under the key `tetris-records` as one JSON object: `{ scores: [{name, score, lines, level, date}], bestCombo, maxLines }`, with `scores` capped at `MAX_RECORDS = 5` entries sorted descending by score. `loadRecords()` validates the parsed shape field-by-field and falls back to `defaultRecords()` on anything malformed (missing keys, wrong types, corrupted JSON) so a hand-edited value can't throw.

At game over, `endGame()` checks `qualifiesForTop()` against the current top 5 and shows a name-entry field (`#name-entry`) only when the score would place; `addRecord()` inserts the entry, updates `bestCombo`/`maxLines`, persists, and re-renders. The records table is rendered in two places — the always-visible sidebar (`#records-list`) and the game-over overlay (`#gameover-records-list`) — both via `renderRecords()`, which builds DOM nodes and sets `textContent` (never `innerHTML`, since record names are user input) and applies a `records-highlight` class to the freshly inserted row's index. `resetRecords()` clears the stored records after a `confirm()` prompt.

### Canvas size is duplicated

`COLS`, `ROWS`, and `BLOCK` in `game.js` must match `<canvas id="board" width height>` in `index.html` (`COLS*BLOCK` × `ROWS*BLOCK`, currently 300×600). Nothing enforces this — change both. Same for `#next-canvas` (120×120) and the `NB = 30` constant inside `drawNext()`.

## Language

UI strings, README, and comments are in Spanish. Keep new user-facing text in Spanish; identifiers stay in English.
