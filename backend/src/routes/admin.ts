import { Router, Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import mongoose from 'mongoose';
import { Order, User } from '../models/index.js';

const router = Router();
const JWT_SECRET = process.env.JWT_SECRET || 'your-secret-key';

type UserRole = 'student' | 'staff' | 'manager' | 'admin';

interface AuthenticatedRequest extends Request {
  user?: {
    id: string;
    role: UserRole;
    name: string;
    email: string;
    usn: string;
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
    const decoded = jwt.verify(token, JWT_SECRET) as { id?: string; userId?: string };
    const userId = decoded.id || decoded.userId;

    if (!userId || !mongoose.Types.ObjectId.isValid(userId)) {
      return res.status(401).json({ error: 'Invalid token' });
    }

    const user = await User.findById(userId).select('_id role name email usn');
    if (!user) {
      return res.status(401).json({ error: 'User not found' });
    }

    req.user = {
      id: String(user._id),
      role: user.role as UserRole,
      name: user.name,
      email: user.email,
      usn: user.usn,
    };

    next();
  } catch {
    return res.status(401).json({ error: 'Invalid token' });
  }
}

router.get('/profile', requireAuth, requireRoles(['staff', 'manager', 'admin']), async (req: AuthenticatedRequest, res: Response) => {
  try {
    const user = await User.findById(req.user!.id).select('_id name email usn role createdAt');
    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    res.json({
      _id: String(user._id),
      id: String(user._id),
      name: user.name,
      email: user.email,
      usn: user.usn,
      role: user.role,
      createdAt: user.createdAt,
    });
  } catch {
    res.status(500).json({ error: 'Failed to fetch profile' });
  }
});

router.get(
  '/orders',
  requireAuth,
  requireRoles(['staff', 'manager', 'admin']),
  async (_req: AuthenticatedRequest, res: Response) => {
    try {
      const orders = await Order.find({})
        .sort({ createdAt: -1 })
        .populate('userId', 'usn name');

      res.json(
        orders.map((order: any) => ({
          _id: String(order._id),
          userId: {
            usn: order.userId?.usn || 'N/A',
            name: order.userId?.name || 'Unknown',
          },
          items: Array.isArray(order.items)
            ? order.items.map((item: any) => ({
                name: item.name,
                quantity: item.quantity,
              }))
            : [],
          totalAmount: order.totalAmount,
          status: order.status,
          createdAt: order.createdAt,
        })),
      );
    } catch {
      res.status(500).json({ error: 'Failed to fetch orders' });
    }
  },
);

router.get(
  '/stats',
  requireAuth,
  requireRoles(['manager', 'admin']),
  async (_req: AuthenticatedRequest, res: Response) => {
    try {
      const startOfDay = new Date();
      startOfDay.setHours(0, 0, 0, 0);

      const sevenDaysAgo = new Date();
      sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 6);
      sevenDaysAgo.setHours(0, 0, 0, 0);

      const [ordersToday, revenueResult, pendingOrders, popularItems, revenueHistory] = await Promise.all([
        Order.countDocuments({ createdAt: { $gte: startOfDay } }),
        Order.aggregate([
          {
            $match: {
              createdAt: { $gte: startOfDay },
              status: { $in: ['paid', 'preparing', 'ready', 'fulfilled'] },
            },
          },
          {
            $group: {
              _id: null,
              total: { $sum: '$totalAmount' },
            },
          },
        ]),
        Order.countDocuments({ status: { $in: ['paid', 'preparing', 'ready'] } }),
        Order.aggregate([
          { $unwind: '$items' },
          {
            $group: {
              _id: '$items.name',
              quantity: { $sum: '$items.quantity' },
            },
          },
          { $sort: { quantity: -1 } },
          { $limit: 1 },
        ]),
        Order.aggregate([
          {
            $match: {
              createdAt: { $gte: sevenDaysAgo },
              status: { $in: ['paid', 'preparing', 'ready', 'fulfilled'] },
            },
          },
          {
            $group: {
              _id: { $dateToString: { format: '%Y-%m-%d', date: '$createdAt' } },
              revenue: { $sum: '$totalAmount' },
            },
          },
          { $sort: { _id: 1 } },
        ]),
      ]);

      res.json({
        ordersToday,
        revenueToday: revenueResult[0]?.total || 0,
        pendingOrders,
        popularItem: popularItems[0]?._id || 'None',
        revenueHistory: revenueHistory.map((day) => ({
          date: day._id,
          revenue: day.revenue,
        })),
      });
    } catch {
      res.status(500).json({ error: 'Failed to fetch stats' });
    }
  },
);

router.get(
  '/users',
  requireAuth,
  requireRoles(['admin']),
  async (_req: AuthenticatedRequest, res: Response) => {
    try {
      const users = await User.find({})
        .select('_id name usn email role createdAt')
        .sort({ createdAt: -1 });

      res.json(
        users.map((user) => ({
          _id: String(user._id),
          name: user.name,
          usn: user.usn,
          email: user.email,
          role: user.role,
          createdAt: user.createdAt,
        })),
      );
    } catch {
      res.status(500).json({ error: 'Failed to fetch users' });
    }
  },
);

router.patch(
  '/users/:id/role',
  requireAuth,
  requireRoles(['admin']),
  async (req: AuthenticatedRequest, res: Response) => {
    try {
      const { role } = req.body as { role?: UserRole };
      const allowedRoles: UserRole[] = ['student', 'staff', 'manager'];

      if (!role || !allowedRoles.includes(role)) {
        return res.status(400).json({ error: 'Invalid role. Cannot assign admin role.' });
      }

      if (!mongoose.Types.ObjectId.isValid(req.params.id)) {
        return res.status(400).json({ error: 'Invalid user ID' });
      }

      if (req.params.id === req.user!.id) {
        return res.status(400).json({ error: 'You cannot change your own role' });
      }

      const user = await User.findByIdAndUpdate(
        req.params.id,
        { role },
        { new: true, runValidators: true },
      ).select('_id name usn email role createdAt');

      if (!user) {
        return res.status(404).json({ error: 'User not found' });
      }

      res.json({
        _id: String(user._id),
        name: user.name,
        usn: user.usn,
        email: user.email,
        role: user.role,
        createdAt: user.createdAt,
      });
    } catch {
      res.status(500).json({ error: 'Failed to update role' });
    }
  },
);

export default router;
