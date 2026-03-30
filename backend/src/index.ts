import express from 'express';
import cors from 'cors';
import { createServer } from 'http';
import { Server as SocketIOServer } from 'socket.io';
import dotenv from 'dotenv';
import mongoose from 'mongoose';

import authRoutes from './routes/auth.js';
import menuRoutes from './routes/menu.js';
import orderRoutes from './routes/orders.js';
import userRoutes from './routes/admin.js';
import { setupSocket } from './socket/index.js';

dotenv.config();

const app = express();
const httpServer = createServer(app);
const io = new SocketIOServer(httpServer, {
  cors: {
    origin: process.env.FRONTEND_URL || 'http://localhost:5173',
    methods: ['GET', 'POST'],
    credentials: true,
  },
});

const PORT = process.env.PORT || 3001;
const MONGO_URI = process.env.MONGO_URI || 'mongodb://localhost:27017/canteen';

// Connect to MongoDB
mongoose.connect(MONGO_URI)
  .then(() => console.log('📦 Connected to MongoDB'))
  .catch((err) => console.error('MongoDB connection error:', err));

// Middleware
app.use(cors({
  origin: process.env.FRONTEND_URL || 'http://localhost:5173',
  credentials: true,
}));
app.use(express.json());

// Health check
app.get('/health', (_req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// Root route for verification
app.get('/', (_req, res) => {
  res.json({ 
    name: 'DSCE Canteen API',
    status: 'online',
    version: '1.0.0',
    endpoints: {
      health: '/health',
      menu: '/api/menu',
      auth: '/api/auth'
    }
  });
});

// Routes
app.use('/api/auth', authRoutes);
app.use('/api/menu', menuRoutes);
app.use('/api/orders', orderRoutes);
app.use('/api/users', userRoutes);

// Setup Socket.io
setupSocket(io);

httpServer.listen(PORT, () => {
  console.log(`🚀 Server running on http://localhost:${PORT}`);
  console.log(`🔌 Socket.io ready for real-time connections`);
});
