# DSCE Canteen - Complete Ordering System

A production-ready canteen ordering app for Dayananda Sagar College of Engineering (DSCE).

## Architecture

- **Backend**: Node.js + Express + MongoDB + Socket.io
- **Admin Panel**: React + Vite + TypeScript
- **Mobile App**: React Native + Expo
- **Payment**: Razorpay
- **Deployment**: Render.com (backend) + Vercel (admin) + Expo (mobile)

## Quick Start

### Prerequisites

- Node.js 18+
- MongoDB Atlas account
- Razorpay account (test mode)
- Gmail account with App Password

### 1. Clone & Setup

```bash
git clone <repo-url>
cd Canteen
```

### 2. Backend Setup

```bash
cd backend
cp .env.example .env
# Edit .env with your values
npm install
npm run seed
npm run dev
```

Backend environment variables:
```env
MONGO_URI=mongodb+srv://user:pass@cluster.mongodb.net/dsce-canteen
JWT_SECRET=your-64-char-secret
REFRESH_TOKEN_SECRET=your-64-char-secret
QR_SECRET=your-64-char-secret
RAZORPAY_KEY_ID=rzp_test_xxxx
RAZORPAY_KEY_SECRET=your-secret
RAZORPAY_WEBHOOK_SECRET=your-webhook-secret
EMAIL_USER=your-email@dsce.edu.in
EMAIL_PASS=your-gmail-app-password
FRONTEND_URL=https://your-vercel-url.vercel.app
```

### 3. Admin Panel Setup

```bash
cd admin
cp .env.example .env
# Edit .env with backend URL
npm install
npm run dev
```

Admin environment variables:
```env
VITE_API_URL=https://your-render-url.onrender.com/api
```

### 4. Mobile App Setup

```bash
cd app
cp .env.example .env
# Edit .env with backend URL
npm install
npx expo start
```

Mobile environment variables:
```env
EXPO_PUBLIC_API_URL=https://your-render-url.onrender.com/api
```

## Deployment

### Backend → Render.com

1. Push to GitHub
2. Connect repo to Render
3. Set environment variables in Render dashboard
4. Deploy

### Admin Panel → Vercel

1. Push to GitHub
2. Connect repo to Vercel
3. Set build command: `npm run build`
4. Set output directory: `dist`
5. Set `VITE_API_URL` in environment variables
6. Deploy

### Mobile App → EAS Build

```bash
cd app
eas build --platform android --profile preview
```

## Test Credentials

| Email | Password | Role |
|-------|----------|------|
| admin@dsce.edu.in | Admin@123! | admin |
| manager@dsce.edu.in | Manager@123! | manager |
| staff@dsce.edu.in | Staff@123! | staff |
| test@dsce.edu.in | Test@123! | student |

## Razorpay Setup

1. Create account at [razorpay.com](https://razorpay.com)
2. Get test keys from Dashboard → API Keys
3. Add webhook URL: `https://your-render-url.onrender.com/api/orders/webhook/razorpay`
4. Select events: `payment.captured`, `payment.failed`
5. Copy webhook secret to backend .env

## Gmail Setup

1. Enable 2FA on your Google account
2. Go to [myaccount.google.com/apppasswords](https://myaccount.google.com/apppasswords)
3. Create app password for "Mail"
4. Use the generated password (not your Gmail password) in EMAIL_PASS

## Features

- **Students**: Browse menu, place orders with scheduled pickup, pay via Razorpay, show QR code for pickup
- **Staff**: Scan QR codes to fulfill orders
- **Manager/Admin**: Manage menu items, view orders, see statistics
- **Real-time**: Socket.io updates for order status changes

## API Endpoints

| Endpoint | Method | Auth | Description |
|----------|--------|------|-------------|
| /api/auth/signup | POST | - | Register with USN, email, password |
| /api/auth/verify-otp | POST | - | Verify email with OTP |
| /api/auth/login | POST | - | Login with email/password |
| /api/auth/refresh | POST | - | Refresh access token |
| /api/auth/logout | POST | ✓ | Logout and invalidate token |
| /api/menu | GET | - | Get available menu items |
| /api/menu | POST | Manager+ | Add new menu item |
| /api/menu/:id | PATCH | Manager+ | Update menu item |
| /api/orders/create | POST | Student | Create new order |
| /api/orders/my | GET | ✓ | Get my orders |
| /api/orders/:id/fulfill | POST | Staff+ | Fulfill order with QR |
| /api/admin/orders | GET | Staff+ | Get all today's orders |
| /api/admin/stats | GET | Manager+ | Get dashboard stats |
| /api/admin/users | GET | Admin | Get all users |
| /api/admin/users/:id/role | PATCH | Admin | Update user role |

## Security

- Helmet security headers
- Rate limiting (100 req/15min global, 10 auth/15min, 5 login/15min)
- MongoDB sanitization (NoSQL injection prevention)
- XSS clean middleware
- HPP (HTTP Parameter Pollution prevention)
- bcrypt password hashing (12 rounds)
- OTP hashing (10 rounds)
- JWT access tokens (15 min expiry)
- Refresh tokens (7 day expiry, SHA256 hashed)
- Razorpay webhook HMAC verification with timing-safe comparison
- QR token JWT with 6-hour expiry
- Idempotency keys for order creation

## License

MIT
