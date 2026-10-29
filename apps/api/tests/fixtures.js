import sharp from 'sharp';
import { auth } from './helpers.js';

export const week = (open = '10:00', close = '23:00') =>
  ['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday'].map((day) => ({ day, openTime: open, closeTime: close }));

/** Creates city/cuisine/amenity through the real API. */
export async function makeMasters(ctx, adminToken) {
  const post = async (path, body) => {
    const res = await ctx.request.post(`/api/v1/${path}`).set(auth(adminToken)).send(body);
    if (res.status !== 201) throw new Error(`${path} failed ${res.status} ${JSON.stringify(res.body)}`);
    return res.body.data;
  };
  return {
    city: await post('cities', { name: 'Indore', state: 'Madhya Pradesh' }),
    cuisine: await post('cuisines', { name: 'North Indian', icon: 'utensils' }),
    cuisine2: await post('cuisines', { name: 'Chinese' }),
    amenity: await post('amenities', { name: 'Parking' }),
  };
}

export const restaurantBody = (m, over = {}) => ({
  name: 'Test Bistro',
  description: 'A place',
  address: { line1: '12 MG Road', area: 'Vijay Nagar', city: m.city._id, pincode: '452010' },
  location: { type: 'Point', coordinates: [75.8937, 22.7531] },
  type: 'veg',
  category: 'restaurant',
  priceForTwo: 500,
  cuisines: [m.cuisine._id],
  amenities: [m.amenity._id],
  timings: week(),
  ...over,
});

export const jpeg = (w = 300, h = 200) => sharp({ create: { width: w, height: h, channels: 3, background: '#c33' } }).jpeg().toBuffer();
export const png = (w = 100, h = 100) => sharp({ create: { width: w, height: h, channels: 3, background: '#33c' } }).png().toBuffer();
