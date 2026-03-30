import mongoose from 'mongoose';
import bcrypt from 'bcryptjs';

// User Schema
const userSchema = new mongoose.Schema({
  usn: {
    type: String,
    required: true,
    unique: true,
    uppercase: true,
    trim: true,
    match: /^[1-9][A-Z]{2}\d{2}[A-Z]{2}\d{3}$/,
  },
  name: {
    type: String,
    required: true,
    trim: true,
    maxlength: 100,
  },
  email: {
    type: String,
    required: true,
    unique: true,
    lowercase: true,
    trim: true,
  },
  passwordHash: {
    type: String,
    required: true,
    select: false,
  },
  role: {
    type: String,
    enum: ['student', 'staff', 'manager', 'admin'],
    default: 'student',
  },
  isVerified: {
    type: Boolean,
    default: false,
  },
  loginAttempts: {
    type: Number,
    default: 0,
  },
  lockUntil: Date,
  createdAt: {
    type: Date,
    default: Date.now,
  },
});

userSchema.methods.isLocked = function() {
  return this.lockUntil && this.lockUntil > Date.now();
};

userSchema.methods.incrementLoginAttempts = async function() {
  this.loginAttempts += 1;
  if (this.loginAttempts >= 5) {
    this.lockUntil = new Date(Date.now() + 30 * 60 * 1000); // 30 minutes
  }
  await this.save();
};

export const User = mongoose.model('User', userSchema);

// OTP Schema - stores HASHED OTP
const otpSchema = new mongoose.Schema({
  email: {
    type: String,
    required: true,
    lowercase: true,
  },
  code: {
    type: String,
    required: true,
  },
  expiresAt: {
    type: Date,
    required: true,
  },
});

otpSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });

// Hash OTP before saving
otpSchema.pre('save', async function() {
  if (this.isModified('code')) {
    this.code = await bcrypt.hash(this.code, 10);
  }
});

// Method to verify OTP
otpSchema.methods.verifyCode = async function(candidateCode: string) {
  return bcrypt.compare(candidateCode, this.code);
};

export const OTP = mongoose.model('OTP', otpSchema);

// RefreshToken Schema
const refreshTokenSchema = new mongoose.Schema({
  token: {
    type: String,
    required: true,
    unique: true,
  },
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
  },
  expiresAt: {
    type: Date,
    required: true,
  },
  userAgent: String,
  ip: String,
});

refreshTokenSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });

export const RefreshToken = mongoose.model('RefreshToken', refreshTokenSchema);

// MenuItem Schema
const menuItemSchema = new mongoose.Schema({
  name: {
    type: String,
    required: true,
    trim: true,
    maxlength: 100,
  },
  description: {
    type: String,
    required: true,
    maxlength: 500,
  },
  imageUrl: {
    type: String,
    required: true,
  },
  price: {
    type: Number,
    required: true,
    min: 1,
    max: 10000,
  },
  calories: {
    type: Number,
    required: true,
    min: 0,
  },
  category: {
    type: String,
    enum: ['meals', 'snacks', 'beverages', 'desserts'],
    required: true,
  },
  tempOptions: [{
    type: String,
    enum: ['cold', 'normal', 'hot'],
  }],
  isAvailable: {
    type: Boolean,
    default: true,
  },
  preparationMinutes: {
    type: Number,
    default: 10,
  },
});

export const MenuItem = mongoose.model('MenuItem', menuItemSchema);

// Order Schema
const orderSchema = new mongoose.Schema({
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
  },
  items: [{
    menuItemId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'MenuItem',
      required: true,
    },
    name: String,
    price: Number,
    quantity: {
      type: Number,
      required: true,
      min: 1,
      max: 10,
    },
    tempPreference: {
      type: String,
      enum: ['cold', 'normal', 'hot'],
    },
  }],
  scheduledTime: {
    type: String,
    required: true,
  },
  totalAmount: {
    type: Number,
    required: true,
  },
  idempotencyKey: {
    type: String,
    unique: true,
    sparse: true,
  },
  razorpayOrderId: {
    type: String,
    unique: true,
    sparse: true,
  },
  razorpayPaymentId: {
    type: String,
    sparse: true,
  },
  // Paytm fields
  paytmOrderId: {
    type: String,
    unique: true,
    sparse: true,
  },
  transactionId: {
    type: String,
    sparse: true,
  },
  paymentMethod: {
    type: String,
    enum: ['razorpay', 'paytm', 'cash'],
  },
  paymentStatus: {
    type: String,
    enum: ['pending', 'completed', 'failed', 'refunded'],
    default: 'pending',
  },
  paidAt: Date,
  status: {
    type: String,
    enum: ['pending_payment', 'paid', 'preparing', 'ready', 'fulfilled', 'failed'],
    default: 'pending_payment',
  },
  qrToken: {
    type: String,
    select: false,
  },
  fulfilledBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
  },
  fulfilledAt: Date,
  webhookVerified: {
    type: Boolean,
    default: false,
  },
  createdAt: {
    type: Date,
    default: Date.now,
  },
});

export const Order = mongoose.model('Order', orderSchema);
