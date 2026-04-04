# Ybyte Canteen Project Context

This file is the current source of truth for the repo as of April 4, 2026. Any AI or engineer picking up this project should read this before changing auth, payments, deployment, or mobile flows.

## 1. What Is Current vs Legacy

### Current production-facing pieces
- `/app`
  - Main mobile app.
  - React Native + Expo SDK 54.
  - This is the primary app currently being edited for auth, ordering, payment, QR pickup, and profile UX.
- `/backend`
  - Main Node.js + Express API.
  - Runs on Render.
  - Connected to MongoDB Atlas.
- `/workers/canteen-payments`
  - Current Cloudflare Worker code for Razorpay webhook handling and optional payment confirmation offload.
- `/admin`
  - Separate admin/staff dashboard.
  - Vite + React app.

### Present in repo but not the current source of truth for mobile auth/payment work
- `/UI`
  - Older web UI assets and experiments.
- top-level `/android`
  - Capacitor Android wrapper for the separate web build, not the main Expo mobile app.
- top-level Vite app files like `/index.html`, `/vite.config.ts`, `/UI/*`
  - Not the main mobile surface.

If an AI needs to work on the live student mobile experience, it should start in `/app`, not in `/UI` or the top-level `/android`.

## 2. Verified Deployment Status

### Render backend
- Live URL: `https://dsce-canteen-backend.onrender.com`
- Verified on April 4, 2026:
  - `GET /health` returned HTTP 200 with:
    - `status: "ok"`
    - `mongo: "connected"`
    - `paymentMode: "razorpay"`
  - `POST /api/auth/signup` without `college` returned:
    - `{"error":"Please choose your college"}`
  - `POST /api/auth/forgot-password/request` with invalid email returned:
    - `{"error":"Please enter a valid email address"}`

This confirms the live Render deployment already contains the newer auth contract.

### Cloudflare worker
- Worker name in repo: `canteen-payments`
- Config file: [workers/canteen-payments/wrangler.toml](/Abhi/Projects/Canteen/workers/canteen-payments/wrangler.toml)
- Local verification completed:
  - `npx tsc -p workers/canteen-payments/tsconfig.json --noEmit` passed
  - Worker config points at the live Render backend through:
    - `RENDER_INTERNAL_URL = "https://dsce-canteen-backend.onrender.com"`

Important limitation:
- The repo does not contain a public Cloudflare worker URL, custom route, or `workers.dev` hostname.
- Because of that, external verification of the deployed public worker endpoint is not possible from repo contents alone.
- If `EXPO_PUBLIC_PAYMENT_API_URL` is not set in the mobile app, the app falls back to the Render backend for payment confirmation instead of the worker.

## 3. Mobile App Architecture

### App entry and navigation
- Main file: [app/App.tsx](/Abhi/Projects/Canteen/app/App.tsx)
- Navigation: [app/src/Navigation.tsx](/Abhi/Projects/Canteen/app/src/Navigation.tsx)
- Unauthenticated stack:
  - `Welcome`
  - `Auth`
  - `Otp`
  - `ForgotPassword`
- Authenticated stack:
  - `Main`
  - `Search`
  - `ItemDetail`
  - `Payment`
  - `OrderQR`
  - `OrderSuccess`
  - `PaymentSuccess`

### Visual system
- Theme tokens live in [app/src/theme.ts](/Abhi/Projects/Canteen/app/src/theme.ts)
- UI direction is warm, bright, card-based, orange/brand-red accented
- New auth UX should continue matching that visual language

## 4. Auth Flow

### Welcome + college selection
- Welcome screen: [app/src/screens/WelcomeScreen.tsx](/Abhi/Projects/Canteen/app/src/screens/WelcomeScreen.tsx)
- Users choose `DSCE` or `NIE` once here.
- The Auth screen should not ask for college again; it should only display the chosen college and use it internally.

### Login
- Screen: [app/src/screens/AuthScreen.tsx](/Abhi/Projects/Canteen/app/src/screens/AuthScreen.tsx)
- API route: `POST /api/auth/login`
- Successful login stores:
  - JWT token
  - serialized user object
- Store: [app/src/stores/authStore.ts](/Abhi/Projects/Canteen/app/src/stores/authStore.ts)

### Signup
- API route: `POST /api/auth/signup`
- Required fields:
  - `usn`
  - `email`
  - `password`
  - `college`
  - `name` when roster lookup does not resolve a name

### College behavior
- `DSCE`
  - Uses roster lookup from [backend/src/data/student-roster.json](/Abhi/Projects/Canteen/backend/src/data/student-roster.json) through [backend/src/services/student-registry.service.ts](/Abhi/Projects/Canteen/backend/src/services/student-registry.service.ts)
  - Manual name fallback is allowed if the USN is missing from the roster
- `NIE`
  - Manual name entry only for now
  - No roster lookup currently exists

### OTP verification
- OTP screen: [app/src/screens/OtpScreen.tsx](/Abhi/Projects/Canteen/app/src/screens/OtpScreen.tsx)
- Signup OTP route: `POST /api/auth/verify-otp`
- Resend signup OTP route: `POST /api/auth/resend-otp`
- OTP purpose is now explicit:
  - `signup`
  - `password_reset`

### Forgot password
- Request screen: [app/src/screens/ForgotPasswordScreen.tsx](/Abhi/Projects/Canteen/app/src/screens/ForgotPasswordScreen.tsx)
- Request route: `POST /api/auth/forgot-password/request`
- Reset route: `POST /api/auth/forgot-password/reset`
- Password reset uses the same OTP screen with extra password fields
- Successful reset logs the user in immediately by returning normal auth payload

### OTP behavior rules
- Backend auth routes live in [backend/src/routes/auth.ts](/Abhi/Projects/Canteen/backend/src/routes/auth.ts)
- Default OTP mode now behaves as email verification unless explicitly disabled
- `AUTH_VERIFICATION_MODE=none` disables OTP verification
- If OTP email sending fails, the backend should return an error
- The backend should not silently auto-verify users when email delivery fails

## 5. Email / OTP Delivery

### Mailer
- File: [backend/src/utils/email.ts](/Abhi/Projects/Canteen/backend/src/utils/email.ts)
- Uses Gmail SMTP by default
- Current implementation now reuses a pooled nodemailer transporter for faster repeat sends

### Required backend env for OTP
- `EMAIL_USER`
- `EMAIL_PASS`
- optionally:
  - `EMAIL_HOST`
  - `EMAIL_PORT`

### Verified behavior on April 4, 2026
- Direct OTP mailer test returned success
- Local backend route test for `POST /api/auth/forgot-password/request` returned:
  - `{"message":"Password reset OTP sent"}`

If the app still shows a stale timeout message after this, the most likely cause is an older installed build hitting an older backend bundle or cached client code, not the current backend route logic.

## 6. Payment Flow

### App-side
- API client: [app/src/api/index.ts](/Abhi/Projects/Canteen/app/src/api/index.ts)
- Payment screen: [app/src/screens/PaymentScreen.tsx](/Abhi/Projects/Canteen/app/src/screens/PaymentScreen.tsx)
- Payment success screen: [app/src/screens/PaymentSuccessScreen.tsx](/Abhi/Projects/Canteen/app/src/screens/PaymentSuccessScreen.tsx)

### Payment endpoints
- Create order: `POST /api/orders/create`
- Confirm Razorpay:
  - Default app target: backend unless `EXPO_PUBLIC_PAYMENT_API_URL` is set
  - Path: `POST /api/orders/:id/confirm-razorpay`

### Realtime events
- `order:paid`
- `order:updated`
- `order:fulfilled`
- Socket client: [app/src/api/socket.ts](/Abhi/Projects/Canteen/app/src/api/socket.ts)

## 7. Backend Architecture

### Entry points
- App setup: [backend/src/app.ts](/Abhi/Projects/Canteen/backend/src/app.ts)
- Server bootstrap: [backend/src/server.ts](/Abhi/Projects/Canteen/backend/src/server.ts)
- Env loader: [backend/src/config/env.ts](/Abhi/Projects/Canteen/backend/src/config/env.ts)

### Important backend routes
- Auth: [backend/src/routes/auth.ts](/Abhi/Projects/Canteen/backend/src/routes/auth.ts)
- Orders: [backend/src/routes/orders.ts](/Abhi/Projects/Canteen/backend/src/routes/orders.ts)
- Admin: [backend/src/routes/admin.ts](/Abhi/Projects/Canteen/backend/src/routes/admin.ts)
- Webhook: [backend/src/routes/webhook.ts](/Abhi/Projects/Canteen/backend/src/routes/webhook.ts)

### Models
- File: [backend/src/models/index.ts](/Abhi/Projects/Canteen/backend/src/models/index.ts)
- Important model notes:
  - `User.college` supports:
    - `DSCE`
    - `NIE`
    - legacy `DSATM`
  - `OTP.purpose` supports:
    - `signup`
    - `password_reset`
  - `Order.status` values:
    - `pending_payment`
    - `paid`
    - `preparing`
    - `ready`
    - `fulfilled`
    - `failed`

### Cleanup job
- Zombie pending-payment orders are cleaned every 15 minutes after MongoDB connects
- Implemented in [backend/src/server.ts](/Abhi/Projects/Canteen/backend/src/server.ts)

## 8. Cloudflare Worker Responsibilities

### Current worker file
- [workers/canteen-payments/src/index.ts](/Abhi/Projects/Canteen/workers/canteen-payments/src/index.ts)

### What it does
- Verifies Razorpay webhook signatures
- Optionally handles `POST /api/orders/:id/confirm-razorpay`
- Uses MongoDB Atlas Data API directly for order lookup and updates
- Emits `order:paid` and `order:failed` back to Render through `/internal/emit`

### Required worker env
- `RAZORPAY_KEY_SECRET`
- `RAZORPAY_WEBHOOK_SECRET`
- `ATLAS_DATA_API_URL`
- `ATLAS_DATA_API_KEY`
- `ATLAS_DB`
- `ATLAS_COLLECTION_ORDERS`
- `INTERNAL_SECRET`
- `RENDER_INTERNAL_URL`
- `QR_SECRET`

## 9. Build / Run Commands

### Main backend
- `cd /Abhi/Projects/Canteen/backend && npm run dev`
- `cd /Abhi/Projects/Canteen/backend && npx tsc --noEmit`

### Expo app
- `cd /Abhi/Projects/Canteen/app && npm start`
- `cd /Abhi/Projects/Canteen/app && npx tsc --noEmit`

### Cloudflare worker local compile check
- `cd /Abhi/Projects/Canteen && npx tsc -p workers/canteen-payments/tsconfig.json --noEmit`

## 10. Repo Hygiene Notes

### Files intentionally removed before push
- old root marketing images not used by code
- temporary implementation prompt files
- hidden progress scratch files
- stale duplicate worker scaffold in `/canteen-payments-worker`

### What should stay
- this `canteen-context.md`
- `/app`
- `/backend`
- `/admin`
- `/workers/canteen-payments`

If a future AI sees both `/workers/canteen-payments` and any other worker folder reappear, it should treat `/workers/canteen-payments` as the canonical worker unless explicit newer instructions say otherwise.
