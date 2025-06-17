const socket = io("https://ponge.fly.dev/"); // Replace with your deployed server

let playerNumber = 0;
socket.on('player-number', (num) => {
  playerNumber = num;
  console.log(`You are player ${num}`);
});

socket.on('opponent-paddle', (data) => {
  opponentY = data.y;
});

socket.on('ball-update', (ballData) => {
  if (playerNumber !== 1) {
    ball = ballData;
  }
});

socket.on('start-game', () => {
  console.log('Game start!');
  // Show game screen or enable controls
});

socket.on('player-disconnect', () => {
  alert("Opponent left the game.");
});
