export const ACCESS_TOKEN_COOKIE = 'access_token';

export function getAccessToken(): string | null {
  if (typeof document === 'undefined') return null;
  const match = document.cookie.match(new RegExp(`(?:^|; )${ACCESS_TOKEN_COOKIE}=([^;]*)`));
  return match ? decodeURIComponent(match[1]) : null;
}

/**
 * Clears the readable access-token cookie on the client. The httpOnly
 * refresh-token cookie can only be cleared by a server route — see
 * app/auth/logout/route.ts.
 */
export function clearAuthCookies() {
  if (typeof document === 'undefined') return;
  document.cookie = `${ACCESS_TOKEN_COOKIE}=; path=/; expires=Thu, 01 Jan 1970 00:00:00 GMT`;
}
