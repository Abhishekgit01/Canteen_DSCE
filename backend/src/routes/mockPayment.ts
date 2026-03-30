import { Router, Request, Response } from 'express';
import { Order, MenuItem } from '../models/index.js';
import jwt from 'jsonwebtoken';
import crypto from 'crypto';

const router = Router();
const JWT_SECRET = process.env.JWT_SECRET || 'your-secret-key';
const QR_SECRET = process.env.QR_SECRET || 'qr-secret-key';

// Auth middleware
const authMiddleware = async (req: Request, res: Response, next: any) => {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader?.startsWith('Bearer ')) {
      return res.status(401).json({ error: 'No token' });
    }
    const token = authHeader.split(' ')[1];
    const decoded = jwt.verify(token, JWT_SECRET) as { id: string };
    (req as any).userId = decoded.id;
    next();
  } catch {
    res.status(401).json({ error: 'Invalid token' });
  }
};

// MOCK PAYMENT SYSTEM - Simulates Razorpay for testing
// No PAN/KYC required. For production, replace with real Razorpay integration

// Create mock order
router.post('/mock/create', authMiddleware, async (req: Request, res: Response) => {
  try {
    const { items } = req.body;
    const userId = (req as any).userId;

    // Calculate total
    let totalAmount = 0;
    const orderItems = [];
    for (const item of items) {
      const menuItem = await MenuItem.findById(item.menuItemId);
      if (menuItem) {
        totalAmount += menuItem.price * item.quantity;
        orderItems.push({
          menuItemId: item.menuItemId,
          quantity: item.quantity,
          name: menuItem.name,
          price: menuItem.price,
        });
      }
    }

    // Create mock Razorpay-like order ID
    const mockOrderId = `order_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

    // Create order with pending status
    const order = await Order.create({
      userId,
      items: orderItems,
      totalAmount,
      status: 'pending_payment',
      paymentMethod: 'razorpay_test',
      paymentStatus: 'pending',
      razorpayOrderId: mockOrderId,
    });

    // Mock Razorpay-style response
    res.json({
      success: true,
      orderId: order._id,
      razorpayOrderId: mockOrderId,
      amount: totalAmount * 100, // Razorpay uses paise
      currency: 'INR',
      key: 'rzp_test_mock_key_for_testing',
      notes: {
        orderId: order._id.toString(),
      },
    });
  } catch (error) {
    console.error('Mock order creation error:', error);
    res.status(500).json({ error: 'Failed to create order' });
  }
});

// Mock payment success - simulates Razorpay webhook
router.post('/mock/verify', authMiddleware, async (req: Request, res: Response) => {
  try {
    const { 
      razorpay_order_id, 
      razorpay_payment_id, 
      razorpay_signature 
    } = req.body;

    const userId = (req as any).userId;

    // Find order
    const order = await Order.findOne({ 
      razorpayOrderId: razorpay_order_id,
      userId 
    });

    if (!order) {
      return res.status(404).json({ error: 'Order not found' });
    }

    // In real Razorpay, verify signature here
    // For mock, we just accept it

    // Generate QR token for pickup
    const qrToken = jwt.sign(
      { orderId: order._id, orderNumber: order.razorpayOrderId },
      QR_SECRET,
      { expiresIn: '24h' }
    );

    // Update order as paid
    order.status = 'paid';
    order.paymentStatus = 'completed';
    order.razorpayPaymentId = razorpay_payment_id;
    order.qrToken = qrToken;
    order.paidAt = new Date();
    await order.save();

    // Mock webhook notification to admin panel
    // In real implementation, this would be called by Razorpay
    
    res.json({
      success: true,
      message: 'Payment verified',
      orderId: order._id,
      qrToken,
    });
  } catch (error) {
    console.error('Mock verify error:', error);
    res.status(500).json({ error: 'Verification failed' });
  }
});

// Mock payment page - for testing without mobile app
router.get('/mock/pay/:orderId', async (req: Request, res: Response) => {
  try {
    const order = await Order.findById(req.params.orderId).populate('items.menuItemId');
    if (!order) {
      return res.status(404).send('Order not found');
    }

    // Simple HTML payment simulation
    const html = `
    <!DOCTYPE html>
    <html>
    <head>
      <title>DSCE Canteen - Test Payment</title>
      <style>
        body { font-family: Arial, sans-serif; background: #0a0f1e; color: white; padding: 40px; max-width: 500px; margin: 0 auto; }
        .card { background: #1e293b; padding: 30px; border-radius: 16px; }
        h1 { color: #f97316; margin-bottom: 30px; }
        .amount { font-size: 48px; color: #22c55e; font-weight: bold; margin: 20px 0; }
        .order-id { color: #8892a4; margin-bottom: 20px; }
        .items { background: #334155; padding: 15px; border-radius: 8px; margin-bottom: 20px; }
        .item { display: flex; justify-content: space-between; margin: 8px 0; }
        button { background: #22c55e; color: white; border: none; padding: 18px 40px; font-size: 18px; border-radius: 12px; cursor: pointer; width: 100%; margin-top: 20px; }
        button:hover { background: #16a34a; }
        .test-badge { background: #dc2626; color: white; padding: 8px 16px; border-radius: 4px; font-size: 12px; display: inline-block; margin-bottom: 20px; }
        .note { color: #8892a4; font-size: 14px; margin-top: 20px; }
      </style>
    </head>
    <body>
      <div class="card">
        <span class="test-badge">TEST MODE - NO REAL MONEY</span>
        <h1>DSCE Canteen</h1>
        <div class="order-id">Order: ${order.razorpayOrderId}</div>
        <div class="amount">₹${order.totalAmount}</div>
        
        <div class="items">
          <strong>Items:</strong>
          ${order.items.map((item: any) => `
            <div class="item">
              <span>${item.name} x${item.quantity}</span>
              <span>₹${item.price * item.quantity}</span>
            </div>
          `).join('')}
        </div>

        <button onclick="simulatePayment()">Simulate Payment (Success)</button>
        
        <p class="note">
          This is a test payment. No real transaction will occur.<br>
          Click the button to simulate a successful payment.
        </p>
      </div>

      <script>
        async function simulatePayment() {
          const button = document.querySelector('button');
          button.disabled = true;
          button.textContent = 'Processing...';

          // Simulate API call delay
          await new Promise(r => setTimeout(r, 1500));

          // Generate mock payment ID
          const mockPaymentId = 'pay_' + Date.now();

          // Redirect to success
          window.location.href = '/payment/mock/success?order_id=${order._id}&payment_id=' + mockPaymentId;
        }
      </script>
    </body>
    </html>`;

    res.send(html);
  } catch (error) {
    res.status(500).send('Error loading payment page');
  }
});

// Success page after mock payment
router.get('/mock/success', async (req: Request, res: Response) => {
  try {
    const { order_id, payment_id } = req.query;

    const order = await Order.findById(order_id);
    if (!order) {
      return res.status(404).send('Order not found');
    }

    // Update order
    if (order.paymentStatus !== 'completed') {
      const qrToken = jwt.sign(
        { orderId: order._id, orderNumber: order.razorpayOrderId },
        QR_SECRET,
        { expiresIn: '24h' }
      );

      order.status = 'paid';
      order.paymentStatus = 'completed';
      order.razorpayPaymentId = payment_id as string;
      order.qrToken = qrToken;
      order.paidAt = new Date();
      await order.save();
    }

    res.send(`
    <!DOCTYPE html>
    <html>
    <head>
      <title>Payment Success</title>
      <style>
        body { font-family: Arial, sans-serif; background: #0a0f1e; color: white; padding: 40px; text-align: center; }
        .success { background: #22c55e; padding: 40px; border-radius: 16px; max-width: 400px; margin: 50px auto; }
        h1 { margin-bottom: 20px; }
        .check { font-size: 64px; }
        .details { background: #1e293b; padding: 20px; border-radius: 8px; margin-top: 20px; }
        .qr { margin-top: 20px; }
        .qr img { max-width: 200px; }
      </style>
    </head>
    <body>
      <div class="success">
        <div class="check">✓</div>
        <h1>Payment Successful!</h1>
        <p>Order: ${order.razorpayOrderId}</p>
        <p>Amount: ₹${order.totalAmount}</p>
        <div class="details">
          <p><strong>Status:</strong> PAID</p>
          <p><strong>Payment ID:</strong> ${payment_id}</p>
          <p>Show this screen when collecting your order.</p>
        </div>
        <div class="qr">
          <p>Your Pickup QR Code:</p>
          <img src="https://api.qrserver.com/v1/create-qr-code/?size=200x200&data=${order.qrToken}" />
        </div>
      </div>
    </body>
    </html>`);
  } catch (error) {
    res.status(500).send('Error processing success');
  }
});

// Get payment status
router.get('/mock/status/:orderId', authMiddleware, async (req: Request, res: Response) => {
  try {
    const order = await Order.findOne({
      _id: req.params.orderId,
      userId: (req as any).userId,
    });

    if (!order) {
      return res.status(404).json({ error: 'Order not found' });
    }

    res.json({
      orderId: order._id,
      razorpayOrderId: order.razorpayOrderId,
      status: order.status,
      paymentStatus: order.paymentStatus,
      amount: order.totalAmount,
      qrToken: order.qrToken,
      paidAt: order.paidAt,
    });
  } catch (error) {
    res.status(500).json({ error: 'Status check failed' });
  }
});

// For admin: manually mark order as paid (for testing)
router.post('/mock/admin/mark-paid', async (req: Request, res: Response) => {
  try {
    const { orderId, adminSecret } = req.body;

    // Simple admin check
    if (adminSecret !== process.env.ADMIN_SECRET) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    const order = await Order.findById(orderId);
    if (!order) {
      return res.status(404).json({ error: 'Order not found' });
    }

    const qrToken = jwt.sign(
      { orderId: order._id, orderNumber: order.razorpayOrderId || order._id },
      QR_SECRET,
      { expiresIn: '24h' }
    );

    order.status = 'paid';
    order.paymentStatus = 'completed';
    order.qrToken = qrToken;
    order.paidAt = new Date();
    await order.save();

    res.json({ success: true, message: 'Order marked as paid', order });
  } catch (error) {
    res.status(500).json({ error: 'Failed to update order' });
  }
});

export default router;
