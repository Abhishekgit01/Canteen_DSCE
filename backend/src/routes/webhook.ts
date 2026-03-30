import { Router, Request, Response } from 'express';
import crypto from 'crypto';
import jwt from 'jsonwebtoken';
import { Order } from '../models/index.js';
import { io } from '../server.js';

const router = Router();
const RAZORPAY_WEBHOOK_SECRET = process.env.RAZORPAY_WEBHOOK_SECRET || '';
const QR_SECRET = process.env.QR_SECRET || 'qr-secret-key';

// Razorpay webhook - MUST be mounted BEFORE express.json() middleware in main app
// This route handles raw body for signature verification
router.post('/razorpay', async (req: Request, res: Response) => {
  try {
    const signature = req.headers['x-razorpay-signature'] as string;
    const body = (req as any).rawBody || req.body;

    if (!signature || !RAZORPAY_WEBHOOK_SECRET) {
      console.error('Webhook: Missing signature or secret');
      return res.status(400).send('Missing signature');
    }

    // Verify HMAC signature using crypto.timingSafeEqual
    const expectedSignature = crypto
      .createHmac('sha256', RAZORPAY_WEBHOOK_SECRET)
      .update(body)
      .digest('hex');

    const sigBuf = Buffer.from(signature, 'hex');
    const expectedBuf = Buffer.from(expectedSignature, 'hex');

    if (sigBuf.length !== expectedBuf.length || !crypto.timingSafeEqual(sigBuf, expectedBuf)) {
      console.error('Webhook: Invalid signature', {
        ip: req.ip,
        timestamp: new Date().toISOString(),
        body: body.toString().slice(0, 200),
      });
      return res.status(400).send('Invalid signature');
    }

    // Parse JSON after verification
    const event = JSON.parse(body.toString());
    console.log('Webhook event:', event.event);

    // Handle payment.captured
    if (event.event === 'payment.captured') {
      const payment = event.payload.payment.entity;
      const razorpayOrderId = payment.order_id;
      const razorpayPaymentId = payment.id;

      const order = await Order.findOne({ razorpayOrderId });
      if (!order) {
        console.error('Webhook: Order not found', razorpayOrderId);
        return res.status(200).send('OK'); // Return 200 to prevent retries
      }

      // Idempotent check
      if (order.status !== 'pending_payment') {
        return res.status(200).send('OK');
      }

      // Update order
      order.status = 'paid';
      order.razorpayPaymentId = razorpayPaymentId;
      order.webhookVerified = true;

      // Generate QR token
      const expiresAt = new Date(Date.now() + 6 * 60 * 60 * 1000); // 6 hours
      const qrToken = jwt.sign(
        {
          orderId: order._id.toString(),
          userId: order.userId.toString(),
          amount: order.totalAmount,
          items: order.items,
          exp: Math.floor(expiresAt.getTime() / 1000),
        },
        QR_SECRET
      );

      order.qrToken = qrToken;
      await order.save();

      // Emit to user's socket room
      io.to(order.userId.toString()).emit('order:paid', {
        orderId: order._id,
        qrToken,
      });

      // Emit to staff room for live updates
      io.to('staff').emit('order:update', { order });
    }

    // Handle payment.failed
    if (event.event === 'payment.failed') {
      const payment = event.payload.payment.entity;
      const razorpayOrderId = payment.order_id;

      const order = await Order.findOne({ razorpayOrderId });
      if (order && order.status === 'pending_payment') {
        order.status = 'failed';
        await order.save();

        io.to(order.userId.toString()).emit('order:failed', { orderId: order._id });
      }
    }

    // Always return 200 to Razorpay
    res.status(200).send('OK');
  } catch (error) {
    console.error('Webhook error:', error);
    res.status(200).send('OK'); // Return 200 to prevent retries
  }
});

export default router;
