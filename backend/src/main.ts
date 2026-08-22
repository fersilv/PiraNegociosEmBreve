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
    database: 'postgres',
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

  // Um arquivo binário de 20 MB ocupa aproximadamente 27 MB depois de virar
  // data URL/base64. O teto HTTP precisa considerar essa expansão, enquanto
  // a validação do arquivo continua limitada a 20 MB de conteúdo original.
  const bodyLimit = process.env.BODY_LIMIT || '40mb';
  const resumeImportBodyLimit = process.env.RESUME_IMPORT_BODY_LIMIT || '60mb';
  const app = await NestFactory.create<NestExpressApplication>(AppModule, {
    bodyParser: false,
  });

  app.set('trust proxy', 1);
  app.setGlobalPrefix('api');
  app.enableCors();

  app.use(
    '/api/ai/analyze-resume-documents',
    json({ limit: resumeImportBodyLimit }),
  );
  app.use(json({ limit: bodyLimit }));
  app.use(urlencoded({ limit: bodyLimit, extended: true }));

  app.useStaticAssets(join(__dirname, '..', 'uploads'), {
    prefix: '/uploads/',
  });
  app.useStaticAssets(join(__dirname, '..', 'uploads'), {
    prefix: '/api/uploads/',
  });

  attachSpaFallback(app);

  await app.listen(process.env.PORT ?? 3888);
}
bootstrap();
