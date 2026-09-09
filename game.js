'use strict';

const COLS = 10;
const ROWS = 20;
const BLOCK = 30;

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

const MAX_LEVEL_OPTION = 15;
const MAX_RECORDS = 5;

const THEME_KEY = 'tetris-theme';
const SKIN_KEY = 'tetris-skin';
const START_LEVEL_KEY = 'tetris-start-level';
const RECORDS_KEY = 'tetris-records';

/* ---------- Utilidades de color ---------- */

// Mezcla un color hexadecimal hacia blanco (amount > 0) o hacia negro (amount < 0).
function shade(hex, amount) {
  const n = parseInt(hex.slice(1), 16);
  const target = amount > 0 ? 255 : 0;
  const t = Math.abs(amount);
  const mix = v => Math.round(v + (target - v) * t);
  const r = mix((n >> 16) & 255);
  const g = mix((n >> 8) & 255);
  const b = mix(n & 255);
  return `rgb(${r}, ${g}, ${b})`;
}

/* ---------- Skins ----------
   Cada paleta tiene 9 entradas: el índice 1-8 es a la vez tipo de pieza,
   índice de color y valor guardado en cada celda del tablero. */

const SKINS = {
  retro: {
    colors: [null, '#4dd0e1', '#ffd54f', '#ba68c8', '#81c784', '#e57373', '#90caf9', '#ffb74d', '#b0bec5'],
    draw(context, px, py, size, color) {
      context.fillStyle = color;
      context.fillRect(px + 1, py + 1, size - 2, size - 2);
      context.fillStyle = themeColors.highlight;
      context.fillRect(px + 1, py + 1, size - 2, 4);
    },
  },
  neon: {
    colors: [null, '#00e5ff', '#ffea00', '#e040fb', '#00e676', '#ff1744', '#2979ff', '#ff9100', '#b0ffff'],
    draw(context, px, py, size, color) {
      context.shadowBlur = size * 0.5;
      context.shadowColor = color;
      context.fillStyle = shade(color, -0.75);
      context.fillRect(px + 2, py + 2, size - 4, size - 4);
      context.lineWidth = 2;
      context.strokeStyle = color;
      context.strokeRect(px + 2.5, py + 2.5, size - 5, size - 5);
      // Restaurar o el glow contamina la rejilla y el canvas de NEXT.
      context.shadowBlur = 0;
    },
  },
  pastel: {
    colors: [null, '#a8e6ef', '#fdf1a9', '#dcc6f2', '#bfe6c3', '#f5b7b1', '#c5d8f7', '#fbd9a8', '#dfe4e8'],
    draw(context, px, py, size, color) {
      const r = size * 0.25;
      context.fillStyle = color;
      context.beginPath();
      if (context.roundRect) {
        context.roundRect(px + 2, py + 2, size - 4, size - 4, r);
      } else {
        context.rect(px + 2, py + 2, size - 4, size - 4);
      }
      context.fill();
      context.fillStyle = shade(color, 0.45);
      context.beginPath();
      if (context.roundRect) {
        context.roundRect(px + 4, py + 4, size - 8, (size - 8) * 0.35, r * 0.6);
      } else {
        context.rect(px + 4, py + 4, size - 8, (size - 8) * 0.35);
      }
      context.fill();
    },
  },
  pixel: {
    colors: [null, '#3fb8c8', '#e8bd3c', '#a355bd', '#66b56a', '#d05a5a', '#6f9fe0', '#e09a3c', '#9aa7ad'],
    draw(context, px, py, size, color) {
      const inner = size - 2;
      context.fillStyle = color;
      context.fillRect(px + 1, py + 1, inner, inner);
      // Textura: rejilla 2x2 de cuadrantes aclarados y oscurecidos.
      const half = inner / 2;
      context.fillStyle = shade(color, 0.3);
      context.fillRect(px + 1, py + 1, half, half);
      context.fillStyle = shade(color, -0.3);
      context.fillRect(px + 1 + half, py + 1 + half, half, half);
      // Puntos de píxel sueltos para dar grano.
      const dot = Math.max(2, Math.round(size / 10));
      context.fillStyle = shade(color, 0.55);
      context.fillRect(px + 1 + half, py + 1 + dot, dot, dot);
      context.fillStyle = shade(color, -0.55);
      context.fillRect(px + 1 + dot, py + 1 + half + dot, dot, dot);
      context.lineWidth = 1;
      context.strokeStyle = shade(color, -0.6);
      context.strokeRect(px + 1.5, py + 1.5, inner - 1, inner - 1);
    },
  },
};

/* ---------- DOM ---------- */

const canvas = document.getElementById('board');
const ctx = canvas.getContext('2d');
const nextCanvas = document.getElementById('next-canvas');
const nextCtx = nextCanvas.getContext('2d');
const scoreEl = document.getElementById('score');
const linesEl = document.getElementById('lines');
const levelEl = document.getElementById('level');
const comboEl = document.getElementById('combo');
const comboSection = document.getElementById('combo-section');

const overlay = document.getElementById('overlay');
const panels = {
  start: document.getElementById('panel-start'),
  pause: document.getElementById('panel-pause'),
  controls: document.getElementById('panel-controls'),
  gameover: document.getElementById('panel-gameover'),
};
const overlayScore = document.getElementById('overlay-score');
const startRecordsEl = document.getElementById('start-records');
const gameoverRecordsEl = document.getElementById('gameover-records');
const newRecordMsg = document.getElementById('new-record-msg');
const saveRow = document.getElementById('save-row');
const playerNameInput = document.getElementById('player-name');

const startLevelSel = document.getElementById('start-level');
const pauseLevelSel = document.getElementById('pause-level');
const skinSelect = document.getElementById('skin-select');
const themeSwitch = document.getElementById('theme-switch');

const themeColors = { gridLine: '#22222e', highlight: 'rgba(255,255,255,0.12)' };

/* ---------- Estado ---------- */

// 'start' | 'playing' | 'paused' | 'controls' | 'gameover'
let state = 'start';
let board, current, next, score, lines, level, combo, maxCombo;
let lastTime, dropAccum, dropInterval, animId;
let startLevel = 1;
let currentSkin = 'retro';
let pendingResult = null;

/* ---------- Almacenamiento ---------- */

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
    /* almacenamiento no disponible: la partida sigue funcionando sin persistir */
  }
}

function defaultRecords() {
  return { scores: [], bestCombo: 0, maxLines: 0 };
}

function loadRecords() {
  const raw = storageGet(RECORDS_KEY);
  if (!raw) return defaultRecords();
  try {
    const data = JSON.parse(raw);
    if (!data || typeof data !== 'object') return defaultRecords();
    return {
      scores: Array.isArray(data.scores) ? data.scores.slice(0, MAX_RECORDS) : [],
      bestCombo: Number(data.bestCombo) || 0,
      maxLines: Number(data.maxLines) || 0,
    };
  } catch (e) {
    return defaultRecords();
  }
}

function saveRecords(data) {
  storageSet(RECORDS_KEY, JSON.stringify(data));
}

// True si la puntuación entra en el top.
function qualifies(value) {
  if (value <= 0) return false;
  const { scores } = loadRecords();
  if (scores.length < MAX_RECORDS) return true;
  return value > scores[scores.length - 1].score;
}

function renderRecords(container, highlightIndex) {
  const data = loadRecords();
  container.textContent = '';

  const title = document.createElement('p');
  title.className = 'records-title';
  title.textContent = 'MEJORES PUNTUACIONES';
  container.appendChild(title);

  if (data.scores.length === 0) {
    const empty = document.createElement('p');
    empty.className = 'records-empty';
    empty.textContent = 'Todavía no hay records.';
    container.appendChild(empty);
  } else {
    const list = document.createElement('ol');
    list.className = 'records-list';
    data.scores.forEach((entry, i) => {
      const li = document.createElement('li');
      if (i === highlightIndex) li.className = 'record-new';
      const name = document.createElement('span');
      name.className = 'record-name';
      name.textContent = entry.name;
      const value = document.createElement('span');
      value.className = 'record-score';
      value.textContent = Number(entry.score).toLocaleString();
      li.appendChild(name);
      li.appendChild(value);
      list.appendChild(li);
    });
    container.appendChild(list);
  }

  const stats = document.createElement('p');
  stats.className = 'records-stats';
  stats.textContent = `Mejor combo: ${data.bestCombo} · Líneas máximas: ${data.maxLines}`;
  container.appendChild(stats);
}

function saveCurrentScore() {
  if (!pendingResult) return;
  const data = loadRecords();
  const name = (playerNameInput.value || '').trim().slice(0, 12) || 'ANÓNIMO';
  const entry = { name, score: pendingResult.score, lines: pendingResult.lines, level: pendingResult.level, date: Date.now() };
  data.scores.push(entry);
  data.scores.sort((a, b) => b.score - a.score);
  data.scores = data.scores.slice(0, MAX_RECORDS);
  saveRecords(data);
  const index = data.scores.indexOf(entry);
  pendingResult = null;
  saveRow.classList.add('hidden');
  newRecordMsg.classList.add('hidden');
  renderRecords(gameoverRecordsEl, index);
  renderRecords(startRecordsEl, -1);
}

function resetRecords() {
  if (!confirm('¿Borrar todos los records?')) return;
  saveRecords(defaultRecords());
  renderRecords(startRecordsEl, -1);
  renderRecords(gameoverRecordsEl, -1);
}

/* ---------- Lógica de juego ---------- */

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
  return cleared;
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
  const cleared = clearLines();
  if (cleared > 0) {
    combo++;
    if (combo > maxCombo) maxCombo = combo;
  } else {
    combo = 0;
  }
  updateHUD();
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
  comboEl.textContent = combo;
  comboSection.classList.toggle('hidden', combo < 2);
}

/* ---------- Dibujo ---------- */

function drawBlock(context, x, y, colorIndex, size, alpha) {
  if (!colorIndex) return;
  const skin = SKINS[currentSkin] || SKINS.retro;
  const color = skin.colors[colorIndex];
  context.save();
  context.globalAlpha = alpha ?? 1;
  skin.draw(context, x * size, y * size, size, color);
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

  if (!current) return;

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
  if (!next) return;
  const shape = next.shape;
  const offX = Math.floor((4 - shape[0].length) / 2);
  const offY = Math.floor((4 - shape.length) / 2);
  for (let r = 0; r < shape.length; r++)
    for (let c = 0; c < shape[r].length; c++)
      drawBlock(nextCtx, offX + c, offY + r, shape[r][c], NB);
}

/* ---------- Paneles y estados ---------- */

function showPanel(name) {
  for (const key of Object.keys(panels)) {
    panels[key].classList.toggle('hidden', key !== name);
  }
  overlay.classList.remove('hidden');
}

function hideOverlay() {
  overlay.classList.add('hidden');
}

function goToStart() {
  state = 'start';
  cancelAnimationFrame(animId);
  renderRecords(startRecordsEl, -1);
  showPanel('start');
}

function startGame() {
  board = createBoard();
  score = 0;
  lines = 0;
  combo = 0;
  maxCombo = 0;
  level = startLevel;
  dropInterval = Math.max(100, 1000 - (level - 1) * 90);
  dropAccum = 0;
  pendingResult = null;
  cancelAnimationFrame(animId);
  hideOverlay();
  state = 'playing';
  next = randomPiece();
  spawn();
  updateHUD();
  draw();
  // spawn() puede terminar la partida al instante si la pieza ya colisiona.
  if (state !== 'playing') return;
  lastTime = performance.now();
  animId = requestAnimationFrame(loop);
}

function endGame() {
  state = 'gameover';
  cancelAnimationFrame(animId);

  const data = loadRecords();
  if (maxCombo > data.bestCombo) data.bestCombo = maxCombo;
  if (lines > data.maxLines) data.maxLines = lines;
  saveRecords(data);

  const isTop = qualifies(score);
  pendingResult = isTop ? { score, lines, level } : null;
  overlayScore.textContent = `Puntuación: ${score.toLocaleString()} · Líneas: ${lines} · Combo máx.: ${maxCombo}`;
  newRecordMsg.classList.toggle('hidden', !isTop);
  saveRow.classList.toggle('hidden', !isTop);
  playerNameInput.value = '';
  renderRecords(gameoverRecordsEl, -1);
  renderRecords(startRecordsEl, -1);
  showPanel('gameover');
  if (isTop) playerNameInput.focus();
}

function pauseGame() {
  if (state !== 'playing') return;
  state = 'paused';
  cancelAnimationFrame(animId);
  showPanel('pause');
}

function resumeGame() {
  if (state !== 'paused' && state !== 'controls') return;
  state = 'playing';
  hideOverlay();
  // Sin reiniciar lastTime, el primer frame tras reanudar vería un dt enorme.
  lastTime = performance.now();
  animId = requestAnimationFrame(loop);
}

function togglePause() {
  if (state === 'playing') pauseGame();
  else if (state === 'paused') resumeGame();
  else if (state === 'controls') { state = 'paused'; showPanel('pause'); }
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
  // lockPiece() puede terminar la partida; no reagendar fuera de 'playing'.
  if (state !== 'playing') return;
  animId = requestAnimationFrame(loop);
}

/* ---------- Tema y skin ---------- */

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
  drawNext();
}

function applySkin(name) {
  currentSkin = SKINS[name] ? name : 'retro';
  for (const key of Object.keys(SKINS)) {
    document.body.classList.toggle(`skin-${key}`, key === currentSkin);
  }
  skinSelect.value = currentSkin;
  updateThemeColors();
  draw();
  drawNext();
}

function changeSkin() {
  applySkin(skinSelect.value);
  storageSet(SKIN_KEY, currentSkin);
}

/* ---------- Nivel inicial ---------- */

function fillLevelSelect(select) {
  for (let i = 1; i <= MAX_LEVEL_OPTION; i++) {
    const option = document.createElement('option');
    option.value = String(i);
    option.textContent = String(i);
    select.appendChild(option);
  }
}

function setStartLevel(value) {
  const parsed = Math.min(MAX_LEVEL_OPTION, Math.max(1, parseInt(value, 10) || 1));
  startLevel = parsed;
  startLevelSel.value = String(parsed);
  pauseLevelSel.value = String(parsed);
  storageSet(START_LEVEL_KEY, String(parsed));
}

/* ---------- Init ---------- */

function init() {
  // El tablero debe existir antes de cualquier draw() disparado por skin o tema.
  board = createBoard();
  current = null;
  next = null;

  fillLevelSelect(startLevelSel);
  fillLevelSelect(pauseLevelSel);
  applyTheme(storageGet(THEME_KEY) === 'light');
  applySkin(storageGet(SKIN_KEY) || 'retro');
  setStartLevel(storageGet(START_LEVEL_KEY) || '1');

  score = 0;
  lines = 0;
  combo = 0;
  maxCombo = 0;
  level = startLevel;
  dropInterval = 1000;
  dropAccum = 0;
  updateHUD();
  draw();
  drawNext();
  goToStart();
}

/* ---------- Eventos ---------- */

document.addEventListener('keydown', e => {
  if (e.code === 'KeyP' || e.code === 'Escape') {
    // No secuestrar Escape mientras se escribe el nombre del record.
    if (document.activeElement === playerNameInput) return;
    togglePause();
    return;
  }
  // Con cualquier panel abierto, las teclas de juego quedan bloqueadas.
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

document.getElementById('play-btn').addEventListener('click', startGame);
document.getElementById('reset-records-btn').addEventListener('click', resetRecords);
document.getElementById('resume-btn').addEventListener('click', resumeGame);
document.getElementById('restart-btn').addEventListener('click', startGame);
document.getElementById('controls-btn').addEventListener('click', () => {
  state = 'controls';
  showPanel('controls');
});
document.getElementById('back-btn').addEventListener('click', () => {
  state = 'paused';
  showPanel('pause');
});
document.getElementById('save-record-btn').addEventListener('click', saveCurrentScore);
playerNameInput.addEventListener('keydown', e => {
  if (e.key === 'Enter') saveCurrentScore();
});
document.getElementById('gameover-restart-btn').addEventListener('click', startGame);
document.getElementById('gameover-home-btn').addEventListener('click', goToStart);

startLevelSel.addEventListener('change', () => setStartLevel(startLevelSel.value));
pauseLevelSel.addEventListener('change', () => setStartLevel(pauseLevelSel.value));
skinSelect.addEventListener('change', changeSkin);
themeSwitch.addEventListener('change', toggleTheme);

init();
