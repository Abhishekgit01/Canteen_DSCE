# Canteen

Canteen is a campus food ordering platform that combines a student mobile app, an operations dashboard, a backend API, and payment workflow services into a single repository.

## Overview

The platform is built to support the full canteen ordering lifecycle:

- student authentication and onboarding
- menu browsing and cart management
- scheduled and immediate pickup orders
- payment processing and confirmation
- QR-based pickup verification
- real-time order status updates
- staff and admin operations

## Architecture

```text
Mobile App (Expo / React Native) ---> Backend API ---> MongoDB
Admin Dashboard (React / Vite) ---> Backend API ---> MongoDB
Payment Worker (Cloudflare) ---> Backend API / Payment Flow
```

## Repository Structure

| Path | Description |
| --- | --- |
| `backend/` | Express and TypeScript backend API |
| `admin/` | React and Vite admin dashboard |
| `app/` | Expo and React Native mobile application |
| `app/android/` | Native Android project generated for the Expo app |
| `workers/canteen-payments/` | Cloudflare Worker for payment confirmation and webhooks |
| `render.yaml` | Render deployment blueprint |

## Technology Stack

| Area | Stack |
| --- | --- |
| Backend | Node.js, Express, TypeScript, Mongoose, Socket.IO, JWT |
| Admin | React, Vite, Axios |
| Mobile | Expo, React Native, React Navigation, Zustand |
| Payments | Razorpay, Cloudflare Workers |
| Deployment | Render, Expo EAS, Cloudflare Workers |

## Getting Started

### Prerequisites

- Node.js 20+
- npm
- MongoDB or MongoDB Atlas
- Android Studio for Android builds
- Expo CLI via `npx expo`
- Wrangler for Cloudflare Worker development

### Environment Files

Create local environment files from:

- `backend/.env.example`
- `admin/.env.example`
- `app/.env.example`
- `workers/canteen-payments/.dev.vars.example`

## Local Development

### Backend

```bash
cd backend
npm install
npm run dev
```

### Admin Dashboard

```bash
cd admin
npm install
npm run dev
```

### Mobile App

```bash
cd app
npm install
npm start
```

Additional app commands:

```bash
npm run android
npm run ios
npm run web
```

### Payment Worker

```bash
cd workers/canteen-payments
npm install
npx wrangler dev
```

## Android Builds

`app/android/` is the active native Android project for the Expo mobile app.

### Debug APK

```bash
cd app/android
./gradlew assembleDebug
```

Output:

- `app/android/app/build/outputs/apk/debug/app-debug.apk`

### Release APK

```bash
cd app/android
./gradlew assembleRelease
```

Output:

- `app/android/app/build/outputs/apk/release/app-release.apk`

### EAS Builds

```bash
cd app
npx eas build -p android --profile preview
npx eas build -p android --profile production
```

## Deployment

### Render

Available deployment blueprints:

- `render.yaml`
- `backend/render.yaml`

Backend health check:

- `/health`

### Cloudflare Worker

Worker configuration:

- `workers/canteen-payments/wrangler.toml`

## Key Services

- authentication and authorization
- order creation and status tracking
- QR-based pickup verification
- payment confirmation
- staff order operations
- notifications and real-time updates

## Notes

- `app/android/` should remain in the repository if Android builds are required.
- Configure a dedicated production signing setup before distributing release builds externally.
