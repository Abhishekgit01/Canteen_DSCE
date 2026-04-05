import { Router, Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import mongoose from 'mongoose';
import { clearMenuCache } from '../cache/menuCache.js';
import { normalizeCollege, resolveCollege, type SupportedCollege } from '../config/college.js';
import { MenuItem, Order, Review, User } from '../models/index.js';

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

type ReviewDocumentLike = {
  _id: mongoose.Types.ObjectId | string;
  menuItemId?: { _id?: mongoose.Types.ObjectId | string; name?: string } | mongoose.Types.ObjectId | string;
  orderId?: mongoose.Types.ObjectId | string;
  userId?: {
    _id?: mongoose.Types.ObjectId | string;
    name?: string;
    college?: string;
    email?: string;
  } | mongoose.Types.ObjectId | string;
  college?: string;
  rating?: number;
  title?: string;
  body?: string;
  tags?: string[];
  helpful?: number;
  isVerified?: boolean;
  isVisible?: boolean;
  createdAt?: Date | string;
};

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

function mapReview(review: ReviewDocumentLike) {
  const populatedMenuItem =
    review.menuItemId && typeof review.menuItemId === 'object' && '_id' in review.menuItemId
      ? (review.menuItemId as { _id?: mongoose.Types.ObjectId | string; name?: string })
      : null;
  const menuItem = populatedMenuItem
    ? {
        id: String(populatedMenuItem._id),
        name: populatedMenuItem.name || '',
      }
    : undefined;

  const populatedStudent =
    review.userId && typeof review.userId === 'object' && '_id' in review.userId
      ? (review.userId as {
          _id?: mongoose.Types.ObjectId | string;
          name?: string;
          college?: string;
          email?: string;
        })
      : null;
  const student = populatedStudent
    ? {
        id: String(populatedStudent._id),
        name: populatedStudent.name || 'Student',
        college: resolveCollege(populatedStudent.college),
        email: populatedStudent.email,
      }
    : undefined;

  return {
    _id: String(review._id),
    id: String(review._id),
    menuItemId: menuItem?.id || String(review.menuItemId || ''),
    orderId: String(review.orderId || ''),
    menuItem,
    student,
    college: resolveCollege(review.college),
    rating: review.rating || 0,
    title: review.title || '',
    body: review.body || '',
    tags: Array.isArray(review.tags) ? review.tags : [],
    helpful: review.helpful || 0,
    isVerified: review.isVerified !== false,
    isVisible: review.isVisible !== false,
    createdAt: review.createdAt,
  };
}

function sanitizeReviewTags(tags: unknown) {
  if (!Array.isArray(tags)) {
    return [];
  }

  return tags
    .map((tag) => (typeof tag === 'string' ? tag.trim().slice(0, 40) : ''))
    .filter(Boolean)
    .slice(0, 5);
}

async function updateMenuItemRating(menuItemId: string) {
  const stats = await Review.aggregate([
    {
      $match: {
        menuItemId: new mongoose.Types.ObjectId(menuItemId),
        isVisible: true,
      },
    },
    {
      $group: {
        _id: null,
        averageRating: { $avg: '$rating' },
        totalReviews: { $sum: 1 },
        r1: { $sum: { $cond: [{ $eq: ['$rating', 1] }, 1, 0] } },
        r2: { $sum: { $cond: [{ $eq: ['$rating', 2] }, 1, 0] } },
        r3: { $sum: { $cond: [{ $eq: ['$rating', 3] }, 1, 0] } },
        r4: { $sum: { $cond: [{ $eq: ['$rating', 4] }, 1, 0] } },
        r5: { $sum: { $cond: [{ $eq: ['$rating', 5] }, 1, 0] } },
      },
    },
  ]);

  const summary = stats[0] ?? {
    averageRating: 0,
    totalReviews: 0,
    r1: 0,
    r2: 0,
    r3: 0,
    r4: 0,
    r5: 0,
  };

  const item = await MenuItem.findByIdAndUpdate(
    menuItemId,
    {
      averageRating: Math.round((summary.averageRating || 0) * 10) / 10,
      totalReviews: summary.totalReviews,
      'ratingBreakdown.1': summary.r1,
      'ratingBreakdown.2': summary.r2,
      'ratingBreakdown.3': summary.r3,
      'ratingBreakdown.4': summary.r4,
      'ratingBreakdown.5': summary.r5,
    },
    { new: true },
  )
    .select('college')
    .lean();

  if (item?.college) {
    clearMenuCache(resolveCollege(item.college));
  }
}

router.get('/menu/:menuItemId', async (req: Request, res: Response) => {
  try {
    if (!mongoose.Types.ObjectId.isValid(req.params.menuItemId)) {
      return res.status(400).json({ error: 'Invalid menu item ID' });
    }

    const page = Math.max(1, Number(req.query.page) || 1);
    const limit = Math.min(20, Math.max(1, Number(req.query.limit) || 10));
    const sort = typeof req.query.sort === 'string' ? req.query.sort : 'recent';
    const sortOptions: Record<string, Record<string, 1 | -1>> = {
      recent: { createdAt: -1 },
      helpful: { helpful: -1, createdAt: -1 },
      highest: { rating: -1, createdAt: -1 },
      lowest: { rating: 1, createdAt: -1 },
    };

    const filter = {
      menuItemId: req.params.menuItemId,
      isVisible: true,
    };

    const [reviews, total, menuItem] = await Promise.all([
      Review.find(filter)
        .populate('userId', 'name college')
        .sort(sortOptions[sort] || sortOptions.recent)
        .skip((page - 1) * limit)
        .limit(limit)
        .lean(),
      Review.countDocuments(filter),
      MenuItem.findById(req.params.menuItemId)
        .select('name averageRating totalReviews ratingBreakdown')
        .lean(),
    ]);

    res.json({
      menuItem,
      reviews: reviews.map(mapReview),
      pagination: {
        page,
        limit,
        total,
        pages: Math.ceil(total / limit),
      },
    });
  } catch {
    res.status(500).json({ error: 'Failed to fetch reviews' });
  }
});

router.get('/pending', requireAuth, requireRoles(['student']), async (req: AuthenticatedRequest, res: Response) => {
  try {
    const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
    const orders = await Order.find({
      userId: req.user!.id,
      status: 'fulfilled',
      createdAt: { $gte: sevenDaysAgo },
    })
      .sort({ createdAt: -1 })
      .lean();

    const reviewed = await Review.find({
      userId: req.user!.id,
      orderId: { $in: orders.map((order) => order._id) },
    })
      .select('orderId menuItemId')
      .lean();

    const reviewedSet = new Set(
      reviewed.map((entry) => `${String(entry.orderId)}:${String(entry.menuItemId)}`),
    );

    const menuItemIds = Array.from(
      new Set(
        orders.flatMap((order) =>
          order.items
            .map((item) => String(item.menuItemId || ''))
            .filter((menuItemId) => mongoose.Types.ObjectId.isValid(menuItemId)),
        ),
      ),
    );

    const menuItems = await MenuItem.find({ _id: { $in: menuItemIds } })
      .select('name imageUrl averageRating totalReviews')
      .lean();

    const menuItemMap = new Map(menuItems.map((item) => [String(item._id), item]));

    const pending = orders.flatMap((order) =>
      order.items
        .filter((item) => !reviewedSet.has(`${String(order._id)}:${String(item.menuItemId)}`))
        .map((item) => {
          const menuItem = menuItemMap.get(String(item.menuItemId));

          return {
            orderId: String(order._id),
            orderDate: order.createdAt,
            menuItem: {
              id: String(item.menuItemId),
              name: menuItem?.name || item.name || 'Menu item',
              imageUrl: menuItem?.imageUrl || '',
              averageRating: menuItem?.averageRating || 0,
              totalReviews: menuItem?.totalReviews || 0,
            },
          };
        }),
    );

    res.json(pending);
  } catch {
    res.status(500).json({ error: 'Failed to fetch pending reviews' });
  }
});

router.post('/', requireAuth, requireRoles(['student']), async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { menuItemId, orderId, rating, title, body, tags } = req.body as {
      menuItemId?: string;
      orderId?: string;
      rating?: number;
      title?: string;
      body?: string;
      tags?: string[];
    };

    if (
      !menuItemId ||
      !orderId ||
      !mongoose.Types.ObjectId.isValid(menuItemId) ||
      !mongoose.Types.ObjectId.isValid(orderId)
    ) {
      return res.status(400).json({ error: 'Valid order and menu item are required' });
    }

    if (!rating || rating < 1 || rating > 5) {
      return res.status(400).json({ error: 'Rating must be between 1 and 5' });
    }

    const order = await Order.findOne({
      _id: orderId,
      userId: req.user!.id,
      status: 'fulfilled',
      'items.menuItemId': menuItemId,
    }).lean();

    if (!order) {
      return res.status(403).json({ error: 'You can only review items from completed orders' });
    }

    const existingReview = await Review.findOne({
      orderId,
      menuItemId,
      userId: req.user!.id,
    })
      .select('_id')
      .lean();

    if (existingReview) {
      return res.status(409).json({ error: 'Already reviewed this item' });
    }

    const review = await Review.create({
      menuItemId,
      orderId,
      userId: req.user!.id,
      college: req.user!.college,
      rating,
      title: typeof title === 'string' ? title.trim().slice(0, 100) : '',
      body: typeof body === 'string' ? body.trim().slice(0, 500) : '',
      tags: sanitizeReviewTags(tags),
      isVerified: true,
      isVisible: true,
    });

    await updateMenuItemRating(menuItemId);

    const populatedReview = await Review.findById(review._id)
      .populate('userId', 'name college')
      .lean();

    res.status(201).json(populatedReview ? mapReview(populatedReview) : mapReview(review.toObject()));
  } catch {
    res.status(500).json({ error: 'Failed to submit review' });
  }
});

router.post('/:id/helpful', requireAuth, async (req: AuthenticatedRequest, res: Response) => {
  try {
    if (!mongoose.Types.ObjectId.isValid(req.params.id)) {
      return res.status(400).json({ error: 'Invalid review ID' });
    }

    const review = await Review.findByIdAndUpdate(
      req.params.id,
      { $inc: { helpful: 1 } },
      { new: true },
    )
      .select('helpful')
      .lean();

    if (!review) {
      return res.status(404).json({ error: 'Review not found' });
    }

    res.json({ helpful: review.helpful || 0 });
  } catch {
    res.status(500).json({ error: 'Failed to mark review as helpful' });
  }
});

router.get(
  '/admin',
  requireAuth,
  requireRoles(['manager', 'admin']),
  async (req: AuthenticatedRequest, res: Response) => {
    try {
      const requestedCollege = normalizeCollege(req.query.college);
      const requestedMenuItemId =
        typeof req.query.menuItemId === 'string' && mongoose.Types.ObjectId.isValid(req.query.menuItemId)
          ? req.query.menuItemId
          : undefined;
      const visibilityParam = typeof req.query.isVisible === 'string' ? req.query.isVisible : undefined;

      const filter: Record<string, unknown> = {};
      if (req.user?.role === 'admin') {
        if (requestedCollege) {
          filter.college = requestedCollege;
        }
      } else {
        filter.college = req.user!.college;
      }

      if (requestedMenuItemId) {
        filter.menuItemId = requestedMenuItemId;
      }

      if (visibilityParam !== undefined) {
        filter.isVisible = visibilityParam === 'true';
      }

      const reviews = await Review.find(filter)
        .populate('userId', 'name college email')
        .populate('menuItemId', 'name')
        .sort({ createdAt: -1 })
        .limit(100)
        .lean();

      res.json(reviews.map(mapReview));
    } catch {
      res.status(500).json({ error: 'Failed to fetch reviews' });
    }
  },
);

router.patch(
  '/:id/visibility',
  requireAuth,
  requireRoles(['manager', 'admin']),
  async (req: AuthenticatedRequest, res: Response) => {
    try {
      if (!mongoose.Types.ObjectId.isValid(req.params.id)) {
        return res.status(400).json({ error: 'Invalid review ID' });
      }

      const { isVisible } = req.body as { isVisible?: boolean };
      if (typeof isVisible !== 'boolean') {
        return res.status(400).json({ error: 'isVisible must be a boolean' });
      }

      const existingReview = await Review.findById(req.params.id).select('college menuItemId');
      if (!existingReview) {
        return res.status(404).json({ error: 'Review not found' });
      }

      if (req.user?.role !== 'admin' && resolveCollege(existingReview.college) !== req.user?.college) {
        return res.status(403).json({ error: 'Not authorized for this college review' });
      }

      existingReview.isVisible = isVisible;
      await existingReview.save();
      await updateMenuItemRating(String(existingReview.menuItemId));

      const populatedReview = await Review.findById(existingReview._id)
        .populate('userId', 'name college email')
        .populate('menuItemId', 'name')
        .lean();

      res.json(populatedReview ? mapReview(populatedReview) : null);
    } catch {
      res.status(500).json({ error: 'Failed to update review visibility' });
    }
  },
);

export default router;
