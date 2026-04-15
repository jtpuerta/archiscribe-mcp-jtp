import { IncomingMessage, ServerResponse } from 'http';
import jwt, { JwtPayload, JwtHeader, SigningKeyCallback, VerifyErrors } from 'jsonwebtoken';
import jwksRsa from 'jwks-rsa';

export interface TokenValidationResult {
  claims: JwtPayload;
}

interface ValidationConfig {
  issuers: string[];
  audiences: string[];
  requiredScope?: string;
  jwksUri: string;
}

let cachedJwksUri: string | null = null;
let cachedClient: jwksRsa.JwksClient | null = null;

function getValidationConfig(): ValidationConfig {
  const tenantId = process.env.AAD_TENANT_ID || process.env.WEBSITE_AUTH_AAD_ALLOWED_TENANTS;
  if (!tenantId) {
    throw new Error('AAD_TENANT_ID or WEBSITE_AUTH_AAD_ALLOWED_TENANTS must be set for token validation');
  }

  const issuerBase = process.env.AUTHORIZATION_SERVER_URL || `https://login.microsoftonline.com/${tenantId}/v2.0`;
  const tenantAuthorityBase = `https://login.microsoftonline.com/${tenantId}`;
  const requiredScope = process.env.OAUTH_SCOPE;

  const inferredAudience = requiredScope && requiredScope.includes('/')
    ? requiredScope.slice(0, requiredScope.lastIndexOf('/'))
    : undefined;

  const audience = process.env.OAUTH_AUDIENCE || inferredAudience;
  if (!audience) {
    throw new Error('OAUTH_AUDIENCE must be set, or OAUTH_SCOPE must include a scope path like api://<app-id>/user_impersonation');
  }

  const issuerNormalized = issuerBase.endsWith('/') ? issuerBase.slice(0, -1) : issuerBase;
  const issuers = [
    issuerNormalized,
    `${issuerNormalized}/`,
    `https://sts.windows.net/${tenantId}/`
  ];

  const audiences = new Set<string>([audience]);
  if (audience.startsWith('api://')) {
    audiences.add(audience.slice('api://'.length));
  }

  const jwksUri = process.env.OAUTH_JWKS_URI || `${tenantAuthorityBase}/discovery/v2.0/keys`;
  return { issuers, audiences: Array.from(audiences), requiredScope, jwksUri };
}

function getJwksClient(jwksUri: string): jwksRsa.JwksClient {
  if (cachedClient && cachedJwksUri === jwksUri) {
    return cachedClient;
  }

  cachedJwksUri = jwksUri;
  cachedClient = jwksRsa({
    jwksUri,
    cache: true,
    cacheMaxEntries: 5,
    cacheMaxAge: 10 * 60 * 1000,
    rateLimit: true,
    jwksRequestsPerMinute: 10
  });

  return cachedClient;
}

function getKey(client: jwksRsa.JwksClient) {
  return (header: JwtHeader, callback: SigningKeyCallback) => {
    const kid = header.kid;
    if (!kid) {
      callback(new Error('JWT header is missing kid'));
      return;
    }

    client.getSigningKey(kid, (err, key) => {
      if (err) {
        const e = err as Error;
        callback(new Error(`Signing key lookup failed for kid '${kid}' via '${cachedJwksUri}': ${e.message}`));
        return;
      }

      const signingKey = key?.getPublicKey();
      if (!signingKey) {
        callback(new Error('Unable to resolve signing key'));
        return;
      }

      callback(null, signingKey);
    });
  };
}

function hasRequiredScope(claims: JwtPayload, requiredScope?: string): boolean {
  if (!requiredScope) return true;

  const scopeClaim = typeof claims.scp === 'string' ? claims.scp : '';
  const tokenScopes = scopeClaim.split(' ').filter(Boolean);
  if (!tokenScopes.length) return false;

  const shortScope = requiredScope.includes('/')
    ? requiredScope.slice(requiredScope.lastIndexOf('/') + 1)
    : requiredScope;

  return tokenScopes.includes(requiredScope) || tokenScopes.includes(shortScope);
}

export async function validateEntraAccessToken(token: string): Promise<TokenValidationResult> {
  const cfg = getValidationConfig();
  const client = getJwksClient(cfg.jwksUri);
  const issuers = cfg.issuers as [string, ...string[]];
  const audiences = cfg.audiences as [string, ...string[]];

  const claims = await new Promise<JwtPayload>((resolve, reject) => {
    jwt.verify(
      token,
      getKey(client),
      {
        issuer: issuers,
        audience: audiences,
        algorithms: ['RS256'],
        clockTolerance: 30
      },
      (err: VerifyErrors | null, decoded: object | string | undefined) => {
        if (err) {
          reject(err);
          return;
        }

        if (!decoded || typeof decoded === 'string') {
          reject(new Error('JWT payload is missing or invalid'));
          return;
        }

        resolve(decoded);
      }
    );
  });

  if (!hasRequiredScope(claims, cfg.requiredScope)) {
    throw new Error(`Token missing required scope: ${cfg.requiredScope}`);
  }

  return { claims };
}

export function isCloudEnvironment(): boolean {
  return Boolean(
    process.env.WEBSITE_INSTANCE_ID
      || process.env.WEBSITE_SITE_NAME
      || process.env.WEBSITE_HOSTNAME
      || process.env.WEBSITE_RESOURCE_GROUP
  );
}

export function isAuthEnforced(): boolean {
  const mode = (process.env.MCP_AUTH_MODE || 'auto').toLowerCase();
  if (['required', 'enforced', 'on', 'true'].includes(mode)) return true;
  if (['disabled', 'off', 'none', 'false'].includes(mode)) return false;
  return isCloudEnvironment();
}

export function getAuthorizationServerUrl(): string | undefined {
  if (process.env.AUTHORIZATION_SERVER_URL) {
    return process.env.AUTHORIZATION_SERVER_URL;
  }

  const tenantId = process.env.AAD_TENANT_ID || process.env.WEBSITE_AUTH_AAD_ALLOWED_TENANTS;
  if (!tenantId) return undefined;
  return `https://login.microsoftonline.com/${tenantId}/v2.0`;
}

export function getRequestOrigin(req: IncomingMessage): string {
  const hostHeader = req.headers.host || 'localhost';
  const protoHeader = req.headers['x-forwarded-proto'];
  const proto = Array.isArray(protoHeader) ? protoHeader[0] : protoHeader;
  const scheme = proto || 'https';
  return `${scheme}://${hostHeader}`;
}

export function escapeAuthHeaderValue(value: string): string {
  return value.replace(/\\/g, '\\\\').replace(/"/g, '\\"');
}

export function getBearerChallenge(req: IncomingMessage, error?: string, errorDescription?: string): string {
  const origin = getRequestOrigin(req);
  const hostHeader = req.headers.host || 'localhost';
  const metadataUrl = `${origin}/.well-known/oauth-protected-resource`;
  const parts = [
    `realm="${escapeAuthHeaderValue(hostHeader)}"`,
    `resource_metadata="${escapeAuthHeaderValue(metadataUrl)}"`
  ];

  if (error) {
    parts.push(`error="${escapeAuthHeaderValue(error)}"`);
  }

  if (errorDescription) {
    parts.push(`error_description="${escapeAuthHeaderValue(errorDescription)}"`);
  }

  return `Bearer ${parts.join(', ')}`;
}

export function writeProtectedResourceMetadata(req: IncomingMessage, res: ServerResponse): void {
  const origin = getRequestOrigin(req);
  const resource = process.env.OAUTH_RESOURCE_URI || `${origin}/mcp`;
  const authorizationServer = getAuthorizationServerUrl();

  if (!authorizationServer) {
    res.statusCode = 500;
    res.setHeader('content-type', 'application/json');
    res.end(JSON.stringify({ error: 'authorization server not configured' }));
    return;
  }

  const scope = process.env.OAUTH_SCOPE;
  const metadata: Record<string, unknown> = {
    resource,
    authorization_servers: [authorizationServer],
    bearer_methods_supported: ['header']
  };

  if (scope) {
    metadata.scopes_supported = [scope];
  }

  res.statusCode = 200;
  res.setHeader('content-type', 'application/json');
  res.setHeader('cache-control', 'no-store');
  res.end(JSON.stringify(metadata));
}
