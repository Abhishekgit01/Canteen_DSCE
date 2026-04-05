import { Resend } from 'resend';
import { COLLEGE_CANTEEN_NAMES, resolveCollege } from '../config/college.js';

const getResendApiKey = () => String(process.env.RESEND_API_KEY || '').trim();

const escapeHtml = (value: string) =>
  value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');

const getCanteenName = (college?: string | null) => {
  return COLLEGE_CANTEEN_NAMES[resolveCollege(college)];
};

const getResendClient = (): Resend => {
  const apiKey = getResendApiKey();

  if (!apiKey) {
    throw new Error('RESEND_API_KEY is not set');
  }

  return new Resend(apiKey);
};

export const isEmailConfigured = (): boolean => {
  return Boolean(getResendApiKey());
};

export const sendOTPEmail = async (
  toEmail: string,
  toName: string,
  otp: string,
  college?: string | null,
): Promise<void> => {
  const safeName = escapeHtml(String(toName || 'there').trim() || 'there');
  const canteenName = getCanteenName(college);
  const safeCanteenName = escapeHtml(canteenName);
  const { error } = await getResendClient().emails.send({
    from: 'Canteen App <onboarding@resend.dev>',
    to: [toEmail],
    subject: `${otp} is your ${canteenName} OTP`,
    html: `
      <div style="font-family:Arial,sans-serif;max-width:420px;margin:0 auto;padding:32px;">
        <h2 style="color:#00C853;margin-bottom:4px;">${safeCanteenName}</h2>
        <p style="color:#666;margin-top:0;">Food ordering app</p>
        <hr style="border:none;border-top:1px solid #eee;margin:24px 0" />
        <p>Hi ${safeName}, your OTP is:</p>
        <div style="background:#F8F8F8;border-radius:12px;padding:24px;text-align:center;margin:24px 0;">
          <span style="font-size:40px;font-weight:700;letter-spacing:12px;color:#1A1A1A;">
            ${otp}
          </span>
        </div>
        <p style="color:#666;font-size:14px;">
          Expires in <strong>10 minutes</strong>.
        </p>
      </div>
    `,
  });

  if (error) {
    console.error('Resend error:', error);
    throw new Error('Failed to send OTP email');
  }
};
