import { Router, Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import mongoose from 'mongoose';
import { MenuItem, User } from '../models/index.js';

const router = Router();
const JWT_SECRET = process.env.JWT_SECRET || 'your-secret-key';
const categories = ['meals', 'snacks', 'beverages', 'desserts'] as const;
const temperatureOptions = ['cold', 'normal', 'hot'] as const;

type UserRole = 'student' | 'staff' | 'manager' | 'admin';

interface AuthenticatedRequest extends Request {
  user?: {
    id: string;
    role: UserRole;
  };
}

type MenuBody = {
  name?: string;
  description?: string;
  imageUrl?: string;
  price?: number;
  calories?: number;
  category?: string;
  tempOptions?: string[];
  isAvailable?: boolean;
  preparationMinutes?: number;
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
    const decoded = jwt.verify(token, JWT_SECRET) as { id: string };
    const user = await User.findById(decoded.id).select('_id role');

    if (!user) {
      return res.status(401).json({ error: 'User not found' });
    }

    req.user = {
      id: String(user._id),
      role: user.role as UserRole,
    };

    next();
  } catch {
    return res.status(401).json({ error: 'Invalid token' });
  }
}

function validateMenuPayload(input: MenuBody, isPartial = false) {
  const errors: string[] = [];
  const payload: Record<string, unknown> = {};

  const addString = (key: 'name' | 'description' | 'imageUrl') => {
    const value = input[key];

    if (value === undefined) {
      if (!isPartial) {
        errors.push(`${key} is required`);
      }
      return;
    }

    if (typeof value !== 'string' || !value.trim()) {
      errors.push(`${key} must be a non-empty string`);
      return;
    }

    payload[key] = value.trim();
  };

  addString('name');
  addString('description');
  addString('imageUrl');

  if (input.price === undefined) {
    if (!isPartial) {
      errors.push('price is required');
    }
  } else if (typeof input.price !== 'number' || !Number.isFinite(input.price) || input.price < 1) {
    errors.push('price must be a number greater than 0');
  } else {
    payload.price = input.price;
  }

  if (input.calories === undefined) {
    if (!isPartial) {
      errors.push('calories is required');
    }
  } else if (
    typeof input.calories !== 'number' ||
    !Number.isFinite(input.calories) ||
    input.calories < 0
  ) {
    errors.push('calories must be a number greater than or equal to 0');
  } else {
    payload.calories = input.calories;
  }

  if (input.category === undefined) {
    if (!isPartial) {
      errors.push('category is required');
    }
  } else if (!categories.includes(input.category as (typeof categories)[number])) {
    errors.push(`category must be one of: ${categories.join(', ')}`);
  } else {
    payload.category = input.category;
  }

  if (input.tempOptions !== undefined) {
    if (
      !Array.isArray(input.tempOptions) ||
      input.tempOptions.some(
        (option) => !temperatureOptions.includes(option as (typeof temperatureOptions)[number]),
      )
    ) {
      errors.push(`tempOptions must only include: ${temperatureOptions.join(', ')}`);
    } else {
      payload.tempOptions = input.tempOptions;
    }
  } else if (!isPartial) {
    payload.tempOptions = [];
  }

  if (input.isAvailable !== undefined) {
    if (typeof input.isAvailable !== 'boolean') {
      errors.push('isAvailable must be a boolean');
    } else {
      payload.isAvailable = input.isAvailable;
    }
  }

  if (input.preparationMinutes !== undefined) {
    if (
      typeof input.preparationMinutes !== 'number' ||
      !Number.isFinite(input.preparationMinutes) ||
      input.preparationMinutes < 0
    ) {
      errors.push('preparationMinutes must be a number greater than or equal to 0');
    } else {
      payload.preparationMinutes = input.preparationMinutes;
    }
  }

  return { errors, payload };
}

router.get('/', async (_req: Request, res: Response) => {
  try {
    const items = await MenuItem.find({ isAvailable: true }).sort({ category: 1, name: 1 });
    res.json(items);
  } catch {
    res.status(500).json({ error: 'Failed to fetch menu' });
  }
});

router.get('/categories', async (_req: Request, res: Response) => {
  res.json(categories);
});

router.post(
  '/',
  requireAuth,
  requireRoles(['manager', 'admin']),
  async (req: AuthenticatedRequest, res: Response) => {
    try {
      const { errors, payload } = validateMenuPayload(req.body as MenuBody);

      if (errors.length > 0) {
        return res.status(400).json({ error: errors.join('. ') });
      }

      const item = await MenuItem.create(payload);
      res.status(201).json(item);
    } catch {
      res.status(500).json({ error: 'Failed to create menu item' });
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
        return res.status(400).json({ error: 'Invalid menu item ID' });
      }

      const { errors, payload } = validateMenuPayload(req.body as MenuBody, true);

      if (errors.length > 0) {
        return res.status(400).json({ error: errors.join('. ') });
      }

      if (Object.keys(payload).length === 0) {
        return res.status(400).json({ error: 'No valid fields provided for update' });
      }

      const item = await MenuItem.findByIdAndUpdate(req.params.id, payload, {
        new: true,
        runValidators: true,
      });

      if (!item) {
        return res.status(404).json({ error: 'Menu item not found' });
      }

      res.json(item);
    } catch {
      res.status(500).json({ error: 'Failed to update menu item' });
    }
  },
);

router.delete(
  '/:id',
  requireAuth,
  requireRoles(['admin']),
  async (req: AuthenticatedRequest, res: Response) => {
    try {
      if (!mongoose.Types.ObjectId.isValid(req.params.id)) {
        return res.status(400).json({ error: 'Invalid menu item ID' });
      }

      const item = await MenuItem.findByIdAndUpdate(
        req.params.id,
        { isAvailable: false },
        { new: true },
      );

      if (!item) {
        return res.status(404).json({ error: 'Menu item not found' });
      }

      res.json({ success: true, item });
    } catch {
      res.status(500).json({ error: 'Failed to delete menu item' });
    }
  },
);

router.get('/:id', async (req: Request, res: Response) => {
  try {
    if (!mongoose.Types.ObjectId.isValid(req.params.id)) {
      return res.status(400).json({ error: 'Invalid menu item ID' });
    }

    const item = await MenuItem.findById(req.params.id);
    if (!item) {
      return res.status(404).json({ error: 'Menu item not found' });
    }

    res.json(item);
  } catch {
    res.status(500).json({ error: 'Failed to fetch item' });
  }
});

export default router;
