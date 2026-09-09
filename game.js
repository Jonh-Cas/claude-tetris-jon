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
const themeSwitch = document.getElementById('theme-switch');

const panelStart = document.getElementById('panel-start');
const panelPause = document.getElementById('panel-pause');
const panelControls = document.getElementById('panel-controls');
const panelGameover = document.getElementById('panel-gameover');
const startBtn = document.getElementById('start-btn');
const resumeBtn = document.getElementById('resume-btn');
const pauseRestartBtn = document.getElementById('restart-btn');
const controlsBtn = document.getElementById('controls-btn');
const backBtn = document.getElementById('back-btn');
const gameoverRestartBtn = document.getElementById('gameover-restart-btn');
const startLevelSelect = document.getElementById('start-level-select');

const THEME_KEY = 'tetris-theme';
const START_LEVEL_KEY = 'tetris-start-level';
const themeColors = { gridLine: '#22222e', highlight: 'rgba(255,255,255,0.12)' };

function storageGet(key, fallback) {
  try {
    const value = localStorage.getItem(key);
    return value === null ? fallback : value;
  } catch {
    return fallback;
  }
}

function storageSet(key, value) {
  try {
    localStorage.setItem(key, value);
  } catch {
    // localStorage bloqueado o lleno: se ignora, el juego sigue funcionando
  }
}

let board, current, next, score, lines, level, state, startLevel, lastTime, dropAccum, dropInterval, animId;

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
    level = Math.floor(lines / 10) + startLevel;
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

function drawBlock(context, x, y, colorIndex, size, alpha) {
  if (!colorIndex) return;
  const color = COLORS[colorIndex];
  context.globalAlpha = alpha ?? 1;
  context.fillStyle = color;
  context.fillRect(x * size + 1, y * size + 1, size - 2, size - 2);
  // highlight
  context.fillStyle = themeColors.highlight;
  context.fillRect(x * size + 1, y * size + 1, size - 2, 4);
  context.globalAlpha = 1;
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
  state = 'gameover';
  cancelAnimationFrame(animId);
  overlayTitle.textContent = 'GAME OVER';
  overlayScore.textContent = `Puntuación: ${score.toLocaleString()}`;
  showPanel('gameover');
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

function showPanel(name) {
  panelStart.classList.add('hidden');
  panelPause.classList.add('hidden');
  panelControls.classList.add('hidden');
  panelGameover.classList.add('hidden');
  const panels = { start: panelStart, pause: panelPause, controls: panelControls, gameover: panelGameover };
  panels[name].classList.remove('hidden');
  overlay.classList.remove('hidden');
}

function hideOverlay() {
  overlay.classList.add('hidden');
}

function readStartLevel() {
  const value = parseInt(startLevelSelect.value, 10);
  return Number.isFinite(value) && value > 0 ? value : 1;
}

function resetRun() {
  board = createBoard();
  score = 0;
  lines = 0;
  level = startLevel;
  dropInterval = Math.max(100, 1000 - (startLevel - 1) * 90);
  dropAccum = 0;
  next = randomPiece();
  spawn();
  updateHUD();
}

function beginRun() {
  resetRun();
  state = 'playing';
  hideOverlay();
  lastTime = performance.now();
  cancelAnimationFrame(animId);
  animId = requestAnimationFrame(loop);
}

function startGame() {
  startLevel = readStartLevel();
  storageSet(START_LEVEL_KEY, String(startLevel));
  beginRun();
}

function restartGame() {
  startGame();
}

function resumeGame() {
  if (state !== 'paused' && state !== 'controls') return;
  state = 'playing';
  hideOverlay();
  lastTime = performance.now();
  animId = requestAnimationFrame(loop);
}

function togglePause() {
  if (state === 'playing') {
    state = 'paused';
    cancelAnimationFrame(animId);
    showPanel('pause');
  } else if (state === 'paused' || state === 'controls') {
    resumeGame();
  }
}

function openControls() {
  if (state !== 'paused') return;
  state = 'controls';
  showPanel('controls');
}

function backToPause() {
  if (state !== 'controls') return;
  state = 'paused';
  showPanel('pause');
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
  // lockPiece() puede terminar la partida; solo 'playing' reagenda el frame
  if (state !== 'playing') return;
  animId = requestAnimationFrame(loop);
}

function populateStartLevelOptions() {
  startLevelSelect.innerHTML = '';
  for (let lvl = 1; lvl <= 10; lvl++) {
    const opt = document.createElement('option');
    opt.value = String(lvl);
    opt.textContent = String(lvl);
    startLevelSelect.appendChild(opt);
  }
}

function init() {
  applyTheme(storageGet(THEME_KEY, null) === 'light');
  populateStartLevelOptions();
  startLevel = parseInt(storageGet(START_LEVEL_KEY, '1'), 10) || 1;
  startLevelSelect.value = String(startLevel);
  resetRun();
  state = 'start';
  showPanel('start');
  cancelAnimationFrame(animId);
  draw();
}

document.addEventListener('keydown', e => {
  if (e.code === 'KeyP' || e.code === 'Escape') { togglePause(); return; }
  if (state !== 'playing') return;
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

startBtn.addEventListener('click', startGame);
resumeBtn.addEventListener('click', resumeGame);
pauseRestartBtn.addEventListener('click', restartGame);
controlsBtn.addEventListener('click', openControls);
backBtn.addEventListener('click', backToPause);
gameoverRestartBtn.addEventListener('click', restartGame);
startLevelSelect.addEventListener('change', () => {
  startLevel = readStartLevel();
  storageSet(START_LEVEL_KEY, String(startLevel));
});
themeSwitch.addEventListener('change', toggleTheme);

init();
