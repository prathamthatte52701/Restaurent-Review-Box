import mongoose from 'mongoose';
import bcrypt from 'bcryptjs';
import { env } from '../config/env.js';

const hidden = { select: false };

const userSchema = new mongoose.Schema(
  {
    fullName: { type: String, required: true, trim: true, maxlength: 80 },
    username: { type: String, required: true, unique: true, lowercase: true, trim: true, index: true },
    email: { type: String, required: true, unique: true, lowercase: true, trim: true, index: true },
    password: { type: String, required: true, select: false },
    phone: { type: String, trim: true },
    gender: { type: String, enum: ['male', 'female', 'other', 'prefer_not_to_say'] },
    city: { type: String, trim: true },
    address: { type: String, trim: true },
    avatar: { type: String },
    role: { type: String, enum: ['user', 'owner', 'admin'], default: 'user', index: true },
    isEmailVerified: { type: Boolean, default: false },
    isActive: { type: Boolean, default: true },
    otp: {
      codeHash: { type: String, ...hidden },
      expiresAt: { type: Date, ...hidden },
      attempts: { type: Number, default: 0, ...hidden },
    },
    passwordResetTokenHash: { type: String, ...hidden },
    passwordResetExpires: { type: Date, ...hidden },
    passwordChangedAt: { type: Date },
    lastLoginAt: { type: Date },
  },
  {
    timestamps: true,
    toJSON: {
      transform(doc, ret) {
        for (const k of ['password', 'otp', 'passwordResetTokenHash', 'passwordResetExpires', 'passwordChangedAt', '__v']) delete ret[k];
        return ret;
      },
    },
  },
);

userSchema.index({ createdAt: -1 });

userSchema.pre('save', async function hash() {
  if (this.isModified('password')) {
    this.password = await bcrypt.hash(this.password, env.bcryptRounds);
    if (!this.isNew) this.passwordChangedAt = new Date();
  }
});

userSchema.methods.comparePassword = function comparePassword(plain) {
  return bcrypt.compare(plain, this.password);
};

export default mongoose.models.User || mongoose.model('User', userSchema);
