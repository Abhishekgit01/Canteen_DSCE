# DSCE Canteen - Campus Food Ordering System

A production-ready canteen ordering app for Dayananda Sagar College of Engineering.

**Note**: This is a private college project. Setup instructions are available to authorized developers only.

## Architecture

- **Backend**: Node.js + Express + MongoDB + Socket.io
- **Admin Panel**: React + Vite + TypeScript  
- **Mobile App**: React Native + Expo
- **Payment**: Razorpay

## Security Features

- JWT authentication with refresh tokens
- OTP email verification (hashed)
- Rate limiting (100 req/15min)
- Helmet security headers
- MongoDB sanitization
- XSS protection
- HPP prevention
- bcrypt password hashing (12 rounds)
- Razorpay webhook HMAC verification
- QR token JWT with expiry

## Deployment

- Backend: Render.com
- Admin: Vercel
- Mobile: Expo / EAS Build

## Contact

For setup assistance or deployment help, contact the project maintainer.

**⚠️ Warning**: Unauthorized access attempts are monitored and will be blocked.

