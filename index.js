// server/index.js
const express = require('express');
const http = require('http');
const { Server } = require('socket.io');

const app = express();
const server = http.createServer(app);
const io = new Server(server, { cors: { origin: '*' } });

const lobbies = new Map();

app.get('/', (req, res) => res.send('DAUN Fighter Server Online'));

// Функция для списка лобби (показываем только те, что ждут игроков)
function getLobbyList() {
  return Array.from(lobbies.values())
    .filter(l => l.state === 'waiting')
    .map(l => ({ id: l.id, name: l.name, playersCount: l.players.length, maxPlayers: l.maxPlayers, mode: l.mode }));
}

io.on('connection', (socket) => {
  console.log('User connected:', socket.id);

  // 1. Система пинга
  socket.on('ping', () => socket.emit('pong'));

  // 2. Создание лобби с выбором режима
  socket.on('createLobby', (data) => {
    const { lobbyName, maxPlayers, map, playerName, mode } = data;
    const lobbyId = socket.id + Date.now().toString(36);
    const lobby = {
      id: lobbyId,
      name: lobbyName,
      maxPlayers: mode === 'br' ? 6 : maxPlayers, // BR всегда до 6
      map,
      mode: mode || 'normal',
      players: [{ id: socket.id, name: playerName, hp: 100, isHost: true }],
      state: 'waiting', // Состояние ожидания
    };
    lobbies.set(lobbyId, lobby);
    socket.join(lobbyId);
    socket.lobbyId = lobbyId;
    
    // Отправляем создателя в комнату ожидания
    socket.emit('lobbyJoined', { lobby });
    io.emit('lobbyListUpdate', getLobbyList());
  });

  // 3. Присоединение к комнате
  socket.on('joinLobby', ({ lobbyId, playerName }) => {
    const lobby = lobbies.get(lobbyId);
    if (!lobby || lobby.players.length >= lobby.maxPlayers || lobby.state !== 'waiting') return;

    lobby.players.push({ id: socket.id, name: playerName, hp: 100, isHost: false });
    socket.join(lobbyId);
    socket.lobbyId = lobbyId;

    // Обновляем UI комнаты для ВСЕХ в лобби
    io.to(lobbyId).emit('roomUpdate', { lobby });
    io.emit('lobbyListUpdate', getLobbyList());
  });

  // 4. Запуск игры хостом
  socket.on('startGame', () => {
    const lobby = lobbies.get(socket.lobbyId);
    if (lobby && lobby.players[0].id === socket.id) { // Проверяем, что нажал хост
      lobby.state = 'playing';
      // Генерируем случайный сид карты прямо здесь, чтобы у всех лут лежал одинаково
      lobby.seed = Math.random(); 
      io.to(lobby.id).emit('gameStart', { lobby });
      io.emit('lobbyListUpdate', getLobbyList());
    }
  });

  // Остальные базовые события (движение, урон, дисконнект) оставляй как были:
  socket.on('playerMove', (data) => {
    socket.to(socket.lobbyId).emit('playerMoved', { id: socket.id, ...data });
  });

  socket.on('disconnect', () => {
    const lobby = lobbies.get(socket.lobbyId);
    if (lobby) {
      lobby.players = lobby.players.filter(p => p.id !== socket.id);
      if (lobby.players.length === 0) lobbies.delete(socket.lobbyId);
      else io.to(socket.lobbyId).emit('roomUpdate', { lobby });
    }
  });
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => console.log(`Server running on port ${PORT}`));
