import express from 'express';
import helmet from 'helmet';
import cors from 'cors';
import rateLimit from 'express-rate-limit';
import mongoSanitize from 'express-mongo-sanitize';
import hpp from 'hpp';
import dotenv from 'dotenv';
import authRoutes from './routes/auth.js';
import menuRoutes from './routes/menu.js';
import orderRoutes from './routes/orders.js';
import adminRoutes from './routes/admin.js';
import { razorpayWebhookHandler } from './routes/webhook.js';

dotenv.config();

const app = express();

// Trust proxy (required for Render.com and express-rate-limit)
app.set('trust proxy', 1);

const ALLOWED_ORIGINS = process.env.ALLOWED_ORIGINS?.split(',') || [
  'http://localhost:5173',
  'http://localhost:19006',
  'exp://',
];

// 1. Helmet - security headers
app.use(helmet());

// 2. CORS
app.use(cors({
  origin: ALLOWED_ORIGINS,
  credentials: true,
}));

// Rate limiting temporarily disabled for deployment
// 3. Global rate limit - 100 requests per 15 minutes
// const globalLimiter = rateLimit({
//   windowMs: 15 * 60 * 1000,
//   max: 100,
//   message: 'Too many requests, please try again later',
//   standardHeaders: true,
//   legacyHeaders: false,
// });
// app.use(globalLimiter);

// 4. Stricter rate limit on /api/auth - 10 requests per 15 minutes
// const authLimiter = rateLimit({
//   windowMs: 15 * 60 * 1000,
//   max: 10,
//   message: 'Too many auth requests, please try again later',
//   standardHeaders: true,
//   legacyHeaders: false,
// });
// app.use('/api/auth', authLimiter);

// 5. Strictest rate limit on /api/auth/login - 5 per 15 minutes (brute force protection)
// const loginLimiter = rateLimit({
//   windowMs: 15 * 60 * 1000,
//   max: 5,
//   message: 'Too many login attempts, please try again in 15 minutes',
//   standardHeaders: true,
//   legacyHeaders: false,
// });
// app.use('/api/auth/login', loginLimiter);

// Razorpay webhook needs the raw body for signature verification.
app.post('/webhook/razorpay', express.raw({ type: 'application/json' }), razorpayWebhookHandler);

// 6. JSON body parser with size limit
app.use(express.json({ limit: '10kb' }));

// 7. Mongo sanitize - prevents NoSQL injection
app.use(mongoSanitize());

// 8. XSS Clean middleware (simple implementation)
app.use((req, _res, next) => {
  const clean = (obj: any): any => {
    if (typeof obj === 'string') {
      return obj
        .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '')
        .replace(/javascript:/gi, '')
        .replace(/on\w+=/gi, '');
    }
    if (Array.isArray(obj)) {
      return obj.map(clean);
    }
    if (typeof obj === 'object' && obj !== null) {
      const cleaned: any = {};
      for (const key in obj) {
        cleaned[key] = clean(obj[key]);
      }
      return cleaned;
    }
    return obj;
  };

  if (req.body) req.body = clean(req.body);
  if (req.query) req.query = clean(req.query);
  next();
});

// 9. HPP - HTTP Parameter Pollution Prevention
app.use(hpp());

// Health check
app.get('/health', (_req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// Root route for Razorpay verification
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
app.use('/api/admin', adminRoutes);

export default app;
