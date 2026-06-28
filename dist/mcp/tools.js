"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.createTools = createTools;
const loader_1 = require("../model/loader");
const config_1 = require("../config");
const formatters_1 = require("../renderer/formatters");
const logger_1 = require("../utils/logger");
// Helper functions to ensure type safety while maintaining MCP compatibility
function createSearchViewsOutput(content) {
    return { content };
}
function createGetViewDetailsOutput(content, id) {
    return { content, id };
}
function createSearchElementsOutput(content) {
    return { content };
}
function createGetElementDetailsOutput(content, id) {
    return { content, id };
}
function createTools(modelPath) {
    const cfg = (0, config_1.loadConfig)();
    const loader = new loader_1.ModelLoader(modelPath || cfg.modelPath);
    const logger = (0, logger_1.getLogger)();
    const DISCLAIMER_PREFIX = cfg.disclaimerPrefix || '';
    function resolveFormat(format) {
        return format || cfg.responseFormat;
    }
    async function searchViewsHandler(input) {
        return logger.auditToolInvocation('SearchViews', input, async () => {
            const q = input?.query ? String(input.query).toLowerCase() : '';
            const model = loader.load();
            let views = model.views || [];
            if (q)
                views = views.filter(v => (v.name || '').toLowerCase().includes(q));
            if (cfg.viewsFilterByProperty) {
                const pname = cfg.viewsFilterPropertyName;
                views = views.filter(v => v.properties && Object.prototype.hasOwnProperty.call(v.properties, pname));
            }
            const formatter = (0, formatters_1.getFormatter)(resolveFormat(input?.format));
            const content = formatter.formatViewList(views, DISCLAIMER_PREFIX || undefined);
            const out = createSearchViewsOutput(content);
            out.__audit = {
                resultCount: views.length
            };
            return out;
        });
    }
    async function getViewDetailsHandler(input) {
        return logger.auditToolInvocation('GetViewDetails', input, async () => {
            if (!input || !input.viewname)
                throw new Error('viewname required');
            const model = loader.load();
            // find by exact name or contains
            const searchName = String(input.viewname || '').toLowerCase();
            const v = model.views.find(x => String(x.name || '').toLowerCase() === searchName)
                || model.views.find(x => String(x.name || '').toLowerCase().includes(searchName));
            let out;
            if (!v) {
                out = createGetViewDetailsOutput(`# View not found: ${input.viewname}`);
                out.__audit = { found: false };
                return out;
            }
            const formatter = (0, formatters_1.getFormatter)(resolveFormat(input?.format));
            const content = formatter.formatViewDetails(model, v, DISCLAIMER_PREFIX || undefined);
            out = createGetViewDetailsOutput(content, v.id);
            out.__audit = { found: true, viewId: v.id };
            return out;
        });
    }
    async function searchElementsHandler(input) {
        return logger.auditToolInvocation('SearchElements', input, async () => {
            const q = input?.query ? String(input.query).toLowerCase() : '';
            const t = input?.type ? String(input.type).toLowerCase() : '';
            const model = loader.load();
            let elements = model.elements || [];
            // Filter by query (name or documentation)
            if (q) {
                elements = elements.filter(e => (e.name || '').toLowerCase().includes(q) ||
                    (e.documentation || '').toLowerCase().includes(q) ||
                    Object.entries(e.properties || {}).some(([key, value]) => String(key || '').toLowerCase().includes(q) || String(value || '').toLowerCase().includes(q)));
            }
            // Filter by type if specified
            if (t) {
                elements = elements.filter(e => (e.type || '').toLowerCase().includes(t));
            }
            const formatter = (0, formatters_1.getFormatter)(resolveFormat(input?.format));
            const content = formatter.formatElementList(elements, DISCLAIMER_PREFIX || undefined);
            const out = createSearchElementsOutput(content);
            out.__audit = {
                resultCount: elements.length
            };
            return out;
        });
    }
    async function getElementDetailsHandler(input) {
        return logger.auditToolInvocation('GetElementDetails', input, async () => {
            if (!input || !input.elementname)
                throw new Error('elementname required');
            const model = loader.load();
            // Find element by exact name or contains
            const element = model.elements.find(x => (x.name || '').toLowerCase() === input.elementname.toLowerCase())
                || model.elements.find(x => (x.name || '').toLowerCase().includes(input.elementname.toLowerCase()));
            let out;
            if (!element) {
                out = createGetElementDetailsOutput(`# Element not found: ${input.elementname}`);
                out.__audit = { found: false };
                return out;
            }
            const formatter = (0, formatters_1.getFormatter)(resolveFormat(input?.format));
            const content = formatter.formatElementDetails(model, element, DISCLAIMER_PREFIX || undefined);
            out = createGetElementDetailsOutput(content, element.id);
            out.__audit = { found: true, elementId: element.id };
            return out;
        });
    }
    return { searchViewsHandler, getViewDetailsHandler, searchElementsHandler, getElementDetailsHandler, loader };
}
