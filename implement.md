## PROMPT — Fix College Display + OTP + Loading Animations + Security + Play Store Readiness

Copy into a fresh conversation:

---

> **READ EVERYTHING BEFORE WRITING A SINGLE LINE OF CODE.**
> Do not touch payment, webhook, QR, or any working feature.
> Show diff before every change. Never touch .env files.
>
> ---
>
> ## FIRST — READ THESE FILES
>
> ```bash
> # College display issue
> cat app/src/screens/HomeScreen.tsx 2>/dev/null || \
>   find app/src/screens -name "*.tsx" -exec grep -l "DSCE\|canteen\|college" {} \;
> cat app/src/stores/authStore.ts
> cat app/src/context/AuthContext.tsx 2>/dev/null || echo "MISSING"
>
> # Find everywhere DSCE is hardcoded
> grep -rn "DSCE\|canteen\|Canteen" app/src/ --include="*.tsx" --include="*.ts"
>
> # OTP flow
> cat backend/src/routes/auth.ts
> cat backend/src/services/email.service.ts 2>/dev/null || echo "MISSING"
> grep -rn "resend\|nodemailer\|sendMail\|OTP_MODE\|otp" backend/src/ --include="*.ts"
>
> # College list
> grep -rn "DSCE\|DSATM\|NIE\|college\|enum" backend/src/models/User.ts
>
> # Loading/animation packages already installed
> grep "reanimated\|lottie\|loading\|spinner" app/package.json
>
> # App config
> cat app/app.json
> cat app/eas.json
>
> # Environment
> cat backend/.env.example
> cat app/.env.example 2>/dev/null || echo "MISSING"
>
> # Security scan
> grep -rn "localhost\|hardcoded\|console.log\|TODO\|FIXME\|hack" \
>   backend/src/ app/src/ --include="*.ts" --include="*.tsx" \
>   | grep -v node_modules
>
> # Check all packages for known issues
> cd backend && npm audit 2>/dev/null
> cd app && npm audit 2>/dev/null
> ```
>
> Say "FILES READ" then proceed.
>
> ---
>
> # FIX 1 — COLLEGE NAME SHOWING WRONG ON HOME SCREEN
>
> **Root cause to find first:**
> ```bash
> # Find exactly where home screen gets college name
> grep -n "DSCE\|college\|collegeName\|canteen" app/src/screens/HomeScreen.tsx
>
> # Check what authStore returns for college
> grep -n "college\|user" app/src/stores/authStore.ts
> ```
>
> **The fix has two parts:**
>
> **Part A — Make college name dynamic everywhere:**
> Search for any hardcoded string "DSCE Canteen" or "DSCE" in all screen files.
> Replace every instance with the value from the auth store:
> ```ts
> // Instead of
> <Text>DSCE Canteen</Text>
>
> // Use
> const { user } = useAuthStore()
> <Text>{user?.college} Canteen</Text>
> ```
>
> **Part B — Add college display name mapping:**
> Create `app/src/constants/colleges.ts`:
> ```ts
> export const COLLEGES = {
>   DSCE: {
>     name: 'DSCE',
>     fullName: 'Dayananda Sagar College of Engineering',
>     canteenName: 'DSCE Canteen'
>   },
>   DSATM: {
>     name: 'DSATM',
>     fullName: 'Dayananda Sagar Academy of Technology',
>     canteenName: 'DSATM Canteen'
>   },
>   NIE: {
>     name: 'NIE',
>     fullName: 'The National Institute of Engineering',
>     canteenName: 'NIE Canteen'
>   }
> }
>
> export type CollegeCode = keyof typeof COLLEGES
> ```
>
> Use this mapping everywhere a college name is displayed:
> ```ts
> import { COLLEGES } from '../constants/colleges'
> const collegeName = COLLEGES[user?.college]?.canteenName ?? 'Canteen'
> <Text>{collegeName}</Text>
> ```
>
> **Part C — Add NIE to backend college enum:**
> In `backend/src/models/User.ts`:
> ```ts
> college: {
>   type: String,
>   required: true,
>   enum: ['DSCE', 'DSATM', 'NIE'],
>   trim: true
> }
> ```
>
> In `backend/src/routes/auth.ts` validation:
> ```ts
> // Update Zod schema or manual validation
> const validColleges = ['DSCE', 'DSATM', 'NIE']
> if (!validColleges.includes(college)) {
>   return res.status(400).json({ error: 'Invalid college' })
> }
> ```
>
> Add NIE roster file:
> ```bash
> cp backend/src/data/rosters/DSCE.json backend/src/data/rosters/NIE.json
> # Then empty the NIE.json to just: []
> ```
>
> In `app/src/screens/SignupScreen.tsx` and `LoginScreen.tsx`:
> Add NIE to college picker options:
> ```ts
> const collegeOptions = [
>   { label: 'DSCE', value: 'DSCE' },
>   { label: 'DSATM', value: 'DSATM' },
>   { label: 'NIE', value: 'NIE' }
> ]
> ```
>
> ---
>
> # FIX 2 — OTP NOT WORKING
>
> **Diagnose first — run these:**
> ```bash
> # Check if Resend is installed and configured
> grep "resend" backend/package.json
> cat backend/src/services/email.service.ts 2>/dev/null || echo "email service MISSING"
>
> # Check OTP_MODE env
> grep "OTP_MODE\|RESEND\|EMAIL" backend/.env.example
>
> # Test email service directly
> cd backend && node -e "
> require('dotenv').config();
> console.log('RESEND_API_KEY:', process.env.RESEND_API_KEY ? 'SET' : 'MISSING');
> console.log('OTP_MODE:', process.env.OTP_MODE);
> "
> ```
>
> **Tell me the output before fixing anything.**
>
> Then apply these fixes based on what you find:
>
> **If RESEND_API_KEY is missing:**
> Tell me: "Please add RESEND_API_KEY to backend/.env — get it from resend.com"
> Wait for me to confirm before continuing.
>
> **If email.service.ts is missing:**
> Create it:
> ```ts
> import { Resend } from 'resend'
>
> if (!process.env.RESEND_API_KEY) {
>   throw new Error('RESEND_API_KEY is not set')
> }
>
> const resend = new Resend(process.env.RESEND_API_KEY)
>
> export async function sendOTPEmail(
>   toEmail: string,
>   toName: string,
>   otp: string,
>   college: string
> ): Promise<void> {
>   const { error } = await resend.emails.send({
>     from: 'Canteen App <onboarding@resend.dev>',
>     to: toEmail,
>     subject: `${otp} is your Canteen OTP`,
>     html: `
>       <div style="font-family:Arial,sans-serif;max-width:420px;margin:0 auto;padding:32px;">
>         <h2 style="color:#00C853;margin-bottom:4px;">${college} Canteen</h2>
>         <p style="color:#666;margin-top:0;">Food ordering app</p>
>         <hr style="border:none;border-top:1px solid #eee;margin:24px 0"/>
>         <p>Hi ${toName},</p>
>         <p>Your OTP verification code is:</p>
>         <div style="background:#F8F8F8;border-radius:12px;padding:24px;text-align:center;margin:24px 0;">
>           <span style="font-size:40px;font-weight:700;letter-spacing:12px;color:#1A1A1A;">
>             ${otp}
>           </span>
>         </div>
>         <p style="color:#666;font-size:14px;">
>           ⏱ Expires in <strong>10 minutes</strong>
>         </p>
>         <p style="color:#999;font-size:12px;">
>           If you didn't request this, ignore this email.
>         </p>
>       </div>
>     `
>   })
>
>   if (error) {
>     console.error('Resend error:', error)
>     throw new Error('Failed to send OTP email')
>   }
> }
> ```
>
> **Make OTP sending non-blocking in auth.ts:**
> ```ts
> // WRONG — blocks response waiting for email
> await sendOTPEmail(email, name, otp, college)
> return res.json({ message: 'OTP sent' })
>
> // CORRECT — responds instantly, email sends in background
> sendOTPEmail(email, name, otp, college).catch(err =>
>   console.error('OTP email failed silently:', err.message)
> )
> return res.json({ message: 'OTP sent' })
> ```
>
> **Add OTP fallback mode:**
> If email fails in dev/test, log OTP to console:
> ```ts
> sendOTPEmail(email, name, otp, college).catch(err => {
>   console.error('Email failed:', err.message)
>   if (process.env.NODE_ENV !== 'production') {
>     console.log(`[DEV] OTP for ${email}: ${otp}`)
>   }
> })
> ```
>
> **Add OTP resend cooldown (prevent spam):**
> ```ts
> // In resend-otp route
> const cooldown = 60 * 1000 // 1 minute
> if (user.otpSentAt && Date.now() - user.otpSentAt.getTime() < cooldown) {
>   const secondsLeft = Math.ceil(
>     (cooldown - (Date.now() - user.otpSentAt.getTime())) / 1000
>   )
>   return res.status(429).json({
>     error: `Please wait ${secondsLeft} seconds before requesting another OTP`
>   })
> }
> ```
>
> Add `otpSentAt: { type: Date }` to User model.
>
> **Mobile OTP screen improvements:**
> Find `OTPScreen.tsx` and add:
> - 60 second countdown timer showing "Resend in 0:45"
> - Auto-submit when 6th digit is entered
> - Shake animation on wrong OTP
> - Clear input on wrong OTP attempt
>
> ---
>
> # FIX 3 — LOADING ANIMATIONS (Cat themed)
>
> **Install:**
> ```bash
> cd app && npx expo install lottie-react-native
> ```
>
> **Create `app/src/components/CatLoader.tsx`:**
> ```tsx
> import React, { useEffect } from 'react'
> import { View, Text, StyleSheet, Dimensions } from 'react-native'
> import Animated, {
>   useSharedValue,
>   useAnimatedStyle,
>   withRepeat,
>   withTiming,
>   withSequence,
>   Easing
> } from 'react-native-reanimated'
>
> // Cat drawn with emoji + animated tail and eyes
> // No external assets needed
>
> interface CatLoaderProps {
>   message?: string
>   size?: 'small' | 'large'
> }
>
> export const CatLoader = ({ message = 'Loading...', size = 'large' }: CatLoaderProps) => {
>   const tailRotation = useSharedValue(0)
>   const eyeBlink = useSharedValue(1)
>   const bodyBob = useSharedValue(0)
>   const pawWave = useSharedValue(0)
>
>   useEffect(() => {
>     // Tail swings left and right
>     tailRotation.value = withRepeat(
>       withSequence(
>         withTiming(20, { duration: 500, easing: Easing.inOut(Easing.ease) }),
>         withTiming(-20, { duration: 500, easing: Easing.inOut(Easing.ease) })
>       ), -1, true
>     )
>
>     // Body gently bobs up and down
>     bodyBob.value = withRepeat(
>       withSequence(
>         withTiming(-4, { duration: 800 }),
>         withTiming(0, { duration: 800 })
>       ), -1, true
>     )
>
>     // Eyes blink every 3 seconds
>     const blinkInterval = setInterval(() => {
>       eyeBlink.value = withSequence(
>         withTiming(0.1, { duration: 80 }),
>         withTiming(1, { duration: 80 })
>       )
>     }, 3000)
>
>     // Paw waves
>     pawWave.value = withRepeat(
>       withSequence(
>         withTiming(-15, { duration: 400 }),
>         withTiming(15, { duration: 400 })
>       ), -1, true
>     )
>
>     return () => clearInterval(blinkInterval)
>   }, [])
>
>   const tailStyle = useAnimatedStyle(() => ({
>     transform: [{ rotate: `${tailRotation.value}deg` }]
>   }))
>
>   const bodyStyle = useAnimatedStyle(() => ({
>     transform: [{ translateY: bodyBob.value }]
>   }))
>
>   const eyeStyle = useAnimatedStyle(() => ({
>     transform: [{ scaleY: eyeBlink.value }]
>   }))
>
>   const pawStyle = useAnimatedStyle(() => ({
>     transform: [{ rotate: `${pawWave.value}deg` }]
>   }))
>
>   const isSmall = size === 'small'
>
>   return (
>     <View style={styles.container}>
>       <Animated.View style={[styles.catContainer, bodyStyle]}>
>         {/* Cat face */}
>         <View style={[styles.catFace, isSmall && styles.catFaceSmall]}>
>           {/* Ears */}
>           <View style={styles.earsRow}>
>             <View style={styles.ear} />
>             <View style={styles.ear} />
>           </View>
>           {/* Eyes */}
>           <Animated.View style={[styles.eyesRow, eyeStyle]}>
>             <View style={styles.eye} />
>             <View style={styles.eye} />
>           </Animated.View>
>           {/* Nose and whiskers */}
>           <Text style={styles.nose}>・ᴥ・</Text>
>         </View>
>
>         {/* Waving paw */}
>         <Animated.Text style={[styles.paw, pawStyle]}>🐾</Animated.Text>
>
>         {/* Tail */}
>         <Animated.View style={[styles.tail, tailStyle]} />
>       </Animated.View>
>
>       {/* Loading dots */}
>       <View style={styles.dotsRow}>
>         {[0, 1, 2].map(i => (
>           <LoadingDot key={i} delay={i * 200} />
>         ))}
>       </View>
>
>       {message ? (
>         <Text style={styles.message}>{message}</Text>
>       ) : null}
>     </View>
>   )
> }
>
> // Bouncing dot component
> const LoadingDot = ({ delay }: { delay: number }) => {
>   const bounce = useSharedValue(0)
>   useEffect(() => {
>     setTimeout(() => {
>       bounce.value = withRepeat(
>         withSequence(
>           withTiming(-8, { duration: 300 }),
>           withTiming(0, { duration: 300 })
>         ), -1, true
>       )
>     }, delay)
>   }, [])
>   const style = useAnimatedStyle(() => ({
>     transform: [{ translateY: bounce.value }]
>   }))
>   return <Animated.View style={[dotStyles.dot, style]} />
> }
>
> // Use throughout app like this:
> // <CatLoader message="Placing your order..." />
> // <CatLoader message="Connecting to canteen..." size="small" />
>
> const styles = StyleSheet.create({
>   container: { alignItems: 'center', justifyContent: 'center', padding: 32 },
>   catContainer: { alignItems: 'center', marginBottom: 16 },
>   catFace: {
>     width: 80, height: 80,
>     backgroundColor: '#FFB347',
>     borderRadius: 40,
>     alignItems: 'center',
>     justifyContent: 'center',
>     elevation: 4,
>     shadowColor: '#000',
>     shadowOffset: { width: 0, height: 2 },
>     shadowOpacity: 0.15,
>     shadowRadius: 4
>   },
>   catFaceSmall: { width: 50, height: 50, borderRadius: 25 },
>   earsRow: { flexDirection: 'row', gap: 30, position: 'absolute', top: -12 },
>   ear: {
>     width: 0, height: 0,
>     borderLeftWidth: 10, borderRightWidth: 10, borderBottomWidth: 18,
>     borderLeftColor: 'transparent', borderRightColor: 'transparent',
>     borderBottomColor: '#FFB347'
>   },
>   eyesRow: { flexDirection: 'row', gap: 16, marginBottom: 4 },
>   eye: {
>     width: 12, height: 12,
>     backgroundColor: '#2D2D2D',
>     borderRadius: 6
>   },
>   nose: { fontSize: 14, color: '#2D2D2D' },
>   paw: { fontSize: 20, marginTop: 8 },
>   tail: {
>     width: 6, height: 30,
>     backgroundColor: '#FFB347',
>     borderRadius: 3,
>     marginTop: 4,
>     transformOrigin: 'top'
>   },
>   dotsRow: { flexDirection: 'row', gap: 8, marginTop: 8 },
>   message: { color: '#666', fontSize: 14, marginTop: 12, textAlign: 'center' }
> })
>
> const dotStyles = StyleSheet.create({
>   dot: {
>     width: 8, height: 8,
>     backgroundColor: '#00C853',
>     borderRadius: 4
>   }
> })
> ```
>
> **Add cat loader messages based on context:**
> ```ts
> export const CAT_MESSAGES = {
>   login: "Meow! Checking your credentials...",
>   signup: "Purrr... Creating your account...",
>   otp: "Sending OTP... the cat is on it 🐱",
>   menu: "Fetching today's menu...",
>   order: "Placing your order... 🐾",
>   payment: "Processing payment... almost there!",
>   connecting: "Connecting to canteen server...",
>   generic: "Loading..."
> }
> ```
>
> **Add full screen loading overlay:**
> Create `app/src/components/LoadingOverlay.tsx`:
> ```tsx
> export const LoadingOverlay = ({ visible, message }: {
>   visible: boolean, message?: string
> }) => {
>   if (!visible) return null
>   return (
>     <View style={StyleSheet.absoluteFill} style={{
>       backgroundColor: 'rgba(255,255,255,0.92)',
>       alignItems: 'center',
>       justifyContent: 'center',
>       zIndex: 999
>     }}>
>       <CatLoader message={message} />
>     </View>
>   )
> }
> ```
>
> **Replace ALL existing loading spinners/ActivityIndicators:**
> ```bash
> # Find every ActivityIndicator in mobile app
> grep -rn "ActivityIndicator\|loading\|spinner\|isLoading" \
>   app/src/ --include="*.tsx"
> ```
>
> For each one found, replace with `<CatLoader size="small" />` or `<LoadingOverlay>`.
> Keep existing loading state logic — only replace the visual component.
>
> **Add skeleton loading for menu items:**
> Create `app/src/components/MenuItemSkeleton.tsx`:
> ```tsx
> // Animated shimmer placeholder shown while menu loads
> // Shows 4 grey shimmer cards that look like menu item cards
> // Uses reanimated for shimmer left-to-right animation
> // Replace with real items when data loads
> ```
>
> **Backend — make responses feel faster:**
> Add compression middleware:
> ```bash
> cd backend && npm install compression
> cd backend && npm install @types/compression -D
> ```
> ```ts
> import compression from 'compression'
> app.use(compression())  // add near top of app.ts after helmet
> ```
>
> Add menu caching so menu does not hit DB every time:
> ```ts
> // Simple in-memory cache for menu — invalidated when menu changes
> let menuCache: { data: any, cachedAt: number } | null = null
> const CACHE_TTL = 60 * 1000 // 1 minute
>
> router.get('/', async (req, res) => {
>   // Return cached menu if fresh
>   if (menuCache && Date.now() - menuCache.cachedAt < CACHE_TTL) {
>     return res.json(menuCache.data)
>   }
>   const items = await MenuItem.find({ isAvailable: true })
>   menuCache = { data: items, cachedAt: Date.now() }
>   res.json(items)
> })
>
> // Invalidate cache when admin updates menu
> export const invalidateMenuCache = () => { menuCache = null }
> // Call this in POST /api/menu and PATCH /api/menu/:id
> ```
>
> ---
>
> # FIX 4 — SECURITY VULNERABILITY SCAN
>
> Run full audit:
> ```bash
> # Dependency vulnerabilities
> cd backend && npm audit --audit-level=moderate
> cd app && npm audit --audit-level=moderate
>
> # Check for exposed secrets in code
> grep -rn "rzp_test\|rzp_live\|mongodb+srv\|AIza\|sk-\|api_key\|apiKey" \
>   backend/src/ app/src/ admin/src/ \
>   --include="*.ts" --include="*.tsx" \
>   | grep -v ".env\|example\|test\|mock"
>
> # Check for SQL/NoSQL injection risks
> grep -rn "\$where\|\$regex\|eval(\|Function(" \
>   backend/src/ --include="*.ts"
>
> # Check for missing auth on routes
> grep -n "router\.\(get\|post\|patch\|delete\)" backend/src/routes/orders.ts \
>   | grep -v "requireAuth\|requireRoles"
>
> grep -n "router\.\(get\|post\|patch\|delete\)" backend/src/routes/admin.ts \
>   | grep -v "requireAuth\|requireRoles"
>
> # Check for console.log leaking sensitive data
> grep -rn "console.log.*password\|console.log.*token\|console.log.*secret\|console.log.*otp" \
>   backend/src/ --include="*.ts"
>
> # Check CORS config
> grep -n "cors" backend/src/app.ts
>
> # Check if rate limiting active
> grep -n "rateLimit\|limiter" backend/src/app.ts
>
> # Check helmet is configured
> grep -n "helmet" backend/src/app.ts
>
> # Check mongoose version for known vulns
> grep "mongoose" backend/package.json
> ```
>
> Report every finding as:
> ```
> CRITICAL → fix immediately
> HIGH     → fix before public launch
> MEDIUM   → fix soon
> LOW      → nice to have
> SAFE     → no action needed
> ```
>
> Fix all CRITICAL and HIGH findings automatically.
> Show me MEDIUM and LOW and ask before fixing.
>
> ---
>
> # FIX 5 — PLAY STORE READINESS CHECK
>
> Check these requirements and tell me what's missing:
>
> ```bash
> # App config
> cat app/app.json
> cat app/eas.json
>
> # Check required fields
> grep -n "name\|slug\|version\|android\|package\|icon\|splash\|permissions" app/app.json
> ```
>
> **Check every Play Store requirement:**
> ```
> TECHNICAL REQUIREMENTS:
> [ ] app.json has valid "name" (not "my-app" or default)
> [ ] app.json has valid "slug"
> [ ] app.json has android.package (e.g. com.yourname.canteen)
> [ ] app.json has versionCode (integer, starts at 1)
> [ ] app.json has version (e.g. "1.0.0")
> [ ] app.json has android.adaptiveIcon configured
> [ ] app.json has splash screen configured
> [ ] eas.json has "production" build profile
> [ ] android.permissions lists only what app actually needs
>
> CONTENT REQUIREMENTS:
> [ ] App has a privacy policy URL
> [ ] App has terms of service
> [ ] Login screen has "Terms of Service" link
> [ ] Signup screen has age/consent checkbox
>
> SECURITY REQUIREMENTS FOR PLAY STORE:
> [ ] No hardcoded API keys in app bundle
> [ ] HTTPS only — no HTTP URLs anywhere
> [ ] Razorpay SDK version is up to date
> [ ] expo-crypto used for any crypto operations
>
> PAYMENT REQUIREMENTS (most important):
> [ ] App uses Razorpay — this is allowed on Play Store
> [ ] No custom payment UI that bypasses Razorpay (not allowed)
> [ ] Payment confirmation comes from server not client
> ```
>
> **Fix `app.json` for Play Store:**
> Update these fields if wrong or missing:
> ```json
> {
>   "expo": {
>     "name": "Canteen App",
>     "slug": "canteen-app",
>     "version": "1.0.0",
>     "orientation": "portrait",
>     "icon": "./assets/icon.png",
>     "splash": {
>       "image": "./assets/splash.png",
>       "resizeMode": "contain",
>       "backgroundColor": "#00C853"
>     },
>     "android": {
>       "package": "com.theabhishekrp.canteen",
>       "versionCode": 1,
>       "adaptiveIcon": {
>         "foregroundImage": "./assets/adaptive-icon.png",
>         "backgroundColor": "#00C853"
>       },
>       "permissions": [
>         "CAMERA",
>         "INTERNET",
>         "ACCESS_NETWORK_STATE"
>       ]
>     },
>     "plugins": [
>       "expo-camera"
>     ]
>   }
> }
> ```
>
> **Fix `eas.json` for production build:**
> ```json
> {
>   "cli": { "version": ">= 5.0.0" },
>   "build": {
>     "development": {
>       "developmentClient": true,
>       "distribution": "internal"
>     },
>     "preview": {
>       "distribution": "internal",
>       "android": { "buildType": "apk" }
>     },
>     "production": {
>       "android": { "buildType": "aab" },
>       "env": {
>         "EXPO_PUBLIC_API_URL": "https://dsce-canteen-backend.onrender.com",
>         "EXPO_PUBLIC_CF_WORKER_URL": "https://canteen-payments.theabhishekrp.workers.dev"
>       }
>     }
>   }
> }
> ```
>
> **Add privacy policy screen:**
> Create `app/src/screens/PrivacyPolicyScreen.tsx`:
> ```tsx
> // Simple scrollable screen with privacy policy text
> // Covers: what data is collected (email, USN, college, orders)
> // How it's used (account creation, order processing, OTP delivery)
> // Who has access (college canteen staff only)
> // Data deletion: contact admin@canteen.com
> // No data sold to third parties
> // Razorpay handles payment data (link to Razorpay privacy policy)
> ```
>
> Add link to privacy policy on `LoginScreen.tsx` and `SignupScreen.tsx`:
> ```tsx
> <TouchableOpacity onPress={() => navigation.navigate('PrivacyPolicy')}>
>   <Text style={styles.privacyLink}>Privacy Policy</Text>
> </TouchableOpacity>
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
> FIX 1 — College display:
>   Hardcoded DSCE instances found: X
>   All replaced with dynamic college: YES/NO
>   NIE added to backend enum: YES/NO
>   NIE added to mobile picker: YES/NO
>
> FIX 2 — OTP:
>   Root cause: [what was wrong]
>   Resend configured: YES/NO
>   OTP non-blocking: YES/NO
>   OTP dev fallback log: YES/NO
>   Resend cooldown added: YES/NO
>
> FIX 3 — Loading:
>   CatLoader component created: YES/NO
>   ActivityIndicators replaced: X replaced
>   Menu cache added: YES/NO
>   Compression added: YES/NO
>
> FIX 4 — Security:
>   npm audit issues: X critical, X high, X medium
>   Hardcoded secrets found: YES (list) / NONE
>   Missing auth on routes: YES (list) / NONE
>   console.log leaks: YES (list) / NONE
>   All CRITICAL fixed: YES/NO
>   All HIGH fixed: YES/NO
>
> FIX 5 — Play Store:
>   app.json complete: YES/NO (list missing)
>   eas.json production profile: YES/NO
>   Privacy policy screen: YES/NO
>   HTTPS only: YES/NO
>   Permissions minimal: YES/NO
>   Estimated Play Store readiness: X/10
>
> tsc --noEmit:   CLEAN / X errors
> admin build:    CLEAN / X errors
> mobile export:  CLEAN / X errors
>
> ENV VARS I NEED FROM YOU:
> [list anything that needs to be added to .env files]
> ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
> ```
>
> **RULES:**
> - Never touch .env files
> - Never touch payment, webhook, QR, socket event logic
> - Show diff before every change
> - Fix in order: 1 → 2 → 3 → 4 → 5
> - Run tsc after every fix
> - One file at a time

---

## What You Do Right Now (Before Running Prompt)

*