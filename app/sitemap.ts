import type { MetadataRoute } from 'next';
import { absoluteUrl } from '@/lib/utils/env';

export default function sitemap(): MetadataRoute.Sitemap {
  const now = new Date();
  return [
    { url: absoluteUrl('/'), lastModified: now, changeFrequency: 'weekly', priority: 1 },
    { url: absoluteUrl('/leaderboard'), lastModified: now, changeFrequency: 'hourly', priority: 0.8 },
    { url: absoluteUrl('/legal'), lastModified: now, changeFrequency: 'yearly', priority: 0.3 },
  ];
}
