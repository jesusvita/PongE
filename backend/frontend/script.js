
// script.js

// —————— DOM Elements ——————
const menu       = document.getElementById('menu');
const startBtn   = document.getElementById('start-btn');
const waitingTxt = document.getElementById('waiting-text');
const canvas     = document.getElementById('pong');
const ctx        = canvas.getContext('2d');
const score1E1   = document.getElementById('score1');
const score2E2   = document.getElementById('score2');

// —————— Canvas Setup ——————
canvas.width  = 800;
canvas.height = 600;

// —————— Game State ——————
const paddleWidth  = 10;
const paddleHeight = 100;
const paddleSpeed  = 6;
let paddleY1   = (canvas.height - paddleHeight) / 2;
let paddleY2   = paddleY1;
let up         = false;
let down       = false;
let ball       = { x: canvas.width/2, y: canvas.height/2, vx: 5, vy: 4, radius: 8 };
let playerNumber  = 0;
let gameStarted    = false;
let countdownStart = 0;  // timestamp when the countdown began
let countdownEnd   = 0;  // timestamp when the countdown ends

let score1 = 0;
let score2 = 0;

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
  console.log("▶️ Game actually started!");
  menu.style.display = "none";
  gameStarted    = true;
  countdownStart = Date.now();                  // mark countdown start
  countdownEnd   = countdownStart + COUNTDOWN_DURATION; // when to release ball
  ball.x = canvas.width / 2;             // ensure ball starts centered
  ball.y = canvas.height / 2;
  score1 = 0;
  score2 = 0;
  updatesScoreDIsplay();
  requestAnimationFrame(loop);
});

// Opponent paddle updates
socket.on("opponent-paddle", data => {
  if (playerNumber === 2) paddleY1 = data.y;
  else                    paddleY2 = data.y;
});

// Ball updates
socket.on("ball-update", data => {
  if (playerNumber !== 1 && gameStarted) ball = data;
});

// Score updates
socket.on("score-update", data => {
  score1 = data.score1;
  score2 = data.score2;
  updateScoreDisplay();
});

socket.on("player-disconnect", () => {
  alert("Opponent left. Refresh to re-match.");
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

    // Bounce off walls
    if (ball.y - ball.radius <= 0 || ball.y + ball.radius >= canvas.height) {
      ball.vy *= -1;
    }

    // Paddle collisions
    if (ball.x - ball.radius <= paddleWidth &&
        ball.y >= paddleY1 && ball.y <= paddleY1 + paddleHeight) {
      ball.vx *= -1;
    }
    if (ball.x + ball.radius >= canvas.width - paddleWidth &&
        ball.y >= paddleY2 && ball.y <= paddleY2 + paddleHeight) {
      ball.vx *= -1;
    }

    // Score & reset
    if (ball.x + ball.radius < 0) {
        score2++;
        updateScoreDisplay();
        socket.emit("score-update", { score1, score2 });
        resetBall();
    } else if (ball.x - ball.radius > canvas.width) {
        score1++;
        updateScoreDisplay();
        socket.emit("score-update", { score1, score2 });
        resetBall();
    }

    // Broadcast to player 2
    socket.emit("ball-move", ball);
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
  ctx.arc(canvas.width / 2, canvas.height / 2, 70, 0, Math.PI * 2);
  ctx.stroke();
  
  ctx.fillStyle = "#0f0";
  ctx.fillRect(0, paddleY1, paddleWidth, paddleHeight);
  ctx.fillRect(canvas.width - paddleWidth, paddleY2, paddleWidth, paddleHeight);

  ctx.beginPath();
  ctx.arc(ball.x, ball.y, ball.radius, 0, Math.PI * 2);
  ctx.fill();


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
  score1El.textContent = score1.toString();
  score2El.textContent = score2.toString();
}

function resetBall() {
  ball.x  = canvas.width  / 2;
  ball.y  = canvas.height / 2;
  ball.vx = -ball.vx;
}

// —————— Utility ——————
function clamp(v, min, max) {
  return v < min ? min : v > max ? max : v;
}
