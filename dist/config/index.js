"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.loadConfig = loadConfig;
const fs_1 = require("fs");
const path_1 = require("path");
function normalizeLogTarget(raw) {
    const value = String(raw || '').trim().toLowerCase();
    if (value === 'file' || value === 'console' || value === 'both' || value === 'auto') {
        return value;
    }
    return 'auto';
}
function readSettings() {
    try {
        const p = (0, path_1.join)(__dirname, '..', '..', 'config', 'settings.json');
        const raw = (0, fs_1.readFileSync)(p, 'utf8');
        return JSON.parse(raw);
    }
    catch (err) {
        return {};
    }
}
function loadConfig() {
    const defaults = readSettings();
    // Require explicit configuration - no hardcoded fallbacks
    const modelPath = process.env.MODEL_PATH || defaults.modelPath;
    if (!modelPath) {
        throw new Error('Model path must be specified in config/settings.json or MODEL_PATH environment variable');
    }
    return {
        modelPath,
        viewsFilterByProperty: (process.env.VIEWS_FILTER_BY_PROPERTY || String(defaults.viewsFilterByProperty || 'false')) === 'true',
        viewsFilterPropertyName: process.env.VIEWS_FILTER_PROPERTY_NAME || defaults.viewsFilterPropertyName || 'AI-Context',
        serverPort: Number(process.env.SERVER_PORT || defaults.serverPort || 3030),
        enableHttpEndpoints: (process.env.ENABLE_HTTP_ENDPOINTS || String(defaults.enableHttpEndpoints || 'false')) === 'true',
        logPath: process.env.LOG_PATH || defaults.logPath || 'logs',
        logLevel: process.env.LOG_LEVEL || defaults.logLevel || 'info',
        logTarget: normalizeLogTarget(process.env.LOG_TARGET || defaults.logTarget || 'auto'),
        disclaimerPrefix: process.env.DISCLAIMER_PREFIX || defaults.disclaimerPrefix || '',
        responseFormat: process.env.RESPONSE_FORMAT || defaults.responseFormat || 'markdown'
    };
}
