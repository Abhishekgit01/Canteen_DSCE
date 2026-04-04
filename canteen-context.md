# Ybyte Canteen App Architecture & Context

This document gives AI assistants a working overview of the Ybyte canteen platform without needing to reverse-engineer the whole repo first.

## 1. Project Structure
- `/app`: The current customer-facing mobile app built with React Native and Expo (SDK 54).
- `/backend`: The primary Node.js/Express API deployed on Render, connected to MongoDB Atlas.
- `/workers/canteen-payments`: A Cloudflare Worker used for Razorpay webhook and payment verification handling.

## 2. Tech Stack & Key Libraries
- **Mobile (React Native / Expo)**:
  - Navigation: `@react-navigation/native`, `@react-navigation/native-stack`, `@react-navigation/bottom-tabs`
  - State: `zustand`
  - Networking: `axios` via `app/src/api/index.ts`
  - Persistence: `@react-native-async-storage/async-storage`
  - Realtime: `socket.io-client`
  - Payments: `react-native-razorpay`
  - UI: fully custom React Native screens styled with the local `theme.ts`
- **Backend (Node.js / Express)**:
  - Database: `mongoose`
  - Auth: JWT + `bcryptjs`
  - Email OTP: `nodemailer`
  - Realtime: `socket.io`
  - Background cleanup: `setInterval` in `server.ts` for stale pending-payment orders

## 3. Data Models
- **User**:
  - Core fields: `name`, `email`, `passwordHash`, `usn`, `role`, `isVerified`
  - College field exists for multi-campus handling.
  - Current mobile flow surfaces `DSCE` and `NIE`.
  - Legacy `DSATM` values may still exist in stored data and are still tolerated in the model.
- **MenuItem**:
  - `name`, `description`, `imageUrl`, `price`, `calories`, `category`, `tempOptions`, availability metadata
- **Order**:
  - `items`, `scheduledTime`, `totalAmount`, payment identifiers, QR-token fields, timestamps
  - Status lifecycle: `pending_payment` -> `paid` -> `preparing` -> `ready` -> `fulfilled` -> `failed`
  - Includes a `college` field for multi-campus boundaries
- **OTP**:
  - Stores hashed OTP codes by `email`
  - Purpose-aware flows currently include `signup` and `password_reset`

## 4. Key Workflows

### Welcome, Signup, OTP, Password Recovery
1. Unauthenticated users land on a welcome screen and choose their active campus: `DSCE` or `NIE`.
2. The app routes into `AuthScreen.tsx` with that campus preselected.
3. Signup posts to `POST /api/auth/signup` with `usn`, `email`, `password`, `college`, and a name when needed.
4. Campus-specific behavior:
   - `DSCE`: attempts roster lookup from `student-roster.json`, but still allows manual name entry if the USN is missing.
   - `NIE`: currently uses manual name entry instead of roster lookup.
5. If OTP verification is enabled, signup navigates to `OtpScreen.tsx` and calls `POST /api/auth/verify-otp`.
6. Password recovery is OTP-based:
   - `POST /api/auth/forgot-password/request` sends the reset OTP
   - `POST /api/auth/forgot-password/reset` verifies the OTP, updates the password, and returns auth data
7. The login screen exposes a “Forgot password?” entry point that reuses the same OTP UI.

### Checkout & Payment Flow
1. User builds a cart in the mobile app.
2. App calls `POST /api/orders/create` with items and `scheduledTime`.
3. Backend creates the order with `pending_payment`.
4. If `PAYMENT_MODE=razorpay`, backend creates a Razorpay order and returns payment init data.
5. App opens Razorpay from `PaymentScreen.tsx`.
6. On success, app confirms payment via `POST /api/orders/:id/confirm-razorpay`.
7. Backend verifies ownership and Razorpay signature, finalizes the order, emits `order:paid`, and returns the QR pickup token.
8. App routes to `PaymentSuccessScreen.tsx`.

### Staff Fulfillment / QR Pickup
1. The user receives a QR token tied to the paid order.
2. Staff accounts use the same mobile app and get scanner access.
3. Staff scan the QR code and call `POST /api/orders/:id/fulfill`.
4. Backend verifies the token, marks the order as `fulfilled`, and emits `order:fulfilled` plus `order:updated`.

## 5. Environment Map
- **Mobile app**:
  - `EXPO_PUBLIC_API_URL`
  - optionally `EXPO_PUBLIC_PAYMENT_API_URL`
- **Backend**:
  - `MONGO_URI`
  - `JWT_SECRET`
  - `PAYMENT_MODE`
  - `RAZORPAY_KEY_ID`
  - `RAZORPAY_KEY_SECRET`
  - `RAZORPAY_WEBHOOK_SECRET`
  - `INTERNAL_SECRET`
  - `EMAIL_USER`, `EMAIL_PASS` if OTP-based signup / password reset should work
- **Cloudflare Worker**:
  - `RAZORPAY_KEY_SECRET`
  - `RAZORPAY_WEBHOOK_SECRET`

## 6. Current Architecture Notes
- A shared env loader now initializes backend environment variables before route imports read `process.env`.
- Socket events are standardized around `order:paid`, `order:updated`, and `order:fulfilled`.
- `server.ts` runs zombie-order cleanup every 15 minutes after MongoDB connects.
- Admin routes are role-protected for staff, manager, and admin access.
- The Expo app is currently the main mobile surface being iterated on for auth, ordering, payment success, and QR pickup UX.
