import { env } from '../../config/env.js';
import local from './local.js';
import cloudinary from './cloudinary.js';

const { cloudName, apiKey, apiSecret } = env.cloudinary;

/** Driver chosen once at startup: Cloudinary only if all three CLOUDINARY_* vars exist, else local disk. */
export const storage = cloudName && apiKey && apiSecret ? cloudinary : local;
