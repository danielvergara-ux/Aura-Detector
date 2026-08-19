import type { MetadataRoute } from 'next';
import { absoluteUrl } from '@/lib/utils/env';

export default function robots(): MetadataRoute.Robots {
  return {
    rules: [{ userAgent: '*', allow: '/', disallow: ['/api/', '/reroll/', '/scan'] }],
    sitemap: absoluteUrl('/sitemap.xml'),
  };
}
