import { Router, Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import mongoose from 'mongoose';
import { io } from '../server.js';
import { MenuItem, Order, User } from '../models/index.js';
import { initiatePayment } from '../services/payment.service.js';
import { finalizePaidOrder } from '../services/order-payment.service.js';
import { serializeOrder } from '../utils/order.utils.js';
import { getPaymentMode, PaymentMode } from '../utils/paymentMode.js';
import { hashQrToken, verifyQrToken } from '../utils/qrToken.js';

const router = Router();
const JWT_SECRET = process.env.JWT_SECRET || 'your-secret-key';

type UserRole = 'student' | 'staff' | 'manager' | 'admin';

interface AuthenticatedRequest extends Request {
  user?: {
    id: string;
    role: UserRole;
  };
}

type CreateOrderBody = {
  items?: Array<{
    menuItemId?: string;
    quantity?: number;
    tempPreference?: 'cold' | 'normal' | 'hot';
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
    const decoded = jwt.verify(token, JWT_SECRET) as { id: string };
    const user = await User.findById(decoded.id).select('_id role');

    if (!user) {
      return res.status(401).json({ error: 'User not found' });
    }

    req.user = {
      id: String(user._id),
      role: user.role as UserRole,
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
    canteenName: mode === 'upi_link' ? process.env.CANTEEN_NAME || 'DSCE+Canteen' : undefined,
  };
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

router.get('/payment-config', requireAuth, (_req: AuthenticatedRequest, res: Response) => {
  res.json(getPaymentConfigResponse());
});

router.get('/my', requireAuth, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const orders = await Order.find({ userId: req.user!.id }).sort({ createdAt: -1 });
    res.json(orders.map((order) => serializeOrder(order)));
  } catch {
    res.status(500).json({ error: 'Failed to fetch orders' });
  }
});

router.get('/:id', requireAuth, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const order = await Order.findById(req.params.id).select('+qrTokenHash');

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

      if (!Array.isArray(items) || items.length === 0) {
        return res.status(400).json({ error: 'At least one item is required' });
      }

      if (!scheduledTime || typeof scheduledTime !== 'string') {
        return res.status(400).json({ error: 'Scheduled time is required' });
      }

      const orderItems = [];
      let totalAmount = 0;

      for (const item of items) {
        if (!item.menuItemId || !item.quantity || item.quantity < 1) {
          return res.status(400).json({ error: 'Invalid order item' });
        }

        const menuItem = await MenuItem.findById(item.menuItemId);
        if (!menuItem || !menuItem.isAvailable) {
          return res.status(400).json({ error: 'One or more items are unavailable' });
        }

        if (
          item.tempPreference &&
          menuItem.tempOptions.length > 0 &&
          !menuItem.tempOptions.includes(item.tempPreference)
        ) {
          return res.status(400).json({ error: `Invalid temperature for ${menuItem.name}` });
        }

        totalAmount += menuItem.price * item.quantity;
        orderItems.push({
          menuItemId: menuItem._id,
          name: menuItem.name,
          price: menuItem.price,
          quantity: item.quantity,
          tempPreference: item.tempPreference,
        });
      }

      order = await Order.create({
        userId: req.user!.id,
        items: orderItems,
        scheduledTime,
        totalAmount: Number(totalAmount.toFixed(2)),
        status: 'pending_payment',
        paymentStatus: 'pending',
      });

      const payment = await initiatePayment(order);
      applyPaymentMethod(order, payment.mode);

      if (payment.mode === 'razorpay') {
        order.razorpayOrderId = payment.razorpayOrderId;
      }

      await order.save();

      res.status(201).json(payment);
    } catch (error) {
      if (order?._id) {
        await Order.findByIdAndDelete(order._id).catch(() => undefined);
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

      io.to('staff').emit('order:update', { order: serializeOrder(order) });

      res.json({ success: true, order: serializeOrder(order) });
    } catch {
      res.status(400).json({ error: 'Invalid QR token' });
    }
  },
);

export default router;
