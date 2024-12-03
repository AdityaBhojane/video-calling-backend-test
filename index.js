import express from 'express';
import { createServer } from 'http';
import { Server } from 'socket.io';
import cors from 'cors';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const app = express();
const httpServer = createServer(app);
const io = new Server(httpServer, {
  cors: {
    origin: "*",
    methods: ["GET", "POST"]
  }
});

app.use(cors());
app.use(express.json());
app.use(express.static(join(__dirname, '../dist')));

// API routes
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok' });
});

// Serve index.html for all other routes
app.get('*', (req, res) => {
  res.sendFile(join(__dirname, '../dist/index.html'));
});

// Store active users
const activeUsers = new Map();

io.on('connection', (socket) => {
  console.log('User connected:', socket.id);

  socket.on('user:register', ({ peerId, username }) => {
    activeUsers.set(socket.id, { peerId, username });
    io.emit('users:update', Array.from(activeUsers.values()));
  });

  socket.on('call:request', ({ to, from }) => {
    const targetSocket = Array.from(activeUsers.entries())
      .find(([_, user]) => user.peerId === to)?.[0];
    
    if (targetSocket) {
      io.to(targetSocket).emit('call:incoming', {
        from,
        caller: activeUsers.get(socket.id)?.username
      });
    }
  });

  socket.on('call:end', ({ to }) => {
    const targetSocket = Array.from(activeUsers.entries())
      .find(([_, user]) => user.peerId === to)?.[0];
    
    if (targetSocket) {
      io.to(targetSocket).emit('call:ended');
    }
  });

  socket.on('disconnect', () => {
    activeUsers.delete(socket.id);
    io.emit('users:update', Array.from(activeUsers.values()));
    console.log('User disconnected:', socket.id);
  });
});

const PORT = process.env.PORT || 3000;
httpServer.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});