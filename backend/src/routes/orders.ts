import { Router, Request, Response, NextFunction } from 'express';
import crypto from 'crypto';
import jwt from 'jsonwebtoken';
import mongoose from 'mongoose';
import { resolveCollege, type SupportedCollege } from '../config/college.js';
import { io } from '../server.js';
import { MenuItem, Order, User } from '../models/index.js';
import { createRazorpayOrder, initiatePayment } from '../services/payment.service.js';
import { finalizeOrder, finalizePaidOrder } from '../services/order-payment.service.js';
import {
  NotificationTemplates,
  sendPushNotification,
} from '../services/notification.service.js';
import {
  calculateEstimatedPickup,
  getPickupRuntimeSettings,
} from '../services/pickup-settings.service.js';
import { serializeOrder } from '../utils/order.utils.js';
import { getPaymentMode, PaymentMode } from '../utils/paymentMode.js';
import { isPickupTimeAllowed } from '../utils/pickupTime.js';
import { hashQrToken, verifyQrToken } from '../utils/qrToken.js';

const router = Router();
const JWT_SECRET = process.env.JWT_SECRET;
if (!JWT_SECRET) throw new Error('JWT_SECRET is not set in environment variables');

type UserRole = 'student' | 'staff' | 'manager' | 'admin';

interface AuthenticatedRequest extends Request {
  user?: {
    id: string;
    role: UserRole;
    college: SupportedCollege;
  };
}

type CreateOrderBody = {
  items?: Array<{
    menuItemId?: string;
    id?: string;
    _id?: string;
    menuItem?: {
      id?: string;
      _id?: string;
    };
    quantity?: number | string;
    tempPreference?: 'cold' | 'normal' | 'hot' | string;
    chefNote?: string;
  }>;
  scheduledTime?: string;
};

function requireRoles(roles: UserRole[]) {
  return (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    if (!req.user || !roles.includes(req.user.role)) {
      return res.status(403).json({ error: 'Not authorized' });
    }

    next();
  };
}

async function requireAuth(req: AuthenticatedRequest, res: Response, next: NextFunction) {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader?.startsWith('Bearer ')) {
      return res.status(401).json({ error: 'No token provided' });
    }

    const token = authHeader.split(' ')[1];
    const decoded = jwt.verify(token, JWT_SECRET as string) as unknown as { id: string };
    const user = await User.findById(decoded.id).select('_id role college').lean();

    if (!user) {
      return res.status(401).json({ error: 'User not found' });
    }

    req.user = {
      id: String(user._id),
      role: user.role as UserRole,
      college: resolveCollege(user.college),
    };

    next();
  } catch {
    return res.status(401).json({ error: 'Invalid token' });
  }
}

function getReadableError(error: unknown) {
  if (error instanceof Error && error.message) {
    return error.message;
  }

  return 'Unexpected error';
}

function getPaymentConfigResponse() {
  const mode = getPaymentMode();

  return {
    mode,
    canteenUpiId: mode === 'upi_link' ? process.env.CANTEEN_UPI_ID || 'canteen@upi' : undefined,
    canteenName: mode === 'upi_link' ? process.env.CANTEEN_NAME || 'Campus+Canteen' : undefined,
  };
}

function getDefaultScheduledTime() {
  const slot = new Date();
  slot.setMinutes(slot.getMinutes() + 15);
  const hours = slot.getHours().toString().padStart(2, '0');
  const minutes = slot.getMinutes().toString().padStart(2, '0');
  return `${hours}:${minutes}`;
}

function getRequestedMenuItemId(item: NonNullable<CreateOrderBody['items']>[number]) {
  const candidates = [
    item.menuItemId,
    item.id,
    item._id,
    item.menuItem?.id,
    item.menuItem?._id,
  ];

  for (const candidate of candidates) {
    if (typeof candidate === 'string' && candidate.trim()) {
      return candidate.trim();
    }
  }

  return '';
}

function getRequestedQuantity(value: unknown) {
  const quantity = Number(value);
  return Number.isFinite(quantity) ? Math.floor(quantity) : NaN;
}

function getRequestedTempPreference(value: unknown) {
  if (typeof value !== 'string') {
    return undefined;
  }

  const normalizedValue = value.trim().toLowerCase();
  if (normalizedValue === 'cold' || normalizedValue === 'normal' || normalizedValue === 'hot') {
    return normalizedValue;
  }

  return undefined;
}

function sanitizeChefNote(value: unknown) {
  if (typeof value !== 'string') {
    return '';
  }

  return value.replace(/<[^>]*>/g, '').slice(0, 200).trim();
}

async function findOwnedOrder(orderId: string, userId: string) {
  const order = await Order.findById(orderId).select('+qrTokenHash');

  if (!order) {
    return null;
  }

  if (String(order.userId) !== userId) {
    return false;
  }

  return order;
}

function applyPaymentMethod(order: any, mode: PaymentMode) {
  order.paymentMethod = mode;
}

function isRazorpayOrderCreationError(error: unknown) {
  if (!error || typeof error !== 'object' || !('code' in error)) {
    return false;
  }

  const code = (error as { code?: unknown }).code;
  return code === 'RAZORPAY_CONFIG_MISSING' || code === 'RAZORPAY_ORDER_CREATE_FAILED';
}

function signaturesMatch(expected: string, received: string) {
  const expectedBuffer = Buffer.from(expected);
  const receivedBuffer = Buffer.from(received);

  if (expectedBuffer.length !== receivedBuffer.length) {
    return false;
  }

  return crypto.timingSafeEqual(expectedBuffer, receivedBuffer);
}

function verifyRazorpayPaymentSignature(
  razorpayOrderId: string,
  razorpayPaymentId: string,
  signature: string,
) {
  const keySecret = process.env.RAZORPAY_KEY_SECRET;
  if (!keySecret) {
    return false;
  }

  const payload = `${razorpayOrderId}|${razorpayPaymentId}`;
  const expected = crypto.createHmac('sha256', keySecret).update(payload).digest('hex');
  return signaturesMatch(expected, signature);
}

router.get('/payment-config', requireAuth, (_req: AuthenticatedRequest, res: Response) => {
  res.json(getPaymentConfigResponse());
});

router.get('/my', requireAuth, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const orders = await Order.find({ userId: req.user!.id }).sort({ createdAt: -1 }).lean();
    res.json(orders.map((order) => serializeOrder(order)));
  } catch {
    res.status(500).json({ error: 'Failed to fetch orders' });
  }
});

router.get('/:id', requireAuth, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const order = await Order.findById(req.params.id).select('+qrTokenHash').lean();

    if (!order) {
      return res.status(404).json({ error: 'Order not found' });
    }

    const isOwner = String(order.userId) === req.user!.id;
    const isStaff = req.user!.role !== 'student';

    if (!isOwner && !isStaff) {
      return res.status(403).json({ error: 'Not authorized' });
    }

    res.json(serializeOrder(order, { includeQrToken: isOwner }));
  } catch {
    res.status(500).json({ error: 'Failed to fetch order' });
  }
});

router.post(
  '/create',
  requireAuth,
  requireRoles(['student']),
  async (req: AuthenticatedRequest, res: Response) => {
    let order: any = null;

    try {
      const { items, scheduledTime } = req.body as CreateOrderBody;
      const college = req.user!.college;
      const resolvedScheduledTime =
        typeof scheduledTime === 'string' && scheduledTime.trim()
          ? scheduledTime.trim()
          : getDefaultScheduledTime();

      if (!Array.isArray(items) || items.length === 0) {
        return res.status(400).json({ error: 'At least one item is required' });
      }

      const pickupRuntime = await getPickupRuntimeSettings(college);
      if (!pickupRuntime.isCurrentlyOpen) {
        return res.status(400).json({
          error: pickupRuntime.closedMessage || `${college} canteen is currently closed`,
        });
      }

      if (!(await isPickupTimeAllowed(resolvedScheduledTime, college))) {
        return res.status(400).json({ error: `Pickup time is outside the ${college} canteen window` });
      }

      const orderItems = [];
      let totalAmount = 0;

      for (const item of items) {
        const requestedMenuItemId = getRequestedMenuItemId(item);
        const requestedQuantity = getRequestedQuantity(item.quantity);
        const requestedTempPreference = getRequestedTempPreference(item.tempPreference);

        if (!requestedMenuItemId || !requestedQuantity || requestedQuantity < 1) {
          return res.status(400).json({ error: 'Invalid order item' });
        }

        const menuItem = await MenuItem.findById(requestedMenuItemId);
        if (!menuItem || !menuItem.isAvailable || resolveCollege(menuItem.college) !== college) {
          return res.status(400).json({ error: 'One or more items are unavailable' });
        }

        if (
          typeof item.tempPreference === 'string' &&
          menuItem.tempOptions.length > 0 &&
          !requestedTempPreference
        ) {
          return res.status(400).json({ error: `Invalid temperature for ${menuItem.name}` });
        }

        if (
          requestedTempPreference &&
          menuItem.tempOptions.length > 0 &&
          !menuItem.tempOptions.includes(requestedTempPreference)
        ) {
          return res.status(400).json({ error: `Invalid temperature for ${menuItem.name}` });
        }

        totalAmount += menuItem.price * requestedQuantity;
        orderItems.push({
          menuItemId: menuItem._id,
          name: menuItem.name,
          price: menuItem.price,
          quantity: requestedQuantity,
          tempPreference: requestedTempPreference,
          chefNote: sanitizeChefNote(item.chefNote),
        });
      }

      order = await Order.create({
        userId: req.user!.id,
        items: orderItems,
        scheduledTime: resolvedScheduledTime,
        totalAmount: Number(totalAmount.toFixed(2)),
        status: 'pending_payment',
        paymentStatus: 'pending',
        college,
      });

      const totalItemCount = orderItems.reduce((sum, item) => sum + item.quantity, 0);
      const { estimatedPickupAt, estimatedPickupMinutes } = await calculateEstimatedPickup(
        college,
        totalItemCount,
      );

      order.estimatedPickupMinutes = estimatedPickupMinutes;
      order.estimatedPickupAt = estimatedPickupAt;

      if (getPaymentMode() === 'razorpay') {
        const razorpay = await createRazorpayOrder(
          Math.round(order.totalAmount * 100),
          String(order._id),
        );

        applyPaymentMethod(order, 'razorpay');
        order.razorpayOrderId = razorpay.razorpay_order_id;
        await order.save();

        return res.status(201).json({
          order: serializeOrder(order),
          razorpay,
        });
      }

      const payment = await initiatePayment(order);
      applyPaymentMethod(order, payment.mode);

      await order.save();

      res.status(201).json(payment);
    } catch (error) {
      if (order?._id) {
        await Order.findByIdAndDelete(order._id).catch(() => undefined);
      }

      if (isRazorpayOrderCreationError(error)) {
        console.error('Failed to create Razorpay order', error);
        return res.status(502).json({ error: 'Payment gateway unavailable' });
      }

      res.status(500).json({ error: `Failed to create order: ${getReadableError(error)}` });
    }
  },
);

router.post(
  '/confirm-mock',
  requireAuth,
  requireRoles(['student']),
  async (req: AuthenticatedRequest, res: Response) => {
    try {
      const paymentMode = getPaymentMode();

      if (process.env.NODE_ENV === 'production' && paymentMode !== 'mock') {
        return res.status(403).json({ error: 'Mock confirmation is disabled' });
      }

      if (paymentMode !== 'mock') {
        return res.status(403).json({ error: 'Mock payments are not active' });
      }

      const { orderId, transactionId } = req.body as {
        orderId?: string;
        transactionId?: string;
      };

      if (!orderId || !transactionId || !transactionId.startsWith('MOCK_')) {
        return res.status(400).json({ error: 'Invalid mock transaction' });
      }

      const order = await findOwnedOrder(orderId, req.user!.id);
      if (order === null) {
        return res.status(404).json({ error: 'Order not found' });
      }

      if (order === false) {
        return res.status(403).json({ error: 'Not authorized' });
      }

      if (order.status !== 'pending_payment') {
        return res.status(400).json({ error: 'Order is not awaiting payment' });
      }

      await finalizePaidOrder(order, {
        paymentMethod: 'mock',
        razorpayPaymentId: transactionId,
      });

      res.json({ success: true, orderId: String(order._id) });
    } catch {
      res.status(500).json({ error: 'Failed to confirm mock payment' });
    }
  },
);

router.post(
  '/confirm-upi',
  requireAuth,
  requireRoles(['student']),
  async (req: AuthenticatedRequest, res: Response) => {
    try {
      if (getPaymentMode() !== 'upi_link') {
        return res.status(403).json({ error: 'UPI link payments are not active' });
      }

      const { orderId, upiTransactionId } = req.body as {
        orderId?: string;
        upiTransactionId?: string;
      };

      const normalizedTransactionId = String(upiTransactionId || '').trim();
      if (!orderId || !/^\d{8,}$/.test(normalizedTransactionId)) {
        return res.status(400).json({ error: 'Enter a valid UPI transaction ID' });
      }

      const duplicate = await Order.findOne({
        upiTransactionId: normalizedTransactionId,
        _id: { $ne: orderId },
      }).select('_id');

      if (duplicate) {
        return res.status(400).json({ error: 'This UPI transaction ID has already been used' });
      }

      const order = await findOwnedOrder(orderId, req.user!.id);
      if (order === null) {
        return res.status(404).json({ error: 'Order not found' });
      }

      if (order === false) {
        return res.status(403).json({ error: 'Not authorized' });
      }

      if (order.status !== 'pending_payment') {
        return res.status(400).json({ error: 'Order is not awaiting payment' });
      }

      await finalizePaidOrder(order, {
        paymentMethod: 'upi_link',
        upiTransactionId: normalizedTransactionId,
      });

      res.json({ success: true, orderId: String(order._id) });
    } catch {
      res.status(500).json({ error: 'Failed to confirm UPI payment' });
    }
  },
);



// POST /api/orders/:id/confirm-razorpay
router.post('/:id/confirm-razorpay', requireAuth, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { razorpay_payment_id, razorpay_order_id, razorpay_signature } = req.body;

    if (!razorpay_payment_id || !razorpay_order_id || !razorpay_signature) {
      return res.status(400).json({ error: 'Missing payment verification fields' });
    }

    // Verify order ownership
    const order = await findOwnedOrder(req.params.id, req.user!.id);
    if (order === null) {
      return res.status(404).json({ error: 'Order not found' });
    }

    if (order === false) {
      return res.status(403).json({ error: 'Not authorized' });
    }

    if (order.razorpayOrderId !== razorpay_order_id) {
      return res.status(400).json({ error: 'Order ID mismatch' });
    }

    // Verify HMAC signature
    if (!verifyRazorpayPaymentSignature(razorpay_order_id, razorpay_payment_id, razorpay_signature)) {
      return res.status(400).json({ error: 'Payment verification failed' });
    }

    // Finalize order using existing finalizeOrder service
    const finalized = await finalizeOrder(razorpay_order_id, {
      razorpayPaymentId: razorpay_payment_id
    });

    // Idempotent — already paid
    if (finalized?.alreadyFinalized) {
      return res.status(200).json({ orderId: order._id, qrToken: finalized.qrToken, status: 'paid' });
    }

    const updated = await Order.findById(req.params.id);
    return res.status(200).json({
      orderId: updated!._id,
      qrToken: finalized?.qrToken || undefined,
      status: updated!.status
    });

  } catch (err) {
    console.error('confirm-razorpay error:', err);
    return res.status(500).json({ error: 'Payment confirmation failed' });
  }
});

router.post(
  '/:id/fulfill',
  requireAuth,
  requireRoles(['staff', 'manager', 'admin']),
  async (req: AuthenticatedRequest, res: Response) => {
    try {
      const { qrToken } = req.body as { qrToken?: string };
      const orderId = req.params.id;

      if (!qrToken || typeof qrToken !== 'string') {
        return res.status(400).json({ error: 'QR token is required' });
      }

      const order = await Order.findById(orderId).select('+qrTokenHash');
      if (!order) {
        return res.status(404).json({ error: 'Order not found' });
      }

      if (req.user?.role !== 'admin' && resolveCollege(order.college) !== req.user?.college) {
        return res.status(403).json({ error: 'Not authorized for this college order' });
      }

      const decoded = verifyQrToken(qrToken);
      if (
        decoded.orderId !== orderId ||
        decoded.userId !== String(order.userId) ||
        decoded.amount !== order.totalAmount
      ) {
        return res.status(400).json({ error: 'Invalid QR token' });
      }

      if (!order.qrTokenHash || hashQrToken(qrToken) !== order.qrTokenHash) {
        return res.status(400).json({ error: 'QR token mismatch' });
      }

      if (!order.qrExpiresAt || new Date(order.qrExpiresAt).getTime() <= Date.now()) {
        return res.status(400).json({ error: 'QR token expired' });
      }

      if (order.status === 'fulfilled') {
        return res.status(400).json({ error: 'Order already fulfilled' });
      }

      if (!['paid', 'preparing', 'ready'].includes(order.status)) {
        return res.status(400).json({ error: 'Order not ready for fulfillment' });
      }

      order.status = 'fulfilled';
      order.fulfilledBy = new mongoose.Types.ObjectId(req.user!.id);
      order.fulfilledAt = new Date();
      await order.save();

      io.to(String(order.userId)).emit('order:fulfilled', {
        orderId: String(order._id),
      });

      io.to(String(order.userId)).emit('order:updated', {
        orderId: String(order._id),
        status: 'fulfilled',
      });

      const student = await User.findById(order.userId).select('expoPushToken').lean();
      if (student?.expoPushToken) {
        const template = NotificationTemplates.orderFulfilled(String(order._id));
        sendPushNotification(
          student.expoPushToken,
          template.title,
          template.body,
          template.data,
        ).catch((error) => console.error('Order fulfilled push failed:', error));

        setTimeout(async () => {
          const freshStudent = await User.findById(order.userId).select('expoPushToken').lean();
          if (!freshStudent?.expoPushToken) {
            return;
          }

          const reminder = NotificationTemplates.rateReminder(String(order._id));
          sendPushNotification(
            freshStudent.expoPushToken,
            reminder.title,
            reminder.body,
            reminder.data,
          ).catch((error) => console.error('Rate reminder push failed:', error));
        }, 30 * 60 * 1000);
      }

      io.to('staff').emit('order:update', { order: serializeOrder(order) });

      res.json({ success: true, order: serializeOrder(order) });
    } catch {
      res.status(400).json({ error: 'Invalid QR token' });
    }
  },
);

export default router;
