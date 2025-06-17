const io = require('socket.io')(3000, {
  cors: {
    origin: '*'
  }
});

console.log('Server started, listening on port 3000');

io.on('connection', (socket) => {
  console.log(`User connected: ${socket.id}`);

  socket.on('disconnect', () => {
    console.log(`User disconnected: ${socket.id}`);
  });
});

let players = {};

io.on('connection', (socket) => {
  console.log(`User connected: ${socket.id}`);

  // Assign player number
  const playerNumber = Object.keys(players).length < 1 ? 1 : 2;
  players[socket.id] = playerNumber;
  socket.emit('player-number', playerNumber);

  // Notify both players when ready
  if (Object.keys(players).length === 2) {
    io.emit('start-game');
  }

  // Handle paddle movement
  socket.on('paddle-move', (data) => {
    socket.broadcast.emit('opponent-paddle', data);
  });

  // Handle ball movement from host
  socket.on('ball-move', (data) => {
    socket.broadcast.emit('ball-update', data);
  });

  // On disconnect
  socket.on('disconnect', () => {
    delete players[socket.id];
    io.emit('player-disconnect');
    console.log(`User disconnected: ${socket.id}`);
  });
});
