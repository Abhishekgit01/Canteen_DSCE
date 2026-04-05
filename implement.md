## PROMPT — Fix Pickup Times + Rush Hour Sync + Reviews in App

Copy into a fresh conversation:

---

> **READ EVERYTHING BEFORE WRITING A SINGLE LINE OF CODE.**
> Do not touch payment, webhook, QR, Razorpay, notifications, or chef notes.
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
> cat backend/src/models/RushHour.ts 2>/dev/null || echo "MISSING"
> cat backend/src/models/Review.ts 2>/dev/null || echo "MISSING"
>
> # Routes
> cat backend/src/routes/rushHours.ts 2>/dev/null || echo "MISSING"
> cat backend/src/routes/reviews.ts 2>/dev/null || echo "MISSING"
> cat backend/src/routes/orders.ts
> cat backend/src/routes/menu.ts
> cat backend/src/app.ts
>
> # Admin pages
> find admin/src/pages -name "*.tsx" -exec echo "=== {} ===" \; -exec cat {} \;
> cat admin/src/api/index.ts
> cat admin/src/App.tsx
> cat admin/vercel.json
>
> # Mobile screens
> cat app/src/screens/MenuScreen.tsx
> cat app/src/screens/CartScreen.tsx
> cat app/src/screens/OrdersScreen.tsx
> cat app/src/screens/MenuItemReviewsScreen.tsx 2>/dev/null || echo "MISSING"
> cat app/src/screens/RateOrderScreen.tsx 2>/dev/null || echo "MISSING"
> cat app/src/api/index.ts
> cat app/src/navigation/Navigation.tsx
>
> # Check if rush hour and reviews are mounted
> grep -n "rushHour\|rush-hour\|review\|Review" backend/src/app.ts
>
> # Check if routes are registered
> grep -rn "rush\|review" backend/src/app.ts backend/src/server.ts
>
> # Check mobile env
> cat app/.env.example 2>/dev/null || echo "MISSING"
> grep -rn "rushHour\|rush\|review\|Review" app/src/ \
>   --include="*.ts" --include="*.tsx"
>
> # Check admin env
> cat admin/.env.example 2>/dev/null || echo "MISSING"
>
> # Check pickup time anywhere
> grep -rn "pickup\|estimatedTime\|prepTime\|waitTime" \
>   backend/src/ app/src/ admin/src/ \
>   --include="*.ts" --include="*.tsx"
> ```
>
> Say "FILES READ" then proceed.
>
> ---
>
> ## DIAGNOSE FIRST — Show me this report before fixing anything
>
> ```
> RUSH HOUR:
>   RushHour model exists:           YES/NO
>   rushHours route file exists:     YES/NO
>   Route mounted in app.ts:         YES/NO — show exact line
>   Admin RushHoursPage exists:      YES/NO
>   Admin route in App.tsx:          YES/NO
>   Admin sidebar link exists:       YES/NO
>   Mobile fetches rush hour status: YES/NO — show exact line
>   Mobile shows rush hour banner:   YES/NO
>   Real-time sync mechanism:        POLLING/SOCKET/NONE
>
> REVIEWS:
>   Review model exists:             YES/NO
>   reviews route file exists:       YES/NO
>   Route mounted in app.ts:         YES/NO — show exact line
>   RateOrderScreen exists:          YES/NO
>   MenuItemReviewsScreen exists:    YES/NO
>   Both screens in Navigation.tsx:  YES/NO
>   Menu cards show ratings:         YES/NO
>   Admin ReviewsPage exists:        YES/NO
>
> PICKUP TIMES:
>   Any pickup time field on Order:  YES/NO
>   Admin can set pickup time:       YES/NO
>   Mobile shows pickup time:        YES/NO
> ```
>
> Show this report. Then fix everything that is NO.
>
> ---
>
> # FIX 1 — RUSH HOUR NOT SYNCING TO APP
>
> ## Root Cause Check
>
> The most likely reasons admin changes don't show in app:
> ```bash
> # Check 1 — Is route even mounted?
> grep -n "rush" backend/src/app.ts
>
> # Check 2 — Is mobile calling correct URL?
> grep -n "rush" app/src/api/index.ts
>
> # Check 3 — Is mobile using correct college param?
> grep -n "getRushHour\|rush" app/src/screens/MenuScreen.tsx
>
> # Check 4 — Is there any caching blocking fresh data?
> grep -n "cache\|Cache" backend/src/routes/rushHours.ts 2>/dev/null
>
> # Check 5 — Is admin panel calling correct endpoint?
> grep -n "rush" admin/src/api/index.ts
> grep -n "rush" admin/src/pages/RushHoursPage.tsx 2>/dev/null
> ```
>
> Fix whatever is missing or wrong:
>
> **If route not mounted — add to `backend/src/app.ts`:**
> ```ts
> import rushHoursRouter from './routes/rushHours'
> app.use('/api/rush-hours', rushHoursRouter)
> ```
>
> **If mobile not fetching — add to `app/src/api/index.ts`:**
> ```ts
> export const getRushHourStatus = (college: string) =>
>   api.get(`/rush-hours?college=${college}`).then(r => r.data)
>
> export const getAllRushHours = (college?: string) =>
>   api.get(`/rush-hours/all${college ? `?college=${college}` : ''}`)
>     .then(r => r.data)
> ```
>
> ## Make Rush Hour Changes Reflect Instantly
>
> The problem is mobile only fetches rush hour once on screen load.
> Admin changes after that are invisible until app restart.
>
> **Fix — Add polling in `app/src/screens/MenuScreen.tsx`:**
> ```ts
> import { useEffect, useRef, useState } from 'react'
> import { AppState } from 'react-native'
>
> const POLL_INTERVAL = 60 * 1000 // check every 60 seconds
>
> export default function MenuScreen() {
>   const { user } = useAuthStore()
>   const [rushHour, setRushHour] = useState(null)
>   const pollRef = useRef<ReturnType<typeof setInterval> | null>(null)
>   const appState = useRef(AppState.currentState)
>
>   const fetchRushHour = async () => {
>     try {
>       const data = await getRushHourStatus(user.college)
>       setRushHour(data)
>     } catch (err) {
>       // silent fail — rush hour is non-critical
>     }
>   }
>
>   useEffect(() => {
>     // Fetch immediately on mount
>     fetchRushHour()
>
>     // Poll every 60 seconds
>     pollRef.current = setInterval(fetchRushHour, POLL_INTERVAL)
>
>     // Refetch when app comes back to foreground
>     const subscription = AppState.addEventListener('change', nextState => {
>       if (
>         appState.current.match(/inactive|background/) &&
>         nextState === 'active'
>       ) {
>         fetchRushHour()
>       }
>       appState.current = nextState
>     })
>
>     return () => {
>       if (pollRef.current) clearInterval(pollRef.current)
>       subscription.remove()
//     }
>   }, [user.college])
>
>   // ... rest of screen
> }
> ```
>
> **Also emit socket event when rush hour changes — backend:**
>
> In `backend/src/routes/rushHours.ts`
> when rush hour is created, updated, or deleted:
> ```ts
> import { getIO } from '../server'  // import socket instance
>
> // After creating/updating/deleting a rush hour
> const io = getIO()
> io.emit(`rush:updated:${targetCollege}`, {
>   college: targetCollege,
>   timestamp: new Date().toISOString()
> })
> ```
>
> **In `app/src/api/socket.ts` add listener:**
> ```ts
> // Listen for rush hour changes from admin
> socket.on(`rush:updated:${user?.college}`, () => {
>   // Trigger a fresh fetch in MenuScreen
>   // Use a simple event emitter or zustand store flag
>   useRushHourStore.getState().triggerRefetch()
> })
> ```
>
> **Create `app/src/stores/rushHourStore.ts`:**
> ```ts
> import { create } from 'zustand'
>
> interface RushHourStore {
>   rushHour: any
>   lastFetchedAt: number
>   setRushHour: (data: any) => void
>   shouldRefetch: boolean
>   triggerRefetch: () => void
>   clearRefetch: () => void
> }
>
> export const useRushHourStore = create<RushHourStore>(set => ({
>   rushHour: null,
>   lastFetchedAt: 0,
>   shouldRefetch: false,
>   setRushHour: (data) => set({
>     rushHour: data,
>     lastFetchedAt: Date.now()
>   }),
>   triggerRefetch: () => set({ shouldRefetch: true }),
>   clearRefetch: () => set({ shouldRefetch: false })
> }))
> ```
>
> **Rush Hour Banner — make it look good:**
> ```tsx
> {rushHour?.isRushHour && (
>   <View style={styles.rushBanner}>
>     <View style={styles.rushLeft}>
>       <Text style={styles.rushDot}>🔴</Text>
>       <View>
>         <Text style={styles.rushTitle}>
>           {rushHour.current.label}
>         </Text>
>         <Text style={styles.rushMsg}>
>           {rushHour.current.message}
>         </Text>
>         <Text style={styles.rushTime}>
>           Until {rushHour.current.endTime}
>         </Text>
>       </View>
>     </View>
>     {rushHour.current.surchargePercent > 0 && (
>       <View style={styles.rushBadge}>
>         <Text style={styles.rushBadgeText}>
>           +{rushHour.current.surchargePercent}%
>         </Text>
>       </View>
>     )}
>   </View>
> )}
>
> // Styles
> rushBanner: {
>   backgroundColor: '#FFF3E0',
>   borderLeftWidth: 4,
>   borderLeftColor: '#FF6F00',
>   marginHorizontal: 16,
>   marginVertical: 8,
>   padding: 12,
>   borderRadius: 8,
>   flexDirection: 'row',
>   alignItems: 'center',
>   justifyContent: 'space-between'
> },
> rushLeft: { flexDirection: 'row', alignItems: 'center', gap: 10, flex: 1 },
> rushTitle: { fontWeight: '700', color: '#E65100', fontSize: 14 },
> rushMsg: { color: '#BF360C', fontSize: 12, marginTop: 2 },
> rushTime: { color: '#999', fontSize: 11, marginTop: 2 },
> rushBadge: {
>   backgroundColor: '#FF6F00',
>   borderRadius: 12,
>   paddingHorizontal: 8,
>   paddingVertical: 4
> },
> rushBadgeText: { color: '#FFF', fontWeight: '700', fontSize: 12 }
> ```
>
> ---
>
> # FIX 2 — CUSTOMISABLE PICKUP TIMES
>
> ## Backend — Pickup Time Settings Model
>
> **Create `backend/src/models/PickupSettings.ts`:**
> ```ts
> import mongoose, { Schema, Document } from 'mongoose'
>
> export interface IPickupSettings extends Document {
>   college:            string
>   basePickupMinutes:  number   // default wait time e.g. 15
>   rushHourExtra:      number   // extra minutes during rush e.g. +10
>   perItemExtra:       number   // extra per item e.g. +2 mins per item
>   maxPickupMinutes:   number   // cap e.g. 45 mins max
>   openingTime:        string   // "08:00"
>   closingTime:        string   // "20:00"
>   breakStart:         string   // "15:00" (optional break)
>   breakEnd:           string   // "16:00"
>   hasBreak:           boolean
>   isOpen:             boolean  // manual override to close canteen
>   closedMessage:      string   // "Canteen closed for cleaning"
>   updatedBy:          mongoose.Types.ObjectId
> }
>
> const PickupSettingsSchema = new Schema<IPickupSettings>({
>   college:           { type: String, required: true, unique: true,
>                        enum: ['DSCE','DSATM','NIE'] },
>   basePickupMinutes: { type: Number, default: 15, min: 5, max: 120 },
>   rushHourExtra:     { type: Number, default: 10, min: 0, max: 60 },
>   perItemExtra:      { type: Number, default: 2, min: 0, max: 10 },
>   maxPickupMinutes:  { type: Number, default: 45, min: 10, max: 120 },
>   openingTime:       { type: String, default: '08:00' },
>   closingTime:       { type: String, default: '21:00' },
>   breakStart:        { type: String, default: '15:00' },
>   breakEnd:          { type: String, default: '16:00' },
>   hasBreak:          { type: Boolean, default: false },
>   isOpen:            { type: Boolean, default: true },
>   closedMessage:     { type: String, default: 'Canteen is currently closed' },
>   updatedBy:         { type: Schema.Types.ObjectId, ref: 'User' }
> }, { timestamps: true })
>
> export const PickupSettings = mongoose.model<IPickupSettings>(
>   'PickupSettings', PickupSettingsSchema
> )
> ```
>
> **Create `backend/src/routes/pickupSettings.ts`:**
> ```ts
> // GET /api/pickup-settings/:college
> // Public — mobile fetches this to show estimated time
> router.get('/:college', async (req, res) => {
>   let settings = await PickupSettings.findOne({
>     college: req.params.college
>   }).lean()
>
>   // Create defaults if none exist
>   if (!settings) {
>     settings = await PickupSettings.create({
>       college: req.params.college,
>       basePickupMinutes: 15
>     })
>   }
>
>   // Calculate current estimated pickup time
>   const now = new Date()
>   const currentTime = `${String(now.getHours()).padStart(2,'0')}:${String(now.getMinutes()).padStart(2,'0')}`
>
>   // Check if open
>   const isCurrentlyOpen = settings.isOpen &&
>     currentTime >= settings.openingTime &&
>     currentTime <= settings.closingTime &&
>     !(settings.hasBreak &&
>       currentTime >= settings.breakStart &&
>       currentTime <= settings.breakEnd)
>
>   res.json({
>     ...settings,
>     isCurrentlyOpen,
>     currentTime
>   })
> })
>
> // PATCH /api/pickup-settings/:college (manager/admin only)
> router.patch('/:college', requireAuth,
>   requireRoles(['manager','admin']),
>   async (req, res) => {
>     // Manager can only update own college
>     if (req.user.role !== 'admin' &&
>         req.params.college !== req.user.college) {
>       return res.status(403).json({ error: 'Access denied' })
>     }
>
>     const allowed = [
>       'basePickupMinutes', 'rushHourExtra', 'perItemExtra',
>       'maxPickupMinutes', 'openingTime', 'closingTime',
>       'breakStart', 'breakEnd', 'hasBreak', 'isOpen', 'closedMessage'
>     ]
>
>     const update: any = {}
>     allowed.forEach(key => {
>       if (req.body[key] !== undefined) update[key] = req.body[key]
>     })
>     update.updatedBy = req.user.id
>
>     const settings = await PickupSettings.findOneAndUpdate(
>       { college: req.params.college },
>       { $set: update },
>       { new: true, upsert: true }
>     )
>
>     // Emit socket so mobile updates instantly
>     const io = getIO()
>     io.emit(`pickup:updated:${req.params.college}`, settings)
>
>     res.json(settings)
>   }
> )
> ```
>
> **Calculate estimated pickup time in order creation (`orders.ts`):**
> ```ts
> // After creating order, calculate pickup time
> const settings = await PickupSettings.findOne({
>   college: req.user.college
> }).lean()
>
> let estimatedMinutes = settings?.basePickupMinutes ?? 15
>
> // Add per-item time
> const totalItems = orderItems.reduce((sum, i) => sum + i.quantity, 0)
> estimatedMinutes += (settings?.perItemExtra ?? 2) * totalItems
>
> // Add rush hour extra if active
> if (activeRush) {
>   estimatedMinutes += settings?.rushHourExtra ?? 10
> }
>
> // Cap at max
> estimatedMinutes = Math.min(
>   estimatedMinutes,
>   settings?.maxPickupMinutes ?? 45
> )
>
> // Calculate pickup time
> const pickupAt = new Date(Date.now() + estimatedMinutes * 60 * 1000)
>
> // Save on order
> order.estimatedPickupMinutes = estimatedMinutes
> order.estimatedPickupAt = pickupAt
> await order.save()
>
> // Include in response
> return res.json({
>   order,
>   razorpay,
>   estimatedPickupMinutes: estimatedMinutes,
>   estimatedPickupAt: pickupAt,
>   rushHour: activeRush ?? null
> })
> ```
>
> Add fields to Order model:
> ```ts
> estimatedPickupMinutes: { type: Number, default: 15 },
> estimatedPickupAt:      { type: Date }
> ```
>
> Mount in `app.ts`:
> ```ts
> import pickupSettingsRouter from './routes/pickupSettings'
> app.use('/api/pickup-settings', pickupSettingsRouter)
> ```
>
> ## Admin Panel — Pickup Settings Page
>
> **Create `admin/src/pages/PickupSettingsPage.tsx`:**
> ```tsx
> // Layout:
> // ┌─────────────────────────────────────────┐
> // │  ⏱️ Pickup Time Settings — DSCE         │
> // ├─────────────────────────────────────────┤
> // │  CANTEEN STATUS                         │
> // │  🟢 Open  [Toggle Open/Closed]          │
> // │  Closed message: [________________]     │
> // ├─────────────────────────────────────────┤
> // │  OPENING HOURS                          │
> // │  Opens:  [08:00]    Closes: [21:00]     │
> // │  Break:  [✓] Enable break               │
> // │  From:   [15:00]    To:     [16:00]     │
> // ├─────────────────────────────────────────┤
> // │  PICKUP TIME SETTINGS                   │
> // │  Base wait time:      [15] minutes      │
> // │  Extra per item:      [2]  minutes      │
> // │  Rush hour extra:     [10] minutes      │
> // │  Maximum wait cap:    [45] minutes      │
> // ├─────────────────────────────────────────┤
> // │  PREVIEW                                │
> // │  Normal order (3 items): ~21 min        │
> // │  Rush hour (3 items):    ~31 min        │
> // │  Large order (10 items): ~45 min (cap)  │
> // ├─────────────────────────────────────────┤
> // │  [Save Changes]                         │
> // └─────────────────────────────────────────┘
>
> // Live preview recalculates as admin changes values
> // No save needed for preview — just reactive calculation
> // Auto-save with debounce when values change
> // Show "Last updated X minutes ago by Manager Name"
>
> const estimatePickup = (
>   baseMinutes: number,
>   perItem: number,
>   rushExtra: number,
>   maxMinutes: number,
>   itemCount: number,
>   isRushHour: boolean
> ): number => {
>   let total = baseMinutes + (perItem * itemCount)
>   if (isRushHour) total += rushExtra
>   return Math.min(total, maxMinutes)
> }
> ```
>
> Add to admin API:
> ```ts
> export const getPickupSettings = (college: string) =>
>   api.get(`/pickup-settings/${college}`).then(r => r.data)
>
> export const updatePickupSettings = (college: string, data: any) =>
>   api.patch(`/pickup-settings/${college}`, data).then(r => r.data)
> ```
>
> Add route to `App.tsx`:
> ```tsx
> <Route path="/pickup-settings" element={
>   <ProtectedRoute roles={['manager','admin']}>
>     <PickupSettingsPage />
>   </ProtectedRoute>
> } />
> ```
>
> Add to sidebar:
> ```tsx
> { label: '⏱️ Pickup Times', path: '/pickup-settings',
>   roles: ['manager','admin'] }
> ```
>
> ## Mobile — Show Pickup Time + Canteen Open/Closed
>
> **In `app/src/screens/MenuScreen.tsx`:**
> ```tsx
> const [pickupSettings, setPickupSettings] = useState(null)
>
> useEffect(() => {
>   // Fetch pickup settings
>   getPickupSettings(user.college)
>     .then(setPickupSettings)
>     .catch(() => {})
>
>   // Listen for real-time updates from admin
>   socket.on(`pickup:updated:${user.college}`, (data) => {
>     setPickupSettings(data)
>   })
>
>   return () => {
>     socket.off(`pickup:updated:${user.college}`)
>   }
> }, [user.college])
>
> // Show canteen closed banner
> {pickupSettings && !pickupSettings.isCurrentlyOpen && (
>   <View style={styles.closedBanner}>
>     <Text style={styles.closedEmoji}>🔒</Text>
>     <View>
>       <Text style={styles.closedTitle}>Canteen Closed</Text>
>       <Text style={styles.closedMsg}>
>         {pickupSettings.closedMessage}
>       </Text>
>       <Text style={styles.closedHours}>
>         Opens at {pickupSettings.openingTime}
>       </Text>
>     </View>
>   </View>
> )}
>
> // Disable order button if closed
> {pickupSettings && !pickupSettings.isCurrentlyOpen && (
>   <View style={styles.orderingDisabled}>
>     <Text>Ordering is currently unavailable</Text>
>   </View>
> )}
> ```
>
> **In `app/src/screens/CartScreen.tsx`:**
> Show estimated pickup time before placing order:
> ```tsx
> {estimatedMinutes && (
>   <View style={styles.pickupEstimate}>
>     <Text style={styles.pickupIcon}>🕐</Text>
>     <View>
>       <Text style={styles.pickupLabel}>Estimated Pickup</Text>
>       <Text style={styles.pickupTime}>
>         ~{estimatedMinutes} minutes
>       </Text>
>       {isRushHour && (
>         <Text style={styles.pickupRushNote}>
>           (+{rushExtra} min rush hour)
>         </Text>
>       )}
>     </View>
>   </View>
> )}
>
> // Calculate estimate on cart screen too
> // so student sees it before payment
> const calculateEstimate = () => {
>   if (!pickupSettings) return 15
>   const totalItems = cartItems.reduce((s, i) => s + i.quantity, 0)
>   let mins = pickupSettings.basePickupMinutes
>   mins += pickupSettings.perItemExtra * totalItems
>   if (rushHour?.isRushHour) mins += pickupSettings.rushHourExtra
>   return Math.min(mins, pickupSettings.maxPickupMinutes)
> }
> ```
>
> **In `app/src/screens/PaymentSuccessScreen.tsx`:**
> Show pickup time prominently:
> ```tsx
> // Add to order details card
> <View style={styles.pickupTimeRow}>
>   <Text style={styles.pickupTimeIcon}>🕐</Text>
>   <View>
>     <Text style={styles.pickupTimeLabel}>Ready for pickup in</Text>
>     <Text style={styles.pickupTimeValue}>
>       ~{order.estimatedPickupMinutes} minutes
>     </Text>
>     <Text style={styles.pickupTimeAt}>
>       Around {formatTime(order.estimatedPickupAt)}
>     </Text>
>   </View>
> </View>
>
> // Time formatter
> const formatTime = (isoString: string) => {
>   const date = new Date(isoString)
>   return date.toLocaleTimeString('en-IN', {
>     hour: '2-digit',
>     minute: '2-digit',
>     hour12: true
>   })
> }
> ```
>
> Add to api:
> ```ts
> export const getPickupSettings = (college: string) =>
>   api.get(`/pickup-settings/${college}`).then(r => r.data)
> ```
>
> ---
>
> # FIX 3 — REVIEW SYSTEM NOT IN APP
>
> ## Step 1 — Check what actually exists
>
> ```bash
> # Are review routes mounted?
> grep -n "review" backend/src/app.ts
>
> # Do the screen files exist?
> ls app/src/screens/ | grep -i "review\|rate\|Rate"
>
> # Are screens in navigation?
> grep -n "Review\|Rate" app/src/navigation/Navigation.tsx
>
> # Is menu showing ratings?
> grep -n "averageRating\|totalReviews\|rating" \
>   app/src/screens/MenuScreen.tsx
> ```
>
> ## Step 2 — Mount reviews route if missing
>
> In `backend/src/app.ts`:
> ```ts
> import reviewsRouter from './routes/reviews'
> app.use('/api/reviews', reviewsRouter)
> ```
>
> ## Step 3 — Create RateOrderScreen if missing
>
> **`app/src/screens/RateOrderScreen.tsx`:**
> ```tsx
> import React, { useState, useEffect } from 'react'
> import {
>   View, Text, StyleSheet, TouchableOpacity,
>   TextInput, ScrollView, Alert, ActivityIndicator
> } from 'react-native'
> import Animated, {
>   useSharedValue, useAnimatedStyle,
>   withSpring, withSequence, withTiming
> } from 'react-native-reanimated'
> import { getPendingReviews, submitReview } from '../api/index'
>
> const TAGS = [
>   '😋 Delicious', '🌶️ Perfectly spicy', '🥗 Fresh',
>   '💰 Value for money', '👨‍🍳 Well prepared', '⚡ Served fast',
>   '🍽️ Great portion', '😐 Average', '🥶 Not hot enough',
>   '🐌 Took too long', '💸 Overpriced', '🧂 Too salty'
> ]
>
> const RATING_LABELS: Record<number, string> = {
>   1: '😞 Poor', 2: '😕 Below average',
>   3: '😐 Okay', 4: '😊 Good', 5: '🤩 Excellent!'
> }
>
> // Animated star component
> const Star = ({ filled, onPress, index }: {
>   filled: boolean, onPress: () => void, index: number
> }) => {
>   const scale = useSharedValue(1)
>
>   const handlePress = () => {
>     scale.value = withSequence(
>       withSpring(1.4),
>       withSpring(1)
>     )
>     onPress()
>   }
>
>   const style = useAnimatedStyle(() => ({
>     transform: [{ scale: scale.value }]
>   }))
>
>   return (
>     <TouchableOpacity onPress={handlePress}>
>       <Animated.Text style={[{ fontSize: 44 }, style]}>
>         {filled ? '⭐' : '☆'}
>       </Animated.Text>
>     </TouchableOpacity>
>   )
> }
>
> export default function RateOrderScreen({ route, navigation }: any) {
>   const { orderId } = route.params
>   const [pending, setPending] = useState<any[]>([])
>   const [currentIndex, setCurrentIndex] = useState(0)
>   const [rating, setRating] = useState(0)
>   const [title, setTitle] = useState('')
>   const [body, setBody] = useState('')
>   const [selectedTags, setSelectedTags] = useState<string[]>([])
>   const [submitting, setSubmitting] = useState(false)
>   const [loading, setLoading] = useState(true)
>
>   useEffect(() => {
>     getPendingReviews()
>       .then(data => {
>         // Filter to this order if orderId provided
>         const filtered = orderId
>           ? data.filter((p: any) => p.orderId === orderId)
>           : data
>         setPending(filtered)
>       })
>       .finally(() => setLoading(false))
>   }, [])
>
>   const currentItem = pending[currentIndex]
>
>   const toggleTag = (tag: string) => {
>     setSelectedTags(prev =>
>       prev.includes(tag)
>         ? prev.filter(t => t !== tag)
>         : prev.length < 5 ? [...prev, tag] : prev
>     )
>   }
>
>   const handleSubmit = async () => {
>     if (rating === 0) {
>       Alert.alert('Rate it!', 'Please select a star rating')
>       return
>     }
>     setSubmitting(true)
>     try {
>       await submitReview({
>         menuItemId: currentItem.menuItem._id,
>         orderId: currentItem.orderId,
>         rating,
>         title,
>         body,
>         tags: selectedTags
>       })
>
>       // Move to next item or finish
>       if (currentIndex < pending.length - 1) {
>         setCurrentIndex(i => i + 1)
>         setRating(0)
>         setTitle('')
>         setBody('')
>         setSelectedTags([])
>       } else {
>         Alert.alert(
>           '🎉 Thanks for your feedback!',
>           'Your reviews help everyone order better.',
>           [{ text: 'Done', onPress: () => navigation.goBack() }]
>         )
>       }
>     } catch (err: any) {
>       Alert.alert('Error', err.message ?? 'Failed to submit review')
>     } finally {
>       setSubmitting(false)
>     }
>   }
>
>   const handleSkip = () => {
>     if (currentIndex < pending.length - 1) {
>       setCurrentIndex(i => i + 1)
>       setRating(0)
>       setTitle('')
>       setBody('')
>       setSelectedTags([])
>     } else {
>       navigation.goBack()
>     }
>   }
>
>   if (loading) return <ActivityIndicator style={{ flex: 1 }} />
>
>   if (pending.length === 0) {
>     return (
>       <View style={styles.empty}>
>         <Text style={styles.emptyIcon}>✅</Text>
>         <Text style={styles.emptyTitle}>All caught up!</Text>
>         <Text style={styles.emptyMsg}>No pending reviews</Text>
>         <TouchableOpacity onPress={() => navigation.goBack()}>
>           <Text style={styles.backBtn}>Go back</Text>
>         </TouchableOpacity>
>       </View>
>     )
>   }
>
>   return (
>     <ScrollView style={styles.container}
>       contentContainerStyle={styles.content}>
>
>       {/* Progress */}
>       <Text style={styles.progress}>
>         {currentIndex + 1} of {pending.length}
>       </Text>
>
>       {/* Item name */}
>       <Text style={styles.itemName}>
>         {currentItem?.menuItem?.name}
>       </Text>
>       <Text style={styles.question}>How was it?</Text>
>
>       {/* Stars */}
>       <View style={styles.starsRow}>
>         {[1,2,3,4,5].map(star => (
>           <Star
>             key={star}
>             index={star}
>             filled={star <= rating}
>             onPress={() => setRating(star)}
>           />
>         ))}
>       </View>
>       {rating > 0 && (
>         <Text style={styles.ratingLabel}>{RATING_LABELS[rating]}</Text>
>       )}
>
>       {/* Tags */}
>       <Text style={styles.sectionLabel}>Quick tags (pick up to 5)</Text>
>       <View style={styles.tagsContainer}>
>         {TAGS.map(tag => (
>           <TouchableOpacity
>             key={tag}
>             style={[
>               styles.tag,
>               selectedTags.includes(tag) && styles.tagSelected
>             ]}
>             onPress={() => toggleTag(tag)}
>           >
>             <Text style={[
>               styles.tagText,
>               selectedTags.includes(tag) && styles.tagTextSelected
>             ]}>
>               {tag}
>             </Text>
>           </TouchableOpacity>
>         ))}
>       </View>
>
>       {/* Written review */}
>       <Text style={styles.sectionLabel}>Write a review (optional)</Text>
>       <TextInput
>         style={styles.titleInput}
>         placeholder="Give it a title..."
>         value={title}
>         onChangeText={setTitle}
>         maxLength={100}
>       />
>       <TextInput
>         style={styles.bodyInput}
>         placeholder="Tell others what you thought..."
>         value={body}
>         onChangeText={setBody}
>         maxLength={500}
>         multiline
>         numberOfLines={4}
>         textAlignVertical="top"
>       />
>       <Text style={styles.charCount}>{body.length}/500</Text>
>
>       {/* Buttons */}
>       <View style={styles.buttonsRow}>
>         <TouchableOpacity style={styles.skipBtn} onPress={handleSkip}>
>           <Text style={styles.skipText}>Skip</Text>
>         </TouchableOpacity>
>         <TouchableOpacity
>           style={[styles.submitBtn,
>             rating === 0 && styles.submitBtnDisabled]}
>           onPress={handleSubmit}
>           disabled={submitting || rating === 0}
>         >
>           <Text style={styles.submitText}>
>             {submitting ? 'Submitting...' : `Submit ⭐`}
>           </Text>
>         </TouchableOpacity>
>       </View>
>     </ScrollView>
>   )
> }
>
> const styles = StyleSheet.create({
>   container: { flex: 1, backgroundColor: '#fff' },
>   content: { padding: 24 },
>   progress: { color: '#999', fontSize: 13, textAlign: 'center' },
>   itemName: { fontSize: 24, fontWeight: '800', textAlign: 'center',
>     marginTop: 8, color: '#1A1A1A' },
>   question: { fontSize: 16, color: '#666', textAlign: 'center',
>     marginTop: 4, marginBottom: 20 },
>   starsRow: { flexDirection: 'row', justifyContent: 'center',
>     gap: 8, marginBottom: 8 },
>   ratingLabel: { textAlign: 'center', fontSize: 16,
>     fontWeight: '600', color: '#00C853', marginBottom: 24 },
>   sectionLabel: { fontSize: 14, fontWeight: '700',
>     color: '#333', marginBottom: 12, marginTop: 20 },
>   tagsContainer: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
>   tag: { paddingHorizontal: 12, paddingVertical: 8,
>     borderRadius: 20, borderWidth: 1.5,
>     borderColor: '#E0E0E0', backgroundColor: '#F8F8F8' },
>   tagSelected: { borderColor: '#00C853', backgroundColor: '#E8F5E9' },
>   tagText: { fontSize: 13, color: '#555' },
>   tagTextSelected: { color: '#00C853', fontWeight: '600' },
>   titleInput: { borderWidth: 1.5, borderColor: '#E0E0E0',
>     borderRadius: 10, padding: 12, fontSize: 15,
>     marginBottom: 10 },
>   bodyInput: { borderWidth: 1.5, borderColor: '#E0E0E0',
>     borderRadius: 10, padding: 12, fontSize: 14,
>     minHeight: 100 },
>   charCount: { color: '#999', fontSize: 12,
>     textAlign: 'right', marginTop: 4 },
>   buttonsRow: { flexDirection: 'row', gap: 12,
>     marginTop: 32, marginBottom: 40 },
>   skipBtn: { flex: 1, padding: 16, borderRadius: 12,
>     borderWidth: 1.5, borderColor: '#E0E0E0',
>     alignItems: 'center' },
>   skipText: { color: '#666', fontWeight: '600' },
>   submitBtn: { flex: 2, padding: 16, borderRadius: 12,
>     backgroundColor: '#00C853', alignItems: 'center' },
>   submitBtnDisabled: { backgroundColor: '#C8E6C9' },
>   submitText: { color: '#fff', fontWeight: '700', fontSize: 16 },
>   empty: { flex: 1, alignItems: 'center',
>     justifyContent: 'center', gap: 12 },
>   emptyIcon: { fontSize: 64 },
>   emptyTitle: { fontSize: 22, fontWeight: '700' },
>   emptyMsg: { color: '#666' },
>   backBtn: { color: '#00C853', fontWeight: '600', marginTop: 8 }
> })
> ```
>
> ## Step 4 — Create MenuItemReviewsScreen if missing
>
> **`app/src/screens/MenuItemReviewsScreen.tsx`:**
> ```tsx
> import React, { useState, useEffect, useCallback } from 'react'
> import {
>   View, Text, StyleSheet, FlatList,
>   TouchableOpacity, ActivityIndicator
> } from 'react-native'
> import { getItemReviews, markReviewHelpful } from '../api/index'
>
> // Rating breakdown bar
> const RatingBar = ({ star, count, total }: {
>   star: number, count: number, total: number
> }) => {
>   const percent = total > 0 ? (count / total) * 100 : 0
>   return (
>     <TouchableOpacity
>       style={styles.barRow}
>       onPress={() => {/* filter by this star */}}
>     >
>       <Text style={styles.barStar}>{star}★</Text>
>       <View style={styles.barBg}>
>         <View style={[styles.barFill, {
>           width: `${percent}%`,
>           backgroundColor: percent >= 50 ? '#00C853'
>             : percent >= 25 ? '#FFC107' : '#FF5252'
>         }]} />
>       </View>
>       <Text style={styles.barPercent}>{Math.round(percent)}%</Text>
>     </TouchableOpacity>
>   )
> }
>
> // Single review card
> const ReviewCard = ({ review, onHelpful }: any) => (
>   <View style={styles.card}>
>     <View style={styles.cardHeader}>
>       <View style={styles.avatar}>
>         <Text style={styles.avatarText}>
>           {review.student?.name?.[0]?.toUpperCase() ?? '?'}
>         </Text>
>       </View>
>       <View style={{ flex: 1 }}>
>         <Text style={styles.reviewerName}>
>           {review.student?.name ?? 'Anonymous'}
>         </Text>
>         <Text style={styles.reviewerCollege}>
>           {review.student?.college}
>         </Text>
>       </View>
>       <Text style={styles.stars}>
>         {'⭐'.repeat(review.rating)}{'☆'.repeat(5 - review.rating)}
>       </Text>
>     </View>
>
>     <View style={styles.verifiedRow}>
>       <Text style={styles.verifiedBadge}>✅ Verified Purchase</Text>
>       <Text style={styles.reviewDate}>
>         {formatTimeAgo(review.createdAt)}
>       </Text>
>     </View>
>
>     {review.title ? (
>       <Text style={styles.reviewTitle}>{review.title}</Text>
>     ) : null}
>     {review.body ? (
>       <Text style={styles.reviewBody}>{review.body}</Text>
>     ) : null}
>
>     {review.tags?.length > 0 && (
>       <View style={styles.tagsRow}>
>         {review.tags.map((tag: string) => (
>           <View key={tag} style={styles.tag}>
>             <Text style={styles.tagText}>{tag}</Text>
>           </View>
>         ))}
>       </View>
>     )}
>
>     <View style={styles.helpfulRow}>
>       {review.helpful > 0 && (
>         <Text style={styles.helpfulCount}>
>           {review.helpful} found this helpful
>         </Text>
>       )}
>       <TouchableOpacity
>         style={styles.helpfulBtn}
>         onPress={() => onHelpful(review._id)}
>       >
>         <Text style={styles.helpfulText}>👍 Helpful</Text>
>       </TouchableOpacity>
>     </View>
>   </View>
> )
>
> const SORT_OPTIONS = [
>   { label: 'Most Recent', value: 'recent' },
>   { label: 'Most Helpful', value: 'helpful' },
>   { label: 'Highest Rated', value: 'highest' },
>   { label: 'Lowest Rated', value: 'lowest' }
> ]
>
> export default function MenuItemReviewsScreen({ route }: any) {
>   const { menuItemId, menuItemName } = route.params
>   const [data, setData] = useState<any>(null)
>   const [page, setPage] = useState(1)
>   const [sort, setSort] = useState('recent')
>   const [loading, setLoading] = useState(true)
>   const [loadingMore, setLoadingMore] = useState(false)
>
>   const fetchReviews = useCallback(async (p = 1, s = sort) => {
>     if (p === 1) setLoading(true)
>     else setLoadingMore(true)
>     try {
>       const result = await getItemReviews(menuItemId, p, s)
>       if (p === 1) {
>         setData(result)
>       } else {
>         setData((prev: any) => ({
>           ...result,
>           reviews: [...prev.reviews, ...result.reviews]
>         }))
>       }
>       setPage(p)
>     } finally {
>       setLoading(false)
>       setLoadingMore(false)
>     }
>   }, [menuItemId, sort])
>
>   useEffect(() => { fetchReviews(1) }, [sort])
>
>   const handleHelpful = async (reviewId: string) => {
>     await markReviewHelpful(reviewId)
>     setData((prev: any) => ({
>       ...prev,
>       reviews: prev.reviews.map((r: any) =>
>         r._id === reviewId
>           ? { ...r, helpful: r.helpful + 1 }
>           : r
>       )
>     }))
>   }
>
>   if (loading) return <ActivityIndicator style={{ flex: 1 }} />
>
>   const { menuItem, reviews, pagination } = data ?? {}
>   const breakdown = menuItem?.ratingBreakdown ?? {}
>   const total = menuItem?.totalReviews ?? 0
>
>   return (
>     <FlatList
>       style={styles.container}
>       data={reviews}
>       keyExtractor={r => r._id}
>       renderItem={({ item }) => (
>         <ReviewCard review={item} onHelpful={handleHelpful} />
>       )}
>       ListHeaderComponent={() => (
>         <View style={styles.header}>
>           <Text style={styles.itemName}>{menuItemName}</Text>
>
>           {/* Overall rating */}
>           <View style={styles.overallRow}>
>             <Text style={styles.bigRating}>
>               {menuItem?.averageRating?.toFixed(1) ?? '—'}
>             </Text>
>             <View>
>               <Text style={styles.bigStars}>
>                 {'⭐'.repeat(Math.round(menuItem?.averageRating ?? 0))}
>               </Text>
>               <Text style={styles.totalReviews}>
>                 {total} review{total !== 1 ? 's' : ''}
>               </Text>
>             </View>
>           </View>
>
>           {/* Rating breakdown bars */}
>           <View style={styles.breakdownContainer}>
>             {[5,4,3,2,1].map(star => (
>               <RatingBar
>                 key={star}
>                 star={star}
>                 count={breakdown[star] ?? 0}
>                 total={total}
>               />
>             ))}
>           </View>
>
>           {/* Sort options */}
>           <ScrollView horizontal showsHorizontalScrollIndicator={false}
>             style={styles.sortRow}>
>             {SORT_OPTIONS.map(opt => (
>               <TouchableOpacity
>                 key={opt.value}
>                 style={[styles.sortBtn,
>                   sort === opt.value && styles.sortBtnActive]}
>                 onPress={() => setSort(opt.value)}
>               >
>                 <Text style={[styles.sortText,
>                   sort === opt.value && styles.sortTextActive]}>
>                   {opt.label}
>                 </Text>
>               </TouchableOpacity>
>             ))}
>           </ScrollView>
>
>           {total === 0 && (
>             <View style={styles.noReviews}>
>               <Text style={styles.noReviewsIcon}>🍽️</Text>
>               <Text style={styles.noReviewsText}>
>                 No reviews yet. Be the first!
>               </Text>
>             </View>
>           )}
>         </View>
>       )}
>       ListFooterComponent={() => (
>         pagination && page < pagination.pages ? (
>           <TouchableOpacity
>             style={styles.loadMore}
>             onPress={() => fetchReviews(page + 1)}
>             disabled={loadingMore}
>           >
>             <Text style={styles.loadMoreText}>
>               {loadingMore ? 'Loading...' : 'Load more reviews'}
>             </Text>
>           </TouchableOpacity>
>         ) : null
>       )}
>     />
>   )
> }
>
> const formatTimeAgo = (iso: string) => {
>   const diff = Date.now() - new Date(iso).getTime()
>   const mins = Math.floor(diff / 60000)
>   if (mins < 60) return `${mins}m ago`
>   const hrs = Math.floor(mins / 60)
>   if (hrs < 24) return `${hrs}h ago`
>   const days = Math.floor(hrs / 24)
>   return `${days}d ago`
> }
>
> const styles = StyleSheet.create({
>   container: { flex: 1, backgroundColor: '#fff' },
>   header: { padding: 20 },
>   itemName: { fontSize: 22, fontWeight: '800', color: '#1A1A1A' },
>   overallRow: { flexDirection: 'row', alignItems: 'center',
>     gap: 16, marginVertical: 16 },
>   bigRating: { fontSize: 56, fontWeight: '800', color: '#1A1A1A' },
>   bigStars: { fontSize: 20 },
>   totalReviews: { color: '#666', marginTop: 4 },
>   breakdownContainer: { gap: 6, marginBottom: 20 },
>   barRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
>   barStar: { width: 24, color: '#666', fontSize: 13 },
>   barBg: { flex: 1, height: 8, backgroundColor: '#F0F0F0',
>     borderRadius: 4, overflow: 'hidden' },
>   barFill: { height: '100%', borderRadius: 4 },
>   barPercent: { width: 36, color: '#666',
>     fontSize: 12, textAlign: 'right' },
>   sortRow: { marginBottom: 16 },
>   sortBtn: { paddingHorizontal: 16, paddingVertical: 8,
>     borderRadius: 20, borderWidth: 1.5,
>     borderColor: '#E0E0E0', marginRight: 8 },
>   sortBtnActive: { borderColor: '#00C853',
>     backgroundColor: '#E8F5E9' },
>   sortText: { color: '#666', fontSize: 13 },
>   sortTextActive: { color: '#00C853', fontWeight: '700' },
>   noReviews: { alignItems: 'center', padding: 40 },
>   noReviewsIcon: { fontSize: 48, marginBottom: 12 },
>   noReviewsText: { color: '#666', fontSize: 16 },
>   card: { margin: 16, marginTop: 0, padding: 16,
>     backgroundColor: '#FAFAFA', borderRadius: 12,
>     borderWidth: 1, borderColor: '#F0F0F0' },
>   cardHeader: { flexDirection: 'row',
>     alignItems: 'center', gap: 10 },
>   avatar: { width: 40, height: 40, borderRadius: 20,
>     backgroundColor: '#00C853', alignItems: 'center',
>     justifyContent: 'center' },
>   avatarText: { color: '#fff', fontWeight: '700', fontSize: 18 },
>   reviewerName: { fontWeight: '700', color: '#1A1A1A' },
>   reviewerCollege: { color: '#999', fontSize: 12 },
>   stars: { fontSize: 14 },
>   verifiedRow: { flexDirection: 'row',
>     justifyContent: 'space-between',
>     alignItems: 'center', marginVertical: 8 },
>   verifiedBadge: { color: '#00C853', fontSize: 12, fontWeight: '600' },
>   reviewDate: { color: '#999', fontSize: 12 },
>   reviewTitle: { fontWeight: '700', fontSize: 15,
>     color: '#1A1A1A', marginBottom: 4 },
>   reviewBody: { color: '#555', fontSize: 14,
>     lineHeight: 20, marginBottom: 8 },
>   tagsRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
>   tag: { paddingHorizontal: 10, paddingVertical: 4,
>     borderRadius: 12, backgroundColor: '#F0F0F0' },
>   tagText: { fontSize: 12, color: '#555' },
>   helpfulRow: { flexDirection: 'row', alignItems: 'center',
>     justifyContent: 'space-between', marginTop: 12 },
>   helpfulCount: { color: '#999', fontSize: 12 },
>   helpfulBtn: { paddingHorizontal: 12, paddingVertical: 6,
>     borderRadius: 8, borderWidth: 1, borderColor: '#E0E0E0' },
>   helpfulText: { color: '#666', fontSize: 13 },
>   loadMore: { margin: 16, padding: 16, borderRadius: 12,
>     borderWidth: 1.5, borderColor: '#E0E0E0',
>     alignItems: 'center' },
>   loadMoreText: { color: '#00C853', fontWeight: '600' }
> })
> ```
>
> ## Step 5 — Wire everything into Navigation
>
> **`app/src/navigation/Navigation.tsx`:**
> ```tsx
> import RateOrderScreen from '../screens/RateOrderScreen'
> import MenuItemReviewsScreen from '../screens/MenuItemReviewsScreen'
>
> // Add inside Stack.Navigator
> <Stack.Screen
>   name="RateOrder"
>   component={RateOrderScreen}
>   options={{
>     title: 'Rate Your Meal',
>     headerStyle: { backgroundColor: '#fff' },
>     headerTintColor: '#00C853'
>   }}
> />
> <Stack.Screen
>   name="ItemReviews"
>   component={MenuItemReviewsScreen}
>   options={({ route }: any) => ({
>     title: route.params?.menuItemName ?? 'Reviews',
>     headerStyle: { backgroundColor: '#fff' },
>     headerTintColor: '#00C853'
>   })}
> />
> ```
>
> ## Step 6 — Show rating on MenuScreen cards
>
> Find each menu item card in `MenuScreen.tsx`.
> Add rating display and make it tappable:
> ```tsx
> // Inside menu item card
> <TouchableOpacity
>   onPress={() => navigation.navigate('ItemReviews', {
>     menuItemId: item._id,
>     menuItemName: item.name
>   })}
>   style={styles.ratingRow}
> >
>   {item.totalReviews > 0 ? (
>     <>
>       <Text style={styles.ratingStar}>⭐</Text>
>       <Text style={styles.ratingValue}>
>         {Number(item.averageRating).toFixed(1)}
>       </Text>
>       <Text style={styles.ratingCount}>
>         ({item.totalReviews})
>       </Text>
>       <Text style={styles.ratingArrow}>›</Text>
>     </>
>   ) : (
>     <Text style={styles.noRating}>No reviews yet</Text>
>   )}
> </TouchableOpacity>
>
> // Styles
> ratingRow: { flexDirection: 'row', alignItems: 'center',
>   gap: 4, marginTop: 4 },
> ratingStar: { fontSize: 13 },
> ratingValue: { fontWeight: '700', color: '#1A1A1A', fontSize: 13 },
> ratingCount: { color: '#999', fontSize: 12 },
> ratingArrow: { color: '#00C853', fontWeight: '700' },
> noRating: { color: '#CCC', fontSize: 12 }
> ```
>
> ## Step 7 — Prompt to rate from OrdersScreen
>
> In `app/src/screens/OrdersScreen.tsx`:
> ```tsx
> // For fulfilled orders, show rate button
> {order.status === 'fulfilled' && (
>   <TouchableOpacity
>     style={styles.rateBtn}
>     onPress={() => navigation.navigate('RateOrder', {
>       orderId: order._id
>     })}
>   >
>     <Text style={styles.rateBtnText}>⭐ Rate this order</Text>
>   </TouchableOpacity>
> )}
>
> rateBtn: {
>   marginTop: 8,
>   paddingVertical: 8,
>   paddingHorizontal: 16,
>   backgroundColor: '#FFF8E1',
>   borderRadius: 8,
>   borderWidth: 1,
>   borderColor: '#FFC107',
>   alignSelf: 'flex-start'
> },
> rateBtnText: {
>   color: '#F57F17',
>   fontWeight: '600',
>   fontSize: 13
> }
> ```
>
> ---
>
> ## FINAL VERIFICATION
>
> ```bash
> cd backend && npx tsc --noEmit
>
> cd backend && npm run dev &
> sleep 5
>
> # Test all new routes exist
> curl http://localhost:4000/api/rush-hours?college=DSCE
> curl http://localhost:4000/api/pickup-settings/DSCE
> curl http://localhost:4000/api/reviews/menu/FAKE_ID
>
> cd admin && npm run build
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
> FIX 1 — Rush Hour Sync:
>   Root cause of no-sync:        [explain]
>   Route mounted:                YES/NO
>   Mobile polling added:         YES/NO
>   Socket emit on change:        YES/NO
>   App state refetch:            YES/NO
>   Banner shows correctly:       YES/NO
>
> FIX 2 — Pickup Times:
>   PickupSettings model:         YES/NO
>   Pickup route mounted:         YES/NO
>   Admin settings page:          YES/NO
>   Open/closed toggle:           YES/NO
>   Estimate on cart screen:      YES/NO
>   Estimate on success screen:   YES/NO
>   Socket update on change:      YES/NO
>
> FIX 3 — Reviews:
>   Reviews route mounted:        YES/NO
>   RateOrderScreen created:      YES/NO
>   MenuItemReviewsScreen:        YES/NO
>   Both in Navigation.tsx:       YES/NO
>   Rating on menu cards:         YES/NO
>   Rate button on OrdersScreen:  YES/NO
>   Admin reviews page:           YES/NO
>
> BUILD:
>   tsc --noEmit:    CLEAN/ERRORS
>   admin build:     CLEAN/ERRORS
>   mobile export:   CLEAN/ERRORS
> ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
> ```
>
> **RULES:**
> - Never touch .env files
> - Never touch payment, webhook, Razorpay, QR, notifications
> - Show diff before every change
> - Fix in order: 1 → 2 → 3
> - Run tsc after every fix