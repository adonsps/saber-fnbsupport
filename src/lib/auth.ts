import crypto from 'crypto';
import fs from 'fs';
import path from 'path';
import { Merchant, PublicMerchant } from '@/types/schema';

export const SESSION_COOKIE = 'saber_merchant_session';
export const ACTIVE_MERCHANT_COOKIE = 'saber_active_merchant';

const DATA_DIR = fs.existsSync('/app/data') ? '/app/data' : process.cwd();
const SECRET_FILE = path.join(DATA_DIR, '.saber-session-secret');

declare global {
  // eslint-disable-next-line no-var
  var __saberSessionSecret: string | undefined;
}

function getSessionSecret(): string {
  const envSecret = (process.env.SESSION_SECRET || '').trim();
  if (envSecret) {
    return envSecret;
  }

  if (global.__saberSessionSecret) {
    return global.__saberSessionSecret;
  }

  try {
    if (fs.existsSync(SECRET_FILE)) {
      const saved = fs.readFileSync(SECRET_FILE, 'utf-8').trim();
      if (saved.length >= 32) {
        global.__saberSessionSecret = saved;
        return saved;
      }
    }
    const generated = crypto.randomBytes(32).toString('hex');
    fs.writeFileSync(SECRET_FILE, generated, { encoding: 'utf-8', mode: 0o600 });
    global.__saberSessionSecret = generated;
    return generated;
  } catch {
    const fallback = crypto.randomBytes(32).toString('hex');
    global.__saberSessionSecret = fallback;
    return fallback;
  }
}

export function hashPassword(password: string): { salt: string; hash: string } {
  const salt = crypto.randomBytes(16).toString('hex');
  const hash = crypto.scryptSync(password, salt, 64).toString('hex');
  return { salt, hash };
}

export function verifyPassword(password: string, salt?: string, expectedHash?: string): boolean {
  if (!password || !salt || !expectedHash) return false;
  try {
    const derived = crypto.scryptSync(password, salt, 64);
    const expectedBuf = Buffer.from(expectedHash, 'hex');
    if (derived.length !== expectedBuf.length) return false;
    return crypto.timingSafeEqual(derived, expectedBuf);
  } catch {
    return false;
  }
}

export function hashOtpCode(otp: string, merchantId: string): string {
  return crypto
    .createHmac('sha256', getSessionSecret())
    .update(`${merchantId}:${otp.trim()}`)
    .digest('hex');
}

export interface SessionPayload {
  merchantId: string;
  slug: string;
  exp: number;
}

export function signSessionToken(merchantId: string, slug: string): string {
  const payload: SessionPayload = {
    merchantId,
    slug,
    exp: Date.now() + 1000 * 60 * 60 * 24 * 14, // 14 days
  };
  const encoded = Buffer.from(JSON.stringify(payload), 'utf-8').toString('base64url');
  const sig = crypto
    .createHmac('sha256', getSessionSecret())
    .update(encoded)
    .digest('base64url');
  return `${encoded}.${sig}`;
}

export function verifySessionToken(token?: string | null): SessionPayload | null {
  if (!token || !token.includes('.')) return null;
  const [encoded, sig] = token.split('.');
  if (!encoded || !sig) return null;

  try {
    const expectedSig = crypto
      .createHmac('sha256', getSessionSecret())
      .update(encoded)
      .digest('base64url');

    const a = Buffer.from(sig);
    const b = Buffer.from(expectedSig);
    if (a.length !== b.length || !crypto.timingSafeEqual(a, b)) {
      return null;
    }

    const decoded = JSON.parse(Buffer.from(encoded, 'base64url').toString('utf-8')) as SessionPayload;
    if (!decoded.merchantId || !decoded.slug || !decoded.exp || decoded.exp < Date.now()) {
      return null;
    }
    return decoded;
  } catch {
    return null;
  }
}

export function sanitizeMerchant(merchant: Merchant): PublicMerchant {
  const { passwordHash: _hash, passwordSalt: _salt, ...rest } = merchant;
  return rest;
}

export function isSafeRedirectPath(candidate?: string | null): string | null {
  if (!candidate) return null;
  const trimmed = candidate.trim();
  if (!trimmed.startsWith('/') || trimmed.startsWith('//') || trimmed.startsWith('/\\')) {
    return null;
  }
  return trimmed;
}
