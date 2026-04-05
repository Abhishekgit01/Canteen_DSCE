import mongoose from 'mongoose';
import bcrypt from 'bcryptjs';
import { DEFAULT_COLLEGE, SUPPORTED_COLLEGES } from '../config/college.js';

const supportedCollegeValues = SUPPORTED_COLLEGES;

// User Schema
const userSchema = new mongoose.Schema({
  usn: {
    type: String,
    required: true,
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
  googleId: {
    type: String,
    unique: true,
    sparse: true,
    trim: true,
  },
  picture: {
    type: String,
    trim: true,
  },
  expoPushToken: {
    type: String,
    default: null,
    trim: true,
  },
  passwordHash: {
    type: String,
    required: false,
    select: false,
  },
  college: {
    type: String,
    enum: supportedCollegeValues,
    trim: true,
    default: DEFAULT_COLLEGE,
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
  otpSentAt: Date,
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

userSchema.index({ usn: 1, college: 1 }, { unique: true });

export const User = mongoose.model('User', userSchema);

// OTP Schema - stores HASHED OTP
const otpSchema = new mongoose.Schema({
  email: {
    type: String,
    required: true,
    lowercase: true,
  },
  purpose: {
    type: String,
    enum: ['signup', 'password_reset'],
    default: 'signup',
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

const notificationLogSchema = new mongoose.Schema({
  type: {
    type: String,
    enum: ['broadcast', 'daily_special', 'rush_warning'],
    required: true,
  },
  title: {
    type: String,
    required: true,
    trim: true,
    maxlength: 120,
  },
  body: {
    type: String,
    required: true,
    trim: true,
    maxlength: 300,
  },
  college: {
    type: String,
    enum: supportedCollegeValues,
    trim: true,
    default: DEFAULT_COLLEGE,
  },
  recipientCount: {
    type: Number,
    default: 0,
    min: 0,
  },
  senderId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
  },
  menuItemId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'MenuItem',
  },
  createdAt: {
    type: Date,
    default: Date.now,
  },
});

notificationLogSchema.index({ college: 1, createdAt: -1 });

export const NotificationLog = mongoose.model('NotificationLog', notificationLogSchema);

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
  isFeatured: {
    type: Boolean,
    default: false,
  },
  averageRating: {
    type: Number,
    default: 0,
    min: 0,
    max: 5,
  },
  totalReviews: {
    type: Number,
    default: 0,
  },
  ratingBreakdown: {
    '1': { type: Number, default: 0 },
    '2': { type: Number, default: 0 },
    '3': { type: Number, default: 0 },
    '4': { type: Number, default: 0 },
    '5': { type: Number, default: 0 },
  },
  preparationMinutes: {
    type: Number,
    default: 10,
  },
  college: {
    type: String,
    enum: supportedCollegeValues,
    trim: true,
    default: DEFAULT_COLLEGE,
  },
});

menuItemSchema.index({ college: 1, isAvailable: 1, category: 1, name: 1 });

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
    chefNote: {
      type: String,
      trim: true,
      maxlength: 200,
      default: '',
    },
  }],
  scheduledTime: {
    type: String,
    required: true,
  },
  estimatedPickupMinutes: {
    type: Number,
    default: 15,
    min: 0,
  },
  estimatedPickupAt: {
    type: Date,
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
  upiTransactionId: {
    type: String,
    unique: true,
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
    enum: ['mock', 'upi_link', 'razorpay', 'paytm', 'cash'],
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
  qrTokenHash: {
    type: String,
    select: false,
  },
  qrExpiresAt: Date,
  fulfilledBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
  },
  fulfilledAt: Date,
  webhookVerified: {
    type: Boolean,
    default: false,
  },
  college: {
    type: String,
    enum: supportedCollegeValues,
    trim: true,
    default: DEFAULT_COLLEGE,
  },
  isPreOrder: {
    type: Boolean,
    default: false,
  },
  scheduledFor: {
    type: Date,
    default: null,
  },
  preOrderNote: {
    type: String,
    default: '',
  },
  preOrderNotified: {
    type: Boolean,
    default: false,
  },
  createdAt: {
    type: Date,
    default: Date.now,
  },
});

orderSchema.index({ userId: 1, createdAt: -1 });
orderSchema.index({ status: 1, createdAt: -1 });
orderSchema.index({ college: 1, createdAt: -1 });
orderSchema.index({ qrTokenHash: 1 }, { sparse: true });

export const Order = mongoose.model('Order', orderSchema);

const reviewSchema = new mongoose.Schema({
  menuItemId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'MenuItem',
    required: true,
  },
  orderId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Order',
    required: true,
  },
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
  },
  college: {
    type: String,
    enum: supportedCollegeValues,
    trim: true,
    default: DEFAULT_COLLEGE,
  },
  rating: {
    type: Number,
    required: true,
    min: 1,
    max: 5,
  },
  title: {
    type: String,
    trim: true,
    maxlength: 100,
    default: '',
  },
  body: {
    type: String,
    trim: true,
    maxlength: 500,
    default: '',
  },
  tags: {
    type: [String],
    default: [],
  },
  images: {
    type: [String],
    default: [],
  },
  helpful: {
    type: Number,
    default: 0,
  },
  isVerified: {
    type: Boolean,
    default: true,
  },
  isVisible: {
    type: Boolean,
    default: true,
  },
  createdAt: {
    type: Date,
    default: Date.now,
  },
});

reviewSchema.index({ orderId: 1, menuItemId: 1, userId: 1 }, { unique: true });
reviewSchema.index({ menuItemId: 1, isVisible: 1, createdAt: -1 });
reviewSchema.index({ college: 1, createdAt: -1 });

export const Review = mongoose.model('Review', reviewSchema);
