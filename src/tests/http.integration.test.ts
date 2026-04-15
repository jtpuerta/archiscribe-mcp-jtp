import { describe, it, expect, afterAll, beforeAll } from 'vitest';
import { Router } from '../../src/api/router';
import { AddressInfo } from 'net';
import http from 'http';

function extractFirstViewName(markdown: string): string | undefined {
  const lines = markdown.split('\n').map(l => l.trim());
  const item = lines.find(l => l.startsWith('- ') && l.length > 2);
  return item ? item.slice(2).trim() : undefined;
}

describe('HTTP integration', () => {
  let server: http.Server;
  let port: number;

  beforeAll(async () => {
    const router = new Router();
    server = http.createServer((req, res) => {
      // mirror server entry: handle promise rejections
      router.handle(req, res).catch(err => {
        res.statusCode = 500;
        res.setHeader('content-type', 'text/plain');
        res.end('Internal Server Error');
        console.error(err);
      });
    });
    await new Promise<void>((resolve) => server.listen(0, resolve));
    port = (server.address() as AddressInfo).port;
  });

  afterAll(async () => {
    await new Promise<void>((resolve) => server.close(() => resolve()));
  });

  it('GET /views returns markdown', async () => {
    const res = await fetch(`http://localhost:${port}/views`);
    expect(res.status).toBe(200);
    const text = await res.text();
    expect(text).toContain('ArchiMate Views');
    expect(extractFirstViewName(text)).toBeTruthy();
  });

  it('GET /views/:name returns view details markdown', async () => {
    const listRes = await fetch(`http://localhost:${port}/views`);
    expect(listRes.status).toBe(200);
    const listText = await listRes.text();
    const viewName = extractFirstViewName(listText);
    expect(viewName).toBeTruthy();

    const res = await fetch(`http://localhost:${port}/views/${encodeURIComponent(viewName!)}`);
    expect(res.status).toBe(200);
    const text = await res.text();
    expect(text).toContain(`ArchiMate View name: ${viewName}`);
  });
});
