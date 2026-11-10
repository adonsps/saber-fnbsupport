import { CustomerStorefrontClient } from '@/components/CustomerStorefrontClient';

export default async function CheckoutRedirectPage({
  searchParams,
}: {
  searchParams: Promise<{ table?: string }>;
}) {
  const { table } = await searchParams;
  return (
    <CustomerStorefrontClient
      slug="warungmakan"
      initialTable={table ? decodeURIComponent(table) : undefined}
    />
  );
}
