/**
 * validate({ body, query, params }) with Zod schemas.
 * Parsed values land in req.validated.{body,query,params} (req.query is a read-only getter in Express 5).
 */
export const validate = (schemas) => (req, res, next) => {
  req.validated = req.validated || {};
  for (const key of ['params', 'query', 'body']) {
    if (!schemas[key]) continue;
    const input = key === 'body' ? (req.body ?? {}) : req[key];
    const result = schemas[key].safeParse(input);
    if (!result.success) return next(result.error);
    req.validated[key] = result.data;
  }
  next();
};
