import { NextRequest, NextResponse } from 'next/server';

const RESERVED_SUBDOMAINS = new Set(['www', 'staging', 'fnbsupport', 'staging-fnbsupport', 'app', 'admin', 'cashier', 'api']);

export function proxy(req: NextRequest) {
  const url = req.nextUrl.clone();
  const hostname = req.headers.get('host') || '';

  // Skip Next.js internals, API routes, and static assets
  if (
    url.pathname.startsWith('/_next') ||
    url.pathname.startsWith('/api') ||
    url.pathname.startsWith('/onboarding') ||
    url.pathname.startsWith('/admin') ||
    url.pathname.startsWith('/cashier') ||
    url.pathname.startsWith('/checkout') ||
    url.pathname.startsWith('/order') ||
    url.pathname.includes('.')
  ) {
    return NextResponse.next();
  }

  // Extract potential merchant subdomain slug from *.saberconsulting.id or *.saber.id
  const cleanHost = hostname.split(':')[0];
  let subdomain: string | null = null;

  if (cleanHost.endsWith('.saberconsulting.id')) {
    subdomain = cleanHost.replace('.saberconsulting.id', '');
  } else if (cleanHost.endsWith('.saber.id')) {
    subdomain = cleanHost.replace('.saber.id', '');
  } else if (cleanHost.endsWith('.localhost')) {
    subdomain = cleanHost.replace('.localhost', '');
  }

  if (subdomain && !subdomain.includes('.') && !RESERVED_SUBDOMAINS.has(subdomain)) {
    url.pathname = `/${subdomain}${url.pathname === '/' ? '' : url.pathname}`;
    return NextResponse.rewrite(url);
  }

  return NextResponse.next();
}

export const config = {
  matcher: ['/((?!api|_next/static|_next/image|favicon.ico|manifest.json).*)'],
};

