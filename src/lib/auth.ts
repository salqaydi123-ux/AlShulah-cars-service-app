import crypto from 'crypto';

// جلسة دخول واحدة مشتركة (كلمة سر واحدة للتطبيق) — موقّعة بـ HMAC حتى لا يمكن تزوير الكوكي.
export const SESSION_COOKIE = 'alshulah_session';
const SESSION_MAX_AGE_SECONDS = 60 * 60 * 24 * 30; // 30 يوم

function getSecret(): string {
  const secret = process.env.SESSION_SECRET;
  if (!secret) {
    throw new Error('متغيّر البيئة SESSION_SECRET غير مضبوط.');
  }
  return secret;
}

function sign(payload: string): string {
  return crypto.createHmac('sha256', getSecret()).update(payload).digest('hex');
}

export function createSessionToken(): string {
  const issuedAt = Date.now().toString();
  const signature = sign(issuedAt);
  return `${issuedAt}.${signature}`;
}

export function verifySessionToken(token: string | undefined | null): boolean {
  if (!token) return false;
  const [issuedAt, signature] = token.split('.');
  if (!issuedAt || !signature) return false;

  const expected = sign(issuedAt);
  const a = Buffer.from(signature);
  const b = Buffer.from(expected);
  if (a.length !== b.length || !crypto.timingSafeEqual(a, b)) return false;

  const ageMs = Date.now() - Number(issuedAt);
  if (Number.isNaN(ageMs) || ageMs < 0 || ageMs > SESSION_MAX_AGE_SECONDS * 1000) return false;

  return true;
}

export function checkPassword(candidate: string): boolean {
  const expected = process.env.APP_PASSWORD;
  if (!expected) {
    throw new Error('متغيّر البيئة APP_PASSWORD غير مضبوط.');
  }
  const a = Buffer.from(candidate);
  const b = Buffer.from(expected);
  if (a.length !== b.length) return false;
  return crypto.timingSafeEqual(a, b);
}

export const SESSION_COOKIE_OPTIONS = {
  httpOnly: true,
  secure: process.env.NODE_ENV === 'production',
  sameSite: 'lax' as const,
  path: '/',
  maxAge: SESSION_MAX_AGE_SECONDS,
};
