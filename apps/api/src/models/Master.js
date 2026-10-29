import mongoose from 'mongoose';

const base = {
  name: { type: String, required: true, trim: true, maxlength: 80, index: true },
  slug: { type: String, required: true, unique: true, lowercase: true },
  isActive: { type: Boolean, default: true, index: true },
};

export const City = mongoose.models.City || mongoose.model('City', new mongoose.Schema({ ...base, state: { type: String, trim: true, default: '' } }, { timestamps: true }));
export const Cuisine = mongoose.models.Cuisine || mongoose.model('Cuisine', new mongoose.Schema({ ...base, icon: { type: String, trim: true, default: '' } }, { timestamps: true }));
export const Amenity = mongoose.models.Amenity || mongoose.model('Amenity', new mongoose.Schema({ ...base, icon: { type: String, trim: true, default: '' } }, { timestamps: true }));
