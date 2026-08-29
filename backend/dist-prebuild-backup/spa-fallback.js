"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.frontendDistPath = frontendDistPath;
exports.attachSpaFallback = attachSpaFallback;
const fs_1 = require("fs");
const path_1 = require("path");
const API_PREFIXES = ['/api', '/uploads', '/socket.io'];
function frontendDistPath() {
    return process.env.FRONTEND_DIST || (0, path_1.join)(__dirname, '..', '..', '..', 'dist');
}
function isApiOrAssetRequest(pathName) {
    if (API_PREFIXES.some((prefix) => pathName === prefix || pathName.startsWith(`${prefix}/`))) {
        return true;
    }
    return /\.[a-zA-Z0-9]+$/.test(pathName);
}
function attachSpaFallback(app) {
    const indexHtml = (0, path_1.join)(frontendDistPath(), 'index.html');
    if (!(0, fs_1.existsSync)(indexHtml)) {
        console.warn(`[spa-fallback] index.html não encontrado em ${indexHtml}. ` +
            'GET /vagas e perfis públicos vão continuar 404 se o Nginx mandar essas rotas para o Nest.');
        return;
    }
    console.log(`[spa-fallback] SPA index em ${indexHtml}`);
    app.use((req, res, next) => {
        if (req.method !== 'GET' && req.method !== 'HEAD')
            return next();
        const pathName = req.path || '';
        if (isApiOrAssetRequest(pathName))
            return next();
        res.setHeader('Cache-Control', 'no-cache');
        res.sendFile(indexHtml, (error) => {
            if (error)
                next(error);
        });
    });
}
//# sourceMappingURL=spa-fallback.js.map