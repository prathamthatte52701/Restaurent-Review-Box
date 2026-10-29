import { v2 as cloudinary } from 'cloudinary';
import { env } from '../../config/env.js';

cloudinary.config({ cloud_name: env.cloudinary.cloudName, api_key: env.cloudinary.apiKey, api_secret: env.cloudinary.apiSecret, secure: true });

export default {
  name: 'cloudinary',
  upload(file, folder = 'restaurants') {
    return new Promise((resolve, reject) => {
      cloudinary.uploader
        .upload_stream({ folder: `rrb/${folder}`, resource_type: 'image' }, (err, r) => (err ? reject(err) : resolve({ url: r.secure_url, publicId: r.public_id })))
        .end(file.buffer);
    });
  },
  async delete(publicId) {
    await cloudinary.uploader.destroy(publicId, { resource_type: 'image' });
  },
};
