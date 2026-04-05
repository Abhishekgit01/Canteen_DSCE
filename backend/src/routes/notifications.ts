import { Router, Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import mongoose from 'mongoose';
import { normalizeCollege, resolveCollege, type SupportedCollege } from '../config/college.js';
import { MenuItem, NotificationLog, User } from '../models/index.js';
import {
  isExpoPushToken,
  NotificationTemplates,
  sendBulkPushNotification,
} from '../services/notification.service.js';

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
    const decoded = jwt.verify(token, JWT_SECRET as string) as jwt.JwtPayload & { id?: string };
    const userId = decoded.id;

    if (!userId || !mongoose.Types.ObjectId.isValid(userId)) {
      return res.status(401).json({ error: 'Invalid token' });
    }

    const user = await User.findById(userId).select('_id role college').lean();
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

router.post('/token', requireAuth, async (req: AuthenticatedRequest, res: Response) => {
  const { expoPushToken } = req.body as { expoPushToken?: string };

  if (!expoPushToken) {
    return res.status(400).json({ error: 'Token required' });
  }

  if (!isExpoPushToken(expoPushToken)) {
    return res.status(400).json({ error: 'Invalid Expo push token' });
  }

  await User.findByIdAndUpdate(req.user!.id, { expoPushToken }, { new: true });
  res.json({ message: 'Push token saved' });
});

router.delete('/token', requireAuth, async (req: AuthenticatedRequest, res: Response) => {
  await User.findByIdAndUpdate(req.user!.id, { expoPushToken: null });
  res.json({ message: 'Push token cleared' });
});

router.get(
  '/history',
  requireAuth,
  requireRoles(['manager', 'admin']),
  async (req: AuthenticatedRequest, res: Response) => {
    try {
      const requestedCollege = normalizeCollege(req.query.college);
      const filter =
        req.user?.role === 'admin'
          ? requestedCollege
            ? { college: requestedCollege }
            : {}
          : { college: req.user!.college };

      const history = await NotificationLog.find(filter)
        .sort({ createdAt: -1 })
        .limit(20)
        .populate('senderId', 'name role')
        .populate('menuItemId', 'name')
        .lean();

      res.json(history);
    } catch {
      res.status(500).json({ error: 'Failed to fetch notification history' });
    }
  },
);

router.post(
  '/broadcast',
  requireAuth,
  requireRoles(['manager', 'admin']),
  async (req: AuthenticatedRequest, res: Response) => {
    try {
      const { title, body, college, type } = req.body as {
        title?: string;
        body?: string;
        college?: string;
        type?: 'broadcast' | 'rush_warning';
      };

      const normalizedTitle = typeof title === 'string' ? title.trim() : '';
      const normalizedBody = typeof body === 'string' ? body.trim() : '';

      if (!normalizedTitle || !normalizedBody) {
        return res.status(400).json({ error: 'Title and body are required' });
      }

      const targetCollege =
        req.user?.role === 'admin'
          ? normalizeCollege(college) || req.user.college
          : req.user!.college;

      const users = await User.find({
        college: targetCollege,
        role: 'student',
        expoPushToken: { $ne: null },
      })
        .select('expoPushToken')
        .lean();

      const tokens = users
        .map((user) => user.expoPushToken)
        .filter((token): token is string => Boolean(token));

      sendBulkPushNotification(tokens, normalizedTitle, normalizedBody, {
        screen: 'Main',
        tab: 'Home',
        type: type || 'broadcast',
        college: targetCollege,
      }).catch((error) => console.error('Broadcast notification failed:', error));

      await NotificationLog.create({
        type: type || 'broadcast',
        title: normalizedTitle,
        body: normalizedBody,
        college: targetCollege,
        recipientCount: tokens.length,
        senderId: req.user!.id,
      });

      res.json({
        message: 'Broadcast sent',
        recipients: tokens.length,
      });
    } catch {
      res.status(500).json({ error: 'Failed to send broadcast notification' });
    }
  },
);

router.post(
  '/daily-special',
  requireAuth,
  requireRoles(['manager', 'admin']),
  async (req: AuthenticatedRequest, res: Response) => {
    try {
      const { menuItemId } = req.body as { menuItemId?: string };

      if (!menuItemId || !mongoose.Types.ObjectId.isValid(menuItemId)) {
        return res.status(400).json({ error: 'Valid menu item is required' });
      }

      const item = await MenuItem.findById(menuItemId).select('name price college').lean();
      if (!item) {
        return res.status(404).json({ error: 'Item not found' });
      }

      const itemCollege = resolveCollege(item.college);
      if (req.user?.role !== 'admin' && itemCollege !== req.user?.college) {
        return res.status(403).json({ error: 'Not authorized for this college menu item' });
      }

      const users = await User.find({
        college: itemCollege,
        role: 'student',
        expoPushToken: { $ne: null },
      })
        .select('expoPushToken')
        .lean();

      const tokens = users
        .map((user) => user.expoPushToken)
        .filter((token): token is string => Boolean(token));

      const template = NotificationTemplates.dailySpecial(item.name, item.price, itemCollege);
      sendBulkPushNotification(tokens, template.title, template.body, template.data).catch((error) =>
        console.error('Daily special notification failed:', error),
      );

      await NotificationLog.create({
        type: 'daily_special',
        title: template.title,
        body: template.body,
        college: itemCollege,
        recipientCount: tokens.length,
        senderId: req.user!.id,
        menuItemId: item._id,
      });

      res.json({
        message: 'Daily special announced',
        recipients: tokens.length,
      });
    } catch {
      res.status(500).json({ error: 'Failed to announce daily special' });
    }
  },
);

export default router;
