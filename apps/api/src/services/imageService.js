import { fileTypeFromBuffer } from 'file-type';
import sharp from 'sharp';
import { ApiError } from '../utils/ApiError.js';
import { storage } from './storage/index.js';

const ALLOWED = new Set(['image/jpeg', 'image/png', 'image/webp']);
const safeName = (n = 'file') => String(n).replace(/[^\w.\- ]/g, '_').slice(0, 60);

/** Verify the real file signature (not the client mimetype/extension), then resize + convert to webp. */
async function processOne(file) {
  const label = safeName(file.originalname);
  const type = await fileTypeFromBuffer(file.buffer);
  if (!type || !ALLOWED.has(type.mime)) {
    throw ApiError.badRequest(`"${label}" is not a valid image (${type ? `detected ${type.mime}` : 'unrecognised content'}). Only JPEG, PNG or WebP are allowed.`);
  }
  try {
    const buffer = await sharp(file.buffer, { limitInputPixels: 80_000_000 })
      .rotate()
      .resize({ width: 1600, withoutEnlargement: true })
      .webp({ quality: 82 })
      .toBuffer();
    return { buffer, mimetype: 'image/webp' };
  } catch {
    throw ApiError.badRequest(`"${label}" could not be processed - the image is corrupt or too large.`);
  }
}

/** Validate ALL files first, then store them. Rolls back stored files if one upload fails. */
export async function storeImages(files) {
  const processed = [];
  for (const f of files) processed.push(await processOne(f));
  const stored = [];
  try {
    for (const p of processed) stored.push(await storage.upload(p));
  } catch (err) {
    await removeImages(stored.map((s) => s.publicId));
    throw err;
  }
  return stored;
}

export async function removeImages(publicIds) {
  await Promise.all(publicIds.filter(Boolean).map((id) => storage.delete(id).catch((e) => console.error('[storage] delete failed', id, e.message))));
}
