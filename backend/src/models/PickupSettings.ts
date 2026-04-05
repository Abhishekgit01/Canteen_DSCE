import mongoose, { Schema, type Document } from 'mongoose';
import { SUPPORTED_COLLEGES } from '../config/college.js';

export interface IPickupSettings extends Document {
  college: string;
  basePickupMinutes: number;
  rushHourExtra: number;
  perItemExtra: number;
  maxPickupMinutes: number;
  openingTime: string;
  closingTime: string;
  breakStart: string;
  breakEnd: string;
  hasBreak: boolean;
  isOpen: boolean;
  closedMessage: string;
  updatedBy?: mongoose.Types.ObjectId | null;
  createdAt: Date;
  updatedAt: Date;
}

const pickupSettingsSchema = new Schema<IPickupSettings>(
  {
    college: {
      type: String,
      required: true,
      unique: true,
      enum: SUPPORTED_COLLEGES,
      trim: true,
    },
    basePickupMinutes: {
      type: Number,
      default: 15,
      min: 5,
      max: 120,
    },
    rushHourExtra: {
      type: Number,
      default: 10,
      min: 0,
      max: 60,
    },
    perItemExtra: {
      type: Number,
      default: 2,
      min: 0,
      max: 10,
    },
    maxPickupMinutes: {
      type: Number,
      default: 45,
      min: 10,
      max: 120,
    },
    openingTime: {
      type: String,
      default: '08:00',
      match: /^\d{2}:\d{2}$/,
    },
    closingTime: {
      type: String,
      default: '20:00',
      match: /^\d{2}:\d{2}$/,
    },
    breakStart: {
      type: String,
      default: '15:00',
      match: /^\d{2}:\d{2}$/,
    },
    breakEnd: {
      type: String,
      default: '16:00',
      match: /^\d{2}:\d{2}$/,
    },
    hasBreak: {
      type: Boolean,
      default: false,
    },
    isOpen: {
      type: Boolean,
      default: true,
    },
    closedMessage: {
      type: String,
      default: 'Canteen is currently closed',
      trim: true,
      maxlength: 160,
    },
    updatedBy: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      default: null,
    },
  },
  { timestamps: true },
);

pickupSettingsSchema.index({ college: 1 }, { unique: true });

export const PickupSettings =
  (mongoose.models.PickupSettings as mongoose.Model<IPickupSettings> | undefined) ||
  mongoose.model<IPickupSettings>('PickupSettings', pickupSettingsSchema);
