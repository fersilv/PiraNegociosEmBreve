import { Module } from '@nestjs/common';
import { UploadsController } from './uploads.controller';
import { MulterModule } from '@nestjs/platform-express';
import { diskStorage } from 'multer';
import { extname } from 'path';

const allowedUploadExtensions = new Set([
  '.pdf',
  '.doc',
  '.docx',
  '.jpg',
  '.jpeg',
  '.png',
  '.webp',
  '.gif',
]);

@Module({
  imports: [
    MulterModule.register({
      limits: { fileSize: 10 * 1024 * 1024, files: 1 },
      fileFilter: (_req, file, callback) => {
        const extension = extname(file.originalname).toLowerCase();
        if (!allowedUploadExtensions.has(extension)) {
          callback(new Error('Tipo de arquivo não permitido.'), false);
          return;
        }
        callback(null, true);
      },
      storage: diskStorage({
        destination: './uploads',
        filename: (req, file, cb) => {
          // Geração de um nome único para o arquivo
          const uniqueSuffix =
            Date.now() + '-' + Math.round(Math.random() * 1e9);
          const ext = extname(file.originalname).toLowerCase();
          cb(null, `${file.fieldname}-${uniqueSuffix}${ext}`);
        },
      }),
    }),
  ],
  controllers: [UploadsController],
})
export class UploadsModule {}
