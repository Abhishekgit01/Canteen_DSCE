CONTEXT — READ THIS ENTIRE SECTION BEFORE TOUCHING ANYTHING
You are working on a college canteen food ordering app called Ybyte Canteen.
This is a real production app being prepared for Play Store and App Store submission.
PROJECT STRUCTURE — CANONICAL FILES ONLY
/app                          ← Main Expo React Native app (SDK 54)
/backend                      ← Express + MongoDB + Socket.io (on Render)
/admin                        ← Vite + React admin panel (on Vercel)
/workers/canteen-payments     ← Cloudflare Worker (payments only)

IGNORE THESE — legacy, not active:
/UI                           ← old web experiments
/android (top level)          ← Capacitor wrapper, not the Expo app
/index.html, /vite.config.ts  ← top level web files, not mobile
LIVE DEPLOYMENT STATUS
Backend:  https://dsce-canteen-backend.onrender.com (verified live)
Worker:   workers/canteen-payments (canteen-payments worker)
Admin:    Vercel
Mobile:   Expo SDK 54, app/ directory
TECH STACK
Mobile:   Expo SDK 54, React Native, TypeScript, Zustand, React Navigation
Backend:  Node.js, Express, MongoDB Atlas, Socket.io, JWT, Resend email
Payment:  Razorpay (test mode) — CF Worker handles webhook + confirm
Auth:     JWT 7d expiry, OTP via email, Google OAuth
Colleges: DSCE (roster lookup), NIE (manual name), legacy DSATM
NAVIGATION STRUCTURE
Unauthenticated:
  Welcome → Auth → Otp → ForgotPassword

Authenticated:
  Main → Search → ItemDetail → Payment →
  OrderQR → OrderSuccess → PaymentSuccess
ROLES
student  → order food, pay, view own orders, review items
staff    → ONLY: view menu, scan QR, view upcoming orders
manager  → staff + manage menu, rush hours, pickup settings,
           send notifications (own college)
admin    → everything across all colleges
PAYMENT FLOW (DO NOT TOUCH)
Mobile → POST /api/orders/create (Render)
Mobile → RazorpayCheckout.open()
Razorpay → POST /webhook (CF Worker)
CF Worker → verifies HMAC → updates Atlas → fires /internal/emit
Mobile → POST /api/orders/:id/confirm-razorpay (CF Worker)
CF Worker → returns { orderId, qrToken }
Mobile → PaymentSuccessScreen
IMPORTANT BACKEND NOTES
- OTP purpose field: 'signup' | 'password_reset'
- AUTH_VERIFICATION_MODE=none disables OTP
- Email via Gmail SMTP (pooled nodemailer transporter)
- Zombie order cleanup runs every 15 min after MongoDB connects
- Order statuses: pending_payment→paid→preparing→ready→fulfilled→failed
- User.college: 'DSCE' | 'NIE' | 'DSATM' (legacy)

READ THE ENTIRE CODEBASE FIRST
bash# Project structure
find . -type f \( -name "*.ts" -o -name "*.tsx" -o -name "*.json" \) \
  | grep -v node_modules | grep -v dist | grep -v .expo \
  | grep -v ".d.ts" | grep -v ".git" | sort

# App config files
cat app/app.json
cat app/eas.json
cat app/package.json
cat app/src/Navigation.tsx
cat app/App.tsx
cat app/src/theme.ts

# All mobile screens
find app/src/screens -name "*.tsx" \
  -exec echo "=== {} ===" \; -exec cat {} \;

# All mobile stores
find app/src/stores -name "*.ts" \
  -exec echo "=== {} ===" \; -exec cat {} \;

# Mobile API
cat app/src/api/index.ts
cat app/src/api/socket.ts

# Backend
cat backend/src/server.ts
cat backend/src/app.ts
cat backend/src/routes/auth.ts
cat backend/src/routes/orders.ts
cat backend/src/routes/admin.ts
cat backend/src/routes/webhook.ts
cat backend/package.json

# Admin
cat admin/src/App.tsx
cat admin/src/api/index.ts
find admin/src/pages -name "*.tsx" \
  -exec echo "=== {} ===" \; -exec cat {} \;

# Worker
cat workers/canteen-payments/src/index.ts
cat workers/canteen-payments/wrangler.toml

# Env examples
cat backend/.env.example
cat app/.env.example 2>/dev/null || echo "MISSING"

# Check permissions declared
grep -n "permissions\|permission" app/app.json

# Check iOS config
grep -n "ios\|bundleIdentifier\|infoPlist" app/app.json

# Check Android config
grep -n "android\|package\|versionCode\|adaptiveIcon" app/app.json

# Check all platform-specific code
grep -rn "Platform.OS\|Platform.select\|ios\|android" \
  app/src/ --include="*.tsx" --include="*.ts" \
  | grep -v node_modules

# Check for any hardcoded URLs
grep -rn "localhost\|onrender.com\|workers.dev" \
  app/src/ --include="*.ts" --include="*.tsx"

# Check staff-specific navigation or screens
grep -rn "staff\|role\|Staff" \
  app/src/ admin/src/ --include="*.tsx" --include="*.ts"
Say "CODEBASE READ COMPLETE" then produce the Phase 1 report below.

PHASE 1 — STORE READINESS AUDIT
Do not fix anything yet. Report only.
CHECK 1 — app.json Completeness
Verify every field against Play Store and App Store requirements:
REQUIRED FOR BOTH STORES:
[ ] expo.name              — not "my-app" or blank
[ ] expo.slug              — lowercase, hyphenated
[ ] expo.version           — semantic e.g. "1.0.0"
[ ] expo.icon              — ./assets/icon.png exists
[ ] expo.splash            — configured with backgroundColor
[ ] expo.orientation       — "portrait" (canteen app)

REQUIRED FOR PLAY STORE (Android):
[ ] expo.android.package       — e.g. com.yourname.canteen
                                 NOT com.example or default
[ ] expo.android.versionCode   — integer, starts at 1
[ ] expo.android.adaptiveIcon  — foregroundImage + backgroundColor
[ ] expo.android.permissions   — only what app needs, nothing extra

REQUIRED FOR APP STORE (iOS):
[ ] expo.ios.bundleIdentifier  — e.g. com.yourname.canteen
                                 must match Android package
[ ] expo.ios.buildNumber       — "1" for first submission
[ ] expo.ios.infoPlist         — camera usage description if using camera
                                 (for QR scanner)

REQUIRED FOR EAS BUILD:
[ ] eas.json exists
[ ] eas.json has "production" profile
[ ] production profile has android.buildType: "aab" (Play Store)
[ ] production profile has ios distribution: "store" (App Store)
Show current values vs required values in a table.

CHECK 2 — Permissions Audit
bash# What permissions are declared
grep -A 30 '"permissions"' app/app.json

# What permissions are actually used in code
grep -rn "Camera\|camera\|Location\|location\|Contacts\|Microphone\|Storage\|WRITE_EXTERNAL" \
  app/src/ --include="*.tsx" --include="*.ts"

# Check expo-camera usage
grep -rn "expo-camera\|BarCodeScanner\|Camera" \
  app/src/ app/package.json
Play Store rejects apps with permissions not justified by features.
Report:
Permission declared | Used in code | Justification | SAFE/RISK
CAMERA              | YES/NO       | QR scan       | SAFE if YES
INTERNET            | YES/NO       | API calls     | Required
[list all others]

CHECK 3 — iOS Compatibility
bash# Check minimum iOS version
grep -n "ios\|deploymentTarget\|supportsTablet" app/app.json

# Check for Android-only APIs used
grep -rn "ToastAndroid\|BackHandler\|PermissionsAndroid" \
  app/src/ --include="*.tsx" --include="*.ts"

# Check for iOS-only APIs used without Platform check
grep -rn "ActionSheetIOS" \y you to USE the app, not OWN it.
You retain all code rights.
If they stop paying, you ca
  app/src/ --include="*.tsx" --include="*.ts"

# Check react-native-razorpay iOS support
grep "react-native-razorpay" app/package.json
Report every Android-only API used without a Platform.OS check.
These will crash on iOS.

CHECK 4 — Payment Compliance
Both stores have strict payment rules:
PLAY STORE PAYMENT RULES:
[ ] If selling digital goods → must use Google Play Billing
    Food ordering is physical goods → Razorpay is allowed ✅
[ ] Payment UI must show clear price before confirming
[ ] No hidden fees (rush hour surcharge must be shown before payment)
[ ] Refund policy must be stated somewhere in app

APP STORE PAYMENT RULES:
[ ] Physical goods/services → third party payment allowed ✅
[ ] Must not mention other payment methods inside app
    e.g. cannot say "also pay via UPI link" if that bypasses Razorpay
[ ] App must work without making a purchase (guest browsing menu)

Check:
- Is menu browsable without login?
- Is rush hour surcharge shown BEFORE payment screen?
- Is there any mention of UPI link payment in active code?
bash# Check for upi_link in active code
grep -rn "upi_link\|upi_payment\|payment_link" \
  app/src/ backend/src/ --include="*.ts" --include="*.tsx"

# Check menu is accessible
grep -n "requireAuth\|isAuthenticated" \
  backend/src/routes/menu.ts

CHECK 5 — Privacy Policy & Legal
Both stores require:
[ ] Privacy policy URL accessible from app
[ ] Privacy policy covers: data collected, how used, who sees it
[ ] Terms of service accessible
[ ] Age verification / 13+ compliance (COPPA)
    College students are 18+ so this is fine
[ ] Data deletion mechanism (user can delete account)

Check:
- Is there a PrivacyPolicyScreen in the app?
- Is there a link to privacy policy on login/signup screen?
- Is there a "Delete my account" option in profile?
bashgrep -rn "privacy\|Privacy\|terms\|Terms\|delete.*account\|deleteAccount" \
  app/src/ --include="*.tsx" --include="*.ts"

CHECK 6 — Content Rating
Play Store content rating questionnaire — your app should answer:
[ ] No violence
[ ] No sexual content
[ ] No gambling
[ ] Food ordering = everyday consumer app
Target rating: Everyone (E) or Teen (T)

App Store age rating:
[ ] 4+ (safest — food app with no user content issues)
    BUT reviews feature = user generated content
    That may require 12+ or content moderation

Check: does review system have moderation?
bashgrep -n "isVisible\|moderat\|flag\|report\|inappropriate" \
  backend/src/routes/reviews.ts 2>/dev/null

CHECK 7 — Security Requirements for Stores
bash# Check for cleartext traffic (Play Store blocks this)
grep -rn "http://" app/src/ --include="*.ts" --include="*.tsx" \
  | grep -v "https://" | grep -v "comment\|//"

# All URLs must be HTTPS
grep -rn "EXPO_PUBLIC" app/.env.example 2>/dev/null
grep -rn "process.env.EXPO_PUBLIC" app/src/ --include="*.ts"

# Check no secrets in app bundle
grep -rn "KEY_SECRET\|key_secret\|MONGO_URI\|JWT_SECRET" \
  app/src/ --include="*.ts" --include="*.tsx"

# Check SSL pinning (nice to have, not required)
grep -rn "ssl\|SSL\|pinning\|certificate" \
  app/src/ --include="*.ts"

CHECK 8 — Expo SDK 54 Compatibility
bash# Check SDK version
grep "expo\"\|\"sdk\"" app/package.json | head -5

# Check for deprecated APIs in SDK 54
grep -rn "FileSystem\|Permissions\|Constants.manifest\b" \
  app/src/ --include="*.ts" --include="*.tsx"

# SDK 54 removed Constants.manifest — must use Constants.expoConfig
grep -rn "Constants.manifest" app/src/ --include="*.ts" --include="*.tsx"

# Check new architecture compatibility
grep -n "newArchEnabled\|newArchitecture" app/app.json

# Check all packages are SDK 54 compatible
npx expo install --check 2>/dev/null || echo "run manually"

CHECK 9 — Build Test
bash# TypeScript must be clean
cd app && npx tsc --noEmit
cd backend && npx tsc --noEmit

# Check for missing assets
ls app/assets/
# Must have: icon.png, splash.png, adaptive-icon.png

# Check asset dimensions
identify app/assets/icon.png 2>/dev/null \
  || file app/assets/icon.png
# icon.png must be 1024x1024
# adaptive-icon.png must be 1024x1024
# splash.png ideally 1284x2778 or larger

# Expo doctor
cd app && npx expo-doctor 2>/dev/null || echo "run manually"

PHASE 1 REPORT FORMAT
Give me this exact table:
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
PLAY STORE + APP STORE READINESS REPORT
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

CHECK 1 — app.json:
  android.package:          [current value] → PASS/FAIL
  android.versionCode:      [current value] → PASS/FAIL
  android.adaptiveIcon:     CONFIGURED/MISSING
  ios.bundleIdentifier:     [current value] → PASS/FAIL
  ios.buildNumber:          [current value] → PASS/FAIL
  ios.infoPlist camera:     PRESENT/MISSING
  eas.json production:      EXISTS/MISSING

CHECK 2 — Permissions:
  [list each permission: declared, used, safe/risk]

CHECK 3 — iOS Compatibility:
  Android-only APIs without Platform check: [list or NONE]
  react-native-razorpay iOS support: YES/NO/UNKNOWN
  Crashes on iOS: [list scenarios or NONE]

CHECK 4 — Payment Compliance:
  Food = physical goods (Razorpay allowed): ✅
  Rush hour surcharge shown before payment: YES/NO
  UPI link code still in app: YES/NO
  Menu browsable without login: YES/NO

CHECK 5 — Privacy & Legal:
  Privacy policy screen: EXISTS/MISSING
  Delete account option: EXISTS/MISSING
  Login screen has privacy link: YES/NO

CHECK 6 — Content Rating:
  User-generated content (reviews): YES
  Review moderation system: YES/NO
  Recommended rating: [Everyone/Teen/12+]

CHECK 7 — Security:
  HTTP (non-HTTPS) URLs in code: [list or NONE]
  Secrets in app bundle: [list or NONE]

CHECK 8 — SDK 54:
  Constants.manifest usage: [list files or NONE]
  Deprecated APIs: [list or NONE]
  New arch enabled: YES/NO

CHECK 9 — Build:
  app tsc --noEmit: CLEAN/X errors
  backend tsc --noEmit: CLEAN/X errors
  icon.png 1024x1024: YES/NO
  adaptive-icon exists: YES/NO

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
PLAY STORE READY: YES / NO
APP STORE READY: YES / NO

BLOCKERS (must fix before submission):
[numbered list]

WARNINGS (fix soon but won't block):
[numbered list]
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
STOP. Show me Phase 1 report.
Wait for me to say "proceed to Phase 2" before fixing anything.

PHASE 2 — FIX STAFF UI
Only start after I approve Phase 1 report.
Context
Staff role should be extremely simple.
They are canteen workers, not tech-savvy admins.
They need exactly 3 things and nothing else:
1. Menu      — see what's available today
2. Scan      — scan student QR to fulfill order
3. Orders    — see upcoming/pending orders with full details
Read staff-related code first
bash# How is role-based navigation currently handled?
grep -rn "role\|staff\|Staff\|manager\|admin" \
  app/src/Navigation.tsx app/App.tsx \
  --include="*.tsx" --include="*.ts"

# What screens exist for staff currently?
grep -rn "staff\|Staff" \
  app/src/ --include="*.tsx" --include="*.ts"

# Admin panel staff screens
grep -rn "staff\|Staff\|role" \
  admin/src/ --include="*.tsx" --include="*.ts"

# How does auth store expose role?
grep -n "role\|user" app/src/stores/authStore.ts
Fix — Staff Navigation
In app/src/Navigation.tsx:
Detect role after login and render different navigator:
tsximport { useAuthStore } from './stores/authStore'

export default function Navigation() {
  const { user, token } = useAuthStore()

  if (!token) return <AuthStack />

  // Staff gets completely different simple UI
  if (user?.role === 'staff') return <StaffStack />

  // Students get full app
  return <StudentStack />
}
Create app/src/navigation/StaffNavigator.tsx:
tsximport React from 'react'
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs'
import { Text, View } from 'react-native'
import StaffMenuScreen from '../screens/staff/StaffMenuScreen'
import StaffScanScreen from '../screens/staff/StaffScanScreen'
import StaffOrdersScreen from '../screens/staff/StaffOrdersScreen'

const Tab = createBottomTabNavigator()

export default function StaffNavigator() {
  return (
    <Tab.Navigator
      screenOptions={{
        tabBarActiveTintColor: '#00C853',
        tabBarInactiveTintColor: '#999',
        tabBarStyle: {
          paddingBottom: 8,
          paddingTop: 4,
          height: 64
        },
        headerStyle: { backgroundColor: '#00C853' },
        headerTintColor: '#fff',
        headerTitleStyle: { fontWeight: '700' }
      }}
    >
      <Tab.Screen
        name="StaffOrders"
        component={StaffOrdersScreen}
        options={{
          title: 'Orders',
          tabBarLabel: 'Orders',
          tabBarIcon: ({ color }) => (
            <Text style={{ fontSize: 22 }}>📋</Text>
          ),
          headerTitle: 'Upcoming Orders'
        }}
      />
      <Tab.Screen
        name="StaffScan"
        component={StaffScanScreen}
        options={{
          title: 'Scan',
          tabBarLabel: 'Scan QR',
          tabBarIcon: ({ color }) => (
            <Text style={{ fontSize: 22 }}>📷</Text>
          ),
          headerTitle: 'Scan QR Code'
        }}
      />
      <Tab.Screen
        name="StaffMenu"
        component={StaffMenuScreen}
        options={{
          title: 'Menu',
          tabBarLabel: 'Menu',
          tabBarIcon: ({ color }) => (
            <Text style={{ fontSize: 22 }}>🍱</Text>
          ),
          headerTitle: "Today's Menu"
        }}
      />
    </Tab.Navigator>
  )
}
Create Staff Screens
Create app/src/screens/staff/StaffOrdersScreen.tsx:
tsx// Shows all paid/preparing/ready orders for the college
// Sorted by: scheduled orders first, then by time placed
// Auto-refreshes every 30 seconds + socket updates

// Each order card shows:
// ┌─────────────────────────────────────────┐
// │  #ORD-1234          🟡 PREPARING       │
// │  ─────────────────────────────────────  │
// │  👤 Rahul Kumar — DSCE                  │
// │  📱 9876543210                          │
// │  ─────────────────────────────────────  │
// │  📅 SCHEDULED: Tomorrow 12:30 PM        │  (only if pre-order)
// │  ─────────────────────────────────────  │
// │  ITEMS:                                 │
// │  • Masala Dosa × 2                      │
// │  • Filter Coffee × 1                   │
// │    📝 Extra strong                      │  (chef note)
// │  ─────────────────────────────────────  │
// │  Total: ₹180     Paid: Razorpay ✅      │
// │  Ordered: 10:32 AM                      │
// │  ─────────────────────────────────────  │
// │  [Mark Preparing] [Mark Ready]          │
// └─────────────────────────────────────────┘

// Status badge colors:
// paid      → blue  "PAID — Start Preparing"
// preparing → yellow "PREPARING"
// ready     → green "READY FOR PICKUP"

// Filter tabs at top:
// [All] [Paid] [Preparing] [Ready] [Pre-Orders]

import React, { useEffect, useState, useCallback } from 'react'
import {
  View, Text, FlatList, TouchableOpacity,
  StyleSheet, RefreshControl, Alert
} from 'react-native'
import { useAuthStore } from '../../stores/authStore'
import { socket } from '../../api/socket'

const STATUS_COLORS: Record<string, string> = {
  paid:       '#1565C0',
  preparing:  '#E65100',
  ready:      '#2E7D32',
  fulfilled:  '#757575'
}

const STATUS_LABELS: Record<string, string> = {
  paid:       '💳 PAID',
  preparing:  '👨‍🍳 PREPARING',
  ready:      '✅ READY',
  fulfilled:  '✅ COLLECTED'
}

export default function StaffOrdersScreen() {
  const { user, token } = useAuthStore()
  const [orders, setOrders] = useState<any[]>([])
  const [filter, setFilter] = useState<string>('active')
  const [refreshing, setRefreshing] = useState(false)

  const fetchOrders = useCallback(async () => {
    try {
      const res = await fetch(
        `${process.env.EXPO_PUBLIC_API_URL}/api/orders?college=${user?.college}&staffView=true`,
        { headers: { Authorization: `Bearer ${token}` } }
      )
      const data = await res.json()
      // Sort: pre-orders first, then by createdAt
      const sorted = (data.orders ?? data).sort((a: any, b: any) => {
        if (a.isPreOrder && !b.isPreOrder) return -1
        if (!a.isPreOrder && b.isPreOrder) return 1
        return new Date(a.createdAt).getTime() -
               new Date(b.createdAt).getTime()
      })
      setOrders(sorted)
    } catch (err) {
      console.error('Failed to fetch orders:', err)
    }
  }, [user?.college, token])

  useEffect(() => {
    fetchOrders()

    // Auto-refresh every 30 seconds
    const interval = setInterval(fetchOrders, 30000)

    // Real-time socket updates
    socket.on('order:new', () => fetchOrders())
    socket.on('order:updated', () => fetchOrders())
    socket.on('order:paid', () => fetchOrders())

    return () => {
      clearInterval(interval)
      socket.off('order:new')
      socket.off('order:updated')
      socket.off('order:paid')
    }
  }, [fetchOrders])

  const updateStatus = async (orderId: string, status: string) => {
    try {
      await fetch(
        `${process.env.EXPO_PUBLIC_API_URL}/api/orders/${orderId}/status`,
        {
          method: 'PATCH',
          headers: {
            Authorization: `Bearer ${token}`,
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({ status })
        }
      )
      fetchOrders()
    } catch {
      Alert.alert('Error', 'Failed to update order status')
    }
  }

  const FILTERS = [
    { key: 'active', label: 'Active' },
    { key: 'paid', label: '💳 Paid' },
    { key: 'preparing', label: '👨‍🍳 Preparing' },
    { key: 'ready', label: '✅ Ready' },
    { key: 'preorder', label: '📅 Pre-Orders' }
  ]

  const filteredOrders = orders.filter(o => {
    if (filter === 'active') {
      return ['paid','preparing','ready'].includes(o.status)
    }
    if (filter === 'preorder') return o.isPreOrder
    return o.status === filter
  })

  const renderOrder = ({ item: order }: any) => (
    <View style={styles.card}>
      {/* Header */}
      <View style={styles.cardHeader}>
        <Text style={styles.orderId}>
          #{order._id?.slice(-6).toUpperCase()}
        </Text>
        <View style={[styles.statusBadge, {
          backgroundColor: STATUS_COLORS[order.status] ?? '#999'
        }]}>
          <Text style={styles.statusText}>
            {STATUS_LABELS[order.status] ?? order.status}
          </Text>
        </View>
      </View>

      {/* Pre-order banner */}
      {order.isPreOrder && order.scheduledFor && (
        <View style={styles.preOrderBanner}>
          <Text style={styles.preOrderText}>
            📅 SCHEDULED: {formatDateTime(order.scheduledFor)}
          </Text>
        </View>
      )}

      <View style={styles.divider} />

      {/* Student details */}
      <View style={styles.studentRow}>
        <Text style={styles.studentName}>
          👤 {order.student?.name ?? 'Unknown'}
        </Text>
        <Text style={styles.studentCollege}>
          {order.student?.college}
        </Text>
      </View>
      {order.student?.phone && (
        <Text style={styles.studentPhone}>
          📱 {order.student.phone}
        </Text>
      )}
      {order.student?.usn && (
        <Text style={styles.studentUsn}>
          🎓 {order.student.usn}
        </Text>
      )}

      <View style={styles.divider} />

      {/* Order items */}
      <Text style={styles.itemsLabel}>ITEMS:</Text>
      {(order.items ?? []).map((item: any, idx: number) => (
        <View key={idx} style={styles.itemRow}>
          <Text style={styles.itemName}>
            • {item.menuItem?.name ?? 'Item'} × {item.quantity}
          </Text>
          <Text style={styles.itemPrice}>
            ₹{(item.price * item.quantity).toFixed(0)}
          </Text>
          {item.chefNote ? (
            <View style={styles.chefNote}>
              <Text style={styles.chefNoteText}>
                📝 {item.chefNote}
              </Text>
            </View>
          ) : null}
        </View>
      ))}

      <View style={styles.divider} />

      {/* Payment info */}
      <View style={styles.paymentRow}>
        <Text style={styles.totalText}>
          Total: ₹{order.totalAmount?.toFixed(0)}
        </Text>
        <Text style={styles.paidBadge}>Paid ✅</Text>
      </View>
      <Text style={styles.orderTime}>
        Ordered: {formatTime(order.createdAt)}
      </Text>

      {/* Action buttons */}
      <View style={styles.actionsRow}>
        {order.status === 'paid' && (
          <TouchableOpacity
            style={[styles.actionBtn, { backgroundColor: '#E65100' }]}
            onPress={() => updateStatus(order._id, 'preparing')}
          >
            <Text style={styles.actionBtnText}>
              Start Preparing 👨‍🍳
            </Text>
          </TouchableOpacity>
        )}
        {order.status === 'preparing' && (
          <TouchableOpacity
            style={[styles.actionBtn, { backgroundColor: '#2E7D32' }]}
            onPress={() => updateStatus(order._id, 'ready')}
          >
            <Text style={styles.actionBtnText}>
              Mark Ready ✅
            </Text>
          </TouchableOpacity>
        )}
      </View>
    </View>
  )

  return (
    <View style={styles.container}>
      {/* Filter tabs */}
      <View style={styles.filterRow}>
        {FILTERS.map(f => (
          <TouchableOpacity
            key={f.key}
            style={[styles.filterBtn,
              filter === f.key && styles.filterBtnActive]}
            onPress={() => setFilter(f.key)}
          >
            <Text style={[styles.filterText,
              filter === f.key && styles.filterTextActive]}>
              {f.label}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      {/* Order count */}
      <Text style={styles.orderCount}>
        {filteredOrders.length} order{filteredOrders.length !== 1 ? 's' : ''}
      </Text>

      <FlatList
        data={filteredOrders}
        keyExtractor={o => o._id}
        renderItem={renderOrder}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={async () => {
              setRefreshing(true)
              await fetchOrders()
              setRefreshing(false)
            }}
            colors={['#00C853']}
          />
        }
        ListEmptyComponent={() => (
          <View style={styles.empty}>
            <Text style={styles.emptyIcon}>🎉</Text>
            <Text style={styles.emptyText}>
              No {filter} orders right now
            </Text>
          </View>
        )}
      />
    </View>
  )
}

const formatDateTime = (iso: string) => {
  const d = new Date(iso)
  return d.toLocaleDateString('en-IN', {
    day: 'numeric', month: 'short',
    hour: '2-digit', minute: '2-digit'
  })
}

const formatTime = (iso: string) => {
  return new Date(iso).toLocaleTimeString('en-IN', {
    hour: '2-digit', minute: '2-digit', hour12: true
  })
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F5F5F5' },
  filterRow: { flexDirection: 'row', padding: 12,
    backgroundColor: '#fff', gap: 8, flexWrap: 'wrap' },
  filterBtn: { paddingHorizontal: 12, paddingVertical: 6,
    borderRadius: 16, borderWidth: 1.5,
    borderColor: '#E0E0E0', backgroundColor: '#F8F8F8' },
  filterBtnActive: { borderColor: '#00C853',
    backgroundColor: '#E8F5E9' },
  filterText: { fontSize: 12, color: '#666' },
  filterTextActive: { color: '#00C853', fontWeight: '700' },
  orderCount: { padding: 12, color: '#999',
    fontSize: 13, backgroundColor: '#F5F5F5' },
  card: { backgroundColor: '#fff', margin: 12,
    marginTop: 0, borderRadius: 12, padding: 16,
    elevation: 2, shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.08, shadowRadius: 4 },
  cardHeader: { flexDirection: 'row',
    justifyContent: 'space-between', alignItems: 'center' },
  orderId: { fontWeight: '800', fontSize: 16, color: '#1A1A1A' },
  statusBadge: { paddingHorizontal: 10, paddingVertical: 4,
    borderRadius: 12 },
  statusText: { color: '#fff', fontWeight: '700', fontSize: 12 },
  preOrderBanner: { backgroundColor: '#EDE7F6',
    borderRadius: 8, padding: 8, marginTop: 8 },
  preOrderText: { color: '#4527A0', fontWeight: '700', fontSize: 13 },
  divider: { height: 1, backgroundColor: '#F0F0F0',
    marginVertical: 10 },
  studentRow: { flexDirection: 'row',
    justifyContent: 'space-between', alignItems: 'center' },
  studentName: { fontWeight: '700', fontSize: 15, color: '#1A1A1A' },
  studentCollege: { color: '#00C853', fontWeight: '600',
    fontSize: 12 },
  studentPhone: { color: '#555', fontSize: 13, marginTop: 2 },
  studentUsn: { color: '#888', fontSize: 12, marginTop: 1 },
  itemsLabel: { fontWeight: '700', color: '#333',
    fontSize: 13, marginBottom: 6 },
  itemRow: { marginBottom: 6 },
  itemName: { fontSize: 14, color: '#333' },
  itemPrice: { color: '#666', fontSize: 13 },
  chefNote: { backgroundColor: '#FFFDE7',
    borderLeftWidth: 3, borderLeftColor: '#FDD835',
    borderRadius: 4, padding: 6, marginTop: 4 },
  chefNoteText: { color: '#555', fontSize: 12,
    fontStyle: 'italic' },
  paymentRow: { flexDirection: 'row',
    justifyContent: 'space-between', alignItems: 'center' },
  totalText: { fontWeight: '700', fontSize: 16, color: '#1A1A1A' },
  paidBadge: { color: '#2E7D32', fontWeight: '600' },
  orderTime: { color: '#999', fontSize: 12, marginTop: 2 },
  actionsRow: { marginTop: 12, gap: 8 },
  actionBtn: { padding: 14, borderRadius: 10,
    alignItems: 'center' },
  actionBtnText: { color: '#fff', fontWeight: '700',
    fontSize: 15 },
  empty: { alignItems: 'center', padding: 60 },
  emptyIcon: { fontSize: 48, marginBottom: 12 },
  emptyText: { color: '#999', fontSize: 16 }
})
Create app/src/screens/staff/StaffMenuScreen.tsx:
tsx// Read-only menu view for staff
// Shows all menu items for their college
// Staff can toggle availability (if backend allows staff to do this)
// Simple flat list, no cart functionality
// Shows: item name, price, category, available/unavailable badge
// Add search bar at top to quickly find items

// Each item card:
// ┌──────────────────────────────────┐
// │ 🍱 Masala Dosa         ₹60      │
// │ South Indian • Available ✅     │
// │ [Mark Unavailable]              │
// └──────────────────────────────────┘

// Keep it simple — no images needed for staff view
// Large text, easy to read in kitchen environment
Create app/src/screens/staff/StaffScanScreen.tsx:
tsx// QR scanner screen for staff
// Uses expo-camera or expo-barcode-scanner
// On successful scan:
//   1. Show order details
//   2. Confirm it's the right student
//   3. Mark as fulfilled

// This screen likely already exists as QR scan in admin
// Find the existing QR scan logic and reuse it
// Look for: grep -rn "scan\|Scan\|barcode\|BarCode" admin/src/ app/src/

// If existing scan logic found — import and reuse
// If not found — create using expo-camera:

import { CameraView, useCameraPermissions } from 'expo-camera'

// On scan:
// 1. Call POST /api/orders/:id/fulfill with { qrToken }
// 2. Show success: student name + items collected
// 3. Play success sound/vibration
// 4. Reset scanner for next student

// Error states:
// - Already fulfilled: "This order was already collected"
// - Invalid QR: "Invalid QR code"
// - Expired QR: "QR code has expired"
Wire Staff Navigator into main Navigation
In app/src/Navigation.tsx:
tsximport StaffNavigator from './navigation/StaffNavigator'

// In root navigator logic:
const { user, token } = useAuthStore()

if (!token) return <AuthNavigator />

// Role-based routing
switch(user?.role) {
  case 'staff':
    return <StaffNavigator />
  case 'manager':
  case 'admin':
    // Managers/admins use full admin panel (web)
    // or show an "Access admin panel at [URL]" screen
    return <AdminAccessScreen />
  default:
    return <StudentNavigator />
}
Create app/src/screens/staff/AdminAccessScreen.tsx:
tsx// Shown when manager or admin logs into mobile app
// Simple screen saying:
// "You're logged in as [Manager/Admin]"
// "For full management, use the admin panel:"
// [Open Admin Panel] button → opens browser to admin URL
// Below that: same 3 staff tabs (orders, scan, menu)
// So managers can still do basic floor operations

AFTER ALL FIXES — Verify
bashcd app && npx tsc --noEmit
cd backend && npx tsc --noEmit
cd admin && npm run build

# Test staff navigation
# Login with staff credentials → should see 3 tabs only
# Login with student credentials → should see full student app
# Login with manager → should see admin access screen + 3 tabs

FINAL REPORT
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
PHASE 2 — STAFF UI REPORT
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

Staff navigator created:          YES/NO
StaffOrdersScreen created:        YES/NO
StaffScanScreen created:          YES/NO
StaffMenuScreen created:          YES/NO
Role-based navigation wired:      YES/NO
Order shows student name:         YES/NO
Order shows student phone:        YES/NO
Order shows scheduled time:       YES/NO
Order shows chef notes:           YES/NO
Order shows paid status:          YES/NO
Status update buttons work:       YES/NO
Real-time socket updates:         YES/NO
Auto-refresh every 30s:           YES/NO

tsc --noEmit app:    CLEAN/ERRORS
tsc --noEmit backend: CLEAN/ERRORS
admin build:          CLEAN/ERRORS
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
ABSOLUTE RULES:

Never touch payment flow, webhook, QR generation, Razorpay
Never touch .env files
Never touch working student order flow
Show diff before every change
One file at a time
Run tsc after every file changed
Phase 2 only starts after I approve Phase 1 report