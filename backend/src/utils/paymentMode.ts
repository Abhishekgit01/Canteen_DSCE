export type PaymentMode = 'mock' | 'upi_link' | 'razorpay';

export function getPaymentMode(): PaymentMode {
  const value = (process.env.PAYMENT_MODE || 'mock').trim().toLowerCase();

  if (value === 'upi_link' || value === 'razorpay') {
    return value;
  }

  return 'mock';
}
