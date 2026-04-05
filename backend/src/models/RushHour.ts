import mongoose, { Schema, type Document } from 'mongoose';
import { SUPPORTED_COLLEGES } from '../config/college.js';

export interface IRushHour extends Document {
  college: string;
  dayOfWeek: number[];
  startTime: string;
  endTime: string;
  label: string;
  surchargePercent: number;
  isActive: boolean;
  message: string;
  createdBy: mongoose.Types.ObjectId;
  createdAt: Date;
  updatedAt: Date;
}

const rushHourSchema = new Schema<IRushHour>(
  {
    college: {
      type: String,
      required: true,
      enum: SUPPORTED_COLLEGES,
      trim: true,
    },
    dayOfWeek: {
      type: [Number],
      required: true,
      validate: {
        validator: (value: number[]) =>
          Array.isArray(value) &&
          value.length > 0 &&
          value.every((day) => Number.isInteger(day) && day >= 0 && day <= 6),
        message: 'dayOfWeek must contain values between 0 and 6',
      },
    },
    startTime: {
      type: String,
      required: true,
      match: /^\d{2}:\d{2}$/,
    },
    endTime: {
      type: String,
      required: true,
      match: /^\d{2}:\d{2}$/,
    },
    label: {
      type: String,
      required: true,
      trim: true,
      maxlength: 60,
    },
    surchargePercent: {
      type: Number,
      default: 0,
      min: 0,
      max: 50,
    },
    isActive: {
      type: Boolean,
      default: true,
    },
    message: {
      type: String,
      default: 'Busy hours — expect slight delays',
      trim: true,
      maxlength: 160,
    },
    createdBy: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
  },
  { timestamps: true },
);

rushHourSchema.index({ college: 1, isActive: 1, dayOfWeek: 1, startTime: 1, endTime: 1 });

export const RushHour =
  (mongoose.models.RushHour as mongoose.Model<IRushHour> | undefined) ||
  mongoose.model<IRushHour>('RushHour', rushHourSchema);
