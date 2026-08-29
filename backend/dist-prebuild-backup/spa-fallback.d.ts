import type { NestExpressApplication } from '@nestjs/platform-express';
export declare function frontendDistPath(): string;
export declare function attachSpaFallback(app: NestExpressApplication): void;
