import { Router, Request, Response } from 'express';
import { db } from '../db/index.js';
import { authMiddleware, AuthRequest } from '../middleware/auth.js';

const router = Router();

router.use(authMiddleware);

// Get user profile
router.get('/profile', (req: AuthRequest, res: Response) => {
  const user = db.getUser(req.userId!);
  if (!user) {
    return res.status(404).json({ error: 'User not found' });
  }

  res.json({
    id: user.id,
    email: user.email,
    name: user.name,
    rollNumber: user.rollNumber,
    semester: user.semester,
    department: user.department,
    walletBalance: user.walletBalance,
    rewardPoints: user.rewardPoints,
  });
});

// Update user profile
router.patch('/profile', (req: AuthRequest, res: Response) => {
  const { name, semester } = req.body;

  const updated = db.updateUser(req.userId!, { name, semester });
  if (!updated) {
    return res.status(404).json({ error: 'User not found' });
  }

  res.json({
    id: updated.id,
    email: updated.email,
    name: updated.name,
    rollNumber: updated.rollNumber,
    semester: updated.semester,
    department: updated.department,
    walletBalance: updated.walletBalance,
    rewardPoints: updated.rewardPoints,
  });
});

// Get wallet balance
router.get('/wallet', (req: AuthRequest, res: Response) => {
  const user = db.getUser(req.userId!);
  if (!user) {
    return res.status(404).json({ error: 'User not found' });
  }

  res.json({
    balance: user.walletBalance,
    rewardPoints: user.rewardPoints,
  });
});

// Add money to wallet
router.post('/wallet/add', (req: AuthRequest, res: Response) => {
  const { amount } = req.body;

  if (!amount || amount <= 0) {
    return res.status(400).json({ error: 'Valid amount is required' });
  }

  const success = db.addWalletBalance(req.userId!, amount);
  if (!success) {
    return res.status(404).json({ error: 'User not found' });
  }

  const user = db.getUser(req.userId!);
  res.json({
    balance: user?.walletBalance,
    message: `₹${amount} added to wallet`,
  });
});

export default router;
