import { z } from 'zod';

const name = z.string().trim().min(2, 'Name must be at least 2 characters').max(80, 'Name is too long (max 80)');
const icon = z.string().trim().max(60).optional();

/** One config per master; MasterPage is generic over these. */
export const masterConfigs = {
  cities: {
    key: 'cities', path: 'cities', endpoint: '/cities', singular: 'City', plural: 'Cities',
    description: 'Cities restaurants can be located in.',
    fields: [{ name: 'name', label: 'Name', required: true }, { name: 'state', label: 'State', hint: 'e.g. Madhya Pradesh' }],
    schema: z.object({ name, state: z.string().trim().max(80).optional(), isActive: z.boolean() }),
    columns: ['name', 'state'],
  },
  cuisines: {
    key: 'cuisines', path: 'cuisines', endpoint: '/cuisines', singular: 'Cuisine', plural: 'Cuisines',
    description: 'Cuisine tags used to filter restaurants.',
    fields: [{ name: 'name', label: 'Name', required: true }, { name: 'icon', label: 'Icon', type: 'icon' }],
    schema: z.object({ name, icon, isActive: z.boolean() }),
    columns: ['name', 'icon'],
  },
  amenities: {
    key: 'amenities', path: 'amenities', endpoint: '/amenities', singular: 'Amenity', plural: 'Amenities',
    description: 'Facilities a restaurant offers, such as parking or Wi-Fi.',
    fields: [{ name: 'name', label: 'Name', required: true }, { name: 'icon', label: 'Icon', type: 'icon' }],
    schema: z.object({ name, icon, isActive: z.boolean() }),
    columns: ['name', 'icon'],
  },
};
