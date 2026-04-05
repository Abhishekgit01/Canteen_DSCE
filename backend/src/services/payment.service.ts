import { getPaymentMode } from '../utils/paymentMode.js';

type PaymentServiceError = Error & {
  code: string;
  cause?: unknown;
};

function toId(value: unknown) {
  return String(value);
}

function createPaymentServiceError(message: string, code: string, cause?: unknown) {
  const error = new Error(message) as PaymentServiceError;
  error.code = code;

  if (cause) {
    error.cause = cause;
  }

  return error;
}

export async function createRazorpayOrder(amountPaise: number, receipt: string) {
  const keyId = process.env.RAZORPAY_KEY_ID;
  const keySecret = process.env.RAZORPAY_KEY_SECRET;

  if (!keyId || !keySecret) {
    throw createPaymentServiceError('Missing Razorpay configuration', 'RAZORPAY_CONFIG_MISSING');
  }

  try {
    const { default: Razorpay } = await import('razorpay');
    const razorpay = new Razorpay({
      key_id: keyId,
      key_secret: keySecret,
    });

    const razorpayOrder = await razorpay.orders.create({
      amount: amountPaise,
      currency: 'INR',
      receipt,
    });

    return {
      razorpay_order_id: razorpayOrder.id,
      amount: razorpayOrder.amount,
      currency: razorpayOrder.currency,
      key_id: keyId,
    };
  } catch (error) {
    throw createPaymentServiceError(
      'Failed to create Razorpay order',
      'RAZORPAY_ORDER_CREATE_FAILED',
      error,
    );
  }
}

export async function initiatePayment(order: { _id: unknown; totalAmount: number }) {
  const mode = getPaymentMode();
  const orderId = toId(order._id);

  if (mode === 'mock') {
    const transactionId = `MOCK_${Date.now()}${Math.floor(100000 + Math.random() * 900000)}`;

    return {
      mode,
      transactionId,
      amount: order.totalAmount,
      orderId,
    };
  }

  if (mode === 'upi_link') {
    const canteenUpiId = process.env.CANTEEN_UPI_ID || 'canteen@upi';
    const canteenName = process.env.CANTEEN_NAME || 'Campus+Canteen';
    const params = new URLSearchParams({
      pa: canteenUpiId,
      pn: canteenName,
      am: order.totalAmount.toFixed(2),
      cu: 'INR',
      tn: `CANTEEN-ORDER-${orderId}`,
      tr: orderId,
    });

    return {
      mode,
      upiUri: `upi://pay?${params.toString()}`,
      canteenUpiId,
      canteenName,
      amount: order.totalAmount,
      orderId,
    };
  }

  throw createPaymentServiceError(
    'Razorpay orders must be created through createRazorpayOrder',
    'RAZORPAY_FLOW_NOT_SUPPORTED',
  );
}
