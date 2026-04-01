# Ybyte Canteen App Architecture & Context

This document is designed to give AI assistants a complete overview of the Ybyte (formerly DSCE Canteen) ordering platform without needing to parse the entire codebase.

## 1. Project Structure
The project is split into three main components:
- `/app`: The mobile application built with React Native and Expo (SDK 54).
- `/backend`: The primary Node.js/Express API deployed on Render, connecting to MongoDB Atlas.
- `/workers/canteen-payments`: A Cloudflare Worker specifically handling Razorpay webhooks and payment verifications securely.

## 2. Tech Stack & Key Libraries
- **Mobile (React Native/Expo)**:
  - Navigation: `@react-navigation/native` & `@react-navigation/bottom-tabs`.
  - State Management: `zustand` (stores in `app/src/stores/`).
  - Network: `axios` (configured in `app/src/api/index.ts` with auto-JWT attachment).
  - Storage: `expo-secure-store` for JWT holding.
  - UI Elements: No major component libraries. Entirely custom UI with `expo-vector-icons` and `@react-native-community/datetimepicker`.
  - Realtime: `socket.io-client` listening to backend updates.
  - Payments: `react-native-razorpay` used in `PaymentScreen.tsx`.

- **Backend (Node.js/Express)**:
  - Database: `mongoose` with models in `backend/src/models/`.
  - Auth: JWT-based (`access_token`, `refresh_token`), with `bcrypt` for passwords.
  - APIs: Grouped in routers (`auth.ts`, `menu.ts`, `orders.ts`, `admin.ts`, `webhook.ts`).
  - Realtime: `socket.io` server attached to Express.
  - Cleanups: `server.ts` runs a `setInterval` every 15 minutes to automatically mark `pending_payment` orders as `failed` to prevent zombie cart blocking.

## 3. Data Models
- **User**: Name, Email, PasswordHash, USN, Role (`student`, `staff`, `manager`, `admin`).
- **MenuItem**: Name, Category, Price, ImageUrl (dummyimage.com), TempOptions (e.g. ['normal', 'hotbed']).
- **Order**:
  - Contains `items` (ref MenuItem, quantity, tempPreference).
  - Contains `timeline` for tracking order state changes.
  - Contains `status`: `pending_payment` -> `preparing` -> `ready` -> `completed` (or `failed`/`abandoned`).
  - Important Field: `isVerified` (boolean) and `razorpayOrderId`.

## 4. Key Workflows

### Checkout & Payment Flow
1. User builds cart via `CartStore`.
2. Taps "Create Order" -> calls `POST /api/orders` sending items and `scheduledTime`.
3. Backend creates order in DB. Critically, it checks the backend `.env` (`PAYMENT_MODE`).
   - If `PAYMENT_MODE=razorpay`, it creates a real Razorpay Order ID via the SDK, and returns `mode: 'razorpay'`.
4. Mobile App routes to `PaymentScreen.tsx`.
   - If `mode === 'razorpay'`, it immediately initializes the `react-native-razorpay` checkout modal.
   - Upon success, the app holds the Razorpay signatures and hits `POST /api/orders/:id/confirm-razorpay`.
5. Backend verifies the signature in `confirm-razorpay` (also ensuring the order *belongs* to the calling user via JWT). Marks it `preparing` and emits a socket event.

### Staff Fulfilling Orders (QR Code Scanning)
1. User's app dynamically generates a QR code from the order ID and a secure secret signing payload (in `TicketScreen.tsx`).
2. Staff log in using the same app but with a `staff` role account.
3. Staff app has an additional tab: the QR Scanner.
4. Staff scan the user's order QR code.
5. The scan triggers `PATCH /api/orders/:id/fulfill` on the backend.
6. The backend marks the order `completed`, records the timeline, and emits socket events (`order:updated`, `order:fulfilled`) to alert the user across the room.

## 5. Environment Map
- **App**: Needs `EXPO_PUBLIC_API_URL` pointing to backend.
- **Backend Render**: Needs `MONGO_URI`, `JWT_SECRET`, `PAYMENT_MODE=razorpay`, `RAZORPAY_KEY_ID`, `RAZORPAY_KEY_SECRET`, `INTERNAL_SECRET`, etc.
- **Cloudflare Worker**: Needs `RAZORPAY_KEY_SECRET` and `RAZORPAY_WEBHOOK_SECRET` for validating payloads out-of-band.
