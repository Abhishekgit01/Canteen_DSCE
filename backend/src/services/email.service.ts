import { Resend } from 'resend';

const getResendClient = (): Resend => {
  const apiKey = String(process.env.RESEND_API_KEY || '').trim();

  if (!apiKey) {
    throw new Error('RESEND_API_KEY is not configured');
  }

  return new Resend(apiKey);
};

export const isEmailConfigured = (): boolean => {
  return Boolean(String(process.env.RESEND_API_KEY || '').trim());
};

export const sendOTPEmail = async (toEmail: string, toName: string, otp: string): Promise<void> => {
  const safeName = String(toName || 'there').trim() || 'there';

  await getResendClient().emails.send({
    from: 'Canteen App <onboarding@resend.dev>',
    to: [toEmail],
    subject: 'Your Canteen OTP Code',
    html: `
      <div style="font-family: Arial, sans-serif; max-width: 400px; margin: 0 auto;">
        <h2 style="color: #00C853;">Canteen App</h2>
        <p>Hi ${safeName},</p>
        <p>Your OTP code is:</p>
        <h1 style="letter-spacing: 8px; color: #1A1A1A; font-size: 36px;">
          ${otp}
        </h1>
        <p style="color: #666;">This code expires in 10 minutes.</p>
        <p style="color: #666;">If you did not request this, ignore this email.</p>
      </div>
    `,
  });
};
