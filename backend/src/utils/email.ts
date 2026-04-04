import nodemailer from 'nodemailer';

let transporter: nodemailer.Transporter | null = null;

const getTransporter = () => {
  if (transporter) {
    return transporter;
  }

  transporter = nodemailer.createTransport({
    host: process.env.EMAIL_HOST || 'smtp.gmail.com',
    port: Number(process.env.EMAIL_PORT || 587),
    secure: Number(process.env.EMAIL_PORT || 587) === 465,
    pool: true,
    maxConnections: 1,
    maxMessages: Infinity,
    auth: {
      user: process.env.EMAIL_USER,
      pass: process.env.EMAIL_PASS,
    },
    connectionTimeout: 8000,
    greetingTimeout: 8000,
    socketTimeout: 10000,
  });

  return transporter;
};

export const isEmailConfigured = (): boolean => Boolean(process.env.EMAIL_USER && process.env.EMAIL_PASS);

export const generateOTP = (): string => {
  return Math.floor(100000 + Math.random() * 900000).toString();
};

export const sendOTPEmail = async (email: string, otp: string): Promise<void> => {
  if (!isEmailConfigured()) {
    throw new Error('OTP email service is not configured');
  }

  const mailOptions = {
    from: process.env.EMAIL_USER,
    to: email,
    subject: 'DSCE Canteen - OTP Verification',
    html: `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <h2 style="color: #f97316;">DSCE Canteen</h2>
        <p>Your OTP for verification is:</p>
        <div style="background: #f97316; color: white; padding: 20px; text-align: center; font-size: 32px; font-weight: bold; letter-spacing: 8px; border-radius: 8px;">
          ${otp}
        </div>
        <p style="color: #666;">This OTP will expire in 10 minutes.</p>
        <p style="color: #666; font-size: 12px;">If you didn't request this, please ignore this email.</p>
      </div>
    `,
  };

  await getTransporter().sendMail(mailOptions);
};
