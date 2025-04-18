const express = require('express');
const http = require('http');
const socketIo = require('socket.io');
const path = require('path');

const app = express();
const server = http.createServer(app);
const io = socketIo(server);

const PORT = process.env.PORT || 3000;
const WebSocket = require('ws');
const wss = new WebSocket.Server({ server });

wss.on('connection', (ws, req) => {
  ws.on('message', (message) => {
    const data = JSON.parse(message);
    
    if (data.type === "joinRoom") {
      const { roomName, userName } = data;
      
      // Add the user to the room (e.g., store in a Map)
      // Assuming a Map that holds room information
      if (!rooms[roomName]) {
        rooms[roomName] = [];
      }
      
      rooms[roomName].push(userName);
      console.log(`${userName} joined room ${roomName}`);

      // Send back updated user list to all clients in the room
      wss.clients.forEach(client => {
        if (client.readyState === WebSocket.OPEN) {
          client.send(JSON.stringify({
            type: "userList",
            users: rooms[roomName]
          }));
        }
      });
    }
  });
});


// Serve static files
app.use(express.static(path.join(__dirname, 'public')));

// Fallback for SPA
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'public/index.html'));
});

// Socket.io logic
let rooms = {};  // Object to store room data

io.on('connection', socket => {
  console.log('New client connected:', socket.id);

  // Join a room
  socket.on('joinRoom', (roomName, userName) => {
    socket.join(roomName);
    if (!rooms[roomName]) {
      rooms[roomName] = [];
    }

    // Add user to the room
    rooms[roomName].push({ id: socket.id, name: userName });

    // Emit updated user list for the room
    io.to(roomName).emit('updateUsers', rooms[roomName]);
  });

  // Handle voting
  socket.on('vote', ({ roomName, user, story, value }) => {
    io.to(roomName).emit('userVoted', { user, story, value });
  });

  // Reveal votes for a room
  socket.on('revealVotes', (roomName) => {
    io.to(roomName).emit('revealVotes');
  });

  // Reset votes for a room
  socket.on('resetVotes', (roomName) => {
    io.to(roomName).emit('resetVotes');
  });

  // Disconnect logic
  socket.on('disconnect', () => {
    // Remove user from all rooms
    for (let roomName in rooms) {
      rooms[roomName] = rooms[roomName].filter(u => u.id !== socket.id);
      if (rooms[roomName].length === 0) {
        delete rooms[roomName];
      }
    }
    // Emit updated user list across all rooms
    io.emit('updateUsers', rooms);
  });
});

server.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
});
