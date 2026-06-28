"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.Router = void 0;
const url_1 = require("url");
const app_1 = require("../services/app");
const logger_1 = require("../utils/logger");
const formatters_1 = require("../renderer/formatters");
const VALID_FORMATS = ['markdown', 'yaml', 'json'];
class Router {
    async handle(req, res) {
        const url = (0, url_1.parse)(req.url || '', true);
        const pathname = url.pathname || '/';
        const logger = (0, logger_1.getLogger)();
        if (req.method === 'GET' && pathname === '/health') {
            res.statusCode = 200;
            res.setHeader('content-type', 'text/plain');
            res.end('OK');
            return;
        }
        const formatParam = url.query?.format ? String(url.query.format) : undefined;
        const format = formatParam && VALID_FORMATS.includes(formatParam)
            ? formatParam
            : undefined;
        const effectiveFormat = format || app_1.appService.config.responseFormat;
        const formatter = (0, formatters_1.getFormatter)(effectiveFormat);
        try {
            if (req.method === 'GET' && pathname === '/views') {
                const q = (url.query && (url.query.q || url.query.query)) || url.query?.query || '';
                const input = { query: String(q || ''), format: effectiveFormat };
                const out = await logger.auditHttpInvocation('GET', '/views', input, async () => app_1.appService.tools.searchViewsHandler(input));
                res.statusCode = 200;
                res.setHeader('content-type', formatter.contentType);
                res.end(out.content);
                return;
            }
            if (req.method === 'GET' && pathname && pathname.startsWith('/views/')) {
                const name = decodeURIComponent(pathname.replace('/views/', ''));
                const input = { viewname: name, format: effectiveFormat };
                const out = await logger.auditHttpInvocation('GET', '/views/:name', input, async () => app_1.appService.tools.getViewDetailsHandler(input));
                res.statusCode = 200;
                res.setHeader('content-type', formatter.contentType);
                res.end(out.content);
                return;
            }
            if (req.method === 'GET' && pathname === '/elements') {
                const q = (url.query && (url.query.q || url.query.query)) || url.query?.query || '';
                const type = url.query?.type || '';
                const input = { query: String(q || ''), type: String(type || ''), format: effectiveFormat };
                const out = await logger.auditHttpInvocation('GET', '/elements', input, async () => app_1.appService.tools.searchElementsHandler(input));
                res.statusCode = 200;
                res.setHeader('content-type', formatter.contentType);
                res.end(out.content);
                return;
            }
            if (req.method === 'GET' && pathname && pathname.startsWith('/elements/')) {
                const name = decodeURIComponent(pathname.replace('/elements/', ''));
                const input = { elementname: name, format: effectiveFormat };
                const out = await logger.auditHttpInvocation('GET', '/elements/:name', input, async () => app_1.appService.tools.getElementDetailsHandler(input));
                res.statusCode = 200;
                res.setHeader('content-type', formatter.contentType);
                res.end(out.content);
                return;
            }
        }
        catch (err) {
            res.statusCode = 500;
            res.setHeader('content-type', 'text/plain');
            res.end(String(err?.message || err));
            return;
        }
        res.statusCode = 404;
        res.setHeader('content-type', 'text/plain');
        res.end('Not Found');
    }
}
exports.Router = Router;
