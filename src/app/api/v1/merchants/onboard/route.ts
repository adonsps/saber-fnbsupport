import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { hashPassword, sanitizeMerchant, signSessionToken } from '@/lib/auth';
import {
  ACTIVE_MERCHANT_COOKIE,
  SESSION_COOKIE,
  createStarterCatalogForBranch,
  createUuid,
  DEFAULT_QRIS_SVG,
  dispatchWhatsAppNotification,
  getAuthenticatedMerchant,
  getDemoMerchant,
  getMerchantBySlug,
  getScopedMerchantBundle,
  getStore,
  isDemoMerchant,
  resolveAuthorizedWorkspaceMerchant,
  saveStore,
} from '@/lib/store';
import {
  buildStorefrontUrl,
  getOriginFromHeaders,
  isReservedSlug,
  normalizeBaseOrigin,
  normalizeWhatsapp,
} from '@/lib/utils';
import { TableSession } from '@/types/schema';

export const dynamic = 'force-dynamic';

const OnboardSchema = z.object({
  mode: z.enum(['create', 'update']).optional(),
  merchantId: z.string().optional(),
  email: z.string().email('Masukkan alamat email akun yang valid.').optional(),
  password: z.string().optional(),
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

function isHttpsRequest(req: NextRequest): boolean {
  const proto = req.headers.get('x-forwarded-proto')?.split(',')[0].trim();
  if (proto) return proto === 'https';
  return req.url.startsWith('https://');
}

export async function GET(req: NextRequest) {
  const store = getStore();
  const explicitSlug = req.nextUrl.searchParams.get('slug');
  const { merchant, authenticatedMerchant, deniedRequestedSlug } =
    resolveAuthorizedWorkspaceMerchant(store, {
      sessionCookie: req.cookies.get(SESSION_COOKIE)?.value,
      activeSlugCookie: req.cookies.get(ACTIVE_MERCHANT_COOKIE)?.value,
      requestedSlug: explicitSlug,
    });

  if (deniedRequestedSlug) {
    return NextResponse.json(
      { error: 'Akses ditolak. Anda harus masuk ke akun restoran tersebut.' },
      { status: 403 }
    );
  }

  const bundle = getScopedMerchantBundle(store, merchant);
  const demo = getDemoMerchant(store);
  const visibleMerchants = authenticatedMerchant
    ? [demo, authenticatedMerchant]
    : [demo];

  return NextResponse.json({
    authenticated: Boolean(authenticatedMerchant),
    authenticatedMerchant: authenticatedMerchant ? sanitizeMerchant(authenticatedMerchant) : null,
    merchant: sanitizeMerchant(bundle.merchant),
    branch: bundle.branch,
    categories: bundle.categories,
    menuItems: bundle.menuItems,
    tableSessions: bundle.tables,
    merchants: visibleMerchants.map((m) => ({
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
      email: body.email ? String(body.email).trim().toLowerCase() : undefined,
      password: body.password ? String(body.password) : undefined,
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
    const origin = normalizeBaseOrigin(getOriginFromHeaders(req.headers));
    const now = new Date().toISOString();
    const authedMerchant = getAuthenticatedMerchant(
      store,
      req.cookies.get(SESSION_COOKIE)?.value
    );
    const activeCookieSlug = req.cookies.get(ACTIVE_MERCHANT_COOKIE)?.value;

    const existingBySlug = getMerchantBySlug(store, cleanSlug);
    const targetById = data.merchantId
      ? store.merchants.find((m) => m.id === data.merchantId)
      : undefined;

    const shouldCreate =
      data.mode === 'create' ||
      (!targetById && !existingBySlug && cleanSlug !== 'warungmakan' && data.mode !== 'update');

    let merchant = targetById || existingBySlug;
    let branch;
    let newlyCreated = false;

    if (shouldCreate) {
      if (existingBySlug) {
        return NextResponse.json(
          { error: `URL toko "/${cleanSlug}" sudah terdaftar. Pilih nama slug unik lainnya.` },
          { status: 409 }
        );
      }

      if (!data.email) {
        return NextResponse.json(
          { error: 'Alamat email wajib diisi untuk membuat akun pemilik restoran.' },
          { status: 400 }
        );
      }

      if (!data.password || data.password.length < 8) {
        return NextResponse.json(
          { error: 'Kata sandi minimal 8 karakter wajib diisi untuk melindungi akun Anda.' },
          { status: 400 }
        );
      }

      const emailTaken = store.merchants.some(
        (m) => !isDemoMerchant(m) && m.email?.toLowerCase() === data.email?.toLowerCase()
      );
      if (emailTaken) {
        return NextResponse.json(
          { error: 'Email sudah terdaftar pada akun restoran lain. Silakan masuk lewat halaman Login.' },
          { status: 409 }
        );
      }

      const { salt, hash } = hashPassword(data.password);
      const newMerchantId = createUuid();
      const newBranchId = createUuid();

      merchant = {
        id: newMerchantId,
        name: data.businessName,
        slug: cleanSlug,
        email: data.email,
        passwordSalt: salt,
        passwordHash: hash,
        ownerName: data.ownerName,
        ownerWhatsapp: normalizeWhatsapp(data.ownerWhatsapp),
        isStoreOpen: true,
        isDemo: false,
        createdAt: now,
        updatedAt: now,
      };
      store.merchants.push(merchant);
      newlyCreated = true;

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
        const authResolution = resolveAuthorizedWorkspaceMerchant(store, {
          sessionCookie: req.cookies.get(SESSION_COOKIE)?.value,
          activeSlugCookie: activeCookieSlug,
        });
        merchant = authResolution.merchant;
      }

      // Authorization check for real merchant accounts
      if (!isDemoMerchant(merchant) && authedMerchant?.id !== merchant.id) {
        return NextResponse.json(
          { error: 'Akses ditolak. Silakan masuk dengan akun pemilik restoran ini terlebih dahulu.' },
          { status: 403 }
        );
      }

      if (existingBySlug && existingBySlug.id !== merchant.id) {
        return NextResponse.json(
          { error: `URL toko "/${cleanSlug}" sudah digunakan oleh restoran lain.` },
          { status: 409 }
        );
      }

      if (data.email && !isDemoMerchant(merchant)) {
        const emailConflict = store.merchants.some(
          (m) => m.id !== merchant!.id && m.email?.toLowerCase() === data.email?.toLowerCase()
        );
        if (emailConflict) {
          return NextResponse.json(
            { error: 'Alamat email sudah dipakai restoran lain.' },
            { status: 409 }
          );
        }
        merchant.email = data.email;
      }

      if (data.password && data.password.length >= 8 && !isDemoMerchant(merchant)) {
        const { salt, hash } = hashPassword(data.password);
        merchant.passwordSalt = salt;
        merchant.passwordHash = hash;
      }

      merchant.name = data.businessName;
      merchant.slug = isDemoMerchant(merchant) ? merchant.slug : cleanSlug;
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

    if (newlyCreated && merchant) {
      await dispatchWhatsAppNotification({
        merchantId: merchant.id,
        recipientPhone: merchant.ownerWhatsapp,
        recipientRole: 'MERCHANT',
        eventType: 'NEW_ORDER_MAGIC_LINK',
        orderNumber: 'ONBOARDING',
        messageBody: `🎉 *Selamat Datang di Saber Culinary, ${merchant.ownerName}!*\nRestoran *${merchant.name}* sudah aktif.\n\n• URL Menu Pelanggan:\n${origin}/${merchant.slug}\n• Login Portal Pemilik:\n${origin}/login\n(Gunakan email: ${merchant.email})`,
        magicLinkUrl: `${origin}/login`,
      });
    }

    const res = NextResponse.json({
      success: true,
      merchant: sanitizeMerchant(merchant!),
      branch,
      miniSiteUrl: `/${merchant!.slug}`,
      subdomainUrl: buildStorefrontUrl(merchant!.slug, { baseOrigin: origin }),
    });

    const secureCookie = isHttpsRequest(req);
    if (!isDemoMerchant(merchant)) {
      const sessionToken = signSessionToken(merchant!.id, merchant!.slug);
      res.cookies.set(SESSION_COOKIE, sessionToken, {
        httpOnly: true,
        sameSite: 'lax',
        secure: secureCookie,
        path: '/',
        maxAge: 60 * 60 * 24 * 14,
      });
    }
    res.cookies.set(ACTIVE_MERCHANT_COOKIE, merchant!.slug, {
      sameSite: 'lax',
      secure: secureCookie,
      path: '/',
      maxAge: 60 * 60 * 24 * 14,
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
    const { merchant, deniedRequestedSlug } = resolveAuthorizedWorkspaceMerchant(store, {
      sessionCookie: req.cookies.get(SESSION_COOKIE)?.value,
      activeSlugCookie: req.cookies.get(ACTIVE_MERCHANT_COOKIE)?.value,
      requestedSlug: body.slug,
    });

    if (deniedRequestedSlug) {
      return NextResponse.json({ error: 'Akses ditolak.' }, { status: 403 });
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
      merchant: sanitizeMerchant(merchant),
      menuItems: updatedBundle.menuItems,
    });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Gagal memperbarui status toko' },
      { status: 500 }
    );
  }
}
