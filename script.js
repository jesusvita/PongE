const canvas = document.getElementById("pong");
const context = canvas.getContext("2d");

canvas.width = 800;
canvas.height = 400;

let paddleHeight = 100;
let playerY = canvas.height / 2 - paddleHeight / 2;
let computerY = canvas.height / 2 - paddleHeight / 2;
let ball = { x: 400, y: 200, dx: 4, dy: 4, size: 10 };

function drawRect(x, y, w, h, color) {
  context.fillStyle = color;
  context.fillRect(x, y, w, h);
}

function drawBall() {
  context.beginPath();
  context.arc(ball.x, ball.y, ball.size, 0, Math.PI * 2);
  context.fillStyle = "#fff";
  context.fill();
  context.closePath();
}

function update() {
  ball.x += ball.dx;
  ball.y += ball.dy;

  // bounce off top/bottom
  if (ball.y < 0 || ball.y > canvas.height) ball.dy *= -1;

  // bounce off paddles
  if (
    ball.x < 20 &&
    ball.y > playerY &&
    ball.y < playerY + paddleHeight
  ) ball.dx *= -1;

  if (
    ball.x > canvas.width - 20 &&
    ball.y > computerY &&
    ball.y < computerY + paddleHeight
  ) ball.dx *= -1;

  // reset if ball goes out
  if (ball.x < 0 || ball.x > canvas.width) {
    ball.x = canvas.width / 2;
    ball.y = canvas.height / 2;
    ball.dx *= -1;
  }

  // basic AI
  if (computerY + paddleHeight / 2 < ball.y) computerY += 3;
  else computerY -= 3;
}

function render() {
  drawRect(0, 0, canvas.width, canvas.height, "black");
  drawRect(10, playerY, 10, paddleHeight, "white");
  drawRect(canvas.width - 20, computerY, 10, paddleHeight, "white");
  drawBall();
}

function gameLoop() {
  update();
  render();
  requestAnimationFrame(gameLoop);
}

document.addEventListener("mousemove", (e) => {
  const rect = canvas.getBoundingClientRect();
  playerY = e.clientY - rect.top - paddleHeight / 2;
});

gameLoop();
