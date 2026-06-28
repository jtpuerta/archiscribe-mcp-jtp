"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.appService = void 0;
const tools_1 = require("../mcp/tools");
const config_1 = require("../config");
/**
 * Singleton service to manage application dependencies
 * Prevents redundant tool creation and configuration loading
 */
class ApplicationService {
    constructor() { }
    static getInstance() {
        if (!ApplicationService.instance) {
            ApplicationService.instance = new ApplicationService();
        }
        return ApplicationService.instance;
    }
    get config() {
        if (!this._config) {
            this._config = (0, config_1.loadConfig)();
        }
        return this._config;
    }
    get tools() {
        if (!this._tools) {
            this._tools = (0, tools_1.createTools)(this.config.modelPath);
        }
        return this._tools;
    }
    /**
     * Reset the singleton (useful for testing)
     */
    reset() {
        this._config = undefined;
        this._tools = undefined;
    }
}
exports.appService = ApplicationService.getInstance();
