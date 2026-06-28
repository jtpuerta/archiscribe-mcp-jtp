"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.createJsonRpcError = createJsonRpcError;
exports.sendErrorResponse = sendErrorResponse;
exports.createErrorResponse = createErrorResponse;
exports.handleMcpError = handleMcpError;
function createJsonRpcError(code, message, id = null) {
    return {
        jsonrpc: '2.0',
        error: { code, message },
        id
    };
}
function sendErrorResponse(res, error) {
    res.statusCode = error.statusCode;
    res.setHeader('content-type', error.contentType);
    res.end(error.message);
}
function createErrorResponse(statusCode, message, contentType = 'text/plain') {
    return { statusCode, contentType, message };
}
function handleMcpError(res, err) {
    console.error('Error handling /mcp request:', err);
    if (!res.headersSent) {
        const errorResponse = createJsonRpcError(-32603, 'Internal server error');
        res.statusCode = 500;
        res.setHeader('content-type', 'application/json');
        res.end(JSON.stringify(errorResponse));
    }
    else {
        try {
            res.end();
        }
        catch (_) {
            // ignore 
        }
    }
}
