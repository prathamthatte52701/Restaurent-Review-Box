import { z } from 'zod';

export const resolveMapLinkBody = z.object({ url: z.string().trim().min(1, 'Paste a link first').max(2048, 'Link is too long') });
