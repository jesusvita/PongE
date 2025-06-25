
// backend/server.js

const express = require('express');
const http    = require('http');
const path    = require('path');
const { Server } = require('socket.io');

const app    = express();
const server = http.createServer(app);

// Configure Socket.IO with CORS so your front-end can connect
const io = new Server(server, {
  cors: { origin: '*' }
});

const PORT = process.env.PORT || 8080;

// Track connected players by socket ID
let players = {};

// Serve your static front-end from ./frontend
app.use(express.static(path.join(__dirname, 'frontend')));

// Start the server
server.listen(PORT, '0.0.0.0', () => {
  console.log(`Server started, listening on port ${PORT}`);
});

io.on('connection', socket => {
  console.log(`🔌 User connected: ${socket.id}`);

  // 1) Assign each new socket a player number
  const playerNumber = Object.keys(players).length < 1 ? 1 : 2;
  players[socket.id] = playerNumber;
  socket.emit('player-number', playerNumber);
  console.log(`→ Assigned Player ${playerNumber}`);

  // 2) As soon as the second player arrives, emit start-game
  if (Object.keys(players).length === 2) {
    console.log('🌐 Both players connected – emitting start-game');
    io.emit('start-game');
  }

  // 3) Relay paddle moves
  socket.on('paddle-move', data => {
    socket.broadcast.emit('opponent-paddle', data);
  });

  // 4) Relay ball updates
  socket.on('ball-move', data => {
    socket.broadcast.emit('ball-update', data);
  });

  // Relay score updates
  socket.on('score-update', data => {
    socket.broadcast.emit('score-update', data);
  });
  
  // 5) When Player 1 clicks Start, kick off the match
  socket.on('begin-game', () => {
    if (players[socket.id] === 1) {
      console.log('▶️ Player 1 clicked Start – emitting game-started');
      io.emit('game-started');
    }
  });

  // 6) Clean up on disconnect
  socket.on('disconnect', () => {
    console.log(`❌ User disconnected: ${socket.id}`);
    delete players[socket.id];
    
    // If one player remains, promote them to Player 1
    const ids = Object.keys(players);
    if (ids.length === 1) {
      const remainingId = ids[0];
      players[remainingId] = 1;
      io.to(remainingId).emit('became-player1');
    }

    io.emit('player-disconnect');
  });
});
