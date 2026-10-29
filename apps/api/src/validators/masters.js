import { z } from 'zod';
import { blankToNull } from './common.js';

const name = z.string().trim().min(2, 'Name must be at least 2 characters').max(80);
const icon = z.preprocess(blankToNull, z.string().trim().max(60).nullish());
const state = z.preprocess(blankToNull, z.string().trim().max(80).nullish());

export const cityCreate = z.object({ name, state, isActive: z.boolean().optional() });
export const cuisineCreate = z.object({ name, icon, isActive: z.boolean().optional() });
export const cityPatch = cityCreate.partial();
export const cuisinePatch = cuisineCreate.partial();
