import { existsSync } from 'fs';
import { join } from 'path';
import type { NestExpressApplication } from '@nestjs/platform-express';
import type { NextFunction, Request, Response } from 'express';

const API_PREFIXES = ['/api', '/uploads', '/socket.io'];

export function frontendDistPath() {
  return process.env.FRONTEND_DIST || join(__dirname, '..', '..', 'dist');
}

function isApiOrAssetRequest(pathName: string) {
  if (API_PREFIXES.some((prefix) => pathName === prefix || pathName.startsWith(`${prefix}/`))) {
    return true;
  }
  // Don't turn missing static files into the SPA shell.
  return /\.[a-zA-Z0-9]+$/.test(pathName);
}

/**
 * Nginx sometimes forwards public HTML routes (/vagas, /:empresa) to Nest.
 * Nest has no such controllers, so browsers get JSON "Cannot GET /vagas".
 * Serving the Vite index.html lets React Router take over, matching in-app clicks.
 */
export function attachSpaFallback(app: NestExpressApplication) {
  const indexHtml = join(frontendDistPath(), 'index.html');
  if (!existsSync(indexHtml)) {
    console.warn(
      `[spa-fallback] index.html não encontrado em ${indexHtml}. ` +
        'GET /vagas e perfis públicos vão continuar 404 se o Nginx mandar essas rotas para o Nest.',
    );
    return;
  }

  console.log(`[spa-fallback] SPA index em ${indexHtml}`);

  app.use((req: Request, res: Response, next: NextFunction) => {
    if (req.method !== 'GET' && req.method !== 'HEAD') return next();
    const pathName = req.path || '';
    if (isApiOrAssetRequest(pathName)) return next();
    res.setHeader('Cache-Control', 'no-cache');
    res.sendFile(indexHtml, (error) => {
      if (error) next(error);
    });
  });
}
