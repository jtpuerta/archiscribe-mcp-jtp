import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { createMcpServer } from './server';

async function main() {
  const mcp = await createMcpServer();

  if (!mcp.sdkServer) {
    console.error('MCP sdkServer is not available');
    process.exit(1);
  }

  const transport = new StdioServerTransport();
  await mcp.sdkServer.connect(transport);
}

main().catch(err => {
  console.error('Failed to start STDIO server', err);
  process.exit(1);
});