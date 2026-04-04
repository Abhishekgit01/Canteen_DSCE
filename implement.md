## PROMPT — Multi-College Support + Auth Fix + Account Cleanup

Copy into a fresh conversation:

---

> **READ EVERYTHING BEFORE WRITING A SINGLE LINE OF CODE.**
>
> You are making 3 focused changes only. Do not touch payment, socket, webhook, QR, or any other working code. Show diff before every change.
>
> ---
>
> ## FIRST — READ THESE FILES BEFORE ANYTHING
>
> ```bash
> # Understand current user model
> cat backend/src/models/User.ts
>
> # Understand current auth routes
> cat backend/src/routes/auth.ts
>
> # Understand current admin routes
> cat backend/src/routes/admin.ts
>
> # Understand current auth store in mobile
> cat app/src/stores/authStore.ts
>
> # Understand current login/signup screens
> cat app/src/screens/LoginScreen.tsx
> cat app/src/screens/SignupScreen.tsx
>
> # Understand admin panel login
> cat admin/src/pages/LoginPage.tsx
> cat admin/src/context/useAuth.tsx
>
> # See what colleges/roster data exists
> find backend/src -name "*.json" | xargs ls -la
> cat backend/src/data/roster.json 2>/dev/null || find backend/src -name "roster*" -exec cat {} \;
> ```
>
> Read every output fully. Then say "FILES READ" before proceeding.
>
> ---
>
> ## CHANGE 1 — ADD MULTI-COLLEGE SUPPORT
>
> **What to change:**
>
> **Backend — `User` model:**
> Add one field:
> ```ts
> college: {
>   type: String,
>   required: true,
>   enum: ['DSCE', 'DSATM'],  // add more colleges here as needed
>   trim: true
> }
> ```
>
> **Backend — roster lookup in `auth.ts`:**
> Currently roster is one JSON file. Change it to support per-college rosters:
> ```
> backend/src/data/rosters/DSCE.json
> backend/src/data/rosters/DSATM.json
> ```
> Each file has the same structure as the existing roster.json.
> Copy existing roster.json to `rosters/DSCE.json` — do not delete original yet.
> Create an empty `rosters/DSATM.json` with structure `[]` for now.
>
> In signup route — when looking up USN in roster:
> ```ts
> // Load roster based on college field from request body
> const rosterPath = path.join(__dirname, `../data/rosters/${college}.json`)
> const roster = JSON.parse(fs.readFileSync(rosterPath, 'utf-8'))
> const student = roster.find(s => s.usn === usn)
> if (!student) return res.status(403).json({ error: `USN not found in ${college} roster` })
> ```
>
> Add `college` to signup body validation — required field.
> Add `college` to the JWT payload so it's always available from token.
> Add `college` to the response from `/api/auth/me`.
>
> **Backend — orders:** When creating an order, save `college` from `req.user.college` onto the order document. Add `college` field to Order model too.
>
> **Backend — admin routes:** Admin can filter orders by college:
> ```
> GET /api/orders?college=DSCE  → returns only DSCE orders
> GET /api/orders               → returns all orders (existing behavior)
> ```
>
> **Mobile — Signup screen:**
> Add a college picker BEFORE the form fields — it must be the first thing the student selects:
> ```
> Select Your College:
> ○ DSCE
> ○ DSATM
> ```
> Use a dropdown or radio buttons. College is required — cannot proceed without selecting.
> Pass `college` in signup API call body.
>
> **Mobile — Login screen:**
> Add the same college picker. Pass `college` in login API call body.
> Store `college` in `authStore` alongside token and user.
>
> **Mobile — show college name** in the profile/home screen header so student knows which college they're logged into.
>
> **Admin panel — Orders page:**
> Add a college filter dropdown at the top:
> ```
> Filter: [All Colleges ▼] [DSCE] [DSATM]
> ```
> Each order card/row should show a college badge.
>
> **Admin panel — Login:**
> Admin accounts are not college-specific (they manage all or one college).
> Add an optional `college` field to admin User model — if set, that admin only sees orders from that college. If null/empty, they see all colleges.
>
> ---
>
> ## CHANGE 2 — FIX LOGIN CREDENTIALS ISSUE
>
> **First, diagnose why old credentials are failing:**
>
> ```bash
> # Check if any users exist in DB
> cd backend && node -e "
> require('dotenv').config();
> const mongoose = require('mongoose');
> mongoose.connect(process.env.MONGO_URI).then(async () => {
>   const User = require('./dist/models/User').default;
>   const users = await User.find({}, 'email role college isVerified createdAt');
>   console.log(JSON.stringify(users, null, 2));
>   process.exit(0);
> }).catch(e => { console.log('DB Error:', e.message); process.exit(1); });
> "
> ```
>
> Show me the output. This will tell us if users exist and what state they're in.
>
> Then check the login route specifically:
> ```bash
> grep -n "college\|findOne\|email\|password\|isVerified" backend/src/routes/auth.ts
> ```
>
> Common reasons login breaks after adding `college` field:
> - Existing users in DB have no `college` field → model validation rejects them
> - Login route now requires `college` in body but old clients don't send it
>
> **Fix:** Make `college` optional in the LOGIN route only (not signup):
> ```ts
> // Login — find by email only, college not required
> const user = await User.findOne({ email })
> ```
>
> Signup still requires college. Login does not — the college is already stored on the user document from when they signed up.
>
> ---
>
> ## CHANGE 3 — REMOVE ALL NON-STAFF ACCOUNTS + CREATE FRESH ONES
>
> **Step 1 — Delete all student accounts from DB:**
> ```bash
> cd backend && node -e "
> require('dotenv').config();
> const mongoose = require('mongoose');
> mongoose.connect(process.env.MONGO_URI).then(async () => {
>   const User = require('./dist/models/User').default;
>   const result = await User.deleteMany({ role: 'student' });
>   console.log('Deleted student accounts:', result.deletedCount);
>   process.exit(0);
> }).catch(e => { console.log(e.message); process.exit(1); });
> "
> ```
>
> **Step 2 — Show me all remaining accounts:**
> ```bash
> cd backend && node -e "
> require('dotenv').config();
> const mongoose = require('mongoose');
> mongoose.connect(process.env.MONGO_URI).then(async () => {
>   const User = require('./dist/models/User').default;
>   const users = await User.find({}, 'email role college isVerified');
>   console.log(JSON.stringify(users, null, 2));
>   process.exit(0);
> }).catch(e => { console.log(e.message); process.exit(1); });
> "
> ```
>
> **Step 3 — Create fresh admin, manager, staff accounts:**
> Write a script `backend/scripts/createStaff.ts`:
> ```ts
> import mongoose from 'mongoose'
> import bcrypt from 'bcrypt'
> import dotenv from 'dotenv'
> dotenv.config()
>
> const staffAccounts = [
>   {
>     name: 'Super Admin',
>     email: 'admin@canteen.com',
>     password: 'Admin@1234',
>     role: 'admin',
>     college: null,       // sees all colleges
>     isVerified: true
>   },
>   {
>     name: 'DSCE Manager',
>     email: 'manager.dsce@canteen.com',
>     password: 'Manager@1234',
>     role: 'manager',
>     college: 'DSCE',
>     isVerified: true
>   },
>   {
>     name: 'DSATM Manager',
>     email: 'manager.dsatm@canteen.com',
>     password: 'Manager@1234',
>     role: 'manager',
>     college: 'DSATM',
>     isVerified: true
>   },
>   {
>     name: 'DSCE Staff',
>     email: 'staff.dsce@canteen.com',
>     password: 'Staff@1234',
>     role: 'staff',
>     college: 'DSCE',
>     isVerified: true
>   },
>   {
>     name: 'DSATM Staff',
>     email: 'staff.dsatm@canteen.com',
>     password: 'Staff@1234',
>     role: 'staff',
>     college: 'DSATM',
>     isVerified: true
>   }
> ]
>
> // hash passwords and insert
> // print each created account email when done
> ```
>
> Run with:
> ```bash
> cd backend && npx ts-node scripts/createStaff.ts
> ```
>
> After running, print all created accounts so I can save the credentials.
>
> **Step 4 — Verify login works for each new account:**
> ```bash
> # Test admin login
> curl -X POST http://localhost:4000/api/auth/login \
>   -H "Content-Type: application/json" \
>   -d '{"email":"admin@canteen.com","password":"Admin@1234"}'
> ```
> Must return `{ token: "..." }`. If 401 — show me the exact error.
>
> ---
>
> ## RULES — STRICTLY FOLLOW
>
> - Do NOT touch: payment routes, webhook, socket events, QR generation, Razorpay integration, CF Worker code
> - Do NOT touch: `.env` files — tell me what to add and I do it myself
> - Do NOT change existing working API response shapes — only ADD the `college` field
> - Show diff before every file change
> - Fix in order: Change 1 → Change 2 → Change 3
> - After all changes: run `npx tsc --noEmit` in backend, fix all errors
> - After all changes: run `npm run build` in admin, fix all errors
>
> ---
>
> ## FINAL REPORT
>
> ```
> CHANGE 1 — Multi-college:
>   User model updated:          YES/NO
>   Per-college rosters created: YES/NO
>   Mobile college picker added: YES/NO
>   Admin filter added:          YES/NO
>
> CHANGE 2 — Login fix:
>   Root cause of login failure: [explain]
>   Fix applied:                 YES/NO
>   Login tested and working:    YES/NO
>
> CHANGE 3 — Account cleanup:
>   Student accounts deleted:    X accounts removed
>   New staff accounts created:  YES/NO
>   Login verified for admin:    YES/NO
>
> tsc --noEmit:   CLEAN / ERRORS
> admin build:    CLEAN / ERRORS
>
> NEW CREDENTIALS:
>   Admin:   admin@canteen.com / Admin@1234
>   Manager: manager.dsce@canteen.com / Manager@1234
>   Staff:   staff.dsce@canteen.com / Staff@1234
> ```

---

## After Running the Prompt

Save these credentials immediately once the agent creates them — keep them somewhere safe before testing anything.
Add this as a new section at the end of the previous prompt:

---

> ## CHANGE 4 — Payment Success Screen (Google Pay style)
>
> **DO NOT touch PaymentScreen.tsx, the payment flow, or any other screen. Only CREATE a new screen and wire it as the navigation destination after successful payment.**
>
> ---
>
> **Create new file: `app/src/screens/PaymentSuccessScreen.tsx`**
>
> Design requirements:
> ```
> 1. Full screen, dark or white clean background
> 2. Animated green checkmark circle — draws itself like Google Pay
>    (use react-native-reanimated for the circle stroke animation)
> 3. "Payment Successful" text fades in after checkmark completes
> 4. Amount paid shown large and bold below that
> 5. Then a card showing:
>    ┌─────────────────────────┐
>    │  Order #ORD-XXXX        │
>    │  ─────────────────────  │
>    │  Student Name           │
>    │  College                │
>    │  ─────────────────────  │
>    │  Item 1 × 2    ₹120     │
>    │  Item 2 × 1    ₹60      │
>    │  ─────────────────────  │
>    │  Total         ₹180     │
>    │  Paid via      Razorpay │
>    │  Time          10:32 AM │
>    └─────────────────────────┘
> 6. QR code shown below the card
>    (use react-native-qrcode-svg, pass qrToken as value)
> 7. "View Orders" button at bottom → navigates to OrdersScreen
> ```
>
> **Animation sequence (use react-native-reanimated):**
> ```
> 0ms:    Screen mounts, everything invisible
> 0-600ms:   Green circle draws itself (stroke animation)
> 400-700ms: Checkmark draws itself inside circle
> 700-900ms: "Payment Successful" fades + slides up
> 900-1100ms: Amount fades in
> 1100-1400ms: Order card slides up from bottom
> 1400-1600ms: QR code fades in
> 1600ms+:  Button appears
> ```
>
> **Color scheme:**
> ```
> Success green: #00C853
> Background: #FFFFFF (light) or #0A0A0A (dark — match app theme)
> Card background: #F8F8F8
> Text primary: #1A1A1A
> Text secondary: #666666
> Amount text: #00C853
> ```
>
> **Screen receives these params from navigation:**
> ```ts
> type PaymentSuccessParams = {
>   orderId: string
>   qrToken: string
>   amount: number        // in rupees
>   items: {
>     name: string
>     quantity: number
>     price: number
>   }[]
>   studentName: string
>   college: string
>   paidAt: string        // ISO timestamp
> }
> ```
>
> **In `PaymentScreen.tsx` — change ONLY the navigation call after successful confirm:**
> Find where it currently navigates after `confirmPayment` succeeds.
> Change that one navigation call to:
> ```ts
> navigation.replace('PaymentSuccess', {
>   orderId: order._id,
>   qrToken: result.qrToken,
>   amount: order.totalAmount,
>   items: order.items.map(i => ({
>     name: i.menuItem.name,
>     quantity: i.quantity,
>     price: i.price
>   })),
>   studentName: user.name,
>   college: user.college,
>   paidAt: new Date().toISOString()
> })
> ```
>
> Use `navigation.replace` not `navigation.navigate` — so pressing back does not go back to payment screen.
>
> **In `Navigation.tsx` — add the new screen:**
> ```ts
> <Stack.Screen
>   name="PaymentSuccess"
>   component={PaymentSuccessScreen}
>   options={{ headerShown: false, gestureEnabled: false }}
> />
> ```
> `gestureEnabled: false` prevents swiping back to payment screen.
>
> **Packages needed — check if already installed before adding:**
> ```bash
> grep "reanimated\|qrcode-svg" app/package.json
> ```
> If missing:
> ```bash
> cd app && npx expo install react-native-reanimated react-native-qrcode-svg
> ```
>
> **RULES for this change:**
> - Only create `PaymentSuccessScreen.tsx`
> - Only change the one navigation call in `PaymentScreen.tsx`
> - Only add the screen to `Navigation.tsx`
> - Nothing else changes
> - No changes to payment logic, API calls, or any other screen
> - If `react-native-reanimated` is already in the project, use the existing version
> - Run `npx tsc --noEmit` after and fix any type errors in the new file only