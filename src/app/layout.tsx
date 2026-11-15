import type { Metadata, Viewport } from 'next';
import './globals.css';
import { MotionProvider } from '@/components/MotionProvider';
import { SaberWorkspaceBar } from '@/components/SaberWorkspaceBar';

export const metadata: Metadata = {
  title: 'Saber Culinary — Platform Pesan Meja QR & Kasir Tanpa Komisi',
  description:
    'Platform pemesanan langsung UMKM kuliner, generator QR meja otomatis, checkout tamu tanpa akun, serta kasir Kanban dengan notifikasi WhatsApp otomatis.',
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
    <html lang="id" className="overflow-x-clip">
      <body className="min-h-screen bg-sky-50 text-ink-primary antialiased selection:bg-scarlet-600/15 selection:text-scarlet-600 overflow-x-clip">
        <MotionProvider>
          <SaberWorkspaceBar />
          <main className="pb-16">{children}</main>
        </MotionProvider>
      </body>
    </html>
  );
}
