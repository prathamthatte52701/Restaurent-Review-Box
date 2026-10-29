import { asyncHandler } from '../utils/asyncHandler.js';
import { sendOk } from '../utils/response.js';
import { User, City, Cuisine, Amenity, Restaurant } from '../models/index.js';

const monthKey = (d) => `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}`;

export const stats = asyncHandler(async (req, res) => {
  const now = new Date();
  const from = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - 11, 1));
  const [restaurants, activeRestaurants, featuredRestaurants, users, cities, cuisines, amenities, recentRestaurants, recentUsers, perMonth] = await Promise.all([
    Restaurant.estimatedDocumentCount(),
    Restaurant.countDocuments({ isActive: true }),
    Restaurant.countDocuments({ isFeatured: true }),
    User.estimatedDocumentCount(),
    City.estimatedDocumentCount(),
    Cuisine.estimatedDocumentCount(),
    Amenity.estimatedDocumentCount(),
    Restaurant.find().sort({ createdAt: -1 }).limit(5).select('name slug coverImage costBracket category isActive isFeatured createdAt').lean(),
    User.find().sort({ createdAt: -1 }).limit(5).select('fullName username email role avatar isActive isEmailVerified createdAt').lean(),
    Restaurant.aggregate([
      { $match: { createdAt: { $gte: from } } },
      { $group: { _id: { $dateToString: { format: '%Y-%m', date: '$createdAt', timezone: 'UTC' } }, count: { $sum: 1 } } },
    ]),
  ]);
  const counts = new Map(perMonth.map((m) => [m._id, m.count]));
  const restaurantsPerMonth = Array.from({ length: 12 }, (_, i) => {
    const month = monthKey(new Date(Date.UTC(from.getUTCFullYear(), from.getUTCMonth() + i, 1)));
    return { month, count: counts.get(month) || 0 };
  });
  sendOk(res, {
    counts: { restaurants, activeRestaurants, featuredRestaurants, users, cities, cuisines, amenities },
    recentRestaurants,
    recentUsers,
    restaurantsPerMonth,
  });
});
