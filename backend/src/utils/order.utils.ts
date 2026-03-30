import { buildQrToken } from './qrToken.js';

function toId(value: unknown) {
  return String(value);
}

export function getOrderQrToken(order: any) {
  if (!order?.qrTokenHash || !order?.qrExpiresAt) {
    return null;
  }

  const qrExpiresAt = new Date(order.qrExpiresAt);
  if (Number.isNaN(qrExpiresAt.getTime()) || qrExpiresAt.getTime() <= Date.now()) {
    return null;
  }

  const { qrToken, qrTokenHash } = buildQrToken(order, qrExpiresAt);
  if (qrTokenHash !== order.qrTokenHash) {
    return null;
  }

  return qrToken;
}

export function serializeOrder(order: any, options: { includeQrToken?: boolean } = {}) {
  const doc = typeof order?.toObject === 'function' ? order.toObject() : order;

  const serialized: Record<string, unknown> = {
    id: toId(doc._id),
    userId: toId(doc.userId),
    items: Array.isArray(doc.items)
      ? doc.items.map((item: any) => ({
          menuItemId: toId(item.menuItemId),
          name: item.name,
          price: item.price,
          quantity: item.quantity,
          tempPreference: item.tempPreference,
        }))
      : [],
    scheduledTime: doc.scheduledTime,
    totalAmount: doc.totalAmount,
    status: doc.status,
    paymentMethod: doc.paymentMethod,
    razorpayOrderId: doc.razorpayOrderId,
    razorpayPaymentId: doc.razorpayPaymentId,
    upiTransactionId: doc.upiTransactionId,
    paidAt: doc.paidAt,
    fulfilledAt: doc.fulfilledAt,
    createdAt: doc.createdAt,
  };

  if (options.includeQrToken) {
    const qrToken = getOrderQrToken(doc);
    if (qrToken) {
      serialized.qrToken = qrToken;
    }
  }

  return serialized;
}
