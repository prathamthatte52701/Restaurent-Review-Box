import slugify from 'slugify';

export const toSlug = (s) => slugify(String(s), { lower: true, strict: true, trim: true }) || 'item';
export const escapeRegex = (s) => String(s).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

/** Next free slug for `base` (base, base-2, base-3...). */
export async function uniqueSlug(Model, base, excludeId) {
  const rows = await Model.find(
    { slug: { $regex: `^${escapeRegex(base)}(-\\d+)?$` }, ...(excludeId && { _id: { $ne: excludeId } }) },
    'slug',
  ).lean();
  const taken = new Set(rows.map((r) => r.slug));
  if (!taken.has(base)) return base;
  let n = 2;
  while (taken.has(`${base}-${n}`)) n++;
  return `${base}-${n}`;
}

/** Create with an auto slug; retries if a concurrent insert grabbed the same slug. */
export async function createWithSlug(Model, base, data) {
  for (let i = 0; i < 6; i++) {
    const slug = await uniqueSlug(Model, base);
    try {
      return await Model.create({ ...data, slug });
    } catch (err) {
      if (err?.code === 11000 && err.keyPattern?.slug) continue;
      throw err;
    }
  }
  throw new Error('Could not allocate a unique slug');
}
