declare module 'react-native-razorpay' {
  type RazorpayCheckoutOptions = {
    key: string;
    amount: number;
    currency: string;
    order_id: string;
    name?: string;
    description?: string;
    prefill?: {
      contact?: string;
      email?: string;
      name?: string;
    };
    theme?: {
      color?: string;
    };
  };

  type RazorpayCheckoutSuccessResponse = {
    razorpay_payment_id: string;
    razorpay_order_id: string;
    razorpay_signature: string;
  };

  const RazorpayCheckout: {
    open(options: RazorpayCheckoutOptions): Promise<RazorpayCheckoutSuccessResponse>;
  };

  export default RazorpayCheckout;
}
