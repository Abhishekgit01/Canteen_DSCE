import { getPaymentMode } from '../utils/paymentMode.js';

function toId(value: unknown) {
  return String(value);
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
    const canteenName = process.env.CANTEEN_NAME || 'DSCE+Canteen';
    const params = new URLSearchParams({
      pa: canteenUpiId,
      pn: canteenName,
      am: order.totalAmount.toFixed(2),
      cu: 'INR',
      tn: `DSCE-ORDER-${orderId}`,
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

  const keyId = process.env.RAZORPAY_KEY_ID;
  const keySecret = process.env.RAZORPAY_KEY_SECRET;

  if (!keyId || !keySecret) {
    throw new Error('Missing Razorpay configuration');
  }

  const { default: Razorpay } = await import('razorpay');
  const razorpay = new Razorpay({
    key_id: keyId,
    key_secret: keySecret,
  });

  const razorpayOrder = await razorpay.orders.create({
    amount: Math.round(order.totalAmount * 100),
    currency: 'INR',
    notes: {
      orderId,
    },
  });

  return {
    mode,
    razorpayOrderId: razorpayOrder.id,
    amount: order.totalAmount,
    key: keyId,
    orderId,
  };
}
