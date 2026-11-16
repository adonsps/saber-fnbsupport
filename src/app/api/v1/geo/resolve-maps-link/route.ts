import { NextRequest, NextResponse } from 'next/server';
import { isValidLatLng, parseGoogleMapsUrlOrCoords } from '@/lib/geo';

export const dynamic = 'force-dynamic';

function extractCoordsFromText(text: string): { lat: number; lng: number } | null {
  if (!text) return null;

  // 1. Google Maps /@lat,lng pattern
  const atMatch = text.match(/@(-?\d{1,2}\.\d+),(-?\d{1,3}\.\d+)/);
  if (atMatch) {
    const lat = parseFloat(atMatch[1]);
    const lng = parseFloat(atMatch[2]);
    if (isValidLatLng(lat, lng)) return { lat, lng };
  }

  // 2. Place protobuf data pattern: !3d-6.297043!4d106.6866
  const dataMatch = text.match(/!3d(-?\d{1,2}\.\d+)!4d(-?\d{1,3}\.\d+)/);
  if (dataMatch) {
    const lat = parseFloat(dataMatch[1]);
    const lng = parseFloat(dataMatch[2]);
    if (isValidLatLng(lat, lng)) return { lat, lng };
  }

  // 3. center=lat,lng or ll=lat,lng
  const centerMatch = text.match(/[?&;](?:center|ll|q)=(-?\d{1,2}\.\d+)(?:%2C|,)(-?\d{1,3}\.\d+)/i);
  if (centerMatch) {
    const lat = parseFloat(centerMatch[1]);
    const lng = parseFloat(centerMatch[2]);
    if (isValidLatLng(lat, lng)) return { lat, lng };
  }

  // 4. Array [lat, lng] inside APP_INITIALIZATION_STATE or json-ld
  const arrayMatch = text.match(/\[null,null,(-?\d{1,2}\.\d+),(-?\d{1,3}\.\d+)\]/);
  if (arrayMatch) {
    const lat = parseFloat(arrayMatch[1]);
    const lng = parseFloat(arrayMatch[2]);
    if (isValidLatLng(lat, lng)) return { lat, lng };
  }

  return null;
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json().catch(() => ({}));
    const query = String(body.url || body.query || '').trim();

    if (!query) {
      return NextResponse.json(
        { error: 'Masukkan tautan Google Maps, koordinat, atau alamat lengkap.' },
        { status: 400 }
      );
    }

    // 1. Direct coordinate or standard Google Maps URL check
    const directCoords = parseGoogleMapsUrlOrCoords(query);
    if (directCoords) {
      return NextResponse.json({
        success: true,
        lat: directCoords.lat,
        lng: directCoords.lng,
        resolvedUrl: query,
        source: 'direct',
      });
    }

    // 2. If it's an HTTP URL (e.g. maps.app.goo.gl, goo.gl/maps, etc.)
    if (/^https?:\/\//i.test(query)) {
      try {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 8000);

        const response = await fetch(query, {
          method: 'GET',
          redirect: 'follow',
          signal: controller.signal,
          headers: {
            'User-Agent':
              'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36',
            Accept:
              'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8',
            'Accept-Language': 'id-ID,id;q=0.9,en-US;q=0.8,en;q=0.7',
          },
        });
        clearTimeout(timeoutId);

        const finalUrl = response.url || query;
        const fromFinalUrl = parseGoogleMapsUrlOrCoords(finalUrl);
        if (fromFinalUrl) {
          return NextResponse.json({
            success: true,
            lat: fromFinalUrl.lat,
            lng: fromFinalUrl.lng,
            resolvedUrl: finalUrl,
            source: 'redirect_url',
          });
        }

        // Parse HTML body if coordinates were not in the final URL query
        const html = await response.text();
        const fromBody = extractCoordsFromText(html);
        if (fromBody) {
          return NextResponse.json({
            success: true,
            lat: fromBody.lat,
            lng: fromBody.lng,
            resolvedUrl: finalUrl,
            source: 'page_content',
          });
        }
      } catch (err: any) {
        console.warn('[resolve-maps-link] URL fetch redirect failed:', err.message);
      }
    }

    // 3. Fallback: Geocode text address via OpenStreetMap Nominatim
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 6000);
      const searchUrl = `https://nominatim.openstreetmap.org/search?format=json&limit=1&q=${encodeURIComponent(
        query
      )}`;

      const geoRes = await fetch(searchUrl, {
        signal: controller.signal,
        headers: {
          'User-Agent': 'Saber-FnBSupport-Geocoding/1.0 (info@saberconsulting.id)',
          Accept: 'application/json',
        },
      });
      clearTimeout(timeoutId);

      if (geoRes.ok) {
        const results = await geoRes.json();
        if (Array.isArray(results) && results.length > 0) {
          const first = results[0];
          const lat = parseFloat(first.lat);
          const lng = parseFloat(first.lon);
          if (isValidLatLng(lat, lng)) {
            return NextResponse.json({
              success: true,
              lat,
              lng,
              displayName: first.display_name,
              source: 'geocoded_address',
            });
          }
        }
      }
    } catch (err: any) {
      console.warn('[resolve-maps-link] Geocode search failed:', err.message);
    }

    return NextResponse.json(
      {
        error:
          'Titik koordinat tidak ditemukan dari tautan atau alamat tersebut. Coba salin link lengkap dari Google Maps atau masukkan koordinat (contoh: -6.2970, 106.6866).',
      },
      { status: 422 }
    );
  } catch (err: any) {
    return NextResponse.json(
      { error: err.message || 'Gagal memproses lokasi.' },
      { status: 500 }
    );
  }
}
