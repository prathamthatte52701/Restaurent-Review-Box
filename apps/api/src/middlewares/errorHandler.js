import { ZodError } from 'zod';
import multer from 'multer';
import { env } from '../config/env.js';

const zodErrors = (err) => {
  const out = {};
  for (const i of err.issues) {
    const key = i.path.join('.') || 'body';
    if (!out[key]) out[key] = i.message;
  }
  return out;
};

export function notFound(req, res) {
  res.status(404).json({ success: false, message: `Route not found: ${req.method} ${req.originalUrl.split('?')[0]}` });
}

// eslint-disable-next-line no-unused-vars
export function errorHandler(err, req, res, next) {
  let status = 500;
  let message = env.isProd ? 'Internal server error' : err?.message || 'Internal server error';
  let errors;

  if (err?.isApiError) {
    ({ status, message, errors } = err);
  } else if (err instanceof ZodError) {
    status = 400;
    message = 'Validation failed';
    errors = zodErrors(err);
  } else if (err?.name === 'ValidationError' && err.errors) {
    status = 400;
    message = 'Validation failed';
    errors = Object.fromEntries(Object.entries(err.errors).map(([k, v]) => [k, v.message]));
  } else if (err?.name === 'CastError') {
    status = 400;
    message = `Invalid value for ${err.path}`;
  } else if (err?.code === 11000) {
    status = 409;
    const field = Object.keys(err.keyPattern || err.keyValue || {})[0] || 'field';
    message = `${field} already exists`;
    errors = { [field]: `${field} already exists` };
  } else if (err instanceof multer.MulterError) {
    const map = {
      LIMIT_FILE_SIZE: [413, 'Image is too large (max 5MB per file)'],
      LIMIT_FILE_COUNT: [400, 'Too many files in one request (max 10)'],
      LIMIT_UNEXPECTED_FILE: [400, `Unexpected or too many files for field "${err.field}"`],
    };
    [status, message] = map[err.code] || [400, `Upload error: ${err.message}`];
  } else if (err?.type === 'entity.parse.failed') {
    status = 400;
    message = 'Malformed JSON body';
  } else if (err?.type === 'entity.too.large') {
    status = 413;
    message = 'Request body too large';
  } else if (err?.status >= 400 && err?.status < 500) {
    status = err.status;
    message = err.message;
  }

  if (status >= 500 && !env.isTest) console.error('[error]', err);
  const body = { success: false, message };
  if (errors) body.errors = errors;
  if (status >= 500 && !env.isProd) body.stack = err?.stack;
  res.status(status).json(body);
}
