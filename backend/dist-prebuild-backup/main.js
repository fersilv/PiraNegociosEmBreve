"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const common_1 = require("@nestjs/common");
const core_1 = require("@nestjs/core");
const app_module_1 = require("./app.module");
const express_1 = require("express");
const path_1 = require("path");
const pg_1 = require("pg");
const spa_fallback_1 = require("./spa-fallback");
function configureChromiumSandboxForWhatsApp() {
    const runningAsRoot = typeof process.getuid === 'function' && process.getuid() === 0;
    if (runningAsRoot) {
        process.env.WHATSAPP_NO_SANDBOX = 'true';
        console.warn('[WhatsApp] Backend executando como root; Chromium será iniciado com --no-sandbox.');
    }
}
async function ensureDatabaseExists() {
    const dbName = process.env.DB_NAME || 'piranegocios';
    const client = new pg_1.Client({
        host: process.env.DB_HOST || 'localhost',
        port: parseInt(process.env.DB_PORT || '5432', 10),
        user: process.env.DB_USER || 'postgres',
        password: process.env.DB_PASS || 'postgres',
        database: 'postgres',
    });
    try {
        await client.connect();
        const res = await client.query(`SELECT datname FROM pg_catalog.pg_database WHERE datname = $1`, [dbName]);
        if (res.rowCount === 0) {
            console.log(`Banco de dados "${dbName}" não encontrado. Criando...`);
            await client.query(`CREATE DATABASE "${dbName}"`);
            console.log(`Banco de dados "${dbName}" criado com sucesso!`);
        }
        else {
            console.log(`Banco de dados "${dbName}" já existe.`);
        }
    }
    catch (err) {
        console.error('Erro ao verificar/criar banco de dados:', err);
    }
    finally {
        await client.end();
    }
}
async function bootstrap() {
    configureChromiumSandboxForWhatsApp();
    await ensureDatabaseExists();
    const bodyLimit = process.env.BODY_LIMIT || '40mb';
    const resumeImportBodyLimit = process.env.RESUME_IMPORT_BODY_LIMIT || '60mb';
    const app = await core_1.NestFactory.create(app_module_1.AppModule, {
        bodyParser: false,
    });
    app.set('trust proxy', 1);
    app.setGlobalPrefix('api', {
        exclude: [
            { path: '.well-known/oauth-authorization-server', method: common_1.RequestMethod.GET },
            { path: '.well-known/openid-configuration', method: common_1.RequestMethod.GET },
            {
                path: '.well-known/oauth-protected-resource/api/whatsapp/mcp/:instanceId',
                method: common_1.RequestMethod.GET,
            },
            {
                path: '.well-known/oauth-authorization-server/jobs',
                method: common_1.RequestMethod.GET,
            },
            {
                path: '.well-known/openid-configuration/jobs',
                method: common_1.RequestMethod.GET,
            },
            {
                path: '.well-known/oauth-protected-resource/api/jobs/mcp',
                method: common_1.RequestMethod.GET,
            },
        ],
    });
    app.enableCors();
    app.use('/api/ai/analyze-resume-documents', (0, express_1.json)({ limit: resumeImportBodyLimit }));
    app.use((0, express_1.json)({ limit: bodyLimit }));
    app.use((0, express_1.urlencoded)({ limit: bodyLimit, extended: true }));
    app.useStaticAssets((0, path_1.join)(__dirname, '..', 'uploads'), {
        prefix: '/uploads/',
    });
    app.useStaticAssets((0, path_1.join)(__dirname, '..', 'uploads'), {
        prefix: '/api/uploads/',
    });
    (0, spa_fallback_1.attachSpaFallback)(app);
    await app.listen(process.env.PORT ?? 3888);
}
bootstrap();
//# sourceMappingURL=main.js.map