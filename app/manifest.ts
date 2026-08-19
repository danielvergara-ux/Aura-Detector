import type { MetadataRoute } from 'next';

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: 'Aura Scanner',
    short_name: 'Aura',
    description: 'Escanea tu aura y descubre si eres NPC, protagonista o una anomalía absoluta.',
    start_url: '/',
    scope: '/',
    display: 'standalone',
    orientation: 'portrait',
    background_color: '#050509',
    theme_color: '#050509',
    lang: 'es-MX',
    categories: ['entertainment', 'games'],
    icons: [
      { src: '/icons/icon-192.png', sizes: '192x192', type: 'image/png', purpose: 'any' },
      { src: '/icons/icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'any' },
      { src: '/icons/icon-maskable-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
    ],
    shortcuts: [
      { name: 'Escanear mi aura', url: '/scan' },
      { name: 'Ranking global', url: '/leaderboard' },
    ],
  };
}
