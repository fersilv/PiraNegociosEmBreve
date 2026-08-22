import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { NestExpressApplication } from '@nestjs/platform-express';
import { json, urlencoded } from 'express';
import { join } from 'path';
import { Client } from 'pg';
import { attachSpaFallback } from './spa-fallback';

async function ensureDatabaseExists() {
  const dbName = process.env.DB_NAME || 'piranegocios';
  const client = new Client({
    host: process.env.DB_HOST || 'localhost',
    port: parseInt(process.env.DB_PORT || '5432', 10),
    user: process.env.DB_USER || 'postgres',
    password: process.env.DB_PASS || 'postgres',
    database: 'postgres', // Conectar ao banco padrão para checar
  });

  try {
    await client.connect();
    const res = await client.query(
      `SELECT datname FROM pg_catalog.pg_database WHERE datname = $1`,
      [dbName],
    );
    if (res.rowCount === 0) {
      console.log(`Banco de dados "${dbName}" não encontrado. Criando...`);
      await client.query(`CREATE DATABASE "${dbName}"`);
      console.log(`Banco de dados "${dbName}" criado com sucesso!`);
    } else {
      console.log(`Banco de dados "${dbName}" já existe.`);
    }
  } catch (err) {
    console.error('Erro ao verificar/criar banco de dados:', err);
  } finally {
    await client.end();
  }
}

async function bootstrap() {
  await ensureDatabaseExists();

  // O sistema ainda trafega imagens/documentos em data URLs (base64). Mantemos
  // um limite geral controlado e um teto maior somente para a importação de
  // múltiplos documentos de currículo.
  const bodyLimit = process.env.BODY_LIMIT || '30mb';
  const resumeImportBodyLimit = process.env.RESUME_IMPORT_BODY_LIMIT || '60mb';
  const app = await NestFactory.create<NestExpressApplication>(AppModule, {
    bodyParser: false,
  });

  // O Nginx termina o HTTPS; assim req.protocol preserva https ao gerar URLs.
  app.set('trust proxy', 1);
  // Public API contract. Nginx forwards /api/* unchanged to this service.
  app.setGlobalPrefix('api');

  // Habilitar CORS para o frontend em React antes dos parsers, inclusive para
  // respostas de erro de payload.
  app.enableCors();

  app.use(
    '/api/ai/analyze-resume-documents',
    json({ limit: resumeImportBodyLimit }),
  );
  app.use(json({ limit: bodyLimit }));
  app.use(urlencoded({ limit: bodyLimit, extended: true }));

  // Servir arquivos de upload estaticamente na rota /uploads
  app.useStaticAssets(join(__dirname, '..', 'uploads'), {
    prefix: '/uploads/',
  });
  // Mantém os arquivos acessíveis também por trás do proxy reverso /api.
  app.useStaticAssets(join(__dirname, '..', 'uploads'), {
    prefix: '/api/uploads/',
  });

  // Last: if Nginx sends /vagas or /:empresa here, return the SPA instead of JSON 404.
  attachSpaFallback(app);

  await app.listen(process.env.PORT ?? 3888);
}
bootstrap();
