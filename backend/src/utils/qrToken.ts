import crypto from 'crypto';
import jwt from 'jsonwebtoken';

const QR_TOKEN_TTL_MS = 6 * 60 * 60 * 1000;

function getQrSecret() {
  return process.env.QR_SECRET || 'qr-secret-key';
}

function toId(value: unknown) {
  return String(value);
}

export function buildQrToken(
  order: { _id: unknown; userId: unknown; totalAmount: number },
  expiresAt = new Date(Date.now() + QR_TOKEN_TTL_MS),
) {
  const payload = {
    orderId: toId(order._id),
    userId: toId(order.userId),
    amount: order.totalAmount,
    exp: Math.floor(expiresAt.getTime() / 1000),
  };

  const qrToken = jwt.sign(payload, getQrSecret(), { noTimestamp: true });
  const qrTokenHash = hashQrToken(qrToken);

  return {
    qrToken,
    qrTokenHash,
    expiresAt,
  };
}

export function verifyQrToken(qrToken: string) {
  return jwt.verify(qrToken, getQrSecret()) as {
    orderId: string;
    userId: string;
    amount: number;
    exp: number;
  };
}

export function hashQrToken(qrToken: string) {
  return crypto.createHash('sha256').update(qrToken).digest('hex');
}
