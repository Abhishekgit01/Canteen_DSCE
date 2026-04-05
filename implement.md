## PROMPT — Fix OTP + Admin Rush Hours + Per-College Menu + Chef Notes

Copy into a fresh conversation:

---

> **READ EVERYTHING BEFORE WRITING A SINGLE LINE OF CODE.**
> Do not touch payment, webhook, QR, socket events, or Razorpay integration.
> Show diff before every change. Never touch .env files.
>
> ---
>
> ## FIRST — READ THESE FILES
>
> ```bash
> # OTP diagnosis
> cat backend/src/routes/auth.ts
> cat backend/src/services/email.service.ts 2>/dev/null || echo "MISSING"
> grep -rn "resend\|nodemailer\|sendMail\|OTP\|otp" backend/src/ --include="*.ts"
> grep "RESEND\|OTP_MODE\|EMAIL" backend/.env.example
>
> # Check if resend is installed
> grep "resend" backend/package.json
>
> # Admin panel
> cat admin/src/api/index.ts
> cat admin/src/App.tsx
> find admin/src/pages -name "*.tsx" -exec echo "=== {} ===" \; -exec cat {} \;
>
> # Mobile screens
> cat app/src/screens/MenuScreen.tsx
> cat app/src/screens/CartScreen.tsx
> cat app/src/api/index.ts
>
> # Models
> cat backend/src/models/MenuItem.ts
> cat backend/src/models/Order.ts
> cat backend/src/models/User.ts
>
> # Routes
> cat backend/src/routes/menu.ts
> cat backend/src/routes/orders.ts
> cat backend/src/routes/admin.ts
>
> # Check college enum everywhere
> grep -rn "DSCE\|DSATM\|NIE\|college\|enum" \
>   backend/src/models/ --include="*.ts"
>
> # Vercel config
> cat admin/vercel.json
> ```
>
> Say "FILES READ" then proceed.
>
> ---
>
> # FIX 1 — OTP DIAGNOSIS AND FIX
>
> **Run this FIRST and show me every output:**
> ```bash
> # Is resend installed?
> node -e "require('resend'); console.log('resend OK')" 2>/dev/null \
>   || echo "resend NOT installed"
>
> # Is API key set?
> cd backend && node -e "
> require('dotenv').config()
> console.log('RESEND_API_KEY:', process.env.RESEND_API_KEY
>   ? 'SET (' + process.env.RESEND_API_KEY.slice(0,8) + '...)'
>   : 'MISSING')
> console.log('OTP_MODE:', process.env.OTP_MODE || 'not set')
> "
>
> # Does email service exist and use resend?
> cat backend/src/services/email.service.ts 2>/dev/null || echo "FILE MISSING"
>
> # Is nodemailer still lurking?
> grep -rn "nodemailer\|createTransport\|smtp" backend/src/ --include="*.ts"
>
> # How is OTP currently being sent in auth.ts?
> grep -n "sendMail\|sendOTP\|email.service\|otp\|OTP" backend/src/routes/auth.ts
>
> # Test Resend API key live right now
> cd backend && node -e "
> require('dotenv').config()
> const { Resend } = require('resend')
> const resend = new Resend(process.env.RESEND_API_KEY)
> resend.emails.send({
>   from: 'onboarding@resend.dev',
>   to: 'delivered@resend.dev',
>   subject: 'OTP Test',
>   html: '<p>Test OTP: 123456</p>'
> }).then(r => console.log('Resend test OK:', JSON.stringify(r)))
>   .catch(e => console.log('Resend test FAILED:', e.message))
> "
> ```
>
> Based on what you find, apply the correct fix:
>
> **CASE A — resend package missing:**
> ```bash
> cd backend && npm install resend
> ```
>
> **CASE B — RESEND_API_KEY missing:**
> Tell me: "Please add RESEND_API_KEY to backend/.env
> Get it from resend.com → API Keys → Create Key"
> Stop and wait for me to confirm.
>
> **CASE C — email.service.ts missing or wrong:**
> Create/replace it entirely:
> ```ts
> import { Resend } from 'resend'
>
> if (!process.env.RESEND_API_KEY) {
>   console.error('RESEND_API_KEY missing — OTP emails will fail')
> }
>
> const resend = new Resend(process.env.RESEND_API_KEY!)
>
> export async function sendOTPEmail(
>   toEmail: string,
>   toName: string,
>   otp: string,
>   college?: string
> ): Promise<{ success: boolean; error?: string }> {
>   try {
>     const { error } = await resend.emails.send({
>       from: 'Canteen App <onboarding@resend.dev>',
>       to: toEmail,
>       subject: `${otp} — Your Canteen Verification Code`,
>       html: `
>         <div style="font-family:Arial,sans-serif;max-width:480px;
>                     margin:0 auto;padding:40px 32px;
>                     background:#fff;border-radius:16px;">
>           <div style="text-align:center;margin-bottom:32px;">
>             <h1 style="color:#00C853;margin:0;font-size:28px;">
>               🍱 ${college ? college + ' ' : ''}Canteen
>             </h1>
>           </div>
>           <p style="color:#333;font-size:16px;">Hi ${toName},</p>
>           <p style="color:#333;">Your one-time verification code is:</p>
>           <div style="background:#F8FFF8;border:2px solid #00C853;
>                       border-radius:16px;padding:32px;
>                       text-align:center;margin:24px 0;">
>             <span style="font-size:48px;font-weight:800;
>                          letter-spacing:16px;color:#00C853;">
>               ${otp}
>             </span>
>           </div>
>           <p style="color:#666;font-size:14px;text-align:center;">
>             ⏱ Expires in <strong>10 minutes</strong>
>           </p>
>           <hr style="border:none;border-top:1px solid #eee;margin:24px 0"/>
>           <p style="color:#999;font-size:12px;text-align:center;">
>             Didn't request this? Ignore this email safely.
>           </p>
>         </div>
>       `
>     })
>     if (error) {
>       console.error('Resend send error:', error)
>       return { success: false, error: error.message }
>     }
>     return { success: true }
>   } catch (err: any) {
>     console.error('Resend exception:', err.message)
>     return { success: false, error: err.message }
>   }
> }
> ```
>
> **CASE D — OTP send is blocking the response (most likely cause of timeout):**
>
> Find in `auth.ts` every place OTP email is sent.
> It MUST be non-blocking. Change from:
> ```ts
> // WRONG — user waits for email before getting response
> await sendOTPEmail(email, name, otp, college)
> return res.json({ message: 'OTP sent' })
> ```
> To:
> ```ts
> // CORRECT — respond instantly, email sends in background
> sendOTPEmail(email, name, otp, college).then(result => {
>   if (!result.success) {
>     console.error('OTP email failed for:', email, result.error)
>     // In dev, log OTP to console as fallback
>     if (process.env.NODE_ENV !== 'production') {
>       console.log(`[DEV] OTP for ${email}: ${otp}`)
>     }
>   }
> })
> return res.json({ message: 'OTP sent to your email' })
> ```
>
> **CASE E — OTP_MODE is set to 'auto' or 'none':**
> If `OTP_MODE` is set to anything other than `email`, that bypasses email.
> Check the logic in auth.ts that reads `OTP_MODE`.
> Make sure `email` mode actually calls `sendOTPEmail`.
>
> **After all fixes — test live:**
> ```bash
> cd backend && npm run dev &
> sleep 5
>
> # Signup and trigger OTP
> curl -X POST http://localhost:4000/api/auth/signup \
>   -H "Content-Type: application/json" \
>   -d '{
>     "email": "test@youremail.com",
>     "password": "Test@1234",
>     "usn": "1DS21CS001",
>     "phone": "9999999999",
>     "college": "DSCE",
>     "name": "Test User"
>   }'
>
> # Should respond in under 1 second with { message: "OTP sent" }
> # Check your email within 30 seconds
> ```
>
> Report: response time in ms + whether email arrived.
>
> ---
>
> # FIX 2 — RUSH HOURS FEATURE
>
> ## Backend
>
> **Create `backend/src/models/RushHour.ts`:**
> ```ts
> import mongoose, { Schema, Document } from 'mongoose'
>
> export interface IRushHour extends Document {
>   college: string
>   dayOfWeek: number[]    // 0=Sun, 1=Mon ... 6=Sat
>   startTime: string      // "12:00" 24hr format
>   endTime: string        // "14:00"
>   label: string          // "Lunch Rush", "Breakfast Rush"
>   surchargePercent: number  // 0 = no surcharge, 10 = 10% extra
>   isActive: boolean
>   message: string        // shown to student e.g. "Busy hours — 15 min wait"
>   createdBy: mongoose.Types.ObjectId
>   updatedAt: Date
> }
>
> const RushHourSchema = new Schema<IRushHour>({
>   college:         { type: String, required: true, enum: ['DSCE','DSATM','NIE'] },
>   dayOfWeek:       { type: [Number], required: true },
>   startTime:       { type: String, required: true },
>   endTime:         { type: String, required: true },
>   label:           { type: String, required: true, trim: true },
>   surchargePercent:{ type: Number, default: 0, min: 0, max: 50 },
>   isActive:        { type: Boolean, default: true },
>   message:         { type: String, default: 'Busy hours — expect slight delays' },
>   createdBy:       { type: Schema.Types.ObjectId, ref: 'User', required: true }
> }, { timestamps: true })
>
> export const RushHour = mongoose.model<IRushHour>('RushHour', RushHourSchema)
> ```
>
> **Create `backend/src/routes/rushHours.ts`:**
> ```ts
> // GET /api/rush-hours?college=DSCE
> // Returns current rush hour status for a college
> // Public — mobile app checks this on load
> router.get('/', async (req, res) => {
>   const { college } = req.query
>   const now = new Date()
>   const currentDay = now.getDay()
>   const currentTime = `${String(now.getHours()).padStart(2,'0')}:${String(now.getMinutes()).padStart(2,'0')}`
>
>   const rushHours = await RushHour.find({
>     college,
>     isActive: true,
>     dayOfWeek: currentDay
>   }).lean()
>
>   const activeRush = rushHours.find(r =>
>     currentTime >= r.startTime && currentTime <= r.endTime
>   )
>
>   return res.json({
>     isRushHour: !!activeRush,
>     current: activeRush ?? null,
>     all: rushHours
>   })
> })
>
> // GET /api/rush-hours/all (admin — see all rush hours for their college)
> router.get('/all', requireAuth, requireRoles(['staff','manager','admin']),
>   async (req, res) => {
>     const college = req.query.college ?? req.user.college
>     const rushHours = await RushHour.find({ college }).lean()
>     res.json(rushHours)
>   }
> )
>
> // POST /api/rush-hours (admin — create rush hour)
> router.post('/', requireAuth, requireRoles(['manager','admin']),
>   async (req, res) => {
>     const { label, dayOfWeek, startTime, endTime,
>             surchargePercent, message, college } = req.body
>
>     // Manager can only set for their own college
>     const targetCollege = req.user.role === 'admin'
>       ? (college ?? req.user.college)
>       : req.user.college
>
>     const rushHour = await RushHour.create({
>       college: targetCollege,
>       label, dayOfWeek, startTime, endTime,
>       surchargePercent: surchargePercent ?? 0,
>       message: message ?? 'Busy hours — expect slight delays',
>       isActive: true,
>       createdBy: req.user.id
>     })
>     res.status(201).json(rushHour)
>   }
> )
>
> // PATCH /api/rush-hours/:id (admin — toggle or update)
> router.patch('/:id', requireAuth, requireRoles(['manager','admin']),
>   async (req, res) => {
>     const rushHour = await RushHour.findById(req.params.id)
>     if (!rushHour) return res.status(404).json({ error: 'Not found' })
>
>     // Manager can only edit own college
>     if (req.user.role !== 'admin' &&
>         rushHour.college !== req.user.college) {
>       return res.status(403).json({ error: 'Access denied' })
>     }
>
>     Object.assign(rushHour, req.body)
>     await rushHour.save()
>     res.json(rushHour)
>   }
> )
>
> // DELETE /api/rush-hours/:id
> router.delete('/:id', requireAuth, requireRoles(['manager','admin']),
>   async (req, res) => {
>     const rushHour = await RushHour.findById(req.params.id)
>     if (!rushHour) return res.status(404).json({ error: 'Not found' })
>     if (req.user.role !== 'admin' && rushHour.college !== req.user.college) {
>       return res.status(403).json({ error: 'Access denied' })
>     }
>     await rushHour.deleteOne()
>     res.json({ message: 'Deleted' })
>   }
> )
> ```
>
> Mount in `app.ts`:
> ```ts
> import rushHoursRouter from './routes/rushHours'
> app.use('/api/rush-hours', rushHoursRouter)
> ```
>
> **Show rush hour surcharge in order creation (`orders.ts`):**
> ```ts
> // After calculating totalAmount, check if rush hour active
> const now = new Date()
> const currentDay = now.getDay()
> const currentTime = `${String(now.getHours()).padStart(2,'0')}:${String(now.getMinutes()).padStart(2,'0')}`
>
> const activeRush = await RushHour.findOne({
>   college: req.user.college,
>   isActive: true,
>   dayOfWeek: currentDay,
>   startTime: { $lte: currentTime },
>   endTime: { $gte: currentTime }
> }).lean()
>
> let finalAmount = totalAmount
> let rushHourApplied = false
>
> if (activeRush && activeRush.surchargePercent > 0) {
>   finalAmount = totalAmount * (1 + activeRush.surchargePercent / 100)
>   rushHourApplied = true
> }
>
> // Include in response so mobile can show it
> // { order, razorpay, rushHour: activeRush ?? null }
> ```
>
> ## Admin Panel — Rush Hours Page
>
> **Create `admin/src/pages/RushHoursPage.tsx`:**
> ```tsx
> // Full rush hours management page
> // Layout:
> //
> // ┌─────────────────────────────────────────┐
> // │  Rush Hours Management    [+ Add New]   │
> // │  College: [DSCE ▼]  (admin sees all,   │
> // │           manager sees own only)        │
> // ├─────────────────────────────────────────┤
> // │  CURRENT STATUS                         │
> // │  🔴 RUSH HOUR ACTIVE — Lunch Rush       │
> // │  12:00 PM - 2:00 PM • Mon-Fri           │
> // │  "Busy hours — 15 min wait"             │
> // ├─────────────────────────────────────────┤
> // │  ALL RUSH HOURS                         │
> // │  ┌──────────────────────────────────┐  │
> // │  │ 🌅 Breakfast Rush               │  │
> // │  │ 8:00 - 10:00 • Mon-Fri          │  │
> // │  │ No surcharge • Active ✅        │  │
> // │  │ [Edit] [Toggle] [Delete]        │  │
> // │  └──────────────────────────────────┘  │
> // └─────────────────────────────────────────┘
>
> // Add New Rush Hour modal:
> // Label (e.g. "Lunch Rush")
> // Days of week (checkboxes: Mon Tue Wed Thu Fri Sat Sun)
> // Start time picker
> // End time picker
> // Surcharge % (0 means no extra charge)
> // Message to students
> // College (admin only — manager auto-set to own college)
>
> // Use existing UI component patterns from other admin pages
> // Show live countdown to next rush hour end time
> // Auto-refresh status every 60 seconds
> ```
>
> **Add to admin API (`admin/src/api/index.ts`):**
> ```ts
> // Rush hours
> export const getRushHours = (college?: string) =>
>   api.get(`/rush-hours/all${college ? `?college=${college}` : ''}`)
>
> export const getRushHourStatus = (college: string) =>
>   api.get(`/rush-hours?college=${college}`)
>
> export const createRushHour = (data: any) =>
>   api.post('/rush-hours', data)
>
> export const updateRushHour = (id: string, data: any) =>
>   api.patch(`/rush-hours/${id}`, data)
>
> export const deleteRushHour = (id: string) =>
>   api.delete(`/rush-hours/${id}`)
> ```
>
> **Add route to admin `App.tsx`:**
> ```tsx
> <Route path="/rush-hours" element={
>   <ProtectedRoute roles={['manager','admin']}>
>     <RushHoursPage />
>   </ProtectedRoute>
> } />
> ```
>
> Add to sidebar/nav:
> ```tsx
> { label: '⏰ Rush Hours', path: '/rush-hours', roles: ['manager','admin'] }
> ```
>
> ## Mobile — Rush Hour Banner
>
> **In `app/src/screens/MenuScreen.tsx`:**
> ```tsx
> // Check rush hour status on mount
> useEffect(() => {
>   getRushHourStatus(user.college)
>     .then(({ data }) => setRushHour(data))
>     .catch(() => {})
> }, [])
>
> // Show banner at top of menu if rush hour active
> {rushHour?.isRushHour && (
>   <View style={styles.rushBanner}>
>     <Text style={styles.rushEmoji}>🔴</Text>
>     <View>
>       <Text style={styles.rushTitle}>Rush Hour Active</Text>
>       <Text style={styles.rushMsg}>{rushHour.current.message}</Text>
>       {rushHour.current.surchargePercent > 0 && (
>         <Text style={styles.rushSurcharge}>
>           +{rushHour.current.surchargePercent}% busy hour charge applies
>         </Text>
>       )}
>     </View>
>   </View>
> )}
> ```
>
> ---
>
> # FIX 3 — PER-COLLEGE MENU ITEMS
>
> ## Backend — Add college field to MenuItem
>
> **Update `backend/src/models/MenuItem.ts`:**
> ```ts
> college: {
>   type: String,
>   required: true,
>   enum: ['DSCE', 'DSATM', 'NIE', 'ALL'],
>   default: 'ALL'  // 'ALL' means visible to every college
> }
> ```
>
> **Update GET /api/menu:**
> ```ts
> router.get('/', async (req, res) => {
>   const { college } = req.query
>
>   // Build filter
>   const filter: any = { isAvailable: true }
>   if (college) {
>     // Show items for this college + items marked ALL
>     filter.$or = [
>       { college: college },
>       { college: 'ALL' }
>     ]
>   }
>
>   // Check cache
>   const cacheKey = college as string ?? 'ALL'
>   const cached = getMenuCache(cacheKey)
>   if (cached) return res.set('X-Cache','HIT').json(cached)
>
>   const items = await MenuItem.find(filter)
>     .select('name description price category image isAvailable college')
>     .lean()
>
>   setMenuCache(cacheKey, items)
>   return res.set('X-Cache','MISS').json(items)
> })
> ```
>
> **Update POST /api/menu (admin creates item):**
> ```ts
> // Manager auto-assigned to their own college
> // Admin can specify any college or ALL
> const targetCollege = req.user.role === 'admin'
>   ? (college ?? 'ALL')
>   : req.user.college
>
> const item = await MenuItem.create({
>   ...req.body,
>   college: targetCollege
> })
> ```
>
> ## Admin Panel — Menu Page per College
>
> **Update `admin/src/pages/MenuPage.tsx`:**
> ```tsx
> // Add college filter tabs at top (admin only)
> // Manager sees only their college items + ALL items
>
> // Tab bar:
> // [All Colleges] [DSCE] [DSATM] [NIE]  ← admin only
> // [DSCE Items] [ALL Items]              ← manager sees this
>
> // Each menu item card shows college badge
> // ┌────────────────────────────────┐
> // │ 🍱 Masala Dosa      [DSCE]    │
> // │ Crispy dosa with chutney       │
> // │ ₹60 • Available ✅            │
> // │ [Edit] [Toggle] [Delete]       │
> // └────────────────────────────────┘
>
> // Add Item modal — add college dropdown
> // Admin: can choose DSCE / DSATM / NIE / ALL
> // Manager: college auto-set to their own, field hidden
>
> // When manager logs in, they only see:
> // - Items with college === their college
> // - Items with college === 'ALL'
> // They can edit their college items but not ALL items
> // Only admin can create/edit ALL items
> ```
>
> ## Mobile — Pass college when fetching menu
>
> **In `app/src/api/index.ts`:**
> ```ts
> export const getMenu = (college?: string) =>
>   api.get(`/menu${college ? `?college=${college}` : ''}`)
>     .then(r => r.data)
> ```
>
> **In `app/src/screens/MenuScreen.tsx`:**
> ```ts
> // Pass user's college when fetching
> const { user } = useAuthStore()
> const menu = await getMenu(user.college)
> ```
>
> ---
>
> # FIX 4 — CHEF NOTES / CUSTOM ITEM DESCRIPTION
>
> ## Backend — Add notes to order items
>
> **Update `backend/src/models/Order.ts`:**
> ```ts
> items: [{
>   menuItem:  { type: Schema.Types.ObjectId, ref: 'MenuItem' },
>   quantity:  { type: Number, required: true, min: 1 },
>   price:     { type: Number, required: true },
>   // NEW FIELD
>   chefNote:  {
>     type: String,
>     trim: true,
>     maxlength: [200, 'Chef note cannot exceed 200 characters'],
>     default: ''
>   }
> }]
> ```
>
> **Update order creation in `orders.ts`:**
> ```ts
> // When mapping cart items to order items
> const orderItems = await Promise.all(items.map(async (item: any) => {
>   const menuItem = await MenuItem.findById(item.menuItemId).lean()
>   if (!menuItem || !menuItem.isAvailable) {
>     throw new Error(`${menuItem?.name ?? 'Item'} is not available`)
>   }
>
>   // Sanitize chef note — strip HTML, limit length
>   const chefNote = item.chefNote
>     ? String(item.chefNote).replace(/<[^>]*>/g, '').slice(0, 200).trim()
>     : ''
>
>   return {
>     menuItem: menuItem._id,
>     quantity: item.quantity,
>     price: menuItem.price,  // server-side price always
>     chefNote                // from client, sanitized
>   }
> }))
> ```
>
> ## Mobile — Chef Notes UI
>
> **Update `app/src/screens/CartScreen.tsx`:**
>
> Each cart item shows an expandable note field:
> ```tsx
> // For each cart item
> const CartItem = ({ item, onUpdateNote }) => {
>   const [showNote, setShowNote] = useState(!!item.chefNote)
>   const [note, setNote] = useState(item.chefNote ?? '')
>
>   return (
>     <View style={styles.cartItem}>
>       {/* existing item display */}
>       <Text style={styles.itemName}>{item.name}</Text>
>       <Text style={styles.itemPrice}>₹{item.price}</Text>
>
>       {/* Chef note toggle */}
>       <TouchableOpacity
>         onPress={() => setShowNote(!showNote)}
>         style={styles.noteToggle}
>       >
>         <Text style={styles.noteToggleText}>
>           {showNote ? '✕ Remove note' : '📝 Add note to chef'}
>         </Text>
>       </TouchableOpacity>
>
>       {/* Expandable note input */}
>       {showNote && (
>         <View style={styles.noteContainer}>
>           <TextInput
>             style={styles.noteInput}
>             placeholder="e.g. Extra spicy, no onions, less oil..."
>             placeholderTextColor="#999"
>             value={note}
>             onChangeText={(text) => {
>               setNote(text)
>               onUpdateNote(item.menuItemId, text)
>             }}
>             maxLength={200}
>             multiline
>             numberOfLines={2}
>           />
>           <Text style={styles.charCount}>{note.length}/200</Text>
>         </View>
>       )}
>     </View>
>   )
> }
>
> // Styles
> noteToggle: {
>   marginTop: 6,
>   alignSelf: 'flex-start'
> },
> noteToggleText: {
>   color: '#00C853',
>   fontSize: 13,
>   fontWeight: '500'
> },
> noteContainer: {
>   marginTop: 8,
>   backgroundColor: '#FFFDE7',
>   borderRadius: 8,
>   borderWidth: 1,
>   borderColor: '#FDD835',
>   padding: 10
> },
> noteInput: {
>   fontSize: 14,
>   color: '#333',
>   minHeight: 48
> },
> charCount: {
>   fontSize: 11,
>   color: '#999',
>   textAlign: 'right',
>   marginTop: 4
> }
> ```
>
> **Update cartStore to store notes:**
> ```ts
> // In cartStore.ts add note to cart item type
> interface CartItem {
>   menuItemId: string
>   name: string
>   price: number
>   quantity: number
>   chefNote: string  // NEW
> }
>
> // Add action
> updateChefNote: (menuItemId: string, note: string) =>
>   set(state => ({
>     items: state.items.map(item =>
>       item.menuItemId === menuItemId
>         ? { ...item, chefNote: note }
>         : item
>     )
>   }))
> ```
>
> **Update createOrder API call to include notes:**
> ```ts
> // In api/index.ts
> export const createOrder = (items: CartItem[]) =>
>   api.post('/orders', {
>     items: items.map(i => ({
>       menuItemId: i.menuItemId,
>       quantity: i.quantity,
>       chefNote: i.chefNote ?? ''  // include note
>     }))
>   }).then(r => r.data)
> ```
>
> ## Admin Panel — Show Chef Notes on Orders
>
> **In `admin/src/pages/OrdersPage.tsx`:**
>
> Each order card shows chef notes prominently:
> ```tsx
> // In order items list
> {order.items.map(item => (
>   <View key={item._id} style={orderStyles.item}>
>     <Text>{item.menuItem.name} × {item.quantity}</Text>
>     <Text>₹{item.price * item.quantity}</Text>
>
>     {/* Show chef note if present */}
>     {item.chefNote && (
>       <View style={orderStyles.chefNote}>
>         <Text style={orderStyles.chefNoteIcon}>👨‍🍳</Text>
>         <Text style={orderStyles.chefNoteText}>
>           {item.chefNote}
>         </Text>
>       </View>
>     )}
>   </View>
> ))}
>
> // Style the chef note to stand out
> // chefNote: yellow background, left border accent
> // so staff cannot miss it
> chefNote: {
>   flexDirection: 'row',
>   alignItems: 'flex-start',
>   backgroundColor: '#FFFDE7',
>   borderLeftWidth: 3,
>   borderLeftColor: '#FDD835',
>   borderRadius: 6,
>   padding: 8,
>   marginTop: 6,
>   gap: 6
> },
> chefNoteIcon: { fontSize: 16 },
> chefNoteText: {
>   color: '#555',
>   fontSize: 13,
>   fontStyle: 'italic',
>   flex: 1
> }
> ```
>
> **In order print/display for kitchen — make notes BIG:**
> ```tsx
> // Kitchen view or QR scan confirmation
> // Chef note must be impossible to miss
> {item.chefNote && (
>   <View style={kitchenStyles.chefAlert}>
>     <Text style={kitchenStyles.chefAlertTitle}>
>       ⚠️ SPECIAL REQUEST
>     </Text>
>     <Text style={kitchenStyles.chefAlertText}>
>       {item.chefNote}
>     </Text>
>   </View>
> )}
>
> kitchenStyles = {
>   chefAlert: {
>     backgroundColor: '#FF6F00',
>     borderRadius: 8,
>     padding: 12,
>     marginTop: 8
>   },
>   chefAlertTitle: {
>     color: '#FFF',
>     fontWeight: '800',
>     fontSize: 12,
>     marginBottom: 4
>   },
>   chefAlertText: {
>     color: '#FFF',
>     fontSize: 15,
>     fontWeight: '600'
>   }
> }
> ```
>
> ---
>
> ## AFTER ALL FIXES — Verify Everything
>
> ```bash
> # Backend clean
> cd backend && npx tsc --noEmit
>
> # Start and test all new routes
> cd backend && npm run dev &
> sleep 5
>
> # Test OTP endpoint responds fast
> time curl -s -X POST http://localhost:4000/api/auth/resend-otp \
>   -H "Content-Type: application/json" \
>   -d '{"email":"test@test.com"}'
> # Must respond in under 500ms
>
> # Test rush hours route exists
> curl http://localhost:4000/api/rush-hours?college=DSCE
>
> # Test menu with college filter
> curl http://localhost:4000/api/menu?college=DSCE
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
> FIX REPORT
> ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
>
> FIX 1 — OTP:
>   Root cause found:          [explain exactly]
>   Resend installed:          YES/NO
>   RESEND_API_KEY:            SET/MISSING
>   email.service.ts correct:  YES/NO
>   OTP non-blocking:          YES/NO
>   OTP test response time:    Xms
>   Email received in test:    YES/NO
>
> FIX 2 — Rush Hours:
>   RushHour model created:    YES/NO
>   Rush hour routes mounted:  YES/NO
>   Admin page created:        YES/NO
>   Mobile banner added:       YES/NO
>   Surcharge in orders:       YES/NO
>
> FIX 3 — Per-College Menu:
>   college field on MenuItem: YES/NO
>   Menu filtered by college:  YES/NO
>   Admin tabs by college:     YES/NO
>   Mobile passes college:     YES/NO
>   NIE added everywhere:      YES/NO
>
> FIX 4 — Chef Notes:
>   chefNote field on Order:   YES/NO
>   Mobile note input added:   YES/NO
>   cartStore updated:         YES/NO
>   Admin shows notes:         YES/NO
>   Kitchen alert styled:      YES/NO
>
> BUILD:
>   tsc --noEmit:    CLEAN/ERRORS
>   admin build:     CLEAN/ERRORS
>   mobile export:   CLEAN/ERRORS
>
> ENV VARS NEEDED FROM ME:
>   [list anything missing]
> ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
> ```
>
> **RULES:**
> - Never touch .env files
> - Never touch payment, webhook, Razorpay, QR, socket events
> - Show diff before every change
> - Fix in order: 1 → 2 → 3 → 4
> - Run tsc after every fix
> - One file at a time

---

## What You Do Right Now

**If RESEND_API_KEY is missing:**
```
1. resend.com → sign up free
2. API Keys → Create API Key → copy it
3. Paste into backend/.env as RESEND_API_KEY=re_xxxxx
```

That single key fixes OTP instantly. Everything else the agent handles.