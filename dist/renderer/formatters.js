"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.getFormatter = getFormatter;
const markdownFormatter_1 = require("./markdownFormatter");
const jsonFormatter_1 = require("./jsonFormatter");
const yamlFormatter_1 = require("./yamlFormatter");
const formatters = {
    markdown: new markdownFormatter_1.MarkdownFormatter(),
    json: new jsonFormatter_1.JsonFormatter(),
    yaml: new yamlFormatter_1.YamlFormatter(),
};
function getFormatter(format) {
    return formatters[format || 'markdown'] || formatters.markdown;
}
