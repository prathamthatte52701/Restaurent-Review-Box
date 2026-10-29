import { ApiError } from '../utils/ApiError.js';
import { asyncHandler } from '../utils/asyncHandler.js';
import { sendOk, sendList } from '../utils/response.js';
import { runListQuery } from '../utils/queryHelper.js';
import { createWithSlug, toSlug, escapeRegex } from '../utils/slug.js';
import Restaurant from '../models/Restaurant.js';

const isObjectId = (v) => /^[a-f\d]{24}$/i.test(v);
const byIdOrSlug = (v) => (isObjectId(v) ? { _id: v } : { slug: String(v).toLowerCase() });

/**
 * Shared CRUD for City / Cuisine / Amenity.
 * @param {{Model, label:string, usageField:string, withState?:boolean}} cfg
 */
export function makeMasterController({ Model, label, usageField, withState = false }) {
  const dupFilter = (d) => ({
    name: new RegExp(`^${escapeRegex(d.name)}$`, 'i'),
    ...(withState && { state: new RegExp(`^${escapeRegex(d.state || '')}$`, 'i') }),
  });

  const load = async (id) => {
    const doc = await Model.findOne(byIdOrSlug(id));
    if (!doc) throw ApiError.notFound(`${label} not found`);
    return doc;
  };

  return {
    list: asyncHandler(async (req, res) => {
      const includeInactive = req.query.includeInactive === 'true'; // adminForInactive already enforced admin
      const out = await runListQuery(Model, req.query, {
        filter: includeInactive ? {} : { isActive: true },
        searchFields: withState ? ['name', 'state'] : ['name'],
        sortable: ['name', 'createdAt'],
        defaultSort: 'name',
        defaultOrder: 1,
      });
      sendList(res, out, `${label} list`);
    }),

    getOne: asyncHandler(async (req, res) => {
      const doc = await Model.findOne(byIdOrSlug(req.validated.params.id)).lean();
      if (!doc || (!doc.isActive && req.user?.role !== 'admin')) throw ApiError.notFound(`${label} not found`);
      sendOk(res, doc);
    }),

    create: asyncHandler(async (req, res) => {
      const d = req.validated.body;
      if (await Model.exists(dupFilter(d))) throw ApiError.conflict(`${label} "${d.name}" already exists`, { name: `${label} already exists` });
      const doc = await createWithSlug(Model, toSlug(d.name), d);
      sendOk(res, doc, `${label} created`, 201);
    }),

    update: asyncHandler(async (req, res) => {
      const doc = await load(req.validated.params.id);
      const d = req.validated.body;
      const next = { name: d.name ?? doc.name, state: d.state ?? doc.state };
      if ((d.name || d.state !== undefined) && (await Model.exists({ ...dupFilter(next), _id: { $ne: doc._id } }))) {
        throw ApiError.conflict(`${label} "${next.name}" already exists`, { name: `${label} already exists` });
      }
      doc.set(d); // slug intentionally stays stable so existing links keep working
      await doc.save();
      sendOk(res, doc, `${label} updated`);
    }),

    remove: asyncHandler(async (req, res) => {
      const doc = await load(req.validated.params.id);
      const used = await Restaurant.countDocuments({ [usageField]: doc._id });
      if (used) {
        throw ApiError.conflict(`${label} is used by ${used} restaurant${used === 1 ? '' : 's'}. Deactivate it instead (isActive=false).`, { usedBy: used });
      }
      await doc.deleteOne();
      sendOk(res, null, `${label} deleted`);
    }),
  };
}
