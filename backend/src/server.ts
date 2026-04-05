import './config/env.js';
import { createServer } from 'http';
import express from 'express';
import { Server as SocketIOServer } from 'socket.io';
import mongoose from 'mongoose';
import jwt from 'jsonwebtoken';
import bcrypt from 'bcryptjs';
import app from './app.js';
import { MENU_CACHE_SELECT, setMenuCache } from './cache/menuCache.js';
import { DEFAULT_COLLEGE } from './config/college.js';
import { User, MenuItem, Order } from './models/index.js';
import { ensurePickupSettingsDocument } from './services/pickup-settings.service.js';
import { sendPushNotification } from './services/notification.service.js';

const PORT = process.env.PORT || 4000;
const MONGO_URI = process.env.MONGO_URI || 'mongodb://localhost:27017/dsce-canteen';
const JWT_SECRET = process.env.JWT_SECRET;
if (!JWT_SECRET) throw new Error('JWT_SECRET is not set in environment variables');
const ALLOWED_ORIGINS = process.env.ALLOWED_ORIGINS?.split(',') || [
  'http://localhost:5173',
  'http://localhost:19006',
  'exp://',
];

const baseMenuSeed = [
  {
    name: 'Masala Dosa',
    description: 'Crispy rice crepe filled with spiced potato filling, served with coconut chutney and sambar',
    imageUrl: 'https://dummyimage.com/400x300/1e2640/f97316.png&text=Masala+Dosa',
    price: 55,
    calories: 350,
    category: 'meals',
    tempOptions: ['normal', 'hot'],
    isAvailable: true,
    preparationMinutes: 12,
  },
  {
    name: 'Idli Sambar (3pc)',
    description: 'Steamed rice cakes served with lentil soup and coconut chutney',
    imageUrl: 'https://dummyimage.com/400x300/1e2640/f97316.png&text=Idli+Sambar',
    price: 40,
    calories: 280,
    category: 'meals',
    tempOptions: ['normal', 'hot'],
    isAvailable: true,
    preparationMinutes: 8,
  },
  {
    name: 'Veg Fried Rice',
    description: 'Wok-tossed rice with fresh vegetables and Indo-Chinese spices',
    imageUrl: 'https://dummyimage.com/400x300/1e2640/f97316.png&text=Veg+Fried+Rice',
    price: 70,
    calories: 450,
    category: 'meals',
    tempOptions: ['normal', 'hot'],
    isAvailable: true,
    preparationMinutes: 15,
  },
  {
    name: 'Filter Coffee',
    description: 'Traditional South Indian filter coffee brewed fresh',
    imageUrl: 'https://dummyimage.com/400x300/1e2640/f97316.png&text=Filter+Coffee',
    price: 20,
    calories: 80,
    category: 'beverages',
    tempOptions: ['hot'],
    isAvailable: true,
    preparationMinutes: 3,
  },
] as const;

// Create HTTP server
const httpServer = createServer(app);

// Create Socket.io server with explicit CORS
const io = new SocketIOServer(httpServer, {
  cors: {
    origin: (origin, callback) => {
      // Allow requests with no origin (mobile apps, Postman)
      if (!origin) return callback(null, true);
      
      // Check if origin is in allowed list
      const allowedOrigins = process.env.ALLOWED_ORIGINS?.split(',') || [
        'http://localhost:5173',
        'http://localhost:19006',
      ];
      
      if (allowedOrigins.includes(origin) || allowedOrigins.some(allowed => origin.includes(allowed))) {
        callback(null, true);
      } else {
        console.log('Socket.io blocked origin:', origin);
        callback(new Error('Not allowed by CORS'));
      }
    },
    methods: ['GET', 'POST'],
    credentials: true,
  },
  transports: ['websocket', 'polling'],
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

app.post('/internal/emit', express.json(), (req, res) => {
  const { secret, event, payload } = req.body ?? {};

  if (!process.env.INTERNAL_SECRET || secret !== process.env.INTERNAL_SECRET) {
    return res.sendStatus(403);
  }

  if (typeof event !== 'string' || !event.trim()) {
    return res.sendStatus(400);
  }

  io.emit(event, payload);
  return res.sendStatus(200);
});

// Root route for API status and Razorpay verification
app.get('/', (_req, res) => {
  res.json({ 
    name: 'Campus Canteen API',
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
mongoose
  .connect(MONGO_URI, {
    maxPoolSize: 10,
    minPoolSize: 2,
    socketTimeoutMS: 30000,
    serverSelectionTimeoutMS: 5000,
    heartbeatFrequencyMS: 10000,
    retryWrites: true,
  })
  .then(async () => {
    console.log('📦 Connected to MongoDB');

    await User.updateMany(
      { $or: [{ college: { $exists: false } }, { college: null }, { college: '' }] },
      { $set: { college: DEFAULT_COLLEGE } },
    );
    await MenuItem.updateMany(
      { $or: [{ college: { $exists: false } }, { college: null }, { college: '' }] },
      { $set: { college: DEFAULT_COLLEGE } },
    );

    const salt = await bcrypt.genSalt(12);
    const seedUsers = [
      { name: 'Admin User', email: 'admin@dsce.edu.in', password: 'Admin@123!', usn: '1DS21CS001', role: 'admin', college: 'DSCE' },
      { name: 'DSCE Manager', email: 'manager@dsce.edu.in', password: 'Manager@123!', usn: '1DS21CS002', role: 'manager', college: 'DSCE' },
      { name: 'DSCE Staff', email: 'staff@dsce.edu.in', password: 'Staff@123!', usn: '1DS21CS003', role: 'staff', college: 'DSCE' },
      { name: 'DSCE Student', email: 'test@dsce.edu.in', password: 'Test@123!', usn: '1DS21CS004', role: 'student', college: 'DSCE' },
      { name: 'NIE Manager', email: 'manager@nie.edu.in', password: 'Manager@123!', usn: '4IK25CS900', role: 'manager', college: 'NIE' },
      { name: 'NIE Staff', email: 'staff@nie.edu.in', password: 'Staff@123!', usn: '4IK25CS901', role: 'staff', college: 'NIE' },
      { name: 'NIE Student', email: 'test@nie.edu.in', password: 'Test@123!', usn: '4IK25CS902', role: 'student', college: 'NIE' },
    ] as const;

    for (const seedUser of seedUsers) {
      await User.updateOne(
        { email: seedUser.email },
        {
          $setOnInsert: {
            name: seedUser.name,
            email: seedUser.email,
            passwordHash: await bcrypt.hash(seedUser.password, salt),
            usn: seedUser.usn,
            role: seedUser.role,
            college: seedUser.college,
            isVerified: true,
          },
        },
        { upsert: true },
      );
    }

    const dsceMenuCount = await MenuItem.countDocuments({ college: 'DSCE' });
    const nieMenuCount = await MenuItem.countDocuments({ college: 'NIE' });

    if (dsceMenuCount === 0) {
      await MenuItem.insertMany(baseMenuSeed.map((item) => ({ ...item, college: 'DSCE' })));
      console.log(`🍽️ Seeded ${baseMenuSeed.length} DSCE menu items`);
    }

    if (nieMenuCount === 0) {
      const dsceItems = await MenuItem.find({ college: 'DSCE' }).select(MENU_CACHE_SELECT).lean();
      const sourceItems = dsceItems.length > 0 ? dsceItems : baseMenuSeed;
      await MenuItem.insertMany(sourceItems.map((item: any) => {
        const { _id, ...rest } = item;
        return { ...rest, college: 'NIE' };
      }));
      console.log(`🍽️ Seeded ${sourceItems.length} NIE menu items`);
    }

    try {
      for (const college of ['DSCE', 'NIE'] as const) {
        await ensurePickupSettingsDocument(college);
        const items = await MenuItem.find({ college, isAvailable: true })
          .select(MENU_CACHE_SELECT)
          .sort({ category: 1, name: 1 })
          .lean();

        setMenuCache(college, items);
        console.log(`🍽️ Menu preloaded for ${college}: ${items.length} items cached`);
      }
    } catch (error) {
      console.warn(
        'Menu preload failed (non-critical):',
        error instanceof Error ? error.message : error,
      );
    }

    // Zombie order cleanup — mark abandoned pending_payment orders as failed
    setInterval(async () => {
      try {
        const cutoff = new Date(Date.now() - 15 * 60 * 1000);
        const result = await Order.updateMany(
          { status: 'pending_payment', createdAt: { $lt: cutoff } },
          { $set: { status: 'failed' } },
        );
        if (result.modifiedCount > 0) {
          console.log(`🧹 Cleaned up ${result.modifiedCount} zombie orders`);
        }
      } catch (err) {
        console.error('Zombie order cleanup error:', err);
      }
    }, 15 * 60 * 1000);

    // Pre-order due notification check
    setInterval(async () => {
      try {
        const now = new Date();
        const soon = new Date(now.getTime() + 30 * 60 * 1000);

        const dueOrders = await Order.find({
          isPreOrder: true,
          status: 'paid',
          scheduledFor: { $gte: now, $lte: soon },
          preOrderNotified: { $ne: true }
        }).populate<{ student: { expoPushToken: string, name: string } }>('userId', 'expoPushToken name');

        let notifiedCount = 0;
        for (const order of dueOrders) {
          const student = order.userId as any;
          if (student?.expoPushToken) {
            const formatTime = (time: Date | null) => {
              if (!time) return '';
              const ISTOffset = 5.5 * 60 * 60 * 1000;
              const IST = new Date(time.getTime() + ISTOffset);
              const hour = IST.getUTCHours() % 12 || 12;
              const ampm = IST.getUTCHours() >= 12 ? 'PM' : 'AM';
              return `${hour}:${String(IST.getUTCMinutes()).padStart(2, '0')} ${ampm}`;
            };
            await sendPushNotification(
              student.expoPushToken,
              '🍱 Your pre-order starts soon!',
              `Your order will be ready around ${formatTime(order.scheduledFor as Date | null)}`,
              { screen: 'Orders', orderId: order._id.toString() }
            );
            notifiedCount++;
          }
          await Order.findByIdAndUpdate(order._id, { preOrderNotified: true });
        }
        if (notifiedCount > 0) {
          console.log(`⏱️ Notified ${notifiedCount} students about upcoming pre-orders`);
        }
      } catch (err) {
        console.error('Pre-order notification check error:', err);
      }
    }, 15 * 60 * 1000);
    
    httpServer.listen(PORT, () => {
      console.log(`🚀 Server running on port ${PORT}`);
      console.log(`🔌 Socket.io ready for real-time connections`);
    });
  })
  .catch((err) => {
    console.error('MongoDB connection error:', err);
    process.exit(1);
  });
