import { NextRequest, NextResponse } from 'next/server';
import {
  ACTIVE_MERCHANT_COOKIE,
  SESSION_COOKIE,
  getStore,
  resolveAuthorizedWorkspaceMerchant,
  sanitizeMerchant,
} from '@/lib/store';

export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  const store = getStore();
  const { merchant, authenticatedMerchant } = resolveAuthorizedWorkspaceMerchant(store, {
    sessionCookie: req.cookies.get(SESSION_COOKIE)?.value,
    activeSlugCookie: req.cookies.get(ACTIVE_MERCHANT_COOKIE)?.value,
  });

  return NextResponse.json(
    {
      authenticated: Boolean(authenticatedMerchant),
      authenticatedMerchant: authenticatedMerchant ? sanitizeMerchant(authenticatedMerchant) : null,
      activeMerchant: sanitizeMerchant(merchant),
    },
    { headers: { 'Cache-Control': 'no-store' } }
  );
}
