"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const http_1 = require("http");
const router_1 = require("../api/router");
const server_1 = require("./server");
const app_1 = require("../services/app");
const errors_1 = require("../utils/errors");
const logger_1 = require("../utils/logger");
const auth_1 = require("../utils/auth");
const VALID_FORMATS = ['markdown', 'yaml', 'json'];
const logger = (0, logger_1.getLogger)();
function parseHeaderFormat(raw) {
    const value = Array.isArray(raw) ? raw[0] : raw;
    if (typeof value !== 'string')
        return undefined;
    const normalized = value.trim().toLowerCase();
    return VALID_FORMATS.includes(normalized)
        ? normalized
        : undefined;
}
function applyHeaderFormatToToolCallBody(body, format) {
    if (!format || !body)
        return body;
    const applyToPayload = (payload) => {
        if (!payload || payload.method !== 'tools/call')
            return;
        if (!payload.params || typeof payload.params !== 'object')
            payload.params = {};
        if (!payload.params.arguments || typeof payload.params.arguments !== 'object')
            payload.params.arguments = {};
        if (!payload.params.arguments.format)
            payload.params.arguments.format = format;
    };
    if (Array.isArray(body)) {
        body.forEach(applyToPayload);
        return body;
    }
    applyToPayload(body);
    return body;
}
const port = Number(process.env.PORT || app_1.appService.config.serverPort);
// Read request body and attempt to parse JSON
function readRequestBody(req) {
    return new Promise((resolve, reject) => {
        const chunks = [];
        req.on('data', (c) => chunks.push(c));
        req.on('end', () => {
            const buf = Buffer.concat(chunks);
            if (!buf || buf.length === 0)
                return resolve(undefined);
            const s = buf.toString('utf8');
            try {
                resolve(JSON.parse(s));
            }
            catch {
                resolve(s);
            }
        });
        req.on('error', reject);
    });
}
async function handleMcpRequest(mcp, req, res) {
    if (!mcp.sdkServer) {
        // Return a 404 JSON-RPC error so clients fall back to legacy SSE
        const errorResponse = (0, errors_1.createJsonRpcError)(-32000, 'Not Found');
        res.statusCode = 404;
        res.setHeader('content-type', 'application/json');
        res.end(JSON.stringify(errorResponse));
        return;
    }
    const body = await readRequestBody(req);
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const { StreamableHTTPServerTransport } = require('@modelcontextprotocol/sdk/server/streamableHttp.js');
    const transport = new StreamableHTTPServerTransport({ sessionIdGenerator: undefined });
    // Close transport when response closes
    res.on('close', () => {
        try {
            transport.close();
        }
        catch (_) { /* ignore */ }
    });
    // Resolve format from X-Response-Format header
    const headerFormat = parseHeaderFormat(req.headers['x-response-format']);
    const requestBody = applyHeaderFormatToToolCallBody(body, headerFormat);
    await mcp.sdkServer.connect(transport);
    await transport.handleRequest(req, res, requestBody);
}
async function main() {
    const enableHttp = Boolean(app_1.appService.config.enableHttpEndpoints);
    const authEnforced = (0, auth_1.isAuthEnforced)();
    const router = enableHttp ? new router_1.Router() : undefined;
    const mcp = await (0, server_1.createMcpServer)();
    // Start the MCP server if it has SDK backing so transports and notifications are initialized
    try {
        await mcp.start();
        logger.log('info', 'server.mcp.start', { success: true });
    }
    catch (err) {
        console.warn('MCP server start() failed:', err?.message || err);
        logger.log('warn', 'server.mcp.start', { success: false, error: err?.message || String(err) });
    }
    const server = (0, http_1.createServer)(async (req, res) => {
        // handle /mcp transport requests
        const host = 'localhost';
        const url = new URL(req.url || '/', `http://${host}`);
        const pathname = url.pathname;
        if (req.method === 'GET' && pathname === '/.well-known/oauth-protected-resource') {
            if (!authEnforced) {
                res.statusCode = 404;
                res.setHeader('content-type', 'application/json');
                res.end(JSON.stringify({ error: 'Not Found' }));
                return;
            }
            (0, auth_1.writeProtectedResourceMetadata)(req, res);
            return;
        }
        if (pathname === '/mcp') {
            if (!authEnforced) {
                try {
                    await handleMcpRequest(mcp, req, res);
                }
                catch (err) {
                    (0, errors_1.handleMcpError)(res, err);
                }
                return;
            }
            const authHeaderRaw = req.headers.authorization;
            const authHeader = Array.isArray(authHeaderRaw) ? authHeaderRaw[0] : authHeaderRaw;
            if (!authHeader || !authHeader.toLowerCase().startsWith('bearer ')) {
                res.statusCode = 401;
                res.setHeader('www-authenticate', (0, auth_1.getBearerChallenge)(req, 'invalid_token', 'Missing bearer access token'));
                res.setHeader('content-type', 'application/json');
                res.end(JSON.stringify((0, errors_1.createJsonRpcError)(-32001, 'Unauthorized')));
                return;
            }
            const token = authHeader.slice('bearer '.length).trim();
            if (!token) {
                res.statusCode = 401;
                res.setHeader('www-authenticate', (0, auth_1.getBearerChallenge)(req, 'invalid_token', 'Missing bearer access token'));
                res.setHeader('content-type', 'application/json');
                res.end(JSON.stringify((0, errors_1.createJsonRpcError)(-32001, 'Unauthorized')));
                return;
            }
            let username;
            try {
                const validation = await (0, auth_1.validateEntraAccessToken)(token);
                username = (0, auth_1.getUsernameFromClaims)(validation.claims);
            }
            catch (err) {
                const message = err?.message || 'Invalid bearer token';
                const usernameHint = (0, auth_1.getUsernameFromBearerTokenUnverified)(token);
                logger.log('warn', 'auth.token.invalid', {
                    reason: message,
                    username: usernameHint,
                    usernameSource: usernameHint ? 'unverified_token_claim' : undefined
                });
                res.statusCode = 401;
                res.setHeader('www-authenticate', (0, auth_1.getBearerChallenge)(req, 'invalid_token', message));
                res.setHeader('content-type', 'application/json');
                res.end(JSON.stringify((0, errors_1.createJsonRpcError)(-32001, 'Unauthorized')));
                return;
            }
            try {
                if (username) {
                    await logger.withContext({ username }, async () => {
                        await handleMcpRequest(mcp, req, res);
                    });
                }
                else {
                    await handleMcpRequest(mcp, req, res);
                }
            }
            catch (err) {
                (0, errors_1.handleMcpError)(res, err);
            }
            return;
        }
        // Fallback to existing router for other endpoints (if enabled)
        if (!enableHttp || !router) {
            // Return 404 for any non-/mcp endpoints when HTTP endpoints are disabled
            res.statusCode = 404;
            res.setHeader('content-type', 'text/plain');
            res.end('Not Found');
            return;
        }
        router.handle(req, res).catch(err => {
            res.statusCode = 500;
            res.setHeader('content-type', 'text/plain');
            res.end('Internal Server Error');
            console.error(err);
            logger.log('error', 'http.unhandled', { error: err?.message || err });
        });
    });
    server.listen(Number(port), () => {
        //console.log(`Server listening on port ${port}`);
        logger.log('info', 'server.listen', { port });
        logger.log('info', 'server.auth.mode', {
            mode: process.env.MCP_AUTH_MODE || 'auto',
            authEnforced,
            cloudEnvironment: (0, auth_1.isCloudEnvironment)()
        });
    });
}
main().catch(err => {
    console.error('Failed to start server', err);
    logger.log('error', 'server.start.fail', { error: err?.message || String(err) });
    process.exit(1);
});
