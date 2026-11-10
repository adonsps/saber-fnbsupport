import { DaySchedule } from '@/types/schema';

export const DEFAULT_HOURS: DaySchedule[] = [
  { day: 'Senin / Monday', isOpen: true, openTime: '08:00', closeTime: '22:00' },
  { day: 'Selasa / Tuesday', isOpen: true, openTime: '08:00', closeTime: '22:00' },
  { day: 'Rabu / Wednesday', isOpen: true, openTime: '08:00', closeTime: '22:00' },
  { day: 'Kamis / Thursday', isOpen: true, openTime: '08:00', closeTime: '22:00' },
  { day: 'Jumat / Friday', isOpen: true, openTime: '08:00', closeTime: '23:00' },
  { day: 'Sabtu / Saturday', isOpen: true, openTime: '09:00', closeTime: '23:30' },
  { day: 'Minggu / Sunday', isOpen: true, openTime: '09:00', closeTime: '22:00' },
];

export const DEFAULT_QRIS_SVG = `data:image/svg+xml;utf8,${encodeURIComponent(`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 360 440" width="360" height="440">
  <rect width="360" height="440" rx="24" fill="#FFFFFF" stroke="#E5E5EA" stroke-width="2"/>
  <rect x="20" y="20" width="320" height="56" rx="14" fill="#1D1D1F"/>
  <text x="180" y="46" font-family="-apple-system, sans-serif" font-size="16" font-weight="700" fill="#FFFFFF" text-anchor="middle">QRIS — STANDAR PEMBAYARAN NASIONAL</text>
  <text x="180" y="64" font-family="-apple-system, sans-serif" font-size="11" font-weight="500" fill="#A1A1A6" text-anchor="middle">WARUNG KOPI NUSANTARA • NMID: ID102600881921</text>
  <rect x="60" y="96" width="240" height="240" rx="16" fill="#F5F5F7" stroke="#D2D2D7" stroke-width="1.5"/>
  <rect x="80" y="116" width="52" height="52" fill="none" stroke="#1D1D1F" stroke-width="8"/>
  <rect x="94" y="130" width="24" height="24" fill="#1D1D1F"/>
  <rect x="228" y="116" width="52" height="52" fill="none" stroke="#1D1D1F" stroke-width="8"/>
  <rect x="242" y="130" width="24" height="24" fill="#1D1D1F"/>
  <rect x="80" y="264" width="52" height="52" fill="none" stroke="#1D1D1F" stroke-width="8"/>
  <rect x="94" y="278" width="24" height="24" fill="#1D1D1F"/>
  <rect x="150" y="120" width="16" height="16" fill="#1D1D1F"/>
  <rect x="180" y="120" width="24" height="16" fill="#1D1D1F"/>
  <rect x="150" y="150" width="60" height="16" fill="#1D1D1F"/>
  <rect x="148" y="182" width="64" height="64" rx="12" fill="#0071E3"/>
  <text x="180" y="220" font-family="-apple-system, sans-serif" font-size="16" font-weight="800" fill="#FFFFFF" text-anchor="middle">QRIS</text>
  <rect x="84" y="190" width="44" height="16" fill="#1D1D1F"/>
  <rect x="84" y="222" width="28" height="20" fill="#1D1D1F"/>
  <rect x="228" y="190" width="48" height="16" fill="#1D1D1F"/>
  <rect x="244" y="220" width="32" height="32" fill="#1D1D1F"/>
  <rect x="154" y="264" width="32" height="24" fill="#1D1D1F"/>
  <rect x="200" y="264" width="76" height="20" fill="#1D1D1F"/>
  <rect x="164" y="298" width="112" height="18" fill="#1D1D1F"/>
  <text x="180" y="366" font-family="-apple-system, sans-serif" font-size="14" font-weight="700" fill="#1D1D1F" text-anchor="middle">Scan via BCA Mobile, Livin, GoPay, OVO, Dana</text>
  <text x="180" y="388" font-family="-apple-system, sans-serif" font-size="12" fill="#86868B" text-anchor="middle">0% MDR Zero-Commission Direct Settlement</text>
  <rect x="110" y="402" width="140" height="22" rx="11" fill="#E8F8EE"/>
  <text x="180" y="417" font-family="-apple-system, sans-serif" font-size="11" font-weight="700" fill="#1B8A36" text-anchor="middle">VERIFIED BY SABER</text>
</svg>`)}`;

export const DEFAULT_RECEIPT_SVG = `data:image/svg+xml;utf8,${encodeURIComponent(`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 360 440" width="360" height="440">
  <rect width="360" height="440" rx="24" fill="#F5F5F7" stroke="#D2D2D7" stroke-width="2"/>
  <rect x="28" y="28" width="304" height="384" rx="18" fill="#FFFFFF"/>
  <circle cx="180" cy="82" r="26" fill="#E8F8EE"/>
  <path d="M168 82l8 8 18-18" stroke="#28CD41" stroke-width="4" fill="none" stroke-linecap="round" stroke-linejoin="round"/>
  <text x="180" y="132" font-family="-apple-system, sans-serif" font-size="16" font-weight="700" fill="#1D1D1F" text-anchor="middle">BUKTI TRANSFER QRIS / BANK</text>
  <text x="180" y="152" font-family="-apple-system, sans-serif" font-size="12" fill="#86868B" text-anchor="middle">BCA Mobile • Berhasil</text>
  <line x1="56" y1="176" x2="304" y2="176" stroke="#E5E5EA" stroke-dasharray="4 4"/>
  <text x="56" y="208" font-family="-apple-system, sans-serif" font-size="12" fill="#86868B">Tujuan</text>
  <text x="304" y="208" font-family="-apple-system, sans-serif" font-size="12" font-weight="600" fill="#1D1D1F" text-anchor="end">Warung Kopi Nusantara</text>
  <text x="56" y="240" font-family="-apple-system, sans-serif" font-size="12" fill="#86868B">Metode</text>
  <text x="304" y="240" font-family="-apple-system, sans-serif" font-size="12" font-weight="600" fill="#1D1D1F" text-anchor="end">QRIS Statis BCA</text>
  <text x="56" y="272" font-family="-apple-system, sans-serif" font-size="12" fill="#86868B">Ref ID</text>
  <text x="304" y="272" font-family="monospace" font-size="12" font-weight="600" fill="#1D1D1F" text-anchor="end">SBR-992817410</text>
  <rect x="56" y="304" width="248" height="58" rx="12" fill="#F5F5F7"/>
  <text x="180" y="326" font-family="-apple-system, sans-serif" font-size="11" fill="#86868B" text-anchor="middle">TOTAL DIBAYAR</text>
  <text x="180" y="348" font-family="-apple-system, sans-serif" font-size="18" font-weight="800" fill="#0071E3" text-anchor="middle">LUNAS / VERIFIED</text>
</svg>`)}`;

