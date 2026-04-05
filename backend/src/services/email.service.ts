import { Resend } from 'resend';
import nodemailer from 'nodemailer';

const getResendApiKey = () => String(process.env.RESEND_API_KEY || '').trim();
const getEmailUser = () => String(process.env.EMAIL_USER || '').trim();
const getEmailPass = () => String(process.env.EMAIL_PASS || '').trim();

const getResendClient = (): Resend => {
  const apiKey = getResendApiKey();

  if (!apiKey) {
    throw new Error('RESEND_API_KEY is not configured');
  }

  return new Resend(apiKey);
};

const hasSmtpCredentials = (): boolean => {
  return Boolean(getEmailUser() && getEmailPass());
};

const getSmtpTransporter = () => {
  const user = getEmailUser();
  const pass = getEmailPass();

  if (!user || !pass) {
    throw new Error('EMAIL_USER or EMAIL_PASS is not configured');
  }

  return nodemailer.createTransport({
    service: 'gmail',
    auth: {
      user,
      pass,
    },
  });
};

export const isEmailConfigured = (): boolean => {
  return Boolean(getResendApiKey()) || hasSmtpCredentials();
};

export const sendOTPEmail = async (toEmail: string, toName: string, otp: string): Promise<void> => {
  const safeName = String(toName || 'there').trim() || 'there';
  const html = `
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
  `;
  const resendApiKey = getResendApiKey();
  let resendErrorMessage = '';

  if (resendApiKey) {
    const { error } = await getResendClient().emails.send({
      from: 'Canteen App <onboarding@resend.dev>',
      to: [toEmail],
      subject: 'Your Canteen OTP Code',
      html,
    });

    if (!error) {
      return;
    }

    resendErrorMessage = error.message || 'Resend rejected the email';
    console.error(`Resend OTP delivery failed for ${toEmail}:`, resendErrorMessage);
  }

  if (hasSmtpCredentials()) {
    await getSmtpTransporter().sendMail({
      from: `"Canteen App" <${getEmailUser()}>`,
      to: toEmail,
      subject: 'Your Canteen OTP Code',
      html,
    });
    return;
  }

  if (resendErrorMessage) {
    throw new Error(resendErrorMessage);
  }

  throw new Error('No working OTP email provider is configured');
};
