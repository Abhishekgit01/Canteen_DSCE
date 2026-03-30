import { Router, Request, Response } from 'express';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { User, OTP } from '../models/index.js';
import { generateOTP, sendOTPEmail } from '../utils/email.js';
import { lookupStudentByUsn, normalizeUsn } from '../services/student-registry.service.js';

const router = Router();
const JWT_SECRET = process.env.JWT_SECRET || 'your-secret-key';
const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

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

    const existingUser = await User.findOne({ $or: [{ email: normalizedEmail }, { usn: resolvedUsn }] });
    if (existingUser) {
      return res.status(400).json({ error: 'User already exists' });
    }

    const passwordHash = await bcrypt.hash(password, 12);
    const user = new User({ name: resolvedName, usn: resolvedUsn, email: normalizedEmail, passwordHash });
    await user.save();

    const otp = generateOTP();
    await OTP.create({ email: normalizedEmail, code: otp, expiresAt: new Date(Date.now() + 10 * 60 * 1000) });
    await sendOTPEmail(normalizedEmail, otp);

    res.json({
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

    const token = jwt.sign(
      { id: user._id, usn: user.usn, role: user.role },
      JWT_SECRET,
      { expiresIn: '7d' }
    );

    res.json({ user: { id: user._id, usn: user.usn, email: user.email, name: user.name, role: user.role, isVerified: user.isVerified }, token });
  } catch (error) {
    res.status(500).json({ error: 'Verification failed' });
  }
});

// Resend OTP
router.post('/resend-otp', async (req: Request, res: Response) => {
  try {
    const normalizedEmail = String(req.body.email || '').trim().toLowerCase();
    const user = await User.findOne({ email: normalizedEmail }).select('+passwordHash');
    if (!user) return res.status(404).json({ error: 'User not found' });
    if (user.isVerified) return res.status(400).json({ error: 'User already verified' });

    const otp = generateOTP();
    await OTP.create({ email: normalizedEmail, code: otp, expiresAt: new Date(Date.now() + 10 * 60 * 1000) });
    await sendOTPEmail(normalizedEmail, otp);
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

    const token = jwt.sign({ id: user._id, usn: user.usn, role: user.role }, JWT_SECRET, { expiresIn: '7d' });
    res.json({ user: { id: user._id, usn: user.usn, email: user.email, name: user.name, role: user.role, isVerified: user.isVerified }, token });
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
