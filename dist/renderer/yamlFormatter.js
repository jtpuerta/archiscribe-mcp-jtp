"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.YamlFormatter = void 0;
exports.toYaml = toYaml;
const dataBuilders_1 = require("./dataBuilders");
// --- YAML Serializer ---
function needsQuoting(s) {
    return s === '' ||
        /^[\s]/.test(s) || /[\s]$/.test(s) ||
        /[:#{}[\],&*?|>!%@`]/.test(s) ||
        /^(true|false|null|yes|no|on|off)$/i.test(s) ||
        /^[\d.eE+-]+$/.test(s);
}
function scalarToYaml(value) {
    if (value === null || value === undefined)
        return 'null';
    if (typeof value === 'boolean' || typeof value === 'number')
        return String(value);
    const s = String(value);
    if (needsQuoting(s))
        return JSON.stringify(s);
    return s;
}
function toYaml(data, indent = 0) {
    const pad = '  '.repeat(indent);
    if (data === null || data === undefined)
        return 'null';
    if (typeof data !== 'object') {
        const s = String(data);
        if (s.includes('\n')) {
            return '|-\n' + s.split('\n').map(l => pad + '  ' + l).join('\n');
        }
        return scalarToYaml(data);
    }
    if (Array.isArray(data)) {
        if (data.length === 0)
            return '[]';
        const items = [];
        for (const item of data) {
            if (typeof item === 'object' && item !== null && !Array.isArray(item)) {
                const inner = objectToYamlLines(item, indent + 1);
                items.push(`${pad}- ${inner[0].trimStart()}`);
                for (let i = 1; i < inner.length; i++) {
                    items.push(inner[i]);
                }
            }
            else {
                items.push(`${pad}- ${toYaml(item, indent + 1)}`);
            }
        }
        return items.join('\n');
    }
    return objectToYamlLines(data, indent).join('\n');
}
function objectToYamlLines(obj, indent) {
    const pad = '  '.repeat(indent);
    const entries = Object.entries(obj).filter(([, v]) => v !== undefined);
    if (entries.length === 0)
        return [`${pad}{}`];
    const lines = [];
    for (const [key, value] of entries) {
        if (value === null) {
            lines.push(`${pad}${key}: null`);
        }
        else if (typeof value === 'object') {
            const isEmpty = Array.isArray(value)
                ? value.length === 0
                : Object.entries(value).filter(([, v]) => v !== undefined).length === 0;
            if (isEmpty) {
                lines.push(`${pad}${key}: ${Array.isArray(value) ? '[]' : '{}'}`);
            }
            else {
                lines.push(`${pad}${key}:`);
                lines.push(toYaml(value, indent + 1));
            }
        }
        else if (typeof value === 'string' && value.includes('\n')) {
            lines.push(`${pad}${key}: ${toYaml(value, indent)}`);
        }
        else {
            lines.push(`${pad}${key}: ${scalarToYaml(value)}`);
        }
    }
    return lines;
}
class YamlFormatter {
    constructor() {
        this.contentType = 'text/yaml';
    }
    formatViewList(views, disclaimer) {
        return toYaml((0, dataBuilders_1.withDisclaimerField)((0, dataBuilders_1.buildViewListData)(views), disclaimer));
    }
    formatViewDetails(model, view, disclaimer) {
        return toYaml((0, dataBuilders_1.withDisclaimerField)((0, dataBuilders_1.buildViewDetailsData)(model, view), disclaimer));
    }
    formatElementList(elements, disclaimer) {
        return toYaml((0, dataBuilders_1.withDisclaimerField)((0, dataBuilders_1.buildElementListData)(elements), disclaimer));
    }
    formatElementDetails(model, element, disclaimer) {
        return toYaml((0, dataBuilders_1.withDisclaimerField)((0, dataBuilders_1.buildElementDetailsData)(model, element), disclaimer));
    }
}
exports.YamlFormatter = YamlFormatter;
