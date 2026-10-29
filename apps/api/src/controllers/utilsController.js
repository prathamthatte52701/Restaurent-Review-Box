import { asyncHandler } from '../utils/asyncHandler.js';
import { sendOk } from '../utils/response.js';
import { resolveMapLink } from '../services/mapLink.js';

// app.locals.mapLinkDeps is a test-only seam (request/lookup injection); unset in production.
export const resolveMap = asyncHandler(async (req, res) => {
  sendOk(res, await resolveMapLink(req.validated.body.url, req.app.locals.mapLinkDeps), 'Link resolved');
});
