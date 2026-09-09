'use strict';

const COLS = 10;
const ROWS = 20;
const BLOCK = 30;

const COLORS = [
  null,
  '#4dd0e1', // I - cyan
  '#ffd54f', // O - yellow
  '#ba68c8', // T - purple
  '#81c784', // S - green
  '#e57373', // Z - red
  '#90caf9', // J - azul pálido
  '#ffb74d', // L - orange
  '#b0bec5', // N - tuerca (gris metal)
];

const PIECES = [
  null,
  [[0,0,0,0],[1,1,1,1],[0,0,0,0],[0,0,0,0]], // I
  [[2,2],[2,2]],                               // O
  [[0,3,0],[3,3,3],[0,0,0]],                  // T
  [[0,4,4],[4,4,0],[0,0,0]],                  // S
  [[5,5,0],[0,5,5],[0,0,0]],                  // Z
  [[6,0,0],[6,6,6],[0,0,0]],                  // J
  [[0,0,7],[7,7,7],[0,0,0]],                  // L
  [[8,8,8],[8,0,8],[8,8,8]],                  // N - tuerca (hueco central)
];

const LINE_SCORES = [0, 100, 300, 500, 800];

const canvas = document.getElementById('board');
const ctx = canvas.getContext('2d');
const nextCanvas = document.getElementById('next-canvas');
const nextCtx = nextCanvas.getContext('2d');
const scoreEl = document.getElementById('score');
const linesEl = document.getElementById('lines');
const levelEl = document.getElementById('level');
const overlay = document.getElementById('overlay');
const overlayTitle = document.getElementById('overlay-title');
const overlayScore = document.getElementById('overlay-score');
const restartBtn = document.getElementById('restart-btn');
const themeSwitch = document.getElementById('theme-switch');
const skinSelect = document.getElementById('skin-select');

const THEME_KEY = 'tetris-theme';
const SKIN_KEY = 'tetris-skin';
const themeColors = { gridLine: '#22222e', highlight: 'rgba(255,255,255,0.12)' };

let board, current, next, score, lines, level, paused, gameOver, lastTime, dropAccum, dropInterval, animId;
let currentSkin = 'retro';

function storageGet(key) {
  try {
    return localStorage.getItem(key);
  } catch (e) {
    return null;
  }
}

function storageSet(key, value) {
  try {
    localStorage.setItem(key, value);
  } catch (e) {
    // localStorage bloqueado o lleno: ignorar, el juego sigue funcionando
  }
}

function createBoard() {
  return Array.from({ length: ROWS }, () => new Array(COLS).fill(0));
}

function randomPiece() {
  const type = Math.floor(Math.random() * 8) + 1;
  const shape = PIECES[type].map(row => [...row]);
  return { type, shape, x: Math.floor(COLS / 2) - Math.floor(shape[0].length / 2), y: 0 };
}

function collide(shape, ox, oy) {
  for (let r = 0; r < shape.length; r++) {
    for (let c = 0; c < shape[r].length; c++) {
      if (!shape[r][c]) continue;
      const nx = ox + c;
      const ny = oy + r;
      if (nx < 0 || nx >= COLS || ny >= ROWS) return true;
      if (ny >= 0 && board[ny][nx]) return true;
    }
  }
  return false;
}

function rotateCW(shape) {
  const rows = shape.length, cols = shape[0].length;
  const result = Array.from({ length: cols }, () => new Array(rows).fill(0));
  for (let r = 0; r < rows; r++)
    for (let c = 0; c < cols; c++)
      result[c][rows - 1 - r] = shape[r][c];
  return result;
}

function tryRotate() {
  const rotated = rotateCW(current.shape);
  const kicks = [0, -1, 1, -2, 2];
  for (const kick of kicks) {
    if (!collide(rotated, current.x + kick, current.y)) {
      current.shape = rotated;
      current.x += kick;
      return;
    }
  }
}

function merge() {
  for (let r = 0; r < current.shape.length; r++)
    for (let c = 0; c < current.shape[r].length; c++)
      if (current.shape[r][c])
        board[current.y + r][current.x + c] = current.shape[r][c];
}

function clearLines() {
  let cleared = 0;
  for (let r = ROWS - 1; r >= 0; r--) {
    if (board[r].every(v => v !== 0)) {
      board.splice(r, 1);
      board.unshift(new Array(COLS).fill(0));
      cleared++;
      r++;
    }
  }
  if (cleared) {
    lines += cleared;
    score += (LINE_SCORES[cleared] || 0) * level;
    level = Math.floor(lines / 10) + 1;
    dropInterval = Math.max(100, 1000 - (level - 1) * 90);
    updateHUD();
  }
}

function ghostY() {
  let gy = current.y;
  while (!collide(current.shape, current.x, gy + 1)) gy++;
  return gy;
}

function hardDrop() {
  const gy = ghostY();
  score += (gy - current.y) * 2;
  current.y = gy;
  lockPiece();
}

function softDrop() {
  if (!collide(current.shape, current.x, current.y + 1)) {
    current.y++;
    score += 1;
    updateHUD();
  } else {
    lockPiece();
  }
}

function lockPiece() {
  merge();
  clearLines();
  spawn();
}

function spawn() {
  current = next;
  next = randomPiece();
  if (collide(current.shape, current.x, current.y)) {
    endGame();
  }
  drawNext();
}

function updateHUD() {
  scoreEl.textContent = score.toLocaleString();
  linesEl.textContent = lines;
  levelEl.textContent = level;
}

// Paletas de skins: 9 posiciones, null en el índice 0 (vacío). El índice
// sigue siendo a la vez tipo de pieza, índice de color y valor de celda.
const NEON_COLORS = [
  null,
  '#00fff9', // I
  '#faff00', // O
  '#ff00f7', // T
  '#00ff6a', // S
  '#ff0044', // Z
  '#3d9bff', // J
  '#ff9500', // L
  '#e0e0ff', // N
];

const PASTEL_COLORS = [
  null,
  '#a8e6e6', // I
  '#fff2b2', // O
  '#dcb8e8', // T
  '#b8e6c2', // S
  '#f2b8b8', // Z
  '#b8d4f2', // J
  '#f2d0a8', // L
  '#d8d8e0', // N
];

const PIXEL_COLORS = COLORS;

function drawBlockRetro(context, x, y, colorIndex, size, alpha) {
  const color = COLORS[colorIndex];
  context.globalAlpha = alpha ?? 1;
  context.fillStyle = color;
  context.fillRect(x * size + 1, y * size + 1, size - 2, size - 2);
  context.fillStyle = themeColors.highlight;
  context.fillRect(x * size + 1, y * size + 1, size - 2, 4);
}

function drawBlockNeon(context, x, y, colorIndex, size, alpha) {
  const color = NEON_COLORS[colorIndex];
  context.globalAlpha = alpha ?? 1;
  context.shadowColor = color;
  context.shadowBlur = size * 0.6;
  context.fillStyle = color;
  context.fillRect(x * size + 2, y * size + 2, size - 4, size - 4);
  // el glow no debe filtrarse a la cuadrícula ni al canvas NEXT
  context.shadowBlur = 0;
  context.strokeStyle = themeColors.highlight;
  context.lineWidth = 1;
  context.strokeRect(x * size + 2, y * size + 2, size - 4, size - 4);
}

function roundedRectPath(context, px, py, s, r) {
  if (typeof context.roundRect === 'function') {
    context.beginPath();
    context.roundRect(px, py, s, s, r);
    return;
  }
  // fallback manual para navegadores sin CanvasRenderingContext2D.roundRect
  context.beginPath();
  context.moveTo(px + r, py);
  context.arcTo(px + s, py, px + s, py + s, r);
  context.arcTo(px + s, py + s, px, py + s, r);
  context.arcTo(px, py + s, px, py, r);
  context.arcTo(px, py, px + s, py, r);
  context.closePath();
}

function drawBlockPastel(context, x, y, colorIndex, size, alpha) {
  const color = PASTEL_COLORS[colorIndex];
  const px = x * size + 1;
  const py = y * size + 1;
  const s = size - 2;
  const r = Math.min(6, s / 4);
  context.globalAlpha = alpha ?? 1;
  context.fillStyle = color;
  roundedRectPath(context, px, py, s, r);
  context.fill();
  context.globalAlpha = (alpha ?? 1) * 0.6;
  context.fillStyle = themeColors.highlight;
  context.fillRect(px + 2, py + 2, s - 4, 3);
}

function drawBlockPixel(context, x, y, colorIndex, size, alpha) {
  const color = PIXEL_COLORS[colorIndex];
  const px = x * size + 1;
  const py = y * size + 1;
  const s = size - 2;
  context.globalAlpha = alpha ?? 1;
  context.fillStyle = color;
  context.fillRect(px, py, s, s);
  // textura tipo pixel-art: cuadrícula interna clara/oscura alterna
  const cell = Math.max(3, Math.floor(s / 4));
  for (let ry = 0; ry < s; ry += cell) {
    for (let rx = 0; rx < s; rx += cell) {
      const dark = ((rx / cell + ry / cell) % 2) === 0;
      context.fillStyle = dark ? 'rgba(0,0,0,0.15)' : 'rgba(255,255,255,0.15)';
      context.fillRect(px + rx, py + ry, Math.min(cell, s - rx), Math.min(cell, s - ry));
    }
  }
  context.strokeStyle = 'rgba(0,0,0,0.35)';
  context.lineWidth = 1;
  context.strokeRect(px + 0.5, py + 0.5, s - 1, s - 1);
}

const SKINS = {
  retro: { colors: COLORS, draw: drawBlockRetro },
  neon: { colors: NEON_COLORS, draw: drawBlockNeon },
  pastel: { colors: PASTEL_COLORS, draw: drawBlockPastel },
  pixel: { colors: PIXEL_COLORS, draw: drawBlockPixel },
};

function drawBlock(context, x, y, colorIndex, size, alpha) {
  if (!colorIndex) return;
  context.save();
  SKINS[currentSkin].draw(context, x, y, colorIndex, size, alpha);
  context.restore();
}

function drawGrid() {
  ctx.strokeStyle = themeColors.gridLine;
  ctx.lineWidth = 0.5;
  for (let c = 1; c < COLS; c++) {
    ctx.beginPath();
    ctx.moveTo(c * BLOCK, 0);
    ctx.lineTo(c * BLOCK, ROWS * BLOCK);
    ctx.stroke();
  }
  for (let r = 1; r < ROWS; r++) {
    ctx.beginPath();
    ctx.moveTo(0, r * BLOCK);
    ctx.lineTo(COLS * BLOCK, r * BLOCK);
    ctx.stroke();
  }
}

function draw() {
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  drawGrid();

  // board
  for (let r = 0; r < ROWS; r++)
    for (let c = 0; c < COLS; c++)
      drawBlock(ctx, c, r, board[r][c], BLOCK);

  // ghost
  const gy = ghostY();
  for (let r = 0; r < current.shape.length; r++)
    for (let c = 0; c < current.shape[r].length; c++)
      if (current.shape[r][c])
        drawBlock(ctx, current.x + c, gy + r, current.shape[r][c], BLOCK, 0.2);

  // current piece
  for (let r = 0; r < current.shape.length; r++)
    for (let c = 0; c < current.shape[r].length; c++)
      drawBlock(ctx, current.x + c, current.y + r, current.shape[r][c], BLOCK);
}

function drawNext() {
  const NB = 30;
  nextCtx.clearRect(0, 0, nextCanvas.width, nextCanvas.height);
  const shape = next.shape;
  const offX = Math.floor((4 - shape[0].length) / 2);
  const offY = Math.floor((4 - shape.length) / 2);
  for (let r = 0; r < shape.length; r++)
    for (let c = 0; c < shape[r].length; c++)
      drawBlock(nextCtx, offX + c, offY + r, shape[r][c], NB);
}

function endGame() {
  gameOver = true;
  cancelAnimationFrame(animId);
  overlayTitle.textContent = 'GAME OVER';
  overlayScore.textContent = `Puntuación: ${score.toLocaleString()}`;
  overlay.classList.remove('hidden');
}

function updateThemeColors() {
  const style = getComputedStyle(document.body);
  themeColors.gridLine = style.getPropertyValue('--grid-line').trim();
  themeColors.highlight = style.getPropertyValue('--block-highlight').trim();
}

function applyTheme(isLight) {
  document.body.classList.toggle('light', isLight);
  themeSwitch.checked = isLight;
  updateThemeColors();
}

function toggleTheme() {
  const isLight = themeSwitch.checked;
  applyTheme(isLight);
  storageSet(THEME_KEY, isLight ? 'light' : 'dark');
  draw();
  if (next) drawNext();
}

function applySkin(skin) {
  if (!SKINS[skin]) skin = 'retro';
  currentSkin = skin;
  document.body.classList.remove('skin-retro', 'skin-neon', 'skin-pastel', 'skin-pixel');
  document.body.classList.add(`skin-${skin}`);
  if (skinSelect) skinSelect.value = skin;
  updateThemeColors();
}

function changeSkin() {
  applySkin(skinSelect.value);
  storageSet(SKIN_KEY, currentSkin);
  draw();
  if (next) drawNext();
}

function togglePause() {
  if (gameOver) return;
  paused = !paused;
  if (!paused) {
    lastTime = performance.now();
    loop(lastTime);
  } else {
    cancelAnimationFrame(animId);
    overlayTitle.textContent = 'PAUSA';
    overlayScore.textContent = '';
    overlay.classList.remove('hidden');
  }
}

function loop(ts) {
  const dt = ts - lastTime;
  lastTime = ts;
  dropAccum += dt;
  if (dropAccum >= dropInterval) {
    dropAccum = 0;
    if (!collide(current.shape, current.x, current.y + 1)) {
      current.y++;
    } else {
      lockPiece();
    }
  }
  draw();
  // lockPiece() puede terminar la partida; no reagendar tras endGame()/togglePause()
  if (gameOver || paused) return;
  animId = requestAnimationFrame(loop);
}

function init() {
  applyTheme(storageGet(THEME_KEY) === 'light');
  applySkin(storageGet(SKIN_KEY) || 'retro');
  board = createBoard();
  score = 0;
  lines = 0;
  level = 1;
  paused = false;
  gameOver = false;
  dropInterval = 1000;
  dropAccum = 0;
  lastTime = performance.now();
  next = randomPiece();
  spawn();
  updateHUD();
  overlay.classList.add('hidden');
  cancelAnimationFrame(animId);
  animId = requestAnimationFrame(loop);
}

document.addEventListener('keydown', e => {
  // Ignorar teclas cuando el foco está en un control de formulario (p.ej.
  // el selector de skin), para no mover/rotar la pieza al navegarlo.
  if (e.target && /^(SELECT|INPUT|BUTTON)$/.test(e.target.tagName)) return;
  if (e.code === 'KeyP') { togglePause(); return; }
  if (paused || gameOver) return;
  switch (e.code) {
    case 'ArrowLeft':
      if (!collide(current.shape, current.x - 1, current.y)) current.x--;
      break;
    case 'ArrowRight':
      if (!collide(current.shape, current.x + 1, current.y)) current.x++;
      break;
    case 'ArrowDown':
      softDrop();
      break;
    case 'ArrowUp':
    case 'KeyX':
      tryRotate();
      break;
    case 'Space':
      e.preventDefault();
      hardDrop();
      break;
  }
  updateHUD();
});

restartBtn.addEventListener('click', init);
themeSwitch.addEventListener('change', toggleTheme);
if (skinSelect) skinSelect.addEventListener('change', changeSkin);

init();
