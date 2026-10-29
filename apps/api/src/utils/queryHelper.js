import { escapeRegex } from './slug.js';

const clamp = (n, lo, hi) => Math.min(hi, Math.max(lo, n));

/** Parse ?search &sort &order &page &limit into safe values. Never throws. */
export function parseListQuery(q = {}, { defaultLimit = 20, maxLimit = 100 } = {}) {
  const asInt = (v, d) => {
    const n = parseInt(v, 10);
    return Number.isFinite(n) ? n : d;
  };
  return {
    page: clamp(asInt(q.page, 1), 1, 1e7),
    limit: clamp(asInt(q.limit, defaultLimit), 1, maxLimit),
    search: typeof q.search === 'string' ? q.search.trim().slice(0, 100) : '',
    sort: typeof q.sort === 'string' ? q.sort : '',
    order: q.order === 'asc' ? 1 : q.order === 'desc' ? -1 : 0,
  };
}

/**
 * The one list helper used by every list endpoint.
 * @returns {{data:any[], pagination:{page,limit,total,totalPages}}}
 */
export async function runListQuery(
  Model,
  query,
  { filter = {}, searchFields = [], sortable = ['createdAt'], defaultSort = 'createdAt', defaultOrder = -1, populate, select } = {},
) {
  const { page, limit, search, sort, order } = parseListQuery(query);
  const f = { ...filter };
  if (search && searchFields.length) {
    const rx = new RegExp(escapeRegex(search), 'i');
    f.$and = [...(f.$and || []), { $or: searchFields.map((p) => ({ [p]: rx })) }];
  }
  const custom = sortable.includes(sort);
  const sortField = custom ? sort : defaultSort;
  const dir = custom ? order || 1 : defaultOrder;
  const sortSpec = { [sortField]: dir };
  if (sortField !== '_id') sortSpec._id = dir; // stable pagination

  let q = Model.find(f).sort(sortSpec).skip((page - 1) * limit).limit(limit);
  if (select) q = q.select(select);
  if (populate) q = q.populate(populate);
  const [data, total] = await Promise.all([q.lean(), Model.countDocuments(f)]);
  return { data, pagination: { page, limit, total, totalPages: Math.ceil(total / limit) } };
}
