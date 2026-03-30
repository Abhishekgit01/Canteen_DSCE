import { Router, Request, Response } from 'express';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { User, OTP } from '../models/index.js';
import { generateOTP, isEmailConfigured, sendOTPEmail } from '../utils/email.js';
import { lookupStudentByUsn, normalizeUsn } from '../services/student-registry.service.js';

const router = Router();
const JWT_SECRET = process.env.JWT_SECRET || 'your-secret-key';
const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
type AuthVerificationMode = 'auto' | 'email' | 'none';

const getAuthVerificationMode = (): AuthVerificationMode => {
  const value = String(process.env.AUTH_VERIFICATION_MODE || 'auto')
    .trim()
    .toLowerCase();

  if (value === 'email' || value === 'none') {
    return value;
  }

  return 'auto';
};

const shouldUseOtpVerification = (): boolean => {
  const mode = getAuthVerificationMode();

  if (mode === 'none') {
    return false;
  }

  if (mode === 'email') {
    return true;
  }

  return isEmailConfigured();
};

const createAuthResponse = (user: {
  _id: unknown;
  usn: string;
  email: string;
  name: string;
  role: string;
  isVerified: boolean;
}) => {
  const token = jwt.sign({ id: user._id, usn: user.usn, role: user.role }, JWT_SECRET, { expiresIn: '7d' });

  return {
    user: {
      id: String(user._id),
      usn: user.usn,
      email: user.email,
      name: user.name,
      role: user.role,
      isVerified: user.isVerified,
    },
    token,
  };
};

// Signup
router.post('/signup', async (req: Request, res: Response) => {
  try {
    const { usn, email, password, name } = req.body;
    const normalizedEmail = String(email || '').trim().toLowerCase();
    const student = lookupStudentByUsn(String(usn || ''));
    const fallbackName = String(name || '').trim().replace(/\s+/g, ' ');
    const resolvedUsn = student?.usn ?? normalizeUsn(String(usn || ''));
    const resolvedName = student?.name ?? fallbackName;

    if (!resolvedUsn) {
      return res.status(400).json({ error: 'Please enter a valid USN' });
    }

    if (!student && !resolvedName) {
      return res.status(400).json({
        error: 'USN not found in the DSCE first-year roster. Enter your name to continue.',
      });
    }

    if (!EMAIL_PATTERN.test(normalizedEmail)) {
      return res.status(400).json({ error: 'Please enter a valid email address' });
    }

    const passwordHash = await bcrypt.hash(password, 12);
    const existingUser = await User.findOne({ $or: [{ email: normalizedEmail }, { usn: resolvedUsn }] }).select(
      '+passwordHash',
    );
    const verificationMode = getAuthVerificationMode();

    if (existingUser?.isVerified) {
      return res.status(400).json({ error: 'User already exists' });
    }

    let user = existingUser;

    if (existingUser) {
      existingUser.name = resolvedName;
      existingUser.usn = resolvedUsn;
      existingUser.email = normalizedEmail;
      existingUser.passwordHash = passwordHash;
      existingUser.isVerified = false;
      await existingUser.save();
    } else {
      user = new User({
        name: resolvedName,
        usn: resolvedUsn,
        email: normalizedEmail,
        passwordHash,
        isVerified: false,
      });
      await user.save();
    }

    if (!user) {
      return res.status(500).json({ error: 'Signup failed' });
    }

    if (!shouldUseOtpVerification()) {
      await OTP.deleteMany({ email: normalizedEmail });
      user.isVerified = true;
      await user.save();

      return res.json({
        verificationRequired: false,
        message: 'Signup complete',
        ...createAuthResponse(user),
      });
    }

    const otp = generateOTP();
    await OTP.deleteMany({ email: normalizedEmail });
    await OTP.create({ email: normalizedEmail, code: otp, expiresAt: new Date(Date.now() + 10 * 60 * 1000) });

    try {
      await sendOTPEmail(normalizedEmail, otp);
    } catch (error) {
      console.error('OTP delivery error:', error);

      if (verificationMode === 'auto') {
        await OTP.deleteMany({ email: normalizedEmail });
        user.isVerified = true;
        await user.save();

        return res.json({
          verificationRequired: false,
          message: 'Signup complete. Email verification is temporarily unavailable, so your account was verified automatically.',
          ...createAuthResponse(user),
        });
      }

      return res.status(503).json({
        error: isEmailConfigured()
          ? 'OTP delivery is taking too long. Please try again in a moment.'
          : 'OTP email service is not configured on the backend. Add EMAIL_USER and EMAIL_PASS in Render.',
      });
    }

    res.json({
      verificationRequired: true,
      message: 'OTP sent',
      student: { usn: resolvedUsn, name: resolvedName, source: student ? 'roster' : 'manual' },
    });
  } catch (error) {
    console.error('Signup error:', error);
    res.status(500).json({ error: 'Signup failed' });
  }
});

router.get('/student/:usn', async (req: Request, res: Response) => {
  const student = lookupStudentByUsn(req.params.usn);

  if (!student) {
    return res.status(404).json({ error: 'USN not found in the DSCE first-year roster' });
  }

  return res.json(student);
});

// Verify OTP
router.post('/verify-otp', async (req: Request, res: Response) => {
  try {
    if (!shouldUseOtpVerification()) {
      return res.status(403).json({ error: 'OTP verification is currently disabled on this backend' });
    }

    const { email, code } = req.body;
    const normalizedEmail = String(email || '').trim().toLowerCase();

    const otp = await OTP.findOne({ email: normalizedEmail }).sort({ expiresAt: -1 });
    const isValidCode = otp ? await bcrypt.compare(String(code || ''), otp.code) : false;

    if (!otp || otp.expiresAt < new Date() || !isValidCode) {
      return res.status(400).json({ error: 'Invalid or expired OTP' });
    }

    const user = await User.findOneAndUpdate(
      { email: normalizedEmail },
      { isVerified: true },
      { new: true }
    );

    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    await OTP.deleteMany({ email: normalizedEmail });
    res.json(createAuthResponse(user));
  } catch (error) {
    res.status(500).json({ error: 'Verification failed' });
  }
});

// Resend OTP
router.post('/resend-otp', async (req: Request, res: Response) => {
  try {
    if (!shouldUseOtpVerification()) {
      return res.status(403).json({ error: 'OTP verification is currently disabled on this backend' });
    }

    const normalizedEmail = String(req.body.email || '').trim().toLowerCase();
    const user = await User.findOne({ email: normalizedEmail }).select('+passwordHash');
    if (!user) return res.status(404).json({ error: 'User not found' });
    if (user.isVerified) return res.status(400).json({ error: 'User already verified' });

    const otp = generateOTP();
    await OTP.deleteMany({ email: normalizedEmail });
    await OTP.create({ email: normalizedEmail, code: otp, expiresAt: new Date(Date.now() + 10 * 60 * 1000) });

    try {
      await sendOTPEmail(normalizedEmail, otp);
    } catch (error) {
      console.error('OTP resend error:', error);
      return res.status(503).json({
        error: isEmailConfigured()
          ? 'OTP delivery is taking too long. Please try again in a moment.'
          : 'OTP email service is not configured on the backend. Add EMAIL_USER and EMAIL_PASS in Render.',
      });
    }

    res.json({ message: 'OTP resent' });
  } catch (error) {
    res.status(500).json({ error: 'Failed to resend OTP' });
  }
});

// Login
router.post('/login', async (req: Request, res: Response) => {
  try {
    const { usn, password } = req.body;
    const normalizedUsn = normalizeUsn(String(usn || ''));
    const user = await User.findOne({ usn: normalizedUsn }).select('+passwordHash');
    if (!user || !user.isVerified) return res.status(401).json({ error: 'Invalid credentials' });

    const isValid = await bcrypt.compare(password, user.passwordHash);
    if (!isValid) return res.status(401).json({ error: 'Invalid credentials' });

    res.json(createAuthResponse(user));
  } catch (error) {
    console.error('Login error:', error);
    res.status(500).json({ error: 'Login failed', details: String(error) });
  }
});

// Get current user
router.get('/me', async (req: Request, res: Response) => {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader?.startsWith('Bearer ')) return res.status(401).json({ error: 'No token' });
    
    const token = authHeader.split(' ')[1];
    const decoded = jwt.verify(token, JWT_SECRET) as { id: string };
    const user = await User.findById(decoded.id);
    if (!user) return res.status(404).json({ error: 'User not found' });

    res.json({ id: user._id, usn: user.usn, email: user.email, name: user.name, role: user.role, isVerified: user.isVerified });
  } catch (error) {
    res.status(401).json({ error: 'Invalid token' });
  }
});

export default router;
