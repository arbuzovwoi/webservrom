// server/index.js
const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const path = require('path');

const app = express();
const server = http.createServer(app);
const io = new Server(server, {
  cors: { origin: '*' } // В продакшене укажи домен Netlify
});

// Хранилище лобби: { lobbyId: { players: [{id, name, x, y, ...}], map: 'city', maxPlayers: 2, ... } }
const lobbies = new Map();

app.use(express.static('public'));

// Отдаём клиент (можно не использовать, если клиент на Netlify)
app.get('/', (req, res) => {
  res.send('DAUN Fighter Server Online');
});

io.on('connection', (socket) => {
  console.log('user connected:', socket.id);

  // Создать лобби
  socket.on('createLobby', (data) => {
    const { lobbyName, maxPlayers, map, playerName } = data;
    const lobbyId = socket.id + Date.now().toString(36); // уникальный
    lobbies.set(lobbyId, {
      id: lobbyId,
      name: lobbyName,
      maxPlayers,
      map,
      players: [{ id: socket.id, name: playerName, x: 100, y: 200, hp: 100, team: 0 }],
      state: 'waiting', // waiting, playing
    });
    socket.join(lobbyId);
    socket.lobbyId = lobbyId;
    socket.emit('lobbyCreated', { lobbyId, lobby: lobbies.get(lobbyId) });
    io.emit('lobbyListUpdate', getLobbyList());
  });

  // Получить список лобби
  socket.on('getLobbies', () => {
    socket.emit('lobbyList', getLobbyList());
  });

  // Присоединиться к лобби
  socket.on('joinLobby', ({ lobbyId, playerName }) => {
    const lobby = lobbies.get(lobbyId);
    if (!lobby || lobby.players.length >= lobby.maxPlayers) {
      socket.emit('joinError', 'Лобби заполнено или не существует');
      return;
    }
    // Добавляем игрока
    lobby.players.push({ id: socket.id, name: playerName, x: 400, y: 200, hp: 100, team: lobby.players.length % 2 }); // команды чередуем
    socket.join(lobbyId);
    socket.lobbyId = lobbyId;
    // Если набралось нужное количество, запускаем игру
    if (lobby.players.length === lobby.maxPlayers) {
      lobby.state = 'playing';
      io.to(lobbyId).emit('gameStart', lobby);
    }
    io.emit('lobbyListUpdate', getLobbyList());
    socket.emit('joinedLobby', lobby);
  });

  // Игровые данные: движение, удар
  socket.on('playerMove', (data) => {
    const lobbyId = socket.lobbyId;
    if (!lobbyId) return;
    const lobby = lobbies.get(lobbyId);
    if (!lobby || lobby.state !== 'playing') return;
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
    if (!lobbyId) return;
    const lobby = lobbies.get(lobbyId);
    if (!lobby || lobby.state !== 'playing') return;
    // Передаём удар всем, кроме отправителя
    socket.to(lobbyId).emit('playerAttacked', {
      attackerId: socket.id,
      x: data.x,
      y: data.y,
      direction: data.direction,
      damage: 10,
    });
    // Проверяем попадание (простая логика на сервере)
    lobby.players.forEach(target => {
      if (target.id === socket.id) return;
      const dx = target.x - data.x;
      const dy = target.y - data.y;
      const dist = Math.sqrt(dx*dx + dy*dy);
      if (dist < 60 && Math.abs(dy) < 50) { // хитбокс
        target.hp -= 10;
        io.to(lobbyId).emit('playerDamaged', { id: target.id, hp: target.hp });
        if (target.hp <= 0) {
          io.to(lobbyId).emit('playerKilled', { id: target.id });
          // Можно добавить респаун позже
        }
      }
    });
  });

  socket.on('disconnect', () => {
    const lobbyId = socket.lobbyId;
    if (lobbyId && lobbies.has(lobbyId)) {
      const lobby = lobbies.get(lobbyId);
      lobby.players = lobby.players.filter(p => p.id !== socket.id);
      if (lobby.players.length === 0) {
        lobbies.delete(lobbyId);
      } else {
        // Уведомить оставшихся
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
  const list = [];
  for (let [id, lobby] of lobbies) {
    list.push({
      id: lobby.id,
      name: lobby.name,
      map: lobby.map,
      players: lobby.players.length,
      maxPlayers: lobby.maxPlayers,
      state: lobby.state,
    });
  }
  return list;
}

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => console.log(`Server on port ${PORT}`));