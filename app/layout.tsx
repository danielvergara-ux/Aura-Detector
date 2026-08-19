import type { Metadata, Viewport } from 'next';
import { Orbitron, Space_Grotesk } from 'next/font/google';
import './globals.css';
import { SoundProvider } from '@/components/providers/SoundProvider';
import { AchievementProvider } from '@/components/providers/AchievementProvider';
import { ServiceWorkerRegistrar } from '@/components/providers/ServiceWorkerRegistrar';
import { absoluteUrl, env } from '@/lib/utils/env';

/**
 * Two families, both variable, both subsetted to latin:
 *  - Space Grotesk for UI
 *  - Orbitron for aura numbers and HUD headings
 */
const spaceGrotesk = Space_Grotesk({
  subsets: ['latin'],
  display: 'swap',
  variable: '--font-space-grotesk',
});

const orbitron = Orbitron({
  subsets: ['latin'],
  display: 'swap',
  weight: ['500', '700', '900'],
  variable: '--font-orbitron',
});

const title = 'Aura Scanner — ¿Cuánta aura tienes?';
const description =
  'Escanea tu aura y descubre si eres NPC, protagonista o una anomalía absoluta. Puro entretenimiento.';

export const metadata: Metadata = {
  metadataBase: new URL(env.appUrl),
  title: {
    default: title,
    template: '%s · Aura Scanner',
  },
  description,
  applicationName: 'Aura Scanner',
  keywords: ['aura', 'aura points', 'escáner', 'meme', 'test', 'aura scanner'],
  alternates: { canonical: '/' },
  manifest: '/manifest.webmanifest',
  appleWebApp: {
    capable: true,
    title: 'Aura Scanner',
    statusBarStyle: 'black-translucent',
  },
  openGraph: {
    type: 'website',
    locale: 'es_MX',
    url: absoluteUrl('/'),
    siteName: 'Aura Scanner',
    title,
    description,
  },
  twitter: {
    card: 'summary_large_image',
    title,
    description,
  },
  robots: { index: true, follow: true },
  icons: {
    icon: [
      { url: '/icons/icon-192.png', sizes: '192x192', type: 'image/png' },
      { url: '/icons/icon-512.png', sizes: '512x512', type: 'image/png' },
    ],
    apple: [{ url: '/apple-touch-icon.png', sizes: '180x180' }],
  },
};

export const viewport: Viewport = {
  themeColor: '#050509',
  colorScheme: 'dark',
  width: 'device-width',
  initialScale: 1,
  maximumScale: 1,
  // The scanner is a fixed-viewport experience; pinch-zoom breaks the framing.
  userScalable: false,
  viewportFit: 'cover',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="es" className={`${spaceGrotesk.variable} ${orbitron.variable}`}>
      <body className="min-h-screen-dvh bg-bg font-sans">
        <SoundProvider>
          <AchievementProvider>{children}</AchievementProvider>
        </SoundProvider>
        <ServiceWorkerRegistrar />
      </body>
    </html>
  );
}
