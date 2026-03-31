import { Order } from '../models/index.js';
import { io } from '../server.js';
import { buildQrToken } from '../utils/qrToken.js';
import { getOrderQrToken, serializeOrder } from '../utils/order.utils.js';

type FinalizePaidOrderOptions = {
  paymentMethod: 'mock' | 'upi_link' | 'razorpay';
  razorpayPaymentId?: string;
  upiTransactionId?: string;
  webhookVerified?: boolean;
};

export async function finalizePaidOrder(order: any, options: FinalizePaidOrderOptions) {
  const { qrToken, qrTokenHash, expiresAt } = buildQrToken(order);

  order.status = 'paid';
  order.paymentStatus = 'completed';
  order.paymentMethod = options.paymentMethod;
  order.paidAt = new Date();
  order.qrTokenHash = qrTokenHash;
  order.qrExpiresAt = expiresAt;

  if (options.razorpayPaymentId) {
    order.razorpayPaymentId = options.razorpayPaymentId;
  }

  if (options.upiTransactionId) {
    order.upiTransactionId = options.upiTransactionId;
  }

  if (typeof options.webhookVerified === 'boolean') {
    order.webhookVerified = options.webhookVerified;
  }

  await order.save();

  const serializedOrder = serializeOrder(order);

  io.to(String(order.userId)).emit('order:paid', {
    orderId: String(order._id),
    qrToken,
  });

  io.to('staff').emit('order:update', { order: serializedOrder });

  return {
    order,
    qrToken,
    serializedOrder,
    alreadyFinalized: false,
  };
}

type FinalizeOrderOptions = {
  razorpayPaymentId?: string;
  webhookVerified?: boolean;
};

function isAlreadyFinalized(status: unknown) {
  return ['paid', 'preparing', 'ready', 'fulfilled'].includes(String(status));
}

export async function finalizeOrder(
  razorpayOrderId: string,
  options: FinalizeOrderOptions = {},
) {
  const order = await Order.findOne({ razorpayOrderId }).select('+qrTokenHash');
  if (!order) {
    return null;
  }

  if (isAlreadyFinalized(order.status)) {
    let shouldSave = false;

    if (options.razorpayPaymentId && !order.razorpayPaymentId) {
      order.razorpayPaymentId = options.razorpayPaymentId;
      shouldSave = true;
    }

    if (options.webhookVerified && !order.webhookVerified) {
      order.webhookVerified = true;
      shouldSave = true;
    }

    if (shouldSave) {
      await order.save();
    }

    const qrToken = getOrderQrToken(order);

    return {
      order,
      qrToken,
      serializedOrder: serializeOrder(order, { includeQrToken: true }),
      alreadyFinalized: true,
    };
  }

  return finalizePaidOrder(order, {
    paymentMethod: 'razorpay',
    razorpayPaymentId: options.razorpayPaymentId,
    webhookVerified: options.webhookVerified,
  });
}
