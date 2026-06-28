"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.JsonFormatter = void 0;
const dataBuilders_1 = require("./dataBuilders");
class JsonFormatter {
    constructor() {
        this.contentType = 'application/json';
    }
    formatViewList(views, disclaimer) {
        return JSON.stringify((0, dataBuilders_1.withDisclaimerField)((0, dataBuilders_1.buildViewListData)(views), disclaimer), null, 2);
    }
    formatViewDetails(model, view, disclaimer) {
        return JSON.stringify((0, dataBuilders_1.withDisclaimerField)((0, dataBuilders_1.buildViewDetailsData)(model, view), disclaimer), null, 2);
    }
    formatElementList(elements, disclaimer) {
        return JSON.stringify((0, dataBuilders_1.withDisclaimerField)((0, dataBuilders_1.buildElementListData)(elements), disclaimer), null, 2);
    }
    formatElementDetails(model, element, disclaimer) {
        return JSON.stringify((0, dataBuilders_1.withDisclaimerField)((0, dataBuilders_1.buildElementDetailsData)(model, element), disclaimer), null, 2);
    }
}
exports.JsonFormatter = JsonFormatter;
