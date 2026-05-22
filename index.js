// server/index.js
const express = require('express');
const http = require('http');
const { Server } = require('socket.io');

const app = express();
const server = http.createServer(app);
const io = new Server(server, { cors: { origin: '*' } });

const lobbies = new Map();

app.get('/', (req, res) => res.send('DAUN Fighter Server Online'));

function getLobbyList() {
  return Array.from(lobbies.values()).map(l => ({
    id: l.id, name: l.name, map: l.map,
    players: l.players.length, maxPlayers: l.maxPlayers, state: l.state
  }));
}

io.on('connection', (socket) => {
  socket.on('createLobby', (data) => {
    const lobbyId = socket.id + Date.now().toString(36);
    const lobby = {
      id: lobbyId,
      name: data.lobbyName || 'Лобби',
      maxPlayers: data.maxPlayers || 2,
      map: data.map || 'canyon',
      players: [{ id: socket.id, name: data.playerName }],
      state: 'waiting',
    };
    lobbies.set(lobbyId, lobby);
    socket.join(lobbyId);
    socket.lobbyId = lobbyId;
    socket.emit('lobbyCreated', { lobby });
    io.emit('lobbyListUpdate', getLobbyList());
  });

  socket.on('getLobbies', () => socket.emit('lobbyList', getLobbyList()));

  socket.on('joinLobby', ({ lobbyId, playerName }) => {
    const lobby = lobbies.get(lobbyId);
    if (!lobby || lobby.players.length >= lobby.maxPlayers || lobby.state === 'playing') {
      socket.emit('joinError', 'Лобби заполнено');
      return;
    }
    lobby.players.push({ id: socket.id, name: playerName });
    socket.join(lobbyId);
    socket.lobbyId = lobbyId;
    io.to(lobbyId).emit('lobbyUpdated', lobby);

    if (lobby.players.length === lobby.maxPlayers) {
      lobby.state = 'playing';
      io.to(lobbyId).emit('gameStart', lobby);
    }
    io.emit('lobbyListUpdate', getLobbyList());
  });

  // НОВАЯ СИНХРОНИЗАЦИЯ
  socket.on('syncClient', (data) => {
    const lobbyId = socket.lobbyId;
    if (lobbyId && lobbies.has(lobbyId)) {
      socket.to(lobbyId).emit('syncServer', { id: socket.id, ...data });
    }
  });

  socket.on('shoot', (data) => {
    const lobbyId = socket.lobbyId;
    if (lobbyId && lobbies.has(lobbyId)) {
      socket.to(lobbyId).emit('enemyShoot', { id: socket.id, ...data });
    }
  });

  socket.on('disconnect', () => {
    const lobbyId = socket.lobbyId;
    if (lobbyId && lobbies.has(lobbyId)) {
      const lobby = lobbies.get(lobbyId);
      lobby.players = lobby.players.filter(p => p.id !== socket.id);
      if (lobby.players.length === 0) {
        lobbies.delete(lobbyId);
      } else {
        io.to(lobbyId).emit('playerLeft', { id: socket.id });
        lobby.state = 'waiting';
        io.to(lobbyId).emit('gameStop');
      }
      io.emit('lobbyListUpdate', getLobbyList());
    }
  });
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => console.log(`Server running on port ${PORT}`));
