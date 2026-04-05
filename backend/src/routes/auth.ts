import { Router, Request, Response } from 'express';
import { createHash } from 'crypto';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { OAuth2Client } from 'google-auth-library';
import { User, OTP } from '../models/index.js';
import { normalizeCollege, SUPPORTED_COLLEGES, type SupportedCollege } from '../config/college.js';
import { generateOTP } from '../utils/email.js';
import { isEmailConfigured, sendOTPEmail } from '../services/email.service.js';
import { lookupStudentByUsn, normalizeUsn } from '../services/student-registry.service.js';

const router = Router();
const JWT_SECRET = process.env.JWT_SECRET;
if (!JWT_SECRET) throw new Error('JWT_SECRET is not set in environment variables');
const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const OTP_COOLDOWN_MS = 60 * 1000;
const OTP_DELIVERY_GRACE_MS = 1500;
type AuthVerificationMode = 'auto' | 'email' | 'none';
type OtpPurpose = 'signup' | 'password_reset';
const INTERNAL_GOOGLE_ID_ALPHABET = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';
let googleClient: OAuth2Client | null = null;
const GOOGLE_TOKEN_INFO_URL = 'https://oauth2.googleapis.com/tokeninfo';
const GOOGLE_USER_INFO_URL = 'https://openidconnect.googleapis.com/v1/userinfo';

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

const getOtpServiceErrorMessage = () =>
  isEmailConfigured()
    ? 'OTP delivery is taking too long. Please try again in a moment.'
    : 'OTP email service is not configured on the backend. Add RESEND_API_KEY to backend env.';

const getOtpRequestErrorMessage = (error: unknown) => {
  if (error instanceof Error && error.message) {
    return error.message;
  }

  return getOtpServiceErrorMessage();
};

const getOtpCooldownMessage = (otpSentAt?: Date | null) => {
  if (!otpSentAt) {
    return null;
  }

  const elapsed = Date.now() - new Date(otpSentAt).getTime();
  if (elapsed >= OTP_COOLDOWN_MS) {
    return null;
  }

  const secondsLeft = Math.ceil((OTP_COOLDOWN_MS - elapsed) / 1000);
  return `Please wait ${secondsLeft} seconds before requesting another OTP`;
};

const getGoogleClientIds = (): string[] => {
  return String(process.env.GOOGLE_CLIENT_ID || '')
    .split(',')
    .map((value) => value.trim())
    .filter(Boolean);
};

const getGoogleClient = (): OAuth2Client | null => {
  const clientId = getGoogleClientIds()[0];

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

const logOtpDeliveryFailure = (email: string, otp: string, message: string) => {
  console.error(`Email send failed for ${email}:`, message);

  if (process.env.NODE_ENV !== 'production') {
    console.info(`[DEV OTP FALLBACK] OTP for ${email}: ${otp}`);
  }
};

const getOtpDeliveryErrorMessage = (message?: string) => {
  const normalized = String(message || '').toLowerCase();

  if (
    normalized.includes('verify') && normalized.includes('domain') ||
    normalized.includes('own email address') ||
    normalized.includes('testing emails')
  ) {
    return 'OTP email delivery is blocked by the current Resend sender. Verify a sending domain in Resend before using OTP signup.';
  }

  if (normalized.includes('api key') || normalized.includes('unauthorized')) {
    return 'OTP email service is not configured correctly on the backend.';
  }

  return 'Could not send the OTP email. Please try again in a moment.';
};

const sendOtpWithGracePeriod = async (
  email: string,
  name: string,
  otp: string,
  college?: string | null,
) => {
  const deliveryPromise = sendOTPEmail(email, name, otp, college).then((result) => {
    if (!result.success) {
      logOtpDeliveryFailure(email, otp, result.error);
    }

    return result;
  });

  const immediateResult = await Promise.race([
    deliveryPromise,
    new Promise<null>((resolve) => {
      setTimeout(() => resolve(null), OTP_DELIVERY_GRACE_MS);
    }),
  ]);

  if (immediateResult === null) {
    void deliveryPromise;
    return { success: true as const };
  }

  return immediateResult;
};

const supportsRosterLookup = (college: SupportedCollege) => college === 'DSCE' || college === 'NIE';

const getRosterMissingNameMessage = (college: SupportedCollege) =>
  `Enter your full name if your USN is missing from the ${college} roster`;

const isDuplicateKeyError = (
  error: unknown,
): error is {
  code: number;
  keyPattern?: Record<string, number>;
  keyValue?: Record<string, unknown>;
} => {
  return Boolean(error && typeof error === 'object' && 'code' in error && (error as { code?: number }).code === 11000);
};

const getSignupErrorMessage = (error: unknown) => {
  if (isDuplicateKeyError(error)) {
    const duplicateKey = Object.keys(error.keyPattern || {})[0];

    if (duplicateKey === 'email') {
      return 'That email address is already in use. Login instead or use Forgot password.';
    }

    if (duplicateKey === 'usn') {
      return 'That USN is already linked to an account. Login instead or contact support if this looks wrong.';
    }
  }

  if (error instanceof Error && error.message) {
    return error.message;
  }

  return 'Signup failed';
};

const getExistingSignupConflictMessage = (options: {
  emailInUse?: boolean;
  usnInUse?: boolean;
}) => {
  if (options.emailInUse) {
    return 'That email address is already in use. Login instead or use Forgot password.';
  }

  if (options.usnInUse) {
    return 'That USN is already linked to an account. Try the email used for that account or contact support if this looks wrong.';
  }

  return 'Account already exists. Login instead or use Forgot password.';
};

const createAndQueueOtp = async ({
  user,
  email,
  name,
  purpose,
  college,
}: {
  user: { _id: unknown; college?: string | null };
  email: string;
  name: string;
  purpose: OtpPurpose;
  college?: string | null;
}) => {
  if (!isEmailConfigured()) {
    throw new Error('OTP email service is not configured');
  }

  const otp = generateOTP();
  const otpSentAt = new Date();
  await OTP.create({
    email,
    purpose,
    code: otp,
    expiresAt: new Date(Date.now() + 10 * 60 * 1000),
  });

  await User.updateOne({ _id: user._id }, { $set: { otpSentAt } });
  const deliveryResult = await sendOtpWithGracePeriod(email, name, otp, college || user.college);

  if (!deliveryResult.success) {
    await OTP.deleteMany({ email, purpose });
    await User.updateOne({ _id: user._id }, { $unset: { otpSentAt: 1 } });
    throw new Error(getOtpDeliveryErrorMessage(deliveryResult.error));
  }
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
  const clientIds = getGoogleClientIds();
  const client = getGoogleClient();

  if (clientIds.length === 0 || !client) {
    throw new Error('GOOGLE_CLIENT_ID is not configured');
  }

  const ticket = await client.verifyIdToken({
    idToken,
    audience: clientIds,
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

const verifyGoogleAccessToken = async (accessToken: string) => {
  const clientIds = getGoogleClientIds();

  if (clientIds.length === 0) {
    throw new Error('GOOGLE_CLIENT_ID is not configured');
  }

  const tokenInfoResponse = await fetch(
    `${GOOGLE_TOKEN_INFO_URL}?access_token=${encodeURIComponent(accessToken)}`,
  );

  if (!tokenInfoResponse.ok) {
    throw new Error('Invalid Google access token');
  }

  const tokenInfo = (await tokenInfoResponse.json()) as {
    aud?: string;
    audience?: string;
    issued_to?: string;
    scope?: string;
    sub?: string;
  };
  const audience = String(tokenInfo.aud || tokenInfo.audience || tokenInfo.issued_to || '').trim();

  if (!audience || !clientIds.includes(audience)) {
    throw new Error('Google token audience mismatch');
  }

  const userInfoResponse = await fetch(GOOGLE_USER_INFO_URL, {
    headers: {
      Authorization: `Bearer ${accessToken}`,
    },
  });

  if (!userInfoResponse.ok) {
    throw new Error('Could not load Google profile');
  }

  const profile = (await userInfoResponse.json()) as {
    sub?: string;
    email?: string;
    name?: string;
    picture?: string;
    email_verified?: boolean | string;
    verified_email?: boolean | string;
  };

  const googleId = String(profile.sub || tokenInfo.sub || '').trim();
  const email = String(profile.email || '').trim().toLowerCase();
  const isVerifiedEmail =
    profile.email_verified === true ||
    profile.email_verified === 'true' ||
    profile.verified_email === true ||
    profile.verified_email === 'true';

  if (!googleId || !email || !isVerifiedEmail) {
    throw new Error('Google account email is not verified');
  }

  return {
    googleId,
    email,
    name: String(profile.name || profile.email || '').trim(),
    picture: profile.picture ? String(profile.picture) : null,
  };
};

const verifyGoogleCredential = async ({
  accessToken,
  idToken,
}: {
  accessToken?: string;
  idToken?: string;
}) => {
  if (idToken) {
    return verifyGoogleIdToken(idToken);
  }

  if (accessToken) {
    return verifyGoogleAccessToken(accessToken);
  }

  throw new Error('Google credential required');
};

// Signup
router.post('/signup', async (req: Request, res: Response) => {
  try {
    const { usn, email, password, name, college: requestedCollege } = req.body;
    const normalizedEmail = String(email || '').trim().toLowerCase();
    const college = normalizeCollege(requestedCollege);
    const verificationMode = getAuthVerificationMode();
    const providedName = String(name || '').trim();
    const student = college && supportsRosterLookup(college)
      ? lookupStudentByUsn(String(usn || ''), college)
      : null;
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

    if (String(password || '').length < 6) {
      return res.status(400).json({ error: 'Password must be at least 6 characters long' });
    }

    if (!resolvedName) {
      return res.status(400).json({
        error:
          supportsRosterLookup(college)
            ? getRosterMissingNameMessage(college)
            : 'Please enter your full name',
      });
    }

    if (shouldUseOtpVerification() && !isEmailConfigured()) {
      return res.status(503).json({
        error: getOtpServiceErrorMessage(),
      });
    }

    const passwordHash = await bcrypt.hash(password, 12);
    const existingUserByEmail = await User.findOne({ email: normalizedEmail }).select(
      '+passwordHash',
    );
    const existingUserByUsn = await User.findOne({ usn: resolvedUsn, college }).select(
      '+passwordHash',
    );

    const emailInUse = Boolean(existingUserByEmail?.isVerified);
    const usnInUse = Boolean(
      existingUserByUsn?.isVerified &&
        String(existingUserByUsn.email || '').trim().toLowerCase() !== normalizedEmail,
    );

    if (emailInUse || usnInUse) {
      return res.status(400).json({
        error: getExistingSignupConflictMessage({ emailInUse, usnInUse }),
      });
    }

    if (
      existingUserByEmail &&
      existingUserByUsn &&
      String(existingUserByEmail._id) !== String(existingUserByUsn._id)
    ) {
      return res.status(409).json({
        error:
          'This email and USN are already tied to different pending accounts. Please use another email or contact support.',
      });
    }

    let user = existingUserByEmail || existingUserByUsn;

    if (user) {
      user.name = resolvedName;
      user.usn = resolvedUsn;
      user.email = normalizedEmail;
      user.passwordHash = passwordHash;
      user.college = college;
      user.isVerified = false;
      await user.save();
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

    const otpCooldownMessage = getOtpCooldownMessage(user.otpSentAt);
    if (otpCooldownMessage) {
      return res.status(429).json({ error: otpCooldownMessage });
    }

    await OTP.deleteMany({ email: normalizedEmail, purpose: 'signup' });

    try {
      await createAndQueueOtp({
        user,
        email: normalizedEmail,
        name: resolvedName,
        purpose: 'signup',
        college,
      });
    } catch (error) {
      console.error('OTP delivery error:', error);

      return res.status(503).json({
        error:
          verificationMode === 'auto'
            ? 'Could not send the OTP email. Please try again in a moment.'
            : getOtpRequestErrorMessage(error),
      });
    }

    res.json({
      verificationRequired: true,
      message: 'OTP sent',
      student: { usn: resolvedUsn, name: resolvedName, source: student ? 'roster' : 'manual' },
    });
  } catch (error) {
    console.error('Signup error:', error);
    res.status(500).json({ error: getSignupErrorMessage(error) });
  }
});

router.get('/student/:usn', async (req: Request, res: Response) => {
  const college = normalizeCollege(req.query.college);

  if (!college || !SUPPORTED_COLLEGES.includes(college)) {
    return res.status(400).json({ error: 'Please choose a supported college' });
  }

  const student = lookupStudentByUsn(req.params.usn, college);

  if (!student) {
    return res.status(404).json({ error: `USN not found in the ${college} roster` });
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
      { isVerified: true, $unset: { otpSentAt: 1 } },
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
    const user = await User.findOne({ email: normalizedEmail }).select('name email isVerified college otpSentAt');
    if (!user) return res.status(404).json({ error: 'User not found' });
    if (user.isVerified) return res.status(400).json({ error: 'User already verified' });

    const otpCooldownMessage = getOtpCooldownMessage(user.otpSentAt);
    if (otpCooldownMessage) {
      return res.status(429).json({ error: otpCooldownMessage });
    }

    await OTP.deleteMany({ email: normalizedEmail, purpose: 'signup' });

    try {
      await createAndQueueOtp({
        user,
        email: normalizedEmail,
        name: user.name,
        purpose: 'signup',
        college: user.college,
      });
    } catch (error) {
      console.error('OTP resend error:', error);
      return res.status(503).json({
        error: getOtpRequestErrorMessage(error),
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

    const user = await User.findOne({ email: normalizedEmail }).select(
      '_id isVerified name college otpSentAt',
    );
    if (!user) {
      return res.status(404).json({ error: 'No account found with that email address' });
    }

    const otpCooldownMessage = getOtpCooldownMessage(user.otpSentAt);
    if (otpCooldownMessage) {
      return res.status(429).json({ error: otpCooldownMessage });
    }

    if (!user.isVerified) {
      await OTP.deleteMany({ email: normalizedEmail, purpose: 'signup' });

      try {
        await createAndQueueOtp({
          user,
          email: normalizedEmail,
          name: user.name,
          purpose: 'signup',
          college: user.college,
        });
      } catch (error) {
        console.error('Unverified account OTP error:', error);
        return res.status(503).json({ error: getOtpRequestErrorMessage(error) });
      }

      return res.json({
        message: 'Your account is not verified yet, so we sent a verification OTP instead.',
        purpose: 'signup',
      });
    }

    await OTP.deleteMany({ email: normalizedEmail, purpose: 'password_reset' });

    try {
      await createAndQueueOtp({
        user,
        email: normalizedEmail,
        name: user.name,
        purpose: 'password_reset',
        college: user.college,
      });
    } catch (error) {
      console.error('Password reset OTP error:', error);
      return res.status(503).json({ error: getOtpRequestErrorMessage(error) });
    }

    return res.json({ message: 'Password reset OTP sent', purpose: 'password_reset' });
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
    user.otpSentAt = undefined;
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
    if (getGoogleClientIds().length === 0) {
      return res.status(503).json({ error: 'Google authentication is not configured on this backend' });
    }

    const idToken = String(req.body?.idToken || '').trim();
    const accessToken = String(req.body?.accessToken || '').trim();
    if (!idToken && !accessToken) {
      return res.status(400).json({ error: 'Google credential required' });
    }

    const profile = await verifyGoogleCredential({ accessToken, idToken });
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
    if (getGoogleClientIds().length === 0) {
      return res.status(503).json({ error: 'Google authentication is not configured on this backend' });
    }

    const idToken = String(req.body?.idToken || '').trim();
    const accessToken = String(req.body?.accessToken || '').trim();
    const college = normalizeCollege(req.body?.college);

    if (!idToken && !accessToken) {
      return res.status(400).json({ error: 'Google credential required' });
    }

    if (!college) {
      return res.status(400).json({ error: 'College is required' });
    }

    const profile = await verifyGoogleCredential({ accessToken, idToken });
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
