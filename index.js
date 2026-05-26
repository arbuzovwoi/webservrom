const express = require('express```javascript
const express = require('express');
const http = require('http');
const { Server } = require('socket.io');

const app = express();
const server = http.createServer(app);
const io = new Server(server, { cors: { origin: '*' } });

const lobbies = new Map');
const http = require('http');
const { Server } = require('socket.io');

const app = express();
const server = http.createServer(app);
const io = new Server(server, { cors: { origin: '*' } });

const lobbies = new Map();

app.get('/', (();

app.get('/', (req, res) => res.sendreq, res) => res.send('DAUN('DAUN Fighter Server Online Fighter Server Online'));

//'));

// Функция для списка лоб Функция для списка лоббиби (только (только ожидающие ожидающие)
function)
function getLobby getLobbyList() {
 List() {
  return Array.from(lobbies.values())
    return Array.from(l .filter(l =>obbies.values())
    .filter l.state === 'waiting(l => l.state === 'waiting')
   ')
    .map(l => .map(l => ({ id: l ({ id: l.id, name:.id, name: l.name, players: l.players l.name, players: l.players.length, max.length, maxPlayersPlayers: l.max: l.maxPlayersPlayers, mode: l, mode: l.mode.mode }));
 }));
}

io.on('connection}

io.on('connection', (', (socket) => {
  console.log('User connected:',socket) => {
  console.log('User connected:', socket.id);

  // Отправ socket.id);

  // Отляем список лобправляем список лобби сразу при подключении
 би сразу при подклю socket.emit('lчении
  socket.emit('lobbyList',obbyList', get getLobbyListLobbyList());

  // Обра());

  // Обработка запросаботка запроса на получение списка ( на получение списка (длядля кнопки об кнопки обновления)
 новления)
  socket.on('get socket.on('getLobbies', ()Lobbies', () => => {
    socket {
    socket.emit('l.emit('lobbyListobbyList', getLobbyList', getLobbyList());
  });

());
  });

  // Создание лобби
  // Создание лобби
  socket.on('create  socket.on('createLobby', (Lobby', (data) =>data) => {
    const { lobby {
    const { lobbyNameName, maxPlayers, maxPlayers, map,, map, playerName, playerName, mode } = data mode } = data;
    const lobbyId;
    const lobbyId = = socket.id + socket.id + Date.now().toString Date.now().toString((36);
   36);
    const lobby = const lobby = {
 {
      id: lobbyId,
      id: lobbyId,
      name: lobbyName,
           name: lobbyName,
      maxPlayers: maxPlayers: maxPlayers || 2,
      map maxPlayers || ,
      mode:2,
      map,
      mode: mode || '1 mode || '1v1',
     v1',
      players: players: [{ id [{ id: socket.id,: socket.id, name: playerName name: playerName, hp: 100, isHost, hp: : true }100, isHost: true }],
      state: '],
      state: 'waiting',
   waiting',
    };
    lobbies };
    lobbies.set(lobbyId.set(lobbyId, lobby);
, lobby);
       socket.join(lobby socket.join(lobbyId);
    socketId);
    socket.lobbyId = lobbyId.lobbyId = lobbyId;
;
    
    socket.    
    socket.emit('lobbyemit('lobbyCreated', { lobbyCreated', { lobby });
    io. });
    io.emit('lobbyListUpdate', getLemit('lobbyListUpdate', getLobbyListobbyList());
  });

  //());
  });

  // Присоедин Присоединение к лобби
 ение к лобби
  socket socket.on('joinL.on('joinLobby',obby', ({ lobbyId, playerName ({ lobbyId, playerName }) => {
    }) => {
    const lobby = lob const lobby = lobbies.get(lobbybies.get(lobbyId);
    ifId);
    if (!lobby || (!lobby || lobby.players.length lobby.players.length >= lobby.maxPlayers >= lobby.maxPlayers || lobby.state || lobby.state !== !== 'waiting') {
      socket. 'waiting') {
      socket.emit('error',emit('error', ' 'ННевозможно присевозможно присоединитьсяоединиться к лоб к лобби');
      returnби');
      return;
    }

    lobby.players.push({;
    }

    lobby.players.push({ id: socket.id id: socket.id, name, name: player: playerName, hp:Name, hp: 100, is 100, isHost: false });
    socketHost: false.join(lobbyId);
    });
    socket.join(lobbyId);
    socket socket.lobbyId = lobbyId.lobbyId = lobbyId;

    socket.;

    socket.emit('joinedemit('joinedLLobby', lobbyobby', lobby);
    io);
    io.to(lobbyId).emit.to(lobbyId).emit('lobbyUpdated', lobby);
   ('lobbyUpdated', lobby);
    io.emit(' io.emit('lobbylobbyListUpdateListUpdate', getLobby', getLobbyList());
 List());
  });

  // Запуск игры ( });

  // Запуск игры (хостхост)
  socket)
  socket.on('startGame', () =>.on('startGame', () => {
    const lobby = lob {
    const lobby =bies.get(socket.lobbyId lobbies.get(s);
    if (ocket.lobbyId);
    if (lobby && lobbylobby && lobby.players[0.players[0].id === socket.id].id === socket) {
      lobby.state = '.id) {
      lobby.state = 'playing';
playing';
      io      io.to(lobby.id.to(lobby.id).emit('game).emit('gameStart', { lobbyStart', { lobby });
      io.emit('lobbyListUpdate', });
      io.emit('lobbyListUpdate', get getLobbyListLobbyList());
    }
 ());
    }
  });

  });

  // Син // Синхронизация движенияхронизация движения и стре и стрельбы
  socket.onльбы
  socket.on('syncClient', (('syncClient', (data) =>data) => {
    socket.to {
    socket.to(socket.lobby(socket.lobbyId).emit('Id).emit('syncServer', {syncServer', { id: socket.id id: socket.id, ..., ...datadata });
  });

  socket });
  });

  socket.on('sh.on('shootoot', (data)', (data) => {
    socket.to => {
    socket.to(socket.l(socket.lobbyId).emitobbyId).emit('('enemyShenemyShoot', { idoot', { id: socket.id,: socket.id, ...data });
  ...data });
  });

  // Вых });

  // Выход из лод из лобби (обби (руручной)
  socket.on('leaveLчной)
  socket.on('leaveLobby', ({ lobbyId }) => {
obby', ({ lobbyId }) => {
    const lobby = lob    const lobby = lobbies.get(lobbybies.get(lobbyId);
    ifId);
    if (l (lobby) {
      lobby.obby)players = lobby.players {
      lobby.players = lobby.players.filter(p =>.filter(p => p.id !== socket p.id !== socket.id);
      socket.leave(lobbyId);
      if.id);
      socket.leave(lobbyId);
      if (lobby. (lobby.players.length === 0) {
       players.length === 0) {
        lobbies.delete lobbies.delete(lobbyId);
     (lobbyId);
      } else {
        } else {
        io.to(lobbyId).emit(' io.to(lobbyId).emitlobbyUpdated',('lobbyUpdated', lobby);
        io lobby);
        io.to(lobbyId.to(lobbyId).emit('playerLeft', socket.id);
     ).emit('playerLeft', socket.id);
      }
      io.emit('lobbyList }
      io.emit('lobbyListUpdate', getLUpdate', getLobbyList());
obbyList());
    }
       }
    socket.l socket.lobbyId = nullobbyId = null;
  });

 ;
  });

  socket.on('dis socket.on('disconnect', () => {
    constconnect', () => {
    const lobby = lobbies lobby = lobbies.get.get(socket(socket.lobbyId);
    if.lobbyId);
    if (lobby) {
      (lobby) {
      lobby.players = lobby lobby.players = lobby..players.filter(p =>players.filter(p => p.id !== socket p.id !== socket.id);
      if.id);
      if (lobby.players.length (lobby.players.length ===  === 0) {
       0) {
        lobbies.delete(s lobbies.delete(socket.lobbyIdocket.lobbyId);
      } else);
      } else {
 {
        io.to(socket        io.to(socket.lobbyId).emit('.lobbyId).emit('lobbyUpdated',lobbyUpdated', lobby);
        io lobby);
        io.to(socket.l.to(socket.lobbyId).emit('playerLeft',obbyId).emit('playerLeft', socket.id);
      socket.id);
      }
      io. }
      io.emit('lobbyListemit('lobbyUpdate', getLobbyListListUpdate', getLobbyList());
    }
 ());
    }
  });
});

const });
});

const PORT = process.env.PORT || 3000;
server.listen(P PORT = process.env.PORT || 3000;
server.listen(PORT, () => console.log(`ServerORT, () => console.log(`Server running on port ${ running on port ${PORT}`));
PORT}`));
