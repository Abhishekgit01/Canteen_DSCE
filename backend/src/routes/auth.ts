import { Router, Request, Response } from 'express';
import { createHash } from 'crypto';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { OAuth2Client } from 'google-auth-library';
import { User, OTP } from '../models/index.js';
import { generateOTP } from '../utils/email.js';
import { isEmailConfigured, sendOTPEmail } from '../services/email.service.js';
import { lookupStudentByUsn, normalizeUsn } from '../services/student-registry.service.js';

const router = Router();
const JWT_SECRET = process.env.JWT_SECRET;
if (!JWT_SECRET) throw new Error('JWT_SECRET is not set in environment variables');
const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
type AuthVerificationMode = 'auto' | 'email' | 'none';
type OtpPurpose = 'signup' | 'password_reset';
type SupportedCollege = 'DSCE' | 'NIE';

const supportedColleges: SupportedCollege[] = ['DSCE', 'NIE'];
const INTERNAL_GOOGLE_ID_ALPHABET = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';
let googleClient: OAuth2Client | null = null;

const getAuthVerificationMode = (): AuthVerificationMode => {
  const value = String(process.env.AUTH_VERIFICATION_MODE || 'email')
    .trim()
    .toLowerCase();

  if (value === 'auto' || value === 'email' || value === 'none') {
    return value;
  }

  return 'email';
};

const shouldUseOtpVerification = (): boolean => {
  return getAuthVerificationMode() !== 'none';
};

const normalizeCollege = (value: unknown): SupportedCollege | null => {
  const normalized = String(value || '')
    .trim()
    .toUpperCase();

  if (supportedColleges.includes(normalized as SupportedCollege)) {
    return normalized as SupportedCollege;
  }

  return null;
};

const getOtpServiceErrorMessage = () =>
  isEmailConfigured()
    ? 'OTP delivery is taking too long. Please try again in a moment.'
    : 'OTP email service is not configured on the backend. Add RESEND_API_KEY to backend env.';

const getGoogleClientId = (): string => {
  return String(process.env.GOOGLE_CLIENT_ID || '').trim();
};

const getGoogleClient = (): OAuth2Client | null => {
  const clientId = getGoogleClientId();

  if (!clientId) {
    return null;
  }

  if (!googleClient) {
    googleClient = new OAuth2Client(clientId);
  }

  return googleClient;
};

const getLetterPair = (hash: string, start: number): string => {
  const first = INTERNAL_GOOGLE_ID_ALPHABET[parseInt(hash.slice(start, start + 2), 16) % 26];
  const second = INTERNAL_GOOGLE_ID_ALPHABET[parseInt(hash.slice(start + 2, start + 4), 16) % 26];

  return `${first}${second}`;
};

const createInternalGoogleUsn = async (googleId: string): Promise<string> => {
  const year = String(new Date().getFullYear() % 100).padStart(2, '0');

  for (let attempt = 0; attempt < 5; attempt += 1) {
    const hash = createHash('sha256')
      .update(`${googleId}:${attempt}`)
      .digest('hex')
      .toUpperCase();
    const prefix = String((parseInt(hash.slice(0, 2), 16) % 9) + 1);
    const middle = getLetterPair(hash, 2);
    const branch = getLetterPair(hash, 8);
    const suffix = String(parseInt(hash.slice(14, 20), 16) % 1000).padStart(3, '0');
    const candidate = `${prefix}${middle}${year}${branch}${suffix}`;
    const exists = await User.exists({ usn: candidate });

    if (!exists) {
      return candidate;
    }
  }

  throw new Error('Could not allocate an internal Google user ID');
};

const queueOtpEmail = (email: string, name: string, otp: string) => {
  sendOTPEmail(email, name, otp).catch((error) => {
    console.error(`Email send failed for ${email}:`, error instanceof Error ? error.message : error);
  });
};

const createAndQueueOtp = async (email: string, name: string, purpose: OtpPurpose) => {
  if (!isEmailConfigured()) {
    throw new Error('OTP email service is not configured');
  }

  const otp = generateOTP();
  await OTP.create({
    email,
    purpose,
    code: otp,
    expiresAt: new Date(Date.now() + 10 * 60 * 1000),
  });

  queueOtpEmail(email, name, otp);
};

const createAuthResponse = (user: {
  _id: unknown;
  usn: string;
  email: string;
  name: string;
  college?: string | null;
  role: string;
  isVerified: boolean;
  googleId?: string | null;
  picture?: string | null;
}) => {
  const token = jwt.sign(
    {
      id: user._id,
      usn: user.usn,
      role: user.role,
      college: user.college,
      email: user.email,
    },
    JWT_SECRET,
    {
      expiresIn: '7d',
      issuer: 'canteen-app',
      audience: 'canteen-users',
    },
  );

  return {
    user: {
      id: String(user._id),
      usn: user.googleId ? null : user.usn,
      email: user.email,
      name: user.name,
      college: user.college,
      role: user.role,
      isVerified: user.isVerified,
      picture: user.picture,
    },
    token,
  };
};

const verifyGoogleIdToken = async (idToken: string) => {
  const clientId = getGoogleClientId();
  const client = getGoogleClient();

  if (!clientId || !client) {
    throw new Error('GOOGLE_CLIENT_ID is not configured');
  }

  const ticket = await client.verifyIdToken({
    idToken,
    audience: clientId,
  });
  const payload = ticket.getPayload();

  if (!payload?.email || !payload.sub) {
    throw new Error('Invalid Google token');
  }

  return {
    googleId: payload.sub,
    email: String(payload.email).trim().toLowerCase(),
    name: String(payload.name || payload.email).trim(),
    picture: payload.picture ? String(payload.picture) : null,
  };
};

// Signup
router.post('/signup', async (req: Request, res: Response) => {
  try {
    const { usn, email, password, name, college: requestedCollege } = req.body;
    const normalizedEmail = String(email || '').trim().toLowerCase();
    const college = normalizeCollege(requestedCollege);
    const verificationMode = getAuthVerificationMode();
    const providedName = String(name || '').trim();
    const student = college === 'DSCE' ? lookupStudentByUsn(String(usn || '')) : null;
    const resolvedUsn = student?.usn ?? normalizeUsn(String(usn || ''));
    const resolvedName = student?.name || providedName;

    if (!college) {
      return res.status(400).json({ error: 'Please choose your college' });
    }

    if (!resolvedUsn) {
      return res.status(400).json({ error: 'Please enter a valid USN' });
    }

    if (!EMAIL_PATTERN.test(normalizedEmail)) {
      return res.status(400).json({ error: 'Please enter a valid email address' });
    }

    if (!resolvedName) {
      return res.status(400).json({
        error:
          college === 'DSCE'
            ? 'Enter your full name if your USN is missing from the DSCE roster'
            : 'Please enter your full name',
      });
    }

    if (shouldUseOtpVerification() && !isEmailConfigured()) {
      return res.status(503).json({
        error: getOtpServiceErrorMessage(),
      });
    }

    const passwordHash = await bcrypt.hash(password, 12);
    const existingUser = await User.findOne({ $or: [{ email: normalizedEmail }, { usn: resolvedUsn }] }).select(
      '+passwordHash',
    );

    if (existingUser?.isVerified) {
      return res.status(400).json({
        error: 'Account already exists. Login instead or use Forgot password.',
      });
    }

    let user = existingUser;

    if (existingUser) {
      existingUser.name = resolvedName;
      existingUser.usn = resolvedUsn;
      existingUser.email = normalizedEmail;
      existingUser.passwordHash = passwordHash;
      existingUser.college = college;
      existingUser.isVerified = false;
      await existingUser.save();
    } else {
      user = new User({
        name: resolvedName,
        usn: resolvedUsn,
        email: normalizedEmail,
        passwordHash,
        college,
        isVerified: false,
      });
      await user.save();
    }

    if (!user) {
      return res.status(500).json({ error: 'Signup failed' });
    }

    if (!shouldUseOtpVerification()) {
      await OTP.deleteMany({ email: normalizedEmail, purpose: 'signup' });
      user.isVerified = true;
      await user.save();

      return res.json({
        verificationRequired: false,
        message: 'Signup complete',
        ...createAuthResponse(user),
      });
    }

    await OTP.deleteMany({ email: normalizedEmail, purpose: 'signup' });

    try {
      await createAndQueueOtp(normalizedEmail, resolvedName, 'signup');
    } catch (error) {
      console.error('OTP delivery error:', error);

      return res.status(503).json({
        error:
          verificationMode === 'auto'
            ? 'Could not send the OTP email. Please try again in a moment.'
            : getOtpServiceErrorMessage(),
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

    const otp = await OTP.findOne({ email: normalizedEmail, purpose: 'signup' }).sort({ expiresAt: -1 });
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

    await OTP.deleteMany({ email: normalizedEmail, purpose: 'signup' });
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

    if (!isEmailConfigured()) {
      return res.status(503).json({ error: getOtpServiceErrorMessage() });
    }

    const normalizedEmail = String(req.body.email || '').trim().toLowerCase();
    const user = await User.findOne({ email: normalizedEmail }).select('+passwordHash');
    if (!user) return res.status(404).json({ error: 'User not found' });
    if (user.isVerified) return res.status(400).json({ error: 'User already verified' });

    await OTP.deleteMany({ email: normalizedEmail, purpose: 'signup' });

    try {
      await createAndQueueOtp(normalizedEmail, user.name, 'signup');
    } catch (error) {
      console.error('OTP resend error:', error);
      return res.status(503).json({
        error: getOtpServiceErrorMessage(),
      });
    }

    res.json({ message: 'OTP resent' });
  } catch (error) {
    res.status(500).json({ error: 'Failed to resend OTP' });
  }
});

router.post('/forgot-password/request', async (req: Request, res: Response) => {
  try {
    if (!shouldUseOtpVerification()) {
      return res.status(403).json({ error: 'Password reset OTP is currently disabled on this backend' });
    }

    if (!isEmailConfigured()) {
      return res.status(503).json({ error: getOtpServiceErrorMessage() });
    }

    const normalizedEmail = String(req.body.email || '').trim().toLowerCase();
    if (!EMAIL_PATTERN.test(normalizedEmail)) {
      return res.status(400).json({ error: 'Please enter a valid email address' });
    }

    const user = await User.findOne({ email: normalizedEmail }).select('_id isVerified name');
    if (!user) {
      return res.status(404).json({ error: 'No account found with that email address' });
    }

    if (!user.isVerified) {
      return res.status(400).json({ error: 'Verify your account first before resetting the password' });
    }

    await OTP.deleteMany({ email: normalizedEmail, purpose: 'password_reset' });

    try {
      await createAndQueueOtp(normalizedEmail, user.name, 'password_reset');
    } catch (error) {
      console.error('Password reset OTP error:', error);
      return res.status(503).json({ error: getOtpServiceErrorMessage() });
    }

    return res.json({ message: 'Password reset OTP sent' });
  } catch (error) {
    console.error('Forgot password request error:', error);
    return res.status(500).json({ error: 'Failed to send password reset OTP' });
  }
});

router.post('/forgot-password/reset', async (req: Request, res: Response) => {
  try {
    if (!shouldUseOtpVerification()) {
      return res.status(403).json({ error: 'Password reset OTP is currently disabled on this backend' });
    }

    const normalizedEmail = String(req.body.email || '').trim().toLowerCase();
    const code = String(req.body.code || '').trim();
    const password = String(req.body.password || '');

    if (!EMAIL_PATTERN.test(normalizedEmail)) {
      return res.status(400).json({ error: 'Please enter a valid email address' });
    }

    if (code.length !== 6) {
      return res.status(400).json({ error: 'Please enter the 6-digit OTP' });
    }

    if (password.length < 6) {
      return res.status(400).json({ error: 'Password must be at least 6 characters long' });
    }

    const otp = await OTP.findOne({ email: normalizedEmail, purpose: 'password_reset' }).sort({
      expiresAt: -1,
    });
    const isValidCode = otp ? await bcrypt.compare(code, otp.code) : false;

    if (!otp || otp.expiresAt < new Date() || !isValidCode) {
      return res.status(400).json({ error: 'Invalid or expired OTP' });
    }

    const user = await User.findOne({ email: normalizedEmail }).select('+passwordHash');
    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    user.passwordHash = await bcrypt.hash(password, 12);
    await user.save();

    await OTP.deleteMany({ email: normalizedEmail, purpose: 'password_reset' });
    return res.json(createAuthResponse(user));
  } catch (error) {
    console.error('Password reset error:', error);
    return res.status(500).json({ error: 'Failed to reset password' });
  }
});

router.post('/google', async (req: Request, res: Response) => {
  try {
    const clientId = getGoogleClientId();
    if (!clientId) {
      return res.status(503).json({ error: 'Google authentication is not configured on this backend' });
    }

    const idToken = String(req.body?.idToken || '').trim();
    if (!idToken) {
      return res.status(400).json({ error: 'ID token required' });
    }

    const profile = await verifyGoogleIdToken(idToken);
    let user = await User.findOne({ email: profile.email }).select('+passwordHash');

    if (user) {
      let didUpdateUser = false;

      if (!user.googleId) {
        user.googleId = profile.googleId;
        didUpdateUser = true;
      }

      if (!user.picture && profile.picture) {
        user.picture = profile.picture;
        didUpdateUser = true;
      }

      if (!user.isVerified) {
        user.isVerified = true;
        didUpdateUser = true;
      }

      if (didUpdateUser) {
        await user.save();
      }

      return res.json(createAuthResponse(user));
    }

    return res.status(206).json({
      requiresCollege: true,
      email: profile.email,
      name: profile.name,
      picture: profile.picture,
      message: 'Please select your college to complete signup',
    });
  } catch (error) {
    console.error('Google auth error:', error);
    return res.status(401).json({ error: 'Google authentication failed' });
  }
});

router.post('/google/complete', async (req: Request, res: Response) => {
  try {
    const clientId = getGoogleClientId();
    if (!clientId) {
      return res.status(503).json({ error: 'Google authentication is not configured on this backend' });
    }

    const idToken = String(req.body?.idToken || '').trim();
    const college = normalizeCollege(req.body?.college);

    if (!idToken) {
      return res.status(400).json({ error: 'ID token required' });
    }

    if (!college) {
      return res.status(400).json({ error: 'College is required' });
    }

    const profile = await verifyGoogleIdToken(idToken);
    const existing = await User.findOne({ email: profile.email }).select('+passwordHash');

    if (existing) {
      return res.status(409).json({ error: 'Account already exists' });
    }

    const internalUsn = await createInternalGoogleUsn(profile.googleId);
    const user = await User.create({
      name: profile.name,
      email: profile.email,
      googleId: profile.googleId,
      picture: profile.picture,
      college,
      role: 'student',
      isVerified: true,
      usn: internalUsn,
    });

    return res.json(createAuthResponse(user));
  } catch (error) {
    console.error('Google complete error:', error);
    return res.status(500).json({ error: 'Signup failed' });
  }
});

// Login
router.post('/login', async (req: Request, res: Response) => {
  try {
    const { email, password } = req.body;
    const normalizedEmail = String(email || '').trim().toLowerCase();
    const user = await User.findOne({ email: normalizedEmail }).select('+passwordHash');
    if (!user || !user.isVerified || !user.passwordHash) {
      return res.status(401).json({ error: 'Invalid email or password' });
    }

    const isValid = await bcrypt.compare(password, user.passwordHash);
    if (!isValid) return res.status(401).json({ error: 'Invalid email or password' });

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

    res.json({
      id: user._id,
      usn: user.googleId ? null : user.usn,
      email: user.email,
      name: user.name,
      college: user.college,
      role: user.role,
      isVerified: user.isVerified,
      picture: user.picture,
    });
  } catch (error) {
    res.status(401).json({ error: 'Invalid token' });
  }
});

export default router;
