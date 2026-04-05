import { Router, type NextFunction, type Request, type Response } from 'express';
import jwt from 'jsonwebtoken';
import { io } from '../server.js';
import {
  normalizeCollege,
  resolveCollege,
  type SupportedCollege,
} from '../config/college.js';
import { User } from '../models/index.js';
import { PickupSettings } from '../models/PickupSettings.js';
import {
  getPickupRuntimeSettings,
} from '../services/pickup-settings.service.js';

const router = Router();
const JWT_SECRET = process.env.JWT_SECRET;
if (!JWT_SECRET) throw new Error('JWT_SECRET is not set in environment variables');

type UserRole = 'student' | 'staff' | 'manager' | 'admin';

interface AuthenticatedRequest extends Request {
  user?: {
    id: string;
    role: UserRole;
    college: SupportedCollege;
  };
}

type PickupSettingsBody = {
  basePickupMinutes?: number;
  rushHourExtra?: number;
  perItemExtra?: number;
  maxPickupMinutes?: number;
  openingTime?: string;
  closingTime?: string;
  breakStart?: string;
  breakEnd?: string;
  hasBreak?: boolean;
  isOpen?: boolean;
  closedMessage?: string;
};

const TIME_PATTERN = /^\d{2}:\d{2}$/;

function requireRoles(roles: UserRole[]) {
  return (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    if (!req.user || !roles.includes(req.user.role)) {
      return res.status(403).json({ error: 'Not authorized' });
    }

    next();
  };
}

async function requireAuth(req: AuthenticatedRequest, res: Response, next: NextFunction) {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader?.startsWith('Bearer ')) {
      return res.status(401).json({ error: 'No token provided' });
    }

    const token = authHeader.split(' ')[1];
    const decoded = jwt.verify(token, JWT_SECRET as string) as unknown as { id: string };
    const user = await User.findById(decoded.id).select('_id role college').lean();

    if (!user) {
      return res.status(401).json({ error: 'User not found' });
    }

    req.user = {
      id: String(user._id),
      role: user.role as UserRole,
      college: resolveCollege(user.college),
    };

    next();
  } catch {
    return res.status(401).json({ error: 'Invalid token' });
  }
}

function validatePayload(input: PickupSettingsBody) {
  const errors: string[] = [];
  const payload: Record<string, unknown> = {};

  const numberFields = [
    ['basePickupMinutes', 5, 120],
    ['rushHourExtra', 0, 60],
    ['perItemExtra', 0, 10],
    ['maxPickupMinutes', 10, 120],
  ] as const;

  numberFields.forEach(([key, min, max]) => {
    const value = input[key];
    if (value === undefined) {
      return;
    }

    if (typeof value !== 'number' || !Number.isFinite(value) || value < min || value > max) {
      errors.push(`${key} must be a number between ${min} and ${max}`);
      return;
    }

    payload[key] = value;
  });

  const timeFields = ['openingTime', 'closingTime', 'breakStart', 'breakEnd'] as const;
  timeFields.forEach((key) => {
    const value = input[key];
    if (value === undefined) {
      return;
    }

    if (typeof value !== 'string' || !TIME_PATTERN.test(value.trim())) {
      errors.push(`${key} must be in HH:MM format`);
      return;
    }

    payload[key] = value.trim();
  });

  if (input.hasBreak !== undefined) {
    if (typeof input.hasBreak !== 'boolean') {
      errors.push('hasBreak must be a boolean');
    } else {
      payload.hasBreak = input.hasBreak;
    }
  }

  if (input.isOpen !== undefined) {
    if (typeof input.isOpen !== 'boolean') {
      errors.push('isOpen must be a boolean');
    } else {
      payload.isOpen = input.isOpen;
    }
  }

  if (input.closedMessage !== undefined) {
    if (typeof input.closedMessage !== 'string' || !input.closedMessage.trim()) {
      errors.push('closedMessage must be a non-empty string');
    } else {
      payload.closedMessage = input.closedMessage.trim().slice(0, 160);
    }
  }

  const openingTime =
    typeof payload.openingTime === 'string'
      ? payload.openingTime
      : typeof input.openingTime === 'string'
        ? input.openingTime.trim()
        : undefined;
  const closingTime =
    typeof payload.closingTime === 'string'
      ? payload.closingTime
      : typeof input.closingTime === 'string'
        ? input.closingTime.trim()
        : undefined;

  if (openingTime && closingTime && openingTime >= closingTime) {
    errors.push('closingTime must be after openingTime');
  }

  const hasBreak = payload.hasBreak ?? input.hasBreak;
  const breakStart =
    typeof payload.breakStart === 'string'
      ? payload.breakStart
      : typeof input.breakStart === 'string'
        ? input.breakStart.trim()
        : undefined;
  const breakEnd =
    typeof payload.breakEnd === 'string'
      ? payload.breakEnd
      : typeof input.breakEnd === 'string'
        ? input.breakEnd.trim()
        : undefined;

  if (hasBreak && breakStart && breakEnd && breakStart >= breakEnd) {
    errors.push('breakEnd must be after breakStart');
  }

  return { errors, payload };
}

router.get('/:college', async (req: Request, res: Response) => {
  try {
    const college = normalizeCollege(req.params.college);
    if (!college) {
      return res.status(400).json({ error: 'Invalid college' });
    }

    const settings = await getPickupRuntimeSettings(college);
    return res.json(settings);
  } catch {
    return res.status(500).json({ error: 'Failed to fetch pickup settings' });
  }
});

router.patch(
  '/:college',
  requireAuth,
  requireRoles(['manager', 'admin']),
  async (req: AuthenticatedRequest, res: Response) => {
    try {
      const college = normalizeCollege(req.params.college);
      if (!college) {
        return res.status(400).json({ error: 'Invalid college' });
      }

      if (req.user?.role !== 'admin' && college !== req.user?.college) {
        return res.status(403).json({ error: 'Access denied' });
      }

      const { errors, payload } = validatePayload(req.body as PickupSettingsBody);
      if (errors.length > 0) {
        return res.status(400).json({ error: errors.join('. ') });
      }

      payload.updatedBy = req.user?.id;

      await PickupSettings.findOneAndUpdate(
        { college },
        { $set: payload },
        {
          new: true,
          upsert: true,
          setDefaultsOnInsert: true,
          runValidators: true,
        },
      );

      const runtimeSettings = await getPickupRuntimeSettings(college);
      io.emit(`pickup:updated:${college}`, runtimeSettings);

      return res.json(runtimeSettings);
    } catch {
      return res.status(500).json({ error: 'Failed to update pickup settings' });
    }
  },
);

export default router;
