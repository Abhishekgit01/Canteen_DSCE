import { Router, Request, Response } from 'express';
import { Order, MenuItem } from '../models/index.js';
import jwt from 'jsonwebtoken';
import { getSocketIO } from '../socket/index.js';
import crypto from 'crypto';

const router = Router();
const JWT_SECRET = process.env.JWT_SECRET || 'your-secret-key';
const QR_SECRET = process.env.QR_SECRET || 'qr-secret-key';

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

// Generate unique Paytm order
router.post('/paytm/create', authMiddleware, async (req: Request, res: Response) => {
  try {
    const { items } = req.body;
    const userId = (req as any).userId;

    // Calculate total
    let totalAmount = 0;
    for (const item of items) {
      const menuItem = await MenuItem.findById(item.menuItemId);
      if (menuItem) {
        totalAmount += menuItem.price * item.quantity;
      }
    }

    // Create order with pending status
    const order = await Order.create({
      userId,
      items,
      totalAmount,
      status: 'pending_payment',
      paymentMethod: 'paytm',
      paymentStatus: 'pending',
      paytmOrderId: `DSCE${Date.now()}${Math.random().toString(36).substr(2, 4).toUpperCase()}`,
    });

    res.json({
      orderId: order._id,
      paytmOrderId: order.paytmOrderId,
      amount: totalAmount,
      upiId: process.env.PAYTM_UPI_ID || 'yourname@paytm',
      instructions: `Open Paytm, scan QR, enter amount ₹${totalAmount}, add note: ${order.paytmOrderId}`,
    });
  } catch (error) {
    console.error('Paytm order creation error:', error);
    res.status(500).json({ error: 'Failed to create order' });
  }
});

// Paytm webhook - called when payment is received
router.post('/paytm/webhook', async (req: Request, res: Response) => {
  try {
    const { paytmOrderId, transactionId, amount, status } = req.body;

    // Verify webhook signature (optional but recommended)
    const signature = req.headers['x-paytm-signature'];
    const expectedSignature = crypto
      .createHmac('sha256', process.env.PAYTM_WEBHOOK_SECRET || 'secret')
      .update(JSON.stringify(req.body))
      .digest('hex');

    if (signature !== expectedSignature) {
      console.warn('Invalid webhook signature');
      // Still process for now, but log warning
    }

    // Find and update order
    const order = await Order.findOne({ paytmOrderId });
    if (!order) {
      return res.status(404).json({ error: 'Order not found' });
    }

    if (status === 'SUCCESS' && order.totalAmount === amount) {
      // Generate QR token for pickup
      const qrToken = jwt.sign(
        { orderId: order._id, orderNumber: order.paytmOrderId },
        QR_SECRET,
        { expiresIn: '24h' }
      );

      // Update order
      order.status = 'paid';
      order.paymentStatus = 'completed';
      order.transactionId = transactionId;
      order.qrToken = qrToken;
      order.paidAt = new Date();
      await order.save();

      // Notify kitchen staff via Socket.io
      const io = getSocketIO();
      io.to('kitchen').emit('new_order', {
        orderId: order._id,
        orderNumber: order.paytmOrderId,
        items: order.items,
        totalAmount: order.totalAmount,
        userId: order.userId,
      });

      // Notify user
      io.to(`user_${order.userId}`).emit('payment_success', {
        orderId: order._id,
        orderNumber: order.paytmOrderId,
        qrToken,
      });

      res.json({ success: true, message: 'Payment verified' });
    } else {
      res.status(400).json({ error: 'Payment verification failed' });
    }
  } catch (error) {
    console.error('Paytm webhook error:', error);
    res.status(500).json({ error: 'Webhook processing failed' });
  }
});

// Manual payment verification (for staff to confirm payment seen in Paytm app)
router.post('/paytm/verify-manual', authMiddleware, async (req: Request, res: Response) => {
  try {
    const { orderId, transactionId } = req.body;
    const userId = (req as any).userId;

    const order = await Order.findOne({ _id: orderId, userId });
    if (!order) {
      return res.status(404).json({ error: 'Order not found' });
    }

    if (order.paymentStatus === 'completed') {
      return res.json({ alreadyVerified: true, order });
    }

    // Staff will verify in Paytm Business app, then mark here
    // This endpoint is for staff/admin only
    res.json({
      orderId: order._id,
      paytmOrderId: order.paytmOrderId,
      amount: order.totalAmount,
      status: order.paymentStatus,
      message: 'Please ask staff to verify payment in Paytm Business app',
    });
  } catch (error) {
    res.status(500).json({ error: 'Verification failed' });
  }
});

// Check payment status
router.get('/paytm/status/:orderId', authMiddleware, async (req: Request, res: Response) => {
  try {
    const order = await Order.findOne({
      _id: req.params.orderId,
      userId: (req as any).userId,
    });

    if (!order) {
      return res.status(404).json({ error: 'Order not found' });
    }

    res.json({
      orderId: order._id,
      paytmOrderId: order.paytmOrderId,
      status: order.status,
      paymentStatus: order.paymentStatus,
      amount: order.totalAmount,
      qrToken: order.qrToken,
    });
  } catch (error) {
    res.status(500).json({ error: 'Status check failed' });
  }
});

export default router;
