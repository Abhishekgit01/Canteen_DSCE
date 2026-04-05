## PROMPT — Full Context + Fix Canteen Closed + Pre-Orders + Reviews Crash

Copy into a fresh conversation:

---

> # CONTEXT — READ THIS BEFORE ANYTHING ELSE
>
> You are working on a college canteen food ordering app.
> This is a real production app being prepared for Play Store launch.
> Read every single file listed below completely before writing one line of code.
> Do not assume anything. Do not guess. Read the actual code.
>
> ---
>
> ## WHAT THIS APP IS
>
> A food ordering system for college canteens with:
> - Students browse menu, order food, pay via Razorpay, get QR code, collect food
> - Admin/Manager/Staff manage orders, menu, rush hours, pickup times in real time
> - Multiple colleges supported: DSCE, DSATM, NIE — each has own menu and settings
>
> ---
>
> ## TECH STACK — UNDERSTAND THIS FULLY
>
> ```
> BACKEND:
>   Runtime:    Node.js + TypeScript
>   Framework:  Express
>   Database:   MongoDB via Mongoose (hosted on Atlas)
>   Realtime:   Socket.io
>   Auth:       JWT (7 day expiry)
>   Email:      Resend API (OTP delivery)
>   Hosting:    Render (free tier, kept warm by UptimeRobot)
>   Entrypoint: backend/src/server.ts
>
> CLOUDFLARE WORKER (separate deployment):
>   Handles ONLY 2 routes:
>     POST /webhook/razorpay       ← Razorpay calls this after payment
>     POST /api/orders/:id/confirm-razorpay ← mobile calls this after payment
>   Uses: crypto.subtle for HMAC, MongoDB Atlas Data API for DB writes
>   After confirming payment → calls Render /internal/emit to fire socket
>   URL: https://canteen-payments.theabhishekrp.workers.dev
>
> MOBILE APP:
>   Framework:  Expo React Native (TypeScript)
>   State:      Zustand stores
>   Navigation: React Navigation (Stack)
>   Payment:    react-native-razorpay
>   Sockets:    socket.io-client (singleton in socket.ts)
>   Location:   app/src/
>
> ADMIN PANEL:
>   Framework:  React + Vite (TypeScript)
>   Hosting:    Vercel
>   Auth:       JWT from localStorage
>   Location:   admin/src/
> ```
>
> ---
>
> ## ARCHITECTURE — HOW EVERYTHING CONNECTS
>
> ```
> Mobile App
>   ├── Normal API calls → Render backend (EXPO_PUBLIC_API_URL)
>   ├── confirmPayment ONLY → CF Worker (EXPO_PUBLIC_CF_WORKER_URL)
>   └── Socket → Render backend (same as API URL)
>
> Admin Panel
>   └── All calls → Render backend (VITE_API_URL)
>       (admin never calls CF Worker directly)
>
> Razorpay
>   └── Webhook → CF Worker /webhook/razorpay
>
> CF Worker
>   ├── Reads/writes MongoDB → Atlas Data API (HTTP)
>   └── Fires socket events → Render /internal/emit
>
> Render Backend
>   ├── Connects to MongoDB Atlas (via MONGO_URI)
>   └── Emits socket events to mobile + admin
> ```
>
> ---
>
> ## PAYMENT FLOW — DO NOT TOUCH THIS, UNDERSTAND IT
>
> ```
> 1. Mobile → POST /api/orders (Render)
>    → creates internal order in MongoDB
>    → creates Razorpay order via Razorpay API
>    → returns { order, razorpay: { key_id, razorpay_order_id, amount } }
>
> 2. Mobile opens RazorpayCheckout.open() with those values
>
> 3. User pays → Razorpay calls webhook → CF Worker
>    → CF Worker verifies HMAC
>    → updates order in Atlas Data API
>    → fires POST /internal/emit to Render
>    → Render emits socket order:paid
>
> 4. Mobile also calls POST /api/orders/:id/confirm-razorpay → CF Worker
>    → CF Worker verifies 3-part signature
>    → returns { orderId, qrToken }
>    → Mobile navigates to PaymentSuccessScreen
>
> NEVER touch this flow. It works.
> ```
>
> ---
>
> ## MODELS THAT EXIST (understand their fields)
>
> ```
> User:          name, email, password, role, usn, college, isVerified,
>                otp, otpExpiry, expoPushToken, googleId
>
> MenuItem:      name, description, price, category, image,
>                isAvailable, college, averageRating, totalReviews,
>                ratingBreakdown
>
> Order:         student, items[{menuItem, quantity, price, chefNote}],
>                totalAmount, status, paymentMode, razorpay_order_id,
>                razorpay_payment_id, qrToken, qrUsed, college,
>                estimatedPickupMinutes, estimatedPickupAt
>
> Review:        menuItem, order, student, college, rating, title,
>                body, tags, helpful, isVerified, isVisible
>
> RushHour:      college, dayOfWeek[], startTime, endTime, label,
>                surchargePercent, isActive, message, createdBy
>
> PickupSettings: college, basePickupMinutes, rushHourExtra,
>                 perItemExtra, maxPickupMinutes, openingTime,
>                 closingTime, breakStart, breakEnd, hasBreak,
>                 isOpen, closedMessage
> ```
>
> ---
>
> ## ORDER STATUS FLOW
>
> ```
> pending_payment → paid → preparing → ready → fulfilled
>                        ↘ failed
>
> pre_order (NEW — to be added) → paid → preparing → ready → fulfilled
> ```
>
> ---
>
> ## SOCKET EVENTS
>
> ```
> Server emits:
>   order:paid      → { orderId, qrToken }
>   order:failed    → { orderId }
>   order:updated   → { orderId, status }
>   order:fulfilled → { orderId }
>   order:new       → { order } (to staff room)
>   rush:updated:COLLEGE → { college, timestamp }
>   pickup:updated:COLLEGE → settings object
>
> Students join room: userId
> Staff join room: 'staff'
> ```
>
> ---
>
> ## ROLES
>
> ```
> student  → can order, view own orders, review items
> staff    → can view orders, update status, scan QR
> manager  → staff permissions + manage menu, rush hours,
>            pickup settings, send notifications (own college only)
> admin    → all permissions across all colleges
> ```
>
> ---
>
> ## WHAT IS ALREADY WORKING — DO NOT TOUCH
>
> ```
> ✅ Full Razorpay payment flow (CF Worker + Render)
> ✅ Webhook handling (raw body BEFORE express.json)
> ✅ QR code generation and fulfillment
> ✅ Socket real-time updates
> ✅ Multi-college support (DSCE, DSATM, NIE)
> ✅ Google OAuth login
> ✅ OTP via Resend API (non-blocking)
> ✅ Push notifications via Expo
> ✅ Chef notes on order items
> ✅ Rush hour management
> ✅ Pickup time settings
> ✅ Cat loading animations
> ✅ Payment success screen with animation
> ✅ Admin panel with all CRUD operations
> ✅ Rate limiting, input validation (Zod), compression
> ✅ JWT blacklisting on logout
> ✅ Account lockout after failed attempts
> ```
>
> ---
>
> ## NOW READ THE ENTIRE CODEBASE
>
> Run every command and read every output completely:
>
> ```bash
> # Full structure
> find . -type f \( -name "*.ts" -o -name "*.tsx" \) \
>   | grep -v node_modules | grep -v dist \
>   | grep -v .expo | grep -v ".d.ts" | sort
>
> # All backend files
> cat backend/src/server.ts
> cat backend/src/app.ts
> cat backend/src/routes/auth.ts
> cat backend/src/routes/orders.ts
> cat backend/src/routes/menu.ts
> cat backend/src/routes/admin.ts
> cat backend/src/routes/reviews.ts
> cat backend/src/routes/rushHours.ts
> cat backend/src/routes/pickupSettings.ts
> cat backend/src/routes/notifications.ts
> cat backend/src/services/payment.service.ts
> cat backend/src/services/order-payment.service.ts
> cat backend/src/services/notification.service.ts
> cat backend/src/services/email.service.ts
> cat backend/src/utils/qrToken.ts
> cat backend/src/models/User.ts
> cat backend/src/models/Order.ts
> cat backend/src/models/MenuItem.ts
> cat backend/src/models/Review.ts
> cat backend/src/models/RushHour.ts
> cat backend/src/models/PickupSettings.ts
>
> # All mobile files
> cat app/src/api/index.ts
> cat app/src/api/socket.ts
> cat app/src/stores/authStore.ts
> cat app/src/stores/cartStore.ts
> cat app/src/stores/orderStore.ts
> cat app/src/stores/rushHourStore.ts 2>/dev/null || echo "MISSING"
> cat app/src/navigation/Navigation.tsx
> cat app/src/screens/LoginScreen.tsx
> cat app/src/screens/SignupScreen.tsx
> cat app/src/screens/MenuScreen.tsx
> cat app/src/screens/CartScreen.tsx
> cat app/src/screens/PaymentScreen.tsx
> cat app/src/screens/PaymentSuccessScreen.tsx
> cat app/src/screens/OrdersScreen.tsx
> cat app/src/screens/RateOrderScreen.tsx 2>/dev/null || echo "MISSING"
> cat app/src/screens/MenuItemReviewsScreen.tsx 2>/dev/null || echo "MISSING"
> cat app/src/components/CatLoader.tsx 2>/dev/null || echo "MISSING"
> cat app/app.json
>
> # All admin files
> cat admin/src/api/index.ts
> cat admin/src/context/useAuth.tsx
> cat admin/src/context/useSocket.tsx
> cat admin/src/App.tsx
> find admin/src/pages -name "*.tsx" \
>   -exec echo "=== {} ===" \; -exec cat {} \;
>
> # CF Worker
> find worker/src -name "*.ts" -exec cat {} \;
> cat worker/wrangler.toml
>
> # Dependencies
> cat backend/package.json
> cat app/package.json
> cat admin/package.json
>
> # Env examples
> cat backend/.env.example
> cat app/.env.example 2>/dev/null || echo "MISSING"
> cat admin/.env.example 2>/dev/null || echo "MISSING"
>
> # Check what is mounted in app.ts
> grep -n "use\|router\|route" backend/src/app.ts
>
> # Check all socket emits
> grep -rn "io.emit\|socket.emit\|socket.on" \
>   backend/src/ app/src/ --include="*.ts" --include="*.tsx"
>
> # Find canteen closed logic
> grep -rn "isOpen\|isCurrentlyOpen\|closed\|Closed" \
>   backend/src/ app/src/ admin/src/ \
>   --include="*.ts" --include="*.tsx"
>
> # Find review crash cause
> grep -rn "Review\|review\|getItemReviews\|MenuItemReview" \
>   app/src/ --include="*.ts" --include="*.tsx"
>
> # Check pre-order anywhere
> grep -rn "preOrder\|pre_order\|scheduleFor\|orderFor" \
>   backend/src/ app/src/ --include="*.ts" --include="*.tsx"
> ```
>
> Say "CODEBASE READ COMPLETE" and give me this report:
>
> ```
> DIAGNOSIS REPORT:
>
> CANTEEN CLOSED BUG:
>   Where is isCurrentlyOpen calculated: [file:line]
>   What logic determines it: [show the exact condition]
>   Why it shows closed incorrectly: [your diagnosis]
>
> REVIEWS CRASH:
>   MenuItemReviewsScreen exists: YES/NO
>   RateOrderScreen exists: YES/NO
>   Both in Navigation.tsx: YES/NO
>   getItemReviews function exists in api: YES/NO
>   What crashes and why: [exact error if visible in code]
>   Likely crash cause: [null access / missing import / bad data shape / etc]
>
> PRE-ORDER:
>   Any pre-order logic exists: YES/NO
>   Order model has scheduledFor field: YES/NO
>
> ROUTES MOUNTED:
>   /api/reviews: YES/NO
>   /api/rush-hours: YES/NO
>   /api/pickup-settings: YES/NO
>   /api/notifications: YES/NO
> ```
>
> STOP. Show me the report. Then fix in order below.
>
> ---
>
> # FIX 1 — CANTEEN CLOSED BUG
>
> ## Find the exact bug first
>
> ```bash
> # Show the full isCurrentlyOpen calculation
> grep -A 20 "isCurrentlyOpen\|isOpen\|openingTime\|closingTime" \
>   backend/src/routes/pickupSettings.ts
>
> # Check what mobile does with this value
> grep -A 10 "isCurrentlyOpen\|isOpen\|closedBanner\|Closed" \
>   app/src/screens/MenuScreen.tsx
>
> # Check what timezone backend uses
> node -e "console.log(new Date().toString(), new Date().toISOString())"
>
> # Check what time PickupSettings has stored
> # (run against your actual DB)
> cd backend && node -e "
> require('dotenv').config()
> const mongoose = require('mongoose')
> mongoose.connect(process.env.MONGO_URI).then(async () => {
>   const { PickupSettings } = require('./dist/models/PickupSettings')
>   const s = await PickupSettings.find({})
>   console.log(JSON.stringify(s, null, 2))
>   process.exit(0)
> }).catch(e => { console.log(e.message); process.exit(1) })
> "
> ```
>
> ## Likely bugs to fix
>
> **Bug A — Timezone mismatch (most likely):**
> Render server runs in UTC. Indian time is UTC+5:30.
> If openingTime is "08:00" (IST) but server compares against UTC "02:30",
> canteen appears closed all morning.
>
> Fix in `backend/src/routes/pickupSettings.ts`:
> ```ts
> // WRONG — uses server UTC time
> const now = new Date()
> const currentTime = `${String(now.getHours()).padStart(2,'0')}:${String(now.getMinutes()).padStart(2,'0')}`
>
> // CORRECT — convert to IST (UTC+5:30)
> const now = new Date()
> const ISTOffset = 5.5 * 60 * 60 * 1000
> const IST = new Date(now.getTime() + ISTOffset)
> const currentTime = `${String(IST.getUTCHours()).padStart(2,'0')}:${String(IST.getUTCMinutes()).padStart(2,'0')}`
> const currentDay = IST.getUTCDay()
> ```
>
> Apply same IST fix to `backend/src/routes/rushHours.ts`
> wherever currentTime and currentDay are calculated.
> Apply same fix to order creation in `orders.ts` where rush hour is checked.
>
> **Bug B — Default settings not created:**
> If PickupSettings document does not exist for a college,
> `isCurrentlyOpen` may be undefined and mobile treats it as false.
>
> Fix: always create default settings if missing:
> ```ts
> let settings = await PickupSettings.findOne({ college })
> if (!settings) {
>   settings = await PickupSettings.create({
>     college,
>     basePickupMinutes: 15,
>     openingTime: '08:00',
>     closingTime: '22:00',
>     isOpen: true,
>     hasBreak: false
>   })
> }
> ```
>
> **Bug C — Mobile blocking orders when undefined:**
> In `MenuScreen.tsx`, if `pickupSettings` is null while loading,
> it may show closed. Fix:
> ```ts
> // WRONG — blocks ordering while loading
> {pickupSettings && !pickupSettings.isCurrentlyOpen && (
>   <ClosedBanner />
> )}
>
> // CORRECT — only show closed if settings loaded AND says closed
> {pickupSettings !== null &&
>  pickupSettings !== undefined &&
>  !pickupSettings.isCurrentlyOpen && (
>   <ClosedBanner />
> )}
>
> // Also default to allowing orders until settings load
> const isOrderingAllowed = pickupSettings === null
>   ? true  // assume open while loading
>   : pickupSettings.isCurrentlyOpen
> ```
>
> ---
>
> # FIX 2 — PRE-ORDER FEATURE
>
> ## Backend
>
> **Update `backend/src/models/Order.ts`:**
> ```ts
> // Add these fields
> isPreOrder:    { type: Boolean, default: false },
> scheduledFor:  { type: Date, default: null },
>   // null = order now, Date = scheduled delivery time
> preOrderNote:  { type: String, default: '' }
>   // e.g. "Please have ready by 1pm tomorrow"
> ```
>
> **Update `backend/src/routes/orders.ts` — order creation:**
> ```ts
> // Accept optional scheduledFor in body
> const { items, scheduledFor, preOrderNote } = req.body
>
> // Validate scheduledFor if provided
> let scheduledDate: Date | null = null
> if (scheduledFor) {
>   scheduledDate = new Date(scheduledFor)
>   const now = new Date()
>   const maxAdvance = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000)
>
>   // Must be in future
>   if (scheduledDate <= now) {
>     return res.status(400).json({
>       error: 'Pre-order time must be in the future'
>     })
>   }
>   // Max 7 days in advance
>   if (scheduledDate > maxAdvance) {
>     return res.status(400).json({
>       error: 'Cannot pre-order more than 7 days in advance'
>     })
>   }
>
>   // Check canteen opening hours for that day
>   const settings = await PickupSettings.findOne({
>     college: req.user.college
>   }).lean()
>
>   if (settings) {
>     const ISTOffset = 5.5 * 60 * 60 * 1000
>     const scheduledIST = new Date(scheduledDate.getTime() + ISTOffset)
>     const scheduledTime = `${String(scheduledIST.getUTCHours()).padStart(2,'0')}:${String(scheduledIST.getUTCMinutes()).padStart(2,'0')}`
>
>     if (scheduledTime < settings.openingTime ||
>         scheduledTime > settings.closingTime) {
>       return res.status(400).json({
>         error: `Canteen is only open ${settings.openingTime} - ${settings.closingTime}`
>       })
>     }
>   }
> }
>
> // Create order with pre-order fields
> const order = await Order.create({
>   student: req.user.id,
>   college: req.user.college,
>   items: orderItems,
>   totalAmount: finalAmount,
>   status: 'pending_payment',
>   isPreOrder: !!scheduledDate,
>   scheduledFor: scheduledDate,
>   preOrderNote: preOrderNote ?? '',
>   estimatedPickupMinutes,
>   estimatedPickupAt: scheduledDate ?? pickupAt
> })
>
> // Skip canteen-closed check for pre-orders
> // (allow ordering even when closed, as long as slot is during open hours)
> ```
>
> **Admin — filter pre-orders separately:**
> In `GET /api/orders`:
> ```ts
> // Add ?type=preorder filter
> if (req.query.type === 'preorder') {
>   filter.isPreOrder = true
>   filter.scheduledFor = { $gte: new Date() }
> }
> ```
>
> **Send notification day-of for pre-orders:**
> In `order-payment.service.ts` or a scheduler:
> ```ts
> // Check every 15 minutes for pre-orders due in next 30 min
> setInterval(async () => {
>   const now = new Date()
>   const soon = new Date(now.getTime() + 30 * 60 * 1000)
>
>   const dueOrders = await Order.find({
>     isPreOrder: true,
>     status: 'paid',
>     scheduledFor: { $gte: now, $lte: soon },
>     preOrderNotified: { $ne: true }
>   }).populate('student', 'expoPushToken name')
>
>   for (const order of dueOrders) {
>     const student = order.student as any
>     if (student?.expoPushToken) {
>       await sendPushNotification(
>         student.expoPushToken,
>         '🍱 Your pre-order starts soon!',
>         `Your order will be ready around ${formatTime(order.scheduledFor)}`,
>         { screen: 'Orders', orderId: order._id.toString() }
>       )
>     }
>     // Mark as notified
>     await Order.findByIdAndUpdate(order._id, { preOrderNotified: true })
>   }
> }, 15 * 60 * 1000)
> ```
>
> Add `preOrderNotified: { type: Boolean, default: false }` to Order model.
>
> ## Mobile — Pre-Order UI
>
> **In `app/src/screens/CartScreen.tsx`:**
>
> Add pre-order toggle below the order summary:
> ```tsx
> const [isPreOrder, setIsPreOrder] = useState(false)
> const [scheduledDate, setScheduledDate] = useState<Date | null>(null)
> const [showDatePicker, setShowDatePicker] = useState(false)
>
> // Install date picker
> // npx expo install @react-native-community/datetimepicker
>
> return (
>   <ScrollView>
>     {/* existing cart items */}
>
>     {/* Canteen closed banner — show order anyway option */}
>     {!isCanteenOpen && (
>       <View style={styles.closedNotice}>
>         <Text style={styles.closedIcon}>🔒</Text>
>         <View style={styles.closedText}>
>           <Text style={styles.closedTitle}>
>             Canteen is currently closed
>           </Text>
>           <Text style={styles.closedSub}>
>             You can still place a pre-order for when it opens!
>           </Text>
>         </View>
>       </View>
>     )}
>
>     {/* Pre-order toggle */}
>     <View style={styles.preOrderSection}>
>       <View style={styles.preOrderHeader}>
>         <View>
>           <Text style={styles.preOrderTitle}>📅 Schedule for later</Text>
>           <Text style={styles.preOrderSubtitle}>
>             Order now, pick up at your chosen time
>           </Text>
>         </View>
>         <Switch
>           value={isPreOrder}
>           onValueChange={val => {
>             setIsPreOrder(val)
>             if (!val) setScheduledDate(null)
>             else {
>               // Default to tomorrow at canteen opening time
>               const tomorrow = new Date()
>               tomorrow.setDate(tomorrow.getDate() + 1)
>               tomorrow.setHours(8, 0, 0, 0)
>               setScheduledDate(tomorrow)
>             }
>           }}
>           trackColor={{ false: '#E0E0E0', true: '#A5D6A7' }}
>           thumbColor={isPreOrder ? '#00C853' : '#FFF'}
>         />
>       </View>
>
>       {isPreOrder && (
>         <View style={styles.preOrderPicker}>
>           {/* Quick options */}
>           <Text style={styles.quickLabel}>Quick pick:</Text>
>           <ScrollView horizontal showsHorizontalScrollIndicator={false}>
>             {getQuickSlots(pickupSettings).map(slot => (
>               <TouchableOpacity
>                 key={slot.label}
>                 style={[
>                   styles.slotBtn,
>                   scheduledDate?.getTime() === slot.date.getTime() &&
>                     styles.slotBtnActive
>                 ]}
>                 onPress={() => setScheduledDate(slot.date)}
>               >
>                 <Text style={styles.slotLabel}>{slot.label}</Text>
>                 <Text style={styles.slotTime}>{slot.time}</Text>
>               </TouchableOpacity>
>             ))}
>           </ScrollView>
>
>           {/* Custom time picker */}
>           <TouchableOpacity
>             style={styles.customTimeBtn}
>             onPress={() => setShowDatePicker(true)}
>           >
>             <Text style={styles.customTimeText}>
>               🕐 Custom time: {scheduledDate
>                 ? formatDateTime(scheduledDate)
>                 : 'Tap to choose'}
>             </Text>
>           </TouchableOpacity>
>
>           {showDatePicker && (
>             <DateTimePicker
>               value={scheduledDate ?? new Date()}
>               mode="datetime"
>               minimumDate={new Date(Date.now() + 30 * 60 * 1000)}
>               maximumDate={new Date(Date.now() + 7 * 24 * 60 * 60 * 1000)}
>               onChange={(event, date) => {
>                 setShowDatePicker(false)
>                 if (date) setScheduledDate(date)
>               }}
>             />
>           )}
>
>           {scheduledDate && (
>             <View style={styles.scheduleConfirm}>
>               <Text style={styles.scheduleConfirmText}>
>                 ✅ Scheduled for {formatDateTime(scheduledDate)}
>               </Text>
>             </View>
>           )}
>         </View>
>       )}
>     </View>
>
>     {/* Place order button */}
>     <TouchableOpacity
>       style={styles.placeOrderBtn}
>       onPress={handlePlaceOrder}
>     >
>       <Text style={styles.placeOrderText}>
>         {isPreOrder
>           ? `📅 Pre-Order for ${formatTime(scheduledDate)}`
>           : '🛒 Place Order'}
>       </Text>
>     </TouchableOpacity>
>   </ScrollView>
> )
>
> // Quick slot generator
> const getQuickSlots = (settings: any) => {
>   const slots = []
>   const now = new Date()
>
>   // Tomorrow morning
>   const tomorrowMorning = new Date(now)
>   tomorrowMorning.setDate(tomorrowMorning.getDate() + 1)
>   tomorrowMorning.setHours(8, 0, 0, 0)
>   slots.push({
>     label: 'Tomorrow Morning',
>     time: '8:00 AM',
>     date: tomorrowMorning
>   })
>
>   // Tomorrow lunch
>   const tomorrowLunch = new Date(tomorrowMorning)
>   tomorrowLunch.setHours(12, 30, 0, 0)
>   slots.push({
>     label: 'Tomorrow Lunch',
>     time: '12:30 PM',
>     date: tomorrowLunch
>   })
>
>   // In 1 hour (only if canteen open)
>   const inOneHour = new Date(now.getTime() + 60 * 60 * 1000)
>   slots.push({
>     label: 'In 1 hour',
>     time: formatTime(inOneHour),
>     date: inOneHour
>   })
>
>   return slots
> }
>
> // Pass scheduledFor to createOrder
> const handlePlaceOrder = async () => {
>   const { order, razorpay } = await createOrder({
>     items: cartItems,
>     scheduledFor: isPreOrder ? scheduledDate?.toISOString() : undefined,
>     preOrderNote: isPreOrder
>       ? `Scheduled for ${formatDateTime(scheduledDate)}`
>       : undefined
>   })
>   // ... rest of payment flow unchanged
> }
> ```
>
> **Show pre-order badge on OrdersScreen:**
> ```tsx
> {order.isPreOrder && order.scheduledFor && (
>   <View style={styles.preOrderBadge}>
>     <Text style={styles.preOrderBadgeText}>
>       📅 Pickup: {formatDateTime(order.scheduledFor)}
>     </Text>
>   </View>
> )}
> ```
>
> **Admin panel — pre-orders tab:**
> In `admin/src/pages/OrdersPage.tsx`:
> ```tsx
> // Add tab: [All Orders] [Pre-Orders] [Active] [Completed]
> // Pre-orders tab shows upcoming scheduled orders sorted by scheduledFor
> // Each shows countdown: "Due in 2 hours 30 minutes"
> // Badge color: purple for pre-orders
> ```
>
> ---
>
> # FIX 3 — REVIEWS CRASH
>
> ## Find crash cause first
>
> ```bash
> # Check if screens exist
> ls app/src/screens/ | grep -i "review\|Rate"
>
> # Check navigation
> grep -n "ItemReviews\|RateOrder\|ReviewsScreen\|RateOrder" \
>   app/src/navigation/Navigation.tsx
>
> # Check API functions exist
> grep -n "getItemReviews\|submitReview\|markReviewHelpful\|getPendingReviews" \
>   app/src/api/index.ts
>
> # Check if route mounted on backend
> grep -n "review" backend/src/app.ts
>
> # Check Review model
> cat backend/src/models/Review.ts
>
> # Check if reviews route has the admin endpoint
> grep -n "router\." backend/src/routes/reviews.ts
> ```
>
> ## Common crash causes and fixes
>
> **CRASH A — Screen not in Navigation.tsx:**
> Most common. App navigates to undefined screen → crash.
> ```tsx
> // In Navigation.tsx add if missing:
> import RateOrderScreen from '../screens/RateOrderScreen'
> import MenuItemReviewsScreen from '../screens/MenuItemReviewsScreen'
>
> <Stack.Screen
>   name="RateOrder"
>   component={RateOrderScreen}
>   options={{ title: 'Rate Your Meal' }}
> />
> <Stack.Screen
>   name="ItemReviews"
>   component={MenuItemReviewsScreen}
>   options={({ route }: any) => ({
>     title: route.params?.menuItemName ?? 'Reviews'
>   })}
> />
> ```
>
> **CRASH B — Null data not handled:**
> API returns unexpected shape → `.map()` on undefined → crash.
> Add null guards to `MenuItemReviewsScreen.tsx`:
> ```tsx
> // Every array access must have fallback
> const reviews = data?.reviews ?? []
> const breakdown = menuItem?.ratingBreakdown ?? {}
> const total = menuItem?.totalReviews ?? 0
> const average = menuItem?.averageRating ?? 0
>
> // Never do: data.reviews.map(...)
> // Always do: (data?.reviews ?? []).map(...)
>
> // Add error boundary
> const [error, setError] = useState<string | null>(null)
>
> if (error) return (
>   <View style={styles.errorContainer}>
>     <Text style={styles.errorIcon}>😿</Text>
>     <Text style={styles.errorTitle}>Could not load reviews</Text>
>     <Text style={styles.errorMsg}>{error}</Text>
>     <TouchableOpacity onPress={() => {
>       setError(null)
>       fetchReviews(1)
>     }}>
>       <Text style={styles.retryBtn}>Try again</Text>
>     </TouchableOpacity>
>   </View>
> )
>
> // Wrap fetchReviews in try/catch
> try {
>   const result = await getItemReviews(menuItemId, p, s)
>   setData(result)
> } catch (err: any) {
>   setError(err.message ?? 'Failed to load reviews')
> } finally {
>   setLoading(false)
> }
> ```
>
> **CRASH C — API function missing:**
> ```ts
> // Add to app/src/api/index.ts if missing:
> export const getItemReviews = (
>   menuItemId: string,
>   page = 1,
>   sort = 'recent'
> ) => api.get(
>   `/reviews/menu/${menuItemId}?page=${page}&sort=${sort}`
> ).then(r => r.data)
>
> export const submitReview = (data: {
>   menuItemId: string
>   orderId: string
>   rating: number
>   title?: string
>   body?: string
>   tags?: string[]
> }) => api.post('/reviews', data).then(r => r.data)
>
> export const markReviewHelpful = (reviewId: string) =>
>   api.post(`/reviews/${reviewId}/helpful`).then(r => r.data)
>
> export const getPendingReviews = () =>
>   api.get('/reviews/pending').then(r => r.data)
> ```
>
> **CRASH D — Backend route not mounted:**
> ```ts
> // In backend/src/app.ts add if missing:
> import reviewsRouter from './routes/reviews'
> app.use('/api/reviews', reviewsRouter)
> ```
>
> **CRASH E — RatingBreakdown object access:**
> MongoDB returns `ratingBreakdown.1` but JS tries `breakdown[1]`.
> Fix in `MenuItemReviewsScreen`:
> ```ts
> // Safely access rating breakdown
> const getBreakdownCount = (star: number) => {
>   if (!breakdown) return 0
>   // Handle both breakdown['1'] and breakdown[1]
>   return breakdown[star] ?? breakdown[String(star)] ?? 0
> }
>
> // Use in render:
> {[5,4,3,2,1].map(star => (
>   <RatingBar
>     key={star}
>     star={star}
>     count={getBreakdownCount(star)}
>     total={total}
>   />
> ))}
> ```
>
> **CRASH F — Student field not populated:**
> If `review.student` is null (user deleted) → `.name[0]` crashes.
> ```tsx
> // Safe avatar initial
> const initial = review.student?.name?.[0]?.toUpperCase() ?? '?'
>
> // Safe name display
> const reviewerName = review.student?.name ?? 'Anonymous'
> const reviewerCollege = review.student?.college ?? ''
> ```
>
> ## After fixing crashes — test the full review flow
>
> ```bash
> # Test reviews endpoint
> curl http://localhost:4000/api/reviews/menu/SOME_ITEM_ID
> # Must return { menuItem: {...}, reviews: [], pagination: {...} }
> # NOT a crash or 404
>
> # Test with a real menu item ID from your DB
> cd backend && node -e "
> require('dotenv').config()
> const mongoose = require('mongoose')
> mongoose.connect(process.env.MONGO_URI).then(async () => {
>   const MenuItem = require('./dist/models/MenuItem').default
>   const item = await MenuItem.findOne({})
>   console.log('Test with ID:', item._id.toString())
>   process.exit(0)
> })
> "
> ```
>
> ---
>
> ## FINAL VERIFICATION
>
> ```bash
> # Backend TypeScript
> cd backend && npx tsc --noEmit
>
> # Start backend
> cd backend && npm run dev &
> sleep 5
>
> # Test canteen open/closed
> curl http://localhost:4000/api/pickup-settings/DSCE
> # Must show isCurrentlyOpen: true if within opening hours
>
> # Test rush hours with IST time
> curl "http://localhost:4000/api/rush-hours?college=DSCE"
>
> # Test reviews
> curl http://localhost:4000/api/reviews/menu/FAKE_ID
> # Must return 404 or empty, not 500
>
> # Admin build
> cd admin && npm run build
>
> # Mobile export
> cd app && npx expo install @react-native-community/datetimepicker
> cd app && npx expo export --platform android
>
> kill %1
> ```
>
> ---
>
> ## FINAL REPORT
>
> ```
> ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
> FIX REPORT
> ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
>
> FIX 1 — Canteen Closed Bug:
>   Root cause:                   [explain exactly]
>   Timezone fix applied:         YES/NO
>   IST fix in rushHours.ts:      YES/NO
>   IST fix in pickupSettings.ts: YES/NO
>   IST fix in orders.ts:         YES/NO
>   Default settings created:     YES/NO
>   Mobile null guard added:      YES/NO
>   Canteen now shows open:       YES/NO
>
> FIX 2 — Pre-Order Feature:
>   Order model updated:          YES/NO
>   scheduledFor validation:      YES/NO
>   canteen hours check:          YES/NO
>   Cart screen pre-order UI:     YES/NO
>   Quick slots (tomorrow etc):   YES/NO
>   Date time picker:             YES/NO
>   Pre-order badge on orders:    YES/NO
>   Admin pre-orders tab:         YES/NO
>   Due-soon notifications:       YES/NO
>
> FIX 3 — Reviews Crash:
>   Crash cause:                  [explain exactly]
>   Screens in Navigation.tsx:    YES/NO
>   Null guards added:            YES/NO
>   Error boundary added:         YES/NO
>   API functions exist:          YES/NO
>   Backend route mounted:        YES/NO
>   ratingBreakdown safe access:  YES/NO
>   Review flow works end-to-end: YES/NO
>
> BUILD:
>   tsc --noEmit:    CLEAN/ERRORS
>   admin build:     CLEAN/ERRORS
>   mobile export:   CLEAN/ERRORS
> ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
> ```
>
> **ABSOLUTE RULES:**
> - NEVER touch .env files — tell me what to add, I do it myself
> - NEVER touch payment flow, webhook, CF Worker, Razorpay logic, QR
> - NEVER touch socket event names (order:paid, order:failed etc)
> - NEVER rewrite working code — only fix what is broken
> - Show diff before EVERY change
> - Fix in order: 1 → 2 → 3
> - Run `npx tsc --noEmit` after every fix
> - If a fix causes a TypeScript error, fix the error before moving on
> - One file at a time