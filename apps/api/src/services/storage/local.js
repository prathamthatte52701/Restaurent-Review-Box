import fs from 'node:fs/promises';
import path from 'node:path';
import { randomUUID } from 'node:crypto';
import { env } from '../../config/env.js';

const EXT = { 'image/webp': 'webp', 'image/jpeg': 'jpg', 'image/png': 'png' };

export default {
  name: 'local',
  /** @param {{buffer:Buffer, mimetype:string}} file */
  async upload(file, folder = 'restaurants') {
    const dir = path.join(env.uploadsDir, folder);
    await fs.mkdir(dir, { recursive: true });
    const name = `${randomUUID()}.${EXT[file.mimetype] || 'bin'}`; // client filename is never used
    await fs.writeFile(path.join(dir, name), file.buffer);
    const publicId = `${folder}/${name}`;
    return { url: `${env.publicApiUrl}/uploads/${publicId}`, publicId };
  },
  async delete(publicId) {
    const root = path.resolve(env.uploadsDir);
    const full = path.resolve(root, publicId);
    if (!full.startsWith(root + path.sep)) return; // path traversal guard
    await fs.rm(full, { force: true });
  },
};
