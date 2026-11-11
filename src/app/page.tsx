import { cookies, headers } from 'next/headers';
import {
  ACTIVE_MERCHANT_COOKIE,
  getScopedMerchantBundle,
  getStore,
  isDemoMerchant,
  resolveWorkspaceMerchant,
} from '@/lib/store';
import { getOriginFromHeaders } from '@/lib/utils';
import {
  PortalLandingClient,
  PortalMerchantSummary,
} from '@/components/PortalLandingClient';

export const dynamic = 'force-dynamic';

export default async function HomePage() {
  const store = getStore();
  const cookieStore = await cookies();
  const reqHeaders = await headers();
  const activeSlugCookie = cookieStore.get(ACTIVE_MERCHANT_COOKIE)?.value;

  const activeMerchant = resolveWorkspaceMerchant(store, activeSlugCookie);
  const origin = getOriginFromHeaders(reqHeaders);
  const displayHost = (
    origin ||
    process.env.NEXT_PUBLIC_APP_DOMAIN ||
    'fnbsupport.saberconsulting.id'
  ).replace(/^https?:\/\//i, '');

  const buildSummary = (m: (typeof store.merchants)[number]): PortalMerchantSummary => {
    const bundle = getScopedMerchantBundle(store, m);
    const activeOrders = bundle.orders.filter(
      (o) => o.orderStatus !== 'COMPLETED' && o.orderStatus !== 'CANCELLED'
    );
    const settledOrders = bundle.orders.filter((o) => o.orderStatus === 'COMPLETED');
    const totalRevenue = settledOrders.reduce((acc, o) => acc + Number(o.totalAmountIdr), 0);

    return {
      id: m.id,
      name: m.name,
      slug: m.slug,
      ownerName: m.ownerName,
      ownerWhatsapp: m.ownerWhatsapp,
      bankName: bundle.branch?.bankName || 'QRIS / Transfer Bank',
      isStoreOpen: m.isStoreOpen,
      isDemo: isDemoMerchant(m),
      menuCount: bundle.menuItems.length,
      tableCount: bundle.tables.length,
      activeTicketCount: activeOrders.length,
      revenueIdr: totalRevenue,
      sampleOrderId: bundle.orders[0]?.id || '66666666-6666-4666-8666-666666666601',
    };
  };

  const summaries = store.merchants.map(buildSummary);
  const activeSummary =
    summaries.find((s) => s.id === activeMerchant.id) || buildSummary(activeMerchant);

  return (
    <PortalLandingClient
      activeMerchant={activeSummary}
      merchants={summaries}
      displayHost={displayHost}
      fonnteConfigured={Boolean(process.env.FONNTE_API_TOKEN)}
    />
  );
}
