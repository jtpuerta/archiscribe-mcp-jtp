"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.logger = void 0;
exports.getLogger = getLogger;
const fs_1 = require("fs");
const path_1 = require("path");
const async_hooks_1 = require("async_hooks");
const config_1 = require("../config");
const LEVEL_ORDER = { debug: 10, info: 20, warn: 30, error: 40 };
class DailyFileLogger {
    constructor(dir, level, target) {
        this.currentDate = null; // YYYY-MM-DD
        this.stream = null;
        this.warned = false;
        this.contextStore = new async_hooks_1.AsyncLocalStorage();
        const cfg = (0, config_1.loadConfig)();
        this.logDir = dir || cfg.logPath || 'logs';
        this.level = level || cfg.logLevel || 'info';
        this.target = target || cfg.logTarget || 'auto';
        if (this.shouldWriteFile()) {
            this.ensureStream();
        }
    }
    today() { return new Date().toISOString().slice(0, 10); }
    isCloudEnvironment() {
        return Boolean(process.env.WEBSITE_INSTANCE_ID
            || process.env.WEBSITE_SITE_NAME
            || process.env.WEBSITE_HOSTNAME
            || process.env.WEBSITE_RESOURCE_GROUP);
    }
    resolveTarget() {
        if (this.target === 'auto') {
            return this.isCloudEnvironment() ? 'console' : 'file';
        }
        return this.target;
    }
    shouldWriteFile() {
        const resolved = this.resolveTarget();
        return resolved === 'file' || resolved === 'both';
    }
    shouldWriteConsole() {
        const resolved = this.resolveTarget();
        return resolved === 'console' || resolved === 'both';
    }
    ensureStream() {
        const d = this.today();
        if (this.currentDate === d && this.stream)
            return;
        try {
            (0, fs_1.mkdirSync)(this.logDir, { recursive: true });
            this.currentDate = d;
            if (this.stream) {
                try {
                    this.stream.end();
                }
                catch { }
            }
            const file = (0, path_1.join)(this.logDir, `archiscribe-${d}.log`);
            this.stream = (0, fs_1.createWriteStream)(file, { flags: 'a', encoding: 'utf8' });
        }
        catch (err) {
            if (!this.warned) {
                //  Sécurisé pour MCP : on pousse l'avertissement sur stderr
                console.error('Logger: cannot write log file:', err.message);
                this.warned = true;
            }
            this.stream = null;
        }
    }
    setLevel(l) { this.level = l; }
    shouldLog(l) { return LEVEL_ORDER[l] >= LEVEL_ORDER[this.level]; }
    log(level, event, record) {
        if (!this.shouldLog(level))
            return;
        if (this.shouldWriteFile()) {
            this.ensureStream();
        }
        const base = { ts: new Date().toISOString(), level, event };
        const context = this.contextStore.getStore() || {};
        const out = { ...base, ...this.sanitize(context), ...this.sanitize(record) };
        const line = JSON.stringify(out);
        let wroteFile = false;
        if (this.shouldWriteFile() && this.stream) {
            this.stream.write(line + '\n');
            wroteFile = true;
        }
        if (this.shouldWriteConsole() || (!wroteFile && this.target !== 'console')) {
            //  Sécurisé pour MCP : On envoie les logs au terminal via stderr !
            console.error(line);
        }
    }
    withContext(context, fn) {
        const existing = this.contextStore.getStore() || {};
        return Promise.resolve(this.contextStore.run({ ...existing, ...context }, fn));
    }
    sanitize(obj, depth = 0) {
        if (obj == null)
            return obj;
        if (typeof obj === 'string') {
            if (obj.length > 2000)
                return obj.slice(0, 2000) + '...<truncated>'; // truncate
            return obj;
        }
        if (depth > 3)
            return '[DepthLimit]';
        if (Array.isArray(obj))
            return obj.slice(0, 50).map(v => this.sanitize(v, depth + 1));
        if (typeof obj === 'object') {
            const out = {};
            const keys = Object.keys(obj).slice(0, 50);
            for (const k of keys)
                out[k] = this.sanitize(obj[k], depth + 1);
            return out;
        }
        return obj;
    }
    flush() {
        return new Promise(res => {
            if (!this.stream)
                return res();
            this.stream.once('finish', () => res());
            this.stream.end();
            this.stream = null;
        });
    }
    auditToolInvocation(tool, params, fn) {
        const start = Date.now();
        return fn().then(result => {
            // Allow tool handlers to attach lightweight audit metadata on the result as __audit
            let auditMeta = undefined;
            if (result && typeof result === 'object' && Object.prototype.hasOwnProperty.call(result, '__audit')) {
                auditMeta = result.__audit;
                // Do not retain the internal field on the outward result
                try {
                    delete result.__audit;
                }
                catch { }
            }
            this.log('info', 'tool.invoke', { tool, params, durationMs: Date.now() - start, success: true, ...(auditMeta || {}) });
            return result;
        }).catch(err => {
            this.log('error', 'tool.invoke', { tool, params, durationMs: Date.now() - start, success: false, error: err.message });
            throw err;
        });
    }
    auditHttpInvocation(method, path, params, fn) {
        const start = Date.now();
        return fn().then(result => {
            this.log('info', 'http.request', { method, path, params, durationMs: Date.now() - start, success: true });
            return result;
        }).catch(err => {
            this.log('error', 'http.request', { method, path, params, durationMs: Date.now() - start, success: false, error: err.message });
            throw err;
        });
    }
}
// Singleton logger instance
exports.logger = new DailyFileLogger();
function getLogger() { return exports.logger; }
