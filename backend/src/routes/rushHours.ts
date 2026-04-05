import { Router, type NextFunction, type Request, type Response } from 'express';
import jwt from 'jsonwebtoken';
import mongoose from 'mongoose';
import { io } from '../server.js';
import { DEFAULT_COLLEGE, normalizeCollege, resolveCollege, type SupportedCollege } from '../config/college.js';
import { User } from '../models/index.js';
import { RushHour } from '../models/RushHour.js';

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

type RushHourBody = {
  college?: string;
  dayOfWeek?: number[];
  endTime?: string;
  isActive?: boolean;
  label?: string;
  message?: string;
  startTime?: string;
  surchargePercent?: number;
};

const TIME_PATTERN = /^\d{2}:\d{2}$/;

function emitRushHourUpdate(college: SupportedCollege) {
  io.emit(`rush:updated:${college}`, {
    college,
    timestamp: new Date().toISOString(),
  });
}

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

function getCurrentTimeString(now = new Date()) {
  const ISTOffset = 5.5 * 60 * 60 * 1000;
  const IST = new Date(now.getTime() + ISTOffset);
  return `${String(IST.getUTCHours()).padStart(2, '0')}:${String(IST.getUTCMinutes()).padStart(2, '0')}`;
}

function normalizeDays(value: unknown) {
  if (!Array.isArray(value)) {
    return [];
  }

  return value
    .map((entry) => Number(entry))
    .filter((entry, index, array) => Number.isInteger(entry) && entry >= 0 && entry <= 6 && array.indexOf(entry) === index)
    .sort((a, b) => a - b);
}

function validateRushHourPayload(input: RushHourBody, isPartial = false) {
  const errors: string[] = [];
  const payload: Record<string, unknown> = {};

  if (input.label === undefined) {
    if (!isPartial) {
      errors.push('label is required');
    }
  } else if (typeof input.label !== 'string' || !input.label.trim()) {
    errors.push('label must be a non-empty string');
  } else {
    payload.label = input.label.trim();
  }

  if (input.message !== undefined) {
    if (typeof input.message !== 'string') {
      errors.push('message must be a string');
    } else {
      payload.message = input.message.trim() || 'Busy hours — expect slight delays';
    }
  }

  const dayOfWeek = normalizeDays(input.dayOfWeek);
  if (input.dayOfWeek === undefined) {
    if (!isPartial) {
      errors.push('dayOfWeek is required');
    }
  } else if (dayOfWeek.length === 0) {
    errors.push('dayOfWeek must include at least one valid day');
  } else {
    payload.dayOfWeek = dayOfWeek;
  }

  if (input.startTime === undefined) {
    if (!isPartial) {
      errors.push('startTime is required');
    }
  } else if (typeof input.startTime !== 'string' || !TIME_PATTERN.test(input.startTime.trim())) {
    errors.push('startTime must be in HH:MM format');
  } else {
    payload.startTime = input.startTime.trim();
  }

  if (input.endTime === undefined) {
    if (!isPartial) {
      errors.push('endTime is required');
    }
  } else if (typeof input.endTime !== 'string' || !TIME_PATTERN.test(input.endTime.trim())) {
    errors.push('endTime must be in HH:MM format');
  } else {
    payload.endTime = input.endTime.trim();
  }

  const nextStartTime = (payload.startTime as string | undefined) || (typeof input.startTime === 'string' ? input.startTime.trim() : undefined);
  const nextEndTime = (payload.endTime as string | undefined) || (typeof input.endTime === 'string' ? input.endTime.trim() : undefined);

  if (nextStartTime && nextEndTime && nextStartTime >= nextEndTime) {
    errors.push('endTime must be after startTime');
  }

  if (input.surchargePercent !== undefined) {
    if (
      typeof input.surchargePercent !== 'number' ||
      !Number.isFinite(input.surchargePercent) ||
      input.surchargePercent < 0 ||
      input.surchargePercent > 50
    ) {
      errors.push('surchargePercent must be a number between 0 and 50');
    } else {
      payload.surchargePercent = input.surchargePercent;
    }
  } else if (!isPartial) {
    payload.surchargePercent = 0;
  }

  if (input.isActive !== undefined) {
    if (typeof input.isActive !== 'boolean') {
      errors.push('isActive must be a boolean');
    } else {
      payload.isActive = input.isActive;
    }
  }

  return { errors, payload };
}

router.get('/', async (req: Request, res: Response) => {
  try {
    const college = normalizeCollege(req.query.college) || DEFAULT_COLLEGE;
    const now = new Date();
    const ISTOffset = 5.5 * 60 * 60 * 1000;
    const IST = new Date(now.getTime() + ISTOffset);
    const currentDay = IST.getUTCDay();
    const currentTime = getCurrentTimeString(now);

    const rushHours = await RushHour.find({
      college,
      isActive: true,
      dayOfWeek: currentDay,
    })
      .sort({ startTime: 1 })
      .lean();

    const current =
      rushHours.find(
        (entry) => entry.startTime <= currentTime && entry.endTime >= currentTime,
      ) || null;

    res.json({
      isRushHour: Boolean(current),
      current,
      all: rushHours,
    });
  } catch {
    res.status(500).json({ error: 'Failed to fetch rush hours' });
  }
});

router.get(
  '/all',
  requireAuth,
  requireRoles(['staff', 'manager', 'admin']),
  async (req: AuthenticatedRequest, res: Response) => {
    try {
      const requestedCollege = normalizeCollege(req.query.college);
      const college =
        req.user?.role === 'admin'
          ? requestedCollege || req.user.college
          : req.user?.college || DEFAULT_COLLEGE;

      const rushHours = await RushHour.find({ college }).sort({ startTime: 1 }).lean();
      res.json(rushHours);
    } catch {
      res.status(500).json({ error: 'Failed to fetch rush hours' });
    }
  },
);

router.post(
  '/',
  requireAuth,
  requireRoles(['manager', 'admin']),
  async (req: AuthenticatedRequest, res: Response) => {
    try {
      const { errors, payload } = validateRushHourPayload(req.body as RushHourBody);
      if (errors.length > 0) {
        return res.status(400).json({ error: errors.join('. ') });
      }

      const college =
        req.user?.role === 'admin'
          ? normalizeCollege(req.body?.college) || req.user.college
          : req.user?.college || DEFAULT_COLLEGE;

      const rushHour = await RushHour.create({
        ...payload,
        college,
        createdBy: new mongoose.Types.ObjectId(req.user!.id),
      });

      emitRushHourUpdate(college);
      res.status(201).json(rushHour);
    } catch {
      res.status(500).json({ error: 'Failed to create rush hour' });
    }
  },
);

router.patch(
  '/:id',
  requireAuth,
  requireRoles(['manager', 'admin']),
  async (req: AuthenticatedRequest, res: Response) => {
    try {
      if (!mongoose.Types.ObjectId.isValid(req.params.id)) {
        return res.status(400).json({ error: 'Invalid rush hour ID' });
      }

      const rushHour = await RushHour.findById(req.params.id);
      if (!rushHour) {
        return res.status(404).json({ error: 'Rush hour not found' });
      }

      if (req.user?.role !== 'admin' && rushHour.college !== req.user?.college) {
        return res.status(403).json({ error: 'Not authorized for this college rush hour' });
      }

      const previousCollege = resolveCollege(rushHour.college);
      const { errors, payload } = validateRushHourPayload(req.body as RushHourBody, true);
      if (errors.length > 0) {
        return res.status(400).json({ error: errors.join('. ') });
      }

      if (req.user?.role === 'admin' && req.body?.college) {
        const nextCollege = normalizeCollege(req.body.college);
        if (!nextCollege) {
          return res.status(400).json({ error: 'Invalid college' });
        }
        payload.college = nextCollege;
      }

      Object.assign(rushHour, payload);
      await rushHour.save();
      emitRushHourUpdate(resolveCollege(rushHour.college));
      if (previousCollege !== resolveCollege(rushHour.college)) {
        emitRushHourUpdate(previousCollege);
      }
      res.json(rushHour);
    } catch {
      res.status(500).json({ error: 'Failed to update rush hour' });
    }
  },
);

router.delete(
  '/:id',
  requireAuth,
  requireRoles(['manager', 'admin']),
  async (req: AuthenticatedRequest, res: Response) => {
    try {
      if (!mongoose.Types.ObjectId.isValid(req.params.id)) {
        return res.status(400).json({ error: 'Invalid rush hour ID' });
      }

      const rushHour = await RushHour.findById(req.params.id);
      if (!rushHour) {
        return res.status(404).json({ error: 'Rush hour not found' });
      }

      if (req.user?.role !== 'admin' && rushHour.college !== req.user?.college) {
        return res.status(403).json({ error: 'Not authorized for this college rush hour' });
      }

      const deletedCollege = resolveCollege(rushHour.college);
      await rushHour.deleteOne();
      emitRushHourUpdate(deletedCollege);
      res.json({ message: 'Rush hour deleted' });
    } catch {
      res.status(500).json({ error: 'Failed to delete rush hour' });
    }
  },
);

export default router;
