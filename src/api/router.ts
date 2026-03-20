import { IncomingMessage, ServerResponse } from 'http';
import { parse } from 'url';
import { appService } from '../services/app';
import { getLogger } from '../utils/logger';
import { ResponseFormat } from '../config';
import { getFormatter } from '../renderer/formatters';

const VALID_FORMATS: ResponseFormat[] = ['markdown', 'yaml', 'json'];

export class Router {
  async handle(req: IncomingMessage, res: ServerResponse) {
    const url = parse(req.url || '', true);
    const pathname = url.pathname || '/';
    const logger = getLogger();

    if (req.method === 'GET' && pathname === '/health') {
      res.statusCode = 200;
      res.setHeader('content-type', 'text/plain');
      res.end('OK');
      return;
    }

    const formatParam = url.query?.format ? String(url.query.format) : undefined;
    const format: ResponseFormat | undefined = formatParam && VALID_FORMATS.includes(formatParam as ResponseFormat)
      ? formatParam as ResponseFormat
      : undefined;
    const effectiveFormat = format || appService.config.responseFormat;
    const formatter = getFormatter(effectiveFormat);

    try {
      if (req.method === 'GET' && pathname === '/views') {
        const q = (url.query && (url.query.q || url.query.query)) || url.query?.query || '';
        const input = { query: String(q || ''), format: effectiveFormat };
        const out = await logger.auditHttpInvocation(
          'GET', '/views', input, 
          async () => appService.tools.searchViewsHandler(input)
        );
        res.statusCode = 200;
        res.setHeader('content-type', formatter.contentType);
        res.end(out.content);
        return;
      }

      if (req.method === 'GET' && pathname && pathname.startsWith('/views/')) {
        const name = decodeURIComponent(pathname.replace('/views/', ''));
        const input = { viewname: name, format: effectiveFormat };
        const out = await logger.auditHttpInvocation(
          'GET', '/views/:name', input, 
          async () => appService.tools.getViewDetailsHandler(input)
        );
        res.statusCode = 200;
        res.setHeader('content-type', formatter.contentType);
        res.end(out.content);
        return;
      }

      if (req.method === 'GET' && pathname === '/elements') {
        const q = (url.query && (url.query.q || url.query.query)) || url.query?.query || '';
        const type = url.query?.type || '';
        const input = { query: String(q || ''), type: String(type || ''), format: effectiveFormat };
        const out = await logger.auditHttpInvocation(
          'GET', '/elements', input, 
          async () => appService.tools.searchElementsHandler(input)
        );
        res.statusCode = 200;
        res.setHeader('content-type', formatter.contentType);
        res.end(out.content);
        return;
      }

      if (req.method === 'GET' && pathname && pathname.startsWith('/elements/')) {
        const name = decodeURIComponent(pathname.replace('/elements/', ''));
        const input = { elementname: name, format: effectiveFormat };
        const out = await logger.auditHttpInvocation(
          'GET', '/elements/:name', input, 
          async () => appService.tools.getElementDetailsHandler(input)
        );
        res.statusCode = 200;
        res.setHeader('content-type', formatter.contentType);
        res.end(out.content);
        return;
      }
    } catch (err: any) {
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
