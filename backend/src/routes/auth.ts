import { Router, Request, Response } from 'express';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { User, OTP } from '../models/index.js';
import { generateOTP, sendOTPEmail } from '../utils/email.js';

const router = Router();
const JWT_SECRET = process.env.JWT_SECRET || 'your-secret-key';

// Signup
router.post('/signup', async (req: Request, res: Response) => {
  try {
    const { name, usn, email, password } = req.body;

    if (!email.endsWith('@dsce.edu.in')) {
      return res.status(400).json({ error: 'Email must end with @dsce.edu.in' });
    }

    const existingUser = await User.findOne({ $or: [{ email }, { usn }] });
    if (existingUser) {
      return res.status(400).json({ error: 'User already exists' });
    }

    const passwordHash = await bcrypt.hash(password, 12);
    const user = new User({ name, usn, email, passwordHash });
    await user.save();

    const otp = generateOTP();
    await OTP.create({ email, code: otp, expiresAt: new Date(Date.now() + 10 * 60 * 1000) });
    await sendOTPEmail(email, otp);

    res.json({ message: 'OTP sent' });
  } catch (error) {
    console.error('Signup error:', error);
    res.status(500).json({ error: 'Signup failed' });
  }
});

// Verify OTP
router.post('/verify-otp', async (req: Request, res: Response) => {
  try {
    const { email, code } = req.body;

    const otp = await OTP.findOne({ email, code });
    if (!otp || otp.expiresAt < new Date()) {
      return res.status(400).json({ error: 'Invalid or expired OTP' });
    }

    const user = await User.findOneAndUpdate(
      { email },
      { isVerified: true },
      { new: true }
    );

    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    await OTP.deleteOne({ email, code });

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
    const { email } = req.body;
    const user = await User.findOne({ email }).select('+passwordHash');
    if (!user) return res.status(404).json({ error: 'User not found' });
    if (user.isVerified) return res.status(400).json({ error: 'User already verified' });

    const otp = generateOTP();
    await OTP.create({ email, code: otp, expiresAt: new Date(Date.now() + 10 * 60 * 1000) });
    await sendOTPEmail(email, otp);
    res.json({ message: 'OTP resent' });
  } catch (error) {
    res.status(500).json({ error: 'Failed to resend OTP' });
  }
});

// Login
router.post('/login', async (req: Request, res: Response) => {
  try {
    const { email, password } = req.body;
    const user = await User.findOne({ email }).select('+passwordHash');
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
