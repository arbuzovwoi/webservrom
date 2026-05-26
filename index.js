const express = require('express');
const http = require('http');
const { Server } = require('socket.io');

const app = express();
const server = http.createServer(app);
const io = new Server(server, { cors: { origin: '*' } });

const lobbies = new Map();

app.get('/', (req, res) => res.send('DAUN Fighter Server Online'));

function getLobbyList() {
  return Array.from(lobbies.values())
    .filter(l => l.state === 'waiting')
    .map(l => ({ id: l.id, name: l.name, players: l.players.length, maxPlayers: l.maxPlayers, mode: l.mode }));
}

io.on('connection', (socket) => {
  console.log('User connected:', socket.id);

  socket.emit('lobbyList', getLobbyList());

  socket.on('getLobbies', () => {
    socket.emit('lobbyList', getLobbyList());
  });

  socket.on('createLobby', (data) => {
    const { lobbyName, maxPlayers, map, playerName, mode } = data;
    const lobbyId = socket.id + Date.now().toString(36);
    const lobby = {
      id: lobbyId,
      name: lobbyName,
      maxPlayers: maxPlayers || 2,
      map,
      mode: mode || '1v1',
      players: [{ id: socket.id, name: playerName, hp: 100, isHost: true }],
      state: 'waiting',
    };
    lobbies.set(lobbyId, lobby);
    socket.join(lobbyId);
    socket.lobbyId = lobbyId;
    socket.emit('lobbyCreated', { lobby });
    io.emit('lobbyListUpdate', getLobbyList());
    
    // Если лобби рассчитано на 1 игрока (бот?), но обычно нет, но на всякий случай
    if (lobby.players.length >= lobby.maxPlayers) {
      lobby.state = 'playing';
      io.to(lobby.id).emit('gameStart', { lobby });
      io.emit('lobbyListUpdate', getLobbyList());
    }
  });

  socket.on('joinLobby', ({ lobbyId, playerName }) => {
    const lobby = lobbies.get(lobbyId);
    if (!lobby || lobby.players.length >= lobby.maxPlayers || lobby.state !== 'waiting') {
      socket.emit('error', 'Невозможно присоединиться к лобби');
      return;
    }
    lobby.players.push({ id: socket.id, name: playerName, hp: 100, isHost: false });
    socket.join(lobbyId);
    socket.lobbyId = lobbyId;
    socket.emit('joinedLobby', lobby);
    io.to(lobbyId).emit('lobbyUpdated', lobby);
    io.emit('lobbyListUpdate', getLobbyList());
    
    // АВТОСТАРТ: если набралось максимальное количество игроков, начинаем игру
    if (lobby.players.length >= lobby.maxPlayers) {
      lobby.state = 'playing';
      io.to(lobby.id).emit('gameStart', { lobby });
      io.emit('lobbyListUpdate', getLobbyList());
    }
  });

  socket.on('startGame', () => {
    const lobby = lobbies.get(socket.lobbyId);
    if (lobby && lobby.players[0].id === socket.id) {
      lobby.state = 'playing';
      io.to(lobby.id).emit('gameStart', { lobby });
      io.emit('lobbyListUpdate', getLobbyList());
    }
  });

  socket.on('syncClient', (data) => {
    socket.to(socket.lobbyId).emit('syncServer', { id: socket.id, ...data });
  });

  socket.on('shoot', (data) => {
    socket.to(socket.lobbyId).emit('enemyShoot', { id: socket.id, ...data });
  });

  socket.on('leaveLobby', ({ lobbyId }) => {
    const lobby = lobbies.get(lobbyId);
    if (lobby) {
      lobby.players = lobby.players.filter(p => p.id !== socket.id);
      socket.leave(lobbyId);
      if (lobby.players.length === 0) {
        lobbies.delete(lobbyId);
      } else {
        io.to(lobbyId).emit('lobbyUpdated', lobby);
        io.to(lobbyId).emit('playerLeft', socket.id);
      }
      io.emit('lobbyListUpdate', getLobbyList());
    }
    socket.lobbyId = null;
  });

  socket.on('disconnect', () => {
    const lobby = lobbies.get(socket.lobbyId);
    if (lobby) {
      lobby.players = lobby.players.filter(p => p.id !== socket.id);
      if (lobby.players.length === 0) {
        lobbies.delete(socket.lobbyId);
      } else {
        io.to(socket.lobbyId).emit('lobbyUpdated', lobby);
        io.to(socket.lobbyId).emit('playerLeft', socket.id);
      }
      io.emit('lobbyListUpdate', getLobbyList());
    }
  });
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => console.log(`Server running on port ${PORT}`));
