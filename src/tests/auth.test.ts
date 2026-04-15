import { describe, it, expect } from 'vitest';
import { getUsernameFromBearerTokenUnverified, getUsernameFromClaims } from '../utils/auth';

function createUnsignedJwt(payload: Record<string, unknown>): string {
  const header = Buffer.from(JSON.stringify({ alg: 'none', typ: 'JWT' })).toString('base64url');
  const body = Buffer.from(JSON.stringify(payload)).toString('base64url');
  return `${header}.${body}.`;
}

describe('auth helpers', () => {
  it('extracts username from claims in priority order', () => {
    const username = getUsernameFromClaims({ preferred_username: 'user@contoso.com' });
    expect(username).toBe('user@contoso.com');
  });

  it('extracts username from unverified token claims', () => {
    const token = createUnsignedJwt({ upn: 'invalid-token-user@contoso.com' });
    const username = getUsernameFromBearerTokenUnverified(token);
    expect(username).toBe('invalid-token-user@contoso.com');
  });

  it('returns undefined for malformed token', () => {
    const username = getUsernameFromBearerTokenUnverified('not-a-jwt');
    expect(username).toBeUndefined();
  });
});
