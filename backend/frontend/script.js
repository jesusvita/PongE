
// script.js

// —————— DOM Elements ——————
const menu       = document.getElementById('menu');
const startBtn   = document.getElementById('start-btn');
const waitingTxt = document.getElementById('waiting-text');
const canvas     = document.getElementById('pong');
const ctx        = canvas.getContext('2d');
const scoreboard = document.getElementById('scoreboard');
const popup      = document.getElementById('popup');
const popupMsg   = document.getElementById('popup-message');
const resultPopup = document.getElementById("result");
const resultMsg   = document.getElementById("result-message");
const rematchBtn  = document.getElementById("rematch-btn");

// —————— Canvas Setup ——————
canvas.width  = 600;
canvas.height = 400;
const CENTER_CIRCLE_RADIUS = Math.min(canvas.width, canvas.height) * 0.15;

// —————— Game State ——————
const paddleWidth  = 10;
const paddleHeight = 100;
const paddleSpeed  = 6;
const paddleMargin = 10; // distance from edge to paddles
let paddleY1   = (canvas.height - paddleHeight) / 2;
let paddleY2   = paddleY1;
let up         = false;
let down       = false;
const INITIAL_VX = 5;
const INITIAL_VY = 4;
let ball       = { x: canvas.width/2, y: canvas.height/2, vx: INITIAL_VX, vy: INITIAL_VY, radius: 8 };
let hitCount   = 0;
const MAX_HITS = 20;
const SPEED_MULT = 1.13;
let playerNumber  = 0;
let gameStarted    = false;
let countdownStart = 0;  // timestamp when the countdown began
let countdownEnd   = 0;  // timestamp when the countdown ends

let score1 = 0;
let score2 = 0;

// Ball appearance
const BALL_COLOR   = '#fff';

// Ball tail
const TAIL_LENGTH  = 10;
const TRAIL_ALPHA  = 0.4; // maximum opacity
let ballTrail      = [];

let rematchSent = false;
// For countdown animation
const COUNTDOWN_DURATION = 3000; // ms

// —————— Socket.IO Setup ——————
const socket = io("https://ponge.fly.dev", {
  transports: ["websocket"],
  path: "/socket.io"
});

socket.on("connect", () => console.log("✅ WS connected as", socket.id));
socket.on("connect_error", err => console.error("❌ WS error", err));

// Assign player number
socket.on("player-number", num => {
  playerNumber = num;
  console.log("You are player", num);
});

// Both here → enable Start
socket.on("start-game", () => {
  console.log("⇄ Both players connected");
  waitingTxt.textContent = "Opponent found! Player 1, click Start to begin";
  startBtn.disabled   = false;
});

// Player 1 clicks Start → tell server to begin
startBtn.addEventListener("click", () => {
  if (playerNumber === 1) {
    socket.emit("begin-game");
    startBtn.disabled = true;
    waitingTxt.textContent = "Starting game…";
  }
});

// Real kickoff
socket.on("game-started", () => {
    console.log("Game started");
    startGame();
});

// Opponent paddle updates
socket.on("opponent-paddle", data => {
  if (playerNumber === 2) paddleY1 = data.y;
  else                    paddleY2 = data.y;
});

// Ball updates
socket.on("ball-update", data => {
    if (playerNumber !== 1 && gameStarted) {
    ball = data;
    addToTrail(ball);
  }
});

// Score updates
socket.on("score-update", data => {
  score1 = data.score1;
  score2 = data.score2;
  updateScoreDisplay();
});

// Start countdown after a goal scored by opponent
socket.on("reset-round", () => {
  resetBall();
  startCountdown();
});

socket.on("player-disconnect", () => {
    showPopup("Your opponent disconnected, going back to main menu.");
    resetToMenu("Waiting for another player...");
    // hide popup after short delay
    setTimeout(hidePopup, 3000);
});
socket.on("rematch-start", () => {
  resultPopup.style.display = "none";
  rematchSent = false;
  startGame();
});

socket.on("game-over", data => {
  showResult(data.winner);
});

socket.on("became-player1", () => {
  playerNumber = 1;
  console.log("Promoted to player 1");
});

// —————— Input Handling ——————
document.addEventListener("keydown", e => {
  if (e.key === "ArrowUp"   || e.key === "w") up   = true;
  if (e.key === "ArrowDown" || e.key === "s") down = true;
});
document.addEventListener("keyup", e => {
  if (e.key === "ArrowUp"   || e.key === "w") up   = false;
  if (e.key === "ArrowDown" || e.key === "s") down = false;
});

// Touch controls for mobile
function handleTouch(e) {
  e.preventDefault();
  const touch = e.touches[0];
  const rect  = canvas.getBoundingClientRect();
  // Account for CSS scaling so the paddle aligns exactly
  const scaleY = canvas.height / rect.height;
  const y     = (touch.clientY - rect.top) * scaleY - paddleHeight / 2;
  if (playerNumber === 1) {
    paddleY1 = clamp(y, 0, canvas.height - paddleHeight);
    socket.emit("paddle-move", { y: paddleY1 });
  } else if (playerNumber === 2) {
    paddleY2 = clamp(y, 0, canvas.height - paddleHeight);
    socket.emit("paddle-move", { y: paddleY2 });
  }
}

canvas.addEventListener("touchstart", handleTouch, { passive: false });
canvas.addEventListener("touchmove",  handleTouch, { passive: false });

// —————— Main Loop ——————
function loop() {
  if (!gameStarted) return;
  updateState();
  render();
  requestAnimationFrame(loop);
}

// —————— Update Game State ——————

function updateState() {

  // <--- Move my paddle & emit --->
  if (playerNumber === 1) {
    if (up)   paddleY1 -= paddleSpeed;
    if (down) paddleY1 += paddleSpeed;
    paddleY1 = clamp(paddleY1, 0, canvas.height - paddleHeight);
    socket.emit("paddle-move", { y: paddleY1 });
  } else if (playerNumber === 2) {
    if (up)   paddleY2 -= paddleSpeed;
    if (down) paddleY2 += paddleSpeed;
    paddleY2 = clamp(paddleY2, 0, canvas.height - paddleHeight);
    socket.emit("paddle-move", { y: paddleY2 });
  }

  // Player 1 drives ball physics
  if (playerNumber === 1) {
  // Wait for countdown before moving the ball
    if (Date.now() < countdownEnd) {
      socket.emit("ball-move", ball); // keep positions in sync
      return;
    }
    ball.x += ball.vx;
    ball.y += ball.vy;
    addToTrail(ball);


    // Bounce off walls
    if (ball.y - ball.radius <= 0 || ball.y + ball.radius >= canvas.height) {
      ball.vy *= -1;
    }

    // Paddle collisions
    if (ball.x - ball.radius <= paddleMargin + paddleWidth &&
            ball.y >= paddleY1 && ball.y <= paddleY1 + paddleHeight) {
        ball.x = paddleMargin + paddleWidth + ball.radius; // avoid sticking
        bouncePaddle();
    }
    if (ball.x + ball.radius >= canvas.width - paddleMargin - paddleWidth &&
            ball.y >= paddleY2 && ball.y <= paddleY2 + paddleHeight) {
        ball.x = canvas.width - paddleMargin - paddleWidth - ball.radius;
        bouncePaddle();
    }

    // Score & reset
    if (ball.x + ball.radius < 0) {
        score2++;
        updateScoreDisplay();
        socket.emit("score-update", { score1, score2 });
        if (score2 >= 8) {
            gameStarted = false;
            socket.emit("game-over", { winner: 2 });
        } else {
            resetBall();
        }
        startCountdown();
        socket.emit("reset-round");
    } else if (ball.x - ball.radius > canvas.width) {
        score1++;
        updateScoreDisplay();
        socket.emit("score-update", { score1, score2 });
        if (score1 >= 8) {
            gameStarted = false;
            socket.emit("game-over", { winner: 1 });
        } else {
            resetBall();
        }
        startCountdown();
        socket.emit("reset-round");
    }

    // Broadcast to player 2
    if (gameStarted) socket.emit("ball-move", ball);
  }
}

// —————— Render Everything ——————

function render() {
  ctx.fillStyle = "#000";
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  // Draw field border and markings
  ctx.strokeStyle = "#0f0";
  ctx.lineWidth   = 2;
  ctx.strokeRect(0, 0, canvas.width, canvas.height);
  ctx.beginPath();
  ctx.moveTo(canvas.width / 2, 0);
  ctx.lineTo(canvas.width / 2, canvas.height);
  ctx.stroke();
  ctx.beginPath();
  ctx.arc(canvas.width / 2, canvas.height / 2, CENTER_CIRCLE_RADIUS, 0, Math.PI * 2);
  ctx.stroke();
  
  ctx.fillStyle = "#0f0";
  ctx.fillRect(paddleMargin, paddleY1, paddleWidth, paddleHeight);
  ctx.fillRect(canvas.width - paddleWidth - paddleMargin, paddleY2, paddleWidth, paddleHeight);

  // Draw ball trail
  ctx.fillStyle = BALL_COLOR;
  for (let i = 0; i < ballTrail.length; i++) {
    const pos    = ballTrail[i];
    const t      = (i + 1) / ballTrail.length;
    const alpha  = t * TRAIL_ALPHA;
    const radius = ball.radius * t;
    ctx.globalAlpha = alpha;
    ctx.beginPath();
    ctx.arc(pos.x, pos.y, radius, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.globalAlpha = 1;

  // Draw ball
  ctx.fillStyle = BALL_COLOR;
  ctx.shadowColor = BALL_COLOR;
  ctx.shadowBlur  = 10;
  ctx.beginPath();
  ctx.arc(ball.x, ball.y, ball.radius, 0, Math.PI * 2);
  ctx.fill();
  ctx.shadowBlur = 0;

  // Countdown overlay
  const now = Date.now();
  if (now < countdownEnd) {
    const remainingMs = countdownEnd - now;
    const remaining   = Math.ceil(remainingMs / 1000); // 3..1
    const elapsed     = (COUNTDOWN_DURATION - remainingMs) % 1000;
    const fraction    = elapsed / 1000;      
    const scale       = 0.5 + 0.5 * fraction;             // grow from 0.5× to 1×
    ctx.save();
    ctx.globalAlpha = fraction;                           // fade in
    ctx.fillStyle   = '#0f0';
    ctx.font        = `${96 * scale}px 'Press Start 2P', monospace`;
    ctx.textAlign   = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(remaining.toString(), canvas.width / 2, canvas.height / 2);
    ctx.restore();
  }
}

function updateScoreDisplay() {
  const score1El = document.getElementById('score1');
  const score2El = document.getElementById('score2');
  if (score1El) score1El.textContent = score1.toString();
  if (score2El) score2El.textContent = score2.toString();
}

function bouncePaddle() {
  let speed = Math.hypot(ball.vx, ball.vy);
  let angle = Math.atan2(ball.vy, ball.vx);
  angle = Math.PI - angle;
  angle += (Math.random() - 0.5) * 0.1; // tiny random variation
  if (hitCount < MAX_HITS) {
    speed *= SPEED_MULT;
    hitCount++;
  }
  ball.vx = speed * Math.cos(angle);
  ball.vy = speed * Math.sin(angle);
}

function resetBall() {
  ball.x  = canvas.width  / 2;
  ball.y  = canvas.height / 2;
  ball.vx = ball.vx > 0 ? -INITIAL_VX : INITIAL_VX;
  ball.vy = INITIAL_VY;
  hitCount = 0;
  ballTrail = [];
}

function startCountdown() {
  countdownStart = Date.now();
  countdownEnd   = countdownStart + COUNTDOWN_DURATION;
}

// —————— Utility ——————
function clamp(v, min, max) {
  return v < min ? min : v > max ? max : v;
}

function addToTrail(pos) {
  ballTrail.push({ x: pos.x, y: pos.y });
  if (ballTrail.length > TAIL_LENGTH) ballTrail.shift();
}


// Show a popup message in the center of the screen
function showPopup(msg) {
  popupMsg.textContent = msg;
  popup.style.display = 'block';
}

function hidePopup() {
  popup.style.display = 'none';
}

// Return to the menu screen
function resetToMenu(message) {
  gameStarted = false;
  menu.style.display = 'block';
  scoreboard.style.display = 'none';
  canvas.style.display = 'none';
  startBtn.disabled = true;
  waitingTxt.textContent = message || 'Waiting for another player...';
}

function startGame() {
  menu.style.display = "none";
  scoreboard.style.display = "block";
  canvas.style.display = "block";
  gameStarted    = true;
  countdownStart = Date.now();
  countdownEnd   = countdownStart + COUNTDOWN_DURATION;
  ball.x = canvas.width / 2;
  ball.y = canvas.height / 2;
  score1 = 0;
  score2 = 0;
  updateScoreDisplay();
  requestAnimationFrame(loop);
}

function showResult(winner) {
  gameStarted = false;
  resultPopup.style.display = 'block';
  resultMsg.textContent = (playerNumber === winner) ? 'Winner' : 'Loser';
  rematchBtn.disabled = false;
}

rematchBtn.addEventListener('click', () => {
  if (!rematchSent) {
    rematchSent = true;
    rematchBtn.disabled = true;
    resultMsg.textContent = 'Waiting for opponent...';
    socket.emit('rematch');
  }
});
