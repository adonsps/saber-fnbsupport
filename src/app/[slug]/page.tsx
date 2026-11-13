import { CustomerStorefrontClient } from '@/components/CustomerStorefrontClient';

export default async function MerchantMiniSitePage({
  params,
  searchParams,
}: {
  params: Promise<{ slug: string }>;
  searchParams: Promise<{ table?: string }>;
}) {
  const { slug } = await params;
  const { table } = await searchParams;
  return (
    <CustomerStorefrontClient
      slug={slug}
      initialTable={table ? decodeURIComponent(table) : undefined}
    />
  );
}
