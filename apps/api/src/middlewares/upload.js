import multer from 'multer';

export const MAX_FILE_BYTES = 5 * 1024 * 1024;
export const MAX_FILES = 10;

const m = multer({ storage: multer.memoryStorage(), limits: { fileSize: MAX_FILE_BYTES, files: MAX_FILES, fields: 10 } });

/** Single image in field `image`. Errors flow to the central handler (413 too big, 400 wrong field). */
export const uploadOne = m.single('image');
/** Up to 10 images in field `images`. */
export const uploadMany = m.array('images', MAX_FILES);
