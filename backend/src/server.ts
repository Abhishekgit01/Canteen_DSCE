import { createServer } from 'http';
import { Server as SocketIOServer } from 'socket.io';
import mongoose from 'mongoose';
import jwt from 'jsonwebtoken';
import bcrypt from 'bcryptjs';
import app from './app.js';
import dotenv from 'dotenv';
import { User, MenuItem } from './models/index.js';

dotenv.config();

const PORT = process.env.PORT || 4000;
const MONGO_URI = process.env.MONGO_URI || 'mongodb://localhost:27017/dsce-canteen';
const JWT_SECRET = process.env.JWT_SECRET || 'your-secret-key';
const ALLOWED_ORIGINS = process.env.ALLOWED_ORIGINS?.split(',') || [
  'http://localhost:5173',
  'http://localhost:19006',
  'exp://',
];

// Create HTTP server
const httpServer = createServer(app);

// Create Socket.io server
const io = new SocketIOServer(httpServer, {
  cors: {
    origin: ALLOWED_ORIGINS,
    methods: ['GET', 'POST'],
    credentials: true,
  },
});

// Socket.io auth middleware
io.use((socket, next) => {
  const token = socket.handshake.auth.token;
  if (!token) {
    return next(new Error('Authentication error'));
  }

  try {
    const decoded = jwt.verify(token, JWT_SECRET) as { id: string; usn: string; role: string };
    socket.data.user = decoded;
    next();
  } catch {
    next(new Error('Authentication error'));
  }
});

// Socket.io connection handler
io.on('connection', (socket) => {
  console.log(`Socket connected: ${socket.id}`);

  // Join user's room for personal notifications
  socket.on('join', () => {
    const userId = socket.data.user?.id;
    if (userId) {
      socket.join(userId.toString());
      console.log(`User ${userId} joined their room`);
    }
  });

  // Staff join staff room
  socket.on('join:staff', () => {
    const role = socket.data.user?.role;
    if (role === 'staff' || role === 'manager' || role === 'admin') {
      socket.join('staff');
      console.log(`Staff member joined staff room`);
    }
  });

  socket.on('disconnect', () => {
    console.log(`Socket disconnected: ${socket.id}`);
  });
});

// Export io for use in routes
export { io };

// Root route for API status and Razorpay verification
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

// Connect to MongoDB and start server
mongoose.connect(MONGO_URI)
  .then(async () => {
    console.log('📦 Connected to MongoDB');
    
    // Auto-seed if no users exist
    const userCount = await User.countDocuments();
    if (userCount === 0) {
      console.log('🌱 Seeding database...');
      const salt = await bcrypt.genSalt(12);
      await User.create([
        { email: 'admin@dsce.edu.in', passwordHash: await bcrypt.hash('Admin@123', salt), usn: 'ADMIN001', role: 'admin', isVerified: true },
        { email: 'manager@dsce.edu.in', passwordHash: await bcrypt.hash('Manager@123', salt), usn: 'MGR001', role: 'manager', isVerified: true },
        { email: 'staff@dsce.edu.in', passwordHash: await bcrypt.hash('Staff@123', salt), usn: 'STAFF001', role: 'staff', isVerified: true },
        { email: 'test@dsce.edu.in', passwordHash: await bcrypt.hash('Test@123', salt), usn: '1DS22CS001', role: 'student', isVerified: true }
      ]);
      console.log('✅ Users seeded');
    }
    
    httpServer.listen(PORT, () => {
      console.log(`🚀 Server running on port ${PORT}`);
      console.log(`🔌 Socket.io ready for real-time connections`);
    });
  })
  .catch((err) => {
    console.error('MongoDB connection error:', err);
    process.exit(1);
  });
