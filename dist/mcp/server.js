"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
exports.createMcpServer = createMcpServer;
const app_1 = require("../services/app");
const zod_1 = require("zod");
const logger_1 = require("../utils/logger");
// Gemini: À ajouter tout en haut du fichier src/mcp/server.ts
process.on('uncaughtException', (err) => {
    if (err.code === 'ENOENT') {
        console.error(`=== 🚨 COMPOSANT MANQUANT DETECTE ===`);
        console.error(`Le serveur a essayé de lancer la commande : "${err.path}"`);
        console.error(`Vérifie que ce programme est bien installé sur ton Windows !`);
        console.error(err.stack);
    }
});
// Create and start an MCP server registering our tools. This function will try to import
// the `@modelcontextprotocol/sdk` package and register tools using a best-effort API.
// If the SDK is not available, it will return a shim that exposes the tools for in-process use.
async function createMcpServer() {
    const tools = app_1.appService.tools;
    let sdkServer = null;
    const logger = (0, logger_1.getLogger)();
    try {
        // Try to load the high-level McpServer (preferred approach)
        const { McpServer } = await Promise.resolve().then(() => __importStar(require('@modelcontextprotocol/sdk/server/mcp.js')));
        //console.info('MCP: initialising server');
        logger.log('info', 'mcp.init', { message: 'initialising server' });
        const server = new McpServer({ name: 'ArchiScribe MCP', version: '1.0.0' }, { capabilities: { tools: { listChanged: true } } });
        // Register the SearchViews tool
        server.registerTool('SearchViews', {
            title: 'Search Views',
            description: 'Search view names in the ArchiMate model',
            inputSchema: {
                query: zod_1.z.string().optional().describe('Search keyword to filter view names'),
                format: zod_1.z.enum(['markdown', 'yaml', 'json']).optional().describe('Response format (default: markdown)')
            },
        }, 
        // @ts-ignore
        async (args) => {
            const out = await tools.searchViewsHandler({ query: args?.query, format: args?.format });
            return { content: [{ type: 'text', text: out.content }], structuredContent: out };
        });
        //console.info('MCP: registered tool: SearchViews');
        logger.log('info', 'mcp.tool.register', { tool: 'SearchViews', highLevel: true });
        // Register the GetViewDetails tool
        server.registerTool('GetViewDetails', {
            title: 'Get View Details',
            description: 'Get detailed information for a named view in the ArchiMate model',
            inputSchema: {
                viewname: zod_1.z.string().describe('The exact name of the view to retrieve details for'),
                format: zod_1.z.enum(['markdown', 'yaml', 'json']).optional().describe('Response format (default: markdown)')
            },
        }, async (args) => {
            const out = await tools.getViewDetailsHandler({ viewname: args.viewname, format: args?.format });
            return { content: [{ type: 'text', text: out.content }], structuredContent: out };
        });
        //console.info('MCP: registered tool: GetViewDetails');
        logger.log('info', 'mcp.tool.register', { tool: 'GetViewDetails', highLevel: true });
        // Register the SearchElements tool
        server.registerTool('SearchElements', {
            title: 'Search Elements',
            description: 'Search elements in the ArchiMate model by name, type, or documentation',
            inputSchema: {
                query: zod_1.z.string().optional().describe('Search keyword to filter element names, documentation, and properties'),
                type: zod_1.z.string().optional().describe('Filter elements by type'),
                format: zod_1.z.enum(['markdown', 'yaml', 'json']).optional().describe('Response format (default: markdown)')
            },
        }, async (args) => {
            const out = await tools.searchElementsHandler({ query: args?.query, type: args?.type, format: args?.format });
            return { content: [{ type: 'text', text: out.content }], structuredContent: out };
        });
        //console.info('MCP: registered tool: SearchElements');
        logger.log('info', 'mcp.tool.register', { tool: 'SearchElements', highLevel: true });
        // Register the GetElementDetails tool
        server.registerTool('GetElementDetails', {
            title: 'Get Element Details',
            description: 'Get detailed information for a named element in the ArchiMate model',
            inputSchema: {
                elementname: zod_1.z.string().describe('The name of the element to retrieve details for'),
                format: zod_1.z.enum(['markdown', 'yaml', 'json']).optional().describe('Response format (default: markdown)')
            },
        }, async (args) => {
            const out = await tools.getElementDetailsHandler({ elementname: args.elementname, format: args?.format });
            return { content: [{ type: 'text', text: out.content }], structuredContent: out };
        });
        //console.info('MCP: registered tool: GetElementDetails');
        logger.log('info', 'mcp.tool.register', { tool: 'GetElementDetails', highLevel: true });
        sdkServer = server;
    }
    catch (err) {
        // SDK not available or registration failed; continue with in-process tools only
        const msg = err?.message || String(err);
        console.warn('MCP SDK not loaded, falling back to in-process tools only:', msg);
        logger.log('warn', 'mcp.init.fallback', { message: 'SDK not loaded, using in-process tools', error: msg });
        sdkServer = null;
    }
    async function start() {
        if (sdkServer && typeof sdkServer.start === 'function') {
            await sdkServer.start();
            logger.log('info', 'mcp.server.start', { mode: 'sdk', tools: Object.keys(tools) });
        }
        else {
            logger.log('info', 'mcp.server.start', { mode: 'in-process', tools: Object.keys(tools) });
        }
        return { tools };
    }
    async function stop() {
        if (sdkServer && typeof sdkServer.stop === 'function') {
            await sdkServer.stop();
            logger.log('info', 'mcp.server.stop', { mode: 'sdk' });
        }
        else {
            logger.log('info', 'mcp.server.stop', { mode: 'in-process' });
        }
        return;
    }
    return { start, stop, tools, sdkServer };
}
