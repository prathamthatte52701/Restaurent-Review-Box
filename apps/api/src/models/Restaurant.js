import mongoose from 'mongoose';

const { Schema } = mongoose;

export const DAYS = ['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday'];
export const TYPES = ['veg', 'non-veg', 'both'];
export const CATEGORIES = ['restaurant', 'cafe', 'bakery', 'street-food', 'bar', 'cloud-kitchen'];
export const BRACKETS = ['budget', 'mid', 'premium', 'luxury'];

/** Derived server-side only; the client value is never trusted. */
export const costBracketOf = (price) => (price < 300 ? 'budget' : price < 800 ? 'mid' : price < 2000 ? 'premium' : 'luxury');

const timingSchema = new Schema(
  {
    day: { type: String, enum: DAYS, required: true },
    openTime: { type: String, match: /^([01]\d|2[0-3]):[0-5]\d$/ },
    closeTime: { type: String, match: /^([01]\d|2[0-3]):[0-5]\d$/ }, // earlier than openTime = past midnight (valid)
    isClosed: { type: Boolean, default: false },
  },
  { _id: false },
);
const imageSchema = new Schema({ url: { type: String, required: true }, publicId: { type: String, required: true }, caption: { type: String, default: '' } });

const restaurantSchema = new Schema(
  {
    name: { type: String, required: true, trim: true, maxlength: 120, index: true },
    slug: { type: String, required: true, unique: true, lowercase: true },
    description: { type: String, trim: true, maxlength: 3000 },
    ownerName: { type: String, trim: true, maxlength: 80 },
    contactPhone: { type: String, trim: true },
    contactEmail: { type: String, trim: true, lowercase: true },
    address: {
      line1: { type: String, required: true, trim: true },
      line2: { type: String, trim: true },
      area: { type: String, trim: true },
      city: { type: Schema.Types.ObjectId, ref: 'City', required: true },
      pincode: { type: String, trim: true },
    },
    location: {
      type: { type: String, enum: ['Point'], default: 'Point', required: true },
      coordinates: { type: [Number], required: true }, // [lng, lat]
    },
    type: { type: String, enum: TYPES, required: true, index: true },
    category: { type: String, enum: CATEGORIES, required: true, index: true },
    establishedYear: { type: Number },
    priceForTwo: { type: Number, required: true, min: 1 },
    costBracket: { type: String, enum: BRACKETS, required: true },
    timings: { type: [timingSchema], default: [] },
    cuisines: [{ type: Schema.Types.ObjectId, ref: 'Cuisine' }],
    amenities: [{ type: Schema.Types.ObjectId, ref: 'Amenity' }],
    coverImage: { url: String, publicId: String },
    gallery: { type: [imageSchema], default: [] },
    externalLinks: { zomatoUrl: String, swiggyUrl: String, mapsUrl: String, website: String, instagram: String },
    ratingAvg: { type: Number, default: 0 },
    ratingCount: { type: Number, default: 0 },
    isFeatured: { type: Boolean, default: false },
    isActive: { type: Boolean, default: true },
    isVerified: { type: Boolean, default: false },
    createdBy: { type: Schema.Types.ObjectId, ref: 'User' },
  },
  { timestamps: true },
);

restaurantSchema.index({ location: '2dsphere' });
restaurantSchema.index({ name: 'text', description: 'text', 'address.area': 'text' });
restaurantSchema.index({ 'address.city': 1, isActive: 1 });
restaurantSchema.index({ cuisines: 1, isActive: 1 });
restaurantSchema.index({ amenities: 1 });
restaurantSchema.index({ costBracket: 1 });
restaurantSchema.index({ ratingAvg: -1 });
restaurantSchema.index({ priceForTwo: 1 });
restaurantSchema.index({ isFeatured: 1, isActive: 1 });
restaurantSchema.index({ createdAt: -1 });
restaurantSchema.index({ 'address.area': 1, isActive: 1 }); // search suggest: area prefix

export default mongoose.models.Restaurant || mongoose.model('Restaurant', restaurantSchema);
