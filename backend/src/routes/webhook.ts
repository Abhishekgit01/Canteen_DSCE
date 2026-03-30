import { Router, Request, Response } from 'express';
import crypto from 'crypto';
import { Order } from '../models/index.js';
import { io } from '../server.js';
import { finalizePaidOrder } from '../services/order-payment.service.js';
import { serializeOrder } from '../utils/order.utils.js';
import { getPaymentMode } from '../utils/paymentMode.js';

const router = Router();

router.post('/razorpay', async (req: Request, res: Response) => {
  try {
    if (getPaymentMode() !== 'razorpay') {
      return res.status(403).json({ error: 'Razorpay webhook is inactive' });
    }

    const signature = req.headers['x-razorpay-signature'];
    const secret = process.env.RAZORPAY_WEBHOOK_SECRET || '';
    const rawBody = req.body;

    if (typeof signature !== 'string' || !secret || !Buffer.isBuffer(rawBody)) {
      return res.status(400).send('Invalid webhook request');
    }

    const expectedSignature = crypto
      .createHmac('sha256', secret)
      .update(rawBody)
      .digest('hex');

    const signatureBuffer = Buffer.from(signature);
    const expectedBuffer = Buffer.from(expectedSignature);

    if (
      signatureBuffer.length !== expectedBuffer.length ||
      !crypto.timingSafeEqual(signatureBuffer, expectedBuffer)
    ) {
      return res.status(400).send('Invalid signature');
    }

    const event = JSON.parse(rawBody.toString('utf8'));

    if (event.event === 'payment.captured') {
      const payment = event.payload.payment.entity;
      const razorpayOrderId = payment.order_id;
      const razorpayPaymentId = payment.id;

      const order = await Order.findOne({ razorpayOrderId }).select('+qrTokenHash');
      if (!order) {
        return res.status(200).send('OK');
      }

      if (order.status !== 'pending_payment') {
        return res.status(200).send('OK');
      }

      await finalizePaidOrder(order, {
        paymentMethod: 'razorpay',
        razorpayPaymentId,
        webhookVerified: true,
      });
    }

    if (event.event === 'payment.failed') {
      const payment = event.payload.payment.entity;
      const razorpayOrderId = payment.order_id;

      const order = await Order.findOne({ razorpayOrderId });
      if (order && order.status === 'pending_payment') {
        order.status = 'failed';
        order.paymentStatus = 'failed';
        await order.save();

        io.to(String(order.userId)).emit('order:failed', { orderId: String(order._id) });
        io.to('staff').emit('order:update', { order: serializeOrder(order) });
      }
    }

    res.status(200).send('OK');
  } catch (error) {
    console.error('Webhook error:', error);
    res.status(200).send('OK');
  }
});

export default router;
