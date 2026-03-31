import type { Request, Response } from 'express';
import crypto from 'crypto';
import { Order } from '../models/index.js';
import { io } from '../server.js';
import { finalizeOrder } from '../services/order-payment.service.js';
import { serializeOrder } from '../utils/order.utils.js';

function signaturesMatch(expected: string, received: string) {
  const expectedBuffer = Buffer.from(expected);
  const receivedBuffer = Buffer.from(received);

  if (expectedBuffer.length !== receivedBuffer.length) {
    return false;
  }

  return crypto.timingSafeEqual(expectedBuffer, receivedBuffer);
}

function verifyWebhookSignature(rawBody: Buffer, signature: string, secret: string) {
  const expected = crypto.createHmac('sha256', secret).update(rawBody).digest('hex');
  return signaturesMatch(expected, signature);
}

async function markRazorpayOrderFailed(razorpayOrderId: string, razorpayPaymentId?: string) {
  const order = await Order.findOne({ razorpayOrderId }).select('+qrTokenHash');
  if (!order) {
    return null;
  }

  if (['paid', 'preparing', 'ready', 'fulfilled', 'failed'].includes(String(order.status))) {
    return order;
  }

  order.status = 'failed';
  order.paymentStatus = 'failed';
  order.paymentMethod = 'razorpay';

  if (razorpayPaymentId && !order.razorpayPaymentId) {
    order.razorpayPaymentId = razorpayPaymentId;
  }

  await order.save();

  io.to(String(order.userId)).emit('order:failed', {
    orderId: String(order._id),
  });

  io.to('staff').emit('order:update', {
    order: serializeOrder(order),
  });

  return order;
}

export function razorpayWebhookHandler(req: Request, res: Response) {
  const signature = String(req.header('x-razorpay-signature') || '');
  const secret = process.env.RAZORPAY_WEBHOOK_SECRET;
  const rawBody = Buffer.isBuffer(req.body) ? req.body : Buffer.from(req.body || '');

  if (!secret || !signature || !verifyWebhookSignature(rawBody, signature, secret)) {
    if (signature) {
      console.error('Rejected Razorpay webhook due to invalid signature');
    }

    return res.sendStatus(200);
  }

  let event: any;

  try {
    event = JSON.parse(rawBody.toString('utf8'));
  } catch (error) {
    console.error('Failed to parse Razorpay webhook payload', error);
    return res.sendStatus(200);
  }

  res.sendStatus(200);

  void (async () => {
    const payment = event?.payload?.payment?.entity;
    const razorpayOrderId = String(payment?.order_id || '').trim();
    const razorpayPaymentId = String(payment?.id || '').trim() || undefined;

    if (!razorpayOrderId) {
      return;
    }

    if (event?.event === 'payment.captured') {
      const finalized = await finalizeOrder(razorpayOrderId, {
        razorpayPaymentId,
        webhookVerified: true,
      });

      if (finalized?.qrToken && finalized.alreadyFinalized) {
        io.to(String(finalized.order.userId)).emit('order:paid', {
          orderId: String(finalized.order._id),
          qrToken: finalized.qrToken,
        });
      }

      return;
    }

    if (event?.event === 'payment.failed') {
      await markRazorpayOrderFailed(razorpayOrderId, razorpayPaymentId);
    }
  })().catch((error) => {
    console.error('Failed to process Razorpay webhook event', error);
  });
}
