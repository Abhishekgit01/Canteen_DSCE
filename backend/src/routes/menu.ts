import { Router, Request, Response } from 'express';
import { MenuItem } from '../models/index.js';

const router = Router();

// Get all available menu items
router.get('/', async (_req: Request, res: Response) => {
  try {
    const items = await MenuItem.find({ isAvailable: true });
    res.json(items);
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch menu' });
  }
});

// Get all categories
router.get('/categories', async (_req: Request, res: Response) => {
  res.json(['meals', 'snacks', 'beverages', 'desserts']);
});

// Get menu item by ID
router.get('/:id', async (req: Request, res: Response) => {
  try {
    const item = await MenuItem.findById(req.params.id);
    if (!item) return res.status(404).json({ error: 'Menu item not found' });
    res.json(item);
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch item' });
  }
});

export default router;
