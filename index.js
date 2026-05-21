// server/index.js
const express = require('express');
const http = require('http');
const { Server } = require('socket.io');

const app = express();
const server = http.createServer(app);
const io = new Server(server, { cors: { origin: '*' } });

const lobbies = new Map();

app.get('/', (req, res) => res.send('DAUN Fighter Server Online'));

io.on('connection', (socket) => {
  console.log('User connected:', socket.id);

  socket.on('createLobby', (data) => {
    const { lobbyName, maxPlayers, map, playerName } = data;
    const lobbyId = socket.id + Date.now().toString(36);
    const lobby = {
      id: lobbyId,
      name: lobbyName,
      maxPlayers,
      map,
      players: [{ id: socket.id, name: playerName, x: 100, y: 200, hp: 100, team: 0 }],
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
    if (!lobby || lobby.players.length >= lobby.maxPlayers) {
      socket.emit('joinError', 'Лобби заполнено или не существует');
      return;
    }
    const newPlayer = {
      id: socket.id,
      name: playerName,
      x: lobby.players.length % 2 === 0 ? 100 : 400,
      y: 200,
      hp: 100,
      team: lobby.players.length % 2
    };
    lobby.players.push(newPlayer);
    socket.join(lobbyId);
    socket.lobbyId = lobbyId;
    socket.emit('joinedLobby', lobby);
    io.to(lobbyId).emit('lobbyUpdated', lobby);
    io.emit('lobbyListUpdate', getLobbyList());

    if (lobby.players.length === lobby.maxPlayers) {
      lobby.state = 'playing';
      io.to(lobbyId).emit('gameStart', lobby);
      io.emit('lobbyListUpdate', getLobbyList());
    }
  });

  socket.on('playerMove', (data) => {
    const lobbyId = socket.lobbyId;
    if (!lobbyId || !lobbies.has(lobbyId)) return;
    const lobby = lobbies.get(lobbyId);
    if (lobby.state !== 'playing') return;
    const player = lobby.players.find(p => p.id === socket.id);
    if (player) {
      player.x = data.x;
      player.y = data.y;
      player.direction = data.direction;
    }
    socket.to(lobbyId).emit('playerMoved', { id: socket.id, x: data.x, y: data.y, direction: data.direction });
  });

  socket.on('playerAttack', (data) => {
    const lobbyId = socket.lobbyId;
    if (!lobbyId || !lobbies.has(lobbyId)) return;
    const lobby = lobbies.get(lobbyId);
    if (lobby.state !== 'playing') return;
    socket.to(lobbyId).emit('playerAttacked', { attackerId: socket.id, x: data.x, y: data.y, direction: data.direction });
    // Простейшая проверка попадания
    lobby.players.forEach(target => {
      if (target.id === socket.id || target.hp <= 0) return;
      const dx = target.x - data.x;
      const dy = target.y - data.y;
      if (Math.abs(dx) < 60 && Math.abs(dy) < 60) {
        target.hp = Math.max(0, target.hp - 10);
        io.to(lobbyId).emit('playerDamaged', { id: target.id, hp: target.hp });
        if (target.hp <= 0) io.to(lobbyId).emit('playerKilled', { id: target.id });
      }
    });
  });

  socket.on('disconnect', () => {
    const lobbyId = socket.lobbyId;
    if (lobbyId && lobbies.has(lobbyId)) {
      const lobby = lobbies.get(lobbyId);
      lobby.players = lobby.players.filter(p => p.id !== socket.id);
      if (lobby.players.length === 0) lobbies.delete(lobbyId);
      else {
        io.to(lobbyId).emit('playerLeft', { id: socket.id });
        if (lobby.state === 'playing') {
          lobby.state = 'waiting';
          io.to(lobbyId).emit('gameStop');
        }
      }
      io.emit('lobbyListUpdate', getLobbyList());
    }
  });
});

function getLobbyList() {
  return Array.from(lobbies.values()).map(l => ({
    id: l.id, name: l.name, map: l.map,
    players: l.players.length, maxPlayers: l.maxPlayers, state: l.state
  }));
}

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => console.log(`Server running on port ${PORT}`));
