import type { Metadata, Viewport } from 'next';
import './globals.css';
import { SaberWorkspaceBar } from '@/components/SaberWorkspaceBar';

export const metadata: Metadata = {
  title: 'Saber Culinary — Zero-Commission Table QR & Cashier Platform',
  description:
    'Zero-commission direct ordering PWA, dynamic Table QR generator, frictionless guest checkout, and real-time Cashier Kanban with Fonnte WhatsApp automation.',
  manifest: '/manifest.json',
  icons: {
    icon: '/icon.svg',
    apple: '/icon.svg',
  },
};

export const viewport: Viewport = {
  themeColor: '#0F1E36',
  width: 'device-width',
  initialScale: 1,
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="id">
      <body className="min-h-screen bg-[#F5F5F7] text-[#1D1D1F] antialiased selection:bg-apple-blue/15 selection:text-apple-blue">
        <SaberWorkspaceBar />
        <main className="pb-16">{children}</main>
      </body>
    </html>
  );
}
