import { NextResponse } from 'next/server';
import { ACTIVE_MERCHANT_COOKIE, SESSION_COOKIE } from '@/lib/auth';

export const dynamic = 'force-dynamic';

export async function POST() {
  const res = NextResponse.json({ success: true });
  res.cookies.delete(SESSION_COOKIE);
  res.cookies.delete(ACTIVE_MERCHANT_COOKIE);
  return res;
}
