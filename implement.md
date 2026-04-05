## PROMPT — Smart Notifications + Rate Your Meal + Public Reviews

Copy into a fresh conversation:

---

> **READ EVERYTHING BEFORE WRITING A SINGLE LINE OF CODE.**
> Do not touch payment, webhook, QR, Razorpay, rush hours, or chef notes.
> Show diff before every change. Never touch .env files.
>
> ---
>
> ## FIRST — READ THESE FILES
>
> ```bash
> # Models
> cat backend/src/models/Order.ts
> cat backend/src/models/MenuItem.ts
> cat backend/src/models/User.ts
>
> # Routes
> cat backend/src/routes/orders.ts
> cat backend/src/routes/menu.ts
> cat backend/src/routes/admin.ts
>
> # Mobile
> cat app/src/screens/OrdersScreen.tsx
> cat app/src/screens/MenuScreen.tsx
> cat app/src/api/index.ts
> cat app/src/stores/authStore.ts
> cat app/app.json
>
> # Admin
> cat admin/src/api/index.ts
> cat admin/src/App.tsx
> find admin/src/pages -name "*.tsx" -exec echo "=== {} ===" \; -exec cat {} \;
>
> # Check what notification packages exist
> grep -rn "expo-notifications\|push\|FCM\|firebase" \
>   app/package.json app/app.json
>
> # Check backend package.json
> cat backend/package.json
>
> # Server
> cat backend/src/server.ts
> cat backend/src/app.ts
> ```
>
> Say "FILES READ" then proceed.
>
> ---
>
> # FEATURE 1 — SMART PUSH NOTIFICATIONS
>
> ## Backend — Push Token Storage
>
> **Update `backend/src/models/User.ts`:**
> ```ts
> // Add push token field
> expoPushToken: {
>   type: String,
>   default: null,
>   trim: true
> }
> ```
>
> **Create `backend/src/services/notification.service.ts`:**
> ```ts
> // Uses Expo Push Notification API — completely free
> // No Firebase setup needed, works directly with Expo
>
> interface PushMessage {
>   to: string           // Expo push token
>   title: string
>   body: string
>   data?: object        // extra data sent to app
>   sound?: 'default' | null
>   badge?: number
>   categoryId?: string  // for actionable notifications
> }
>
> const EXPO_PUSH_URL = 'https://exp.host/--/api/v2/push/send'
>
> export async function sendPushNotification(
>   token: string,
>   title: string,
>   body: string,
>   data?: object
> ): Promise<void> {
>   if (!token || !token.startsWith('ExponentPushToken')) {
>     console.warn('Invalid push token:', token)
>     return
>   }
>
>   const message: PushMessage = {
>     to: token,
>     title,
>     body,
>     sound: 'default',
>     data: data ?? {}
>   }
>
>   try {
>     const response = await fetch(EXPO_PUSH_URL, {
>       method: 'POST',
>       headers: {
>         'Content-Type': 'application/json',
>         'Accept': 'application/json'
>       },
>       body: JSON.stringify(message)
>     })
>     const result = await response.json()
>     if (result.data?.status === 'error') {
>       console.error('Push notification error:', result.data.message)
>     }
>   } catch (err: any) {
>     console.error('Push notification failed:', err.message)
>   }
> }
>
> // Send to multiple tokens at once (batch)
> export async function sendBulkPushNotification(
>   tokens: string[],
>   title: string,
>   body: string,
>   data?: object
> ): Promise<void> {
>   const validTokens = tokens.filter(t =>
>     t && t.startsWith('ExponentPushToken')
>   )
>   if (validTokens.length === 0) return
>
>   // Expo supports up to 100 per batch
>   const batches = []
>   for (let i = 0; i < validTokens.length; i += 100) {
>     batches.push(validTokens.slice(i, i + 100))
>   }
>
>   const messages = batches.map(batch =>
>     batch.map(token => ({
>       to: token, title, body,
>       sound: 'default',
>       data: data ?? {}
>     }))
>   )
>
>   await Promise.all(
>     messages.map(batch =>
>       fetch(EXPO_PUSH_URL, {
>         method: 'POST',
>         headers: { 'Content-Type': 'application/json' },
>         body: JSON.stringify(batch)
>       }).catch(err => console.error('Batch push failed:', err.message))
>     )
>   )
> }
>
> // Pre-built notification templates
> export const NotificationTemplates = {
>   orderPaid: (orderId: string) => ({
>     title: '✅ Payment Confirmed!',
>     body: 'Your order is being prepared. We will notify you when ready!',
>     data: { screen: 'OrderDetail', orderId, type: 'order_paid' }
>   }),
>
>   orderReady: (items: string[]) => ({
>     title: '🍱 Your Order is Ready!',
>     body: `${items.slice(0,2).join(', ')}${items.length > 2 ? ` +${items.length-2} more` : ''} — come collect!`,
>     data: { screen: 'Orders', type: 'order_ready' }
>   }),
>
>   orderFulfilled: () => ({
>     title: '🎉 Enjoy your meal!',
>     body: 'Order collected. How was it? Rate your meal!',
>     data: { screen: 'Orders', type: 'order_fulfilled', showRating: true }
>   }),
>
>   rushHourWarning: (endTime: string, college: string) => ({
>     title: '⏰ Beat the Rush!',
>     body: `${college} canteen rush hour ends at ${endTime}. Order now for faster service!`,
>     data: { screen: 'Menu', type: 'rush_warning' }
>   }),
>
>   dailySpecial: (itemName: string, price: number, college: string) => ({
>     title: `🌟 Today's Special at ${college}!`,
>     body: `${itemName} — just ₹${price}. Available while stocks last!`,
>     data: { screen: 'Menu', type: 'daily_special' }
>   }),
>
>   itemRestocked: (itemName: string) => ({
>     title: '🔔 Back in Stock!',
>     body: `${itemName} is available again. Order before it runs out!`,
>     data: { screen: 'Menu', type: 'restock' }
>   }),
>
>   orderFailed: (orderId: string) => ({
>     title: '❌ Payment Failed',
>     body: 'Your payment could not be processed. Please try again.',
>     data: { screen: 'Cart', orderId, type: 'order_failed' }
>   }),
>
>   rateReminder: (orderId: string) => ({
>     title: '⭐ How was your meal?',
>     body: 'Take 10 seconds to rate your food. Your feedback helps!',
>     data: { screen: 'RateOrder', orderId, type: 'rate_reminder' }
>   })
> }
> ```
>
> **Create `backend/src/routes/notifications.ts`:**
> ```ts
> // POST /api/notifications/token
> // Student saves their Expo push token
> router.post('/token', requireAuth, async (req, res) => {
>   const { expoPushToken } = req.body
>   if (!expoPushToken) {
>     return res.status(400).json({ error: 'Token required' })
>   }
>   if (!expoPushToken.startsWith('ExponentPushToken')) {
>     return res.status(400).json({ error: 'Invalid Expo push token' })
>   }
>   await User.findByIdAndUpdate(req.user.id, { expoPushToken })
>   res.json({ message: 'Push token saved' })
> })
>
> // DELETE /api/notifications/token
> // Clear token on logout
> router.delete('/token', requireAuth, async (req, res) => {
>   await User.findByIdAndUpdate(req.user.id, { expoPushToken: null })
>   res.json({ message: 'Push token cleared' })
> })
>
> // POST /api/notifications/broadcast (admin/manager only)
> // Send notification to all students of a college
> router.post('/broadcast', requireAuth,
>   requireRoles(['manager','admin']),
>   async (req, res) => {
>     const { title, body, college } = req.body
>     if (!title || !body) {
>       return res.status(400).json({ error: 'Title and body required' })
>     }
>
>     const targetCollege = req.user.role === 'admin'
>       ? college
>       : req.user.college
>
>     const users = await User.find({
>       college: targetCollege,
>       role: 'student',
>       expoPushToken: { $ne: null }
>     }).select('expoPushToken').lean()
>
>     const tokens = users
>       .map(u => u.expoPushToken)
>       .filter(Boolean) as string[]
>
>     // Fire and forget
>     sendBulkPushNotification(tokens, title, body, {
>       type: 'broadcast', college: targetCollege
>     }).catch(console.error)
>
>     res.json({
>       message: 'Broadcast sent',
>       recipients: tokens.length
>     })
>   }
> )
>
> // POST /api/notifications/daily-special (manager only)
> // Announce a daily special item
> router.post('/daily-special', requireAuth,
>   requireRoles(['manager','admin']),
>   async (req, res) => {
>     const { menuItemId } = req.body
>     const item = await MenuItem.findById(menuItemId).lean()
>     if (!item) return res.status(404).json({ error: 'Item not found' })
>
>     const college = req.user.role === 'admin'
>       ? item.college
>       : req.user.college
>
>     const users = await User.find({
>       college,
>       role: 'student',
>       expoPushToken: { $ne: null }
>     }).select('expoPushToken').lean()
>
>     const tokens = users
>       .map(u => u.expoPushToken)
>       .filter(Boolean) as string[]
>
>     const template = NotificationTemplates.dailySpecial(
>       item.name, item.price, college
>     )
>
>     sendBulkPushNotification(tokens, template.title, template.body, template.data)
>       .catch(console.error)
>
>     res.json({ message: 'Daily special announced', recipients: tokens.length })
>   }
> )
> ```
>
> **Wire notifications into existing order flow:**
>
> In `backend/src/services/order-payment.service.ts`
> find `finalizeOrder()` and add notifications:
> ```ts
> import {
>   sendPushNotification,
>   NotificationTemplates
> } from './notification.service'
>
> // After marking order as paid, send push notification
> const student = await User.findById(order.student)
>   .select('expoPushToken').lean()
>
> if (student?.expoPushToken) {
>   const template = NotificationTemplates.orderPaid(order._id.toString())
>   // Fire and forget
>   sendPushNotification(
>     student.expoPushToken,
>     template.title,
>     template.body,
>     template.data
>   ).catch(console.error)
> }
> ```
>
> In `backend/src/routes/orders.ts`
> find where order status is updated to `ready`:
> ```ts
> // When admin marks order as ready
> if (newStatus === 'ready') {
>   const student = await User.findById(order.student)
>     .select('expoPushToken').lean()
>   if (student?.expoPushToken) {
>     const itemNames = order.items.map((i: any) => i.menuItem.name)
>     const template = NotificationTemplates.orderReady(itemNames)
>     sendPushNotification(
>       student.expoPushToken,
>       template.title,
>       template.body,
>       template.data
>     ).catch(console.error)
>   }
> }
>
> // When order is fulfilled (QR scanned)
> if (newStatus === 'fulfilled') {
>   const student = await User.findById(order.student)
>     .select('expoPushToken').lean()
>   if (student?.expoPushToken) {
>     const template = NotificationTemplates.orderFulfilled()
>     sendPushNotification(
>       student.expoPushToken,
>       template.title,
>       template.body,
>       { ...template.data, orderId: order._id.toString() }
>     ).catch(console.error)
>   }
>
>   // Schedule rate reminder 30 minutes after fulfillment
>   setTimeout(async () => {
>     const freshStudent = await User.findById(order.student)
>       .select('expoPushToken').lean()
>     if (freshStudent?.expoPushToken) {
>       const rateTemplate = NotificationTemplates.rateReminder(
>         order._id.toString()
>       )
>       sendPushNotification(
>         freshStudent.expoPushToken,
>         rateTemplate.title,
>         rateTemplate.body,
>         rateTemplate.data
>       ).catch(console.error)
>     }
>   }, 30 * 60 * 1000) // 30 minutes
> }
> ```
>
> Mount in `app.ts`:
> ```ts
> import notificationsRouter from './routes/notifications'
> app.use('/api/notifications', notificationsRouter)
> ```
>
> ## Mobile — Push Notification Setup
>
> **Install:**
> ```bash
> cd app && npx expo install expo-notifications expo-device
> ```
>
> **Create `app/src/services/notifications.ts`:**
> ```ts
> import * as Notifications from 'expo-notifications'
> import * as Device from 'expo-device'
> import { Platform } from 'react-native'
> import { saveExpoPushToken } from '../api/index'
>
> // Configure how notifications appear when app is foreground
> Notifications.setNotificationHandler({
>   handleNotification: async () => ({
>     shouldShowAlert: true,
>     shouldPlaySound: true,
>     shouldSetBadge: true
>   })
> })
>
> export async function registerForPushNotifications(): Promise<string | null> {
>   // Must be physical device
>   if (!Device.isDevice) {
>     console.log('Push notifications require physical device')
>     return null
>   }
>
>   // Check existing permissions
>   const { status: existing } = await Notifications.getPermissionsAsync()
>   let finalStatus = existing
>
>   // Request if not granted
>   if (existing !== 'granted') {
>     const { status } = await Notifications.requestPermissionsAsync()
>     finalStatus = status
>   }
>
>   if (finalStatus !== 'granted') {
>     console.log('Push notification permission denied')
>     return null
>   }
>
>   // Android channel
>   if (Platform.OS === 'android') {
>     await Notifications.setNotificationChannelAsync('orders', {
>       name: 'Order Updates',
>       importance: Notifications.AndroidImportance.MAX,
>       vibrationPattern: [0, 250, 250, 250],
>       lightColor: '#00C853',
>       sound: 'default'
>     })
>     await Notifications.setNotificationChannelAsync('general', {
>       name: 'General',
>       importance: Notifications.AndroidImportance.DEFAULT,
>     })
>   }
>
>   // Get token
>   const token = await Notifications.getExpoPushTokenAsync({
>     projectId: process.env.EXPO_PUBLIC_PROJECT_ID
>   })
>
>   return token.data
> }
>
> export function setupNotificationListeners(navigation: any) {
>   // Notification received while app is open
>   const foregroundSub = Notifications.addNotificationReceivedListener(
>     notification => {
>       console.log('Notification received:', notification)
>       // Could show in-app toast here
>     }
>   )
>
>   // User tapped a notification
>   const responseSub = Notifications.addNotificationResponseReceivedListener(
>     response => {
>       const data = response.notification.request.content.data
>
>       // Navigate based on notification type
>       switch (data.screen) {
>         case 'OrderDetail':
>           navigation.navigate('OrderDetail', { orderId: data.orderId })
>           break
>         case 'Orders':
>           navigation.navigate('Orders')
>           if (data.showRating) {
>             // Will trigger rating modal in OrdersScreen
>           }
>           break
>         case 'RateOrder':
>           navigation.navigate('RateOrder', { orderId: data.orderId })
>           break
>         case 'Menu':
>           navigation.navigate('Menu')
>           break
>         case 'Cart':
>           navigation.navigate('Cart')
>           break
>       }
>     }
>   )
>
>   return () => {
>     foregroundSub.remove()
>     responseSub.remove()
>   }
> }
> ```
>
> **In `app/src/App.tsx` or root navigator:**
> ```ts
> import {
>   registerForPushNotifications,
>   setupNotificationListeners
> } from './services/notifications'
> import { saveExpoPushToken } from './api/index'
>
> // After login succeeds
> export const onLoginSuccess = async () => {
>   const token = await registerForPushNotifications()
>   if (token) {
>     // Save to backend — fire and forget
>     saveExpoPushToken(token).catch(console.error)
>   }
> }
>
> // In root component
> useEffect(() => {
>   const cleanup = setupNotificationListeners(navigation)
>   return cleanup
> }, [navigation])
> ```
>
> **Add to `app/src/api/index.ts`:**
> ```ts
> export const saveExpoPushToken = (token: string) =>
>   api.post('/notifications/token', { expoPushToken: token })
>
> export const clearExpoPushToken = () =>
>   api.delete('/notifications/token')
> ```
>
> **Clear token on logout in `authStore.ts`:**
> ```ts
> logout: async () => {
>   // Clear push token from backend before clearing local state
>   clearExpoPushToken().catch(console.error)
>   await AsyncStorage.removeItem('token')
>   set({ token: null, user: null })
> }
> ```
>
> **Add to `app.json`:**
> ```json
> {
>   "expo": {
>     "plugins": [
>       [
>         "expo-notifications",
>         {
>           "icon": "./assets/notification-icon.png",
>           "color": "#00C853",
>           "sounds": [],
>           "androidMode": "default"
>         }
>       ]
>     ]
>   }
> }
> ```
>
> ## Admin Panel — Broadcast Notification Page
>
> **Create `admin/src/pages/NotificationsPage.tsx`:**
> ```tsx
> // Layout:
> // ┌─────────────────────────────────────────┐
> // │  📢 Send Notification                   │
> // ├─────────────────────────────────────────┤
> // │  QUICK ACTIONS                          │
> // │  ┌──────────┐ ┌──────────┐ ┌────────┐ │
> // │  │ 🌟 Daily  │ │ ⚠️ Rush  │ │ 📣 Any │ │
> // │  │ Special   │ │ Warning  │ │ Custom │ │
> // │  └──────────┘ └──────────┘ └────────┘ │
> // ├─────────────────────────────────────────┤
> // │  CUSTOM BROADCAST                       │
> // │  College: [DSCE ▼]                      │
> // │  Title: [____________________________]  │
> // │  Message: [_________________________]   │
> // │           [_________________________]   │
> // │  Preview: 📱 [shows phone mockup]       │
> // │  [Send to X students]                   │
> // ├─────────────────────────────────────────┤
> // │  DAILY SPECIAL                          │
> // │  Pick item: [Masala Dosa ▼]             │
> // │  [📢 Announce as Today's Special]       │
> // └─────────────────────────────────────────┘
>
> // Show sent notification history with timestamps
> // Show recipient count per notification
> ```
>
> **Add to admin API:**
> ```ts
> export const broadcastNotification = (data: {
>   title: string, body: string, college?: string
> }) => api.post('/notifications/broadcast', data)
>
> export const announceDailySpecial = (menuItemId: string) =>
>   api.post('/notifications/daily-special', { menuItemId })
> ```
>
> **Add route to admin `App.tsx`:**
> ```tsx
> <Route path="/notifications" element={
>   <ProtectedRoute roles={['manager','admin']}>
>     <NotificationsPage />
>   </ProtectedRoute>
> } />
> ```
>
> Add to sidebar:
> ```tsx
> { label: '📢 Notifications', path: '/notifications', roles: ['manager','admin'] }
> ```
>
> ---
>
> # FEATURE 2 — RATE YOUR MEAL + PUBLIC REVIEWS
>
> ## Backend — Review Model
>
> **Create `backend/src/models/Review.ts`:**
> ```ts
> import mongoose, { Schema, Document } from 'mongoose'
>
> export interface IReview extends Document {
>   menuItem:    mongoose.Types.ObjectId
>   order:       mongoose.Types.ObjectId
>   student:     mongoose.Types.ObjectId
>   college:     string
>   rating:      number       // 1-5
>   title:       string       // "Crispy and delicious!"
>   body:        string       // detailed review
>   tags:        string[]     // ['spicy','fresh','value-for-money']
>   images:      string[]     // future: photo reviews
>   helpful:     number       // upvotes from other students
>   isVerified:  boolean      // verified purchase (always true here)
>   isVisible:   boolean      // admin can hide inappropriate reviews
>   createdAt:   Date
> }
>
> const ReviewSchema = new Schema<IReview>({
>   menuItem:   { type: Schema.Types.ObjectId, ref: 'MenuItem', required: true },
>   order:      { type: Schema.Types.ObjectId, ref: 'Order', required: true },
>   student:    { type: Schema.Types.ObjectId, ref: 'User', required: true },
>   college:    { type: String, required: true },
>   rating:     { type: Number, required: true, min: 1, max: 5 },
>   title:      { type: String, trim: true, maxlength: 100, default: '' },
>   body:       { type: String, trim: true, maxlength: 500, default: '' },
>   tags:       { type: [String], default: [] },
>   helpful:    { type: Number, default: 0 },
>   isVerified: { type: Boolean, default: true },
>   isVisible:  { type: Boolean, default: true }
> }, { timestamps: true })
>
> // One review per student per order item
> ReviewSchema.index(
>   { order: 1, menuItem: 1, student: 1 },
>   { unique: true }
> )
>
> // For fetching reviews of a menu item
> ReviewSchema.index({ menuItem: 1, isVisible: 1, createdAt: -1 })
>
> export const Review = mongoose.model<IReview>('Review', ReviewSchema)
> ```
>
> **Update `backend/src/models/MenuItem.ts`:**
> ```ts
> // Add rating summary — updated whenever a review is added
> averageRating: { type: Number, default: 0, min: 0, max: 5 },
> totalReviews:  { type: Number, default: 0 },
> ratingBreakdown: {
>   1: { type: Number, default: 0 },
>   2: { type: Number, default: 0 },
>   3: { type: Number, default: 0 },
>   4: { type: Number, default: 0 },
>   5: { type: Number, default: 0 }
> }
> ```
>
> **Create `backend/src/routes/reviews.ts`:**
> ```ts
> // GET /api/reviews/menu/:menuItemId
> // Public — anyone can see reviews for a menu item
> router.get('/menu/:menuItemId', async (req, res) => {
>   const { page = 1, limit = 10, sort = 'recent' } = req.query
>
>   const sortOptions: any = {
>     recent:  { createdAt: -1 },
>     helpful: { helpful: -1 },
>     highest: { rating: -1 },
>     lowest:  { rating: 1 }
>   }
>
>   const reviews = await Review.find({
>     menuItem: req.params.menuItemId,
>     isVisible: true
>   })
>   .populate('student', 'name college')
>   .sort(sortOptions[sort as string] ?? sortOptions.recent)
>   .skip((Number(page) - 1) * Number(limit))
>   .limit(Number(limit))
>   .lean()
>
>   const total = await Review.countDocuments({
>     menuItem: req.params.menuItemId,
>     isVisible: true
>   })
>
>   const menuItem = await MenuItem.findById(req.params.menuItemId)
>     .select('averageRating totalReviews ratingBreakdown name')
>     .lean()
>
>   return res.json({
>     menuItem,
>     reviews,
>     pagination: {
>       page: Number(page),
>       limit: Number(limit),
>       total,
>       pages: Math.ceil(total / Number(limit))
>     }
>   })
> })
>
> // POST /api/reviews
> // Student submits a review — must have a fulfilled order for this item
> router.post('/', requireAuth, async (req, res) => {
>   const { menuItemId, orderId, rating, title, body, tags } = req.body
>
>   // Validate rating
>   if (!rating || rating < 1 || rating > 5) {
>     return res.status(400).json({ error: 'Rating must be 1-5' })
>   }
>
>   // Verify the student actually ordered and received this item
>   const order = await Order.findOne({
>     _id: orderId,
>     student: req.user.id,
>     status: 'fulfilled',  // must be fulfilled — verified purchase
>     'items.menuItem': menuItemId
>   }).lean()
>
>   if (!order) {
>     return res.status(403).json({
>       error: 'You can only review items from completed orders'
>     })
>   }
>
>   // Check not already reviewed this item from this order
>   const existing = await Review.findOne({
>     order: orderId,
>     menuItem: menuItemId,
>     student: req.user.id
>   })
>   if (existing) {
>     return res.status(409).json({ error: 'Already reviewed this item' })
>   }
>
>   // Create review
>   const review = await Review.create({
>     menuItem: menuItemId,
>     order: orderId,
>     student: req.user.id,
>     college: req.user.college,
>     rating,
>     title: title?.slice(0, 100) ?? '',
>     body: body?.slice(0, 500) ?? '',
>     tags: (tags ?? []).slice(0, 5),
>     isVerified: true,
>     isVisible: true
>   })
>
>   // Update menu item average rating
>   await updateMenuItemRating(menuItemId)
>
>   // Populate student name for response
>   await review.populate('student', 'name college')
>
>   return res.status(201).json(review)
> })
>
> // POST /api/reviews/:id/helpful
> // Any authenticated user can mark review as helpful
> router.post('/:id/helpful', requireAuth, async (req, res) => {
>   const review = await Review.findByIdAndUpdate(
>     req.params.id,
>     { $inc: { helpful: 1 } },
>     { new: true }
>   )
>   if (!review) return res.status(404).json({ error: 'Review not found' })
>   res.json({ helpful: review.helpful })
> })
>
> // PATCH /api/reviews/:id/visibility (admin only — hide inappropriate)
> router.patch('/:id/visibility', requireAuth,
>   requireRoles(['manager','admin']),
>   async (req, res) => {
>     const { isVisible } = req.body
>     const review = await Review.findByIdAndUpdate(
>       req.params.id,
>       { isVisible },
>       { new: true }
>     )
>     if (!review) return res.status(404).json({ error: 'Review not found' })
>
>     // Update menu item rating after hiding/showing
>     await updateMenuItemRating(review.menuItem.toString())
>     res.json(review)
>   }
> )
>
> // GET /api/reviews/pending
> // Get orders the student can still review
> router.get('/pending', requireAuth, async (req, res) => {
>   // Find fulfilled orders in last 7 days
>   const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000)
>   const orders = await Order.find({
>     student: req.user.id,
>     status: 'fulfilled',
>     createdAt: { $gte: sevenDaysAgo }
>   }).populate('items.menuItem', 'name image').lean()
>
>   // Find already reviewed
>   const reviews = await Review.find({
>     student: req.user.id,
>     order: { $in: orders.map(o => o._id) }
>   }).select('order menuItem').lean()
>
>   const reviewedSet = new Set(
>     reviews.map(r => `${r.order}-${r.menuItem}`)
>   )
>
>   // Return unreviewed items only
>   const pending = orders.flatMap(order =>
>     order.items
>       .filter((item: any) =>
>         !reviewedSet.has(`${order._id}-${item.menuItem._id}`)
>       )
>       .map((item: any) => ({
>         orderId: order._id,
>         menuItem: item.menuItem,
>         orderDate: order.createdAt
>       }))
>   )
>
>   res.json(pending)
> })
>
> // Helper — recalculate and update menu item rating stats
> async function updateMenuItemRating(menuItemId: string) {
>   const stats = await Review.aggregate([
>     {
>       $match: {
>         menuItem: new mongoose.Types.ObjectId(menuItemId),
>         isVisible: true
>       }
>     },
>     {
>       $group: {
>         _id: null,
>         averageRating: { $avg: '$rating' },
>         totalReviews: { $sum: 1 },
>         r1: { $sum: { $cond: [{ $eq: ['$rating', 1] }, 1, 0] } },
>         r2: { $sum: { $cond: [{ $eq: ['$rating', 2] }, 1, 0] } },
>         r3: { $sum: { $cond: [{ $eq: ['$rating', 3] }, 1, 0] } },
>         r4: { $sum: { $cond: [{ $eq: ['$rating', 4] }, 1, 0] } },
>         r5: { $sum: { $cond: [{ $eq: ['$rating', 5] }, 1, 0] } }
>       }
>     }
>   ])
>
>   const s = stats[0] ?? {
>     averageRating: 0, totalReviews: 0,
>     r1: 0, r2: 0, r3: 0, r4: 0, r5: 0
>   }
>
>   await MenuItem.findByIdAndUpdate(menuItemId, {
>     averageRating: Math.round(s.averageRating * 10) / 10,
>     totalReviews: s.totalReviews,
>     'ratingBreakdown.1': s.r1,
>     'ratingBreakdown.2': s.r2,
>     'ratingBreakdown.3': s.r3,
>     'ratingBreakdown.4': s.r4,
>     'ratingBreakdown.5': s.r5
>   })
> }
> ```
>
> Mount in `app.ts`:
> ```ts
> import reviewsRouter from './routes/reviews'
> app.use('/api/reviews', reviewsRouter)
> ```
>
> ## Mobile — Rating Flow
>
> **Create `app/src/screens/RateOrderScreen.tsx`:**
> ```tsx
> // Shown after order fulfilled OR from notification tap
> // One screen covers all unreviewed items from an order
>
> // Layout — card per item with:
> // ┌─────────────────────────────────────┐
> // │  🍱 Masala Dosa                     │
> // │  How would you rate this?           │
> // │                                     │
> // │  ☆ ☆ ☆ ☆ ☆  ← tap to rate         │
> // │  (stars animate when tapped)        │
> // │                                     │
> // │  Quick tags (tap to select):        │
> // │  [🌶️ Spicy] [🥗 Fresh] [💰 Value]  │
> // │  [😋 Delicious] [👨‍🍳 Well made]     │
> // │  [🐌 Slow service] [🥶 Lukewarm]   │
> // │                                     │
> // │  Add a review (optional):           │
> // │  Title: [_______________________]   │
> // │  [Write your review here...    ]    │
> // │                                     │
> // │  [Skip]          [Submit ⭐]        │
> // └─────────────────────────────────────┘
>
> const RATING_TAGS = {
>   positive: [
>     '😋 Delicious', '🌶️ Perfectly spicy', '🥗 Fresh',
>     '💰 Value for money', '👨‍🍳 Well prepared',
>     '⚡ Served fast', '🍽️ Great portion'
>   ],
>   negative: [
>     '😐 Average', '🥶 Not hot enough', '🐌 Took long',
>     '💸 Overpriced', '🧂 Too salty', '🫙 Too oily'
>   ]
> }
>
> // Star rating component
> const StarRating = ({ rating, onRate, size = 40 }) => (
>   <View style={{ flexDirection: 'row', gap: 8 }}>
>     {[1, 2, 3, 4, 5].map(star => (
>       <TouchableOpacity key={star} onPress={() => onRate(star)}>
>         <Animated.Text style={{
>           fontSize: size,
>           // Animate scale when tapped
>         }}>
>           {star <= rating ? '⭐' : '☆'}
>         </Animated.Text>
>       </TouchableOpacity>
>     ))}
>   </View>
> )
>
> // Show rating label based on stars
> const ratingLabels = {
>   1: "😞 Poor",
>   2: "😕 Below average",
>   3: "😐 Okay",
>   4: "😊 Good",
>   5: "🤩 Excellent!"
> }
> ```
>
> **Create `app/src/screens/MenuItemReviewsScreen.tsx`:**
> ```tsx
> // Public reviews page — Amazon style
> // Shown when student taps on a menu item
>
> // Layout:
> // ┌─────────────────────────────────────┐
> // │  🍱 Masala Dosa                     │
> // │  ⭐⭐⭐⭐☆  4.2  (127 reviews)       │
> // │                                     │
> // │  RATING BREAKDOWN                   │
> // │  5★ ████████████████░░░  68%       │
> // │  4★ ████████░░░░░░░░░░  22%        │
> // │  3★ ██░░░░░░░░░░░░░░░░   6%        │
> // │  2★ █░░░░░░░░░░░░░░░░░   3%        │
> // │  1★ ░░░░░░░░░░░░░░░░░░   1%        │
> // │                                     │
> // │  Sort by: [Most Recent ▼]           │
> // │                                     │
> // │  ┌──────────────────────────────┐   │
> // │  │ Rahul K. • DSCE • ⭐⭐⭐⭐⭐  │   │
> // │  │ ✅ Verified Purchase         │   │
> // │  │ "Best masala dosa in campus" │   │
> // │  │ Crispy, well-spiced, value   │   │
> // │  │ [🌶️ Spicy] [💰 Value]       │   │
> // │  │ 12 people found this helpful │   │
> // │  │ [👍 Helpful]    3 days ago  │   │
> // │  └──────────────────────────────┘   │
> // │                                     │
> // │  [Load more reviews]                │
> // └─────────────────────────────────────┘
>
> // Rating bar component
> const RatingBar = ({ star, count, total }) => {
>   const percent = total > 0 ? (count / total) * 100 : 0
>   return (
>     <View style={styles.ratingBarRow}>
>       <Text style={styles.starLabel}>{star}★</Text>
>       <View style={styles.barBackground}>
>         <View style={[styles.barFill, {
>           width: `${percent}%`,
>           backgroundColor: percent > 50 ? '#00C853' : '#FFC107'
>         }]} />
>       </View>
>       <Text style={styles.percent}>{Math.round(percent)}%</Text>
>     </View>
>   )
> }
>
> // Review card component
> const ReviewCard = ({ review, onHelpful }) => (
>   <View style={styles.reviewCard}>
>     {/* Header */}
>     <View style={styles.reviewHeader}>
>       <View style={styles.avatar}>
>         <Text style={styles.avatarText}>
>           {review.student.name[0].toUpperCase()}
>         </Text>
>       </View>
>       <View>
>         <Text style={styles.reviewerName}>{review.student.name}</Text>
>         <Text style={styles.reviewerCollege}>{review.student.college}</Text>
>       </View>
>       <View style={styles.starRow}>
>         {'⭐'.repeat(review.rating)}{'☆'.repeat(5 - review.rating)}
>       </View>
>     </View>
>
>     {/* Verified badge */}
>     <Text style={styles.verifiedBadge}>✅ Verified Purchase</Text>
>
>     {/* Review content */}
>     {review.title ? (
>       <Text style={styles.reviewTitle}>{review.title}</Text>
>     ) : null}
>     {review.body ? (
>       <Text style={styles.reviewBody}>{review.body}</Text>
>     ) : null}
>
>     {/* Tags */}
>     {review.tags.length > 0 && (
>       <View style={styles.tagsRow}>
>         {review.tags.map(tag => (
>           <View key={tag} style={styles.tag}>
>             <Text style={styles.tagText}>{tag}</Text>
>           </View>
>         ))}
>       </View>
>     )}
>
>     {/* Helpful */}
>     <View style={styles.helpfulRow}>
>       <Text style={styles.helpfulCount}>
>         {review.helpful > 0
>           ? `${review.helpful} ${review.helpful === 1 ? 'person' : 'people'} found this helpful`
>           : ''}
>       </Text>
>       <TouchableOpacity
>         style={styles.helpfulBtn}
>         onPress={() => onHelpful(review._id)}
>       >
>         <Text style={styles.helpfulBtnText}>👍 Helpful</Text>
>       </TouchableOpacity>
>       <Text style={styles.reviewDate}>
>         {formatTimeAgo(review.createdAt)}
>       </Text>
>     </View>
>   </View>
> )
> ```
>
> **Update `app/src/screens/MenuScreen.tsx`:**
> Show rating on menu item cards:
> ```tsx
> // Each menu item card shows rating
> {item.totalReviews > 0 ? (
>   <TouchableOpacity
>     onPress={() => navigation.navigate('ItemReviews', {
>       menuItemId: item._id,
>       menuItemName: item.name
>     })}
>   >
>     <View style={styles.ratingRow}>
>       <Text style={styles.ratingStar}>⭐</Text>
>       <Text style={styles.ratingValue}>
>         {item.averageRating.toFixed(1)}
>       </Text>
>       <Text style={styles.ratingCount}>
>         ({item.totalReviews})
>       </Text>
>     </View>
>   </TouchableOpacity>
> ) : (
>   <Text style={styles.noRating}>No reviews yet</Text>
> )}
> ```
>
> **Add to `app/src/api/index.ts`:**
> ```ts
> // Reviews
> export const getItemReviews = (
>   menuItemId: string,
>   page = 1,
>   sort = 'recent'
> ) => api.get(`/reviews/menu/${menuItemId}?page=${page}&sort=${sort}`)
>   .then(r => r.data)
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
> **Add screens to `Navigation.tsx`:**
> ```tsx
> <Stack.Screen
>   name="RateOrder"
>   component={RateOrderScreen}
>   options={{ title: 'Rate Your Meal', headerShown: true }}
> />
> <Stack.Screen
>   name="ItemReviews"
>   component={MenuItemReviewsScreen}
>   options={{ title: 'Reviews', headerShown: true }}
> />
> ```
>
> ## Admin Panel — Reviews Management
>
> **Create `admin/src/pages/ReviewsPage.tsx`:**
> ```tsx
> // Layout:
> // ┌─────────────────────────────────────────┐
> // │  ⭐ Reviews Management                  │
> // │  College: [All ▼]  Item: [All ▼]       │
> // │  Filter: [All] [Flagged] [Hidden]       │
> // ├─────────────────────────────────────────┤
> // │  TOP RATED ITEMS (this week)            │
> // │  1. Masala Dosa    ⭐4.8  (23 reviews) │
> // │  2. Filter Coffee  ⭐4.6  (18 reviews) │
> // ├─────────────────────────────────────────┤
> // │  RECENT REVIEWS                         │
> // │  ┌────────────────────────────────────┐ │
> // │  │ Rahul K. • Masala Dosa • ⭐⭐⭐⭐⭐ │ │
> // │  │ "Best in campus..."                │ │
> // │  │ [👁️ Visible] [🚫 Hide] [🗑️ Delete] │ │
> // │  └────────────────────────────────────┘ │
> // └─────────────────────────────────────────┘
> ```
>
> **Add to admin API:**
> ```ts
> export const getAllReviews = (params?: {
>   college?: string, menuItemId?: string, isVisible?: boolean
> }) => api.get('/reviews/admin', { params }).then(r => r.data)
>
> export const toggleReviewVisibility = (id: string, isVisible: boolean) =>
>   api.patch(`/reviews/${id}/visibility`, { isVisible })
> ```
>
> Add to admin reviews route in backend:
> ```ts
> // GET /api/reviews/admin (admin only)
> router.get('/admin', requireAuth, requireRoles(['manager','admin']),
>   async (req, res) => {
>     const { college, menuItemId, isVisible } = req.query
>     const filter: any = {}
>
>     if (college) filter.college = college
>     else if (req.user.role !== 'admin') filter.college = req.user.college
>
>     if (menuItemId) filter.menuItem = menuItemId
>     if (isVisible !== undefined) filter.isVisible = isVisible === 'true'
>
>     const reviews = await Review.find(filter)
>       .populate('student', 'name college email')
>       .populate('menuItem', 'name')
>       .sort({ createdAt: -1 })
>       .limit(100)
>       .lean()
>
>     res.json(reviews)
>   }
> )
> ```
>
> **Add route to admin App.tsx:**
> ```tsx
> <Route path="/reviews" element={
>   <ProtectedRoute roles={['manager','admin']}>
>     <ReviewsPage />
>   </ProtectedRoute>
> } />
> ```
>
> Add to sidebar:
> ```tsx
> { label: '⭐ Reviews', path: '/reviews', roles: ['manager','admin'] }
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
> # Start and test new routes
> cd backend && npm run dev &
> sleep 5
>
> # Test notification token save
> curl -X POST http://localhost:4000/api/notifications/token \
>   -H "Authorization: Bearer YOUR_TOKEN" \
>   -H "Content-Type: application/json" \
>   -d '{"expoPushToken":"ExponentPushToken[test]"}'
>
> # Test reviews fetch (public)
> curl http://localhost:4000/api/reviews/menu/SOME_MENU_ITEM_ID
>
> # Test pending reviews
> curl http://localhost:4000/api/reviews/pending \
>   -H "Authorization: Bearer YOUR_TOKEN"
>
> # Admin build
> cd admin && npm run build
>
> # Mobile export
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
> FEATURE REPORT
> ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
>
> FEATURE 1 — NOTIFICATIONS:
>   notification.service.ts:     YES/NO
>   Push token saved on login:   YES/NO
>   Token cleared on logout:     YES/NO
>   Order paid notification:     YES/NO
>   Order ready notification:    YES/NO
>   Order fulfilled + reminder:  YES/NO
>   Admin broadcast page:        YES/NO
>   Daily special announce:      YES/NO
>   app.json plugin added:       YES/NO
>
> FEATURE 2 — REVIEWS:
>   Review model created:        YES/NO
>   MenuItem rating fields:      YES/NO
>   Public reviews GET route:    YES/NO
>   Verified purchase check:     YES/NO
>   One review per order item:   YES/NO
>   Helpful votes:               YES/NO
>   Admin hide/show reviews:     YES/NO
>   RateOrderScreen:             YES/NO
>   Star animation:              YES/NO
>   Quick tags:                  YES/NO
>   ItemReviewsScreen:           YES/NO
>   Rating bars (Amazon style):  YES/NO
>   Rating on menu cards:        YES/NO
>   Admin reviews page:          YES/NO
>
> BUILD:
>   tsc --noEmit:    CLEAN/ERRORS
>   admin build:     CLEAN/ERRORS
>   mobile export:   CLEAN/ERRORS
>
> ENV VARS NEEDED:
>   EXPO_PUBLIC_PROJECT_ID → get from expo.dev dashboard
> ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
> ```
>
> **RULES:**
> - Never touch .env files
> - Never touch payment, webhook, QR, Razorpay, socket events
> - Show diff before every change
> - Fix in order: Feature 1 → Feature 2
> - Run tsc after every feature
> - One file at a time

---

## One Thing You Do Before Running

Get your Expo Project ID — needed for push notifications:
```
expo.dev → log in → your project → copy the Project ID
Add to app/.env: EXPO_PUBLIC_PROJECT_ID=your-project-id
```

Everything else the agent handles.