import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import {
  ACTIVE_MERCHANT_COOKIE,
  createStarterCatalogForBranch,
  createUuid,
  DEFAULT_QRIS_SVG,
  getMerchantBySlug,
  getScopedMerchantBundle,
  getStore,
  isDemoMerchant,
  resolveWorkspaceMerchant,
  saveStore,
} from '@/lib/store';
import {
  buildStorefrontUrl,
  getOriginFromHeaders,
  isReservedSlug,
  normalizeWhatsapp,
} from '@/lib/utils';
import { TableSession } from '@/types/schema';

export const dynamic = 'force-dynamic';

const OnboardSchema = z.object({
  mode: z.enum(['create', 'update']).optional(),
  merchantId: z.string().optional(),
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

export async function GET(req: NextRequest) {
  const store = getStore();
  const explicitSlug = req.nextUrl.searchParams.get('slug');
  const cookieSlug = req.cookies.get(ACTIVE_MERCHANT_COOKIE)?.value;
  const merchant = resolveWorkspaceMerchant(store, explicitSlug || cookieSlug);
  const bundle = getScopedMerchantBundle(store, merchant);

  return NextResponse.json({
    merchant: bundle.merchant,
    branch: bundle.branch,
    categories: bundle.categories,
    menuItems: bundle.menuItems,
    tableSessions: bundle.tables,
    merchants: store.merchants.map((m) => ({
      id: m.id,
      name: m.name,
      slug: m.slug,
      isDemo: isDemoMerchant(m),
      isStoreOpen: m.isStoreOpen,
    })),
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
    const cleanSlug = data.slug.trim().toLowerCase();
    if (isReservedSlug(cleanSlug)) {
      return NextResponse.json(
        { error: `Slug "${cleanSlug}" dicadangkan oleh sistem.` },
        { status: 400 }
      );
    }

    const store = getStore();
    const origin = getOriginFromHeaders(req.headers);
    const now = new Date().toISOString();
    const cookieSlug = req.cookies.get(ACTIVE_MERCHANT_COOKIE)?.value;

    const existingBySlug = getMerchantBySlug(store, cleanSlug);
    const targetById = data.merchantId
      ? store.merchants.find((m) => m.id === data.merchantId)
      : undefined;

    // Create brand-new merchant when explicitly requested OR when slug doesn't belong to demo warungmakan in new flow
    const shouldCreate =
      data.mode === 'create' ||
      (!targetById && !existingBySlug && cleanSlug !== 'warungmakan' && data.mode !== 'update');

    let merchant = targetById || existingBySlug;
    let branch;

    if (shouldCreate) {
      if (existingBySlug) {
        return NextResponse.json(
          { error: `URL toko "/${cleanSlug}" sudah terdaftar. Pilih nama slug unik lainnya.` },
          { status: 409 }
        );
      }

      const newMerchantId = createUuid();
      const newBranchId = createUuid();

      merchant = {
        id: newMerchantId,
        name: data.businessName,
        slug: cleanSlug,
        ownerName: data.ownerName,
        ownerWhatsapp: normalizeWhatsapp(data.ownerWhatsapp),
        isStoreOpen: true,
        isDemo: false,
        createdAt: now,
        updatedAt: now,
      };
      store.merchants.push(merchant);

      branch = {
        id: newBranchId,
        merchantId: newMerchantId,
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
      store.branches.push(branch);

      // Provision starter editable menu categories/dishes & 4 starter table QR sessions
      const starter = createStarterCatalogForBranch(newBranchId, data.businessName);
      store.categories.push(...starter.categories);
      store.menuItems.push(...starter.menuItems);

      const starterTables: TableSession[] = ['TABLE 01', 'TABLE 02', 'TABLE 03', 'TABLE 04'].map(
        (tbl) => ({
          id: createUuid(),
          branchId: newBranchId,
          tableNumber: tbl,
          qrCodeUrl: buildStorefrontUrl(cleanSlug, {
            tableNumber: tbl,
            baseOrigin: origin,
          }),
          isOccupied: false,
          wifiName: `${data.businessName.slice(0, 14).replace(/\s+/g, '')}_WiFi`,
          wifiPassword: 'tamuresto',
        })
      );
      store.tableSessions.push(...starterTables);
    } else {
      if (!merchant) {
        merchant = resolveWorkspaceMerchant(store, cookieSlug);
      }

      // Guard against overwriting demo slug into someone else's taken slug
      if (existingBySlug && existingBySlug.id !== merchant.id) {
        return NextResponse.json(
          { error: `URL toko "/${cleanSlug}" sudah digunakan oleh restoran lain.` },
          { status: 409 }
        );
      }

      merchant.name = data.businessName;
      merchant.slug = cleanSlug;
      merchant.ownerName = data.ownerName;
      merchant.ownerWhatsapp = normalizeWhatsapp(data.ownerWhatsapp);
      merchant.isStoreOpen = true;
      merchant.updatedAt = now;

      branch =
        store.branches.find((b) => b.merchantId === merchant!.id) || store.branches[0];
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

        store.tableSessions = store.tableSessions.map((t) =>
          t.branchId === branch!.id
            ? {
                ...t,
                qrCodeUrl: buildStorefrontUrl(merchant!.slug, {
                  tableNumber: t.tableNumber,
                  baseOrigin: origin,
                }),
              }
            : t
        );
      }
    }

    saveStore(store);

    const res = NextResponse.json({
      success: true,
      merchant,
      branch,
      miniSiteUrl: `/${merchant.slug}`,
      subdomainUrl: buildStorefrontUrl(merchant.slug, { baseOrigin: origin }),
    });
    res.cookies.set(ACTIVE_MERCHANT_COOKIE, merchant.slug, {
      path: '/',
      sameSite: 'lax',
      maxAge: 60 * 60 * 24 * 30,
    });
    return res;
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
    const cookieSlug = req.cookies.get(ACTIVE_MERCHANT_COOKIE)?.value;
    const merchant = resolveWorkspaceMerchant(store, body.slug || cookieSlug);

    if (!merchant) {
      return NextResponse.json({ error: 'Merchant tidak ditemukan' }, { status: 404 });
    }

    const bundle = getScopedMerchantBundle(store, merchant);

    if (typeof body.isStoreOpen === 'boolean') {
      merchant.isStoreOpen = body.isStoreOpen;
      merchant.updatedAt = new Date().toISOString();
    }

    if (body.resetAllSoldOut === true) {
      const catIds = new Set(bundle.categories.map((c) => c.id));
      store.menuItems = store.menuItems.map((item) =>
        catIds.has(item.categoryId) ? { ...item, isSoldOut: false } : item
      );
    }

    saveStore(store);
    const updatedBundle = getScopedMerchantBundle(store, merchant);
    return NextResponse.json({
      success: true,
      merchant,
      menuItems: updatedBundle.menuItems,
    });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Gagal memperbarui status toko' },
      { status: 500 }
    );
  }
}
