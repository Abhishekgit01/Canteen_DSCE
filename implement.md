## PROMPT — Fix All Issues

Copy into a fresh conversation:

---

> **READ THIS FULLY BEFORE TOUCHING ANY FILE.**
>
> You have a verification report. Fix exactly what it says, in priority order, one fix at a time. Show diff before applying each fix. Never touch `.env` files — tell me what value to add and I do it myself.
>
> ---
>
> ## FIX 1 — 💀 DEMO KILLER — Add auth header to confirmRazorpayPayment
>
> **File:** `app/src/api/index.ts` around line 188
>
> Find the `confirmRazorpayPayment` function. It uses raw `fetch()` without an Authorization header. This causes 401 every time.
>
> ```diff
> headers: {
>   'Content-Type': 'application/json',
> + 'Authorization': `Bearer ${useAuthStore.getState().token}`,
> },
> ```
>
> Also check: is this function using raw `fetch()` while everything else uses the `api` axios instance? If yes, rewrite it to use the `api` axios instance instead so the JWT interceptor handles the header automatically. Match the pattern used by every other function in that file.
>
> Show me the full function before and after. Verify `useAuthStore` is already imported at the top of the file — if not, add the import.
>
> ---
>
> ## FIX 2 — 💀 DEMO KILLER — Webhook secret placeholder
>
> **File:** `backend/.env` — DO NOT TOUCH THIS FILE
>
> Instead, tell me:
> - What is the current value of `RAZORPAY_WEBHOOK_SECRET` — is it literally `XXXX` or a placeholder?
> - Show me exactly where in the code the webhook secret is used: `grep -n "RAZORPAY_WEBHOOK_SECRET" backend/src/routes/webhook.ts`
>
> Then tell me:
> **"Please set RAZORPAY_WEBHOOK_SECRET in backend/.env to the real secret from your Razorpay dashboard → Settings → Webhooks → your webhook → Secret Key"**
>
> Wait for me to confirm I've set it before continuing to Fix 3.
>
> ---
>
> ## FIX 3 — ❌ BROKEN — Add ownership check to confirm-razorpay
>
> **File:** `backend/src/routes/orders.ts` around line 439
>
> The `confirm-razorpay` route finds the order but does not verify the order belongs to the requesting student. `confirm-mock` and `confirm-upi` both use `findOwnedOrder()` — this route must too.
>
> Find the `findOwnedOrder()` helper in the same file (around line 138-151). Use it here:
>
> ```diff
> - const order = await Order.findOne({ _id: req.params.id, razorpay_order_id })
> + const order = await findOwnedOrder(req.params.id, req.user.id)
> + if (!order) return res.status(404).json({ error: 'Order not found' })
> + if (order.razorpay_order_id !== razorpay_order_id) {
> +   return res.status(400).json({ error: 'Order ID mismatch' })
> + }
> ```
>
> Show me the `findOwnedOrder` function first so I can confirm it does the right thing, then show me the diff.
>
> ---
>
> ## FIX 4 — ⚠️ Socket event name mismatch
>
> **Two files involved:**
>
> First show me:
> ```bash
> grep -n "order:fulfilled\|order:updated\|order:paid" backend/src/routes/orders.ts backend/src/routes/admin.ts
> grep -n "order:fulfilled\|order:updated\|order:paid" app/src/api/socket.ts
> ```
>
> The problem:
> - Backend emits `order:fulfilled` in `orders.ts:543`
> - Mobile listens for `order:updated` in `socket.ts:48`
> - Admin has no `order:updated` emit for status changes
>
> Fix strategy — standardize on these event names everywhere:
> ```
> order:paid       → payment confirmed
> order:updated    → any status change (preparing, ready, etc)
> order:fulfilled  → QR scanned, order collected
> ```
>
> Changes needed:
>
> **In `backend/src/routes/orders.ts`:**
> - When order status changes → emit `order:updated` with `{ orderId, status }`
> - When order fulfilled → emit BOTH `order:fulfilled` AND `order:updated` with `{ orderId, status: 'fulfilled' }`
>
> **In `backend/src/routes/admin.ts`:**
> - When admin updates order status → emit `order:updated` with `{ orderId, status }`
>
> **In `app/src/api/socket.ts`:**
> - Keep existing `order:updated` listener
> - Add `order:fulfilled` listener:
> ```ts
> socket.on('order:fulfilled', ({ orderId }) => {
>   useOrderStore.getState().updateOrder(orderId, { status: 'fulfilled' })
>   // show "Your order is ready! Please collect it 🎉"
> })
> ```
>
> Show diffs for each file separately.
>
> ---
>
> ## FIX 5 — ⚠️ Zombie order cleanup
>
> **File:** `backend/src/routes/orders.ts` or a new scheduler file
>
> Orders stuck in `pending_payment` for more than 15 minutes should be marked `failed`. Add a cleanup job:
>
> ```ts
> // Run every 15 minutes
> setInterval(async () => {
>   const cutoff = new Date(Date.now() - 15 * 60 * 1000)
>   const result = await Order.updateMany(
>     {
>       status: 'pending_payment',
>       createdAt: { $lt: cutoff }
>     },
>     { $set: { status: 'failed' } }
>   )
>   if (result.modifiedCount > 0) {
>     console.log(`Cleaned up ${result.modifiedCount} zombie orders`)
>   }
> }, 15 * 60 * 1000)
> ```
>
> Add this in `backend/src/server.ts` after MongoDB connects — not before, or it will run against a disconnected DB.
>
> ---
>
> ## FIX 6 — ⚠️ LOW RISK — Admin profile route restriction
>
> **File:** `backend/src/routes/admin.ts` around line 65
>
> The `/api/admin/profile` route has auth but no role restriction — any student can hit it.
>
> Find the route and add role check:
> ```diff
> - router.get('/profile', requireAuth, async (req, res) => {
> + router.get('/profile', requireAuth, requireRoles(['staff','manager','admin']), async (req, res) => {
> ```
>
> One line change. Show diff only.
>
> ---
>
> ## AFTER ALL FIXES — Run verification
>
> ```bash
> # TypeScript check
> cd backend && npx tsc --noEmit
>
> # Start backend and test health
> cd backend && npm run dev &
> sleep 5
> curl http://localhost:4000/health
>
> # Test confirm-razorpay returns 401 WITHOUT token (correct)
> curl -X POST http://localhost:4000/api/orders/test123/confirm-razorpay \
>   -H "Content-Type: application/json" \
>   -d '{"razorpay_payment_id":"x","razorpay_order_id":"x","razorpay_signature":"x"}'
> # Expected: 401 (auth required)
>
> # Test confirm-razorpay returns 400 WITH fake token and wrong signature (correct)
> curl -X POST http://localhost:4000/api/orders/test123/confirm-razorpay \
>   -H "Content-Type: application/json" \
>   -H "Authorization: Bearer FAKE_TOKEN" \
>   -d '{"razorpay_payment_id":"x","razorpay_order_id":"x","razorpay_signature":"x"}'
> # Expected: 401 (invalid token) — proves auth is enforced
> ```
>
> Report:
> ```
> Fix 1 auth header:        DONE / FAILED
> Fix 2 webhook secret:     WAITING FOR ME / DONE
> Fix 3 ownership check:    DONE / FAILED
> Fix 4 socket events:      DONE / FAILED
> Fix 5 zombie cleanup:     DONE / FAILED
> Fix 6 admin profile:      DONE / FAILED
> tsc --noEmit:             CLEAN / ERRORS (list them)
> health endpoint:          OK / FAIL
> confirm-razorpay 401:     YES / NO
>
> READY FOR DEMO: YES / NO
> ```
>
> **RULES:**
> - Fix in order 1 → 2 → 3 → 4 → 5 → 6
> - Show diff before every fix
> - Never touch any .env file
> - Never rewrite working code outside these 6 fixes
> - After Fix 2, wait for me to confirm I set the webhook secret before continuing

---

