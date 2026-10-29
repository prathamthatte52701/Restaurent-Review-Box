import { z } from 'zod';

export const objectId = z.string().regex(/^[a-f\d]{24}$/i, 'Invalid id');
export const idParam = z.object({ id: objectId });
/** ObjectId or slug */
export const idOrSlugParam = z.object({ id: z.string().min(1).max(120) });

// Query strings are always plain strings; arrays/objects ("?a[]=1&a=2") are rejected by z.string().
const qs = z.string().max(500).optional();
export const listQuery = z.object({
  search: qs,
  sort: qs,
  order: z.enum(['asc', 'desc']).optional(),
  page: qs,
  limit: qs,
  includeInactive: z.enum(['true', 'false']).optional(),
});

/** "" -> null (cleared); undefined stays undefined (not sent); null stays null. */
export const blankToNull = (v) => (v === '' ? null : v);
