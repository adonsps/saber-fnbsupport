import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { createUuid, DEFAULT_QRIS_SVG, getStore, saveStore } from '@/lib/store';
import { normalizeWhatsapp } from '@/lib/utils';

const OnboardSchema = z.object({
  businessName: z.string().min(2, 'Nama bisnis wajib diisi'),
  slug: z.string().regex(/^[a-z0-9-]+$/, 'Slug tidak valid'),
  ownerName: z.string().min(2, 'Nama pemilik wajib diisi'),
  ownerWhatsapp: z.string().min(8, 'Nomor WhatsApp wajib diisi'),
  address: z.string().min(5, 'Alamat cabang wajib diisi'),
  logoUrl: z.string().optional(),
  operationalHours: z.any(),
  isSelfDeliveryEnabled: z.boolean().default(false),
  maxDeliveryRadiusKm: z.number().min(0).default(5),
  deliveryFeeIdr: z.number().min(0).default(10000),
  qrisImageUrl: z.string().optional(),
  bankName: z.string().min(2, 'Nama bank wajib dipilih'),
  bankAccountNumber: z.string().min(4, 'Nomor rekening wajib diisi'),
  bankAccountHolder: z.string().min(2, 'Nama pemilik rekening wajib diisi'),
});

export async function GET() {
  const store = getStore();
  return NextResponse.json({
    merchant: store.merchants[0],
    branch: store.branches[0],
    categories: store.categories,
    menuItems: store.menuItems,
    tableSessions: store.tableSessions,
  });
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const parsed = OnboardSchema.safeParse({
      ...body,
      maxDeliveryRadiusKm: Number(body.maxDeliveryRadiusKm || 0),
      deliveryFeeIdr: Number(body.deliveryFeeIdr || 0),
    });

    if (!parsed.success) {
      return NextResponse.json(
        { error: parsed.error.issues[0]?.message || 'Validasi gagal' },
        { status: 400 }
      );
    }

    const data = parsed.data;
    const store = getStore();
    const now = new Date().toISOString();

    let merchant = store.merchants.find((m) => m.slug === data.slug) || store.merchants[0];
    if (merchant) {
      merchant.name = data.businessName;
      merchant.slug = data.slug;
      merchant.ownerName = data.ownerName;
      merchant.ownerWhatsapp = normalizeWhatsapp(data.ownerWhatsapp);
      merchant.isStoreOpen = true;
      merchant.updatedAt = now;
    } else {
      merchant = {
        id: createUuid(),
        name: data.businessName,
        slug: data.slug,
        ownerName: data.ownerName,
        ownerWhatsapp: normalizeWhatsapp(data.ownerWhatsapp),
        isStoreOpen: true,
        createdAt: now,
        updatedAt: now,
      };
      store.merchants.unshift(merchant);
    }

    let branch = store.branches.find((b) => b.merchantId === merchant.id) || store.branches[0];
    if (branch) {
      branch.merchantId = merchant.id;
      branch.address = data.address;
      if (data.logoUrl) branch.logoUrl = data.logoUrl;
      branch.operationalHours =
        typeof data.operationalHours === 'string'
          ? data.operationalHours
          : JSON.stringify(data.operationalHours);
      branch.isSelfDeliveryEnabled = data.isSelfDeliveryEnabled;
      branch.maxDeliveryRadiusKm = data.maxDeliveryRadiusKm;
      branch.deliveryFeeIdr = data.deliveryFeeIdr;
      branch.qrisImageUrl = data.qrisImageUrl || branch.qrisImageUrl || DEFAULT_QRIS_SVG;
      branch.bankName = data.bankName;
      branch.bankAccountNumber = data.bankAccountNumber;
      branch.bankAccountHolder = data.bankAccountHolder;
    } else {
      branch = {
        id: createUuid(),
        merchantId: merchant.id,
        address: data.address,
        logoUrl: data.logoUrl,
        operationalHours:
          typeof data.operationalHours === 'string'
            ? data.operationalHours
            : JSON.stringify(data.operationalHours),
        isSelfDeliveryEnabled: data.isSelfDeliveryEnabled,
        maxDeliveryRadiusKm: data.maxDeliveryRadiusKm,
        deliveryFeeIdr: data.deliveryFeeIdr,
        qrisImageUrl: data.qrisImageUrl || DEFAULT_QRIS_SVG,
        bankName: data.bankName,
        bankAccountNumber: data.bankAccountNumber,
        bankAccountHolder: data.bankAccountHolder,
      };
      store.branches.unshift(branch);
    }

    // Update table session QR target URLs with the active slug
    store.tableSessions = store.tableSessions.map((t) => ({
      ...t,
      qrCodeUrl: `https://${merchant.slug}.saberconsulting.id?table=${encodeURIComponent(t.tableNumber)}`,
    }));

    saveStore(store);

    return NextResponse.json({
      success: true,
      merchant,
      branch,
      miniSiteUrl: `/${merchant.slug}`,
      subdomainUrl: `https://${merchant.slug}.saberconsulting.id`,
    });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Gagal menyimpan onboarding merchant' },
      { status: 500 }
    );
  }
}

export async function PATCH(req: NextRequest) {
  try {
    const body = await req.json();
    const store = getStore();
    const merchant = store.merchants[0];
    if (!merchant) {
      return NextResponse.json({ error: 'Merchant tidak ditemukan' }, { status: 404 });
    }

    if (typeof body.isStoreOpen === 'boolean') {
      merchant.isStoreOpen = body.isStoreOpen;
      merchant.updatedAt = new Date().toISOString();
    }

    if (body.resetAllSoldOut === true) {
      store.menuItems = store.menuItems.map((item) => ({
        ...item,
        isSoldOut: false,
      }));
    }

    saveStore(store);
    return NextResponse.json({
      success: true,
      merchant,
      menuItems: store.menuItems,
    });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Gagal memperbarui status toko' },
      { status: 500 }
    );
  }
}

