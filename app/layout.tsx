import type { Metadata, Viewport } from 'next';
import {
  Geist,
  Geist_Mono,
  Fraunces,
  Inter,
  Space_Grotesk,
  Playfair_Display,
  JetBrains_Mono,
} from 'next/font/google';
import './globals.css';
import 'highlight.js/styles/github-dark.css'; // syntax highlighting for code blocks
import 'katex/dist/katex.min.css'; // LaTeX math rendering

const geistSans = Geist({
  variable: '--font-geist-sans',
  subsets: ['latin'],
});

const geistMono = Geist_Mono({
  variable: '--font-geist-mono',
  subsets: ['latin'],
});

// Elegant serif for display headings (premium, Claude-like).
const fraunces = Fraunces({
  variable: '--font-serif',
  subsets: ['latin'],
  display: 'swap',
});

// Extra interface fonts — exposed via CSS variables so the user's Interface-font
// setting can switch between them at runtime (no reload needed).
const inter = Inter({
  variable: '--font-inter',
  subsets: ['latin'],
  display: 'swap',
});
const spaceGrotesk = Space_Grotesk({
  variable: '--font-space-grotesk',
  subsets: ['latin'],
  display: 'swap',
});
const playfair = Playfair_Display({
  variable: '--font-playfair',
  subsets: ['latin'],
  display: 'swap',
});
const jetbrainsMono = JetBrains_Mono({
  variable: '--font-jetbrains',
  subsets: ['latin'],
  display: 'swap',
});

export const metadata: Metadata = {
  title: 'Close AI – Document Intelligence',
  description:
    'Chat with memory, live web search, and PDF document understanding.',
  manifest: '/manifest.webmanifest',
  appleWebApp: { capable: true, title: 'Close AI', statusBarStyle: 'black-translucent' },
  icons: { icon: '/icon.svg', apple: '/icon.svg' },
};

export const viewport: Viewport = {
  themeColor: '#000000',
};

// Applies the saved theme before paint to avoid a flash of the wrong theme.
const themeScript = `(function(){try{var t=localStorage.getItem('theme');if(t!=='light'&&t!=='dark'){t='dark';}document.documentElement.classList.add(t);}catch(e){document.documentElement.classList.add('dark');}})();`;

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html
      lang="en"
      suppressHydrationWarning
      className={`${geistSans.variable} ${geistMono.variable} ${fraunces.variable} ${inter.variable} ${spaceGrotesk.variable} ${playfair.variable} ${jetbrainsMono.variable} h-full`}
    >
      <body className="h-full">
        <script dangerouslySetInnerHTML={{ __html: themeScript }} />
        {children}
      </body>
    </html>
  );
}
