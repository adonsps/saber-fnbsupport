import fs from 'fs';
import path from 'path';
import crypto from 'crypto';
import {
  Branch,
  Category,
  DaySchedule,
  MenuItem,
  Merchant,
  Order,
  OrderItem,
  OrderStatus,
  OrderType,
  PaymentReceipt,
  PaymentStatus,
  PaymentType,
  TableSession,
  WhatsAppWebhookLog,
} from '@/types/schema';

export interface DatabaseState {
  merchants: Merchant[];
  branches: Branch[];
  tableSessions: TableSession[];
  categories: Category[];
  menuItems: MenuItem[];
  orders: Order[];
  whatsappLogs: WhatsAppWebhookLog[];
}

const DATA_DIR = fs.existsSync('/app/data') ? '/app/data' : process.cwd();
const DATA_FILE = path.join(DATA_DIR, '.saber-fnb-db.json');

const DEFAULT_HOURS: DaySchedule[] = [
  { day: 'Senin / Monday', isOpen: true, openTime: '08:00', closeTime: '22:00' },
  { day: 'Selasa / Tuesday', isOpen: true, openTime: '08:00', closeTime: '22:00' },
  { day: 'Rabu / Wednesday', isOpen: true, openTime: '08:00', closeTime: '22:00' },
  { day: 'Kamis / Thursday', isOpen: true, openTime: '08:00', closeTime: '22:00' },
  { day: 'Jumat / Friday', isOpen: true, openTime: '08:00', closeTime: '23:00' },
  { day: 'Sabtu / Saturday', isOpen: true, openTime: '09:00', closeTime: '23:30' },
  { day: 'Minggu / Sunday', isOpen: true, openTime: '09:00', closeTime: '22:00' },
];

// Clean inline SVG data URL for default Static QRIS so it works offline & in PDF
const DEFAULT_QRIS_SVG = `data:image/svg+xml;utf8,${encodeURIComponent(`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 360 440" width="360" height="440">
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

const DEFAULT_RECEIPT_SVG = `data:image/svg+xml;utf8,${encodeURIComponent(`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 360 440" width="360" height="440">
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

function createInitialSeed(): DatabaseState {
  const merchantId = '11111111-1111-4111-8111-111111111111';
  const branchId = '22222222-2222-4222-8222-222222222222';
  const now = new Date().toISOString();

  const catSignatureId = '33333333-3333-4333-8333-333333333301';
  const catCoffeeId = '33333333-3333-4333-8333-333333333302';
  const catPastryId = '33333333-3333-4333-8333-333333333303';
  const catSnacksId = '33333333-3333-4333-8333-333333333304';

  const menuItems: MenuItem[] = [
    {
      id: '44444444-4444-4444-8444-444444444401',
      categoryId: catSignatureId,
      titleId: 'Nasi Goreng Kampung Sei Sapi Asap',
      titleEn: 'Smoked Beef Village Fried Rice',
      descriptionId: 'Nasi goreng rempah warisan dengan irisan sei sapi asap Kupang, telur mata sapi organik, dan sambal luat.',
      descriptionEn: 'Heritage spiced fried rice topped with Kupang smoked beef brisket, organic sunny-side egg, and sambal luat.',
      priceIdr: 48000,
      imageUrl: 'https://images.unsplash.com/photo-1603133872878-684f208fb84b?auto=format&fit=crop&w=900&q=80',
      isSoldOut: false,
    },
    {
      id: '44444444-4444-4444-8444-444444444402',
      categoryId: catSignatureId,
      titleId: 'Mie Ayam Truffle Jamur Panggang',
      titleEn: 'Roasted Mushroom Truffle Chicken Noodles',
      descriptionId: 'Mie keriting handmade dengan ayam kampung bumbu manis gurih, minyak truffle putih, dan pangsit rebus.',
      descriptionEn: 'Handmade artisan egg noodles with free-range savory chicken, white truffle oil, and poached wontons.',
      priceIdr: 45000,
      imageUrl: 'https://images.unsplash.com/photo-1569718212165-3a8278d5f624?auto=format&fit=crop&w=900&q=80',
      isSoldOut: false,
    },
    {
      id: '44444444-4444-4444-8444-444444444403',
      categoryId: catSignatureId,
      titleId: 'Sate Ayam Madura Bakar Arang Batok',
      titleEn: 'Charcoal-Grilled Madura Chicken Satay',
      descriptionId: '10 tusuk sate dada ayam empuk dengan bumbu kacang sangrai halus, lontong daun pisang, dan acar bawang.',
      descriptionEn: '10 skewers of tender chicken breast grilled over coconut shell charcoal with roasted peanut sauce and rice cakes.',
      priceIdr: 42000,
      imageUrl: 'https://images.unsplash.com/photo-1529563021893-cc83c992d75d?auto=format&fit=crop&w=900&q=80',
      isSoldOut: false,
    },
    {
      id: '44444444-4444-4444-8444-444444444404',
      categoryId: catCoffeeId,
      titleId: 'Es Kopi Susu Gula Aren Organik',
      titleEn: 'Organic Palm Sugar Iced Oat Latte',
      descriptionId: 'Double ristretto biji Arabika Gayo Gunung Gayo dengan gula aren asli Banten dan susu segar creamy.',
      descriptionEn: 'Double ristretto of Aceh Gayo Arabica beans swirled with organic Banten palm nectar and velvety milk.',
      priceIdr: 28000,
      imageUrl: 'https://images.unsplash.com/photo-1517701550927-30cf4ba1dba5?auto=format&fit=crop&w=900&q=80',
      isSoldOut: false,
    },
    {
      id: '44444444-4444-4444-8444-444444444405',
      categoryId: catCoffeeId,
      titleId: 'Uji Matcha Ceremonial Cloud Latte',
      titleEn: 'Ceremonial Uji Matcha Cloud Latte',
      descriptionId: 'Matcha first-harvest Kyoto yang dikocok tradisional dengan cold foam pandan lembut di atasnya.',
      descriptionEn: 'First-harvest whisked Kyoto ceremonial matcha topped with a pillowy pandan-infused sweet cream cloud.',
      priceIdr: 34000,
      imageUrl: 'https://images.unsplash.com/photo-1536256263959-770b48d82b0a?auto=format&fit=crop&w=900&q=80',
      isSoldOut: false,
    },
    {
      id: '44444444-4444-4444-8444-444444444406',
      categoryId: catPastryId,
      titleId: 'Kouign-Amann Kayu Manis & Keju Bali',
      titleEn: 'Balinese Sea Salt Caramel Kouign-Amann',
      descriptionId: 'Pastry berlapis mentega Prancis yang dikaramelisasi renyah dengan taburan garam laut Amed Bali.',
      descriptionEn: 'Crisp caramelized French butter laminated pastry finished with flaky Amed Balinese sea salt.',
      priceIdr: 32000,
      imageUrl: 'https://images.unsplash.com/photo-1509440159596-0249088772ff?auto=format&fit=crop&w=900&q=80',
      isSoldOut: false,
    },
    {
      id: '44444444-4444-4444-8444-444444444407',
      categoryId: catSnacksId,
      titleId: 'Tahu Walik Crispy Sambal Kecap Limau',
      titleEn: 'Crispy Inside-Out Tofu with Kaffir Lime Soy',
      descriptionId: 'Tahu goreng balik khas Banyuwangi dengan isian aci ayam renyah dan cocolan kecap cabai rawit.',
      descriptionEn: 'Banyuwangi-style crispy inverted tofu puffs stuffed with savory chicken, served with bird-eye chili soy dip.',
      priceIdr: 24000,
      imageUrl: 'https://images.unsplash.com/photo-1541592106381-b31e9677c0e5?auto=format&fit=crop&w=900&q=80',
      isSoldOut: false,
    },
    {
      id: '44444444-4444-4444-8444-444444444408',
      categoryId: catSnacksId,
      titleId: 'Pisang Goreng Madu Wijen Hitam',
      titleEn: 'Wild Honey & Black Sesame Fried Banana',
      descriptionId: 'Pisang raja matang pohon digoreng garing dengan baluran madu hutan Sumbawa dan wijen hitam.',
      descriptionEn: 'Tree-ripened Raja bananas fried to golden perfection and glazed in Sumbawa wildflower honey.',
      priceIdr: 26000,
      imageUrl: 'https://images.unsplash.com/photo-1576618148400-f54bed99fcfd?auto=format&fit=crop&w=900&q=80',
      isSoldOut: true,
    },
  ];

  const tables: TableSession[] = [
    {
      id: '55555555-5555-4555-8555-555555555501',
      branchId,
      tableNumber: 'TABLE 01',
      qrCodeUrl: 'https://warungmakan.saberconsulting.id?table=TABLE%2001',
      isOccupied: true,
      activeOrderId: '66666666-6666-4666-8666-666666666601',
      wifiName: 'KopiNusantara_5G',
      wifiPassword: 'kopi100persen',
    },
    {
      id: '55555555-5555-4555-8555-555555555502',
      branchId,
      tableNumber: 'TABLE 02',
      qrCodeUrl: 'https://warungmakan.saberconsulting.id?table=TABLE%2002',
      isOccupied: true,
      activeOrderId: '66666666-6666-4666-8666-666666666602',
      wifiName: 'KopiNusantara_5G',
      wifiPassword: 'kopi100persen',
    },
    {
      id: '55555555-5555-4555-8555-555555555503',
      branchId,
      tableNumber: 'TABLE 03',
      qrCodeUrl: 'https://warungmakan.saberconsulting.id?table=TABLE%2003',
      isOccupied: true,
      activeOrderId: '66666666-6666-4666-8666-666666666603',
      wifiName: 'KopiNusantara_5G',
      wifiPassword: 'kopi100persen',
    },
    {
      id: '55555555-5555-4555-8555-555555555504',
      branchId,
      tableNumber: 'TABLE 04',
      qrCodeUrl: 'https://warungmakan.saberconsulting.id?table=TABLE%2004',
      isOccupied: false,
      wifiName: 'KopiNusantara_5G',
      wifiPassword: 'kopi100persen',
    },
    {
      id: '55555555-5555-4555-8555-555555555505',
      branchId,
      tableNumber: 'VIP OUTDOOR 01',
      qrCodeUrl: 'https://warungmakan.saberconsulting.id?table=VIP%20OUTDOOR%2001',
      isOccupied: false,
      wifiName: 'KopiNusantara_5G',
      wifiPassword: 'kopi100persen',
    },
    {
      id: '55555555-5555-4555-8555-555555555506',
      branchId,
      tableNumber: 'VIP OUTDOOR 02',
      qrCodeUrl: 'https://warungmakan.saberconsulting.id?table=VIP%20OUTDOOR%2002',
      isOccupied: false,
      wifiName: 'KopiNusantara_5G',
      wifiPassword: 'kopi100persen',
    },
  ];

  const orders: Order[] = [
    {
      id: '66666666-6666-4666-8666-666666666601',
      branchId,
      orderNumber: 'ORD-1024',
      orderType: OrderType.WALK_IN_TABLE,
      orderStatus: OrderStatus.PENDING_STOCK_CONFIRMATION,
      customerName: 'Nadia Kusuma',
      customerWhatsapp: '+6281294827110',
      tableNumber: 'TABLE 01',
      subtotalIdr: 128000,
      deliveryFeeIdr: 0,
      totalAmountIdr: 128000,
      specialNotes: 'Sambal luat dipisah, es kopi less ice.',
      paymentType: PaymentType.BANK_TRANSFER_QRIS,
      paymentStatus: PaymentStatus.UNPAID,
      magicToken: 'mgtk_ord1024_saber991',
      createdAt: new Date(Date.now() - 4 * 60 * 1000).toISOString(),
      updatedAt: new Date(Date.now() - 4 * 60 * 1000).toISOString(),
      items: [
        {
          id: '77777777-7777-4777-8777-777777777701',
          orderId: '66666666-6666-4666-8666-666666666601',
          menuItemId: menuItems[0].id,
          itemTitleSnapshot: menuItems[0].titleId,
          unitPriceIdr: 48000,
          quantity: 2,
          totalPriceIdr: 96000,
          notes: 'Pedas sedang',
        },
        {
          id: '77777777-7777-4777-8777-777777777702',
          orderId: '66666666-6666-4666-8666-666666666601',
          menuItemId: menuItems[5].id,
          itemTitleSnapshot: menuItems[5].titleId,
          unitPriceIdr: 32000,
          quantity: 1,
          totalPriceIdr: 32000,
        },
      ],
      receipts: [],
    },
    {
      id: '66666666-6666-4666-8666-666666666602',
      branchId,
      orderNumber: 'ORD-1023',
      orderType: OrderType.WALK_IN_TABLE,
      orderStatus: OrderStatus.PAYMENT_PENDING_APPROVAL,
      customerName: 'Raka Mahendra',
      customerWhatsapp: '+628118239104',
      tableNumber: 'TABLE 02',
      subtotalIdr: 101000,
      deliveryFeeIdr: 0,
      totalAmountIdr: 101000,
      specialNotes: 'Mie ayam jangan pakai daun bawang.',
      paymentType: PaymentType.BANK_TRANSFER_QRIS,
      paymentStatus: PaymentStatus.PROOF_UPLOADED,
      magicToken: 'mgtk_ord1023_saber992',
      createdAt: new Date(Date.now() - 12 * 60 * 1000).toISOString(),
      updatedAt: new Date(Date.now() - 6 * 60 * 1000).toISOString(),
      items: [
        {
          id: '77777777-7777-4777-8777-777777777703',
          orderId: '66666666-6666-4666-8666-666666666602',
          menuItemId: menuItems[1].id,
          itemTitleSnapshot: menuItems[1].titleId,
          unitPriceIdr: 45000,
          quantity: 1,
          totalPriceIdr: 45000,
        },
        {
          id: '77777777-7777-4777-8777-777777777704',
          orderId: '66666666-6666-4666-8777-777777777704',
          menuItemId: menuItems[3].id,
          itemTitleSnapshot: menuItems[3].titleId,
          unitPriceIdr: 28000,
          quantity: 2,
          totalPriceIdr: 56000,
        },
      ],
      receipts: [
        {
          id: '88888888-8888-4888-8888-888888888801',
          orderId: '66666666-6666-4666-8666-666666666602',
          receiptImageUrl: DEFAULT_RECEIPT_SVG,
          uploadedAt: new Date(Date.now() - 5 * 60 * 1000).toISOString(),
        },
      ],
    },
    {
      id: '66666666-6666-4666-8666-666666666603',
      branchId,
      orderNumber: 'ORD-1022',
      orderType: OrderType.WALK_IN_TABLE,
      orderStatus: OrderStatus.IN_KITCHEN,
      customerName: 'Dimas Prayogo',
      customerWhatsapp: '+6281377819200',
      tableNumber: 'TABLE 03',
      subtotalIdr: 76000,
      deliveryFeeIdr: 0,
      totalAmountIdr: 76000,
      paymentType: PaymentType.CASH,
      paymentStatus: PaymentStatus.VERIFIED,
      magicToken: 'mgtk_ord1022_saber993',
      createdAt: new Date(Date.now() - 18 * 60 * 1000).toISOString(),
      updatedAt: new Date(Date.now() - 10 * 60 * 1000).toISOString(),
      items: [
        {
          id: '77777777-7777-4777-8777-777777777705',
          orderId: '66666666-6666-4666-8666-666666666603',
          menuItemId: menuItems[2].id,
          itemTitleSnapshot: menuItems[2].titleId,
          unitPriceIdr: 42000,
          quantity: 1,
          totalPriceIdr: 42000,
        },
        {
          id: '77777777-7777-4777-8777-777777777706',
          orderId: '66666666-6666-4666-8666-666666666603',
          menuItemId: menuItems[4].id,
          itemTitleSnapshot: menuItems[4].titleId,
          unitPriceIdr: 34000,
          quantity: 1,
          totalPriceIdr: 34000,
        },
      ],
      receipts: [],
    },
    {
      id: '66666666-6666-4666-8666-666666666604',
      branchId,
      orderNumber: 'ORD-1021',
      orderType: OrderType.SELF_DELIVERY,
      orderStatus: OrderStatus.READY_FOR_DELIVERY,
      customerName: 'Clara Wijaya',
      customerWhatsapp: '+6281908223112',
      deliveryAddress: 'Jl. Senopati Dalam No. 18B, Kebayoran Baru, Jakarta Selatan (2.4 km)',
      subtotalIdr: 120000,
      deliveryFeeIdr: 12000,
      totalAmountIdr: 132000,
      specialNotes: 'Titip di resepsionis lobby selatan.',
      paymentType: PaymentType.BANK_TRANSFER_QRIS,
      paymentStatus: PaymentStatus.VERIFIED,
      magicToken: 'mgtk_ord1021_saber994',
      createdAt: new Date(Date.now() - 28 * 60 * 1000).toISOString(),
      updatedAt: new Date(Date.now() - 8 * 60 * 1000).toISOString(),
      items: [
        {
          id: '77777777-7777-4777-8777-777777777707',
          orderId: '66666666-6666-4666-8666-666666666604',
          menuItemId: menuItems[0].id,
          itemTitleSnapshot: menuItems[0].titleId,
          unitPriceIdr: 48000,
          quantity: 1,
          totalPriceIdr: 48000,
        },
        {
          id: '77777777-7777-4777-8777-777777777708',
          orderId: '66666666-6666-4666-8666-666666666604',
          menuItemId: menuItems[6].id,
          itemTitleSnapshot: menuItems[6].titleId,
          unitPriceIdr: 24000,
          quantity: 3,
          totalPriceIdr: 72000,
        },
      ],
      receipts: [
        {
          id: '88888888-8888-4888-8888-888888888802',
          orderId: '66666666-6666-4666-8666-666666666604',
          receiptImageUrl: DEFAULT_RECEIPT_SVG,
          uploadedAt: new Date(Date.now() - 22 * 60 * 1000).toISOString(),
          verifiedAt: new Date(Date.now() - 19 * 60 * 1000).toISOString(),
          verifiedByStaffId: 'KASIR-01',
        },
      ],
    },
    {
      id: '66666666-6666-4666-8666-666666666605',
      branchId,
      orderNumber: 'ORD-1020',
      orderType: OrderType.PRE_ORDER_PICKUP,
      orderStatus: OrderStatus.COMPLETED,
      customerName: 'Hendra Gunawan',
      customerWhatsapp: '+628159918273',
      scheduledPickupTime: new Date(Date.now() - 35 * 60 * 1000).toISOString(),
      subtotalIdr: 176000,
      deliveryFeeIdr: 0,
      totalAmountIdr: 176000,
      paymentType: PaymentType.BANK_TRANSFER_QRIS,
      paymentStatus: PaymentStatus.VERIFIED,
      magicToken: 'mgtk_ord1020_saber995',
      createdAt: new Date(Date.now() - 65 * 60 * 1000).toISOString(),
      updatedAt: new Date(Date.now() - 30 * 60 * 1000).toISOString(),
      items: [
        {
          id: '77777777-7777-4777-8777-777777777709',
          orderId: '66666666-6666-4666-8666-666666666605',
          menuItemId: menuItems[0].id,
          itemTitleSnapshot: menuItems[0].titleId,
          unitPriceIdr: 48000,
          quantity: 2,
          totalPriceIdr: 96000,
        },
        {
          id: '77777777-7777-4777-8777-777777777710',
          orderId: '66666666-6666-4666-8666-666666666605',
          menuItemId: menuItems[3].id,
          itemTitleSnapshot: menuItems[3].titleId,
          unitPriceIdr: 28000,
          quantity: 2,
          totalPriceIdr: 56000,
        },
        {
          id: '77777777-7777-4777-8777-777777777711',
          orderId: '66666666-6666-4666-8666-666666666605',
          menuItemId: menuItems[6].id,
          itemTitleSnapshot: menuItems[6].titleId,
          unitPriceIdr: 24000,
          quantity: 1,
          totalPriceIdr: 24000,
        },
      ],
      receipts: [
        {
          id: '88888888-8888-4888-8888-888888888803',
          orderId: '66666666-6666-4666-8666-666666666605',
          receiptImageUrl: DEFAULT_RECEIPT_SVG,
          uploadedAt: new Date(Date.now() - 55 * 60 * 1000).toISOString(),
          verifiedAt: new Date(Date.now() - 50 * 60 * 1000).toISOString(),
          verifiedByStaffId: 'KASIR-01',
        },
      ],
    },
    {
      id: '66666666-6666-4666-8666-666666666606',
      branchId,
      orderNumber: 'ORD-1019',
      orderType: OrderType.WALK_IN_TABLE,
      orderStatus: OrderStatus.COMPLETED,
      customerName: 'Ayu Lestari',
      customerWhatsapp: '+628128837162',
      tableNumber: 'TABLE 04',
      subtotalIdr: 154000,
      deliveryFeeIdr: 0,
      totalAmountIdr: 154000,
      paymentType: PaymentType.CASH,
      paymentStatus: PaymentStatus.VERIFIED,
      magicToken: 'mgtk_ord1019_saber996',
      createdAt: new Date(Date.now() - 110 * 60 * 1000).toISOString(),
      updatedAt: new Date(Date.now() - 80 * 60 * 1000).toISOString(),
      items: [
        {
          id: '77777777-7777-4777-8777-777777777712',
          orderId: '66666666-6666-4666-8666-666666666606',
          menuItemId: menuItems[1].id,
          itemTitleSnapshot: menuItems[1].titleId,
          unitPriceIdr: 45000,
          quantity: 2,
          totalPriceIdr: 90000,
        },
        {
          id: '77777777-7777-4777-8777-777777777713',
          orderId: '66666666-6666-4666-8666-666666666606',
          menuItemId: menuItems[5].id,
          itemTitleSnapshot: menuItems[5].titleId,
          unitPriceIdr: 32000,
          quantity: 2,
          totalPriceIdr: 64000,
        },
      ],
      receipts: [],
    },
  ];

  const whatsappLogs: WhatsAppWebhookLog[] = [
    {
      id: '99999999-9999-4999-8999-999999999901',
      timestamp: new Date(Date.now() - 4 * 60 * 1000).toISOString(),
      recipientPhone: '+6281288990011',
      recipientRole: 'MERCHANT',
      eventType: 'NEW_ORDER_MAGIC_LINK',
      orderNumber: 'ORD-1024',
      messageBody:
        '🔔 [SABER CENTRAL BOT] Pesanan Baru #ORD-1024 (TABLE 01 - Nadia Kusuma) Rp 128.000 menunggu verifikasi stok dapur. Klik Magic Link untuk konfirmasi.',
      magicLinkUrl: 'https://fnbsupport.saberconsulting.id/cashier/orders?magicToken=mgtk_ord1024_saber991',
      deliveryStatus: 'DELIVERED',
    },
    {
      id: '99999999-9999-4999-8999-999999999902',
      timestamp: new Date(Date.now() - 8 * 60 * 1000).toISOString(),
      recipientPhone: '+628118239104',
      recipientRole: 'CUSTOMER',
      eventType: 'STOCK_CONFIRMED_INVOICE',
      orderNumber: 'ORD-1023',
      messageBody:
        '✅ Halo Raka Mahendra! Stok pesanan #ORD-1023 (TABLE 02) telah dikonfirmasi kasir. Total tagihan: Rp 101.000. Silakan scan QRIS Statis / Transfer BCA dan unggah bukti di tautan pesanan Anda.',
      magicLinkUrl: 'https://fnbsupport.saberconsulting.id/order/66666666-6666-4666-8666-666666666602',
      deliveryStatus: 'DELIVERED',
    },
  ];

  return {
    merchants: [
      {
        id: merchantId,
        name: 'Warung Kopi & Roastery Nusantara',
        slug: 'warungmakan',
        ownerName: 'Bapak Hendra Wijaya',
        ownerWhatsapp: '+6281288990011',
        isStoreOpen: true,
        createdAt: now,
        updatedAt: now,
      },
    ],
    branches: [
      {
        id: branchId,
        merchantId,
        address: 'Jl. Wolter Monginsidi No. 42, Kebayoran Baru, Jakarta Selatan 12170',
        logoUrl: 'https://images.unsplash.com/photo-1555396273-367ea4eb4db5?auto=format&fit=crop&w=400&q=80',
        operationalHours: JSON.stringify(DEFAULT_HOURS),
        isSelfDeliveryEnabled: true,
        maxDeliveryRadiusKm: 8,
        deliveryFeeIdr: 12000,
        qrisImageUrl: DEFAULT_QRIS_SVG,
        bankName: 'BCA (Bank Central Asia)',
        bankAccountNumber: '5240998172',
        bankAccountHolder: 'PT SABER KULINER NUSANTARA',
      },
    ],
    tableSessions: tables,
    categories: [
      { id: catSignatureId, branchId, nameId: 'Hidangan Utama Nusantara', nameEn: 'Signature Mains', displayOrder: 1 },
      { id: catCoffeeId, branchId, nameId: 'Kopi & Matcha Artisan', nameEn: 'Specialty Coffee & Matcha', displayOrder: 2 },
      { id: catPastryId, branchId, nameId: 'Pastry & Roti Panggang', nameEn: 'Artisanal Bakery', displayOrder: 3 },
      { id: catSnacksId, branchId, nameId: 'Kudapan & Pendamping', nameEn: 'Small Plates & Bites', displayOrder: 4 },
    ],
    menuItems,
    orders,
    whatsappLogs,
  };
}

declare global {
  // eslint-disable-next-line no-var
  var __saberFnbStore: DatabaseState | undefined;
}

export function getStore(): DatabaseState {
  if (global.__saberFnbStore) {
    return global.__saberFnbStore;
  }

  try {
    if (fs.existsSync(DATA_FILE)) {
      const raw = fs.readFileSync(DATA_FILE, 'utf-8');
      const parsed = JSON.parse(raw) as DatabaseState;
      if (parsed && Array.isArray(parsed.merchants) && parsed.merchants.length > 0) {
        global.__saberFnbStore = parsed;
        return parsed;
      }
    }
  } catch {
    // Fallback to initial seed if file read fails
  }

  const seed = createInitialSeed();
  global.__saberFnbStore = seed;
  saveStore(seed);
  return seed;
}

export function saveStore(state: DatabaseState): void {
  global.__saberFnbStore = state;
  try {
    fs.writeFileSync(DATA_FILE, JSON.stringify(state, null, 2), 'utf-8');
  } catch {
    // Ignore write errors in read-only edge environments
  }
}

export function createUuid(): string {
  return crypto.randomUUID();
}

export function createMagicToken(orderNumber: string): string {
  const clean = orderNumber.toLowerCase().replace(/[^a-z0-9]/g, '');
  const rand = crypto.randomBytes(6).toString('hex');
  return `mgtk_${clean}_${rand}`;
}

export function dispatchWhatsAppNotification(params: {
  recipientPhone: string;
  recipientRole: 'MERCHANT' | 'CUSTOMER';
  eventType: WhatsAppWebhookLog['eventType'];
  orderNumber: string;
  messageBody: string;
  magicLinkUrl?: string;
}): WhatsAppWebhookLog {
  const store = getStore();
  const log: WhatsAppWebhookLog = {
    id: createUuid(),
    timestamp: new Date().toISOString(),
    recipientPhone: params.recipientPhone,
    recipientRole: params.recipientRole,
    eventType: params.eventType,
    orderNumber: params.orderNumber,
    messageBody: params.messageBody,
    magicLinkUrl: params.magicLinkUrl,
    deliveryStatus: 'DELIVERED',
  };
  store.whatsappLogs.unshift(log);
  saveStore(store);
  return log;
}

export { DEFAULT_QRIS_SVG, DEFAULT_RECEIPT_SVG, DEFAULT_HOURS };

