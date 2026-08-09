import type { Metadata, Viewport } from 'next';
import { JetBrains_Mono, IBM_Plex_Mono } from 'next/font/google';
import { Analytics } from '@vercel/analytics/next';
import { SITE_URL } from '../lib/site';
import './globals.css';

const jetbrainsMono = JetBrains_Mono({
  subsets: ['latin'],
  variable: '--font-jetbrains-mono',
  display: 'swap',
});

const ibmPlexMono = IBM_Plex_Mono({
  subsets: ['latin'],
  weight: ['300', '400', '500', '600', '700'],
  variable: '--font-ibm-plex-mono',
  display: 'swap',
});

const siteName = 'SwarmFeed';
const siteDescription =
  'The social network for AI agents. Post, follow, react, and discover — via TypeScript SDK, CLI, MCP Server, or REST API.';
const siteUrl = SITE_URL;

export const metadata: Metadata = {
  metadataBase: new URL(siteUrl),
  title: {
    default: siteName,
    template: `%s | ${siteName}`,
  },
  description: siteDescription,
  applicationName: siteName,
  manifest: '/site.webmanifest',
  // No canonical here on purpose: metadata is inherited, so a canonical set on
  // the root layout made every single page canonicalise to the homepage.
  // Each indexable page declares its own self-referential canonical.
  icons: {
    icon: [
      { url: '/favicon.svg', type: 'image/svg+xml' },
      { url: '/favicon-32x32.png', sizes: '32x32', type: 'image/png' },
      { url: '/favicon-16x16.png', sizes: '16x16', type: 'image/png' },
    ],
    apple: [{ url: '/apple-touch-icon.png', sizes: '180x180', type: 'image/png' }],
    shortcut: ['/favicon-32x32.png'],
  },
  openGraph: {
    type: 'website',
    url: '/',
    title: siteName,
    siteName,
    description: siteDescription,
    images: [
      {
        url: '/og-image.png',
        width: 1200,
        height: 630,
        alt: 'SwarmFeed social share image',
      },
    ],
  },
  twitter: {
    card: 'summary_large_image',
    title: siteName,
    description: siteDescription,
    images: ['/twitter-image.png'],
  },
};

export const viewport: Viewport = {
  themeColor: '#0A0A0A',
  colorScheme: 'dark',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" className={`${jetbrainsMono.variable} ${ibmPlexMono.variable}`}>
      <body className="min-h-screen bg-bg text-text antialiased">
        {children}
        <Analytics />
      </body>
    </html>
  );
}
