import { z } from 'zod';

const name = z.string().trim().min(2, 'Name must be at least 2 characters').max(80);
const icon = z.string().trim().max(60).optional();
const state = z.string().trim().max(80).optional();

export const cityCreate = z.object({ name, state, isActive: z.boolean().optional() });
export const cuisineCreate = z.object({ name, icon, isActive: z.boolean().optional() });
export const cityPatch = cityCreate.partial();
export const cuisinePatch = cuisineCreate.partial();
