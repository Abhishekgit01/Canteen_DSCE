import { Router, Request, Response } from 'express';
import jwt from 'jsonwebtoken';
import { Order, MenuItem } from '../models/index.js';
import { getSocketIO } from '../socket/index.js';

const router = Router();
const QR_SECRET = process.env.QR_SECRET || 'qr-secret-key';
const JWT_SECRET = process.env.JWT_SECRET || 'your-secret-key';

// Auth middleware
const authMiddleware = async (req: Request, res: Response, next: any) => {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader?.startsWith('Bearer ')) {
      return res.status(401).json({ error: 'No token' });
    }
    const token = authHeader.split(' ')[1];
    const decoded = jwt.verify(token, JWT_SECRET) as { id: string };
    (req as any).userId = decoded.id;
    next();
  } catch {
    res.status(401).json({ error: 'Invalid token' });
  }
};

// Get my orders
router.get('/my', authMiddleware, async (req: Request, res: Response) => {
  try {
    const orders = await Order.find({ userId: (req as any).userId }).sort({ createdAt: -1 });
    res.json(orders);
  } catch {
    res.status(500).json({ error: 'Failed to fetch orders' });
  }
});

// Get order by ID
router.get('/:id', authMiddleware, async (req: Request, res: Response) => {
  try {
    const order = await Order.findById(req.params.id);
    if (!order) return res.status(404).json({ error: 'Order not found' });
    if (order.userId.toString() !== (req as any).userId) {
      return res.status(403).json({ error: 'Not authorized' });
    }
    res.json(order);
  } catch {
    res.status(500).json({ error: 'Failed to fetch order' });
  }
});

// Create order
router.post('/create', authMiddleware, async (req: Request, res: Response) => {
  try {
    const { items, scheduledTime } = req.body;
    const userId = (req as any).userId;

    let totalAmount = 0;
    const orderItems = [];

    for (const item of items) {
      const menuItem = await MenuItem.findById(item.menuItemId);
      if (!menuItem) continue;
      totalAmount += menuItem.price * item.quantity;
      orderItems.push({
        menuItemId: menuItem._id,
        name: menuItem.name,
        quantity: item.quantity,
        tempPreference: item.tempPreference,
      });
    }

    const order = new Order({
      userId,
      items: orderItems,
      scheduledTime,
      totalAmount,
      status: 'pending_payment',
    });
    await order.save();

    res.json({
      orderId: order._id,
      amount: totalAmount * 100,
      currency: 'INR',
    });
  } catch {
    res.status(500).json({ error: 'Failed to create order' });
  }
});

// Payment success - generate QR token
router.post('/payment-success', authMiddleware, async (req: Request, res: Response) => {
  try {
    const { orderId, razorpayPaymentId } = req.body;
    const userId = (req as any).userId;

    const order = await Order.findById(orderId);
    if (!order || order.userId.toString() !== userId) {
      return res.status(404).json({ error: 'Order not found' });
    }

    const expiresAt = new Date(Date.now() + 6 * 60 * 60 * 1000);
    const qrToken = jwt.sign(
      { orderId: order._id, userId, amount: order.totalAmount, expiresAt },
      QR_SECRET,
      { expiresIn: '6h' }
    );

    order.status = 'paid';
    order.razorpayPaymentId = razorpayPaymentId;
    order.qrToken = qrToken;
    await order.save();

    const io = getSocketIO();
    io.to(userId).emit('order:paid', { orderId: order._id, qrToken });

    res.json({ success: true, qrToken });
  } catch {
    res.status(500).json({ error: 'Payment processing failed' });
  }
});

// Fulfill order (staff only)
router.post('/:id/fulfill', authMiddleware, async (req: Request, res: Response) => {
  try {
    const { qrToken } = req.body;
    const orderId = req.params.id;

    const decoded = jwt.verify(qrToken, QR_SECRET) as { orderId: string; expiresAt: Date };
    
    if (decoded.orderId !== orderId) {
      return res.status(400).json({ error: 'Invalid QR token' });
    }

    if (new Date(decoded.expiresAt) < new Date()) {
      return res.status(400).json({ error: 'QR token expired' });
    }

    const order = await Order.findById(orderId);
    if (!order) return res.status(404).json({ error: 'Order not found' });
    
    if (order.status === 'fulfilled') {
      return res.status(400).json({ error: 'Order already fulfilled' });
    }

    if (order.status !== 'paid' && order.status !== 'preparing') {
      return res.status(400).json({ error: 'Order not ready for fulfillment' });
    }

    order.status = 'fulfilled';
    await order.save();

    const io = getSocketIO();
    io.to(order.userId.toString()).emit('order:fulfilled', { orderId: order._id });

    res.json({ success: true, order });
  } catch {
    res.status(400).json({ error: 'Invalid QR token' });
  }
});

export default router;
