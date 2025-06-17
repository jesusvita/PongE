function gameLoop() {
  updateGame();  // your game update logic
  renderGame();  // your drawing/render logic
  requestAnimationFrame(gameLoop);
}
gameLoop();

