Got it. So the real deployment picture is:
- **Backend** → Render.com (free, always-on after first request)
- **Admin panel** → Vercel (free, instant deploy)
- **Mobile app** → Expo Go on your phone during dev, EAS Build for a real APK

Here is the complete Windsurf prompt. Paste this entire thing into a new Cascade chat:

---

```
You are building a production-ready canteen ordering app for Dayananda Sagar 
College of Engineering (DSCE). This is a REAL app with REAL database connections, 
REAL payment processing, and REAL deployment. You must NOT use mock data, 
in-memory storage, fake timers, or placeholder functions anywhere. Every single 
feature must be fully implemented and working.

═══════════════════════════════════════════════
DEPLOYMENT TARGETS (not localhost)
═══════════════════════════════════════════════

Backend   → Render.com (Node/Express — free tier)
Admin     → Vercel (React/Vite — free tier)
Mobile    → Expo Go (dev) + EAS Build (production APK)
Database  → MongoDB Atlas (user will provide URI)

The app must be structured so that:
- Backend is a standalone Node.js app deployable to Render with a single 
  "npm start" command
- Admin panel is a standalone React/Vite app deployable to Vercel with 
  "npm run build"
- Mobile app runs on physical Android/iOS devices via Expo Go using the 
  Render backend URL (not localhost)

═══════════════════════════════════════════════
FOLDER STRUCTURE — create exactly this
═══════════════════════════════════════════════

/dsce-canteen/
  /backend/
    /src/
      /models/         ← Mongoose models
      /routes/         ← Express route files
      /middleware/     ← Auth, role, rate limit, security
      /services/       ← Razorpay, Nodemailer, Socket, QR
      /utils/          ← helpers
    app.ts             ← Express app setup (no listen here)
    server.ts          ← HTTP + Socket.io server (listen here)
    seed.ts            ← database seeder
    .env.example       ← all required env vars with comments
    package.json
    tsconfig.json
    render.yaml        ← Render deployment config

  /admin/
    /src/
      /pages/
      /components/
      /hooks/
      /api/            ← all axios calls
    .env.example
    package.json
    vite.config.ts
    vercel.json        ← Vercel deployment config

  /app/
    /src/
      /screens/
      /components/
      /store/          ← Zustand stores
      /api/            ← axios instance + all API calls
      /hooks/
      /navigation/
      /types/
    app.json
    package.json
    eas.json           ← EAS Build config

═══════════════════════════════════════════════
ENVIRONMENT VARIABLES
═══════════════════════════════════════════════

Create backend/.env.example with exactly these keys 
(user will copy to .env and fill values):

# Database
MONGO_URI=mongodb+srv://<user>:<pass>@<cluster>.mongodb.net/dsce-canteen

# Auth
JWT_SECRET=<generate a 64-char random hex string as default hint>
JWT_EXPIRES_IN=7d
REFRESH_TOKEN_SECRET=<generate a different 64-char random hex string>
QR_SECRET=<generate another different 64-char random hex string>

# App
PORT=4000
NODE_ENV=production
FRONTEND_URL=https://dsce-canteen-admin.vercel.app
ALLOWED_ORIGINS=https://dsce-canteen-admin.vercel.app,exp://

# Email (Gmail SMTP)
EMAIL_HOST=smtp.gmail.com
EMAIL_PORT=587
EMAIL_USER=<gmail address>
EMAIL_PASS=<gmail app password — not account password>

# Razorpay (get from razorpay.com/dashboard — use test keys first)
RAZORPAY_KEY_ID=rzp_test_xxxxxxxxxxxx
RAZORPAY_KEY_SECRET=<your razorpay key secret>
RAZORPAY_WEBHOOK_SECRET=<set this in Razorpay dashboard under webhooks>

Create app/.env.example:
EXPO_PUBLIC_API_URL=https://your-render-app.onrender.com

Create admin/.env.example:
VITE_API_URL=https://your-render-app.onrender.com

═══════════════════════════════════════════════
SECURITY ARCHITECTURE — implement ALL of these
═══════════════════════════════════════════════

Install and configure these packages in the backend:
- helmet (sets 14 security headers automatically)
- express-rate-limit (rate limit all routes)
- express-mongo-sanitize (prevents NoSQL injection)
- xss-clean (strips XSS from req.body, req.query)
- hpp (HTTP parameter pollution prevention)
- cors (strict origin whitelist from ALLOWED_ORIGINS env var)
- express-validator (input validation on every route)
- bcrypt with 12 rounds
- jsonwebtoken for access + refresh token pattern

Security middleware stack in app.ts (order matters):
1. helmet()
2. cors({ origin: ALLOWED_ORIGINS.split(","), credentials: true })
3. express-rate-limit: max 100 requests per 15 minutes globally
4. Stricter rate limit on /api/auth: max 10 requests per 15 minutes
5. Strictest rate limit on /api/auth/login: max 5 per 15 minutes (brute force protection)
6. express.json({ limit: "10kb" }) — prevent large payload attacks
7. express-mongo-sanitize()
8. xss-clean()
9. hpp()

Payment security (this is how production payment apps work — implement exactly):

A) Idempotency: every POST /api/orders/create generates a UUID idempotency key, 
   stored on the order document. If the same user submits again within 30 seconds, 
   return the existing order instead of creating a new Razorpay order.

B) Amount lock: price is ALWAYS calculated server-side by fetching each menuItemId 
   from MongoDB. The client sends only { menuItemId, quantity, tempPreference }. 
   The server calculates the total. If client-sent amount differs from server 
   calculated amount by even 1 paise, reject with 400.

C) Razorpay webhook verification — CRITICAL:
   Mount POST /api/orders/webhook/razorpay BEFORE express.json() middleware.
   Use express.raw({ type: "application/json" }) on this route ONLY.
   Verify: crypto.createHmac("sha256", RAZORPAY_WEBHOOK_SECRET)
                  .update(req.body)  ← raw Buffer, not parsed JSON
                  .digest("hex")
   Compare to x-razorpay-signature header using 
   crypto.timingSafeEqual() — not === operator (prevents timing attacks).
   If signature fails: log the attempt with IP and return 400. Do not process.
   If signature passes: parse JSON from raw body THEN process payment.

D) QR Token security:
   QR tokens are JWTs signed with QR_SECRET (separate from JWT_SECRET).
   Payload: { orderId, userId, amount, items: [{id, qty}], exp: now + 6hrs }
   On fulfill: verify signature, check exp, check order.userId === token.userId,
   check order.status === "paid" (not already "fulfilled").
   Use crypto.timingSafeEqual for any string comparisons.

E) Access + Refresh token pattern:
   Login returns { accessToken (15min expiry), refreshToken (7day expiry) }
   POST /api/auth/refresh accepts refreshToken, returns new accessToken.
   Store refreshToken in MongoDB RefreshToken collection with userId and expiry.
   On logout: delete the RefreshToken document (server-side invalidation).
   Mobile app uses axios interceptor: on 401, automatically call /refresh, 
   retry original request. If refresh fails, logout user.

F) All user inputs validated with express-validator before any DB operation.
   Sanitize: trim, escape. Validate: isEmail, isLength, matches (USN pattern).
   USN must match pattern /^[1-9][A-Z]{2}\d{2}[A-Z]{2}\d{3}$/ 
   Email must end in @dsce.edu.in (checked with custom validator).

═══════════════════════════════════════════════
MONGODB MODELS — implement with full validation
═══════════════════════════════════════════════

User model:
{
  usn: { type: String, required, unique, uppercase, trim, 
         match: /^[1-9][A-Z]{2}\d{2}[A-Z]{2}\d{3}$/ },
  name: { type: String, required, trim, maxlength: 100 },
  email: { type: String, required, unique, lowercase, trim },
  passwordHash: { type: String, required, select: false },
  role: { type: String, enum: ["student","staff","manager","admin"], 
          default: "student" },
  isVerified: { type: Boolean, default: false },
  loginAttempts: { type: Number, default: 0 },
  lockUntil: Date,
  createdAt: { type: Date, default: Date.now }
}
Add method: user.isLocked() → returns true if lockUntil > now
Add method: user.incrementLoginAttempts() → if attempts >= 5, set lockUntil = now + 30min

OTP model:
{
  email: { type: String, required, lowercase },
  code: { type: String, required },  ← store HASHED otp (bcrypt 10 rounds)
  expiresAt: { type: Date, required }
}
TTL index: { expiresAt: 1 } with expireAfterSeconds: 0
Never store OTP in plaintext. Hash it before saving. Compare with bcrypt on verify.

RefreshToken model:
{
  token: { type: String, required, unique },  ← store hashed with SHA256
  userId: { type: ObjectId, ref: "User", required },
  expiresAt: Date,
  userAgent: String,
  ip: String
}
TTL index on expiresAt.

MenuItem model:
{
  name: { type: String, required, trim, maxlength: 100 },
  description: { type: String, required, maxlength: 500 },
  imageUrl: { type: String, required },
  price: { type: Number, required, min: 1, max: 10000 },
  calories: { type: Number, required, min: 0 },
  category: { type: String, enum: ["meals","snacks","beverages","desserts"], required },
  tempOptions: [{ type: String, enum: ["cold","normal","hot"] }],
  isAvailable: { type: Boolean, default: true },
  preparationMinutes: { type: Number, default: 10 }
}

Order model:
{
  userId: { type: ObjectId, ref: "User", required },
  items: [{
    menuItemId: { type: ObjectId, ref: "MenuItem", required },
    name: String,      ← snapshot at time of order (menu price may change later)
    price: Number,     ← snapshot
    quantity: { type: Number, required, min: 1, max: 10 },
    tempPreference: { type: String, enum: ["cold","normal","hot"] },
  }],
  scheduledTime: { type: String, required },
  totalAmount: { type: Number, required },
  idempotencyKey: { type: String, unique },
  razorpayOrderId: { type: String, unique, sparse: true },
  razorpayPaymentId: { type: String, sparse: true },
  status: { type: String, 
            enum: ["pending_payment","paid","preparing","ready","fulfilled","failed"],
            default: "pending_payment" },
  qrToken: { type: String, select: false },
  fulfilledBy: { type: ObjectId, ref: "User" },
  fulfilledAt: Date,
  webhookVerified: { type: Boolean, default: false },
  createdAt: { type: Date, default: Date.now }
}

═══════════════════════════════════════════════
BACKEND ROUTES — implement every handler fully
═══════════════════════════════════════════════

POST /api/auth/signup
  - validate with express-validator: name, usn (pattern), email (@dsce.edu.in), 
    password (min 8 chars, 1 uppercase, 1 number, 1 special char)
  - check user doesn't already exist
  - hash password with bcrypt 12 rounds
  - save user with isVerified: false
  - generate 6-digit OTP, hash it (bcrypt 10 rounds), save to OTP collection
  - send email via Nodemailer with a proper HTML template showing the OTP 
    (not plaintext), 10-minute warning, DSCE branding
  - return { message: "OTP sent to your college email" }

POST /api/auth/verify-otp
  - find OTP document by email
  - if not found: return 400 "OTP expired or not found"
  - compare provided code with stored hash using bcrypt.compare
  - if no match: return 400 "Invalid OTP"
  - delete OTP document
  - set user.isVerified = true
  - generate accessToken (15min) and refreshToken (7 days)
  - hash refreshToken with SHA256, save RefreshToken document with ip and userAgent
  - return { accessToken, refreshToken, user: { id, name, usn, email, role } }

POST /api/auth/login
  - check if user.isLocked() → 429 "Account locked, try in 30 minutes"
  - fetch user with passwordHash (select: "+passwordHash")
  - bcrypt.compare password
  - if wrong: user.incrementLoginAttempts() → 401
  - if correct: reset loginAttempts to 0, generate tokens, return same shape as verify-otp

POST /api/auth/refresh
  - receive { refreshToken } in body
  - hash it with SHA256, find in RefreshToken collection
  - verify it's not expired
  - verify the JWT (REFRESH_TOKEN_SECRET)
  - generate new accessToken
  - return { accessToken }

POST /api/auth/logout
  - hash the provided refreshToken, delete from RefreshToken collection
  - return { message: "Logged out" }

POST /api/auth/resend-otp
  - rate limited to 3 per hour per email
  - delete existing OTP for this email
  - generate and send new one

GET /api/menu
  - public, no auth
  - return all items where isAvailable: true
  - sort by category, then name

POST /api/menu (requireRole: manager, admin)
  - validate all fields
  - create MenuItem
  - return created item

PATCH /api/menu/:id (requireRole: manager, admin)
  - validate id is valid ObjectId
  - find and update, return updated item

DELETE /api/menu/:id (requireRole: admin)
  - soft delete: set isAvailable: false rather than actually deleting
  - (orders reference menuItemId, hard delete breaks history)

POST /api/orders/create (requireAuth, requireRole: student)
  - generate idempotencyKey = SHA256(userId + sorted menuItemIds + scheduledTime)
  - check if Order with this idempotencyKey exists and was created < 60s ago → return it
  - fetch each menuItemId from DB, verify all exist and isAvailable: true
  - calculate totalAmount server-side: sum(item.price * quantity)
  - validate scheduledTime is a valid future time within today's canteen hours (8am-8pm)
  - call Razorpay API: razorpay.orders.create({ amount: totalAmount * 100, currency: "INR", 
    receipt: orderId.toString(), notes: { userId, scheduledTime } })
  - save Order with status: "pending_payment", snapshot item names+prices from DB
  - return { razorpayOrderId, amount: totalAmount * 100, currency: "INR", 
             key: RAZORPAY_KEY_ID, orderId: savedOrder._id }

POST /api/orders/webhook/razorpay
  ← MUST be mounted BEFORE express.json() with express.raw({ type: "application/json" })
  - verify HMAC signature with crypto.timingSafeEqual
  - if invalid: log { ip, timestamp, body: req.body.toString().slice(0,200) } → return 400
  - parse JSON from raw buffer
  - handle event "payment.captured":
      find Order by razorpayOrderId (from payment.entity.order_id)
      if order.status !== "pending_payment": return 200 (idempotent)
      set status: "paid", razorpayPaymentId, webhookVerified: true
      generate qrToken: sign { orderId, userId, amount, items } with QR_SECRET, 6hr expiry
      save qrToken (hashed with SHA256) to order.qrToken
      return qrToken (raw JWT) only via Socket.io, NEVER in webhook response
      emit via Socket.io to room userId: { event: "order:paid", orderId, qrToken }
  - handle event "payment.failed":
      set order.status: "failed"
      emit { event: "order:failed", orderId } to user's socket room
  - always return 200 to Razorpay (they retry on non-200)

GET /api/orders/my (requireAuth)
  - return orders for req.user.id, newest first
  - populate item names from snapshot (not from MenuItem ref — use stored snapshots)
  - do NOT return qrToken in this response

GET /api/orders/:id (requireAuth)
  - return order only if order.userId === req.user.id OR role is staff/manager/admin
  - if student and order.status is "paid": return qrToken (the raw JWT, fetched fresh 
    from DB by doing Order.findById(id).select("+qrToken"))

POST /api/orders/:id/fulfill (requireAuth, requireRole: staff, manager, admin)
  - receive { qrToken } in body
  - verify qrToken JWT with QR_SECRET
  - if expired: return 400 "QR code expired"
  - extract orderId and userId from token payload
  - fetch order from DB
  - compare SHA256(qrToken) with stored order.qrToken using crypto.timingSafeEqual
  - if order.status === "fulfilled": return 400 "Order already fulfilled"
  - if order.status !== "paid": return 400 "Payment not confirmed"
  - verify token.userId matches order.userId (prevents QR token swapping)
  - set order.status: "fulfilled", order.fulfilledBy: req.user.id, order.fulfilledAt: now
  - emit { event: "order:fulfilled", orderId } to socket room of order.userId
  - return { success: true, order: { items, scheduledTime, studentName } }

GET /api/admin/users (requireRole: admin)
  - return all users (exclude passwordHash)

PATCH /api/admin/users/:id/role (requireRole: admin)
  - cannot change own role (req.user.id !== id check)
  - cannot set role to "admin" (only seeded admins exist)
  - valid targets: student, staff, manager
  - update and return user

GET /api/admin/orders (requireRole: staff, manager, admin)
  - return today's orders, sorted newest first
  - populated with user USN and name

GET /api/admin/stats (requireRole: manager, admin)
  - return: { ordersToday, revenueToday, pendingOrders, popularItem }
  - calculate from DB with aggregation pipeline, not in JS

═══════════════════════════════════════════════
SOCKET.IO SETUP
═══════════════════════════════════════════════

Configure Socket.io on the same HTTP server as Express.
CORS: same ALLOWED_ORIGINS as Express.
Auth middleware on Socket.io: verify the accessToken JWT on connection.
  socket.handshake.auth.token → verify → attach socket.data.user
  If invalid token: socket.disconnect()

Events the server handles:
  "join" → socket.join(socket.data.user.id.toString())

Events the server emits to rooms:
  "order:paid"      → to room userId: { orderId, qrToken }
  "order:failed"    → to room userId: { orderId }
  "order:fulfilled" → to room userId: { orderId }
  "order:update"    → to room "staff": { order } (broadcast new orders to staff panel)

═══════════════════════════════════════════════
MOBILE APP (/app)
═══════════════════════════════════════════════

Packages (install all of these):
expo, expo-camera, expo-status-bar, expo-secure-store,
@react-navigation/native, @react-navigation/native-stack, @react-navigation/bottom-tabs,
react-native-screens, react-native-safe-area-context,
react-native-razorpay, react-native-qrcode-svg,
@shopify/flash-list, react-native-reanimated, react-native-gesture-handler,
zustand, axios, socket.io-client, expo-haptics,
react-native-skeleton-placeholder, lottie-react-native

Store tokens securely with expo-secure-store (NOT AsyncStorage — AsyncStorage is not 
encrypted, expo-secure-store uses Android Keystore / iOS Keychain).

Design language:
  Background: #0a0f1e
  Card surface: #141929
  Elevated surface: #1e2640
  Accent (primary): #f97316 (warm orange)
  Accent (secondary): #fb923c
  Text primary: #ffffff
  Text secondary: #94a3b8
  Text muted: #475569
  Success: #22c55e
  Error: #ef4444
  Border: #1e2a45
  Border radius: 16px cards, 12px inputs, 8px chips
  Font: Use expo-font to load "Nunito" for body and "Nunito_800ExtraBold" for headings
  Tab bar: background #0d1425, no border, active tint #f97316

Zustand stores — all state persisted to expo-secure-store:

authStore: {
  user: User | null,
  accessToken: string | null,
  refreshToken: string | null,
  setAuth(user, accessToken, refreshToken): void,
  updateAccessToken(token): void,
  logout(): void  ← clears secure store too
}

cartStore: {
  items: CartItem[],
  addItem(menuItem, qty, tempPreference, scheduledTime): void,
  removeItem(menuItemId): void,
  updateQty(menuItemId, qty): void,
  clearCart(): void,
  total: computed from items
}

Axios instance (src/api/client.ts):
  baseURL: process.env.EXPO_PUBLIC_API_URL
  timeout: 10000
  Request interceptor: attach Authorization: Bearer <accessToken> from authStore
  Response interceptor:
    On 401: call POST /auth/refresh with refreshToken
    If refresh succeeds: update authStore accessToken, retry original request once
    If refresh fails: call authStore.logout(), navigate to Auth screen
    On network error: show user-friendly toast "No internet connection"

Socket.io client (src/api/socket.ts):
  Connect with { auth: { token: accessToken } }
  On connect: emit "join" with userId
  Export: connect(), disconnect(), on(event, cb), off(event, cb)
  Reconnect automatically (socket.io-client handles this)
  On reconnect: re-emit "join"

SCREENS — implement each completely:

AuthScreen:
  Two tabs: Login / Sign Up toggled with animated underline indicator
  Sign Up: Name, USN (auto-uppercase), College Email, Password, Confirm Password
  All fields validated client-side before API call:
    USN: must match /^[1-9][A-Z]{2}\d{2}[A-Z]{2}\d{3}$/
    Email: must end in @dsce.edu.in
    Password: min 8 chars, show strength indicator (weak/medium/strong)
  Login: Email, Password, "Forgot Password?" link (just show "Contact admin" for now)
  Show/hide password toggle on password fields
  Loading spinner on the button during API call
  On signup success → navigate to OtpScreen
  On login success → navigate to Main (tab navigator)
  On error: show error below the relevant field (not an alert)

OtpScreen:
  6 individual TextInput boxes in a row, each maxLength 1
  Auto-focus next box on digit entry, auto-focus previous on backspace
  Paste detection: if user pastes 6 digits, auto-fill all boxes
  Countdown timer: "Resend OTP in 0:47"
  Resend button appears when timer hits 0
  Verify button disabled until all 6 digits filled
  Show haptic feedback (expo-haptics) on success and error
  On success: navigate to Main

HomeScreen:
  Safe area header: "DSCE Canteen" logo left, greeting right "Hi, [firstname]"
  Orange notification dot if there are active/paid orders
  Below header: horizontal scrollable category chips 
    (All | Meals | Snacks | Beverages | Desserts)
  FlashList numColumns={2} with 12px gap
  FoodCard component:
    Image at top (use Image with resizeMode="cover", height 140)
    Show SkeletonPlaceholder while image loads
    If no imageUrl: show category-colored placeholder with first letter of item name
    Name (medium weight), calorie count in small muted text
    Price in orange bold "₹XX"
    Circular + button in orange at bottom-right
    Tapping + adds to cart with default preferences: 
      tempPreference = tempOptions[0], scheduledTime = nearest 15-min slot
    Show a brief toast at bottom "Added to cart" with haptic feedback
  Tapping card → ItemDetailScreen

ItemDetailScreen:
  Full-screen header image (height 280) with back button overlay
  LinearGradient from transparent to #0a0f1e over bottom of image
  Scrollable content below:
    Name (24px bold), category chip, calories, description
    Temperature selector: 
      Only render chips for tempOptions that exist on this item
      e.g. if item.tempOptions = ["cold","normal"], don't show "Hot" chip
      Selected chip: orange background, white text
      Unselected: card surface background
    Time picker:
      Label "Pick up time"
      Horizontal ScrollView of time slot chips
      Generate slots from (now + 15min) to 20:00, every 15 minutes
      If current time is after 19:45, show "Canteen is closed for orders"
    Quantity stepper: − [number] + with min 1, max 10
    Sticky bottom bar: "Add to Cart — ₹[price × qty]" orange button
  On add: save to cartStore with all preferences, show success animation, 
  trigger haptic, pop navigation back

CartScreen:
  Header: "Your Order" + item count badge
  ScrollView of CartItem rows:
    Item name, temp preference chip, scheduled time, price
    Qty stepper inline (− qty +), delete icon at right
  Order summary card:
    Subtotal, "Platform fee: ₹0", Total in orange bold
  If cart empty: illustration + "Nothing here yet" + "Browse Menu" button
  Sticky bottom: "Pay ₹[total] via UPI" orange button
  On pay tap:
    POST /api/orders/create
    On success: open RazorpayCheckout.open({
      key: response.key,
      order_id: response.razorpayOrderId,
      amount: response.amount,
      currency: "INR",
      name: "DSCE Canteen",
      description: "Food Order",
      prefill: { email: user.email, name: user.name },
      theme: { color: "#f97316" }
    })
    Razorpay success callback: do NOT navigate. Show loading overlay 
    "Confirming payment..." and wait for socket "order:paid" event.
    If socket event received within 30s: navigate to OrderQRScreen
    If no socket event in 30s: show "Payment processing, check Orders tab"
    Razorpay dismiss/cancel: remove overlay, stay on cart
  On API error: show error message inline (not alert)

OrderQRScreen:
  Receives orderId as route param
  Fetches GET /api/orders/:id on mount to get qrToken and order details
  Full dark screen:
    "Show this to canteen staff" header
    Scheduled time prominently displayed
    QRCode component: value={qrToken}, size=280, backgroundColor="#141929", 
    color="#ffffff"
    Orange animated pulsing ring around QR (Reanimated infinite loop)
    Below QR: ordered items list (name + qty)
    Total amount
  Subscribe to socket "order:fulfilled" event for this orderId:
    On event: 
      Stop pulsing animation
      Animate QR out (scale to 0 + fade)
      Animate in success state:
        Large green checkmark (Lottie animation if available, else Reanimated drawn check)
        "Your food is ready!" text
        "Enjoy your meal" subtitle
        Confetti burst using react-native-reanimated (just colored rects raining down)
        Haptic notification (expo-haptics.notificationAsync success)
      "Done" button → navigate back to Home

OrdersScreen:
  Header "My Orders"
  FlatList of order history from GET /api/orders/my
  Each row:
    Date + time (formatted "Today, 2:30 PM" or "Mar 29, 1:00 PM")
    Items summary "Masala Dosa, Cold Coffee +1 more"
    Total "₹85"
    Status badge with colors:
      pending_payment → gray "Pending"
      paid → blue "Paid"
      preparing → amber "Preparing"  
      ready → green "Ready"
      fulfilled → success green "Collected"
      failed → red "Failed"
  Tapping a paid/preparing/ready order → navigate to OrderQRScreen

ProfileScreen:
  Avatar circle with initials (first letter of name, orange background)
  Name, USN, Email displayed
  "My Orders" link → OrdersScreen
  "Sign Out" button → calls POST /api/auth/logout, clears stores, navigate to Auth

Staff Scanner Screen (visible only if user.role === "staff" or "manager" or "admin"):
  Add as 5th tab icon (a QR code scan icon), only show if role !== "student"
  Full screen expo-camera with Camera.Constants.Type.back
  Square scan overlay: 4 corner brackets in orange, 
  animated scanning line moving top to bottom (Reanimated)
  On barcode detected:
    Pause scanning (set scanning = false to prevent duplicates)
    Vibrate (expo-haptics)
    POST /api/orders/:orderId/fulfill with { qrToken: scannedValue }
    On success:
      Green flash overlay for 2 seconds showing:
        "Order Fulfilled!" title
        Student name
        Items list
        Scheduled time
      Then reset to scanning
    On error:
      Red flash overlay for 2 seconds showing the error message
      Then reset to scanning

═══════════════════════════════════════════════
ADMIN PANEL (/admin)
═══════════════════════════════════════════════

React + Vite + TypeScript. Same dark color scheme as mobile.
React Router v6 for routing. TanStack Query for data fetching.
Socket.io-client connected as a React context so updates are live.
axios instance with JWT interceptor (same refresh token pattern as mobile).

Route structure:
  /login          ← no auth required
  /dashboard      ← requireRole: manager, admin
  /menu           ← requireRole: manager, admin
  /orders         ← requireRole: staff, manager, admin
  /users          ← requireRole: admin only

Login page:
  Simple centered card. Email + password. Error inline.
  On success: store tokens in localStorage (admin panel is not a phone, 
  localStorage is fine here). Navigate to /dashboard.

Dashboard page:
  4 stat cards: Orders Today, Revenue Today (₹), Pending Orders, Top Item
  All from GET /api/admin/stats
  Line chart (Recharts ResponsiveContainer + LineChart) showing orders per hour
  Table of last 10 orders with live status updates via socket

Menu page:
  Table with columns: Image, Name, Category, Price, Calories, Temp Options, Available
  Available column: Toggle switch (PATCH /api/menu/:id { isAvailable })
  "Add Item" button → opens a side drawer form with all fields
  Inline edit: clicking any row field opens an input in place
  Image URL field: show preview img tag below the input

Orders page:
  Auto-refreshing table of today's orders (socket event "order:update" triggers re-query)
  Filter buttons: All / Pending Payment / Paid / Preparing / Fulfilled
  Columns: Time, USN, Student Name, Items, Total, Status badge
  Status updates reflected live via Socket.io

Users page (admin only):
  Table: Name, USN, Email, Role, Joined
  Role column: dropdown select to change role (PATCH /api/admin/users/:id/role)
  Cannot edit own row (disable the dropdown)
  Filter by role

═══════════════════════════════════════════════
DATABASE SEEDER (backend/src/seed.ts)
═══════════════════════════════════════════════

Run with: npx ts-node src/seed.ts
Do NOT wipe and reseed if data exists. Check first.

Create these accounts (all pre-verified, isVerified: true):
  admin@dsce.edu.in / Admin@123! / role: admin / USN: 1DS21CS001
  manager@dsce.edu.in / Manager@123! / role: manager / USN: 1DS21CS002
  staff@dsce.edu.in / Staff@123! / role: staff / USN: 1DS21CS003
  test@dsce.edu.in / Test@123! / role: student / USN: 1DS21CS004

Create 14 menu items:
  MEALS:
    Masala Dosa: ₹55, 350 cal, tempOptions: ["normal","hot"], prep: 12min
    Idli Sambar (3pc): ₹40, 280 cal, tempOptions: ["normal","hot"], prep: 8min
    Veg Fried Rice: ₹70, 450 cal, tempOptions: ["normal","hot"], prep: 15min
    Chicken Biryani: ₹110, 620 cal, tempOptions: ["normal","hot"], prep: 20min
    Chapati with Curry (3pc): ₹50, 380 cal, tempOptions: ["normal","hot"], prep: 10min

  SNACKS:
    Samosa (2pc): ₹20, 180 cal, tempOptions: ["normal","hot"], prep: 5min
    Veg Puff: ₹18, 220 cal, tempOptions: ["normal","hot"], prep: 5min
    French Fries: ₹60, 310 cal, tempOptions: ["normal","hot"], prep: 8min
    Bread Omelette: ₹35, 290 cal, tempOptions: ["normal","hot"], prep: 7min

  BEVERAGES:
    Filter Coffee: ₹20, 80 cal, tempOptions: ["hot"], prep: 3min
    Cold Coffee: ₹45, 180 cal, tempOptions: ["cold"], prep: 4min
    Fresh Lime Soda: ₹30, 60 cal, tempOptions: ["cold"], prep: 3min
    Masala Chai: ₹15, 70 cal, tempOptions: ["hot"], prep: 3min

  DESSERTS:
    Gulab Jamun (2pc): ₹30, 210 cal, tempOptions: ["cold","normal","hot"], prep: 2min

Use placeholder imageUrl format: 
"https://placehold.co/400x300/1e2640/f97316?text=ItemName"
Replace spaces with + in the item name for the URL.

═══════════════════════════════════════════════
DEPLOYMENT CONFIG FILES
═══════════════════════════════════════════════

backend/render.yaml:
  services:
    - type: web
      name: dsce-canteen-backend
      env: node
      buildCommand: npm install && npm run build
      startCommand: npm start
      envVars:
        - key: NODE_ENV
          value: production
        (list all other keys from .env.example as sync: false so user fills them in dashboard)

backend/package.json scripts:
  "build": "tsc"
  "start": "node dist/server.js"
  "dev": "ts-node-dev src/server.ts"
  "seed": "ts-node src/seed.ts"

admin/vercel.json:
  {
    "rewrites": [{ "source": "/(.*)", "destination": "/" }]
  }

app/eas.json:
  {
    "cli": { "version": ">= 5.0.0" },
    "build": {
      "development": { "developmentClient": true, "distribution": "internal" },
      "preview": { "distribution": "internal" },
      "production": {}
    }
  }

═══════════════════════════════════════════════
README.md — generate one at the repo root
═══════════════════════════════════════════════

Include:
1. Architecture overview
2. Step-by-step setup:
   a. Clone repo
   b. MongoDB Atlas: create M0 cluster, get URI, paste in backend/.env
   c. Razorpay: create account at razorpay.com, go to Settings > API Keys, 
      generate test keys, paste in backend/.env. 
      Go to Settings > Webhooks, add URL: https://your-render-url.onrender.com/api/orders/webhook/razorpay
      Select event: payment.captured and payment.failed
      Copy webhook secret to backend/.env as RAZORPAY_WEBHOOK_SECRET
   d. Gmail: enable 2FA, go to myaccount.google.com/apppasswords, 
      create app password for "Mail", paste in EMAIL_PASS (not your Gmail password)
   e. Deploy backend to Render: connect GitHub, set env vars in dashboard
   f. Deploy admin to Vercel: connect GitHub, set VITE_API_URL in dashboard
   g. Update app/.env with the Render URL
   h. Run mobile app: cd app && npx expo start
   i. Seed database: cd backend && npm run seed
3. Test credentials (from seed)
4. How to promote a student to staff (via admin panel or direct DB)

═══════════════════════════════════════════════
FINAL RULES — Windsurf must follow all of these
═══════════════════════════════════════════════

1. Do not use any mock data, hardcoded arrays of food items, or fake API responses.
   Every screen fetches from the real backend.

2. Do not use AsyncStorage for tokens. Use expo-secure-store exclusively.

3. Do not trust client-submitted prices. Always calculate server-side.

4. The Razorpay webhook route must use express.raw() not express.json().

5. Do not skip the refresh token flow. Implement it completely.

6. Do not use === for comparing secrets or tokens. Use crypto.timingSafeEqual().

7. Do not store OTPs in plaintext. Hash them with bcrypt before saving.

8. Every API route must have express-validator validation. No unvalidated inputs reach 
   the database.

9. The mobile app must handle no-internet gracefully with user-readable error messages, 
   not crashes.

10. Generate a complete README.md with exact setup steps so the app can be deployed 
    and running without any guesswork.

Build everything now. Start with the backend, then the mobile app, then the admin panel.
After generating all files, list every file created and the exact commands needed to 
install dependencies for each of the three parts.
```

---

When Windsurf starts building, watch for these three moments where AI agents typically cut corners — if you see any of these, tell it to fix immediately:

If it creates a fake `menuItems` array instead of fetching from MongoDB, say: *"You are using mock data. Delete the array and fetch from the real database."*

If it skips the Razorpay webhook verification and just trusts the app-side callback, say: *"Implement the full HMAC webhook verification with express.raw() and crypto.timingSafeEqual()."*

If it uses `AsyncStorage` for tokens instead of `expo-secure-store`, say: *"Replace all AsyncStorage usage with expo-secure-store. Tokens must be stored in the device keychain."*