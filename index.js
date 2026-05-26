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
  return Array.from(lobbies.values())
    .filter(l => l.state === 'waiting')
    .map(l => ({ id: l.id, name: l.name, players: l.players.length, maxPlayers: l.maxPlayers, mode: l.mode }));
}

io.on('connection', (socket) => {
  console.log('User connected:', socket.id);

  socket.on('createLobby', (data) => {
    const { lobbyName, maxPlayers, map, playerName, mode } = data;
    const lobbyId = socket.id + Date.now().toString(36);
    const lobby = {
      id: lobbyId,
      name: lobbyName,
      maxPlayers: mode === 'br' ? 6 : (maxPlayers || 2),
      map,
      mode: mode || 'normal',
      players: [{ id: socket.id, name: playerName, hp: 100, isHost: true }],
      state: 'waiting',
      seed: Math.random()
    };
    lobbies.set(lobbyId, lobby);
    socket.join(lobbyId);
    socket.lobbyId = lobbyId;
    
    // Отправляем создателю событие lobbyCreated
    socket.emit('lobbyCreated', { lobby });
    // Обновляем список лобби для всех
    io.emit('lobbyListUpdate', getLobbyList());
  });

  socket.on('joinLobby', ({ lobbyId, playerName }) => {
    const lobby = lobbies.get(lobbyId);
    if (!lobby || lobby.players.length >= lobby.maxPlayers || lobby.state !== 'waiting') {
      socket.emit('joinError', { message: 'Cannot join lobby' });
      return;
    }

    lobby.players.push({ id: socket.id, name: playerName, hp: 100, isHost: false });
    socket.join(lobbyId);
    socket.lobbyId = lobbyId;

    // Отправляем присоединившемуся событие joinedLobby
    socket.emit('joinedLobby', lobby);
    // Всем остальным в комнате отправляем lobbyUpdated
    socket.to(lobbyId).emit('lobbyUpdated', lobby);
    // Обновляем список лобби
    io.emit('lobbyListUpdate', getLobbyList());
  });

  socket.on('startGame', () => {
    const lobby = lobbies.get(socket.lobbyId);
    if (lobby && lobby.players[0].id === socket.id) {
      lobby.state = 'playing';
      io.to(lobby.id).emit('gameStart', { lobby });
      io.emit('lobbyListUpdate', getLobbyList());
    }
  });

  // Синхронизация движения, стрельбы и т.д.
  socket.on('syncClient', (data) => {
    socket.to(socket.lobbyId).emit('syncServer', { id: socket.id, ...data });
  });

  socket.on('shoot', (data) => {
    socket.to(socket.lobbyId).emit('enemyShoot', data);
  });

  socket.on('disconnect', () => {
    const lobby = lobbies.get(socket.lobbyId);
    if (lobby) {
      lobby.players = lobby.players.filter(p => p.id !== socket.id);
      if (lobby.players.length === 0) {
        lobbies.delete(socket.lobbyId);
      } else {
        // Уведомляем остальных об изменении состава
        io.to(socket.lobbyId).emit('lobbyUpdated', lobby);
        // Если игра уже началась, отправляем сигнал о выходе
        if (lobby.state === 'playing') {
          io.to(socket.lobbyId).emit('playerLeft', { id: socket.id });
        }
      }
      io.emit('lobbyListUpdate', getLobbyList());
    }
  });
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => console.log(`Server running on port ${PORT}`));
